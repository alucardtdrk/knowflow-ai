import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "live.spec.ts",
  workers: 1,
  timeout: 90000,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "live", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node --import tsx e2e/start-live.ts",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
