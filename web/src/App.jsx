import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import UploadPage from './components/UploadPage';
import { SessionProvider } from './context/SessionContext';
import OptionsPage from './components/OptionsPage';
import ConfirmPage from './components/ConfirmPage';
import SessionPage from './components/SessionPage';
import SummaryPage from './components/SummaryPage';

/**
 * Root application component.  Defines all routes for the PWA.
 */
const App = () => {
  return (
    <SessionProvider>
      <Router>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/options" element={<OptionsPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/session" element={<SessionPage />} />
          <Route path="/summary" element={<SummaryPage />} />
        </Routes>
      </Router>
    </SessionProvider>
  );
};

export default App;