(function () {
  "use strict";
  var status = document.getElementById("status");
  var enabled = document.getElementById("enabled");

  function refresh() {
    chrome.storage.local.get(["apiKey", "enabled"], function (cfg) {
      status.textContent = cfg.apiKey
        ? "Connected. Expansions bill your own Pollen."
        : "Not connected. Open options to connect your Pollen.";
      enabled.checked = cfg.enabled !== false;
    });
  }
  enabled.addEventListener("change", function () {
    chrome.storage.local.set({ enabled: enabled.checked }, refresh);
  });
  document.getElementById("openOptions").addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
  refresh();
})();
