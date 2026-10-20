import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryRepo } from "../src/repo.js";
import { istDateKey } from "@dostleague/shared";
import { streak } from "../src/achievements.js";

let t = Date.parse("2026-10-17T06:00:00Z"); const date = istDateKey(new Date(t)); const KEY = "k".repeat(24);
const qs = [0, 1].map((i) => ({ id: crypto.randomUUID(), position: i, type: "trivia", category: "c", difficulty: 1, prompt: `Q${i}`, options: ["a", "b", "c", "d"], correctIndex: 1, explanation: "e" }));
let repo: MemoryRepo, app: ReturnType<typeof createApp>;
beforeEach(() => { t = Date.parse("2026-10-17T06:00:00Z"); repo = new MemoryRepo(); repo.packs.set(date, { packId: "p", date, version: 1, questions: qs }); app = createApp(repo, { origins: [], secret: "x".repeat(32), adminKey: KEY, now: () => t }); });
const guest = async (n = "A") => `Bearer ${(await request(app).post("/api/guest").send({ displayName: n, avatar: "a1" })).body.token}`;
const sub = { title: "Fruit riddle", type: "riddle", category: "Food", prompt: "Which fruit is yellow and curved?", answer: "Banana", wrongOptions: ["Apple", "Mango", "Grape"], explanation: "Bananas are curved.", difficulty: 1 };
const admin = (r: request.Test) => r.set("x-admin-key", KEY);

describe("submissions", () => {
  it("validates input and keeps new submissions pending and private", async () => {
    const a = await guest();
    expect((await request(app).post("/api/submissions").set("Authorization", a).send({ ...sub, title: "<script>x</script>" })).status).toBe(400);
    const r = await request(app).post("/api/submissions").set("Authorization", a).send(sub); expect(r.status).toBe(201); expect(r.body.status).toBe("pending");
    expect((await request(app).get("/api/submissions/approved")).body.rows).toHaveLength(0);
  });
  it("requires 3 distinct wrong options", async () => {
    const a = await guest(); expect((await request(app).post("/api/submissions").set("Authorization", a).send({ ...sub, wrongOptions: ["Apple", "banana", "Grape"] })).status).toBe(400); expect((await request(app).post("/api/submissions").set("Authorization", a).send({ ...sub, wrongOptions: ["Apple"] })).status).toBe(400);
  });
  it("limits submissions per player per day", async () => {
    const a = await guest(); for (let i = 0; i < 5; i++) expect((await request(app).post("/api/submissions").set("Authorization", a).send(sub)).status).toBe(201);
    expect((await request(app).post("/api/submissions").set("Authorization", a).send(sub)).status).toBe(429);
  });
});
describe("moderation", () => {
  it("requires the admin key", async () => { expect((await request(app).get("/api/admin/submissions")).status).toBe(401); expect((await admin(request(app).get("/api/admin/submissions"))).status).toBe(200); });
  it("approve publishes without the answer, records the action, blocks invalid transitions, supports reports and removal", async () => {
    const a = await guest(); const { id } = (await request(app).post("/api/submissions").set("Authorization", a).send(sub)).body;
    expect((await admin(request(app).post(`/api/admin/submissions/${id}/moderate`)).send({ action: "remove", reason: "nope" })).status).toBe(409);
    expect((await admin(request(app).post(`/api/admin/submissions/${id}/moderate`)).send({ action: "approve", reason: "ok" })).body.status).toBe("approved"); expect(repo.actions).toHaveLength(1);
    const pub = (await request(app).get("/api/submissions/approved")).body.rows; expect(pub).toHaveLength(1); expect(JSON.stringify(pub)).not.toMatch(/Banana|curved\./);
    expect((await request(app).post(`/api/submissions/${id}/report`).set("Authorization", a).send({ reason: "spam" })).status).toBe(201); expect((await admin(request(app).get("/api/admin/reports"))).body.rows).toHaveLength(1);
    await admin(request(app).post(`/api/admin/submissions/${id}/moderate`)).send({ action: "remove", reason: "reported" }); expect((await request(app).get("/api/submissions/approved")).body.rows).toHaveLength(0);
  });
  it("rejects with a recorded reason", async () => {
    const a = await guest(); const { id } = (await request(app).post("/api/submissions").set("Authorization", a).send(sub)).body;
    await admin(request(app).post(`/api/admin/submissions/${id}/moderate`)).send({ action: "reject", reason: "duplicate question" }); expect(repo.actions[0]).toMatchObject({ action: "reject", reason: "duplicate question" });
  });
});
describe("profile and achievements", () => {
  it("grants first_dangal and contributor, and updates the profile", async () => {
    const a = await guest(); await request(app).post("/api/daily/start").set("Authorization", a);
    for (const q of qs) { t += 1000; await request(app).post("/api/daily/answer").set("Authorization", a).send({ questionId: q.id, choice: 1 }); }
    const { id } = (await request(app).post("/api/submissions").set("Authorization", a).send(sub)).body; await admin(request(app).post(`/api/admin/submissions/${id}/moderate`)).send({ action: "approve", reason: "good" });
    const p = (await request(app).get("/api/profile/me").set("Authorization", a)).body; const earned = p.achievements.filter((x: { earned: boolean }) => x.earned).map((x: { code: string }) => x.code);
    expect(earned).toEqual(expect.arrayContaining(["first_dangal", "contributor"])); expect(p.stats.dailyCount).toBe(1);
    expect((await request(app).post("/api/profile").set("Authorization", a).send({ displayName: "Asha K", avatar: "a3" })).body.player.displayName).toBe("Asha K");
  });
  it("computes streaks", () => { expect(streak(["2026-10-17", "2026-10-16", "2026-10-15", "2026-10-12"], "2026-10-17")).toBe(3); expect(streak(["2026-10-16"], "2026-10-17")).toBe(1); expect(streak([], "2026-10-17")).toBe(0); });
});
