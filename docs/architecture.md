# Personal Memory App --- Architecture

**Status:** Draft for implementation\
**Version:** 1.0\
**Date:** 2026-10-08\
**Purpose:** Define the runtime architecture, data model, security
boundaries, offline synchronization, AI subsystem, and deployment model.
The architecture prioritizes reliable capture and privacy over backend
sophistication.

**Top principle:**\
\> **The application must remain useful when AI, the backend, and the
internet are unavailable. AI enhances captured data; it does not own the
capture workflow.**

## 1. Architectural principles

    Rank ID      Principle
  ------ ------- ----------------------------
       1 AP-01   Capture reliability
       2 AP-02   Privacy and user isolation
       3 AP-03   Offline-first capture
       4 AP-04   Simplicity
       5 AP-05   Low/free operational cost
       6 AP-06   Replaceable AI
       7 AP-07   Incremental evolution

## 2. System context

``` mermaid
flowchart LR
U[User] --> W[Web/PWA]
W --> L[(IndexedDB/Dexie)]
W -->|JWT + publishable key| S[(Supabase)]
W -->|only when needed| F[FastAPI]
F --> A[AI Provider]
F --> X[SSRF-hardened URL Fetcher]
S --> W
```

Trust boundaries:

``` text
[Device]
  Browser/PWA
  IndexedDB
       |
       | HTTPS + JWT
       v
[Supabase]
  Auth / Postgres / RLS

[Server boundary]
  FastAPI
       |
       +--> External AI
       +--> Public web URLs
```

## 3. Container architecture

``` mermaid
flowchart TB
subgraph Device["User Device"]
  UI["React + Vite PWA"]
  DB["Dexie / IndexedDB"]
  UI <--> DB
end

subgraph Supabase["Supabase"]
  AUTH["Auth"]
  PG["PostgreSQL + RLS"]
  STORE["Storage"]
  AUTH --> PG
end

subgraph Render["FastAPI on Render"]
  API["URL Metadata / AI Gateway"]
  FETCH["SSRF-Hardened Fetcher"]
  AIP["AIProvider"]
  API --> FETCH
  API --> AIP
end

UI -->|direct data access| AUTH
UI -->|direct CRUD with JWT| PG
UI -->|authenticated specialized requests| API
AIP --> EXT["External AI"]
```

## 4. Component responsibilities

  Component       Owns                         Must never do
  --------------- ---------------------------- -----------------------------------
  React app       UI and interaction           Store service secrets
  Dexie           Local capture/outbox         Become permanent source of truth
  Supabase Auth   Identity/session             Expose secret keys
  Postgres/RLS    Durable user data            Trust browser-supplied user_id
  FastAPI         URL/AI specialized work      Become mandatory for capture
  URL Fetcher     Safe public metadata fetch   Access private networks
  AIProvider      Model abstraction            Persist raw secrets unnecessarily
  Sync engine     Push/pull                    Drop items on 401
  Search          FTS/local search             Require AI

## 5. Failure-mode matrix

  --------------------------------------------------------------------------------
  Failure              Capture        Local data     Synced data    AI
  -------------------- -------------- -------------- -------------- --------------
  Device offline       Works          Works          Read cached    Deferred
                                                     subset         

  Render asleep        Works          Works          Direct         Deferred
                                                     Supabase still 
                                                     works          

  FastAPI down         Works          Works          Direct CRUD    Unavailable
                                                     works          

  AI quota exhausted   Works          Works          Works          Falls back to
                                                                    unclassified

  Supabase             Works          Works          Deferred       Deferred
  paused/unavailable                                                

  Token expired        Works locally  Preserved in   Retry after    Deferred
                                      outbox         refresh        
  --------------------------------------------------------------------------------

## 6. Data model

### TBL-profiles

``` sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  ai_enabled boolean not null default false,
  ai_public_resources boolean not null default true,
  ai_personal_types boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### TBL-items

``` sql
create table items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id),
  type text not null default 'unclassified'
    check (type in ('unclassified','resource','note','task','event','idea')),
  status text not null default 'inbox'
    check (status in ('inbox','active','done','archived')),
  raw_input text not null,
  title text,
  content text,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  ai_type text,
  ai_tags text[],
  ai_confidence real,
  ai_model text,
  fts tsvector generated always as (
    to_tsvector('english',
      coalesce(title,'') || ' ' ||
      coalesce(content,'') || ' ' ||
      raw_input)
  ) stored
);
```

### TBL-resources

``` sql
create table resources (
  item_id uuid primary key references items(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  url text not null,
  domain text,
  fetched_title text,
  description text,
  image_url text,
  resource_status text not null default 'unread'
    check (resource_status in ('unread','reading','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### TBL-tasks

``` sql
create table tasks (
  item_id uuid primary key references items(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  due_at timestamptz,
  priority text not null default 'normal'
    check (priority in ('low','normal','high')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### TBL-calendar-events

``` sql
create table calendar_events (
  item_id uuid primary key references items(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### TBL-tags / item_tags / relationships

``` sql
create table tags (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  name text not null,
  unique(user_id, name)
);

create table item_tags (
  item_id uuid not null references items(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  primary key(item_id, tag_id)
);

create table item_relationships (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  source_id uuid not null references items(id) on delete cascade,
  target_id uuid not null references items(id) on delete cascade,
  relationship_type text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, source_id, target_id, relationship_type)
);
```

Every user-owned table gets `user_id`, `updated_at`, and RLS in the same
migration.

### Indexes

``` sql
create index items_user_updated_idx on items(user_id, updated_at, id);
create index items_fts_idx on items using gin(fts);
create index items_user_type_idx on items(user_id, type);
create index items_user_status_idx on items(user_id, status);
```

### Updated trigger

``` sql
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
```

Attach to all mutable tables.

### RLS

``` sql
alter table profiles enable row level security;
alter table items enable row level security;
alter table resources enable row level security;
alter table tasks enable row level security;
alter table calendar_events enable row level security;
alter table tags enable row level security;
alter table item_tags enable row level security;
alter table item_relationships enable row level security;

-- Repeat the following ownership policy for each table:
create policy own_items on items
for all
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
```

The actual migration must create a distinct policy for each table.

## 7. Offline and sync

### Local schema

``` text
local_items
outbox
sync_meta
```

Outbox states:

``` text
pending -> syncing -> synced
                                         -> failed -> pending
```

### Push

1.  Save capture to IndexedDB.
2.  Add outbox record.
3.  Attempt Supabase upsert when authenticated.
4.  Use `on conflict (id)` for idempotency.
5.  Mark synced only after server success.
6.  On 401, retain the item and wait for token refresh.
7.  Retry with exponential backoff.

### Pull

Use a compound cursor:

``` text
(updated_at, id)
```

Query:

``` sql
where
  updated_at > :updated_at
  or (updated_at = :updated_at and id > :id)
order by updated_at asc, id asc
limit :page_size;
```

The frozen plan includes a small overlap window for out-of-order
commits; if implemented, the client must still deduplicate by ID. The
compound cursor is the authoritative ordering mechanism.

### Tombstones

Never physically delete a synced item during normal user deletion. Set
`deleted_at` and synchronize the tombstone.

### Multi-device

Server is the source of truth. Captures are append-only in offline mode.
Online edits use server `updated_at` and last-write-wins for v1.

### Sync tests

  Scenario               Expected
  ---------------------- -----------------------
  3 offline captures     Exactly 3 server rows
  Retry same request     No duplicate
  Kill tab during sync   Later retry completes
  Token expires          Item remains queued
  Two devices capture    Both survive
  Soft delete offline    Tombstone syncs
  Render down            Capture still works

## 8. FastAPI API

  -----------------------------------------------------------------------
  Endpoint                Auth                    Purpose
  ----------------------- ----------------------- -----------------------
  POST                    Supabase JWT            Fetch safe public
  `/resources/preview`                            metadata

  POST `/ai/classify`     Supabase JWT            Advisory
                                                  type/title/tags

  POST `/embeddings`      Supabase JWT            Later semantic search
  -----------------------------------------------------------------------

All endpoints require: - JWT verification - request schema validation -
per-user rate limiting - strict CORS - bounded request body - structured
errors - timeout - no content logging

## 9. AI subsystem

``` text
interface AIProvider:
  classify(input, context) -> ClassificationSuggestion
```

First implementation:

``` text
AIProvider
└── GeminiProvider
```

Future implementations may include compatible providers or local
inference.

Deterministic-first: 1. URL detection 2. Date parsing 3. AI
classification only if enabled and needed

LLM responsibility: - suggest type - suggest title - suggest 1-2 tags

LLM must not: - own datetime calculations - block capture - modify raw
input - create relationships automatically - receive sensitive notes
under Level 3

Validate model output with Pydantic. Failure returns `unclassified`; no
infinite retry.

Fetched web content is untrusted input. Treat it as data, not
instructions. Do not give the model tools.

## 10. Security architecture

### Key placement

Browser: - Supabase publishable key - user JWT/session

Server only: - AI API key - Supabase secret/service credential if ever
required

Never log: - raw note content - access tokens - AI keys - full URLs
containing secrets/query tokens

### SSRF requirements

The URL fetcher must: 1. Resolve DNS itself. 2. Validate the resolved
IP. 3. Connect to the validated IP. 4. Revalidate every redirect. 5. Cap
redirects at about 3. 6. Block loopback, private, link-local,
IPv4-mapped IPv6, and cloud metadata ranges such as `169.254.169.254`.
7. Allow only ports 80/443. 8. Enforce timeout. 9. Enforce maximum
response size. 10. Validate content type. 11. Return a safe domain
fallback when blocked.

### Threat table

  Threat                Mitigation                         Test
  --------------------- ---------------------------------- --------------------
  Cross-user access     RLS + JWT identity                 User A/B isolation
  Secret key exposure   Server env only                    Secret scan
  SSRF                  DNS/IP validation                  Private IP suite
  XSS                   Escape/render sanitized Markdown   Payload suite
  Prompt injection      Treat fetched text as untrusted    Golden tests
  AI data leak          Four-level policy                  Policy tests
  Replay                Idempotent IDs                     Retry tests
  Rate abuse            Per-user limits                    Load test

## 11. Search

Phase 3: - PostgreSQL FTS on title/content/raw input. - Client-side
MiniSearch or equivalent over local cache for offline search.

Phase 8: - pgvector only if real usage shows FTS insufficient. -
Embeddings should be asynchronous and privacy-controlled.

## 12. Deployment

``` text
GitHub
  |
  +--> Vercel: React/PWA
  |
  +--> Render: FastAPI
  |
  +--> Supabase: dev/prod databases
```

Migration workflow:

``` text
local migration
 -> review
 -> dev Supabase
 -> tests/RLS
 -> prod migration
```

Generate TypeScript database types from Supabase. Generate API
client/types from FastAPI OpenAPI. Do not hand-maintain shared types.

## 13. Backup, recovery, observability

-   JSON export is available early.
-   Backups are encrypted before leaving the database environment.
-   Restore drills must be performed against a scratch project.
-   Frontend error tracking is enabled without raw content.
-   Backend structured logs exclude user content.
-   Metrics: capture success, sync failures, AI failures, metadata
    failures, API latency.

## 14. Architecture Decision Records (ADRs)

Detailed records with trade-off analysis, accepted consequences, and revisit triggers are maintained in [`docs/adrs/`](./adrs/README.md).
An interactive visual architecture diagram is available at [`.archify/architecture-praxis/praxis-architecture.html`](../.archify/architecture-praxis/praxis-architecture.html).

  -----------------------------------------------------------------------
  ADR                     Decision                Consequence
  ----------------------- ----------------------- -----------------------
  [ADR-01](./adrs/adr-001-direct-supabase-rls.md) Direct Supabase data   RLS is primary data
                          access                  boundary

  ADR-02                  Capture-only offline    Avoids complex offline
                          scope                   edit conflicts

  ADR-03                  UUIDv4                  IDs remain opaque;
                                                  timestamps order data

  ADR-04                  Compound sync cursor    Deterministic
                                                  incremental sync

  ADR-05                  Soft deletes            Tombstones support sync

  ADR-06                  Immutable raw input     AI can be rerun safely

  ADR-07                  AI provider abstraction Provider can change
                                                  without product rewrite

  ADR-08                  Four-level AI data      Privacy controls
                          policy                  external processing

  ADR-09                  Extension tables        Stronger type/query
                                                  semantics than all-JSON
                                                  design

  ADR-10                  Encrypted backups       Backup does not become
                                                  a second plaintext data
                                                  store
  -----------------------------------------------------------------------

## 15. Evolution path

  -----------------------------------------------------------------------
  Deferred feature        Trigger                 Integration point
  ----------------------- ----------------------- -----------------------
  Zustand                 Cross-component state   UI state only
                          becomes painful         

  React Hook Form         Complex forms appear    Form layer

  Heavy calendar          Drag/drop or recurring  Calendar UI
                          events required         

  Graph visualization     Relationships become    `item_relationships`
                          useful in practice      

  pgvector                FTS search misses real  Embedding service
                          queries                 

  Block editor            Notes need structured   Note content layer
                          blocks                  

  Neo4j                   PostgreSQL graph        Relationship service
                          queries become a proven 
                          bottleneck              

  React Native            PWA fails important     Shared API/data model
                          native requirements     
  -----------------------------------------------------------------------

## Assumptions

-   **ASSUMPTION A-01:** Supabase remains the primary data plane.
-   **ASSUMPTION A-02:** Render is used only for specialized FastAPI
    workloads.
-   **ASSUMPTION A-03:** AI model selection can change without schema
    changes.
-   **ASSUMPTION A-04:** PostgreSQL is sufficient for relationship
    storage initially.

## Open questions

-   Exact rate limits per endpoint.
-   Exact backup destination and encryption key management.
-   Exact calendar UI library, if any.

## Objections

**A-OBJ-01:** The frozen "small overlap" sync window is retained for
safety, but compound `(updated_at,id)` cursor ordering should be treated
as authoritative and the overlap should be configurable rather than
hard-coded.
