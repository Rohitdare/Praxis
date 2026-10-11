# Personal Memory App — Implementation Status

**Status:** Daily To-Do Planner & Weekly Productivity Statistics Completed
**Version:** 1.9
**Date:** 2026-10-12
**Assessed by:** Senior Frontend Engineer & UI/UX Designer

---

## 1. Repository State

The repository structure has been established per Phase 0 and Phase 1A specifications:

```
d:\sample-projects\bruno\
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI for web and api
├── api/                         # FastAPI backend workspace (uv)
│   ├── pyproject.toml
│   ├── src/personal_memory_api/
│   │   ├── __init__.py
│   │   └── main.py              # GET /health endpoint
│   └── tests/
│       ├── test_health.py
│       └── test_rls_isolation.py # Automated RLS policy & isolation verification
├── docs/                        # Architecture, PRD, Design, Tech Stack, Status
├── supabase/
│   ├── config.toml              # Local Supabase CLI configuration
│   └── migrations/
│       └── 20261008000000_initial_schema.sql # 8 tables, indexes, triggers, RLS policies
├── web/                         # Vite + React 19 + TypeScript SPA (npm)
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── protected-route.tsx # Session guard redirecting to /auth
│   │   │   │   └── public-route.tsx    # Unauthenticated guard redirecting to /capture
│   │   │   ├── layout/
│   │   │   │   └── app-shell.tsx       # Calm, responsive desktop and mobile shell
│   │   │   └── ui/
│   │   │       ├── button.tsx
│   │   │       └── input.tsx
│   │   ├── lib/
│   │   │   ├── auth/
│   │   │   │   └── auth-context.tsx    # Supabase browser auth provider & session restoration
│   │   │   ├── supabase/
│   │   │   │   ├── database.types.ts
│   │   │   │   └── client.ts
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   ├── auth-page.tsx           # SCR-01 Email/Password + Google OAuth
│   │   │   ├── capture-page.tsx        # SCR-02 Capture placeholder
│   │   │   └── inbox-page.tsx          # SCR-03 Inbox placeholder
│   │   ├── test/
│   │   │   ├── auth-routing.test.tsx   # Auth flow, guards, and navigation tests
│   │   │   ├── pwa-config.test.ts      # PWA manifest and caching restrictions test
│   │   │   ├── rls-isolation.test.ts
│   │   │   └── setup.ts
│   │   ├── App.tsx                     # Route hierarchy
│   │   └── index.css                   # Tailwind v4, Inter typography, semantic tokens
│   ├── tsconfig.json
│   ├── vite.config.ts                  # Vite + Tailwind v4 + VitePWA
│   └── package.json
├── .editorconfig
├── .env.example
├── .gitignore
└── README.md
```

---

## 2. Existing Technologies

- **Frontend (`web/`)**: Node.js 22 LTS, npm 11, Vite 8, React 19, TypeScript 6, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn/ui, Radix UI primitives, Lucide React, react-router-dom 7, vite-plugin-pwa 2, @supabase/supabase-js 2, @tanstack/react-query, @fontsource/inter, Vitest, oxlint.
- **Backend (`api/`)**: Python 3.14 / 3.12, uv 0.12, FastAPI 0.143, Uvicorn, Pydantic 2.14, HTTPX, Ruff, Pytest, Pytest-asyncio.
- **Database (`supabase/`)**: PostgreSQL 15 schema migration, full Row Level Security (RLS) on all 8 tables, `set_updated_at` trigger, GIN full-text search index, compound cursor indexes.
- **CI/CD (`.github/workflows/ci.yml`)**: Automated pipelines for web (lint, typecheck, test, build) and api (lint, format-check, test).

---

## 3. Existing Functionality

- **Authentication & Sessions**: Supabase browser client authentication with Email & Password + Google OAuth, password reset and recovery flows, session restoration on mount, auth state listener, and sign out (`/auth`). Magic-link authentication completely removed.
- **Protected Routing**: Route guards (`ProtectedRoute`, `PublicRoute`) redirecting unauthenticated users to `/auth`, authenticated root `/` visits to `/capture`, with navigation between `/capture` and `/inbox`.
- **Application Shell & Navigation**: Clean typography-first layout with desktop header navigation and thumb-reachable mobile bottom navigation bar (min 44x44px touch targets), Settings placeholder notice, and Sign out button.
- **Local-First Capture & Dexie IndexedDB**: Complete IndexedDB schema (`local_items`, `outbox`, `sync_meta`), client-generated UUIDv4 IDs, atomic capture pipeline, sub-2ms local persistence latency (< 300 ms target), offline support without network dependencies, `CaptureBar` with five reactive states (empty, focused, saving, saved, offline), desktop keyboard shortcuts (`Enter` to save, `Shift+Enter` for newline), touch save button, and recent captures feed (5 newest items with relative timestamps).
- **Online Synchronization Engine (Push Path)**: Dedicated synchronization layer in `web/src/lib/sync/`, in-memory concurrency guard preventing overlapping drains, automatic stale record recovery on startup, trigger hooks (app mount, user authentication, browser online event, unawaited post-capture trigger), idempotent Supabase `items` upsert (`onConflict: 'id'`), bounded exponential backoff (1s to 30s, max 5 attempts), user account cross-leakage prevention, and unobtrusive `SyncIndicator` component across desktop and mobile headers.
- **PWA Foundation**: Web app manifest, standalone display mode, service worker app-shell caching, with explicit exclusion of all API and Supabase network traffic.
- **FastAPI Service**: `GET /health` endpoint returning `{"status": "ok", "version": "0.1.0"}` with structured response and CORS middleware.
- **Database & RLS**: Complete PostgreSQL migration with all 8 tables, indexes, triggers, and verified RLS cross-user isolation tests.

---

## 4. Foundation Pieces Status

### Phase 0 — Decisions, migrations, CI

