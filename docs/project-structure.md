# Praxis — Complete Repository Structure

This document provides a comprehensive map of the entire **Praxis** codebase, organized by layer, component, and responsibility.

---

## 1. Directory Tree Overview

```text
praxis/
├── .editorconfig                          # Global indentation and formatting rules
├── .env.example                           # Root environment variable template
├── .gitignore                             # Git ignore rules for node_modules, build artifacts, venvs
├── README.md                              # Main project overview, quickstart, and deployment guide
│
├── api/                                   # Auxiliary Backend (FastAPI / Python 3.14 on Render)
│   ├── .env.example                       # API environment configuration template
│   ├── .gitignore                         # Python, pytest, and venv ignore rules
│   ├── .python-version                    # Pinned Python version (3.14)
│   ├── README.md                          # API documentation, local run, and deployment notes
│   ├── pyproject.toml                     # Python packaging and tool configuration
│   ├── requirements.txt                   # Production pip dependencies for Render
│   ├── uv.lock                            # Fast uv package manager lockfile
│   ├── src/
│   │   └── personal_memory_api/
│   │       ├── __init__.py                # Package root
│   │       └── main.py                    # FastAPI app initialization, CORS middleware, /health
│   └── tests/
│       ├── test_health.py                 # API healthcheck test
│       └── test_rls_isolation.py          # Backend Supabase RLS isolation tests
│
├── docs/                                  # Project Documentation & Architecture Records
│   ├── architecture.md                    # Core system architecture, data flow, and layers
│   ├── design.md                          # UI/UX design specifications, screen catalog, and theme tokens
│   ├── prd.md                             # Product Requirements Document (features, latency SLAs)
│   ├── tech-stack.md                      # Complete technology stack and rationale
│   ├── implementation-status.md           # Implementation phase tracking and feature status
│   ├── repository-audit.md                # Repository health and code quality audit
│   ├── repository-cleanup-report.md       # Audit and dead-code removal log
│   ├── review.md                          # Architectural and feature reviews
│   ├── adrs/                              # Architecture Decision Records
│   │   ├── README.md                      # ADR registry and decision index
│   │   ├── adr-001-direct-supabase-rls.md # Direct client-to-Supabase with strict RLS
│   │   ├── adr-002-capture-only-offline-scope.md # Local-first capture & outbox scope
│   │   ├── adr-003-client-generated-uuidv4.md # Client-side UUIDv4 for collision-free writes
│   │   ├── adr-006-immutable-raw-input-provenance.md # Preserving raw input integrity
│   │   └── adr-009-relational-extension-tables.md # Items core table + extension tables
│   ├── assets/                            # Documentation screenshots and branding references
│   │   ├── praxis-dark.png                # Dark mode preview
│   │   ├── praxis-light.png               # Light mode preview
│   │   └── praxis-mobile.png              # Mobile layout preview
│   ├── implementation-plans/              # Phased implementation roadmaps
│   │   ├── daily-todo-planner.md          # Daily planner and weekly dashboard spec
│   │   ├── phase-1e-settings-export.md    # Settings and JSON data export roadmap
│   │   └── phase-2-item-classification-editing.md # Item editing & extension tables
│   └── security/                          # Security Audits & Incident Reports
│       └── cross-account-data-leakage.md  # SEC-001 root cause, remediation, and verification
│
├── supabase/                              # Database Schema & BaaS Configuration
│   ├── config.toml                        # Supabase local environment config
│   └── migrations/                        # Versioned SQL migrations
│       ├── 20261008000000_initial_schema.sql # Core items, tasks, resources, calendar, RLS
│       ├── 20261009000000_classify_item_rpc.sql # First classify RPC version
│       ├── 20261010000000_classify_item_rpc_idempotent.sql # Atomic classify_and_update_item RPC
│       └── 20261012000000_tasks_completed_idx.sql # Planner indexing performance optimizations
│
└── web/                                   # Frontend Client (React 18 SPA / Vite / PWA / TypeScript)
    ├── .env.example                       # Web client environment template
    ├── .gitignore                         # Frontend build and dependency ignore rules
    ├── .oxlintrc.json                     # Linter configuration (oxlint)
    ├── README.md                          # Frontend setup, development, and test scripts
    ├── components.json                    # UI component library configuration
    ├── index.html                         # SPA entry HTML shell with PWA meta tags
    ├── package.json                       # Dependencies, scripts, and build tools
    ├── package-lock.json                  # Locked npm dependency tree
    ├── tsconfig.json                      # TypeScript root project config
    ├── tsconfig.app.json                  # Application TypeScript compiler options
    ├── tsconfig.node.json                 # Node/Vite build tooling TypeScript options
    ├── vite.config.ts                     # Vite bundle config, VitePWA workbox plugin
    ├── public/                            # Static Assets & PWA Icons
    │   ├── favicon.svg                    # SVG browser favicon
    │   ├── icons.svg                      # System icon sprites
    │   └── branding/                      # Praxis branding assets
    │       ├── praxis-icon.png            # 1x App icon
    │       ├── praxis-icon.svg            # Vector app icon
    │       ├── praxis-icon@2x.png         # 2x Retina app icon
    │       ├── praxis-logo.png            # Default logo (light background)
    │       ├── praxis-logo.svg            # Vector logo
    │       ├── praxis-logo@2x.png         # 2x Retina logo
    │       ├── praxis-logo-dark.png       # Logo for dark backgrounds
    │       ├── praxis-logo-dark.svg       # Vector dark logo
    │       ├── praxis-logo-dark@2x.png    # 2x Retina dark logo
    │       └── praxis-logo-reference.png  # Brand identity reference
    └── src/                               # Application Source Code
        ├── main.tsx                       # React DOM root entry point
        ├── App.tsx                        # Router configuration, route guards, lazy loading
        ├── App.test.tsx                   # Top-level smoke test
        ├── index.css                      # Global styles, Tailwind base, design tokens
        ├── components/                    # Reusable React UI Components
        │   ├── auth/                      # Authentication Guard Components
        │   │   ├── protected-route.tsx    # Redirects unauthenticated sessions to /auth
        │   │   └── public-route.tsx       # Redirects authenticated sessions to /capture
        │   ├── branding/                  # Brand & Identity Components
        │   │   └── praxis-logo.tsx        # Responsive SVG Praxis mark & typography
        │   ├── capture/                   # Capture UI Components
        │   │   ├── capture-bar.tsx        # Omni-capture input bar (<300ms SLA, keyboard shortcuts)
        │   │   └── recent-captures.tsx    # Reverse chronological recent captures feed
        │   ├── inbox/                     # Inbox & Triage Components
        │   │   ├── inbox-empty-state.tsx  # Zero-state empty inbox graphic & copy
        │   │   ├── inbox-filters.tsx      # Type filters (All, Notes, Tasks, Resources, Events)
        │   │   ├── inbox-list.tsx         # Virtualized / scrollable inbox items list
        │   │   └── item-row.tsx           # Individual item card with quick actions
        │   ├── items/                     # Detail & Extension Editor Components
        │   │   ├── type-selector.tsx      # Dynamic classification switcher
        │   │   ├── task-fields.tsx        # Due date, priority, completion inputs
        │   │   ├── resource-fields.tsx    # URL, domain extraction, read status
        │   │   └── event-fields.tsx       # Start/end datetime, all-day toggle
        │   ├── layout/                    # Layout & Shell Components
        │   │   └── app-shell.tsx          # Mobile navigation bar, desktop header, sync status
        │   ├── planner/                   # Daily & Weekly Planner Components
        │   │   ├── planner-header.tsx     # Date navigation, day picker, stats summary
        │   │   ├── rollover-banner.tsx    # Past due / incomplete task rollover warning
        │   │   ├── task-item-row.tsx      # Task item with checkbox, priority tag, delete
        │   │   ├── task-list-section.tsx  # Categorized sections (Planned, Overdue, Completed)
        │   │   ├── task-quick-add.tsx     # Inline task creation input
        │   │   ├── weekly-bar-chart.tsx   # Productivity bar chart component
        │   │   └── weekly-dashboard.tsx   # 7-day productivity metrics & stats card
        │   ├── sync/                      # Synchronization Components
        │   │   └── sync-indicator.tsx     # Cloud sync status pill (synced, syncing, offline, error)
        │   ├── theme/                     # Theme Switching Components
        │   │   └── theme-toggle.tsx       # Light / Dark / System mode toggle
        │   └── ui/                        # Core UI Primitives (Design System)
        │       ├── button.tsx             # Button variants (default, outline, ghost, destructive)
        │       ├── clock.tsx              # Calm real-time clock indicator
        │       ├── date-time-picker.tsx   # Date & time picker dialog
        │       └── input.tsx              # Standard input primitive
        ├── lib/                           # Core Business Logic, State & Services
        │   ├── utils.ts                   # Tailwind merge and className helpers
        │   ├── auth/                      # Authentication Provider & State
        │   │   └── auth-context.tsx       # AuthProvider, Supabase GoTrue lifecycle, session storage
        │   ├── calendar/                  # Calendar Service Layer
        │   │   ├── service.ts             # fetchCalendarEvents, CRUD, partitioned cache
        │   │   └── timezone.ts            # Timezone math, date conversion, ISO formatting
        │   ├── db/                        # Client-Side Storage Engine (Dexie / IndexedDB)
        │   │   ├── index.ts               # PersonalMemoryDB schema v2, table declarations, migrations
        │   │   ├── schema.ts              # TypeScript interfaces for LocalItem, OutboxRecord
        │   │   └── capture.ts             # captureItem (<300ms SLA), getRecentCaptures, local classifier
        │   ├── export/                    # Data Export Service Layer
        │   │   ├── service.ts             # gatherExportData, JSON serialization, download trigger
        │   │   └── types.ts               # Export schema interfaces
        │   ├── inbox/                     # Inbox Service Layer
        │   │   ├── index.ts               # Public exports
        │   │   └── service.ts             # fetchInboxItems (local+remote merge), softDeleteItem
        │   ├── items/                     # Item Detail & Mutation Service Layer
        │   │   ├── service.ts             # fetchItemDetail, updateItemClassification RPC
        │   │   └── types.ts               # ItemRow, TaskRow, ResourceRow, CalendarEventRow types
        │   ├── notes/                     # Notes Service Layer
        │   │   └── service.ts             # fetchNotes, createNote, saveNote, deleteNote
        │   ├── planner/                   # Planner Service Layer
        │   │   ├── service.ts             # fetchDailyPlannerData, fetchWeeklyProductivityStats
        │   │   ├── stats.ts               # calculateWeeklyStats, date range helpers
        │   │   └── types.ts               # PlannerTask, DailyPlannerData, WeeklyStats
        │   ├── supabase/                  # Supabase Client & Database Types
        │   │   ├── client.ts              # createClient singleton, auth state management
        │   │   └── database.types.ts      # Generated database schema types
        │   ├── sync/                      # Offline Synchronization Engine
        │   │   ├── engine.ts              # drainOutbox, exponential backoff, account-switch guard
        │   │   ├── mapper.ts              # LocalItem to server ItemRow schema translation
        │   │   ├── sync-context.tsx       # SyncProvider, reactive sync status state machine
        │   │   └── types.ts               # SyncState, OutboxRecord, SyncResult interfaces
        │   └── theme/                     # Theme Context
        │       └── theme-context.tsx      # ThemeProvider, CSS variable dark/light switcher
        ├── pages/                         # Route Page Components
        │   ├── auth-page.tsx              # /auth — Sign In, Sign Up, Forgot Password, Google OAuth
        │   ├── capture-page.tsx           # /capture — Omni-capture bar & recent captures feed
        │   ├── inbox-page.tsx             # /inbox — Triage list, filtering, quick classification
        │   ├── item-detail-page.tsx       # /items/:id — Full item editor, extension fields
        │   ├── notes-page.tsx             # /notes — Split-pane note editor & search list
        │   ├── planner-page.tsx           # /planner — Daily planner, task rollover, weekly stats
        │   ├── calendar-page.tsx          # /calendar — Monthly & weekly calendar view
        │   └── settings-page.tsx          # /settings — Account details, JSON data export, sign-out
        └── test/                          # Unit & Integration Test Suite (Vitest)
            ├── setup.ts                   # Test environment setup (jsdom, fake-indexeddb, matchers)
            ├── auth-config.test.ts        # Supabase auth configuration tests
            ├── auth-routing.test.tsx      # Auth routing, public/protected routes, eye toggle
            ├── calendar-page.test.tsx     # Calendar page component integration tests
            ├── calendar.test.ts           # Calendar service & timezone unit tests
            ├── capture-flow.test.tsx      # Omni-capture UX, keyboard shortcuts, latency tests
            ├── clock.test.tsx             # Clock component tests
            ├── cross-account-isolation.test.tsx # SEC-001 cross-account isolation regression suite
            ├── date-time-picker.test.tsx  # DateTimeSelector component tests
            ├── export-service.test.ts     # JSON data export unit tests
            ├── inbox-page.test.tsx        # Inbox page triage & filtering tests
            ├── inbox-service.test.ts      # Inbox fetch & soft delete unit tests
            ├── item-detail-page.test.tsx  # ItemDetailPage component tests
            ├── item-detail-service.test.ts # Item detail & extension fetch tests
            ├── local-db.test.ts           # Dexie IndexedDB latency, operations, & migration tests
            ├── mobile-responsiveness.test.tsx # Mobile layout & touch-target accessibility tests
            ├── notes-page.test.tsx        # Notes editor component tests
            ├── notes-service.test.ts      # Notes CRUD & offline fallback tests
            ├── planner-page.test.tsx      # Daily planner UI component tests
            ├── planner-service.test.ts    # Planner task fetch & rollover tests
            ├── planner-stats.test.ts      # Weekly productivity analytics calculation tests
            ├── praxis-logo.test.tsx       # Brand logo rendering tests
            ├── pwa-config.test.ts         # Service worker & PWA manifest tests
            ├── recent-captures.test.tsx   # RecentCaptures component tests
            ├── rls-isolation.test.ts      # Frontend RLS policy expectation tests
            ├── settings-page.test.tsx     # Settings page & export action tests
            ├── smart-capture.test.ts      # Local heuristic classifier tests
            ├── sync-engine.test.ts        # Sync engine, outbox drain, backoff tests
            ├── sync-indicator.test.tsx    # SyncIndicator component tests
            └── theme-system.test.tsx      # Dark / Light theme context tests
```

