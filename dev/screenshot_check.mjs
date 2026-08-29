// One-off visual verification script: drives the real running app (Next
// server + fake-ollama + OCR service must already be up) through the full
// upload -> processing -> results flow and saves screenshots at a few
// breakpoints so the rebuilt UI can be checked against the Figma design.
import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const OUT_DIR = "/tmp/screens";
const QUESTION_FILE = path.resolve("test_fixtures/question_paper.png");
const ANSWER_FILE = path.resolve("test_fixtures/answer_sheet.pdf");

async function shot(page, name) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true });
  console.log("saved", name);
}

async function run() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium/chrome-linux/chrome" }).catch(async () => {
    return chromium.launch();
  });

  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    await page.goto(BASE, { waitUntil: "networkidle" });
    await shot(page, `${label}-01-upload-empty`);

    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.nth(0).setInputFiles(QUESTION_FILE);
    await fileInputs.nth(1).setInputFiles(ANSWER_FILE);
    await page.waitForTimeout(300);
    await shot(page, `${label}-02-upload-filled`);

    await page.getByText("Start Mapping", { exact: false }).click();
    await page.waitForTimeout(600);
    await shot(page, `${label}-03-processing`);

    // Wait for the results screen (poll interval is 1.2s server-side; give
    // this fixture, which is small, generous headroom).
    await page.waitForSelector("text=Extracted Questions", { timeout: 90_000 });
    await page.waitForTimeout(500);
    await shot(page, `${label}-04-results`);

    if (label === "mobile") {
      const sheetTab = page.getByRole("button", { name: "Answer Sheet" });
      if (await sheetTab.count()) {
        await sheetTab.click();
        await page.waitForTimeout(300);
        await shot(page, `${label}-05-results-sheet-tab`);
      }
    }

    await context.close();
  }

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
