import { test, expect } from "@playwright/test";
test("two separate browsers play a live match", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage(), b = await (await browser.newContext()).newPage();
  await a.goto("/battle"); await a.getByLabel("Display name").fill("Asha"); await a.getByRole("button", { name: "Create private room" }).click();
  const code = (await a.locator("h1 span").first().innerText()).trim();
  await b.goto("/battle"); await b.getByLabel("Display name").fill("Ravi"); await b.getByLabel("Room code").fill(code); await b.getByRole("button", { name: "Join" }).click();
  await b.getByRole("button", { name: "Ready" }).click(); await a.getByRole("button", { name: "Start match" }).click();
  for (let i = 0; i < 5; i++) {
    for (const p of [a, b]) { await expect(p.getByText(new RegExp(`Question ${i + 1} of`))).toBeVisible({ timeout: 20_000 }); await p.getByTestId("opt").first().click(); }
  }
  for (const p of [a, b]) await expect(p.getByText("Final scoreboard")).toBeVisible({ timeout: 30_000 });
});
