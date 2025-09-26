import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { generateQuestions } from '../api/client';

/**
 * ConfirmPage gives a quick summary of the worksheet and session options before
 * we generate practice questions.
 */
const ConfirmPage = () => {
  const navigate = useNavigate();
  const { worksheet, grade, concepts, options, setQuestions } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!worksheet) {
      navigate('/');
    }
  }, [worksheet, navigate]);

  const handleStart = async () => {
    if (!worksheet || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const countByDuration = { 5: 5, 10: 8, 15: 12 };
    const count = countByDuration[options.duration] ?? 5;

    try {
      const { questions = [] } = await generateQuestions({
        concepts,
        difficulty: options.difficulty,
        count,
      });

      setQuestions(questions);
      navigate('/session');
    } catch (err) {
      setError(err.message || 'Failed to generate questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sc-page">
      <div className="sc-shell">
        <section className="sc-card">
          <h2>Review and launch</h2>
          <p className="sc-lead">Take a quick peek, then we will spin up your practice mix.</p>

          {worksheet ? (
            <div className="sc-session-stats">
              <div>
                <strong>Worksheet</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--sc-muted)' }}>{worksheet.name}</p>
              </div>
              <div>
                <strong>Concept focus</strong>
                <div className="sc-chip-row">
                  {concepts.length ?
                    concepts.map((concept) => (
                      <span key={concept} className="sc-chip">{concept}</span>
                    )) : (
                      <span className="sc-chip">general practice</span>
                    )}
                </div>
              </div>
              <div>
                <strong>Session plan</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--sc-muted)' }}>
                  {options.duration} minute run | Difficulty: {options.difficulty}
                </p>
              </div>
              <div>
                <strong>Grade</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--sc-muted)' }}>{worksheet?.grade || grade || 'Not set'}</p>
              </div>
            </div>
          ) : null}

          <div className="sc-controls">
            <button className="sc-button sc-button--primary" onClick={handleStart} disabled={isLoading}>
              {isLoading ? 'Generating questions...' : 'Start session'}
            </button>
          </div>

          {error ? <p className="sc-error">{error}</p> : null}
        </section>
      </div>
    </div>
  );
};

export default ConfirmPage;