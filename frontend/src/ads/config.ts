/** Build-time AdSense configuration (Vite embeds VITE_* values at build time: rebuild/redeploy after changing them). */
export type Placement = "guideTop" | "guideMiddle" | "guideBottom";
export interface AdsConfig { enabled: boolean; approved: boolean; client: string; slots: Record<Placement, string>; problems: string[] }
const CLIENT_RE = /^ca-pub-\d{10,20}$/; const SLOT_RE = /^\d{6,20}$/;
const fake = (digits: string) => /^(\d)\1+$/.test(digits) || digits === "1234567890" || digits === "1234567890123456"; // obvious placeholders
export function readAdsConfig(env: Record<string, unknown>): AdsConfig {
  const s = (k: string) => String(env[k] ?? "").trim(); const problems: string[] = [];
  const enabled = s("VITE_ADS_ENABLED") === "true", approved = s("VITE_ADS_SITE_APPROVED") === "true"; const client = s("VITE_ADSENSE_CLIENT");
  const slots = { guideTop: s("VITE_ADSENSE_SLOT_GUIDE_TOP"), guideMiddle: s("VITE_ADSENSE_SLOT_GUIDE_MIDDLE"), guideBottom: s("VITE_ADSENSE_SLOT_GUIDE_BOTTOM") };
  if (enabled) {
    if (!approved) problems.push("VITE_ADS_SITE_APPROVED is not \"true\" (set it only after AdSense shows the site as Ready)");
    if (!CLIENT_RE.test(client) || fake(client.replace("ca-pub-", ""))) problems.push("VITE_ADSENSE_CLIENT must be your real ca-pub-… publisher ID");
    for (const [k, v] of Object.entries(slots)) if (!SLOT_RE.test(v) || fake(v)) problems.push(`slot for ${k} is missing or invalid`);
  }
  const ok = (v: string, re: RegExp, raw: string) => re.test(v) && !fake(raw);
  return { enabled, approved, client: ok(client, CLIENT_RE, client.replace("ca-pub-", "")) ? client : "", slots: { guideTop: ok(slots.guideTop, SLOT_RE, slots.guideTop) ? slots.guideTop : "", guideMiddle: ok(slots.guideMiddle, SLOT_RE, slots.guideMiddle) ? slots.guideMiddle : "", guideBottom: ok(slots.guideBottom, SLOT_RE, slots.guideBottom) ? slots.guideBottom : "" }, problems };
}
/** Real ads need: enabled + site marked approved + a valid publisher ID. Each placement additionally needs its own valid slot ID. */
export const adsLive = (c: AdsConfig) => c.enabled && c.approved && c.client !== "";
const rawEnv = ((import.meta as unknown as { env?: Record<string, unknown> }).env) ?? {};
export const adsConfig = readAdsConfig(rawEnv);
if (rawEnv.DEV === true && adsConfig.enabled && adsConfig.problems.length) console.info("[ads] disabled until fixed:", adsConfig.problems.join("; "));
