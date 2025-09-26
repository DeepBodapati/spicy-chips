const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';

const resolveUrl = (input) => {
  if (typeof input !== 'string' || !input.length) {
    return API_BASE_URL;
  }
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
  if (input.startsWith('/')) {
    return `${API_BASE_URL}${input}`;
  }
  return `${API_BASE_URL}/${input}`;
};

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request to ${path} failed with ${response.status}`);
  }

  return response.json();
}

/**
 * Calls the backend /analyze endpoint with worksheet metadata.  For now we
 * transmit only a URL or filename placeholder until full upload support lands.
 */
export function analyzeWorksheet(payload) {
  return postJson('/analyze', payload);
}

/**
 * Requests generated questions for the selected concepts and difficulty.
 */
export function generateQuestions(payload) {
  return postJson('/generate', payload);
}

/**
 * Requests a temporary upload URL so the client can stream the worksheet.
 */
export function signUpload(payload) {
  return postJson('/sign-upload', payload);
}

/**
 * Uploads a file to the provided URL (POST + multipart form data).
 */
export async function uploadFile({ uploadUrl, file, fields = {}, method = 'POST' }) {
  const target = resolveUrl(uploadUrl);
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    formData.append(key, value);
  });
  formData.append('file', file);

  const response = await fetch(target, {
    method,
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Upload failed.');
  }

  return response.json();
}

/**
 * Requests contextual feedback for a user's answer.
 */
export function requestFeedback(payload) {
  return postJson('/feedback', payload);
}

export { API_BASE_URL };
