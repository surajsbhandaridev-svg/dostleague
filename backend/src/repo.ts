export interface FullQuestion { id: string; position: number; type: string; category: string; difficulty: number; prompt: string; options: string[]; correctIndex: number; explanation: string }
export interface Pack { packId: string; date: string; version: number; questions: FullQuestion[] }
export interface Player { id: string; displayName: string; avatar: string }
export interface FinalAttempt { categoryScores?: Record<string, number>; playerId: string; date: string; score: number; correct: number; totalMs: number; createdAt: Date }
export interface LbRow { rank: number; name: string; avatar: string; score: number; correct: number; totalMs: number }
export interface MatchRecord { idempotencyKey: string; packId: string | null; mode?: string; startedAt: Date; results: { playerId: string; score: number; correct: number; rank: number }[]; answers: { questionId: string; playerId: string; choice: number; points: number; ms: number }[] }
export interface ChAttempt { playerId: string; name: string; avatar: string; score: number; correct: number; totalMs: number }
export interface ChallengeView { id: string; code: string; packId: string; challengerId: string; status: "open" | "completed" | "expired"; expiresAt: Date; attempts: ChAttempt[] }
export interface HistoryRow { kind: "daily" | "match" | "challenge" | "practice" | "saboteur"; at: Date; score: number; correct: number; rank: number | null }
export interface SoloGameResult {
  idempotencyKey: string; playerId: string; gameMode: string; playType: "solo" | "bots" | "saboteur";
  score: number; correct: number; totalQuestions: number; totalMs: number; outcome: string | null; details: Record<string, unknown>; createdAt?: Date;
}
import type { PlayerStats } from "./achievements.js";
export interface SubmissionInput { wrongOptions: string[]; title: string; type: string; category: string; prompt: string; answer: string; explanation: string; difficulty: number }
export interface Submission extends SubmissionInput { id: string; authorName: string; status: "pending" | "approved" | "rejected" | "removed"; createdAt: Date; reports: number }
export interface RoomRow { code: string; hostId: string; mode: string; status: string; maxPlayers: number; expiresAt: Date; players: { id: string; ready: boolean }[] }
export interface SiteStats { dailyPacks: number; dailyQuestions: number; communityChallenges: number; matchesPlayed: number; players: number }
export interface Repo {
  /** Real aggregate counts only (no fabricated numbers). dailyPacks = challenges scheduled from `today` onward. */
  stats(today: string): Promise<SiteStats>;
  saveRoom(m: RoomRow): Promise<void>;
  /** On boot: any room still marked waiting/playing belongs to a dead process, so mark it voided. */
  expireStaleRooms(): Promise<number>;
  categoryLeaderboard(category: string, from: string | null, to: string | null, limit: number, offset: number): Promise<LbRow[]>;
  /** Approved submissions that have exactly 3 wrong options, random order. */
  approvedForPlay(limit: number): Promise<Submission[]>;
  addFriends(a: string, b: string): Promise<void>;
  friendsLeaderboard(playerId: string, from: string | null, to: string | null, limit: number, offset: number): Promise<LbRow[]>;
  createSubmission(authorId: string, d: SubmissionInput): Promise<string>;
  countSubmissionsSince(authorId: string, since: Date): Promise<number>;
  submissionById(id: string): Promise<Submission | null>;
  listSubmissions(status: string, limit: number, offset: number): Promise<Submission[]>;
  /** Atomic status change + moderation_actions record; false if the submission was no longer in `from`. */
  moderate(id: string, from: string, to: string, action: string, reason: string): Promise<boolean>;
  reportSubmission(id: string, reporterId: string, reason: string): Promise<void>;
  listReports(limit: number, offset: number): Promise<{ id: string; submissionId: string; title: string; reason: string; createdAt: Date; status: string }[]>;
  playerStats(playerId: string): Promise<PlayerStats>;
  grantAchievements(playerId: string, codes: string[]): Promise<string[]>;
  earnedAchievements(playerId: string): Promise<string[]>;
  updatePlayer(id: string, name: string, avatar: string): Promise<Player>;
  packById(id: string): Promise<Pack | null>;
  bestDailyScore(playerId: string): Promise<number | null>;
  /** Sums ranked daily scores per player in [from,to] (null = unbounded). Order: score DESC, total_ms ASC, first submission ASC. */
  periodLeaderboard(from: string | null, to: string | null, limit: number, offset: number): Promise<LbRow[]>;
  history(playerId: string, limit: number, offset: number): Promise<HistoryRow[]>;
  createChallenge(c: { code: string; challengerId: string; packId: string; expiresAt: Date; challengerAttempt: { date: string; score: number; correct: number; totalMs: number } }): Promise<void>;
  challengeByCode(code: string): Promise<ChallengeView | null>;
  /** Atomic: only the first completer wins; returns saved=false otherwise. */
  completeChallenge(code: string, a: { playerId: string; score: number; correct: number; totalMs: number }): Promise<{ saved: boolean }>;
  /** Idempotent by idempotencyKey: a duplicate finalization returns saved=false and writes nothing. */
  saveMatch(m: MatchRecord): Promise<{ saved: boolean }>;
  createGuest(name: string, avatar: string, tokenHash: string): Promise<Player>;
  createAccount(name: string, avatar: string, email: string, passwordHash: string, tokenHash: string): Promise<Player>;
  linkAccount(playerId: string, email: string, passwordHash: string): Promise<void>;
  accountByEmail(email: string): Promise<{ player: Player; passwordHash: string } | null>;
  accountEmail(playerId: string): Promise<string | null>;
  createSession(playerId: string, tokenHash: string): Promise<void>;
  revokeSession(tokenHash: string): Promise<void>;
  saveSoloResult(result: SoloGameResult): Promise<boolean>;
  playerByTokenHash(h: string): Promise<Player | null>;
  dailyPack(date: string): Promise<Pack | null>;
  rankedAttempt(playerId: string, date: string): Promise<FinalAttempt | null>;
  /** Idempotent: returns saved=false if a ranked attempt already exists. */
  saveRankedAttempt(a: FinalAttempt): Promise<{ saved: boolean }>;
  dailyLeaderboard(date: string, limit: number, offset: number): Promise<LbRow[]>;
}
const cmp = (a: FinalAttempt, b: FinalAttempt) => b.score - a.score || a.totalMs - b.totalMs || +a.createdAt - +b.createdAt;
export class MemoryRepo implements Repo {
  subs: (Submission & { authorId: string })[] = []; actions: { id: string; action: string; reason: string }[] = []; reps: { id: string; submissionId: string; reason: string; createdAt: Date }[] = []; ach = new Map<string, Set<string>>();
  async createSubmission(authorId: string, d: SubmissionInput) { const id = crypto.randomUUID(); this.subs.push({ ...d, id, authorId, authorName: this.players.get(authorId)!.displayName, status: "pending", createdAt: new Date(), reports: 0 }); return id; }
  async countSubmissionsSince(a: string, since: Date) { return this.subs.filter((x) => x.authorId === a && x.createdAt >= since).length; }
  async submissionById(id: string) { return this.subs.find((x) => x.id === id) ?? null; }
  async listSubmissions(status: string, limit: number, offset: number) { return this.subs.filter((x) => x.status === status).sort((a, b) => +b.createdAt - +a.createdAt).slice(offset, offset + limit).map((x) => ({ ...x, reports: this.reps.filter((r) => r.submissionId === x.id).length })); }
  async moderate(id: string, from: string, to: string, action: string, reason: string) { const s = this.subs.find((x) => x.id === id); if (!s || s.status !== from) return false; s.status = to as Submission["status"]; this.actions.push({ id, action, reason }); return true; }
  async reportSubmission(id: string, _r: string, reason: string) { this.reps.push({ id: crypto.randomUUID(), submissionId: id, reason, createdAt: new Date() }); }
  async listReports(limit: number, offset: number) { return this.reps.slice(offset, offset + limit).map((r) => { const s = this.subs.find((x) => x.id === r.submissionId)!; return { id: r.id, submissionId: s.id, title: s.title, reason: r.reason, createdAt: r.createdAt, status: s.status }; }); }
  async playerStats(pid: string): Promise<PlayerStats> {
    const a = this.attempts.filter((x) => x.playerId === pid); const rs = this.matches.flatMap((m) => m.results.filter((r) => r.playerId === pid));
    return { dailyCount: a.length, bestScore: a.length ? Math.max(...a.map((x) => x.score)) : 0, dates: a.map((x) => x.date), matchesPlayed: rs.length, matchesWon: rs.filter((r) => r.rank === 1).length, approvedSubmissions: this.subs.filter((x) => x.authorId === pid && x.status === "approved").length };
  }
  async grantAchievements(pid: string, codes: string[]) { const set = this.ach.get(pid) ?? new Set<string>(); const fresh = codes.filter((c) => !set.has(c)); fresh.forEach((c) => set.add(c)); this.ach.set(pid, set); return fresh; }
  async earnedAchievements(pid: string) { return [...(this.ach.get(pid) ?? [])]; }
  async updatePlayer(id: string, name: string, avatar: string) { const p = this.players.get(id)!; p.displayName = name; p.avatar = avatar; return { id, displayName: name, avatar }; }
  matches: MatchRecord[] = []; chals = new Map<string, ChallengeView>();
  async packById(id: string) { return [...this.packs.values()].find((p) => p.packId === id) ?? null; }
  async bestDailyScore(pid: string) { const v = this.attempts.filter((a) => a.playerId === pid).map((a) => a.score); return v.length ? Math.max(...v) : null; }
  async approvedForPlay(limit: number) { return this.subs.filter((x) => x.status === "approved" && x.wrongOptions?.length === 3).sort(() => Math.random() - 0.5).slice(0, limit); }
  roomRows = new Map<string, RoomRow>();
  async saveRoom(m: RoomRow) { this.roomRows.set(m.code, m); }
  async expireStaleRooms() { let n = 0; for (const r of this.roomRows.values()) if (["waiting", "playing"].includes(r.status)) { r.status = "voided"; n++; } return n; }
  async categoryLeaderboard(cat: string, from: string | null, to: string | null, limit: number, offset: number) {
    const m = new Map<string, { score: number; ms: number; first: number }>();
    for (const a of this.attempts) { const v = a.categoryScores?.[cat]; if (v === undefined || (from && a.date < from) || (to && a.date > to)) continue; const x = m.get(a.playerId) ?? { score: 0, ms: 0, first: +a.createdAt }; x.score += v; x.ms += a.totalMs; m.set(a.playerId, x); }
    return [...m].sort(([, a], [, b]) => b.score - a.score || a.ms - b.ms || a.first - b.first).slice(offset, offset + limit).map(([id, x], i) => ({ rank: offset + i + 1, name: this.players.get(id)!.displayName, avatar: this.players.get(id)!.avatar, score: x.score, correct: 0, totalMs: x.ms }));
  }
  async stats(today: string): Promise<SiteStats> { const packs = [...this.packs.values()].filter((p) => p.date >= today); return { dailyPacks: packs.length, dailyQuestions: packs.reduce((n, p) => n + p.questions.length, 0), communityChallenges: this.subs.filter((x) => x.status === "approved" && x.wrongOptions?.length === 3).length, matchesPlayed: this.matches.length, players: this.players.size }; }
  fr = new Set<string>();
  async addFriends(a: string, b: string) { this.fr.add([a, b].sort().join("|")); }
  async friendsLeaderboard(pid: string, from: string | null, to: string | null, limit: number, offset: number) { const ids = new Set([pid]); for (const k of this.fr) { const [x, y] = k.split("|"); if (x === pid) ids.add(y); if (y === pid) ids.add(x); } return this.periodLeaderboard(from, to, limit, offset, ids); }
  async periodLeaderboard(from: string | null, to: string | null, limit: number, offset: number, only?: Set<string>) {
    const m = new Map<string, { score: number; correct: number; ms: number; first: number }>();
    for (const a of this.attempts) { if ((from && a.date < from) || (to && a.date > to) || (only && !only.has(a.playerId))) continue; const x = m.get(a.playerId) ?? { score: 0, correct: 0, ms: 0, first: +a.createdAt }; x.score += a.score; x.correct += a.correct; x.ms += a.totalMs; x.first = Math.min(x.first, +a.createdAt); m.set(a.playerId, x); }
    return [...m].sort(([, a], [, b]) => b.score - a.score || a.ms - b.ms || a.first - b.first).slice(offset, offset + limit).map(([id, x], i) => ({ rank: offset + i + 1, name: this.players.get(id)!.displayName, avatar: this.players.get(id)!.avatar, score: x.score, correct: x.correct, totalMs: x.ms }));
  }
  async history(pid: string, limit: number, offset: number) {
    const rows: HistoryRow[] = [...this.attempts.filter((a) => a.playerId === pid).map((a) => ({ kind: "daily" as const, at: a.createdAt, score: a.score, correct: a.correct, rank: null })),
      ...this.matches.flatMap((m) => m.results.filter((r) => r.playerId === pid).map((r) => ({ kind: "match" as const, at: m.startedAt, score: r.score, correct: r.correct, rank: r.rank }))),
      ...this.soloResults.filter((r) => r.playerId === pid).map((r) => ({ kind: (r.playType === "saboteur" ? "saboteur" : "practice") as HistoryRow["kind"], at: r.createdAt ?? new Date(), score: r.score, correct: r.correct, rank: null }))];
    return rows.sort((a, b) => +b.at - +a.at).slice(offset, offset + limit);
  }
  async createChallenge(c: { code: string; challengerId: string; packId: string; expiresAt: Date; challengerAttempt: { score: number; correct: number; totalMs: number } }) {
    const p = this.players.get(c.challengerId)!; this.chals.set(c.code, { id: c.code, code: c.code, packId: c.packId, challengerId: c.challengerId, status: "open", expiresAt: c.expiresAt, attempts: [{ playerId: p.id, name: p.displayName, avatar: p.avatar, ...c.challengerAttempt }] });
  }
  async challengeByCode(code: string) { return this.chals.get(code) ?? null; }
  async completeChallenge(code: string, a: { playerId: string; score: number; correct: number; totalMs: number }) {
    const c = this.chals.get(code); if (!c || c.status !== "open") return { saved: false }; const p = this.players.get(a.playerId)!;
    c.attempts.push({ playerId: p.id, name: p.displayName, avatar: p.avatar, score: a.score, correct: a.correct, totalMs: a.totalMs }); c.status = "completed"; return { saved: true };
  }
  async saveMatch(m: MatchRecord) { if (this.matches.some((x) => x.idempotencyKey === m.idempotencyKey)) return { saved: false }; this.matches.push(m); return { saved: true }; }
  players = new Map<string, Player & { hash: string }>(); attempts: FinalAttempt[] = []; packs = new Map<string, Pack>();
  accounts = new Map<string, { playerId: string; passwordHash: string }>();
  sessions = new Map<string, string>();
  soloResults: SoloGameResult[] = [];
  async createGuest(name: string, avatar: string, hash: string) { const p = { id: crypto.randomUUID(), displayName: name, avatar, hash }; this.players.set(p.id, p); this.sessions.set(hash, p.id); return { id: p.id, displayName: name, avatar }; }
  async createAccount(name: string, avatar: string, email: string, passwordHash: string, tokenHash: string) {
    if (this.accounts.has(email.toLowerCase())) throw new Error("email_taken");
    const p = await this.createGuest(name, avatar, tokenHash); this.accounts.set(email.toLowerCase(), { playerId: p.id, passwordHash }); return p;
  }
  async linkAccount(playerId: string, email: string, passwordHash: string) {
    const e = email.toLowerCase(); if (this.accounts.has(e)) throw new Error("email_taken");
    if (![...this.players.keys()].includes(playerId)) throw new Error("player_not_found");
    if ([...this.accounts.values()].some((x) => x.playerId === playerId)) throw new Error("account_exists");
    this.accounts.set(e, { playerId, passwordHash });
  }
  async accountByEmail(email: string) { const a = this.accounts.get(email.toLowerCase()); if (!a) return null; const p = this.players.get(a.playerId); return p ? { player: { id: p.id, displayName: p.displayName, avatar: p.avatar }, passwordHash: a.passwordHash } : null; }
  async accountEmail(playerId: string) { for (const [email, a] of this.accounts) if (a.playerId === playerId) return email; return null; }
  async createSession(playerId: string, tokenHash: string) { if (!this.players.has(playerId)) throw new Error("player_not_found"); this.sessions.set(tokenHash, playerId); }
  async revokeSession(tokenHash: string) { this.sessions.delete(tokenHash); }
  async saveSoloResult(x: SoloGameResult) { if (this.soloResults.some((r) => r.idempotencyKey === x.idempotencyKey)) return true; this.soloResults.push({ ...x, createdAt: x.createdAt ?? new Date() }); return true; }
  async playerByTokenHash(h: string) { const id = this.sessions.get(h); const p = id ? this.players.get(id) : undefined; return p ? { id: p.id, displayName: p.displayName, avatar: p.avatar } : null; }
  async dailyPack(date: string) { return this.packs.get(date) ?? null; }
  async rankedAttempt(pid: string, date: string) { return this.attempts.find((a) => a.playerId === pid && a.date === date) ?? null; }
  async saveRankedAttempt(a: FinalAttempt) { if (await this.rankedAttempt(a.playerId, a.date)) return { saved: false }; this.attempts.push(a); return { saved: true }; }
  async dailyLeaderboard(date: string, limit: number, offset: number) {
    return this.attempts.filter((a) => a.date === date).sort(cmp).slice(offset, offset + limit).map((a, i) => { const p = this.players.get(a.playerId)!; return { rank: offset + i + 1, name: p.displayName, avatar: p.avatar, score: a.score, correct: a.correct, totalMs: a.totalMs }; });
  }
}
