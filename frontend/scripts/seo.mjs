import { mkdirSync, writeFileSync, rmSync } from "node:fs";
const site = (process.env.VITE_SITE_URL || "").replace(/\/$/, ""); const real = /^https:\/\/[^/\s]+\.[^/\s]+/.test(site);
// /ads-preview is intentionally NOT listed. Add pages here only when they are public and useful.
const paths = ["/", "/how-to-play", "/articles", "/articles/live-trivia-battles", "/articles/scoring-and-speed-bonus", "/articles/puzzle-types-guide", "/guides", "/guides/pattern-puzzles", "/guides/riddle-solving", "/guides/memory-sequences", "/guides/daily-challenge-strategy", "/about", "/contact", "/privacy", "/terms", "/cookies", "/disclaimer", "/community-rules", "/leaderboard", "/community"];
mkdirSync("public", { recursive: true });
if (real) writeFileSync("public/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `  <url><loc>${site}${p}</loc></url>`).join("\n")}\n</urlset>\n`);
else { rmSync("public/sitemap.xml", { force: true }); console.warn("[seo] VITE_SITE_URL is not a real https URL: sitemap not generated."); }
writeFileSync("public/robots.txt", `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /room/\nDisallow: /ads-preview\nDisallow: /challenge/\n${real ? `Sitemap: ${site}/sitemap.xml\n` : ""}`);
// ads.txt only from a real publisher ID. Nothing is invented; with no valid ID any stale file is removed.
const client = process.env.VITE_ADSENSE_CLIENT || "";
if (/^ca-pub-\d{10,20}$/.test(client)) writeFileSync("public/ads.txt", `google.com, ${client.replace("ca-", "")}, DIRECT, f08c47fec0942fa0\n`);
else { rmSync("public/ads.txt", { force: true }); console.warn("[seo] No valid VITE_ADSENSE_CLIENT: ads.txt not generated."); }
