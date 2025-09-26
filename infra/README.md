# Infrastructure notes

This directory contains guidance on deploying the Spicy Chips project to Google Cloud.

## Recommended deployment

- **Region:** `us-east1` (matching your earlier specification).
- **Project ID:** `spicy-chips`.
- **Frontend:** Build the React project in `web/` and deploy the resulting static assets to [Firebase Hosting](https://firebase.google.com/products/hosting) or upload them to a Google Cloud Storage bucket and serve them through Cloud CDN.  Both approaches provide SSL, caching and a custom domain.
- **Backend:** Package the Express server in `api/` into a container image and deploy it to [Cloud Run](https://cloud.google.com/run).  Configure environment variables for secrets (such as `OPENAI_API_KEY`, `GCS_BUCKET`, and `ALLOWED_ORIGIN`) through Secret Manager.  Use auto‑scaling with a minimum of zero instances to save costs when the API is idle.
- **Storage:** Create a Cloud Storage bucket (e.g. `spicy-chips-uploads`) in the same region for temporary uploads.  Apply a lifecycle rule to automatically delete objects older than 1 day.

## CI/CD with GitHub Actions

Sample GitHub Actions workflows are provided under `.github/workflows/`.  You will need to configure the following secrets in your GitHub repository settings:

- `GCP_SA_EMAIL` – the service account email with permission to deploy to Cloud Run.
- `GCP_SA_KEY` – the JSON key for the service account.
- `GCP_PROJECT` – the Google Cloud project ID (`spicy-chips`).
- `FIREBASE_SERVICE_ACCOUNT` – for Firebase Hosting deployments.
- `FIREBASE_PROJECT_ID` – the Firebase project ID (`spicy-chips`).
- `GITHUB_TOKEN` – automatically provided by GitHub for repository actions.

The provided workflows illustrate building the API, pushing a container image to Google Container Registry, and deploying it to Cloud Run.  The web workflow builds the React app and deploys it to Firebase Hosting using the official action.

## Environment variables

The API expects the following environment variables at runtime:

- `OPENAI_API_KEY` – your OpenAI API key for LLM calls.
- `GCS_BUCKET` – the name of the Cloud Storage bucket for uploads.
- `ALLOWED_ORIGIN` – the origin of your web app (e.g. `https://spicy-chips.web.app`) to configure CORS.

You can set these variables through Cloud Run’s console or via the `--set-env-vars` flag when deploying from the CLI.