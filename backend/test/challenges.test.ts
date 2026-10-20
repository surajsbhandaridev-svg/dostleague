import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { MemoryRepo } from "../src/repo.js";
import { istDateKey } from "@dostleague/shared";

let t = Date.parse("2026-10-17T06:00:00Z"); const date = istDateKey(new Date(t));
const qs = [0, 1, 2].map((i) => ({ id: crypto.randomUUID(), position: i, type: "trivia", category: "c", difficulty: 1, prompt: `Q${i}`, options: ["a", "b", "c", "d"], correctIndex: 1, explanation: "e" }));
let repo: MemoryRepo, app: ReturnType<typeof createApp>;
beforeEach(() => { t = Date.parse("2026-10-17T06:00:00Z"); repo = new MemoryRepo(); repo.packs.set(date, { packId: "p1", date, version: 1, questions: qs }); app = createApp(repo, { origins: [], secret: "x".repeat(32), now: () => t }); });
const guest = async (n: string) => `Bearer ${(await request(app).post("/api/guest").send({ displayName: n, avatar: "a1" })).body.token}`;
async function play(auth: string, base: string, choice: number) { await request(app).post(`${base}/start`).set("Authorization", auth); let last: any; for (const q of qs) { t += 1000; last = await request(app).post(`${base}/answer`).set("Authorization", auth).send({ questionId: q.id, choice }); } return last.body.result; }

describe("results and personal best", () => {
  it("reports previousBest", async () => { const a = await guest("A"); const r = await play(a, "/api/daily", 1); expect(r.previousBest).toBeNull(); expect(r.accuracy).toBe(100); });
});
describe("friend challenges", () => {
  it("requires a completed daily, verifies scores server-side, and allows one opponent", async () => {
    const a = await guest("A"), b = await guest("B"), c = await guest("C");
    expect((await request(app).post("/api/challenges").set("Authorization", a)).status).toBe(409);
    await play(a, "/api/daily", 1); const { code } = (await request(app).post("/api/challenges").set("Authorization", a)).body;
    const view = (await request(app).get(`/api/challenges/${code}`)).body; expect(view.status).toBe("open"); expect(view.challenger.correct).toBe(3); expect(JSON.stringify(view)).not.toMatch(/correctIndex/);
    expect((await request(app).post(`/api/challenges/${code}/start`).set("Authorization", a)).status).toBe(403);
    const res = await play(b, `/api/challenges/${code}`, 0); expect(res.saved).toBe(true);
    const done = (await request(app).get(`/api/challenges/${code}`)).body; expect(done.status).toBe("completed"); expect(done.winner).toBe("challenger"); expect(done.opponent.name).toBe("B");
    expect((await request(app).post(`/api/challenges/${code}/start`).set("Authorization", c)).status).toBe(409);
  });
  it("expires abandoned challenges", async () => {
    const a = await guest("A"), b = await guest("B"); await play(a, "/api/daily", 1); const { code } = (await request(app).post("/api/challenges").set("Authorization", a)).body;
    t += 4 * 86400_000; expect((await request(app).get(`/api/challenges/${code}`)).body.status).toBe("expired"); expect((await request(app).post(`/api/challenges/${code}/start`).set("Authorization", b)).status).toBe(410);
  });
  it("404s unknown codes", async () => { expect((await request(app).get("/api/challenges/NOPE1234")).status).toBe(404); });
});
describe("leaderboards", () => {
  it("serves daily, weekly and all-time with the same ordering", async () => {
    const a = await guest("A"), b = await guest("B"); await play(a, "/api/daily", 1); await play(b, "/api/daily", 0);
    for (const p of ["daily", "weekly", "all"]) { const r = (await request(app).get(`/api/leaderboard/${p}`)).body; expect(r.rows.map((x: { name: string }) => x.name)).toEqual(["A", "B"]); }
    expect((await request(app).get("/api/leaderboard/monthly")).status).toBe(400);
  });
});

describe("friends and preview", () => {
  it("completing a challenge makes friends; friends leaderboard excludes strangers", async () => {
    const a = await guest("A"), b = await guest("B"), c = await guest("C");
    await play(a, "/api/daily", 1); const { code } = (await request(app).post("/api/challenges").set("Authorization", a)).body; await play(b, `/api/challenges/${code}`, 0); await play(b, "/api/daily", 0); await play(c, "/api/daily", 1);
    const rows = (await request(app).get("/api/leaderboard/friends?period=daily").set("Authorization", b)).body.rows; expect(rows.map((r: { name: string }) => r.name)).toEqual(["A", "B"]);
  });
  it("previews today's challenge without questions", async () => { const r = (await request(app).get("/api/daily/preview")).body; expect(r.total).toBe(3); expect(JSON.stringify(r)).not.toMatch(/prompt|correctIndex/); });
});

describe("category rankings", () => {
  it("ranks players by points in one category", async () => {
    const a = await guest("A"), b = await guest("B"); await play(a, "/api/daily", 1); await play(b, "/api/daily", 0);
    const r = (await request(app).get("/api/leaderboard/category/c?period=daily")).body; expect(r.rows.map((x: { name: string }) => x.name)).toEqual(["A"]); expect(r.rows[0].score).toBeGreaterThan(0);
    expect((await request(app).get("/api/leaderboard/category/Nope?period=daily")).body.rows).toHaveLength(0);
  });
});

describe("site stats", () => {
  it("reports real counts only", async () => {
    let s = (await request(app).get("/api/stats")).body; expect(s).toMatchObject({ dailyPacks: 1, dailyQuestions: 3, communityChallenges: 0, matchesPlayed: 0, players: 0 });
    await guest("A"); s = (await request(app).get("/api/stats")).body; expect(s.players).toBe(1);
  });
});
