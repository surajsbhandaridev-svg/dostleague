import { randomInt, randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import { z } from "zod";
import { scoreAnswer, istDateKey } from "@dostleague/shared";
import { hashToken } from "./auth.js";
import type { Repo, Player, FullQuestion } from "./repo.js";
import { generateMode } from "./questions.js";
import { ROOM_MODES } from "./modes.js";

export interface RoomCfg { countdownMs: number; questionMs: number; revealMs: number; graceMs: number; ttlMs: number; captionMs: number; voteMs: number }
export const defaultCfg: RoomCfg = { countdownMs: 3000, questionMs: 15000, revealMs: 4000, graceMs: 30000, ttlMs: 3600_000, captionMs: 30000, voteMs: 20000 };
type Status = "waiting" | "countdown" | "playing" | "reveal" | "captioning" | "voting" | "completed" | "voided";
interface Cap { round: number; prompts: string[]; captions: Map<string, string>; votes: Map<string, string>; order: string[] }
const CAPTION_PROMPTS = ["🐱 in a tiny chef hat watching the toast burn", "🐘 trying to hide behind a lamp post", "🚀 landing in the middle of a vegetable garden", "🧑‍🚀 ordering chai on the moon", "🐶 caught napping in the boss's chair", "🦆 leading a very long traffic jam", "👵 teaching a robot to dance", "☂️ an umbrella with a mind of its own"];
interface RP { player: Player; ready: boolean; sid: string | null; score: number; correct: number; ms: number; answers: Map<string, { choice: number; points: number; ms: number }>; drop?: NodeJS.Timeout }
interface Room { code: string; hostId: string; status: Status; mode: string; max: number; players: Map<string, RP>; touched: number; matchId: string; packId: string; startedAt: number; qs: FullQuestion[]; idx: number; deadline: number; timer?: NodeJS.Timeout; finalized: boolean; cap?: Cap; sig?: string }
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code6 = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/) });
const pubQ = (q: FullQuestion) => ({ id: q.id, type: q.type, category: q.category, prompt: q.prompt, options: q.options });

