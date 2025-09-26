import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { analyzeWorksheetVision, analyzeWorksheetText } from './visionAnalyzer.js';

const require = createRequire(import.meta.url);
const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');

const ensureProcessPolyfills = () => {
  if (typeof process !== 'undefined' && typeof process.getBuiltinModule !== 'function') {
    process.getBuiltinModule = (name) => {
      try {
        switch (name) {
          case 'fs':
            return require('fs');
          case 'path':
            return require('path');
          case 'module':
            return require('module');
          default:
            return require(name);
        }
      } catch (error) {
        console.warn('process.getBuiltinModule polyfill could not load', name, error.message);
        return undefined;
      }
    };
  }
};

ensureProcessPolyfills();

let pdfjsLibPromise = null;
const getPdfJs = async () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLibPromise;
};

const defaultConcepts = ['addition', 'subtraction'];

const applyCanvasPolyfills = () => {
  const globalAny = global;
  if (DOMMatrix && !globalAny.DOMMatrix) {
    globalAny.DOMMatrix = DOMMatrix;
  }
  if (ImageData && !globalAny.ImageData) {
    globalAny.ImageData = ImageData;
  }
  if (Path2D && !globalAny.Path2D) {
    globalAny.Path2D = Path2D;
  }
};

applyCanvasPolyfills();

const conceptMatchers = [
  { label: 'fractions', pattern: /(fraction|numerator|denominator|\d+\/\d+)/i },
  { label: 'multiplication', pattern: /(times|multiply|product|\bx\b)/i },
  { label: 'division', pattern: /(divide|quotient|per)/i },
  { label: 'geometry fundamentals', pattern: /(area|perimeter|volume|rectangle|triangle|circle)/i },
  { label: 'place value', pattern: /(place value|hundred|ten|ones|round)/i },
  { label: 'estimation', pattern: /(estimate|about how many|nearest)/i },
  { label: 'word problems', pattern: /(story|miles|tickets|classroom|bags|chips)/i },
  { label: 'algebra basics', pattern: /(solve for|unknown|variable|equation|x\s*[+=-])/i },
];

const sanitizeText = (text) => text.replace(/\s+/g, ' ').trim();

const resolveLocalPath = (url, uploadDir) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return path.join(uploadDir, path.basename(parsed.pathname));
  } catch {
    return path.isAbsolute(url) ? url : path.join(uploadDir, path.basename(url));
  }
};

const readFileSafe = async (filePath) => {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.warn('Unable to read upload file', filePath, error.message);
    throw error;
  }
};

const extractFromPdf = async (buffer) => {
  const { text } = await pdfParse(buffer);
  return sanitizeText(text || '');
};

const extractFromImage = async (filePath) => {
  const { data } = await Tesseract.recognize(filePath, 'eng');
  return sanitizeText(data.text || '');
};

const ensurePdfImageDir = async (uploadDir) => {
  const dir = path.join(uploadDir, 'pdf-pages');
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(Math.ceil(width) || 1, Math.ceil(height) || 1);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }

  reset(canvasAndContext, width, height) {
    if (!canvasAndContext?.canvas) return;
    canvasAndContext.canvas.width = Math.ceil(width) || 1;
    canvasAndContext.canvas.height = Math.ceil(height) || 1;
  }

  destroy(canvasAndContext) {
    if (!canvasAndContext?.canvas) return;
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

const safeSlug = (value) => value.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'worksheet';

const convertPdfToImages = async ({ buffer, uploadDir, originalName, maxPages = 2 }) => {
  if (!buffer?.byteLength) {
    return [];
  }

  try {
    const toUint8Array = (data) => {
      if (!data) return null;
      if (data instanceof Uint8Array && !(typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(data))) {
        return data;
      }
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      }
      if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
      }
      return Uint8Array.from(data);
    };

    const uint8 = toUint8Array(buffer);
    if (!uint8) {
      return [];
    }

    const pdfjsLib = await getPdfJs();
    const loadingTask = pdfjsLib.getDocument({ data: uint8, disableFontFace: false, useSystemFonts: true, disableWorker: true });
    const pdfDocument = await loadingTask.promise;
    const totalPages = Math.min(pdfDocument.numPages || 0, maxPages);
    if (!totalPages) {
      return [];
    }

    const targetDir = await ensurePdfImageDir(uploadDir);
    const slug = safeSlug(originalName || `pdf-${Date.now()}`);
    const images = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvasFactory = new NodeCanvasFactory();
      const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);

      canvasAndContext.context.fillStyle = '#ffffff';
      canvasAndContext.context.fillRect(0, 0, canvasAndContext.canvas.width, canvasAndContext.canvas.height);

      await page.render({
        canvasContext: canvasAndContext.context,
        viewport,
        canvasFactory,
      }).promise;

      const pngBuffer = canvasAndContext.canvas.toBuffer('image/png');
      const filename = `${slug}-page-${pageNumber}.png`;
      const filePath = path.join(targetDir, filename);
      await fs.writeFile(filePath, pngBuffer);
      canvasFactory.destroy(canvasAndContext);

      images.push({ filePath, mimeType: 'image/png', page: pageNumber });
    }

    return images;
  } catch (error) {
    console.error('Failed to convert PDF to images', error);
    return [];
  }
};

