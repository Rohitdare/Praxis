# Personal Memory App --- Cross-Document Review

**Status:** Draft for implementation\
**Version:** 1.0\
**Date:** 2026-10-08\
**Purpose:** Check that the PRD, design, architecture, and tech stack
use the same terminology and cover the same requirements. This review
also records volatile third-party items that must be rechecked before
deployment.

**Top principle:**\
\> **The application must remain useful when AI, the backend, and the
internet are unavailable. AI enhances captured data; it does not own the
capture workflow.**

## 1. Requirement coverage

  ----------------------------------------------------------------------------
  Requirement       Design            Architecture           Test
  ----------------- ----------------- ---------------------- -----------------
  FR-01 Universal   SCR-02            React + Dexie          Playwright
  capture                                                    offline

  FR-02 Quick       SCR-02            IndexedDB-first        latency test
  confirmation                                               

  FR-03 Immutable   SCR-04            `raw_input`            DB integration
  raw input                                                  

  FR-06 Inbox       SCR-03            `items`                E2E

  FR-09 Resources   SCR-06            `resources` + FastAPI  integration

  FR-12 Notes       SCR-07            `items` content        E2E

  FR-14 Tasks       SCR-08            `tasks`                E2E

  FR-16 Calendar    SCR-09            `calendar_events`      E2E

  FR-18 FTS         SCR-05            PostgreSQL FTS         search golden set

  FR-21             SCR-11 later      `item_relationships`   DB tests
  Relationships                                              

  FR-24 AI provider SCR-04/10         `AIProvider`           contract tests

  FR-27 AI data     SCR-10            AI gateway             privacy tests
  policy                                                     

  FR-30 Export      SCR-10            export service/query   restore/import
                                                             test

  FR-33 Auth        SCR-01            Supabase Auth + RLS    User A/B
                                                             isolation
  ----------------------------------------------------------------------------

## 2. Terminology review

Canonical terms: - **Capture** = raw user submission. - **Item** =
common persisted entity. - **Inbox** = unprocessed/new item view. -
**Resource** = item with URL-specific extension. - **Note** =
lightweight text item. - **Task** = actionable item with optional due
date. - **Event** = calendar item. - **AI suggestion** = advisory output
not yet accepted. - **Relationship** = explicit item-to-item link. -
**Graph** = visualization of relationships. - **AIProvider** =
provider-independent AI boundary.

No conflicting table or endpoint names were identified.

## 3. Decisions reviewed

  Decision                     Review
  ---------------------------- ------------------------------------------
  Direct Supabase access       Keep
  Capture-only offline scope   Keep
  UUIDv4                       Keep
  UTC timestamps               Keep
  Server `updated_at`          Keep
  Compound cursor              Keep; overlap should remain configurable
  Soft deletes                 Keep
  Immutable raw input          Keep
  AI advisory                  Keep
  Four-level AI policy         Keep; critical for privacy
  Extension tables             Keep
  Markdown notes               Keep
  User-created relationships   Keep
  Encrypted backup             Keep
  Free-tier stack              Keep with VERIFY markers

## 4. Items to verify before development/deployment

### VERIFY-01 --- Vercel Hobby

Official pricing currently lists Hobby at \$0 and describes it as
intended for personal/non-commercial use. Confirm this remains
appropriate before any public/commercial release.\
https://vercel.com/pricing\
https://vercel.com/legal/terms

### VERIFY-02 --- Supabase Free

Current official billing documentation lists 500 MB database size, 1 GB
storage, 50,000 MAU and 5 GB egress on Free. Recheck before production
because quotas/terms can change.\
https://supabase.com/docs/guides/platform/billing-on-supabase

### VERIFY-03 --- Render Free

Recheck the exact current Free Web Service compute, sleeping/cold-start,
outbound networking, build/runtime, and usage terms immediately before
deployment. Do not encode numerical limits into application behavior.\
https://render.com/docs/free

### VERIFY-04 --- Gemini Free Tier

The current Gemini pricing documentation lists free-tier availability
for multiple models and states that free-tier content may be used to
improve Google's products. Recheck the current data-use terms before
enabling any Level 2 personal content.\
https://ai.google.dev/gemini-api/docs/pricing

### VERIFY-05 --- Web Share Target

The Web Share Target manifest feature has limited browser availability.
Test installed PWA behavior on actual Android and iOS devices before
treating it as a core capture path.\
https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target

### VERIFY-06 --- GitHub Actions

Public repositories receive free standard GitHub-hosted runner usage;
private repositories have plan-dependent included quotas. Recheck the
account/repository situation before relying on nightly backup
workflows.\
https://docs.github.com/en/actions/concepts/billing-and-usage

## 5. Consolidated assumptions

1.  First release is for one primary user but uses multi-user-safe RLS.
2.  Offline scope is capture-only.
3.  Supabase is the durable source of truth.
4.  Render is never required for capture.
5.  AI is optional and advisory.
6.  Gemini is not automatically permitted for private data.
7.  Internal calendar is sufficient for MVP.
8.  PostgreSQL is sufficient for relationship storage before Neo4j is
    considered.
9.  PWA is the mobile strategy before React Native.
10. Free-tier limits are deployment constraints, not application
    guarantees.

## 6. Three biggest risks

### RISK-01 --- Privacy mismatch with external AI

**Risk:** Free AI provider terms may allow provider-side use of
submitted content.\
**Mitigation:** Four-level policy; Level 3 never leaves the
device/server; Level 2 requires explicit per-type permission; provider
abstraction.

### RISK-02 --- Offline sync/data loss

**Risk:** Mobile connectivity changes and tab termination can cause
duplicate or lost writes.\
**Mitigation:** IndexedDB-first capture, client UUIDv4, outbox,
idempotent upsert, tombstones, compound cursor, real-device tests.

### RISK-03 --- Free-tier instability

**Risk:** Render/Supabase/Vercel/AI free terms can change or services
can sleep/pause.\
**Mitigation:** Core capture independent of backend/AI; provider
abstraction; local persistence; export; encrypted backups; VERIFY list.

## 7. Frozen decisions that are potentially risky

### FD-01 --- Capture-only offline scope

Risk: users may eventually expect offline editing.\
Reason to keep: it dramatically reduces sync conflicts and preserves the
most important use case.

### FD-02 --- Direct Supabase access

Risk: frontend data access requires rigorous RLS discipline.\
Reason to keep: RLS becomes a genuine database security boundary and
removes unnecessary CRUD endpoints.

### FD-03 --- External AI

Risk: privacy and terms vary by provider.\
Reason to keep: lightweight external inference avoids trying to run an
LLM on free application hosting. Provider abstraction and data policy
constrain the risk.

## 8. Final readiness checklist

-   [ ] Read and accept all frozen decisions.
-   [ ] Create `dev` and `prod` Supabase projects.
-   [ ] Create migration 0001.
-   [ ] Enable RLS on every user-owned table.
-   [ ] Add cross-user RLS tests.
-   [ ] Scaffold Vite/React/PWA.
-   [ ] Scaffold FastAPI without making it part of capture.
-   [ ] Add CI.
-   [ ] Add JSON export.
-   [ ] Document AI privacy policy.
-   [ ] Set a hard rule that no secret key reaches the browser.
-   [ ] Verify current provider terms/quotas.
-   [ ] Set a hard monthly cost ceiling before enabling paid services.
