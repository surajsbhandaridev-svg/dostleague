# DostLeague UI Redesign and Frontend Review

## Changes in this revision

- Reworked the homepage into a polished DostLeague landing/dashboard with dark navy and purple visual identity, hero illustration, Friend Battle and Daily Dangal actions, game-mode cards, challenge preview, and responsive layouts.
- Added a shared top navigation with active route states and profile/play actions.
- Redesigned the Friend Battle name-entry, create-room, and join-room screen to match the supplied visual reference.
- Redesigned live room lobby, player tiles, question options, progress state, caption battle, and final results presentation while preserving the existing Socket.IO event names and API wiring.
- Redesigned Daily Dangal, guest name entry, question view, result state, and daily leaderboard presentation.
- Redesigned the leaderboard, empty states, and match history presentation.
- Added the generated friends illustration as a decorative asset at `frontend/public/friends-hero.png`. The UI is real React/TypeScript, not a screenshot used as the interface.
- Updated the design tokens and responsive CSS.
- Improved Friend Battle guest-name recovery: if a stored guest credential has expired, the flow clears it and creates a fresh guest profile after a 401 response.

## Verification status

- TypeScript/TSX syntax transpilation completed for 23 source files with no syntax diagnostics.
- `npm install --include=dev` was attempted, but dependency installation timed out in this environment.
- Because dependencies could not be installed, the full TypeScript type check, frontend production build, backend build, unit tests, and browser tests have **not** been verified here.
- Live multiplayer behavior was not tested in a running browser in this environment.

## Next verification steps

From the project root on a machine with npm registry access:

1. Run `npm install --include=dev`.
2. Configure `backend/.env` and `frontend/.env` with the correct Supabase and local URLs.
3. Run `npm run db:migrate -w backend` and `npm run db:seed -w backend`.
4. Run `npm test`, `npm test -w frontend`, and `npm run build`.
5. Run backend and frontend in separate terminals and test two independent browser sessions.

Never share `backend/.env`, database passwords, or Supabase service-role credentials.

## Account / save-progress update
- `/account` now provides Create account and Sign in tabs.
- The global header has a visible Sign in / Save progress action; it distinguishes a real account from a guest profile.
- Guest profiles can be upgraded to email/password accounts without changing player ID.
- Migration 007 creates account data and personal history for solo/bot/Saboteur results.
- Important: database saving and authentication still require valid Supabase credentials and successful migrations. The previously reported PostgreSQL `password authentication failed` error must be fixed separately.
- A syntax-only check passed for 53 TypeScript/TSX files. Full dependency install/build/tests remain unverified because npm installation timed out.
