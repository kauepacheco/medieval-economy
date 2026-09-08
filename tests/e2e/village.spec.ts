import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createPool } from "../../src/server/database";
import { seed } from "../../src/server/seed";

let url: string;
let pool: ReturnType<typeof createPool>;
let worker: ChildProcess | undefined;
async function stopWorker() {
  if (!worker || worker.exitCode !== null || worker.signalCode !== null) return;
  const child = worker;
  await new Promise<void>((resolve) => { child.once("exit", () => resolve()); child.kill("SIGTERM"); });
  worker = undefined;
}
function startWorker() {
  worker = spawn(process.execPath, ["--import", "tsx", "scripts/worker.ts"], {
    env: { ...process.env, NODE_ENV: "development", LOCAL_DEV_AUTH: "true", DATABASE_URL: url }, stdio: "ignore",
  });
}
async function makeJobsDue() {
  // Only the isolated test DB is touched; no test clock or settlement endpoint is exposed.
  await pool.query("UPDATE production_jobs SET started_at = clock_timestamp() - interval '60 seconds', due_at = clock_timestamp() - interval '1 second' WHERE status = 'running'");
}
test.beforeAll(async () => {
  ({ url } = JSON.parse(await readFile(".local/e2e-runtime.json", "utf8")));
  pool = createPool(url);
});
test.beforeEach(async () => {
  await stopWorker();
  await pool.query("TRUNCATE inventory_events, production_jobs, inventory, villages CASCADE");
  await seed(pool);
});
test.afterAll(async () => { await stopWorker(); await pool.end(); });

test("gathering survives refresh, a closed browser, and an actual worker restart", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByTestId("free-workers")).toHaveText("6");
  startWorker();
  await page.getByLabel("Assign workers").first().fill("2");
  await page.getByRole("button", { name: "Gather wood" }).click();
  await expect(page.getByTestId("free-workers")).toHaveText("4");
  await expect(page.getByRole("heading", { name: "Gathering wood" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Gathering wood" })).toBeVisible();
  // Moving the browser's wall clock cannot grant output or free workers.
  await page.clock.setFixedTime(new Date("2040-01-01"));
  await expect(page.getByTestId("wood-balance")).toHaveText("0");
  await expect(page.getByText("In progress", { exact: true })).toBeVisible();
  await stopWorker();
  await page.close();
  await makeJobsDue();
  expect((await pool.query("SELECT quantity FROM inventory WHERE resource = 'wood'")).rows[0].quantity).toBe("0");
  startWorker();
  await expect.poll(async () => (await pool.query("SELECT quantity FROM inventory WHERE resource = 'wood'")).rows[0].quantity).toBe("10");
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.getByTestId("wood-balance")).toHaveText("10");
  await expect(reopened.getByTestId("free-workers")).toHaveText("6");
  expect((await pool.query("SELECT count(*)::int AS count FROM inventory_events")).rows[0].count).toBe(1);
  expect(errors).toEqual([]);
});

test("shared capacity, automatic deliveries, and mobile layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("free-workers")).toHaveText("6");
  await page.getByLabel("Assign workers").first().fill("3");
  await page.getByRole("button", { name: "Gather wood" }).click();
  await expect(page.getByTestId("free-workers")).toHaveText("3");
  await page.getByLabel("Assign workers").nth(1).fill("3");
  await page.getByRole("button", { name: "Gather stone" }).click();
  await expect(page.getByTestId("free-workers")).toHaveText("0");
  await expect(page.getByRole("button", { name: "Workers occupied" })).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/village-mobile.png", fullPage: true });
  await makeJobsDue();
  startWorker();
  await expect(page.getByTestId("wood-balance")).toHaveText("15");
  await expect(page.getByTestId("stone-balance")).toHaveText("9");
  await expect(page.getByTestId("free-workers")).toHaveText("6");
});

test("an ambiguous response can be retried without a second assignment", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("free-workers")).toHaveText("6");
  await page.route("**/api/jobs", async (route) => {
    await route.fetch(); // The real server commits, but the response never reaches the browser.
    await route.abort("failed");
    await page.unroute("**/api/jobs");
  });
  await page.getByRole("button", { name: "Gather wood" }).click();
  await expect(page.getByRole("button", { name: "Retry assignment" })).toBeVisible();
  await page.getByRole("button", { name: "Retry assignment" }).click();
  await expect(page.getByTestId("free-workers")).toHaveText("5");
  await expect(page.getByRole("heading", { name: "Gathering wood" })).toHaveCount(1);
  expect((await pool.query("SELECT count(*)::int AS count FROM production_jobs")).rows[0].count).toBe(1);
});

test("HTTP boundary rejects forged rewards, ownership, cross-site writes, and oversized bodies", async ({ request }) => {
  const input = { recipeId: "gather_wood", workers: 1, idempotencyKey: randomUUID() };
  const headers = { Origin: "http://127.0.0.1:3100" };
  expect((await request.post("/api/jobs", { headers, data: { ...input, outputQuantity: 999999 } })).status()).toBe(400);
  expect((await request.post("/api/jobs", { headers, data: { ...input, ownerId: randomUUID() } })).status()).toBe(400);
  expect((await request.post("/api/jobs", { data: input, headers: { Origin: "http://evil.example" } })).status()).toBe(403);
  expect((await request.post("/api/jobs", { headers, data: { ...input, junk: "x".repeat(2000) } })).status()).toBe(413);
  expect((await pool.query("SELECT count(*)::int AS count FROM production_jobs")).rows[0].count).toBe(0);
});

test("desktop overview and recoverable load failure", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.route("**/api/village", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Database is temporarily unavailable." }) }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your village is out of reach" })).toBeVisible();
  await page.unroute("**/api/village");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("free-workers")).toHaveText("6");
  await page.screenshot({ path: "test-results/village-desktop.png", fullPage: true });
});
