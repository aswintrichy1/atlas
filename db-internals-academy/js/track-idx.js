/* =====================================================================
   LEDGER · Indexing
   window.TRACKS.idx — modules: basics / beyond / design

   Self-contained: this file registers its own widgets (idxComposite,
   idxBloom), its own quizzes (idx-basics, idx-beyond, idx-design) and
   its own track data. Nothing else needs editing to load it.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
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
    for (var i = 0; i < pairs.length; i++) {
      (function (pair, idx) {
        var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
        b.addEventListener("click", function () {
          for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
          b.classList.add("active");
          onPick(pair[0]);
        });
        btns.push(b);
        seg.appendChild(b);
      })(pairs[i], i);
    }
    return seg;
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function fmt(n) {
    if (!isFinite(n)) return "0";
    var s = String(Math.round(n));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }
  function pct(x, digits) {
    if (!isFinite(x)) return "0%";
    return (x * 100).toFixed(digits == null ? 2 : digits) + "%";
  }

  var Widgets = {};

  /* ==================================================================
     1. idxComposite — composite index column order vs a query
     Table: orders, 10,000,000 rows. tenant_id has ~1,000 values,
     status ~5 values, a created_at range picks ~10% of rows.
  ================================================================== */
  var IC_N = 10000000;
  var IC_COL = { t: "tenant_id", s: "status", c: "created_at" };
  var IC_SEL = { t: 1 / 1000, s: 1 / 5, c: 0.1 };
  var IC_ORDERS = [
    ["t", "s", "c"], ["t", "c", "s"], ["s", "t", "c"],
    ["s", "c", "t"], ["c", "t", "s"], ["c", "s", "t"]
  ];
  var IC_QUERIES = [
    { sql: "SELECT created_at, amount FROM orders WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50",
      pred: { t: "eq", s: "eq" }, order: "c", limit: 50, select: ["c", "amount"] },
    { sql: "SELECT status, created_at FROM orders WHERE tenant_id = ? AND created_at >= now() - interval '30 days'",
      pred: { t: "eq", c: "range" }, order: null, limit: 0, select: ["s", "c"] },
    { sql: "SELECT tenant_id, amount FROM orders WHERE status = ? AND created_at >= now() - interval '30 days'",
      pred: { s: "eq", c: "range" }, order: null, limit: 0, select: ["t", "amount"] },
    { sql: "SELECT amount FROM orders WHERE tenant_id = ? ORDER BY created_at LIMIT 20",
      pred: { t: "eq" }, order: "c", limit: 20, select: ["amount"] },
    { sql: "SELECT count(*) FROM orders WHERE created_at >= now() - interval '30 days'",
      pred: { c: "range" }, order: null, limit: 0, select: [] }
  ];

  function icAnalyse(order, q, include) {
    var seek = [], filters = [], roles = {}, stopped = false, i;
    for (i = 0; i < order.length; i++) {
      var col = order[i], p = q.pred[col];
      if (!stopped) {
        if (p === "eq") { seek.push(col); roles[col] = "eq"; }
        else if (p === "range") { seek.push(col); roles[col] = "range"; stopped = true; }
        else { roles[col] = "gap"; stopped = true; }
      } else if (p) { filters.push(col); roles[col] = "filter"; }
      else roles[col] = "unused";
    }
    var sortAvoided = false;
    if (q.order) {
      var pos = order.indexOf(q.order);
      sortAvoided = true;
      for (i = 0; i < pos; i++) if (q.pred[order[i]] !== "eq") sortAvoided = false;
    }
    var covering = true;
    for (i = 0; i < q.select.length; i++) {
      var sc = q.select[i];
      if (sc === "amount") { if (!include) covering = false; }
      else if (order.indexOf(sc) < 0) covering = false;
    }
    var seekSel = 1, filterSel = 1;
    for (i = 0; i < seek.length; i++) seekSel *= IC_SEL[seek[i]];
    for (i = 0; i < filters.length; i++) filterSel *= IC_SEL[filters[i]];
    var inRange = IC_N * seekSel;
    var matching = inRange * filterSel;
    var scanned = inRange, returned = matching, heap;
    if (q.limit && sortAvoided) {
      scanned = Math.min(inRange, Math.ceil(q.limit / filterSel));
      returned = Math.min(matching, q.limit);
      heap = covering ? 0 : returned;
    } else {
      if (q.limit) returned = Math.min(matching, q.limit);
      heap = covering ? 0 : matching;
    }
    var access;
    if (!seek.length) access = "full index scan (leading column unconstrained)";
    else if (!filters.length) access = "index seek on prefix (" + seek.map(function (c) { return IC_COL[c]; }).join(", ") + ")";
    else access = "seek on " + seek.map(function (c) { return IC_COL[c]; }).join(", ") + ", then filter in index";
    return { seek: seek, filters: filters, roles: roles, sortAvoided: sortAvoided, covering: covering,
      scanned: scanned, matching: matching, returned: returned, heap: heap, access: access };
  }

  Widgets.idxComposite = function (mount) {
    shell(mount, "planner", "Composite index column order",
      "One orders table with 10 million rows: about 1,000 tenants, 5 statuses, and a 30-day window that covers roughly 10% of rows. Pick a query and an index column order, and see how much of the index the engine can seek into, what it must filter, whether the sort disappears, and whether the heap is touched at all.");
    var qi = 0, oi = 0, include = false;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var qSel = h("select", { "aria-label": "Query" });
    for (var a = 0; a < IC_QUERIES.length; a++) qSel.appendChild(h("option", { value: String(a) }, "Q" + (a + 1) + ": " + IC_QUERIES[a].sql.replace(/^SELECT .*? FROM orders /, "")));
    var oSel = h("select", { "aria-label": "Index column order" });
    for (var b = 0; b < IC_ORDERS.length; b++) oSel.appendChild(h("option", { value: String(b) }, "(" + IC_ORDERS[b].map(function (c) { return IC_COL[c]; }).join(", ") + ")"));
    qSel.addEventListener("change", function () { qi = parseInt(qSel.value, 10) || 0; paint(); });
    oSel.addEventListener("change", function () { oi = parseInt(oSel.value, 10) || 0; paint(); });

    var ROLE = {
      eq: ["seek: equality", "var(--accent-ink)"],
      range: ["seek: range (stops the seek)", "var(--cyan-ink)"],
      filter: ["filter on index entries", "var(--amber-ink)"],
      gap: ["no predicate (seek stops here)", "var(--rose-ink)"],
      unused: ["not used", "var(--text-dim)"]
    };

    function paint() {
      var q = IC_QUERIES[qi], order = IC_ORDERS[oi];
      var r = icAnalyse(order, q, include);
      clear(stage);
      stage.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text);line-height:1.5;margin-bottom:6px" }, q.sql));
      stage.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text-dim);margin-bottom:10px" },
        "CREATE INDEX ON orders (" + order.map(function (c) { return IC_COL[c]; }).join(", ") + ")" + (include ? " INCLUDE (amount)" : "")));
      var row = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;align-items:stretch" });
      for (var i = 0; i < order.length; i++) {
        var c = order[i], role = ROLE[r.roles[c]];
        var extra = q.order === c ? " · ORDER BY column" : "";
        row.appendChild(h("div", { style: "border:1px solid " + role[1] + ";border-radius:8px;padding:6px 10px;background:var(--surface-solid);min-width:140px" },
          h("div", { style: "font-family:var(--font-mono);font-size:0.82rem;color:var(--text);font-weight:600" }, (i + 1) + ". " + IC_COL[c]),
          h("div", { style: "font-size:0.78rem;color:" + role[1] }, role[0] + extra)));
        if (i < order.length - 1) row.appendChild(h("span", { style: "align-self:center;color:var(--text-dim)" }, "\u2192"));
      }
      if (include) row.appendChild(h("div", { style: "border:1px dashed var(--line);border-radius:8px;padding:6px 10px;background:var(--surface-solid)" },
        h("div", { style: "font-family:var(--font-mono);font-size:0.82rem;color:var(--text)" }, "INCLUDE amount"),
        h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, "payload only, not searchable")));
      stage.appendChild(row);

      var msg;
      if (!r.seek.length) msg = "The leading column has no predicate, so there is no contiguous slice of the index to jump to. The engine either reads the whole index (only attractive when it covers the query) or, more likely, the whole table.";
      else if (r.filters.length) msg = "The seek narrows to " + fmt(r.scanned) + " entries, but " + r.filters.map(function (c) { return IC_COL[c]; }).join(", ") + " sits behind a range or a gap, so it can only be checked entry by entry inside that slice. Move equality columns in front of the range column to turn that filter into part of the seek.";
      else msg = "Every predicate is part of one contiguous seek: the engine descends once and reads exactly the matching run of " + fmt(r.scanned) + " entries.";
      if (q.order) msg += r.sortAvoided ? " The index already delivers rows in ORDER BY order" + (q.limit ? ", so the scan stops after " + q.limit + " qualifying rows." : ".") : " Rows come out of the index in the wrong order, so the engine must collect all " + fmt(r.matching) + " matches and sort them before applying the LIMIT.";
      stage.appendChild(h("p", { style: "font-size:0.84rem;color:var(--text-dim);margin:10px 0 0;line-height:1.55" }, msg));

      clear(readout);
      readout.appendChild(ro("access", r.access));
      readout.appendChild(ro("index entries read", "~" + fmt(r.scanned)));
      readout.appendChild(ro("rows returned", "~" + fmt(r.returned)));
      readout.appendChild(ro("sort", q.order ? (r.sortAvoided ? "avoided" : "explicit sort of ~" + fmt(r.matching)) : "not needed"));
      readout.appendChild(ro("covering", r.covering ? "yes (index-only)" : "no"));
      readout.appendChild(ro("heap lookups", "~" + fmt(r.heap)));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center" },
      h("label", { class: "w-field" }, "Query ", qSel),
      h("label", { class: "w-field" }, "Index ", oSel),
      segment([[false, "No INCLUDE"], [true, "INCLUDE (amount)"]], 0, function (v) { include = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. idxBloom — bloom filter bits, hashes, false positives
     Deterministic FNV-1a double hashing; 300 probe keys that were
     never inserted measure the observed false-positive rate.
  ================================================================== */
  var BF_KEYS = [], BF_PROBES = [];
  (function () {
    for (var i = 0; i < 64; i++) BF_KEYS.push("user:" + (1000 + i * 37));
    for (var j = 0; j < 300; j++) BF_PROBES.push("sku-" + (j * 13 + 7));
  })();
  function fnv(str, seed) {
    var hsh = (0x811c9dc5 ^ seed) >>> 0;
    for (var i = 0; i < str.length; i++) {
      hsh ^= str.charCodeAt(i);
      hsh = (hsh + (hsh << 1) + (hsh << 4) + (hsh << 7) + (hsh << 8) + (hsh << 24)) >>> 0;
    }
    return hsh >>> 0;
  }
  function bfPositions(key, m, k) {
    var h1 = fnv(key, 0), h2 = (fnv(key, 0x5bd1e995) | 1) >>> 0, out = [];
    for (var i = 0; i < k; i++) out.push((h1 + i * h2) % m);
    return out;
  }

  Widgets.idxBloom = function (mount) {
    shell(mount, "probabilistic", "Bloom filter lab",
      "A bit array of m bits and k hash functions. Inserting a key sets k bits; a lookup answers \u201cdefinitely not here\u201d if any of its k bits is 0, otherwise \u201cmaybe here\u201d. Insert keys, change m and k, and compare the formula with the false-positive rate measured on 300 keys that were never inserted.");
    var m = 64, k = 3, n = 0, bits = [], last = null, probeIdx = 0, hitIdx = 0;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function rebuild() {
      bits = [];
      for (var i = 0; i < m; i++) bits.push(0);
      for (var j = 0; j < n; j++) {
        var ps = bfPositions(BF_KEYS[j], m, k);
        for (var p = 0; p < ps.length; p++) bits[ps[p]] = 1;
      }
      if (last) last = query(last.key, last.inserted);
    }
    function query(key, inserted) {
      var ps = bfPositions(key, m, k), set = 0;
      for (var i = 0; i < ps.length; i++) if (bits[ps[i]]) set++;
      return { key: key, inserted: inserted, positions: ps, set: set, maybe: set === ps.length };
    }
    function observed() {
      var fp = 0;
      for (var i = 0; i < BF_PROBES.length; i++) {
        var ps = bfPositions(BF_PROBES[i], m, k), all = true;
        for (var j = 0; j < ps.length; j++) if (!bits[ps[j]]) { all = false; break; }
        if (all) fp++;
      }
      return fp;
    }

    function paint() {
      clear(stage);
      var mark = {};
      if (last) for (var q = 0; q < last.positions.length; q++) mark[last.positions[q]] = true;
      var grid = h("div", { style: "display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px", role: "img", "aria-label": "bit array" });
      var setCount = 0;
      for (var i = 0; i < m; i++) {
        if (bits[i]) setCount++;
        grid.appendChild(h("span", {
          title: "bit " + i + " = " + bits[i],
          style: "display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid var(--line);background:" +
            (bits[i] ? "var(--accent)" : "var(--ink-800)") + (mark[i] ? ";outline:2px solid var(--rose-ink);outline-offset:1px" : "")
        }));
      }
      stage.appendChild(grid);
      var line;
      if (!last) line = "No lookup yet. Insert a few keys, then query a key that was never inserted.";
      else {
        line = "Lookup " + last.key + " \u2192 bits [" + last.positions.join(", ") + "] \u2192 " + last.set + " of " + last.positions.length + " set \u2192 ";
        if (!last.maybe) line += "definitely not present (a 0 bit proves it).";
        else if (last.inserted) line += "maybe present (true positive: this key was inserted).";
        else line += "maybe present \u2014 a FALSE POSITIVE: this key was never inserted, other keys happened to set all its bits.";
      }
      stage.appendChild(h("p", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text);margin:0;line-height:1.5" }, line));

      var theory = n ? Math.pow(1 - Math.exp(-k * n / m), k) : 0;
      var fp = observed();
      clear(readout);
      readout.appendChild(ro("keys n", n));
      readout.appendChild(ro("bits per key m/n", n ? (m / n).toFixed(1) : "\u2014"));
      readout.appendChild(ro("bits set", setCount + "/" + m + " (" + pct(setCount / m, 0) + ")"));
      readout.appendChild(ro("predicted FPR (1\u2212e^(\u2212kn/m))^k", pct(theory)));
      readout.appendChild(ro("observed FPR", fp + "/300 = " + pct(fp / 300)));
      readout.appendChild(ro("optimal k = (m/n)\u00b7ln 2", n ? ((m / n) * Math.LN2).toFixed(1) : "\u2014"));
    }

    var mLabel = h("b", {}, String(m));
    var range = h("input", { type: "range", min: "16", max: "256", step: "8", value: String(m), "aria-label": "m bits" });
    range.addEventListener("input", function () {
      m = parseInt(range.value, 10) || 64;
      mLabel.textContent = String(m);
      rebuild(); paint();
    });
    function btn(label, cls, fn) {
      var b = h("button", { type: "button", class: "w-btn" + (cls ? " " + cls : "") }, label);
      b.addEventListener("click", fn);
      return b;
    }
    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center" },
      h("label", { class: "w-field" }, "m bits ", range, " ", mLabel),
      h("span", { style: "font-size:0.82rem;color:var(--text-dim)" }, "k hashes"),
      segment([[1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [8, "8"]], 2, function (v) { k = v; rebuild(); paint(); })));
    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:8px;margin-top:8px" },
      btn("Insert next key", "primary", function () { if (n < BF_KEYS.length) { n++; rebuild(); } paint(); }),
      btn("Insert 8 keys", "", function () { n = Math.min(BF_KEYS.length, n + 8); rebuild(); paint(); }),
      btn("Query a never-inserted key", "", function () { last = query(BF_PROBES[probeIdx % BF_PROBES.length], false); probeIdx++; paint(); }),
      btn("Query an inserted key", "", function () { if (n) { last = query(BF_KEYS[hitIdx % n], true); hitIdx++; } paint(); }),
      btn("Reset", "ghost", function () { n = 0; last = null; probeIdx = 0; hitIdx = 0; rebuild(); paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    rebuild();
    paint();
  };

  /* ==================================================================
     idxAnn — IVF approximate nearest neighbour: nprobe vs recall
  ================================================================== */
  var ANN_NS = "http://www.w3.org/2000/svg";
  function annSvg(tag, attrs) {
    var el = document.createElementNS(ANN_NS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    return el;
  }
  function annData() {
    var seed = 20261028;
    function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
    function gauss() { var u = Math.max(1e-9, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var pts = [], i, j, c;
    for (c = 0; c < 12; c++) {
      var cx = 0.1 + 0.8 * rnd(), cy = 0.1 + 0.8 * rnd(), sd = 0.035 + 0.04 * rnd();
      for (j = 0; j < 50; j++) pts.push([Math.min(0.99, Math.max(0.01, cx + sd * gauss())), Math.min(0.99, Math.max(0.01, cy + sd * gauss()))]);
    }
    var NL = 16, cents = [];
    for (i = 0; i < NL; i++) cents.push(pts[(i * 37 + 11) % pts.length].slice());
    var assign = new Array(pts.length);
    for (var it = 0; it < 10; it++) {
      for (i = 0; i < pts.length; i++) {
        var best = 0, bd = Infinity;
        for (c = 0; c < NL; c++) { var d = d2(pts[i], cents[c]); if (d < bd) { bd = d; best = c; } }
        assign[i] = best;
      }
      var sum = [];
      for (c = 0; c < NL; c++) sum.push([0, 0, 0]);
      for (i = 0; i < pts.length; i++) { sum[assign[i]][0] += pts[i][0]; sum[assign[i]][1] += pts[i][1]; sum[assign[i]][2]++; }
      for (c = 0; c < NL; c++) if (sum[c][2]) cents[c] = [sum[c][0] / sum[c][2], sum[c][1] / sum[c][2]];
    }
    var queries = [];
    for (i = 0; i < 24; i++) {
      var base = pts[Math.floor(rnd() * pts.length)];
      queries.push([Math.min(0.98, Math.max(0.02, base[0] + 0.06 * (rnd() - 0.5))), Math.min(0.98, Math.max(0.02, base[1] + 0.06 * (rnd() - 0.5)))]);
    }
    return { pts: pts, cents: cents, assign: assign, queries: queries };
  }
  function d2(a, b) { var x = a[0] - b[0], y = a[1] - b[1]; return x * x + y * y; }
  function topK(q, pts, idxs, k) {
    return idxs.slice().sort(function (a, b) { return d2(q, pts[a]) - d2(q, pts[b]); }).slice(0, k);
  }

  Widgets.idxAnn = function (mount) {
    shell(mount, "ann", "IVF index: nprobe versus recall",
      "600 vectors (2-D so you can see them) are clustered into 16 lists by k-means. A query compares itself to the 16 centroids, then scans only the nprobe closest lists. Raise nprobe and watch recall@10 climb while the share of vectors scanned climbs with it.");
    var D = annData(), K = 10, N = D.pts.length;
    var all = [], i;
    for (i = 0; i < N; i++) all.push(i);
    var truth = D.queries.map(function (q) { return topK(q, D.pts, all, K); });
    var st = { nprobe: 2, qi: 0 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function search(q, nprobe) {
      var order = D.cents.map(function (c, ci) { return ci; }).sort(function (a, b) { return d2(q, D.cents[a]) - d2(q, D.cents[b]); });
      var probed = {}, cand = [];
      for (var p = 0; p < nprobe; p++) probed[order[p]] = true;
      for (var j = 0; j < N; j++) if (probed[D.assign[j]]) cand.push(j);
      return { probed: probed, scanned: cand.length, found: topK(q, D.pts, cand, K) };
    }
    function recallOf(found, tr) {
      var hit = 0, set = {};
      for (var j = 0; j < tr.length; j++) set[tr[j]] = true;
      for (j = 0; j < found.length; j++) if (set[found[j]]) hit++;
      return hit / tr.length;
    }

    function paint() {
      var q = D.queries[st.qi], res = search(q, st.nprobe), tr = truth[st.qi];
      var sumR = 0, sumS = 0;
      for (var qi = 0; qi < D.queries.length; qi++) {
        var r = search(D.queries[qi], st.nprobe);
        sumR += recallOf(r.found, truth[qi]); sumS += r.scanned;
      }
      clear(stage);
      var S = 340, root = annSvg("svg", { viewBox: "0 0 " + S + " " + S, width: "100%", style: "max-width:420px;display:block;margin:0 auto", role: "img", "aria-label": "Vectors, probed lists, true and found neighbours" });
      root.appendChild(annSvg("rect", { x: 0, y: 0, width: S, height: S, rx: 10, style: "fill:var(--surface-solid);stroke:var(--line)" }));
      var trueSet = {}, foundSet = {};
      tr.forEach(function (t) { trueSet[t] = true; });
      res.found.forEach(function (f) { foundSet[f] = true; });
      for (i = 0; i < N; i++) {
        var pt = D.pts[i], inList = res.probed[D.assign[i]];
        root.appendChild(annSvg("circle", { cx: (pt[0] * S).toFixed(1), cy: (pt[1] * S).toFixed(1), r: foundSet[i] ? 3.6 : 2.2,
          style: foundSet[i] ? "fill:var(--accent)" : inList ? "fill:var(--cyan);opacity:0.75" : "fill:var(--text-dim);opacity:0.3" }));
        if (trueSet[i] && !foundSet[i]) root.appendChild(annSvg("circle", { cx: (pt[0] * S).toFixed(1), cy: (pt[1] * S).toFixed(1), r: 5, style: "fill:none;stroke:var(--rose);stroke-width:1.6" }));
      }
      D.cents.forEach(function (c) {
        root.appendChild(annSvg("rect", { x: (c[0] * S - 3.5).toFixed(1), y: (c[1] * S - 3.5).toFixed(1), width: 7, height: 7, style: "fill:none;stroke:var(--amber);stroke-width:1.5" }));
      });
      var qx = q[0] * S, qy = q[1] * S;
      root.appendChild(annSvg("path", { d: "M" + (qx - 7) + " " + qy + " H" + (qx + 7) + " M" + qx + " " + (qy - 7) + " V" + (qy + 7), style: "stroke:var(--text);stroke-width:2.4" }));
      stage.appendChild(root);
      stage.appendChild(h("p", { style: "font-size:0.82rem;color:var(--text);margin:8px 0 0;line-height:1.5;text-align:center" },
        "Cross = query. Squares = centroids. Teal = vectors in probed lists. Magenta = the 10 results returned. Rose rings = true neighbours the index missed."));

      clear(readout);
      readout.appendChild(ro("this query recall@10", pct(recallOf(res.found, tr), 0)));
      readout.appendChild(ro("avg recall@10 (24 queries)", pct(sumR / D.queries.length, 0)));
      readout.appendChild(ro("vectors scanned", fmt(sumS / D.queries.length) + " of " + N + " (" + pct(sumS / D.queries.length / N, 0) + ")"));
      readout.appendChild(ro("lists probed", st.nprobe + " / 16"));
    }

    var npLabel = h("b", {}, String(st.nprobe));
    var range = h("input", { type: "range", min: "1", max: "16", step: "1", value: String(st.nprobe), "aria-label": "nprobe" });
    range.addEventListener("input", function () { st.nprobe = parseInt(range.value, 10) || 1; npLabel.textContent = String(st.nprobe); paint(); });
    var nextQ = h("button", { type: "button", class: "w-btn primary" }, "Next query");
    nextQ.addEventListener("click", function () { st.qi = (st.qi + 1) % D.queries.length; paint(); });
    var flat = h("button", { type: "button", class: "w-btn ghost" }, "Exact (probe all)");
    flat.addEventListener("click", function () { st.nprobe = 16; range.value = "16"; npLabel.textContent = "16"; paint(); });
    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center" },
      h("label", { class: "w-field" }, "nprobe ", range, " ", npLabel), nextQ, flat));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     3. Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "idx-basics": {
      title: "Index fundamentals checkpoint",
      sub: "Clustered vs secondary, covering scans and composite column order.",
      questions: [
        { q: "In MySQL InnoDB, what does a leaf entry of a secondary index on (email) contain?",
          options: ["The email plus a 6-byte physical row address", "The email plus the primary key column values", "The email plus a full copy of the row", "The email plus the page number of the clustered leaf"],
          answer: 1,
          explain: "InnoDB secondary indexes point at rows logically, by primary key, not by physical location. A lookup through the secondary index therefore finds the PK and then descends the clustered index a second time. That is also why a wide primary key inflates every secondary index." },
        { q: "A PostgreSQL UPDATE changes one non-indexed column, but the page has no free space. Why do all of the table's indexes get new entries?",
          options: ["Postgres rebuilds indexes after every update", "Indexes store a copy of every column, so all must change", "The visibility map forces index rewrites on updates", "Index entries point at a physical tuple location (TID), and the new row version lands at a new TID"],
          answer: 3,
          explain: "Postgres writes a new tuple version for every UPDATE. If it fits on the same page and no indexed column changed, a HOT update chains it from the old tuple and the indexes stay untouched. Otherwise the new version has a new ctid, and every index needs an entry pointing at it." },
        { q: "EXPLAIN ANALYZE shows an Index Only Scan with \u201cHeap Fetches: 48000\u201d on a busy table. What is the most likely cause?",
          options: ["Many heap pages are not marked all-visible in the visibility map, so visibility had to be checked in the heap", "The index is missing an INCLUDE clause for the selected columns", "The planner chose the wrong index", "The table has no primary key"],
          answer: 0,
          explain: "Postgres index entries carry no visibility information. An index-only scan can skip the heap only for pages the visibility map marks all-visible, which VACUUM sets and any write clears. Recently modified pages force a heap visit per row; a missing column would have prevented the index-only plan entirely." },
        { q: "Index on (tenant_id, created_at, status). Query: WHERE tenant_id = ? AND status = ? AND created_at > ?. What does the engine do?",
          options: ["Seeks on all three columns as one contiguous range", "Ignores the index because status is not the second column", "Seeks on tenant_id plus the created_at range, then checks status on each index entry in that range", "Seeks on tenant_id only and checks both other predicates in the heap"],
          answer: 2,
          explain: "Entries are sorted by tenant_id, then created_at, then status. Equality on tenant_id and a range on created_at define one contiguous slice, but inside it status values are interleaved, so status can only be filtered entry by entry. Putting status before created_at would make all three part of the seek." },
        { q: "Hot query: WHERE status = 'open' ORDER BY created_at DESC LIMIT 20. Which single index serves it best?",
          options: ["(created_at, status)", "(status, created_at)", "(status) alone", "(created_at) alone"],
          answer: 1,
          explain: "With status fixed by equality, (status, created_at) yields matching rows already ordered by created_at; a backward scan gives DESC order and the scan stops after 20 rows. (created_at, status) can also avoid the sort but must walk past every non-open row. (status) alone forces a sort of every open row before the LIMIT." }
      ]
    },
    "idx-beyond": {
      title: "Beyond the B-tree checkpoint",
      sub: "Hash, GIN, GiST, BRIN, bitmap scans and bloom filters.",
      questions: [
        { q: "Why can a PostgreSQL hash index not help with WHERE id BETWEEN 10 AND 20?",
          options: ["Hash indexes are not crash-safe", "Hash indexes only work on text columns", "Hashing destroys key order, so neighbouring keys land in unrelated buckets", "Hash indexes cannot be used together with a primary key"],
          answer: 2,
          explain: "A hash index maps each key to a bucket by its hash code, so 10 and 11 end up in unrelated places. The only question it can answer is \u201cwhich rows have exactly this value\u201d. Crash safety was a pre-version-10 problem and has nothing to do with ranges." },
        { q: "You need fast WHERE attrs @> '{\"color\": \"red\"}' on a large jsonb column. Which index type fits?",
          options: ["GIN", "BRIN", "Hash", "B-tree on the whole jsonb value"],
          answer: 0,
          explain: "GIN is an inverted index: it maps each key or key/value element inside the document to a posting list of rows containing it, which is exactly what containment needs. A B-tree or hash on the whole value can only match documents that are entirely equal. BRIN needs physical correlation, which a document attribute does not have." },
        { q: "A BRIN index on created_at of an append-only events table is tiny and fast. Why does it work here?",
          options: ["BRIN stores every timestamp in sorted order", "BRIN builds a hash of each block", "The planner caches BRIN results between queries", "Rows are inserted in time order, so each block range has a narrow min/max and most ranges can be skipped"],
          answer: 3,
          explain: "BRIN keeps only a summary, typically min and max, per range of heap pages. When the column correlates with physical order, those ranges barely overlap and a time predicate excludes most of them. On a randomly ordered column every range would span almost everything and BRIN would prune nothing." },
        { q: "EXPLAIN shows a Bitmap Heap Scan with \u201cHeap Blocks: exact=2100 lossy=9800\u201d and a Recheck Cond. What happened?",
          options: ["The index is corrupt and was partly ignored", "The bitmap outgrew work_mem, so parts were stored per page instead of per row, and every row on those pages is rechecked", "The visibility map was out of date", "Two indexes were combined with BitmapOr"],
          answer: 1,
          explain: "A bitmap scan first tries to remember exact tuple positions. When that exceeds work_mem, it degrades to one bit per heap page, which is lossy: the executor must read every row on those pages and re-evaluate the condition. Raising work_mem or making the predicate more selective restores exact blocks." },
        { q: "A bloom filter is sized at 10 bits per key. Roughly what number of hash functions minimises the false-positive rate?",
          options: ["7", "3", "10", "14"],
          answer: 0,
          explain: "The optimum is k = (m/n) \u00b7 ln 2 = 10 \u00d7 0.693 \u2248 6.9, so about 7. Fewer hashes leave each lookup checking too few bits, while more hashes fill the array too quickly. At that optimum the false-positive rate is roughly 0.8%." },
        {
          q: "An IVF vector index returns results with recall@10 of 0.78. Which change raises recall most directly, and what does it cost?",
          options: ["Increase nprobe so more cluster lists are scanned per query; latency and work rise roughly in proportion", "Decrease nlist to one list; queries become faster", "Switch the distance metric from cosine to Euclidean", "Add a B-tree index on the embedding column"],
          answer: 0,
          explain: "IVF misses true neighbours that sit in lists it did not probe, typically near cluster boundaries. Probing more lists recovers them at proportional extra work; probing all lists is exact search. Changing the metric changes the question, not the recall, and B-trees cannot order high-dimensional vectors."
        },
        {
          q: "A query asks for the 10 nearest documents for tenant 7 using an HNSW index, but often returns only 3 rows. Why?",
          options: ["HNSW indexes are limited to 3 results per query", "The tenant filter is applied after the index returns its global nearest candidates, and most of them belong to other tenants", "Cosine distance cannot be combined with WHERE clauses", "The graph was built with too many neighbours per node"],
          answer: 1,
          explain: "With post-filtering, the index hands back roughly ef_search global candidates and the filter discards those from other tenants. Remedies are larger ef_search, per-tenant partitions or indexes, filter-aware traversal, or exact search over a small pre-filtered set."
        }
      ]
    },
    "idx-design": {
      title: "Index design checkpoint",
      sub: "Write amplification, unused indexes, partial and expression indexes.",
      questions: [
        { q: "An insert-heavy PostgreSQL table has nine indexes. What is the most direct cost each INSERT pays for them?",
          options: ["Nine extra table scans", "A full index rebuild every checkpoint", "Nothing until the next VACUUM", "Nine extra B-tree descents and leaf modifications, each WAL-logged, on top of the heap insert"],
          answer: 3,
          explain: "Every index must receive an entry for the new row immediately, so one logical insert becomes roughly ten page modifications plus their WAL records. Leaf pages that are not cached cause random reads, and splits add more writes. That is index write amplification." },
        { q: "You created CREATE INDEX ... ON jobs (run_at) WHERE status = 'pending'. A prepared statement using WHERE status = $1 AND run_at < now() does not use it under a generic plan. Why?",
          options: ["Partial indexes only work with literal constants in DDL", "With an unknown parameter the planner cannot prove the query implies status = 'pending'", "Partial indexes are ignored inside transactions", "run_at must be the first column of the table"],
          answer: 1,
          explain: "The planner may use a partial index only when it can prove the query's WHERE clause implies the index predicate. A generic plan has to work for any $1, including values other than 'pending', so the proof fails. Writing the literal status = 'pending' in the query fixes it." },
        { q: "CREATE INDEX ON events (date_trunc('day', ts)) fails where ts is timestamptz. Why?",
          options: ["The function is not IMMUTABLE: its result depends on the session TimeZone setting", "Expression indexes cannot use functions with two arguments", "timestamptz columns cannot be indexed", "date_trunc is only allowed in partial index predicates"],
          answer: 0,
          explain: "Index expressions must return the same output for the same input forever, otherwise stored entries would go stale. Truncating a timestamptz to a day depends on the session time zone, so that variant is only STABLE. Converting to a fixed zone first, or indexing a timestamp without time zone, makes it immutable." },
        { q: "Users are soft-deleted with deleted_at. How do you enforce unique email only among active users?",
          options: ["A unique index on (email, deleted_at)", "A trigger that scans the table on every insert", "A unique partial index on (email) WHERE deleted_at IS NULL", "A hash index on email"],
          answer: 2,
          explain: "A partial unique index enforces uniqueness only for rows that satisfy its predicate, so deleted rows can share an email freely. (email, deleted_at) fails because NULLs are distinct by default, letting duplicate active rows in. A scanning trigger is slow and races under concurrency." },
        { q: "Which PostgreSQL UPDATE can be a HOT (heap-only tuple) update that skips index maintenance?",
          options: ["One that changes the primary key", "One that changes a column listed in an index INCLUDE clause", "Any update on a table with fillfactor 100", "One that changes only non-indexed columns, with free space for the new version on the same page"],
          answer: 3,
          explain: "HOT needs two conditions: no column referenced by any index changes, and the new version fits on the same heap page. INCLUDE columns are stored in the index, so changing them breaks HOT. A lower fillfactor leaves the spare room that makes HOT likely on update-heavy tables." }
      ]
    }
  });

  /* ==================================================================
     4. Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.idx = {
    id: "idx",
    name: "Indexing",
    short: "IDX",
    tagline: "What an index really stores, and what every one of them costs",
    color: "#38bdf8",
    blurb: "How engines actually find rows: clustered versus heap-organised tables, secondary indexes that point at primary keys or physical tuple ids, covering and index-only scans and the visibility map that limits them, composite column order, hash, GIN, GiST, BRIN, bitmap indexes and bitmap heap scans, vector indexes (IVF, HNSW, product quantization), bloom filters with the math behind them, and the write amplification, partial and expression indexes that decide whether an index is worth having.",
    modules: [
      {
        id: "basics",
        name: "Index Fundamentals",
        icon: "database",
        lessons: [
          {
            id: "clustered-vs-secondary",
            title: "Clustered vs secondary indexes: where the row actually lives",
            summary: "InnoDB stores rows inside the primary-key B+tree and points secondaries at the PK; Postgres keeps rows in a heap and every index points at a physical tuple id.",
            minutes: 10,
            tags: ["clustered-index", "secondary-index", "innodb", "postgres", "heap"],
            blocks: [
              { t: "p", html: "Every index answers one question: <em>given a key, where is the row?</em> Engines split on what \u201cwhere\u201d means. In a <strong>clustered</strong> design the table <em>is</em> an index: rows live in the leaves of a B+tree sorted by primary key. In a <strong>heap</strong> design rows live in an unordered file of pages, and every index, including the primary key, is a separate structure pointing into it." },
              { t: "diagram", id: "btree-structure", caption: "A B+tree: internal pages route by key, leaf pages hold the entries and are linked for range scans. In InnoDB the clustered leaves hold whole rows." },
              { t: "h", text: "InnoDB: the table is the primary-key B+tree" },
              { t: "ul", items: [
                "Leaf pages (16 KB by default) of the clustered index hold complete rows in primary-key order.",
                "No primary key? InnoDB uses the first <code class='tok'>UNIQUE NOT NULL</code> index, else it generates a hidden 6-byte row id.",
                "A <strong>secondary index</strong> leaf stores <code class='tok'>(secondary key, primary key columns)</code>. Finding a row through it means two descents: the secondary tree to get the PK, then the clustered tree to get the row.",
                "Because secondaries point by PK, moving a row inside the clustered tree (a page split) never touches them."
              ] },
              { t: "h", text: "PostgreSQL: heap plus tuple ids" },
              { t: "ul", items: [
                "Rows live in 8 KB heap pages in roughly insertion order. Each row version has a <code class='tok'>ctid</code>: (block number, line pointer), 6 bytes.",
                "Every index, the primary key included, stores <code class='tok'>(key, ctid)</code>. One index descent, then one heap page read.",
                "UPDATE writes a new row version. If no indexed column changed and the new version fits on the same page, it is a <strong>HOT</strong> update and indexes are untouched; otherwise every index gets a new entry for the new ctid.",
                "<code class='tok'>CLUSTER</code> reorders the heap once by an index; the order is not maintained afterwards."
              ] },
              { t: "code", lang: "sql", code:
                "-- InnoDB: secondary lookup = two B+tree descents\n" +
                "CREATE TABLE orders (\n" +
                "  id         BIGINT AUTO_INCREMENT PRIMARY KEY,\n" +
                "  email      VARCHAR(255),\n" +
                "  total      DECIMAL(10,2),\n" +
                "  KEY idx_email (email)          -- leaf entry: (email, id)\n" +
                ") ENGINE=InnoDB;\n" +
                "SELECT total FROM orders WHERE email = 'a@b.example';  -- idx_email -> id -> clustered leaf\n\n" +
                "-- PostgreSQL: every index entry carries a physical tuple id\n" +
                "SELECT ctid, id FROM orders WHERE id = 42;   -- e.g. (1287,14): block 1287, slot 14"
              },
              { t: "table", headers: ["Property", "Clustered (InnoDB, SQL Server clustered)", "Heap + TIDs (Postgres, Oracle default)"], rows: [
                ["PK range scan", "Sequential leaf pages, row data inline", "Index walk plus one heap visit per row (random unless correlated)"],
                ["Secondary lookup", "Two descents (secondary, then clustered)", "One descent plus one heap page"],
                ["Wide primary key", "Copied into every secondary index", "Irrelevant to other indexes"],
                ["Row moves (split or new version)", "Secondaries unaffected", "Indexes need new entries unless the update is HOT"],
                ["Random PK inserts (UUIDv4)", "Splits all over the tree, fragmented pages", "Heap appends stay cheap; only the PK index fragments"]
              ] },
              { t: "note", variant: "warn", html: "A random UUIDv4 primary key on InnoDB scatters inserts across the whole clustered tree: the working set becomes the entire table, pages split at random and sit around half full. Prefer an increasing key (auto-increment or time-ordered UUIDv7) when insert rate matters." },
              { t: "p", html: "SQL Server lets you choose: a table with a clustered index behaves like InnoDB (secondaries store the clustering key), a table without one is a heap whose secondaries store a physical row id. Oracle defaults to heaps and offers index-organised tables as the clustered option." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \u201cwhy is our secondary index so big\u201d (wide PK in InnoDB), \u201cupdates got slower after adding an index\u201d (lost HOT updates in Postgres), \u201cinserts slowed down after switching ids to UUIDs\u201d (random clustered inserts)." },
              { t: "note", variant: "tip", html: "Interview line: <em>\u201cIn InnoDB a secondary index is a map from key to primary key, so I keep the PK narrow and increasing. In Postgres every index points at a physical tuple, so I care about HOT updates and fillfactor instead.\u201d</em>" },
              { t: "note", variant: "key", html: "<strong>Know what the index leaf points at.</strong> PK values (InnoDB) make secondaries stable but double the lookup; physical TIDs (Postgres) make lookups direct but tie every index to every row move." }
            ]
          },
          {
            id: "covering-indexes",
            title: "Covering indexes, INCLUDE and index-only scans",
            summary: "When every column a query needs is in the index, the engine can skip the table, subject to the visibility check in Postgres.",
            minutes: 9,
            tags: ["covering-index", "include", "index-only-scan", "visibility-map"],
            blocks: [
              { t: "p", html: "The expensive part of an index lookup is usually not the descent; upper levels are cached. It is the <strong>table visit per matching row</strong>, often a random page read. A <strong>covering index</strong> holds every column the query touches, so the engine answers straight from index leaves: an <em>index-only scan</em>." },
              { t: "stat", items: [
                { v: "~3\u20134", k: "B+tree levels for hundreds of millions of rows" },
                { v: "1 per row", k: "table visits without covering" },
                { v: "0", k: "table visits when covered (ideal case)" }
              ] },
              { t: "h", text: "Key columns vs payload columns" },
              { t: "p", html: "PostgreSQL (11+) and SQL Server support <code class='tok'>INCLUDE</code>: extra columns stored in leaf entries but not part of the search key. They do not affect sort order, cannot be searched on, and do not count toward a UNIQUE constraint. That lets you keep a narrow unique key and still cover the query." },
              { t: "code", lang: "sql", code:
                "-- unique on (tenant_id, order_no) only, but cover the dashboard query too\n" +
                "CREATE UNIQUE INDEX orders_tenant_no\n" +
                "  ON orders (tenant_id, order_no) INCLUDE (status, total);\n\n" +
                "SELECT order_no, status, total FROM orders WHERE tenant_id = 7;\n" +
                "-- Index Only Scan using orders_tenant_no on orders\n" +
                "--   Index Cond: (tenant_id = 7)\n" +
                "--   Heap Fetches: 0"
              },
              { t: "p", html: "MySQL InnoDB has no INCLUDE clause, but every secondary index already carries the primary key, so an index on <code class='tok'>(tenant_id, status)</code> covers <code class='tok'>SELECT id, status ... WHERE tenant_id = ?</code> for free. EXPLAIN shows <code class='tok'>Using index</code> in the Extra column when a query is covered." },
              { t: "h", text: "The visibility-map caveat (Postgres)" },
              { t: "p", html: "Postgres index entries carry no transaction visibility information: an entry may point at a dead or not-yet-committed row version. An index-only scan can skip the heap only for pages the <strong>visibility map</strong> marks <em>all-visible</em>. VACUUM sets that bit; any insert, update or delete on the page clears it. For rows on cleared pages, the executor fetches the heap tuple anyway and counts it as a heap fetch." },
              { t: "compare",
                bad: { title: "Index-only scan on a hot table", items: ["Pages are modified constantly, all-visible bits stay cleared", "EXPLAIN shows Heap Fetches close to the row count", "You pay the wider index on every write and still read the heap"] },
                good: { title: "Index-only scan on settled data", items: ["Older partitions or append-mostly tables, vacuumed regularly", "Heap Fetches near zero", "Large wins for counts and narrow aggregates"] } },
              { t: "note", variant: "trap", html: "Adding columns to INCLUDE makes them part of the index. In Postgres, updating any of them disqualifies the update from HOT, so a covering index on a frequently updated column can make writes noticeably more expensive." },
              { t: "table", headers: ["Tier", "Answer to \u201cthis lookup is slow\u201d"], rows: [
                ["Naive", "Add every selected column to the index key"],
                ["Solid", "Keep the searched columns as the key and move the rest to INCLUDE (or rely on the PK in InnoDB)"],
                ["Standout", "Also check Heap Fetches and vacuum health, and weigh the extra write cost on updated columns before covering"]
              ] },
              { t: "note", variant: "key", html: "<strong>Covering removes the per-row table visit, the real cost of an index lookup.</strong> In Postgres it only works on all-visible pages, so check Heap Fetches before celebrating." }
            ]
          },
          {
            id: "composite-order",
            title: "Composite indexes: leftmost prefix and equality before range",
            summary: "A multi-column B-tree is sorted like a phone book; the order of columns decides which predicates seek, which filter and whether the sort disappears.",
            minutes: 11,
            tags: ["composite-index", "leftmost-prefix", "column-order", "order-by"],
            blocks: [
              { t: "p", html: "An index on <code class='tok'>(a, b, c)</code> is one sorted list of tuples: ordered by <code class='tok'>a</code>, ties broken by <code class='tok'>b</code>, then <code class='tok'>c</code>. Think of a phone book sorted by last name, then first name: easy to find every Smith, or every John Smith, useless for every John." },
              { t: "h", text: "Leftmost prefix" },
              { t: "table", headers: ["Predicates", "Usable as a seek on (a, b, c)?", "Why"], rows: [
                ["a = 1", "Yes, prefix (a)", "All a = 1 entries are contiguous"],
                ["a = 1 AND b = 2", "Yes, prefix (a, b)", "Contiguous within a = 1"],
                ["a = 1 AND c = 3", "Seek on a, filter c", "Within a = 1, c values are scattered across every b"],
                ["b = 2", "No seek (full index scan at best)", "b = 2 entries appear under every a"],
                ["a > 1 AND b = 2", "Range on a, filter b", "The range on a ends the contiguous seek"]
              ] },
              { t: "h", text: "Equality before range" },
              { t: "p", html: "A range predicate selects a contiguous slice on its column, but within that slice later columns are no longer sorted. So everything after the first range column can only be <em>checked</em> entry by entry, not <em>sought</em>. For <code class='tok'>WHERE tenant_id = ? AND created_at &gt;= ?</code>, the index <code class='tok'>(tenant_id, created_at)</code> reads exactly the matching entries, while <code class='tok'>(created_at, tenant_id)</code> reads the whole time window for every tenant and discards most of it." },
              { t: "code", lang: "text", code:
                "10,000,000 rows, 1,000 tenants, last-30-days window ~= 10% of rows\n\n" +
                "(tenant_id, created_at): seek tenant -> 10,000 entries -> range 10%  ~= 1,000 entries read\n" +
                "(created_at, tenant_id): seek range  -> 1,000,000 entries, filter tenant ~= 1,000 kept\n" +
                "same answer, ~1000x more index entries touched"
              },
              { t: "h", text: "ORDER BY and LIMIT for free" },
              { t: "p", html: "If every index column before the ORDER BY column is pinned by equality, the index already returns rows in the requested order. The sort node disappears, and with a LIMIT the scan stops after N rows. A descending ORDER BY on all columns is a backward scan; mixed directions such as <code class='tok'>ORDER BY a, b DESC</code> need an index declared as <code class='tok'>(a, b DESC)</code>." },
              { t: "widget", id: "idxComposite" },
              { t: "note", variant: "tip", html: "\u201cMost selective column first\u201d is a weaker rule than it sounds. Predicate shape matters more: equality columns first, then the column you sort by or range over. Selectivity only breaks ties between equality columns." },
              { t: "p", html: "Some engines can rescue a missing leading predicate with a <strong>skip scan</strong>: Oracle, MySQL 8.0 and PostgreSQL 18 can jump through each distinct value of a low-cardinality leading column. It helps when that column has a handful of values and hurts when it has thousands, so do not design around it." },
              { t: "table", headers: ["Tier", "Index for WHERE tenant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 50"], rows: [
                ["Naive", "Three single-column indexes and hope the planner combines them (it cannot avoid the sort that way)"],
                ["Solid", "(tenant_id, status, created_at): two equality columns, then the sort column"],
                ["Standout", "Same index, plus INCLUDE for the selected columns if the page is hot, and a check that one index also serves the tenant-only listing"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \u201cthe query has an index but still sorts\u201d, \u201cfast for one tenant, slow for date ranges\u201d, \u201cwe have an index on (a, b) but filtering on b is slow\u201d. Each is a column-order problem." },
              { t: "quiz", id: "idx-basics" },
              { t: "note", variant: "key", html: "<strong>Equality columns first, then the sort or range column, and nothing useful after a range.</strong> Column order decides what is sought, what is filtered and whether the sort exists." }
            ]
          }
        ]
      },
      {
        id: "beyond",
        name: "Beyond the B-tree",
        icon: "grid",
        lessons: [
          {
            id: "hash-indexes",
            title: "Hash indexes: O(1) equality and nothing else",
            summary: "Buckets keyed by hash code give constant-time point lookups, but no ranges, no ordering and no prefix matching, which is why B-trees stay the default.",
            minutes: 8,
            tags: ["hash-index", "adaptive-hash-index", "point-lookup"],
            blocks: [
              { t: "p", html: "A hash index computes <code class='tok'>hash(key) mod buckets</code> and stores the entry in that bucket. Lookup cost does not grow with table size the way tree depth does. The price: hashing scatters neighbouring keys, so the index can answer <em>only</em> exact equality." },
              { t: "table", headers: ["Query shape", "B-tree", "Hash"], rows: [
                ["WHERE k = 42", "Yes, O(log n) descent", "Yes, one bucket"],
                ["WHERE k BETWEEN 10 AND 20", "Yes", "No"],
                ["ORDER BY k / MIN / MAX", "Yes, from the order", "No"],
                ["WHERE name LIKE 'abc%'", "Yes (with a suitable collation or operator class)", "No"],
                ["UNIQUE constraint", "Yes", "Not in Postgres"],
                ["Multi-column", "Yes, leftmost prefix", "Postgres: single column only"]
              ] },
              { t: "h", text: "Why the B-tree usually wins anyway" },
              { t: "stat", items: [
                { v: "~200\u2013500", k: "typical B-tree fanout per 8\u201316 KB page" },
                { v: "3\u20134", k: "levels for ~1 billion keys" },
                { v: "~1", k: "uncached page reads per lookup either way" }
              ] },
              { t: "p", html: "With a fanout of a few hundred, the top two or three levels of a B-tree are a few megabytes and stay in memory. A point lookup then costs about one uncached leaf read, the same as a hash bucket read. The asymptotic win of hashing rarely shows up on disk, while the B-tree also serves ranges, sorts and prefixes." },
              { t: "h", text: "Where hashing does appear" },
              { t: "ul", items: [
                "<strong>PostgreSQL hash indexes</strong>: WAL-logged and crash-safe since version 10. They store only 4-byte hash codes, so on long keys such as URLs they can be notably smaller than a B-tree.",
                "<strong>MySQL InnoDB</strong>: <code class='tok'>USING HASH</code> is silently a B-tree. Instead, the <em>adaptive hash index</em> builds an in-memory hash over hot B-tree pages automatically; it can become a contention point on some workloads.",
                "<strong>Log-structured key-value stores</strong>: an in-memory hash map from key to file offset, with all data in append-only files on disk.",
                "<strong>Hash joins and hash aggregation</strong>: the engine builds a temporary hash table at query time, which is the most common use of hashing in a database."
              ] },
              { t: "code", lang: "sql", code:
                "CREATE INDEX short_links_url_hash ON short_links USING hash (long_url);\n" +
                "SELECT code FROM short_links WHERE long_url = 'shop.example/p/123?ref=mail';  -- hash lookup\n" +
                "SELECT code FROM short_links WHERE long_url LIKE 'shop.example/%';  -- cannot use it"
              },
              { t: "note", variant: "trap", html: "Disk-based hash tables must grow. Postgres splits buckets incrementally as the index fills, but heavy skew (many rows with the same value) piles into overflow pages and degrades lookups. Hash indexes like distinct keys." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \u201conly ever looked up by exact value\u201d, \u201ckey is a long string\u201d, \u201cnever sorted or ranged\u201d. Even then, say why a B-tree is still a fine default." },
              { t: "note", variant: "key", html: "<strong>Hash gives exact-match only; the B-tree gives exact-match at roughly the same disk cost plus ranges, order and prefixes.</strong> Reach for hash only for long, equality-only keys." }
            ]
          },
          {
            id: "gin-gist",
            title: "GIN, GiST and BRIN: indexes for documents, shapes and huge tables",
            summary: "Inverted indexes for elements inside values, generalized search trees for overlap and nearest-neighbour, and block-range summaries for naturally ordered data.",
            minutes: 12,
            tags: ["gin", "gist", "brin", "jsonb", "full-text", "postgres"],
            blocks: [
              { t: "p", html: "A B-tree indexes a column's whole value with a total order. Many questions do not fit that: <em>which documents contain this word</em>, <em>which ranges overlap this one</em>, <em>which points are nearest</em>. PostgreSQL ships several access methods for these shapes; the three to know are GIN, GiST and BRIN." },
              { t: "h", text: "GIN: an inverted index" },
              { t: "p", html: "GIN splits each value into <strong>elements</strong> (words of a tsvector, items of an array, keys and values of a jsonb document) and stores a B-tree of elements, each pointing to a posting list (or posting tree) of row ids. A query for <code class='tok'>tags @&gt; ARRAY['db']</code> reads one posting list instead of every row." },
              { t: "ul", items: [
                "Great for containment and membership: <code class='tok'>@&gt;</code>, <code class='tok'>?</code>, <code class='tok'>&amp;&amp;</code>, full-text <code class='tok'>@@</code>, trigram <code class='tok'>LIKE '%foo%'</code> with pg_trgm.",
                "Expensive to update: one row with 50 words touches 50 posting lists. The <code class='tok'>fastupdate</code> pending list (bounded by <code class='tok'>gin_pending_list_limit</code>, 4 MB by default) batches insertions until VACUUM or overflow merges them.",
                "For jsonb, <code class='tok'>jsonb_path_ops</code> is smaller and faster for <code class='tok'>@&gt;</code> but supports fewer operators than the default <code class='tok'>jsonb_ops</code>."
              ] },
              { t: "h", text: "GiST: a balanced tree of overlapping predicates" },
              { t: "p", html: "GiST generalises the B-tree: each internal entry holds a predicate such as a bounding box that covers everything beneath it. Boxes may overlap, so a search can descend several branches, and results are rechecked. It powers geometric search (PostGIS), range types, nearest-neighbour ordering with <code class='tok'>ORDER BY location &lt;-&gt; point</code>, and exclusion constraints." },
              { t: "code", lang: "sql", code:
                "-- no two bookings of the same room may overlap in time\n" +
                "CREATE EXTENSION IF NOT EXISTS btree_gist;\n" +
                "ALTER TABLE bookings ADD CONSTRAINT no_double_booking\n" +
                "  EXCLUDE USING gist (room_id WITH =, during WITH &&);\n\n" +
                "-- documents containing a key/value pair\n" +
                "CREATE INDEX docs_attrs_gin ON docs USING gin (attrs jsonb_path_ops);\n" +
                "SELECT id FROM docs WHERE attrs @> '{\"color\": \"red\"}';"
              },
              { t: "h", text: "BRIN: a summary per block range" },
              { t: "p", html: "BRIN stores one small summary, usually min and max, for each range of heap pages (128 pages, about 1 MB, by default). A query skips every range whose summary cannot match. On a 1 TB append-only events table keyed by time, the BRIN index can be on the order of megabytes where a B-tree would be tens of gigabytes." },
              { t: "code", lang: "sql", code:
                "CREATE INDEX events_ts_brin ON events USING brin (created_at) WITH (pages_per_range = 64);\n" +
                "SELECT count(*) FROM events WHERE created_at >= '2026-10-01' AND created_at < '2026-10-02';\n" +
                "-- Bitmap Heap Scan: only block ranges whose [min,max] overlaps the day, rows rechecked"
              },
              { t: "note", variant: "warn", html: "BRIN only works when values correlate with physical row order. Bulk updates, random-order backfills or heavy churn widen every range's min/max until nothing is pruned. Check <code class='tok'>pg_stats.correlation</code> for the column; close to 1 or -1 is what you want." },
              { t: "table", headers: ["Access method", "Best for", "Lossy?", "Write cost"], rows: [
                ["B-tree", "Equality, ranges, sorting on scalar columns", "No", "Moderate"],
                ["GIN", "Elements inside values: jsonb, arrays, full text, trigrams", "Can be (some operator classes recheck)", "High (mitigated by pending list)"],
                ["GiST", "Overlap, containment, nearest-neighbour, exclusion", "Often (recheck)", "Moderate"],
                ["SP-GiST", "Non-overlapping partitions: quadtrees, radix tries", "Sometimes", "Moderate"],
                ["BRIN", "Huge tables physically ordered by the column", "Yes, block-range granularity", "Very low"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \u201csearch inside JSON or tags\u201d (GIN), \u201cno overlapping reservations\u201d or \u201cnearest store\u201d (GiST), \u201cbillions of time-series rows, queries by time window, index too big\u201d (BRIN)." },
              { t: "note", variant: "key", html: "<strong>Match the access method to the question.</strong> GIN looks up elements inside values, GiST searches overlapping shapes, BRIN skips block ranges of naturally ordered data at almost no write cost." }
            ]
          },
          {
            id: "bitmap-indexes",
            title: "Bitmap indexes and bitmap heap scans",
            summary: "Stored per-value bitmaps for read-mostly analytics, and Postgres's runtime bitmaps that combine indexes and read each heap page once.",
            minutes: 10,
            tags: ["bitmap-index", "bitmap-heap-scan", "work-mem", "analytics"],
            blocks: [
              { t: "p", html: "\u201cBitmap\u201d means two different things in databases. A <strong>bitmap index</strong> is a stored structure: one bit array per distinct value. A <strong>bitmap scan</strong> is a runtime strategy: build a temporary bitmap of matching row locations from ordinary indexes, then visit the table in physical order. Know both, and say which you mean." },
              { t: "h", text: "Stored bitmap indexes" },
              { t: "p", html: "For a <code class='tok'>region</code> column with 4 values over 10 million rows, the index is 4 bitmaps of 10 million bits each, about 1.25 MB per value before compression. <code class='tok'>region = 'EU' AND channel = 'web'</code> becomes a bitwise AND of two bitmaps, which CPUs do 64 or more rows per instruction. Run-length style compression (WAH, Roaring and similar) shrinks sparse or clustered bitmaps dramatically." },
              { t: "compare",
                bad: { title: "Bitmap index on an OLTP table", items: ["One bit change rewrites part of a compressed bitmap", "In Oracle, DML locks a bitmap segment covering many rows, so concurrent updates block each other", "High-cardinality columns explode into millions of tiny bitmaps"] },
                good: { title: "Bitmap index in a warehouse", items: ["Low-cardinality columns, read-mostly data, batch loads", "Ad-hoc AND/OR combinations across many columns", "Counts answered from bitmaps without touching rows"] } },
              { t: "h", text: "PostgreSQL bitmap scans" },
              { t: "p", html: "Postgres has no stored bitmap index. Instead, a <strong>Bitmap Index Scan</strong> walks an ordinary index and sets a bit per matching tuple in memory; <strong>BitmapAnd</strong> / <strong>BitmapOr</strong> combine bitmaps from several indexes; then a <strong>Bitmap Heap Scan</strong> reads the marked heap pages in block order, each page once, turning random I/O into mostly sequential I/O." },
              { t: "code", lang: "text", code:
                "EXPLAIN (ANALYZE) SELECT * FROM orders WHERE status = 'open' AND region = 'EU';\n\n" +
                "Bitmap Heap Scan on orders  (actual rows=41890 loops=1)\n" +
                "  Recheck Cond: ((status = 'open') AND (region = 'EU'))\n" +
                "  Heap Blocks: exact=2100 lossy=9800\n" +
                "  ->  BitmapAnd\n" +
                "        ->  Bitmap Index Scan on orders_status_idx\n" +
                "        ->  Bitmap Index Scan on orders_region_idx"
              },
              { t: "p", html: "The bitmap lives in <code class='tok'>work_mem</code>. When it would exceed it, Postgres switches parts of the bitmap from one bit per tuple to one bit per heap page. Those pages are <em>lossy</em>: every row on them is read and the condition rechecked. Lossy blocks in EXPLAIN mean either more memory or a more selective predicate would help." },
              { t: "table", headers: ["Fraction of rows matched", "Typical plan", "Why"], rows: [
                ["Tiny (a handful of rows)", "Index Scan", "A few random heap reads are cheapest; also preserves index order"],
                ["Small to moderate", "Bitmap Heap Scan", "Each page read once in physical order; can combine indexes"],
                ["Large", "Seq Scan", "Reading everything sequentially beats any index"]
              ] },
              { t: "note", variant: "tip", html: "The crossover points are not fixed percentages; they depend on <code class='tok'>random_page_cost</code>, caching and physical correlation. On SSDs with a lowered random_page_cost, index and bitmap scans stay attractive for larger fractions." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \u201cfilters on several low-cardinality columns in any combination\u201d (stored bitmaps in a warehouse, or bitmap AND in Postgres), \u201cplan shows Recheck Cond and lossy blocks\u201d (work_mem)." },
              { t: "note", variant: "key", html: "<strong>Stored bitmap indexes are for read-mostly, low-cardinality analytics; Postgres bitmap scans are a runtime trick to combine indexes and read each heap page once.</strong> Lossy blocks mean the bitmap ran out of work_mem." }
            ]
          },
          {
            id: "vector-indexes",
            title: "Vector indexes: IVF, HNSW and the recall trade-off",
            summary: "Nearest-neighbour search over embeddings, why exact search does not scale, how IVF, product quantization and HNSW trade recall for speed, and the filtering problem.",
            minutes: 10,
            tags: ["vector", "ann", "hnsw", "ivf", "pgvector", "embeddings"],
            blocks: [
              { t: "p", html: "Search by meaning, recommendations and retrieval for language models all reduce to one query: <strong>given a vector, find the k stored vectors closest to it</strong>. Embeddings typically have hundreds to a few thousand dimensions, and closeness is cosine similarity, inner product or Euclidean distance. B-trees cannot help: there is no single sort order that keeps nearby points in high dimensions next to each other." },
              { t: "h", text: "Exact search and why it stops scaling" },
              { t: "p", html: "Exact k-nearest-neighbour search compares the query with every vector: N \u00d7 d multiply-adds. Ten million 768-dimension float vectors are about 30 GB and 7.7 billion operations per query. That is fine for thousands of rows and some batch jobs, too slow for interactive search at scale. <strong>Approximate nearest neighbour (ANN)</strong> indexes accept missing a few true neighbours in exchange for orders of magnitude less work. Their quality is measured as <strong>recall@k</strong>: the fraction of the true top k that the index returns." },
              { t: "h", text: "IVF: cluster, then search only nearby clusters" },
              { t: "p", html: "An inverted-file index runs k-means to pick <em>nlist</em> centroids and stores each vector in the list of its nearest centroid. A query first ranks the centroids, then scans only the <strong>nprobe</strong> closest lists. Vectors near a cluster boundary may live in a list you did not probe, which is where recall is lost. Raising nprobe buys recall back at proportional cost." },
              { t: "widget", id: "idxAnn" },
              { t: "h", text: "Product quantization: making vectors small" },
              { t: "p", html: "PQ splits each vector into m sub-vectors and replaces each one with the id of its nearest entry in a small learned codebook (often 256 entries, so one byte). A 768-dimension float vector of 3 KB can shrink to 96 bytes, so far more of the index fits in memory, and distances are computed from precomputed tables. The cost is approximation error, usually repaired by re-ranking the best candidates with full vectors. IVF and PQ are commonly combined." },
              { t: "h", text: "HNSW: a navigable graph" },
              { t: "p", html: "Hierarchical navigable small world indexes link each vector to roughly <em>M</em> close neighbours, in several layers: the top layers are sparse with long links, the bottom layer contains everything. A search enters at the top, greedily walks toward the query, drops a layer and repeats, keeping a candidate list of size <strong>ef_search</strong> at the bottom. It gives excellent recall at low latency, which is why it is the default in many systems, but it stores a lot of graph edges, is slow to build (<em>ef_construction</em> controls build quality), and handles deletes by marking and later rebuilding." },
              { t: "table", headers: ["", "Flat (exact)", "IVF (+PQ)", "HNSW"], rows: [
                ["Recall", "100%", "Tunable with nprobe", "High; tunable with ef_search"],
                ["Query cost", "Every vector", "nprobe lists", "Roughly logarithmic graph walk"],
                ["Memory", "Raw vectors", "Low, very low with PQ", "Raw vectors plus edges, highest"],
                ["Build", "None", "Needs training data for k-means", "Slow, incremental inserts are fine"],
                ["Main knob", "None", "nlist, nprobe", "M, ef_construction, ef_search"]
              ] },
              { t: "code", lang: "sql", code:
                "-- pgvector: store embeddings next to the rows they describe\n" +
                "CREATE EXTENSION IF NOT EXISTS vector;\n" +
                "ALTER TABLE docs ADD COLUMN embedding vector(768);\n\n" +
                "CREATE INDEX ON docs USING hnsw (embedding vector_cosine_ops)\n" +
                "  WITH (m = 16, ef_construction = 64);\n" +
                "-- or: USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1000);\n\n" +
                "SET hnsw.ef_search = 100;              -- recall versus latency, per session\n" +
                "SELECT id, title FROM docs\n" +
                "ORDER BY embedding <=> :query_vec      -- cosine distance\n" +
                "LIMIT 10;" },
              { t: "note", variant: "trap", html: "<strong>Filtered vector search is the hard part.</strong> <code class='tok'>WHERE tenant_id = 7 ORDER BY embedding &lt;=&gt; :q LIMIT 10</code> with a post-filter can return fewer than 10 rows, because the index found the 10 globally nearest and most belonged to other tenants. Options: raise ef_search or nprobe, partition the index per tenant, use an engine with filter-aware graph traversal, or pre-filter and search exactly when the filtered set is small." },
              { t: "ul", items: [
                "Dedicated vector databases (and libraries such as FAISS) focus on ANN at scale; general databases (pgvector, Elasticsearch and OpenSearch, Redis, many warehouses) add vector indexes beside ordinary data.",
                "Disk-oriented graph indexes in the DiskANN family keep compressed vectors in memory and full vectors on SSD for billion-scale sets.",
                "Normalise vectors once if you use cosine similarity; inner product on normalised vectors is equivalent and cheaper."
              ] },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Answer to \"semantic search over 50M documents\"", "Why"], rows: [
                ["Naive", "Store embeddings and compute similarity against all of them.", "Linear scan per query"],
                ["Solid", "HNSW or IVF index, tuned for recall@10 against a latency budget, with exact re-ranking.", "Names the trade-off and how to measure it"],
                ["Standout", "Also sizes memory (vectors plus graph or PQ codes), plans for filtered queries per tenant, and re-indexes as the embedding model changes.", "Thinks about operations, not just the algorithm"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"embeddings\", \"semantic search\", \"similar items\", \"RAG\", \"nearest neighbours\", \"pgvector is slow\". Ask about recall target, latency budget, data size in memory, and whether queries also filter by attributes." },
              { t: "note", variant: "key", html: "<strong>Vector indexes trade recall for speed.</strong> IVF scans the nprobe nearest clusters, PQ compresses vectors into codes, HNSW walks a layered neighbour graph; measure recall@k against exact search, and plan explicitly for filtered queries." }
            ]
          },
          {
            id: "bloom-filters",
            title: "Bloom filters: \u201cdefinitely not\u201d in a few bits per key",
            summary: "A bit array and k hash functions that never give false negatives, the false-positive math, and where engines use them: LSM reads, joins and multi-column signatures.",
            minutes: 12,
            tags: ["bloom-filter", "probabilistic", "lsm", "false-positive-rate"],
            blocks: [
              { t: "p", html: "A bloom filter is an m-bit array plus k hash functions. <strong>Insert</strong> sets the k bits a key hashes to. <strong>Lookup</strong> checks those k bits: if any is 0 the key was <em>definitely never inserted</em>; if all are 1 it <em>may</em> have been. No false negatives, a tunable rate of false positives, and no way to list or delete keys." },
              { t: "h", text: "The math you should be able to derive" },
              { t: "code", lang: "text", code:
                "After n inserts into m bits with k hashes:\n" +
                "  P(a given bit is still 0)   = (1 - 1/m)^(kn)  ~= e^(-kn/m)\n" +
                "  false-positive rate p       ~= (1 - e^(-kn/m))^k\n" +
                "  optimal k                   = (m/n) * ln 2   ~= 0.693 * m/n\n" +
                "  at optimal k: p ~= 0.6185^(m/n), i.e. m/n ~= -1.44 * log2(p)\n\n" +
                "Worked example: n = 1,000,000 keys, m = 10,000,000 bits (1.25 MB), k = 7\n" +
                "  kn/m = 0.7,  e^-0.7 ~= 0.497,  p ~= (0.503)^7 ~= 0.0082  (about 0.8%)"
              },
              { t: "stat", items: [
                { v: "~9.6", k: "bits per key for 1% false positives" },
                { v: "~14.4", k: "bits per key for 0.1%" },
                { v: "~4.8", k: "extra bits per key for each 10x better" }
              ] },
              { t: "p", html: "Every additional ~4.8 bits per key cuts the false-positive rate by 10x. Adding hash functions beyond the optimum makes things worse: each insert sets more bits, the array saturates and almost every lookup returns \u201cmaybe\u201d." },
              { t: "widget", id: "idxBloom" },
              { t: "h", text: "Where engines use them" },
              { t: "ul", items: [
                "<strong>LSM storage (RocksDB, Cassandra, and others)</strong>: one filter per SSTable, kept in memory. A point read for a missing key skips every file whose filter says no, instead of a disk read per level. Around 10 bits per key is a common setting in RocksDB; Cassandra exposes the target false-positive chance per table.",
                "<strong>Range scans cannot use a whole-key filter</strong>, because a range names no single key. Prefix bloom filters (hashing a key prefix) restore some benefit for prefix-bounded scans.",
                "<strong>Joins</strong>: many analytic engines build a bloom filter from a hash join's build side and push it into the probe-side scan, discarding non-matching rows before they are shuffled or joined.",
                "<strong>Columnar files</strong>: Parquet can store bloom filters per column chunk so a point predicate skips row groups that min/max statistics cannot rule out.",
                "<strong>PostgreSQL bloom extension</strong>: a signature index over many columns that serves equality on any combination of them, where separate B-trees would be too many."
              ] },
              { t: "note", variant: "trap", html: "You cannot delete from a plain bloom filter: clearing a bit may also clear it for another key and create a false negative. Counting bloom filters (small counters instead of bits) or rebuilding on compaction, as LSM engines do, solve that." },
              { t: "table", headers: ["Tier", "Answer to \u201csize a filter for 100 M keys\u201d"], rows: [
                ["Naive", "Pick m and k by feel, or use many hash functions to be safe"],
                ["Solid", "Choose a target rate (say 1%), so about 9.6 bits per key, about 120 MB, k = 7"],
                ["Standout", "Tie the rate to the cost of a false positive (one wasted disk read), note memory per SSTable level, and mention prefix filters for range-heavy reads"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \u201cmost lookups are for keys that do not exist\u201d, \u201cavoid a disk read per level\u201d, \u201ccheap membership pre-check before an expensive operation\u201d, \u201cusername already taken?\u201d at huge scale." },
              { t: "quiz", id: "idx-beyond" },
              { t: "note", variant: "key", html: "<strong>p \u2248 (1 \u2212 e^(\u2212kn/m))^k, best k = (m/n)\u00b7ln 2, about 10 bits per key buys about 1%.</strong> A bloom filter never misses a present key; it only saves work on absent ones." }
            ]
          }
        ]
      },
      {
        id: "design",
        name: "Index Design",
        icon: "wrench",
        lessons: [
          {
            id: "index-tradeoffs",
            title: "Index trade-offs: write amplification and the cost of every index",
            summary: "Each index turns one logical write into several page writes, competes for cache and slows the planner; how to count the cost and find indexes to drop.",
            minutes: 11,
            tags: ["write-amplification", "unused-indexes", "hot-updates", "change-buffer"],
            blocks: [
              { t: "p", html: "An index is a second copy of some columns, kept sorted, maintained synchronously inside your write transaction. Reads get cheaper; <strong>every insert, every delete and many updates get more expensive</strong>, and the cost is paid on the hot path, not in the background." },
              { t: "h", text: "Counting the write cost" },
              { t: "code", lang: "text", code:
                "INSERT one row into a table with 8 indexes (PostgreSQL):\n" +
                "  heap:    1 tuple into a heap page            -> 1 page dirtied + WAL record\n" +
                "  indexes: 8 B-tree descents + 8 leaf inserts   -> 8 pages dirtied + 8 WAL records\n" +
                "  unique:  each unique index must read its leaf to check for duplicates\n" +
                "  splits:  occasional leaf splits write 2-3 more pages\n" +
                "  first change to a page after a checkpoint may log the full page image\n" +
                "~= 9+ page modifications for one logical row"
              },
              { t: "table", headers: ["Engine behaviour", "PostgreSQL", "MySQL InnoDB"], rows: [
                ["UPDATE of a non-indexed column", "HOT update if it fits on the same page: no index writes; otherwise a new entry in every index", "Clustered row updated in place; secondaries untouched"],
                ["UPDATE of an indexed column", "New entries in every index (old ones cleaned later by VACUUM)", "Delete-mark plus insert in the affected secondaries only"],
                ["Deferring secondary work", "GIN pending list only", "Change buffer delays changes to non-unique secondary pages that are not in memory"],
                ["Dead index entries", "Removed by VACUUM", "Purged by background purge threads"]
              ] },
              { t: "stat", items: [
                { v: "1 + N", k: "page writes per insert with N indexes" },
                { v: "0", k: "index writes for a HOT update" },
                { v: "fillfactor", k: "spare heap room that keeps updates HOT" }
              ] },
              { t: "h", text: "Costs that do not show up in the write path" },
              { t: "ul", items: [
                "<strong>Memory</strong>: index pages compete with table pages for the buffer pool; ten indexes can easily be larger than the table.",
                "<strong>Planning</strong>: more candidate indexes mean more paths to cost; usually small, noticeable for very short queries.",
                "<strong>Operations</strong>: building, rebuilding and vacuuming each index; use <code class='tok'>CREATE INDEX CONCURRENTLY</code> in Postgres to avoid blocking writes, at the cost of two table scans.",
                "<strong>Redundancy</strong>: an index on <code class='tok'>(a)</code> is usually redundant next to <code class='tok'>(a, b)</code>, which serves every query on <code class='tok'>a</code> as well."
              ] },
              { t: "code", lang: "sql", code:
                "-- PostgreSQL: indexes never scanned since stats were last reset\n" +
                "SELECT schemaname, relname, indexrelname, idx_scan,\n" +
                "       pg_size_pretty(pg_relation_size(indexrelid)) AS size\n" +
                "FROM pg_stat_user_indexes\n" +
                "WHERE idx_scan = 0\n" +
                "ORDER BY pg_relation_size(indexrelid) DESC;\n\n" +
                "-- MySQL: sys schema helper\n" +
                "SELECT * FROM sys.schema_unused_indexes;"
              },
              { t: "note", variant: "warn", html: "Before dropping an \u201cunused\u201d index, check every replica (stats are per server), how long ago stats were reset, monthly or quarterly jobs, and whether it backs a unique or foreign-key constraint. Making it invisible first (MySQL <code class='tok'>ALTER INDEX ... INVISIBLE</code>) gives you a cheap undo." },
              { t: "table", headers: ["Tier", "Answer to \u201cthis query is slow, add an index?\u201d"], rows: [
                ["Naive", "Add an index for every slow query"],
                ["Solid", "Design the index for the query's predicates and sort, check it replaces rather than duplicates an existing one"],
                ["Standout", "Quantify the write cost on the table's insert and update rate, check HOT eligibility, and drop a redundant index in the same change"]
              ] },
              { t: "note", variant: "key", html: "<strong>Every index is a tax on every write and on cache, paid synchronously.</strong> Add indexes for measured query patterns, and remove the ones nobody scans." }
            ]
          },
          {
            id: "partial-expression-indexes",
            title: "Partial and expression indexes",
            summary: "Index only the rows you query, or a computed value instead of the raw column; small, precise indexes with planner rules you must respect.",
            minutes: 10,
            tags: ["partial-index", "expression-index", "functional-index", "unique"],
            blocks: [
              { t: "p", html: "Two ways to make an index smaller and more precise. A <strong>partial index</strong> indexes only rows matching a WHERE clause. An <strong>expression index</strong> indexes the result of an expression, such as <code class='tok'>lower(email)</code>, instead of the raw column. Both trade generality for size and write cost." },
              { t: "h", text: "Partial indexes" },
              { t: "code", lang: "sql", code:
                "-- 50 M jobs, only ~2,000 pending at any moment\n" +
                "CREATE INDEX jobs_pending_run_at ON jobs (run_at) WHERE status = 'pending';\n\n" +
                "SELECT id FROM jobs WHERE status = 'pending' AND run_at < now()\n" +
                "ORDER BY run_at LIMIT 100;              -- uses the tiny index\n\n" +
                "-- uniqueness only among live rows (soft delete)\n" +
                "CREATE UNIQUE INDEX users_email_live ON users (email) WHERE deleted_at IS NULL;"
              },
              { t: "ul", items: [
                "Size and write cost scale with the matching rows only: rows that never match never touch the index.",
                "The planner uses it only if it can <strong>prove</strong> the query's WHERE implies the index predicate. A literal <code class='tok'>status = 'pending'</code> works; <code class='tok'>status = $1</code> under a generic prepared plan does not.",
                "Partial unique indexes express rules like \u201cone active subscription per user\u201d that a plain constraint cannot.",
                "PostgreSQL and SQLite support partial indexes; SQL Server calls them filtered indexes. MySQL has none, though an expression index can approximate some cases."
              ] },
              { t: "h", text: "Expression indexes" },
              { t: "code", lang: "sql", code:
                "CREATE INDEX users_email_lower ON users (lower(email));\n" +
                "SELECT id FROM users WHERE lower(email) = lower('Ana@Shop.example');  -- index used\n" +
                "SELECT id FROM users WHERE email = 'ana@shop.example';                -- different expression, not used\n\n" +
                "-- PostgreSQL rejects non-immutable expressions:\n" +
                "CREATE INDEX ON events (date_trunc('day', ts));   -- ts timestamptz: depends on TimeZone -> error\n" +
                "CREATE INDEX ON events ((date_trunc('day', ts AT TIME ZONE 'UTC')));  -- immutable, allowed"
              },
              { t: "ul", items: [
                "The query must use the <strong>same expression</strong> the index was built on; the planner matches expressions, it does not reason about them.",
                "In Postgres the expression must be <code class='tok'>IMMUTABLE</code>, because a stored entry must stay correct forever.",
                "ANALYZE collects statistics on indexed expressions, which can fix bad row estimates for queries on <code class='tok'>lower(email)</code> and similar.",
                "MySQL 8.0.13+ supports functional key parts; earlier versions index a generated column instead."
              ] },
              { t: "compare",
                bad: { title: "Fighting the index", items: ["WHERE lower(email) = ? with an index on email", "WHERE status = $1 hoping a partial index on 'pending' applies", "Indexing a timestamptz day bucket and hitting the IMMUTABLE error"] },
                good: { title: "Matching the index", items: ["Index exactly the expression the query uses", "Literal predicate that implies the partial index's WHERE", "Normalise to a fixed time zone inside the indexed expression"] } },
              { t: "note", variant: "tip", html: "Partial indexes shine on skewed status columns: queues, unprocessed events, open tickets. The hot subset is tiny, the index stays in memory, and the millions of finished rows cost nothing on write." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \u201conly a small fraction of rows are ever queried\u201d, \u201cunique except for deleted rows\u201d, \u201ccase-insensitive lookup\u201d, \u201cfilter on a computed value is slow\u201d." },
              { t: "quiz", id: "idx-design" },
              { t: "note", variant: "key", html: "<strong>Index only the rows you query and the exact expression you filter on.</strong> The planner must be able to prove the partial predicate and match the expression verbatim." }
            ]
          }
        ]
      }
    ]
  };
})();
