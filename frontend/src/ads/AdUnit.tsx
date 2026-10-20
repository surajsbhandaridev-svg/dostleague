import { useEffect, useRef } from "react"; import { useLocation } from "react-router-dom";
import { adsConfig, adsLive, type AdsConfig, type Placement } from "./config"; import { adEligible } from "./policy";
declare global { interface Window { adsbygoogle?: unknown[] } }
export const SCRIPT_ID = "adsense-script"; const HEIGHT: Record<Placement, number> = { guideTop: 110, guideMiddle: 290, guideBottom: 260 }; // reserved to limit layout shift
/** Injects Google's script at most once per page load. */
export function loadAdSenseScript(client: string) {
  if (document.getElementById(SCRIPT_ID)) return;
  const s = document.createElement("script"); s.id = SCRIPT_ID; s.async = true; s.crossOrigin = "anonymous"; s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`; document.head.appendChild(s);
}
/** Renders a real ad only if config is live, the route is eligible, and this placement has its own valid slot. Otherwise renders nothing. */
export function AdUnit({ placement, config = adsConfig }: { placement: Placement; config?: AdsConfig }) {
  const { pathname } = useLocation(); const ref = useRef<HTMLModElement>(null);
  const slot = adsLive(config) && adEligible(pathname) ? config.slots[placement] : "";
  useEffect(() => {
    if (!slot) return;
    try { loadAdSenseScript(config.client); const el = ref.current; if (el && !el.dataset.dlInit) { el.dataset.dlInit = "1"; (window.adsbygoogle = window.adsbygoogle || []).push({}); } } catch { /* ads must never break the page */ }
  }, [slot, config.client]);
  if (!slot) return null;
  return <aside className="ad-unit" aria-label="Advertisement" style={{ minHeight: HEIGHT[placement] }}><small className="ad-label">Advertisement</small><ins ref={ref} className="adsbygoogle" style={{ display: "block" }} data-ad-client={config.client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" /></aside>;
}
