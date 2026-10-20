import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryRepo } from "../src/repo.js";
const app = () => createApp(new MemoryRepo(), { origins: ["http://localhost:5173"], secret: "x".repeat(32) });
describe("hardening", () => {
  it("returns JSON 404 and a readiness check", async () => { const a = app(); expect((await request(a).get("/nope")).status).toBe(404); expect((await request(a).get("/health/ready")).body.db).toBe("up"); });
  it("rate limits guest creation", async () => { const a = app(); let last = 0; for (let i = 0; i < 11; i++) last = (await request(a).post("/api/guest").send({ displayName: "Asha", avatar: "a1" })).status; expect(last).toBe(429); });
  it("sets security headers and rejects oversized bodies", async () => { const a = app(); expect((await request(a).get("/health")).headers["x-content-type-options"]).toBe("nosniff"); expect((await request(a).post("/api/guest").send({ displayName: "x".repeat(30000), avatar: "a1" })).status).toBe(413); });
});
