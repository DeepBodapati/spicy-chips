import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const OpenAI = require('openai');

const MODEL = process.env.OPENAI_QUESTION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

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

const clampText = (value = '', max = 800) => {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}…` : value;
};

const buildPromptSections = ({ concepts, difficulty, count, grade, analysis }) => {
  const topicPlan = concepts.length
    ? Array.from({ length: count }, (_, index) => concepts[index % concepts.length])
    : Array(count).fill('mixed practice');

  const conceptLine = topicPlan
    .map((topic, index) => `${index + 1}. ${topic}`)
    .join('\n');

  const difficultyNote =
    difficulty === 'less'
      ? 'Make each problem slightly easier than the worksheet—smaller numbers, single-step thinking.'
      : difficulty === 'more'
      ? 'Make each problem a notch harder than the worksheet—push multi-step reasoning or larger numbers, but stay appropriate for the grade.'
      : 'Match the worksheet difficulty—similar numbers and complexity.';

  const gradeLine = grade ? `These questions are for a student in grade ${grade}.` : 'Grade level is unknown. Assume late elementary math.';

  const analysisSnippets = [];
  if (analysis?.vision?.difficulty_notes) {
    analysisSnippets.push(`Worksheet difficulty notes: ${analysis.vision.difficulty_notes}`);
  } else if (analysis?.textAnalysis?.difficulty_notes) {
    analysisSnippets.push(`Worksheet difficulty notes: ${analysis.textAnalysis.difficulty_notes}`);
  }
  const numberInfo = analysis?.vision?.numbers || analysis?.textAnalysis?.numbers;
  if (numberInfo && (Number.isFinite(numberInfo.min) || Number.isFinite(numberInfo.max))) {
    const min = Number.isFinite(numberInfo.min) ? numberInfo.min : 'unknown';
    const max = Number.isFinite(numberInfo.max) ? numberInfo.max : 'unknown';
    analysisSnippets.push(`Typical number range spotted: min ${min}, max ${max}.`);
  }
  const observation = analysis?.vision?.observations?.[0] || analysis?.textAnalysis?.observations?.[0];
  if (observation) {
    analysisSnippets.push(`Worksheet observation: ${clampText(observation, 200)}`);
  }
  if (analysis?.textPreview) {
    analysisSnippets.push(`Extracted text sample: ${clampText(analysis.textPreview, 280)}`);
  }

  const analysisBlock = analysisSnippets.length ? analysisSnippets.join('\n') : 'No worksheet details were provided.';

  const instructions = `You are a math tutor creating kid-friendly practice questions.
${gradeLine}
Difficulty guidance: ${difficultyNote}
Generate exactly ${count} questions using the topic order below. Rotate through the list so each concept shows up fairly.

Topic plan:
${conceptLine}

Rules:
- Vary the wording to keep questions fun but brief (1-2 sentences).
- Keep numbers reasonable for the grade. Use whole numbers unless estimation specifically calls for ranges.
- Include 1-2 friendly hints focused on strategy. Hints must NOT reveal the exact answer.
- Use the following keys for every question: prompt, type, answer, hints, concept.
- Stick to JSON only; do not add extra fields beyond those keys.
- For estimation questions, set type to "free_text" with answer.range [min, max].
- For rounding questions with two parts, use type "multi_part" and provide named parts like { "nearest_ten": 130, "nearest_hundred": 100 }.
- For standard calculation questions, use type "numeric" with answer.exact.
- Prefer "numeric" or "free_text" types. Use "multi_part" only when you supply named numeric parts.
- Concepts should mirror the assigned topic for each question.`;

  const messages = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: instructions }],
    },
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `Worksheet summary:\n${analysisBlock}\nReturn JSON only in the form { "questions": [...] }.`,
        },
      ],
    },
  ];

  return { messages, topicPlan };
};

const normalizeQuestion = (item, index, { topicPlan, difficulty }) => {
  const promptText = item?.prompt || item?.question;
  if (!promptText) {
    return null;
  }
  const rawType = typeof item.type === 'string' ? item.type.toLowerCase() : '';
  let type = ['numeric', 'multi_part', 'free_text'].includes(rawType) ? rawType : 'numeric';
  const answer = item.answer || {};
  let normalizedAnswer;

  if (type === 'numeric') {
    if (typeof answer.exact !== 'number' || Number.isNaN(answer.exact)) {
      if (Array.isArray(answer.range) && answer.range.length === 2) {
        type = 'free_text';
        normalizedAnswer = { range: answer.range.map(Number) };
      } else {
        return null;
      }
    } else {
      normalizedAnswer = { exact: answer.exact };
    }
  }

  if (type === 'free_text' && !normalizedAnswer) {
    if (!Array.isArray(answer.range) || answer.range.length !== 2 || answer.range.some((value) => typeof value !== 'number')) {
      if (typeof answer.exact === 'number') {
        type = 'numeric';
        normalizedAnswer = { exact: answer.exact };
      } else {
        return null;
      }
    } else {
      normalizedAnswer = { range: answer.range.map(Number) };
    }
  }

  if (type === 'multi_part') {
    const parts = {};
    Object.entries(answer.parts || {}).forEach(([key, value]) => {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        parts[key] = value;
      }
    });
    if (!Object.keys(parts).length) {
      if (Array.isArray(answer.range) && answer.range.length === 2) {
        type = 'free_text';
        normalizedAnswer = { range: answer.range.map(Number) };
      } else if (typeof answer.exact === 'number') {
        type = 'numeric';
        normalizedAnswer = { exact: answer.exact };
      } else {
        return null;
      }
    } else {
      normalizedAnswer = { parts };
    }
  }

  const hints = Array.isArray(item.hints) && item.hints.length
    ? item.hints.slice(0, 2)
    : ['Take it step by step.', 'Double-check your work.'];

  const concept = item.concept?.trim() || topicPlan[index] || topicPlan[0] || 'mixed practice';

  return {
    id: `llm-${index + 1}`,
    concept,
    difficulty,
    type,
    prompt: promptText.trim(),
    answer: normalizedAnswer,
    hints,
  };
};

export const generateQuestionsWithLLM = async ({ concepts = [], difficulty = 'same', count = 5, grade = '', analysis = null }) => {
  const apiClient = getClient();
  if (!apiClient) {
    return null;
  }

  try {
    const safeCount = Math.max(1, Math.min(Number(count) || 5, 15));
    const safeConcepts = Array.isArray(concepts) && concepts.length ? concepts : ['mixed practice'];
    const { messages, topicPlan } = buildPromptSections({ concepts: safeConcepts, difficulty, count: safeCount, grade, analysis });

    const response = await apiClient.responses.create({
      model: MODEL,
      input: messages,
      text: {
        format: { type: 'json_object' },
      },
    });

    const content = response.output_text || response.output?.[0]?.content?.[0]?.text;
    if (!content) {
      throw new Error('Empty LLM response for questions');
    }

    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.questions) || !parsed.questions.length) {
      throw new Error('LLM response missing questions array');
    }

    const normalized = parsed.questions
      .slice(0, safeCount)
      .map((item, index) => normalizeQuestion(item, index, { topicPlan, difficulty }))
      .filter(Boolean);

    return normalized;
  } catch (error) {
    console.error('LLM question generation failed', error);
    return null;
  }
};
