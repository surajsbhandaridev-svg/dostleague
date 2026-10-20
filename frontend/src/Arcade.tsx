import { useEffect, useState } from "react"; import { Link, NavLink, useLocation, useSearchParams } from "react-router-dom";
import { Search, Home as HomeIcon, Gamepad2, Swords, CalendarDays, BarChart3, CircleHelp, User, Users, Crown, Zap, Bot, Trophy, ChevronRight, Play, BookOpen, Clock, MessagesSquare, LogIn } from "lucide-react";
import { api, ApiError, getToken } from "./api"; import { GAMES } from "./games"; import { GameLibrary } from "./GameLibrary"; import { Footer } from "./Public";
interface Stats { dailyPacks: number; dailyQuestions: number; communityChallenges: number; matchesPlayed: number; players: number }
interface Preview { date: string; total: number; categories: string[] } interface Row { rank: number; name: string; score: number }
const initials = (n: string | null) => (n ? n.slice(0, 2).toUpperCase() : "G");
const lead = "ar-link";
export function ArcadeShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation(); const [me, setMe] = useState<string | null>(null); const [st, setSt] = useState<"online" | "offline" | "guest">("guest"); const [accountLinked, setAccountLinked] = useState(false); const [q, setQ] = useState(""); const [focus, setFocus] = useState(false);
  useEffect(() => {
    let live = true;
    const refreshIdentity = () => {
      if (!getToken()) { setMe(null); setSt("guest"); setAccountLinked(false); return; }
      api<{ player: { displayName: string }; account: boolean }>("/api/auth/me").then((r) => { if (live) { setMe(r.player.displayName); setSt("online"); setAccountLinked(r.account); } }).catch((e) => { if (live) { setMe(null); setAccountLinked(false); setSt(e instanceof ApiError && e.status === 401 ? "guest" : "offline"); } });
    };
    refreshIdentity();
    window.addEventListener("dostleague:auth-change", refreshIdentity);
    return () => { live = false; window.removeEventListener("dostleague:auth-change", refreshIdentity); };
  }, [loc.pathname]);
  const term = q.trim().toLowerCase(); const results = term ? GAMES.filter((g) => `${g.title} ${g.categoryLabel}`.toLowerCase().includes(term)).slice(0, 6) : [];
  const L = (to: string, label: string, icon: React.ReactNode, end = false) => <NavLink to={to} end={end} className={({ isActive }) => `${lead}${isActive ? " active" : ""}`}>{icon}<span>{label}</span></NavLink>;
  return (<div className="ar-shell">
    <header className="ar-header"><Link to="/" className="ar-brand" aria-label="DostLeague home"><Crown size={22} aria-hidden="true" /><span>Dost<em>League</em></span></Link>
      <div className="ar-search" role="search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search games" placeholder="Search games…" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
        {focus && term && <ul className="ar-results" onMouseDown={(e) => e.preventDefault()}>{results.length ? results.map((g) => <li key={g.id}><Link to={`/?game=${g.id}`} onClick={() => setQ("")}><img src={g.image} alt="" width={48} height={27} /><span>{g.title}<small>{g.categoryLabel}</small></span></Link></li>) : <li className="ar-none">No games match “{q}”</li>}</ul>}</div>
      <Link to="/history" className="ar-icon-link" aria-label="Match history"><Clock size={19} /></Link>
      <Link to="/account" className="ar-account-cta" aria-label={accountLinked ? "Manage account" : "Sign in or create account to save progress"}><LogIn size={17} /><span>{accountLinked ? "Account" : st === "offline" ? "Connection issue" : "Sign in / Save progress"}</span></Link>
      <Link to="/profile" className="ar-profile" aria-label="Your profile"><span className="ar-avatar">{initials(me)}</span><span><strong>{me ?? "Guest"}</strong><small className={`ar-st-${st}`}>{st === "online" ? "Player online" : st === "offline" ? "Server offline" : "Guest profile"}</small></span></Link></header>
    <nav className="ar-rail" aria-label="Main">{L("/", "Home", <HomeIcon size={20} />, true)}<Link to={{ pathname: "/", hash: "#games" }} className={lead}><Gamepad2 size={20} /><span>Games</span></Link>{L("/battle", "Friend Battle", <Swords size={20} />)}{L("/daily", "Daily Dangal", <CalendarDays size={20} />)}{L("/leaderboard", "Leaderboard", <BarChart3 size={20} />)}
      <p className="ar-more">MORE</p>{L("/how-to-play", "How to Play", <CircleHelp size={20} />)}{L("/profile", "My Profile", <User size={20} />)}{L("/community", "Community", <MessagesSquare size={20} />)}{L("/articles", "Articles", <BookOpen size={20} />)}</nav>
    <div className="ar-content">{children}</div></div>);
}
const istLeft = () => { const now = Date.now() + 19_800_000; const ms = (Math.floor(now / 86_400_000) + 1) * 86_400_000 - now; const m = Math.floor(ms / 60_000); return `${Math.floor(m / 60)}h ${m % 60}m`; };
export function Home() {
  const [sp] = useSearchParams(); const loc = useLocation(); const [stats, setStats] = useState<Stats | null>(null); const [pv, setPv] = useState<Preview | null>(null); const [top, setTop] = useState<Row[]>([]); const [left, setLeft] = useState(istLeft());
  useEffect(() => { api<Stats>("/api/stats").then(setStats).catch(() => {}); api<Preview>("/api/daily/preview").then(setPv).catch(() => {}); api<{ rows: Row[] }>("/api/leaderboard/weekly").then((r) => setTop(r.rows.slice(0, 5))).catch(() => {}); const t = setInterval(() => setLeft(istLeft()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (loc.hash === "#games") document.getElementById("games")?.scrollIntoView?.({ behavior: "smooth" }); }, [loc.hash]);
  const sab = GAMES.find((g) => g.id === "saboteur")!; const num = (n?: number) => (stats && n !== undefined ? n.toLocaleString() : "—");
  return (<main className="landing-wrap ar-home">
    <div className="ar-main"><div className="ar-hero" aria-label="Featured game"><div className="ar-hero-copy"><p className="ar-tag">Play. Compete. Make Friends.</p><h1>{sab.title}</h1><p>{sab.blurb}</p><div className="ar-badges"><span>VS BOTS</span><span>{sab.players[0]}–{sab.players[1]} PLAYERS</span><span>UNRANKED</span></div></div>
        <img className="ar-hero-img" src={sab.image} alt={sab.alt} width={640} height={360} /><Link to="/saboteur?difficulty=medium" className="ar-cta" aria-label="Play Signal Saboteur now">Play Now <ChevronRight size={18} aria-hidden="true" /></Link></div>
      <GameLibrary initialOpenId={sp.get("game")} /></div>
    <aside className="ar-side" aria-label="Daily and quick play">
      <div className="ar-daily"><Trophy size={44} aria-hidden="true" /><div><h2>Daily Dangal</h2><p>New challenge every day!</p><p className="ar-ends">Ends in <b>{left}</b> (IST){pv ? ` · ${pv.total} questions` : ""}</p></div><Link to="/daily" className="ar-cta ar-cta-gold">Play Now <ChevronRight size={18} aria-hidden="true" /></Link></div>
      <div className="ar-panel"><h2><Zap size={19} aria-hidden="true" /> Quick Play</h2><p>Jump into a game instantly</p><div className="ar-quick">
        <Link to="/practice/trivia"><User size={22} aria-hidden="true" /><strong>Solo Mode</strong><small>Play alone</small></Link><Link to="/practice/trivia?bots=3&difficulty=medium"><Bot size={22} aria-hidden="true" /><strong>Vs Bots</strong><small>Play with computers</small></Link>
        <Link to="/battle"><Users size={22} aria-hidden="true" /><strong>With Friends</strong><small>Create or join</small></Link><Link to="/practice"><Play size={22} aria-hidden="true" /><strong>Practice</strong><small>Improve your skills</small></Link></div></div>
      <div className="ar-panel"><div className="ar-panel-head"><h2><Crown size={19} aria-hidden="true" /> Top Players</h2><Link to="/leaderboard">View All <ChevronRight size={15} aria-hidden="true" /></Link></div>
        {top.length ? <ol className="ar-top">{top.map((r) => <li key={r.rank}><span>{r.rank}</span><b>{r.name}</b><em>{r.score}</em></li>)}</ol> : <p className="ar-empty">No ranked scores this week yet. Play the Daily Dangal to be first.</p>}<small className="ar-note">Real scores, this week</small></div></aside>
    <div className="ar-bar"><div><h2>Play Together, Grow Together</h2><p>From solo challenges to friend battles, there is always a game waiting.</p></div>
      <dl className="ar-stats"><div><dt>Games</dt><dd>{GAMES.length}</dd></div><div><dt>Players</dt><dd>{num(stats?.players)}</dd></div><div><dt>Daily challenges</dt><dd>{num(stats?.dailyPacks)}</dd></div></dl></div>
    <div className="ar-foot"><Footer /></div></main>);
}
