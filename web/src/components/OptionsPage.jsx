import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * OptionsPage lets the user pick session parameters.  Selections are not stored
 * yet—wire these into your state management or API calls as needed.
 */
const OptionsPage = () => {
  const [duration, setDuration] = useState(5);
  const [difficulty, setDifficulty] = useState('same');
  const navigate = useNavigate();

  const handleNext = () => {
    // TODO: pass selected options to confirmation screen
    navigate('/confirm');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Choose your session</h2>
      <div>
        <h3>Duration</h3>
        {[5, 10, 15].map((min) => (
          <button
            key={min}
            onClick={() => setDuration(min)}
            style={{ margin: '0 0.5rem', padding: '0.5rem 1rem', backgroundColor: duration === min ? '#ff3b30' : '#f3f4f6', color: duration === min ? '#fff' : '#000' }}
          >
            {min} min
          </button>
        ))}
      </div>
      <div style={{ marginTop: '1rem' }}>
        <h3>Difficulty</h3>
        {['less', 'same', 'more'].map((level) => (
          <button
            key={level}
            onClick={() => setDifficulty(level)}
            style={{ margin: '0 0.5rem', padding: '0.5rem 1rem', backgroundColor: difficulty === level ? '#ff3b30' : '#f3f4f6', color: difficulty === level ? '#fff' : '#000' }}
          >
            {level}
          </button>
        ))}
      </div>
      <button onClick={handleNext} style={{ marginTop: '2rem' }}>
        Next
      </button>
    </div>
  );
};

export default OptionsPage;