# Milestones

Each milestone ends with a runnable result, relevant automated tests, and a human review. Proposed ordering; execute M1 first.

## M1 — Persistent timed village

Seed a local-only development village. Show its resources, finite workforce, and active jobs. Let the user assign workers to gather wood or stone. Use provisional documented quantities and short development durations so a human can test quickly. Require at least two available activities to demonstrate shared capacity.

Acceptance:
- Start a job, refresh the browser, and see the same persisted job.
- Close the browser; a running worker still completes the job and credits output.
- Restart the app/worker; persisted overdue work completes without loss or duplication.
- Replayed or concurrent completion attempts award output and release workers once.
- Concurrent starts cannot allocate more workers than exist.
- Client clock changes and forged reward fields cannot change output.
- App and database restarts preserve progress using the persistent database volume.
- Document clean setup, migrations, seed, app, worker, tests, and build commands. Startup needs no AI API key or paid service.
- Render an understandable resource/worker/job view with simple placeholders.

Explicitly excluded: public signups, trading, payments, crypto, generated artwork, map and combat.

## M2 — Production and expertise

Introduce a small recipe chain such as wood to charcoal, ore plus charcoal to metal, then a tool. These are illustrative recipes. Add profession experience and one meaningful unlock. Make inputs and workforce compete with gathering. Put tunable recipe data in versioned content. Test consumption, gating, and completion.

## M3 — Two-player test market

Use two local test identities, separate inventories and test balances. Reserve goods in listings; settle fixed-price sales, including the proposed 5% buyer fee in test currency. Demonstrate a complete gather/produce/sell/buy loop. Verify last-item races, insufficient funds, authorization and duplicate requests. No cash-out.

## M4 — Public-alpha readiness

Implement real authentication and one village per account; multiple accounts remain allowed. Add protected account creation, operational logs, backups/restoration, rate limits, CI, and failure recovery tests. Configure a staging environment before public deployment. Show temporary-world and reset notices. Complete a review of the authentication and economy code.

## M5 — Interaction and economy testing

Consider public shop profiles, trade offers, regional map and timed transport according to owner decisions. Measure player retention, completed trades, market liquidity, basic-resource demand, and production allocation. Simulations can detect incentives but cannot prove player enjoyment. Test intended slow pacing as well as accelerated development settings.

## Later — Paid persistent world

Finalize reset communication, subscription entitlements, real-money settlement, transaction policies and provider suitability, security review, support and operations before paid launch. Village transfers and any cryptocurrency are separate future projects.
