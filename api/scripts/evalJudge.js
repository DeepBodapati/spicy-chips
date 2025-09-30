import 'dotenv/config';
import { gradeWithLLM } from '../llmJudge.js';
import { evaluateDeterministic } from '../answerEvaluator.js';

const cases = [
  {
    name: 'Exact numeric – correct',
    question: {
      id: 'case-1',
      concept: 'multi-digit multiplication',
      difficulty: 'same',
      type: 'numeric',
      prompt: 'Compute 24 × 6.',
      answer: { exact: 144 },
      hints: ['Break 24 into 20 + 4 to multiply more easily.'],
    },
    submission: { raw: '144', text: '144' },
    expected: true,
  },
  {
    name: 'Exact numeric – incorrect',
    question: {
      id: 'case-2',
      concept: 'fractions',
      difficulty: 'less',
      type: 'numeric',
      prompt: 'What is 3/4 of 16?',
      answer: { exact: 12 },
      hints: ['Think about how many quarters fit into 16.'],
    },
    submission: { raw: '10', text: '10' },
    expected: false,
  },
  {
    name: 'Range answer – inside bounds',
    question: {
      id: 'case-3',
      concept: 'estimation strategies',
      difficulty: 'same',
      type: 'free_text',
      prompt: 'Estimate 287 + 299 to the nearest ten.',
      answer: { range: [570, 600] },
      hints: ['Round each number to a friendly ten before adding.'],
    },
    submission: { raw: '590', text: '590' },
    expected: true,
  },
  {
    name: 'Range answer – outside bounds',
    question: {
      id: 'case-4',
      concept: 'estimation strategies',
      difficulty: 'same',
      type: 'free_text',
      prompt: 'Estimate 432 + 189 to the nearest hundred.',
      answer: { range: [600, 700] },
      hints: ['Round to the nearest hundred first then add.'],
    },
    submission: { raw: '800', text: '800' },
    expected: false,
  },
  {
    name: 'Multi-part – partially correct',
    question: {
      id: 'case-5',
      concept: 'rounding',
      difficulty: 'same',
      type: 'multi_part',
      prompt: 'Round 684 to the nearest ten and to the nearest hundred.',
      answer: {
        parts: {
          nearest_ten: 680,
          nearest_hundred: 700,
        },
      },
      hints: ['Look at the digit one place to the right before rounding.'],
    },
    submission: { raw: '680, 600', text: '680, 600' },
    expected: false,
  },
  {
    name: 'Free response explanation – correct reasoning',
    question: {
      id: 'case-6',
      concept: 'word problems',
      difficulty: 'more',
      type: 'free_text',
      prompt: 'Explain how you would check if 48 is divisible by 6 without long division.',
      answer: { range: [0, 0] },
      hints: ['Think about multiples of 6 or using factor pairs.'],
    },
    submission: {
      raw: 'Since 4 + 8 = 12 and 12 is divisible by 3, the number is divisible by 3, and it is even so divisible by 6.',
      text: 'Since 4 + 8 = 12 and 12 is divisible by 3, the number is divisible by 3, and it is even so divisible by 6.',
    },
    expected: true,
  },
];

const run = async () => {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY is not set; LLM judge cannot run.');
    process.exit(0);
  }

  const outcomes = [];

  for (const testCase of cases) {
    const deterministic = evaluateDeterministic({ question: testCase.question, submission: testCase.submission });
    const result = await gradeWithLLM({
      question: testCase.question,
      submission: deterministic.normalized,
      deterministic,
    });

    if (!result) {
      outcomes.push({
        name: testCase.name,
        status: 'error',
        detail: 'LLM returned null result',
      });
      continue;
    }

    const expectedCorrect = typeof testCase.expected === 'boolean' ? testCase.expected : deterministic.correct;
    outcomes.push({
      name: testCase.name,
      status: result.correct === expectedCorrect ? 'ok' : 'mismatch',
      correct: result.correct,
      deterministic: deterministic.correct,
      tip: result.tip,
      expected: expectedCorrect,
    });
  }

  const mismatches = outcomes.filter((item) => item.status !== 'ok');
  outcomes.forEach((item) => {
    console.log(`\n[${item.status === 'ok' ? 'PASS' : 'WARN'}] ${item.name}`);
    if (item.detail) {
      console.log(`  detail: ${item.detail}`);
    }
    if (!item.detail) {
      console.log(`  deterministic: ${item.deterministic}`);
      console.log(`  llm: ${item.correct}`);
      console.log(`  expected: ${item.expected}`);
      console.log(`  tip: ${item.tip || '(none returned)'}`);
    }
  });

  if (mismatches.length) {
    console.warn(`\nCompleted with ${mismatches.length} mismatches.`);
    process.exit(1);
  }

  console.log('\nAll judge checks passed.');
};

run();
