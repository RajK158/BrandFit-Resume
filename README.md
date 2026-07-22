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

The optimize API is available at `http://localhost:8000/api/v1/optimize-resume`.

## Load the unpacked Chrome extension

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository root (the folder that contains `manifest.json`).
5. Open the Impulso side panel from the toolbar action.

## Security note

Never commit `.env`, API keys, or other secrets. Use `.env.example` as the only checked-in template.
