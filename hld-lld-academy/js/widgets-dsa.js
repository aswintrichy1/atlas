/* =====================================================================
   BLUEPRINT · Interactive DSA widgets
   Adds graph traversal, sorting, heap, trie, two-pointer, prefix-sum,
   backtracking and big-O labs onto window.Widgets (set up by widgets.js).
   ===================================================================== */
(function () {
  "use strict";

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
      el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };
  const shell = (mount, pill, title, desc) => {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  };
  const seg = (labels, onPick) => {
    const wrap = h("div", { class: "w-seg" });
    labels.forEach((lab, i) => {
      const b = h("button", { class: i === 0 ? "active" : "" }, lab);
      b.addEventListener("click", () => {
        wrap.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        onPick(lab, i);
      });
      wrap.appendChild(b);
    });
    return wrap;
  };
  const btn = (label, cls, onClick) => h("button", { class: "w-btn " + (cls || ""), onclick: onClick }, label);
  const alive = (node) => document.body.contains(node);

  const Widgets = window.Widgets || {};

  /* ---------------------------------------------------------------
     1. GRAPH TRAVERSAL — BFS / DFS step-through
  --------------------------------------------------------------- */
  Widgets.graphtraversal = function (mount) {
    shell(mount, "graph lab", "BFS & DFS Traversal",
      "Step a breadth-first or depth-first search across a graph. Watch the queue vs. the stack, the frontier, and the tree of discovery edges grow.");

    const pos = [
      [60, 150], [165, 70], [165, 235], [275, 45], [275, 155], [385, 95], [385, 215]
    ];
    const adj = [[1, 2], [0, 3, 4], [0, 4], [1, 5], [1, 2, 5, 6], [3, 4, 6], [4, 5]];
    const N = pos.length;
    const lab = (i) => String.fromCharCode(65 + i);
    const ek = (a, b) => Math.min(a, b) + "-" + Math.max(a, b);

    let algo = "BFS", start = 0, frames = [], fi = 0, timer = null;

    function build() {
      frames = [];
      if (algo === "BFS") {
        const vis = new Set([start]); const q = [start]; const tree = [];
        frames.push({ cur: -1, vis: [...vis], ds: [...q], tree: [...tree], order: [], desc: "Enqueue " + lab(start) });
        const order = [];
        while (q.length) {
          const u = q.shift(); order.push(u);
          adj[u].forEach((v) => { if (!vis.has(v)) { vis.add(v); tree.push(ek(u, v)); q.push(v); } });
          frames.push({ cur: u, vis: [...vis], ds: [...q], tree: [...tree], order: [...order], desc: "Visit " + lab(u) + " — enqueue new neighbours" });
        }
      } else {
        const vis = new Set(); const st = [[start, -1]]; const tree = []; const order = [];
        frames.push({ cur: -1, vis: [], ds: [start], tree: [], order: [], desc: "Push " + lab(start) });
        while (st.length) {
          const [u, p] = st.pop();
          if (vis.has(u)) continue;
          vis.add(u); order.push(u); if (p >= 0) tree.push(ek(p, u));
          adj[u].slice().reverse().forEach((v) => { if (!vis.has(v)) st.push([v, u]); });
          frames.push({ cur: u, vis: [...vis], ds: st.map((s) => s[0]), tree: [...tree], order: [...order], desc: "Pop & visit " + lab(u) });
        }
      }
      fi = 0;
    }

    const svg = svgEl("svg", { class: "graph-svg", viewBox: "0 0 445 280" });
    const edgeEls = {};
    // edges first (under nodes)
    const drawn = new Set();
    for (let u = 0; u < N; u++) adj[u].forEach((v) => {
      const key = ek(u, v);
      if (drawn.has(key)) return; drawn.add(key);
      const line = svgEl("line", { class: "gt-edge", x1: pos[u][0], y1: pos[u][1], x2: pos[v][0], y2: pos[v][1] });
      edgeEls[key] = line; svg.appendChild(line);
    });
    const nodeEls = [];
    for (let i = 0; i < N; i++) {
      const g = svgEl("g", { class: "gt-node" });
      const c = svgEl("circle", { cx: pos[i][0], cy: pos[i][1], r: 18 });
      const t = svgEl("text", { x: pos[i][0], y: pos[i][1] }); t.textContent = lab(i);
      g.appendChild(c); g.appendChild(t); svg.appendChild(g); nodeEls.push(g);
    }

    const dsRow = h("div", { class: "gt-ds" });
    const orderRO = h("span", { class: "ro" }, "order ", h("b", {}, "—"));
    const stepRO = h("span", { class: "ro" }, "");
    const stage = h("div", { class: "w-stage" }, svg, dsRow);

    function paint() {
      const f = frames[fi] || frames[0];
      const visSet = new Set(f.vis); const dsSet = new Set(f.ds); const treeSet = new Set(f.tree);
      nodeEls.forEach((g, i) => {
        g.classList.remove("visited", "frontier", "current");
        if (i === f.cur) g.classList.add("current");
        else if (visSet.has(i)) g.classList.add("visited");
        else if (dsSet.has(i)) g.classList.add("frontier");
      });
      Object.keys(edgeEls).forEach((k) => edgeEls[k].classList.toggle("tree", treeSet.has(k)));
      dsRow.innerHTML = "";
      dsRow.appendChild(h("span", { class: "gt-ds-lbl" }, algo === "BFS" ? "Queue (FIFO)" : "Stack (LIFO)"));
      (f.ds.length ? f.ds : []).forEach((n) => dsRow.appendChild(h("span", { class: "gt-ds-cell" }, lab(n))));
      if (!f.ds.length) dsRow.appendChild(h("span", { class: "gt-ds-lbl" }, "empty"));
      orderRO.querySelector("b").textContent = f.order.length ? f.order.map(lab).join(" → ") : "—";
      stepRO.textContent = f.desc + "  (" + (fi + 1) + "/" + frames.length + ")";
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; autoBtn.textContent = "Auto-play"; } }
    function step() { if (fi < frames.length - 1) { fi++; paint(); } else stop(); }
    function reset() { stop(); build(); paint(); }

    const autoBtn = btn("Auto-play", "primary", () => {
      if (timer) { stop(); return; }
      if (fi >= frames.length - 1) { build(); fi = 0; }
      autoBtn.textContent = "Pause";
      timer = setInterval(() => { if (!alive(mount)) { stop(); return; } if (fi >= frames.length - 1) { stop(); return; } step(); }, 800);
    });

    const controls = h("div", { class: "widget-controls" },
      seg(["BFS", "DFS"], (v) => { algo = v; reset(); }),
      h("label", { class: "w-field" }, "from ",
        (() => {
          const s = h("select");
          for (let i = 0; i < N; i++) s.appendChild(h("option", { value: i }, lab(i)));
          s.addEventListener("change", () => { start = +s.value; reset(); });
          return s;
        })()
      ),
      btn("Step", "ghost", step), autoBtn, btn("Reset", "ghost", reset)
    );

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(h("div", { class: "w-readout" }, orderRO, stepRO));
    mount.appendChild(h("div", { class: "dsa-legend" },
      legendItem("var(--amber)", "current"), legendItem("var(--cyan)", "frontier"),
      legendItem("var(--violet)", "visited"), legendItem("transparent", "unseen")
    ));
    build(); paint();
  };

  function legendItem(color, label) {
    return h("span", {}, h("i", { style: "background:" + color }), label);
  }

  /* ---------------------------------------------------------------
     2. SORTING VISUALIZER
  --------------------------------------------------------------- */
  Widgets.sortviz = function (mount) {
    shell(mount, "sorting lab", "Sorting Visualizer",
      "Watch six algorithms reorder the same bars. Compare the work each one does — and see why counting sort beats the O(n log n) wall when keys are small.");

    const BIG = { Bubble: "O(n²)", Insertion: "O(n²)", Selection: "O(n²)", Quick: "O(n log n) avg", Merge: "O(n log n)", Counting: "O(n + k)" };
    let algo = "Bubble", base = [], frames = [], fi = 0, timer = null;

    function shuffle() {
      const n = 20; base = [];
      for (let i = 0; i < n; i++) base.push(2 + Math.floor(Math.random() * 98));
    }

    function record(frames, arr, type, idx, sorted, pivot) {
      frames.push({ arr: arr.slice(), type: type, idx: idx || [], sorted: sorted ? sorted.slice() : [], pivot: pivot == null ? -1 : pivot, cmp: 0, wr: 0 });
    }

    function gen() {
      const a = base.slice(); const F = []; let cmp = 0, wr = 0;
      const sortedSet = [];
      const snap = (type, idx, pivot) => { F.push({ arr: a.slice(), type: type, idx: idx || [], sorted: sortedSet.slice(), pivot: pivot == null ? -1 : pivot, cmp: cmp, wr: wr }); };
      const n = a.length;
      if (algo === "Bubble") {
        for (let i = 0; i < n - 1; i++) {
          for (let j = 0; j < n - 1 - i; j++) { cmp++; snap("cmp", [j, j + 1]); if (a[j] > a[j + 1]) { [a[j], a[j + 1]] = [a[j + 1], a[j]]; wr += 2; snap("swap", [j, j + 1]); } }
          sortedSet.push(n - 1 - i);
        }
        sortedSet.push(0);
      } else if (algo === "Insertion") {
        sortedSet.push(0);
        for (let i = 1; i < n; i++) {
          let j = i; cmp++; snap("cmp", [j, j - 1]);
          while (j > 0 && a[j - 1] > a[j]) { [a[j], a[j - 1]] = [a[j - 1], a[j]]; wr += 2; snap("swap", [j, j - 1]); j--; if (j > 0) { cmp++; snap("cmp", [j, j - 1]); } }
          if (!sortedSet.includes(i)) sortedSet.push(i);
        }
      } else if (algo === "Selection") {
        for (let i = 0; i < n - 1; i++) {
          let m = i;
          for (let j = i + 1; j < n; j++) { cmp++; snap("cmp", [m, j]); if (a[j] < a[m]) m = j; }
          if (m !== i) { [a[i], a[m]] = [a[m], a[i]]; wr += 2; snap("swap", [i, m]); }
          sortedSet.push(i);
        }
        sortedSet.push(n - 1);
      } else if (algo === "Quick") {
        const qs = (lo, hi) => {
          if (lo >= hi) { if (lo === hi) sortedSet.push(lo); return; }
          const pivot = a[hi]; let i = lo;
          for (let j = lo; j < hi; j++) { cmp++; snap("cmp", [j, hi], hi); if (a[j] < pivot) { if (i !== j) { [a[i], a[j]] = [a[j], a[i]]; wr += 2; snap("swap", [i, j], hi); } i++; } }
          [a[i], a[hi]] = [a[hi], a[i]]; wr += 2; snap("swap", [i, hi], hi); sortedSet.push(i);
          qs(lo, i - 1); qs(i + 1, hi);
        };
        qs(0, n - 1);
      } else if (algo === "Merge") {
        const tmp = a.slice();
        const ms = (lo, hi) => {
          if (hi - lo < 1) return;
          const mid = (lo + hi) >> 1; ms(lo, mid); ms(mid + 1, hi);
          let i = lo, j = mid + 1, k = lo;
          while (i <= mid && j <= hi) { cmp++; snap("cmp", [i, j]); tmp[k++] = (a[i] <= a[j]) ? a[i++] : a[j++]; }
          while (i <= mid) tmp[k++] = a[i++];
          while (j <= hi) tmp[k++] = a[j++];
          for (let x = lo; x <= hi; x++) { a[x] = tmp[x]; wr++; snap("swap", [x]); }
        };
        ms(0, n - 1);
        for (let i = 0; i < n; i++) sortedSet.push(i);
      } else { // Counting
        const max = Math.max.apply(null, a); const count = new Array(max + 1).fill(0);
        for (let i = 0; i < n; i++) { count[a[i]]++; snap("cmp", [i]); }
        let idx = 0;
        for (let v = 0; v <= max; v++) { while (count[v]-- > 0) { a[idx] = v; wr++; sortedSet.push(idx); snap("swap", [idx]); idx++; } }
      }
      snap("done", []);
      frames.length = 0; F.forEach((f) => frames.push(f)); fi = 0;
    }

    const bars = h("div", { class: "sv-bars" });
    const cmpRO = h("span", { class: "ro" }, "comparisons ", h("b", {}, "0"));
    const wrRO = h("span", { class: "ro" }, "writes ", h("b", {}, "0"));
    const bigRO = h("span", { class: "ro" }, "Big-O ", h("b", {}, BIG.Bubble));

    function paint() {
      const f = frames[fi] || frames[0];
      const max = Math.max.apply(null, f.arr);
      const sortedSet = new Set(f.sorted); const idxSet = new Set(f.idx);
      bars.innerHTML = "";
      f.arr.forEach((v, i) => {
        let cls = "sv-bar";
        if (f.type === "done" || sortedSet.has(i)) cls += " sorted";
        else if (i === f.pivot) cls += " pivot";
        else if (idxSet.has(i)) cls += (f.type === "swap" ? " swap" : " cmp");
        bars.appendChild(h("div", { class: cls, style: "height:" + (v / max * 100) + "%" }));
      });
      cmpRO.querySelector("b").textContent = f.cmp;
      wrRO.querySelector("b").textContent = f.wr;
      bigRO.querySelector("b").textContent = BIG[algo];
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; runBtn.textContent = "Run"; } }
    function step() { if (fi < frames.length - 1) { fi++; paint(); } else stop(); }
    function reset(reshuffle) { stop(); if (reshuffle) shuffle(); gen(); paint(); }

    const runBtn = btn("Run", "primary", () => {
      if (timer) { stop(); return; }
      if (fi >= frames.length - 1) { gen(); fi = 0; }
      runBtn.textContent = "Pause";
      timer = setInterval(() => { if (!alive(mount)) { stop(); return; } if (fi >= frames.length - 1) { stop(); return; } step(); }, 90);
    });

    const controls = h("div", { class: "widget-controls" },
      seg(["Bubble", "Insertion", "Selection", "Quick", "Merge", "Counting"], (v) => { algo = v; reset(false); }),
      btn("Step", "ghost", step), runBtn, btn("Shuffle", "ghost", () => reset(true))
    );
    mount.appendChild(controls);
    mount.appendChild(h("div", { class: "w-stage" }, bars));
    mount.appendChild(h("div", { class: "w-readout" }, cmpRO, wrRO, bigRO));
    shuffle(); gen(); paint();
  };

  /* ---------------------------------------------------------------
     3. BINARY HEAP (min-heap)
  --------------------------------------------------------------- */
  Widgets.heap = function (mount) {
    shell(mount, "heap lab", "Binary Min-Heap",
      "Insert keys and extract the minimum. The array is the heap; the tree is just a picture of it. Notice the shape stays complete and every parent ≤ its children.");

    let heap = [];
    const feed = [5, 9, 3, 8, 1, 7, 12, 2, 6, 10, 4, 11]; let fp = 0;
    const log = h("div", { class: "dsa-log" });
    function logln(html, cls) { const d = h("div", cls ? { class: cls } : {}); d.innerHTML = html; log.insertBefore(d, log.firstChild); }

    const svg = svgEl("svg", { class: "tree-svg", viewBox: "0 0 520 230" });
    const cells = h("div", { class: "dsa-cells" });

    function swap(i, j) { const t = heap[i]; heap[i] = heap[j]; heap[j] = t; }
    function siftUp(i) { const path = [i]; while (i > 0) { const p = (i - 1) >> 1; if (heap[p] <= heap[i]) break; swap(i, p); i = p; path.push(i); } return path; }
    function siftDown(i) { const n = heap.length; const path = [i]; for (; ;) { let s = i, l = 2 * i + 1, r = 2 * i + 2; if (l < n && heap[l] < heap[s]) s = l; if (r < n && heap[r] < heap[s]) s = r; if (s === i) break; swap(i, s); i = s; path.push(i); } return path; }

    function insert(x) {
      if (heap.length >= 15) { logln('<span class="no">heap full (15 max for layout)</span>'); return; }
      heap.push(x); const path = siftUp(heap.length - 1);
      logln('insert <b class="hi2">' + x + '</b> → sift-up ' + (path.length > 1 ? "swaps to index " + path[path.length - 1] : "stays at leaf"), null);
      render(new Set([path[path.length - 1]]));
    }
    function extract() {
      if (!heap.length) { logln('<span class="no">heap empty</span>'); return; }
      const min = heap[0]; const last = heap.pop();
      if (heap.length) { heap[0] = last; siftDown(0); }
      logln('extract-min → <b class="ok">' + min + '</b>; ' + last + ' sifts down', null);
      render(new Set([0]));
    }

    function render(hot) {
      hot = hot || new Set();
      cells.innerHTML = "";
      heap.forEach((v, i) => {
        const c = h("div", { class: "dsa-cell" + (hot.has(i) ? " cur" : "") }, h("span", { class: "idx" }, i), String(v));
        cells.appendChild(c);
      });
      if (!heap.length) cells.appendChild(h("div", { class: "gt-ds-lbl", style: "font-family:var(--font-mono);color:var(--text-faint)" }, "empty heap"));
      // tree
      svg.innerHTML = "";
      const n = heap.length;
      const xfor = (i) => { const d = Math.floor(Math.log2(i + 1)); const start = (1 << d) - 1; const within = i - start; const cnt = 1 << d; return (within + 0.5) / cnt * 520; };
      const yfor = (i) => 30 + Math.floor(Math.log2(i + 1)) * 58;
      for (let i = 0; i < n; i++) {
        const p = (i - 1) >> 1;
        if (i > 0) svg.appendChild(svgEl("line", { class: "tr-edge" + (hot.has(i) ? " on" : ""), x1: xfor(p), y1: yfor(p), x2: xfor(i), y2: yfor(i) }));
      }
      for (let i = 0; i < n; i++) {
        const g = svgEl("g", { class: "tr-node" + (hot.has(i) ? " on" : "") + (i === 0 ? " word" : "") });
        g.appendChild(svgEl("circle", { cx: xfor(i), cy: yfor(i), r: 16 }));
        const t = svgEl("text", { x: xfor(i), y: yfor(i) }); t.textContent = heap[i]; g.appendChild(t);
        svg.appendChild(g);
      }
    }

    const controls = h("div", { class: "widget-controls" },
      btn("Insert next", "primary", () => { insert(feed[fp % feed.length]); fp++; }),
      btn("Insert random", "ghost", () => insert(1 + Math.floor(Math.random() * 99))),
      btn("Extract-min", "ghost", extract),
      btn("Reset", "ghost", () => { heap = []; fp = 0; log.innerHTML = ""; render(); })
    );
    mount.appendChild(controls);
    mount.appendChild(h("div", { class: "w-stage" }, svg, cells));
    mount.appendChild(log);
    mount.appendChild(h("div", { class: "dsa-legend" }, legendItem("var(--cyan)", "root = current min"), legendItem("var(--accent)", "just moved")));
    [5, 9, 3, 8, 1].forEach((v) => { heap.push(v); siftUp(heap.length - 1); }); fp = 5;
    render();
  };

  /* ---------------------------------------------------------------
     4. TRIE (prefix tree)
  --------------------------------------------------------------- */
  Widgets.trie = function (mount) {
    shell(mount, "trie lab", "Trie / Prefix Tree",
      "Insert words and search by prefix. Each edge is one character; shared prefixes share a path — that is what makes a trie fast for autocomplete.");

    const root = { ch: "", kids: {}, end: false };
    const log = h("div", { class: "dsa-log" });
    function logln(html, cls) { const d = h("div", cls ? { class: cls } : {}); d.innerHTML = html; log.insertBefore(d, log.firstChild); }

    function insert(word) {
      word = (word || "").toLowerCase().replace(/[^a-z]/g, "");
      if (!word) return;
      let node = root, created = 0;
      for (const c of word) { if (!node.kids[c]) { node.kids[c] = { ch: c, kids: {}, end: false }; created++; } node = node.kids[c]; }
      node.end = true;
      logln('insert "<b class="hi2">' + word + '</b>" — ' + created + ' new node(s)');
      render();
    }
    function search(word, prefixMode) {
      word = (word || "").toLowerCase().replace(/[^a-z]/g, "");
      if (!word) return;
      let node = root; const path = [root];
      for (const c of word) { if (!node.kids[c]) { render(path, false); logln('search "<b>' + word + '</b>" → <span class="no">no path at \'' + c + '\'</span>'); return; } node = node.kids[c]; path.push(node); }
      const ok = prefixMode ? true : node.end;
      render(path, ok);
      logln((prefixMode ? 'prefix "' : 'search "') + '<b>' + word + '</b>" → ' + (ok ? '<span class="ok">' + (prefixMode ? "prefix exists" : "found") + '</span>' : '<span class="no">' + (node.end ? "found" : "prefix only, not a word") + '</span>'));
    }

    const svg = svgEl("svg", { class: "tree-svg", viewBox: "0 0 520 250" });

    function layout() {
      // assign x by leaf order (in-order), y by depth
      let leaf = 0; const nodes = [];
      (function walk(node, depth, parent) {
        const kids = Object.keys(node.kids).sort().map((k) => node.kids[k]);
        const rec = { node: node, depth: depth, parent: parent, x: 0 };
        nodes.push(rec);
        if (!kids.length) { rec.x = leaf++; }
        else { const xs = kids.map((k) => walk(k, depth + 1, rec)); rec.x = xs.reduce((a, b) => a + b, 0) / xs.length; }
        return rec.x;
      })(root, 0, null);
      return nodes;
    }

    function render(hotPath, ok) {
      svg.innerHTML = "";
      const nodes = layout();
      const maxLeaf = Math.max(1, Math.max.apply(null, nodes.map((r) => r.x)));
      const maxDepth = Math.max(1, Math.max.apply(null, nodes.map((r) => r.depth)));
      const X = (r) => 30 + (r.x / maxLeaf) * 460;
      const Y = (r) => 26 + (r.depth / Math.max(1, maxDepth)) * (maxDepth > 0 ? maxDepth * 56 : 56);
      const hot = new Set(hotPath || []);
      nodes.forEach((r) => { if (r.parent) svg.appendChild(svgEl("line", { class: "tr-edge" + (hot.has(r.node) && hot.has(r.parent.node) ? " on" : ""), x1: X(r.parent), y1: Y(r.parent), x2: X(r), y2: Y(r) })); });
      nodes.forEach((r) => {
        let cls = "tr-node";
        if (r.node.end) cls += " word";
        if (hot.has(r.node)) cls += (ok === false && r.node === (hotPath ? hotPath[hotPath.length - 1] : null)) ? " cmp" : " on";
        const g = svgEl("g", { class: cls });
        g.appendChild(svgEl("circle", { cx: X(r), cy: Y(r), r: 14 }));
        const t = svgEl("text", { x: X(r), y: Y(r) }); t.textContent = r.node.ch || "•"; g.appendChild(t);
        svg.appendChild(g);
      });
    }

    const input = h("input", { type: "text", placeholder: "word…", value: "card", style: "min-width:120px" });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { insert(input.value); input.value = ""; } });
    const chips = h("div", { class: "widget-controls" });
    ["cat", "car", "card", "care", "dog", "do", "dodge", "can"].forEach((w) =>
      chips.appendChild(h("button", { class: "w-btn ghost", onclick: () => insert(w) }, "+ " + w)));

    const controls = h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, input),
      btn("Insert", "primary", () => { insert(input.value); input.value = ""; }),
      btn("Search word", "ghost", () => search(input.value, false)),
      btn("Search prefix", "ghost", () => search(input.value, true)),
      btn("Reset", "ghost", () => { root.kids = {}; root.end = false; log.innerHTML = ""; render(); })
    );
    mount.appendChild(controls);
    mount.appendChild(chips);
    mount.appendChild(h("div", { class: "w-stage" }, svg));
    mount.appendChild(log);
    mount.appendChild(h("div", { class: "dsa-legend" }, legendItem("var(--cyan)", "end of a word"), legendItem("var(--accent)", "search path")));
    ["cat", "car", "card", "can", "do", "dog"].forEach((w) => insert(w));
  };

  /* ---------------------------------------------------------------
     5. TWO-POINTER (pair sum on a sorted array)
  --------------------------------------------------------------- */
  Widgets.twopointer = function (mount) {
    shell(mount, "technique lab", "Two-Pointer Pair Sum",
      "On a sorted array, two pointers converge from the ends to find a pair summing to the target — O(n) instead of O(n²) nested loops.");

    let arr = [2, 3, 5, 8, 11, 15, 18, 21], target = 19, frames = [], fi = 0, timer = null;

    function build() {
      frames = []; let lo = 0, hi = arr.length - 1;
      while (lo < hi) {
        const sum = arr[lo] + arr[hi];
        frames.push({ lo, hi, sum, status: sum === target ? "hit" : (sum < target ? "low" : "high") });
        if (sum === target) break;
        if (sum < target) lo++; else hi--;
      }
      if (!frames.length || frames[frames.length - 1].status !== "hit") frames.push({ lo: -1, hi: -1, sum: 0, status: "none" });
      fi = 0;
    }

    const cells = h("div", { class: "dsa-cells" });
    const sumRO = h("span", { class: "ro" }, "");
    const log = h("div", { class: "dsa-log" });

    function paint(appendLog) {
      const f = frames[fi];
      cells.innerHTML = "";
      arr.forEach((v, i) => {
        let cls = "dsa-cell";
        if (f.status === "hit" && (i === f.lo || i === f.hi)) cls += " hit";
        else if (i === f.lo) cls += " lo";
        else if (i === f.hi) cls += " hi";
        else if (f.lo >= 0 && (i < f.lo || i > f.hi)) cls += " dim";
        const c = h("div", { class: cls }, h("span", { class: "idx" }, i), String(v),
          i === f.lo ? h("span", { class: "ptr" }, "L") : (i === f.hi ? h("span", { class: "ptr" }, "R") : null));
        cells.appendChild(c);
      });
      if (f.status === "none") { sumRO.innerHTML = ""; sumRO.appendChild(h("b", { style: "color:var(--rose)" }, "no pair sums to " + target)); }
      else {
        sumRO.innerHTML = "";
        sumRO.appendChild(document.createTextNode("arr[L] + arr[R] = " + arr[f.lo] + " + " + arr[f.hi] + " = "));
        sumRO.appendChild(h("b", { style: "color:" + (f.status === "hit" ? "var(--lime)" : "var(--accent)") }, String(f.sum)));
        sumRO.appendChild(document.createTextNode(" " + (f.status === "hit" ? "= target ✓" : (f.status === "low" ? "< " + target + " → move L right" : "> " + target + " → move R left"))));
      }
      if (appendLog && f.status !== "none") {
        const d = h("div", f.status === "hit" ? { class: "ok" } : {});
        d.textContent = "L=" + f.lo + " R=" + f.hi + "  sum=" + f.sum + (f.status === "hit" ? "  FOUND" : (f.status === "low" ? "  <  L++" : "  >  R--"));
        log.insertBefore(d, log.firstChild);
      }
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; autoBtn.textContent = "Auto"; } }
    function step() { if (fi < frames.length - 1) { fi++; paint(true); } else stop(); }
    function reset() { stop(); log.innerHTML = ""; build(); paint(false); }

    const autoBtn = btn("Auto", "primary", () => {
      if (timer) { stop(); return; }
      if (fi >= frames.length - 1) { reset(); }
      autoBtn.textContent = "Pause";
      timer = setInterval(() => { if (!alive(mount)) { stop(); return; } if (fi >= frames.length - 1) { stop(); return; } step(); }, 750);
    });

    const tInput = h("input", { type: "number", value: String(target), style: "width:72px" });
    tInput.addEventListener("change", () => { target = +tInput.value || 0; reset(); });

    const controls = h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "target ", tInput),
      seg(["19", "26", "7", "39"], (v) => { target = +v; tInput.value = v; reset(); }),
      btn("Step", "ghost", step), autoBtn, btn("New array", "ghost", () => {
        const n = 8; const set = new Set(); while (set.size < n) set.add(2 + Math.floor(Math.random() * 28));
        arr = [...set].sort((a, b) => a - b); reset();
      })
    );
    mount.appendChild(controls);
    mount.appendChild(h("div", { class: "w-stage" }, cells));
    mount.appendChild(h("div", { class: "w-readout" }, sumRO));
    mount.appendChild(log);
    build(); paint(false);
  };

  /* ---------------------------------------------------------------
     6. PREFIX SUM (O(1) range queries)
  --------------------------------------------------------------- */
  Widgets.prefixsum = function (mount) {
    shell(mount, "technique lab", "Prefix Sums",
      "Pre-compute running totals once, then answer any range-sum query in O(1) with a single subtraction. Pick a range and watch the formula.");

    let arr = [3, 1, 4, 1, 5, 9, 2, 6]; let lo = 2, hi = 5;
    const pre = () => { const p = [0]; for (let i = 0; i < arr.length; i++) p.push(p[i] + arr[i]); return p; };

    const arrRow = h("div", { class: "dsa-cells" });
    const preRow = h("div", { class: "dsa-cells" });
    const formula = h("span", { class: "ro" }, "");

    function paint() {
      const P = pre();
      arrRow.innerHTML = ""; preRow.innerHTML = "";
      arr.forEach((v, i) => {
        const inR = i >= lo && i <= hi;
        arrRow.appendChild(h("div", { class: "dsa-cell" + (inR ? " range" : "") }, h("span", { class: "idx" }, i), String(v)));
      });
      P.forEach((v, i) => {
        let cls = "dsa-cell";
        if (i === lo) cls += " lo"; else if (i === hi + 1) cls += " hi";
        preRow.appendChild(h("div", { class: cls }, h("span", { class: "idx" }, "P" + i), String(v),
          i === lo ? h("span", { class: "ptr" }, "P[l]") : (i === hi + 1 ? h("span", { class: "ptr" }, "P[r+1]") : null)));
      });
      const brute = arr.slice(lo, hi + 1).reduce((a, b) => a + b, 0);
      formula.innerHTML = "";
      formula.appendChild(document.createTextNode("sum(" + lo + ".." + hi + ") = P[" + (hi + 1) + "] − P[" + lo + "] = " + P[hi + 1] + " − " + P[lo] + " = "));
      formula.appendChild(h("b", { style: "color:var(--lime)" }, String(P[hi + 1] - P[lo])));
      formula.appendChild(document.createTextNode("  (brute-force check: " + brute + ")"));
    }

    const mkSel = (cur, onCh, count) => {
      const s = h("select");
      for (let i = 0; i < count; i++) s.appendChild(h("option", { value: i, selected: i === cur ? "selected" : null }, String(i)));
      s.addEventListener("change", () => onCh(+s.value));
      return s;
    };
    const loSel = mkSel(lo, (v) => { lo = v; if (hi < lo) hi = lo; rebuild(); }, arr.length);
    const hiSel = mkSel(hi, (v) => { hi = v; if (lo > hi) lo = hi; rebuild(); }, arr.length);
    function rebuild() {
      const c = mount.querySelector(".widget-controls");
      const nl = mkSel(lo, (v) => { lo = v; if (hi < lo) hi = lo; rebuild(); }, arr.length);
      const nh = mkSel(hi, (v) => { hi = v; if (lo > hi) lo = hi; rebuild(); }, arr.length);
      c.replaceChild(nl, c.querySelector(".js-lo")); nl.className = "js-lo";
      c.replaceChild(nh, c.querySelector(".js-hi")); nh.className = "js-hi";
      paint();
    }
    loSel.className = "js-lo"; hiSel.className = "js-hi";

    const controls = h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "l ", loSel),
      h("label", { class: "w-field" }, "r ", hiSel),
      btn("Randomize", "ghost", () => {
        arr = Array.from({ length: 8 }, () => 1 + Math.floor(Math.random() * 9)); lo = 1; hi = 4; rebuild();
      })
    );
    mount.appendChild(controls);
    mount.appendChild(h("div", { class: "w-stage" },
      h("div", { class: "gt-ds-lbl", style: "font-family:var(--font-mono);font-size:.7rem;color:var(--text-faint)" }, "array"), arrRow,
      h("div", { class: "gt-ds-lbl", style: "font-family:var(--font-mono);font-size:.7rem;color:var(--text-faint);margin-top:6px" }, "prefix  P[i] = P[i-1] + arr[i-1]"), preRow
    ));
    mount.appendChild(h("div", { class: "w-readout" }, formula));
    paint();
  };

  /* ---------------------------------------------------------------
     7. BACKTRACKING (N-Queens)
  --------------------------------------------------------------- */
  Widgets.backtracking = function (mount) {
    shell(mount, "recursion lab", "Backtracking · N-Queens",
      "Place N queens so none attack each other. The solver tries a square, recurses if it is safe, and backtracks the moment it hits a dead end.");

    let N = 6, frames = [], fi = 0, timer = null, placed = 0, backs = 0;

    function build() {
      frames = []; const q = new Array(N).fill(-1); let solved = false; let pl = 0, bk = 0;
      const safe = (r, c) => { for (let i = 0; i < r; i++) { if (q[i] === c || Math.abs(q[i] - c) === r - i) return false; } return true; };
      (function bt(r) {
        if (solved) return;
        if (r === N) { solved = true; frames.push({ q: q.slice(), r: -1, c: -1, st: "solved", pl: pl, bk: bk }); return; }
        for (let c = 0; c < N; c++) {
          frames.push({ q: q.slice(), r, c, st: "try", pl: pl, bk: bk });
          if (safe(r, c)) { q[r] = c; pl++; frames.push({ q: q.slice(), r, c, st: "place", pl: pl, bk: bk }); bt(r + 1); if (solved) return; q[r] = -1; bk++; frames.push({ q: q.slice(), r, c, st: "back", pl: pl, bk: bk }); }
          else { frames.push({ q: q.slice(), r, c, st: "bad", pl: pl, bk: bk }); }
        }
      })(0);
      fi = 0;
    }

    const board = h("div", { class: "bt-board", style: "grid-template-columns:repeat(" + N + ",38px)" });
    const log = h("div", { class: "dsa-log" });
    const plRO = h("span", { class: "ro" }, "placements ", h("b", {}, "0"));
    const bkRO = h("span", { class: "ro" }, "backtracks ", h("b", {}, "0"));

    function paint(appendLog) {
      const f = frames[fi];
      board.style.gridTemplateColumns = "repeat(" + N + ",38px)";
      board.innerHTML = "";
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        let cls = "bt-cell" + (((r + c) % 2) ? " dark" : "");
        const isQ = f.q[r] === c;
        if (isQ) cls += " queen";
        if (r === f.r && c === f.c) { if (f.st === "try") cls += " try"; else if (f.st === "bad") cls += " bad"; }
        board.appendChild(h("div", { class: cls }, isQ ? "♛" : ""));
      }
      plRO.querySelector("b").textContent = f.pl;
      bkRO.querySelector("b").textContent = f.bk;
      if (appendLog) {
        const txt = { try: "row " + f.r + ": try col " + f.c, place: "row " + f.r + ": place ♛ at col " + f.c, bad: "row " + f.r + ": col " + f.c + " attacked", back: "backtrack from row " + f.r, solved: "SOLVED ✓" }[f.st];
        const d = h("div", f.st === "solved" ? { class: "ok" } : (f.st === "bad" || f.st === "back" ? { class: "no" } : (f.st === "place" ? { class: "hi2" } : {})));
        d.textContent = txt; log.insertBefore(d, log.firstChild);
      }
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; autoBtn.textContent = "Auto-solve"; } }
    function step() { if (fi < frames.length - 1) { fi++; paint(true); } else stop(); }
    function reset() { stop(); log.innerHTML = ""; build(); paint(false); }

    const autoBtn = btn("Auto-solve", "primary", () => {
      if (timer) { stop(); return; }
      if (fi >= frames.length - 1) reset();
      autoBtn.textContent = "Pause";
      timer = setInterval(() => { if (!alive(mount)) { stop(); return; } if (fi >= frames.length - 1) { stop(); return; } step(); }, 120);
    });

    const controls = h("div", { class: "widget-controls" },
      seg(["6", "4", "5", "7", "8"], (v) => { N = +v; reset(); }),
      btn("Step", "ghost", step), autoBtn, btn("Reset", "ghost", reset)
    );
    mount.appendChild(controls);
    mount.appendChild(h("div", { class: "w-stage" }, board));
    mount.appendChild(h("div", { class: "w-readout" }, plRO, bkRO));
    mount.appendChild(log);
    build(); paint(false);
  };

  /* ---------------------------------------------------------------
     8. BIG-O GROWTH EXPLORER
  --------------------------------------------------------------- */
  Widgets.bigo = function (mount) {
    shell(mount, "complexity lab", "Big-O Growth Explorer",
      "How the number of operations explodes as input size n grows. Drag n and compare — the y-axis is log-scaled, so each gap is an order of magnitude.");

    const NMAX = 32;
    const fns = [
      { k: "O(1)", c: "var(--text-dim)", f: () => 1 },
      { k: "O(log n)", c: "var(--cyan)", f: (n) => Math.log2(n) },
      { k: "O(n)", c: "var(--lime)", f: (n) => n },
      { k: "O(n log n)", c: "var(--amber)", f: (n) => n * Math.log2(n) },
      { k: "O(n²)", c: "var(--violet)", f: (n) => n * n },
      { k: "O(2ⁿ)", c: "var(--rose)", f: (n) => Math.pow(2, n) }
    ];
    let n = 12, on = -1;
    const W = 540, H = 250, PADL = 40, PADB = 28, PADT = 12, PADR = 12;
    const maxV = Math.pow(2, NMAX);
    const yOf = (v) => { const t = Math.log10(v + 1) / Math.log10(maxV + 1); return H - PADB - t * (H - PADB - PADT); };
    const xOf = (nn) => PADL + (nn - 1) / (NMAX - 1) * (W - PADL - PADR);

    const svg = svgEl("svg", { class: "bigo-svg", viewBox: "0 0 " + W + " " + H });
    const readout = h("div", { class: "dsa-log" });

    function fmt(v) { if (v < 1000) return String(Math.round(v)); if (v < 1e6) return Math.round(v).toLocaleString(); return v.toExponential(2); }

    function draw() {
      svg.innerHTML = "";
      // axes
      svg.appendChild(svgEl("line", { class: "bigo-axis", x1: PADL, y1: H - PADB, x2: W - PADR, y2: H - PADB }));
      svg.appendChild(svgEl("line", { class: "bigo-axis", x1: PADL, y1: PADT, x2: PADL, y2: H - PADB }));
      [1, 100, 1e4, 1e6, 1e8].forEach((gv) => {
        const y = yOf(gv); svg.appendChild(svgEl("line", { class: "bigo-grid", x1: PADL, y1: y, x2: W - PADR, y2: y }));
        const tl = svgEl("text", { class: "bigo-lbl", x: 4, y: y + 3 }); tl.textContent = gv >= 1e6 ? (gv / 1e6) + "M" : (gv >= 1000 ? gv / 1000 + "k" : gv); svg.appendChild(tl);
      });
      const xl = svgEl("text", { class: "bigo-lbl", x: W - PADR - 26, y: H - 8 }); xl.textContent = "n=" + NMAX; svg.appendChild(xl);
      const x0 = svgEl("text", { class: "bigo-lbl", x: PADL - 2, y: H - 8 }); x0.textContent = "1"; svg.appendChild(x0);
      // curves
      fns.forEach((fn, idx) => {
        let d = "";
        for (let nn = 1; nn <= NMAX; nn++) { d += (nn === 1 ? "M" : "L") + xOf(nn).toFixed(1) + " " + yOf(fn.f(nn)).toFixed(1) + " "; }
        svg.appendChild(svgEl("path", { class: "bigo-curve" + (on === idx || on === -1 ? " on" : ""), d: d, stroke: fn.c }));
      });
      // marker at n
      svg.appendChild(svgEl("line", { class: "bigo-grid", x1: xOf(n), y1: PADT, x2: xOf(n), y2: H - PADB, "stroke-dasharray": "3 4" }));
      fns.forEach((fn) => { if (on === -1 || fns[on] === fn) svg.appendChild(svgEl("circle", { class: "bigo-marker", cx: xOf(n), cy: yOf(fn.f(n)), r: 3.5, fill: fn.c })); });
      // readout
      readout.innerHTML = "";
      readout.appendChild(h("div", { class: "mut" }, "operations at n = " + n + ":"));
      fns.forEach((fn) => {
        const d = h("div", {});
        d.innerHTML = '<span style="color:' + fn.c + ';font-weight:700">' + fn.k + '</span> → ' + fmt(fn.f(n));
        readout.appendChild(d);
      });
    }

    const slider = h("input", { type: "range", min: "1", max: String(NMAX), value: String(n), style: "width:200px;accent-color:var(--accent)" });
    slider.addEventListener("input", () => { n = +slider.value; draw(); });
    const legend = h("div", { class: "dsa-legend" });
    fns.forEach((fn, idx) => {
      const s = h("span", { style: "cursor:pointer" }, h("i", { style: "background:" + fn.c }), fn.k);
      s.addEventListener("click", () => { on = on === idx ? -1 : idx; draw(); });
      legend.appendChild(s);
    });

    mount.appendChild(h("div", { class: "widget-controls" }, h("label", { class: "w-field" }, "input size  n = " + n, slider)));
    // keep the n label live
    const nlab = mount.querySelector(".w-field");
    slider.addEventListener("input", () => { nlab.firstChild.textContent = "input size  n = " + n; });
    mount.appendChild(h("div", { class: "w-stage" }, svg));
    mount.appendChild(legend);
    mount.appendChild(readout);
    draw();
  };

  /* ---------------------------------------------------------------
     UNION-FIND (disjoint set) — union by rank + path compression
  --------------------------------------------------------------- */
  Widgets.unionfind = function (mount) {
    shell(mount, "structure lab", "Union-Find / Disjoint Set",
      "Merge elements into groups and ask 'are these two connected?' in near-O(1). Union by rank keeps trees flat; path compression flattens them further on every find.");

    const N = 8;
    const pos = [];
    for (let i = 0; i < N; i++) pos.push([55 + i * 56, 70]);
    let parent = [], rank = [], compress = true, ops = 0, finds = 0;
    function reset() { parent = Array.from({ length: N }, (_, i) => i); rank = new Array(N).fill(0); ops = 0; finds = 0; log.innerHTML = ""; draw(); readout(); }
    function find(x, record) {
      const path = [];
      let r = x;
      while (parent[r] !== r) { path.push(r); r = parent[r]; }
      if (compress) path.forEach((p) => { parent[p] = r; });
      if (record) finds += path.length + 1;
      return r;
    }
    function union(a, b) {
      const ra = find(a, true), rb = find(b, true);
      if (ra === rb) { logln(a + " & " + b + " already connected", "mut"); return; }
      ops++;
      if (rank[ra] < rank[rb]) parent[ra] = rb;
      else if (rank[ra] > rank[rb]) parent[rb] = ra;
      else { parent[rb] = ra; rank[ra]++; }
      logln("union(" + a + ", " + b + ")", "ok");
      draw(); readout();
    }

    const svg = svgEl("svg", { class: "tree-svg", viewBox: "0 0 500 150" });
    const log = h("div", { class: "dsa-log" });
    const ro = h("div", { class: "w-readout" });
    function logln(t, cls) { const d = h("div", cls ? { class: cls } : {}); d.textContent = t; log.insertBefore(d, log.firstChild); }

    function colorFor(root) { const cs = ["var(--amber)", "var(--cyan)", "var(--violet)", "var(--lime)", "var(--rose)", "var(--accent-2)"]; return cs[root % cs.length]; }
    function draw() {
      svg.innerHTML = "";
      // edges to parents
      for (let i = 0; i < N; i++) {
        if (parent[i] !== i) svg.appendChild(svgEl("line", { x1: pos[i][0], y1: pos[i][1], x2: pos[parent[i]][0], y2: pos[parent[i]][1], stroke: "var(--accent)", "stroke-width": 2 }));
      }
      for (let i = 0; i < N; i++) {
        const root = find(i, false);
        const g = svgEl("g", {});
        g.appendChild(svgEl("circle", { cx: pos[i][0], cy: pos[i][1], r: 16, fill: "color-mix(in srgb, " + colorFor(root) + " 22%, var(--surface-solid))", stroke: colorFor(root), "stroke-width": parent[i] === i ? 3 : 1.6 }));
        const t = svgEl("text", { x: pos[i][0], y: pos[i][1], "text-anchor": "middle", "dominant-baseline": "central", fill: "var(--text)", "font-family": "var(--font-mono)", "font-size": 12, "font-weight": 700 });
        t.textContent = i; g.appendChild(t);
        svg.appendChild(g);
      }
    }
    function groups() { const s = new Set(); for (let i = 0; i < N; i++) s.add(find(i, false)); return s.size; }
    function readout() {
      ro.innerHTML = "";
      ro.appendChild(h("span", { class: "ro" }, "groups ", h("b", {}, String(groups()))));
      ro.appendChild(h("span", { class: "ro" }, "unions ", h("b", {}, String(ops))));
      ro.appendChild(h("span", { class: "ro" }, "find steps ", h("b", {}, String(finds))));
    }

    // controls: pick two nodes to union, a connected? check, compression toggle
    const selA = h("select"), selB = h("select");
    for (let i = 0; i < N; i++) { selA.appendChild(h("option", { value: i }, String(i))); selB.appendChild(h("option", { value: i, selected: i === 1 ? "selected" : null }, String(i))); }
    const controls = h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "union ", selA, h("span", { style: "color:var(--text-faint)" }, "+"), selB),
      btn("Union", "primary", () => union(+selA.value, +selB.value)),
      btn("Connected?", "ghost", () => {
        const a = +selA.value, b = +selB.value;
        const yes = find(a, true) === find(b, true);
        logln("connected(" + a + ", " + b + ") \u2192 " + (yes ? "YES" : "no"), yes ? "ok" : "no");
        draw(); readout();
      }),
      seg(["path compression: on", "off"], (lab, i) => { compress = i === 0; }),
      btn("Reset", "ghost", reset)
    );

    mount.appendChild(controls);
    mount.appendChild(h("div", { class: "w-stage" }, svg));
    mount.appendChild(ro);
    mount.appendChild(log);
    mount.appendChild(h("div", { class: "dsa-legend" }, h("span", {}, "Each colour is one connected set; the thick-ringed node is its root (representative).")));
    reset();
  };

  window.Widgets = Widgets;
})();
