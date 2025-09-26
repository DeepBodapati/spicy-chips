# Spicy Chips

Spicy Chips is a React + Express playground for bite-sized practice sessions. Upload a worksheet, pick a vibe, and the app serves a stream of kid-friendly questions with instant feedback. The repo is optimized for rapid iteration—perfect for experimenting with OCR/LLM-backed tutoring flows.

## What’s inside

- **Polished PWA front end** (`web/`): Vite + React with a playful Spicy Chips theme.
- **Session workflow**: upload (with parent-provided grade) → OCR/vision-backed concept detection → options → confirmation → live session → recap with per-question feedback.
- **In-browser state**: worksheet metadata, selections, questions, and responses stay client-side for now (no auth, no persistence).
- **API playground** (`api/`): Express routes for uploads, concept/grade analysis (OpenAI vision + OCR), question generation, and feedback.

```text
spicy-chips/
├── web/       # React PWA
├── api/       # Express API
├── infra/     # Deployment notes
└── .github/   # Sample CI/CD workflows
```

## Quick start

### Prerequisites
- Node.js 18+
- npm 9+

### Run directly
```bash
# Front end
cd web
npm install
npm run dev  # http://localhost:5173

# In a second terminal
cd ../api
npm install
npm start    # http://localhost:3001
```

### Docker workflow
```bash
docker compose build
docker compose up
```
- Vite dev server: http://localhost:5173
- Express API: http://localhost:3001
- Uploads land in `api/uploads/` during local dev and are served from `/uploads/*`.

## API snapshot

| Endpoint | Purpose |
| --- | --- |
| `POST /sign-upload` | Issues a temporary upload target (local dev returns `http://localhost:3001/upload`). |
| `POST /upload` | Accepts multipart uploads, saves to `api/uploads/`, returns a file URL. |
| `POST /analyze` | Uses OCR + OpenAI vision/text to infer concepts, difficulty notes, question styles, and number ranges. |
| `POST /generate` | Generates concept-aware question sets (mix of numeric, multi-part, and estimation prompts). |
| `POST /feedback` | Returns upbeat hints per submission; currently heuristic-based. |

## OCR & vision prerequisites
- The API uses [tesseract.js](https://github.com/naptha/tesseract.js) and [pdf-parse](https://www.npmjs.com/package/pdf-parse) for local extraction.
- For richer concept detection, set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`/`OPENAI_TEXT_MODEL`) so `/analyze` can call GPT-4o. Vision works best with images; PDFs fall back to text extraction + LLM reasoning.

## Local-only data policy
For early iterations we intentionally keep session data in memory—no accounts, no persistence. When you’re ready to track mastery across sessions, plan a `/sessions` endpoint and storage (Firestore, Postgres, etc.).

## Roadmap highlights
1. Wire `/analyze` and `/generate` to real OCR/LLM pipelines.
2. Add a kid-friendly timer / pacing UI and celebratory effects.
3. Persist session summaries for concept mastery tracking once storage is chosen.
4. Layer automated tests (API + React) and linting for CI.

## Deployment pointers
- `infra/README.md` covers recommended Google Cloud setup (Cloud Run + Firebase Hosting / Cloud Storage).
- `cloudbuild.yaml` demonstrates a build/deploy pipeline; `.github/workflows/` includes GitHub Actions equivalents.

Happy shipping spicy practice sessions!

### Configure OpenAI
Set the following before `docker compose up` (or export in your shell):
```bash
export OPENAI_API_KEY=sk-...
# optional overrides
export OPENAI_MODEL=gpt-4o-mini
export OPENAI_TEXT_MODEL=gpt-4o-mini
```
The grade dropdown on the upload screen feeds context into the analyzer prompt.
