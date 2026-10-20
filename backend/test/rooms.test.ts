import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server as H } from "node:http";
import { Server } from "socket.io";
import { io as client, type Socket } from "socket.io-client";
import { createApp } from "../src/app.js";
import { MemoryRepo } from "../src/repo.js";
import { attachRooms } from "../src/rooms.js";
import { hashToken } from "../src/auth.js";
import { istDateKey } from "@dostleague/shared";

const secret = "s".repeat(32); const cfg = { countdownMs: 20, questionMs: 600, revealMs: 20, graceMs: 100, ttlMs: 1000, captionMs: 400, voteMs: 400 };
let skew = 0, http: H, repo: MemoryRepo, rooms: ReturnType<typeof attachRooms>, url: string; const socks: Socket[] = [];
const qs = [0, 1].map((i) => ({ id: crypto.randomUUID(), position: i, type: "trivia", category: "c", difficulty: 1, prompt: `Q${i}`, options: ["a", "b", "c", "d"], correctIndex: 1, explanation: "e" }));
const ask = (s: Socket, ev: string, d?: unknown) => new Promise<any>((res) => s.emit(ev, d, res));
const wait = (s: Socket, ev: string) => new Promise<any>((res) => s.once(ev, res));
async function player(name: string) { const token = `tok-${name}`; await repo.createGuest(name, "a1", hashToken(token, secret)); const s = client(url, { auth: { token } }); socks.push(s); await wait(s, "connect"); return s; }
beforeEach(async () => {
  skew = 0; repo = new MemoryRepo(); repo.packs.set(istDateKey(), { packId: "pack", date: istDateKey(), version: 1, questions: qs });
  http = createServer(createApp(repo, { origins: [], secret })); rooms = attachRooms(new Server(http), repo, secret, cfg, () => Date.now() + skew);
  await new Promise<void>((r) => http.listen(0, r)); url = `http://localhost:${(http.address() as { port: number }).port}`;
});
afterEach(() => { socks.splice(0).forEach((s) => s.close()); http.close(); });

describe("rooms", () => {
  it("rejects invalid codes and unauthenticated sockets", async () => {
    const a = await player("A"); expect((await ask(a, "room:join", { code: "ZZZZZZ" })).error).toBe("room_not_found"); expect((await ask(a, "room:join", { code: "x" })).error).toBe("invalid_input");
    const bad = client(url, { auth: { token: "nope" } }); socks.push(bad); expect((await wait(bad, "connect_error")).message).toBe("unauthorized");
  });
  it("enforces host-only start and ready state", async () => {
    const a = await player("A"), b = await player("B"); const { code } = await ask(a, "room:create", {}); await ask(b, "room:join", { code });
    expect((await ask(b, "match:start")).error).toBe("not_host"); expect((await ask(a, "match:start")).error).toBe("players_not_ready");
    await ask(b, "room:ready"); expect((await ask(a, "match:start")).ok).toBe(true);
  });
  it("runs a full 2-player match, scores on the server, saves once", async () => {
    const a = await player("A"), b = await player("B"); const { code } = await ask(a, "room:create", {}); await ask(b, "room:join", { code }); await ask(b, "room:ready");
    let dup: any; const done = wait(a, "match:complete");
    for (const [s, pick] of [[a, 1], [b, 0]] as const) s.on("match:question", async (m) => { const r = await ask(s, "answer:submit", { questionId: m.question.id, choice: pick }); if (s === a && m.index === 0) dup = await ask(a, "answer:submit", { questionId: m.question.id, choice: 1 }); expect(r.ok).toBe(true); });
    await ask(a, "match:start"); const res = await done;
    expect(dup.error).toBe("already_answered"); expect(res.scoreboard[0].name).toBe("A"); expect(res.scoreboard[0].correct).toBe(2); expect(res.scoreboard[1].score).toBe(0); expect(res.saved).toBe(true);
    expect(repo.matches).toHaveLength(1); expect((await repo.saveMatch(repo.matches[0])).saved).toBe(false);
  });
  it("expires idle rooms", async () => {
    const a = await player("A"); const { code } = await ask(a, "room:create", {}); expect(rooms.rooms.has(code)).toBe(true); skew = 5000; rooms.sweep(); expect(rooms.rooms.has(code)).toBe(false);
  });
});

describe("modes", () => {
  it("host picks a mode and questions match it; non-host cannot", async () => {
    const a = await player("A"), b = await player("B"); const { code } = await ask(a, "room:create", {}); await ask(b, "room:join", { code }); await ask(b, "room:ready");
    expect((await ask(b, "room:setMode", { mode: "pattern" })).error).toBe("not_host"); expect((await ask(a, "room:setMode", { mode: "pattern" })).ok).toBe(true);
    const q = wait(a, "match:question"); await ask(a, "match:start"); const m = await q; expect(m.question.type).toBe("pattern"); expect(JSON.stringify(m)).not.toMatch(/correctIndex/);
  });
});

