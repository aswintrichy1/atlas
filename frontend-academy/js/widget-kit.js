/* =====================================================================
   PIXEL · Widget kit
   Shared DOM helpers for every track file's widgets: window.WK.
   Loaded before the track files (index.html order and the validator both
   put widget-kit first).
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
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    append(el, kids);
    return el;
  }
  function append(el, kids) {
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null || kid === false) continue;
      if (Array.isArray(kid)) { append(el, kid); continue; }
      el.appendChild(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
    }
  }
  function svg(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    var kids = Array.prototype.slice.call(arguments, 2);
    for (var i = 0; i < kids.length; i++) {
      if (kids[i] == null) continue;
      el.appendChild(typeof kids[i] === "object" ? kids[i] : document.createTextNode(String(kids[i])));
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }

  /* Segmented control. pairs = [[value, label], ...] */
  function segment(pairs, initialIdx, onPick, label) {
    var seg = h("div", { class: "w-seg", role: "group", "aria-label": label || null });
    var btns = [];
    pairs.forEach(function (pair, idx) {
      var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : ""), "aria-pressed": idx === initialIdx ? "true" : "false" }, pair[1]);
      b.addEventListener("click", function () {
        btns.forEach(function (o) { o.classList.remove("active"); o.setAttribute("aria-pressed", "false"); });
        b.classList.add("active");
        b.setAttribute("aria-pressed", "true");
        onPick(pair[0], idx);
      });
      btns.push(b);
      seg.appendChild(b);
    });
    return seg;
  }

  /* Labelled field wrapping a control: field("Label", selectEl) */
  function field(label, control) { return h("label", { class: "w-field" }, label, control); }

  function select(options, initial, onChange, label) {
    var s = h("select", { "aria-label": label || null });
    options.forEach(function (o) {
      var opt = h("option", { value: o[0] }, o[1]);
      if (o[0] === initial) opt.selected = true;
      s.appendChild(opt);
    });
    s.addEventListener("change", function () { onChange(s.value); });
    return s;
  }

  /* Toggle button with aria-pressed */
  function toggle(label, initial, onChange) {
    var on = !!initial;
    var b = h("button", { type: "button", class: "w-btn" + (on ? " primary" : ""), "aria-pressed": on ? "true" : "false" }, label);
    b.addEventListener("click", function () {
      on = !on;
      b.classList.toggle("primary", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      onChange(on);
    });
    return b;
  }

  function btn(label, onClick, cls) {
    var b = h("button", { type: "button", class: "w-btn" + (cls ? " " + cls : "") }, label);
    b.addEventListener("click", onClick);
    return b;
  }

  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function readout(el, pairs) {
    clear(el);
    pairs.forEach(function (p) { el.appendChild(ro(p[0], p[1])); });
  }

  /* Tinted chip/box: text stays on the theme text colour so both themes read. */
  function tint(hex, pct) {
    return "background:color-mix(in srgb, " + hex + " " + (pct || 18) + "%, transparent);border:1px solid " + hex + ";color:var(--text);";
  }

  function badge(text, hex) {
    return h("span", { style: tint(hex, 20) + "border-radius:999px;padding:2px 10px;font-family:var(--font-mono);font-size:0.74rem;font-weight:600;white-space:nowrap;" }, text);
  }

  var GOOD = "#22c55e", MID = "#f59e0b", BAD = "#ef4444";

  window.WK = {
    h: h, svg: svg, clear: clear, shell: shell, segment: segment, field: field, select: select,
    toggle: toggle, btn: btn, ro: ro, readout: readout, tint: tint, badge: badge,
    GOOD: GOOD, MID: MID, BAD: BAD
  };
})();