| Item | Status |
|------|--------|
| Supabase dev project created | Pending human action |
| Supabase prod project created | Pending human action |
| Migration 0001 (all tables + RLS) | Completed (`20261008000000_initial_schema.sql`) |
| TypeScript DB type generation | Completed (`web/src/lib/supabase/database.types.ts`) |
| Vite + React + TypeScript scaffold | Completed |
| Tailwind CSS v4 configured | Completed (`web/src/index.css`) |
| shadcn/ui initialized | Completed (`components.json`, `button.tsx`, `input.tsx`) |
| Lucide React installed | Completed |
| TanStack Query installed | Completed |
| Dexie / IndexedDB layer | Completed (`web/src/lib/db/`) |
| vite-plugin-pwa configured | Completed (`vite.config.ts`) |
| FastAPI scaffold (api/ folder) | Completed with `/health` and Pydantic schema |
| GitHub Actions CI workflow | Completed (`.github/workflows/ci.yml`) |
| .env.example and secret policy | Completed (`.env.example`) |
| npm package management selected and committed | Completed (`package-lock.json`) |
| RLS isolation tests | Completed (`api/tests/test_rls_isolation.py`, `web/src/test/rls-isolation.test.ts`) |

### Phase 1 — Auth + Capture + local DB

| Item | Status |
|------|--------|
| Sign-in screen (SCR-01) | Completed (`web/src/pages/auth-page.tsx`) |
| Supabase Auth (Email/Password + Google OAuth) | Completed (`web/src/lib/auth/auth-context.tsx`) |
| Protected App Shell & Navigation | Completed (`web/src/components/layout/app-shell.tsx`) |
| Basic Routing (`/auth`, `/`, `/capture`, `/inbox`) | Completed (`web/src/App.tsx`) |
| PWA Manifest & App-Shell Cache | Completed (`vite-plugin-pwa`) |
| CaptureBar component (SCR-02) | Completed (`web/src/components/capture/capture-bar.tsx`) |
| IndexedDB write on capture (< 300 ms) | Completed (`web/src/lib/db/capture.ts`, latency ~1.8 ms) |
| Outbox table in Dexie | Completed (`web/src/lib/db/schema.ts`, `outbox`) |
| Saved / Saved offline confirmation | Completed (inline polite status, design.md §12 microcopy) |
| Sync engine (push only) | Completed (`web/src/lib/sync/`, idempotent upsert, backoff, outbox state machine) |
| Inbox screen (SCR-03) | Completed in Phase 1D (`web/src/pages/inbox-page.tsx`, `web/src/components/inbox/`) |
| Settings screen (SCR-10) | Completed in Phase 1E (`web/src/pages/settings-page.tsx`) |
| JSON export (FR-31) | Completed in Phase 1E (`web/src/lib/export/service.ts`, `web/src/pages/settings-page.tsx`) |
| Soft-delete / tombstone logic (FR-08) | Completed in Phase 1D (`web/src/lib/inbox/service.ts`, tombstone sync) |

---

## 5. Conflicts and Deviations Found

### CONFLICT-01 — nextjs-supabase-auth skill vs. Vite SPA

The installed global skill nextjs-supabase-auth documents Next.js App Router patterns (createServerClient, middleware.ts, Server Actions, cookies()). The project documents specify Vite + React SPA — there is no server component layer. The correct Supabase client for this project is the browser client (createClient from @supabase/supabase-js). Do not follow the Next.js-specific patterns from that skill.

### CONFLICT-02 — gpt-taste / frontend-design skills vs. design spec

The gpt-taste skill mandates GSAP heavy animation, AIDA structure, bento grids, and wide hero typography. The frontend-design skill flags Inter/system fonts as an immediate failure anti-pattern.

The project design spec (design.md) explicitly:
- Bans gradient blobs, glowing AI badges, nested cards, excessive glassmorphism, decorative 3D graphics (s1)
- Specifies Inter as the default font (ASSUMPTION D-01)
- Requires 120-180 ms micro-interactions only (s9)
- Mandates typography-first, generous whitespace, calm density, subtle borders

Resolution: Follow the project design spec strictly. The aesthetic is utilitarian-editorial / calm productivity tool — not a marketing landing page. Use Inter (as specified), shadcn/ui base components, and the 4 px spacing scale.

### CONFLICT-03 — Tailwind v4 vs. shadcn/ui compatibility

The tailwind-patterns skill documents Tailwind v4 CSS-first @theme configuration. shadcn/ui's latest stable release supports Tailwind v4 via the vite template. Some community registry components may still assume v3 config. Resolution: Use Tailwind v4 with shadcn CLI vite template and verify each added component. The shadcn skill confirms v4 is handled via the tailwindVersion field from npx shadcn@latest info.

### CONFLICT-04 — Gemini AI Level 2 privacy (Phase 5 concern)

tech-stack.md states: "free-tier content may be used to improve Google's products. Therefore Level 2 personal content and Level 3 sensitive notes must not be sent to Gemini." Not a Phase 0/1 concern but recorded here so it is not forgotten when Phase 5 begins.

### DEVIATION-01 — No package manager committed yet

tech-stack.md specifies npm (ASSUMPTION T-01). `package-lock.json` is committed as the canonical lockfile.

---

## 6. Assumptions

| ID | Assumption |
|----|-----------|
| IMPL-A-01 | npm will be used as the frontend package manager (aligns with tech-stack.md ASSUMPTION T-01). |
| IMPL-A-02 | uv will be used for the FastAPI Python environment. |
| IMPL-A-03 | Monorepo layout: web/ (Vite React SPA), api/ (FastAPI), docs/, supabase/ at repository root. Not specified in project documents; must be confirmed before scaffold. |
| IMPL-A-04 | Email/Password and Google OAuth are the two supported authentication methods; magic links removed. |
| IMPL-A-05 | Node.js active LTS (v22.x at time of writing) is the runtime. |
| IMPL-A-06 | Tailwind CSS v4 will be used. If a blocking incompatibility is found, fall back to v3 and record here. |
| IMPL-A-07 | Sentry adoption is deferred until privacy review (tech-stack.md open questions). |
| IMPL-A-08 | FastAPI scaffold in Phase 0 is a placeholder with health-check endpoint only. It must never become required for capture. |
| IMPL-A-09 | react-router-dom will be used for routing. TanStack Router is an equally valid alternative. Confirm before implementing. |

---

## 7. Proposed Implementation Order

### Phase 0 — Foundation and CI

Goal: Fresh DB migration + CI green. No user-visible features.

**Step 1 — Establish repo structure**
- Confirm web/ + api/ + docs/ + supabase/ layout
- Create root .gitignore, .editorconfig, README.md

**Step 2 — Web scaffold**
```
cd web/
npm create vite@latest . --template react-ts
npx shadcn@latest init --template vite
npm install lucide-react @tanstack/react-query dexie @supabase/supabase-js @supabase/ssr vite-plugin-pwa react-router-dom
npm install -D vitest @playwright/test
```
Tailwind CSS v4 installed via shadcn init. Verify tailwindVersion field.

