# Arcade frontend (applied to v9)

Applied the supplied reference layout to the existing project: new app shell (`frontend/src/Arcade.tsx`, `arcade.css`) around all existing routes.

## What changed
- **Header:** logo, working game search (matches title/category, links to the game chooser via `/?game=id`), match-history shortcut, profile chip showing the real guest name and status (Online / Server offline / Not signed in).
- **Left rail** (becomes a horizontal scroll bar on phones): Home, Games, Friend Battle, Daily Dangal, Leaderboard, How to Play, My Profile, Community, Articles.
- **Home:** Signal Saboteur hero (badges say VS BOTS, 4–8 players, UNRANKED, because that is what exists), existing filterable game library restyled to the reference (cover, title, mode badges, round play button), right column with Daily Dangal (live countdown to midnight IST and today's question count), Quick Play (Solo, Vs Bots, With Friends, Practice: all real routes), Top Players, and a bottom bar.
- All other pages (Daily, rooms, profile, articles, policy pages, admin, ads preview) are unchanged and render inside the new shell. Ads stay off by default and never appear on the shell, home or game screens.

## Deliberate differences from the reference
- **No invented data:** the reference shows "Rohan", scores like 2870, "2.4K+ Active Players" and "1.8K+ Daily Challenges". The app shows only real values: the guest's own name, the actual weekly top 5 (or an empty-state message), and real player/daily-challenge counts from the database (— while loading or offline).
- **Artwork:** the reference uses painted illustrations. I cannot produce that quality here, so the existing 13 local vector covers are used. Replace any `frontend/public/games/<id>.svg` with your own art (same file name, 16:9) to upgrade it.
- Not included: notification bell (no notification feature), Settings (no settings page), decorative "Good Vibes Only"/"Game On" graphics.
- `FRONTEND_REDESIGN.md` said Signal Saboteur is "Coming Soon". In this project it is playable against bots, so it is presented as playable.

## Validation
Not run: `npm install`, build, Vitest, browser. Run: syntax/type scan with `tsc` (no non-module errors), CSS brace balance, and a check that every `ar-` class used is defined. New tests (unrun): `frontend/src/Arcade.test.tsx`.
Run locally: `npm install && npm test -w frontend && npm run build`, then `npm run dev:frontend`.
