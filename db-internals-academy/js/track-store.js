/* =====================================================================
   LEDGER · Storage Engines
   window.TRACKS.store — modules: pages / btree / lsm / durability

   Self-contained: registers its own widgets (storeBtree, storeLsm,
   storeBufferPool), its own quizzes and its own track data.
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
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function svg(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (attrs[k] != null) el.setAttribute(k, String(attrs[k]));
    }
    if (text != null) el.appendChild(document.createTextNode(String(text)));
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
  function btn(label, cls, onClick) {
    var b = h("button", { type: "button", class: "w-btn" + (cls ? " " + cls : "") }, label);
    b.addEventListener("click", onClick);
    return b;
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function pad2(n) { return n < 10 ? "0" + n : String(n); }

  var Widgets = {};

  /* ------------------------------------------------------------------
     storeBtree — B+tree insert / split visualizer
     Leaf split: lower half stays, upper half moves right, the first key
     of the right leaf is COPIED into the parent. Internal split: the
     middle key is PUSHED into the parent and kept in neither half.
     ------------------------------------------------------------------ */
  Widgets.storeBtree = function (mount) {
    shell(mount, "flagship", "B+tree insert and split visualizer",
      "Pick an order (the maximum number of children per node), then insert keys. Watch leaves split and copy a separator up, internal nodes split and push their middle key up, and the tree grow taller only when the root splits.");
    var SCRIPT = [10, 20, 30, 40, 50, 25, 35, 5, 15, 45, 27, 33, 60, 8, 12, 70, 22, 38, 55, 3, 65, 18, 42, 48, 75, 28, 1, 52, 80, 36, 58, 14, 44, 68, 31, 6, 90, 24, 47, 63];
    var MAX_KEYS = 40;
    var order = 4;
    var tree, inserted, splits, leafSplits, internalSplits, scriptPos, seed, lastMsg, touched, fresh, nid;

    function newNode(leaf) { nid++; return { id: nid, leaf: leaf, keys: [], children: [], next: null }; }
    function resetTree() {
      nid = 0;
      tree = { root: newNode(true), height: 1 };
      inserted = []; splits = 0; leafSplits = 0; internalSplits = 0;
      touched = {}; fresh = {};
    }
    function resetAll() {
      resetTree();
      scriptPos = 0; seed = 7;
      lastMsg = "Empty tree: the root is a single empty leaf. Insert a key to begin.";
    }

    function insertInParent(path, left, sep, right, msgs) {
      var maxK = order - 1;
      if (!path.length) {
        var root = newNode(false);
        root.keys = [sep]; root.children = [left, right];
        tree.root = root; tree.height++;
        fresh[root.id] = 1;
        msgs.push("the root split, so a new root [" + sep + "] is created and the height becomes " + tree.height);
        return;
      }
      var parent = path.pop();
      var idx = parent.children.indexOf(left);
      if (idx < 0) idx = parent.children.length - 1;
      parent.keys.splice(idx, 0, sep);
      parent.children.splice(idx + 1, 0, right);
      fresh[parent.id] = 1;
      if (parent.keys.length <= maxK) {
        msgs.push("parent now routes with [" + parent.keys.join(" ") + "]");
        return;
      }
      var mid = Math.floor(parent.keys.length / 2);
      var up = parent.keys[mid];
      var nr = newNode(false);
      nr.keys = parent.keys.slice(mid + 1);
      nr.children = parent.children.slice(mid + 1);
      parent.keys = parent.keys.slice(0, mid);
      parent.children = parent.children.slice(0, mid + 1);
      splits++; internalSplits++;
      fresh[nr.id] = 1;
      msgs.push("internal node overflowed: split into [" + parent.keys.join(" ") + "] | [" + nr.keys.join(" ") + "] and PUSH " + up + " up (it stays in neither half)");
      insertInParent(path, parent, up, nr, msgs);
    }

    function insert(key) {
      var maxK = order - 1;
      touched = {}; fresh = {};
      var path = [];
      var node = tree.root;
      while (!node.leaf) {
        touched[node.id] = 1;
        path.push(node);
        var i = 0;
        while (i < node.keys.length && key >= node.keys[i]) i++;
        node = node.children[i];
      }
      touched[node.id] = 1;
      if (node.keys.indexOf(key) >= 0) return "Key " + key + " is already present; this tree stores unique keys.";
      var pos = 0;
      while (pos < node.keys.length && node.keys[pos] < key) pos++;
      node.keys.splice(pos, 0, key);
      inserted.push(key);
      var msgs = ["Inserted " + key + " (search path visited " + (path.length + 1) + " node" + (path.length ? "s" : "") + ")"];
      if (node.keys.length <= maxK) {
        msgs.push("leaf [" + node.keys.join(" ") + "] has room, no split");
        return msgs.join("; ") + ".";
      }
      var cut = Math.floor(node.keys.length / 2);
      var right = newNode(true);
      right.keys = node.keys.slice(cut);
      node.keys = node.keys.slice(0, cut);
      right.next = node.next; node.next = right;
      splits++; leafSplits++;
      fresh[node.id] = 1; fresh[right.id] = 1;
      msgs.push("leaf overflowed (" + (maxK + 1) + " keys > max " + maxK + "): split into [" + node.keys.join(" ") + "] | [" + right.keys.join(" ") + "] and COPY " + right.keys[0] + " up (it stays in the right leaf)");
      insertInParent(path, node, right.keys[0], right, msgs);
      return msgs.join("; ") + ".";
    }

    function maxKey() {
      var m = 0;
      for (var i = 0; i < inserted.length; i++) if (inserted[i] > m) m = inserted[i];
      return m;
    }
    function nextRandom() {
      for (var tries = 0; tries < 300; tries++) {
        seed = (seed * 48271) % 2147483647;
        var k = 1 + (seed % 99);
        if (inserted.indexOf(k) < 0) return k;
      }
      return maxKey() + 1;
    }
    function nextScripted() {
      while (scriptPos < SCRIPT.length && inserted.indexOf(SCRIPT[scriptPos]) >= 0) scriptPos++;
      if (scriptPos < SCRIPT.length) return SCRIPT[scriptPos++];
      return nextRandom();
    }

    function stats() {
      var nodes = 0, leaves = 0, keysInLeaves = 0;
      (function walk(n) {
        nodes++;
        if (n.leaf) { leaves++; keysInLeaves += n.keys.length; return; }
        for (var i = 0; i < n.children.length; i++) walk(n.children[i]);
      })(tree.root);
      return { nodes: nodes, leaves: leaves, internal: nodes - leaves, fill: leaves ? Math.round(100 * keysInLeaves / (leaves * (order - 1))) : 0 };
    }

    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var msgEl = h("p", { style: "font-size:0.86rem;margin:0 0 10px;line-height:1.55;color:var(--text)", "aria-live": "polite" });
    var scroller = h("div", { style: "overflow-x:auto;padding:4px 0" });
    var legend = h("p", { style: "font-size:0.8rem;margin:8px 0 0;color:var(--text-dim);line-height:1.5" },
      "Thick accent outline: nodes on the search path. Rose outline: nodes created or changed by a split. Dashed line: leaf-to-leaf sibling links used by range scans.");
    stage.appendChild(msgEl); stage.appendChild(scroller); stage.appendChild(legend);
    var readout = h("div", { class: "w-readout" });

    var bNext = btn("Insert next key", "primary", function () { if (inserted.length < MAX_KEYS) { lastMsg = insert(nextScripted()); paint(); } });
    var bRand = btn("Insert random key", "", function () { if (inserted.length < MAX_KEYS) { lastMsg = insert(nextRandom()); paint(); } });
    var bAsc = btn("Insert 5 ascending", "", function () {
      var out = [];
      for (var i = 0; i < 5 && inserted.length < MAX_KEYS; i++) { out.push(insert(maxKey() + 1)); }
      lastMsg = out.length ? out[out.length - 1] + " (ascending inserts always hit the rightmost leaf, leaving split-off leaves only partly full.)" : lastMsg;
      paint();
    });
    var bReset = btn("Reset", "ghost", function () { resetAll(); paint(); });

    controls.appendChild(segment([[3, "Order 3"], [4, "Order 4"], [5, "Order 5"]], 1, function (v) {
      var keep = inserted.slice(), sp = scriptPos, sd = seed;
      order = v;
      resetTree();
      for (var i = 0; i < keep.length; i++) insert(keep[i]);
      touched = {}; fresh = {};
      scriptPos = sp; seed = sd;
      lastMsg = "Rebuilt the same " + keep.length + " keys with order " + order + " (max " + (order - 1) + " keys per node): height " + tree.height + ".";
      paint();
    }));
    controls.appendChild(bNext); controls.appendChild(bRand); controls.appendChild(bAsc); controls.appendChild(bReset);
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);

    function draw() {
      clear(scroller);
      var CW = 26, PAD = 5, GAP = 14, LH = 66, NH = 26, TOP = 8;
      var pos = {}, cursor = 10, depthMax = 0, all = [];
      function w(n) { return Math.max(1, n.keys.length) * CW + PAD * 2; }
      function place(n, depth) {
        if (depth > depthMax) depthMax = depth;
        all.push(n);
        if (n.leaf) {
          pos[n.id] = { x: cursor, y: TOP + depth * LH, w: w(n) };
          cursor += w(n) + GAP;
          return;
        }
        for (var i = 0; i < n.children.length; i++) place(n.children[i], depth + 1);
        var f = pos[n.children[0].id], l = pos[n.children[n.children.length - 1].id];
        var cx = (f.x + f.w / 2 + l.x + l.w / 2) / 2;
        pos[n.id] = { x: cx - w(n) / 2, y: TOP + depth * LH, w: w(n) };
      }
      place(tree.root, 0);
      var minX = Infinity, maxX = -Infinity, i, p;
      for (i = 0; i < all.length; i++) { p = pos[all[i].id]; if (p.x < minX) minX = p.x; if (p.x + p.w > maxX) maxX = p.x + p.w; }
      var contentW = maxX - minX;
      var vbW = Math.max(320, contentW + 20);
      var shift = (vbW - contentW) / 2 - minX;
      var vbH = TOP + depthMax * LH + NH + 10;
      var s = svg("svg", { viewBox: "0 0 " + vbW + " " + vbH, width: vbW, height: vbH, role: "img", "aria-label": "B+tree of height " + tree.height });
      s.setAttribute("style", "display:block;margin:0 auto;max-width:none");
      var edges = svg("g", {}), links = svg("g", {}), nodesG = svg("g", {});
      s.appendChild(edges); s.appendChild(links); s.appendChild(nodesG);
      for (i = 0; i < all.length; i++) {
        var n = all[i]; p = pos[n.id];
        var x = p.x + shift;
        if (!n.leaf) {
          for (var c = 0; c < n.children.length; c++) {
            var cp = pos[n.children[c].id];
            var line = svg("line", { x1: x + PAD + c * CW, y1: p.y + NH, x2: cp.x + shift + cp.w / 2, y2: cp.y });
            line.setAttribute("style", "stroke:var(--text-dim);stroke-width:1.2");
            edges.appendChild(line);
          }
        } else if (n.next && pos[n.next.id]) {
          var np = pos[n.next.id];
          var ll = svg("line", { x1: x + p.w, y1: p.y + NH / 2, x2: np.x + shift, y2: np.y + NH / 2 });
          ll.setAttribute("style", "stroke:var(--text-dim);stroke-width:1.2;stroke-dasharray:3 3");
          links.appendChild(ll);
        }
        var stroke = fresh[n.id] ? "var(--rose-ink)" : (touched[n.id] ? "var(--accent-ink)" : "var(--line)");
        var sw = (fresh[n.id] || touched[n.id]) ? 2.4 : 1.2;
        var r = svg("rect", { x: x, y: p.y, width: p.w, height: NH, rx: 5 });
        r.setAttribute("style", "fill:var(--surface-solid);stroke:" + stroke + ";stroke-width:" + sw);
        nodesG.appendChild(r);
        for (var k = 1; k < n.keys.length; k++) {
          var dv = svg("line", { x1: x + PAD + k * CW, y1: p.y + 4, x2: x + PAD + k * CW, y2: p.y + NH - 4 });
          dv.setAttribute("style", "stroke:var(--line);stroke-width:1");
          nodesG.appendChild(dv);
        }
        if (!n.keys.length) {
          var et = svg("text", { x: x + p.w / 2, y: p.y + 17, "text-anchor": "middle" }, "empty");
          et.setAttribute("style", "fill:var(--text-dim);font-size:11px");
          nodesG.appendChild(et);
        }
        for (k = 0; k < n.keys.length; k++) {
          var t = svg("text", { x: x + PAD + k * CW + CW / 2, y: p.y + 17, "text-anchor": "middle" }, n.keys[k]);
          t.setAttribute("style", "fill:var(--text);font-size:12px;font-family:var(--font-mono, monospace);font-weight:" + (n.leaf ? "500" : "700"));
          nodesG.appendChild(t);
        }
      }
      scroller.appendChild(s);
    }

    function paint() {
      msgEl.textContent = lastMsg;
      draw();
      var st = stats();
      var full = inserted.length >= MAX_KEYS;
      bNext.disabled = full; bRand.disabled = full; bAsc.disabled = full;
      clear(readout);
      readout.appendChild(ro("keys", inserted.length + (full ? " (max)" : "")));
      readout.appendChild(ro("nodes", st.nodes + " (" + st.leaves + " leaf, " + st.internal + " internal)"));
      readout.appendChild(ro("height", tree.height));
      readout.appendChild(ro("splits", splits + " (" + leafSplits + " leaf, " + internalSplits + " internal)"));
      readout.appendChild(ro("avg leaf fill", st.fill + "%"));
    }

    resetAll();
    paint();
  };

  /* ------------------------------------------------------------------
     storeLsm — LSM write path and compaction (leveled vs size-tiered)
     ------------------------------------------------------------------ */
  Widgets.storeLsm = function (mount) {
    shell(mount, "flagship", "LSM write path and compaction",
      "Puts land in the memtable; at 4 distinct keys it flushes to an immutable sorted run. Compaction merges runs and keeps only the newest version of each key. Switch strategy to replay the same writes and compare write, read and space amplification. Struck-through keys are obsolete versions still occupying disk.");
    var MEM = 4, L0_TRIGGER = 2, T = 4, BASE = 8, TIER_TRIGGER = 3, KEYSPACE = 40, LEVELS = 4, MAX_PUTS = 240;
    var mode = "leveled", workload = "uniform";
    var S;

    function fresh() {
      return { mem: {}, memN: 0, seq: 0, puts: 0, written: 0, compactions: 0, flushes: 0, rng: 11,
        l0: [], levels: [[], [], [], []], tiers: [[], [], [], []], changed: {}, msg: "Empty store. Put some keys." };
    }
    function nextKey() {
      S.rng = (S.rng * 48271) % 2147483647;
      var r = S.rng % 1000;
      if (workload === "hot" && r < 700) { S.rng = (S.rng * 48271) % 2147483647; return S.rng % 8; }
      S.rng = (S.rng * 48271) % 2147483647;
      return S.rng % KEYSPACE;
    }
    function merge(runs) {
      var best = {};
      for (var i = 0; i < runs.length; i++) {
        for (var j = 0; j < runs[i].length; j++) {
          var e = runs[i][j];
          if (!best[e.k] || best[e.k].s < e.s) best[e.k] = e;
        }
      }
      var out = [];
      for (var k in best) if (Object.prototype.hasOwnProperty.call(best, k)) out.push(best[k]);
      out.sort(function (a, b) { return a.k - b.k; });
      return out;
    }
    function cap(level) { return BASE * Math.pow(T, level - 1); }

    function flush() {
      if (!S.memN) return "Memtable is empty; nothing to flush.";
      var run = [];
      for (var k in S.mem) if (Object.prototype.hasOwnProperty.call(S.mem, k)) run.push({ k: +k, s: S.mem[k] });
      run.sort(function (a, b) { return a.k - b.k; });
      S.mem = {}; S.memN = 0; S.flushes++;
      S.written += run.length;
      S.changed = {};
      var msgs = ["Flushed memtable as a sorted run of " + run.length];
      if (mode === "leveled") {
        S.l0.unshift(run); S.changed["L0-0"] = 1;
        if (S.l0.length >= L0_TRIGGER) {
          var out = merge(S.l0.concat([S.levels[1]]));
          S.written += out.length; S.compactions++;
          msgs.push("L0 hit " + L0_TRIGGER + " files: merged L0 with L1, rewriting " + out.length + " entries");
          S.l0 = []; S.levels[1] = out; S.changed = { "L1-0": 1 };
        }
        for (var lv = 1; lv < LEVELS - 1; lv++) {
          if (S.levels[lv].length > cap(lv)) {
            var o2 = merge([S.levels[lv], S.levels[lv + 1]]);
            S.written += o2.length; S.compactions++;
            msgs.push("L" + lv + " exceeded " + cap(lv) + " entries: merged into L" + (lv + 1) + ", rewriting " + o2.length);
            S.levels[lv] = []; S.levels[lv + 1] = o2; S.changed = {}; S.changed["L" + (lv + 1) + "-0"] = 1;
          }
        }
      } else {
        S.tiers[0].unshift(run); S.changed["T0-0"] = 1;
        for (var t = 0; t < LEVELS; t++) {
          if (S.tiers[t].length >= TIER_TRIGGER) {
            var o3 = merge(S.tiers[t]);
            S.written += o3.length; S.compactions++;
            S.tiers[t] = [];
            var dest = Math.min(t + 1, LEVELS - 1);
            S.tiers[dest].unshift(o3);
            S.changed = {}; S.changed["T" + dest + "-0"] = 1;
            msgs.push("tier " + t + " had " + TIER_TRIGGER + " similar-size runs: merged into one run of " + o3.length + " in tier " + dest);
            if (dest === t) break;
          }
        }
      }
      return msgs.join("; ") + ".";
    }
    function put(n) {
      var last = "";
      for (var i = 0; i < n && S.puts < MAX_PUTS; i++) {
        var k = nextKey();
        S.seq++; S.puts++;
        if (!Object.prototype.hasOwnProperty.call(S.mem, k)) S.memN++;
        S.mem[k] = S.seq;
        last = "Put k" + pad2(k) + " (seq " + S.seq + ") into the memtable.";
        if (S.memN >= MEM) last = flush();
      }
      return last || "Write budget reached; reset to start again.";
    }
    function allRuns() {
      var rows = [];
      if (mode === "leveled") {
        rows.push({ label: "L0", sub: "flushes, overlap", runs: S.l0, key: "L0" });
        for (var i = 1; i < LEVELS; i++) rows.push({ label: "L" + i, sub: i < LEVELS - 1 ? "cap " + cap(i) : "last level", runs: S.levels[i].length ? [S.levels[i]] : [], key: "L" + i });
      } else {
        for (var t = 0; t < LEVELS; t++) rows.push({ label: "Tier " + t, sub: "merge at " + TIER_TRIGGER + " runs", runs: S.tiers[t], key: "T" + t });
      }
      return rows;
    }
    function metrics() {
      var rows = allRuns(), runs = 0, entries = 0, newest = {}, uniq = 0;
      for (var r = 0; r < rows.length; r++) {
        runs += rows[r].runs.length;
        for (var i = 0; i < rows[r].runs.length; i++) {
          var run = rows[r].runs[i];
          entries += run.length;
          for (var j = 0; j < run.length; j++) {
            var e = run[j];
            if (!(e.k in newest)) uniq++;
            if (!(e.k in newest) || newest[e.k] < e.s) newest[e.k] = e.s;
          }
        }
      }
      for (var mk in S.mem) if (Object.prototype.hasOwnProperty.call(S.mem, mk)) { if (!(mk in newest) || newest[mk] < S.mem[mk]) newest[mk] = S.mem[mk]; }
      return { rows: rows, runs: runs, entries: entries, uniq: uniq, newest: newest };
    }

    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var msgEl = h("p", { style: "font-size:0.86rem;margin:0 0 10px;line-height:1.55;color:var(--text)", "aria-live": "polite" });
    var grid = h("div", { style: "display:grid;gap:8px" });
    stage.appendChild(msgEl); stage.appendChild(grid);

    function replay() {
      var n = S ? S.puts : 0;
      S = fresh();
      if (n) { put(n); S.msg = "Replayed the same " + n + " puts under " + (mode === "leveled" ? "leveled" : "size-tiered") + " compaction."; }
      S.changed = {};
    }

    controls.appendChild(segment([["leveled", "Leveled"], ["tiered", "Size-tiered"]], 0, function (v) { mode = v; replay(); paint(); }));
    controls.appendChild(segment([["uniform", "Uniform keys"], ["hot", "Hot keys (updates)"]], 0, function (v) { workload = v; S = fresh(); S.msg = "Workload changed; store reset."; paint(); }));
    controls.appendChild(btn("Put 1", "primary", function () { S.msg = put(1); paint(); }));
    controls.appendChild(btn("Put 8", "", function () { S.msg = put(8); paint(); }));
    controls.appendChild(btn("Flush now", "", function () { S.msg = flush(); paint(); }));
    controls.appendChild(btn("Reset", "ghost", function () { S = fresh(); paint(); }));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);

    function chip(k, stale) {
      return h("span", { style: "display:inline-block;font-family:var(--font-mono, monospace);font-size:0.78rem;padding:1px 4px;margin:1px;border:1px solid var(--line);border-radius:4px;" +
        (stale ? "color:var(--text-dim);text-decoration:line-through" : "color:var(--text)") }, pad2(k));
    }
    function row(label, sub, body) {
      return h("div", { style: "display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;align-items:start" },
        h("div", { style: "font-size:0.82rem;color:var(--text);line-height:1.3" }, h("b", {}, label), h("br"), h("span", { style: "color:var(--text-dim);font-size:0.78rem" }, sub)),
        body);
    }
    function paint() {
      var m = metrics();
      msgEl.textContent = S.msg;
      clear(grid);
      var memBody = h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;min-height:26px" });
      var memKeys = [];
      for (var mk in S.mem) if (Object.prototype.hasOwnProperty.call(S.mem, mk)) memKeys.push(+mk);
      memKeys.sort(function (a, b) { return a - b; });
      var memBox = h("div", { style: "border:1px dashed var(--accent-ink);border-radius:6px;padding:3px 5px;min-width:60px" });
      if (!memKeys.length) memBox.appendChild(h("span", { style: "font-size:0.78rem;color:var(--text-dim)" }, "empty"));
      for (var i = 0; i < memKeys.length; i++) memBox.appendChild(chip(memKeys[i], false));
      memBody.appendChild(memBox);
      grid.appendChild(row("Memtable", "RAM, " + S.memN + "/" + MEM, memBody));
      for (var r = 0; r < m.rows.length; r++) {
        var rw = m.rows[r];
        var body = h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;min-height:26px" });
        if (!rw.runs.length) body.appendChild(h("span", { style: "font-size:0.78rem;color:var(--text-dim);align-self:center" }, "no runs"));
        for (var j = 0; j < rw.runs.length; j++) {
          var hot = S.changed[rw.key + "-" + j];
          var box = h("div", { style: "border:" + (hot ? "2px solid var(--accent-ink)" : "1px solid var(--line)") + ";border-radius:6px;padding:3px 5px;max-width:100%" });
          for (var q = 0; q < rw.runs[j].length; q++) {
            var e = rw.runs[j][q];
            box.appendChild(chip(e.k, m.newest[e.k] > e.s));
          }
          body.appendChild(box);
        }
        grid.appendChild(row(rw.label, rw.sub, body));
      }
      clear(readout);
      readout.appendChild(ro("puts", S.puts));
      readout.appendChild(ro("write amp", S.puts ? (S.written / S.puts).toFixed(2) + "x" : "n/a"));
      readout.appendChild(ro("read amp (runs probed, worst case)", m.runs));
      readout.appendChild(ro("space amp", m.uniq ? (m.entries / m.uniq).toFixed(2) + "x" : "n/a"));
      readout.appendChild(ro("entries on disk", m.entries + " for " + m.uniq + " live keys"));
      readout.appendChild(ro("compactions", S.compactions));
    }

    S = fresh();
    paint();
  };

  /* ------------------------------------------------------------------
     storeBufferPool — LRU vs Clock with dirty write-back
     ------------------------------------------------------------------ */
  Widgets.storeBufferPool = function (mount) {
    shell(mount, "simulator", "Buffer pool: LRU versus Clock",
      "Step through a page request sequence. A request suffixed with w modifies the page, marking its frame dirty; evicting a dirty frame costs a write-back before the new page can be read in.");
    var SEQS = {
      hot: { label: "Hot page + others", reqs: ["1", "2w", "1", "3", "1", "4", "1", "2", "5", "1", "3w", "1", "6", "1", "2"] },
      loop: { label: "Looping scan", reqs: ["1", "2", "3", "4", "1", "2", "3", "4", "1", "2", "3", "4"] },
      mixed: { label: "Mixed reads/writes", reqs: ["1", "2", "3", "1w", "2", "4", "1", "2", "5w", "3", "1", "2w", "4", "5", "1"] }
    };
    var nFrames = 3, policy = "lru", seqKey = "hot";
    var frames, hand, step, hits, misses, writebacks, results, msg;

    function reset() {
      frames = [];
      for (var i = 0; i < nFrames; i++) frames.push({ page: null, dirty: false, ref: 0, used: 0 });
      hand = 0; step = 0; hits = 0; misses = 0; writebacks = 0; results = []; msg = "Pool is empty. Press Step.";
    }
    function doStep() {
      var reqs = SEQS[seqKey].reqs;
      if (step >= reqs.length) { msg = "Sequence finished."; return; }
      var raw = reqs[step], isW = raw.charAt(raw.length - 1) === "w", page = parseInt(raw, 10);
      var t = step + 1, i, idx = -1;
      for (i = 0; i < frames.length; i++) if (frames[i].page === page) idx = i;
      if (idx >= 0) {
        hits++; results.push("hit");
        frames[idx].used = t; frames[idx].ref = 1;
        if (isW) frames[idx].dirty = true;
        msg = "P" + page + " is already in frame " + idx + ": HIT" + (policy === "clock" ? " (reference bit set to 1)." : " (moved to most-recently-used).") + (isW ? " Page modified, frame marked dirty." : "");
      } else {
        misses++; results.push("miss");
        var free = -1;
        for (i = 0; i < frames.length; i++) if (frames[i].page === null) { free = i; break; }
        var victim = free, note = "";
        if (free < 0) {
          if (policy === "lru") {
            victim = 0;
            for (i = 1; i < frames.length; i++) if (frames[i].used < frames[victim].used) victim = i;
            note = "LRU victim is frame " + victim + " (P" + frames[victim].page + ", last used at step " + frames[victim].used + ")";
          } else {
            var cleared = [];
            var guard = 0;
            while (frames[hand].ref === 1 && guard < 2 * frames.length) { frames[hand].ref = 0; cleared.push(hand); hand = (hand + 1) % frames.length; guard++; }
            victim = hand;
            hand = (hand + 1) % frames.length;
            note = (cleared.length ? "clock hand cleared reference bits on frame" + (cleared.length > 1 ? "s " : " ") + cleared.join(", ") + ", then " : "clock hand ") + "evicts frame " + victim + " (P" + frames[victim].page + ")";
          }
          if (frames[victim].dirty) { writebacks++; note += "; it was dirty, so it is written back first"; }
        } else {
          note = "free frame " + free + " used";
        }
        frames[victim] = { page: page, dirty: isW, ref: 1, used: t };
        msg = "P" + page + " not in pool: MISS, " + note + "." + (isW ? " New page modified, marked dirty." : "");
      }
      step++;
    }

    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    controls.appendChild(segment([["lru", "LRU"], ["clock", "Clock"]], 0, function (v) { policy = v; reset(); paint(); }));
    controls.appendChild(segment([[3, "3 frames"], [4, "4 frames"]], 0, function (v) { nFrames = v; reset(); paint(); }));
    controls.appendChild(segment([["hot", SEQS.hot.label], ["loop", SEQS.loop.label], ["mixed", SEQS.mixed.label]], 0, function (v) { seqKey = v; reset(); paint(); }));
    controls.appendChild(btn("Step", "primary", function () { doStep(); paint(); }));
    controls.appendChild(btn("Run all", "", function () { var g = 0; while (step < SEQS[seqKey].reqs.length && g < 100) { doStep(); g++; } paint(); }));
    controls.appendChild(btn("Reset", "ghost", function () { reset(); paint(); }));
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);

    function paint() {
      clear(stage);
      var reqs = SEQS[seqKey].reqs;
      var seqRow = h("div", { style: "display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px" });
      for (var i = 0; i < reqs.length; i++) {
        var res = results[i];
        var border = res === "hit" ? "var(--lime-ink)" : (res === "miss" ? "var(--rose-ink)" : (i === step ? "var(--accent-ink)" : "var(--line)"));
        seqRow.appendChild(h("div", { style: "border:" + (i === step || res ? "2px" : "1px") + " solid " + border + ";border-radius:6px;padding:2px 6px;text-align:center;min-width:34px" },
          h("div", { style: "font-family:var(--font-mono, monospace);font-size:0.82rem;color:var(--text)" }, "P" + reqs[i]),
          h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, res ? res : (i === step ? "next" : "\u00a0"))));
      }
      stage.appendChild(seqRow);
      var fr = h("div", { style: "display:grid;grid-template-columns:repeat(" + nFrames + ",minmax(0,1fr));gap:8px" });
      for (i = 0; i < frames.length; i++) {
        var f = frames[i];
        var isHand = policy === "clock" && i === hand;
        var meta = f.page === null ? "free" : (policy === "clock" ? "ref bit " + f.ref : "last used step " + f.used);
        fr.appendChild(h("div", { style: "border:" + (isHand ? "2px solid var(--violet-ink)" : "1px solid var(--line)") + ";border-radius:8px;padding:8px;background:var(--surface-solid)" },
          h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, "Frame " + i + (isHand ? "  \u25c0 clock hand" : "")),
          h("div", { style: "font-family:var(--font-mono, monospace);font-size:1.15rem;font-weight:700;color:var(--text);margin:2px 0" }, f.page === null ? "\u2014" : "P" + f.page),
          h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, meta),
          h("div", { style: "font-size:0.78rem;font-weight:600;color:" + (f.dirty ? "var(--amber-ink)" : "var(--text-dim)") }, f.dirty ? "dirty" : "clean")));
      }
      stage.appendChild(fr);
      stage.appendChild(h("p", { style: "font-size:0.86rem;margin:10px 0 0;line-height:1.55;color:var(--text)", "aria-live": "polite" }, msg));
      clear(readout);
      readout.appendChild(ro("step", step + "/" + reqs.length));
      readout.appendChild(ro("hits", hits));
      readout.appendChild(ro("misses", misses));
      readout.appendChild(ro("hit ratio", step ? Math.round(100 * hits / step) + "%" : "n/a"));
      readout.appendChild(ro("dirty write-backs", writebacks));
    }

    reset();
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- quizzes ---------- */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "store-pages": {
      title: "Pages and heap files checkpoint",
      sub: "Page sizes, slotted layout, torn writes and how tables sit on disk.",
      questions: [
        { q: "What is the default page (block) size in PostgreSQL?", options: ["4 KB", "16 KB", "8 KB", "64 KB"], answer: 2,
          explain: "PostgreSQL uses 8 KB pages unless it is compiled with a different block size. InnoDB defaults to 16 KB and SQLite to 4 KB, so the same row count produces different page counts and I/O patterns across engines." },
        { q: "Why do indexes in a slotted-page design point at (page number, slot number) rather than at a byte offset inside the page?", options: ["So the engine can move tuples around inside the page, for example to defragment free space, without touching any index entry", "Because byte offsets would not fit in 32 bits", "Because slot numbers compress better than offsets", "So that tuples are guaranteed never to move once written"], answer: 0,
          explain: "The slot array is a level of indirection: the slot holds the current offset and length of the tuple. Compacting a page only rewrites slot contents, so every index that stores (page, slot) stays valid." },
        { q: "A table has 10 million rows averaging 200 bytes each on disk including tuple overhead, stored in 8 KB pages packed nearly full. Roughly how many pages does a full sequential scan read?", options: ["About 2,400", "About 24,000", "About 2.4 million", "About 245,000"], answer: 3,
          explain: "10,000,000 x 200 bytes is 2 GB; 2,000,000,000 / 8,192 is roughly 244,000 pages. Thinking in page counts like this is how optimizers cost a scan, and it is the habit interviewers want to see." },
        { q: "What problem do PostgreSQL full-page writes and the InnoDB doublewrite buffer solve?", options: ["They speed up sequential scans", "Torn pages: a database page is larger than the device's atomic write unit, so a crash mid-write can leave a half-old, half-new page that redo records alone cannot repair", "They replicate pages to standby servers", "They compress pages before writing"], answer: 1,
          explain: "An 8 KB or 16 KB page is written as several 4 KB sectors, and power loss can persist only some of them. Keeping a complete page image elsewhere (in the WAL or in the doublewrite area) lets recovery restore a whole page before replaying changes on top of it." },
        { q: "In InnoDB, what does a secondary index leaf entry store to locate the row?", options: ["The physical page number and slot of the row", "A hash of the full row", "The row's primary key value, so the lookup continues into the clustered index", "A complete copy of the row"], answer: 2,
          explain: "InnoDB tables are clustered on the primary key, and rows move when clustered-index pages split. Storing the primary key in secondary indexes keeps them stable across splits, at the cost of a second B+tree descent for each lookup and fatter secondary indexes when the key is wide." }
      ]
    },
    "store-btree": {
      title: "B+tree checkpoint",
      sub: "Fanout, height, split rules and key choice.",
      questions: [
        { q: "Why does a B+tree typically have a higher fanout than a classic B-tree with the same page size?", options: ["It uses larger pages", "Its internal nodes store only separator keys and child pointers, not full records, so many more entries fit in each page", "It always compresses keys", "It has no leaf level"], answer: 1,
          explain: "In a classic B-tree, records (or record payloads) live in internal nodes too, which eats space that could hold routing entries. Pushing all records to the leaves leaves internal pages dense with small key and pointer pairs, so the tree is wider and shallower." },
        { q: "An index has an effective fanout of 500. How many leaf pages can a tree with a root, one internal level, and a leaf level address?", options: ["1,000", "25,000", "500", "250,000"], answer: 3,
          explain: "The root points to 500 internal pages and each of those points to 500 leaves, so 500 x 500 = 250,000 leaves. With about 100 rows per leaf that is 25 million rows reachable in three page reads, and usually only one of them misses the cache." },
        { q: "In an order-4 B+tree (at most 3 keys per node), the leaf [10 20 30] receives key 25. Using the visualizer's rule that the lower half stays left, what happens?", options: ["It splits into [10 20] and [25 30]; 25 is copied into the parent and also stays in the right leaf", "It splits into [10 20] and [30]; 25 moves to the parent and is removed from the leaves", "It splits into [10] and [20 25 30]; 20 is pushed up", "The leaf keeps 4 keys; only the root ever splits"], answer: 0,
          explain: "The overflowing leaf [10 20 25 30] divides into two halves, and the first key of the right half becomes the separator. In a B+tree every key must remain in a leaf, so the separator is a copy; the leaf still owns 25." },
        { q: "How does splitting an internal node differ from splitting a leaf?", options: ["Internal splits copy the middle key so it appears in both halves", "Internal nodes never split", "The middle key moves up to the parent and is kept in neither half, because internal keys exist only to route searches", "Internal nodes split only during deletes"], answer: 2,
          explain: "Internal keys are routing signposts, not data, so there is no reason to duplicate them. The middle key is pushed up, the left half keeps the keys below it and the right half keeps the keys above it, each with the matching child pointers." },
        { q: "A team switches an InnoDB table's primary key from an auto-increment integer to random UUIDv4 values. What happens to insert performance on a large table?", options: ["It improves, because spreading inserts across pages removes contention with no downside", "Nothing changes; B+trees are insensitive to key order", "The index shrinks because UUIDs compress well", "Inserts land on random leaves, causing splits across the whole tree, pages left roughly half to two-thirds full, and a working set equal to the entire index instead of its right edge"], answer: 3,
          explain: "Sequential keys always append to the rightmost leaf, which stays hot in memory and fills completely. Random keys touch every leaf, so once the index outgrows the buffer pool most inserts need a disk read, and splits scatter half-empty pages. Time-ordered identifiers such as UUIDv7 avoid most of this." }
      ]
    },
    "store-lsm": {
      title: "LSM-tree checkpoint",
      sub: "Write path, bloom filters, compaction strategies and deletes.",
      questions: [
        { q: "Why are writes to an LSM-tree cheap compared with in-place B+tree updates?", options: ["A write appends to the log and updates an in-memory memtable; disk writes happen later as large sequential flushes and merges", "Writes skip durability entirely", "They update pages in place but with larger pages", "They avoid sorting data"], answer: 0,
          explain: "The foreground cost of a put is one sequential log append plus a memory insert. Random-write work is converted into sequential bulk writes, which suits both disks and SSDs; the bill is paid later by compaction." },
        { q: "A bloom filter configured with about 10 bits per key has roughly what false-positive rate?", options: ["About 10%", "About 0.01%", "About 1%", "Exactly zero"], answer: 2,
          explain: "With around 10 bits per key and the optimal number of hash functions (about 7), the false-positive rate is close to 1%. That means a lookup for a missing key skips about 99 out of 100 sorted runs without reading them." },
        { q: "Which compaction strategy usually has lower space amplification, and why?", options: ["Size-tiered, because it merges less often", "Leveled, because each level below L0 is a single sorted run holding at most one version per key, so obsolete data is bounded to roughly 10% at a fanout of 10", "They are identical by construction", "Neither; space amplification comes only from the write-ahead log"], answer: 1,
          explain: "In leveled compaction the last level holds about 90% of the data and overlapping versions in upper levels are a small fraction. Size-tiered keeps several overlapping runs per tier and needs scratch space for large merges, so it can approach 2x or more." },
        { q: "How does an LSM-tree delete a key?", options: ["It removes the key from every SSTable immediately", "It erases the memtable entry and does nothing else", "It rewrites the SSTable that holds the key in place", "It writes a tombstone; older values disappear only when compaction carries the tombstone down past every older version of that key"], answer: 3,
          explain: "SSTables are immutable, so a delete is just another write that shadows older versions. Until compaction merges the tombstone with the older data, both occupy space and reads must still consult them, which is why delete-heavy workloads can suffer." },
        { q: "In a leveled LSM tree, a point lookup for a key that does not exist faces 4 files in L0 and non-empty levels L1 through L4. Ignoring bloom filters, how many sorted runs might it have to check?", options: ["8", "5", "4", "1"], answer: 0,
          explain: "L0 files can overlap, so each must be checked: that is 4. Each deeper level is one non-overlapping run, adding one probe per level: 4 more. Bloom filters are what keep most of those 8 probes from becoming disk reads." }
      ]
    },
    "store-durability": {
      title: "Durability and recovery checkpoint",
      sub: "WAL rules, group commit, buffer replacement, checkpoints and ARIES.",
      questions: [
        { q: "Which statement captures the write-ahead logging rule?", options: ["Data pages must be flushed to disk before a commit is acknowledged", "Log records may be written any time after the page they describe", "The commit record may stay buffered in memory indefinitely", "Log records for a page must be durable before that dirty page is written, and the commit record must be durable before the commit is acknowledged"], answer: 3,
          explain: "The first half guarantees that any change on disk can be undone or redone from the log; the second guarantees that an acknowledged commit survives a crash. Data pages themselves can be written much later, which is what makes WAL fast." },
        { q: "What does group commit buy you?", options: ["It merges several transactions into one", "One fsync is shared by many concurrently committing transactions, raising throughput when each flush costs hundreds of microseconds or more", "It compresses log records", "It avoids calling fsync at all"], answer: 1,
          explain: "Durable commit is bounded by flush latency, not CPU. If 50 sessions commit while one flush is in flight, the next flush can cover all of them, turning a ceiling of a few thousand commits per second into many times that." },
        { q: "What is sequential flooding in a buffer pool?", options: ["Clock always evicting the wrong page", "Hash collisions in the page table", "A scan larger than the pool marks each scanned page most-recently-used, so pure LRU evicts every genuinely hot page; engines counter it with midpoint insertion or small ring buffers for scans", "Dirty pages being written too often"], answer: 2,
          explain: "LRU assumes recency predicts reuse, which is false for a one-pass scan. InnoDB inserts new pages into the middle of its list and PostgreSQL gives large sequential scans a small private ring, so the scan cannot wipe out the working set." },
        { q: "A buffer manager uses a steal / no-force policy. What must recovery be able to do?", options: ["Both undo, because pages dirtied by uncommitted transactions may already be on disk, and redo, because committed changes may not yet be on disk", "Neither, because the policy prevents inconsistency", "Only undo", "Only redo"], answer: 0,
          explain: "Steal lets the pool evict uncommitted changes to disk, so recovery may need to roll them back. No-force lets commit return before pages are written, so recovery may need to replay them. ARIES-style recovery exists precisely to handle both." },
        { q: "Why do databases take checkpoints?", options: ["Commits are not durable without one", "They bound crash-recovery time and let old log be recycled, because every change before the checkpoint's redo point is guaranteed to be in the data files", "They replace the write-ahead log", "They defragment tables"], answer: 1,
          explain: "Without checkpoints, recovery would replay the log from the beginning of time and the log could never be truncated. The trade-off is I/O: frequent checkpoints shorten recovery but flush more pages and, in PostgreSQL, produce more full-page images." }
      ]
    }
  });

  /* ---------- track ---------- */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.store = {
    id: "store",
    name: "Storage Engines",
    short: "STORE",
    tagline: "Pages, B+trees, LSM-trees and the machinery that makes a commit stick",
    color: "#e879f9",
    blurb: "What actually sits on disk and in memory underneath a table: why everything is measured in pages, how slotted pages and heap files are laid out, how B+trees split and stay shallow, how LSM-trees trade write speed for compaction, and how the write-ahead log, buffer pool and checkpoints combine to make commits fast and crashes survivable. Concrete numbers throughout, from page sizes to fanout math to read, write and space amplification.",
    modules: [
      {
        id: "pages",
        name: "Disks, Pages & Heap Files",
        icon: "grid",
        lessons: [
          {
            id: "disk-and-pages",
            title: "Why databases think in pages",
            summary: "The latency gap between memory and storage, and why every engine moves data in fixed-size pages.",
            minutes: 9,
            tags: ["storage", "pages", "latency", "ssd"],
            blocks: [
              { t: "p", html: "Hold this picture: the database is a giant array of <strong>fixed-size pages</strong> on storage, and a much smaller set of those pages cached in memory. Every query, index lookup and write is ultimately a question of <em>which pages must be read or written</em>. Rows are what you ask for; pages are what the engine pays for." },
              { t: "h", text: "The latency ladder" },
              { t: "table", headers: ["Operation", "Typical latency", "Relative to a DRAM read"], rows: [
                ["Read from DRAM", "~100 ns", "1x"],
                ["Random 4 KB read, NVMe SSD", "~20-100 microseconds", "200-1,000x"],
                ["Random 4 KB read, SATA SSD", "~100-200 microseconds", "1,000-2,000x"],
                ["Random read, spinning disk (seek + rotation)", "~5-10 ms", "50,000-100,000x"],
                ["Round trip inside a data centre", "~0.25-0.5 ms", "2,500-5,000x"]
              ] },
              { t: "p", html: "Those gaps explain most storage-engine design. If touching storage costs a thousand times more than touching memory, the engine should fetch a useful chunk each time, keep hot chunks cached, and arrange data so related rows share a chunk. That chunk is the <strong>page</strong>." },
              { t: "h", text: "Page sizes in real engines" },
              { t: "table", headers: ["Engine", "Default page size", "Notes"], rows: [
                ["PostgreSQL", "8 KB", "Fixed at compile time; tables and indexes use the same size"],
                ["MySQL InnoDB", "16 KB", "Configurable at instance creation (4-64 KB)"],
                ["SQLite", "4 KB", "Settable per database file with <code class='tok'>PRAGMA page_size</code>"],
                ["SQL Server", "8 KB", "Grouped into 64 KB extents of 8 pages"],
                ["Oracle", "8 KB typical", "Block size chosen per tablespace"]
              ] },
              { t: "h", text: "Why not tiny or huge pages?" },
              { t: "compare",
                bad: { title: "Small pages (1-2 KB)", items: ["Less wasted transfer for point reads", "More pages, so taller indexes and bigger page tables", "Per-page header overhead eats a larger share", "Large rows overflow more often"] },
                good: { title: "Large pages (32-64 KB)", items: ["Higher B+tree fanout, fewer levels", "Better sequential throughput and compression", "A point lookup drags in lots of unrelated bytes", "Hot-page contention and bigger write amplification per change"] } },
              { t: "p", html: "4-16 KB is the sweet spot because it lines up with the OS page (usually 4 KB), with SSD flash pages (typically 4-16 KB), and gives B+tree nodes hundreds of entries each." },
              { t: "h", text: "The torn-write problem" },
              { t: "p", html: "Storage usually guarantees atomic writes only at the sector level (512 bytes or 4 KB). An 8 KB or 16 KB page is several sectors, so a power cut can leave a <strong>torn page</strong>: half new bytes, half old. PostgreSQL defends with <code class='tok'>full_page_writes</code> (the first change to a page after a checkpoint logs the whole page image), InnoDB with the <strong>doublewrite buffer</strong> (pages are written to a scratch area first, then to their home)." },
              { t: "note", variant: "warn", html: "SSDs hide their own complexity: flash is written in pages but erased in blocks of several megabytes, and the drive's translation layer remaps writes. Random small writes therefore cost more internally than they look, which is one reason log-structured designs are attractive on flash." },
              { t: "stat", items: [
                { v: "8 KB", k: "PostgreSQL page" },
                { v: "16 KB", k: "InnoDB page" },
                { v: "4 KB", k: "SQLite default page" },
                { v: "~1,000x", k: "SSD random read vs DRAM" }
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'why is this query slow even though it returns one row', 'how many disk reads does this lookup take', 'why did the database choose a sequential scan'. Answer in pages touched, not rows returned." },
              { t: "note", variant: "key", html: "<strong>Rows are the interface; pages are the cost.</strong> Count page reads and writes, remember 8 KB (Postgres) / 16 KB (InnoDB) / 4 KB (SQLite), and know that a page larger than a sector needs torn-write protection." }
            ]
          },
          {
            id: "slotted-pages",
            title: "Inside a page: the slotted layout",
            summary: "Headers, slot arrays, free space in the middle, and how variable-length rows live in a fixed-size page.",
            minutes: 10,
            tags: ["slotted-page", "tuple", "layout", "toast"],
            blocks: [
              { t: "p", html: "Picture a page as a box filled from both ends. A small <strong>header</strong> sits at the front, followed by a growing <strong>slot array</strong> (also called line pointers). Tuples are written from the <em>back</em> of the page toward the front. Free space is the gap in the middle; the page is full when the two ends meet." },
              { t: "code", lang: "text", code:
                "+--------------------------------------------------------------+\n" +
                "| header (LSN, checksum, free-space bounds)  slot1 slot2 slot3 -> |\n" +
                "|                                                              |\n" +
                "|                    ... free space ...                        |\n" +
                "|                                                              |\n" +
                "| <- tuple3 bytes | tuple2 bytes        | tuple1 bytes         |\n" +
                "+--------------------------------------------------------------+\n" +
                "slot = (offset, length, flags)   row address = (page no, slot no)" },
              { t: "h", text: "Why the indirection matters" },
              { t: "ul", items: [
                "A row's address is <strong>(page number, slot number)</strong>, in PostgreSQL called the TID or <code class='tok'>ctid</code>. Indexes store that address.",
                "Tuples can move <em>within</em> the page (to squeeze out holes after deletes or updates) by rewriting only the slot's offset. No index changes.",
                "A deleted row leaves its slot as a tombstone or reusable entry, so slot numbers held by other structures stay meaningful.",
                "Variable-length rows fit naturally: the slot records each tuple's own length."
              ] },
              { t: "h", text: "PostgreSQL by the numbers" },
              { t: "table", headers: ["Component", "Size", "Note"], rows: [
                ["Page header", "24 bytes", "Includes the page LSN, checksum and free-space pointers"],
                ["Line pointer (slot)", "4 bytes each", "Offset, length and state flags"],
                ["Heap tuple header", "23 bytes, padded to 24", "Holds xmin, xmax, ctid and flags for MVCC"],
                ["Max tuples per 8 KB heap page", "291", "Bounded by the smallest possible tuple plus its pointer"]
              ] },
              { t: "code", lang: "text", code:
                "row payload            = 100 bytes\n" +
                "tuple header           =  24 bytes\n" +
                "line pointer           =   4 bytes\n" +
                "per-row cost           = 128 bytes\n" +
                "usable page            = 8192 - 24 = 8168 bytes\n" +
                "rows per page          = 8168 / 128  ~= 63\n" +
                "overhead share         = 28 / 128    ~= 22%" },
              { t: "p", html: "That 22% is why narrow tables of tiny rows look bigger on disk than you expect, and why a 'wide but few rows' table can be cheaper than 'narrow but many rows' for the same logical data." },
              { t: "h", text: "Rows that do not fit" },
              { t: "p", html: "A row larger than a fraction of the page cannot live inline. PostgreSQL compresses and moves large values into a side table via <strong>TOAST</strong> once a row exceeds roughly 2 KB, leaving a pointer behind. InnoDB stores long variable-length columns <strong>off-page</strong> in overflow pages, keeping a 20-byte pointer (plus, in older row formats, a prefix) in the record." },
              { t: "note", variant: "tip", html: "Selecting only the columns you need matters more than it looks: a query that never touches a TOASTed column never reads its out-of-line chunks." },
              { t: "h", text: "Fill factor: leaving room on purpose" },
              { t: "p", html: "A <strong>fill factor</strong> below 100% leaves free space in each page at load time so later updates can stay on the same page. PostgreSQL tables default to 100 and B-tree indexes to 90. Lowering a hot table to 80-90 trades about 10-20% more disk for fewer page-crossing updates." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'how is a row physically stored', 'why does the table take more space than rows x row size', 'what does an index entry point at'. Draw the slotted page and name the TID." },
              { t: "note", variant: "key", html: "<strong>Slots give rows a stable address inside a page while the bytes move freely.</strong> Header at the front, slots growing forward, tuples growing backward, and per-row overhead (about 28 bytes in Postgres) you should budget for." }
            ]
          },
          {
            id: "heap-files",
            title: "Heap files and index-organized tables",
            summary: "How pages form a table, how free space is found, and the heap versus clustered-index split between engines.",
            minutes: 10,
            tags: ["heap", "clustered-index", "free-space-map", "hot-updates"],
            blocks: [
              { t: "p", html: "A table needs a way to organise its pages. There are two dominant answers. A <strong>heap file</strong> is an unordered bag of pages: rows go wherever there is room, and every index is a separate structure pointing at row addresses. An <strong>index-organized table</strong> stores the rows themselves inside a B+tree ordered by the primary key." },
              { t: "table", headers: ["Engine", "Table organization", "Secondary index points to"], rows: [
                ["PostgreSQL", "Heap", "TID (page, slot) of the row version"],
                ["MySQL InnoDB", "Clustered B+tree on the primary key", "Primary key value"],
                ["SQLite", "B-tree keyed by rowid (or primary key for WITHOUT ROWID)", "rowid or primary key"],
                ["SQL Server", "Heap, or clustered index if one is defined", "RID for heaps, clustering key otherwise"],
                ["Oracle", "Heap by default; index-organized tables optional", "ROWID for heaps"]
              ] },
              { t: "h", text: "Finding free space in a heap" },
              { t: "p", html: "Inserting into a heap means finding a page with room. PostgreSQL keeps a <strong>free space map</strong> that records roughly how much space each page has, so an insert does not scan the table. It also keeps a <strong>visibility map</strong> with two bits per heap page (all-visible, all-frozen) that lets vacuum skip pages and lets index-only scans avoid visiting the heap." },
              { t: "h", text: "Scan cost is page count" },
              { t: "code", lang: "text", code:
                "rows          = 10,000,000\n" +
                "bytes/row     = 128 (payload + header + slot)\n" +
                "table size    = 1.28 GB\n" +
                "8 KB pages    = 1.28e9 / 8192 ~= 156,000 pages\n" +
                "seq read      @ 1 GB/s  ~= 1.3 s   (if not cached)\n" +
                "random reads  156,000 x 100 microseconds ~= 15.6 s" },
              { t: "p", html: "The same pages cost ten times more when read in random order. That ratio is why an optimizer abandons an index once a query needs more than a modest fraction of a table." },
              { t: "h", text: "Updates: heap versus clustered" },
              { t: "compare",
                bad: { title: "Heap (PostgreSQL)", items: ["Inserts are cheap: any page with room", "An update writes a new row version at a new TID", "Every index needs a new entry unless the update is HOT", "Primary-key lookups go index then heap: two structures"] },
                good: { title: "Clustered (InnoDB)", items: ["Primary-key lookups and range scans read rows directly from leaves", "Rows are physically ordered, so PK ranges are sequential", "Secondary lookups need a second descent through the clustered index", "Random primary keys cause page splits in the table itself"] } },
              { t: "p", html: "PostgreSQL softens the heap's update cost with <strong>HOT</strong> (heap-only tuple) updates: if no indexed column changes and the new version fits on the same page, the new version is chained from the old one and no index is touched. A lower table fill factor makes HOT far more likely." },
              { t: "table", headers: ["Tier", "Answer to 'heap or clustered?'"], rows: [
                ["Naive", "Clustered is always faster because rows are sorted"],
                ["Solid", "Clustered wins for primary-key lookups and ranges; heap wins for insert-anywhere workloads and keeps secondary indexes small"],
                ["Standout", "Also names the update path: heap updates create new TIDs (mitigated by HOT and fill factor), clustered secondaries pay a double lookup and grow with PK width, and key choice drives split behaviour"]
              ] },
              { t: "note", variant: "trap", html: "Wide primary keys hurt InnoDB twice: every secondary index stores the full PK in every entry. A 36-character string UUID as PK can double the size of each secondary index compared with an 8-byte integer." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'Postgres versus MySQL for this table', 'why is my secondary index lookup slower in InnoDB', 'why do updates bloat indexes'. Start from heap versus clustered organization." },
              { t: "quiz", id: "store-pages" },
              { t: "note", variant: "key", html: "<strong>A heap is unordered pages plus indexes pointing at TIDs; a clustered table is the primary-key B+tree itself.</strong> Heaps make inserts cheap and updates index-heavy; clustered tables make PK access fast and secondary lookups double." }
            ]
          }
        ]
      },
      {
        id: "btree",
        name: "B-trees & B+trees",
        icon: "blocks",
        lessons: [
          {
            id: "btree-vs-bplus",
            title: "B-tree versus B+tree, and the fanout math",
            summary: "Why nearly every database index is a B+tree, and how a three-level tree reaches a hundred million rows.",
            minutes: 10,
            tags: ["btree", "bplus-tree", "fanout", "index"],
            blocks: [
              { t: "p", html: "Think of a B+tree as a very wide, very short sorted directory. Each node is one page. Internal pages hold only <strong>separator keys and child pointers</strong>; all records (or record pointers) live in the <strong>leaves</strong>, and leaves are chained left to right so a range scan walks sideways instead of climbing back up." },
              { t: "diagram", id: "btree-structure", caption: "Internal pages route with separator keys; leaves hold the entries and link to their siblings." },
              { t: "table", headers: ["Property", "Classic B-tree", "B+tree"], rows: [
                ["Where records live", "In every node", "Only in leaves"],
                ["Internal node contents", "Keys plus records", "Separator keys plus child pointers"],
                ["Fanout for a given page", "Lower", "Higher, so the tree is shallower"],
                ["Range scan", "In-order traversal up and down the tree", "Find the start leaf, then follow sibling links"],
                ["Point lookup cost", "Sometimes ends early in an internal node", "Always reaches a leaf, but in fewer levels"]
              ] },
              { t: "h", text: "Fanout: the number that decides everything" },
              { t: "p", html: "Fanout is how many children an internal page can point to. It is roughly <em>usable page bytes / (key size + pointer size + per-entry overhead)</em>, times a fill factor because pages are rarely full." },
              { t: "code", lang: "text", code:
                "InnoDB, 16 KB page, BIGINT key\n" +
                "  entry  ~= 8 key + 4 child page no + ~5 record header ~= 17 bytes\n" +
                "  fanout ~= 16,384 / 17 ~= 960, call it ~1,000 (less when pages are not full)\n" +
                "\n" +
                "Clustered leaf, ~160-byte rows\n" +
                "  rows/leaf ~= 16,384 / 160 ~= 100\n" +
                "\n" +
                "height 1 (root leaf)       :          ~100 rows\n" +
                "height 2 (root + leaves)   : 1,000 x 100 = ~100 thousand rows\n" +
                "height 3                   : 1,000^2 x 100 = ~100 million rows\n" +
                "height 4                   : ~100 billion rows" },
              { t: "p", html: "For PostgreSQL, an index entry on an 8-byte key is about 16 bytes plus a 4-byte line pointer, so an 8 KB page holds roughly 360-400 entries. Fanout is lower than InnoDB's, but the same logarithm applies: a few hundred million entries fit in four levels." },
              { t: "h", text: "What a lookup really costs" },
              { t: "ul", items: [
                "The root and the second level are touched by every lookup, so they stay in the buffer pool permanently.",
                "A three-level index on 100 million rows typically needs <strong>one</strong> real I/O per point lookup: the leaf.",
                "If the index is secondary, add the heap or clustered-index fetch for the row itself.",
                "The upper levels are tiny: for the InnoDB example, levels one and two are about 1,000 pages, roughly 16 MB."
              ] },
              { t: "stat", items: [
                { v: "~1,000", k: "InnoDB fanout, 8-byte key" },
                { v: "~370", k: "Postgres fanout, 8-byte key" },
                { v: "3-4", k: "levels for 100M+ rows" },
                { v: "1", k: "typical cold I/O per lookup" }
              ] },
              { t: "note", variant: "tip", html: "Fanout is why key width matters. Doubling the key size roughly halves fanout; at large scale that can add a level, which is one more page read on every cold lookup." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'how many disk reads to find a row among a billion', 'why is the index only three levels deep', 'why B+tree and not a binary tree'. Do the fanout math out loud." },
              { t: "note", variant: "key", html: "<strong>B+trees keep data in linked leaves and only routing keys above, so fanout is in the hundreds to thousands.</strong> Height is log base fanout of N: three or four levels cover hundreds of millions of rows, and the cached top levels leave about one I/O per lookup." }
            ]
          },
          {
            id: "btree-insert-split",
            title: "Inserts, splits and how the tree grows",
            summary: "Step through leaf and internal splits, see why B+trees grow from the root, and why key order changes everything.",
            minutes: 12,
            tags: ["btree", "split", "insert", "algorithms"],
            blocks: [
              { t: "p", html: "An insert does two things: descend to the correct leaf, then place the key there. If the leaf has room, you are done. If it overflows, it <strong>splits</strong>, and the split may ripple upward. The tree only gets taller when the <strong>root</strong> splits, which is why every leaf is always at the same depth." },
              { t: "h", text: "The two split rules" },
              { t: "table", headers: ["Split", "What happens to the middle key", "Why"], rows: [
                ["Leaf split", "The first key of the new right leaf is <strong>copied</strong> up as a separator; it stays in the leaf", "Every key must remain in a leaf, because leaves hold the data and range scans read only leaves"],
                ["Internal split", "The middle key is <strong>pushed</strong> up and removed from both halves", "Internal keys only route searches; duplicating one would add a useless entry"],
                ["Root split", "A new root is created holding the pushed key", "This is the only operation that increases height"]
              ] },
              { t: "code", lang: "text", code:
                "insert(key):\n" +
                "  leaf = descend(root, key)          # remember the path\n" +
                "  put key into leaf in sorted order\n" +
                "  if leaf.size <= MAX: return\n" +
                "  right = upper half of leaf; leaf keeps lower half\n" +
                "  link leaf -> right -> old next     # sibling chain for range scans\n" +
                "  insert_in_parent(leaf, right.first_key, right)   # COPY up\n" +
                "\n" +
                "insert_in_parent(left, sep, right):\n" +
                "  if left is root: new root = [sep], children [left, right]; height += 1\n" +
                "  parent.add(sep, right)\n" +
                "  if parent.size > MAX:\n" +
                "    mid = parent.keys[size/2]\n" +
                "    split parent around mid; mid is in neither half\n" +
                "    insert_in_parent(parent, mid, new_right)  # PUSH up" },
              { t: "widget", id: "storeBtree" },
              { t: "p", html: "Try it: with order 3, insert the next eight keys and watch the root split twice. Then switch to order 5 and see the same keys rebuilt into a shorter tree. Next, press <em>Insert 5 ascending</em> a few times and watch the average leaf fill drop: each split leaves the lower half behind and only the rightmost leaf receives new keys." },
              { t: "h", text: "Key order shapes the tree" },
              { t: "compare",
                bad: { title: "Random keys (UUIDv4, hashes)", items: ["Inserts hit leaves all over the tree", "Splits everywhere; pages settle around 50-70% full", "Working set is the whole index, so cache misses on insert", "More WAL and full-page images per insert"] },
                good: { title: "Ascending keys (sequence, UUIDv7, timestamps)", items: ["Every insert lands on the rightmost leaf", "Engines special-case a right-edge split: the old page is left (nearly) full instead of half full", "Only the right edge needs to be in memory", "Risk: a single hot page under very high concurrency"] } },
              { t: "note", variant: "warn", html: "The plain textbook rule (split half and half) applied to ascending keys leaves every page half full forever. Real engines detect the rightmost-insert pattern and split unevenly, which is why bulk-loaded and sequential indexes end up dense." },
              { t: "h", text: "Deletes are lazier than inserts" },
              { t: "p", html: "The textbook merges or borrows from a sibling whenever a node falls below half full. Most production engines do not bother: PostgreSQL removes index pages only once they are completely empty (during vacuum), and InnoDB merges only below a threshold (50% by default via <code class='tok'>MERGE_THRESHOLD</code>). The price is bloat after mass deletes; the fix is a rebuild." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'walk me through inserting into a full B+tree node', 'what goes up on a split', 'why are random UUID primary keys slow'. Say copy-up for leaves, push-up for internal nodes, height grows only at the root." },
              { t: "note", variant: "key", html: "<strong>Leaf splits copy the separator up; internal splits push it up; only a root split adds a level.</strong> Ascending keys keep splits at the right edge and pages full; random keys split everywhere and blow up the working set." }
            ]
          },
          {
            id: "btree-in-practice",
            title: "B+trees in real engines",
            summary: "Concurrency with latches and B-link trees, compression, fill factors, and the write amplification you pay for in-place updates.",
            minutes: 11,
            tags: ["btree", "concurrency", "latches", "write-amplification"],
            blocks: [
              { t: "p", html: "The textbook B+tree assumes one user. Production trees serve thousands of concurrent readers and writers, compress keys, and must survive crashes mid-split. Three ideas carry most of the weight: <strong>latches</strong>, <strong>sibling links</strong>, and <strong>logged structure changes</strong>." },
              { t: "h", text: "Latches are not locks" },
              { t: "table", headers: ["", "Lock", "Latch"], rows: [
                ["Protects", "Logical data (rows, ranges) for a transaction", "A physical in-memory structure (a page) for microseconds"],
                ["Held for", "Until commit or abort", "The duration of one page operation"],
                ["Deadlock handling", "Detection or timeouts", "Avoided by acquiring in a fixed order"],
                ["Visible to SQL users", "Yes (lock waits, deadlock errors)", "Only as internal contention in wait stats"]
              ] },
              { t: "h", text: "Latch crabbing and the B-link trick" },
              { t: "p", html: "<strong>Latch crabbing</strong>: descend holding the parent's latch until the child's latch is acquired, then release the parent if the child is <em>safe</em> (cannot split or merge from this operation). Writers that might split hold latches higher up, which hurts at the root." },
              { t: "p", html: "PostgreSQL uses a <strong>B-link tree</strong> design: every page has a right-sibling link and a <em>high key</em>. A split creates the right page and links it before the parent is updated. A reader that lands on a page whose high key is below its search key just follows the right link. Readers never need to latch-couple down the tree, and splits finish in two short steps." },
              { t: "h", text: "Making pages hold more" },
              { t: "ul", items: [
                "<strong>Suffix truncation</strong>: separators only need enough bytes to route, so 'Smithson' versus 'Smythe' can be stored as 'Smy'. PostgreSQL 12+ truncates trailing key columns in internal pages.",
                "<strong>Prefix compression</strong>: store a shared prefix once per page (common in InnoDB-compatible engines, SQL Server page compression and LSM blocks).",
                "<strong>Deduplication</strong>: PostgreSQL 13+ stores repeated keys once with a list of TIDs, which can shrink low-cardinality indexes several-fold.",
                "<strong>Fill factor</strong>: Postgres B-tree indexes default to 90% so the first updates do not split immediately."
              ] },
              { t: "h", text: "The write amplification of in-place updates" },
              { t: "code", lang: "text", code:
                "change one 100-byte row in a 16 KB InnoDB page\n" +
                "  redo log record           ~ 100-200 bytes\n" +
                "  eventual page write       16,384 bytes\n" +
                "  doublewrite copy          16,384 bytes\n" +
                "  -> worst case ~300x bytes written per byte changed\n" +
                "\n" +
                "amortized: if 50 rows on that page change before it is flushed,\n" +
                "  cost per change drops to ~650 bytes (~6.5x)" },
              { t: "p", html: "B+trees win on reads and on predictable latency, and pay on writes. That bill depends on how many changes hit a page between flushes, which is why checkpoint spacing and buffer-pool size matter so much for write-heavy B+tree workloads." },
              { t: "table", headers: ["Tier", "Answer to 'how would you pick a primary key for a big InnoDB table?'"], rows: [
                ["Naive", "UUIDv4 strings, because they are globally unique"],
                ["Solid", "An 8-byte auto-increment or sequence, because inserts append at the right edge and secondary indexes stay small"],
                ["Standout", "An 8-byte time-ordered id (sequence or UUIDv7 stored as 16 binary bytes if global uniqueness is needed), noting the right-edge hot page under extreme concurrency and the trade-off of exposing ordering in public ids"]
              ] },
              { t: "note", variant: "trap", html: "Do not answer a concurrency question about B+trees with 'it takes a lock on the page'. Interviewers listen for the distinction: row locks for transactions, short latches for pages." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'how do concurrent inserts not corrupt the tree', 'why is my index bigger after deletes', 'why are B-trees bad for write-heavy workloads'. Reach for latches and B-link right-links, lazy merges, and per-page write amplification." },
              { t: "quiz", id: "store-btree" },
              { t: "note", variant: "key", html: "<strong>Production B+trees are latch-coupled (or B-link with right-links), compressed, and filled below 100%.</strong> They give stable reads at the cost of page-sized writes per small change, amortized only when several changes hit a page before it is flushed." }
            ]
          }
        ]
      },
      {
        id: "lsm",
        name: "LSM-trees & Compaction",
        icon: "queue",
        lessons: [
          {
            id: "lsm-trees",
            title: "LSM-trees: turning random writes into sequential ones",
            summary: "Memtables, immutable SSTables, the read path through levels, bloom filters and tombstones.",
            minutes: 11,
            tags: ["lsm", "memtable", "sstable", "bloom-filter"],
            blocks: [
              { t: "p", html: "A log-structured merge tree never updates data in place. Picture a stack of sorted files: new writes go into an in-memory sorted buffer, which is periodically frozen and written out as a new immutable file on top. Background <strong>compaction</strong> merges files downward. Reads look from newest to oldest and stop at the first match." },
              { t: "diagram", id: "lsm-flow", caption: "Writes go to the WAL and memtable, flush to L0 SSTables, and compaction merges them into deeper levels." },
              { t: "h", text: "The write path" },
              { t: "ol", items: [
                "Append the change to the <strong>write-ahead log</strong> for durability (one sequential write).",
                "Insert it into the <strong>memtable</strong>, usually a skiplist kept sorted by key.",
                "When the memtable reaches its size limit (RocksDB's default write buffer is 64 MB), freeze it and start a new one.",
                "Flush the frozen memtable as an <strong>SSTable</strong>: a sorted, immutable file of data blocks plus an index block and a bloom filter.",
                "Once flushed, the corresponding WAL segment can be discarded."
              ] },
              { t: "h", text: "The read path" },
              { t: "code", lang: "text", code:
                "get(k):\n" +
                "  check active memtable, then immutable memtables  -> found? return\n" +
                "  for each L0 file, newest first (files overlap):\n" +
                "      bloom filter says 'maybe'? -> binary search index block -> read one data block\n" +
                "  for each level L1..Ln (one non-overlapping run per level):\n" +
                "      pick the single file whose key range covers k\n" +
                "      bloom filter -> index block -> data block\n" +
                "  first hit wins; a tombstone hit means 'deleted'" },
              { t: "h", text: "Bloom filters carry the read path" },
              { t: "table", headers: ["Bits per key", "Approx. false-positive rate", "Memory for 1 billion keys"], rows: [
                ["5", "~10%", "~0.6 GB"],
                ["10", "~1%", "~1.2 GB"],
                ["15", "~0.1%", "~1.9 GB"]
              ] },
              { t: "p", html: "With 10 bits per key, a lookup for a missing key skips about 99% of runs without any I/O. Bloom filters cannot help <strong>range scans</strong>, though: a scan must open an iterator on every overlapping run and merge them, so range reads are where LSM read amplification really shows." },
              { t: "h", text: "Deletes are writes too" },
              { t: "p", html: "Files are immutable, so a delete writes a <strong>tombstone</strong>, a marker that shadows older versions. The space is reclaimed only when compaction merges the tombstone down past every older copy of that key. Delete-heavy patterns such as queues can accumulate tombstones that every scan has to step over." },
              { t: "compare",
                bad: { title: "B+tree (update in place)", items: ["Reads: one path, predictable", "Writes: random page writes, page-sized amplification", "Space: pages 50-90% full from splits", "Great for read-heavy OLTP"] },
                good: { title: "LSM-tree (append and merge)", items: ["Reads: may probe several runs; bloom filters help", "Writes: sequential, batched, high ingest", "Space: compresses well; obsolete versions linger until compaction", "Great for write-heavy, time-series, key-value"] } },
              { t: "p", html: "LSM engines you will meet: <strong>RocksDB</strong> (and MySQL's MyRocks on top of it), LevelDB, <strong>Cassandra</strong> and ScyllaDB, HBase, and the storage layers of CockroachDB (Pebble) and TiDB (TiKV on RocksDB)." },
              { t: "note", variant: "warn", html: "An LSM write is fast because the expensive work is deferred, not avoided. If ingest outpaces compaction, L0 files pile up and engines deliberately <strong>stall writes</strong>; RocksDB slows and then stops writes when L0 file counts cross configured thresholds." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'design a store for 1 million writes per second', 'time-series ingest', 'why does Cassandra read slower than it writes', 'what is a tombstone'. Reach for memtable, SSTables, bloom filters and compaction debt." },
              { t: "note", variant: "key", html: "<strong>LSM-trees buffer writes in memory, flush immutable sorted runs, and merge them later.</strong> Writes become sequential; reads probe newest to oldest with bloom filters skipping most runs; deletes are tombstones that only compaction can clear." }
            ]
          },
          {
            id: "compaction",
            title: "Compaction strategies and the three amplifications",
            summary: "Leveled versus size-tiered compaction, with write, read and space amplification worked out in numbers.",
            minutes: 12,
            tags: ["lsm", "compaction", "amplification", "rocksdb", "cassandra"],
            blocks: [
              { t: "p", html: "Compaction is where an LSM engine spends its I/O budget, and the strategy you choose decides which of three costs you pay. Hold the three numbers in your head as a triangle: you can shrink any two, but rarely all three at once." },
              { t: "table", headers: ["Amplification", "Definition", "Who feels it"], rows: [
                ["Write amplification", "Bytes written to storage / bytes written by the application", "SSD lifetime, background I/O, ingest ceiling"],
                ["Read amplification", "Sorted runs (or I/Os) consulted per lookup", "Read latency, especially range scans"],
                ["Space amplification", "Bytes on disk / bytes of live data", "Disk cost, headroom needed for compaction"]
              ] },
              { t: "h", text: "Leveled compaction" },
              { t: "p", html: "Each level below L0 is one sorted, non-overlapping run, and each is about <strong>T</strong> times larger than the one above (T = 10 by default in RocksDB, with L1 around 256 MB). When a level exceeds its target, a file from it is merged into the overlapping files of the next level." },
              { t: "code", lang: "text", code:
                "leveled, fanout T = 10, data 1 TB, L1 = 256 MB\n" +
                "  levels: L1 256 MB, L2 2.5 GB, L3 25 GB, L4 256 GB, L5 ~1 TB  -> ~5 levels\n" +
                "  write amp: a byte is rewritten when it enters each level, and merging\n" +
                "             into a level 10x larger rewrites up to ~10 bytes of overlap per byte\n" +
                "             -> commonly cited 10-30x in practice\n" +
                "  read amp : L0 files (a few) + 1 run per level ~= 4 + 5 = 9 runs worst case\n" +
                "  space amp: last level holds ~90% of data -> ~1.1x" },
              { t: "h", text: "Size-tiered compaction" },
              { t: "p", html: "Runs are grouped by similar size. When enough runs of one size class accumulate (Cassandra's default threshold is 4), they are merged into one bigger run in the next tier. Data is rewritten roughly once per tier, so write amplification is low, but many overlapping runs coexist." },
              { t: "code", lang: "text", code:
                "size-tiered, threshold 4, 64 MB flushes, data 1 TB\n" +
                "  tiers: 64 MB, 256 MB, 1 GB, 4 GB, 16 GB, 64 GB, 256 GB, 1 TB -> ~8 tiers\n" +
                "  write amp: each byte rewritten about once per tier -> ~8x\n" +
                "  read amp : up to ~3 runs per tier -> tens of runs without bloom filters\n" +
                "  space amp: overlapping versions plus scratch space for a merge of the\n" +
                "             biggest tier -> up to ~2x" },
              { t: "widget", id: "storeLsm" },
              { t: "p", html: "In the simulator, choose the hot-keys workload and press <em>Put 8</em> about a dozen times (roughly 100 puts), then flip between strategies; the same writes are replayed each time. Size-tiered shows lower write amplification at every point. Read and space amplification move in a sawtooth, dropping right after a big merge, but around 100 puts size-tiered typically has 4-5 runs and about 1.8x space while leveled has 2-3 runs and about 1.3x. The numbers are tiny-scale; the direction matches real systems." },
              { t: "table", headers: ["Strategy", "Write amp", "Read amp", "Space amp", "Fits"], rows: [
                ["Leveled", "High (10-30x)", "Low", "Low (~1.1x)", "Read-heavy, point lookups, tight disk budget"],
                ["Size-tiered", "Low (~log of size ratio)", "High", "High (up to 2x+)", "Write-heavy ingest, lots of disk"],
                ["Hybrid (tiered L0, leveled below; RocksDB universal, Cassandra time-window)", "Medium", "Medium", "Medium", "Time-series, TTL data, mixed workloads"]
              ] },
              { t: "note", variant: "tip", html: "For time-series data with TTLs, time-window compaction groups data by time bucket so whole files expire together. Dropping a file is free; compacting tombstones is not." },
              { t: "table", headers: ["Tier", "Answer to 'which compaction strategy would you pick?'"], rows: [
                ["Naive", "Leveled, because it is the default"],
                ["Solid", "Leveled for read-heavy point lookups and limited disk; size-tiered for write-heavy ingest with spare disk"],
                ["Standout", "Quantifies the triangle for the workload (for example 1 TB at fanout 10 gives about 1.1x space but 10-30x write amp), checks SSD endurance and compaction throughput against ingest, and considers time-window compaction when data expires by age"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'disk usage doubled during compaction', 'SSDs wearing out', 'reads got slower as data grew', 'write stalls'. Name the amplification involved and the compaction knob that moves it." },
              { t: "quiz", id: "store-lsm" },
              { t: "note", variant: "key", html: "<strong>Leveled buys low read and space amplification with high write amplification; size-tiered does the reverse.</strong> Quote the numbers: leveled at fanout 10 is about 1.1x space and 10-30x writes; size-tiered is a handful of rewrites but up to 2x space and many runs per read." }
            ]
          }
        ]
      },
      {
        id: "durability",
        name: "Durability, Buffers & Recovery",
        icon: "shield",
        lessons: [
          {
            id: "write-ahead-log",
            title: "The write-ahead log",
            summary: "The WAL rule, fsync and group commit, LSNs, and the durability knobs real engines expose.",
            minutes: 11,
            tags: ["wal", "durability", "fsync", "group-commit"],
            blocks: [
              { t: "p", html: "The write-ahead log is an append-only file describing every change. Picture it as the database's source of truth for the last few minutes: data pages in memory are allowed to be newer than the pages on disk, because the log can always bring the disk up to date after a crash." },
              { t: "diagram", id: "wal-buffer", caption: "Changes hit the in-memory page and the log buffer; the log is flushed at commit, dirty pages are written later." },
              { t: "h", text: "The two rules" },
              { t: "ol", items: [
                "<strong>Log before data</strong>: a dirty page may be written to disk only after every log record describing its changes is durable. Each page carries the LSN of its latest change (the pageLSN) so the buffer manager can check this.",
                "<strong>Log before acknowledgement</strong>: a commit is reported to the client only after its commit record is durable."
              ] },
              { t: "p", html: "Together they make commit cheap: one sequential append and flush, instead of writing every modified page (which could be dozens of random writes) before replying." },
              { t: "h", text: "Log sequence numbers" },
              { t: "p", html: "Each record gets an <strong>LSN</strong>, a monotonically increasing position in the log (in PostgreSQL literally a byte offset into the WAL stream, shown like <code class='tok'>0/16B3740</code>). Pages, checkpoints and replicas all speak in LSNs: 'this page reflects the log up to X', 'redo from Y', 'the standby has replayed up to Z'." },
              { t: "h", text: "fsync is the real price, so share it" },
              { t: "code", lang: "text", code:
                "flush latency (fsync to stable storage)\n" +
                "  enterprise NVMe with power-loss protection   ~ 20-100 microseconds\n" +
                "  consumer SSD                                 ~ 0.5-5 ms\n" +
                "  cloud network block storage                  ~ 0.5-2 ms\n" +
                "\n" +
                "one commit per flush at 1 ms   -> ~1,000 commits/s per log\n" +
                "group commit, 40 commits/flush -> ~40,000 commits/s, same disk" },
              { t: "p", html: "<strong>Group commit</strong> lets every transaction that reaches commit while a flush is in flight piggyback on the next one. Throughput rises with concurrency while per-commit latency stays near one flush." },
              { t: "h", text: "Durability knobs" },
              { t: "table", headers: ["Setting", "Behaviour", "Risk on crash"], rows: [
                ["PostgreSQL <code class='tok'>synchronous_commit = on</code> (default)", "Wait for local WAL flush at commit", "None for acknowledged commits"],
                ["PostgreSQL <code class='tok'>synchronous_commit = off</code>", "Return before flush; WAL writer flushes shortly after", "Last few hundred ms of commits lost, no corruption"],
                ["InnoDB <code class='tok'>innodb_flush_log_at_trx_commit = 1</code> (default)", "Write and flush redo at every commit", "None for acknowledged commits"],
                ["InnoDB <code class='tok'>= 2</code>", "Write to the OS at commit, flush about once per second", "Up to ~1 s lost if the OS or machine crashes"],
                ["InnoDB <code class='tok'>= 0</code>", "Write and flush about once per second", "Up to ~1 s lost even if only mysqld crashes"]
              ] },
              { t: "h", text: "What goes into a log record" },
              { t: "table", headers: ["Style", "Records", "Example"], rows: [
                ["Physical", "Byte ranges of a page before/after", "Full-page images"],
                ["Logical", "The operation itself", "'insert row r into table t'"],
                ["Physiological", "Physical to a page, logical within it", "'on page 42, insert this tuple at slot 7' (most engines)"]
              ] },
              { t: "note", variant: "trap", html: "Turning off <code class='tok'>fsync</code> entirely (PostgreSQL <code class='tok'>fsync = off</code>) is not a durability-for-speed trade like <code class='tok'>synchronous_commit = off</code>. It can corrupt the database after an OS crash, because the WAL rule is no longer guaranteed." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'how does the database guarantee a committed write survives power loss', 'why is commit latency 2 ms', 'can we trade durability for throughput'. Answer with the WAL rule, fsync cost, group commit and the per-engine knob." },
              { t: "note", variant: "key", html: "<strong>Log first, data later: the commit record must be durable before you say yes, and a page's log records before the page.</strong> fsync latency bounds commit rate; group commit shares it; relaxed settings lose recent commits but never corrupt, while disabling fsync can." }
            ]
          },
          {
            id: "buffer-pool",
            title: "The buffer pool and page replacement",
            summary: "Frames, pins and dirty bits; LRU, Clock and their scan-resistant variants; sizing in PostgreSQL and InnoDB.",
            minutes: 11,
            tags: ["buffer-pool", "lru", "clock", "caching"],
            blocks: [
              { t: "p", html: "The buffer pool is the engine's own page cache: a fixed array of <strong>frames</strong>, each holding one page, plus a hash table mapping page ids to frames. Every page access goes through it. When the page is present it is a hit; otherwise a frame must be freed, possibly by writing a dirty page back first." },
              { t: "table", headers: ["Per-frame state", "Meaning"], rows: [
                ["Page id", "Which file and block the frame holds"],
                ["Pin count", "How many threads are using it right now; pinned frames cannot be evicted"],
                ["Dirty bit", "Modified since read; must be written (after its WAL) before reuse"],
                ["Recency or usage info", "LRU position, Clock reference bit, or usage counter"],
                ["Page LSN", "Latest log record applied, used to enforce the WAL rule"]
              ] },
              { t: "h", text: "Replacement policies" },
              { t: "ul", items: [
                "<strong>LRU</strong>: evict the least recently used page. Good locality model, but every hit must move the page in a shared list, which becomes a contention point.",
                "<strong>Clock</strong>: frames sit in a circle with a reference bit. A hit just sets the bit. To evict, the hand sweeps, clearing set bits and taking the first frame whose bit is already clear. Approximates LRU with no list manipulation on hits.",
                "<strong>PostgreSQL clock-sweep</strong>: a usage counter per buffer (capped at 5) instead of a single bit, so frequently used pages survive several sweeps.",
                "<strong>InnoDB midpoint LRU</strong>: new pages enter at the head of the <em>old</em> sublist (about 3/8 of the list from the tail) and move to the young end only if touched again after <code class='tok'>innodb_old_blocks_time</code> (1 s by default)."
              ] },
              { t: "widget", id: "storeBufferPool" },
              { t: "p", html: "Run the looping scan with 3 frames: four pages cycling through three frames give LRU a 0% hit ratio, because the page about to be needed is always the one just evicted. That is <strong>sequential flooding</strong> in miniature. The hot-page sequence shows the opposite under LRU: page 1 stays resident the whole way. Clock with a single reference bit does worse there, because one sweep clears every bit and page 1 gets evicted anyway; that is exactly why PostgreSQL keeps a usage counter instead of one bit. Switch to the mixed sequence to watch dirty evictions turn into write-backs." },
              { t: "note", variant: "warn", html: "A single report query scanning a 50 GB table through a 16 GB pool would, under plain LRU, evict every hot page your OLTP traffic relies on. PostgreSQL avoids this by giving large sequential scans a small private ring buffer (256 KB) instead of the shared pool; InnoDB's midpoint insertion keeps scanned pages in the old sublist." },
              { t: "h", text: "Sizing and double buffering" },
              { t: "table", headers: ["Engine", "Setting", "Common guidance", "Why"], rows: [
                ["PostgreSQL", "<code class='tok'>shared_buffers</code> (default 128 MB)", "~25% of RAM as a starting point", "Postgres uses buffered I/O and relies on the OS page cache for the rest"],
                ["InnoDB", "<code class='tok'>innodb_buffer_pool_size</code>", "50-75% of RAM on a dedicated server", "Usually runs with O_DIRECT, so the pool is the only cache"]
              ] },
              { t: "p", html: "Caching the same page in both the database pool and the OS cache is <strong>double buffering</strong>: it wastes RAM, which is why the two engines take opposite approaches. Either way, the target is a hit ratio high enough that steady-state reads rarely touch storage." },
              { t: "h", text: "Steal and force" },
              { t: "table", headers: ["Policy", "Meaning", "Recovery consequence"], rows: [
                ["Steal", "Dirty pages of uncommitted transactions may be written to disk", "Need undo (or MVCC invisibility) for aborted changes"],
                ["No-steal", "Uncommitted changes never reach disk", "No undo, but the pool must hold every active change"],
                ["Force", "All of a transaction's pages are flushed at commit", "No redo, but commit costs many random writes"],
                ["No-force", "Commit flushes only the log", "Need redo; this is what WAL enables"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'performance drops when the nightly report runs', 'how big should shared_buffers be', 'why not just use mmap'. Talk about scan resistance, double buffering and the WAL-before-page check the pool enforces." },
              { t: "note", variant: "key", html: "<strong>The buffer pool caches pages in frames with pin counts and dirty bits, and enforces the WAL rule on eviction.</strong> Clock-style policies approximate LRU cheaply; scan resistance (rings, midpoint insertion) stops one big scan from flushing the working set. Engines run steal / no-force." }
            ]
          },
          {
            id: "checkpoints-recovery",
            title: "Checkpoints and crash recovery",
            summary: "Why checkpoints bound recovery, how fuzzy checkpoints work, and the analysis, redo and undo passes of ARIES-style recovery.",
            minutes: 12,
            tags: ["checkpoint", "recovery", "aries", "redo", "undo"],
            blocks: [
              { t: "p", html: "After a crash, the data files are a stale and possibly inconsistent snapshot; the log holds the truth. Recovery replays the log to rebuild the state at the moment of the crash, then removes the effects of transactions that never committed. A <strong>checkpoint</strong> is a promise that limits how far back that replay must start." },
              { t: "h", text: "Fuzzy checkpoints" },
              { t: "p", html: "Stopping the world to flush every dirty page would freeze the database. Instead, engines take <strong>fuzzy checkpoints</strong>: record a redo point (an LSN), then write dirty pages in the background while transactions keep running. Once every page dirty as of the redo point has been written, the checkpoint completes and log before the redo point is no longer needed for crash recovery." },
              { t: "table", headers: ["PostgreSQL setting", "Default", "Effect"], rows: [
                ["<code class='tok'>checkpoint_timeout</code>", "5 min", "Maximum time between checkpoints"],
                ["<code class='tok'>max_wal_size</code>", "1 GB", "WAL volume that triggers a checkpoint sooner"],
                ["<code class='tok'>checkpoint_completion_target</code>", "0.9", "Spread page writes over 90% of the interval to avoid I/O spikes"],
                ["<code class='tok'>full_page_writes</code>", "on", "First change to each page after a checkpoint logs the whole page"]
              ] },
              { t: "compare",
                bad: { title: "Frequent checkpoints", items: ["Short recovery (less WAL to replay)", "More page writes: hot pages flushed repeatedly", "In Postgres, more full-page images, so much more WAL"] },
                good: { title: "Infrequent checkpoints", items: ["Hot pages absorb many changes per flush", "Less WAL from full-page images", "Longer recovery and more WAL kept on disk"] } },
              { t: "h", text: "ARIES-style recovery in three passes" },
              { t: "ol", items: [
                "<strong>Analysis</strong>: scan forward from the last checkpoint to rebuild the dirty page table and the list of transactions active at the crash.",
                "<strong>Redo</strong>: from the oldest LSN that might be missing on disk, reapply every logged change, committed or not, skipping pages whose pageLSN shows the change is already there. This 'repeats history'.",
                "<strong>Undo</strong>: roll back the transactions that were still active, writing compensation log records so a crash during recovery does not undo anything twice."
              ] },
              { t: "code", lang: "text", code:
                "LSN  100  checkpoint (redo point 090)\n" +
                "LSN  110  T1 update page 7\n" +
                "LSN  120  T2 update page 9\n" +
                "LSN  130  T1 commit           <- durable, must survive\n" +
                "LSN  140  T2 update page 7\n" +
                "     ---- crash ----\n" +
                "analysis: T2 active, pages 7 and 9 possibly dirty\n" +
                "redo    : reapply 110, 120, 140 where pageLSN is older\n" +
                "undo    : roll back T2 (140, then 120); T1 stays committed" },
              { t: "h", text: "How real engines differ" },
              { t: "table", headers: ["Engine", "Redo", "Undo"], rows: [
                ["InnoDB", "Redo log replayed from the checkpoint LSN", "Undo logs roll back uncommitted transactions (often in the background after startup)"],
                ["PostgreSQL", "WAL replayed from the last checkpoint's redo point", "No undo pass: aborted row versions simply stay invisible via the commit status log, and vacuum removes them later"],
                ["SQLite (rollback journal mode)", "None needed", "Original pages restored from the journal"],
                ["SQLite (WAL mode)", "Committed frames in the WAL file are read or checkpointed", "Uncommitted frames are ignored"]
              ] },
              { t: "note", variant: "tip", html: "Recovery time is roughly WAL to replay divided by replay speed. With <code class='tok'>max_wal_size</code> at 1 GB and replay at a few hundred MB/s, crash recovery in PostgreSQL is typically seconds to a minute; raising it to 16 GB for write-heavy systems trades that for longer worst-case restarts." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'what happens when the database restarts after a crash', 'why are there I/O spikes every five minutes', 'why does Postgres not need an undo log'. Walk through checkpoint, analysis, redo, undo, and the MVCC exception." },
              { t: "quiz", id: "store-durability" },
              { t: "note", variant: "key", html: "<strong>Checkpoints bound recovery by promising every change before the redo point is on disk.</strong> ARIES recovery runs analysis, redo (repeat history) and undo (roll back losers with compensation records); PostgreSQL skips undo because MVCC leaves aborted versions invisible." }
            ]
          }
        ]
      }
    ]
  };
})();