describe("community mode", () => {
  const seed = async (n: number) => { const author = [...repo.players.keys()][0]; for (let i = 0; i < n; i++) { const id = await repo.createSubmission(author, { title: `T${i}`, type: "riddle", category: "Food", prompt: `Community question ${i}?`, answer: `Right${i}`, wrongOptions: ["w1", "w2", "w3"], explanation: "because", difficulty: 1 }); await repo.moderate(id, "pending", "approved", "approve", "ok"); } };
  it("plays approved submissions with shuffled options", async () => {
    const a = await player("A"), b = await player("B"); await seed(3); const { code } = await ask(a, "room:create", {}); await ask(b, "room:join", { code }); await ask(b, "room:ready"); await ask(a, "room:setMode", { mode: "community" });
    const q = wait(a, "match:question"); expect((await ask(a, "match:start")).ok).toBe(true); const m = await q; expect(m.question.options).toHaveLength(4); expect(m.question.prompt).toMatch(/Community question/); expect(JSON.stringify(m)).not.toMatch(/correctIndex|because/);
  });
  it("refuses to start without enough approved questions", async () => {
    const a = await player("A"), b = await player("B"); await seed(2); const { code } = await ask(a, "room:create", {}); await ask(b, "room:join", { code }); await ask(b, "room:ready"); await ask(a, "room:setMode", { mode: "community" });
    expect((await ask(a, "match:start")).error).toBe("not_enough_community_questions");
  });
});

describe("caption battle", () => {
  it("runs 3 rounds of captions and votes, blocks self-votes, hides authors, saves once", async () => {
    const a = await player("A"), b = await player("B"); const { code } = await ask(a, "room:create", {}); await ask(b, "room:join", { code }); await ask(b, "room:ready"); await ask(a, "room:setMode", { mode: "caption" });
    let selfErr = "", votingPayload = ""; const done = wait(a, "match:complete");
    for (const [s, name] of [[a, "A"], [b, "B"]] as const) {
      s.on("caption:round", async (m) => { await ask(s, "caption:submit", { text: `${name} round ${m.round}` }); });
      s.on("caption:voting", async (m) => { votingPayload = JSON.stringify(m); const own = m.captions.find((c: { text: string }) => c.text.startsWith(name + " ")); const other = m.captions.find((c: { text: string }) => !c.text.startsWith(name + " "));
        if (name === "A" && m.round === 0) selfErr = (await ask(s, "caption:vote", { captionId: own.id })).error; await ask(s, "caption:vote", { captionId: other.id }); });
    }
    expect((await ask(a, "match:start")).ok).toBe(true); const res = await done;
    expect(selfErr).toBe("own_caption"); expect(votingPayload).not.toMatch(/author|playerId/); expect(res.scoreboard.map((x: { score: number }) => x.score)).toEqual([300, 300]); expect(res.saved).toBe(true); expect(repo.matches[0].mode).toBe("caption");
  });
});
describe("reconnect and persistence", () => {
  it("reattaches a player who reconnects within the grace period", async () => {
    const a = await player("A"), b = await player("B"); const { code } = await ask(a, "room:create", {}); await ask(b, "room:join", { code });
    b.close(); await new Promise((r) => setTimeout(r, 30)); const back = wait(a, "player:reconnected"); const b2 = client(url, { auth: { token: "tok-B" } }); socks.push(b2); const upd = wait(b2, "room:update");
    await back; const v = await upd; expect(v.code).toBe(code); expect(v.players.find((p: { name: string }) => p.name === "B").connected).toBe(true);
  });
  it("removes a waiting player after the grace period", async () => {
    const a = await player("A"), b = await player("B"); const { code } = await ask(a, "room:create", {}); await ask(b, "room:join", { code });
    const shrunk = new Promise<any>((res) => a.on("room:update", (v) => v.players.length === 1 && res(v))); b.close(); expect((await shrunk).players[0].name).toBe("A");
  });
  it("saves room metadata and marks stale rooms voided on restart", async () => {
    const a = await player("A"); const { code } = await ask(a, "room:create", {}); await ask(a, "room:setMode", { mode: "pattern" }); await new Promise((r) => setTimeout(r, 30));
    expect(repo.roomRows.get(code)?.mode).toBe("pattern"); expect(await repo.expireStaleRooms()).toBe(1); expect(repo.roomRows.get(code)?.status).toBe("voided");
  });
});
