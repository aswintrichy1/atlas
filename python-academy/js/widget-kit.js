/* =====================================================================
   PYXIS · Widget kit
   Shared DOM helpers for the track files. Loaded before every track-*.js
   (index.html order, and the content validator sorts widget-kit first).
   Exposes window.PyxisKit; registers no content of its own.
   ===================================================================== */
(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function svg(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    attrs = attrs || {};
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, attrs[k]);
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }
  /* A .w-seg group. `pairs` is [[value, label], ...]; onPick gets the value. */
  function segment(pairs, initialIdx, onPick) {
    var seg = h("div", { class: "w-seg" });
    var btns = [];
    pairs.forEach(function (pair, idx) {
      var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        onPick(pair[0]);
      });
      btns.push(b);
      seg.appendChild(b);
    });
    return seg;
  }
  function btn(label, cls, onClick) {
    var b = h("button", { type: "button", class: "w-btn" + (cls ? " " + cls : "") }, label);
    b.addEventListener("click", onClick);
    return b;
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function wide(text, color) {
    return h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" + (color ? ";color:" + color : "") }, text);
  }
  function labeled(label, control) {
    return h("label", { class: "w-field", style: "display:inline-flex;gap:8px;align-items:center;font-size:0.82rem" }, h("span", {}, label), control);
  }
  function range(min, max, step, value, onInput) {
    var r = h("input", { type: "range", min: min, max: max, step: step, value: value });
    r.addEventListener("input", function () { onInput(parseFloat(r.value)); });
    return r;
  }
  function J(lines) { return lines.join("\n"); }
  function fmt(n, digits) {
    if (!isFinite(n)) return "\u221e";
    var d = digits == null ? 0 : digits;
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  /* Lesson block builders: each returns one block object from the engine's
     block grammar, so track files read as prose rather than object literals. */
  var B = {
    p: function (html) { return { t: "p", html: html }; },
    h: function (text) { return { t: "h", text: text }; },
    h2: function (text) { return { t: "h2", text: text }; },
    ul: function (items) { return { t: "ul", items: items }; },
    ol: function (items) { return { t: "ol", items: items }; },
    code: function (lang, lines) { return { t: "code", lang: lang, code: Array.isArray(lines) ? lines.join("\n") : lines }; },
    tip: function (html) { return { t: "note", variant: "tip", html: html }; },
    warn: function (html) { return { t: "note", variant: "warn", html: html }; },
    trap: function (html) { return { t: "note", variant: "trap", html: html }; },
    key: function (html) { return { t: "note", variant: "key", html: html }; },
    table: function (headers, rows) { return { t: "table", headers: headers, rows: rows }; },
    cmp: function (badTitle, badItems, goodTitle, goodItems) { return { t: "compare", bad: { title: badTitle, items: badItems }, good: { title: goodTitle, items: goodItems } }; },
    stat: function (pairs) { return { t: "stat", items: pairs.map(function (x) { return { v: x[0], k: x[1] }; }) }; },
    cue: function (html) { return { t: "cue", html: html }; },
    widget: function (id) { return { t: "widget", id: id }; },
    quiz: function (id) { return { t: "quiz", id: id }; },
    diagram: function (id, caption) { return { t: "diagram", id: id, caption: caption }; }
  };
  /* lesson(id, title, summary, minutes, tags, blocks) */
  function lesson(id, title, summary, minutes, tags, blocks) {
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: blocks };
  }

  window.PyxisKit = { h: h, svg: svg, clear: clear, shell: shell, segment: segment, btn: btn, ro: ro, wide: wide, labeled: labeled, range: range, J: J, fmt: fmt, B: B, lesson: lesson };
})();
