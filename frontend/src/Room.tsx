import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Socket } from "socket.io-client";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Clipboard, Crown, Gamepad2, Link2, LoaderCircle, LockKeyhole, Play, Share2, ShieldCheck, Swords, Trophy, Users, Zap } from "lucide-react";
import { connect } from "./socket";
import { api, ApiError, clearGuestToken, ensureGuest, getToken, guestErrorMessage } from "./api";
import { Prompt } from "./Prompt";

interface P { id: string; name: string; ready: boolean; connected: boolean; score: number; answered: boolean }
interface RoomV { mode: string; code: string; hostId: string; status: string; maxPlayers: number; players: P[] }
interface Q { id: string; type?: string; prompt: string; options: string[] }

export function Battle() {
  const modeQ = (() => { const m = new URLSearchParams(window.location.search).get("mode"); return m ? `?mode=${encodeURIComponent(m)}` : ""; })();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const nameTouched = useRef(false);
  const [nameLoading, setNameLoading] = useState(!!getToken());
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get("join")?.trim().toUpperCase().slice(0, 6) ?? "");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!getToken()) { setNameLoading(false); return; }
    api<{ player: { displayName: string } }>("/api/profile/me")
      .then((r) => { if (!nameTouched.current) setName(r.player.displayName); })
      .catch(() => { setErr("Could not load your saved profile. You can still enter a name and try again."); })
      .finally(() => setNameLoading(false));
  }, []);

  const go = async (to: string) => {
    try {
      if (!getToken()) await ensureGuest(name);
      else if (name.trim()) {
        try { await api("/api/profile", { displayName: name.trim(), avatar: "a1" }); }
        catch (e) {
          if (e instanceof ApiError && e.status === 401) { clearGuestToken(); await ensureGuest(name); }
          else throw e;
        }
      }
      setErr(""); nav(to);
    } catch (e) { setErr(guestErrorMessage(e)); }
  };

  const copyRoomCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { setErr("Could not copy the code. You can select and copy it manually."); }
  };

  return <main className="battle-page">
    <section className="battle-intro no-panel">
      <Link to="/" className="subtle-link"><ArrowLeft size={15} /> Back home</Link>
      <div className="battle-icon-large mt-5"><Swords size={30} /></div>
      <span className="eyebrow mt-5"><span className="eyebrow-dot" /> FRIEND BATTLE</span>
      <h1>Make it a<br /><span className="brand-accent">friendly showdown.</span></h1>
      <p>Create a private room, invite your gang, and see who knows the most. No account or download required to get started.</p>
      <div className="battle-feature-list">
        <span><CheckCircle2 size={17} /> Play with 2–6 friends</span>
        <span><CheckCircle2 size={17} /> Live questions and scores</span>
        <span><CheckCircle2 size={17} /> Share a room link or code</span>
      </div>
      <div className="battle-avatars" aria-hidden="true"><span>R</span><span>A</span><span>P</span><span>K</span><small>Your gang is one invite away</small></div>
    </section>

    <section className="battle-forms no-panel">
      <div className="form-card profile-name-card">
        <div className="name-card-icon"><Users size={22} /></div>
        <span className="section-kicker">QUICK GUEST SETUP</span>
        <h2>Let’s get you in!</h2>
        <p>Choose a display name to continue. Your friends will see it in the room.</p>
        <label className="form-label">Your display name
          <input autoFocus={!getToken()} required minLength={2} autoComplete="nickname" placeholder="e.g. Suraj" value={name} maxLength={24} onChange={(e) => { nameTouched.current = true; setName(e.target.value); setErr(""); }} />
        </label>
        <p className="form-help">2–24 characters. Letters, numbers, spaces, dots, underscores and hyphens work best.</p>
        <p className="form-help">Guest play saves your results to this browser profile while the server/database is available. <Link to="/account" className="inline-link">Sign in or create an account</Link> to access the same profile on another device.</p>
        {nameLoading && <p className="form-help">Loading saved profile…</p>}
        <p role="alert" className="form-err">{err}</p>
      </div>

      <div className="battle-choice-grid">
        <div className="form-card battle-choice-card">
          <div className="choice-symbol purple"><Users size={21} /></div>
          <h2>Create Room</h2>
          <p>Start a new private room and share the invite code with your friends.</p>
          <button type="button" className="btn btn-primary w-full" disabled={name.trim().length < 2 || nameLoading} onClick={() => void go(`/room/new${modeQ}`)}>Create private room <ArrowRight size={16} /></button>
          <span className="form-help centered-help"><LockKeyhole size={12} /> Private room · Up to 6 players</span>
        </div>
        <div className="form-card battle-choice-card">
          <div className="choice-symbol green"><Link2 size={21} /></div>
          <h2>Join Room</h2>
          <p>Already got a code from a friend? Enter it below to join their lobby.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) void go(`/room/${code.trim().toUpperCase()}`); }}>
            <label className="form-label">Room code
              <input aria-label="Room code" placeholder="ABC123" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
            </label>
            <button type="submit" className="btn btn-green w-full mt-3" disabled={code.trim().length < 4 || name.trim().length < 2 || nameLoading}>Join room <ArrowRight size={16} /></button>
          </form>
          {code.length >= 4 && <button className="text-button mt-2" onClick={() => void copyRoomCode()}><Clipboard size={13} /> {copied ? "Copied" : "Copy code"}</button>}
        </div>
      </div>
      <div className="battle-footnote"><ShieldCheck size={15} /> Guest play · No download · Just share the code and play</div>
    </section>
  </main>;
}

