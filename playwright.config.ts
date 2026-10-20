import { defineConfig } from "@playwright/test";
// Needs both servers running and the DB seeded: `npm run dev:backend`, `npm run dev:frontend`, then `npm run e2e`.
export default defineConfig({ testDir: "e2e", use: { baseURL: process.env.E2E_URL ?? "http://localhost:5173" }, timeout: 120_000 });
