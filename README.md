# Praxis

Praxis is a calm, minimal, local-first productivity and personal memory application designed to capture thoughts, tasks, resources, and events before you forget them. It remains completely useful offline, with Supabase synchronization and advisory AI capabilities acting strictly as background enhancements.

## Architecture

- **`web/`**: Client-first Single Page Application built with Vite, React 19, TypeScript, Tailwind CSS v4, Lucide React, and Dexie (IndexedDB).
- **`api/`**: Auxiliary FastAPI backend service for URL previews, public metadata enrichment, and advisory AI tasks.
- **`supabase/`**: PostgreSQL database schema, ordered migrations, and Row Level Security (RLS) policies.
- **`docs/`**: Product Requirements (PRD), design specifications, system architecture, ADRs, tech stack rationale, and implementation status reports.

## Prerequisites

- **Node.js**: v22+ (Active LTS)
- **npm**: v10+ (Standard Node.js package manager)
- **Python**: 3.12+ / 3.14+
- **uv**: Modern Python project and package manager

## Getting Started

### 1. Web Client (`web/`)

```bash
cd web
npm install
npm run dev
```

### 2. Backend API (`api/`)

```bash
cd api
uv run uvicorn personal_memory_api.main:app --reload --port 8000
```

### 3. Database (`supabase/`)

Local migrations are located in `supabase/migrations/`:
- `20261008000000_initial_schema.sql` — Base tables, indexes, triggers, and user RLS policies
- `20261009000000_classify_item_rpc.sql` — Transactional item classification RPC
- `20261010000000_classify_item_rpc_idempotent.sql` — Idempotent classification RPC with atomic extension writes

Apply migrations via the Supabase CLI or the Supabase project dashboard.

## Verification & Quality Assurance

- **Web Typecheck**: `npm --prefix web run typecheck`
- **Web Lint**: `npm --prefix web run lint`
- **Web Tests**: `npm --prefix web test`
- **Web Production Build**: `npm --prefix web run build`
- **API Tests**: `uv run --directory api pytest`
- **API Lint & Format**: `uv run --directory api ruff check .`
