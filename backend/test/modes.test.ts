import { describe, it, expect } from "vitest";
import { generateMode, GROUPS, WORDS, type Mode } from "../src/questions.js";
const modes: Exclude<Mode, "daily">[] = ["trivia", "emoji", "riddle", "pattern", "memory", "math", "oddone", "scramble"];
describe("generated game modes", () => {
  for (const m of modes) it(`${m}: 5 valid questions for many seeds`, () => {
    for (let s = 1_000_000; s < 1_000_200; s++) { const qs = generateMode(m, s); expect(qs).toHaveLength(5); for (const q of qs) { expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.correct).toBeGreaterThanOrEqual(0); expect(q.correct).toBeLessThan(4); expect(q.explanation.length).toBeGreaterThan(2); } }
  });
  it("math answers are arithmetically correct", () => { for (let s = 1; s < 200; s++) for (const q of generateMode("math", s)) { const [x, op, y] = q.prompt.replace(" = ?", "").split(" "); const a = Number(x), b = Number(y); const v = op === "+" ? a + b : op === "-" ? a - b : a * b; expect(q.options[q.correct]).toBe(String(v)); expect(v).toBeGreaterThan(0); } });
  it("scramble answers use exactly the shown letters", () => { for (let s = 1; s < 200; s++) for (const q of generateMode("scramble", s)) { const shown = q.prompt.replace("Unscramble: ", ""); const ans = q.options[q.correct]; expect(WORDS).toContain(ans); expect(shown.split("").sort().join("")).toBe(ans.split("").sort().join("")); expect(shown).not.toBe(ans); } });
  it("odd-one-out has exactly one intruder", () => { const group = (w: string) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(w)); for (let s = 1; s < 200; s++) for (const q of generateMode("oddone", s)) { const gs = q.options.map(group); const odd = q.options[q.correct]; expect(gs.filter((g) => g === group(odd))).toHaveLength(1); expect(new Set(gs).size).toBe(2); } });
});
