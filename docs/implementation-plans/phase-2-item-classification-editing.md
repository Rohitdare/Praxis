# Implementation Plan: Phase 2 — Item Classification & Editing

**Document:** `docs/implementation-plans/phase-2-item-classification-editing.md`  
**Status:** Completed and Verified  
**Date:** 2026-10-09  
**Phase Gate:** Phase 2 fully implemented and automated tests verified. Zero regressions.

---

## 1. Executive Summary & Objective

The objective of Phase 2 is to transform captured raw items in the **Inbox (SCR-03)** into organized, classified personal memories via a dedicated **Item Detail / Edit Screen (SCR-04)**:

1. **Explicit User Classification**: Allow the user to classify an `unclassified` capture into `resource`, `note` (or `idea`), `task`, or `event`.
2. **Editable Structured Fields**: Provide clean inline editing for `title` and `content` (Markdown-ready).
3. **Strict Invariant — Immutable `raw_input`**: Guarantee that `raw_input` is preserved verbatim as captured (ADR-06), displayed read-only for provenance and future AI processing.
4. **Extension Table Synchronization (ADR-09)**: Persist type-specific metadata into extension tables (`resources`, `tasks`, `calendar_events`) transactionally or via coordinated RLS upserts alongside the common `items` record.
5. **Frozen Offline Scope Adherence (ADR-02)**: In accordance with ADR-02 (*"Capture-only offline scope: Organization, triage, tagging, and editing are online-only to avoid complex multi-device edit conflicts"*), editing and classification require an active connection. If offline, the edit UI clearly indicates read-only mode and disables modification actions with helpful guidance.
6. **Zero Redundant Migrations**: The existing database schema ([`supabase/migrations/20261008000000_initial_schema.sql`](../../supabase/migrations/20261008000000_initial_schema.sql)) already provides full tables, constraints, triggers, and RLS policies for `items`, `resources`, `tasks`, and `calendar_events`. Zero schema changes are required.

---

## 2. Frozen Architecture & Invariants

| Principle / Invariant | Enforcement Mechanism in Phase 2 |
| :--- | :--- |
| **Immutable `raw_input` (ADR-06)** | Displayed in a read-only "Original Capture" accordion/section. The update payload never mutates `raw_input`. |
| **Capture-Only Offline (ADR-02)** | Item detail is readable from local Dexie / TanStack cache, but classification & updates require an active online connection with clear UI notification if offline. |
| **Row Level Security (ADR-01)** | All mutations to `items`, `tasks`, `resources`, and `calendar_events` pass through Supabase client with PostgreSQL RLS `auth.uid() = user_id`. |
| **Extension Tables (ADR-09)** | Type-specific attributes reside in `tasks` (`due_at`, `priority`), `resources` (`url`, `resource_status`), and `calendar_events` (`start_at`, `end_at`, `all_day`). |
| **Soft Deletes (ADR-05)** | Updating an item preserves `deleted_at`. Deleted items in detail view display tombstone status with permanent recovery or archival actions deferred to later phases. |
| **Design Language (DP-01..04)** | Minimal typography-led design (Inter font, subtle borders, no flashy gradients, responsive single-column mobile & centered desktop). |

---

## 3. Scope & Detailed Requirements

### 3.1 Routing & Navigation
- **Route**: Add `/items/:id` to `AppRoutes` wrapped in `ProtectedRoute` and `AppShell`.
- **Inbox Linkage**: Clicking an item row in `/inbox` navigates to `/items/:id`.
- **Header Navigation**: Back button (`← Inbox`) returns cleanly to the triage view preserving active filters.

### 3.2 Form Layout & Field Architecture (SCR-04)
1. **Header / Top Bar**:
   - Back link (`← Inbox`) with keyboard shortcut (`Esc`).
   - Status badge (`Inbox` vs `Active` / `Done` / `Archived`).
   - "Save Changes" button (`Cmd+Enter` / `Ctrl+Enter` shortcut) with loading spinner.
2. **Classification Selector (Type Switcher)**:
   - Visual toggle/tabs: `Note / Idea`, `Task`, `Resource`, `Calendar Event`.
   - Selecting a type dynamically reveals type-specific extension fields below.
3. **Core Editable Content**:
   - `Title`: Auto-populated from title or truncated first line of capture; editable text input.
   - `Content`: Auto-populated from content; multiline textarea for expanded notes/thoughts.
