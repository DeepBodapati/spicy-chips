import express from 'express';
import cors from 'cors';

const app = express();

// Allow JSON parsing and cross‑origin requests.  Replace the origin with your
// deployed front end domain in production.
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

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
app.post('/analyze', (req, res) => {
  // TODO: perform OCR on the uploaded worksheet and infer concepts
  res.json({ concepts: [] });
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
  const { concepts = [], difficulty = 'same', count = 10 } = req.body;
  // TODO: call LLM to generate `count` questions according to `concepts` and `difficulty`
  res.json({ questions: [] });
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
  const { question, answer } = req.body;
  // TODO: provide tailored feedback using LLM
  res.json({ feedback: 'Nice try! Keep going.' });
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
  // TODO: generate a signed URL using the storage provider of your choice
  res.json({ url: 'https://example.com/upload' });
});

// Default port is 3001 unless overridden by environment
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});