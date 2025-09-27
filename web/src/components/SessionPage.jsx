import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionView from './QuestionView';
import { useSession } from '../context/SessionContext';
import { requestFeedback } from '../api/client';

/**
 * SessionPage iterates through questions stored in session state. When all
 * questions are answered it navigates to the summary screen and records the
 * score. After each submission it requests feedback from the backend.
 */
const SessionPage = () => {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const navigate = useNavigate();
  const { worksheet, options, questions, addResponse } = useSession();

  useEffect(() => {
    if (!worksheet) {
      navigate('/');
      return;
    }
    if (worksheet && questions.length === 0) {
      navigate('/options');
    }
  }, [worksheet, questions.length, navigate]);

  useEffect(() => {
    // Reset progress if a new question set is loaded.
    setIndex(0);
    setScore(0);
    setFeedback(null);
  }, [questions]);

  const handleSubmit = async ({ submission }) => {
    const question = questions[index];
    if (!question) {
      return;
    }

    let message = '';
    let feedbackError = false;
    let feedbackResult;

    try {
      const response = await requestFeedback({
        question,
        submission,
      });
      const judgedCorrect = Boolean(response?.correct);
      message = response?.feedback || (judgedCorrect ? 'Great job!' : 'Keep trying!');
      feedbackResult = {
        message,
        correct: judgedCorrect,
        questionId: question.id,
        source: response?.source || 'unknown',
      };
      addResponse({
        questionId: question.id,
        question,
        submission,
        correct: judgedCorrect,
        feedback: message,
        feedbackError,
        timestamp: Date.now(),
      });

      const nextScore = score + (judgedCorrect ? 1 : 0);
      setScore(nextScore);

      const isLastQuestion = index + 1 >= questions.length;
      if (isLastQuestion) {
        navigate('/summary', { state: { score: nextScore, total: questions.length } });
        return;
      }

      setIndex((prev) => prev + 1);
    } catch (error) {
      feedbackError = true;
      message = error?.message || 'Feedback is unavailable right now.';
      feedbackResult = {
        message,
        correct: null,
        questionId: question.id,
        isError: true,
      };
      addResponse({
        questionId: question.id,
        question,
        submission,
        correct: null,
        feedback: message,
        feedbackError,
        timestamp: Date.now(),
      });
    }

    setFeedback(feedbackResult);
  };

  const current = questions[index];

  if (!current) {
    return (
      <div className="sc-page">
        <div className="sc-shell">
          <section className="sc-card">
            <h2>Preparing your session...</h2>
            <p className="sc-lead">Head back to the setup screen if this message sticks around.</p>
          </section>
        </div>
      </div>
    );
  }

  const feedbackVariant = feedback ? (feedback.isError ? 'error' : feedback.correct ? 'success' : 'warning') : '';

  return (
    <div className="sc-page">
      <div className="sc-shell">
        <section className="sc-card">
          <div className="sc-cta-row">
            <span className="sc-question-number">Question {index + 1} / {questions.length}</span>
            <span className="sc-question-number">Score {score}</span>
          </div>

          {feedback ? (
            <div className={`sc-feedback ${feedbackVariant}`}>
              <strong>{feedback.isError ? 'Feedback unavailable' : feedback.correct ? 'Nice work!' : 'Try this:'}</strong>
              <p style={{ margin: '6px 0 0' }}>{feedback.message}</p>
            </div>
          ) : null}

          <h2 className="sc-question-prompt">{current.prompt}</h2>
          <QuestionView q={current} onSubmit={handleSubmit} />

          <p className="sc-lead" style={{ marginTop: '28px', color: 'var(--sc-muted)' }}>
            No timer yet — focus on getting it right!
          </p>
        </section>
      </div>
    </div>
  );
};

export default SessionPage;
