import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

const createInitialState = () => ({
  worksheet: null,
  grade: '',
  concepts: [],
  options: {
    duration: 5,
    difficulty: 'same',
  },
  questions: [],
  responses: [],
});

const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
  const [state, setState] = useState(() => createInitialState());

  const setWorksheet = useCallback((worksheet, concepts = []) => {
    setState((prev) => ({
      ...prev,
      worksheet,
      grade: worksheet?.grade ?? prev.grade ?? '',
      concepts,
      questions: [],
      responses: [],
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
    }));
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
    }));
  }, []);

  const reset = useCallback(() => {
    setState(createInitialState());
  }, []);

  const value = useMemo(() => ({
    worksheet: state.worksheet,
    grade: state.grade,
    concepts: state.concepts,
    options: state.options,
    questions: state.questions,
    responses: state.responses,
    setWorksheet,
    setGrade,
    setOptions,
    setQuestions,
    addResponse,
    reset,
  }), [state, setWorksheet, setGrade, setOptions, setQuestions, addResponse, reset]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