export function RoomView() {
  const { code: param } = useParams();
  const nav = useNavigate();
  const sock = useRef<Socket>();
  const [room, setRoom] = useState<RoomV | null>(null);
  const [q, setQ] = useState<(Q & { index: number; total: number }) | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [reveal, setReveal] = useState<{ correctIndex: number; explanation: string } | null>(null);
  const [final, setFinal] = useState<{ name: string; score: number; rank: number }[] | null>(null);
  const qRef = useRef<Q | null>(null);
  const [log, setLog] = useState<{ prompt: string; answer: string; explanation: string }[]>([]);
  const [msg, setMsg] = useState("Connecting…");
  const [me, setMe] = useState("");
  const [cap, setCap] = useState<any>(null);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!getToken()) { nav(param && param !== "new" ? `/battle?join=${encodeURIComponent(param)}` : `/battle${window.location.search}`, { replace: true }); return; }
    const s = connect(); sock.current = s; let code = param!;
    s.on("connect", () => {
      setMsg("");
      if (code === "new") { const wanted = new URLSearchParams(window.location.search).get("mode"); s.emit("room:create", {}, (r: any) => { if (r.ok) { code = r.code; window.history.replaceState(null, "", `/room/${code}`); if (wanted) s.emit("room:setMode", { mode: wanted }, () => {}); } else setMsg(r.error); }); }
      else s.emit("room:join", { code }, (r: any) => { if (!r.ok) setMsg(r.error === "room_not_found" ? "Room not found. If the server restarted, this match was interrupted — start a new room." : r.error); });
    });
    s.on("connect_error", () => setMsg("Server is waking up or offline. Retrying…"));
    s.on("hello", (h: { playerId: string }) => setMe(h.playerId));
    s.on("room:expired", () => setMsg("This room expired."));
    s.on("room:update", (r: RoomV) => { setRoom(r); if (r.status === "waiting") { setFinal(null); setQ(null); setReveal(null); setLog([]); setCap(null); } });
    s.on("match:question", (m: { index: number; total: number; question: Q }) => { qRef.current = m.question; setQ({ ...m.question, index: m.index, total: m.total }); setPicked(null); setReveal(null); });
    s.on("match:questionResult", (m: { correctIndex: number; explanation: string }) => { setReveal(m); setLog((l) => [...l, { prompt: qRef.current?.prompt ?? "", answer: qRef.current?.options[m.correctIndex] ?? "", explanation: m.explanation }]); });
    s.on("caption:round", (m: object) => { setCap({ phase: "write", ...m }); setPicked(null); setText(""); setSent(false); });
    s.on("caption:voting", (m: object) => { setCap({ phase: "vote", ...m }); setPicked(null); });
    s.on("caption:result", (m: object) => setCap({ phase: "result", ...m }));
    s.on("match:complete", (m: { scoreboard: any[] }) => setFinal(m.scoreboard));
    return () => { s.close(); };
  }, []);

  const emit = (ev: string, d?: unknown) => sock.current?.emit(ev, d ?? {}, (r: any) => !r.ok && setMsg(r.error));
  const url = room ? `${location.origin}/room/${room.code}` : "";
  const isHost = !!room && room.hostId === me;
  const copyInvite = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setMsg("Copy failed. You can copy the URL from the browser address bar."); } };

  return <main className="room-page">
    <div className="room-heading">
      <div><Link to="/battle" className="subtle-link"><ArrowLeft size={15} /> Friend Battle</Link><h1 className="mt-3">{room?.status === "playing" || room?.status === "reveal" ? "You’re in the game!" : final ? "Match complete" : "Your game room"}</h1><p className="text-sm text-slate-400">{room ? `Room ${room.code} · ${room.players.length} of ${room.maxPlayers} players` : "Connect with your friends and get ready to play."}</p></div>
      {room && <div className="room-tools"><span className="pill-muted"><span className="pulse-dot" /> {room.status === "playing" ? "Live match" : room.status === "completed" ? "Completed" : room.status}</span><button className="btn btn-outline" onClick={() => void copyInvite()}><Share2 size={15} /> {copied ? "Copied!" : "Invite friends"}</button></div>}
    </div>
    {msg && <div role="status" className={`connection-notice${msg.toLowerCase().includes("offline") || msg.toLowerCase().includes("waking") ? " notice-warn" : ""}`}><LoaderCircle size={15} className="notice-spinner" /> {msg}</div>}
    {room && room.status === "voided" && <div role="alert" className="connection-notice notice-error">This match was interrupted. No winner was declared.</div>}

    {room && ["waiting", "countdown"].includes(room.status) && <div className="room-grid">
      <section>
        <div className="room-heading"><div><span className="section-kicker">PRIVATE LOBBY</span><h2 className="mt-2">Waiting for players…</h2><p className="text-sm text-slate-400">Share your room code to get your gang together.</p></div><div className="room-code-block"><span>ROOM CODE</span><strong className="room-code">{room.code}</strong></div></div>
        <div className="player-grid">{room.players.map((p) => <div key={p.id} className="player-tile"><span className="player-avatar">{p.name.slice(0, 1).toUpperCase()}</span><strong>{p.name}{p.id === room.hostId ? " (host)" : ""}</strong><span className={`player-state${p.ready && p.connected ? " is-ready" : ""}`}>{!p.connected ? "Disconnected" : p.ready ? <><Check size={12} className="inline" /> Ready</> : "Getting ready"}</span></div>)}{Array.from({ length: Math.max(0, Math.min(6, room.maxPlayers) - room.players.length) }).slice(0, 4).map((_, i) => <div key={`empty-${i}`} className="player-tile player-empty"><span className="player-avatar"><Users size={17} /></span><strong>Waiting…</strong><span className="player-state">Invite a friend</span></div>)}</div>
        <div className="room-actions"><button className="btn btn-green" onClick={() => emit("room:ready")}><CheckCircle2 size={16} /> I’m ready</button><button className="btn btn-outline" onClick={() => emit("room:unready")}><Circle size={15} /> Not ready</button><button className="btn btn-outline" onClick={() => emit("room:leave")}><ArrowLeft size={15} /> Leave room</button></div>
        {isHost && room.status === "waiting" && <button className="btn btn-primary mt-4" disabled={room.players.length < 2 || !room.players.every((p) => p.ready && p.connected)} onClick={() => emit("match:start")}><Play size={16} fill="currentColor" /> Start match <ArrowRight size={16} /></button>}
        {room.status === "countdown" && <p className="form-help mt-4">Players ready — getting the game started…</p>}
      </section>
      <section>
        <span className="section-kicker"><Gamepad2 size={14} /> MATCH SETTINGS</span>
        <h2 className="mt-2">Choose your challenge</h2>
        <p className="text-sm text-slate-400">The host can choose the mode before the match begins.</p>
        <label className="form-label mt-4">Game mode
          <select disabled={!isHost || room.status !== "waiting"} value={room.mode} onChange={(e) => emit("room:setMode", { mode: e.target.value })}>{[["daily", "Today's Dangal pack"], ["trivia", "Quick Trivia"], ["emoji", "Emoji Puzzle"], ["riddle", "Guessing Challenge"], ["pattern", "Pattern Challenge"], ["memory", "Memory Challenge"], ["community", "Community challenges"], ["caption", "Caption Battle"], ["math", "Math Rush"], ["oddone", "Odd One Out"], ["scramble", "Word Scramble"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
        <div className="mode-summary"><div className="mode-summary-icon"><Zap size={20} /></div><div><strong>Quick rounds, live scores</strong><p>Answer independently and see who's fastest and most accurate. No paid AI required.</p></div></div>
        <div className="form-help mt-4"><ShieldCheck size={13} className="inline" /> Keep your room code private to your group.</div>
      </section>
    </div>}

    {room && ["playing", "reveal"].includes(room.status) && q && <section className="game-screen">
      <div className="game-meta-row"><span className="pill-muted"><Zap size={13} /> LIVE FRIEND BATTLE</span><span className="pill-muted">Question {q.index + 1} of {q.total}</span><span className="timer-pill"><span className="pulse-dot" /> Live</span></div>
      <div className="game-progress"><div className="game-progress-fill" style={{ width: `${((q.index + 1) / q.total) * 100}%` }} /></div>
      <div className="question-card">
        <span className="question-category">{q.type ? q.type.replace(/_/g, " ") : "QUICK TRIVIA"}</span>
        <Prompt q={q} />
        <div className="answer-grid">{q.options.map((o, i) => <button key={i} data-testid="opt" disabled={picked !== null || !!reveal} onClick={() => { setPicked(i); emit("answer:submit", { questionId: q.id, choice: i }); }} className={`answer-option${reveal ? i === reveal.correctIndex ? " correct" : " incorrect" : picked === i ? " chosen" : ""}`}><span className="answer-letter">{String.fromCharCode(65 + i)}</span><span>{o}</span>{reveal && i === reveal.correctIndex && <CheckCircle2 size={17} />}</button>)}</div>
        <div className="room-player-progress">{room.players.map((p) => <span key={p.id} className="progress-player"><span className={`mini-online${p.answered ? " answered" : ""}`} />{p.name}: {p.answered ? "answered" : "thinking"}</span>)}</div>
        {reveal && <div role="status" className="explanation-box"><CheckCircle2 size={18} /><div><strong>Answer revealed</strong><p>{reveal.explanation}</p></div></div>}
      </div>
    </section>}

    {room && room.mode === "caption" && cap && ["captioning", "voting", "reveal"].includes(room.status) && <section className="game-screen"><div className="question-card"><span className="section-kicker">CAPTION BATTLE · ROUND {cap.round + 1} OF {cap.total ?? 3}</span>
      {cap.phase === "write" && <><h2 className="question-title">Write a caption for this prompt</h2><p>{cap.prompt}</p><input aria-label="Caption" className="mt-3" maxLength={80} value={text} disabled={sent} onChange={(e) => setText(e.target.value)} /><button className="btn btn-primary mt-3" disabled={sent || text.trim().length < 2} onClick={() => { emit("caption:submit", { text }); setSent(true); }}>{sent ? "Submitted" : "Submit caption"}</button></>}
      {cap.phase === "vote" && <><h2 className="question-title">Vote for the funniest caption</h2><p>You can’t vote for your own caption.</p><div className="answer-grid">{cap.captions.map((c: { id: number; text: string }) => <button key={c.id} disabled={picked !== null} onClick={() => { setPicked(c.id); emit("caption:vote", { captionId: c.id }); }} className={`answer-option${picked === c.id ? " chosen" : ""}`}>{c.text}</button>)}</div></>}
      {cap.phase === "result" && <ol className="score-list">{cap.captions.map((c: { author: string; text: string; votes: number }, i: number) => <li key={i} className="score-row"><span className="score-rank">{i + 1}</span><span className="score-name">{c.text} <small>— {c.author}</small></span><strong className="score-total">{c.votes} votes</strong></li>)}</ol>}
    </div></section>}

    {final && <section className="result-screen"><div className="result-celebration"><div className="result-trophy"><Trophy size={32} /></div><span className="section-kicker">MATCH COMPLETE</span><h2>Game over. Good game!</h2><p>Here are the final scores from your battle.</p></div><ol className="score-list">{final.map((f) => <li key={f.name} className={`score-row${f.rank === 1 ? " winner" : ""}`}><span className="score-rank">{f.rank === 1 ? <Crown size={16} /> : f.rank}</span><span className="score-name">{f.name}</span><strong className="score-total">{f.score} pts</strong></li>)}</ol>
      <div className="room-actions">{isHost && <button className="btn btn-primary" onClick={() => emit("match:rematch")}><Zap size={16} /> Rematch</button>}<Link to="/" className="btn btn-outline">Back to home <ArrowRight size={15} /></Link></div>
      <h3 className="mt-7">Answers & explanations</h3><ol className="answer-review-list">{log.map((l, i) => <li key={i}><span>{i + 1}</span><div><strong>{l.prompt}</strong><p>{l.answer}. {l.explanation}</p></div></li>)}</ol>
    </section>}
  </main>;
}
