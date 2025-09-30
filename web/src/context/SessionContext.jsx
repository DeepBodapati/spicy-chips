import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

const createInitialState = () => ({
  worksheet: null,
  grade: '',
  concepts: [],
  selectedConcepts: [],
  analysis: null,
  options: {
    duration: 5,
    difficulty: 'same',
  },
  questions: [],
  responses: [],
  usedQuestionIds: [],
  questionHistory: [],
});

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
  const [state, setState] = useState(() => createInitialState());

  const setWorksheet = useCallback((worksheet, analysis = null, concepts = []) => {
    setState((prev) => ({
      ...prev,
      worksheet,
      grade: worksheet?.grade ?? prev.grade ?? '',
      analysis,
      concepts,
      selectedConcepts: concepts,
      questions: [],
      responses: [],
      usedQuestionIds: [],
      questionHistory: [],
    }));
  }, []);
  const setOptions = useCallback((nextOptions) => {
    setState((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        ...nextOptions,
      },
    }));
  }, []);

  const setQuestions = useCallback((questions) => {
    setState((prev) => ({
      ...prev,
      questions,
      responses: [],
      usedQuestionIds: Array.isArray(questions)
        ? questions
            .map((q) => q?.id)
            .filter(Boolean)
        : [],
      questionHistory: Array.isArray(questions)
        ? questions
            .map((q) => ({ id: q?.id, prompt: q?.prompt }))
            .filter((item) => item.id && item.prompt)
        : [],
    }));
  }, []);

  const setSelectedConcepts = useCallback((concepts) => {
    setState((prev) => ({
      ...prev,
      selectedConcepts: concepts,
    }));
  }, []);

  const appendQuestions = useCallback((questions) => {
    if (!Array.isArray(questions) || !questions.length) {
      return;
    }

    setState((prev) => {
      const existingIds = Array.isArray(prev.usedQuestionIds) ? prev.usedQuestionIds : [];
      const existingSet = new Set(existingIds);
      const filtered = questions.filter((q) => q && q.id && !existingSet.has(q.id));
      if (!filtered.length) {
        return prev;
      }

      const mergedIds = [...existingIds, ...filtered.map((q) => q.id)];
      const updatedHistory = [...prev.questionHistory, ...filtered.map((q) => ({ id: q.id, prompt: q.prompt }))].slice(-30);

      return {
        ...prev,
        questions: [...prev.questions, ...filtered],
        usedQuestionIds: mergedIds,
        questionHistory: updatedHistory,
      };
    });
  }, []);

  const setGrade = useCallback((grade) => {
    setState((prev) => ({
      ...prev,
      grade,
      worksheet: prev.worksheet ? { ...prev.worksheet, grade } : prev.worksheet,
    }));
  }, []);

  const addResponse = useCallback((response) => {
    setState((prev) => ({
      ...prev,
      responses: [...prev.responses, response],
      questionHistory: response?.question
        ? [...prev.questionHistory, { id: response.question.id, prompt: response.question.prompt }].slice(-30)
        : prev.questionHistory,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(createInitialState());
  }, []);

  const value = useMemo(() => ({
    worksheet: state.worksheet,
    grade: state.grade,
    concepts: state.concepts,
    selectedConcepts: state.selectedConcepts,
    analysis: state.analysis,
    options: state.options,
    questions: state.questions,
    responses: state.responses,
    usedQuestionIds: state.usedQuestionIds,
    questionHistory: state.questionHistory,
    setWorksheet,
    setGrade,
    setOptions,
    setQuestions,
    setSelectedConcepts,
    addResponse,
    appendQuestions,
    reset,
  }), [state, setWorksheet, setGrade, setOptions, setQuestions, setSelectedConcepts, addResponse, appendQuestions, reset]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
