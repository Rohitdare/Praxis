# Praxis Repository Audit Report

**Date:** 2026-10-11  
**Auditor:** Senior Software Engineer, Repository Maintainer & Security Reviewer  
**Repository:** Praxis (`d:\sample-projects\bruno`)  
**Status:** Audit Complete — Pre-Refactoring Baseline Established  

---

## 1. Executive Summary

An exhaustive audit of the Praxis repository was conducted across frontend (`web/`), backend auxiliary services (`api/`), Supabase migrations (`supabase/`), documentation (`docs/`), environment configurations, dependencies, and git history.

The repository is structurally sound, with strong local-first principles and strict Row Level Security (RLS) enforcement. No hardcoded production secrets or uncommitted credential leaks exist in the git history. 

This audit documents specific optimization opportunities in **type safety**, **route-level code splitting**, **utility consolidation**, **documentation alignment**, and **repository hygiene** that will improve performance, maintainability, and production-readiness without disrupting verified core functionality.

---

## 2. Baseline Verification Results

Prior to making any repository changes, all existing test suites, linters, type checks, and production builds were executed to record the empirical baseline:

| Workspace | Command | Result | Details |
|-----------|---------|--------|---------|
| `web/` | `npm run typecheck` (`tsc -b`) | **PASS** | 0 type errors across all TypeScript projects. |
| `web/` | `npm run lint` (`oxlint`) | **PASS (with warnings)** | 0 errors, 10 warnings (React fast-refresh component exports & state in effects). |
| `web/` | `npm test` (`vitest run`) | **PASS** | 25 test files passed, 172 unit & integration tests passed (100%). |
| `web/` | `npm run build` (`vite build`) | **PASS (with warning)** | Built in 1.10s. Monolithic bundle: `index.js` = 736.56 kB (gzip 214.72 kB). Vite warned on chunk size > 500 kB. |
| `api/` | `pytest` | **PASS** | 6 passed in 0.72s (`test_health.py`, `test_rls_isolation.py`). |
| `api/` | `ruff check .` | **PASS** | 0 lint errors. |
| `api/` | `ruff format --check .` | **PASS** | 5 files verified formatted. |
| Security | Git commit history inspection | **PASS** | No credentials or `.env` files tracked; `.gitignore` rules active and respected. |

---

## 3. Findings by Category & Severity

### Finding 1: Monolithic Frontend Bundle & Missing Route-Level Code Splitting
- **Severity:** Medium (Performance / User Experience)
- **Affected Files:** `web/src/App.tsx`, `web/vite.config.ts`
- **Description:** All top-level page components (`AuthPage`, `CapturePage`, `InboxPage`, `NotesPage`, `CalendarPage`, `ItemDetailPage`, `SettingsPage`) are imported statically in `App.tsx`. As a result, Vite packages the entire application into a single 736 kB minified JavaScript bundle. Users landing on `/auth` or `/capture` download the entire Calendar and Notes suites upfront.
- **Recommended Action:** Implement route-level code splitting using `React.lazy()` and `<Suspense>` with a calm fallback inside `AppShell` / `AppRoutes`. Configure vendor chunk separation in `vite.config.ts` if appropriate.

### Finding 2: Unsafe `any` Assertions on Supabase RPC Calls & Database Types
- **Severity:** Medium (Type Safety & Maintainability)
- **Affected Files:**
  - `web/src/lib/supabase/database.types.ts`
  - `web/src/lib/items/service.ts`
  - `web/src/lib/calendar/service.ts`
- **Description:** 
  1. `web/src/lib/supabase/database.types.ts` defines `Functions: { [_ in never]: never }`. The migration `20261010000000_classify_item_rpc_idempotent.sql` introduced `public.classify_and_update_item(...)`, but because this RPC function is absent from `Database['public']['Functions']`, developers were forced to bypass type checking via `(supabase as any).rpc(...)` and `(client as any).rpc(...)`.
  2. In `web/src/lib/calendar/service.ts` line 98, calendar event query results are cast using `(row: any)`.
- **Recommended Action:** Strongly type `classify_and_update_item` in `database.types.ts` with its exact arguments and return types. Remove `as any` casts in `items/service.ts` and `calendar/service.ts`, replacing them with typed RPC responses and a strongly typed `CalendarQueryRow` interface.

### Finding 3: Inconsistent ClassName Utility Imports (`"cn"` vs `@/lib/utils`)
- **Severity:** Low (Code Consistency / DX)
- **Affected Files:**
  - `web/src/components/ui/input.tsx`
  - `web/src/components/ui/button.tsx`
  - `web/src/components/ui/date-time-picker.tsx`
  - `web/src/components/inbox/item-row.tsx`
  - `web/src/components/inbox/inbox-filters.tsx`
  - `web/src/lib/utils.ts`
