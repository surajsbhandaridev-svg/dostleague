# DostLeague local setup fixes

This patch addresses the three startup errors reported from Windows PowerShell.

## 1. Supabase DNS / DATABASE_URL

The value in the user's local `backend/.env` points at `db.qongqgcqywjdcralgsmr.supabase.co`, which is the direct-connection hostname. The error `getaddrinfo ENOTFOUND` means the hostname did not resolve in that environment. The ZIP cannot safely invent the user's actual Supabase connection string.

Fix: open Supabase Dashboard → Connect → Session pooler and copy the complete URI supplied by Supabase. Replace only the password placeholder. Put that URI in `backend/.env` as `DATABASE_URL`. Do not share the URI because it contains the database credential.

## 2. Shared package missing during seed/migrate

Updated `backend/package.json` so `db:migrate` and `db:seed` build `@dostleague/shared` before executing the TypeScript scripts. This should create `shared/dist/index.js`, which the scripts import.

## 3. Backend syntax error

Fixed the duplicate `extra` identifier in `backend/src/app.ts`. The result of `finalize(s)` is now named `finalExtra`, so it no longer conflicts with the optional `extra` callback parameter.

## Suggested commands

From the repository root in PowerShell:

```powershell
npm install --include=dev
npm run db:migrate -w backend
npm run db:seed -w backend
npm run dev:backend
```

In a second terminal:

```powershell
npm run dev:frontend
```

## Validation limitation

Package JSON files parse successfully. An `npm install --include=dev` attempt in the build environment timed out before dependencies were installed, so a full TypeScript build, database migration, seed, and multiplayer integration test could not be completed here. After fixing the local `DATABASE_URL`, run the commands above and confirm `/health/ready` responds with `{"ok":true,"db":"up"}`.
