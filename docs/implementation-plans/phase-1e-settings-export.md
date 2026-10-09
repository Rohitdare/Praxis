# Phase 1E Implementation Plan: Settings Skeleton + JSON Export

> **Document Path:** `docs/implementation-plans/phase-1e-settings-export.md`  
> **Status:** Draft / Pending Approval  
> **Scope:** Phase 1E (Settings screen, Sync diagnostics & manual retry, Client-side JSON export)  
> **Target Date:** 2026-10-10  

---

## 1. Current Implementation Findings

### 1.1 Architecture & Tech Stack Baseline
- **Frontend SPA**: React 19 + TypeScript + Vite 8 in `web/`, styled with Tailwind CSS v4 and shadcn/ui components.
- **Local Persistence**: Dexie.js (IndexedDB) with schema `local_items`, `outbox`, and `sync_meta`.
- **Cloud Backend**: Supabase PostgreSQL + Auth (Email/Password + Google OAuth) with full Row Level Security (RLS) on all 8 tables.
- **Auxiliary Backend**: FastAPI service in `api/` (`GET /health` with Pydantic validation and CORS configuration).

### 1.2 Routing & Navigation
- The routing tree in [`web/src/App.tsx`](file:///d:/sample-projects/bruno/web/src/App.tsx) currently exposes `/auth`, `/capture`, and `/inbox` inside [`ProtectedRoute`](file:///d:/sample-projects/bruno/web/src/components/auth/protected-route.tsx) and [`AppShell`](file:///d:/sample-projects/bruno/web/src/components/layout/app-shell.tsx).
- In [`web/src/components/layout/app-shell.tsx`](file:///d:/sample-projects/bruno/web/src/components/layout/app-shell.tsx), the Settings buttons (in both the desktop header and mobile bottom navigation) trigger a transient notification banner stating *"Settings will be configurable in a later phase."*
- There is no `/settings` route currently defined in `AppRoutes`.

### 1.3 State of Synchronization & Storage
- `captureItem()` in [`web/src/lib/db/capture.ts`](file:///d:/sample-projects/bruno/web/src/lib/db/capture.ts) generates client-side UUIDv4 identifiers and writes atomically to `local_items` and `outbox`.
- `drainOutbox()` in [`web/src/lib/sync/engine.ts`](file:///d:/sample-projects/bruno/web/src/lib/sync/engine.ts) checks for authenticated session, enforces user ID isolation (`user_id = null` items remain offline; `user_id !== authenticatedUserId` items are strictly skipped), and pushes pending records via `supabase.from("items").upsert()`.
- `softDeleteItem()` in [`web/src/lib/inbox/service.ts`](file:///d:/sample-projects/bruno/web/src/lib/inbox/service.ts) marks `deleted_at` locally and creates an outbox tombstone record for cloud synchronization.

---

## 2. Sync Issue Diagnosis & Proposed Resolution

### 2.1 Trace from UI to Database
1. **UI Presentation**:
   - [`web/src/components/sync/sync-indicator.tsx`](file:///d:/sample-projects/bruno/web/src/components/sync/sync-indicator.tsx) renders a `Sync issue` badge when `syncState.status === "error"`:
     ```tsx
     case "error":
       return (
         <div
           aria-label="Sync encounter an issue, will retry"
           title={syncState.lastError || "Sync error"}
           className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium px-2 py-1 rounded transition-colors"
         >
           <AlertCircle className="size-3 shrink-0" />
           <span>Sync issue</span>
         </div>
       )
     ```
2. **State Calculation**:
   - `useSync()` consumes `syncState` from `SyncProvider` in [`web/src/lib/sync/sync-context.tsx`](file:///d:/sample-projects/bruno/web/src/lib/sync/sync-context.tsx).
   - In [`web/src/lib/sync/engine.ts`](file:///d:/sample-projects/bruno/web/src/lib/sync/engine.ts) lines 89–103, `getSyncEngineState()` queries:
     ```ts
     const failedCount = await database.outbox.where("status").equals("failed").count()
     const status = determineSyncStatus({
       isOffline,
       isSyncing: isDraining,
       pendingCount,
       hasError: failedCount > 0 || !!lastErrorCache,
     })
     ```
   - When `hasError` is true, `determineSyncStatus()` unconditionally returns `"error"`.

### 2.2 Is the Indicator an Actual Error or an Expected State?
- The indicator represents an **ACTUAL ERROR** encountered during an execution of `drainOutbox()`.
- When an authenticated user submits a capture on `/capture`, `triggerBackgroundSync()` calls `drainOutbox()`.
- If `client.from("items").upsert(...)` throws or rejects with an error:
  - `lastErrorCache` is populated with the error message.
  - If the error code corresponds to a 4xx client failure (e.g., 404 table missing, 400 bad payload), or if retries exceed `MAX_RETRY_ATTEMPTS (5)`, the outbox record status is updated to `"failed"`.
  - Once any record is `"failed"`, `failedCount > 0` persists in IndexedDB, latching the UI in the `"error"` state across reloads.

### 2.3 Root Cause Analysis & Verification

| Potential Cause | Mechanism | Likelihood in Current Environment | Verification & Remediation |
| :--- | :--- | :--- | :--- |
| **Missing Cloud Database Schema** | Migration `supabase/migrations/20261008000000_initial_schema.sql` was not run on the remote Supabase project. PostgREST returns HTTP 404 (`PGRST205` / `42P01: relation "public.items" does not exist`). | **HIGH (Most Likely)** | Verify table existence in Supabase dashboard. Remediate by applying the SQL migration in the Supabase SQL Editor. |
| **RLS Policy Violation** | `auth.uid()` does not match `serverPayload.user_id` or the user profile trigger failed. PostgREST returns HTTP 42501 (`new row violates row-level security policy`). | **MEDIUM** | Check user ID in active session vs outbox payload. Ensure migration RLS policy `own_items` is active. |
| **Stale PostgREST Schema Cache** | Migration was executed, but PostgREST has not refreshed its internal schema cache. | **LOW** | Trigger schema cache reload in Supabase SQL Editor (`NOTIFY pgrst, 'reload config'`). |
| **Network or CORS Error** | `VITE_SUPABASE_URL` is blocked, misspelled, or experiencing client-side network interruptions (`Failed to fetch`). | **MEDIUM** | Inspect browser DevTools Network tab for failed HTTP requests. |
| **Stuck "Failed" Outbox Records** | Once an item enters status `"failed"`, there is no UI action to reset or retry it, permanently locking the indicator. | **CONFIRMED ARCHITECTURAL GAP** | Provide an explicit "Retry Sync" action in Settings that can reset failed records and trigger `drainOutbox({ force: true })`. |

### 2.4 Remediation Plan for Phase 1E
1. **User Action**: Execute `supabase/migrations/20261008000000_initial_schema.sql` in the Supabase project dashboard if not yet applied.
2. **UI Diagnostics**: Expose the exact `lastError` string and failed record count in the new Settings page so the user has immediate diagnostic clarity without inspecting HTML attributes or browser console logs.
3. **Manual Retry Action**: Add a "Retry Sync" button on `/settings` that resets failed records to `"pending"` and executes `drainOutbox({ force: true })`.
4. **Resilient Status Reset**: In `engine.ts`, when `drainOutbox()` completes a cycle with 0 pending and 0 failed records, clear `lastErrorCache` and update `hasError` to false.

---

## 3. Scope and Explicit Non-Goals

### 3.1 In-Scope for Phase 1E
1. **Settings Route (`/settings`)**:
   - Add `/settings` to `AppRoutes` wrapped in `ProtectedRoute` and `AppShell`.
   - Update navigation in `AppShell` (desktop header link & mobile bottom nav) to route to `/settings`.
2. **Account Information Section**:
   - Display active user email, user UUID, and session provider (Email vs Google OAuth).
   - "Sign out" button utilizing `useAuth().signOut()`.
3. **Sync Diagnostics & Controls Section**:
   - Real-time sync badge (Synced, Syncing, Pending, Offline, Error).
   - Metrics: Pending records count, failed records count, and last synced timestamp.
   - Exact diagnostic error message if an issue exists.
   - "Retry Sync Now" button with loading spinner and disabled state while running.
4. **Client-Side JSON Export (FR-31)**:
   - Dedicated "Export All Data" card.
   - Comprehensive extraction of user records:
     - Cloud records fetched from Supabase (`items`, `resources`, `tasks`, `calendar_events`, `tags`, `item_tags`, `item_relationships`).
     - Local unsynced captures from Dexie `local_items`.
   - Deduplication: Merge cloud and local copies by ID; local unsynced edits/tombstones take precedence.
   - Preservation of soft-deleted records (`deleted_at !== null`) with explicit metadata so future imports do not resurrect deleted notes.
   - Generation and download of a versioned `.json` file (`schema_version: "1.0.0"`).
   - Purely client-side execution via `Blob` and Object URL; zero external API requests.
   - Robust error handling, loading state, and honest representation of offline/partial export states.
5. **Storage & Security Advisory**:
   - Plain-language advisory note about unencrypted browser IndexedDB storage and recommendation to sign out on shared devices.

### 3.2 Explicit Non-Goals (Deferred to Later Phases)
- **JSON Import / Data Restore**: Non-goal for Phase 1E. Import semantics and conflict resolution will be defined in a dedicated phase.
- **AI / Privacy Toggles**: Deferred to Phase 5 when AI classification is implemented.
- **Cloud Backup Automation / Encryption (FR-32)**: Deferred to Phase 3+.
- **Account Deletion / Profile Edits**: Outside MVP scope.
- **Third-Party Integrations**: No external cloud drives or syncing services.

---

## 4. Proposed File-by-File Changes

```text
web/
├── src/
│   ├── App.tsx                               # Add /settings route
│   ├── components/
│   │   └── layout/
│   │       └── app-shell.tsx                 # Convert Settings buttons to NavLinks
│   ├── lib/
│   │   ├── export/
│   │   │   ├── types.ts                      # Export schema TypeScript interfaces
│   │   │   └── service.ts                    # Core export gathering & JSON generation service
│   │   └── sync/
│   │       ├── engine.ts                     # Add resetFailedRecords() & improve error clearing
│   │       └── sync-context.tsx              # Expose retrySync() in SyncContextValue
│   ├── pages/
│   │   └── settings-page.tsx                 # Settings screen (Account, Sync, Export, Privacy notice)
│   └── test/
│       ├── settings-page.test.tsx            # Unit & integration tests for Settings screen
│       └── export-service.test.ts            # Unit tests for JSON export logic, merge, and schema
```

### 4.1 `web/src/lib/export/types.ts`
Defines the versioned contract for exported personal memory data:
```ts
import type { Database, ItemStatus, ItemType, ResourceStatus, TaskPriority } from "@/lib/supabase/database.types"

export interface ExportMetadata {
  schema_version: "1.0.0"
  app_version: string
  exported_at: string
  user_id: string
  is_offline: boolean
  sync_status: string
  counts: {
    items_total: number
    items_active: number
    items_soft_deleted: number
    resources: number
    tasks: number
    calendar_events: number
    tags: number
    item_tags: number
    item_relationships: number
    unsynced_local_items: number
  }
}

export interface ExportItem {
  id: string
  user_id: string
  raw_input: string
  title: string | null
  content: string | null
  type: ItemType
  status: ItemStatus
  captured_at: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced: boolean
  ai_type?: string | null
  ai_tags?: string[] | null
  ai_confidence?: number | null
  ai_model?: string | null
}

export interface ExportDataPayload {
  metadata: ExportMetadata
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null
  items: ExportItem[]
  resources: Database["public"]["Tables"]["resources"]["Row"][]
  tasks: Database["public"]["Tables"]["tasks"]["Row"][]
  calendar_events: Database["public"]["Tables"]["calendar_events"]["Row"][]
  tags: Database["public"]["Tables"]["tags"]["Row"][]
  item_tags: Database["public"]["Tables"]["item_tags"]["Row"][]
  item_relationships: Database["public"]["Tables"]["item_relationships"]["Row"][]
}
```

### 4.2 `web/src/lib/export/service.ts`
Orchestrates data gathering, deduplication, JSON serialization, and browser download trigger:
- **`gatherExportData(userId: string, options?: { supabaseClient?: SupabaseClient; database?: PersonalMemoryDB }): Promise<ExportDataPayload>`**
  1. Reads all records from `local_items` in Dexie belonging to `userId` (or unsynced items).
  2. If online and Supabase is configured:
     - Queries `profiles`, `items`, `resources`, `tasks`, `calendar_events`, `tags`, `item_tags`, and `item_relationships` with `.eq('user_id', userId)`.
     - Merges `items`: If an item ID exists in both cloud and local, the local version is selected if it has pending changes (`synced === false` or newer `updated_at`).
  3. If offline or if Supabase queries encounter network failure:
     - Falls back cleanly to local-only records.
     - Sets `is_offline = true` in metadata and logs an informative note in `counts`.
  4. Formats data according to `ExportDataPayload`.
- **`triggerJsonDownload(data: ExportDataPayload, filename?: string): void`**
  - Generates filename: `personal-memory-export-YYYY-MM-DD-HHmmss.json`.
  - Serializes to formatted JSON (`JSON.stringify(data, null, 2)`).
  - Uses `Blob` + `URL.createObjectURL` + anchor click + `URL.revokeObjectURL`.

### 4.3 `web/src/lib/sync/engine.ts`
Enhancements:
- Add `resetFailedOutboxRecords(database: PersonalMemoryDB = db): Promise<number>` to allow recovering records that entered `"failed"` state due to transient server issues or fixed database migrations.
- In `drainOutbox()`, when all records are drained successfully (`failureCount === 0` and `pendingCount === 0`), reset `lastErrorCache = null`.

### 4.4 `web/src/lib/sync/sync-context.tsx`
- Add `retrySync: (force?: boolean) => Promise<SyncResult>` to `SyncContextValue`.
- Implement `retrySync` to call `resetFailedOutboxRecords()` followed by `drainOutbox({ force: true })`.

### 4.5 `web/src/pages/settings-page.tsx`
Minimal, calm, utilitarian-editorial screen:
- **Header**: "Settings" with concise description.
- **Account Section**:
  - Email address badge.
  - User UUID (monospace snippet).
  - Auth provider badge (Email / Google).
  - "Sign out" button.
- **Sync Diagnostics Section**:
  - Live status indicator (synced, syncing, pending, offline, error).
  - Metrics grid: Pending records, Failed records, Last sync timestamp.
  - Error banner (renders `lastError` with troubleshooting advice if status is error).
  - "Retry Sync Now" button.
- **Data Export Section (FR-31)**:
  - "Export all data" description.
  - "Download JSON Export" button with active loading state and completion confirmation.
  - Export metrics summary upon completion (e.g., "Exported 42 items, 5 tasks, 0 resources").
- **Security & Privacy Note**:
  - Explains local IndexedDB persistence, RLS cloud isolation, and advice for shared devices.

### 4.6 Navigation & Routes
- Update [`web/src/App.tsx`](file:///d:/sample-projects/bruno/web/src/App.tsx): Add `<Route path="/settings" element={<SettingsPage />} />`.
- Update [`web/src/components/layout/app-shell.tsx`](file:///d:/sample-projects/bruno/web/src/components/layout/app-shell.tsx): Replace temporary `setShowSettingsNotice` button with `<NavLink to="/settings">`.

---

## 5. Export Schema Example

```json
{
  "metadata": {
    "schema_version": "1.0.0",
    "app_version": "0.1.0",
    "exported_at": "2026-10-09T16:15:30.123Z",
    "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "is_offline": false,
    "sync_status": "synced",
    "counts": {
      "items_total": 3,
      "items_active": 2,
      "items_soft_deleted": 1,
      "resources": 1,
      "tasks": 1,
      "calendar_events": 0,
      "tags": 2,
      "item_tags": 2,
      "item_relationships": 0,
      "unsynced_local_items": 0
    }
  },
  "profile": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "timezone": "UTC",
    "ai_enabled": false,
    "ai_public_resources": true,
    "ai_personal_types": false,
    "created_at": "2026-10-08T10:00:00.000Z",
    "updated_at": "2026-10-08T10:00:00.000Z"
  },
  "items": [
    {
      "id": "11111111-2222-3333-4444-555555555555",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "raw_input": "https://react.dev/ - Read React 19 documentation",
      "title": "React 19 Documentation",
      "content": "Official documentation for React 19 features.",
      "type": "resource",
      "status": "inbox",
      "captured_at": "2026-10-09T14:20:00.000Z",
      "created_at": "2026-10-09T14:20:00.000Z",
      "updated_at": "2026-10-09T14:20:00.000Z",
      "deleted_at": null,
      "synced": true,
      "ai_type": null,
      "ai_tags": null,
      "ai_confidence": null,
      "ai_model": null
    },
    {
      "id": "22222222-3333-4444-5555-666666666666",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "raw_input": "Review security audit by Friday",
      "title": "Security Audit",
      "content": null,
      "type": "task",
      "status": "active",
      "captured_at": "2026-10-09T15:00:00.000Z",
      "created_at": "2026-10-09T15:00:00.000Z",
      "updated_at": "2026-10-09T15:00:00.000Z",
      "deleted_at": null,
      "synced": true,
      "ai_type": null,
      "ai_tags": null,
      "ai_confidence": null,
      "ai_model": null
    },
    {
      "id": "33333333-4444-5555-6666-777777777777",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "raw_input": "Temporary scratch idea that was deleted",
      "title": null,
      "content": null,
      "type": "idea",
      "status": "inbox",
      "captured_at": "2026-10-09T15:10:00.000Z",
      "created_at": "2026-10-09T15:10:00.000Z",
      "updated_at": "2026-10-09T15:15:00.000Z",
      "deleted_at": "2026-10-09T15:15:00.000Z",
      "synced": true,
      "ai_type": null,
      "ai_tags": null,
      "ai_confidence": null,
      "ai_model": null
    }
  ],
  "resources": [
    {
      "item_id": "11111111-2222-3333-4444-555555555555",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "url": "https://react.dev/",
      "domain": "react.dev",
      "fetched_title": "React Reference",
      "description": "The library for web and native user interfaces",
      "image_url": null,
      "resource_status": "unread",
      "created_at": "2026-10-09T14:20:00.000Z",
      "updated_at": "2026-10-09T14:20:00.000Z"
    }
  ],
  "tasks": [
    {
      "item_id": "22222222-3333-4444-5555-666666666666",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "due_at": "2026-10-16T17:00:00.000Z",
      "priority": "normal",
      "completed_at": null,
      "created_at": "2026-10-09T15:00:00.000Z",
      "updated_at": "2026-10-09T15:00:00.000Z"
    }
  ],
  "calendar_events": [],
  "tags": [
    { "id": "t1", "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "name": "work" },
    { "id": "t2", "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "name": "reading" }
  ],
  "item_tags": [
    { "item_id": "11111111-2222-3333-4444-555555555555", "tag_id": "t2", "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
    { "item_id": "22222222-3333-4444-5555-666666666666", "tag_id": "t1", "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }
  ],
  "item_relationships": []
}
```

---

## 6. Security and Data Integrity Considerations

1. **Active Account Ownership Enforcement**:
   - The export service accepts the authenticated user's ID (`user.id` from `useAuth()`).
   - All cloud queries explicitly specify `.eq("user_id", userId)` in addition to database-level PostgreSQL Row Level Security.
   - Local Dexie queries filter strictly by `item.user_id === userId || (!item.user_id && item.synced === false)`.
   - Records belonging to other users that may exist in local storage are never included in the export.
2. **PostgreSQL RLS Invariance**:
   - Cloud data retrieval runs through the Supabase client with the active user's JWT bearer token, guaranteeing that Postgres RLS policies (`auth.uid() = user_id`) validate every row read.
3. **Soft-Delete / Tombstone Integrity**:
   - Soft-deleted items must be preserved in the export alongside active items, with their original `deleted_at` timestamp.
   - This prevents data loss and ensures that future import mechanisms can recognize tombstones rather than treating deleted items as active notes.
4. **Offline and Unsynchronized Data Safety**:
   - The export process is read-only. It performs zero mutations on `local_items` or `outbox`.
   - Unsynced local records (`synced: false`) are included with `synced: false` flag, ensuring the export represents the complete local-first truth without altering outbox states or premature tombstone purging.
5. **Zero External Data Leakage**:
   - The JSON export is assembled in browser memory and passed directly to `URL.createObjectURL(new Blob(...))`.
   - No data payload is transmitted to FastAPI, external AI endpoints, or third-party servers.
6. **Credential & Secret Sanitation**:
   - Supabase tokens, session refresh tokens, passwords, and environment keys are strictly excluded from the export JSON.
7. **Storage Privacy Advisory**:
   - The Settings page will include a prominent note that Dexie IndexedDB stores unencrypted local data on the device, advising users to sign out and clear browsing data when operating on shared computers.

---

## 7. Testing and Acceptance Criteria

### 7.1 Test Suites to Create
1. **`web/src/test/export-service.test.ts`**:
   - **Schema & Versioning**: Verifies `schema_version === "1.0.0"`, `app_version`, ISO timestamps, and summary counts.
   - **Cloud + Local Merge**: Tests deduplication of items present in both cloud and Dexie, verifying local pending edits win over stale cloud records.
   - **Offline Export**: Verifies that when network is disconnected or Supabase is unavailable, export succeeds cleanly with local-only data and sets `is_offline: true`.
   - **Tombstones & Soft Deletes**: Verifies items with `deleted_at !== null` are exported with timestamps preserved.
   - **Cross-Account Isolation**: Verifies User B running export never receives User A's local or cloud records.
   - **Filename Generation**: Verifies generated filename matches `personal-memory-export-YYYY-MM-DD-HHmmss.json`.
   - **Empty State**: Verifies valid JSON payload is produced for a brand-new user with zero items.
2. **`web/src/test/settings-page.test.tsx`**:
   - **Rendering**: Renders user email, user UUID, sync status, and export buttons.
   - **Sign Out**: Clicking "Sign out" calls `signOut()` from auth context and redirects to `/auth`.
   - **Export Action**: Clicking "Download JSON Export" triggers export, displays loading state, and shows success confirmation.
   - **Sync Issue Display**: Displays clear error banner when sync state has an error, showing the exact error message.
   - **Retry Sync Button**: Clicking "Retry Sync Now" invokes `retrySync()` and updates the UI.
3. **Regression Testing**:
   - Ensure existing tests (`auth-routing.test.tsx`, `capture-flow.test.tsx`, `sync-engine.test.ts`, `inbox-page.test.tsx`, `inbox-service.test.ts`) continue passing without regressions.

---

## 8. Risks, Assumptions, and Dependencies

### 8.1 Risks
1. **Large Export Payload Memory Usage**:
   - *Risk*: Users with thousands of items could consume browser memory when creating a large string.
   - *Mitigation*: For Phase 1E (MVP personal memory app), text notes and URLs are small (typically < a few megabytes). Blob creation easily handles up to 50MB in browser memory.
2. **Stuck Outbox Status in Test/Dev**:
   - *Risk*: A developer with a missing database table has failed outbox records in Dexie that persist indefinitely.
   - *Mitigation*: The `resetFailedOutboxRecords()` utility in `engine.ts` and the Settings "Retry Sync" button safely reset failed records once the schema is applied.

### 8.2 Assumptions
- **IMPL-1E-01**: The user will apply the database migration `supabase/migrations/20261008000000_initial_schema.sql` to their Supabase project to resolve table absence.
- **IMPL-1E-02**: Import functionality is strictly excluded from Phase 1E.
- **IMPL-1E-03**: No new external dependencies (e.g. file-saver) are needed; standard browser `Blob` and anchor download APIs are used.

---

## 9. Implementation Sequence with Checkpoints

### Checkpoint 1: Database Verification & Sync Remediation
- Verify Supabase schema migration status.
- Add `resetFailedOutboxRecords()` and error clearing in `engine.ts`.
- Expose `retrySync()` in `sync-context.tsx`.
- Run `npm test` to verify sync engine tests pass.

### Checkpoint 2: Export Domain Service (TDD)
- Create `web/src/lib/export/types.ts`.
- Write failing unit tests in `web/src/test/export-service.test.ts`.
- Implement `gatherExportData()` and `triggerJsonDownload()` in `web/src/lib/export/service.ts`.
- Run `web/src/test/export-service.test.ts` to verify 100% pass.

### Checkpoint 3: Settings Page & UI Integration
- Create `web/src/pages/settings-page.tsx` with Account, Sync Diagnostics, JSON Export, and Storage Notice.
- Update `web/src/App.tsx` route tree to include `/settings`.
- Update `web/src/components/layout/app-shell.tsx` navigation links.
- Write tests in `web/src/test/settings-page.test.tsx`.
- Verify full test suite, typecheck, and linter.

### Checkpoint 4: Verification & Build
- Run full test suite: `npm test` (web) + `py -m pytest` (api).
- Run typecheck: `npm run typecheck`.
- Run linter: `npm run lint` + `py -m ruff check .`.
- Run production build: `npm run build`.

---

## 10. Definition of Done

- [ ] `docs/implementation-plans/phase-1e-settings-export.md` reviewed and approved.
- [ ] `/settings` route accessible to authenticated users with responsive layout (desktop header & mobile bottom nav).
- [ ] Sync issue diagnosis documented with step-by-step resolution for Supabase SQL migration.
- [ ] "Retry Sync Now" button allows resetting failed outbox records and triggering immediate sync.
- [ ] JSON export generates valid, versioned JSON (`schema_version: "1.0.0"`) containing user profile, cloud items, related records, and unsynced local records.
- [ ] Soft-deleted records are preserved with `deleted_at` timestamps.
- [ ] Cross-account isolation verified in unit tests.
- [ ] All frontend tests pass (`npm test`), TypeScript typecheck passes (`npm run typecheck`), and production build succeeds (`npm run build`).
- [ ] All backend tests pass (`py -m pytest`) and linter checks pass (`ruff`).
