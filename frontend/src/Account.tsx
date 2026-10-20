import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { api, ApiError, getToken, setToken, clearGuestToken } from "./api";

type AuthMe = { player: { id: string; displayName: string; avatar: string }; email: string | null; account: boolean };
export function Account() {
  const [tab, setTab] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [me, setMe] = useState<AuthMe | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loadError, setLoadError] = useState("");

  const reloadMe = async () => {
    if (!getToken()) { setMe(null); setLoadError(""); setLoading(false); return; }
    setLoading(true);
    try { setMe(await api<AuthMe>("/api/auth/me")); setLoadError(""); }
    catch (e) {
      setMe(null);
      // If the saved browser credential is revoked/invalid, stop treating it as a guest profile.
      // Network/server failures should not erase a potentially valid token.
      if (e instanceof ApiError && e.status === 401) { clearGuestToken(); setLoadError(""); }
      else setLoadError("We could not verify this browser profile. Check that the backend and database are online, then retry. Your saved token has not been removed.");
    }
    finally { setLoading(false); }
  };
  useEffect(() => { void reloadMe(); }, []);

  const explainError = (e: unknown) => {
    if (e instanceof ApiError) {
      if (e.code === "email_already_exists") return "This email already has an account. Choose Sign in.";
      if (e.code === "invalid_credentials" || e.status === 401) return "Email or password is incorrect.";
      if (e.code === "account_already_linked") return "This profile already has an account.";
      if (e.code === "invalid_input") return "Check the form. Use a valid email, a name of 2–24 characters, and a password of at least 10 characters.";
      if (e.status >= 500) return "The server could not complete this request. Check the backend and database connection.";
      return `Could not continue (${e.code}). Please try again.`;
    }
    return "Could not reach the server. Check that the DostLeague backend is running.";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(""); setMsg(""); setBusy(true);
    try {
      if (tab === "login") {
        if (getToken() && me && !me.account) {
          const proceed = window.confirm("You are currently playing as a guest. Signing into an existing account will switch this browser to that account; guest progress will not be merged automatically. To keep this guest progress, choose Create account instead.");
          if (!proceed) return;
        }
        const r = await api<{ token: string; email: string; player: { displayName: string } }>("/api/auth/login", { email, password });
        setToken(r.token); setMsg(`Signed in as ${r.player.displayName}. Your saved account data is ready.`); setPassword(""); await reloadMe();
      } else {
        if (password.length < 10) { setErr("Use a password with at least 10 characters."); return; }
        if (getToken()) {
          const r = await api<{ email: string; player: { displayName: string } }>("/api/auth/upgrade", { email, password });
          setMsg(`Account created for ${r.player.displayName}. Your existing guest profile and saved history stay linked to this account.`);
          setPassword(""); await reloadMe();
        } else {
          if (name.trim().length < 2 || name.trim().length > 24) { setErr("Enter a display name between 2 and 24 characters."); return; }
          const r = await api<{ token: string; email: string; player: { displayName: string } }>("/api/auth/register", { displayName: name.trim(), avatar: "a1", email, password });
          setToken(r.token); setMsg(`Account created. Welcome, ${r.player.displayName}! Your results can now follow your account when you sign in on another device.`); setPassword(""); await reloadMe();
        }
      }
    } catch (e) { setErr(explainError(e)); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    setErr(""); setMsg(""); setBusy(true);
    try { await api("/api/auth/logout", {}); } catch { /* remove local token even if server is sleeping */ }
    clearGuestToken(); setMe(null); setBusy(false); setMsg("Signed out on this browser.");
  };

  return <main className="account-page mx-auto max-w-xl p-5 md:p-8">
    <Link to="/" className="subtle-link"><ArrowLeft size={15} /> Back to DostLeague</Link>
    <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/65 p-5 md:p-7 shadow-2xl">
      <div className="mb-5 flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200"><ShieldCheck size={25} /></div><div><p className="text-xs font-bold tracking-[0.18em] text-indigo-300">DOSTLEAGUE ACCOUNT</p><h1 className="text-2xl font-extrabold">Keep your progress</h1></div></div>
      {loading ? <p className="text-sm text-slate-300">Checking your player profile…</p> : loadError && getToken() ? <div role="alert" className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4"><p className="font-semibold text-amber-100">Could not check the saved profile</p><p className="text-sm text-slate-200">{loadError}</p><button type="button" className="btn btn-primary" onClick={() => void reloadMe()}>Retry connection check</button></div> : me?.account ? <div className="space-y-4"><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4"><p className="flex items-center gap-2 font-semibold text-emerald-200"><CheckCircle2 size={18} /> Account connected</p><p className="mt-2 text-slate-100">{me.player.displayName}</p><p className="text-sm text-slate-300">{me.email}</p><p className="mt-3 text-sm text-slate-300">Your account is linked to this player profile. Ranked results, completed friend matches, and saved practice results are associated with this player.</p></div><button className="btn btn-outline" disabled={busy} onClick={() => void logout()}>{busy ? "Signing out…" : "Sign out on this browser"}</button><Link to="/profile" className="ml-3 text-sm text-indigo-300 underline">View profile</Link></div> : <>
        {getToken() && me && !me.account && <div className="mb-4 rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-sm text-sky-100"><b>Guest profile found: {me.player.displayName}.</b><br />Your completed results are saved to the database under this profile. Create an account to attach an email and password to this exact profile so you can sign in on another device.</div>}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-900 p-1"><button type="button" className={`rounded-lg px-3 py-2 text-sm font-bold ${tab === "register" ? "bg-indigo-500 text-white" : "text-slate-300"}`} onClick={() => { setTab("register"); setErr(""); setMsg(""); }}>Create account</button><button type="button" className={`rounded-lg px-3 py-2 text-sm font-bold ${tab === "login" ? "bg-indigo-500 text-white" : "text-slate-300"}`} onClick={() => { setTab("login"); setErr(""); setMsg(""); }}>Sign in</button></div>
        <form className="space-y-4" onSubmit={(e) => void submit(e)}>
          {tab === "register" && !getToken() && <label className="block text-sm font-semibold text-slate-200">Display name<input className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none focus:border-indigo-400" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={24} autoComplete="nickname" placeholder="Choose your player name" /></label>}
          <label className="block text-sm font-semibold text-slate-200">Email<input className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none focus:border-indigo-400" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} autoComplete="email" placeholder="you@example.com" /></label>
          <label className="block text-sm font-semibold text-slate-200">Password<input className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-white outline-none focus:border-indigo-400" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} maxLength={128} autoComplete={tab === "login" ? "current-password" : "new-password"} placeholder={tab === "login" ? "Your password" : "At least 10 characters"} /></label>
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : tab === "login" ? <><LogIn size={16} /> Sign in</> : <><UserPlus size={16} /> {getToken() ? "Save my guest progress" : "Create account"}</>}</button>
        </form>
        {tab === "register" && <p className="mt-3 text-xs leading-relaxed text-slate-400">Passwords are hashed on the server. Your email is used for account sign-in. We do not send a verification email in this version, so use an email address you control and protect your password.</p>}
      </>}
      {err && <p role="alert" className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-200">{err}</p>}
      {msg && <p role="status" className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-200">{msg}</p>}
      <p className="mt-5 text-sm text-slate-400">Guest play stores results under this browser's profile when the server/database is online. Create an account to recover the same profile and history on another device. If a game reports that a result could not be saved, check the server connection and database migration status.</p>
    </div>
  </main>;
}
