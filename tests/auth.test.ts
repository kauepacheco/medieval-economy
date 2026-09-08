import { describe, expect, it } from "vitest";
import { requireLocalOwner } from "../src/server/auth";
import { LOCAL_OWNER_ID } from "../src/domain/content";
import { startJobSchema } from "../src/domain/validation";

const env = { NODE_ENV: "test", LOCAL_DEV_AUTH: "true", APP_ORIGIN: "http://127.0.0.1:3000" } as const;
function request(method = "GET", overrides: Record<string, string> = {}, url: string = env.APP_ORIGIN) {
  return new Request(`${url}/api/village`, { method, headers: { host: "127.0.0.1:3000", origin: env.APP_ORIGIN, ...overrides } });
}
describe("local fixture authorization", () => {
  it("derives owner from server fixture, ignoring forged ownership headers", () => {
    expect(requireLocalOwner(request("GET", { "x-owner-id": "someone-else" }), env)).toBe(LOCAL_OWNER_ID);
  });
  it("refuses production even if local auth was accidentally enabled", () => {
    expect(() => requireLocalOwner(request(), { ...env, NODE_ENV: "production" })).toThrow(/local development/);
  });
  it("defaults to disabled", () => {
    expect(() => requireLocalOwner(request(), { NODE_ENV: "development" })).toThrow();
  });
  it("refuses external hosts, DNS rebinding, and cross-site writes", () => {
    expect(() => requireLocalOwner(request("GET", { host: "evil.example" }), env)).toThrow();
    expect(() => requireLocalOwner(request("GET", {}, "http://evil.example"), env)).toThrow();
    expect(() => requireLocalOwner(request("POST", { origin: "http://evil.example" }), env)).toThrow();
    expect(() => requireLocalOwner(request("GET", { "sec-fetch-site": "cross-site" }), env)).toThrow();
    expect(() => requireLocalOwner(request(), { ...env, APP_ORIGIN: "http://evil.example" })).toThrow();
  });
  it("requires an explicit same origin on writes", () => {
    const req = new Request(`${env.APP_ORIGIN}/api/jobs`, { method: "POST", headers: { host: "127.0.0.1:3000" } });
    expect(() => requireLocalOwner(req, env)).toThrow();
    expect(requireLocalOwner(request("POST"), env)).toBe(LOCAL_OWNER_ID);
  });
  it("accepts Next.js internal localhost normalization only with the configured Host", () => {
    expect(requireLocalOwner(request("GET", {}, "http://localhost:3000"), env)).toBe(LOCAL_OWNER_ID);
    expect(() => requireLocalOwner(request("GET", { host: "localhost:3000" }, "http://localhost:3000"), env)).toThrow();
  });
});

describe("job request boundary", () => {
  const valid = { recipeId: "gather_wood", workers: 2, idempotencyKey: "00000000-0000-4000-8000-000000000009" };
  it.each([0, -1, 1.5, 7, "2", null])("rejects invalid worker count %s", (workers) => {
    expect(startJobSchema.safeParse({ ...valid, workers }).success).toBe(false);
  });
  it.each(["reward", "ownerId", "villageId", "dueAt", "outputQuantity", "recipeVersion"])("rejects forged %s", (field) => {
    expect(startJobSchema.safeParse({ ...valid, [field]: 999 }).success).toBe(false);
  });
  it("rejects unknown recipes and malformed retry keys", () => {
    expect(startJobSchema.safeParse({ ...valid, recipeId: "free_gold" }).success).toBe(false);
    expect(startJobSchema.safeParse({ ...valid, idempotencyKey: "invalid" }).success).toBe(false);
  });
});
