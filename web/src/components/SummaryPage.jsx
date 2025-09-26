import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

/**
 * SummaryPage shows the user’s results at the end of a session.  It
 * demonstrates how to access route state passed from the SessionPage.
 */
const SummaryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { worksheet, grade, concepts, options, questions, responses, reset } = useSession();
  const score = location.state?.score ?? 0;
  const total = location.state?.total ?? (responses.length || questions.length);

  const handleRestart = () => {
    reset();
    navigate('/');
  };

  const formatSubmission = (submission = {}) => {
    if (typeof submission.numeric === 'number') {
      return submission.numeric;
    }
    if (submission.parts && Object.keys(submission.parts).length) {
      return Object.entries(submission.parts)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    if (submission.text && submission.text.trim().length) {
      return submission.text.trim();
    }
    if (typeof submission.raw === 'string' && submission.raw.trim().length) {
      return submission.raw.trim();
    }
    return '—';
  };

  return (
    <div className="sc-page">
      <div className="sc-shell">
        <section className="sc-card">
          <h2>Session complete</h2>
          <p className="sc-lead">{score}{typeof total === 'number' && total > 0 ? ` / ${total}` : ''} correct. Nice hustle!</p>

          {worksheet ? (
            <div className="sc-session-stats">
              <div>
                <strong>Worksheet</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--sc-muted)' }}>{worksheet.name}</p>
              </div>
              <div>
                <strong>Session settings</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--sc-muted)' }}>
                  {options.duration} min | Difficulty: {options.difficulty}
                </p>
              </div>
              <div>
                <strong>Grade</strong>
                <p style={{ margin: '4px 0 0', color: 'var(--sc-muted)' }}>{worksheet?.grade || grade || 'Not set'}</p>
              </div>
              <div>
                <strong>Concepts</strong>
                <div className="sc-chip-row">
                  {concepts.length ?
                    concepts.map((concept) => (
                      <span key={concept} className="sc-chip">{concept}</span>
                    )) : (
                      <span className="sc-chip">general practice</span>
                    )}
                </div>
              </div>
            </div>
          ) : null}

          <div style={{ margin: '1.5rem 0 1rem' }}>
            <h3>Question review</h3>
            {responses.length ? (
              <div className="sc-table-wrapper">
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Prompt</th>
                      <th>Your answer</th>
                      <th>Result</th>
                      <th>Feedback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((response, idx) => {
                      const question = response.question || questions.find((q) => q.id === response.questionId);
                      const status = response.feedbackError ? 'Unknown' : response.correct ? 'Correct' : 'Incorrect';
                      return (
                        <tr key={response.questionId || idx}>
                          <td>{idx + 1}</td>
                          <td>{question?.prompt || '—'}</td>
                          <td>{formatSubmission(response.submission)}</td>
                          <td>{status}</td>
                          <td>{response.feedback || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No responses were recorded this session.</p>
            )}
          </div>

          <div className="sc-controls">
            <button className="sc-button sc-button--primary" onClick={handleRestart}>Start over</button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SummaryPage;