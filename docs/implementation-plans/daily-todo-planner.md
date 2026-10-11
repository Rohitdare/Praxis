# Praxis Implementation Plan — Daily To-Do Planner & Weekly Productivity Statistics

**Status:** Phase A Complete — Proposed Implementation Plan  
**Target Architecture:** Local-First Praxis Task Planner with Weekly Metrics  
**Date:** 2026-10-11  
**Authors:** Senior Full-Stack Engineer & Product Designer  

---

## 1. Audit of Existing Task Architecture

A comprehensive audit of the existing Praxis codebase, database schema, services, and tests was conducted prior to designing the Planner.

### 1.1 Existing Database Schema & RLS
- **Core Table (`public.items`):**
  - Contains `id` (UUIDv4), `user_id` (auth user), `type` (`'task'`), `status` (`'inbox'`, `'active'`, `'done'`, `'archived'`), `title`, `content`, `raw_input`, `captured_at`, `created_at`, `updated_at`, `deleted_at`.
  - Protected by RLS policy `own_items` (`user_id = (select auth.uid())`).
  - Indexed on `(user_id, updated_at, id)`, `(user_id, type)`, `(user_id, status)`.
- **Extension Table (`public.tasks`):**
  - Contains `item_id` (PK references `items.id`), `user_id`, `due_at` (`timestamptz`), `priority` (`'low'`, `'normal'`, `'high'`), `completed_at` (`timestamptz`), `created_at`, `updated_at`.
  - Protected by RLS policy `own_tasks` (`user_id = (select auth.uid())`).
  - Already indexed on `(user_id, due_at)`.
- **Database Function (`classify_and_update_item`):**
  - Added in `20261010000000_classify_item_rpc_idempotent.sql`.
  - Atomically manages `items` and `tasks` in a single transaction with validation and idempotency.
  - Takes `p_item_id`, `p_type = 'task'`, `p_title`, `p_content`, `p_status`, `p_due_at`, `p_priority`, `p_completed_at`.

### 1.2 Local Storage (Dexie) & Outbox Engine
- `PersonalMemoryDB` in `web/src/lib/db/index.ts` provides `local_items` and `outbox`.
- Offline capture stores raw inputs and classification items locally with stable client-generated UUIDv4.
- Outbox synchronization replays pending entries to Supabase once online.

### 1.3 Key Audit Finding
**No second task table or duplicated task system is required.** The existing `items` and `tasks` schema already stores all requisite fields: titles, notes, statuses (`active` vs `done`), deadlines (`due_at`), priorities (`low`/`normal`/`high`), and explicit completion timestamps (`completed_at`).

To optimize weekly statistics range queries over large sets of completed tasks, only a single non-breaking index migration is proposed:
- `tasks_user_completed_idx` on `public.tasks(user_id, completed_at)`.

---

## 2. Precise Metric & Statistics Definitions

Statistics must represent truthful historical task activity, not transient state. The following formal rules govern all metric calculations:

### 2.1 Timezone & Date Boundaries
- **Week Boundaries:** Weeks strictly start on **Monday 00:00:00** and end on **Sunday 23:59:59.999** in the user's localized timezone (from profile or browser runtime).
- **UTC Storage:** All database timestamps (`due_at`, `completed_at`, `created_at`) remain in UTC ISO-8601 strings and are projected into localized day boundaries for display.

### 2.2 Core Weekly Metrics
1. **Tasks Planned ($P$):**
   - Count of distinct active or completed tasks whose `due_at` falls between Monday 00:00:00 and Sunday 23:59:59 of the selected week.
   - Tasks without a due date are counted as "Inbox / Unscheduled" and are excluded from the weekly planned denominator to avoid arbitrary date attribution.
2. **Tasks Completed ($C$):**
   - Count of distinct tasks whose `completed_at` timestamp falls between Monday 00:00:00 and Sunday 23:59:59 of the selected week.
   - *Rule:* A task completed in Week $W_2$ that was originally due in Week $W_1$ counts as completed in Week $W_2$.
3. **Completion Rate ($R$):**
   - Defined as:
     $$\text{Completion Rate} = \begin{cases} 0\% & \text{if } P = 0 \text{ and } C = 0 \\ 100\% & \text{if } P = 0 \text{ and } C > 0 \\ \min\left(100\%, \frac{C_{\text{planned}}}{P} \times 100\right) & \text{if } P > 0 \end{cases}$$
     where $C_{\text{planned}}$ is tasks planned for that week and completed. Tasks completed without a due date or from past weeks are displayed in the activity breakdown without artificially inflating the denominator.
4. **Outstanding Tasks ($O$):**
   - Planned tasks for the selected week that remain in status `'active'` (`status != 'done'`).
5. **Overdue Tasks ($V$):**
   - For the current week: Tasks whose `due_at` has elapsed (`due_at < now()`) and are still `'active'`.
   - For past weeks: Tasks planned for that week that were never completed.
