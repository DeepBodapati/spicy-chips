import crypto from 'crypto';

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const createRng = (seed) => {
  let hash = crypto.createHash('sha256').update(seed).digest().readUInt32LE(0);
  return () => {
    hash = (hash * 1664525 + 1013904223) % 2 ** 32;
    return hash / 2 ** 32;
  };
};

const randomInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;

const makeNumericQuestion = ({ id, concept, difficulty, prompt, exact, hints }) => ({
  id,
  concept,
  difficulty,
  type: 'numeric',
  prompt,
  answer: { exact },
  hints,
});

const makeRangeQuestion = ({ id, concept, difficulty, prompt, range, hints }) => ({
  id,
  concept,
  difficulty,
  type: 'free_text',
  prompt,
  answer: { range },
  hints,
});

const makeMultiPartQuestion = ({ id, concept, difficulty, prompt, parts, hints }) => ({
  id,
  concept,
  difficulty,
  type: 'multi_part',
  prompt,
  answer: { parts },
  hints,
});

const additionGenerator = ({ concept, difficulty, index, rng }) => {
  const maxBase = difficulty === 'more' ? 999 : difficulty === 'same' ? 499 : 199;
  const a = randomInt(rng, 12, maxBase);
  const b = randomInt(rng, 8, maxBase);
  const isSubtraction = rng() > 0.5;
  const prompt = isSubtraction
    ? `What is ${Math.max(a, b)} - ${Math.min(a, b)}?`
    : `What is ${a} + ${b}?`;
  const exact = isSubtraction ? Math.abs(a - b) : a + b;

  return makeNumericQuestion({
    id: `q-add-${index}`,
    concept,
    difficulty,
    prompt,
    exact,
    hints: [
      'Stack the numbers so the ones place lines up.',
      isSubtraction
        ? 'Borrow if the top digit is smaller—then subtract each place value.'
        : 'Add ones, then tens, then hundreds. Carry if needed.',
    ],
  });
};

const multiplicationGenerator = ({ concept, difficulty, index, rng }) => {
  const maxFactor = difficulty === 'more' ? 19 : difficulty === 'same' ? 12 : 9;
  const a = randomInt(rng, 3, maxFactor);
  const b = randomInt(rng, difficulty === 'more' ? 10 : 3, maxFactor);
  const prompt = `Compute ${a} × ${b}.`;
  return makeNumericQuestion({
    id: `q-mult-${index}`,
    concept,
    difficulty,
    prompt,
    exact: a * b,
    hints: [
      'Use a multiplication strategy you like—skip count or break into tens + ones.',
      `If you split ${a} × ${b}, you can compute ${a} × ${Math.floor(b / 2) * 2} and add the leftover.`,
    ],
  });
};

const divisionGenerator = ({ concept, difficulty, index, rng }) => {
  const divisor = randomInt(rng, 2, difficulty === 'more' ? 12 : 9);
  const quotient = randomInt(rng, 2, difficulty === 'more' ? 25 : 12);
  const dividend = divisor * quotient;
  const prompt = `What is ${dividend} ÷ ${divisor}?`;
  return makeNumericQuestion({
    id: `q-div-${index}`,
    concept,
    difficulty,
    prompt,
    exact: quotient,
    hints: [
      'Think “how many groups” or “how many in each group.”',
      `You can skip count by ${divisor} until you reach ${dividend}.`,
    ],
  });
};

const fractionGenerator = ({ concept, difficulty, index, rng }) => {
  const denominator = [2, 3, 4, 5, 8][randomInt(rng, 0, 4)];
  const numerator = clamp(randomInt(rng, 1, Math.min(denominator - 1, difficulty === 'more' ? denominator - 1 : 2)), 1, denominator - 1);
  const groups = randomInt(rng, 2, difficulty === 'more' ? 12 : 8);
  const whole = groups * denominator;
  const prompt = `A sheet has ${whole} shapes. What is ${numerator}/${denominator} of them?`;
  const exact = groups * numerator;

  return makeNumericQuestion({
    id: `q-frac-${index}`,
    concept,
    difficulty,
    prompt,
    exact,
    hints: [
      `Find ${numerator} out of every ${denominator} shapes.`,
      `There are ${groups} groups of ${denominator}. Multiply ${groups} × ${numerator}.`,
    ],
  });
};

