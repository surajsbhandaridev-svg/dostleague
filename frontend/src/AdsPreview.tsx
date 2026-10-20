import { Link } from "react-router-dom"; import { usePage } from "./Public"; import { NotFound } from "./NotFound"; import { ROUTE_POLICY } from "./ads/policy";
/** Only in local dev or when VITE_ADS_PREVIEW=true. Never loads the AdSense script and never renders an <ins> ad unit. */
export const previewEnabled = (env: Record<string, unknown> = ((import.meta as unknown as { env?: Record<string, unknown> }).env) ?? {}) => env.DEV === true || env.VITE_ADS_PREVIEW === "true";
const Slot = ({ label, w, h }: { label: string; w: number; h: number }) => <div role="img" aria-label={`Placeholder: ${label}`} className="ad-ph" style={{ width: "100%", maxWidth: w, height: h }}><strong>{label}</strong><span>{w} × {h} placeholder (no ad)</span></div>;
export function AdsPreview({ enabled = previewEnabled() }: { enabled?: boolean }) {
  usePage("Ad Placement Preview", "Developer-only ad layout preview.", "/ads-preview", { noindex: true });
  if (!enabled) return <NotFound />;
  const eligible = Object.entries(ROUTE_POLICY).filter(([, v]) => v.eligible).map(([k]) => k);
  return <main><div role="alert" className="ad-demo-banner">DEMO PREVIEW — NO REAL ADS ARE BEING SERVED</div><h1>DostLeague Ad Placement Preview</h1>
    <p>The grey rectangles below are visual design samples only. They contain no Google code, make no ad requests and cannot create impressions or clicks.</p>
    <h2>Sample editorial page (desktop)</h2><div className="ad-sample"><h3>Sample article title</h3><Slot label="Top banner (guideTop)" w={728} h={90} /><p>Introduction paragraph of the article appears first, so readers see useful content before any advertisement.</p><p>More article text…</p><Slot label="In-content (guideMiddle)" w={336} h={280} /><p>The article continues after the in-content placement…</p><Slot label="Bottom of article (guideBottom)" w={300} h={250} /></div>
    <h2>Sample editorial page (mobile)</h2><div className="ad-sample" style={{ maxWidth: 360 }}><Slot label="Top banner (mobile)" w={320} h={100} /><p>Article text…</p><Slot label="In-content (mobile)" w={300} h={250} /></div>
    <h2>Where placements are allowed</h2><p>Only long, original editorial articles listed in the central policy (<code>src/ads/policy.ts</code>). Currently eligible:</p><ul>{eligible.map((e) => <li key={e}><code>{e}</code></li>)}</ul>
    <p>Never on: gameplay, answer choices, timers, create/join forms, lobbies, results, profiles, policy pages, or this preview.</p><p><Link to="/" className="subtle-link">← Back to the DostLeague homepage</Link></p></main>;
}
