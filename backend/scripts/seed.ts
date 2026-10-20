import pg from "pg"; import { istDateKey } from "@dostleague/shared"; import { generatePack, dateForDay, DAYS } from "../src/questions.js";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect(); const start = istDateKey();
for (let i = 0; i < DAYS; i++) {
  const date = dateForDay(start, i);
  await c.query("begin");
  // Published packs are never rewritten: an existing slug is skipped, so answer keys don't change silently.
  const p = await c.query("insert into challenge_packs(slug,title) values($1,$2) on conflict(slug) do nothing returning id", [`daily-${date}`, `Daily Dangal ${date}`]);
  if (p.rowCount) {
    const id = p.rows[0].id;
    for (const [pos, q] of generatePack(i).entries()) await c.query("insert into questions(pack_id,position,type,category,difficulty,prompt,options,correct_index,explanation) values($1,$2,$3,$4,$5,$6,$7,$8,$9)", [id, pos, q.type, q.category, q.difficulty, q.prompt, JSON.stringify(q.options), q.correct, q.explanation]);
    await c.query("insert into daily_challenges(challenge_date,pack_id) values($1,$2) on conflict do nothing", [date, id]);
  }
  await c.query("commit");
}
console.log("seeded"); await c.end();