6. **Daily Activity (Monday – Sunday):**
   - For each day $d \in [\text{Mon}, \text{Tue}, \dots, \text{Sun}]$, count of tasks completed on day $d$ based on `completed_at`.

### 2.3 Rescheduling & State Reversal Rules
- **Reopening a Task:** If a user unchecks a completed task, `status` reverts to `'active'` and `completed_at` is set to `null`. It immediately ceases to count in historical completed metrics.
- **Carrying Tasks Forward:** When an overdue or unfinished task is pushed to today or tomorrow, its `due_at` is updated to the target day. The audit log (`updated_at`) records the change, and the task moves to the new day's planned list without rewriting previous days' immutable completion histories.

---

## 3. UI/UX Design & Architecture

### 3.1 Dedicated Planner Navigation
- Add a new route `/planner` (or `/tasks`) with the Lucide `CheckSquare` icon.
- Add navigation item in:
  - Desktop floating focus lens navbar in `app-shell.tsx`.
  - Mobile bottom floating navigation capsule in `app-shell.tsx`.
- Follow Praxis visual aesthetics: calm contrast, clean typography (`Geist` / `Inter`), dark/light theme support, and zero distracting animations or gamified streak pressure.

### 3.2 Daily Planner Layout
1. **Header Row:**
   - Date picker & navigation (`< Today >`, date picker dropdown).
   - Day progress pill (e.g. `3 of 5 completed`).
   - Switcher between **Daily Planner** and **Weekly Stats** tabs.
2. **Quick-Add Task Bar:**
   - Clean single-line input: *"Add a task for today..."*.
   - Keyboard shortcut: `Enter` to save immediately.
   - Optional quick priority flag (Low, Normal, High) and time picker.
3. **Today's Active Task List:**
   - One-click checkbox for instant completion.
   - Priority indicator badges (subtle dot / pill: High = subtle rose/amber, Normal = muted, Low = subtle slate).
   - Overdue badge for overdue tasks.
   - Quick action menu: Reschedule ("Move to tomorrow"), Edit (opens item detail or inline edit), Delete (soft delete).
4. **Overdue / Rollover Section:**
   - Appears when unresolved tasks from past days exist.
   - Allows one-click "Carry forward to today" individually or in bulk.
5. **Completed Tasks Section:**
   - Strikethrough title with completion timestamp.
   - Collapsible accordion to preserve a calm, uncluttered view.
6. **Empty States:**
   - Clear, minimalist message when no tasks are planned for the day (*"Nothing scheduled for today. Capture a task above to plan your day."*).

### 3.3 Weekly Productivity Dashboard Layout
1. **Week Header:**
   - Week range indicator: e.g., *"Oct 12 – Oct 18, 2026"*.
   - Navigation buttons: `Previous Week`, `Current Week`, `Next Week`.
2. **Summary Cards Grid (4 compact metrics):**
   - **Tasks Planned:** Total planned for the week.
   - **Tasks Completed:** Total finished during the week.
   - **Completion Rate:** Percentage with clear denominator label.
   - **Outstanding / Overdue:** Unfinished items count.
3. **Weekly Activity Visualizer:**
   - Lightweight, accessible 7-bar chart (Monday through Sunday) rendered using pure CSS/SVG.
   - Zero heavyweight charting libraries introduced.
   - Displays daily completed count on hover/focus.
4. **Daily Breakdown Table/List:**
   - Day-by-day rows (Mon to Sun) detailing Planned vs Completed vs Pending for each date.
5. **Empty Week State:**
   - Informative message when no task data exists for the selected week without misleading `0%` warnings.

---

## 4. Technical Architecture & File Organization

```
web/src/
├── components/
│   └── planner/
│       ├── planner-header.tsx         # Date navigator, progress summary, view switcher
│       ├── task-quick-add.tsx         # Rapid single-input task creator
│       ├── task-item-row.tsx          # Accessible checkbox, priority pill, action menu
│       ├── task-list-section.tsx      # Active, overdue, and completed collapsible lists
│       ├── rollover-banner.tsx        # One-click carry forward for overdue tasks
│       ├── weekly-dashboard.tsx       # Weekly metric cards and CSS bar visualization
│       └── weekly-bar-chart.tsx       # Accessible lightweight SVG/CSS weekly activity chart
├── lib/
│   └── planner/
│       ├── service.ts                 # Task CRUD, completion toggles, daily/weekly queries
│       ├── types.ts                   # PlannerTask, WeeklyStats, DaySummary interfaces
│       └── stats.ts                   # Pure functions calculating weekly metrics and date ranges
├── pages/
│   └── planner-page.tsx               # Top-level route page (/planner)
└── test/
    ├── planner-service.test.ts        # Unit tests for queries, completion, and rescheduling
    ├── planner-stats.test.ts          # Pure math/boundary tests for Monday-Sunday stats
    └── planner-page.test.tsx          # Component tests for daily view, weekly dashboard, keyboard
```

