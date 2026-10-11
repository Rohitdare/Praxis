# Praxis Auxiliary API (`api/`)

This directory contains the auxiliary FastAPI backend for Praxis. It provides auxiliary non-blocking services such as URL metadata preview generation, public resource enrichment, and advisory AI tasks.

## Design Principle

Praxis is local-first. Core capture, storage, and note/task/calendar management operate directly against IndexedDB and Supabase PostgreSQL with Row Level Security (RLS). The FastAPI service does not sit in the critical path of user captures.

## Requirements

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) or pip for dependency management and execution

## Running the Service

```bash
# Start local development server
uv run uvicorn personal_memory_api.main:app --reload --port 8000
```

## Running Tests and Linters

```bash
# Run unit & RLS isolation tests
uv run pytest

# Check linting and formatting
uv run ruff check .
uv run ruff format --check .
```

## Production Deployment (Render)

- **Root Directory:** `api`
- **Runtime:** Python 3
- **Python Version:** `.python-version` (`3.12.8`)
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn personal_memory_api.main:app --app-dir src --host 0.0.0.0 --port $PORT`
- **Health Check Path:** `/health`
- **Environment Variables:**
  - `ALLOWED_ORIGINS`: (Optional) Comma-separated allowed frontend origins (defaults to `https://praxis-memo.vercel.app,http://localhost:5173,http://localhost:3000`).

