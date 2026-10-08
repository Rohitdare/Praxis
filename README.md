# Personal Memory App

A calm, reliable personal memory and capture system designed to remain useful even when offline, with AI enhancements acting purely as advisory suggestions.

## Architecture

- **`web/`**: Client-first Single Page Application built with Vite, React, TypeScript, Tailwind CSS v4, and shadcn/ui.
- **`api/`**: Auxiliary FastAPI background service for URL previews, public metadata enrichment, and advisory AI tasks.
- **`supabase/`**: PostgreSQL database schema, migrations, and Row Level Security (RLS) policies.
- **`docs/`**: Product Requirements (PRD), Design specifications, System Architecture, Tech Stack rationale, and Implementation Status.

## Prerequisites

- **Node.js**: v22+ (Active LTS)
- **pnpm**: v9+ (or v12+)
- **Python**: 3.12+ / 3.14+
- **uv**: Modern Python project and package manager

## Getting Started

### 1. Web Client (`web/`)

```bash
cd web
pnpm install
pnpm dev
```

### 2. Backend API (`api/`)

```bash
cd api
uv run uvicorn main:app --reload --port 8000
```

### 3. Database (`supabase/`)

Local migrations are located in `supabase/migrations/`.
Apply migrations via Supabase CLI or the Supabase project dashboard.
