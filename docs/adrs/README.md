# Praxis Architecture Decision Records (ADRs)

This directory documents key architectural decisions for Praxis (Personal Memory application) following the Architecture Decision Framework.

## Core Principle

> **"Simplicity is the ultimate sophistication."**
> Requirements drive architecture. Trade-offs inform decisions. ADRs capture rationale.
> Top priority: Reliable local-first capture and user privacy over backend complexity.

## Index of ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](adr-001-direct-supabase-rls.md) | Direct Supabase Client Data Access with PostgreSQL Row Level Security | Accepted | 2026-10-08 |
| [ADR-002](adr-002-capture-only-offline-scope.md) | Capture-Only Offline Scope with Online Edit Guards | Accepted | 2026-10-08 |
| [ADR-003](adr-003-client-generated-uuidv4.md) | Client-Generated UUIDv4 Primary Keys for Outbox and RPC Synchronization | Accepted | 2026-10-11 |
| [ADR-006](adr-006-immutable-raw-input-provenance.md) | Immutable `raw_input` for Audit Provenance and AI Reprocessing | Accepted | 2026-10-09 |
| [ADR-009](adr-009-relational-extension-tables.md) | Relational Extension Tables for Item Classification Specialization | Accepted | 2026-10-09 |

## Interactive Architecture Diagram

An interactive standalone HTML diagram of the system architecture is maintained via Archify:
- Artifact: [praxis-architecture.html](../../.archify/architecture-praxis/praxis-architecture.html)
- Source Candidate: [candidate.json](../../.archify/architecture-praxis/candidate.json)
