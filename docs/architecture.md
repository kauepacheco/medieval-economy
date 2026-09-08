# Proposed architecture

## M1 implementation decisions (2026-09-08)

The proposed stack is implemented with Node.js 24, Next.js 16, React 19, PostgreSQL 18, `pg` for explicit transactional SQL, Vitest, and Playwright. `pg` keeps ownership queries and lock order visible without adding an ORM to the four-entity schema. SQL migrations are checked in and serialized with a transaction-level advisory lock. The official name is Medieval Economy.

The local seed has six workers. Recipe v1 produces 5 wood bundles per worker in 30 seconds or 3 stone blocks per worker in 45 seconds. These are accelerated, provisional development values. Gathering has no inputs; jobs persist an empty input snapshot for M1. There is no currency or cancellation.

All game mutations lock a village before its job. Completion uses `SKIP LOCKED` and retries in subsequent polling passes. A unique village/request key protects starts, and a unique inventory-event job key plus atomic status transition protects deliveries. The database supplies production time; a constructor-injected clock is test-only. Idle pool errors have a sanitized handler so a disconnected client can be replaced on the next query.

The optional `embedded-postgres` development runner starts a real PostgreSQL server with disk persistence and generated ignored credentials. It was used because Docker WSL integration was unavailable. Docker Compose with a persistent volume remains an alternative. Neither path changes the authoritative PostgreSQL requirement.

The app derives a fixed local owner after validating an explicit development flag, nonproduction runtime, loopback Host, and same-origin mutation headers. Next.js's internal localhost URL normalization is allowed only at the configured port and with the exact actual Host header. This fixture cannot be enabled through `NODE_ENV=production`. Public authentication remains M4.

The original proposed architecture and later scope below are preserved for future milestones.

## Local-first implementation

Use TypeScript, Next.js, PostgreSQL, and a separate Node worker in one repository. Use npm and a lockfile. Choose compatible supported dependency versions at implementation time and record runtime requirements. Use Docker Compose for local PostgreSQL with a persistent volume. Store game logic in server/domain modules, not React components.

Suggested modules: villages, inventory, workforce, production, progression, marketplace. Add features when milestones require them; do not prebuild unused services. Use transactional database access and checked-in migrations. No Kubernetes, blockchain, message broker, or microservice fleet for the first slice.

## First persistent entities

Village, inventory balance, production job, and inventory event. Seed one development village with a finite workforce. Jobs record recipe version, committed inputs, allocated workers, start time, due time, and status. Final schema is implementation work.

Starting a job atomically validates resource availability and free workers, reserves workers, consumes any recipe inputs, and persists the job. Completing a due job atomically checks completion state, credits output, releases workers, and records the inventory event. Concurrency must not produce duplicate effects. A crashed worker must leave recoverable work. Use database-supported locking/claiming with transactional rechecks rather than assuming a queue delivers exactly once.

Job completion queries use indexed status/due-time fields. The browser renders a countdown; changing its clock does not grant rewards. Refreshing a page does not restart or reward a job. Already-due jobs complete after worker restart. No continuously simulated villagers on the server.

For initial gathering, reject requests for unavailable workers. Cancellation can remain unsupported in M1, with a clear UI rather than invented refund rules. Snapshot recipe values needed to settle existing jobs deterministically if content changes.

## Marketplace later

Listings reserve stock. Purchases atomically check remaining stock, debit buyer, credit seller and fee account, and transfer inventory. Represent test currency as integer minor units; specify fee rounding. Test concurrent buyers for the final stock and request replay. Keep account ownership checks on every private operation. Real-money settlement is a later system; a test ledger is not a payment processor.

## Public alpha gate

Replace local fixtures with real authentication, add authorization and rate limits, verify backups by restoration, test restart recovery and abuse cases, and display reset notices. No public developer login or arbitrary village-ID mutation endpoint. Load-test realistic read/write mixes and hot market listings before claiming capacity. The earlier 1,000-concurrent-player target is an unverified target, not a guarantee.
