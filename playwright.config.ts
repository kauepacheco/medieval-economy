import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 10000 },
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: "node --import tsx tests/e2e/server.ts",
    url: "http://127.0.0.1:3100/api/village",
    reuseExistingServer: false,
    timeout: 60000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10000 },
  },
});
