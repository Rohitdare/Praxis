# Praxis Repository Cleanup & Architecture Optimization Report

**Date:** 2026-10-11  
**Lead Engineer:** Senior Software Engineer & Repository Maintainer  
**Repository:** Praxis (`d:\sample-projects\bruno`)  
**Scope:** Repository Cleanup, Architecture Audit, Type Safety, Frontend Optimization, Security Verification  

---

## 1. Original Repository Problems Identified

During the audit, the following specific issues and architectural friction points were identified:

1. **Monolithic Frontend Bundle:** All top-level page components were eagerly imported synchronously in `web/src/App.tsx`. Vite bundled the entire application into a single 736.56 kB JavaScript bundle (`index.js`), triggering Vite's bundle size warning (> 500 kB). Users landing on authentication or simple capture were forced to download the entire Calendar and Notes suites upfront.
2. **Type Safety Gaps in Supabase RPC Calls:** `web/src/lib/supabase/database.types.ts` had `Functions: { [_ in never]: never }`. Because the `classify_and_update_item` PostgreSQL RPC function (added in migration `20261010000000_classify_item_rpc_idempotent.sql`) was missing from the generated types, developers were forced to bypass type checking using unsafe casts like `(client as any).rpc(...)` and `(supabase as any).rpc(...)`.
3. **Unsafe Row Mapping:** In `web/src/lib/calendar/service.ts`, calendar event query results were mapped using an untyped `(row: any)` parameter.
4. **Inconsistent ClassName Utility Imports:** UI components inconsistently imported `cn` either directly from the npm package `"cn"` or through the project's standard internal alias `@/lib/utils`.
5. **Documentation Drift & Boilerplate:**
   - Root `README.md` retained the obsolete working title "Personal Memory App" and cited an invalid backend startup command (`uv run uvicorn main:app` instead of `personal_memory_api.main:app`).
   - `api/README.md` was completely empty (0 bytes).
   - `web/README.md` was unchanged default Vite boilerplate.
6. **Stray Files and Empty Directories:**
   - `docs/adrs/image.png`: An untracked 39.5 KB unreferenced screenshot file left in the ADR folder.
   - `web/src/assets/`: An empty directory left from project scaffolding (static assets are properly maintained in `web/public/`).

---

## 2. Files and Directories Changed, Moved, or Removed

| File / Directory | Change | Rationale |
|------------------|--------|-----------|
| `docs/repository-audit.md` | Created | Comprehensive pre-refactoring audit documenting baseline, findings, severity, and plan. |
| `docs/repository-cleanup-report.md` | Created | Final delivery documentation detailing all actions, metrics, and verification. |
| `web/src/lib/supabase/database.types.ts` | Modified | Added strongly typed `classify_and_update_item` definition in `Database['public']['Functions']`. |
| `web/src/lib/items/service.ts` | Modified | Removed `(client as any).rpc` cast; now uses strongly typed `client.rpc`. |
| `web/src/lib/calendar/service.ts` | Modified | Added `CalendarQueryRow` and `ClassifyRpcEventResponse` interfaces; eliminated `(row: any)` and `(supabase as any).rpc` casts. |
| `web/src/components/ui/input.tsx` | Modified | Standardized `cn` import to `@/lib/utils`. |
| `web/src/components/ui/button.tsx` | Modified | Standardized `cn` import to `@/lib/utils`. |
| `web/src/components/ui/date-time-picker.tsx` | Modified | Standardized `cn` import to `@/lib/utils`. |
| `web/src/components/inbox/item-row.tsx` | Modified | Standardized `cn` import to `@/lib/utils`. |
| `web/src/components/inbox/inbox-filters.tsx` | Modified | Standardized `cn` import to `@/lib/utils`. |
| `web/src/App.tsx` | Modified | Implemented route-level code splitting using `React.lazy` and `<Suspense>` for secondary feature pages (`NotesPage`, `CalendarPage`, `ItemDetailPage`, `SettingsPage`) while keeping core critical paths (`AuthPage`, `CapturePage`, `InboxPage`) immediately responsive. |
| `README.md` | Modified | Updated to Praxis branding, correct architecture references, and verified dev/test commands. |
| `api/README.md` | Modified | Documented backend auxiliary service, design principles, prerequisites, and execution commands. |
| `web/README.md` | Modified | Documented frontend tech stack, PWA capabilities, offline-first data flow, and dev commands. |
| `docs/adrs/image.png` | Removed | Stray, unreferenced binary screenshot file. |
| `web/src/assets/` | Removed | Empty scaffolding directory. |

---

## 3. Dependencies Audited

| Dependency | Location | Status | Justification |
|------------|----------|--------|---------------|
| `cn` | `web/package.json` | **Retained** | Official `@shadcn-ui/cn` compiled replacement for `clsx + tailwind-merge`. Canonical export maintained via `@/lib/utils`. |
| `shadcn` | `web/package.json` | **Retained** | Required for `@import "shadcn/tailwind.css"` loaded in `src/index.css`. |
| `radix-ui` | `web/package.json` | **Retained** | Unified Radix UI package used for primitives (e.g. `Slot` in `button.tsx`). |
| `dexie` | `web/package.json` | **Retained** | Core offline-first IndexedDB storage and outbox queue engine. |
| `@supabase/supabase-js` | `web/package.json` | **Retained** | Client authentication, session management, and RLS database interface. |
| `lucide-react` | `web/package.json` | **Retained** | Standardized iconography across all shell navigation, status, and button states. |

