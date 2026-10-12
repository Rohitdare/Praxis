# Security Incident & Resolution Report: Cross-Account Data Leakage (SEC-001)

## Executive Summary

| Parameter | Value |
|---|---|
| **Incident ID** | SEC-001 |
| **Severity** | CRITICAL (Privacy / Account Isolation) |
| **Component** | Client Storage (IndexedDB / Dexie), Outbox Sync Engine, Local Caches, Data Fetching Services, Screen Transition State |
| **Status** | **FIX IMPLEMENTED, LIVE VERIFICATION PENDING** |
| **Affected Environments** | Shared Browser Profiles, Multi-Account Workstations |
| **Release Decision** | Code corrected, 100% automated regressions pass; Live two-account browser verification pending |

---

## 1. Incident Overview & Confirmed Root Causes

### Problem Statement
In a shared browser profile (such as local development or multi-user workstations):
1. User A authenticated and created records (notes, captures, tasks, events).
2. User A logged out.
3. User B authenticated on the same machine/browser.
4. User B could view records created by User A on the Capture screen, Inbox, and Calendar, and observed User A's sync status.

### Detailed Root Causes Identified:
1. **Unscoped Dexie Queries**: `getRecentCaptures` previously filtered on `deleted_at === null` without enforcing `user_id`. When `userId` was omitted or undefined during authentication hydration, it returned records without account boundaries or improperly fell back to unauthenticated records.
2. **Missing Outbox Ownership**: The Dexie `outbox` table lacked a top-level `user_id` column and compound indexes, risking cross-account queue contamination.
3. **Mid-Drain Sync Race Conditions**: If an account switch occurred while `drainOutbox` was actively running, mutations could be attempted under the new user's session without re-validating the active Supabase JWT per item.
4. **Global In-Memory & LocalStorage Caching**: Calendar events were stored in `localStorage` under a single global key `pm_cached_calendar_events`. Sync error/timestamp state (`lastSyncedAtCache`, `lastErrorCache`) persisted in module memory across sign-outs.
5. **Component State Hydration & Flashing**: Pages (`CapturePage`, `InboxPage`, `NotesPage`, `PlannerPage`, `CalendarPage`) did not distinguish between an unresolved authentication session (`userId === undefined` during hydration) and an unauthenticated session (`userId === null`), causing brief flashes of stale or anonymous data during auth initialization.

### Data Lifecycle Audit Table

| Area | Implementation Component | Confirmed Vulnerability / Defect | Remediation Implemented |
|---|---|---|---|
| **Local Database (`Dexie`)** | `PersonalMemoryDB` schema v2 (`web/src/lib/db/index.ts`, `schema.ts`) | `local_items` and `outbox` lacked compound ownership indexes; `outbox` lacked top-level `user_id`. | Added schema v2 with compound indexes `[user_id+deleted_at]` and `[user_id+status]`; automated non-destructive migration backfilling `user_id` from payload. |
| **Capture & Recent Captures** | `captureItem` and `getRecentCaptures` (`web/src/lib/db/capture.ts`) | `getRecentCaptures` did not distinguish unresolved session (`undefined`) from confirmed anonymous (`null`), leaking data or flashing during auth loading. | Scoped `captureItem` with `user_id`; updated `getRecentCaptures` to return `[]` immediately if `userId === undefined`, only returning anonymous captures when explicitly `null`. |
| **Inbox Merging** | `fetchInboxItems` (`web/src/lib/inbox/service.ts`) | If `userId` was undefined, defaulted to `null` and leaked anonymous items. Did not defensively check `local.user_id === targetUserId` before merging. | Guarded against unresolved `userId === undefined` (returns `[]`); scoped Dexie queries and only merged local records matching `options.userId`. |
| **Outbox & Sync** | `drainOutbox` (`web/src/lib/sync/engine.ts`) | Lack of per-item session re-verification; conflicting payload vs outbox ownership wasn't quarantined; unauthenticated records could be pushed. | Verified ownership consistency; quarantined mismatched records; re-verifies active session before each mutation; immediate abort on mid-drain account switch. |
| **Auth Transitions** | `AuthProvider` (`web/src/lib/auth/auth-context.tsx`) | Module memory caches and calendar cache were not invalidated across user changes or sign-out. | Added `clearSyncMemoryCache()` and `clearCalendarCache(user.id)` on `signOut` and user transitions. |
| **Cache & Screen State** | `calendar/service.ts` & Page components | Calendar used global `localStorage` key; pages rendered before session resolved without resetting state on account switch. | Partitioned cache to `pm_cached_calendar_events_${userId}`; added `prevUserIdRef` transition guards and `isAuthLoading` checks across all 5 pages. |
| **Supabase / RLS** | PostgreSQL tables & RPCs | Frontend could attempt unauthorized calls if client bypassed checks. | Verified RLS policies across all tables (`USING user_id = auth.uid()`); RPC `classify_and_update_item` verified caller ownership under `SECURITY INVOKER`. |

