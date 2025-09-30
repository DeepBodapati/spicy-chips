import { createRequire } from 'module';
import { logger } from './logger.js';

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

const buildPromptSections = ({ concepts, difficulty, count, grade, analysis, history, seed }) => {
  const CONCEPT_GUIDANCE = [
    { pattern: /fraction/i, note: 'Fractions: use friendly denominators (2, 3, 4, 5, 8) and ask for part-of-a-set or explaining why a fraction is larger.' },
    { pattern: /estimation/i, note: 'Estimation: require rounding before computing and answer.range that captures a sensible low/high window.' },
    { pattern: /round/i, note: 'Rounding: ask for nearest ten/hundred (or thousand) and use type "multi_part" when multiple places are requested.' },
    { pattern: /word problem/i, note: 'Word problems: include a short story context and encourage one-step or two-step reasoning tied to the concept.' },
    { pattern: /geometry|area|perimeter|volume/i, note: 'Geometry: give dimensions in whole numbers and ask for area, perimeter, or volume with clear units.' },
    { pattern: /division/i, note: 'Division: present equal groups or sharing scenarios; answers should be whole numbers for this grade band.' },
    { pattern: /multiplication|product/i, note: 'Multiplication: use two- or three-digit factors appropriate for the grade and highlight strategies like area model or distributive property.' },
    { pattern: /addition|subtraction|sum|difference/i, note: 'Addition/Subtraction: mix regrouping practice and friendly numbers; encourage checking with inverse operations.' },
  ];

  const topicPlan = concepts.length
    ? Array.from({ length: count }, (_, index) => concepts[index % concepts.length])
    : Array(count).fill('mixed practice');

  const conceptLine = topicPlan
    .map((topic, index) => `${index + 1}. ${topic}`)
    .join('\n');

  const notedConcepts = new Set();
  const conceptNotes = [];
  topicPlan.forEach((topic) => {
    if (!topic || notedConcepts.has(topic)) {
      return;
    }
    notedConcepts.add(topic);
    const guidance = CONCEPT_GUIDANCE.find((entry) => entry.pattern.test(topic));
    if (guidance) {
      conceptNotes.push(`- ${guidance.note}`);
    }
  });

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

Session seed: ${seed || 'not-provided'}. Use it to diversify numbers, contexts, and names.

Topic plan:
${conceptLine}

Concept reminders (apply when relevant):
${conceptNotes.length ? conceptNotes.join('\n') : '- Keep questions aligned to the listed topics.'}

Rules:
- Vary the wording to keep questions fun but brief (1-2 sentences).
- Keep numbers reasonable for the grade. Use whole numbers unless estimation specifically calls for ranges.
- Include 1-2 friendly hints focused on strategy. Hints must NOT reveal the exact answer.
- Each question must include the keys: prompt, type, answer, hints, concept.
- type must be one of: "numeric", "free_text", "multi_part".
- For numeric questions, provide answer.exact as a number.
- For estimation questions, set type to "free_text" with answer.range [min, max] using two numbers.
- For multi-part rounding or comparisons, set type to "multi_part" with answer.parts where each key is a descriptive string (e.g., "nearest_ten") mapped to a number.
- Concepts must exactly match the topic assigned for that question.
- Provide between 1 and 3 hints. Keep each hint under 120 characters.
- Avoid reusing numbers, story contexts, or wording from the recent prompts list.

Negative patterns to avoid:
- Do not repeat the same numbers or context more than once.
- Do not list multiple questions inside a single prompt.
- Do not leak the exact answer inside the hint or prompt.
- Do not default every question to plain addition/subtraction if the topic says otherwise.
- Do not invent new keys or camelCase variations.

Positive variety cues:
- Rotate through real-world hooks (classroom, sports, kitchen, games).
- Mix single-step and short multi-step reasoning when the topic allows.
- Let estimation questions report clear low/high bounds, not exact answers.

Schema example (do not copy the numbers; keep the structure):
{
  "questions": [
    {
      "prompt": "Lena collects 23 stickers and buys 18 more. How many does she have now?",
      "type": "numeric",
      "concept": "addition strategies",
      "answer": { "exact": 41 },
      "hints": ["Add tens first, then ones.", "Check by adding 20 + 10 and the leftovers."]
    },
    {
      "prompt": "Estimate 287 + 299 by rounding.",
      "type": "free_text",
      "concept": "estimation strategies",
      "answer": { "range": [560, 600] },
      "hints": ["Round each number to the nearest ten first."]
    },
    {
      "prompt": "Round 468 to the nearest ten and hundred.",
      "type": "multi_part",
      "concept": "rounding",
      "answer": { "parts": { "nearest_ten": 470, "nearest_hundred": 500 } },
      "hints": ["Check the digit one place to the right."]
    }
  ]
}
`;

  const trimmedHistory = Array.isArray(history)
    ? history
        .map((item) => (typeof item === 'string' ? item : null))
        .filter((item) => item && item.trim().length)
        .slice(-10)
    : [];

  const historyBlock = trimmedHistory.length
    ? `Recent prompts (avoid mimicking these exactly):\n${trimmedHistory
        .map((prompt, idx) => `${idx + 1}. ${prompt.trim()}`)
        .join('\n')}\n`
    : 'No prior prompts were provided.';

  const messages = [
    {
      role: 'system',
      content: [
        { type: 'input_text', text: instructions },
        { type: 'input_text', text: historyBlock },
      ],
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
  let answer = item.answer;
  if (typeof answer === 'number') {
    answer = { exact: answer };
  } else if (Array.isArray(answer) && rawType === 'free_text' && answer.length === 2) {
    answer = { range: answer.map(Number) };
  }
  answer = answer || {};
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

  const rawHints = Array.isArray(item.hints)
    ? item.hints
    : typeof item.hints === 'string' && item.hints.trim().length
    ? [item.hints]
    : [];
  const hints = rawHints.length
    ? rawHints
        .map((hint) => (typeof hint === 'string' ? hint.trim() : ''))
        .filter((hint) => hint.length)
        .slice(0, 3)
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

export const generateQuestionsWithLLM = async ({ concepts = [], difficulty = 'same', count = 5, grade = '', analysis = null, history = [], seed = '' }) => {
  const apiClient = getClient();
  if (!apiClient) {
    return null;
  }

  try {
    const safeCount = Math.max(1, Math.min(Number(count) || 5, 45));
    const safeConcepts = Array.isArray(concepts) && concepts.length ? concepts : ['mixed practice'];
    const attemptAnalyses = analysis ? [analysis, null] : [analysis];
    let lastTopicPlan = [];
    for (let attempt = 0; attempt < attemptAnalyses.length; attempt += 1) {
      const { messages, topicPlan } = buildPromptSections({
        concepts: safeConcepts,
        difficulty,
        count: safeCount,
        grade,
        analysis: attemptAnalyses[attempt],
        history,
        seed,
      });
      lastTopicPlan = topicPlan;

      try {
        const response = await apiClient.responses.create({
          model: MODEL,
          input: messages,
          text: {
            format: { type: 'json_object' },
          },
        });

        const content = response.output_text || response.output?.[0]?.content?.[0]?.text;
        if (!content) {
          continue;
        }

        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed.questions) || !parsed.questions.length) {
          continue;
        }

        const normalized = parsed.questions
          .slice(0, safeCount)
          .map((item, index) => normalizeQuestion(item, index, { topicPlan, difficulty }))
          .filter(Boolean);

        if (normalized.length) {
          logger.debug('llm.generate.questions.normalized', { count: normalized.length });
          return normalized;
        }
      } catch (innerError) {
        logger.warn('llm.generate.questions.attempt_failed', {
          attempt,
          analysisProvided: Boolean(attemptAnalyses[attempt]),
          error: innerError.message,
        });
      }
    }

    if (lastTopicPlan.length) {
      logger.warn('llm.generate.questions.empty', {
        concepts: safeConcepts,
        difficulty,
        count: safeCount,
      });
    }

    return null;
  } catch (error) {
    logger.error('llm.generate.questions.error', { error: error.message });
    return null;
  }
};
