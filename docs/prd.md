# Personal Memory App --- Product Requirements Document

**Status:** Draft for implementation\
**Version:** 1.0\
**Date:** 2026-10-08\
**Purpose:** Define the product requirements for a private personal
capture and knowledge tool. This document is the source for UX,
architecture, implementation phases, and acceptance testing.

**Top principle:**\
\> **The application must remain useful when AI, the backend, and the
internet are unavailable. AI enhances captured data; it does not own the
capture workflow.**

## 1. Problem and opportunity

The user repeatedly discovers useful links, UI libraries, GitHub
repositories, ideas, tasks, and other information, but these captures
become scattered across notes, bookmarks, saved items, and temporary
places. The core failure is not lack of storage; it is **capture
friction followed by poor recall**.

The product therefore optimizes for one behavior: **capture immediately,
organize later, retrieve reliably**.

## 2. Goals and non-goals

  -----------------------------------------------------------------------
  ID                      Goal                    Measure
  ----------------------- ----------------------- -----------------------
  G-01                    Capture without network 100% of capture tests
                                                  succeed in airplane
                                                  mode

  G-02                    Make capture fast       Local save confirmation
                                                  target \<300 ms after
                                                  user submission on a
                                                  normal device

  G-03                    Prevent                 Lost captures = 0;
                          loss/duplication        duplicate captures from
                                                  retry = 0 in test suite

  G-04                    Make old resources      Search success \>=90%
                          findable                on a maintained golden
                                                  test set

  G-05                    Keep AI optional        Full
                                                  capture/inbox/search
                                                  flow remains usable
                                                  with AI disabled

  G-06                    Protect private data    Cross-user RLS tests
                                                  cannot read/write
                                                  another user's rows
  -----------------------------------------------------------------------

**Non-goals for MVP:** collaboration, public sharing, team workspaces,
on-device LLM, full Notion block editor, external calendar sync, email
integration, Slack integration, billing, public knowledge graph, Neo4j,
complex project management, habit tracking.

## 3. User and scenarios

**Persona P-01:** Technically comfortable solo builder using Android and
desktop, potentially iPhone, who frequently captures development
resources and ideas.

  -----------------------------------------------------------------------
  ID                      Scenario                Expected result
  ----------------------- ----------------------- -----------------------
  SC-01                   Paste a GitHub URL on   Item is saved locally
                          desktop                 and appears in Inbox

  SC-02                   Paste a UI library URL  Capture is saved
                          on Android while        locally and queued for
                          offline                 sync

  SC-03                   Type an idea            Item is saved as
                                                  unclassified/inbox; AI
                                                  may later suggest
                                                  Idea + 1-2 tags

  SC-04                   Type a task with a date Task is captured;
                                                  deterministic date
                                                  parsing suggests due
                                                  date

  SC-05                   Type an event           Event is captured with
                                                  date/time suggestion

  SC-06                   Search for a component  FTS returns matching
                          library saved months    resource
                          ago                     

  SC-07                   Reject an AI suggestion Raw input remains
                                                  unchanged and advisory
                                                  AI fields are not
                                                  applied

  SC-08                   Render/AI is            Capture, local inbox,
                          unavailable             and previously synced
                                                  data remain usable

  SC-09                   Share a URL from        PWA receives the shared
                          Android Chrome          URL where platform
                                                  support permits

  SC-10                   Sign in on a second     Server data bootstraps
                          device                  locally without
                                                  duplicates
  -----------------------------------------------------------------------

## 4. Core loop

1.  **Capture --- target \<10 seconds:** enter a URL or natural language
    into the persistent CaptureBar.
2.  **Save --- target \<300 ms locally:** write append-only capture to
    IndexedDB and show Saved.
3.  **Inbox:** item remains unprocessed until the user or optional AI
    organizes it.
4.  **Organize:** assign type, tags, status; edit only while online in
    v1.
5.  **Find:** use FTS, filters, and later semantic search.
6.  **Act:** complete tasks, review resources, open notes/events.
7.  **Connect:** later create explicit relationships and explore the
    graph.

## 5. Functional requirements

### Capture

**FR-01 --- Universal capture \[Must, Phase 1\]**\
Accept arbitrary text and URLs.\
**Given** the app is open, **when** the user submits text or a URL,
**then** a local item is created without requiring a network.

**FR-02 --- Quick confirmation \[Must, Phase 1\]**\
**Given** a valid capture, **when** local persistence succeeds, **then**
the UI shows Saved immediately.

