import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Crown, Medal, Trophy, Users, History as HistoryIcon, CalendarDays } from "lucide-react";
import { api } from "./api";
import Daily from "./Daily";

interface Row { rank: number; name: string; score: number; correct: number; totalMs: number }
export function Leaderboard() {
  const [p, setP] = useState<"daily" | "weekly" | "all" | "friends" | "category">("daily");
  const [cat, setCat] = useState("Patterns"); const [page, setPage] = useState(0); const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { setRows(null); api<{ rows: Row[] }>(p === "category" ? `/api/leaderboard/category/${cat}?period=weekly&page=${page}` : p === "friends" ? `/api/leaderboard/friends?period=weekly&page=${page}` : `/api/leaderboard/${p}?page=${page}`).then((r) => setRows(r.rows)).catch(() => setRows([])); }, [p, page, cat]);
  const tabs = (["daily", "weekly", "all", "friends", "category"] as const);
  return <main className="leaderboard-page">
    <Link to="/" className="subtle-link"><ArrowLeft size={15} /> Back home</Link>
    <div className="leaderboard-hero"><div className="daily-icon leaderboard-icon"><Trophy size={28} /></div><span className="section-kicker">THE FRIENDLY RACE</span><h1>Leaderboard</h1><p>Every round counts. See who's climbing the DostLeague ranks.</p></div>
    <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard period">{tabs.map((x) => <button key={x} role="tab" aria-selected={p === x} onClick={() => { setP(x); setPage(0); }} className={p === x ? "selected" : ""}>{x === "all" ? "All-time" : x === "category" ? "By category" : x[0].toUpperCase() + x.slice(1)}</button>)}</div>
    {p === "category" && <label className="form-label leaderboard-category">Category<select aria-label="Category" value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }}>{["Patterns", "Logic", "Memory", "Science", "Geography", "Emoji", "Riddles", "Maths", "Music", "General"].map((c) => <option key={c}>{c}</option>)}</select></label>}
    <div className="leaderboard-description"><Users size={15} /> Ranked by score, then lower completion time. Weekly rankings run Monday–Sunday (IST).</div>
    {rows === null ? <div className="leaderboard-empty">Loading leaderboard…</div> : rows.length === 0 ? <div className="leaderboard-empty"><div className="leader-empty-icon"><Medal size={25} /></div><h2>Your league starts here.</h2><p>No ranked results yet. Play a challenge and become one of the first players on the board.</p><Link to="/daily" className="btn btn-primary">Play Daily Dangal <ArrowRight size={15} /></Link></div> : <>
      <div className="leaderboard-count-row"><span><Trophy size={14} /> {p === "daily" ? "Today's top players" : p === "weekly" ? "This week's top players" : p === "all" ? "All-time leaders" : p === "friends" ? "Your friends" : `${cat} leaders`}</span><small>Page {page + 1}</small></div>
      <ol className="leaderboard-list">{rows.map((r) => <li key={r.rank} className={`leaderboard-row${r.rank === 1 ? " first-place" : ""}`}><span className={`leader-rank rank-${r.rank <= 3 ? r.rank : "other"}`}>{r.rank === 1 ? <Crown size={17} /> : r.rank === 2 ? <Medal size={17} /> : r.rank === 3 ? <Medal size={16} /> : r.rank}</span><span className="leader-avatar">{r.name.slice(0,1).toUpperCase()}</span><span className="leader-name"><strong>{r.name}</strong><small>{r.correct} correct · {(r.totalMs / 1000).toFixed(1)}s</small></span><strong className="leader-score">{r.score.toLocaleString()} <small>pts</small></strong></li>)}</ol>
    </>}
    <div className="leaderboard-pagination"><button className="btn btn-outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><button className="btn btn-outline" disabled={!rows || rows.length < 20} onClick={() => setPage(page + 1)}>Next page</button></div>
  </main>;
}

export function History() {
  const [rows, setRows] = useState<{ kind: string; at: string; score: number; correct: number; rank: number | null }[] | null>(null); const [err, setErr] = useState("");
  useEffect(() => { api<{ rows: typeof rows }>("/api/me/history").then((r) => setRows(r.rows)).catch(() => setErr("Your history loads for this guest profile or signed-in account. Check your connection if it cannot load.")); }, []);
  return <main className="history-page"><Link to="/" className="subtle-link"><ArrowLeft size={15} /> Back home</Link><div className="daily-intro"><div className="daily-icon"><HistoryIcon size={24} /></div><div><span className="section-kicker">YOUR PLAY RECORD</span><h1>Your history</h1><p>See the challenges you've completed and the scores you've earned.</p></div></div><p role="status" className="form-help">{err} {err && <Link to="/account" className="underline">Sign in / create account</Link>}</p>
    {!rows?.length && !err && <div className="leaderboard-empty">Loading your match history…</div>}
    {rows?.length === 0 && !err && <div className="leaderboard-empty"><CalendarDays size={25} /><h2>No games yet</h2><p>Your completed challenges will appear here.</p><Link to="/daily" className="btn btn-primary">Play today's challenge</Link></div>}
    <ul className="history-list">{rows?.map((r, i) => <li key={i}><span className="history-symbol"><Trophy size={16} /></span><div className="history-copy"><strong>{({ daily: "Daily Dangal", match: "Friend Battle", challenge: "Friend Challenge", practice: "Solo/Bot Practice", saboteur: "Signal Saboteur" } as Record<string, string>)[r.kind] ?? r.kind}{r.rank ? ` · #${r.rank}` : ""}</strong><small>{new Date(r.at).toLocaleString()}</small></div><div className="history-score"><strong>{r.score} pts</strong><small>{r.correct} correct</small></div></li>)}</ul>
  </main>;
}

export function ChallengePage() {
  const { code } = useParams(); const [c, setC] = useState<any>(null); const [err, setErr] = useState(""); const [play, setPlay] = useState(false);
  useEffect(() => { api(`/api/challenges/${code}`).then(setC).catch(() => setErr("Challenge not found.")); }, [code]);
  if (play) return <Daily challenge={code} />;
  return <main className="challenge-page"><Link to="/" className="subtle-link"><ArrowLeft size={15} /> Back home</Link><div className="result-celebration"><div className="result-trophy"><Trophy size={32} /></div><span className="section-kicker">FRIEND CHALLENGE</span><h1>Can you beat this score?</h1><p>Play the same challenge and see who comes out on top.</p></div><p role="alert" className="form-err">{err}</p>
    {c && <div className="friend-challenge-card"><p><strong>{c.challenger.name}</strong> scored</p><strong className="challenge-score">{c.challenger.score}</strong><p>{c.challenger.correct} correct answers</p><span className="pill-muted">Status: {c.status}</span><p className="form-help">This is an asynchronous challenge, not a live room.</p>{c.status === "open" && <button className="btn btn-primary mt-4" onClick={() => setPlay(true)}>Accept challenge <ArrowRight size={15} /></button>}{c.opponent && <p className="mt-4">{c.opponent.name} scored {c.opponent.score} — {c.winner === "tie" ? "It's a tie!" : `${c.winner === "challenger" ? c.challenger.name : c.opponent.name} wins`}</p>}</div>}</main>;
}
