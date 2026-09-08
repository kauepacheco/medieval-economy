import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { PoolClient } from "pg";
import { recipes } from "../domain/content";
import { GameError } from "../domain/errors";
import { startJobSchema, type StartJobInput } from "../domain/validation";
import { transaction } from "./database";

type JobRow = {
  id: string; village_id: string; recipe_id: string; recipe_version: number;
  workers: number; resource: "wood" | "stone"; output_quantity: number;
  started_at: Date; due_at: Date; completed_at: Date | null; status: "running" | "completed";
};
function serializeJob(job: JobRow) {
  return { id: job.id, recipeId: job.recipe_id, recipeVersion: job.recipe_version,
    workers: job.workers, resource: job.resource, outputQuantity: job.output_quantity,
    startedAt: job.started_at.toISOString(), dueAt: job.due_at.toISOString(),
    completedAt: job.completed_at?.toISOString() ?? null, status: job.status };
}

// Only tests inject a clock. Production always reads PostgreSQL time after locking.
export class Game {
  constructor(private pool: pg.Pool, private clock?: () => Date) {}

  private async now(client: PoolClient): Promise<Date> {
    return this.clock ? this.clock() : (await client.query<{ now: Date }>("SELECT clock_timestamp() AS now")).rows[0].now;
  }

  async getVillage(ownerId: string) {
    return transaction(this.pool, async (client) => {
      const { rows: [village] } = await client.query("SELECT * FROM villages WHERE owner_id = $1", [ownerId]);
      if (!village) throw new GameError(404, "Village not found. Run the development seed.");
      const { rows: balances } = await client.query<{ resource: "wood" | "stone"; quantity: string }>("SELECT resource, quantity FROM inventory WHERE village_id = $1", [village.id]);
      const { rows: jobs } = await client.query<JobRow>(`SELECT * FROM production_jobs WHERE village_id = $1 AND status = 'running'
        UNION ALL (SELECT * FROM production_jobs WHERE village_id = $1 AND status = 'completed' ORDER BY completed_at DESC LIMIT 10)
        ORDER BY started_at DESC`, [village.id]);
      return { serverNow: (await this.now(client)).toISOString(), village: { id: village.id as string, name: village.name as string, totalWorkers: village.total_workers as number, busyWorkers: village.busy_workers as number },
        inventory: { wood: Number(balances.find((b) => b.resource === "wood")?.quantity ?? 0), stone: Number(balances.find((b) => b.resource === "stone")?.quantity ?? 0) },
        recipes, jobs: jobs.map(serializeJob) };
    }, true);
  }

  async startJob(ownerId: string, rawInput: StartJobInput) {
    const parsed = startJobSchema.safeParse(rawInput);
    if (!parsed.success) throw new GameError(400, "Choose a gathering activity and 1–6 workers. Unexpected fields are not accepted.");
    const input = parsed.data;
    const recipe = recipes.find((entry) => entry.id === input.recipeId)!;
    return transaction(this.pool, async (client) => {
      const { rows: [village] } = await client.query("SELECT * FROM villages WHERE owner_id = $1 FOR UPDATE", [ownerId]);
      if (!village) throw new GameError(404, "Village not found.");
      const { rows: [existing] } = await client.query<JobRow>("SELECT * FROM production_jobs WHERE village_id = $1 AND idempotency_key = $2", [village.id, input.idempotencyKey]);
      if (existing) {
        if (existing.recipe_id !== input.recipeId || existing.workers !== input.workers) throw new GameError(409, "This request was already used for a different assignment.");
        return serializeJob(existing);
      }
      if (village.total_workers - village.busy_workers < input.workers) throw new GameError(409, "Not enough available workers. Wait for an expedition to return.");
      const now = await this.now(client);
      const due = new Date(now.getTime() + recipe.durationSeconds * 1000);
      await client.query("UPDATE villages SET busy_workers = busy_workers + $2 WHERE id = $1", [village.id, input.workers]);
      const { rows: [job] } = await client.query<JobRow>(`INSERT INTO production_jobs
        (id, village_id, idempotency_key, recipe_id, recipe_version, workers, resource, output_quantity, inputs, started_at, due_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'{}'::jsonb,$9,$10) RETURNING *`,
      [randomUUID(), village.id, input.idempotencyKey, recipe.id, recipe.version, input.workers, recipe.resource, recipe.outputPerWorker * input.workers, now, due]);
      return serializeJob(job);
    });
  }

  async completeJob(jobId: string): Promise<boolean> {
    return transaction(this.pool, async (client) => {
      const { rows: [candidate] } = await client.query<{ village_id: string }>("SELECT village_id FROM production_jobs WHERE id = $1 AND status = 'running'", [jobId]);
      if (!candidate) return false;
      // All mutations lock village before job, avoiding start/completion deadlocks.
      // Another worker can skip this village and safely retry on its next pass.
      const village = await client.query("SELECT id FROM villages WHERE id = $1 FOR UPDATE SKIP LOCKED", [candidate.village_id]);
      if (!village.rowCount) return false;
      const { rows: [job] } = await client.query<JobRow>("SELECT * FROM production_jobs WHERE id = $1 FOR UPDATE", [jobId]);
      const now = await this.now(client);
      if (job.status !== "running" || job.due_at.getTime() > now.getTime()) return false;
      await client.query(`INSERT INTO inventory (village_id, resource, quantity) VALUES ($1,$2,$3)
        ON CONFLICT (village_id, resource) DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity`, [job.village_id, job.resource, job.output_quantity]);
      await client.query("UPDATE villages SET busy_workers = busy_workers - $2 WHERE id = $1", [job.village_id, job.workers]);
      await client.query("INSERT INTO inventory_events (id, village_id, job_id, resource, quantity, occurred_at) VALUES ($1,$2,$3,$4,$5,$6)", [randomUUID(), job.village_id, job.id, job.resource, job.output_quantity, now]);
      await client.query("UPDATE production_jobs SET status = 'completed', completed_at = $2 WHERE id = $1", [jobId, now]);
      return true;
    });
  }

  async completeDueJobs(limit = 100): Promise<number> {
    // Bind the cutoff once so PostgreSQL can use the due-time index range.
    const cutoff = this.clock?.() ?? (await this.pool.query<{ now: Date }>("SELECT clock_timestamp() AS now")).rows[0].now;
    const { rows } = await this.pool.query<{ id: string }>("SELECT id FROM production_jobs WHERE status = 'running' AND due_at <= $1 ORDER BY due_at, id LIMIT $2", [cutoff, limit]);
    let completed = 0;
    for (const job of rows) {
      if (await this.completeJob(job.id)) completed++;
    }
    return completed;
  }
}