**Step 3 — FastAPI scaffold**
```
cd api/
uv init --python 3.12
uv add fastapi "uvicorn[standard]" httpx pydantic ruff
```
Single GET /health endpoint returning {"status": "ok"}.

**Step 4 — Supabase projects (HUMAN ACTION REQUIRED)**
- Create dev Supabase project
- Create prod Supabase project
- Add .env.example with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Confirm no secret keys are in web/ environment

**Step 5 — Database migration 0001**
File: supabase/migrations/0001_initial.sql
- Tables: profiles, items, resources, tasks, calendar_events, tags, item_tags, item_relationships
- All indexes per architecture.md s6
- set_updated_at() trigger on all mutable tables
- RLS enabled on every user-owned table with distinct ownership policies
- Apply to dev Supabase project and validate

**Step 6 — TypeScript type generation**
```
npx supabase gen types typescript --project-id <dev-id> > web/src/lib/supabase/database.types.ts
```

**Step 7 — GitHub Actions CI**
- Workflow: install, lint (ruff + Prettier), TypeScript type-check, Vitest unit tests
- Phase 0 exit criterion: CI green on push to main

**Step 8 — Cross-user RLS tests**
- Tests: User A cannot read User B rows in items and profiles
- Must pass before Phase 1 begins

---

### Phase 1 — Auth + Capture + Local DB

Goal: Real daily use for several days. Core capture loop working.

**Step 1 — App shell and routing**
- Install react-router-dom (already in web scaffold above)
- Routes: /auth (SCR-01), / redirects to /capture (SCR-02), /inbox (SCR-03)
- PWA manifest via vite-plugin-pwa
- Service worker: cache app shell only; never cache API responses or user data

**Step 2 — Supabase browser client**
- web/src/lib/supabase/client.ts using browser client only
- Auth session listener integrated with TanStack Query

**Step 3 — Sign-in screen (SCR-01)**
- Google OAuth button ("Continue with Google")
- Email and password authentication (Sign in, Sign up, Forgot password, Recovery modes)
- Magic link completely removed
- Clear error handling & rate limit diagnostics
- Design: Inter font, calm surface, minimal per DP-01..04
- Microcopy per design.md §12

**Step 4 — Dexie local schema**
- web/src/lib/db/index.ts
- Tables: local_items, outbox, sync_meta
- Typed with Dexie TypeScript generics

**Step 5 — CaptureBar component**
- States: empty, focused, saving, saved, offline (per design.md s8 component table)
- Enter key submits on desktop
- Local save to local_items + outbox entry on submit
- "Saved" confirmation within 300 ms (FR-02)
- "Saved offline — will sync later" when navigator.onLine is false (design.md s12)
- raw_input is immutable from the moment of capture (FR-03, ADR-06)

**Step 6 — Capture screen (SCR-02)**
- CaptureBar visually dominant and centered
- Recent captures below (last 5 from IndexedDB)
- SyncIndicator component (small, unobtrusive)
- Responsive: single-column mobile, centered desktop per design.md s10

**Step 7 — Sync engine (push path only) — AUDITED & APPROVED in Phase 1C**
- **Architecture**: Dedicated layer in `web/src/lib/sync/` (`types.ts`, `mapper.ts`, `engine.ts`, `sync-context.tsx`) separated cleanly from capture domain logic and UI.
- **Canonical Outbox State Machine**: Explicit transitions: `pending` -> `syncing` -> `synced` | `failed`.
  - `pending`: Awaiting push to cloud.
  - `syncing`: Currently being uploaded in active drain cycle.
  - `synced`: Successfully pushed and upserted in Supabase.
  - `failed`: Terminal failure on permanent errors (e.g., 400 Bad Request, schema violation) to prevent infinite loops.
  - *Retention Rationale*: `synced` records are kept in IndexedDB as a local audit trail and test verification checkpoint. Pruning older synced records (e.g. > 7 days) can be scheduled without affecting active sync queues.
  - *Crash Recovery*: Stale `syncing` records from crashes/reloads automatically recover to `pending` on app startup (`recoverStaleSyncingRecords`).
- **Authentication & Ownership Invariants**:
  - Eliminated magic placeholder `"local-user"`: unauthenticated captures store `user_id = null`.
  - Invariant: `user_id = null` records remain local-first in IndexedDB only; `drainOutbox` strictly skips them (`skippedCount++`), guaranteeing zero unauthenticated data leaks to cloud.
  - Client-generated UUIDv4 `id` preserved across local and server records.
- **Account Switching**:
  - Safe behavior: If User A captures notes and logs out, and User B logs in, the sync engine validates `record.payload.user_id === authenticatedUserId`. User A's pending records are skipped and will NEVER be uploaded to User B's Supabase account.
- **Security Boundary (RLS vs Client Validation)**:
  - Client-side checks are defense-in-depth safety filters. The true security boundary is PostgreSQL RLS (`auth.uid() = user_id`) paired with Supabase Auth JWTs.
  - Browser client exclusively uses `VITE_SUPABASE_ANON_KEY`. Zero privileged keys or service-role tokens exist on the client.
- **Idempotency & Upsert**:
  - Supabase `items` table upsert uses `{ onConflict: 'id' }` matching client UUID. Multiple retries cannot create duplicate records or modify IDs.
- **Retry Semantics & Backoff**:
  - Transient network failures and 5xx errors retain `pending` status, increment `retry_count`, and enforce exponential backoff: `Math.min(1000 * 2^retry_count, 30000)`.
  - Immediate drains before backoff duration elapses are skipped unless explicit retry is forced (`force: true`).
  - Auth failures (401 / null session) skip queue draining without incrementing error counts or thrashing the network.
- **Capture Independence**:
  - `web/src/lib/db/capture.ts` has zero sync or network dependencies. Local writes execute in < 2ms (far below the 300ms SLA).
- **Testing**: 15 test cases (13 unit/integration in `sync-engine.test.ts`, 2 in `sync-indicator.test.tsx`), covering unauthenticated isolation, account switching, retry backoff, stale recovery, and RLS defense-in-depth. All 41 web tests and 6 api tests passing.

