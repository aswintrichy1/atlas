/* =====================================================================
   CASCADE · Shared widget kit
   Exposes the DOM/SVG helpers every track file uses to build its
   interactive widgets, so each track file stays self-contained while
   reusing the same styling primitives as the rest of the app.
   window.WK = { h, svgEl, shell, hashStr }
   ===================================================================== */
(function () {
  "use strict";

  // h(tag, attrs, ...children) -> HTMLElement
  //   class -> className · html -> innerHTML · on<Event> -> listener · else attribute
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) {
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  };

  // svgEl(tag, attrs) -> SVGElement (namespaced)
  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  // shell(mount, pill, title, desc) -> mount  (adds the widget header chrome)
  const shell = (mount, pill, title, desc) => {
    mount.classList.add("widget");
    mount.appendChild(
      h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title))
    );
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  };

  // tiny deterministic string hash -> 0..(mod-1)
  const hashStr = (str, mod, seed = 0) => {
    let hsh = 2166136261 ^ seed;
    for (let i = 0; i < str.length; i++) {
      hsh ^= str.charCodeAt(i);
      hsh = Math.imul(hsh, 16777619);
    }
    return (hsh >>> 0) % mod;
  };

  window.WK = { h, svgEl, shell, hashStr };
})();
