import { test, expect } from "@playwright/test";

test("mostra il lancio carte prima del riepilogo della chiusura in mano", async ({ page }) => {
  await page.goto("https://3000-i9xlclvdo2add1k916q2e-a0dec53b.us2.manus.computer/?demo=chiuso", { waitUntil: "networkidle" });
  await expect(page.locator(".closed-hand-throw")).toBeVisible();
  await expect(page.locator(".overlay-panel")).toHaveCount(0);
  await page.waitForTimeout(1_500);
  await expect(page.locator(".closed-hand-throw")).toHaveCount(0);
  await expect(page.locator(".overlay-panel")).toBeVisible();
});
