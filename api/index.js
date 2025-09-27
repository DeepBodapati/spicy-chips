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
    console.error('Worksheet analysis failed', error);
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
  const { concepts = [], difficulty = 'same', count = 10, seed, grade = '', analysis = null } = req.body || {};
  const conceptList = Array.isArray(concepts) ? concepts : [];

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
      });

      if (Array.isArray(llmQuestions) && llmQuestions.length) {
        questions = llmQuestions;
        source = 'llm';
        console.info('Question generation: using LLM pathway');
      }
    }

    if (!questions.length) {
      questions = generateQuestionSet({ concepts: conceptList, difficulty, count, seed });
      source = 'heuristic';
      if (process.env.OPENAI_API_KEY) {
        console.warn('Question generation: falling back to heuristic templates');
      }
    }

    res.json({ questions, source });
  } catch (error) {
    console.error('Failed to generate questions', error);
    const fallbackQuestions = generateQuestionSet({ concepts: conceptList, difficulty, count, seed });
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
      return res.json({ correct: true, feedback, source: 'deterministic' });
    }

    const hints = Array.isArray(question.hints)
      ? question.hints.filter((hint) => typeof hint === 'string' && hint.trim().length)
      : [];

    if (process.env.OPENAI_API_KEY) {
      const llmResult = await gradeWithLLM({ question, submission: deterministic.normalized, deterministic });
      if (llmResult) {
        if (llmResult.correct) {
          return res.json({ correct: true, feedback: llmResult.tip || 'Sweet! Nailed it.', source: 'llm' });
        }
        if (llmResult.tip) {
          return res.json({ correct: false, feedback: llmResult.tip, source: 'llm' });
        }
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
      const missing = keys.filter((key) => deterministic.normalized.parts[key] === undefined);
      fallbackFeedback = missing.length
        ? `Make sure to fill out all parts (${missing.join(', ')}).`
        : 'Compare each rounded value to see which place value changes.';
    } else {
      fallbackFeedback = 'Take another look and break the problem into smaller steps.';
    }

    res.json({ correct: false, feedback: fallbackFeedback, source: 'heuristic' });
  } catch (error) {
    console.error('Feedback evaluation failed', error);
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

// Default port is 3001 unless overridden by environment
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
