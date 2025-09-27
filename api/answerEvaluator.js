export const normalizeSubmission = (submission = {}) => {
  if (!submission || typeof submission !== 'object') {
    return { raw: '', text: '', numeric: null, parts: {} };
  }

  const raw = typeof submission.raw === 'string' ? submission.raw : '';
  const text = typeof submission.text === 'string' ? submission.text : raw;
  const numeric = typeof submission.numeric === 'number' && Number.isFinite(submission.numeric)
    ? submission.numeric
    : (() => {
        const match = String(raw ?? '').match(/-?\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : null;
      })();

  const parts = {};
  if (submission.parts && typeof submission.parts === 'object') {
    Object.entries(submission.parts).forEach(([key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        parts[key] = value;
      }
    });
  }

  return { raw, text, numeric, parts };
};

export const evaluateDeterministic = ({ question, submission }) => {
  if (!question) {
    return { correct: false, reason: 'no-question', normalized: normalizeSubmission(submission) };
  }

  const normalized = normalizeSubmission(submission);
  const type = question.type || 'text';
  let correct = false;

  if (type === 'numeric') {
    if (typeof question.answer?.exact === 'number' && Number.isFinite(normalized.numeric)) {
      correct = normalized.numeric === question.answer.exact;
    }
  } else if (type === 'free_text') {
    if (
      Array.isArray(question.answer?.range) &&
      question.answer.range.length === 2 &&
      question.answer.range.every((value) => typeof value === 'number') &&
      Number.isFinite(normalized.numeric)
    ) {
      const [low, high] = question.answer.range;
      correct = normalized.numeric >= low && normalized.numeric <= high;
    }
  } else if (type === 'multi_part') {
    const expectedParts = question.answer?.parts || {};
    const expectedKeys = Object.keys(expectedParts);
    if (expectedKeys.length) {
      correct = expectedKeys.every((key) => normalized.parts[key] === expectedParts[key]);
    }
  } else if (typeof question.answer?.exact === 'string') {
    correct = normalized.text.trim().toLowerCase() === question.answer.exact.trim().toLowerCase();
  }

  return { correct, reason: 'deterministic', normalized };
};