- **Description:** Some components import `cn` directly from `"cn"` while the shadcn convention and project structure specify `@/lib/utils`. Standardizing to `@/lib/utils` provides a single source of truth for UI utilities.
- **Recommended Action:** Standardize all internal imports to `@/lib/utils`.

### Finding 4: Empty and Outdated Documentation Files
- **Severity:** Low (Repository Hygiene & Onboarding)
- **Affected Files:**
  - `README.md`
  - `api/README.md`
  - `web/README.md`
- **Description:**
  1. `README.md` retains the old title `# Personal Memory App` and cites an invalid Python invocation (`uv run uvicorn main:app` instead of `personal_memory_api.main:app`).
  2. `api/README.md` is empty (0 bytes).
  3. `web/README.md` contains default Vite boilerplate.
- **Recommended Action:** Update `README.md`, `web/README.md`, and `api/README.md` to accurately describe Praxis, its architecture, requirements, and exact running/testing commands.

### Finding 5: Stray Untracked Artifact in Documentation Directory
- **Severity:** Low (Repository Hygiene)
- **Affected Files:** `docs/adrs/image.png`
- **Description:** An unreferenced 39 KB PNG image was placed in `docs/adrs/image.png`. It is not referenced in any ADR or markdown file.
- **Recommended Action:** Remove the unreferenced stray screenshot file from `docs/adrs/`.

### Finding 6: Empty Directory in Source Tree
- **Severity:** Trivial (Cleanliness)
- **Affected Files:** `web/src/assets/`
- **Description:** `web/src/assets/` is completely empty because public assets are correctly located in `web/public/`.
- **Recommended Action:** Remove empty `web/src/assets` directory.

---

## 4. Offline Capture & Synchronization Audit

An in-depth review of `web/src/lib/sync/sync-engine.ts`, `sync-context.tsx`, and `web/src/lib/db/index.ts` was performed against the core criteria:

1. **Offline Capture:** Uses IndexedDB (`PraxisDB` / Dexie) to immediately persist raw captures with client-generated UUIDv4 and pending outbox status. Verified working without network.
2. **Persistence across Restarts:** Outbox operations are durable in IndexedDB `outbox` table and rehydrated upon app startup.
3. **Idempotency & Stability:** Client-generated UUIDs (`itemId`) remain invariant across retries. The Supabase RPC `classify_and_update_item` is explicitly idempotent (`on conflict do update`).
4. **Account Switching Isolation:** Outbox entries and local item queries filter by `user_id`. When `auth.signOut()` occurs, local state clears/resets appropriately.
5. **Soft Deletes & Tombstones:** Deleted items receive `deleted_at = now()`, preventing ghost reappearance during synchronization sweeps.
6. **Integrity Rule:** No modifications to the synchronization core algorithms will be made that could jeopardize correctness or offline durability.

---

## 5. Security & Secrets Review

1. **Tracked Secrets:** Audited using `git log` and `git ls-files`. Zero credentials, `.env` files, or API keys are tracked in git.
2. **Environment Templates:** `.env.example` and `web/.env.example` contain only placeholder documentation strings (`https://your-project-id.supabase.co`).
3. **Row Level Security:** Audited `supabase/migrations/`. All tables (`items`, `notes`, `tasks`, `resources`, `calendar_events`, `ideas`, `profiles`, `item_relationships`) enforce RLS policies restricting read, insert, update, and delete operations strictly to `auth.uid() = user_id`.
4. **RPC Function:** `classify_and_update_item` is `security invoker` with explicit check `if v_user_id is null then raise exception 'Not authenticated'` and cross-tenant ownership check `if found and v_item.user_id <> v_user_id then raise exception 'Item not found or permission denied'`.

---

## 6. Planned Refactoring Actions

1. **Step 1:** Strongly type `classify_and_update_item` in `database.types.ts`. Refactor `items/service.ts` and `calendar/service.ts` to eliminate `as any`.
2. **Step 2:** Standardize `cn` imports across UI components to `@/lib/utils`.
3. **Step 3:** Implement route-level code splitting (`React.lazy` + `Suspense`) in `App.tsx` and configure Vite Rollup manualChunks for optimal vendor chunking.
4. **Step 4:** Clean up stray files (`docs/adrs/image.png`, empty `web/src/assets`).
5. **Step 5:** Update documentation (`README.md`, `web/README.md`, `api/README.md`).
6. **Step 6:** Run full validation suite (typecheck, lint, vitest, vite build, pytest, ruff) and record metrics before/after.
7. **Step 7:** Compile `docs/repository-cleanup-report.md`.
