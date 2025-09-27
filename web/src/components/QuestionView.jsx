import React, { useEffect, useMemo, useState } from 'react';

/**
 * QuestionView renders a single question and collects the learner's response.
 * It normalizes the answer and forwards it to the parent via `onSubmit`, which
 * may perform grading, feedback lookups, or navigation.
 */
const QuestionView = ({ q, onSubmit }) => {
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
          disabled={isSubmitting}
        />
      </div>
      <div className="sc-controls">
        <button
          type="button"
          className="sc-button sc-button--outline sc-button--small"
          onClick={handleToggleTip}
          disabled={!hints.length || isSubmitting}
        >
          {tipVisible ? 'Hide tip' : 'Show tip'}
        </button>
        <button className="sc-button sc-button--primary" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Checking...' : 'Submit'}
        </button>
      </div>
      {tipVisible && hints.length ? (
        <div className="sc-tip">
          <strong>Try this:</strong>
          <p style={{ margin: '6px 0 0' }}>{hints[0]}</p>
        </div>
      ) : null}
      {submitError ? <p className="sc-error">{submitError}</p> : null}
    </div>
  );
};

export default QuestionView;