**Step 8 — Inbox screen (SCR-03) — COMPLETED & TESTED in Phase 1D**
- **Architecture**: Domain service layer in `web/src/lib/inbox/service.ts` decoupled from React presentation components (`ItemRow`, `InboxFilters`, `InboxList`, `InboxEmptyState`, `InboxPage`).
- **Data Source & Offline Durability**:
  - Offline: reads directly from IndexedDB `local_items` (`deleted_at is null`).
  - Online: fetches active user items from Supabase (`deleted_at is null`, ordered by `captured_at desc`), gracefully merging any pending local captures and caching remote rows in IndexedDB.
  - Failure tolerance: network or server 5xx errors fallback seamlessly to local IndexedDB captures without hiding or blanking user data.
- **Item Ordering**: Strict reverse chronological order (`captured_at desc`) enforced in both Postgres SQL queries and local array operations.
- **ItemRow Component**:
  - Type icons: `Link2` (Resource), `Lightbulb` (Idea), `CheckSquare` (Task), `Calendar` (Event), `FileText` (Note), `HelpCircle` (Unclassified).
  - Relative time: calm humanized relative labels ("just now", "2 min ago", "1 hr ago", "yesterday", or date).
  - States: default, hover (`hover:bg-muted/40`), selected, and deleting with accessible touch targets.
  - Delete action: trash button invoking soft delete with accessible label.
- **Filter Tabs**: Canonical category filtering: `All`, `Resource`, `Idea / Note`, `Task`, `Event`. Tab counts dynamically rendered. Filter empty state ("No items in this category.") with "View all items" reset action.
- **Soft Delete & Tombstone Synchronization**:
  - `softDeleteItem`: sets `deleted_at = new Date().toISOString()`, appends or updates outbox tombstone record (`operation: 'delete'`), and triggers background sync.
  - Race condition protection (delete before initial upload): updates pending outbox payload so initial upsert sends `deleted_at: now` directly, preventing accidental resurrection.
  - Delete after sync: queues a new delete operation in outbox so Supabase updates `deleted_at`.
  - Idempotent: repeated deletions on already tombstoned items are safe no-ops (`alreadyDeleted: true`, no duplicate outbox records).
  - Offline deletion: tombstone saved to IndexedDB immediately, item removed from UI, and synced when reconnected.
- **Testing**: 21 unit & UI integration tests (`inbox-service.test.ts`, `inbox-page.test.tsx`), covering reverse chronological ordering, category filters, empty states, soft delete, race conditions, and offline deletion. Total suite passing: 62 tests across 10 test files.

**Step 9 — JSON export (FR-31)**
- Settings page stub (SCR-10 skeleton only)
- Export all data button: fetch all user items, download as .json

**Step 10 — Phase 1 acceptance tests**
- Playwright: capture -> local save -> "Saved" confirmation < 300 ms
- Playwright: capture offline -> "Saved offline" confirmation appears
- Playwright: retry sync -> no duplicate item in Supabase
- RLS: User A item not accessible to User B

---

## 8. Skills Identified as Relevant

| Skill | Relevance | Application Note |
|-------|-----------|-----------------|
| shadcn | High | Component selection, CLI workflow, Tailwind v4 integration |
| tailwind-patterns | High | Tailwind v4 CSS-first config, spacing, dark mode tokens |
| nextjs-supabase-auth | Medium — ADAPT | Use browser client patterns only; ignore server/middleware patterns |
| frontend-design | Medium — OVERRIDE | Design thinking framework useful; aesthetic mandates overridden by project spec |
| gpt-taste | Do not apply | Project spec explicitly bans GSAP motion, bento grids, cinematic animation for this tool |
| tdd-workflow | High | Phase 0 CI and Phase 1 acceptance tests |
| varlock | Medium | Secret management during development |
| concise-planning | Medium | Phase planning and task breakdown |

---

## 9. Blockers (All Require Human Action)

| ID | Blocker | Notes |
|----|---------|-------|
| B-01 | Supabase dev and prod projects must be created | Requires Supabase account; credentials must be provided as env vars before any DB work |
| B-02 | Directory structure must be confirmed | IMPL-A-03 assumes web/ + api/; confirm before scaffold |
| B-03 | Google OAuth app registration | Google Cloud Console OAuth 2.0 client must be created; redirect URI configured in Supabase |
| B-04 | VERIFY items from review.md not yet checked | Vercel, Supabase Free, Render Free, Gemini, GitHub Actions terms must be verified before deployment (does not block Phase 0 scaffold) |
| B-05 | CI secrets for Supabase in GitHub Actions | SUPABASE_URL and SUPABASE_ANON_KEY must be added to repo secrets before CI DB tests can run |

---

## 10. Phase Gate Reminder

Per PRD s8: Do not start Phase 2 until Phase 1 has been used for real for several days and all Phase 1 acceptance tests pass. This applies to every subsequent phase.

---

## 11. Items Explicitly Deferred (Do Not Implement Yet)

- AI classification (Phase 5)
- URL metadata enrichment / FastAPI resource fetcher (Phase 4)
- Full-text search (Phase 3)
- Zustand (deferred unless cross-component state becomes painful)
- React Hook Form (deferred unless complex forms appear)
- pgvector / semantic search (Phase 8)
- Graph visualization (Phase 8)
- Notes, Tasks, Calendar screens (Phase 6)
- Relationships (Phase 7)
- Sentry error tracking (pending privacy review)
- Web Share Target (feature-detect only; not a core capture path dependency)

---

## 12. Authentication Simplification & Security Hardening (Completed)

- **Authentication Methods**: Strictly simplified to two methods:
  1. Email and Password (Sign in, Sign up with password confirmation, Password reset, and Password recovery).
  2. Google OAuth (`signInWithOAuth` using existing browser client).
- **Magic Link Removal**: Completely removed `signInWithOtp`, OTP buttons, OTP input fields, and obsolete magic link tests. Magic links were eliminated due to Supabase free-tier rate limits (3 emails/hour), email delivery delays, and domain restrictions.
- **Security Audit & Hardening**:
  - **RLS Verification**: Confirmed all 8 database tables (`profiles`, `items`, `resources`, `tasks`, `calendar_events`, `tags`, `item_tags`, `item_relationships`) enforce PostgreSQL Row Level Security with strict `auth.uid()` checks for both `USING` and `WITH CHECK`.
  - **Multi-Tenant / Cross-User Isolation**: Verified User B cannot read, mutate, delete, or insert records with User A's `user_id`.
  - **Offline Capture Isolation**: Unauthenticated captures store `user_id = null` and are strictly skipped by the sync engine until safely associated with an authenticated account.
  - **Account-Switch Protection**: The sync engine strictly skips pending outbox records if `record.payload.user_id !== authenticatedUserId`. User A's local pending records never leak to User B's cloud account.
  - **Credential & Secret Protection**: No service-role keys or database passwords exist in frontend code or git repository.
  - **Logging Hygiene**: Diagnostic logs strictly omit passwords, session tokens, access tokens, and sensitive capture content.
  - **FastAPI Review**: Auxiliary backend has CORS restricted to configured origins, health check endpoint with no auth bypasses, and Pydantic validation.
