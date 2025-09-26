import React, { useState } from 'react';

/**
 * QuestionView renders a single question and collects the learner's response.
 * It normalizes the answer and forwards it to the parent via `onSubmit`, which
 * may perform grading, feedback lookups, or navigation.
 */
const QuestionView = ({ q, onSubmit }) => {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  if (!q) {
    return null;
  }

  const handleChange = (event) => {
    setValue(event.target.value);
  };

  const buildSubmission = () => {
    const trimmed = value.trim();
    const submission = {
      raw: value,
      text: value,
    };
    let correct = false;

    if (q.type === 'numeric') {
      const parsed = Number(trimmed);
      submission.numeric = Number.isFinite(parsed) ? parsed : undefined;
      if (typeof q.answer?.exact === 'number' && Number.isFinite(parsed)) {
        correct = parsed === q.answer.exact;
      }
    } else if (q.type === 'free_text') {
      const match = trimmed.match(/-?\d+(?:\.\d+)?/);
      if (match) {
        const parsed = Number(match[0]);
        submission.numeric = Number.isFinite(parsed) ? parsed : undefined;
        const [low, high] = q.answer?.range ?? [];
        if (
          Number.isFinite(parsed) &&
          typeof low === 'number' &&
          typeof high === 'number'
        ) {
          correct = parsed >= low && parsed <= high;
        }
      }
    } else if (q.type === 'multi_part') {
      const expected = q.answer?.parts ?? {};
      const keys = Object.keys(expected);
      const parts = trimmed
        .split(',')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

      const parsedParts = {};
      let allMatch = keys.length > 0;

      keys.forEach((key, index) => {
        const expectedValue = expected[key];
        const segment = parts[index];
        if (segment === undefined) {
          allMatch = false;
          return;
        }
        if (typeof expectedValue === 'number') {
          const parsed = Number(segment);
          if (!Number.isFinite(parsed) || parsed !== expectedValue) {
            allMatch = false;
          }
          if (Number.isFinite(parsed)) {
            parsedParts[key] = parsed;
          }
        } else if (segment.toLowerCase() !== String(expectedValue).toLowerCase()) {
          allMatch = false;
        } else {
          parsedParts[key] = segment;
        }
      });

      submission.parts = parsedParts;
      correct = allMatch;
    } else {
      // Fallback: compare trimmed strings.
      const expected = String(q.answer?.exact ?? '').trim().toLowerCase();
      correct = trimmed.toLowerCase() === expected;
    }

    return { correct, submission };
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const { correct, submission } = buildSubmission();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit({ correct, submission });
      setValue('');
    } catch (err) {
      setSubmitError(err?.message || 'Unable to submit answer right now.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div>
      <div className="sc-field">
        <label htmlFor={`answer-${q.id}`}>Your answer</label>
        <input
          id={`answer-${q.id}`}
          className="sc-input"
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your response"
          disabled={isSubmitting}
        />
      </div>
      <div className="sc-controls">
        <button className="sc-button sc-button--primary" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Checking...' : 'Submit'}
        </button>
      </div>
      {submitError ? <p className="sc-error">{submitError}</p> : null}
    </div>
  );
};

export default QuestionView;
