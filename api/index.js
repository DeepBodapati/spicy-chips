import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateQuestionSet } from './questionBank.js';
import { generateQuestionsWithLLM } from './llmQuestionGenerator.js';
import { analyzeWorksheet } from './conceptExtractor.js';
import { evaluateDeterministic } from './answerEvaluator.js';
import { gradeWithLLM } from './llmJudge.js';
import { logger } from './logger.js';
import { telemetry } from './telemetry.js';

const FEEDBACK_CACHE_LIMIT = 200;
const llmFeedbackCache = new Map();

const buildFeedbackCacheKey = (question = {}, normalizedSubmission = {}) => {
  const base = question.id || question.prompt || 'unknown-question';
  const keyPayload = {
    text: typeof normalizedSubmission.text === 'string' ? normalizedSubmission.text.trim().toLowerCase() : '',
    numeric: Number.isFinite(normalizedSubmission.numeric) ? normalizedSubmission.numeric : null,
    parts: normalizedSubmission.parts || {},
  };
  return `${base}::${JSON.stringify(keyPayload)}`;
};

const rememberFeedback = (key, value) => {
  if (!key) return;
  if (llmFeedbackCache.size >= FEEDBACK_CACHE_LIMIT) {
    const firstKey = llmFeedbackCache.keys().next().value;
    llmFeedbackCache.delete(firstKey);
  }
  llmFeedbackCache.set(key, { ...value, cachedAt: Date.now() });
};

const app = express();

// Allow JSON parsing and cross‑origin requests.  Replace the origin with your
// deployed front end domain in production.
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, 'uploads');

app.use(express.json());
app.use('/uploads', express.static(uploadDir));
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    cb(null, `${base || 'upload'}-${timestamp}-${randomSuffix}${ext}`);
  },
});

const upload = multer({ storage });

/**
 * POST /analyze
 *
 * Accepts a request body with information about an uploaded worksheet.  It
 * should extract text via OCR and determine the math concepts present.
 *
 * Request body:
 * {
 *   url: string  // URL of the uploaded file or data URI
 * }
 *
 * Response:
 * {
 *   concepts: string[]
 * }
 */
app.post('/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;

  res.json({
    fileUrl,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  });
});

app.post('/analyze', async (req, res) => {
  const { url = '', originalName = '', size = 0, mimeType = '', grade = '' } = req.body || {};

  try {
    const analysis = await analyzeWorksheet({ url, mimeType, originalName, uploadDir, grade });
    res.json({
      concepts: analysis.concepts,
      originalName,
      size,
      mimeType,
      grade,
      textPreview: analysis.textPreview,
      ocrSource: analysis.ocrSource,
      vision: analysis.vision || null,
      textAnalysis: analysis.textAnalysis || null,
    });
  } catch (error) {
    logger.error('Worksheet analysis failed', { error: error.message, stack: error.stack });
    res.json({ concepts: ['addition', 'subtraction'], originalName, size, mimeType, grade, note: 'analysis-fallback' });
  }
});

/**
 * POST /generate
 *
 * Generates a list of questions based on selected concepts and difficulty.
 *
 * Request body:
 * {
 *   concepts: string[],
 *   difficulty: 'less' | 'same' | 'more',
 *   count: number
 * }
 *
 * Response:
 * {
 *   questions: any[]
 * }
 */
app.post('/generate', async (req, res) => {
  const {
    concepts = [],
    difficulty = 'same',
    count = 10,
    seed = '',
    grade = '',
    analysis = null,
    history = [],
  } = req.body || {};
  const conceptList = Array.isArray(concepts) ? concepts : [];

  logger.info('generate:request.received', {
    concepts: conceptList,
    difficulty,
    count,
    grade,
    history_size: Array.isArray(history) ? history.length : 0,
    seed: seed || null,
  });

  try {
    let questions = [];
    let source = 'heuristic';

    if (process.env.OPENAI_API_KEY) {
      const llmQuestions = await generateQuestionsWithLLM({
        concepts: conceptList,
        difficulty,
        count,
        grade,
        analysis,
        history,
        seed,
      });

      if (Array.isArray(llmQuestions) && llmQuestions.length) {
        questions = llmQuestions;
        source = 'llm';
        source = 'llm';
        logger.info('generate:llm.success', { concepts: conceptList, difficulty, count: questions.length, grade });
      }
    }

    if (!questions.length) {
      logger.warn('generate:llm.fallback', {
        concepts: conceptList,
        difficulty,
        count,
        reason: 'llm-empty',
      });
      questions = generateQuestionSet({ concepts: conceptList, difficulty, count, seed });
      source = 'heuristic';
      if (process.env.OPENAI_API_KEY) {
        logger.warn('generate:heuristic.used', { concepts: conceptList, difficulty, count });
      }
    }

    telemetry.incrementQuestion(source === 'llm' ? 'llm' : 'heuristic');
    res.json({ questions, source });
  } catch (error) {
    logger.error('generate:error', { error: error.message, stack: error.stack, concepts: conceptList, difficulty, count, grade });
    const fallbackQuestions = generateQuestionSet({ concepts: conceptList, difficulty, count, seed });
    telemetry.incrementQuestion('heuristic');
    res.status(200).json({ questions: fallbackQuestions, source: 'heuristic', note: 'generate-fallback' });
  }
});

