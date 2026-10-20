import pg from "pg"; import { readdirSync, readFileSync } from "node:fs";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("create table if not exists _migrations(name text primary key, applied_at timestamptz default now())");
for (const f of readdirSync("db/migrations").sort()) {
  if ((await c.query("select 1 from _migrations where name=$1", [f])).rowCount) continue;
  await c.query("begin");
  try { await c.query(readFileSync(`db/migrations/${f}`, "utf8")); await c.query("insert into _migrations(name) values($1)", [f]); await c.query("commit"); console.log("applied", f); }
  catch (e) { await c.query("rollback"); throw e; }
}
await c.end();
