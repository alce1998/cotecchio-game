import { chromium } from "playwright";

const url = "https://3000-i9xlclvdo2add1k916q2e-a0dec53b.us2.manus.computer/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Siediti al tavolo/i }).click();
  await page.waitForFunction(() => document.querySelectorAll(".hand-area .piacentine-card:not(.disabled)").length > 0, null, { timeout: 8_000 });

  const hand = page.locator(".hand-area .piacentine-card:not(.disabled)");
  const card = hand.first();
  const trick = page.locator(".trick-zone");
  const before = await hand.count();
  const cardBox = await card.boundingBox();
  const trickBox = await trick.boundingBox();
  if (!cardBox || !trickBox) throw new Error("Impossibile trovare carta o campo di gioco");

  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  const endX = trickBox.x + trickBox.width / 2;
  const endY = trickBox.y + trickBox.height * 0.72;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 18 });
  await page.mouse.up();

  await page.waitForFunction((initial) => document.querySelectorAll(".hand-area .piacentine-card").length < initial, before, { timeout: 4_000 });
  const after = await page.locator(".hand-area .piacentine-card").count();
  if (after !== before - 1) throw new Error(`Carta non giocata: mano ${before} → ${after}`);
  console.log(`OK: mouse drag ha giocato una carta (${before} → ${after}).`);
} finally {
  await browser.close();
}
