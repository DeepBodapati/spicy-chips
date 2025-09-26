# Spicy Chips

**Spicy&nbsp;Chips** is a progressive web application designed around the idea of short, game‑inspired practice sessions.  Upload a scanned worksheet, pick a session length and difficulty, and let the app generate bite‑sized problems tailored to the concepts on the page.  You can reuse the structure here as a jumping‑off point for your own custom tutoring tool.

## Project layout

This repository is split into separate modules for the web front end and the API backend.  You can extend or replace any part of this structure depending on your needs.

```text
spicy-chips/
├── web/       # React PWA (front end)
├── api/       # Express server (backend)
├── infra/     # Infrastructure and deployment notes
└── .github/   # Sample CI/CD workflows for GitHub Actions
```

### Front end (`web/`)

The `web` directory contains a simple React application built with [Vite](https://vitejs.dev/).  Pages are organized by concept:

| File/Component      | Purpose                                                        |
|---------------------|----------------------------------------------------------------|
| `UploadPage`        | Upload a PDF or image of a worksheet.                          |
| `OptionsPage`       | Choose session length and difficulty.                          |
| `ConfirmPage`       | Review selected options before starting.                        |
| `SessionPage`       | Presents a sequence of questions and collects answers.          |
| `QuestionView`      | Renders different question types (numeric, free text, multi-part). |
| `SummaryPage`       | Shows results at the end of a session and offers to restart.    |

To start the development server:

```bash
cd web
npm install
npm run dev
```

This will start Vite on http://localhost:5173 and live‑reload your changes.

### Back end (`api/`)

The `api` folder contains a minimal Express server stub.  It exposes the following endpoints:

- **`POST /analyze`** – Accepts a file URL or uploaded content and returns a list of inferred concepts (to be implemented).
- **`POST /generate`** – Given a set of concepts and a difficulty level, returns JSON describing a set of questions.
- **`POST /feedback`** – Returns hints and explanations based on the user's answer.
- **`POST /sign-upload`** – Returns a signed URL for uploading a file to cloud storage.

To run the API locally:

```bash
cd api
npm install
npm start
```

The server listens on port `3001` by default.  It uses CORS to allow requests from the PWA during development.

### Infrastructure (`infra/`)

Deployment instructions and sample configuration live under `infra/`.  The recommended pattern is to serve the static PWA from Firebase Hosting or a Google Cloud Storage bucket behind a CDN, and to deploy the API as a container to Cloud Run.  A short guide in `infra/README.md` outlines region and project settings, secret management, and sample GitHub Actions workflows.

### Next steps for Codex

This codebase is deliberately lean—it is meant to be a starting point rather than a finished product.  You can build on it using Codex or ChatGPT by iterating on the following areas:

1. **OCR and concept extraction** – Wire up the `POST /analyze` handler to your OCR engine (e.g. Tesseract or a cloud OCR API) and send the extracted text to an LLM (such as GPT‑5) to identify concepts and number ranges.
2. **Question generation** – In `POST /generate`, call the LLM with the selected concepts and difficulty to generate an array of question objects.  Each object should conform to a schema like the one described earlier in the conversation (type, prompt, answer, hints).
3. **Feedback logic** – Implement `POST /feedback` to provide context‑aware hints and short explanations based on the student’s answers.  Consider multiple hint tiers and positive reinforcement when correct.
4. **UI polish** – Apply your brand (“Spicy Chips”) by updating colors, fonts, and layout.  Add a timer bar, progress rings, and numeric keypad for input.  Use confetti or badges to celebrate streaks.  See the earlier design discussion for inspiration.
5. **Persistent storage** – Implement the `sign-upload` endpoint to return a signed URL for uploading scanned worksheets to Google Cloud Storage.  Apply a lifecycle rule to auto‑delete uploads after a day.
6. **Testing and linting** – Add unit tests for your API and React components.  Integrate ESLint and Prettier to maintain code quality.

By using this structure, Codex can quickly navigate the code, understand the intent of each component, and implement the missing pieces.  Feel free to add more pages, routes, or API endpoints as your project grows.

### CI/CD with Cloud&nbsp;Build

If you prefer to run your build and deployment pipeline directly on Google Cloud rather than GitHub Actions, a sample `cloudbuild.yaml` is included at the root of this repository.  This pipeline does the following in order:

1. Installs API dependencies and builds a Docker image for the API using `api/Dockerfile`.
2. Pushes the image to Artifact Registry and deploys it to Cloud&nbsp;Run in `us-east1`.
3. Installs web dependencies, builds the React app, and synchronizes the compiled assets (`web/dist`) to a Cloud Storage bucket specified by the `_FRONTEND_BUCKET` substitution.

To enable continuous deployment:

- **Create a Cloud&nbsp;Build trigger** in the Google Cloud console that watches pushes to your main branch.  Choose “Cloud Build configuration file” and set the filename to `cloudbuild.yaml`.
- **Grant the Cloud&nbsp;Build service account permissions** to deploy to Cloud&nbsp;Run and write to your Cloud Storage bucket.
- **Set the `_FRONTEND_BUCKET` substitution** to the name of your front‑end bucket (for example, `spicy-chips-frontend`).  Cloud Build will use `gsutil rsync` to keep the bucket in sync with your latest build.

The provided GitHub Actions workflows and `cloudbuild.yaml` are complementary—use whichever system fits your workflow best.