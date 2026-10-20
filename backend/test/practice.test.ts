import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryRepo } from "../src/repo.js";
import { istDateKey } from "@dostleague/shared";
describe("practice mode", () => {
  it("is unranked, leak-free, and leaves the ranked attempt available", async () => {
    let t = Date.parse("2026-10-17T06:00:00Z"); const date = istDateKey(new Date(t)); const repo = new MemoryRepo();
    repo.packs.set(date, { packId: "p", date, version: 1, questions: [{ id: crypto.randomUUID(), position: 0, type: "trivia", category: "c", difficulty: 1, prompt: "Q?", options: ["a", "b", "c", "d"], correctIndex: 1, explanation: "e" }] });
    const app = createApp(repo, { origins: [], secret: "x".repeat(32), now: () => t });
    const auth = `Bearer ${(await request(app).post("/api/guest").send({ displayName: "Asha", avatar: "a1" })).body.token}`;
    let r = await request(app).post("/api/practice/start").set("Authorization", auth); expect(JSON.stringify(r.body)).not.toMatch(/correctIndex|explanation/);
    let q = r.body.question; let result: any; for (let i = 0; i < 5; i++) { t += 500; r = await request(app).post("/api/practice/answer").set("Authorization", auth).send({ questionId: q.id, choice: 0 }); q = r.body.next; result = r.body.result; }
    expect(result.practice).toBe(true); expect(result.saved).toBe(true); expect(repo.attempts).toHaveLength(0); expect(repo.soloResults).toHaveLength(1);
    expect((await request(app).post("/api/daily/start").set("Authorization", auth)).status).toBe(200);
  });
});