### 4.1 Service Layer (`task-planner-service.ts`)
- **`fetchDailyTasks(userId: string, date: string)`**:
  - Queries `tasks` and `items` joined where `items.deleted_at is null` and `items.type = 'task'`.
  - Filters by `tasks.due_at` on the specified day, plus fetches overdue active tasks.
  - Offline-resilient: Falls back to Dexie `local_items` when offline.
- **`createPlannerTask(params: CreatePlannerTaskParams)`**:
  - Client generates UUIDv4 `itemId`.
  - Invokes `classify_and_update_item` with `p_type = 'task'`, `p_status = 'active'`, `p_due_at`.
  - Immediately writes to Dexie `local_items` for local-first immediacy.
- **`toggleTaskCompletion(itemId: string, userId: string, completed: boolean)`**:
  - Updates `tasks.completed_at = completed ? now() : null` and `items.status = completed ? 'done' : 'active'`.
  - Atomically executed via RPC or Supabase client update.
- **`carryTaskForward(itemId: string, newDate: string)`**:
  - Updates `tasks.due_at` to the new target date, preserving original `created_at`.
- **`fetchWeeklyStats(userId: string, weekStart: string, weekEnd: string)`**:
  - Queries tasks planned in `[weekStart, weekEnd]` and tasks completed in `[weekStart, weekEnd]`.
  - Runs pure `calculateWeeklyStats(tasksPlanned, tasksCompleted, weekStart, weekEnd)`.

---

## 5. Security, Multi-User Isolation & Offline Invariants

1. **Multi-User Security & RLS:**
   - All queries filter strictly by `user_id = auth.uid()`.
   - RPC and table updates enforce user ownership; unauthorized operations fail closed (`P0002` / `42501`).
2. **Offline Invariants:**
   - Task creation offline writes to `local_items` with `synced: false` and adds an `outbox` record.
   - When the user reconnects, existing background sync (`sync-engine.ts`) pushes the outbox.
   - Status changes while offline are reflected optimistically in local cache with pending sync indicators.
3. **JSON Export Compatibility:**
   - Existing JSON export in `web/src/lib/export/service.ts` already captures the `tasks` and `items` tables with `due_at` and `completed_at`. Zero breaking changes to the export schema required.

---

## 6. Schema Migration (Minimal & Non-Breaking)

A single migration file:
`supabase/migrations/20261012000000_tasks_completed_idx.sql`
```sql
-- Migration: 20261012000000_tasks_completed_idx.sql
-- Description: Add index on tasks(user_id, completed_at) for fast weekly productivity aggregations.

create index if not exists tasks_user_completed_idx on public.tasks(user_id, completed_at);
```

---

## 7. Automated Test Plan

1. **Task Planner Service Tests (`planner-service.test.ts`):**
   - Create task with due date and verify `items` + `tasks` record.
   - Complete task: verifies `items.status = 'done'` and `tasks.completed_at` is set.
   - Reopen task: verifies `items.status = 'active'` and `tasks.completed_at = null`.
   - Soft delete task: verifies `items.deleted_at` set and removed from active planner.
   - Carry forward task: updates `due_at` to tomorrow without altering creation timestamp.
2. **Weekly Statistics Calculation Tests (`planner-stats.test.ts`):**
   - Monday-to-Sunday boundary edge cases.
   - Task completed in a different week than planned.
   - Completion rate calculation with 0 planned tasks (avoids division by zero).
   - Empty week metrics and unassigned tasks handling.
   - Reopened tasks recalculation.
3. **UI & Integration Tests (`planner-page.test.tsx`):**
   - Quick-add input creates and renders task immediately in Today's list.
   - Checkbox toggle marks task completed and updates day progress summary.
   - Overdue tasks banner renders with rollover action.
   - Weekly stats tab renders summary cards and 7-day activity visualizer.
   - Week navigation updates stats dynamically.
   - Responsive layout and accessibility controls.
4. **Regression & Full Suite:**
   - Run complete suite: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `pytest`, `ruff`.

---

## 8. Implementation Phases & Checkpoints

- [x] **Phase A — Audit and Plan:** Inspected codebase, designed metric definitions, planned architecture, created `docs/implementation-plans/daily-todo-planner.md`.
- [x] **Phase B — Core Daily Planner:** Implemented `planner-service.ts`, `task-quick-add.tsx`, `task-item-row.tsx`, `rollover-banner.tsx`, `task-list-section.tsx`, daily list view, and app navigation link.
- [x] **Phase C — Weekly Statistics Dashboard:** Implemented pure `stats.ts`, `weekly-dashboard.tsx`, accessible 7-day activity visualizer `weekly-bar-chart.tsx`, and week navigation.
- [x] **Phase D — Integration, Verification & Documentation:** Integration with Inbox/Tasks data model, offline Dexie fallback, 21 unit & component tests across 3 suites, typecheck, lint, and production bundle build verified.
