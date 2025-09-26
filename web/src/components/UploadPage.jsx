import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * UploadPage allows the user to select a worksheet.  In a full implementation
 * you would upload the file to your backend and call `/analyze` to infer
 * concepts.  Here we simply navigate to the options screen.
 */
const UploadPage = () => {
  const navigate = useNavigate();

  const handleAnalyze = () => {
    // TODO: upload selected file and call /analyze
    navigate('/options');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Spicy Chips</h1>
      <p>Quick bites. Big gains.</p>
      <p>Select a scanned worksheet (PDF or image) to get started:</p>
      <input type="file" accept="application/pdf,image/*" />
      <br />
      <button onClick={handleAnalyze} style={{ marginTop: '1rem' }}>
        Analyze
      </button>
    </div>
  );
};

export default UploadPage;