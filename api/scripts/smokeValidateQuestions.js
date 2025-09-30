import 'dotenv/config';
import { generateQuestionsWithLLM } from '../llmQuestionGenerator.js';
import { generateQuestionSet } from '../questionBank.js';

const run = async () => {
  const payload = {
    concepts: ['estimation strategies', 'rounding'],
    difficulty: 'same',
    count: 4,
    grade: '4',
    analysis: {
      textPreview: 'Worksheet mixes estimation and rounding with numbers up to 800.',
      vision: null,
      textAnalysis: null,
    },
  };

  const llm = await generateQuestionsWithLLM(payload);
  const usedLlm = Array.isArray(llm) && llm.length;
  const questions = usedLlm ? llm : generateQuestionSet(payload);

  if (!usedLlm && !process.env.OPENAI_API_KEY) {
    console.warn('Skipping LLM generation in smoke test: OPENAI_API_KEY is not set.');
  }

  const errors = [];
  const warnings = [];
  const seenConcepts = new Set();

  const validateAnswerShape = (question, idx) => {
    if (question.type === 'numeric') {
      if (typeof question.answer?.exact !== 'number' || Number.isNaN(question.answer.exact)) {
        errors.push(`Question ${idx} numeric type missing numeric answer.exact`);
      }
    } else if (question.type === 'free_text') {
      if (!Array.isArray(question.answer?.range) || question.answer.range.length !== 2) {
        errors.push(`Question ${idx} free_text type missing answer.range[2]`);
      }
    } else if (question.type === 'multi_part') {
      const parts = question.answer?.parts;
      if (!parts || typeof parts !== 'object' || !Object.keys(parts).length) {
        errors.push(`Question ${idx} multi_part type missing answer.parts`);
      }
    }
  };

  questions.forEach((q, idx) => {
    if (!q.prompt || typeof q.prompt !== 'string') errors.push(`Question ${idx} missing prompt`);
    if (!['numeric', 'free_text', 'multi_part'].includes(q.type)) errors.push(`Question ${idx} has invalid type ${q.type}`);
    if (!Array.isArray(q.hints) || !q.hints.length) errors.push(`Question ${idx} missing hints`);
    if (!q.answer || typeof q.answer !== 'object') errors.push(`Question ${idx} missing answer`);
    if (!q.concept || typeof q.concept !== 'string') errors.push(`Question ${idx} missing concept`);
    if (Array.isArray(q.hints) && q.answer?.exact !== undefined) {
      q.hints.forEach((hint) => {
        if (typeof hint === 'string' && String(q.answer.exact).length && hint.includes(String(q.answer.exact))) {
          warnings.push(`Question ${idx} hint may reveal answer value`);
        }
      });
    }
    validateAnswerShape(q, idx);
    seenConcepts.add(q.concept);
  });

  if (errors.length) {
    console.error('Question validation failed:', errors.join('; '));
    process.exit(1);
  }

  if (warnings.length) {
    console.warn('Warnings (non-blocking):', warnings.join('; '));
  }

  console.log(`Question smoke test passed using ${usedLlm ? 'LLM' : 'heuristic'} generator.`);
  console.log('Concept coverage:', Array.from(seenConcepts).join(', ') || 'none');
  console.log('Sample prompts:', questions.map((q) => q.prompt));
};

run();