export function attachRooms(io: Server, repo: Repo, secret: string, cfg: RoomCfg = defaultCfg, now: () => number = Date.now) {
  const rooms = new Map<string, Room>(); const inRoom = new Map<string, string>(); const creates = new Map<string, number[]>();
  const view = (r: Room) => ({ code: r.code, hostId: r.hostId, status: r.status, mode: r.mode, maxPlayers: r.max, index: r.idx, total: r.cap ? r.cap.prompts.length : r.qs.length,
    players: [...r.players.values()].map((p) => ({ id: p.player.id, name: p.player.displayName, avatar: p.player.avatar, ready: p.ready, connected: p.sid !== null, score: p.score, answered: r.status === "playing" && p.answers.has(r.qs[r.idx]?.id) })) });
  const persist = (r: Room, status: string) => void repo.saveRoom({ code: r.code, hostId: r.hostId, mode: r.mode, status, maxPlayers: r.max, expiresAt: new Date(r.touched + cfg.ttlMs), players: [...r.players].map(([id, p]) => ({ id, ready: p.ready })) }).catch(() => {});
  const push = (r: Room) => { io.to(r.code).emit("room:update", view(r));
    const sig = [r.status, r.mode, r.hostId, ...[...r.players].map(([id, p]) => id + p.ready)].join("|"); // write to the DB only when room metadata changes
    if (sig !== r.sig) { r.sig = sig; persist(r, ["waiting", "completed", "voided"].includes(r.status) ? r.status : "playing"); } };

  function startQuestion(r: Room) {
    r.status = "playing"; r.deadline = now() + cfg.questionMs;
    io.to(r.code).emit("match:question", { index: r.idx, total: r.qs.length, question: pubQ(r.qs[r.idx]), deadline: r.deadline, serverNow: now() });
    push(r); r.timer = setTimeout(() => endQuestion(r), cfg.questionMs);
  }
  function endQuestion(r: Room) {
    if (r.status !== "playing") return; // idempotent: timer and "all answered" may both fire
    clearTimeout(r.timer); r.status = "reveal"; const q = r.qs[r.idx];
    io.to(r.code).emit("match:questionResult", { questionId: q.id, correctIndex: q.correctIndex, explanation: q.explanation, results: [...r.players.values()].map((p) => ({ playerId: p.player.id, choice: p.answers.get(q.id)?.choice ?? null, points: p.answers.get(q.id)?.points ?? 0, score: p.score })) });
    push(r); r.timer = setTimeout(() => { r.idx++; r.idx < r.qs.length ? startQuestion(r) : void finalize(r); }, cfg.revealMs);
  }
  async function finalize(r: Room) {
    if (r.finalized) return; r.finalized = true; r.status = "completed";
    const sorted = [...r.players.values()].sort((a, b) => b.score - a.score || a.ms - b.ms); let prev: RP | null = null; let rank = 0;
    const board = sorted.map((p, i) => { if (!prev || p.score !== prev.score || p.ms !== prev.ms) rank = i + 1; prev = p; return { playerId: p.player.id, name: p.player.displayName, score: p.score, correct: p.correct, totalMs: p.ms, rank }; });
    let saved = false;
    try { saved = (await repo.saveMatch({ idempotencyKey: `room:${r.code}:${r.matchId}`, packId: r.packId || null, mode: r.mode, startedAt: new Date(r.startedAt), results: board.map((b) => ({ playerId: b.playerId, score: b.score, correct: b.correct, rank: b.rank })),
      answers: [...r.players.values()].flatMap((p) => [...p.answers].map(([questionId, a]) => ({ questionId, playerId: p.player.id, choice: a.choice, points: a.points, ms: a.ms }))) })).saved; } catch (e) { console.error("saveMatch failed"); }
    io.to(r.code).emit("match:complete", { scoreboard: board, saved }); push(r);
  }
  function removePlayer(r: Room, pid: string) {
    r.players.delete(pid); inRoom.delete(pid);
    if (r.players.size === 0) { clearTimeout(r.timer); rooms.delete(r.code); return; }
    if (r.hostId === pid) r.hostId = r.players.keys().next().value as string; push(r);
  }
  function voidIfEmpty(r: Room) { if (["countdown", "playing", "reveal", "captioning", "voting"].includes(r.status) && ![...r.players.values()].some((p) => p.sid)) { clearTimeout(r.timer); r.status = "voided"; r.finalized = true; push(r); } }
  function sweep() { for (const r of rooms.values()) if (now() - r.touched > cfg.ttlMs && r.status !== "playing") { persist(r, "expired"); clearTimeout(r.timer); io.to(r.code).emit("room:expired", { code: r.code }); for (const id of r.players.keys()) inRoom.delete(id); rooms.delete(r.code); } }

  const shuffled = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = randomInt(i + 1); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  type Emitter = { emit: (e: string, d: unknown) => unknown };
  const emitRound = (r: Room, to: Emitter) => to.emit("caption:round", { round: r.cap!.round, total: r.cap!.prompts.length, prompt: r.cap!.prompts[r.cap!.round], deadline: r.deadline, serverNow: now() });
  const emitVoting = (r: Room, to: Emitter) => to.emit("caption:voting", { round: r.cap!.round, captions: r.cap!.order.map((pid, i) => ({ id: i, text: r.cap!.captions.get(pid) })), deadline: r.deadline, serverNow: now() }); // authors stay hidden until the result
  function startCaptionRound(r: Room) { const c = r.cap!; c.captions.clear(); c.votes.clear(); c.order = []; r.status = "captioning"; r.deadline = now() + cfg.captionMs; emitRound(r, io.to(r.code)); push(r); r.timer = setTimeout(() => startVoting(r), cfg.captionMs); }
  function startVoting(r: Room) {
    if (r.status !== "captioning") return; clearTimeout(r.timer); const c = r.cap!; c.order = shuffled([...c.captions.keys()]); r.status = "voting";
    if (c.order.length < 2) return endCaptionRound(r); // nothing to vote on
    r.deadline = now() + cfg.voteMs; emitVoting(r, io.to(r.code)); push(r); r.timer = setTimeout(() => endCaptionRound(r), cfg.voteMs);
  }
  function endCaptionRound(r: Room) {
    if (r.status !== "voting") return; clearTimeout(r.timer); const c = r.cap!; const tally = new Map<string, number>();
    for (const target of c.votes.values()) { tally.set(target, (tally.get(target) ?? 0) + 1); const p = r.players.get(target); if (p) p.score += 100; } // 100 points per vote received; self-votes are rejected
    r.status = "reveal"; io.to(r.code).emit("caption:result", { round: c.round, captions: c.order.map((pid) => ({ author: r.players.get(pid)?.player.displayName ?? "?", text: c.captions.get(pid), votes: tally.get(pid) ?? 0 })) }); push(r);
    r.timer = setTimeout(() => { c.round++; c.round < c.prompts.length ? startCaptionRound(r) : void finalize(r); }, cfg.revealMs);
  }
  io.use(async (socket, next) => { const t = socket.handshake.auth?.token; const p = typeof t === "string" ? await repo.playerByTokenHash(hashToken(t, secret)) : null; if (!p) return next(new Error("unauthorized")); socket.data.player = p; next(); });
  io.on("connection", (socket) => {
    const me: Player = socket.data.player;
    const mine = () => { const c = inRoom.get(me.id); return c ? rooms.get(c) : undefined; };
    const rp = (r: Room) => r.players.get(me.id)!;
    const reattach = (r: Room) => { const p = rp(r); clearTimeout(p.drop); p.sid = socket.id; socket.join(r.code); r.touched = now(); socket.emit("room:update", view(r)); io.to(r.code).emit("player:reconnected", { playerId: me.id });
      if (r.status === "playing") socket.emit("match:question", { index: r.idx, total: r.qs.length, question: pubQ(r.qs[r.idx]), deadline: r.deadline, serverNow: now() }); if (r.status === "captioning") emitRound(r, socket); if (r.status === "voting") emitVoting(r, socket); push(r); };
    let win = 0, cnt = 0; // per-socket flood guard: max 20 events/second
    const on = <T>(ev: string, schema: z.ZodType<T>, fn: (d: T) => Promise<object | void> | object | void) => socket.on(ev, async (raw: unknown, ack?: (r: unknown) => void) => {
      const tn = now(); if (tn - win > 1000) { win = tn; cnt = 0; } if (++cnt > 20) { ack?.({ ok: false, error: "rate_limited" }); return; }
      try { const d = schema.parse(raw ?? {}); const out = await fn(d); ack?.({ ok: true, ...(out ?? {}) }); } catch (e) { ack?.({ ok: false, error: e instanceof z.ZodError ? "invalid_input" : (e as Error).message }); } });
    const fail = (m: string): never => { throw new Error(m); };

    socket.emit("hello", { playerId: me.id });
    const existing = mine(); if (existing) reattach(existing);

    on("room:create", z.object({ maxPlayers: z.number().int().min(2).max(6).default(2) }), ({ maxPlayers }) => {
      if (mine()) fail("already_in_room");
      const t = now(); const hist = (creates.get(me.id) ?? []).filter((x) => t - x < 60_000); if (hist.length >= 5) fail("rate_limited"); creates.set(me.id, [...hist, t]);
      let code = ""; do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""); } while (rooms.has(code));
      const r: Room = { code, hostId: me.id, status: "waiting", mode: "daily", max: maxPlayers ?? 2, players: new Map(), touched: t, matchId: randomUUID(), packId: "", startedAt: 0, qs: [], idx: 0, deadline: 0, finalized: false };
      r.players.set(me.id, { player: me, ready: true, sid: socket.id, score: 0, correct: 0, ms: 0, answers: new Map() }); rooms.set(code, r); inRoom.set(me.id, code); socket.join(code); push(r); return { code };
    });
    on("room:join", code6, ({ code }) => {
      const r = rooms.get(code) ?? fail("room_not_found");
      if (r.players.has(me.id)) { inRoom.set(me.id, code); reattach(r); return { code }; }
      if (mine()) fail("already_in_room"); if (r.status !== "waiting") fail("match_in_progress"); if (r.players.size >= r.max) fail("room_full");
      r.players.set(me.id, { player: me, ready: false, sid: socket.id, score: 0, correct: 0, ms: 0, answers: new Map() }); inRoom.set(me.id, code); r.touched = now(); socket.join(code); push(r); return { code };
    });
    on("room:leave", z.object({}), () => { const r = mine(); if (!r) return; socket.leave(r.code); removePlayer(r, me.id); });
    for (const [ev, v] of [["room:ready", true], ["room:unready", false]] as const) on(ev, z.object({}), () => { const r = mine() ?? fail("not_in_room"); if (r.status !== "waiting") fail("bad_state"); rp(r).ready = v; r.touched = now(); push(r); });
    on("match:start", z.object({}), async () => {
      const r = mine() ?? fail("not_in_room"); if (r.hostId !== me.id) fail("not_host"); if (r.status !== "waiting") fail("bad_state");
      if (r.players.size < 2) fail("need_more_players"); if ([...r.players.values()].some((p) => !p.ready)) fail("players_not_ready");
      if (r.mode === "caption") { // Caption Battle: write captions, then vote (no self-votes); 100 points per vote received
        r.cap = { round: 0, prompts: shuffled(CAPTION_PROMPTS).slice(0, 3), captions: new Map(), votes: new Map(), order: [] }; r.qs = []; r.packId = ""; r.idx = 0; r.finalized = false; r.startedAt = now(); r.status = "countdown";
        for (const p of r.players.values()) { p.score = 0; p.correct = 0; p.ms = 0; p.answers.clear(); }
        io.to(r.code).emit("match:countdown", { startsAt: now() + cfg.countdownMs, serverNow: now() }); push(r); r.timer = setTimeout(() => startCaptionRound(r), cfg.countdownMs); return;
      }
      let qs: FullQuestion[]; let packId = "";
      if (r.mode === "daily") { const pack = await repo.dailyPack(istDateKey(new Date(now()))); if (!pack?.questions.length) fail("no_questions"); qs = pack!.questions.slice(0, 5); packId = pack!.packId; }
      else if (r.mode === "community") {
        const subs = await repo.approvedForPlay(5); if (subs.length < 3) fail("not_enough_community_questions");
        qs = subs.map((x, i) => { const opts = [x.answer, ...x.wrongOptions]; for (let k = 3; k > 0; k--) { const j = randomInt(k + 1); [opts[k], opts[j]] = [opts[j], opts[k]]; } return { id: randomUUID(), position: i, type: x.type, category: x.category, difficulty: x.difficulty, prompt: x.prompt, options: opts, correctIndex: opts.indexOf(x.answer), explanation: x.explanation }; });
      } else qs = generateMode(r.mode as "trivia", randomInt(1_000_000, 9_000_000)).map((q, i) => ({ id: randomUUID(), position: i, type: q.type, category: q.category, difficulty: q.difficulty, prompt: q.prompt, options: q.options, correctIndex: q.correct, explanation: q.explanation }));
      if (r.status !== "waiting") fail("bad_state"); // re-check after await
      r.qs = qs; r.packId = packId; r.idx = 0; r.finalized = false; r.startedAt = now(); r.status = "countdown";
      for (const p of r.players.values()) { p.score = 0; p.correct = 0; p.ms = 0; p.answers.clear(); }
      io.to(r.code).emit("match:countdown", { startsAt: now() + cfg.countdownMs, serverNow: now() }); push(r); r.timer = setTimeout(() => startQuestion(r), cfg.countdownMs);
    });
    on("answer:submit", z.object({ questionId: z.string().uuid(), choice: z.number().int().min(0).max(3) }), ({ questionId, choice }) => {
      const r = mine() ?? fail("not_in_room"); const q = r.qs[r.idx]; if (r.status !== "playing" || q?.id !== questionId) fail("not_active_question");
      const t = now(); const p = rp(r); if (p.answers.has(q.id)) fail("already_answered"); if (t > r.deadline) fail("too_late");
      const ms = cfg.questionMs - (r.deadline - t); const correct = choice === q.correctIndex; const points = scoreAnswer(correct, ms, cfg.questionMs);
      p.answers.set(q.id, { choice, points, ms }); p.score += points; p.correct += correct ? 1 : 0; p.ms += ms;
      socket.emit("answer:accepted", { questionId }); io.to(r.code).emit("player:progress", { answered: [...r.players.values()].filter((x) => x.answers.has(q.id)).map((x) => x.player.id) }); push(r);
      if ([...r.players.values()].filter((x) => x.sid).every((x) => x.answers.has(q.id))) endQuestion(r);
    });
    on("match:rematch", z.object({}), () => { const r = mine() ?? fail("not_in_room"); if (r.hostId !== me.id) fail("not_host"); if (r.status !== "completed") fail("bad_state");
      r.status = "waiting"; r.cap = undefined; r.matchId = randomUUID(); r.idx = 0; r.qs = []; for (const p of r.players.values()) { p.ready = p.player.id === r.hostId; p.score = 0; p.correct = 0; p.ms = 0; p.answers.clear(); } push(r); });
    on("room:setMode", z.object({ mode: z.enum(ROOM_MODES) }), ({ mode }) => { const r = mine() ?? fail("not_in_room"); if (r.hostId !== me.id) fail("not_host"); if (r.status !== "waiting") fail("bad_state"); r.mode = mode; r.touched = now(); push(r); });
    on("caption:submit", z.object({ text: z.string().trim().min(2).max(80).regex(/^[^<>\u0000-\u001f]+$/) }), ({ text }) => {
      const r = mine() ?? fail("not_in_room"); const c = r.cap; if (r.status !== "captioning" || !c) fail("not_captioning"); if (now() > r.deadline) fail("too_late"); if (c!.captions.has(me.id)) fail("already_submitted");
      c!.captions.set(me.id, text); r.touched = now(); if ([...r.players.values()].filter((x) => x.sid).every((x) => c!.captions.has(x.player.id))) startVoting(r);
    });
    on("caption:vote", z.object({ captionId: z.number().int().min(0).max(5) }), ({ captionId }) => {
      const r = mine() ?? fail("not_in_room"); const c = r.cap; if (r.status !== "voting" || !c) fail("not_voting"); if (now() > r.deadline) fail("too_late");
      const target = c!.order[captionId]; if (!target) fail("invalid_caption"); if (target === me.id) fail("own_caption"); if (c!.votes.has(me.id)) fail("already_voted");
      c!.votes.set(me.id, target); if ([...r.players.values()].filter((x) => x.sid).every((x) => c!.votes.has(x.player.id))) endCaptionRound(r);
    });
    socket.on("disconnect", () => { const r = mine(); if (!r) return; const p = rp(r); if (p.sid !== socket.id) return; p.sid = null; push(r);
      p.drop = setTimeout(() => { if (p.sid) return; if (r.status === "waiting" || r.status === "completed") removePlayer(r, me.id); else voidIfEmpty(r); }, cfg.graceMs); voidIfEmpty(r); });
  });
  return { rooms, sweep };
}