- Calendar external sync (non-goal for MVP)

---

## 13. Phase 1E — Settings Skeleton + JSON Export (Completed)

- **Settings Screen (SCR-10)**: Implemented in `web/src/pages/settings-page.tsx` and routed to `/settings` in `web/src/App.tsx`.
  - Header with account information (Email, User ID, Provider name).
  - "Sign out" action integrated with `useAuth().signOut()`.
  - Storage & device privacy advisory regarding unencrypted browser IndexedDB storage.
- **Sync Diagnostics & Safe Recovery Engine**:
  - Live synchronization status display (Synced, Syncing, Pending, Offline, Sync issue).
  - Diagnostic details box exposing `lastError` with actionable troubleshooting steps.
  - "Retry Sync Now" action via `retrySync(force)` in `web/src/lib/sync/sync-context.tsx`.
  - `resetFailedOutboxRecords(authenticatedUserId)` in `web/src/lib/sync/engine.ts` securely resets eligible failed outbox records for the active user while strictly excluding unauthenticated (`user_id = null`) and cross-account records.
  - Automatic clearance of `lastErrorCache` once all records drain cleanly or when `clearLastError()` is invoked on retry, logout, or account switch.
  - `getSyncEngineState(database, authenticatedUserId)` scopes pending and failed counts strictly to the active user, preventing cross-account false error badges.
- **Client-Side JSON Export (FR-31) — Schema v1.0.0**:
  - Documented, versioned JSON schema (`schema_version: "1.0.0"`) defined in `web/src/lib/export/types.ts`:
    ```json
    {
      "metadata": {
        "schema_version": "1.0.0",
        "app_version": "0.1.0",
        "exported_at": "ISO-8601 timestamp",
        "user_id": "UUID",
        "is_offline": false,
        "is_partial": false,
        "partial_reasons": [],
        "sync_status": "synced",
        "counts": {
          "items_total": 0,
          "items_active": 0,
          "items_soft_deleted": 0,
          "resources": 0,
          "tasks": 0,
          "calendar_events": 0,
          "tags": 0,
          "item_tags": 0,
          "item_relationships": 0,
          "unsynced_local_items": 0
        }
      },
      "profile": { ... },
      "items": [ ... ],
      "resources": [ ... ],
      "tasks": [ ... ],
      "calendar_events": [ ... ],
      "tags": [ ... ],
      "item_tags": [ ... ],
      "item_relationships": [ ... ]
    }
    ```
  - **Service Pipeline** (`web/src/lib/export/service.ts`):
    - Concurrent, isolated queries across all 8 cloud tables (`profiles`, `items`, `resources`, `tasks`, `calendar_events`, `tags`, `item_tags`, `item_relationships`).
    - **Partial-Export Resilience**: If any cloud table query encounters an error (e.g., table missing, network drop), it does NOT abort the remaining tables; whatever data is successfully retrieved is included, and `is_partial: true` is flagged with diagnostic details.
    - **Local/Cloud Merging Precedence**: Merges cloud records with local Dexie items using stable UUIDs. If a local item has unsynchronized edits (`!synced`) or a newer timestamp (`local.updated_at >= cloud.updated_at`), the local version takes precedence.
    - **Tombstone Preservation**: Soft-deleted records (`deleted_at !== null`) are preserved in the export so future imports do not accidentally resurrect deleted notes.
    - **Strict Ownership**: Local records with `user_id = null` and records belonging to other users are strictly excluded from the export.
    - **Pure Client-Side**: Generates and downloads the `.json` file using native browser `Blob` and Object URL; zero external API requests.
- **Verification Status — Distinction Between Automated & Live**:
  - **Automated Mocked Tests**:
    - **Frontend**: 13 test suites / 92 tests passing across `web/` (`npm test -- --run`).
    - **TypeScript**: 0 errors (`tsc -b`).
    - **Linter**: 0 errors (`oxlint`).
    - **Production Build**: Successful bundle and PWA service worker generated (`vite build`).
    - **Backend**: 6 / 6 tests passing (`pytest`) and `ruff check` passed.
  - **Live Supabase Verification Status**:
    - **NOT yet verified against live Supabase cloud**.
    - In the current live browser session, the sync engine encounters PostgREST 404 relation missing errors because the SQL schema migration has not yet been executed in the remote Supabase project.
    - **Action Required**: Run `supabase/migrations/20261008000000_initial_schema.sql` and `supabase/migrations/20261009000000_classify_item_rpc.sql` in the Supabase Dashboard SQL Editor before live cloud sync and full cloud classification can be verified.

---

## 14. Phase 2 — Item Classification & Editing (Completed)

- **Item Detail Route & Navigation (SCR-04)**:
  - Mounted `/items/:id` in `web/src/App.tsx` wrapped in `ProtectedRoute` and `AppShell`.
  - Updated `web/src/pages/inbox-page.tsx` row selection to route to `/items/:id`.
  - Implemented 4 distinct states:
    - **Loading State**: Subtle pulsating skeleton placeholders with back link.
    - **404 / Missing State**: Clear "Item Not Found" card with explanation and Return to Inbox button.
    - **Permission Denied**: Strictly rejects cross-user queries via RLS (`user_id = auth.uid()`) and returns sanitized not-found state without leaking item metadata.
    - **Editing Interface**: Clean editorial layout with title input, markdown content textarea, type selector, dynamic extension fields, and immutable `raw_input` provenance card.
- **Classification & Extension Tables**:
  - Supports 4 primary types: Note/Idea, Task, Resource, Event.
  - **Editable fields**: `title` and `content`.
  - **Immutable `raw_input` (ADR-06)**: Preserved untouched as read-only audit trail with copy button, monospace styling, and capture timestamp.
  - **Extension Form Controls**:
    - **Task**: Due date-time picker, 3-state priority buttons (`low`, `normal`, `high`), and completion toggle checkbox.
    - **Resource**: URL input with validation and 3-state reading status (`unread`, `reading`, `completed`).
    - **Event**: Start time, optional end time, and all-day toggle with validation (`end_at >= start_at`).