**FR-03 --- Immutable raw input \[Must, Phase 1\]**\
**Given** an item exists, **when** classification/editing occurs,
**then** `raw_input` remains unchanged.

**FR-04 --- Deterministic URL detection \[Must, Phase 2\]**\
Recognize HTTP/HTTPS URLs without AI.

**FR-05 --- Deterministic date parsing \[Should, Phase 2\]**\
Recognize common dates/times using the profile timezone; the parser, not
the LLM, owns datetime computation.

### Inbox / triage

**FR-06 --- Inbox \[Must, Phase 1\]**\
Show newly captured items in reverse capture order.

**FR-07 --- Triage \[Must, Phase 3\]**\
Allow type, tags, status, archive, and deletion while online.

**FR-08 --- Soft delete \[Must, Phase 1\]**\
Deleted items remain as tombstones for synchronization.

### Resources

**FR-09 --- Resource record \[Must, Phase 4\]**\
Store URL, domain, title, description/image when safely fetched.

**FR-10 --- Async metadata \[Must, Phase 4\]**\
Metadata enrichment must never block capture.

**FR-11 --- Resource status \[Should, Phase 6\]**\
Support unread/reading/completed without adding a heavy workflow.

### Notes

**FR-12 --- Lightweight notes \[Must, Phase 6\]**\
Support plain/Markdown text, headings, lists, checkboxes, links, and
code blocks.

**FR-13 --- No block editor MVP \[Must, Phase 6\]**\
Do not introduce block-level Notion architecture.

### Tasks

**FR-14 --- Simple tasks \[Must, Phase 6\]**\
Tasks have title, optional content, status, and optional due date.

**FR-15 --- Completion \[Must, Phase 6\]**\
Completing a task changes status to done.

### Calendar

**FR-16 --- Internal events \[Must, Phase 6\]**\
Events have title, start/end, all-day flag, and optional content.

**FR-17 --- Natural-language event capture \[Should, Phase 6\]**\
Capture text can suggest event details; deterministic parsing owns
datetime interpretation.

### Search

**FR-18 --- Server FTS \[Must, Phase 3\]**\
Search title/content/raw input with PostgreSQL full-text search.

**FR-19 --- Offline search \[Should, Phase 3\]**\
Search the locally cached item set without network.

**FR-20 --- Semantic search \[Could, Phase 8\]**\
Add embeddings only after FTS proves insufficient.

### Relationships / graph

**FR-21 --- Explicit relationships \[Should, Phase 7\]**\
User can link items with a relationship type.

**FR-22 --- AI relationship suggestions \[Could, Phase 8\]**\
AI may suggest links but cannot create them automatically.

**FR-23 --- Graph visualization \[Could, Phase 8\]**\
Visualize stored relationships without making graph navigation
mandatory.

### AI

**FR-24 --- Provider abstraction \[Must, Phase 5\]**\
AI calls go through `AIProvider`.

**FR-25 --- Advisory classification \[Must, Phase 5\]**\
AI may suggest type, title, and 1-2 tags.

**FR-26 --- AI never blocks capture \[Must, Phase 5\]**\
AI outage/quota exhaustion leaves capture functional.

**FR-27 --- Four-level data policy \[Must, Phase 5\]**\
Level 0 no AI; Level 1 public URLs/public metadata; Level 2 personal
ideas/tasks with explicit opt-in; Level 3 sensitive notes never sent
externally.

**FR-28 --- User acceptance \[Must, Phase 5\]**\
AI suggestions require one-tap accept/dismiss.

### Settings/privacy

**FR-29 --- AI controls \[Must, Phase 5\]**\
User can enable/disable AI globally and per type.

**FR-30 --- Auth isolation \[Must, Phase 1\]**\
RLS prevents cross-user access.

### Export/backup

**FR-31 --- JSON export \[Must, Phase 1\]**\
Export all user data in a portable JSON format.

**FR-32 --- Encrypted backup \[Should, Phase 3+\]**\
Backups are encrypted before leaving the database environment.

### Auth

**FR-33 --- Authentication [Must, Phase 1]**\
Use Supabase Auth with two methods only: Email and password, and Google OAuth. Magic-link authentication is removed completely to avoid email rate limits and deliverability friction while ensuring hardened security.

