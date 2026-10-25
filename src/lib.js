// StretchText core logic. Pure functions, shared by the content script,
// the options page, and the Node test suite.
(function (global) {
  "use strict";

  var MAX_DEPTH = 2;
  var MIN_PASSAGE_CHARS = 120;
  var MAX_PASSAGE_CHARS = 2000;
  var API_BASE = "https://gen.pollinations.ai";
  var AUTH_BASE = "https://enter.pollinations.ai";
  var DEFAULT_MODEL = "openai";

  // Split a passage into sentences, keeping terminal punctuation attached.
  function splitSentences(text) {
    if (!text) return [];
    var cleaned = String(text).replace(/\s+/g, " ").trim();
    if (!cleaned) return [];
    var parts = cleaned.match(/[^.!?…]+[.!?…]+["'”’)\]]*|\S[^.!?…]*$/g);
    if (!parts) return [cleaned];
    return parts.map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function isExpandableText(text) {
    if (!text) return false;
    var t = String(text).replace(/\s+/g, " ").trim();
    if (t.length < MIN_PASSAGE_CHARS || t.length > MAX_PASSAGE_CHARS) return false;
    // Needs at least two sentence-like chunks to be worth stretching.
    return splitSentences(t).length >= 2;
  }

  function clampDepth(depth, maxDepth) {
    var max = typeof maxDepth === "number" ? maxDepth : MAX_DEPTH;
    var d = parseInt(depth, 10);
    if (isNaN(d) || d < 1) return 1;
    return Math.min(d, max);
  }

  function cacheKey(passage, depth, model) {
    var text = String(passage || "").replace(/\s+/g, " ").trim();
    var h = 0;
    for (var i = 0; i < text.length; i++) {
      h = ((h << 5) - h + text.charCodeAt(i)) | 0;
    }
    return (model || DEFAULT_MODEL) + ":" + clampDepth(depth) + ":" + h + ":" + text.length;
  }

  // Build the chat messages for one expansion request.
  // depth 1 expands the original passage; depth 2 expands an expansion.
  function buildExpandMessages(passage, depth) {
    var d = clampDepth(depth);
    var system =
      "You expand a passage of text in the stretchtext style: the reader asked " +
      "for more detail exactly here, so continue and deepen this passage. " +
      "Write plain prose only, no headings, no lists, no preamble, no quotes " +
      "around the result. Keep the same language, tense, and voice as the " +
      "passage. Add concrete detail, examples, and explanation; do not repeat " +
      "the passage itself and do not summarise it. Aim for roughly " +
      (d === 1 ? "the same length again" : "half the length again") + ".";
    var user =
      (d === 1
        ? "Expand this passage:\n\n"
        : "Expand this already-expanded passage one level deeper:\n\n") +
      String(passage || "");
    return [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
  }

  function buildChatRequest(passage, depth, model) {
    return {
      url: API_BASE + "/v1/chat/completions",
      body: {
        model: model || DEFAULT_MODEL,
        messages: buildExpandMessages(passage, depth),
      },
    };
  }

  // Tidy raw model output before it is inserted into the page.
  function cleanModelText(text) {
    if (!text) return "";
    var t = String(text).trim();
    t = t.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
    t = t.replace(/^["“](.*)["”]$/s, "$1");
    return t.replace(/\s+/g, " ").trim();
  }

  function parseChatResponse(json) {
    if (!json || !json.choices || !json.choices[0] || !json.choices[0].message) {
      return "";
    }
    return cleanModelText(json.choices[0].message.content || "");
  }

  // --- BYOP device flow (see BRING_YOUR_OWN_POLLEN.md, CLIs & Headless) ---

  function buildDeviceCodeRequest(appKey) {
    var body = {};
    if (appKey) body.client_id = appKey;
    return { url: AUTH_BASE + "/api/device/code", body: body };
  }

  function buildDeviceTokenRequest(deviceCode) {
    return {
      url: AUTH_BASE + "/api/device/token",
      body: { device_code: deviceCode },
    };
  }

  // Returns "done", "pending", or "error" for a device token response.
  function deviceTokenState(json) {
    if (!json) return "error";
    if (json.access_token) return "done";
    if (json.error === "authorization_pending" || json.error === "slow_down") {
      return "pending";
    }
    return "error";
  }

  function pollIntervalMs(json, fallback) {
    var seconds = json && json.interval ? Number(json.interval) : NaN;
    if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
    return fallback || 5000;
  }

  var api = {
    MAX_DEPTH: MAX_DEPTH,
    MIN_PASSAGE_CHARS: MIN_PASSAGE_CHARS,
    MAX_PASSAGE_CHARS: MAX_PASSAGE_CHARS,
    API_BASE: API_BASE,
    AUTH_BASE: AUTH_BASE,
    DEFAULT_MODEL: DEFAULT_MODEL,
    splitSentences: splitSentences,
    isExpandableText: isExpandableText,
    clampDepth: clampDepth,
    cacheKey: cacheKey,
    buildExpandMessages: buildExpandMessages,
    buildChatRequest: buildChatRequest,
    cleanModelText: cleanModelText,
    parseChatResponse: parseChatResponse,
    buildDeviceCodeRequest: buildDeviceCodeRequest,
    buildDeviceTokenRequest: buildDeviceTokenRequest,
    deviceTokenState: deviceTokenState,
    pollIntervalMs: pollIntervalMs,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  global.StretchCore = api;
})(typeof window !== "undefined" ? window : globalThis);