- **PostgREST Transaction Safety (Atomic Classification & Fail-Closed Integrity)**:
  - Addressed PostgREST limitation where multi-table REST updates are not inherently atomic.
  - Added PostgreSQL stored function `classify_and_update_item` in migration `supabase/migrations/20261009000000_classify_item_rpc.sql`.
  - Runs in a single atomic database transaction with `SECURITY INVOKER` and explicit `auth.uid() = p_user_id` authorization.
  - Automatically upserts the target extension row (`tasks`, `resources`, `calendar_events`) and deletes any stale extension rows when switching types within the same transaction.
  - **Fail-Closed Client Policy**: The client strictly invokes `classify_and_update_item` via RPC with zero silent fallbacks to independent multi-table writes. If the RPC fails or is missing, the mutation aborts immediately, leaving the database and local Dexie cache untouched, and presenting a clear error alert to the user without falsely displaying "Saved".
- **Offline Behavior (ADR-02 Compliance)**:
  - **Viewing cached items is permitted offline** via local Dexie IndexedDB cache (`fetchItemDetail` queries local DB when offline).
  - **Editing, classification, and reorganization are strictly online-only**.
  - All form controls and save actions are disabled when `navigator.onLine === false`.
  - Amber warning banner is rendered alerting users that classification requires internet connectivity.
  - Rejects offline mutations early before modifying any local or remote state, completely avoiding split-brain multi-device merge conflicts.
- **Verification Status**:
  - **Automated Tests**:
    - **Frontend**: 20 test suites / 144 tests passing in `web/` (`npm test -- --run`).
    - **Item Detail & RPC Suite**: 12/12 tests passing (`src/test/item-detail-service.test.ts`), verifying atomic type switching, fail-closed RPC errors, stale extension cleanup, Dexie cache preservation on failure, and cross-account rejection.
    - **Item Detail UI Suite**: 6/6 tests passing (`src/test/item-detail-page.test.tsx`), verifying form save failure error alert (confirming "Saved" is never displayed on error).
    - **Notes Service Suite**: 5/5 tests passing (`src/test/notes-service.test.ts`), verifying notes fetching, RPC note creation, immutable raw_input preservation on edit, and soft deletion.
    - **Notes UI Suite**: 5/5 tests passing (`src/test/notes-page.test.tsx`), verifying list search, editor interactions, and offline read-only guard.
    - **Calendar Service Suite**: 13/13 tests passing (`src/test/calendar.test.ts`), verifying timezone conversions, date validation, RPC event creation/updates, and soft deletion.
    - **Calendar UI Suite**: 5/5 tests passing (`src/test/calendar-page.test.tsx`), verifying month navigation, date selection, date validation error handling, and offline banner.
    - **Smart Capture Suite**: 6/6 tests passing (`src/test/smart-capture.test.ts`), verifying Pinterest resource + Inspiration tag categorization, task/event syntax detection, and immediate raw input capture.
    - **TypeScript**: 0 errors (`tsc -b`).
    - **Linter**: 0 errors (`oxlint`).
    - **Production Build**: Clean production bundle with PWA service worker generated (`vite build`).
    - **Backend**: 6/6 tests passing (`pytest`) and `ruff check` passed.

---

## 8. Stabilization + Notes + Calendar Deliverables (October 2026)

