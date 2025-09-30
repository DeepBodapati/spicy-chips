const counters = {
  question: {
    llm: 0,
    llm_cache: 0,
    heuristic: 0,
    error: 0,
  },
  judge: {
    llm: 0,
    llm_cache: 0,
    deterministic: 0,
    heuristic: 0,
    error: 0,
  },
};

export const telemetry = {
  incrementQuestion(source) {
    if (source && counters.question[source] !== undefined) {
      counters.question[source] += 1;
    } else {
      counters.question.error += 1;
    }
  },
  incrementJudge(source) {
    if (source && counters.judge[source] !== undefined) {
      counters.judge[source] += 1;
    } else {
      counters.judge.error += 1;
    }
  },
  snapshot() {
    return {
      question: { ...counters.question },
      judge: { ...counters.judge },
    };
  },
};
