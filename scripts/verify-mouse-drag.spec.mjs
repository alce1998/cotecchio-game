import { test, expect } from "@playwright/test";

test("trascina una carta dalla mano al campo con mouse", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("https://3000-i9xlclvdo2add1k916q2e-a0dec53b.us2.manus.computer/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Siediti al tavolo/i }).click();
  const card = page.locator(".hand-area .piacentine-card:not(.disabled)").first();
  await expect(card).toBeVisible();
  const hand = page.locator(".hand-area .piacentine-card");
  const before = await hand.count();
  const cardBox = await card.boundingBox();
  const trickBox = await page.locator(".trick-zone").boundingBox();
  if (!cardBox || !trickBox) throw new Error("Carta o campo non visibile");

  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(trickBox.x + trickBox.width / 2, trickBox.y + trickBox.height * 0.72, { steps: 18 });
  await page.mouse.up();

  await expect(hand).toHaveCount(before - 1);
});

test("trascina una carta dalla mano al campo con touch", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("https://3000-i9xlclvdo2add1k916q2e-a0dec53b.us2.manus.computer/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Siediti al tavolo/i }).click();
  const card = page.locator(".hand-area .piacentine-card:not(.disabled)").first();
  await expect(card).toBeVisible();
  const hand = page.locator(".hand-area .piacentine-card");
  const before = await hand.count();
  const cardBox = await card.boundingBox();
  const trickBox = await page.locator(".trick-zone").boundingBox();
  if (!cardBox || !trickBox) throw new Error("Carta o campo non visibile");

  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  const endX = trickBox.x + trickBox.width / 2;
  const endY = trickBox.y + trickBox.height * 0.72;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: startX, y: startY }] });
  for (let step = 1; step <= 18; step += 1) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: startX + ((endX - startX) * step) / 18, y: startY + ((endY - startY) * step) / 18 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });

  await expect(hand).toHaveCount(before - 1);
});
