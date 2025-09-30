import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeWorksheet, signUpload, uploadFile } from '../api/client';
import { useSession } from '../context/SessionContext';

/**
 * UploadPage allows a parent to upload a worksheet, streams it to the backend
 * and kicks off analysis to detect focus concepts for the session.
 */
const UploadPage = () => {
  const navigate = useNavigate();
  const { setWorksheet } = useSession();
  const [selectedFile, setSelectedFile] = useState(null);
  const [grade, setGrade] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { uploadUrl, fields = {}, method = 'POST' } = await signUpload({
        filename: selectedFile.name,
        mimeType: selectedFile.type,
        size: selectedFile.size,
        grade,
      });

      const uploadResult = await uploadFile({
        uploadUrl,
        file: selectedFile,
        fields,
        method,
      });

      if (!uploadResult?.fileUrl) {
        throw new Error('Upload failed to return a file URL.');
      }

      const analyzePayload = {
        url: uploadResult.fileUrl,
        originalName: uploadResult.originalName || selectedFile.name,
        size: uploadResult.size ?? selectedFile.size,
        mimeType: uploadResult.mimeType || selectedFile.type,
      };

      const analysisResult = await analyzeWorksheet({ ...analyzePayload, grade });
      const { concepts = [] } = analysisResult || {};
      const rawConcepts = Array.isArray(analysisResult?.vision?.concepts) && analysisResult.vision.concepts.length
        ? analysisResult.vision.concepts
        : concepts;
      const heuristicConcepts = Array.isArray(analysisResult?.heuristicConcepts) ? analysisResult.heuristicConcepts : [];
      const uniqueConcepts = Array.from(new Set([...(rawConcepts || []), ...(concepts || [])])).filter(Boolean);
      const suggestedConcepts = uniqueConcepts.slice(0, 3);
      const conceptOptions = suggestedConcepts.length
        ? suggestedConcepts
        : heuristicConcepts.slice(0, 3).filter(Boolean);
      const finalConcepts = conceptOptions.length ? conceptOptions : concepts.slice(0, 3);
      const safeConcepts = finalConcepts.length ? finalConcepts : ['mixed practice'];

      setWorksheet({
        name: analyzePayload.originalName,
        size: analyzePayload.size,
        type: analyzePayload.mimeType,
        url: analyzePayload.url,
        grade,
      }, analysisResult, safeConcepts);

      navigate('/options');
    } catch (err) {
      setError(err.message || 'Failed to analyze worksheet. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sc-page">
      <div className="sc-shell">
        <section className="sc-hero">
          <div className="sc-brand">
            <span className="sc-brand-mark">SC</span>
            <span className="sc-brand-title">Spicy Chips</span>
          </div>
          <p>Upload a worksheet, pick your vibe, and we will turn it into bite-sized wins.</p>
        </section>

        <section className="sc-card">
          <h2>Get ready to practice</h2>
          <p className="sc-lead">We’ll look at the worksheet, tag the hot topics, and spin up a session in seconds.</p>

          <ol className="sc-steps">
            <li className="sc-step">
              <div className="sc-step-number">1</div>
              <div className="sc-step-content">
                <h3>Pick the learner’s grade</h3>
                <p className="sc-step-copy">This keeps the questions and hints age-appropriate.</p>
                <div className="sc-options-group sc-options-group--wrap" role="group" aria-label="Select grade">
                  {['K', '1', '2', '3', '4', '5', '6', '7', '8'].map((item) => {
                    const selected = grade === item;
                    return (
                      <button
                        key={item}
                        type="button"
                        className={`sc-button sc-button--outline ${selected ? 'active' : ''}`}
                        onClick={() => setGrade(selected ? '' : item)}
                        aria-pressed={selected}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>
                {!grade ? (
                  <p className="sc-step-hint">Choose a grade to unlock uploads.</p>
                ) : (
                  <p className="sc-step-hint">Great! We’ll tailor prompts for grade {grade}.</p>
                )}
              </div>
            </li>

            <li className="sc-step">
              <div className="sc-step-number">2</div>
              <div className="sc-step-content">
                <h3>Upload the worksheet</h3>
                <p className="sc-step-copy">Images or PDFs work. We’ll keep everything local for now.</p>
                <div className={`sc-upload-dropzone ${!grade ? 'disabled' : ''}`} aria-disabled={!grade}>
                  <strong>{grade ? 'Select a file to get started' : 'Pick a grade to enable uploads'}</strong>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={handleFileChange}
                    disabled={!grade || isLoading}
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--sc-muted)' }}>Max 20MB • PDF, PNG, JPG</span>
                </div>
                {selectedFile ? (
                  <p className="sc-step-hint">Ready to scan: <strong>{selectedFile.name}</strong></p>
                ) : null}
              </div>
            </li>
          </ol>

          <div className="sc-controls">
            <button
              className="sc-button sc-button--primary sc-button--primary-lg"
              onClick={handleAnalyze}
              disabled={!selectedFile || !grade || isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Analyze worksheet'}
            </button>
          </div>

          {error ? <p className="sc-error">{error}</p> : null}
        </section>
      </div>
    </div>
  );
};

export default UploadPage;
