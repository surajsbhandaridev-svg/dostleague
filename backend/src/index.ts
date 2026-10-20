import { createServer } from "node:http";
import pg from "pg";
import { Server } from "socket.io";
import { loadEnv } from "./env.js";
import { createApp } from "./app.js";
import { PgRepo } from "./pgRepo.js";
import { attachRooms, defaultCfg } from "./rooms.js";
const env = loadEnv();
const origins = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
const repo = new PgRepo(new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 }));
try { const n = await repo.expireStaleRooms(); if (n) console.log(`Marked ${n} room(s) from a previous run as voided`); } catch { console.error("could not clean stale rooms"); }
const http = createServer(createApp(repo, { origins, secret: env.SESSION_TOKEN_SECRET, adminKey: env.ADMIN_API_KEY }));
http.requestTimeout = 30_000; http.headersTimeout = 35_000;
const io = new Server(http, { cors: { origin: origins }, maxHttpBufferSize: 10_000 });
const { sweep } = attachRooms(io, repo, env.SESSION_TOKEN_SECRET, { ...defaultCfg, ttlMs: env.ROOM_TTL_SECONDS * 1000 });
setInterval(sweep, 60_000);
http.listen(env.PORT, () => console.log(`DostLeague backend on :${env.PORT}`));
