import { test, expect } from "@playwright/test";
for (const path of ["/", "/articles/live-trivia-battles", "/articles/scoring-and-speed-bonus", "/articles/puzzle-types-guide", "/privacy", "/terms", "/cookies", "/contact", "/about", "/disclaimer", "/community-rules"]) test(`public page ${path} loads without ad script when ads are disabled`, async ({ page }) => {
  const res = await page.goto(path); expect(res?.status()).toBeLessThan(400); await expect(page.locator("h1").first()).toBeVisible(); expect(await page.locator("#adsense-script, ins.adsbygoogle").count()).toBe(0);
});
test("unknown route shows a not-found page", async ({ page }) => { await page.goto("/no-such-page"); await expect(page.getByText("Page not found")).toBeVisible(); });
