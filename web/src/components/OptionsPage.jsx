import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

/**
 * OptionsPage lets the learner pick session parameters and persists them in
 * shared session state before moving on to confirmation.
 */
const OptionsPage = () => {
  const navigate = useNavigate();
  const { grade, concepts, worksheet, options, setOptions } = useSession();
  const { duration, difficulty } = options;
  const worksheetName = worksheet?.name ?? '';

  useEffect(() => {
    if (!worksheet) {
      navigate('/');
    }
  }, [worksheet, navigate]);

  const handleNext = () => {
    navigate('/confirm');
  };

  const handleDurationSelect = (min) => {
    setOptions({ duration: min });
  };

  const handleDifficultySelect = (level) => {
    setOptions({ difficulty: level });
  };

  return (
    <div className="sc-page">
      <div className="sc-shell">
        <section className="sc-card">
          <h2>Choose your session</h2>
          <p className="sc-lead">Dial in the vibe and we will queue up questions that feel just right.</p>

          {worksheetName ? (
            <div>
              <strong>Detected from {worksheetName}</strong>
              <p style={{ margin: '4px 0', color: 'var(--sc-muted)' }}>Grade: {worksheet?.grade || grade || 'Not set'}</p>
              <div className="sc-chip-row">
                {concepts.length ?
                  concepts.map((concept) => (
                    <span key={concept} className="sc-chip">{concept}</span>
                  )) : (
                    <span className="sc-chip">general practice</span>
                  )}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: '24px' }}>
            <h3>Duration</h3>
            <div className="sc-options-group">
              {[5, 10, 15].map((min) => (
                <button
                  key={min}
                  className={`sc-button sc-button--outline ${duration === min ? 'active' : ''}`}
                  onClick={() => handleDurationSelect(min)}
                  type="button"
                >
                  {min} min
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '28px' }}>
            <h3>Difficulty</h3>
            <div className="sc-options-group">
              {['less', 'same', 'more'].map((level) => (
                <button
                  key={level}
                  className={`sc-button sc-button--outline ${difficulty === level ? 'active' : ''}`}
                  onClick={() => handleDifficultySelect(level)}
                  type="button"
                >
                  {level === 'less' ? 'Gentler' : level === 'same' ? 'Familiar' : 'Spicier'}
                </button>
              ))}
            </div>
          </div>

          <div className="sc-controls">
            <button className="sc-button sc-button--primary" onClick={handleNext}>
              Continue
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default OptionsPage;