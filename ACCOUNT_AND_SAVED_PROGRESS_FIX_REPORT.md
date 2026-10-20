# Account and Saved Progress Fix Report

## Implemented in this source package

- Added `/account` to the router with distinct **Create account** and **Sign in** tabs.
- Added a visible **Sign in / Save progress** link in the global header. It changes to **Account** when an email/password account is linked, not merely when a guest session exists.
- The header identity refreshes when the browser token changes, so the link and player status update after sign-in, registration, or sign-out.
- Added links to `/account` from guest name-entry, profile, and history flows.
- Registration creates a player plus account record and a server-issued session token; sign-in checks the stored password hash; guest upgrade attaches an email/password account to the same player ID.
- Passwords are stored as salted scrypt hashes, not plaintext.
- Added migration `007_accounts_and_solo_results.sql` for account records and personal-history persistence of completed solo practice, bot-practice and Signal Saboteur results.
- Completed solo/bot/Saboteur results remain unranked and are not inserted into the competitive leaderboard.
- Added backend account tests for registration/sign-in, duplicate email/wrong password, and guest upgrade preserving player ID.
- Improved account-page handling when the backend/database cannot verify an existing browser profile.
- Updated run/deploy instructions and corrected stale documentation that said solo/bot results were never saved.
- Hardened async auth middleware to forward database/session lookup failures to Express error handling.

## What the user must do locally

1. Use the `backend/.env` file with the correct Supabase Session Pooler `DATABASE_URL`.
2. Confirm the backend can authenticate to PostgreSQL. The earlier `password authentication failed for user "postgres"` error means registration, sign-in and saving will not work until the database credentials are corrected.
3. Run `npm run db:migrate -w backend` successfully. This applies migration `007_accounts_and_solo_results.sql` if not already applied.
4. Run `npm run db:seed -w backend`.
5. Run `npm run dev:backend` and `npm run dev:frontend` in separate terminals.
6. Open `http://localhost:5173/account` or click **Sign in / Save progress** in the top header.
7. If already playing as a guest, choose **Create account** to link an email/password to that same player profile. If you choose **Sign in** to a different existing account, the browser switches identity; separate guest history is not automatically merged.

## Limitations and verification

- This MVP does not send email-verification or password-reset emails. Add verified email and account recovery before a broad production launch.
- If guest browser storage is cleared before an account is linked, its local session token may be lost.
- The frontend/backend full build and automated tests could not be completed in this environment because `npm install --include=dev` timed out. A syntax-only TypeScript/TSX transpilation check passed for 53 source/test files; this is not a substitute for the real build/test suite.
