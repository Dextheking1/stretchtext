// Renders the fixture article in real Chromium (Playwright) with the
// extension's content script and a mocked model call, and saves a screenshot.
// Used to produce docs/screenshot.png honestly: real browser, real content
// script, mocked API (no Pollen spent).
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const executablePath = join(
  homedir(),
  ".cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell"
);

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 900, height: 1150 } });
await page.goto("file://" + join(root, "test/fixtures/article.html"));
await page.waitForSelector(".st-grown .st-grown", { timeout: 10000 });
await page.waitForTimeout(400);
await page.screenshot({ path: join(root, "docs/screenshot.png") });
await browser.close();
console.log("screenshot saved");