## 6. Non-functional requirements

  -------------------------------------------------------------------------
  ID                      Requirement             Target
  ----------------------- ----------------------- -------------------------
  NFR-01                  Privacy                 RLS on every user-owned
                                                  table; no secret keys in
                                                  browser

  NFR-02                  Offline capture         Works in airplane mode

  NFR-03                  Reliability             Zero lost captures in
                                                  test scenarios

  NFR-04                  Idempotency             Retry cannot duplicate an
                                                  item

  NFR-05                  Local latency           Save confirmation target
                                                  \<300 ms

  NFR-06                  Accessibility           WCAG 2.2 AA target

  NFR-07                  Responsive              Android, iOS Safari,
                                                  desktop
                                                  Chromium/Firefox/Safari

  NFR-08                  PWA                     Installable where
                                                  platform supports PWA
                                                  installation

  NFR-09                  Cost                    MVP uses free-tier
                                                  infrastructure; volatile
                                                  limits marked VERIFY

  NFR-10                  Portability             Full JSON export

  NFR-11                  Observability           Client errors tracked;
                                                  content not logged

  NFR-12                  Security                SSRF-hardened URL fetcher
                                                  and rate-limited FastAPI
  -------------------------------------------------------------------------

## 7. AI behavior and data policy

  Level     Data                         External AI
  --------- ---------------------------- --------------------------
  Level 0   Any capture                  Never
  Level 1   Public URL/public metadata   Allowed when enabled
  Level 2   Personal idea/task           Explicit per-type opt-in
  Level 3   Sensitive note               Never

AI output is advisory and stored separately from raw input. The AI
receives only the minimum required content. Free-tier provider data-use
terms must be verified before private content is sent.

## 8. MVP phases

  -----------------------------------------------------------------------
  Phase                   Scope                   Exit criteria
  ----------------------- ----------------------- -----------------------
  0                       Decisions, migrations,  Fresh DB migration + CI
                          CI                      green

  1                       Auth + Capture + local  Real daily use for
                          DB                      several days

  2                       Sync + Supabase         Offline captures sync
                                                  exactly once

  3                       Inbox + FTS + local     Search golden set
                          search                  succeeds

  4                       URL metadata            SSRF suite passes; app
                                                  works if Render sleeps

  5                       AI enrichment           AI-off mode fully
                                                  works; privacy controls
                                                  pass

  6                       Notes + tasks +         Daily workflow is
                          calendar                usable without manual
                                                  workarounds

  7                       Relationships           Explicit links work
                                                  reliably

  8                       Graph + semantic search Added only after real
                                                  usage identifies the
                                                  need
  -----------------------------------------------------------------------

**Phase gate:** do not start the next phase until the current phase has
been used for real for a few days.

## 9. Success metrics

**Leading:** captures/day, median local save time, inbox-zero frequency,
search success rate, percentage of captures requiring correction.

**Guardrails:** lost items = 0; duplicate items = 0; cross-user data
access = 0; AI privacy-policy violations = 0.

## 10. Risks and dependencies

  -----------------------------------------------------------------------
  Risk                                Mitigation
  ----------------------------------- -----------------------------------
  Free-tier limits change             Provider abstraction; VERIFY each
                                      phase

  Render cold start                   Core capture never depends on
                                      FastAPI

  Supabase pause                      Local-first capture + server as
                                      source of truth

  External AI privacy                 Four-level policy; notes off by
                                      default

  SSRF                                DNS/IP pinning, redirect
                                      validation, private-range blocking

  Sync conflict                       Append-only offline scope +
                                      compound cursor + idempotent upsert

  Scope creep                         Phase gates and deferred list
  -----------------------------------------------------------------------

## 11. Traceability

  Requirement group   Phase   Test
  ------------------- ------- ---------------------------
  FR-01..05           1-2     Playwright + unit
  FR-06..11           3-4     API/RLS + E2E
  FR-12..17           6       E2E
  FR-18..20           3/8     Search integration
  FR-21..23           7/8     DB + visual E2E
  FR-24..30           5       Golden AI + privacy tests
  FR-31..33           1-3     Integration/security

## Assumptions

-   **ASSUMPTION A-01:** The first release is single-person in practice
    but multi-user-safe in schema.
-   **ASSUMPTION A-02:** Email/password and Google OAuth authentication are
    the two supported methods; magic link is removed.
-   **ASSUMPTION A-03:** Calendar remains internal; no external calendar
    sync is required in MVP.
-   **ASSUMPTION A-04:** Offline editing is intentionally excluded from
    v1.

## Open questions

-   Exact authentication method can be selected during Phase 1
    implementation.
-   Exact calendar UI can be selected during Phase 6.

## Objections

None to frozen product decisions.