---

## 2. Exact Files and Functions Modified

1. **`web/src/lib/db/schema.ts`**:
   - Added `user_id?: string | null` to `OutboxRecord`.
2. **`web/src/lib/db/index.ts`**:
   - Added Dexie schema version 2 with compound indexes `[user_id+deleted_at]` on `local_items` and `[user_id+status]` on `outbox`.
   - Added non-destructive version 2 migration backfilling `user_id` on existing outbox records.
3. **`web/src/lib/db/capture.ts`**:
   - `captureItem`: sets `user_id` on both `local_items` and `outbox`.
   - `getRecentCaptures`: distinguishes unresolved session (`userId === undefined` -> returns `[]`) from confirmed anonymous (`userId === null` -> returns anonymous items) and authenticated (`userId === string` -> returns matching items).
4. **`web/src/lib/inbox/service.ts`**:
   - `fetchInboxItems`: immediately returns empty items if `userId === undefined`; scopes Dexie queries by `targetUserId`; filters merged local records strictly to `targetUserId`.
   - `softDeleteItem`: propagates `user_id` to outbox delete tombstones.
5. **`web/src/lib/notes/service.ts`**:
   - `fetchNotes`: strictly scopes local Dexie fallback to `item.user_id === userId`; protects Dexie cache update from overwriting items owned by another user.
   - `deleteNote`: passes `userId` to `softDeleteItem`.
6. **`web/src/lib/planner/service.ts`**:
   - `fetchDailyPlannerDataOffline`: strictly queries `database.local_items.where("user_id").equals(userId)`.
   - `fetchWeeklyProductivityStats`: strictly scopes queries to `userId`.
   - `deletePlannerTask`: passes `userId` to `softDeleteItem`.
7. **`web/src/lib/calendar/service.ts`**:
   - `getCachedEvents` & `setCachedEvents`: partitioned keys to `pm_cached_calendar_events_${userId}`.
   - Removed unpartitioned legacy fallback.
   - Added `clearCalendarCache(userId)`.
8. **`web/src/lib/items/service.ts`**:
   - `fetchItemDetail`: throws error if local record does not match `userId`.
   - `updateItemClassification`: requires `existingLocal.user_id === userId` before updating local cache.
9. **`web/src/lib/export/service.ts`**:
   - `gatherExportData`: requires `userId` and filters local items and outbox queries strictly by `userId`.
10. **`web/src/lib/sync/engine.ts`**:
    - `drainOutbox`: verifies `recordOwner === authenticatedUserId`; quarantines records with conflicting metadata; re-verifies session before each mutation and aborts if session changed mid-drain.
    - `resetFailedOutboxRecords`: scoped to `authenticatedUserId`.
    - `getSyncEngineState`: scoped to `authenticatedUserId`.
    - Added `clearSyncMemoryCache()`.
11. **`web/src/lib/sync/sync-context.tsx`**:
    - Scopes `getSyncEngineState` and `subscribeToSyncState` to active `user?.id`.
12. **`web/src/lib/auth/auth-context.tsx`**:
    - Invalidate calendar and sync memory caches on `signOut` and when user ID changes.
13. **Page Components (`capture-page.tsx`, `inbox-page.tsx`, `notes-page.tsx`, `planner-page.tsx`, `calendar-page.tsx`)**:
    - Integrated `isAuthLoading` guard to prevent querying during auth hydration.
    - Added `prevUserIdRef` transition guards that immediately clear data when active user changes.
14. **`web/src/test/cross-account-isolation.test.tsx`**:
    - Comprehensive regression suite covering 13 isolation scenarios.

---

## 3. Data Migration and Legacy Record Handling

