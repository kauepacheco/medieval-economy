import type pg from "pg";
import { INITIAL_WORKERS, LOCAL_OWNER_ID, LOCAL_VILLAGE_ID } from "../domain/content";
import { transaction } from "./database";

export async function seed(pool: pg.Pool) {
  await transaction(pool, async (client) => {
    await client.query("INSERT INTO villages (id, owner_id, name, total_workers) VALUES ($1, $2, 'Oakstead', $3) ON CONFLICT DO NOTHING", [LOCAL_VILLAGE_ID, LOCAL_OWNER_ID, INITIAL_WORKERS]);
    await client.query("INSERT INTO inventory (village_id, resource) VALUES ($1, 'wood'), ($1, 'stone') ON CONFLICT DO NOTHING", [LOCAL_VILLAGE_ID]);
  });
}
