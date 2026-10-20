/** Central, explicit ad-eligibility policy. Exact paths only (no substring matching). Unknown routes are NOT eligible. */
export interface RulePolicy { eligible: boolean; reason: string }
const no = (reason: string): RulePolicy => ({ eligible: false, reason });
const yes = (reason: string): RulePolicy => ({ eligible: true, reason });
export const ROUTE_POLICY: Record<string, RulePolicy> = {
  "/articles/live-trivia-battles": yes("Long original guide with examples"),
  "/articles/scoring-and-speed-bonus": yes("Long original guide with worked examples"),
  "/articles/puzzle-types-guide": yes("Long original guide with worked examples"),
  "/": no("Home/navigation page"), "/articles": no("Index of articles (navigation)"),
  "/guides": no("Index (navigation)"), "/guides/pattern-puzzles": no("Short guide; expand before enabling ads"), "/guides/riddle-solving": no("Short guide; expand before enabling ads"),
  "/guides/memory-sequences": no("Short guide; expand before enabling ads"), "/guides/daily-challenge-strategy": no("Short guide; expand before enabling ads"),
  "/how-to-play": no("Short instructional page"), "/about": no("Policy/info page"), "/contact": no("Policy/info page"), "/privacy": no("Policy page"), "/terms": no("Policy page"),
  "/cookies": no("Policy page"), "/disclaimer": no("Policy page"), "/community-rules": no("Policy page"),
  "/daily": no("Gameplay"), "/practice": no("Gameplay"), "/battle": no("Create/join forms"), "/room": no("Live game screens and lobby"),
  "/challenge": no("Gameplay and results"), "/leaderboard": no("Data page, no editorial content"), "/history": no("Private player data"), "/profile": no("Private player data"),
  "/community": no("Submission form and user content"), "/admin": no("Private admin tool"), "/ads-preview": no("Developer preview"),
};
export function normalizePath(p: string): string { const x = p.split(/[?#]/)[0].toLowerCase().replace(/\/+$/, ""); return x === "" ? "/" : x; }
export function adEligible(pathname: string): boolean { return ROUTE_POLICY[normalizePath(pathname)]?.eligible === true; }