4. **Type-Specific Extension Fields**:
   - **Task**:
     - `Due Date` / `Time`: Optional date-time picker (ISO string).
     - `Priority`: Radio or selector (`low`, `normal`, `high`).
     - `Completed`: Checkbox toggling `completed_at` (now vs null).
   - **Resource**:
     - `URL`: Validated HTTP/HTTPS URL input (auto-extracted from `raw_input` if a link was captured).
     - `Status`: Reading status selector (`unread`, `reading`, `completed`).
   - **Calendar Event**:
     - `Start Time`: Mandatory date-time input.
     - `End Time`: Optional date-time input (must be >= start time).
     - `All Day`: Toggle checkbox.
   - **Note / Idea**:
     - No extra extension table; pure `items` record with `type: 'note' | 'idea'`.
5. **Read-Only Original Capture**:
   - Collapsible panel displaying `raw_input`, `captured_at`, and client UUID `id`.

### 3.3 Persistence & Data Synchronization
1. **Supabase Cloud Mutation**:
   - Update `items` table: `title`, `content`, `type`, `status`, `updated_at`.
   - Manage extension tables:
     - If `type === 'task'`: Upsert row in `tasks` table with `item_id` and `user_id`.
     - If `type === 'resource'`: Upsert row in `resources` table with `item_id` and `user_id`.
     - If `type === 'event'`: Upsert row in `calendar_events` table with `item_id` and `user_id`.
     - Clean up stale extension rows if the user changes type (e.g. changing from `task` to `note` deletes the corresponding row from `tasks`).
2. **Local Dexie Cache Update**:
   - Update `local_items` in Dexie to reflect the new `title`, `content`, `type`, and `updated_at` so `/inbox` and `/capture` reflect the changes immediately without stale cache flashes.
   - Set `synced = true` for the local item record upon successful cloud response.
3. **Export Integration**:
   - Because `web/src/lib/export/service.ts` already queries `tasks`, `resources`, `calendar_events`, and `items`, classified memories will immediately appear fully populated in the versioned JSON export.

---

## 4. UI States & Validation Rules

| State | Behavior & Visual Presentation |
| :--- | :--- |
| **Loading** | Clean skeleton loader while fetching item details from Supabase / Dexie. |
| **Empty / 404** | "Item not found" empty state if the UUID does not exist or belongs to another user under RLS. Includes a button to return to `/inbox`. |
| **Validation Error** | Client-side validation: <br>• Resource URL must be a valid URL (`http://` or `https://`). <br>• Event `end_at` must be after `start_at`. <br>• Title/Content must not exceed reasonable length limits (e.g., title <= 255 chars). |
| **Offline Mode** | Amber banner: *"You are offline. Editing and classification require an active connection."* Form inputs and Save button are disabled (`disabled={!isOnline}`). |
| **Save Success** | Brief toast or confirmation banner (`"Item updated"`), and automatic background cache invalidation in TanStack Query. |
| **Server Error** | Alert box showing specific error message with a "Retry" button. |

---

## 5. Security & Isolation Safeguards

1. **Strict Postgres RLS Boundary**:
   - All queries and mutations use `supabase.from(...)` with the user's JWT.
   - Attempting to edit or fetch an item owned by another user returns an empty result (404) or Postgres 42501 error.
2. **Payload Validation**:
   - `user_id` is always set to `session.user.id` on server payload.
   - Client never allows editing or clearing `raw_input`.
3. **No Privileged Keys**:
   - Purely browser-safe client (`VITE_SUPABASE_ANON_KEY`).

---

## 6. Implementation Plan & Steps

### Step 1: Domain Service & Types (`web/src/lib/items/`)
- Create `web/src/lib/items/types.ts`: TypeScript contracts for edit payloads, validation schemas, and extension record shapes.
- Create `web/src/lib/items/service.ts`:
  - `fetchItemDetail(itemId, userId)`: Queries `items` along with its matching extension record (`tasks`, `resources`, or `calendar_events`).
  - `updateItemClassification(itemId, userId, payload)`: Executes coordinated updates to `items` and extension tables, updating local Dexie cache upon completion.

### Step 2: Form Components (`web/src/components/items/`)
- `type-selector.tsx`: Tab/pill selector for `Note`, `Task`, `Resource`, `Event`.
- `task-fields.tsx`: Date picker, priority selector, completion checkbox.
- `resource-fields.tsx`: URL input, reading status selector.
- `event-fields.tsx`: Start/end datetime pickers, all-day toggle.
- `raw-input-provenance.tsx`: Collapsible view of immutable capture data.

### Step 3: Page Integration & Routing (`web/src/pages/item-detail-page.tsx`)
- Implement `ItemDetailPage` connecting `useParams<{ id: string }>()`, `useAuth()`, and TanStack Query / local service.
- Mount route in `AppRoutes`: `<Route path="/items/:id" element={<ProtectedRoute><ItemDetailPage /></ProtectedRoute>} />`.
- Update `web/src/components/inbox/item-row.tsx` to make the row clickable, navigating to `/items/${item.id}`.