const mergeVisionAnalyses = (entries) => {
  if (!entries?.length) {
    return null;
  }

  const conceptSet = new Set();
  const styleSet = new Set();
  const observations = [];
  const difficultyNotes = [];
  let hasNumbers = false;
  let minNumber = Number.POSITIVE_INFINITY;
  let maxNumber = Number.NEGATIVE_INFINITY;

  entries.forEach(({ page, analysis }) => {
    if (!analysis) {
      return;
    }

    (analysis.concepts || []).forEach((concept) => concept && conceptSet.add(concept));
    (analysis.question_styles || []).forEach((style) => style && styleSet.add(style));

    if (analysis.difficulty_notes) {
      const prefix = entries.length > 1 ? `Page ${page}: ${analysis.difficulty_notes}` : analysis.difficulty_notes;
      difficultyNotes.push(prefix);
    }

    if (Array.isArray(analysis.observations)) {
      analysis.observations.forEach((note) => {
        if (!note) return;
        const prefix = entries.length > 1 ? `Page ${page}: ${note}` : note;
        observations.push(prefix);
      });
    }

    const numbers = analysis.numbers || {};
    if (Number.isFinite(numbers.min) || Number.isFinite(numbers.max)) {
      hasNumbers = true;
      if (Number.isFinite(numbers.min)) {
        minNumber = Math.min(minNumber, numbers.min);
      }
      if (Number.isFinite(numbers.max)) {
        maxNumber = Math.max(maxNumber, numbers.max);
      }
    }
  });

  const combined = {
    concepts: Array.from(conceptSet),
    question_styles: Array.from(styleSet),
    observations,
    difficulty_notes: difficultyNotes.join(' '),
  };

  if (hasNumbers) {
    combined.numbers = {
      min: Number.isFinite(minNumber) ? minNumber : undefined,
      max: Number.isFinite(maxNumber) ? maxNumber : undefined,
    };
  }

  combined.pages = entries.map(({ page, analysis }) => ({ page, ...analysis }));

  return combined;
};

export const extractTextFromUpload = async ({ url, mimeType, uploadDir }) => {
  const filePath = resolveLocalPath(url, uploadDir);
  if (!filePath) {
    return { text: '', source: null };
  }

  const buffer = await readFileSafe(filePath);
  const extension = (mimeType || path.extname(filePath).toLowerCase()).toString();
  let text = '';
  let strategy = 'filename';

  try {
    if (extension.includes('pdf') || path.extname(filePath).toLowerCase() === '.pdf') {
      text = await extractFromPdf(buffer);
      strategy = 'pdf';
    } else {
      text = await extractFromImage(filePath);
      strategy = 'image';
    }
  } catch (error) {
    console.error('OCR extraction failed, falling back to filename heuristics', error);
  }

  return { text, source: strategy, filePath, buffer };
};

export const detectConcepts = ({ text, originalName = '' }) => {
  const haystack = `${originalName} ${text}`.toLowerCase();
  const concepts = new Set();

  conceptMatchers.forEach(({ label, pattern }) => {
    if (pattern.test(haystack)) {
      concepts.add(label);
    }
  });

  if (/multiply|times|product/.test(haystack)) {
    concepts.add('multiplication');
  }

  if (/divide|quotient|per/.test(haystack)) {
    concepts.add('division');
  }

  if (/subtract|minus|difference/.test(haystack)) {
    concepts.add('subtraction');
  }

  if (/add|plus|sum/.test(haystack)) {
    concepts.add('addition');
  }

  if (!concepts.size) {
    defaultConcepts.forEach((concept) => concepts.add(concept));
  }

  return Array.from(concepts);
};

export const analyzeWorksheet = async ({ url, mimeType, originalName, uploadDir, grade }) => {
  const { text, source, filePath, buffer } = await extractTextFromUpload({ url, mimeType, uploadDir });
  const heuristicConcepts = detectConcepts({ text, originalName });

  let vision = null;
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  if (hasApiKey && filePath && mimeType && mimeType.startsWith('image/')) {
    vision = await analyzeWorksheetVision({ filePath, mimeType, grade, originalName });
  }

  if (hasApiKey && !vision && filePath && (mimeType?.includes('pdf') || path.extname(filePath).toLowerCase() === '.pdf')) {
    const images = await convertPdfToImages({ buffer, uploadDir, originalName });
    if (images.length) {
      const pageAnalyses = [];
      for (const page of images) {
        const analysis = await analyzeWorksheetVision({
          filePath: page.filePath,
          mimeType: page.mimeType,
          grade,
          originalName: `${originalName || 'worksheet'} (page ${page.page})`,
        });

        if (analysis) {
          pageAnalyses.push({ page: page.page, analysis });
        }
      }

      vision = mergeVisionAnalyses(pageAnalyses);
    }
  }

  let textAnalysis = null;
  if (!vision) {
    textAnalysis = await analyzeWorksheetText({ text, grade, originalName });
  }

  const concepts = vision?.concepts?.length
    ? vision.concepts
    : textAnalysis?.concepts?.length
    ? textAnalysis.concepts
    : heuristicConcepts;

  const sourceLabel = vision ? 'vision' : textAnalysis ? 'llm-text' : source;

  return {
    concepts,
    textPreview: text.slice(0, 400),
    ocrSource: sourceLabel,
    filePath,
    vision,
    textAnalysis,
    heuristicConcepts,
  };
};
