// StretchText content script.
// Adds a small expand control to article paragraphs. Clicking it asks the
// background worker to expand the passage with a Pollinations text model,
// inserts the result inline as tinted "grown" text, and clicking again
// collapses back to the untouched original.
//
// Safety rules: original page nodes are never modified or moved. Expansions
// and buttons are only appended, and collapse removes exactly what was
// appended, so the page returns to its exact prior state. Editable fields,
// code, and scripts are never touched.
(function () {
  "use strict";
  if (window.__stretchtextLoaded) return;
  window.__stretchtextLoaded = true;

  var Core = window.StretchCore;
  if (!Core) return;

  var SKIP_SELECTOR = "script, style, pre, code, textarea, input, [contenteditable], .st-grown";
  var cache = {};

  function sendMessage(msg) {
    return new Promise(function (resolve) {
      try {
        var maybePromise = chrome.runtime.sendMessage(msg, function (res) {
          resolve(res || { ok: false, message: "No response from background." });
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(resolve, function () {
            resolve({ ok: false, message: "Background unavailable." });
          });
        }
      } catch (e) {
        resolve({ ok: false, message: String(e) });
      }
    });
  }

  function plainText(el) {
    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function isCandidate(el) {
    if (el.dataset.stretchtext) return false;
    if (el.closest(SKIP_SELECTOR)) return false;
    if (el.querySelector("input, textarea, select, [contenteditable]")) return false;
    if (window.getComputedStyle) {
      var style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return Core.isExpandableText(plainText(el));
  }

  function makeButton(label) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "st-btn";
    btn.textContent = label;
    return btn;
  }

  function showError(host, message) {
    var err = document.createElement("span");
    err.className = "st-error";
    err.textContent = message;
    host.appendChild(err);
    setTimeout(function () { err.remove(); }, 6000);
  }

  // Expand `sourceText` at `depth`, appending the grown span and its own
  // controls to `host`. Returns the state object tracked on the host.
  function expandInto(host, sourceText, depth, state) {
    var key = Core.cacheKey(sourceText, depth);
    var btn = state.buttons[depth];
    btn.disabled = true;
    btn.textContent = "growing…";

    function finish(text) {
      btn.disabled = false;
      btn.textContent = "shrink";
      var grown = document.createElement("span");
      grown.className = "st-grown";
      grown.dataset.depth = String(depth);
      grown.appendChild(document.createTextNode(" " + text + " "));
      host.appendChild(grown);
      state.grown[depth] = grown;
      state.expanded[depth] = true;

      if (depth < Core.MAX_DEPTH) {
        var deeper = makeButton("stretch more");
        deeper.classList.add("st-visible");
        deeper.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (state.expanded[depth + 1]) {
            collapseLevel(host, state, depth + 1);
            deeper.textContent = "stretch more";
          } else {
            state.buttons[depth + 1] = deeper;
            expandInto(grown, text, depth + 1, state);
          }
        });
        grown.appendChild(deeper);
        state.buttons[depth + 1] = deeper;
      }
    }

    if (cache[key]) {
      finish(cache[key]);
      return;
    }
    sendMessage({ type: "stretchtext:expand", text: sourceText, depth: depth }).then(function (res) {
      if (!res || !res.ok) {
        btn.disabled = false;
        btn.textContent = depth === 1 ? "+ stretch" : "stretch more";
        showError(host, (res && res.message) || "Expansion failed.");
        return;
      }
      cache[key] = res.text;
      finish(res.text);
    });
  }

  function collapseLevel(host, state, depth) {
    if (state.grown[depth]) {
      state.grown[depth].remove();
      delete state.grown[depth];
    }
    state.expanded[depth] = false;
    // Collapsing a level also collapses anything grown from it.
    if (depth === 1 && state.grown[2]) {
      state.grown[2].remove();
      delete state.grown[2];
      state.expanded[2] = false;
    }
  }

  function attach(paragraph) {
    paragraph.dataset.stretchtext = "1";
    var state = { grown: {}, expanded: {}, buttons: {} };
    var btn = makeButton("+ stretch");
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (state.expanded[1]) {
        collapseLevel(paragraph, state, 1);
        btn.textContent = "+ stretch";
      } else {
        state.buttons[1] = btn;
        expandInto(paragraph, plainText(paragraph), 1, state);
      }
    });
    state.buttons[1] = btn;
    paragraph.appendChild(btn);
  }

  function scan() {
    var nodes = document.querySelectorAll("p, li, blockquote");
    for (var i = 0; i < nodes.length; i++) {
      if (isCandidate(nodes[i])) attach(nodes[i]);
    }
  }

  chrome.storage.local.get(["enabled"], function (cfg) {
    if (cfg.enabled === false) return;
    scan();
    var pending = null;
    var observer = new MutationObserver(function () {
      if (pending) return;
      pending = setTimeout(function () { pending = null; scan(); }, 800);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
