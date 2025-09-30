import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { generateQuestions } from '../api/client';

/**
 * OptionsPage lets the family pick focus areas and pacing before jumping into the
 * session. It also kicks off question generation.
 */
const OptionsPage = () => {
  const navigate = useNavigate();
  const {
    concepts,
    selectedConcepts,
    worksheet,
    analysis,
    options,
    setOptions,
    setSelectedConcepts,
    setQuestions,
    questionHistory,
  } = useSession();
  const { duration, difficulty } = options;
  const worksheetName = worksheet?.name ?? '';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!worksheet) {
      navigate('/');
    }
  }, [worksheet, navigate]);

  const handleConceptToggle = (concept) => {
    if (!concept) return;
    const exists = selectedConcepts.includes(concept);
    const next = exists
      ? selectedConcepts.filter((item) => item !== concept)
      : [...selectedConcepts, concept];
    setSelectedConcepts(next);
    if (error && next.length) {
      setError(null);
    }
  };

  const handleStart = async () => {
    if (!worksheet || isLoading) {
      return;
    }

    const chosenConcepts = selectedConcepts.length ? selectedConcepts : concepts;
    if (!chosenConcepts.length) {
      setError('Select at least one concept to focus on.');
      return;
    }

    setIsLoading(true);
    setError(null);

    const initialBatch = 4;
    const count = initialBatch;

    try {
      const analysisContext = analysis
        ? {
            textPreview: analysis.textPreview,
            ocrSource: analysis.ocrSource,
            vision: analysis.vision ? {
              concepts: analysis.vision.concepts,
              difficulty_notes: analysis.vision.difficulty_notes,
              question_styles: analysis.vision.question_styles,
              observations: analysis.vision.observations,
              numbers: analysis.vision.numbers,
              pages: analysis.vision.pages?.slice(0, 2),
            } : null,
            textAnalysis: analysis.textAnalysis ? {
              concepts: analysis.textAnalysis.concepts,
              difficulty_notes: analysis.textAnalysis.difficulty_notes,
              question_styles: analysis.textAnalysis.question_styles,
              observations: analysis.textAnalysis.observations,
              numbers: analysis.textAnalysis.numbers,
            } : null,
          }
        : null;

      const seed = Math.random().toString(36).slice(2);
      const recentHistory = Array.isArray(questionHistory)
        ? Array.from(
            new Set(
              questionHistory
                .slice(-12)
                .map((entry) => entry?.prompt)
                .filter((prompt) => typeof prompt === 'string' && prompt.trim().length)
            )
          )
        : [];

      const { questions = [], source } = await generateQuestions({
        concepts: chosenConcepts,
        difficulty: options.difficulty,
        count,
        grade: worksheet?.grade || '',
        analysis: analysisContext,
        history: recentHistory,
        seed,
      });

      if (source) {
        console.info(`[spicy-chips] questions source: ${source}`);
      }

      setQuestions(questions);
      navigate('/session');
    } catch (err) {
      setError(err.message || 'Failed to generate questions. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
          <h2>Customize your session</h2>
          <p className="sc-lead">Tell us what to drill so we can spin up just-right practice.</p>

          {worksheetName ? (
            <div>
              <h3 style={{ marginTop: '0' }}>Topics</h3>
              <p style={{ margin: '6px 0 18px', color: 'var(--sc-muted)' }}>These are the hot spots from your worksheet. Grab all of them or zero in on a specific vibe.</p>
              <div className="sc-options-group sc-options-group--stacked">
                {concepts.length ? (
                  concepts.map((concept) => {
                    const selected = selectedConcepts.includes(concept);
                    return (
                      <button
                        key={concept}
                        type="button"
                        onClick={() => handleConceptToggle(concept)}
                        className={`sc-button sc-button--outline ${selected ? 'active' : ''}`}
                        >
                        {concept}
                      </button>
                    );
                  })
                ) : (
                  <p style={{ color: 'var(--sc-muted)' }}>We will generate a mixed-practice set.</p>
                )}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: '32px' }}>
            <h3>Duration</h3>
            <div className="sc-options-group">
              {[0.5, 5, 10, 15].map((min) => (
                <button
                  key={min}
                  className={`sc-button sc-button--outline ${duration === min ? 'active' : ''}`}
                  onClick={() => handleDurationSelect(min)}
                  type="button"
                >
                  {min < 1 ? '30 sec' : `${min} min`}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '28px' }}>
            <h3>Difficulty</h3>
            <p style={{ margin: '6px 0 14px', color: 'var(--sc-muted)' }}>Bump the difficulty relative to that worksheet.</p>
            <div className="sc-options-group">
              {['less', 'same', 'more'].map((level) => (
                <button
                  key={level}
                  className={`sc-button sc-button--outline ${difficulty === level ? 'active' : ''}`}
                  onClick={() => handleDifficultySelect(level)}
                  type="button"
                >
                  {level === 'less' ? 'Easier' : level === 'same' ? 'Same' : 'Harder'}
                </button>
              ))}
            </div>
          </div>

          <div className="sc-controls" style={{ marginTop: '48px' }}>
            <button
              className="sc-button sc-button--primary sc-button--primary-lg"
              onClick={handleStart}
              disabled={isLoading || !selectedConcepts.length}
            >
              {isLoading ? 'Loading session…' : 'Start session'}
            </button>
          </div>

          {error ? <p className="sc-error">{error}</p> : null}
        </section>
      </div>
    </div>
  );
};

export default OptionsPage;
