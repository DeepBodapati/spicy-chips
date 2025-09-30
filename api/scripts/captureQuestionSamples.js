import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateQuestionsWithLLM } from '../llmQuestionGenerator.js';
import { generateQuestionSet } from '../questionBank.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const combos = [
  {
    concepts: ['estimation strategies', 'rounding'],
    difficulty: 'same',
    count: 5,
    grade: '4',
  },
  {
    concepts: ['multi-digit multiplication'],
    difficulty: 'more',
    count: 5,
    grade: '5',
  },
  {
    concepts: ['fractions', 'word problems'],
    difficulty: 'less',
    count: 4,
    grade: '4',
  },
];

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const run = async () => {
  const samplesDir = path.join(__dirname, 'samples');
  ensureDir(samplesDir);

  const snapshot = [];

  for (const payload of combos) {
    const analysis = {
      textPreview: 'Collected from worksheet smoke sample.',
      vision: null,
      textAnalysis: null,
    };
    const enrichedPayload = { ...payload, analysis };

    const llm = await generateQuestionsWithLLM(enrichedPayload);
    const usedLlm = Array.isArray(llm) && llm.length;
    const questions = usedLlm ? llm : generateQuestionSet(enrichedPayload);

    if (!usedLlm && !process.env.OPENAI_API_KEY) {
      console.warn('Samples script fallback: OPENAI_API_KEY not set, using heuristic generator.');
    } else if (!usedLlm) {
      console.warn('Samples script fallback: LLM call returned no results, using heuristic generator.');
    }

    snapshot.push({
      requested: enrichedPayload,
      source: usedLlm ? 'llm' : 'heuristic',
      questions,
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(samplesDir, `question-samples-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(`Saved question samples to ${filePath}`);
};

run();