### Step 4: Automated Testing Suite
- `web/src/test/item-detail-service.test.ts`:
  1. Fetching existing item with task extension.
  2. Fetching existing item with resource extension.
  3. Updating title and content while preserving immutable `raw_input`.
  4. Classifying an item from `unclassified` to `task` creates row in `tasks`.
  5. Switching type from `task` to `note` removes row from `tasks`.
  6. RLS enforcement: attempting to update another user's item fails.
  7. Invalid URL or invalid event date ranges trigger validation errors.
- `web/src/test/item-detail-page.test.tsx`:
  1. Renders loading skeleton and populates form.
  2. Renders 404 state on missing item.
  3. Displays offline banner and disables editing when offline.
  4. Submitting form calls service and updates local cache.
  5. Keyboard shortcuts (`Esc` to back, `Cmd+Enter` to save).

---

## 7. Explicit Non-Goals for Phase 2

- **AI Classification / Auto-tagging (FR-24, Phase 5)**: AI suggestions and automatic type inference are deferred to Phase 5. Phase 2 provides explicit, manual user classification.
- **FastAPI URL Metadata Fetcher (FR-09, Phase 4)**: Automatically scraping web titles/descriptions from captured links is deferred to Phase 4.
- **Full-Text Search (FR-18, Phase 3)**: PostgreSQL FTS and search UI are deferred to Phase 3.
- **Block Editor / Rich Text**: Phase 2 uses standard Markdown textarea. No heavy block editor.
- **Relationships / Graph (FR-21, Phase 7/8)**: Cross-item linking deferred to Phase 7.

---

## 8. Execution & Verification Report

### 8.1 Files Created and Modified
- **Database Function**:
  - `supabase/migrations/20261009000000_classify_item_rpc.sql`: Atomic stored procedure `classify_and_update_item` (`SECURITY INVOKER`, verifying `auth.uid() = p_user_id`, updating item fields, upserting active extension row, deleting stale extension rows).
- **Core Domain Service & Types**:
  - `web/src/lib/items/types.ts`: Domain models (`ItemDetailRecord`, `UpdateItemPayload`, `TaskFields`, `ResourceFields`, `EventFields`), validation helper `validateItemPayload`.
  - `web/src/lib/items/service.ts`: Ownership-enforcing `fetchItemDetail` and strictly fail-closed atomic `updateItemClassification` (direct RPC call with no silent non-atomic multi-table writes).
- **Components & UI**:
  - `web/src/components/items/type-selector.tsx`: Visual selector for Note, Task, Resource, Event.
  - `web/src/components/items/task-fields.tsx`: Due date, priority (`low`, `normal`, `high`), and completion toggle.
  - `web/src/components/items/resource-fields.tsx`: URL input with validation and reading status (`unread`, `reading`, `completed`).
  - `web/src/components/items/event-fields.tsx`: Start time, end time, and all-day toggle with validation.
  - `web/src/pages/item-detail-page.tsx`: SCR-04 screen with 4 states (loading, missing/404, offline read-only, editing), keyboard shortcuts (`Esc`, `Cmd+Enter`), and immutable `raw_input` provenance card.
- **Routing & Integration**:
  - `web/src/App.tsx`: Mounted `/items/:id` in `ProtectedRoute` and `AppShell`.
  - `web/src/pages/inbox-page.tsx`: Navigates to `/items/:id` on row selection.
- **Automated Tests**:
  - `web/src/test/item-detail-service.test.ts`: 11 tests covering detail fetching, cross-user RLS rejection, classification creation, atomic stale extension cleanup via RPC, URL/date validation, ADR-02 offline error, offline cache reading, fail-closed RPC errors, Dexie cache preservation on failure, and cross-account rejection.
  - `web/src/test/item-detail-page.test.tsx`: 6 tests covering UI rendering, immutable `raw_input`, dynamic extension fields, form save feedback, 404 state, ADR-02 offline banner, and form save failure error alert (verifying "Saved" is never displayed on error).

### 8.2 Review Audit Findings & Priority 1 Remediations
1. **Transaction Integrity Verified**:
   - `classify_and_update_item` runs completely inside a single PostgreSQL transaction. Any error (e.g. invalid type, check constraint failure, or missing parameters) triggers `RAISE EXCEPTION`, rolling back all updates to `items` and extension tables.
   - Ownership is enforced via `SECURITY INVOKER` and explicit `v_user_id := auth.uid()` assertions. The query `WHERE id = p_item_id AND user_id = v_user_id` ensures cross-account mutations abort with `'Item not found or permission denied'`.
   - Stale extension rows are deleted atomically within the same transaction during type switches (e.g. switching `task` -> `resource` deletes from `tasks` and inserts into `resources`).
