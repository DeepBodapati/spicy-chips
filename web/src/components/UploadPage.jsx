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

      const { concepts = [] } = await analyzeWorksheet({ ...analyzePayload, grade });

      setWorksheet({
        name: analyzePayload.originalName,
        size: analyzePayload.size,
        type: analyzePayload.mimeType,
        url: analyzePayload.url,
        grade,
      }, concepts);

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
          <h2>Upload a worksheet</h2>
          <p className="sc-lead">PDFs or images work great. We will keep it local during dev, then ship it to storage in prod.</p>

          <div className="sc-field">
            <label htmlFor="grade-select">Grade level</label>
            <select
              id="grade-select"
              className="sc-input"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
            >
              <option value="">Select grade</option>
              {['K', '1', '2', '3', '4', '5', '6', '7', '8'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <span style={{ fontSize: '0.85rem', color: 'var(--sc-muted)' }}>Grade context helps tailor the analysis.</span>
          </div>

          <div className="sc-upload-dropzone">
            <strong>Select a file to get started</strong>
            <input type="file" accept="application/pdf,image/*" onChange={handleFileChange} />
            <span style={{ fontSize: '0.9rem', color: 'var(--sc-muted)' }}>Max 20MB • PDF, PNG, JPG</span>
          </div>

          <div className="sc-controls">
            <button
              className="sc-button sc-button--primary"
              onClick={handleAnalyze}
              disabled={!selectedFile || !grade || isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Analyze worksheet'}
            </button>
          </div>

          {selectedFile ? (
            <p className="sc-lead" style={{ marginTop: '16px' }}>Ready to scan: <strong>{selectedFile.name}</strong></p>
          ) : null}

          {error ? <p className="sc-error">{error}</p> : null}
        </section>
      </div>
    </div>
  );
};

export default UploadPage;