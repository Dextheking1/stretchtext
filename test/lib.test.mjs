import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Core = require("../src/lib.js");

test("splitSentences splits on terminal punctuation and keeps it", () => {
  const out = Core.splitSentences("First one here. Second follows! Is it third? Yes, trailing bit");
  assert.equal(out.length, 4);
  assert.equal(out[0], "First one here.");
  assert.equal(out[1], "Second follows!");
  assert.equal(out[2], "Is it third?");
});

test("splitSentences collapses whitespace and handles empty input", () => {
  assert.deepEqual(Core.splitSentences(""), []);
  assert.deepEqual(Core.splitSentences("   \n "), []);
  assert.deepEqual(Core.splitSentences("One   spaced\nsentence."), ["One spaced sentence."]);
});

test("isExpandableText enforces length and sentence count", () => {
  const good = "Stretchtext is an old idea from 1967 that never caught on because writing every level of detail by hand was too much work. Generated text changes that cost completely.";
  assert.equal(Core.isExpandableText(good), true);
  assert.equal(Core.isExpandableText("Too short."), false);
  assert.equal(Core.isExpandableText("x".repeat(3000) + ". And more."), false);
  assert.equal(Core.isExpandableText(""), false);
});

test("clampDepth keeps depth inside 1..MAX_DEPTH", () => {
  assert.equal(Core.clampDepth(0), 1);
  assert.equal(Core.clampDepth(1), 1);
  assert.equal(Core.clampDepth(2), 2);
  assert.equal(Core.clampDepth(99), Core.MAX_DEPTH);
  assert.equal(Core.clampDepth("nope"), 1);
});

test("buildExpandMessages asks for prose expansion, deeper at depth 2", () => {
  const m1 = Core.buildExpandMessages("Some passage.", 1);
  assert.equal(m1.length, 2);
  assert.equal(m1[0].role, "system");
  assert.match(m1[0].content, /plain prose only/);
  assert.match(m1[1].content, /Expand this passage/);
  const m2 = Core.buildExpandMessages("Some passage.", 2);
  assert.match(m2[1].content, /one level deeper/);
});

test("buildChatRequest targets the OpenAI-compatible gen endpoint", () => {
  const req = Core.buildChatRequest("Passage text.", 1);
  assert.equal(req.url, "https://gen.pollinations.ai/v1/chat/completions");
  assert.equal(req.body.model, Core.DEFAULT_MODEL);
  const custom = Core.buildChatRequest("Passage text.", 1, "openai/gpt-5.4-nano");
  assert.equal(custom.body.model, "openai/gpt-5.4-nano");
});

test("cacheKey is stable per passage, depth, and model", () => {
  const a = Core.cacheKey("Same  text here.", 1, "openai");
  const b = Core.cacheKey("Same text here.", 1, "openai");
  assert.equal(a, b);
  assert.notEqual(a, Core.cacheKey("Same text here.", 2, "openai"));
  assert.notEqual(a, Core.cacheKey("Other text here.", 1, "openai"));
});

test("cleanModelText strips code fences and surrounding quotes", () => {
  assert.equal(Core.cleanModelText("```\nExpanded text.\n```"), "Expanded text.");
  assert.equal(Core.cleanModelText('"Quoted result."'), "Quoted result.");
  assert.equal(Core.cleanModelText("  spaced   out  "), "spaced out");
  assert.equal(Core.cleanModelText(""), "");
});

test("parseChatResponse reads choices[0].message.content", () => {
  const json = { choices: [{ message: { content: " Grown text. " } }] };
  assert.equal(Core.parseChatResponse(json), "Grown text.");
  assert.equal(Core.parseChatResponse({}), "");
  assert.equal(Core.parseChatResponse(null), "");
});

test("device flow request builders match the BYOP doc", () => {
  const code = Core.buildDeviceCodeRequest("pk_abc");
  assert.equal(code.url, "https://enter.pollinations.ai/api/device/code");
  assert.deepEqual(code.body, { client_id: "pk_abc" });
  const anon = Core.buildDeviceCodeRequest(undefined);
  assert.deepEqual(anon.body, {});
  const token = Core.buildDeviceTokenRequest("dev-code-1");
  assert.equal(token.url, "https://enter.pollinations.ai/api/device/token");
  assert.deepEqual(token.body, { device_code: "dev-code-1" });
});

test("deviceTokenState classifies pending, done, and error", () => {
  assert.equal(Core.deviceTokenState({ access_token: "sk_x" }), "done");
  assert.equal(Core.deviceTokenState({ error: "authorization_pending" }), "pending");
  assert.equal(Core.deviceTokenState({ error: "slow_down" }), "pending");
  assert.equal(Core.deviceTokenState({ error: "expired_token" }), "error");
  assert.equal(Core.deviceTokenState(null), "error");
});

test("pollIntervalMs uses the server interval when present", () => {
  assert.equal(Core.pollIntervalMs({ interval: 5 }), 5000);
  assert.equal(Core.pollIntervalMs({}, 3000), 3000);
  assert.equal(Core.pollIntervalMs(null), 5000);
});