*No new dependencies were added.*

---

## 4. Performance Improvements Actually Measured

### Vite Production Bundle Size:
- **Before Optimization (Monolithic):**
  - Single main chunk (`index.js`): **736.56 kB** (gzip: 214.72 kB)
  - Vite warning: `(!) Some chunks are larger than 500 kB after minification.`
- **After Route Code Splitting (`React.lazy` + `Suspense`):**
  - Entry chunk (`index.js`): **305.87 kB** (gzip: 94.46 kB) — **58.5% reduction in initial entry script size**
  - Secondary chunks split on-demand:
    - `calendar-page.js`: 19.78 kB (gzip: 5.80 kB)
    - `settings-page.js`: 16.80 kB (gzip: 5.22 kB)
    - `item-detail-page.js`: 15.89 kB (gzip: 4.52 kB)
    - `notes-page.js`: 13.33 kB (gzip: 4.22 kB)
    - `date-time-picker.js`: 1.58 kB (gzip: 0.69 kB)
  - Vite chunk size warning (> 500 kB): **Completely resolved (0 warnings)**

---

## 5. Security & Data-Integrity Findings

1. **Secrets & Git Exposure:** Checked full git history (`git log --all --full-history`) and tracked file index (`git ls-files`). Verified zero exposed credentials, tokens, or environment files.
2. **Row Level Security (RLS):** All 8 Supabase PostgreSQL tables (`items`, `notes`, `tasks`, `resources`, `calendar_events`, `ideas`, `profiles`, `item_relationships`) enforce RLS policies restricting operations exclusively to `auth.uid() = user_id`.
3. **RPC Boundary Security:** `classify_and_update_item` enforces `security invoker` privileges with explicit guard `if v_user_id is null then raise exception 'Not authenticated'` and cross-tenant guard `if found and v_item.user_id <> v_user_id then raise exception 'Item not found or permission denied'`.
4. **Offline Resilience & Idempotency:** Client-generated UUIDv4 keys remain stable across offline retries, preventing duplicate rows. Deletions utilize soft-deletion tombstones (`deleted_at = now()`) so offline items do not resurface during cloud sync.

---

## 6. Verification and Validation Results

All verification suites were executed against the modified codebase:

| Tool / Check | Workspace | Target | Status | Result Details |
|--------------|-----------|--------|--------|----------------|
| `tsc -b` | `web/` | Type Checking | **PASS** | 0 errors across entire frontend TypeScript project. |
| `oxlint` | `web/` | Linter | **PASS** | 0 errors across 77 files. |
| `vitest run` | `web/` | Unit & Integration Tests | **PASS** | **25 test files passed (100%), 172 tests passed (100%)**. |
| `vite build` | `web/` | Production Bundle | **PASS** | Built in 1.46s with 0 chunk warnings and verified PWA service worker precache. |
| `pytest` | `api/` | Backend & RLS Isolation | **PASS** | **6 passed in 1.00s** (`test_health.py`, `test_rls_isolation.py`). |
| `ruff check .` | `api/` | Backend Lint | **PASS** | 0 lint errors. |
| `ruff format --check .` | `api/` | Code Formatting | **PASS** | 5 files verified formatted. |

---

## 7. Existing Failures and Unresolved Risks

- **Zero Test Failures:** All 178 frontend and backend tests pass.
- **Environment Dependency:** Full end-to-end cloud sync tests against live Supabase require valid test project credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); mocked and RLS isolation tests pass deterministically without cloud connectivity.
- **FastAPI Port Isolation:** The auxiliary API runs on port 8000 while Vite dev runs on port 5173. Cross-origin configuration in `api/src/personal_memory_api/main.py` is configured for local development.

---

## 8. Proposed Changes Deliberately Deferred

1. **State Management Migration:** The current architecture uses React Context (`AuthProvider`, `SyncProvider`, `ThemeProvider`) coupled with Dexie live queries. Replacing this with Zustand or TanStack Query was evaluated but deferred as unnecessary complexity that would risk regression of verified offline capture flows.
2. **Database Migration Squashing:** The 3 Supabase migrations (`20261008000000`, `20261009000000`, `20261010000000`) were preserved intact to maintain historical migration integrity and reproducibility across development environments.
3. **Eager Route Code Splitting on Critical Paths:** We deliberately avoided lazy-loading `/auth`, `/capture`, and `/inbox` to eliminate any chunk fetch delay for the app's primary everyday user loops.

---

## 9. Final Recommendation

**Status: READY FOR NEXT DEPLOYMENT-READINESS STAGE.**

The Praxis repository is clean, type-safe, well-documented, secure, and performant. Monolithic bundle warnings are resolved, database RPC contracts are strongly typed, offline capture invariants are intact, and 100% of the test suite passes.
