# Instructions for the development agent

## Context and scope

Read docs/product.md, docs/architecture.md, docs/milestones.md and docs/status.md before implementation. Treat explicitly stated owner decisions as authoritative. Proposed defaults can be refined with documented reasons. Do not turn unanswered questions into established product rules. Implement only the requested milestone, continuing through implementation and verification rather than stopping after a plan.

## Working approach

Inspect the existing repository first. Preserve user edits and these documents. Make routine reversible engineering decisions autonomously; document assumptions. Ask only for an actual blocker or consequential product decision needed for the active milestone. Do not let decisions about future features block a local prototype.

Use one working implementation agent initially. Separate review can happen in a new conversation. Do not build agent orchestration infrastructure as part of the game bootstrap.

## Engineering rules

- Server owns time, ownership, resource balances, worker allocation, prices, and action eligibility. Never trust client-supplied rewards or account ownership.
- Persist game state in PostgreSQL. No in-memory or localStorage substitute for authoritative state.
- Timed actions use persisted timestamps, not one sleeping process or timer per village.
- Job effects must be idempotent under retries and concurrency. Atomically credit output and release workers once.
- Prevent negative inventory and over-allocation of workers at the database transaction boundary.
- Use versioned recipes and explicit numeric units. Use integer minor units for test currency; never floating-point balances.
- Real-money payments, subscriptions, crypto, payouts, and ownership transfers are outside the first milestones. Test balances are not redeemable money.
- Keep credentials in ignored environment files; provide an example containing placeholders. Do not put privileged credentials into browser code.
- Development seed identities must not become public authentication. Public deployment requires the authentication milestone first.
- Start with simple original placeholders. Image generation is not a runtime dependency.

## Verification and handoff

Write meaningful tests for time boundaries, retries, authorization, concurrent inventory changes, and persistence as relevant. Use an injectable clock instead of long test sleeps. Do not claim tests were run when they were not. Report unavailable dependencies and exact next steps.

After implementing, update README with actual commands and docs/status.md with changes, decisions, tests, known issues, and next task. Finish with how to run the app, what to try in the browser, and limitations. Do not publish publicly or add paid infrastructure merely to complete a local task. Preserve progress in reviewable Git changes; never reset user changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