---

## 2. Layer & Architectural Responsibility Matrix

| Subsystem | Primary Technologies | Key Files / Paths | Main Responsibility |
|---|---|---|---|
| **Frontend UI (SPA)** | React 18, Vite, Tailwind CSS, Lucide | [`web/src/pages/`](file:///d:/sample-projects/bruno/web/src/pages/), [`web/src/components/`](file:///d:/sample-projects/bruno/web/src/components/) | Responsive PWA interface for capture, triage, notes, calendar, and daily planning. |
| **Local-First Storage** | Dexie.js v2, IndexedDB, localStorage | [`web/src/lib/db/`](file:///d:/sample-projects/bruno/web/src/lib/db/), [`web/src/lib/calendar/service.ts`](file:///d:/sample-projects/bruno/web/src/lib/calendar/service.ts) | Sub-300ms guaranteed writes, compound index migrations, user-partitioned local cache. |
| **Sync Engine** | Custom TypeScript Queue | [`web/src/lib/sync/`](file:///d:/sample-projects/bruno/web/src/lib/sync/) | Push/pull outbox engine, exponential backoff, account-switch abort guards (SEC-001). |
| **Authentication** | Supabase Auth (GoTrue), JWT | [`web/src/lib/auth/auth-context.tsx`](file:///d:/sample-projects/bruno/web/src/lib/auth/auth-context.tsx) | Google OAuth & Email/Password login, session restoration, memory cache hygiene. |
| **Cloud Database (BaaS)** | Supabase, PostgreSQL 15, PostgREST | [`supabase/migrations/`](file:///d:/sample-projects/bruno/supabase/migrations/) | Relational core + extension tables, Row-Level Security (`auth.uid()`), atomic RPCs. |
| **Auxiliary Backend** | Python 3.14, FastAPI, Render | [`api/src/personal_memory_api/`](file:///d:/sample-projects/bruno/api/src/personal_memory_api/) | Render-hosted microservice for health monitoring, auxiliary tasks, and Gemini AI hooks. |
| **Test Suites** | Vitest, Testing Library, pytest | [`web/src/test/`](file:///d:/sample-projects/bruno/web/src/test/), [`api/tests/`](file:///d:/sample-projects/bruno/api/tests/) | 210 frontend test cases + 8 backend test cases covering isolation, UX, and offline sync. |