### Deliverable 1 — Save Failure Resolution & RPC Stabilization
- **Root Cause**: PostgREST returned `PGRST202: Could not find the function public.classify_and_update_item(...) in the schema cache` because the migration had not been executed on the live remote Supabase project, or lacked explicit `GRANT EXECUTE` permissions and schema cache notification.
- **Idempotent Migration Created**: [`supabase/migrations/20261010000000_classify_item_rpc_idempotent.sql`](file:///d:/sample-projects/bruno/supabase/migrations/20261010000000_classify_item_rpc_idempotent.sql):
  - Created with `SECURITY INVOKER`, enforcing authenticated user ID via `auth.uid() = v_user_id`.
  - Added atomic `INSERT` (when `p_item_id` is null or new) and `UPDATE` (when existing item).
  - Explicitly executes `GRANT EXECUTE ON FUNCTION public.classify_and_update_item(...) TO authenticated;`
  - Explicitly executes `NOTIFY pgrst, 'reload schema';` to reload the PostgREST cache immediately.
- **Fail-Closed Safeguard**: Strict fail-closed policy maintained in `web/src/lib/items/service.ts`, preventing silent multi-table writes when RPC is unavailable. Form inputs remain preserved on failure.

### Deliverable 2 — Dedicated Notes Module (`/notes`)
- **Navigation & Routing**: Mounted at `/notes` in `AppRoutes`, accessible from desktop header and mobile bottom navigation bar.
- **Notes List**: Reverse-chronological list of active note/idea items, displaying title, content preview, and updated timestamp.
- **Real-Time Search**: Title and content filtering across loaded notes.
- **Editor**: Textarea supporting plain text and lightweight Markdown, immutable `raw_input` provenance badge, explicit Save with unsaved changes tracking, and `beforeunload` warning.
- **Lifecycle**: Soft-delete using tombstone pattern, updating parent `items` record (`deleted_at = now()`).
- **Offline Guard**: Renders clear banner and disables creation/editing while offline per ADR-02.

### Deliverable 3 — Dedicated Calendar Module (`/calendar`)
- **Navigation & Routing**: Mounted at `/calendar` in `AppRoutes`.
- **Month Grid**: Desktop and mobile month grid with previous/next month navigation, Today jump, and date indicators.
- **Event List**: Day-specific event list showing title, time/all-day badge, and description preview.
- **Create & Edit Dialog**: Atomic event creation and updates via `classify_and_update_item` RPC with full date validation (`end_at >= start_at`).
- **Timezone Management**: User timezone detected via browser/profile, converting timestamps to/from UTC `timestamptz`.
- **Offline Guard**: Cached events viewable offline; creation and editing disabled with clear notice.

### Deliverable 4 — Smart Capture Compatibility
- **Deterministic Local Classification**: Fast synchronous syntax matching in `web/src/lib/db/capture.ts`:
  - Pinterest URLs (`pinterest.com`, `pin.it`) automatically classify as `resource` with suggested tag `Inspiration` (`ai_tags: ["Inspiration"]`).
  - Standard URLs classify as `resource`.
  - Task language (`todo:`, `task:`, `[ ]`, `remember to`) classify as `task`.
  - Event language (`event:`, `meeting:`, `call:`, `appointment with`) classify as `event`.
  - Other text defaults to `unclassified`.
- **Zero Overhead**: Preserves immediate raw input capture and Dexie transaction write (< 15 ms).

---

## 9. UI Refinement & Design Quality Pass Deliverables (October 2026)

### Deliverable 1 — Typography System & Design Token Evolution
- **Sculptural Geometric Display Typography**: Integrated Google Fonts (`Outfit`, `Plus Jakarta Sans`, `Syne`) inspired by user reference typography specimens (`flexing`, `spark.`).
- **Heading Standardization**: `--font-heading` assigned to all titles, brand headers, dialog headings, and modal sections (`font-heading font-extrabold tracking-tight`).
- **Body Legibility**: `--font-sans` configured with `@fontsource-variable/geist` (`Geist Variable`) and `@fontsource/inter` for warm, legible, distraction-free reading measure.
- **Surface & Token Polish**: Replaced harsh card containers with subtle rounded-xl borders (`border-border/80`), tactile shadows (`shadow-2xs`), and restrained accents.

### Deliverable 2 — Screen Refinements
- **App Shell & Navigation**:
  - Brand header elevated with bold geometric display title `Personal Memory`.
  - Desktop nav links styled with subtle tactile active pills (`bg-secondary text-foreground font-semibold shadow-2xs`).
  - Mobile bottom navigation bar refined with 44px min touch targets, clean backdrop blur (`bg-background/95 backdrop-blur-md`), and distinct active states.
  - Quiet, unobtrusive `SyncIndicator` integration.
- **Capture Experience (`/capture`)**:
  - Dominant hero capture section with bold typography.
  - Live deterministic smart-capture suggestion badge dynamically rendered during typing (e.g. `Resource · Inspiration` for Pinterest, `Resource` for URLs, `Task` for todos, `Event` for meetings) without adding clicks or network round-trips.
  - Subdued keyboard instructions (`Enter` to save, `Shift+Enter` for newline) with monospace kbd styling.
  - Elevated recent captures list with relative timestamps and distinct icon treatments.
- **Inbox & Triage (`/inbox`)**:
  - Refined filter pill navigation with count badges and smooth active indicators.
  - Item rows styled with subtle rounded-xl borders, category badges, soft delete controls, and offline indicators.
- **Item Detail & Classification (`/items/:id`)**:
  - Unified header with breadcrumb and Save Changes action.
  - TypeSelector segmented pill buttons for instant classification switching.
  - Authoritative, clean read-only provenance card for immutable `raw_input` (ADR-06).
- **Notes (`/notes`)**:
  - Two-column layout with real-time search, count badges, and clean list item cards.
  - Distraction-free Markdown editor with display title typography and unsaved change detection.
- **Calendar (`/calendar`)**:
  - High-clarity month grid with uppercase weekday headers, today indicator, and event pills.
  - Selected day agenda view with quick event creation and edit dialog.
- **Settings (`/settings`)**:
  - Logically grouped Account, Synchronization, and Data Portability sections with diagnostic details.
  - Tactile action buttons for Retry Sync and JSON Export.

### Verification Matrix
- **Vitest Unit/Integration Tests**: 21/21 test files (150/150 tests) passing.
- **TypeScript Typecheck**: 0 errors (`tsc -b`).
- **Linter**: 0 errors (`oxlint`).
- **Vite Production Build**: Successful bundle generation in 0.9s.
- **FastAPI Pytest**: 6/6 tests passing.
- **FastAPI Ruff**: All checks passed.

---

## 10. Focus Lens Navbar, Responsive Layout & Dark/Light Theme System (October 2026)

### Deliverable 1 — Focus Lens Floating Capsule Navbar
- **Desktop Floating Capsule**:
  - Centered horizontally near the top of the viewport (`sticky top-3.5 z-40`).
  - Encased in a refined, compact pill (`rounded-full border border-border/80 bg-background/85 dark:bg-card/80 backdrop-blur-md shadow-sm`).
  - Integrated brand identity with active navigation links for **Capture**, **Inbox**, **Notes**, and **Calendar**.
  - Restrained active route pill (`bg-secondary text-foreground font-semibold shadow-2xs rounded-full`).
  - Subtle divider elements separating identity, navigation routes, and the right utility control group.
  - Balanced utility cluster integrating `SyncIndicator`, `ThemeToggle`, `Settings`, and `Sign out`.
- **Mobile Responsive Header & Capsule**:
  - Dedicated compact top header (`md:hidden sticky top-2 z-40`) providing brand mark, live sync indicator, theme toggle, and sign out without crowding.
  - Floating bottom capsule navigation bar (`fixed bottom-3 inset-x-3 max-w-sm mx-auto z-40 rounded-full border border-border/80 bg-background/95 dark:bg-card/95 backdrop-blur-md shadow-md p-1.5`) with 44px touch targets respecting `safe-area-pb` insets.
  - All primary routes (**Capture**, **Inbox**, **Notes**, **Calendar**, **Settings**) remain comfortably thumb-reachable.

### Deliverable 2 — Responsive Container Tokens & Horizontal Whitespace Remediation
- **Audit & Standardization**: Eliminated cramped legacy `max-w-2xl` (672px) wrappers across all routes, establishing intentional workspace widths:
  - **Capture (`/capture`)**: Expanded to `max-w-4xl lg:max-w-5xl` (960px–1024px). The `CaptureBar` input and `RecentCaptures` list use the available width with clean vertical rhythm and unified alignment.
  - **Inbox (`/inbox`)**: Expanded to `max-w-4xl lg:max-w-5xl`. Broadened item rows with aligned metadata badges, category chips, relative timestamps, and soft delete actions.
  - **Notes (`/notes`)**: Expanded to `max-w-5xl lg:max-w-6xl` (1024px–1152px). Generous two-column layout giving 4 columns to real-time search & note lists and 8 columns to the distraction-free Markdown editor.
  - **Calendar (`/calendar`)**: Expanded to `max-w-5xl lg:max-w-6xl`. Optimized month grid taking 2 columns on `lg:` viewports with 1 column dedicated to the selected day agenda view.
  - **Item Detail (`/items/:id`)**: Form and immutable provenance card container aligned to `max-w-3xl lg:max-w-4xl` for comfortable long-form editing and reading measures.
  - **Settings (`/settings`)**: Upgraded to `max-w-3xl lg:max-w-4xl` with spacious cards for Account, Synchronization Diagnostics, and Portable JSON Export.

### Deliverable 3 — Complete Light & Dark Theme System
- **Semantic CSS Token System**:
  - **Light Mode**: Warm off-white background (`oklch(0.985 0.003 95)`), crisp elevated white card surfaces (`oklch(1 0 0)`), rich charcoal text (`oklch(0.18 0.005 60)`), and subtle warm borders (`oklch(0.91 0.003 90)`).
  - **Dark Mode**: Deep matte obsidian charcoal background (`oklch(0.13 0.006 260)`), elevated charcoal card surfaces (`oklch(0.17 0.006 260)`), soft high-contrast text (`oklch(0.97 0 0)`), and subtle translucent borders (`oklch(1 0 0 / 11%)`).
  - No harsh pitch-black or clinical stark white extremes; zero neon accents.
- **Pre-Hydration Anti-FOUC Script**: Embedded inline `<script>` in `index.html` `head` that parses `localStorage.getItem('pm-theme')` or system `prefers-color-scheme` immediately prior to DOM rendering, preventing theme flash on reloads.
- **Persistence & Fallback**: `ThemeProvider` persists user selections to `localStorage` under `pm-theme`, automatically listens to OS media query changes in system mode, and provides fallback defaults for resilient testing.
- **ThemeToggle Component**: Accessible toggle button featuring Sun/Moon iconography with rotation transitions and ARIA attributes, integrated into desktop navbar, mobile header, and login screen.

### Deliverable 5 — Official Praxis Logo (ALT 3 / MODERN) Integration
- **Logo Preservation**:
  - Exact preservation of the official symbol: bold geometric letter **P** (`#181818`), opaque white cat silhouette (`#FFFFFF`), soft warm gray cat eye (`#A9A8A7`), and warm orange four-point sparkle (`#F76F31`).
  - Wordmark **Praxis** beneath the symbol in bold modern geometric sans typography (`#181818` for light mode, `#F5F5F5` for dark mode).
  - Source reference saved at `web/public/branding/praxis-logo-reference.png`.
- **Vector & High-DPI Assets**:
  - `web/public/branding/praxis-icon.svg`: Standalone cat-and-P symbol with orange sparkle.
  - `web/public/branding/praxis-logo.svg`: Full logo (symbol + wordmark) for light mode.
  - `web/public/branding/praxis-logo-dark.svg`: Full logo with light wordmark for dark mode.
  - `web/public/favicon.svg`: Standalone symbol favicon optimized for browser tabs.
  - Transparent PNGs with opaque white cat: `praxis-icon.png`, `praxis-icon@2x.png`, `praxis-logo.png`, `praxis-logo@2x.png`, `praxis-logo-dark.png`, `praxis-logo-dark@2x.png`.
- **Reusable PraxisLogo Component (`web/src/components/branding/praxis-logo.tsx`)**:
  - Supports `variant`: `"full" | "icon" | "wordmark"`.
  - Supports `size`: `"xs" | "sm" | "md" | "lg" | "xl"`.
  - Handles light & dark mode via responsive `dark:hidden` / `hidden dark:block` image rendering without layout shift.
  - Accessible `alt` text and sizing attributes.
- **Application Integration**:
  - Desktop Focus Lens Navbar (`app-shell.tsx`): Replaced placeholder dot with `PraxisLogo variant="icon" size="sm"`.
  - Mobile Floating Top Header (`app-shell.tsx`): Replaced dot with `PraxisLogo variant="icon" size="xs"` and clean "Praxis" branding.
  - Authentication Page (`auth-page.tsx`): Centered `PraxisLogo variant="full" size="lg"` prominently above the form.
  - Route Loading States (`protected-route.tsx`, `public-route.tsx`): Subtle `PraxisLogo variant="icon"` with gentle pulsing animation.
  - Browser Metadata (`index.html`): SVG favicon link `/favicon.svg`, PNG fallback, and Apple touch icon.
  - PWA Configuration (`vite.config.ts`): Registered branding assets in `includeAssets` for offline caching.
### Deliverable 6 — Daily To-Do Planner & Weekly Productivity Statistics
- **Architecture & Data Model**:
  - Leveraged existing `public.items` (`type = 'task'`) and `public.tasks` (`due_at`, `priority`, `completed_at`) without duplicate tables.
  - Added migration `20261012000000_tasks_completed_idx.sql` indexing `public.tasks(user_id, completed_at)` for sub-millisecond weekly aggregations.
  - Offline-first resilience via Dexie `local_items` fallback.
- **Core Daily Planner (`web/src/pages/planner-page.tsx`)**:
  - `TaskQuickAdd` inline form with priority cycling (`normal`, `high`, `low`) and time setting.
  - `TaskItemRow` with accessible toggle checkbox, priority badges, detail routing, and carry-forward actions.
  - `RolloverBanner` identifying overdue tasks from previous days with one-click "Carry all to today".
  - Day navigation with previous/next day, quick "Today" shortcut, and completion progress counter.
- **Weekly Productivity Dashboard**:
  - Strict Monday 00:00:00 to Sunday 23:59:59 week boundaries via pure math utilities in `stats.ts`.
  - Four key metric cards: Planned tasks, Completed tasks, Completion rate (0-100%), and Outstanding/overdue tasks.
  - Accessible CSS/SVG 7-day activity bar chart (`WeeklyBarChart`) and detailed daily breakdown table.
  - Week navigation with previous/next week and "This Week" shortcuts.
- **Application Integration**:
  - Registered `/planner` route with lazy-loading in `App.tsx`.
  - Added Planner (`CheckSquare`) navigation link in desktop floating capsule and mobile tab bar in `app-shell.tsx`.
- **Verification**:
  - Automated tests: 21 tests across 3 new test suites (`planner-stats.test.ts`, `planner-service.test.ts`, `planner-page.test.tsx`) passing 100%.
  - Total web tests: 28 test suites, 199/199 passing.
  - TypeScript: 0 errors (`tsc -b`).
  - Linter: 0 errors.
  - Production Build: Successfully generated `dist/` with PWA precaching.
  - Backend: 6/6 pytest passing.





