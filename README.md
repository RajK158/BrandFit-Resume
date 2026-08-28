# Impulso

**Early development version.** Impulso is an unfinished Chrome extension plus FastAPI backend for job-application assistance (profile caching, job-description scraping, form autofill, and resume keyword tailoring). Do not treat this as a production-ready release.

## Current folder structure

```
BrandFit-Resume/
├── manifest.json          # Chrome extension (Manifest V3)
├── background.js          # Service worker (side panel open behavior)
├── sidepanel.html         # Extension side panel UI
├── sidepanel.js           # Side panel logic (profile, scrape, optimize, autofill trigger)
├── content.js             # Injected autofill / scrape helpers
├── brandfit-backend/
│   ├── main.py            # FastAPI AI optimize endpoint
│   ├── requirements.txt   # Python dependencies
│   └── .env.example       # Environment variable template
├── .gitignore
├── .gitattributes
└── README.md
```

Folder and file names still use the legacy `BrandFit` / `brandfit` paths; they have not been renamed yet.

## Backend setup (Python)

### 1. Create a virtual environment

From the repository root:

```bash
cd brandfit-backend
python -m venv .venv
```

Activate it:

- Windows (PowerShell): `.\.venv\Scripts\Activate.ps1`
- macOS / Linux: `source .venv/bin/activate`

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Create a local `.env`

Copy the example file and add your key locally (never commit the real file):

```bash
cp .env.example .env
```

Edit `.env` and set:

```
OPENAI_API_KEY=your_key_here
```

**Warning: never commit API keys.** Keep `.env` out of Git. Only `.env.example` (with an empty value) belongs in the repository.

### 4. Start FastAPI

From `brandfit-backend` with the virtual environment activated:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Or:

```bash
python main.py
```

The API is available at `http://localhost:8000`. Check `http://localhost:8000/health` before using the AI features.

## Sharing and hosted beta

Each Chrome installation stores its own profile, resumes, jobs, and saved answers locally. A new installation starts with an empty profile, so another user will not receive the developer's saved information.

The AI key belongs only in the backend environment. Never place it in the extension files. After the backend is deployed, set `DEFAULT_API_BASE_URL` in `api.js` to the public HTTPS backend URL. Friends can then install the same extension, create their own profile, and use AI features without running Python or entering an API key.

The backend includes beta safeguards configured through environment variables:

```text
AI_DAILY_REQUEST_LIMIT=10
MAX_RESUME_BYTES=5242880
MAX_JOB_DESCRIPTION_CHARS=50000
CORS_ALLOW_ORIGINS=chrome-extension://YOUR_EXTENSION_ID
```

The daily limit is per extension installation and resets at midnight UTC. It is an in-memory beta limit and resets when the backend restarts. Use persistent usage tracking and user authentication before a large public release.

### Container deployment

The backend contains a `Dockerfile`. Deploy the `brandfit-backend` directory on a container host and configure these secrets and environment values on the host:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=your_server_side_key
GEMINI_MODEL=gemini-flash-latest
AI_DAILY_REQUEST_LIMIT=10
MAX_RESUME_BYTES=5242880
MAX_JOB_DESCRIPTION_CHARS=50000
CORS_ALLOW_ORIGINS=chrome-extension://YOUR_EXTENSION_ID
```

For local development, `CORS_ALLOW_ORIGINS=*` remains available. Use the exact extension origin for a distributed build.

## Load the unpacked Chrome extension

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository root (the folder that contains `manifest.json`).
5. Open the Impulso side panel from the toolbar action.

## Security note

Never commit `.env`, API keys, or other secrets. Use `.env.example` as the only checked-in template.
