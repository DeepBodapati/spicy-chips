import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * SummaryPage shows the user’s results at the end of a session.  It
 * demonstrates how to access route state passed from the SessionPage.
 */
const SummaryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const score = location.state?.score ?? 0;

  const handleRestart = () => {
    navigate('/');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Session complete</h2>
      <p>Your score: {score}</p>
      <button onClick={handleRestart}>Start Over</button>
    </div>
  );
};

export default SummaryPage;