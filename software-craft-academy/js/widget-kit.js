/* =====================================================================
   CHISEL · Widget kit
   Shared DOM helpers and two reusable lab shapes used by the track files:
     - lineSpotter: click the suspicious lines of a code listing
     - choiceDrill: classify a set of scenarios, one choice each
   Loaded before every track file. Exposes window.ChiselKit.
   Only literal strings authored in this repo are ever rendered, and they are
   rendered through textContent, never innerHTML.
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
      if (v == null) continue;
      if (k === "class") el.className = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
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
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function btn(label, onClick, kind) {
    var b = h("button", { type: "button", class: "w-btn" + (kind ? " " + kind : "") }, label);
    b.addEventListener("click", onClick);
    return b;
  }
  function toggle(label, on, onChange) {
    var state = !!on;
    var b = h("button", { type: "button", class: "w-btn" + (state ? " primary" : " ghost"), "aria-pressed": state ? "true" : "false" }, label);
    b.addEventListener("click", function () {
      state = !state;
      b.className = "w-btn" + (state ? " primary" : " ghost");
      b.setAttribute("aria-pressed", state ? "true" : "false");
      onChange(state);
    });
    return b;
  }
  function para(text, extra) {
    return h("p", { style: "margin:0;font-size:0.86rem;line-height:1.55;color:var(--text)" + (extra || "") }, text);
  }
  function mono(text) {
    return h("pre", { style: "margin:0;white-space:pre-wrap;font-family:var(--font-mono);font-size:0.78rem;line-height:1.5;color:var(--text);background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:12px" }, text);
  }
  var GOOD_BG = "rgba(52,211,153,0.16)";
  var BAD_BG = "rgba(251,113,133,0.16)";
  var MEH_BG = "rgba(251,191,36,0.16)";
  function badge(text, tone) {
    var bg = tone === "good" ? GOOD_BG : tone === "bad" ? BAD_BG : MEH_BG;
    return h("span", { style: "display:inline-block;padding:2px 8px;border-radius:6px;font-family:var(--font-mono);font-size:0.72rem;color:var(--text);background:" + bg + ";border:1px solid var(--line)" }, text);
  }

  /* ------------------------------------------------------------------
     lineSpotter(mount, cfg)
     cfg = { pill, title, desc, snippets: [{ id, label, intro?, lines: [{ code, issue?, why }] }] }
     A line with `issue` is a real problem; one without is clean.
     ------------------------------------------------------------------ */
  function lineSpotter(mount, cfg) {
    shell(mount, cfg.pill || "spot it", cfg.title, cfg.desc);
    var snippets = cfg.snippets || [];
    var current = 0;
    var flagged = {};
    var revealed = false;
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var feedback = h("div", { style: "margin-top:12px;display:grid;gap:6px" });
    var readout = h("div", { class: "w-readout" });

    if (snippets.length > 1) {
      controls.appendChild(segment(snippets.map(function (s, i) { return [i, s.label]; }), 0, function (i) {
        current = i; flagged = {}; revealed = false; paint();
      }));
    }
    controls.appendChild(btn("Reveal all", function () { revealed = true; paint(); }, "ghost"));
    controls.appendChild(btn("Reset", function () { flagged = {}; revealed = false; paint(); }, "ghost"));

    function paint() {
      var snip = snippets[current] || { lines: [] };
      clear(stage);
      clear(feedback);
      clear(readout);
      if (snip.intro) stage.appendChild(para(snip.intro, ";margin-bottom:10px;color:var(--text-dim)"));
      var list = h("div", { style: "display:grid;gap:3px" });
      var total = 0, found = 0, wrong = 0;
      snip.lines.forEach(function (line, idx) {
        if (line.issue) total++;
        var isFlag = !!flagged[idx];
        if (isFlag && line.issue) found++;
        if (isFlag && !line.issue) wrong++;
        var show = isFlag || (revealed && line.issue);
        var bg = "var(--surface-2)";
        if (show) bg = line.issue ? (isFlag ? GOOD_BG : MEH_BG) : BAD_BG;
        var b = h("button", {
          type: "button",
          "aria-pressed": isFlag ? "true" : "false",
          style: "display:flex;gap:10px;width:100%;text-align:left;padding:4px 10px;border-radius:6px;border:1px solid var(--line);background:" + bg + ";color:var(--text);font-family:var(--font-mono);font-size:0.78rem;line-height:1.45;white-space:pre;overflow-x:auto;cursor:pointer"
        }, h("span", { style: "color:var(--text-dim);min-width:1.6em;text-align:right" }, String(idx + 1)), h("span", {}, line.code || " "));
        b.addEventListener("click", function () { flagged[idx] = !flagged[idx]; paint(); });
        list.appendChild(b);
        if (show) {
          feedback.appendChild(h("div", { style: "font-size:0.84rem;line-height:1.5;color:var(--text);padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:" + (line.issue ? (isFlag ? GOOD_BG : MEH_BG) : BAD_BG) },
            h("strong", {}, "Line " + (idx + 1) + " \u2014 " + (line.issue ? line.issue : "fine as written") + ". "),
            line.why || ""));
        }
      });
      stage.appendChild(list);
      readout.appendChild(ro("found", found + " / " + total));
      readout.appendChild(ro("false alarms", wrong));
      readout.appendChild(ro("verdict", found === total && !wrong ? "clean sweep" : revealed ? "answers shown" : "keep looking"));
    }
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(feedback);
    mount.appendChild(readout);
    paint();
  }

  /* ------------------------------------------------------------------
     choiceDrill(mount, cfg)
     cfg = { pill, title, desc, choices?: [labels], items: [{ prompt, code?, options?, answer, why }] }
     `options` overrides the shared `choices` for one item. `answer` is an index.
     ------------------------------------------------------------------ */
  function choiceDrill(mount, cfg) {
    shell(mount, cfg.pill || "drill", cfg.title, cfg.desc);
    var picks = {};
    var stage = h("div", { class: "w-stage", style: "display:grid;gap:14px" });
    var readout = h("div", { class: "w-readout" });
    var controls = h("div", { class: "widget-controls" });
    controls.appendChild(btn("Reset", function () { picks = {}; paint(); }, "ghost"));

    function paint() {
      clear(stage);
      clear(readout);
      var right = 0, answered = 0;
      cfg.items.forEach(function (item, idx) {
        var opts = item.options || cfg.choices || [];
        var card = h("div", { style: "display:grid;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--line)" });
        card.appendChild(h("div", { style: "font-size:0.88rem;line-height:1.5;color:var(--text)" }, h("strong", {}, (idx + 1) + ". "), item.prompt));
        if (item.code) card.appendChild(mono(item.code));
        var row = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px" });
        var picked = picks[idx];
        opts.forEach(function (label, oi) {
          var cls = "w-btn";
          var style = "";
          if (picked != null) {
            if (oi === item.answer) style = "background:" + GOOD_BG + ";color:var(--text)";
            else if (oi === picked) style = "background:" + BAD_BG + ";color:var(--text)";
            else cls += " ghost";
          } else cls += " ghost";
          var b = h("button", { type: "button", class: cls, style: style || null }, label);
          b.addEventListener("click", function () { if (picks[idx] == null) { picks[idx] = oi; paint(); } });
          row.appendChild(b);
        });
        card.appendChild(row);
        if (picked != null) {
          answered++;
          if (picked === item.answer) right++;
          card.appendChild(h("div", { style: "font-size:0.84rem;line-height:1.5;color:var(--text-dim)" },
            h("strong", { style: "color:var(--text)" }, picked === item.answer ? "Right. " : "Not quite \u2014 " + opts[item.answer] + ". "), item.why || ""));
        }
        stage.appendChild(card);
      });
      readout.appendChild(ro("answered", answered + " / " + cfg.items.length));
      readout.appendChild(ro("correct", right));
      readout.appendChild(ro("score", answered ? Math.round((right / answered) * 100) + "%" : "\u2014"));
    }
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  }

  window.ChiselKit = {
    h: h, svg: svg, clear: clear, shell: shell, segment: segment, ro: ro, btn: btn, toggle: toggle,
    para: para, mono: mono, badge: badge, lineSpotter: lineSpotter, choiceDrill: choiceDrill,
    GOOD_BG: GOOD_BG, BAD_BG: BAD_BG, MEH_BG: MEH_BG
  };
})();
