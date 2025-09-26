import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ConfirmPage displays a summary of options before starting the session.  In a
 * complete application you would show the selected concept tags here as well.
 */
const ConfirmPage = () => {
  const navigate = useNavigate();

  const handleStart = () => {
    // TODO: initialize session state and generate questions
    navigate('/session');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Ready to start?</h2>
      <p>Your settings have been selected.  Press Start to begin your session.</p>
      <button onClick={handleStart}>Start Session</button>
    </div>
  );
};

export default ConfirmPage;