import React, { useEffect, useMemo, useState } from 'react';

/**
 * QuestionView renders a single question and collects the learner's response.
 * It normalizes the answer and forwards it to the parent via `onSubmit`, which
 * may perform grading, feedback lookups, or navigation.
 */
const QuestionView = ({ q, onSubmit, disabled = false }) => {
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [tipVisible, setTipVisible] = useState(false);

  const hints = useMemo(() => {
    if (!Array.isArray(q?.hints)) {
      return [];
    }
    return q.hints.filter((hint) => typeof hint === 'string' && hint.trim().length);
  }, [q?.hints]);

  useEffect(() => {
    setTipVisible(false);
    setSubmitError(null);
  }, [q?.id]);

  useEffect(() => {
    if (disabled) {
      setTipVisible(false);
    }
  }, [disabled]);

  if (!q) {
    return null;
  }

  const handleChange = (event) => {
    setValue(event.target.value);
  };

  const handleToggleTip = () => {
    if (!hints.length) {
      return;
    }
    setTipVisible((prev) => !prev);
  };

  const buildSubmission = () => {
    const trimmed = value.trim();
    const submission = {
      raw: value,
      text: value,
    };

    if (trimmed.length) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        submission.numeric = numeric;
      }
    }

    if (q.type === 'multi_part') {
      const parts = trimmed
        .split(',')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

      const parsedParts = {};
      const expected = q.answer?.parts ? Object.keys(q.answer.parts) : [];
      expected.forEach((key, index) => {
        const segment = parts[index];
        const parsed = Number(segment);
        if (Number.isFinite(parsed)) {
          parsedParts[key] = parsed;
        }
      });
      submission.parts = parsedParts;
    }

    return submission;
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const submission = buildSubmission();
    if (disabled) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit({ submission });
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
          disabled={isSubmitting || disabled}
        />
      </div>
      <div className="sc-controls">
        <button
          type="button"
          className="sc-button sc-button--outline sc-button--small"
          onClick={handleToggleTip}
          disabled={!hints.length || isSubmitting || disabled}
        >
          {tipVisible ? 'Hide tip' : 'Show tip'}
        </button>
        <button className="sc-button sc-button--primary" onClick={handleSubmit} disabled={isSubmitting || disabled}>
          {isSubmitting ? 'Checking...' : 'Submit'}
        </button>
      </div>
      {tipVisible && hints.length ? (
        <div className="sc-tip">
          <strong>Try this:</strong>
          <ul className="sc-tip-list">
            {hints.map((hint, idx) => (
              <li key={`${q.id}-hint-${idx}`}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {submitError ? <p className="sc-error">{submitError}</p> : null}
    </div>
  );
};

export default QuestionView;
