import { generatePack, DAYS } from "../src/questions.js";
let bad = 0;
for (let d = 0; d < DAYS; d++) for (const q of generatePack(d)) {
  const ok = q.prompt.length > 4 && q.options.length === 4 && new Set(q.options).size === 4 && Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3 && q.explanation.length > 2;
  if (!ok) { bad++; console.error("invalid day", d, q.prompt); }
}
console.log(bad ? `${bad} invalid` : `OK: ${DAYS} packs x 5 questions valid`); process.exit(bad ? 1 : 0);
