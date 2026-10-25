// StretchText options: BYOP device flow + manual key fallback.
// Both routes end at the same place: the reader's own key in
// chrome.storage.local, used by the background worker for every call.
(function () {
  "use strict";
  var Core = window.StretchCore;
  var deviceStatus = document.getElementById("deviceStatus");
  var keyStatus = document.getElementById("keyStatus");
  var pollTimer = null;

  function setStatus(el, text) { el.textContent = text; }

  function refresh() {
    chrome.storage.local.get(["apiKey", "appKey", "model"], function (cfg) {
      if (cfg.appKey) document.getElementById("appKey").value = cfg.appKey;
      if (cfg.model) document.getElementById("model").value = cfg.model;
      if (cfg.apiKey) {
        setStatus(deviceStatus, "Connected. A key is saved on this machine.");
        setStatus(keyStatus, "A key is saved.");
      } else {
        setStatus(deviceStatus, "Not connected.");
        setStatus(keyStatus, "No key saved.");
      }
    });
  }

  function postJson(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (res) { return res.json(); });
  }

  function poll(deviceCode, intervalMs, expiresAt) {
    var req = Core.buildDeviceTokenRequest(deviceCode);
    postJson(req.url, req.body).then(function (json) {
      var state = Core.deviceTokenState(json);
      if (state === "done") {
        chrome.storage.local.set({ apiKey: json.access_token }, function () {
          setStatus(deviceStatus, "Connected. Your Pollen key is saved on this machine only.");
          refresh();
        });
        return;
      }
      if (state === "pending" && Date.now() < expiresAt) {
        pollTimer = setTimeout(function () {
          poll(deviceCode, Core.pollIntervalMs(json, intervalMs), expiresAt);
        }, intervalMs);
        return;
      }
      setStatus(deviceStatus, "Sign-in did not complete. Start again, or paste a key below.");
    }).catch(function (err) {
      setStatus(deviceStatus, "Network error while waiting for approval: " + err.message);
    });
  }

  document.getElementById("deviceStart").addEventListener("click", function () {
    var appKey = document.getElementById("appKey").value.trim();
    if (appKey) chrome.storage.local.set({ appKey: appKey });
    if (pollTimer) clearTimeout(pollTimer);
    setStatus(deviceStatus, "Requesting a sign-in code…");
    var req = Core.buildDeviceCodeRequest(appKey || undefined);
    postJson(req.url, req.body).then(function (json) {
      if (!json.device_code) {
        setStatus(deviceStatus, "Could not start sign-in: " + JSON.stringify(json));
        return;
      }
      var link = json.verification_uri_complete || json.verification_uri;
      deviceStatus.innerHTML =
        "Open <a href=\"" + link + "\" target=\"_blank\" rel=\"noreferrer\">" + link + "</a>" +
        " and confirm this code: <span class=\"code\">" + (json.user_code || "") + "</span>" +
        "\nWaiting for approval…";
      var interval = Core.pollIntervalMs(json, 5000);
      var expiresAt = Date.now() + (Number(json.expires_in) || 1800) * 1000;
      pollTimer = setTimeout(function () { poll(json.device_code, interval, expiresAt); }, interval);
    }).catch(function (err) {
      setStatus(deviceStatus, "Network error: " + err.message);
    });
  });

  document.getElementById("saveKey").addEventListener("click", function () {
    var key = document.getElementById("apiKey").value.trim();
    if (!key) { setStatus(keyStatus, "Paste a key first."); return; }
    chrome.storage.local.set({ apiKey: key }, function () {
      document.getElementById("apiKey").value = "";
      setStatus(keyStatus, "Key saved in chrome.storage.local.");
      refresh();
    });
  });

  document.getElementById("clearKey").addEventListener("click", function () {
    chrome.storage.local.remove(["apiKey"], function () {
      setStatus(keyStatus, "Key removed.");
      refresh();
    });
  });

  document.getElementById("saveModel").addEventListener("click", function () {
    var model = document.getElementById("model").value.trim() || Core.DEFAULT_MODEL;
    chrome.storage.local.set({ model: model }, function () {
      setStatus(keyStatus, "Model saved: " + model);
    });
  });

  refresh();
})();
