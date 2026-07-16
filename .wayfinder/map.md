# Map — PostManagerwa Technical Specification

`wayfinder:map` | Created 2026-07-14

## Destination

A complete technical specification that makes PostManagerwa buildable by any coding agent. Produces: full database DDL (pm + wa schemas), API route contracts with request/response shapes, component tree and route structure, PostingProvider interface + implementations, campaign engine pseudocode, import pipeline spec, integration contracts, auth/RLS spec, AI spec, notification spec, and infrastructure/deployment spec. No code written — but every decision resolved so implementation is mechanical.

## Notes

- **Architecture:** Approach 6 — one Next.js app, one Supabase project, schema separation (`pm.*` and `wa.*` tables), shared auth
- **Skills:** `/grill-with-docs` for any HITL decisions, `/domain-modeling` for glossary updates
- **Context files:** `CONTEXT.md`, `AI-REFERENCE.md`, `scheduling-engine-analysis.md`, `approach-connections.md`, `architecture-approaches.md`
- **Storage:** Cloudflare R2 (`@aws-sdk/client-s3` v3, presigned URLs)
- **Database:** Supabase Postgres, RLS everywhere, `ltree` categories, JSONB snapshots, `pg_cron` + `pg_partman`
- **Scope:** Spec only. No implementation code. Decisions, not deliverables.

## Decisions so far

*None yet — map freshly charted.*

## Tickets

### Frontier (unblocked, workable now)

- [T-001](tickets/T-001.md) — Database Schema: PostManager Tables (pm.*) | `wayfinder:task`
- [T-002](tickets/T-002.md) — Database Schema: WhatsApp Tables (wa.*) | `wayfinder:task`
- [T-008](tickets/T-008.md) — WatsSender HTTP Client Specification | `wayfinder:task`
- [T-011](tickets/T-011.md) — Infrastructure & Deployment Specification | `wayfinder:task`

### Blocked (waiting on dependencies)

- [T-003](tickets/T-003.md) — PostingProvider Interface Contract | blocked by T-001, T-002
- [T-004](tickets/T-004.md) — Campaign Engine Specification | blocked by T-001, T-003
- [T-005](tickets/T-005.md) — API Route Contract: PostManager (/api/pm/*) | blocked by T-001
- [T-006](tickets/T-006.md) — API Route Contract: WhatsApp (/api/wa/*) | blocked by T-002
- [T-007](tickets/T-007.md) — Frontend Architecture & Route Specification | blocked by T-005, T-006
- [T-009](tickets/T-009.md) — Auth, RLS, and Multi-Tenancy Specification | blocked by T-001, T-002
- [T-010](tickets/T-010.md) — AI Integration Specification | blocked by T-001
- [T-012](tickets/T-012.md) — WhatsApp Automation Engine Specification (wa.*) | blocked by T-002, T-008
- [T-013](tickets/T-013.md) — Import Pipeline Specification | blocked by T-001
- [T-014](tickets/T-014.md) — Notification System Specification | blocked by T-001, T-009
- [T-015](tickets/T-015.md) — Integration & Migration Specification | blocked by T-001, T-002, T-005, T-006

### Dependency Graph

```
T-001 (pm schema) ──────┬── T-003 (PostingProvider) ─── T-004 (Campaign Engine)
                        ├── T-005 (pm API routes) ────┬── T-007 (Frontend)
                        ├── T-009 (Auth/RLS) ─────────┤
                        ├── T-010 (AI)                 ├── T-014 (Notifications)
                        ├── T-013 (Import Pipeline)    └── T-015 (Integration)
                        └── T-015 (Integration)

T-002 (wa schema) ──────┬── T-003 (PostingProvider)
                        ├── T-006 (wa API routes) ────┬── T-007 (Frontend)
                        ├── T-009 (Auth/RLS)          └── T-015 (Integration)
                        ├── T-012 (WA Engine)
                        └── T-015 (Integration)

T-008 (WatsSender) ──────── T-012 (WA Engine)

T-011 (Infrastructure) — unblocked, no dependents
```

## Not yet specified

- Exact RLS policy SQL for each table (resolved in T-009)
- Frontend route structure and page-level component breakdown (resolved in T-007)
- Error response format standardization (resolved in T-005/T-006)
- API versioning strategy (resolved in T-005/T-006)
- Rate limiting implementation details (resolved in T-005/T-006)
- Session management for WA Posters — QR pairing flow (resolved in T-005)
- Image compression pipeline — WebP conversion on upload (resolved in T-013)
- WhatsApp webhook receiver implementation — async queue choice (resolved in T-006)
- Export package generation implementation — ZIP streaming (resolved in T-003)
- Migration strategy from existing WassFlow data (resolved in T-015)
- Testing strategy and tooling
- CI/CD pipeline configuration (resolved in T-011)
- Schema handshake mechanism (pm.enqueue_dispatch function — resolved in T-015)
- WA Poster ↔ WA Instance sync mechanism (resolved in T-015)
- WassFlow data migration mapping (resolved in T-015)

## Out of scope

- Billing implementation (schema placeholder only — `organizations.plan` column)
- Stock management module (schema placeholder only — `products.stock_count` column)
- Franchise/parent-org hierarchy (schema supports it via `parent_org_id` pattern, no spec)
- Notification channel implementations beyond the interface (email, Slack, Telegram — interface only in T-014)
- Migration tools/scripts (part of implementation, not specification)
- Frontend styling/design system specification (implementation detail)
- Actual code — this map produces specifications, not implementations
