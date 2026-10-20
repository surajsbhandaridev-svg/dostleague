import { mulberry32, shuffleWith, makeBots, PROFILE, type Difficulty } from "./botbrain.js";
export type Persona = "analytical" | "cautious" | "bold" | "bluffer";
export interface WordRec { word: string; category: string; clues: string[] } // clues ordered generic -> specific
const W = (category: string, rows: [string, string][]): WordRec[] => rows.map(([word, c]) => ({ word, category, clues: c.split(" ") }));
export const WORDBANK: WordRec[] = [
  ...W("Nature", [["Mountain", "high rocky climb peak snow"], ["River", "flowing water bank bridge current"], ["Forest", "trees green wild leaves shade"]]),
  ...W("Food", [["Mango", "sweet fruit yellow summer juicy"], ["Pizza", "round hot cheese slice oven"], ["Samosa", "fried snack triangle spicy crispy"]]),
  ...W("Technology", [["Laptop", "portable screen keys battery typing"], ["Satellite", "orbit space signal dish moon"], ["Router", "wifi box cables network lights"]]),
  ...W("Places", [["Airport", "travel planes gate luggage runway"], ["Library", "quiet books shelves reading borrow"], ["Market", "busy stalls bargain vendors fresh"]]),
  ...W("Weather", [["Thunder", "loud storm rumble sky lightning"], ["Fog", "grey mist low cloudy hazy"], ["Monsoon", "season rain humid July showers"]]),
  ...W("Objects", [["Umbrella", "handle rain fold canopy open"], ["Bicycle", "wheels pedals ride chain handlebar"], ["Lantern", "light glow carry flame festival"]]),
];
export class SabError extends Error { constructor(public code: string, public status = 409) { super(code); } }
export interface SabPlayer { id: string; name: string; bot: boolean; persona?: Persona; role: "team" | "saboteur" }
export interface Result { winner: "team" | "saboteur"; reason: string; secret: string; decoy: string; saboteur: string; roles: { name: string; role: string }[]; rounds: { outcome: string; tally: Record<string, number> }[]; humanWon: boolean }
export interface Game { players: SabPlayer[]; difficulty: Difficulty; secret: WordRec; decoy: WordRec; round: number; phase: "clues" | "discussion" | "vote" | "final_guess" | "over"; clues: Record<string, string>[]; votes: Record<string, string>; rounds: { outcome: "caught" | "tie" | "missed"; tally: Record<string, number> }[]; scanUsed: boolean; scan: string | null; options: string[]; result: Result | null; rng: () => number }
/** Everything a bot is allowed to know: its own role and its own prompt. Never the full role list or other players' prompts. */
export interface BotView { id: string; role: "team" | "saboteur"; category: string; rec: WordRec }
const PERSONAS: Persona[] = ["analytical", "cautious", "bold", "bluffer"];
const SPEC: Record<Persona, number> = { analytical: 0.6, cautious: 0.25, bold: 0.85, bluffer: 0.4 };
const NOISE: Record<Difficulty, number> = { easy: 0.5, medium: 0.3, hard: 0.12 }; const MISTAKE: Record<Difficulty, number> = { easy: 0.3, medium: 0.15, hard: 0.05 };
const PN: Record<Persona, number> = { analytical: 0.6, cautious: 0.8, bold: 1.3, bluffer: 1 };
const inCategory = (c: string) => WORDBANK.filter((w) => w.category === c);
const fit = (clue: string, rec: WordRec, cat: string) => rec.clues.includes(clue) ? 1 : inCategory(cat).some((w) => w.clues.includes(clue)) ? 0.45 : 0.6 - 0.6 + 0.4; // in-table-other-word: plausible-but-off; unknown free text: uncertain
export function botClue(me: BotView, persona: Persona, d: Difficulty, used: string[], rng: () => number): string {
  const free = me.rec.clues.filter((c) => !used.includes(c)); const list = free.length ? free : me.rec.clues;
  let s = SPEC[persona] + (d === "hard" ? 0.1 : d === "easy" ? -0.15 : 0);
  let i = Math.round(s * (list.length - 1) + (rng() - 0.5) * (d === "easy" ? 3 : 1.2)); i = Math.min(list.length - 1, Math.max(0, i));
  if (me.role === "saboteur") i = Math.min(i, Math.floor(list.length / 2)); // blends in with generic clues
  return list[i];
}
export function consensus(cands: WordRec[], clues: string[], rng: () => number, noise: number): WordRec {
  return cands.map((w) => ({ w, s: clues.filter((c) => w.clues.includes(c)).length + (rng() - 0.5) * noise })).sort((a, b) => b.s - a.s)[0].w;
}
export function botVote(me: BotView, p: Persona, d: Difficulty, board: { ids: string[]; clues: Record<string, string>; priorTops: string[] }, rng: () => number): string {
  const others = board.ids.filter((x) => x !== me.id); if (rng() < MISTAKE[d]) return others[Math.floor(rng() * others.length)];
  const belief = me.role === "team" ? me.rec : consensus(inCategory(me.category).filter((w) => w.word !== me.rec.word), Object.entries(board.clues).filter(([k]) => k !== me.id).map(([, v]) => v), rng, 0.5);
  const scored = others.map((id) => ({ id, s: 1 - fit(board.clues[id] ?? "", belief, me.category) - (board.priorTops.includes(id) ? 0.25 : 0) + (rng() - 0.5) * 2 * NOISE[d] * PN[p] }));
  return scored.sort((a, b) => b.s - a.s)[0].id;
}
const band = (w: string) => (w.length <= 5 ? "5 letters or fewer" : w.length <= 8 ? "6 to 8 letters" : "9 or more letters");
export function newGame(o: { players?: number; difficulty?: Difficulty; seed?: number; humanRole?: "team" | "saboteur" } = {}): Game {
  const rng = mulberry32(o.seed ?? Math.floor(Math.random() * 2 ** 31)); const n = Math.min(8, Math.max(4, o.players ?? 5)); const d = o.difficulty ?? "medium";
  const cat = shuffleWith([...new Set(WORDBANK.map((w) => w.category))], rng)[0]; const [secret, decoy] = shuffleWith(inCategory(cat), rng);
  const sab = o.humanRole ? (o.humanRole === "saboteur" ? 0 : 1 + Math.floor(rng() * (n - 1))) : Math.floor(rng() * n); const personas = shuffleWith(PERSONAS, rng);
  const players: SabPlayer[] = [{ id: "you", name: "You", bot: false, role: sab === 0 ? "saboteur" : "team" }, ...makeBots(n - 1, d, rng).map((b, i): SabPlayer => ({ id: b.id, name: b.name, bot: true, persona: personas[i % 4], role: sab === i + 1 ? "saboteur" : "team" }))];
  return { players, difficulty: d, secret, decoy, round: 0, phase: "clues", clues: [{}], votes: {}, rounds: [], scanUsed: false, scan: null, options: [], result: null, rng };
}
const botView = (g: Game, p: SabPlayer): BotView => ({ id: p.id, role: p.role, category: g.secret.category, rec: p.role === "saboteur" ? g.decoy : g.secret });
export function submitClue(g: Game, text: string) {
  if (g.phase !== "clues") throw new SabError("wrong_phase"); const cur = g.clues[g.round]; if (cur.you) throw new SabError("already_submitted");
  const t = text.trim(); if (!/^[^<>\u0000-\u001f]{1,40}$/.test(t)) throw new SabError("invalid_clue", 400); cur.you = t; const used: string[] = [t.toLowerCase()];
  for (const p of g.players.filter((x) => x.bot)) { const c = botClue(botView(g, p), p.persona!, g.difficulty, used, g.rng); cur[p.id] = c; used.push(c); }
  g.phase = "discussion";
}
export function doScan(g: Game) { if (g.phase !== "discussion") throw new SabError("wrong_phase"); if (g.scanUsed) throw new SabError("scan_used"); g.scanUsed = true; g.scan = `The secret word has ${band(g.secret.word)}.`; }
export function proceedToVote(g: Game) { if (g.phase !== "discussion") throw new SabError("wrong_phase"); g.phase = "vote"; }
const sabOf = (g: Game) => g.players.find((p) => p.role === "saboteur")!;
function end(g: Game, winner: "team" | "saboteur", reason: string) {
  g.phase = "over"; const names = (t: Record<string, number>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [g.players.find((p) => p.id === k)!.name, v]));
  g.result = { winner, reason, secret: g.secret.word, decoy: g.decoy.word, saboteur: sabOf(g).name, roles: g.players.map((p) => ({ name: p.name, role: p.role === "saboteur" ? "Saboteur" : "Signal Team" })), rounds: g.rounds.map((r) => ({ outcome: r.outcome, tally: names(r.tally) })), humanWon: (winner === "saboteur") === (g.players[0].role === "saboteur") };
}
export function castVote(g: Game, target: string) {
  if (g.phase !== "vote") throw new SabError("wrong_phase"); if (g.votes.you) throw new SabError("already_voted");
  if (target === "you") throw new SabError("self_vote", 400); if (!g.players.some((p) => p.id === target)) throw new SabError("unknown_player", 400);
  g.votes.you = target; const ids = g.players.map((p) => p.id); const priorTops = g.rounds.flatMap((r) => Object.entries(r.tally).sort((a, b) => b[1] - a[1]).slice(0, 1).map(([k]) => k));
  for (const p of g.players.filter((x) => x.bot)) g.votes[p.id] = botVote(botView(g, p), p.persona!, g.difficulty, { ids, clues: g.clues[g.round], priorTops }, g.rng);
  const tally: Record<string, number> = {}; for (const v of Object.values(g.votes)) tally[v] = (tally[v] ?? 0) + 1;
  const max = Math.max(...Object.values(tally)); const tops = Object.keys(tally).filter((k) => tally[k] === max); const sab = sabOf(g);
  const outcome = tops.length > 1 ? "tie" : tops[0] === sab.id ? "caught" : "missed"; g.rounds.push({ outcome, tally }); g.votes = {};
  if (outcome === "caught") {
    g.options = shuffleWith(inCategory(g.secret.category), g.rng).map((w) => w.word);
    if (sab.bot) { const cands = inCategory(g.secret.category).filter((w) => w.word !== g.decoy.word); const all = Object.values(g.clues).flatMap((c) => Object.entries(c).filter(([k]) => k !== sab.id).map(([, v]) => v)); const pick = g.rng() < 1 - PROFILE[g.difficulty].acc / 2 ? consensus(cands, all, g.rng, 1) : cands[Math.floor(g.rng() * cands.length)]; end(g, pick.word === g.secret.word ? "saboteur" : "team", pick.word === g.secret.word ? "The Saboteur was caught but guessed the secret word." : "The Signal Team caught the Saboteur."); }
    else g.phase = "final_guess";
  } else if (g.round >= 1) end(g, "saboteur", "Two votes failed to identify the Saboteur.");
  else { g.round++; g.clues.push({}); g.phase = "clues"; }
}
export function finalGuess(g: Game, word: string) {
  if (g.phase !== "final_guess") throw new SabError("wrong_phase"); if (!g.options.includes(word)) throw new SabError("invalid_guess", 400);
  word === g.secret.word ? end(g, "saboteur", "The Saboteur was caught but guessed the secret word.") : end(g, "team", "The Signal Team caught the Saboteur.");
}
function reactions(g: Game): string[] { // derived only from the public clue board
  const cur = g.clues[g.round]; const best = consensus(inCategory(g.secret.category), Object.values(cur), () => 0.5, 0); const odd = g.players.filter((p) => cur[p.id] && !best.clues.includes(cur[p.id]));
  return g.players.filter((p) => p.bot).slice(0, 3).map((b, i) => (odd.length ? `${b.name}: “${cur[odd[i % odd.length].id]}” from ${odd[i % odd.length].name} feels off to me.` : `${b.name}: These clues line up nicely.`));
}
/** The only payload sent to the human: their own role/prompt plus public information. Others' roles and all votes stay hidden until the end. */
export function viewOf(g: Game) {
  const me = g.players[0]; const nm = (id: string) => g.players.find((p) => p.id === id)!.name; const shown = g.phase === "clues" ? g.round : g.round + 1;
  return { phase: g.phase, round: g.round + 1, maxRounds: 2, category: g.secret.category, you: { role: me.role === "saboteur" ? "Saboteur" : "Signal Team", word: me.role === "saboteur" ? g.decoy.word : g.secret.word, note: me.role === "saboteur" ? "You are the Saboteur. You only know a decoy word: blend in." : "You are on the Signal Team. Find the Saboteur." },
    players: g.players.map((p) => ({ id: p.id, name: p.name, bot: p.bot })), clues: g.clues.slice(0, shown).map((c, r) => ({ round: r + 1, entries: g.players.filter((p) => c[p.id]).map((p) => ({ id: p.id, name: p.name, clue: c[p.id] })) })),
    reactions: g.phase === "discussion" || g.phase === "vote" ? reactions(g) : [], scan: g.scan, scanAvailable: g.phase === "discussion" && !g.scanUsed, options: g.phase === "final_guess" ? g.options : [],
    rounds: g.rounds.map((r) => ({ outcome: r.outcome, tally: Object.fromEntries(Object.entries(r.tally).map(([k, v]) => [nm(k), v])) })), result: g.result };
}
