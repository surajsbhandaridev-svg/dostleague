import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryRepo } from "../src/repo.js";
import { istDateKey } from "@dostleague/shared";

let t = Date.parse("2026-10-17T06:00:00Z"); const date = istDateKey(new Date(t));
const qs = [0, 1, 2].map((i) => ({ id: crypto.randomUUID(), position: i, type: "trivia", category: "c", difficulty: 1, prompt: `Q${i}?`, options: ["a", "b", "c", "d"], correctIndex: 1, explanation: "because" }));
let repo: MemoryRepo, app: ReturnType<typeof createApp>;
beforeEach(() => { t = Date.parse("2026-10-17T06:00:00Z"); repo = new MemoryRepo(); repo.packs.set(date, { packId: "p", date, version: 1, questions: qs }); app = createApp(repo, { origins: ["http://localhost:5173"], secret: "x".repeat(32), now: () => t }); });
const guest = async (name = "Asha") => (await request(app).post("/api/guest").send({ displayName: name, avatar: "a1" })).body.token as string;

describe("guest identity", () => {
  it("issues a token and stores only its hash", async () => {
    const token = await guest(); expect(token.length).toBeGreaterThan(30);
    expect(JSON.stringify([...repo.players.values()])).not.toContain(token);
  });
  it("rejects bad names and unauthenticated calls", async () => {
    expect((await request(app).post("/api/guest").send({ displayName: "<b>x</b>", avatar: "a1" })).status).toBe(400);
    expect((await request(app).post("/api/daily/start")).status).toBe(401);
  });
});
describe("daily dangal", () => {
  it("never leaks answers in questions", async () => {
    const r = await request(app).post("/api/daily/start").set("Authorization", `Bearer ${await guest()}`);
    expect(JSON.stringify(r.body)).not.toMatch(/correctIndex|because/);
  });
  it("scores on the server, rejects duplicates, saves once, blocks replay", async () => {
    const auth = `Bearer ${await guest()}`; await request(app).post("/api/daily/start").set("Authorization", auth);
    t += 3000; const a1 = await request(app).post("/api/daily/answer").set("Authorization", auth).send({ questionId: qs[0].id, choice: 1 });
    expect(a1.body.reveal.points).toBeGreaterThan(100);
    expect((await request(app).post("/api/daily/answer").set("Authorization", auth).send({ questionId: qs[0].id, choice: 1 })).status).toBe(409);
    await request(app).post("/api/daily/answer").set("Authorization", auth).send({ questionId: qs[1].id, choice: 0 });
    const last = await request(app).post("/api/daily/answer").set("Authorization", auth).send({ questionId: qs[2].id, choice: 1 });
    expect(last.body.result.correct).toBe(2); expect(repo.attempts).toHaveLength(1);
    expect((await request(app).post("/api/daily/start").set("Authorization", auth)).status).toBe(409);
  });
  it("late answers score zero", async () => {
    const auth = `Bearer ${await guest()}`; await request(app).post("/api/daily/start").set("Authorization", auth);
    t += 20000; const r = await request(app).post("/api/daily/answer").set("Authorization", auth).send({ questionId: qs[0].id, choice: 1 });
    expect(r.body.reveal.points).toBe(0);
  });
  it("orders the leaderboard by score then time", async () => {
    for (const [name, wait] of [["Slow", 9000], ["Fast", 1000]] as const) {
      const auth = `Bearer ${await guest(name)}`; await request(app).post("/api/daily/start").set("Authorization", auth);
      for (const q of qs) { t += wait; await request(app).post("/api/daily/answer").set("Authorization", auth).send({ questionId: q.id, choice: 1 }); }
    }
    const lb = (await request(app).get("/api/leaderboard/daily")).body.rows; expect(lb.map((r: { name: string }) => r.name)).toEqual(["Fast", "Slow"]);
  });
});
