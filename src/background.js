// StretchText background service worker.
// Holds no state of its own: the reader's key lives in chrome.storage.local
// and every model call is made with that key, so readers pay with their
// own Pollen.
importScripts("lib.js");

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg || msg.type !== "stretchtext:expand") return false;

  chrome.storage.local.get(["apiKey", "model"], function (cfg) {
    if (!cfg.apiKey) {
      sendResponse({
        ok: false,
        error: "no-key",
        message: "No Pollinations key yet. Open the StretchText options and connect your Pollen.",
      });
      return;
    }
    var req = StretchCore.buildChatRequest(msg.text, msg.depth, cfg.model);
    fetch(req.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.apiKey,
      },
      body: JSON.stringify(req.body),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Pollinations API returned " + res.status);
        return res.json();
      })
      .then(function (json) {
        var text = StretchCore.parseChatResponse(json);
        if (!text) throw new Error("Empty response from the model.");
        sendResponse({ ok: true, text: text });
      })
      .catch(function (err) {
        sendResponse({ ok: false, error: "api", message: String(err && err.message || err) });
      });
  });

  return true; // async sendResponse
});
