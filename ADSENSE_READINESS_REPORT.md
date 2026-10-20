# AdSense readiness report (DostLeague v8)

**Status: technically prepared for a review. Not approved, and approval is not guaranteed. Nothing here was built or tested with a package install** (see "Validation").

## Audit (what I found in v8)
Vite + React Router + TypeScript frontend; Express + Socket.IO + Supabase Postgres backend; Render blueprint. Problems found: one global `AdSlot` rendered on every info page (including Privacy/Terms), a single reused slot ID, a homemade consent banner, no preview route, no 404 route, no Open Graph tags, thin 100–150-word guides, `ads.txt` generated from any well-formed ID, `VITE_ADSENSE_SLOT` not per placement.

## Files changed / added
New: `frontend/src/ads/{config,policy,AdUnit,ads.test}.ts(x)`, `AdsPreview.tsx`, `NotFound.tsx`, `Articles.tsx`, `public/{favicon.svg,manifest.webmanifest}`, `e2e/public.spec.ts`, this report.
Changed: `Public.tsx` (AdSlot and banner removed; policy pages rewritten; Open Graph/robots/canonical helper), `main.tsx` (routes), `index.css`, `index.html`, `vite.config.ts` (build-time verification meta), `scripts/seo.mjs`, `.env.example`, `render.yaml`, `ui.test.tsx`, README, RUN_AND_DEPLOY.md.

## Ad placement by route (source of truth: `src/ads/policy.ts`, exact paths)
- **Eligible (3):** `/articles/live-trivia-battles`, `/articles/scoring-and-speed-bonus`, `/articles/puzzle-types-guide` (top, in-content, bottom).
- **No ads:** home, article index, guides index and the four short guides (too thin; expand first), How to play, About, Contact, Privacy, Terms, Cookies, Disclaimer, Community Rules, Daily, Practice, Battle, rooms, challenges, results, leaderboard, history, profile, community, admin, `/ads-preview`, all unknown routes.

## Configuration status
Default: everything off. Real ads need `VITE_ADS_ENABLED=true` + `VITE_ADS_SITE_APPROVED=true` + a valid `ca-pub-…` ID, and each placement its own numeric slot ID. Placeholder-looking IDs are rejected. One script injection per page load; each unit initialised once; failures are caught. Variables are build-time: rebuild/redeploy after changes.

## Preview route
`/ads-preview`: available in `npm run dev` or when `VITE_ADS_PREVIEW=true`; otherwise a not-found page. noindex, not in the sitemap, disallowed in robots.txt, placeholders only (no `ins`, no script, no requests).

## SEO and policy
Unique title/description per page, canonical and Open Graph from `VITE_SITE_URL`, sitemap (only for a real https URL), robots.txt, favicon and manifest, 404 page, `google-adsense-account` meta injected at build only for a valid ID. Privacy/Terms/Cookies/Rules/Contact/About rewritten to match what the app actually stores. No invented company details. The old homemade consent banner was removed: it was not a certified CMP.

## Validation (honest)
**Not run:** `npm install`, builds, unit tests, Playwright, any browser. The sandbox has no network.
**Run:** `scripts/seo.mjs` in several environments, and the config/policy logic compiled with `tsc` and executed in Node (results in the chat reply). Tests in `ads.test.tsx`, `e2e/public.spec.ts` and the existing suites are written but unrun.

## Remaining manual tasks
1. Own a domain; connect it in Render; set `VITE_SITE_URL` to it; set `VITE_CONTACT_EMAIL`.
2. Have an owner read and adjust the policy pages and fact-check the three articles. Expand the four short guides before making them ad-eligible.
3. AdSense: add the site, verify ownership (the meta tag is added at build when `VITE_ADSENSE_CLIENT` is set), request review, **wait for Ready**.
4. AdSense → Privacy & messaging: set up a Google-certified CMP for EEA/UK/Switzerland traffic.
5. Create three ad units, add `VITE_ADSENSE_CLIENT`, the three slot IDs, `VITE_ADS_ENABLED=true`, `VITE_ADS_SITE_APPROVED=true` in the Render static-site environment, redeploy.
6. Check `/ads.txt` shows your own record. Never click your own ads.

## Known limitations
Content is client-rendered (consider prerendering); only 3 long articles; articles were written by an AI assistant and have not been independently fact-checked; free hosting may sleep; the app has not been run end to end.