const geometryGenerator = ({ concept, difficulty, index, rng }) => {
  const length = randomInt(rng, 4, difficulty === 'more' ? 18 : 12);
  const width = randomInt(rng, 3, difficulty === 'more' ? 16 : 10);
  const height = randomInt(rng, 3, 10);
  const useVolume = difficulty === 'more' && rng() > 0.5;

  if (useVolume) {
    const prompt = `A box is ${length} cm long, ${width} cm wide, and ${height} cm tall. What is its volume?`;
    return makeNumericQuestion({
      id: `q-geom-vol-${index}`,
      concept,
      difficulty,
      prompt,
      exact: length * width * height,
      hints: [
        'Volume of a rectangular prism is length × width × height.',
        `Multiply ${length} × ${width} first, then multiply by ${height}.`,
      ],
    });
  }

  const prompt = `What is the area of a rectangle with length ${length} cm and width ${width} cm?`;
  return makeNumericQuestion({
    id: `q-geom-${index}`,
    concept,
    difficulty,
    prompt,
    exact: length * width,
    hints: [
      'Area of a rectangle is length × width.',
      `Count how many groups of ${width} fit into ${length}.`,
    ],
  });
};

const estimationGenerator = ({ concept, difficulty, index, rng }) => {
  const a = randomInt(rng, 120, 980);
  const b = randomInt(rng, 120, 980);
  const roundedA = Math.round(a / 100) * 100;
  const roundedB = Math.round(b / 100) * 100;
  const prompt = `Estimate ${a} + ${b}. Round each number to the nearest hundred before you add.`;
  return makeRangeQuestion({
    id: `q-est-${index}`,
    concept,
    difficulty,
    prompt,
    range: [roundedA + roundedB - 100, roundedA + roundedB + 100],
    hints: [
      `Round ${a} to ${roundedA} and ${b} to ${roundedB}.`,
      `Now add the rounded numbers to estimate the sum.`,
    ],
  });
};

const roundingGenerator = ({ concept, difficulty, index, rng }) => {
  const number = randomInt(rng, 120, 999);
  const prompt = `Round ${number} to the nearest ten and the nearest hundred.`;
  const ten = Math.round(number / 10) * 10;
  const hundred = Math.round(number / 100) * 100;
  return makeMultiPartQuestion({
    id: `q-round-${index}`,
    concept,
    difficulty,
    prompt,
    parts: { ten, hundred },
    hints: [
      'Look at the digit to the right of the place you are rounding.',
      `If it is 5 or more, bump the place up. If it is 4 or less, keep it the same.`,
    ],
  });
};

const wordProblemGenerator = ({ concept, difficulty, index, rng }) => {
  const base = randomInt(rng, 3, 8);
  const perGroup = randomInt(rng, 4, 9);
  const total = base * perGroup;
  const prompt = `A class is making snack bags with ${perGroup} chips each. They fill ${base} bags. How many chips do they need in all?`;
  return makeNumericQuestion({
    id: `q-word-${index}`,
    concept,
    difficulty,
    prompt,
    exact: total,
    hints: [
      'Each bag has the same number of chips—think multiplication.',
      `Multiply ${base} × ${perGroup} to find the total chips.`,
    ],
  });
};

const defaultGenerators = [additionGenerator, estimationGenerator, roundingGenerator];

const conceptGenerators = [
  { keywords: ['fraction'], generator: fractionGenerator },
  { keywords: ['addition', 'subtraction', 'sum', 'difference', 'algebra', 'equation'], generator: additionGenerator },
  { keywords: ['geometry', 'area', 'perimeter', 'volume'], generator: geometryGenerator },
  { keywords: ['multiplication', 'times', 'product'], generator: multiplicationGenerator },
  { keywords: ['division', 'quotient'], generator: divisionGenerator },
  { keywords: ['estimate', 'round'], generator: estimationGenerator },
  { keywords: ['place value'], generator: roundingGenerator },
  { keywords: ['word', 'story'], generator: wordProblemGenerator },
];

const pickGenerator = (concept) => {
  if (!concept) {
    return defaultGenerators;
  }
  const lower = concept.toLowerCase();
  const matches = conceptGenerators.filter(({ keywords }) =>
    keywords.some((keyword) => lower.includes(keyword))
  );
  if (matches.length) {
    return matches.map((item) => item.generator);
  }
  return defaultGenerators;
};

export const generateQuestionSet = ({ concepts = [], difficulty = 'same', count = 10, seed }) => {
  const safeCount = clamp(Math.floor(count) || 10, 1, 20);
  const list = concepts.length ? concepts : ['mixed practice'];
  const rng = createRng(seed || JSON.stringify({ concepts: list, difficulty, count: safeCount }));

  const questions = [];
  for (let i = 0; i < safeCount; i += 1) {
    const concept = list[i % list.length];
    const generators = pickGenerator(concept);
    const generator = generators[Math.floor(rng() * generators.length)];
    const question = generator({ concept, difficulty, index: i, rng });
    questions.push(question);
  }

  return questions;
};
