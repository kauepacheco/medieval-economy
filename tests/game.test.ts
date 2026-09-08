import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPool } from "../src/server/database";
import { migrate } from "../src/server/migrate";
import { seed } from "../src/server/seed";
import { Game } from "../src/server/game";
import { LOCAL_OWNER_ID, LOCAL_VILLAGE_ID } from "../src/domain/content";

let postgres: EmbeddedPostgres;
let directory: string;
let url: string;
let pool: ReturnType<typeof createPool>;
let game: Game;
let now = new Date("2026-09-08T12:00:00.000Z");
const clock = () => new Date(now);
const start = (workers = 2, recipeId: "gather_wood" | "gather_stone" = "gather_wood", idempotencyKey = randomUUID()) => game.startJob(LOCAL_OWNER_ID, { workers, recipeId, idempotencyKey });

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "medieval-test-"));
  const socket = createServer();
  await new Promise<void>((resolve, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", resolve); });
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  const password = randomBytes(24).toString("hex");
  postgres = new EmbeddedPostgres({ databaseDir: join(directory, "data"), user: "test_user", password, port,
    persistent: true, authMethod: "scram-sha-256", postgresFlags: ["-h", "127.0.0.1", "-k", directory], onLog: () => {}, onError: () => {} });
  await postgres.initialise();
  await postgres.start();
  url = `postgresql://test_user:${password}@127.0.0.1:${port}/postgres`;
  pool = createPool(url);
  await migrate(pool);
});

beforeEach(async () => {
  await pool.query("TRUNCATE inventory_events, production_jobs, inventory, villages CASCADE");
  await seed(pool);
  now = new Date("2026-09-08T12:00:00.000Z");
  game = new Game(pool, clock);
});

