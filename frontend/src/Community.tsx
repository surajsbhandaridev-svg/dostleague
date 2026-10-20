import { useEffect, useState } from "react"; import { Link } from "react-router-dom"; import { api, ensureGuest, getToken, guestErrorMessage, ApiError } from "./api";
interface Item { id: string; title: string; type: string; category: string; prompt: string; difficulty: number; author: string }
const empty = { wrongOptions: ["", "", ""], title: "", type: "riddle", category: "", prompt: "", answer: "", explanation: "", difficulty: 1 };
export function Community() {
  const [rows, setRows] = useState<Item[]>([]); const [f, setF] = useState(empty); const [name, setName] = useState(""); const [msg, setMsg] = useState("");
  useEffect(() => { api<{ rows: Item[] }>("/api/submissions/approved").then((r) => setRows(r.rows)).catch(() => {}); }, []);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: k === "difficulty" ? Number(e.target.value) : e.target.value });
  const submit = async () => { try { if (!getToken()) await ensureGuest(name); await api("/api/submissions", f); setMsg("Thanks! Your challenge is pending moderation."); setF(empty); } catch (e) { setMsg(e instanceof ApiError && e.code === "invalid_input" ? "Check every field: title, category, question and explanation are required; options must be distinct and angle brackets are not allowed." : e instanceof ApiError && e.code === "daily_submission_limit" ? "You have reached today’s submission limit." : !getToken() ? guestErrorMessage(e) : "Could not submit. Check the backend connection and try again."); } };
  const report = async (id: string) => { const reason = window.prompt("Why are you reporting this?"); if (reason) try { await api(`/api/submissions/${id}/report`, { reason }); setMsg("Report sent."); } catch { setMsg("Couldn’t send report."); } };
  const L = "mt-2 block text-sm"; const I = "mt-1 w-full rounded-lg bg-navy-800 p-2";
  return (<main className="mx-auto max-w-xl p-6"><Link to="/" className="text-sm text-slate-400">← DostLeague</Link><h1 className="mt-2 text-2xl font-bold">Community challenges</h1>
    <section className="mt-4"><h2 className="font-semibold">Submit a challenge</h2>
      {!getToken() && <label className={L}>Display name<input className={I} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} /></label>}
      <label className={L}>Title<input className={I} value={f.title} maxLength={80} onChange={set("title")} /></label>
      <label className={L}>Type<select className={I} value={f.type} onChange={set("type")}>{["riddle", "trivia", "emoji", "logic"].map((t) => <option key={t}>{t}</option>)}</select></label>
      <label className={L}>Category<input className={I} value={f.category} maxLength={30} onChange={set("category")} /></label>
      <label className={L}>Question<textarea className={I} value={f.prompt} maxLength={300} onChange={set("prompt")} /></label>
      <label className={L}>Answer<input className={I} value={f.answer} maxLength={100} onChange={set("answer")} /></label>
      {[0, 1, 2].map((i) => <label key={i} className={L}>Wrong option {i + 1}<input className={I} value={f.wrongOptions[i]} maxLength={100} onChange={(e) => setF({ ...f, wrongOptions: f.wrongOptions.map((w, j) => (j === i ? e.target.value : w)) })} /></label>)}
      <label className={L}>Explanation<textarea className={I} value={f.explanation} maxLength={300} onChange={set("explanation")} /></label>
      <label className={L}>Difficulty<select className={I} value={f.difficulty} onChange={set("difficulty")}><option value={1}>Easy</option><option value={2}>Medium</option><option value={3}>Hard</option></select></label>
      <button className="btn mt-3" onClick={submit}>Submit for review</button><p role="status" className="mt-2 text-sm">{msg}</p></section>
    <h2 className="mt-6 font-semibold">Approved by moderators</h2>{rows.length === 0 && <p className="text-sm text-slate-400">No approved community challenges yet.</p>}
    <ul>{rows.map((r) => <li key={r.id} className="border-b border-navy-700 py-2"><p className="font-semibold">{r.title} <span className="text-xs text-slate-400">{r.type} · {r.category} · by {r.author}</span></p><p>{r.prompt}</p><button className="text-sm text-slate-400 underline" onClick={() => report(r.id)}>Report</button></li>)}</ul></main>);
}