- **Non-Destructive Guarantee**: IndexedDB is never wiped, purged, or reset during logout or account transitions.
- **Idempotent Dexie Schema v2**:
  ```typescript
  db.version(2)
    .stores({
      local_items: "id, user_id, type, status, synced, captured_at, updated_at, deleted_at, [user_id+deleted_at]",
      outbox: "++id, item_id, user_id, status, operation, created_at, updated_at, [user_id+status]",
    })
    .upgrade(async (tx) => {
      await tx.table("outbox").toCollection().modify((record) => {
        if (!record.user_id && record.payload && record.payload.user_id) {
          record.user_id = record.payload.user_id
        }
      })
    })
  ```
- **Unauthenticated / Anonymous Captures**: Remain assigned to `user_id = null`. They are never automatically reassigned to an authenticated user upon sign-in.
- **Conflicting Metadata**: Outbox records where `record.user_id !== payload.user_id` are safely quarantined without synchronizing to prevent cross-account corruptions.

---

## 4. Test Execution & Environment Breakdown

### Automated Suite Results

1. **Isolation Regression Suite (`npx vitest run src/test/cross-account-isolation.test.tsx`)**:
   - **Environment**: Node.js / `jsdom` with `fake-indexeddb` and mocked Supabase authentication transitions.
   - **Result**: 13 passed / 13 total.
   - **Scenarios Verified**:
     - Basic isolation (User A captures vs User B query).
     - Account switching without storage wipes.
     - Conflicting outbox metadata quarantine.
     - Mid-sync account switch loop abortion.
     - Offline notes and planner task isolation.
     - Direct item detail authorization.
     - JSON export isolation.
     - Partitioned calendar cache isolation.
     - Unauthenticated capture isolation and unresolved session guard.
     - Sync engine state and retry count isolation.

2. **Full Frontend Test Suite (`npm test`)**:
   - **Environment**: `vitest` / `jsdom` across 30 test files.
   - **Result**: 30 passed / 30 files, 210 passed / 210 tests.

3. **Backend Test Suite (`pytest api/tests`)**:
   - **Environment**: Python 3.14 virtual environment with async pytest.
   - **Result**: 8 passed / 8 tests (including 5 Supabase RLS isolation tests in `test_rls_isolation.py`).

4. **TypeScript Typecheck (`npm run typecheck`)**:
   - **Result**: 0 errors (`tsc -b`).

5. **Linter (`npm run lint`)**:
   - **Result**: 0 errors (`oxlint`).

6. **Production Build (`npm run build`)**:
   - **Result**: Succeeded in 1.09s (`vite build` + workbox PWA service worker precache).

---

## 5. Live Supabase & Browser Verification Status

- **Automated Tests**: Utilized `fake-indexeddb` and `jsdom`. As required by SEC-001 audit guidelines, `jsdom` is explicitly NOT classified as real browser testing.
- **Live Supabase Environment**: The repository's `.env` specifies a live Supabase project URL and anon publishable key, but no secondary dedicated test user credentials (`email`/`password`) or service role key are present in the local environment.
- **Status Determination**: In accordance with the execution protocol, live browser testing is not fabricated. Because code changes and local automated integration tests are completely passing, the project is marked **FIX IMPLEMENTED, LIVE VERIFICATION PENDING**.

---

## 6. Remaining Risks & Required Manual Checks

### Manual Verification Checklist (Recommended before production deployment):
1. **Physical Browser Two-Account Walkthrough**:
   - Launch application with `npm run dev`.
   - Open browser, navigate to `/auth`, log in as `account-a@example.com`.
   - Create 1 item in Capture, 1 Note, 1 Task in Planner, 1 Event in Calendar.
   - Disconnect network (DevTools offline mode) and capture 1 offline item.
   - Log out without clearing browser cookies/storage.
   - Log in as `account-b@example.com`.
   - Verify all screens (Capture, Inbox, Notes, Planner, Calendar) show 0 records belonging to Account A.
   - Verify Sync Indicator does not display Account A's pending outbox count.
   - Re-enable network; log out as Account B; log in as Account A.
   - Confirm Account A's offline records remain intact and synchronize successfully.
2. **Database Verification**:
   - Inspect Supabase Table Editor to verify records in `items` table retain correct `user_id` matching auth IDs.

---

## 7. Final Verdict

### **FIX IMPLEMENTED, LIVE VERIFICATION PENDING**

All code defects across IndexedDB schema migrations, query scoping, cache partitioning, outbox processing, account transition guards, and RLS alignments have been corrected and validated with 210 frontend tests and 8 backend tests passing. Live two-account verification on a production Supabase instance remains pending.
