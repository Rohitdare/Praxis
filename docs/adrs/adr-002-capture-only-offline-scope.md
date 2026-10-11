# ADR-002: Capture-Only Offline Scope with Online Edit Guards

## Status
Accepted

## Context
- **Problem**: Full offline multi-master replication with arbitrary concurrent edits across multiple devices introduces CRDT complexity, merge conflicts, and data loss hazards. How should offline capability be scoped in Praxis?
- **Constraints**: Principle AP-01 (Capture reliability is paramount); AP-03 (Offline-first capture); AP-04 (Simplicity).

## Options Considered

| Option | Pros | Cons | Complexity | When Valid |
|--------|------|------|------------|------------|
| **Option A: Full Offline Read/Write/Edit with CRDTs (Yjs/Automerge)** | Every edit anywhere works offline | Massive complexity, bundle bloat, merge conflict edge cases, non-deterministic state | Very High | Real-time collaborative documents |
| **Option B: Capture-Only Offline with Online Edit Guards** | Zero capture loss, simple queue drain, zero merge conflict bugs, cached read offline | Editing and classification require active connection | Low | Personal capture & productivity apps |
| **Option C: Online-Only (No offline support)** | Simplest implementation | Fails top principle (AP-01): captures fail when network drops | Very Low | Traditional web apps |

## Decision
**Chosen**: Option B — Capture-Only Offline Scope.
- **Capture**: Works 100% offline, immediately writing to IndexedDB (Dexie) and enqueuing to local outbox. When online, the sync engine drains outbox to Supabase.
- **Cached Reading**: Users can read previously cached items, notes, and calendar events while offline.
- **Editing & Classification**: Strictly online-only. If offline, the UI shows a clear banner and disables save buttons to avoid multi-device conflict divergence.

## Rationale
1. **User Trust**: Capture must never drop a user's thought or snippet.
2. **Conflict Prevention**: 95% of conflicts in note-taking apps stem from editing existing content offline across two unsynced devices. Freezing edits to online sessions eliminates this entire class of distributed system failure.
3. **Simplicity**: No complex vector clocks or CRDT trees needed.

## Trade-offs Accepted
- Users cannot re-classify or modify notes/events on an airplane unless connected.
- UI must detect offline status and display actionable banners explaining connection requirement.

## Consequences
- **Positive**: Bulletproof capture reliability; zero data clobbering; ultra-lean client bundle.
- **Negative**: Temporary read-only lock on edits during network outages.
- **Mitigation**: Dedicated offline banners inform users that cached items are visible and edits will unlock once reconnected.

## Revisit Trigger
- If user feedback overwhelmingly requests full offline editing and team capacity allows CRDT adoption.