2. **Elimination of Silent Non-Atomic Client Fallback**:
   - **Finding**: The original draft in `web/src/lib/items/service.ts` attempted independent table-by-table writes (`client.from('tasks').upsert()`, then `client.from('items').update()`, then `client.from('resources').delete()`) if the RPC function call failed or returned an error.
   - **Remediation**: The fallback has been completely removed. `updateItemClassification` now adopts a strict **fail-closed** policy. If `client.rpc('classify_and_update_item')` fails or returns an error, it immediately throws `Failed to update item classification: ...`.
   - **Data Integrity Guarantee**: RPC failures leave existing database and local Dexie records completely untouched. No orphaned extension records or partially updated items can be created.
   - **UI Feedback Guarantee**: The UI catches the RPC error, sets `saveError`, displays a visible error alert box, and never falsely indicates "Saved".

### 8.3 Live Deployment & Verification Instructions
To verify Phase 2 in a live Supabase environment:

#### 1. Apply Migration
In the **Supabase Dashboard** -> **SQL Editor**, run:
```sql
-- Apply Phase 2 RPC function
\i supabase/migrations/20261009000000_classify_item_rpc.sql
```
*(Or copy and paste the contents of `supabase/migrations/20261009000000_classify_item_rpc.sql` into the SQL Editor and execute).*

#### 2. Confirm Function Signature and Security Mode
Run the following SQL verification query:
```sql
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'classify_and_update_item';
```
**Expected Result**:
- `function_name`: `classify_and_update_item`
- `arguments`: includes `p_item_id uuid, p_type text, p_title text ...`
- `is_security_definer`: `false` (confirms `SECURITY INVOKER` so caller RLS identity is enforced).

#### 3. Live Browser Functional Verification
1. Sign in to `http://localhost:5173/auth`.
2. Capture a new item on `/capture`: e.g. `"https://news.ycombinator.com Hacker News front page"`.
3. Navigate to `/inbox` and click the newly captured row.
4. Verify navigation to `/items/<uuid>`.
5. Verify immutable `raw_input` card matches the captured text exactly.
6. Select **Task**: set Priority to `High`, pick a Due Date, and press `Ctrl+Enter` (or click "Save Changes").
   - Verify green "Saved" confirmation indicator appears.
   - Run SQL check: `SELECT * FROM public.tasks WHERE item_id = '<uuid>';` (confirms task row created).
   - Run SQL check: `SELECT type, title FROM public.items WHERE id = '<uuid>';` (confirms `type = 'task'`).
7. Switch Type to **Resource**:
   - URL is pre-filled or entered. Set Status to `Reading`.
   - Save changes.
   - Run SQL check: `SELECT * FROM public.resources WHERE item_id = '<uuid>';` (confirms resource row created).
   - Run SQL check: `SELECT * FROM public.tasks WHERE item_id = '<uuid>';` (confirms stale task row was atomically deleted).
8. Test Missing RPC / Fail-Closed Behavior:
   - Temporarily rename the function or call a non-existent RPC:
   - The UI immediately surfaces: `"Unable to save item: Failed to update item classification: function ... does not exist"`.
   - The UI does NOT show "Saved".
   - Refresh the page: the item retains its previous valid state with zero data corruption.
9. Cross-Account Ownership Verification:
   - Attempting to call the RPC with User B's authenticated session on User A's `item_id` raises:
     `P0002: Item not found or permission denied`.

### 8.4 Automated Test Suite Metrics
- **Frontend Test Suite (`npm test -- --run`)**: 15 test files passed, 109 total tests passed (100% green).
- **Phase 2 Service Suite (`src/test/item-detail-service.test.ts`)**: 11/11 tests passed.
- **Phase 2 UI Suite (`src/test/item-detail-page.test.tsx`)**: 6/6 tests passed.
- **TypeScript Typecheck (`npm run typecheck`)**: 0 errors (`tsc -b` clean).
- **Frontend Linter (`npm run lint`)**: 0 errors (`oxlint` clean).
- **Production Build (`npm run build`)**: Vite bundle built cleanly in 978ms; PWA service worker generated.
- **Backend API (`py -m pytest` & `py -m ruff check .`)**: 6 passed in 1.59s; 0 lint errors.

### 8.5 Remaining Limitations & Boundaries
- **No Search or AI (Frozen Scope)**: Search indexing, keyword search UI, and automatic AI classification are deferred to Phase 3 and Phase 5.
- **Capture-Only Offline (ADR-02)**: Item editing and classification remain strictly online-only to prevent multi-device edit conflicts. Offline reading of cached items is fully supported.

