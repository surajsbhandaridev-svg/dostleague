import { GROUPS, KNOWLEDGE } from "./questions.js";
export type Difficulty = "easy" | "medium" | "hard";
/** Bots only ever see this: no answer key, no correct index, no explanation. */
export interface PermittedQuestion { type: string; prompt: string; options: string[] }
export interface BotDecision { choice: number; ms: number }
export const PROFILE: Record<Difficulty, { acc: number; recall: number; min: number; max: number }> = { easy: { acc: 0.5, recall: 0.45, min: 6000, max: 13500 }, medium: { acc: 0.75, recall: 0.7, min: 3500, max: 9500 }, hard: { acc: 0.92, recall: 0.9, min: 1800, max: 6500 } };
export const BOT_NAMES = ["Pixel", "Nova", "Quark", "Orbit", "Mochi", "Zephyr", "Ember", "Glitch", "Relay", "Beacon", "Sigma", "Echo"];
export function mulberry32(seed: number) { return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function shuffleWith<T>(a: T[], rng: () => number): T[] { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }
export function makeBots(n: number, difficulty: Difficulty, rng: () => number) { return shuffleWith(BOT_NAMES, rng).slice(0, n).map((name, i) => ({ id: `bot-${i}`, name, avatar: i % 6, difficulty })); }
type Solver = (q: PermittedQuestion, rng: () => number, recall: number) => number | null;
const idx = (q: PermittedQuestion, text: string) => { const i = q.options.indexOf(text); return i < 0 ? null : i; };
const SOLVERS: Record<string, Solver> = {
  math: (q) => { const m = /^(\d+) ([+×-]) (\d+) = \?$/.exec(q.prompt); if (!m) return null; const x = +m[1], y = +m[3]; return idx(q, String(m[2] === "+" ? x + y : m[2] === "-" ? x - y : x * y)); },
  scramble: (q) => { const m = /^Unscramble: (\w+)$/.exec(q.prompt); if (!m) return null; const k = [...m[1]].sort().join(""); const i = q.options.findIndex((o) => [...o].sort().join("") === k); return i < 0 ? null : i; },
  pattern: (q) => { const m = /What comes next\? (.*), \?$/.exec(q.prompt); if (!m) return null; const n = m[1].split(",").map((x) => Number(x.trim())); const d = n[1] - n[0]; if (n.every((v, i) => i === 0 || v - n[i - 1] === d)) return idx(q, String(n[n.length - 1] + d)); const r = n[1] / n[0]; if (n.every((v, i) => i === 0 || v === n[i - 1] * r)) return idx(q, String(n[n.length - 1] * r)); return null; },
  oddone: (q) => { const g = (w: string) => Object.keys(GROUPS).find((k) => GROUPS[k].includes(w)); const gs = q.options.map(g); const i = gs.findIndex((x) => x && gs.filter((y) => y === x).length === 1); return i < 0 ? null : i; },
  memory: (q, rng, recall) => { const m = /Memorise: (.*) \(hidden after 4s\)\. Which symbol was in position (\d)\?/.exec(q.prompt); if (!m) return null; const seq = m[1].split(" "); const pos = Number(m[2]) - 1; return rng() < recall ? idx(q, seq[pos]) : null; }, // imperfect recall of the shown sequence
};
const knowledge: Solver = (q) => { const a = KNOWLEDGE[q.prompt]; return a === undefined ? null : idx(q, a); };
export function decide(q: PermittedQuestion, difficulty: Difficulty, rng: () => number): BotDecision {
  const p = PROFILE[difficulty]; const belief = (SOLVERS[q.type] ?? knowledge)(q, rng, p.recall);
  const sure = belief !== null && (q.type === "memory" || rng() < p.acc);
  return { choice: sure ? belief! : Math.floor(rng() * q.options.length), ms: Math.round(p.min + (p.max - p.min) * rng() * (sure ? 0.9 : 1)) };
}
