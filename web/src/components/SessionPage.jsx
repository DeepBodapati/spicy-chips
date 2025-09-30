import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionView from './QuestionView';
import { useSession } from '../context/SessionContext';
import { requestFeedback, generateQuestions } from '../api/client';

const REFILL_THRESHOLD = 3;
const REFILL_BATCH = 10;
const FETCH_COOLDOWN_MS = 4000;

const SessionPage = () => {
  const {
    worksheet,
    options,
    questions,
    responses,
    addResponse,
    analysis,
    selectedConcepts,
    concepts,
    appendQuestions,
    usedQuestionIds,
    questionHistory,
  } = useSession();
  const navigate = useNavigate();

  const durationSeconds = Math.max(1, Number(options?.duration ?? 5) * 60);

  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferError, setBufferError] = useState(null);
  const [waitingForNext, setWaitingForNext] = useState(false);
  const [noMoreQuestions, setNoMoreQuestions] = useState(false);
 const [tipOverlay, setTipOverlay] = useState(null);

  const timerRef = useRef(null);
  const timeLeftRef = useRef(durationSeconds);
  const lastFetchRef = useRef(0);
  const pendingAdvanceRef = useRef(null);
  const sessionEndedRef = useRef(false);

  const activeConcepts = useMemo(() => {
    if (Array.isArray(selectedConcepts) && selectedConcepts.length) {
      return selectedConcepts;
    }
    return Array.isArray(concepts) && concepts.length ? concepts : ['mixed practice'];
  }, [selectedConcepts, concepts]);

  const recentHistory = useMemo(() => {
    if (!Array.isArray(questionHistory)) {
      return [];
    }
    return Array.from(
      new Set(
        questionHistory
          .slice(-12)
          .map((entry) => entry?.prompt)
          .filter((prompt) => typeof prompt === 'string' && prompt.trim().length)
      )
    );
  }, [questionHistory]);

  const uniqueQuestionIds = useMemo(() => new Set(Array.isArray(usedQuestionIds) ? usedQuestionIds : []), [usedQuestionIds]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (seconds) => {
      stopTimer();
      timeLeftRef.current = seconds;
      setTimeLeft(seconds);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            timeLeftRef.current = 0;
            return 0;
          }
          const next = prev - 1;
          timeLeftRef.current = next;
          return next;
        });
      }, 1000);
    },
    [stopTimer]
  );

  const analysisContext = useMemo(() => {
    if (!analysis) {
      return null;
    }
    return {
      textPreview: analysis.textPreview,
      ocrSource: analysis.ocrSource,
      vision: analysis.vision
        ? {
            concepts: analysis.vision.concepts,
            difficulty_notes: analysis.vision.difficulty_notes,
            question_styles: analysis.vision.question_styles,
            observations: analysis.vision.observations,
            numbers: analysis.vision.numbers,
            pages: analysis.vision.pages?.slice(0, 2),
          }
        : null,
      textAnalysis: analysis.textAnalysis
        ? {
            concepts: analysis.textAnalysis.concepts,
            difficulty_notes: analysis.textAnalysis.difficulty_notes,
            question_styles: analysis.textAnalysis.question_styles,
            observations: analysis.textAnalysis.observations,
            numbers: analysis.textAnalysis.numbers,
          }
        : null,
    };
  }, [analysis]);

 useEffect(() => {
   if (!worksheet) {
     navigate('/');
   }
  }, [worksheet, navigate]);

  useEffect(() => {
    setFeedback(null);
  }, [index]);

  const initializedRef = useRef(false);
  const prevDurationRef = useRef(options.duration);

  const hasQuestions = questions.length > 0;

  useEffect(() => {
    if (!hasQuestions) {
      initializedRef.current = false;
      stopTimer();
      return;
    }

    const durationChanged = prevDurationRef.current !== options.duration;

    if (!initializedRef.current || durationChanged) {
      setIndex(0);
      setScore(0);
      setFeedback(null);
      setBufferError(null);
      setWaitingForNext(false);
      setNoMoreQuestions(false);
      sessionEndedRef.current = false;
      timeLeftRef.current = durationSeconds;
      setTimeLeft(durationSeconds);
      startTimer(durationSeconds);
      initializedRef.current = true;
    } else if (!timerRef.current) {
      startTimer(timeLeftRef.current > 0 ? timeLeftRef.current : durationSeconds);
    }

    prevDurationRef.current = options.duration;

    return () => {
      stopTimer();
    };
  }, [hasQuestions, options.duration, durationSeconds, startTimer, stopTimer]);

  useEffect(() => {
    if (timeLeft === 0 && !sessionEndedRef.current) {
      sessionEndedRef.current = true;
      stopTimer();
      navigate('/summary', { state: { score, total: responses.length } });
    }
  }, [timeLeft, score, responses.length, navigate, stopTimer]);

  const loadMoreQuestions = useCallback(async () => {
    if (isBuffering || sessionEndedRef.current) {
      return;
    }
    if (!activeConcepts.length) {
      return;
    }

    const now = Date.now();
    if (now - lastFetchRef.current < FETCH_COOLDOWN_MS) {
      return;
    }

    lastFetchRef.current = now;
    setIsBuffering(true);
    setBufferError(null);

    const payload = {
      concepts: activeConcepts,
      difficulty: options.difficulty,
      count: Math.max(REFILL_BATCH, Math.ceil((options.duration || 5) * 2)),
      grade: worksheet?.grade || '',
      analysis: analysisContext,
      history: recentHistory,
      seed: Math.random().toString(36).slice(2),
    };

    try {
      const result = await generateQuestions(payload);
      const nextBatch = Array.isArray(result?.questions) ? result.questions : [];
      let filtered = nextBatch.filter((question) => question?.id && !uniqueQuestionIds.has(question.id));

      if (!filtered.length && nextBatch.length) {
        filtered = nextBatch.map((question, idx) => ({
          ...question,
          id: `${question?.id || 'repeat'}-${Date.now()}-${idx}`,
        }));
      }

      if (!filtered.length) {
        setBufferError('No fresh questions available right now.');
        setNoMoreQuestions(true);
      } else {
        appendQuestions(filtered);
        setBufferError(null);
        setNoMoreQuestions(false);
      }
    } catch (error) {
      setBufferError(error?.message || 'Could not load more questions.');
    } finally {
      setIsBuffering(false);
    }
  }, [
    isBuffering,
    activeConcepts,
    options.difficulty,
    options.duration,
    worksheet?.grade,
    analysisContext,
    recentHistory,
    appendQuestions,
    uniqueQuestionIds,
  ]);

  useEffect(() => {
    if (!questions.length) {
      return;
    }
    const remaining = questions.length - index - 1;
    if (remaining <= REFILL_THRESHOLD && !isBuffering && !noMoreQuestions && !sessionEndedRef.current) {
      loadMoreQuestions();
    }
  }, [questions.length, index, isBuffering, noMoreQuestions, loadMoreQuestions]);

  useEffect(() => {
    if (!waitingForNext) {
      return;
    }
    if (questions.length > index + 1) {
      setWaitingForNext(false);
      const advance = pendingAdvanceRef.current;
      pendingAdvanceRef.current = null;
      if (typeof advance === 'function') {
        advance();
      } else {
        setIndex((prev) => Math.min(prev + 1, questions.length - 1));
      }
      return;
    }

    if (!isBuffering && noMoreQuestions && !sessionEndedRef.current) {
      sessionEndedRef.current = true;
      stopTimer();
      navigate('/summary', { state: { score, total: responses.length } });
    }
  }, [waitingForNext, questions.length, index, isBuffering, noMoreQuestions, stopTimer, navigate, score, responses.length]);

  const advanceToNext = useCallback(
    ({ scoreValue, totalAnswered }) => {
      const isLast = index + 1 >= questions.length;
      if (isLast) {
        if (noMoreQuestions) {
          sessionEndedRef.current = true;
          stopTimer();
          navigate('/summary', { state: { score: scoreValue, total: totalAnswered } });
        } else {
          pendingAdvanceRef.current = () => setIndex((prev) => Math.min(prev + 1, questions.length - 1));
          setWaitingForNext(true);
          loadMoreQuestions();
        }
        return;
      }

      setIndex((prev) => prev + 1);
    },
    [index, questions.length, noMoreQuestions, loadMoreQuestions, stopTimer, navigate]
  );

  const handleTipDismiss = useCallback(() => {
    setTipOverlay(null);
    setFeedback(null);
    const next = pendingAdvanceRef.current;
    pendingAdvanceRef.current = null;
    if (typeof next === 'function') {
      next();
    }
  }, []);

  const handleSubmit = async ({ submission }) => {
    const question = questions[index];
    if (!question || timeLeft === 0 || sessionEndedRef.current) {
      return;
    }

    try {
      const response = await requestFeedback({ question, submission });
      const judgedCorrect = Boolean(response?.correct);
      const message = response?.feedback || (judgedCorrect ? 'Great job!' : 'Keep trying!');
      const result = {
        message,
        correct: judgedCorrect,
        questionId: question.id,
        source: response?.source || 'unknown',
      };

      const record = {
        questionId: question.id,
        question,
        submission,
        correct: judgedCorrect,
        feedback: message,
        feedbackError: false,
        source: result.source,
        timestamp: Date.now(),
      };
      addResponse(record);

      const totalAnswered = responses.length + 1;
      const nextScore = score + (judgedCorrect ? 1 : 0);
      setScore(nextScore);
      setFeedback(result);

      const proceed = () => advanceToNext({ scoreValue: nextScore, totalAnswered });

      if (judgedCorrect) {
        proceed();
      } else {
        pendingAdvanceRef.current = proceed;
        setTipOverlay({ message, isError: false });
      }
    } catch (error) {
      const message = error?.message || 'Feedback is unavailable right now.';
      const record = {
        questionId: question.id,
        question,
        submission,
        correct: null,
        feedback: message,
        feedbackError: true,
        source: 'error',
        timestamp: Date.now(),
      };
      addResponse(record);
      setFeedback({ message, correct: null, questionId: question.id, source: 'error' });
      pendingAdvanceRef.current = () => advanceToNext({ scoreValue: score, totalAnswered: responses.length + 1 });
      setTipOverlay({ message, isError: true });
    }
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

  const timerProgress = Math.max(0, Math.min(1, timeLeft / durationSeconds));
  const isWaitingOverlay = waitingForNext && !sessionEndedRef.current;

  return (
    <div className="sc-page">
      <div className="sc-shell">
        <section className="sc-card">
          <div className="sc-cta-row sc-cta-row--session">
            <div className="sc-cta-spacer" />
            <div className={`sc-timer-badge ${timeLeft === 0 ? 'expired' : ''}`}>
              <span className="sc-timer-icon" aria-hidden="true">⏱</span>
              <div>
                <small>Time left</small>
                <strong>{new Date(timeLeft * 1000).toISOString().slice(14, 19)}</strong>
              </div>
            </div>
            <div className="sc-score-badge">Score {score} of {responses.length}</div>
          </div>

          <div className="sc-timer-track" role="progressbar" aria-valuemin={0} aria-valuemax={durationSeconds} aria-valuenow={timeLeft}>
            <div className="sc-timer-track__fill" style={{ width: `${timerProgress * 100}%` }} />
          </div>

          {bufferError ? <div className="sc-buffer-indicator sc-buffer-indicator--error">{bufferError}</div> : null}

          {feedback ? (
            <div className={`sc-feedback ${feedback.isError ? 'error' : feedback.correct ? 'success' : 'warning'}`}>
              <strong>{feedback.correct ? 'Nice work!' : feedback.correct === false ? 'Try this:' : 'Feedback unavailable'}</strong>
              <p style={{ margin: '6px 0 0' }}>{feedback.message}</p>
            </div>
          ) : null}

          <h2 className="sc-question-prompt">{current.prompt}</h2>
          <QuestionView q={current} onSubmit={handleSubmit} disabled={Boolean(tipOverlay) || isWaitingOverlay || timeLeft === 0} />

          <p className="sc-lead" style={{ marginTop: '28px', color: 'var(--sc-muted)' }}>
            {timeLeft === 0 ? 'Time is up! Great effort.' : 'Stay focused and keep going!'}
          </p>
        </section>
      </div>

      {isWaitingOverlay ? (
        <div className="sc-overlay sc-overlay--wait">
          <div className="sc-overlay__card sc-overlay__card--wait">
            <div className="sc-overlay__icon" aria-hidden="true">⏳</div>
            <h3>Loading the next challenge…</h3>
            <p className="sc-overlay__message">We’re fetching more questions that match your worksheet.</p>
          </div>
        </div>
      ) : null}

      {tipOverlay ? (
        <div className="sc-overlay">
          <div className="sc-overlay__card">
            <div className="sc-overlay__icon" aria-hidden="true">{tipOverlay.isError ? '⚠️' : '💡'}</div>
            <h3>{tipOverlay.isError ? 'Let’s pause a sec…' : 'Try this!'}</h3>
            <p className="sc-overlay__message">{tipOverlay.message}</p>
            <div className="sc-overlay__actions">
              <button className="sc-button sc-button--primary" onClick={handleTipDismiss}>
                Next question
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default SessionPage;
