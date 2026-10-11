# ADR-009: Relational Extension Tables for Item Classification Specialization

## Status
Accepted

## Context
- **Problem**: Captured items in Praxis can be classified into different specialized types: Note, Task, Event, or Resource. Each type carries specialized attributes (`due_at`, `priority` for tasks; `start_at`, `end_at`, `all_day` for events; `url`, `status` for resources). How should polymorphic entity schemas be modeled in PostgreSQL?
- **Constraints**: Relational integrity, fast specialized filtering (e.g. calendar queries by date range, tasks by priority), strong TypeScript typing, future migration ease.

## Options Considered

| Option | Pros | Cons | Complexity | When Valid |
|--------|------|------|------------|------------|
| **Option A: Single Table with Polymorphic JSONB column (`metadata JSONB`)** | Schema-less, easy to add random fields | Weak indexing, no foreign key guarantees, messy migrations, difficult SQL type checking | Low | Unstructured document logs |
| **Option B: Single Wide Table (Sparse columns for all types)** | Single table queries | Null columns sprawl, cannot enforce type-specific NOT NULL constraints | Low | Few types with minimal fields |
| **Option C: Class Table Inheritance / Extension Tables (`items` + `tasks`, `calendar_events`, `resources`)** | Strict relational integrity, type-specific indexes, clean RLS cascading, strong type safety | Requires JOIN or transactional RPC for polymorphic updates | Medium | Core domain models with distinct behaviors |

## Decision
**Chosen**: Option C — Class Table Inheritance with Extension Tables.
- `items`: Central hub table with universal fields (`id`, `user_id`, `raw_input`, `title`, `content`, `type`, `status`, `captured_at`, `deleted_at`).
- `tasks`: Extension table with `item_id REFERENCES items(id) ON DELETE CASCADE`, `due_at`, `priority`, `completed_at`.
- `calendar_events`: Extension table with `item_id REFERENCES items(id) ON DELETE CASCADE`, `start_at`, `end_at`, `all_day`.
- `resources`: Extension table with `item_id REFERENCES items(id) ON DELETE CASCADE`, `url`, `resource_status`.
- Polymorphic updates are coordinated via atomic PostgreSQL RPC (`classify_and_update_item`) to guarantee transactional cleanup of stale extension rows when types switch.

## Rationale
1. **Query Performance**: Calendar views can query `calendar_events` joined with `items` using clean B-tree indexes on `(start_at, end_at)` without JSONB path extraction overhead.
2. **Data Integrity**: Foreign key constraints with `ON DELETE CASCADE` ensure no orphaned task or event records exist if an item is purged.
3. **TypeScript Alignment**: Maps directly to clean discriminated unions in TypeScript (`ItemDetailRecord`).

## Trade-offs Accepted
- Reclassifying an item across types requires deleting rows from the old extension table and inserting into the new extension table (handled atomically in SQL RPC).

## Consequences
- **Positive**: High query performance; strong relational constraints; robust type checking in both SQL and TypeScript.
- **Negative**: Polymorphic mutations require transactional RPC rather than a simple single-table UPDATE.
- **Mitigation**: Stored procedure `classify_and_update_item` encapsulates the extension lifecycle atomically.

## Revisit Trigger
- If item subtypes expand to dozens of highly dynamic or user-customizable schema variants.
