import { setTimeout } from "node:timers/promises";
import { assertLocalDevelopment } from "../src/server/auth";
import { createPool } from "../src/server/database";
import { Game } from "../src/server/game";

assertLocalDevelopment();
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL in .env first.");
const pool = createPool(process.env.DATABASE_URL);
const game = new Game(pool);
const abort = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => abort.abort());
console.log("Medieval Economy worker started. Checking persisted jobs every second.");
try {
  while (!abort.signal.aborted) {
    try {
      const count = await game.completeDueJobs();
      if (count) console.log(`Completed ${count} production job(s).`);
    } catch (error) { console.error("Worker pass failed; retrying:", error instanceof Error ? error.name : "UnknownError"); }
    try { await setTimeout(1000, undefined, { signal: abort.signal }); }
    catch { /* Graceful shutdown interrupts polling, never a transaction. */ }
  }
} finally { await pool.end(); }
