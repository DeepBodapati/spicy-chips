import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const OpenAI = require('openai');

const MODEL_VISION = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MODEL_TEXT = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini';
const MAX_IMAGE_MB = 8;

let client = null;
const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new OpenAI.OpenAI({ apiKey });
  }
  return client;
};

const readFileBase64 = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  const sizeMb = buffer.byteLength / (1024 * 1024);
  if (sizeMb > MAX_IMAGE_MB) {
    throw new Error('Image exceeds 8MB vision limit.');
  }
  return buffer.toString('base64');
};

const buildVisionPrompt = ({ grade, originalName }) => {
  const gradeLine = grade ? `The parent said this worksheet is for grade ${grade}.` : 'Grade level unknown.';
  return `You are an educational content analyst. ${gradeLine}
Look at the worksheet image and respond with JSON describing:
- concepts: array of short concept labels (e.g., "two-digit addition", "fraction comparison", "multi-step word problems").
- difficulty_notes: 1-2 sentences about number ranges, operations, and complexity (mention negatives, regrouping, irrelevant info, multiple steps, etc.).
- question_styles: array of styles (e.g., "fill-in blank", "matching", "story problems with distractors").
- numbers: object with {min, max} showing smallest/largest numbers on the page if visible.
- observations: array of extra notes that might inform generation (e.g., "includes measurement units", "requires choosing operations", "visual models").

Respond strictly as JSON.`;
};

const buildTextPrompt = ({ grade, originalName, text }) => {
  const gradeLine = grade ? `Grade context: ${grade}.` : 'Grade context unknown.';
  return `You are an educational content analyst. ${gradeLine}
The parent uploaded a worksheet titled "${originalName || 'unknown'}". Analyze the extracted text and respond with JSON containing:
- concepts: array of short concept labels.
- difficulty_notes: short paragraph about number ranges, operations, complexity.
- question_styles: array describing the types of questions.
- numbers: object {min, max} summarizing numeric range.
- observations: extra notes (irrelevant info, multi-step reasoning, visuals, etc.).
If information is missing, make your best inference and mention the uncertainty in observations.

TEXT:
"""
${text}
"""`;
};

export const analyzeWorksheetVision = async ({ filePath, mimeType, grade, originalName }) => {
  const apiClient = getClient();
  if (!apiClient) {
    return null;
  }

  try {
    const base64 = await readFileBase64(filePath);
    const prompt = buildVisionPrompt({ grade, originalName });

    const response = await apiClient.responses.create({
      model: MODEL_VISION,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: prompt }],
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Analyze this worksheet page:' },
            { type: 'input_image', image_url: `data:${mimeType};base64,${base64}` },
          ],
        },
      ],
      text: { format: { type: 'json_object' } },
    });

    const content = response.output_text || response.output?.[0]?.content?.[0]?.text;
    if (!content) {
      throw new Error('Empty response from OpenAI vision endpoint.');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Vision analysis failed', error);
    return null;
  }
};

export const analyzeWorksheetText = async ({ text, grade, originalName }) => {
  const apiClient = getClient();
  if (!apiClient || !text || text.length < 40) {
    return null;
  }

  try {
    const response = await apiClient.responses.create({
      model: MODEL_TEXT,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: buildTextPrompt({ grade, originalName, text }) }],
        },
      ],
      text: { format: { type: 'json_object' } },
    });

    const content = response.output_text || response.output?.[0]?.content?.[0]?.text;
    if (!content) {
      throw new Error('Empty text-analysis response');
    }

    return JSON.parse(content);
  } catch (error) {
    console.error('Text analysis failed', error);
    return null;
  }
};
