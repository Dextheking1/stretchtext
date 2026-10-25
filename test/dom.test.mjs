// DOM load test: runs the real content script against the fixture article
// in jsdom with a stubbed chrome API and a mocked model response.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = readFileSync(join(root, "test/fixtures/article.html"), "utf8");
const libSrc = readFileSync(join(root, "src/lib.js"), "utf8");
const contentSrc = readFileSync(join(root, "src/content.js"), "utf8");

const MOCK_1 = "Mock expansion one. It adds detail in place.";
const MOCK_2 = "Mock expansion two, one level deeper.";

function tick(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function loadFixture() {
  const dom = new JSDOM(fixture, { url: "https://example.test/article", runScripts: "outside-only" });
  const { window } = dom;
  window.chrome = {
    storage: { local: { get: (keys, cb) => cb({ enabled: true }) } },
    runtime: {
      sendMessage: (msg, cb) => {
        setTimeout(() => cb({ ok: true, text: msg.depth === 2 ? MOCK_2 : MOCK_1 }), 5);
      },
    },
  };
  window.eval(libSrc);
  window.eval(contentSrc);
  await tick(30);
  return window;
}

test("content script adds stretch buttons to long paragraphs only", async () => {
  const window = await loadFixture();
  const doc = window.document;
  const buttons = doc.querySelectorAll(".st-btn");
  assert.ok(buttons.length >= 2, "expected buttons on the two long paragraphs, got " + buttons.length);
  const pre = doc.querySelector("pre");
  assert.equal(pre.querySelector(".st-btn"), null, "code block must stay untouched");
  const editable = doc.querySelector("[contenteditable]");
  assert.equal(editable.querySelector(".st-btn"), null, "editable field must stay untouched");
  const allText = doc.body.textContent;
  assert.ok(!allText.includes("Short paragraph. It should not get a control. + stretch") ||
            doc.querySelectorAll("p")[3].querySelector(".st-btn") === null,
            "short paragraph must not get a button");
});

test("expand inserts tinted growth, depth 2 works, collapse restores exactly", async () => {
  const window = await loadFixture();
  const doc = window.document;
  const p = [...doc.querySelectorAll("p")].find((el) => el.textContent.includes("In 1967 Ted Nelson"));
  const originalText = p.textContent.replace("+ stretch", "").trim();

  p.querySelector(".st-btn").click();
  await tick(40);
  const grown = p.querySelector(".st-grown");
  assert.ok(grown, "depth 1 growth inserted");
  assert.ok(grown.textContent.includes(MOCK_1));

  const deeper = grown.querySelector(".st-btn");
  assert.ok(deeper, "depth 2 control present inside grown text");
  deeper.click();
  await tick(40);
  const grown2 = grown.querySelector(".st-grown");
  assert.ok(grown2, "depth 2 growth inserted");
  assert.ok(grown2.textContent.includes(MOCK_2));

  p.querySelector(".st-btn").click(); // shrink the top level
  await tick(10);
  assert.equal(p.querySelector(".st-grown"), null, "collapse removes all growth");
  assert.equal(p.textContent.replace("+ stretch", "").trim(), originalText,
    "original paragraph text restored exactly after collapse");
});
