import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type pg from "pg";
import { transaction } from "./database";

export async function migrate(pool: pg.Pool) {
  await transaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(72189421)");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    const files = (await readdir(resolve("migrations"))).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (applied.rowCount) continue;
      await client.query(await readFile(resolve("migrations", file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    }
  });
}
