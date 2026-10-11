# ADR-006: Immutable `raw_input` for Audit Provenance and AI Reprocessing

## Status
Accepted

## Context
- **Problem**: When users capture raw snippets, URLs, or quick thoughts, subsequent title editing, cleanup, or AI enrichment should never destroy the original text. How should original captured text be preserved?
- **Constraints**: Principle AP-06 (Replaceable AI); Principle AP-01 (Capture reliability); auditability and trust.

## Options Considered

| Option | Pros | Cons | Complexity | When Valid |
|--------|------|------|------------|------------|
| **Option A: Mutable Input (Overwritten on Edit)** | Single field to store text | Loses original provenance; re-running AI on improved models impossible; accidental truncation irreversible | Low | Ephemeral scrapers |
| **Option B: Immutable `raw_input` + Separate Editable Fields (`title`, `content`)** | Original capture is never lost; transparent provenance; AI can be re-run with improved models anytime | Extra database column | Low | Audit-grade personal memory apps |
| **Option C: Full Event-Sourced Delta History** | Every keystroke recorded | Massive storage, high query complexity, over-engineering for simple note editing | High | Legal compliance / financial ledgers |

## Decision
**Chosen**: Option B — Immutable `raw_input`.
The `raw_input` column on the `items` table is written once upon capture and NEVER updated by subsequent edits, classifications, or AI jobs.
- The UI renders `raw_input` inside a dedicated, read-only "Original Capture (Immutable — ADR-06)" card with a quick copy button.
- User modifications apply strictly to `title`, `content`, or extension tables (`tasks`, `resources`, `calendar_events`).

## Rationale
1. **Model Evolution (AP-06)**: As AI models improve over the years, Praxis can re-analyze original raw inputs without contamination from human summaries or old hallucinations.
2. **User Peace of Mind**: Users never fear losing the exact verbatim context or URL they originally captured.
3. **Simplicity over Event Sourcing**: Provides 99% of provenance benefits without event-sourcing complexity.

## Trade-offs Accepted
- Database stores both `raw_input` and editable `content` (approx. 20-50% redundant text storage for text-only notes).

## Consequences
- **Positive**: Guaranteed provenance; verifiable AI input; tamper-free audit log.
- **Negative**: User cannot edit the original raw capture text (by design).
- **Mitigation**: Clear UI explanation that editing applies to title/notes while the original snippet remains locked as history.

## Revisit Trigger
- If storage budget constraints require optional raw input pruning after user explicit confirmation.