afterAll(async () => {
  await pool?.end();
  await postgres?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe("PostgreSQL production transactions", () => {
  it("persists jobs and does not award before the exact due boundary", async () => {
    const job = await start();
    expect((await new Game(pool, clock).getVillage(LOCAL_OWNER_ID)).jobs[0].id).toBe(job.id);
    now = new Date(new Date(job.dueAt).getTime() - 1);
    expect(await game.completeJob(job.id)).toBe(false);
    expect((await game.getVillage(LOCAL_OWNER_ID)).inventory.wood).toBe(0);
    now = new Date(job.dueAt);
    expect(await game.completeJob(job.id)).toBe(true);
    const state = await game.getVillage(LOCAL_OWNER_ID);
    expect(state.inventory.wood).toBe(10);
    expect(state.village.busyWorkers).toBe(0);
    expect(state.jobs[0].status).toBe("completed");
  });

  it("awards and releases workers exactly once under simultaneous retries", async () => {
    const job = await start(6);
    now = new Date(job.dueAt);
    const attempts = await Promise.all(Array.from({ length: 20 }, () => game.completeJob(job.id)));
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(await game.completeJob(job.id)).toBe(false);
    expect((await game.getVillage(LOCAL_OWNER_ID)).inventory.wood).toBe(30);
    expect((await pool.query("SELECT * FROM inventory_events")).rowCount).toBe(1);
    expect((await game.getVillage(LOCAL_OWNER_ID)).village.busyWorkers).toBe(0);
  });

  it("rejects concurrent starts that exceed the shared workforce", async () => {
    const attempts = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => start(2, i % 2 ? "gather_wood" : "gather_stone")));
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect((await game.getVillage(LOCAL_OWNER_ID)).village.busyWorkers).toBe(6);
    expect((await pool.query("SELECT sum(workers)::int AS workers FROM production_jobs WHERE status = 'running'")).rows[0].workers).toBe(6);
  });

  it("deduplicates starts, including a replay after completion", async () => {
    const key = randomUUID();
    const jobs = await Promise.all(Array.from({ length: 10 }, () => start(2, "gather_wood", key)));
    expect(new Set(jobs.map((job) => job.id)).size).toBe(1);
    await expect(start(3, "gather_wood", key)).rejects.toMatchObject({ status: 409 });
    now = new Date(jobs[0].dueAt);
    await game.completeDueJobs();
    expect((await start(2, "gather_wood", key)).id).toBe(jobs[0].id);
    expect((await game.getVillage(LOCAL_OWNER_ID)).village.busyWorkers).toBe(0);
  });

  it("isolates owners and does not allow a nonexistent owner to mutate a village", async () => {
    const otherOwner = randomUUID();
    await expect(game.getVillage(otherOwner)).rejects.toMatchObject({ status: 404 });
    await expect(game.startJob(otherOwner, { workers: 1, recipeId: "gather_wood", idempotencyKey: randomUUID() })).rejects.toMatchObject({ status: 404 });
    const villageId = randomUUID();
    await pool.query("INSERT INTO villages (id, owner_id, name, total_workers) VALUES ($1,$2,'Other village',6)", [villageId, otherOwner]);
    await game.startJob(otherOwner, { workers: 1, recipeId: "gather_stone", idempotencyKey: randomUUID() });
    expect((await game.getVillage(LOCAL_OWNER_ID)).jobs).toHaveLength(0);
    expect((await game.getVillage(otherOwner)).jobs).toHaveLength(1);
  });

  it("rolls back output and worker release if a later settlement statement fails", async () => {
    const job = await start();
    now = new Date(job.dueAt);
    await pool.query("CREATE FUNCTION reject_test_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$");
    await pool.query("CREATE TRIGGER reject_test_event BEFORE INSERT ON inventory_events FOR EACH ROW EXECUTE FUNCTION reject_test_event()");
    try {
      await expect(game.completeJob(job.id)).rejects.toThrow("injected failure");
      const state = await game.getVillage(LOCAL_OWNER_ID);
      expect(state.inventory.wood).toBe(0);
      expect(state.village.busyWorkers).toBe(2);
      expect(state.jobs[0].status).toBe("running");
    } finally {
      await pool.query("DROP TRIGGER reject_test_event ON inventory_events");
      await pool.query("DROP FUNCTION reject_test_event()");
    }
    expect(await game.completeJob(job.id)).toBe(true);
    expect((await game.getVillage(LOCAL_OWNER_ID)).inventory.wood).toBe(10);
  });

  it("retains committed recipe output and duration independently of future content", async () => {
    const job = await start(2, "gather_stone");
    expect(job.outputQuantity).toBe(6);
    expect(new Date(job.dueAt).getTime() - new Date(job.startedAt).getTime()).toBe(45000);
    // Simulate a retired recipe: completion must use the persisted snapshot only.
    await pool.query("UPDATE production_jobs SET recipe_id = 'retired_recipe', recipe_version = 99 WHERE id = $1", [job.id]);
    now = new Date(job.dueAt);
    await game.completeDueJobs();
    expect((await game.getVillage(LOCAL_OWNER_ID)).inventory.stone).toBe(6);
  });

  it("database constraints reject negative inventory and workforce over-allocation", async () => {
    await expect(pool.query("UPDATE inventory SET quantity = -1 WHERE village_id = $1", [LOCAL_VILLAGE_ID])).rejects.toThrow();
    await expect(pool.query("UPDATE villages SET busy_workers = 7 WHERE id = $1", [LOCAL_VILLAGE_ID])).rejects.toThrow();
    await expect(pool.query("UPDATE villages SET busy_workers = -1 WHERE id = $1", [LOCAL_VILLAGE_ID])).rejects.toThrow();
  });

  it("concurrent workers and new starts preserve allocation and both inventories", async () => {
    await start(2, "gather_wood");
    await start(2, "gather_stone");
    now = new Date(now.getTime() + 60000);
    const operations = await Promise.allSettled([game.completeDueJobs(), game.completeDueJobs(), start(2), start(2)]);
    expect(operations[0].status).toBe("fulfilled");
    expect(operations[1].status).toBe("fulfilled");
    await game.completeDueJobs();
    const state = await game.getVillage(LOCAL_OWNER_ID);
    expect(state.inventory).toEqual({ wood: 10, stone: 6 });
    expect(state.village.busyWorkers).toBe(state.jobs.filter((job) => job.status === "running").reduce((sum, job) => sum + job.workers, 0));
    expect(state.village.busyWorkers).toBeLessThanOrEqual(6);
  });

  it("migration and seed reruns preserve existing progress", async () => {
    await start();
    await migrate(pool);
    await seed(pool);
    expect((await game.getVillage(LOCAL_OWNER_ID)).village.busyWorkers).toBe(2);
    expect((await game.getVillage(LOCAL_OWNER_ID)).jobs).toHaveLength(1);
  });

  it("uses database time in normal operation", async () => {
    const realGame = new Game(pool);
    const before = (await pool.query("SELECT clock_timestamp() AS now")).rows[0].now as Date;
    const job = await realGame.startJob(LOCAL_OWNER_ID, { workers: 1, recipeId: "gather_wood", idempotencyKey: randomUUID() });
    const after = (await pool.query("SELECT clock_timestamp() AS now")).rows[0].now as Date;
    expect(new Date(job.startedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(new Date(job.startedAt).getTime()).toBeLessThanOrEqual(after.getTime());
    expect(await realGame.completeJob(job.id)).toBe(false);
  });

  it("recovers overdue jobs after actual PostgreSQL and service restarts", async () => {
    const job = await start(3);
    await pool.end();
    await postgres.stop();
    await postgres.start();
    pool = createPool(url);
    now = new Date(new Date(job.dueAt).getTime() + 3600000);
    game = new Game(pool, clock);
    expect((await game.getVillage(LOCAL_OWNER_ID)).jobs[0].id).toBe(job.id);
    expect(await game.completeDueJobs()).toBe(1);
    expect(await new Game(pool, clock).completeDueJobs()).toBe(0);
    expect((await game.getVillage(LOCAL_OWNER_ID)).inventory.wood).toBe(15);
    expect((await game.getVillage(LOCAL_OWNER_ID)).village.busyWorkers).toBe(0);
  });

  it("reconnects after an idle database connection is terminated", async () => {
    const isolatedPool = createPool(url);
    // Assert the factory installs its own handler before adding a test observer.
    expect(isolatedPool.listenerCount("error")).toBeGreaterThan(0);
    const { rows: [{ pid }] } = await isolatedPool.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    const disconnect = new Promise<void>((resolve) => isolatedPool.once("error", () => resolve()));
    try {
      await pool.query("SELECT pg_terminate_backend($1)", [pid]);
      await disconnect;
      expect((await isolatedPool.query("SELECT 1 AS alive")).rows[0].alive).toBe(1);
    } finally { await isolatedPool.end(); }
  });
});
