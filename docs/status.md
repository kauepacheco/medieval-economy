# Current status

## Completed

- Planning handoff prepared from the conversation.
- Owner decisions and proposed technical defaults separated.
- First implementation task and review prompt prepared.
- **M1 implemented on 2026-09-08:** a runnable local village with persistent resources, six shared workers, wood/stone assignments, server-timed jobs, and automatic deliveries.
- Official name confirmed: **Medieval Economy**. The owner authorized autonomous engineering decisions, parallel agents when useful, and code review. One backend implementation agent, a bounded UI agent, and an independent reviewer were used; no orchestration infrastructure was added to the game.
- TypeScript/Next.js browser app, original responsive CSS/SVG countryside view, PostgreSQL schema and migrations, non-destructive local seed, separate polling worker, and local-only identity guard.
- Atomic job settlement, inventory event uniqueness, retry-safe job creation, worker-allocation locking, persisted recipe snapshots, server-owned time, and database balance constraints.
- Local PostgreSQL runner with disk persistence and random ignored credentials; alternative Docker Compose configuration with persistent volume. App, database, and worker were started locally.
- README now documents actual installation, database, migration, seed, app, worker, test, build, restart, and browser exercise commands.
- Git initialized and connected to the owner's initially empty repository at `https://github.com/kauepacheco/medieval-economy`.

## Engineering decisions

- Runtime verified: Node.js 24.20.0, npm 11.19.0. Locked application packages include Next.js 16.3.4, React 19.2.8, pg 8.23.0, TypeScript 5.9.3, Vitest 5.0.0, and Playwright 1.63.0.
- `pg` chosen for explicit parameterized SQL, visible transaction boundaries and lock ordering, and minimal schema tooling. Migrations are versioned SQL files, serialized transactionally by an advisory lock.
- Provisional gathering v1: 6 workers total; 5 whole wood bundles per assigned worker after 30 seconds; 3 whole stone blocks per assigned worker after 45 seconds. More workers increase output, not speed. No recipe inputs or cancellation in M1. These accelerated values are not final balance decisions.
- Worker polls indexed persisted due jobs once per second. All mutations lock village before job; completion may skip a busy village and retry. Completion does not consult current recipes, so existing jobs settle from committed snapshots.
- Local fixture is fixed server-side, requires `LOCAL_DEV_AUTH=true`, and is rejected in production. Exact loopback Host and same-origin writes are required. Next.js internally normalizes request URLs to localhost, so that internal alias is accepted only with the configured port and exact actual Host.
- `embedded-postgres` 18.4.0-beta.17 runs actual PostgreSQL 18.4 for development/testing. It is an optional convenience, not an alternative state model. The beta label belongs to the wrapper package. Docker remains available in the configuration.

## Verification actually run

- `npm test`: **32 passed**. Real PostgreSQL tests cover exact due-time boundary, 20 simultaneous completion attempts, concurrent starts and shared capacity, duplicate starts and replays after completion, ownership isolation, forced transaction rollback, retired recipe snapshots, negative balance/allocation constraints, concurrent starts/completions, migration/seed reruns, production database time, actual PostgreSQL stop/start recovery, and idle connection termination/reconnection. Authorization tests cover forged fields, invalid workers, local origin/Host validation, disabled fixtures, and production refusal.
- `npm run test:e2e` with project-local Chromium shared libraries: **5 passed**. Real browser/app/worker/database coverage includes refresh persistence, closing/reopening browser pages, an actual worker process restart and overdue delivery, altered browser wall clock, mobile layout with no horizontal overflow, shared activity capacity, ambiguous committed-response retry, HTTP forged reward/ownership and oversized-body rejection, and loading failure recovery.
- Desktop (1440px) and mobile (390px) screenshots visually inspected. Original placeholder art is readable and the resource/workforce/job controls remain usable on both.
- `npm run typecheck`: passed, including route type generation for a clean checkout.
- `npm run lint`: passed.
- `npm run build`: optimized production build passed with both API routes and the prerendered village shell.
- `npm audit --audit-level=low`: **0 reported vulnerabilities** for the final lockfile.
- Local setup, migration, seed, and API response verified against persistent PostgreSQL. No AI API or paid service used.

## Independent review

An independent agent reviewed the domain, transactions, schema, API authorization, scripts, tests, and UI retries. Two findings were fixed:

1. An idle PostgreSQL disconnection could emit an unhandled pool error and terminate the worker. Added a sanitized listener and an actual backend-termination/reconnection regression test.
2. Recent deliveries were ordered by assignment time. They now sort by completion time before truncating the display.

Browser testing additionally caught the Next.js internal URL normalization mismatch; it was fixed and covered by unit and real HTTP checks. A final follow-up review checked the fixes and setup and found no remaining material blocker for M1.

## Known limitations and environment notes

- M1 only. No building placement/construction, production chains, expertise, trading, currency, public authentication, subscriptions, payments, crypto, map, or combat yet. No performance/capacity claim has been made.
- Local identity is intentionally unusable in production. `npm start` can serve the build shell, but game APIs return 403. Do not publish or tunnel the development fixture; M4 is the public-alpha gate.
- Closing the browser does not stop the worker. Sleeping the computer stops execution; persisted overdue work settles after processes resume.
- Docker Desktop's WSL integration is disabled in this environment. The Compose path has not been run, and Docker volume restart behavior has not been separately verified. Real PostgreSQL disk persistence and process restart were verified using the local runner.
- Chromium initially lacked Linux libraries. Normal system dependency installation required an unavailable interactive sudo password. Official Ubuntu packages were instead downloaded/extracted into ignored `.local/browser-libs` for successful browser tests. Fresh-machine instructions are in README.
- ESLint 10.10.0 failed with the React plugin bundled by Next.js. Pinned compatible ESLint 9.39.5, which emits a deprecation warning; upgrade the lint stack when upstream plugins support ESLint 10. This is a development tooling limitation.
- Test database startup and browser execution require localhost sockets. The execution sandbox blocks those, so verified checks were run with approved escalation. An initial sandbox build failed reading a TypeScript subprocess; the approved full build passed.
- Browser tests require ports 3100/55434 and run serially. Tests use an isolated database and never reset the playable village. Generated credentials, database files, screenshots, and caches are ignored by Git.
- Original Windows `:Zone.Identifier` metadata files remain on disk and are ignored by Git.

## Next task

M2 — introduce a small configurable production chain, profession experience, and one meaningful unlock; add transactional input consumption and gating tests. Keep provisional balance explicit. Continue milestone-by-milestone review before expanding toward the test marketplace. Future payment/crypto/warfare decisions remain open and do not block this prototype.
