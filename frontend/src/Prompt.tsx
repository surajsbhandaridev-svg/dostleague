import { useEffect, useState } from "react";
/** Memory questions show the sequence for 4 seconds, then hide it (the question text is only a display convention). */
export function Prompt({ q }: { q: { id: string; type?: string; prompt: string } }) {
  const [hide, setHide] = useState(false);
  useEffect(() => { setHide(false); if (q.type !== "memory") return; const t = setTimeout(() => setHide(true), 4000); return () => clearTimeout(t); }, [q.id]);
  return <p className="mt-2 text-lg">{hide ? q.prompt.replace(/Memorise: .*? \(hidden after 4s\)\./, "The sequence is now hidden.") : q.prompt}</p>;
}
