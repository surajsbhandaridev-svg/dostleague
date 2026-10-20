# Security & database
- Guest credential: 256-bit random token; only an HMAC-SHA256 hash is stored. Ownership is checked on every private route and socket connection.
- Database: reached only from the backend via `DATABASE_URL`. Row Level Security is enabled on every table with no policies (deny-by-default for the Supabase public API). No Supabase key is used or shipped to the browser.
- Input: zod on every route and socket event; submissions reject `<`, `>` and control characters; the UI renders text only (React escapes).
- Abuse limits: per-IP limits (guest creation, challenges, reports, admin), per-player daily submission cap, per-player room-create cap, per-socket event cap, 20 KB body limit, 30 s request timeout. `trust proxy` is set for Render.
- Admin: `ADMIN_API_KEY` compared in constant time; unset = admin disabled.
- Transport/headers: helmet; CORS and Socket.IO origins limited to `ALLOWED_ORIGINS`.
- Limits: guest identities are lost if browser storage is cleared; the DB TLS setting uses `rejectUnauthorized:false` (Supabase pooler) — pin the CA for stricter setups; rate-limit state is in memory.
