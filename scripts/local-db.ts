import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { createPool } from "../src/server/database";

if (process.env.NODE_ENV === "production") throw new Error("The bundled database is for local development only.");
await mkdir(".local", { recursive: true, mode: 0o700 });
const configPath = resolve(".local/db-config.json");
let config: { password: string; port: number };
try { config = JSON.parse(await readFile(configPath, "utf8")); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  config = { password: randomBytes(24).toString("hex"), port: 55432 };
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600, flag: "wx" });
}
const databaseUrl = `postgresql://medieval:${config.password}@127.0.0.1:${config.port}/medieval_economy`;
try {
  const env = parseEnv(await readFile(".env", "utf8"));
  if (env.DATABASE_URL !== databaseUrl) throw new Error("Existing .env points to a different database. Use that database, or move .env aside before running db:local. No settings were overwritten.");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  await writeFile(".env", `DATABASE_URL=${databaseUrl}\nLOCAL_DEV_AUTH=true\nAPP_ORIGIN=http://127.0.0.1:3000\n`, { mode: 0o600, flag: "wx" });
}
const postgres = new EmbeddedPostgres({
  databaseDir: resolve(".local/postgres"), user: "medieval", password: config.password,
  port: config.port, persistent: true, authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1", "-k", resolve(".local")],
  onLog: () => {}, onError: () => {},
});
try { await access(".local/postgres/PG_VERSION"); }
catch { await postgres.initialise(); }
await postgres.start();
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  console.log("Local PostgreSQL stopped. Data is preserved in .local/postgres.");
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void stop(); });
try {
  const admin = createPool(databaseUrl.replace(/\/medieval_economy$/, "/postgres"));
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'medieval_economy'");
    if (!exists.rowCount) await admin.query("CREATE DATABASE medieval_economy");
  } finally { await admin.end(); }
  console.log(`PostgreSQL is running at 127.0.0.1:${config.port}. Keep this terminal open.`);
  console.log("Next: npm run db:migrate && npm run db:seed (in another terminal).");
} catch (error) { await stop(); throw error; }
