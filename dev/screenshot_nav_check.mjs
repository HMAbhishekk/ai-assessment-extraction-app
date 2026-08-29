// Visual verification for the newly-wired nav/topbar/settings functionality
// (sidebar sections, Settings health panel, help/notifications/profile
// popovers, mobile drawer nav). Requires the app + OCR service + fake-ollama
// to already be running (see dev/screenshot_check.mjs for that setup).
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const OUT_DIR = "/tmp/screens";

async function shot(page, name) {
  await page.screenshot({ path: `${OUT_DIR}/${name}.png`, fullPage: true });
  console.log("saved", name);
}

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE, { waitUntil: "networkidle" });

  // Sidebar nav -> placeholder section
  await page.getByRole("button", { name: "My Classroom" }).click();
  await page.waitForTimeout(300);
  await shot(page, "nav-01-classroom-placeholder");

  // Settings via sidebar -> real health panel
  await page.getByRole("button", { name: "Settings" }).first().click();
  await page.waitForTimeout(800);
  await shot(page, "nav-02-settings-panel");

  // Back to Exams via placeholder's own button (round-trip through a
  // different placeholder first)
  await page.getByRole("button", { name: "Assignments" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Go to Exams" }).click();
  await page.waitForTimeout(300);
  await shot(page, "nav-03-back-to-exams");

  // TopBar: help popover
  await page.getByRole("button", { name: "Help" }).click();
  await page.waitForTimeout(300);
  await shot(page, "nav-04-help-popover");

  // Profile popover (closes help via outside-click semantics through direct click)
  await page.getByText("Madhur Rastogi").click();
  await page.waitForTimeout(300);
  await shot(page, "nav-05-profile-popover");

  // Notifications popover (empty state, no job run yet)
  await page.getByRole("button", { name: "Notifications" }).click();
  await page.waitForTimeout(300);
  await shot(page, "nav-06-notifications-empty");

  // Mobile drawer nav
  await context.close();
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(BASE, { waitUntil: "networkidle" });
  await mobilePage.getByRole("button", { name: "Menu" }).click();
  await mobilePage.waitForTimeout(300);
  await shot(mobilePage, "nav-07-mobile-drawer");
  await mobilePage.getByRole("button", { name: "Home" }).click();
  await mobilePage.waitForTimeout(300);
  await shot(mobilePage, "nav-08-mobile-home-placeholder");
  await mobileContext.close();

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
