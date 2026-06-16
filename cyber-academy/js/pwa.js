/* Citadel — installable-PWA support (progressive enhancement).
 *
 * Self-contained, additive module: when the browser offers installation it
 * reveals an "Install app" button in the topbar that drives the native
 * install prompt. It does NOT modify any existing app code or markup.
 *
 * Design goals:
 *   - Fully offline. No external requests, ever.
 *   - Degrade silently where the install APIs are missing (Safari/Firefox):
 *     every browser-specific call is feature-detected and wrapped in try/catch.
 *   - Never show the button when already running as an installed app.
 *   - No layout shift: the button is display:none until revealed via a class.
 */
(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  var SVG_NS = "http://www.w3.org/2000/svg";

  var deferredPrompt = null; // stashed `beforeinstallprompt` event
  var installBtn = null;     // our button, once built + inserted

  /* ---------- environment checks ---------- */

  // True when Citadel is already running as an installed / standalone app.
  function isStandalone() {
    try {
      if (window.matchMedia &&
          window.matchMedia("(display-mode: standalone)").matches) return true;
      // iOS Safari exposes installation state via navigator.standalone.
      if (window.navigator && window.navigator.standalone === true) return true;
    } catch (e) { /* matchMedia unsupported — treat as not standalone */ }
    return false;
  }

  /* ---------- DOM helpers ---------- */

  function svgEl(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    for (var key in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, key)) {
        node.setAttribute(key, attrs[key]);
      }
    }
    return node;
  }

  // Build the install button. It reuses the existing `.icon-btn` styling so it
  // sits naturally beside the command-palette and theme-toggle buttons.
  function buildButton() {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "installBtn";
    btn.className = "icon-btn cy-install-btn";
    btn.title = "Install Citadel as an app";
    btn.setAttribute("aria-label", "Install app");

    // Inline "install" glyph (a download arrow dropping into a tray). Built as
    // SVG DOM nodes — no innerHTML — and stroked by the existing .icon-btn svg
    // rules, so it inherits theme-aware colours automatically.
    var svg = svgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
    svg.appendChild(svgEl("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }));
    svg.appendChild(svgEl("path", { d: "M7 10l5 5 5-5" }));
    svg.appendChild(svgEl("path", { d: "M12 3v12" }));
    btn.appendChild(svg);

    // Visually-hidden text label for assistive technology.
    var label = document.createElement("span");
    label.className = "visually-hidden";
    label.textContent = "Install app";
    btn.appendChild(label);

    btn.addEventListener("click", onInstallClick);
    return btn;
  }

  // Insert the button into `.topbar-actions`, before the command-palette button
  // if present, otherwise appended. Returns the button, or null if no topbar.
  function ensureButton(actions) {
    if (installBtn) return installBtn;
    installBtn = buildButton();
    var cmdk = actions.querySelector("#cmdkBtn");
    if (cmdk) {
      actions.insertBefore(installBtn, cmdk);
    } else {
      actions.appendChild(installBtn);
    }
    return installBtn;
  }

  function showButton() {
    if (isStandalone()) return; // already installed — no affordance needed
    var actions = document.querySelector(".topbar-actions");
    if (!actions) {
      // Topbar not parsed yet — retry once the DOM is ready, then give up.
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", showButton, { once: true });
      }
      return;
    }
    var btn = ensureButton(actions);
    if (btn) btn.classList.add("show");
  }

  function hideButton() {
    if (installBtn) installBtn.classList.remove("show");
  }

  // Best-effort, dependency-free confirmation. Reuses the app's existing
  // #toast element + .show class if present; otherwise logs. Never throws.
  function confirmInstalled() {
    try {
      var t = document.getElementById("toast");
      if (t && t.classList) {
        while (t.firstChild) t.removeChild(t.firstChild);
        t.appendChild(document.createTextNode(
          "Citadel installed — launch it any time, fully offline."));
        t.classList.add("show");
        setTimeout(function () { t.classList.remove("show"); }, 2400);
        return;
      }
    } catch (e) { /* confirmation is non-essential — ignore */ }
    try { if (window.console && console.info) console.info("Citadel installed."); }
    catch (e2) { /* ignore */ }
  }

  /* ---------- event handlers ---------- */

  function onInstallClick() {
    var evt = deferredPrompt;
    if (!evt || typeof evt.prompt !== "function") { hideButton(); return; }
    deferredPrompt = null; // a saved prompt may only be used once

    try {
      evt.prompt();
      if (evt.userChoice && typeof evt.userChoice.then === "function") {
        evt.userChoice.then(function () { hideButton(); },
                            function () { hideButton(); });
      } else {
        hideButton();
      }
    } catch (e) {
      hideButton();
    }
  }

  function onBeforeInstallPrompt(e) {
    try {
      e.preventDefault();  // suppress the browser's mini-infobar; we drive the UI
      deferredPrompt = e;  // stash for the button's click handler
      showButton();
    } catch (err) { /* never break the page over an install affordance */ }
  }

  function onAppInstalled() {
    deferredPrompt = null;
    hideButton();
    confirmInstalled();
  }

  /* ---------- init ---------- */

  // Register listeners immediately (not on DOMContentLoaded): the
  // `beforeinstallprompt` event can fire before the DOM is fully ready, and we
  // must not miss it. Button insertion itself waits for the DOM (see showButton).
  if (!isStandalone()) {
    try {
      window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.addEventListener("appinstalled", onAppInstalled);
    } catch (e) { /* addEventListener should always exist; guard regardless */ }
  }
})();
