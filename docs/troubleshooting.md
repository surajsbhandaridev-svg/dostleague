# Troubleshooting
- **"Server is waking up"**: Render free backend asleep; wait ~1 minute.
- **CORS / socket `connect_error`**: `ALLOWED_ORIGINS` must exactly match the frontend origin (no trailing slash); frontend `VITE_*` URLs need a rebuild after changes.
- **`Invalid configuration`** at startup: the message lists variable names only; fix `backend/.env` / Render env.
- **Migration/seed fails**: check `DATABASE_URL` (pooler URI + password); migrations are tracked in `_migrations`, seeding never rewrites existing packs.
- **"no_challenge_today"**: seed covers 30 days from the day you ran it; rerun `db:seed`.
- **Rooms vanished**: backend restarted or slept; finished matches are still saved.
- **Render build can't find workspaces**: build from the repo root (the blueprint does) and commit `package-lock.json`.

- **`getaddrinfo ENOTFOUND db.<project-ref>.supabase.co`**: the hostname in `DATABASE_URL` does not resolve. Open Supabase Dashboard → **Connect** → **Session pooler**, copy the full URI, and replace only the password placeholder. Do not construct the hostname by hand; check that the project exists and is not paused, then run `nslookup <exact-host-from-the-URI>` in PowerShell. The shared session-pooler host is different from the direct `db.<project-ref>.supabase.co` host.
- **`Cannot find package @dostleague/shared/dist/index.js` during migration/seed**: rebuild the shared workspace. The updated `db:migrate` and `db:seed` scripts now do this automatically; alternatively run `npm run build -w @dostleague/shared` from the repository root before running migration or seed.
- **`The symbol "extra" has already been declared` in `backend/src/app.ts`**: the local finalization result conflicted with the `extra` callback parameter. The reviewed version renames the result variable to `finalExtra`.
