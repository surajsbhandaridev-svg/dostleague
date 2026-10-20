import pg from "pg";
import type { SiteStats, Repo, FinalAttempt, MatchRecord, SubmissionInput, Submission, RoomRow, SoloGameResult } from "./repo.js";
import type { PlayerStats } from "./achievements.js";
export class PgRepo implements Repo {
  constructor(private pool: pg.Pool) {}
  async createGuest(name: string, avatar: string, hash: string) {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      const p = (await c.query("insert into players(display_name,avatar) values($1,$2) returning id", [name, avatar])).rows[0];
      await c.query("insert into guest_sessions(player_id,token_hash) values($1,$2)", [p.id, hash]);
      await c.query("commit"); return { id: p.id as string, displayName: name, avatar };
    } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
  }
  async createAccount(name: string, avatar: string, email: string, passwordHash: string, tokenHash: string) {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      const p = (await c.query("insert into players(display_name,avatar) values($1,$2) returning id", [name, avatar])).rows[0];
      await c.query("insert into player_accounts(player_id,email,password_hash) values($1,$2,$3)", [p.id, email.toLowerCase(), passwordHash]);
      await c.query("insert into guest_sessions(player_id,token_hash) values($1,$2)", [p.id, tokenHash]);
      await c.query("commit"); return { id: p.id as string, displayName: name, avatar };
    } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
  }
  async linkAccount(playerId: string, email: string, passwordHash: string) {
    await this.pool.query("insert into player_accounts(player_id,email,password_hash) values($1,$2,$3)", [playerId, email.toLowerCase(), passwordHash]);
  }
  async accountByEmail(email: string) {
    const r = await this.pool.query("select p.id,p.display_name,p.avatar,a.password_hash from player_accounts a join players p on p.id=a.player_id where lower(a.email)=lower($1) limit 1", [email]);
    return r.rows[0] ? { player: { id: r.rows[0].id as string, displayName: r.rows[0].display_name as string, avatar: r.rows[0].avatar as string }, passwordHash: r.rows[0].password_hash as string } : null;
  }
  async accountEmail(playerId: string): Promise<string | null> { const r = await this.pool.query("select email from player_accounts where player_id=$1", [playerId]); const email = r.rows[0]?.email; return typeof email === "string" ? email : null; }
  async createSession(playerId: string, tokenHash: string) { await this.pool.query("insert into guest_sessions(player_id,token_hash) values($1,$2)", [playerId, tokenHash]); }
  async revokeSession(tokenHash: string) { await this.pool.query("delete from guest_sessions where token_hash=$1", [tokenHash]); }
  async saveSoloResult(x: SoloGameResult) {
    const r = await this.pool.query(`insert into solo_game_results(player_id,game_mode,play_type,score,correct,total_questions,total_ms,outcome,details,idempotency_key)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) on conflict(idempotency_key) do nothing returning id`,
      [x.playerId,x.gameMode,x.playType,x.score,x.correct,x.totalQuestions,x.totalMs,x.outcome,JSON.stringify(x.details),x.idempotencyKey]);
    if (r.rowCount) return true;
    const exists = await this.pool.query("select 1 from solo_game_results where idempotency_key=$1", [x.idempotencyKey]);
    return (exists.rowCount ?? 0) > 0;
  }
  async packById(id: string) {
    const q = await this.pool.query("select id, position, type, category, difficulty, prompt, options, correct_index, explanation from questions where pack_id=$1 and status='published' order by position", [id]);
    return q.rows.length ? { packId: id, date: "", version: 1, questions: q.rows.map((r) => ({ id: r.id, position: r.position, type: r.type, category: r.category, difficulty: r.difficulty, prompt: r.prompt, options: r.options, correctIndex: r.correct_index, explanation: r.explanation })) } : null;
  }
  async bestDailyScore(pid: string) { const r = await this.pool.query("select max(score) m from challenge_attempts where player_id=$1 and ranked", [pid]); return r.rows[0].m ?? null; }
  async periodLeaderboard(from: string | null, to: string | null, limit: number, offset: number) {
    const r = await this.pool.query("select p.display_name, p.avatar, sum(a.score)::int score, sum(a.correct)::int correct, sum(a.total_ms)::int total_ms from challenge_attempts a join players p on p.id=a.player_id where a.ranked and ($1::date is null or a.daily_date>=$1::date) and ($2::date is null or a.daily_date<=$2::date) group by p.id order by score desc, total_ms asc, min(a.created_at) asc limit $3 offset $4", [from, to, limit, offset]);
    return r.rows.map((x, i) => ({ rank: offset + i + 1, name: x.display_name, avatar: x.avatar, score: x.score, correct: x.correct, totalMs: x.total_ms }));
  }
  async history(pid: string, limit: number, offset: number) {
    const r = await this.pool.query(`select * from (
      select 'daily' kind, created_at at, score, correct, null::int rank from challenge_attempts where player_id=$1 and ranked
      union all select 'challenge', created_at, score, correct, null::int from challenge_attempts where player_id=$1 and friend_challenge_id is not null
      union all select 'match', m.finished_at, r.score, r.correct, r.rank from match_results r join matches m on m.id=r.match_id where r.player_id=$1
      union all select case when play_type='saboteur' then 'saboteur' else 'practice' end, created_at, score, correct, null::int from solo_game_results where player_id=$1) h order by at desc limit $2 offset $3`, [pid, limit, offset]);
    return r.rows.map((x) => ({ kind: x.kind, at: x.at, score: x.score, correct: x.correct, rank: x.rank }));
  }
  async createChallenge(c: { code: string; challengerId: string; packId: string; expiresAt: Date; challengerAttempt: { date: string; score: number; correct: number; totalMs: number } }) {
    const k = await this.pool.connect();
    try {
      await k.query("begin");
      const id = (await k.query("insert into friend_challenges(code,challenger_id,pack_id,expires_at) values($1,$2,$3,$4) returning id", [c.code, c.challengerId, c.packId, c.expiresAt])).rows[0].id;
      const a = c.challengerAttempt;
      await k.query("insert into challenge_attempts(player_id,daily_date,friend_challenge_id,score,correct,total_ms,ranked,idempotency_key) values($1,$2,$3,$4,$5,$6,false,$7)", [c.challengerId, a.date, id, a.score, a.correct, a.totalMs, `challenge:${id}:${c.challengerId}`]);
      await k.query("commit");
    } catch (e) { await k.query("rollback"); throw e; } finally { k.release(); }
  }
  async challengeByCode(code: string) {
    const c = (await this.pool.query("select id, code, pack_id, challenger_id, status, expires_at from friend_challenges where code=$1", [code])).rows[0]; if (!c) return null;
    const a = await this.pool.query("select a.player_id, p.display_name, p.avatar, a.score, a.correct, a.total_ms from challenge_attempts a join players p on p.id=a.player_id where a.friend_challenge_id=$1 order by a.created_at", [c.id]);
    return { id: c.id, code: c.code, packId: c.pack_id, challengerId: c.challenger_id, status: c.status, expiresAt: c.expires_at, attempts: a.rows.map((x) => ({ playerId: x.player_id, name: x.display_name, avatar: x.avatar, score: x.score, correct: x.correct, totalMs: x.total_ms })) };
  }
  async completeChallenge(code: string, a: { playerId: string; score: number; correct: number; totalMs: number }) {
    const k = await this.pool.connect();
    try {
      await k.query("begin");
      const c = (await k.query("select id, status from friend_challenges where code=$1 for update", [code])).rows[0];
      if (!c || c.status !== "open") { await k.query("rollback"); return { saved: false }; }
      const r = await k.query("insert into challenge_attempts(player_id,friend_challenge_id,score,correct,total_ms,ranked,idempotency_key) values($1,$2,$3,$4,$5,false,$6) on conflict do nothing", [a.playerId, c.id, a.score, a.correct, a.totalMs, `challenge:${c.id}:${a.playerId}`]);
      if (!r.rowCount) { await k.query("rollback"); return { saved: false }; }
      await k.query("update friend_challenges set status='completed' where id=$1", [c.id]); await k.query("commit"); return { saved: true };
    } catch (e) { await k.query("rollback"); throw e; } finally { k.release(); }
  }
  async createSubmission(a: string, d: SubmissionInput) { return (await this.pool.query("insert into community_submissions(author_id,title,type,category,prompt,answer,explanation,difficulty,wrong_options) values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) returning id", [a, d.title, d.type, d.category, d.prompt, d.answer, d.explanation, d.difficulty, JSON.stringify(d.wrongOptions)])).rows[0].id as string; }
  async countSubmissionsSince(a: string, since: Date) { return (await this.pool.query("select count(*)::int c from community_submissions where author_id=$1 and created_at>=$2", [a, since])).rows[0].c; }
  private sub = (r: any): Submission => ({ id: r.id, title: r.title, type: r.type, category: r.category, prompt: r.prompt, answer: r.answer, explanation: r.explanation, difficulty: r.difficulty, status: r.status, createdAt: r.created_at, authorName: r.display_name, wrongOptions: r.wrong_options ?? [], reports: r.reports ?? 0 });
  private subSql = "select s.*, p.display_name, (select count(*)::int from moderation_reports m where m.submission_id=s.id) reports from community_submissions s join players p on p.id=s.author_id";
  async submissionById(id: string) { const r = await this.pool.query(this.subSql + " where s.id=$1", [id]); return r.rows[0] ? this.sub(r.rows[0]) : null; }
  async listSubmissions(status: string, limit: number, offset: number) { return (await this.pool.query(this.subSql + " where s.status=$1 order by s.created_at desc limit $2 offset $3", [status, limit, offset])).rows.map(this.sub); }
  async moderate(id: string, from: string, to: string, action: string, reason: string) {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      const u = await c.query("update community_submissions set status=$3, updated_at=now() where id=$1 and status=$2", [id, from, to]);
      if (!u.rowCount) { await c.query("rollback"); return false; }
      await c.query("insert into moderation_actions(submission_id,action,reason) values($1,$2,$3)", [id, action, reason]); await c.query("commit"); return true;
    } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
  }
  async reportSubmission(id: string, reporter: string, reason: string) { await this.pool.query("insert into moderation_reports(submission_id,reporter_id,reason) values($1,$2,$3)", [id, reporter, reason]); }
  async listReports(limit: number, offset: number) { return (await this.pool.query("select m.id, m.submission_id, s.title, m.reason, m.created_at, s.status from moderation_reports m join community_submissions s on s.id=m.submission_id order by m.created_at desc limit $1 offset $2", [limit, offset])).rows.map((r) => ({ id: r.id, submissionId: r.submission_id, title: r.title, reason: r.reason, createdAt: r.created_at, status: r.status })); }
  async playerStats(pid: string): Promise<PlayerStats> {
    const a = (await this.pool.query("select count(*)::int c, coalesce(max(score),0)::int b from challenge_attempts where player_id=$1 and ranked", [pid])).rows[0];
    const d = (await this.pool.query("select to_char(daily_date,'YYYY-MM-DD') d from challenge_attempts where player_id=$1 and ranked order by daily_date desc limit 60", [pid])).rows.map((r) => r.d as string);
    const m = (await this.pool.query("select count(*)::int p, (count(*) filter (where rank=1))::int w from match_results where player_id=$1", [pid])).rows[0];
    const s = (await this.pool.query("select count(*)::int c from community_submissions where author_id=$1 and status='approved'", [pid])).rows[0];
    return { dailyCount: a.c, bestScore: a.b, dates: d, matchesPlayed: m.p, matchesWon: m.w, approvedSubmissions: s.c };
  }
  async grantAchievements(pid: string, codes: string[]) { if (!codes.length) return []; return (await this.pool.query("insert into player_achievements(player_id,code) select $1, unnest($2::text[]) on conflict do nothing returning code", [pid, codes])).rows.map((r) => r.code as string); }
  async earnedAchievements(pid: string) { return (await this.pool.query("select code from player_achievements where player_id=$1", [pid])).rows.map((r) => r.code as string); }
  async updatePlayer(id: string, name: string, avatar: string) { await this.pool.query("update players set display_name=$2, avatar=$3, updated_at=now() where id=$1", [id, name, avatar]); return { id, displayName: name, avatar }; }
  async approvedForPlay(limit: number) { return (await this.pool.query(this.subSql + " where s.status='approved' and jsonb_array_length(s.wrong_options)=3 order by random() limit $1", [limit])).rows.map(this.sub); }
  async saveRoom(m: RoomRow) {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      const id = (await c.query("insert into rooms(code,host_player_id,mode,status,max_players,expires_at) values($1,$2,$3,$4,$5,$6) on conflict(code) do update set host_player_id=excluded.host_player_id, mode=excluded.mode, status=excluded.status, expires_at=excluded.expires_at returning id", [m.code, m.hostId, m.mode, m.status, m.maxPlayers, m.expiresAt])).rows[0].id;
      await c.query("delete from room_players where room_id=$1", [id]);
      for (const p of m.players) await c.query("insert into room_players(room_id,player_id,ready) values($1,$2,$3) on conflict do nothing", [id, p.id, p.ready]);
      await c.query("commit");
    } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
  }
  async expireStaleRooms() { return (await this.pool.query("update rooms set status='voided' where status in ('waiting','playing')")).rowCount ?? 0; }
  async categoryLeaderboard(cat: string, from: string | null, to: string | null, limit: number, offset: number) {
    const r = await this.pool.query("select p.display_name, p.avatar, sum((a.category_scores->>$1)::int)::int score, sum(a.total_ms)::int total_ms from challenge_attempts a join players p on p.id=a.player_id where a.ranked and a.category_scores->>$1 is not null and ($2::date is null or a.daily_date>=$2::date) and ($3::date is null or a.daily_date<=$3::date) group by p.id order by score desc, total_ms asc, min(a.created_at) asc limit $4 offset $5", [cat, from, to, limit, offset]);
    return r.rows.map((x, i) => ({ rank: offset + i + 1, name: x.display_name, avatar: x.avatar, score: x.score, correct: 0, totalMs: x.total_ms }));
  }
  async stats(today: string): Promise<SiteStats> {
    const q = async (sql: string, args: unknown[] = []) => (await this.pool.query(sql, args)).rows[0].n as number;
    return { dailyPacks: await q("select count(*)::int n from daily_challenges where challenge_date >= $1::date", [today]), dailyQuestions: await q("select count(*)::int n from questions q join daily_challenges d on d.pack_id=q.pack_id where d.challenge_date >= $1::date and q.status='published'", [today]),
      communityChallenges: await q("select count(*)::int n from community_submissions where status='approved' and jsonb_array_length(wrong_options)=3"), matchesPlayed: await q("select count(*)::int n from matches where status='completed'"), players: await q("select count(*)::int n from players") };
  }
  async addFriends(a: string, b: string) { await this.pool.query("insert into friendships(player_a,player_b) values(least($1::uuid,$2::uuid), greatest($1::uuid,$2::uuid)) on conflict do nothing", [a, b]); }
  async friendsLeaderboard(pid: string, from: string | null, to: string | null, limit: number, offset: number) {
    const r = await this.pool.query(`with f as (select case when player_a=$1 then player_b else player_a end id from friendships where player_a=$1 or player_b=$1 union select $1::uuid)
      select p.display_name, p.avatar, sum(a.score)::int score, sum(a.correct)::int correct, sum(a.total_ms)::int total_ms from challenge_attempts a join players p on p.id=a.player_id
      where a.ranked and a.player_id in (select id from f) and ($2::date is null or a.daily_date>=$2::date) and ($3::date is null or a.daily_date<=$3::date)
      group by p.id order by score desc, total_ms asc, min(a.created_at) asc limit $4 offset $5`, [pid, from, to, limit, offset]);
    return r.rows.map((x, i) => ({ rank: offset + i + 1, name: x.display_name, avatar: x.avatar, score: x.score, correct: x.correct, totalMs: x.total_ms }));
  }
  async saveMatch(m: MatchRecord) {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      const r = await c.query("insert into matches(pack_id,mode,status,started_at,finished_at,idempotency_key) values($1,$2,'completed',$3,now(),$4) on conflict(idempotency_key) do nothing returning id", [m.packId, m.mode ?? "daily", m.startedAt, m.idempotencyKey]);
      if (!r.rowCount) { await c.query("rollback"); return { saved: false }; }
      const id = r.rows[0].id;
      for (const x of m.results) await c.query("insert into match_results(match_id,player_id,score,correct,rank) values($1,$2,$3,$4,$5)", [id, x.playerId, x.score, x.correct, x.rank]);
      for (const a of m.answers) await c.query("insert into answers(match_id,question_id,player_id,choice,points,elapsed_ms) values($1,$2,$3,$4,$5,$6)", [id, a.questionId, a.playerId, a.choice, a.points, a.ms]);
      await c.query("commit"); return { saved: true };
    } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
  }
  async playerByTokenHash(h: string) {
    const r = await this.pool.query("select p.id, p.display_name, p.avatar from guest_sessions g join players p on p.id=g.player_id where g.token_hash=$1", [h]);
    return r.rows[0] ? { id: r.rows[0].id, displayName: r.rows[0].display_name, avatar: r.rows[0].avatar } : null;
  }
  async dailyPack(date: string) {
    const d = await this.pool.query("select pack_id, version from daily_challenges where challenge_date=$1 order by version desc limit 1", [date]);
    if (!d.rows[0]) return null;
    const q = await this.pool.query("select id, position, type, category, difficulty, prompt, options, correct_index, explanation from questions where pack_id=$1 and status='published' order by position", [d.rows[0].pack_id]);
    return { packId: d.rows[0].pack_id, date, version: d.rows[0].version, questions: q.rows.map((r) => ({ id: r.id, position: r.position, type: r.type, category: r.category, difficulty: r.difficulty, prompt: r.prompt, options: r.options, correctIndex: r.correct_index, explanation: r.explanation })) };
  }
  async rankedAttempt(pid: string, date: string) {
    const r = await this.pool.query("select score, correct, total_ms, created_at from challenge_attempts where player_id=$1 and daily_date=$2 and ranked", [pid, date]);
    return r.rows[0] ? { playerId: pid, date, score: r.rows[0].score, correct: r.rows[0].correct, totalMs: r.rows[0].total_ms, createdAt: r.rows[0].created_at } : null;
  }
  async saveRankedAttempt(a: FinalAttempt) {
    const r = await this.pool.query("insert into challenge_attempts(player_id,daily_date,score,correct,total_ms,ranked,idempotency_key,category_scores) values($1,$2,$3,$4,$5,true,$6,$7::jsonb) on conflict do nothing", [a.playerId, a.date, a.score, a.correct, a.totalMs, `daily:${a.date}:${a.playerId}`, JSON.stringify(a.categoryScores ?? {})]);
    return { saved: (r.rowCount ?? 0) > 0 };
  }
  async dailyLeaderboard(date: string, limit: number, offset: number) {
    const r = await this.pool.query("select p.display_name, p.avatar, a.score, a.correct, a.total_ms from challenge_attempts a join players p on p.id=a.player_id where a.ranked and a.daily_date=$1 order by a.score desc, a.total_ms asc, a.created_at asc limit $2 offset $3", [date, limit, offset]);
    return r.rows.map((x, i) => ({ rank: offset + i + 1, name: x.display_name, avatar: x.avatar, score: x.score, correct: x.correct, totalMs: x.total_ms }));
  }
}
