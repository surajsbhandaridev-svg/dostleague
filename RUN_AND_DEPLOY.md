# Run and deploy DostLeague (Windows + free plans)

This guide assumes you extracted this repository and are using Node.js 20 or newer.

## A. Run locally first

### 1) Install dependencies

Open PowerShell in the repository root (the folder containing the top-level `package.json`):

```powershell
node -v
npm -v
npm install --include=dev
```

Keep the generated `package-lock.json` and commit it to GitHub. The included Render Blueprint uses `npm install --include=dev` because the supplied ZIP did not contain a lockfile. With a lockfile committed, `npm ci --include=dev` is more reproducible.

### 2) Create the free database

Create a Supabase project, open **Connect**, choose **Session pooler**, and copy the entire PostgreSQL connection URI from the dashboard. Use the exact host, username, and port provided there; do not manually type or reconstruct the hostname. Keep the password private.

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Open `backend\.env` and replace the sample `DATABASE_URL` with the exact Session Pooler URI copied from Supabase. The host should be the specific pooler hostname shown in Connect, typically ending in `.pooler.supabase.com`, rather than `db.<project-ref>.supabase.co`. Set `SESSION_TOKEN_SECRET` to a unique random string of at least 32 characters. The sample `ADMIN_API_KEY` is commented out; uncomment it with a unique random value of at least 24 characters only if you need the moderation page locally.

Do not share or commit `backend\.env`, and never put database credentials in `frontend\.env`.

### 3) Create tables and seed questions

From the repository root:

```powershell
npm run db:migrate -w backend
npm run db:seed -w backend
```

The seed script creates 365 days of daily challenge packs starting from the current India date. The script is safe to rerun for extending the future challenge horizon.

### 4) Start frontend and backend

Use two PowerShell terminals, both opened at the repository root.

Terminal 1:

```powershell
npm run dev:backend
```

Terminal 2:

```powershell
npm run dev:frontend
```

Open `http://localhost:5173`. Backend health endpoints:

- `http://localhost:10000/health`
- `http://localhost:10000/health/ready`

### 5) Test multiplayer and accounts locally

1. Open `http://localhost:5173/battle` in a normal browser window.
2. Enter a guest display name and create a private room.
3. Open a private/incognito browser window and go to `http://localhost:5173/battle`.
4. Enter a different display name, enter the first player's room code, and join.
5. Mark the second player Ready; then start the match from the host window.
6. Complete a full match and verify the scoreboard.
7. Open `http://localhost:5173/account`. The page provides **Create account** and **Sign in** tabs.
8. To keep the current guest profile and history, stay on **Create account** while signed in as that guest. This attaches the email/password account to the same player ID. Signing into a different existing account switches to that account; histories are not automatically merged.
9. To check cross-device persistence, sign out and sign in using the same email/password on a separate browser after the database is working.
10. Check History and Profile to confirm results persisted.

**Saved-data requirement:** `backend/.env` must contain the correct Supabase Session Pooler `DATABASE_URL`, the database must be reachable, and migration `007_accounts_and_solo_results.sql` must have succeeded. When the backend logs `password authentication failed` or `/health/ready` reports `db: down`, guest creation, sign-in, and saving cannot work until database credentials/connectivity are fixed.

This MVP does not send verification or password-reset emails. Add email verification and recovery before broad public launch.

Run checks:

```powershell
npm test
npm test -w frontend
npm run build
```

For browser end-to-end tests, install Playwright Chromium once with `npx playwright install chromium`, then run `npm run e2e` while the local servers and seeded database are available.

## B. Deploy on Render + Supabase free plans

### 1) Push the project to GitHub

Create an empty GitHub repository. From the repository root:

