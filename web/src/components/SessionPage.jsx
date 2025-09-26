import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionView from './QuestionView';

// A handful of mock questions for demonstration.  Replace with API‑generated data.
const mockQuestions = [
  {
    id: 'q1',
    type: 'numeric',
    prompt: '15 + 6 = ?',
    answer: { exact: 21 },
    hint_1: 'Add the two numbers together.',
    hint_2: '15 + 6 equals 21.'
  },
  {
    id: 'q2',
    type: 'free_text',
    prompt:
      'A class collected 287 cans on Monday and 614 on Tuesday.  About how many cans is that in total? Round to the nearest hundred, then give the estimate.',
    answer: { range: [800, 900] },
    hint_1: 'Round each number to the nearest hundred first.',
    hint_2: '300 + 600 = 900; the answer is approximately 900.'
  },
  {
    id: 'q3',
    type: 'multi_part',
    prompt: 'Round 381 to the nearest hundred and thousand.',
    answer: { parts: { hundred: 400, thousand: 0 } },
    hint_1: '381 is closer to 400 than 300.',
    hint_2: '381 rounded to the nearest hundred is 400 and to the nearest thousand is 0.'
  }
];

/**
 * SessionPage iterates through a list of questions.  When all questions are
 * answered it navigates to the summary screen and passes along the score.
 */
const SessionPage = () => {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const navigate = useNavigate();

  const handleSubmit = (correct) => {
    if (correct) {
      setScore((s) => s + 1);
    }
    if (index + 1 < mockQuestions.length) {
      setIndex((i) => i + 1);
    } else {
      navigate('/summary', { state: { score: score + (correct ? 1 : 0) } });
    }
  };

  const current = mockQuestions[index];

  return (
    <div style={{ padding: '2rem' }}>
      <QuestionView q={current} onSubmit={handleSubmit} />
    </div>
  );
};

export default SessionPage;