import { useEffect, useState } from "react"; import { api } from "./api";
export interface Result { score: number; correct: number; total: number; accuracy: number; totalMs: number; previousBest?: number | null; saved?: boolean; practice?: boolean; }
interface Cmp { status: string; challenger: { name: string; score: number }; opponent: { name: string; score: number } | null; winner: string | null }
export function ResultActions({ result, challenge }: { result: Result; challenge?: string }) {
  const [link, setLink] = useState(""); const [cmp, setCmp] = useState<Cmp | null>(null); const [note, setNote] = useState("");
  const improved = result.previousBest != null && result.score > result.previousBest;
  useEffect(() => { if (challenge) api<Cmp>(`/api/challenges/${challenge}`).then(setCmp).catch(() => {}); }, [challenge]);
  const text = `I scored ${result.score} (${result.correct}/${result.total}) on today’s DostLeague Daily Dangal. Can you beat me?`;
  const share = async (t: string, u?: string) => { try { if (navigator.share) await navigator.share({ text: t, url: u }); else { await navigator.clipboard.writeText(u ? `${t} ${u}` : t); setNote("Copied!"); } } catch { /* cancelled */ } };
  const make = async () => { try { const { code } = await api<{ code: string }>("/api/challenges", {}); const u = `${location.origin}/challenge/${code}`; setLink(u); void share("Challenge me on DostLeague!", u); } catch { setNote("Finish today’s ranked Dangal first."); } };
  return (<div className="mt-4"><div className="rounded-xl bg-navy-800 p-4"><p className="text-sm text-slate-400">Result card</p>
    <p className="text-3xl font-bold text-lime">{result.score} pts</p><p>{result.correct}/{result.total} correct · {result.accuracy}% accuracy · {(result.totalMs / 1000).toFixed(1)}s</p>
    {improved && <p className="font-semibold text-lime">New personal best (previous {result.previousBest})!</p>}</div>
    {cmp && <p role="status" className="mt-3">{cmp.opponent ? `${cmp.challenger.name} ${cmp.challenger.score} vs ${cmp.opponent.name} ${cmp.opponent.score} — ${cmp.winner === "tie" ? "tie" : (cmp.winner === "challenger" ? cmp.challenger.name : cmp.opponent.name) + " wins"}` : "Waiting for result…"}</p>}
    <div className="mt-3 flex flex-wrap gap-2"><button className="btn" onClick={() => share(text)}>Share result</button>{!challenge && <button className="btn" onClick={make}>Challenge a friend</button>}</div>
    {link && <p className="mt-2 break-all text-sm">{link}</p>}<p role="status" className="text-sm text-slate-400">{note}</p></div>);
}