```powershell
git init
git add .
git status
git commit -m "Prepare DostLeague MVP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Before committing, verify that no `.env` file, database password, service key, or real admin key appears in `git status`. Only `.env.example` files should be committed.

### 2) Prepare Supabase

Run migrations and seeding locally against the same Supabase `DATABASE_URL` that Render will use. Verify `/health/ready` locally returns `{ "ok": true, "db": "up" }` after seeding.

### 3) Create Render services

In Render, choose **New → Blueprint** and connect the GitHub repository containing `render.yaml`. The Blueprint defines:

- `dostleague-api`: Node.js Express + Socket.IO backend.
- `dostleague-web`: static Vite frontend.

When prompted for backend `DATABASE_URL`, use the Supabase Session Pooler connection string. Enter a unique random `ADMIN_API_KEY` of at least 24 characters when prompted; this enables the moderation screen. Keep this key and the generated `SESSION_TOKEN_SECRET` private.

The exact public URLs are assigned by Render. After both services exist, open each service's **Environment** page and set the values below to the URLs Render actually assigned (no trailing slash):

Backend service:

- `DATABASE_URL` = Supabase Session Pooler connection string.
- `ALLOWED_ORIGINS` = exact frontend URL, e.g. `https://YOUR-FRONTEND.onrender.com`.
- `SESSION_TOKEN_SECRET` = generated secret.
- `ADMIN_API_KEY` = the same unique secret of at least 24 characters entered during Blueprint setup.

Frontend static site:

- `VITE_API_BASE_URL` = exact backend URL, e.g. `https://YOUR-API.onrender.com`.
- `VITE_SOCKET_URL` = the same backend URL.
- `VITE_SITE_URL` = exact frontend URL.

Vite embeds `VITE_*` values at build time, so **redeploy the frontend after changing these variables**. Redeploy/restart the backend after changing `ALLOWED_ORIGINS` or database configuration.

If the Blueprint asks for initial values before the final URLs are known, use the expected service URLs if available, then correct them in the Environment pages after deployment and redeploy.

### 4) Verify the live site

Open:

- `https://YOUR-API.onrender.com/health`
- `https://YOUR-API.onrender.com/health/ready`
- `https://YOUR-FRONTEND.onrender.com`

Then test: guest creation, Daily Dangal, room creation, joining by code, real-time answers, final scoring, and the leaderboard. Restart the backend and verify that completed scores remain in Supabase.

## Free-plan limits to understand

- Render's free web service can sleep after inactivity, so the first request may take around a minute. Active room state is held in memory and can be interrupted by a restart/sleep; completed scores are persisted in Supabase.
- Supabase Free has storage and usage limits and can pause an inactive project.
- Do not use a Render local SQLite file for deployed persistent records.
- This is an MVP/test deployment, not a guarantee of 24/7 availability or unlimited traffic.

## If something fails

- Build error: confirm Node.js is current, run `npm install --include=dev`, then `npm run build` locally.
- Database connection error: re-copy the Supabase Session Pooler URI and make sure the password is URL-encoded if it contains special characters.
- `health` succeeds but `health/ready` fails: run migrations and seeding against the same database URL used by Render.
- CORS/browser requests fail: set `ALLOWED_ORIGINS` to the exact static frontend origin and redeploy the backend.
- Frontend calls `localhost` after deployment: set the production `VITE_API_BASE_URL` and `VITE_SOCKET_URL`, then rebuild/redeploy the static site.
- Friend invite asks for a name: enter one; the room code should remain prefilled from the invite link.


## AdSense deployment steps
1. Deploy with ads disabled (the blueprint sets all three flags to "false"). Use your own domain as `VITE_SITE_URL`.
2. In AdSense add the site, verify ownership, request review, and wait for **Ready**.
3. Create three ad units; copy the publisher ID and slot IDs into the Render static-site environment; set the enable and approved flags to "true"; redeploy.
4. Visit `/ads.txt` and an article page to confirm. To test layout without real ads use `/ads-preview` locally.


## v9 notes
No new migration or environment variable is needed. Local check list: `npm install`, `npm test`, `npm test -w frontend`, `npm run build`; then play `/practice/math?bots=3&difficulty=hard` and `/saboteur` in the browser. Solo/bot/Saboteur sessions live in server memory (single instance, lost on restart).


## Accounts and saved solo results (v10 update)
- Visit `/account` to create an account or sign in. If you are already a guest, choose Create account to attach email/password to the same player ID and preserve existing history. Signing into a different account switches the browser identity; guest data is not automatically merged into a different existing account.
- Passwords are hashed server-side using Node.js scrypt. This MVP does not send email-verification or password-reset emails; the user should use an email they control and protect the password. Add verified-email and recovery flows before a broad production launch.
- Apply migration `007_accounts_and_solo_results.sql` with `npm run db:migrate -w backend`. Practice and Signal Saboteur results are saved in the personal history but remain excluded from competitive leaderboards.
- If the application was already deployed, push the changes, run the migration against the same Supabase database, and redeploy both backend and frontend.
