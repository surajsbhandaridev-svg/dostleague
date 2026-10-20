import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, Crown, Flame, LoaderCircle, Sparkles, Trophy, UserRound, Zap } from "lucide-react";
import { api, ApiError, ensureGuest, getToken, waitForServer, guestErrorMessage } from "./api";
import { ResultActions, type Result } from "./Share";
import { Prompt } from "./Prompt";

interface Q { id: string; type?: string; prompt: string; options: string[] }
interface Reveal { correct: boolean; correctIndex: number; explanation: string; points: number }
interface Row { rank: number; name: string; score: number; totalMs: number }

import { GAMES } from "./games";
interface Standing { id: string; name: string; bot: boolean; score: number }
function StandingsList({ rows }: { rows: Standing[] }) { return <div className="standings" aria-label="Standings"><h3>Standings</h3><ol>{[...rows].sort((a, b) => b.score - a.score).map((r) => <li key={r.id}><b>{r.name}</b>{r.bot && <span className="mode-badge">BOT</span>} <em>{r.score} pts</em></li>)}</ol></div>; }
export default function Daily({ challenge, practice, mode, bots, difficulty }: { challenge?: string; practice?: boolean; mode?: string; bots?: number; difficulty?: string }) {
  const [standings, setStandings] = useState<Standing[]>([]);
  const base = challenge ? `/api/challenges/${challenge}` : practice ? "/api/practice" : "/api/daily";
  const [phase, setPhase] = useState<"boot" | "waking" | "name" | "play" | "reveal" | "done" | "error">("boot");
  const [name, setName] = useState(""); const [q, setQ] = useState<Q | null>(null); const [idx, setIdx] = useState(0); const [total, setTotal] = useState(0);
  const [reveal, setReveal] = useState<Reveal | null>(null); const [next, setNext] = useState<Q | null>(null); const [result, setResult] = useState<Result | null>(null);
  const [rows, setRows] = useState<Row[]>([]); const [msg, setMsg] = useState(""); const [answerBusy, setAnswerBusy] = useState(false);
  const start = async () => {
    try { const r = await api<{ question: Q; index: number; total: number }>(`${base}/start`, practice ? { mode: mode ?? "mixed", bots: bots ?? 0, difficulty: difficulty ?? "medium" } : {}); setQ(r.question); setIdx(r.index); setTotal(r.total); setPhase("play"); setMsg(""); }
    catch (e) { if (e instanceof ApiError && e.status === 409) { setMsg("You already completed this challenge."); void board(); setPhase("done"); } else if (e instanceof ApiError && e.status === 401) setPhase("name"); else { setMsg("Today’s challenge isn’t available right now."); setPhase("error"); } }
  };
  const board = async () => { try { setRows((await api<{ rows: Row[] }>("/api/leaderboard/daily")).rows); } catch { setRows([]); } };
  useEffect(() => { waitForServer(() => setPhase("waking")).then(() => (getToken() ? start() : setPhase("name"))).catch(() => { setMsg("Can’t reach the server. Start the backend and try again."); setPhase("error"); }); }, []);
  const join = async () => { try { await ensureGuest(name); setMsg(""); await start(); } catch (e) { setMsg(guestErrorMessage(e)); } };
  const answer = async (choice: number) => {
    if (!q || answerBusy) return;
    setAnswerBusy(true);
    try {
      const r = await api<{ reveal: Reveal; next?: Q; index?: number; result?: Result }>(`${base}/answer`, { questionId: q.id, choice });
      setReveal(r.reveal); setNext(r.next ?? null); { const st = (r.reveal as any).standings ?? (r.result as any)?.standings; if (st) setStandings(st); } if (r.result) { setResult(r.result); if (!practice) void board(); } setPhase("reveal");
    } catch { setMsg("Your answer could not be submitted. Check your connection and try again."); }
    finally { setAnswerBusy(false); }
  };
  const advance = () => { if (result) return setPhase("done"); setQ(next); setIdx(idx + 1); setReveal(null); setPhase("play"); };
  const gameName = GAMES.find((x) => x.id === mode)?.title; const title = challenge ? "Friend challenge" : practice ? (gameName ? `${gameName} · ${bots ? "vs Bots" : "Solo practice"}` : "Practice Room") : "Daily Dangal";
  const progress = total > 0 ? Math.min(100, ((idx + (phase === "reveal" ? 1 : 0)) / total) * 100) : 0;

  return <main className="daily-page">
    <div className="daily-page-top"><Link to="/" className="subtle-link"><ArrowLeft size={15} /> Back home</Link><span className="pill-muted"><CalendarDays size={14} /> {practice ? "UNRANKED PRACTICE" : challenge ? "FRIEND CHALLENGE" : "DAILY CHALLENGE"}</span></div>
    <div className="daily-intro"><div className="daily-icon"><CalendarDays size={25} /></div><div><span className="section-kicker">YOUR DAILY MOMENT</span><h1>{title}</h1><p>{practice ? "Warm up, learn the patterns and improve without affecting your ranked score." : challenge ? "Your friend has set a challenge. Can you beat their score?" : "A fresh question set, a new personal best to chase."}</p></div></div>

    {(phase === "boot" || phase === "waking") && <section className="daily-state-card"><LoaderCircle className="notice-spinner" size={25} /><h2>{phase === "waking" ? "Waking up the game server…" : "Getting today's challenge ready…"}</h2><p>{phase === "waking" ? "The free server may take a little time to start. Keep this tab open." : "Connecting to DostLeague."}</p></section>}
    {phase === "error" && <section className="daily-state-card"><div className="state-icon error-icon"><Zap size={23} /></div><h2>We couldn't load this challenge</h2><p>{msg}</p><button className="btn btn-primary" onClick={() => { setPhase("boot"); setMsg(""); void waitForServer(() => setPhase("waking")).then(() => (getToken() ? start() : setPhase("name"))).catch(() => { setMsg("Can’t reach the server. Try again in a moment."); setPhase("error"); }); }}>Try again <ArrowRight size={15} /></button></section>}

    {phase === "name" && <section className="daily-name-card"><div className="name-card-icon"><UserRound size={22} /></div><h2>Let's get you in!</h2><p>Choose a display name to start playing. Your friends will see this name in the game.</p><form className="form-stack" onSubmit={(e) => { e.preventDefault(); void join(); }}><label className="form-label">Display name<input autoFocus required minLength={2} className="mt-2" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="nickname" placeholder="e.g. Suraj" /></label><button type="submit" className="btn btn-primary" disabled={name.trim().length < 2}>Play as guest <ArrowRight size={16} /></button><p role="alert" className="form-err">{msg}</p><p className="form-help">2–24 characters. Guest results save to this browser profile when the server/database is available. <Link to="/account" className="inline-link">Sign in or create an account</Link> to access your profile on another device.</p></form></section>}

    {(phase === "play" || phase === "reveal") && q && <section className="daily-game-layout">
      <div className="game-screen daily-question-screen">
        <div className="game-meta-row"><span className="pill-muted"><Sparkles size={13} /> {practice ? "PRACTICE ROUND" : "TODAY'S DANGAL"}</span><span className="pill-muted">Question {idx + 1} of {total}</span><span className="timer-pill"><Clock3 size={14} /> No rush</span></div>
        <div className="game-progress"><div className="game-progress-fill" style={{ width: `${progress}%` }} /></div>
        <div className="question-card"><span className="question-category">{q.type ? q.type.replace(/_/g, " ") : "QUICK CHALLENGE"}</span><Prompt q={q} />
          <div className="answer-grid">{q.options.map((o, i) => <button key={i} disabled={phase === "reveal" || answerBusy} onClick={() => void answer(i)} className={`answer-option${reveal ? (i === reveal.correctIndex ? " correct" : " incorrect") : ""}`}><span className="answer-letter">{String.fromCharCode(65 + i)}</span><span>{o}</span>{reveal && i === reveal.correctIndex && <CheckCircle2 size={17} />}</button>)}</div>
          {answerBusy && <p className="form-help mt-3"><LoaderCircle size={13} className="inline notice-spinner" /> Saving your answer…</p>}
          {reveal && <div role="status" className={`explanation-box${reveal.correct ? "" : " explanation-wrong"}`}><CheckCircle2 size={18} /><div><strong>{reveal.correct ? `Correct! +${reveal.points} points` : "Not quite this time"}</strong><p>{reveal.explanation}</p><button className="btn btn-primary mt-3" onClick={advance}>{result ? "See results" : "Next question"} <ArrowRight size={15} /></button></div></div>}
          {msg && <p role="alert" className="form-err mt-3">{msg}</p>}
        </div>
      </div>
      {standings.length > 1 && phase !== "done" && <StandingsList rows={standings} />}<aside className="daily-side-panel"><div className="daily-side-icon"><Trophy size={23} /></div><span className="section-kicker">YOUR PROGRESS</span><h2>Keep the streak alive.</h2><p>Play the daily challenge, review the answers and come back tomorrow to beat your score.</p><div className="side-progress-line"><span style={{ width: `${progress}%` }} /></div><div className="side-progress-label"><span>Questions completed</span><strong>{idx + (phase === "reveal" ? 1 : 0)} / {total}</strong></div><div className="side-tip"><Zap size={16} /><span>Accuracy first. Speed comes after.</span></div></aside>
    </section>}

    {phase === "done" && <section className="daily-results">
      <div className="result-celebration"><div className="result-trophy"><Trophy size={32} /></div><span className="section-kicker">CHALLENGE COMPLETE</span><h2>{result ? "Nice run!" : "You're all caught up."}</h2><p>{result ? "Your result is ready. Challenge a friend and see if they can beat you." : msg || "Today's ranked attempt is already completed in this browser."}</p></div>
      {result && <>{standings.length > 1 && <StandingsList rows={standings} />}<div className="result-metric-grid"><div className="result-metric"><span className="metric-emoji"><Crown size={19} /></span><small>Final score</small><strong>{result.score}</strong></div><div className="result-metric"><span className="metric-emoji green"><CheckCircle2 size={19} /></span><small>Correct answers</small><strong>{result.correct}/{result.total}</strong></div><div className="result-metric"><span className="metric-emoji blue"><Zap size={19} /></span><small>Accuracy</small><strong>{result.accuracy}%</strong></div></div>{!practice && <ResultActions result={result} challenge={challenge} />}{practice && <p className="form-help">{result.saved ? "Saved to your game history. Practice does not affect competitive rankings." : "This practice result could not be confirmed as saved. Check your connection and open History to verify."}</p>}</>}
      {msg && <p className="form-help">{msg}</p>}
      {!practice && <div className="daily-leaderboard"><div className="section-heading"><div><span className="section-kicker"><Trophy size={14} /> DAILY RANKINGS</span><h2>Today's leaderboard</h2></div><Link to="/leaderboard" className="subtle-link">Full leaderboard <ArrowRight size={15} /></Link></div>{rows.length === 0 ? <p className="empty-note">No ranked results yet. Be one of the first to play today.</p> : <ol className="score-list">{rows.slice(0, 5).map((r) => <li key={r.rank} className={`score-row${r.rank === 1 ? " winner" : ""}`}><span className="score-rank">{r.rank === 1 ? <Crown size={15} /> : r.rank}</span><span className="score-name">{r.name}</span><strong className="score-total">{r.score} pts</strong></li>)}</ol>}</div>}
      <div className="room-actions"><Link to="/daily" className="btn btn-primary"><Flame size={16} /> Play again tomorrow</Link><Link to="/" className="btn btn-outline">Back to home</Link></div>
    </section>}
  </main>;
}
