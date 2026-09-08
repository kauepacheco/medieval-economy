# Medieval Economy

A slow-paced medieval browser economy game. The first playable milestone, M1, gives you **Oakstead**: six workers, wood and stone gathering, durable production jobs, and automatic deliveries. The official game name was confirmed on 2026-09-08.

This is a **local development prototype** with accelerated gathering times. No signup, payments, marketplace, map, combat, or public deployment is included. Normal gameplay needs no AI API key or paid service.

## Requirements

- Node.js 24 LTS and npm (verified with Node 24.20.0 / npm 11.19.0).
- Git.
- PostgreSQL 18, provided by either the bundled local runner below or Docker Compose.
- For browser tests: Playwright Chromium and its Linux system libraries.

## Quick start without Docker

From the project root:

```sh
npm ci
npm run db:local
```

Keep that terminal open. On first run, this starts a real PostgreSQL server at `127.0.0.1:55432`, creates a random local password, and writes an ignored `.env`. Data survives shutdown in `.local/postgres`. The runner preserves existing settings and refuses to overwrite an `.env` pointing to another database. Do not copy `.env.example` first when using this option.

In a second terminal:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

In a third terminal:

```sh
npm run worker
```

Open **http://127.0.0.1:3000**. Use this exact address; the local identity is restricted to `APP_ORIGIN`. The app and worker load `.env` automatically. Keep the database, app, and worker running. Stop each with Ctrl+C; start the same commands again to resume. Migrations and seeds can be rerun without resetting progress.

## Alternative: Docker PostgreSQL

Use this instead of `db:local`:

```sh
cp .env.example .env
```

Replace the placeholder password in **both** `POSTGRES_PASSWORD` and `DATABASE_URL` with the same local password. URL-encode it in `DATABASE_URL` if it contains special characters. Then:

```sh
docker compose up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

Run `npm run worker` in another terminal. Docker binds PostgreSQL only to loopback and stores it in a named volume. `docker compose down` preserves that volume; `docker compose down -v` deletes game progress and is not a routine restart command.

Docker was unavailable in the implementation WSL distro. To enable it: start Docker Desktop, open Settings → Resources → WSL Integration, enable this distro, apply/restart, then verify `docker compose version`. The bundled runner was used for actual database verification; the Compose path has not been executed here.

## Try the prototype

1. Assign two workers to wood and three to stone. One worker remains free.
2. Refresh the page: the same assignments remain.
3. Wood returns after 30 seconds; stone after 45 seconds. Supplies and workers return automatically.
4. Close the browser while work is running; reopen it to see the result.
5. Stop the worker with Ctrl+C, let a job become due, then restart it. Overdue jobs settle once. A due job displays “Awaiting delivery” while waiting for the worker.

Development balance is provisional: each assigned worker produces **5 wood bundles in 30 seconds** or **3 stone blocks in 45 seconds**. Additional workers increase output, not speed. Both activities share six workers. Gathering costs no inputs in M1; cancellation is unsupported. These choices are tunable content, not final economy rules.

Closing the browser is supported. If the computer sleeps or all processes stop, no process runs in the background; persisted overdue work is recovered when the database and worker resume.

## Commands and verification

| Command | Purpose |
| --- | --- |
| `npm ci` | Install exact dependencies from the lockfile |
| `npm run db:local` | Start optional persistent local PostgreSQL |
| `npm run db:migrate` | Apply checked-in SQL migrations transactionally |
| `npm run db:seed` | Create local Oakstead without resetting it |
| `npm run dev` | Run the playable development app on loopback |
| `npm run worker` | Poll persisted jobs once per second |
| `npm run typecheck` | Strict TypeScript checks |
| `npm run lint` | Next.js, React, accessibility, and TypeScript lint checks |
| `npm test` | Domain/auth tests and isolated real PostgreSQL integration tests |
| `npm run test:e2e` | Chromium tests against a separate app, database, and worker |
| `npm run build` | Check the optimized production build |
| `npm start` | Serve the production build; local game APIs intentionally return 403 |

Install the browser once:

```sh
npx playwright install --with-deps chromium
```

Then run:

```sh
npm test
npm run typecheck
npm run lint
npm run test:e2e
npm run build
```

Integration tests start an isolated PostgreSQL cluster in a temporary directory and never read your game database URL. Time-boundary tests use an injected clock rather than long sleeps. Browser tests use ports 3100 and 55434, a separate `.next-e2e` directory, and an ignored temporary connection file; run one browser suite at a time. They shorten jobs through direct access to their isolated database, never through a public testing endpoint. Screenshots and failure traces are saved in `test-results/`.

On this environment only, Chromium's missing `libnspr4`, `libnss3`, and `libasound2t64` packages were downloaded and extracted to `.local/browser-libs` because sudo needs interactive authentication. With those local libraries present, run:

```sh
LD_LIBRARY_PATH="$PWD/.local/browser-libs/usr/lib/x86_64-linux-gnu" npm run test:e2e
```

That directory is not committed; fresh machines should use Playwright's normal dependency installation above. Sandboxed coding environments may also require permission for local sockets and subprocesses.

## Implementation and boundaries

- TypeScript / Next.js 16 / React 19, PostgreSQL 18, and a separate Node worker in one repository.
- `pg` provides explicit parameterized SQL and transactions; the small schema does not need an ORM. Migrations live in `migrations/`.
- `src/domain/content.ts` holds versioned gathering recipes. Jobs snapshot duration, resource, output, workers, and empty committed inputs, so later recipe changes do not rewrite existing jobs.
- Database row locks serialize workforce changes. Output, inventory events, worker release, and completion status commit together. Request keys deduplicate repeated starts, including retries after completion.
- PostgreSQL owns time. Browser countdowns use a server-time anchor plus a monotonic clock. Private operations derive the owner on the server; client ownership and reward fields are rejected.
- The fixed development identity requires `LOCAL_DEV_AUTH=true`, a matching loopback host/origin, and a nonproduction runtime. It is **not authentication**. Do not expose the dev server through a proxy or tunnel. M4 must replace it before any public deployment.
- No real or test currency is implemented in M1. Balances are whole resource units. Credentials and local data stay in ignored files; no privileged browser credentials.
- The `embedded-postgres` npm wrapper has a beta version label; it launches real PostgreSQL 18.4 and is development/test tooling only. Docker is the alternative.
- ESLint is pinned to 9.39.5 because Next's current React/accessibility plugins fail with ESLint 10. Its deprecation warning is a known tooling limitation; upgrade when that plugin stack supports ESLint 10. Installed dependencies passed `npm audit` at implementation time.

## Project documents and workflow

The original planning handoff was prepared on 2026-09-08. Owner decisions remain distinguished from proposals in [the product brief](docs/product.md), [architecture](docs/architecture.md), and [milestones](docs/milestones.md). See [current status](docs/status.md) for verified results, review findings, limitations, and the next task.

The owner authorized autonomous implementation and parallel agents. Continue one milestone at a time and review each change. The original build and independent review prompts remain in `prompts/`; `AGENTS.md` defines the engineering rules. No agent scheduler or orchestration service is part of the game.

Technical references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [PostgreSQL locking](https://www.postgresql.org/docs/18/sql-select.html), [Node.js downloads](https://nodejs.org/en/download).
