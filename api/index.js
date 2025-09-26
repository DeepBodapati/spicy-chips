import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateQuestionSet } from './questionBank.js';
import { analyzeWorksheet } from './conceptExtractor.js';

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
app.post('/generate', (req, res) => {
  const { concepts = [], difficulty = 'same', count = 10, seed } = req.body || {};

  try {
    const questions = generateQuestionSet({ concepts, difficulty, count, seed });
    res.json({ questions });
  } catch (error) {
    console.error('Failed to generate questions', error);
    res.status(400).json({ error: 'Unable to generate questions right now.' });
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
app.post('/feedback', (req, res) => {
  const { question = {}, answer = {}, correct } = req.body || {};
  const type = question.type || 'text';

  let feedback = '';

  if (correct) {
    const positivePhrases = [
      'Awesome work!',
      'Great job!',
      'Nice work! Keep that streak going.',
    ];
    feedback = `${positivePhrases[Math.floor(Math.random() * positivePhrases.length)]} Ready for the next one.`;
  } else if (type === 'numeric' && typeof question.answer?.exact === 'number') {
    const expected = question.answer.exact;
    const provided = Number(answer.numeric);

    if (Number.isFinite(provided)) {
      const diff = expected - provided;
      if (Math.abs(diff) <= 2) {
        feedback = `So close! The correct answer is ${expected}. Double-check your addition or subtraction.`;
      } else {
        feedback = `Remember to work carefully through each step. The correct answer is ${expected}.`;
      }
    } else {
      feedback = `Try turning your response into a number—for example, ${expected}.`;
    }
  } else if (type === 'free_text' && Array.isArray(question.answer?.range)) {
    const [low, high] = question.answer.range;
    feedback = `Aim for a value between ${low} and ${high}. Rounding before estimating often helps.`;
  } else if (type === 'multi_part' && question.answer?.parts) {
    const parts = question.answer.parts;
    const keys = Object.keys(parts);
    const missing = keys.filter((key) => answer?.parts?.[key] === undefined);
    if (missing.length) {
      feedback = `Make sure to fill out all parts (${missing.join(', ')}).`;
    } else {
      feedback = 'Compare each rounded value to see which place value changes.';
    }
  } else {
    feedback = 'Take another look and break the problem into smaller steps.';
  }

  res.json({ feedback });
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