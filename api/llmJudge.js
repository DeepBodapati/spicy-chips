import { createRequire } from 'module';

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
    console.error('LLM judgment failed', error);
    return null;
  }
};
