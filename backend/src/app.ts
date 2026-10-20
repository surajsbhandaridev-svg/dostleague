import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { randomInt, randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { hashPassword, verifyPassword } from "./passwords.js";
import { generatePractice, generateMode } from "./questions.js";
import { decide, makeBots, mulberry32, type Difficulty } from "./botbrain.js";
import { newGame, submitClue, doScan, proceedToVote, castVote, finalGuess, viewOf, SabError, type Game } from "./saboteur.js";
import { SOLO_MODES } from "./modes.js";
import { ACHIEVEMENTS, earnedCodes, streak } from "./achievements.js";
import { z } from "zod";
import { scoreAnswer, istDateKey } from "@dostleague/shared";
import { hashToken, newToken } from "./auth.js";
import type { Repo, Player, FullQuestion, Pack } from "./repo.js";

export const QUESTION_LIMIT_MS = 15000;
export const REVEAL_PAUSE_MS = 3000; // time to read feedback; not counted against the next question
interface Progress { cats: Record<string, number>; idx: number; servedAt: number; elapsed: number; score: number; correct: number }
type Authed = Request & { player: Player };
const pub = (q: FullQuestion) => ({ id: q.id, type: q.type, category: q.category, difficulty: q.difficulty, prompt: q.prompt, options: q.options });
const guestBody = z.object({ displayName: z.string().trim().min(2).max(24).regex(/^[\p{L}\p{N} _.-]+$/u), avatar: z.enum(["a1", "a2", "a3", "a4", "a5", "a6"]) });
const answerBody = z.object({ questionId: z.string().uuid(), choice: z.number().int().min(0).max(3) });

export function createApp(repo: Repo, opts: { origins: string[]; secret: string; adminKey?: string; now?: () => number }) {
  const now = opts.now ?? Date.now; const app = express(); app.set("trust proxy", 1); // behind Render's proxy: use the real client IP for rate limits
  const progress = new Map<string, Progress>(); // in-progress daily runs; lost on restart (finalized scores are in the DB)
  const hits = new Map<string, number[]>();
  const limit = (name: string, max: number, windowMs: number) => (req: Request, res: Response, next: NextFunction) => {
    const k = `${name}:${req.ip}`; const t = now(); const arr = (hits.get(k) ?? []).filter((x) => t - x < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: "rate_limited" });
    arr.push(t); hits.set(k, arr); if (hits.size > 5000) for (const [kk, v] of hits) if (!v.some((x) => t - x < 3600_000)) hits.delete(kk); next();
  };
  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
  // Express 4 does not automatically forward rejected async middleware promises.
  // Explicitly forward database/session lookup failures to the error handler.
  const auth = (req: Request, res: Response, next: NextFunction) => {
    const m = /^Bearer (.+)$/.exec(req.header("authorization") ?? "");
    if (!m) return res.status(401).json({ error: "unauthorized" });
    repo.playerByTokenHash(hashToken(m[1], opts.secret)).then((p) => {
      if (!p) return res.status(401).json({ error: "unauthorized" });
      (req as Authed).player = p;
      next();
    }).catch(next);
  };

  app.use(helmet()); app.use(cors({ origin: opts.origins })); app.use(express.json({ limit: "20kb" }));
  app.get("/health", (_q, r) => r.json({ ok: true }));
  app.get("/health/ready", wrap(async (_q, r) => { try { await repo.dailyPack(istDateKey(new Date(now()))); r.json({ ok: true, db: "up" }); } catch { r.status(503).json({ ok: false, db: "down" }); } }));

  app.post("/api/guest", limit("guest", 10, 3600_000), wrap(async (req, res) => {
    const b = guestBody.safeParse(req.body); if (!b.success) return res.status(400).json({ error: "invalid_input" });
    const token = newToken(); const player = await repo.createGuest(b.data.displayName, b.data.avatar, hashToken(token, opts.secret));
    res.status(201).json({ player, token });
  }));

  const accountBody = z.object({ email: z.string().trim().email().max(254).transform((s) => s.toLowerCase()), password: z.string().min(10).max(128) });
  app.post("/api/auth/register", limit("register", 8, 3600_000), wrap(async (req, res) => {
    const b = z.object({ ...guestBody.shape, ...accountBody.shape }).safeParse(req.body);
    if (!b.success) return res.status(400).json({ error: "invalid_input" });
    if (await repo.accountByEmail(b.data.email)) return res.status(409).json({ error: "email_already_exists" });
    const token = newToken();
    try {
      const player = await repo.createAccount(b.data.displayName, b.data.avatar, b.data.email, hashPassword(b.data.password), hashToken(token, opts.secret));
      return res.status(201).json({ player, token, email: b.data.email, account: true });
    } catch (e) {
      if ((e as { code?: string })?.code === "23505" || (e instanceof Error && e.message === "email_taken")) return res.status(409).json({ error: "email_already_exists" });
      throw e;
    }
  }));
  app.post("/api/auth/login", limit("login", 12, 3600_000), wrap(async (req, res) => {
    const b = accountBody.safeParse(req.body); if (!b.success) return res.status(400).json({ error: "invalid_input" });
    const found = await repo.accountByEmail(b.data.email);
    if (!found || !verifyPassword(b.data.password, found.passwordHash)) return res.status(401).json({ error: "invalid_credentials" });
    const token = newToken(); await repo.createSession(found.player.id, hashToken(token, opts.secret));
    return res.json({ player: found.player, token, email: b.data.email, account: true });
  }));
  app.post("/api/auth/upgrade", auth, limit("upgrade", 8, 3600_000), wrap(async (req, res) => {
    const b = accountBody.safeParse(req.body); if (!b.success) return res.status(400).json({ error: "invalid_input" });
    const player = (req as Authed).player;
    if (await repo.accountEmail(player.id)) return res.status(409).json({ error: "account_already_linked" });
    if (await repo.accountByEmail(b.data.email)) return res.status(409).json({ error: "email_already_exists" });
    try { await repo.linkAccount(player.id, b.data.email, hashPassword(b.data.password)); }
    catch (e) { if ((e as { code?: string })?.code === "23505" || (e instanceof Error && e.message === "email_taken")) return res.status(409).json({ error: "email_already_exists" }); throw e; }
    return res.status(201).json({ player, email: b.data.email, account: true, upgradedGuest: true });
  }));
  app.get("/api/auth/me", auth, wrap(async (req, res) => { const player = (req as Authed).player; const email = await repo.accountEmail(player.id); res.json({ player, email, account: Boolean(email) }); }));
  app.post("/api/auth/logout", wrap(async (req, res) => { const m = /^Bearer (.+)$/.exec(req.header("authorization") ?? ""); if (m) await repo.revokeSession(hashToken(m[1], opts.secret)); res.json({ ok: true }); }));

  const today = () => istDateKey(new Date(now()));
  const loadPack = (): Promise<Pack | null> => repo.dailyPack(today());
  const startRun = (pack: Pack, key: string, res: Response, extra: object = {}) => {
    if (!pack.questions.length) return res.status(503).json({ error: "no_challenge_today" });
    let s = progress.get(key); if (!s) { s = { cats: {}, idx: 0, servedAt: now(), elapsed: 0, score: 0, correct: 0 }; progress.set(key, s); } // resuming never resets the clock
    res.json({ date: pack.date, total: pack.questions.length, index: s.idx, limitMs: QUESTION_LIMIT_MS, question: pub(pack.questions[s.idx]), ...extra });
  };
  const answerRun = async (req: Request, res: Response, pack: Pack, key: string, finalize: (s: Progress) => Promise<object>, extra?: (q: FullQuestion, points: number) => object) => {
    const b = answerBody.safeParse(req.body); if (!b.success) return res.status(400).json({ error: "invalid_input" });
    const s = progress.get(key); const q = s && pack.questions[s.idx]; if (!s || !q) return res.status(409).json({ error: "not_started" });
    if (b.data.questionId !== q.id) return res.status(409).json({ error: "duplicate_or_out_of_order" });
    const elapsed = Math.max(0, now() - s.servedAt); const correct = b.data.choice === q.correctIndex; const points = scoreAnswer(correct, elapsed, QUESTION_LIMIT_MS);
    s.score += points; s.cats[q.category] = (s.cats[q.category] ?? 0) + points; s.correct += correct ? 1 : 0; s.elapsed += Math.min(elapsed, QUESTION_LIMIT_MS); s.idx += 1; s.servedAt = now() + REVEAL_PAUSE_MS;
    const reveal = { correct, correctIndex: q.correctIndex, explanation: q.explanation, points, ...(extra?.(q, points) ?? {}) };
    if (s.idx < pack.questions.length) return res.json({ reveal, index: s.idx, next: pub(pack.questions[s.idx]) });
    const finalExtra = await finalize(s); progress.delete(key);
    res.json({ reveal, result: { score: s.score, correct: s.correct, total: pack.questions.length, totalMs: s.elapsed, accuracy: Math.round((100 * s.correct) / pack.questions.length), ...finalExtra } });
  };

  app.get("/api/stats", wrap(async (_q, res) => res.json(await repo.stats(today())))); // public aggregates for the home page
  app.get("/api/daily/preview", wrap(async (_q, res) => { // public: shape of today's challenge only, no questions or answers
    const pack = await loadPack(); if (!pack) return res.status(404).json({ error: "no_challenge_today" });
    res.json({ date: pack.date, total: pack.questions.length, categories: [...new Set(pack.questions.map((q) => q.category))] });
  }));
  app.post("/api/daily/start", auth, wrap(async (req, res) => {
    const player = (req as Authed).player; const pack = await loadPack(); if (!pack) return res.status(503).json({ error: "no_challenge_today" });
    if (await repo.rankedAttempt(player.id, pack.date)) return res.status(409).json({ error: "already_completed" });
    startRun(pack, `${player.id}:${pack.date}`, res);
  }));
  app.post("/api/daily/answer", auth, wrap(async (req, res) => {
    const player = (req as Authed).player; const pack = await loadPack(); if (!pack) return res.status(503).json({ error: "no_challenge_today" });
    await answerRun(req, res, pack, `${player.id}:${pack.date}`, async (s) => {
      const previousBest = await repo.bestDailyScore(player.id);
      const { saved } = await repo.saveRankedAttempt({ playerId: player.id, date: pack.date, score: s.score, correct: s.correct, totalMs: s.elapsed, createdAt: new Date(now()), categoryScores: s.cats });
      return { saved, previousBest, newAchievements: await refreshAch(player.id) };
    });
  }));

  // --- Practice mode: unranked, server-scored, and saved to private player history (never public competitive leaderboards).
  const practice = new Map<string, { pack: Pack; rng: () => number; bots: { id: string; name: string; avatar: number; difficulty: Difficulty; score: number }[]; runId: string; mode: string; difficulty: Difficulty; startedAt: number }>();
  app.post("/api/practice/start", auth, limit("practice", 60, 3600_000), wrap(async (req, res) => {
    const b = z.object({ mode: z.enum(["mixed", ...SOLO_MODES]).default("mixed"), bots: z.number().int().min(0).max(3).default(0), difficulty: z.enum(["easy", "medium", "hard"]).default("medium") }).safeParse(req.body ?? {}); if (!b.success) return res.status(400).json({ error: "invalid_input" });
    const key = `${(req as Authed).player.id}:practice`; const seed = randomInt(1_000_000, 9_000_000); const src = b.data.mode === "mixed" ? generatePractice(seed) : generateMode(b.data.mode, seed);
    const questions = src.map((q, i) => ({ id: randomUUID(), position: i, type: q.type, category: q.category, difficulty: q.difficulty, prompt: q.prompt, options: q.options, correctIndex: q.correct, explanation: q.explanation }));
    const rng = mulberry32(seed); const bots = makeBots(b.data.bots, b.data.difficulty, rng).map((x) => ({ ...x, score: 0 })); const pack = { packId: "practice", date: "practice", version: 0, questions };
    practice.set(key, { pack, rng, bots, runId: randomUUID(), mode: b.data.mode, difficulty: b.data.difficulty, startedAt: now() }); progress.delete(key); startRun(pack, key, res, { mode: b.data.mode, bots: bots.map((x) => ({ id: x.id, name: x.name, avatar: x.avatar, difficulty: x.difficulty, bot: true })) });
  }));
  app.post("/api/practice/answer", auth, wrap(async (req, res) => { // Unranked results persist to personal history but never enter public competitive leaderboards.
    const player = (req as Authed).player; const key = `${player.id}:practice`; const run = practice.get(key); if (!run) return res.status(409).json({ error: "not_started" });
    const standings = () => [{ id: "you", name: "You", bot: false, score: progress.get(key)?.score ?? 0 }, ...run.bots.map((x) => ({ id: x.id, name: x.name, bot: true, avatar: x.avatar, difficulty: x.difficulty, score: x.score }))];
    await answerRun(req, res, run.pack, key, async (s) => {
      const st = standings();
      const saved = await repo.saveSoloResult({ idempotencyKey: `practice:${run.runId}`, playerId: player.id, gameMode: run.mode, playType: run.bots.length ? "bots" : "solo", score: s.score, correct: s.correct, totalQuestions: run.pack.questions.length, totalMs: s.elapsed, outcome: "completed", details: { difficulty: run.difficulty, botCount: run.bots.length, standings: st } });
      practice.delete(key); return { practice: true, saved, standings: st };
    }, (q) => {
      const rows = run.bots.map((x) => { const d = decide({ type: q.type, prompt: q.prompt, options: q.options }, x.difficulty, run.rng); const ok = d.choice === q.correctIndex; const pts = scoreAnswer(ok, d.ms, QUESTION_LIMIT_MS); x.score += pts; return { id: x.id, name: x.name, correct: ok, points: pts, ms: d.ms }; });
      return { bots: rows, standings: standings() };
    });
  }));

  // --- Signal Saboteur: active round state is temporary, but completed human results are persisted to personal history.
  const sabGames = new Map<string, Game>(); const sabRunIds = new Map<string, string>(); const sabStartedAt = new Map<string, number>(); const sabSaved = new Set<string>();
  const persistSabResult = async (pid: string, g: Game) => {
    const runId = sabRunIds.get(pid); if (!g.result || !runId) return false;
    if (sabSaved.has(runId)) return true;
    const saved = await repo.saveSoloResult({ idempotencyKey: `saboteur:${runId}`, playerId: pid, gameMode: "signal-saboteur", playType: "saboteur", score: g.result.humanWon ? 1000 : 0, correct: g.result.humanWon ? 1 : 0, totalQuestions: 1, totalMs: Math.max(0, now() - (sabStartedAt.get(pid) ?? now())), outcome: g.result.humanWon ? "won" : "lost", details: { winner: g.result.winner, humanRole: g.players[0]?.role, difficulty: g.difficulty, playerCount: g.players.length, reason: g.result.reason } });
    if (saved) sabSaved.add(runId); return saved;
  };
  const sab = (fn: (g: Game, body: any) => void) => [auth, wrap(async (req, res) => {
    const pid = (req as Authed).player.id; const g = sabGames.get(pid); if (!g) return res.status(409).json({ error: "not_started" });
    try { fn(g, req.body ?? {}); } catch (e) { if (e instanceof SabError) return res.status(e.status).json({ error: e.code }); throw e; }
    let resultSaved: boolean | null = null; if (g.result) { try { resultSaved = await persistSabResult(pid, g); } catch { resultSaved = false; } }
    res.json({ ...viewOf(g), resultSaved });
  })] as const;
  app.post("/api/saboteur/start", auth, limit("sab", 30, 3600_000), wrap(async (req, res) => {
    const b = z.object({ players: z.number().int().min(4).max(8).default(5), difficulty: z.enum(["easy", "medium", "hard"]).default("medium") }).safeParse(req.body ?? {}); if (!b.success) return res.status(400).json({ error: "invalid_input" });
    const pid = (req as Authed).player.id; const g = newGame(b.data); sabGames.set(pid, g); sabRunIds.set(pid, randomUUID()); sabStartedAt.set(pid, now()); res.json({ ...viewOf(g), resultSaved: null });
  }));
  app.get("/api/saboteur/state", auth, wrap(async (req, res) => { const pid = (req as Authed).player.id; const g = sabGames.get(pid); if (!g) return res.status(404).json({ error: "not_started" }); let resultSaved: boolean | null = null; if (g.result) { try { resultSaved = await persistSabResult(pid, g); } catch { resultSaved = false; } } res.json({ ...viewOf(g), resultSaved }); }));
  app.post("/api/saboteur/clue", ...sab((g, b) => submitClue(g, String(b.text ?? ""))));
  app.post("/api/saboteur/scan", ...sab((g) => doScan(g)));
  app.post("/api/saboteur/proceed", ...sab((g) => proceedToVote(g)));
  app.post("/api/saboteur/vote", ...sab((g, b) => castVote(g, String(b.target ?? ""))));
  app.post("/api/saboteur/guess", ...sab((g, b) => finalGuess(g, String(b.word ?? ""))));

  // --- asynchronous friend challenges (separate from live rooms)
  const CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  app.post("/api/challenges", auth, limit("chal", 20, 3600_000), wrap(async (req, res) => {
    const player = (req as Authed).player; const pack = await loadPack(); if (!pack) return res.status(503).json({ error: "no_challenge_today" });
    const a = await repo.rankedAttempt(player.id, pack.date); if (!a) return res.status(409).json({ error: "finish_daily_first" }); // score comes from the verified ranked attempt
    const code = Array.from({ length: 8 }, () => CH[randomInt(CH.length)]).join("");
    await repo.createChallenge({ code, challengerId: player.id, packId: pack.packId, expiresAt: new Date(now() + 3 * 86400_000), challengerAttempt: { date: pack.date, score: a.score, correct: a.correct, totalMs: a.totalMs } });
    res.status(201).json({ code });
  }));
  app.get("/api/challenges/:code", wrap(async (req, res) => {
    const c = await repo.challengeByCode(String(req.params.code).toUpperCase()); if (!c) return res.status(404).json({ error: "not_found" });
    const status = c.status === "open" && c.expiresAt.getTime() < now() ? "expired" : c.status; const [challenger, opponent] = c.attempts;
    const winner = !opponent ? null : challenger.score !== opponent.score ? (challenger.score > opponent.score ? "challenger" : "opponent") : challenger.totalMs !== opponent.totalMs ? (challenger.totalMs < opponent.totalMs ? "challenger" : "opponent") : "tie";
    res.json({ code: c.code, status, expiresAt: c.expiresAt, challenger, opponent: opponent ?? null, winner });
  }));
  const openChallenge = async (req: Request, res: Response, player: Player) => {
    const c = await repo.challengeByCode(String(req.params.code).toUpperCase());
    if (!c) { res.status(404).json({ error: "not_found" }); return; }
    if (c.challengerId === player.id) { res.status(403).json({ error: "own_challenge" }); return; }
    if (c.status === "expired" || (c.status === "open" && c.expiresAt.getTime() < now())) { res.status(410).json({ error: "expired" }); return; }
    if (c.status !== "open" || c.attempts.some((a) => a.playerId === player.id)) { res.status(409).json({ error: "already_completed" }); return; }
    const pack = await repo.packById(c.packId); if (!pack) { res.status(503).json({ error: "pack_unavailable" }); return; }
    return { c, pack };
  };
  app.post("/api/challenges/:code/start", auth, wrap(async (req, res) => {
    const player = (req as Authed).player; const o = await openChallenge(req, res, player); if (o) startRun(o.pack, `${player.id}:c:${o.c.code}`, res);
  }));
  app.post("/api/challenges/:code/answer", auth, wrap(async (req, res) => {
    const player = (req as Authed).player; const o = await openChallenge(req, res, player); if (!o) return;
    await answerRun(req, res, o.pack, `${player.id}:c:${o.c.code}`, async (s) => ({ saved: await (async () => { const { saved } = await repo.completeChallenge(o.c.code, { playerId: player.id, score: s.score, correct: s.correct, totalMs: s.elapsed }); if (saved) await repo.addFriends(o.c.challengerId, player.id); return saved; })() }));
  }));

  app.get("/api/me", auth, wrap(async (req, res) => { const p = (req as Authed).player; res.json({ player: p, bestDaily: await repo.bestDailyScore(p.id) }); }));
  app.get("/api/me/history", auth, wrap(async (req, res) => { const page = z.coerce.number().int().min(0).max(1000).default(0).parse(req.query.page); res.json({ rows: await repo.history((req as Authed).player.id, 20, page * 20) }); }));

  // Leaderboards: daily = one day; weekly = Mon-Sun (IST dates); all = every ranked daily. Bounded to 20 rows/page.
  const week = (d: string) => { const t = Date.parse(`${d}T00:00:00Z`); const s = t - ((new Date(t).getUTCDay() + 6) % 7) * 86400_000; const f = (x: number) => new Date(x).toISOString().slice(0, 10); return [f(s), f(s + 6 * 86400_000)] as const; };
  app.get("/api/leaderboard/category/:name", wrap(async (req, res) => { // points earned inside one question category (ranked dailies only)
    const q = z.object({ name: z.string().trim().min(1).max(30), period: z.enum(["daily", "weekly", "all"]).default("weekly"), page: z.coerce.number().int().min(0).max(1000).default(0) }).safeParse({ ...req.params, ...req.query }); if (!q.success) return res.status(400).json({ error: "invalid_input" });
    const d = today(); const [from, to] = q.data.period === "daily" ? [d, d] : q.data.period === "weekly" ? week(d) : [null, null];
    res.json({ category: q.data.name, period: q.data.period, rows: await repo.categoryLeaderboard(q.data.name, from, to, 20, q.data.page * 20) });
  }));
  app.get("/api/leaderboard/friends", auth, wrap(async (req, res) => { // you + players you have completed challenges with
    const q = z.object({ period: z.enum(["daily", "weekly", "all"]).default("weekly"), page: z.coerce.number().int().min(0).max(1000).default(0) }).safeParse(req.query); if (!q.success) return res.status(400).json({ error: "invalid_input" });
    const d = today(); const [from, to] = q.data.period === "daily" ? [d, d] : q.data.period === "weekly" ? week(d) : [null, null];
    res.json({ period: q.data.period, rows: await repo.friendsLeaderboard((req as Authed).player.id, from, to, 20, q.data.page * 20) });
  }));
  app.get("/api/leaderboard/:period", wrap(async (req, res) => {
    const q = z.object({ period: z.enum(["daily", "weekly", "all"]), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), page: z.coerce.number().int().min(0).max(1000).default(0) }).safeParse({ ...req.params, ...req.query });
    if (!q.success) return res.status(400).json({ error: "invalid_input" });
    const d = q.data.date ?? today(); const [from, to] = q.data.period === "daily" ? [d, d] : q.data.period === "weekly" ? week(d) : [null, null];
    res.json({ period: q.data.period, from, to, rows: await repo.periodLeaderboard(from, to, 20, q.data.page * 20) });
  }));

  // --- achievements, profile
  const refreshAch = async (pid: string) => { const st = await repo.playerStats(pid); return repo.grantAchievements(pid, earnedCodes(st, streak(st.dates, today()))); };
  app.get("/api/profile/me", auth, wrap(async (req, res) => {
    const p = (req as Authed).player; await refreshAch(p.id); const st = await repo.playerStats(p.id); const earned = new Set(await repo.earnedAchievements(p.id));
    res.json({ player: p, stats: { dailyCount: st.dailyCount, bestScore: st.bestScore, streak: streak(st.dates, today()), matchesPlayed: st.matchesPlayed, matchesWon: st.matchesWon, approvedSubmissions: st.approvedSubmissions }, achievements: ACHIEVEMENTS.map((a) => ({ ...a, earned: earned.has(a.code) })) });
  }));
  app.post("/api/profile", auth, wrap(async (req, res) => { const b = guestBody.safeParse(req.body); if (!b.success) return res.status(400).json({ error: "invalid_input" }); res.json({ player: await repo.updatePlayer((req as Authed).player.id, b.data.displayName, b.data.avatar) }); }));

  // --- community submissions (text only; never rendered as HTML; angle brackets and control characters are rejected)
  const safe = (min: number, max: number) => z.string().trim().min(min).max(max).regex(/^[^<>\u0000-\u001f]+$/);
  const subBody = z.object({ title: safe(3, 80), type: z.enum(["trivia", "riddle", "emoji", "logic"]), category: safe(2, 30), prompt: safe(10, 300), answer: safe(1, 100), wrongOptions: z.array(safe(1, 100)).length(3), explanation: safe(5, 300), difficulty: z.number().int().min(1).max(3) })
    .refine((d) => new Set([d.answer, ...d.wrongOptions].map((x) => x.trim().toLowerCase())).size === 4, { message: "options must be distinct" });
  app.post("/api/submissions", auth, limit("sub", 20, 3600_000), wrap(async (req, res) => {
    const p = (req as Authed).player; const b = subBody.safeParse(req.body); if (!b.success) return res.status(400).json({ error: "invalid_input" });
    if ((await repo.countSubmissionsSince(p.id, new Date(now() - 86400_000))) >= 5) return res.status(429).json({ error: "daily_submission_limit" });
    res.status(201).json({ id: await repo.createSubmission(p.id, b.data), status: "pending" });
  }));
  app.get("/api/submissions/approved", wrap(async (req, res) => { // public: no answers or explanations
    const page = z.coerce.number().int().min(0).max(1000).default(0).parse(req.query.page);
    res.json({ rows: (await repo.listSubmissions("approved", 20, page * 20)).map((s) => ({ id: s.id, title: s.title, type: s.type, category: s.category, prompt: s.prompt, difficulty: s.difficulty, author: s.authorName })) });
  }));
  app.post("/api/submissions/:id/report", auth, limit("report", 30, 3600_000), wrap(async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id); const b = z.object({ reason: safe(3, 300) }).safeParse(req.body); if (!id.success || !b.success) return res.status(400).json({ error: "invalid_input" });
    const s = await repo.submissionById(id.data); if (!s || s.status !== "approved") return res.status(404).json({ error: "not_found" });
    await repo.reportSubmission(id.data, (req as Authed).player.id, b.data.reason); res.status(201).json({ ok: true });
  }));

  // --- admin moderation (server-side key; constant-time comparison; brute-force limited)
  const h = (x: string) => createHash("sha256").update(x).digest();
  const adminAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!opts.adminKey) return res.status(503).json({ error: "admin_disabled" });
    if (!timingSafeEqual(h(req.header("x-admin-key") ?? ""), h(opts.adminKey))) return res.status(401).json({ error: "unauthorized" }); next();
  };
  app.get("/api/admin/submissions", limit("admin", 120, 3600_000), adminAuth, wrap(async (req, res) => {
    const q = z.object({ status: z.enum(["pending", "approved", "rejected", "removed"]).default("pending"), page: z.coerce.number().int().min(0).max(1000).default(0) }).safeParse(req.query);
    if (!q.success) return res.status(400).json({ error: "invalid_input" }); res.json({ rows: await repo.listSubmissions(q.data.status, 20, q.data.page * 20) });
  }));
  app.get("/api/admin/reports", limit("admin", 120, 3600_000), adminAuth, wrap(async (_req, res) => res.json({ rows: await repo.listReports(50, 0) })));
  const NEXT: Record<string, { from: string; to: string }> = { approve: { from: "pending", to: "approved" }, reject: { from: "pending", to: "rejected" }, remove: { from: "approved", to: "removed" } };
  app.post("/api/admin/submissions/:id/moderate", limit("admin", 120, 3600_000), adminAuth, wrap(async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id); const b = z.object({ action: z.enum(["approve", "reject", "remove"]), reason: safe(3, 300) }).safeParse(req.body);
    if (!id.success || !b.success) return res.status(400).json({ error: "invalid_input" });
    const t = NEXT[b.data.action]; if (!(await repo.moderate(id.data, t.from, t.to, b.data.action, b.data.reason))) return res.status(409).json({ error: "invalid_transition" }); res.json({ status: t.to });
  }));

  app.use((_q, r) => { r.status(404).json({ error: "not_found" }); });
  app.use((err: unknown, _q: Request, res: Response, _n: NextFunction) => { console.error(err instanceof Error ? err.message : "error"); res.status(500).json({ error: "server_error" }); });
  return app;
}
