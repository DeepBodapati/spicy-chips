import { createRequire } from 'module';
import { logger } from './logger.js';

const require = createRequire(import.meta.url);
const OpenAI = require('openai');

const MODEL = process.env.OPENAI_JUDGE_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

let client = null;
const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!client) {
    client = new OpenAI.OpenAI({ apiKey });
  }
  return client;
};

const EXAMPLES = [
  {
    prompt: 'Mia runs 3 laps around the track and each lap is 400 meters. How many meters does she run in total?',
    expected: '1200',
    submission: '1200',
    verdict: 'correct',
    tip: 'Nice job multiplying laps by distance!',
    deterministic: 'CORRECT',
  },
  {
    prompt: 'Estimate the sum of 289 + 614 by rounding to the nearest hundred before adding.',
    expected: 'Around 900',
    submission: '903',
    verdict: 'incorrect',
    tip: 'Round each number first (300 + 600) before adding to stay close to the worksheet strategy.',
    deterministic: 'INCORRECT',
  },
  {
    prompt: 'Round 862 to the nearest ten and the nearest hundred.',
    expected: '{"nearest_ten": 860, "nearest_hundred": 900}',
    submission: '860, 800',
    verdict: 'incorrect',
    tip: 'Check each place value separately: tens place 6 rounds up to 860; hundreds place 8 rounds up to 900.',
    deterministic: 'INCORRECT',
  },
  {
    prompt: 'Explain how you know 48 is divisible by 6 without using long division.',
    expected: 'Use divisibility by 3 and the fact that it is even.',
    submission: '48 is even and 4 + 8 = 12 which is divisible by 3, so the number is divisible by both 2 and 3.',
    verdict: 'correct',
    tip: 'Great reasoning—checking divisibility by 2 and 3 is perfect for 6.',
    deterministic: 'INCORRECT',
  },
  {
    prompt: 'Explain why 35 is not a multiple of 4.',
    expected: 'Multiples of 4 jump by 4 (32, 36), so 35 is skipped.',
    submission: 'Multiples of 4 go 32, 36, 40, so 35 isn’t on the list.',
    verdict: 'correct',
    tip: 'Nice job using the pattern of multiples to explain it.',
    deterministic: 'INCORRECT',
  },
];

const buildJudgePrompt = ({ question, submission, deterministic }) => {
  const details = [];
  if (question.answer?.exact !== undefined) {
    details.push(`Exact answer: ${question.answer.exact}`);
  }
  if (Array.isArray(question.answer?.range)) {
    details.push(`Acceptable range: [${question.answer.range[0]}, ${question.answer.range[1]}]`);
  }
  if (question.answer?.parts && typeof question.answer.parts === 'object') {
    details.push(
      `Required parts (name:value): ${Object.entries(question.answer.parts)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ')}`
    );
  }

  const conceptLine = question.concept ? `Concept focus: ${question.concept}.` : '';
  const difficultyLine = question.difficulty ? `Target difficulty: ${question.difficulty}.` : '';
  const reasoningRequired =
    question.type === 'free_text' &&
    ((Array.isArray(question.answer?.range) && question.answer.range[0] === 0 && question.answer.range[1] === 0) ||
      /explain|why|describe|strategy/i.test(question.prompt || ''));

  const exampleBlock = EXAMPLES.map((example, index) => `Example ${index + 1}:
Question: ${example.prompt}
Student submission: ${example.submission}
Deterministic hint: ${example.deterministic}
Expected evaluation: ${example.verdict.toUpperCase()}
Coach-style feedback: ${example.tip}`).join('\n\n');

  return `You are grading a student's short math answer.
${conceptLine} ${difficultyLine}
Question type: ${question.type}.
Question prompt:
"""
${question.prompt}
"""

Expected answer data:
${details.length ? details.join('\n') : 'No structured answer provided.'}

Student submission:
"""
${submission.raw || submission.text || ''}
"""
Parsed numeric value (if available): ${submission.numeric ?? 'none'}
Parsed parts: ${JSON.stringify(submission.parts || {})}
Deterministic check says the answer is ${deterministic.correct ? 'CORRECT' : 'INCORRECT'}.
Reasoning question: ${reasoningRequired ? 'YES' : 'NO'}

Follow this rubric:
- Respect the deterministic signal unless the submission clearly contradicts the structured answer. If the reasoning shows the student is right, override the deterministic hint.
- Only mark CORRECT when the response satisfies the answer or falls inside the expected range.
- Offer encouraging, strategy-focused feedback that avoids giving away the exact answer.
- When Reasoning question is YES, focus on the explanation. If the student cites valid properties or steps that prove the claim, mark CORRECT even if no numeric value is supplied or the deterministic hint says incorrect.

Reference style examples:
${exampleBlock}

Treat the deterministic result as a hint only—it can be wrong whenever the structured answer is missing or too strict. If the student reasoning is mathematically sound, mark it correct even if the deterministic flag says otherwise.

Return strict JSON with:
- correct: boolean
- tip: string (do NOT reveal the exact answer; give strategy advice)
`;
};

export const gradeWithLLM = async ({ question, submission, deterministic }) => {
  const apiClient = getClient();
  if (!apiClient) {
    return null;
  }

  try {
    const prompt = buildJudgePrompt({ question, submission, deterministic });

    const response = await apiClient.responses.create({
      model: MODEL,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: prompt }] },
      ],
      text: { format: { type: 'json_object' } },
    });

    const content = response.output_text || response.output?.[0]?.content?.[0]?.text;
    if (!content) {
      throw new Error('Empty judge response');
    }

    const parsed = JSON.parse(content);
    if (typeof parsed.correct !== 'boolean') {
      throw new Error('Judge response missing boolean correct');
    }

    return {
      correct: parsed.correct,
      tip: typeof parsed.tip === 'string' && parsed.tip.trim().length ? parsed.tip.trim() : null,
    };
  } catch (error) {
    logger.error('llm.judge.error', { error: error.message });
    return null;
  }
};
