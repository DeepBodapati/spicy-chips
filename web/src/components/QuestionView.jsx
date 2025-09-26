import React, { useState } from 'react';

/**
 * QuestionView renders different question formats based on `q.type`.  It calls
 * the provided `onSubmit` callback with a boolean indicating whether the
 * student’s answer is correct.  This demo implementation is intentionally
 * simple—you should expand it to support multi‑part answers, numeric keypad
 * input, and hints.
 */
const QuestionView = ({ q, onSubmit }) => {
  const [value, setValue] = useState('');

  const handleChange = (e) => {
    setValue(e.target.value);
  };

  const checkAnswer = () => {
    let correct = false;
    if (q.type === 'numeric') {
      correct = parseInt(value, 10) === q.answer.exact;
    } else if (q.type === 'free_text') {
      // Extract the first number from free text and compare to the accepted range
      const match = value.match(/\d+/);
      if (match) {
        const num = parseInt(match[0], 10);
        const [low, high] = q.answer.range;
        correct = num >= low && num <= high;
      }
    } else if (q.type === 'multi_part') {
      // For multi‑part questions we accept comma‑separated values.  The demo
      // compares the first and second parts to the expected answers.
      const parts = value.split(',').map((s) => s.trim());
      const expected = q.answer.parts;
      const hundred = parseInt(parts[0], 10);
      const thousand = parseInt(parts[1], 10);
      correct =
        hundred === expected.hundred &&
        (expected.thousand === undefined || thousand === expected.thousand);
    }
    onSubmit(correct);
    setValue('');
  };

  return (
    <div>
      <p>{q.prompt}</p>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder="Type your answer"
        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
      />
      <button onClick={checkAnswer}>Submit</button>
    </div>
  );
};

export default QuestionView;