# ADR-001: Direct Supabase Client Data Access with PostgreSQL Row Level Security

## Status
Accepted

## Context
- **Problem**: How should client applications (web/PWA) access and manipulate user data while guaranteeing multi-tenant isolation, minimal server maintenance, and near-instant interaction?
- **Constraints**: Low/free operational budget (AP-05), zero server DevOps overhead for basic CRUD, strict multi-tenant privacy (AP-02), and fast time-to-market.

## Options Considered

| Option | Pros | Cons | Complexity | When Valid |
|--------|------|------|------------|------------|
| **Option A: Custom API Backend (Node/FastAPI CRUD Gateway)** | Full control over queries, hides database schema | Requires hosting, scaling, maintaining API endpoints for all operations, latency overhead | High | Enterprise multi-tier governance |
| **Option B: Direct Supabase Client + Postgres RLS** | Zero middleware overhead, database-enforced security, real-time sync capabilities, fast queries | Client interacts with DB schema directly; requires disciplined RLS policies | Low | Single/multi-tenant SaaS, local-first apps |
| **Option C: Firebase Firestore** | Managed auth + DB | Vendor lock-in, weak relational semantics, costly full-text search and complex joins | Low | Simple document-only apps |

## Decision
**Chosen**: Option B — Direct Supabase Client + PostgreSQL Row Level Security (RLS).
The web application communicates directly with Supabase via `@supabase/supabase-js`, with every table secured by `auth.uid() = user_id` policies.

## Rationale
1. **Security at the Data Layer**: PostgreSQL RLS guarantees that queries cannot leak data across users, regardless of client bugs or rogue queries.
2. **Operational Simplicity**: Eliminates the burden of writing, testing, and maintaining boilerplate CRUD endpoints in a middle-tier service.
3. **Budget**: Fits cleanly inside Supabase's generous free tier while supporting standard PostgreSQL tooling and extensions.

## Trade-offs Accepted
- Database schema and foreign keys are exposed directly to client code.
- Custom logic (like multi-table transactions) requires database RPC stored procedures (`SECURITY DEFINER`) rather than middle-tier application handlers.

## Consequences
- **Positive**: Blazing fast reads/writes, zero backend server costs for standard CRUD, battle-tested GoTrue authentication.
- **Negative**: Complex business transactions require SQL PL/pgSQL migrations.
- **Mitigation**: Critical multi-table updates use atomic stored procedures (e.g. `classify_and_update_item`).

## Revisit Trigger
- If database queries require proprietary proprietary compliance gateways or non-Postgres storage backends.
