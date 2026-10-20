import { describe, it, expect, beforeEach } from "vitest"; import { render, screen, cleanup } from "@testing-library/react"; import { MemoryRouter } from "react-router-dom"; import { readFileSync } from "node:fs";
import { readAdsConfig, adsLive } from "./config"; import { adEligible, ROUTE_POLICY } from "./policy"; import { AdUnit, SCRIPT_ID } from "./AdUnit"; import { AdsPreview, previewEnabled } from "../AdsPreview"; import { Info } from "../Public"; import { Article, ARTICLES } from "../Articles";
const live = readAdsConfig({ VITE_ADS_ENABLED: "true", VITE_ADS_SITE_APPROVED: "true", VITE_ADSENSE_CLIENT: "ca-pub-4815162342108642", VITE_ADSENSE_SLOT_GUIDE_TOP: "2718281828", VITE_ADSENSE_SLOT_GUIDE_MIDDLE: "3141592653", VITE_ADSENSE_SLOT_GUIDE_BOTTOM: "1618033988" });
const at = (path: string, ui: React.ReactNode) => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
beforeEach(() => { cleanup(); document.getElementById(SCRIPT_ID)?.remove(); (window as { adsbygoogle?: unknown[] }).adsbygoogle = undefined; });
describe("ad configuration", () => {
  it("is disabled by default", () => { const c = readAdsConfig({}); expect(c.enabled).toBe(false); expect(adsLive(c)).toBe(false); });
  it("rejects placeholder or malformed IDs and unapproved sites", () => {
    expect(adsLive(readAdsConfig({ VITE_ADS_ENABLED: "true", VITE_ADS_SITE_APPROVED: "true", VITE_ADSENSE_CLIENT: "ca-pub-0000000000000000" }))).toBe(false);
    expect(adsLive(readAdsConfig({ VITE_ADS_ENABLED: "true", VITE_ADS_SITE_APPROVED: "true", VITE_ADSENSE_CLIENT: "pub-123" }))).toBe(false);
    expect(adsLive(readAdsConfig({ VITE_ADS_ENABLED: "true", VITE_ADSENSE_CLIENT: "ca-pub-4815162342108642" }))).toBe(false);
    expect(readAdsConfig({ VITE_ADS_ENABLED: "true", VITE_ADS_SITE_APPROVED: "true", VITE_ADSENSE_CLIENT: "ca-pub-4815162342108642", VITE_ADSENSE_SLOT_GUIDE_TOP: "1111111111" }).slots.guideTop).toBe("");
    expect(adsLive(live)).toBe(true);
  });
});
describe("route policy", () => {
  it("allows only listed articles", () => { for (const a of ARTICLES) expect(adEligible(a.path)).toBe(true); expect(adEligible("/articles/live-trivia-battles/")).toBe(true); });
  it("excludes gameplay, forms, policy, private and unknown routes", () => { for (const p of ["/", "/battle", "/room/ABC234", "/daily", "/practice", "/challenge/XYZ", "/profile", "/history", "/admin", "/privacy", "/terms", "/cookies", "/contact", "/about", "/disclaimer", "/community-rules", "/ads-preview", "/leaderboard", "/community", "/guides", "/unknown", "/articles/live-trivia-battles-extra"]) expect(adEligible(p), p).toBe(false); });
  it("has no substring-based or preview entries that are eligible", () => { expect(ROUTE_POLICY["/ads-preview"].eligible).toBe(false); });
});
describe("AdUnit", () => {
  it("renders nothing and loads no script when ads are disabled", () => { at("/articles/scoring-and-speed-bonus", <AdUnit placement="guideTop" config={readAdsConfig({})} />); expect(document.querySelector("ins")).toBeNull(); expect(document.getElementById(SCRIPT_ID)).toBeNull(); });
  it("renders nothing on excluded routes even when live", () => { for (const p of ["/battle", "/room/ABC234", "/privacy", "/daily"]) { cleanup(); at(p, <AdUnit placement="guideTop" config={live} />); expect(document.querySelector("ins")).toBeNull(); } expect(document.getElementById(SCRIPT_ID)).toBeNull(); });
  it("uses each placement's own slot and injects the script only once", () => {
    at("/articles/scoring-and-speed-bonus", <><AdUnit placement="guideTop" config={live} /><AdUnit placement="guideMiddle" config={live} /><AdUnit placement="guideBottom" config={live} /></>);
    expect([...document.querySelectorAll("ins")].map((e) => e.getAttribute("data-ad-slot"))).toEqual(["2718281828", "3141592653", "1618033988"]);
    expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1); cleanup(); at("/articles/puzzle-types-guide", <AdUnit placement="guideTop" config={live} />); expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);
  });
  it("does not push the same unit twice on re-render", () => { const { rerender } = at("/articles/puzzle-types-guide", <AdUnit placement="guideTop" config={live} />); rerender(<MemoryRouter initialEntries={["/articles/puzzle-types-guide"]}><AdUnit placement="guideTop" config={live} /></MemoryRouter>); expect((window as { adsbygoogle?: unknown[] }).adsbygoogle?.length ?? 0).toBeLessThanOrEqual(1); });
  it("articles render with no ads and no ad script by default", () => { at("/articles/live-trivia-battles", <Article slug="live-trivia-battles" />); expect(screen.getByRole("heading", { level: 1 })).toBeTruthy(); expect(screen.getAllByRole("heading", { level: 2 }).length).toBeGreaterThanOrEqual(5); expect(document.querySelector("ins")).toBeNull(); expect(document.getElementById(SCRIPT_ID)).toBeNull(); });
});
describe("/ads-preview", () => {
  it("is disabled in production mode and enabled in dev or with VITE_ADS_PREVIEW", () => { expect(previewEnabled({ DEV: false, VITE_ADS_PREVIEW: "false" })).toBe(false); expect(previewEnabled({ DEV: false, VITE_ADS_PREVIEW: "true" })).toBe(true); expect(previewEnabled({ DEV: true })).toBe(true); });
  it("shows not-found with noindex when disabled", () => { at("/ads-preview", <AdsPreview enabled={false} />); expect(screen.getByText("Page not found")).toBeTruthy(); expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toContain("noindex"); });
  it("shows only placeholders (no ins, no script) when enabled", () => { at("/ads-preview", <AdsPreview enabled />); expect(screen.getByText("DEMO PREVIEW — NO REAL ADS ARE BEING SERVED")).toBeTruthy(); expect(document.querySelector("ins")).toBeNull(); expect(document.getElementById(SCRIPT_ID)).toBeNull(); expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(5); });
});
describe("pages, gameplay and config hygiene", () => {
  it("policy pages load", () => { for (const k of ["about", "contact", "privacy", "terms", "cookies", "disclaimer", "rules"] as const) { cleanup(); at("/", <Info page={k} />); expect(screen.getByRole("heading", { level: 1 })).toBeTruthy(); } });
  it("gameplay source never imports or renders ad code", () => { for (const f of ["Room.tsx", "Daily.tsx", "Prompt.tsx", "Share.tsx"]) { const src = readFileSync(`src/${f}`, "utf8"); expect(src, f).not.toMatch(/AdUnit|adsbygoogle|ads\//); } });
  it("sitemap script excludes the preview route; env example has placeholders only", () => { const seo = readFileSync("scripts/seo.mjs", "utf8"); expect(seo.split("const paths")[1].split("];")[0]).not.toContain("ads-preview"); const env = readFileSync(".env.example", "utf8"); expect(env).not.toMatch(/ca-pub-\d|SERVICE_ROLE|DATABASE_URL|ADMIN_API_KEY|SESSION_TOKEN/); expect(env).toMatch(/VITE_ADS_ENABLED=false/); expect(env).toMatch(/VITE_ADSENSE_CLIENT=\n/); });
});
