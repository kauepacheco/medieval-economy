import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPool } from "../../src/server/database";
import { migrate } from "../../src/server/migrate";
import { seed } from "../../src/server/seed";

const directory = await mkdtemp(join(tmpdir(), "medieval-e2e-"));
const password = randomBytes(24).toString("hex");
const postgres = new EmbeddedPostgres({ databaseDir: join(directory, "data"), user: "e2e_user", password, port: 55434,
  persistent: true, authMethod: "scram-sha-256", postgresFlags: ["-h", "127.0.0.1", "-k", directory], onLog: () => {}, onError: () => {} });
await postgres.initialise();
await postgres.start();
const url = `postgresql://e2e_user:${password}@127.0.0.1:55434/postgres`;
const pool = createPool(url);
await migrate(pool);
await seed(pool);
await pool.end();
await mkdir(".local", { recursive: true });
await writeFile(".local/e2e-runtime.json", JSON.stringify({ url }), { mode: 0o600 });
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  stdio: "inherit", env: { ...process.env, NODE_ENV: "development", DATABASE_URL: url, LOCAL_DEV_AUTH: "true", APP_ORIGIN: "http://127.0.0.1:3100", E2E_TEST: "true" },
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (app.exitCode === null && app.signalCode === null) {
    await new Promise<void>((resolve) => { app.once("exit", () => resolve()); app.kill("SIGTERM"); });
  }
  await postgres.stop();
  await rm(directory, { recursive: true, force: true });
  await rm(".local/e2e-runtime.json", { force: true });
}
for (const signal of ["SIGTERM", "SIGINT"] as const) process.on(signal, () => { void stop(); });
app.on("exit", () => { if (!stopping) { process.exitCode = 1; void stop(); } });
