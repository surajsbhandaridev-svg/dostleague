import { useEffect, useState } from "react"; import { Link } from "react-router-dom"; import { api } from "./api";
interface Prof { player: { displayName: string; avatar: string }; stats: Record<string, number>; achievements: { code: string; title: string; description: string; earned: boolean }[] }
export function Profile() {
  const [p, setP] = useState<Prof | null>(null); const [name, setName] = useState(""); const [msg, setMsg] = useState(""); const [email, setEmail] = useState<string | null>(null);
  const load = () => { api<Prof>("/api/profile/me").then((r) => { setP(r); setName(r.player.displayName); }).catch(() => setMsg("Play as a guest first or sign in to view your profile.")); api<{ email: string | null }>("/api/auth/me").then((r) => setEmail(r.email)).catch(() => setEmail(null)); };
  useEffect(() => { void load(); }, []);
  const save = async () => { try { await api("/api/profile", { displayName: name, avatar: p?.player.avatar ?? "a1" }); setMsg("Saved."); void load(); } catch { setMsg("Name must be 2–24 letters/numbers."); } };
  return (<main className="mx-auto max-w-xl p-6"><Link to="/" className="text-sm text-slate-400">← DostLeague</Link><h1 className="mt-2 text-2xl font-bold">Your profile</h1><p role="status">{msg}</p>
    {!p && <div className="mt-4 rounded-xl border border-white/10 bg-slate-900/60 p-4"><p className="text-slate-300">Sign in to recover a saved profile, or create an account to keep your guest progress.</p><Link to="/account" className="btn btn-primary mt-3 inline-flex">Sign in / Create account</Link></div>}
    {p && <><label className="mt-3 block text-sm">Display name<input className="mt-1 w-full rounded-lg bg-navy-800 p-2" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} /></label><button className="btn mt-2" onClick={save}>Save</button>
      <p className="mt-4">Streak <b className="text-lime">{p.stats.streak}</b> · Best <b className="text-lime">{p.stats.bestScore}</b> · Dangals {p.stats.dailyCount} · Battles {p.stats.matchesPlayed} (won {p.stats.matchesWon})</p>
      {email ? <p className="mt-1 text-xs text-emerald-300">Account linked: {email}. Sign in with this email and password on another device to access this player profile.</p> : <p className="mt-1 text-xs text-slate-400">This is a guest profile. It is stored in the database, but the browser token is required to recover it. <Link to="/account" className="text-indigo-300 underline">Create an account to save access to this profile.</Link></p>}
      <h2 className="mt-4 font-semibold">Achievements</h2><ul>{p.achievements.map((a) => <li key={a.code} className={`py-1 ${a.earned ? "" : "opacity-50"}`}><b>{a.earned ? "✓ " : ""}{a.title}</b> — {a.description}</li>)}</ul>
      <Link to="/history" className="mt-3 inline-block underline">Match & challenge history</Link></>}</main>);
}