/**
 * POST /feedback
 *
 * Returns hints or explanations for a given question and user answer.
 *
 * Request body:
 * {
 *   question: object,
 *   answer: any
 * }
 *
 * Response:
 * {
 *   feedback: string
 * }
 */
app.post('/feedback', async (req, res) => {
  const { question = {}, submission = {} } = req.body || {};

  try {
    const deterministic = evaluateDeterministic({ question, submission });

    if (deterministic.correct) {
      const positivePhrases = [
        'Awesome work!',
        'Great job!',
        'Nice work! Keep that streak going.',
      ];
      const feedback = `${positivePhrases[Math.floor(Math.random() * positivePhrases.length)]} Ready for the next one.`;
      telemetry.incrementJudge('deterministic');
      return res.json({ correct: true, feedback, source: 'deterministic' });
    }

    const hints = Array.isArray(question.hints)
      ? question.hints.filter((hint) => typeof hint === 'string' && hint.trim().length)
      : [];

    const normalizedSubmission = deterministic.normalized || {};
    const cacheKey = buildFeedbackCacheKey(question, normalizedSubmission);

    if (process.env.OPENAI_API_KEY) {
      const cached = llmFeedbackCache.get(cacheKey);
      if (cached) {
        telemetry.incrementJudge('llm_cache');
        return res.json({ correct: cached.correct, feedback: cached.feedback, source: 'llm-cache' });
      }

      const llmResult = await gradeWithLLM({ question, submission: normalizedSubmission, deterministic });
      if (llmResult) {
        const tip = typeof llmResult.tip === 'string' && llmResult.tip.trim().length
          ? llmResult.tip.trim()
          : llmResult.correct
          ? 'Sweet! Nailed it.'
          : 'Explain how you approached it, then try again with that strategy.';
        const llmPayload = { correct: Boolean(llmResult.correct), feedback: tip, source: 'llm' };
        rememberFeedback(cacheKey, llmPayload);
        telemetry.incrementJudge('llm');
        return res.json(llmPayload);
      }
    }

    let fallbackFeedback = '';
    if (hints.length) {
      fallbackFeedback = hints[Math.floor(Math.random() * hints.length)];
    } else if (question.type === 'numeric') {
      fallbackFeedback = 'Stack the numbers and work carefully through each place value.';
    } else if (question.type === 'free_text') {
      fallbackFeedback = 'Round first, then estimate—getting close is the goal.';
    } else if (question.type === 'multi_part' && question.answer?.parts) {
      const keys = Object.keys(question.answer.parts || {});
      const submittedParts = normalizedSubmission.parts || {};
      const missing = keys.filter((key) => submittedParts[key] === undefined);
      fallbackFeedback = missing.length
        ? `Make sure to fill out all parts (${missing.join(', ')}).`
        : 'Compare each rounded value to see which place value changes.';
    } else {
      fallbackFeedback = 'Take another look and break the problem into smaller steps.';
    }

    telemetry.incrementJudge('heuristic');
    res.json({ correct: false, feedback: fallbackFeedback, source: 'heuristic' });
  } catch (error) {
    logger.error('feedback:error', { error: error.message, stack: error.stack, questionId: question?.id });
    telemetry.incrementJudge('error');
    res.status(200).json({ correct: false, feedback: 'We had trouble checking this one. Try again!', source: 'error' });
  }
});

/**
 * POST /sign-upload
 *
 * Returns a signed upload URL.  In production this should generate a short‑
 * lived signed URL for a cloud storage bucket where parents can upload
 * worksheets.
 *
 * Response:
 * {
 *   url: string
 * }
 */
app.post('/sign-upload', (req, res) => {
  const uploadUrl = `${req.protocol}://${req.get('host')}/upload`;
  res.json({ uploadUrl, method: 'POST', fields: {} });
});

app.get('/metrics', (req, res) => {
  res.json({
    status: 'ok',
    telemetry: telemetry.snapshot(),
  });
});

// Default port is 3001 unless overridden by environment
const port = process.env.PORT || 3001;
app.listen(port, () => {
  logger.info('api.start', { port });
});
