/* =====================================================================
   BLUEPRINT · Interactive widgets
   Each widget is a function (mountEl) that renders an interactive demo.
   Registered on window.Widgets[id]; the app calls them when it renders
   a {type:'widget', id} block.
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
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
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

  const Widgets = {};

  /* ---------------------------------------------------------------
     1. LOAD BALANCER SIMULATOR
  --------------------------------------------------------------- */
  Widgets.loadbalancer = function (mount) {
    shell(mount, "simulator", "Load Balancer Lab",
      "Pick a strategy and fire requests. Watch how each algorithm spreads load across the pool differently.");

    const weights = [3, 1, 2, 1, 1];
    const servers = weights.map((w, i) => ({ name: "srv-" + (i + 1), total: 0, active: 0, weight: w }));
    let strategy = "round";
    let rr = 0;           // round-robin pointer
    let wrrIdx = 0, wrrLeft = weights[0]; // weighted RR

    const stage = h("div", { class: "w-stage" });
    const pool = h("div", { class: "lb-servers" });
    stage.appendChild(pool);

    const cells = servers.map((s) => {
      const bar = h("i");
      const count = h("div", { class: "srv-count" }, "0");
      const cell = h("div", { class: "lb-server" },
        h("div", { class: "srv-name" }, s.name),
        h("div", { class: "srv-bar" }, bar),
        count,
        h("div", { class: "srv-weight" }, "weight " + s.weight)
      );
      pool.appendChild(cell);
      return { cell, bar, count };
    });

    const readout = h("div", { class: "w-readout" },
      h("span", { class: "ro" }, "requests ", h("b", { id: "lbTotal" }, "0")),
      h("span", { class: "ro" }, "spread (σ) ", h("b", { id: "lbStd" }, "0.0"))
    );

    function render(hitIdx) {
      const max = Math.max(1, ...servers.map((s) => s.total));
      servers.forEach((s, i) => {
        cells[i].count.textContent = s.total;
        cells[i].bar.style.width = (s.total / max) * 100 + "%";
        cells[i].cell.classList.toggle("hit", i === hitIdx);
      });
      const total = servers.reduce((a, s) => a + s.total, 0);
      const mean = total / servers.length;
      const variance = servers.reduce((a, s) => a + (s.total - mean) ** 2, 0) / servers.length;
      mount.querySelector("#lbTotal").textContent = total;
      mount.querySelector("#lbStd").textContent = Math.sqrt(variance).toFixed(1);
    }

    function pick() {
      if (strategy === "round") { const i = rr % servers.length; rr++; return i; }
      if (strategy === "random") return Math.floor(Math.random() * servers.length);
      if (strategy === "least") {
        let best = 0; for (let i = 1; i < servers.length; i++) if (servers[i].active < servers[best].active) best = i;
        return best;
      }
      // weighted round robin
      const i = wrrIdx;
      wrrLeft--;
      if (wrrLeft <= 0) { wrrIdx = (wrrIdx + 1) % servers.length; wrrLeft = servers[wrrIdx].weight; }
      return i;
    }

    function send(n = 1) {
      let last = -1;
      for (let r = 0; r < n; r++) {
        const i = pick();
        servers[i].total++; servers[i].active++;
        last = i;
      }
      render(last);
      setTimeout(() => render(-1), 380);
    }

    // active-connection decay so "least connections" behaves believably
    setInterval(() => {
      let changed = false;
      servers.forEach((s) => { if (s.active > 0 && Math.random() < 0.5) { s.active--; changed = true; } });
      if (changed && strategy === "least") render(-1);
    }, 700);

    const seg = h("div", { class: "w-seg" });
    [["round", "Round Robin"], ["weighted", "Weighted"], ["least", "Least Conn"], ["random", "Random"]].forEach(([val, label], idx) => {
      const b = h("button", { class: idx === 0 ? "active" : "" }, label);
      b.addEventListener("click", () => {
        strategy = val; rr = 0; wrrIdx = 0; wrrLeft = servers[0].weight;
        seg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      });
      seg.appendChild(b);
    });

    mount.appendChild(
      h("div", { class: "widget-controls" },
        seg,
        h("button", { class: "w-btn primary", onclick: () => send(1) }, "Send request"),
        h("button", { class: "w-btn", onclick: () => send(12) }, "Burst ×12"),
        h("button", { class: "w-btn ghost", onclick: () => { servers.forEach((s) => { s.total = 0; s.active = 0; }); rr = 0; wrrIdx = 0; wrrLeft = servers[0].weight; render(-1); } }, "Reset")
      )
    );
    mount.appendChild(stage);
    mount.appendChild(readout);
    render(-1);
  };

  /* ---------------------------------------------------------------
     2. LRU CACHE VISUALIZER
  --------------------------------------------------------------- */
  Widgets.lru = function (mount) {
    shell(mount, "visualizer", "LRU Cache Visualizer",
      "Access keys and watch the cache evict the Least-Recently-Used entry once it hits capacity. Newest sits on the right.");

    const CAP = 4;
    let order = []; // [oldest ... newest]
    const track = h("div", { class: "lru-track" });
    const log = h("div", { class: "lru-log", html: "Cache is empty. Access a key to begin." });

    function paint(flashKey, flashType) {
      track.innerHTML = "";
      if (order.length === 0) track.appendChild(h("div", { class: "lru-log", html: "— empty —" }));
      order.forEach((k, i) => {
        const cls = ["lru-cell"];
        if (i === order.length - 1) cls.push("mru");
        if (i === 0 && order.length === CAP) cls.push("lru");
        if (k === flashKey && flashType) cls.push(flashType === "hit" ? "flash-hit" : "flash-evict");
        const tag = i === order.length - 1 ? "MRU" : (i === 0 && order.length === CAP ? "LRU" : "");
        track.appendChild(h("div", { class: cls.join(" ") },
          tag ? h("span", { class: "lru-tag" }, tag) : null,
          h("span", { class: "lru-key" }, k)
        ));
      });
    }

    function access(key) {
      key = String(key).trim().toUpperCase();
      if (!key) return;
      const idx = order.indexOf(key);
      if (idx !== -1) {
        order.splice(idx, 1); order.push(key);
        log.innerHTML = `Accessed <b>${key}</b> → <b class="hit">HIT</b>. Promoted to most-recent.`;
        paint(key, "hit");
      } else {
        let evicted = null;
        if (order.length >= CAP) evicted = order.shift();
        order.push(key);
        log.innerHTML = evicted
          ? `Accessed <b>${key}</b> → <b class="miss">MISS</b>. Cache full, evicted <b class="evict">${evicted}</b> (LRU).`
          : `Accessed <b>${key}</b> → <b class="miss">MISS</b>. Loaded into cache.`;
        paint(key, evicted ? "evict" : null);
        if (evicted) setTimeout(() => paint(), 600);
      }
    }

    const input = h("input", { type: "text", maxlength: "3", placeholder: "A", value: "" });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { access(input.value); input.value = ""; input.focus(); } });

    mount.appendChild(
      h("div", { class: "widget-controls" },
        h("span", { class: "w-field" }, "capacity ", h("b", { html: "&nbsp;" + CAP, style: "color:var(--accent);font-family:var(--font-mono)" })),
        h("label", { class: "w-field" }, "access key ", input),
        h("button", { class: "w-btn primary", onclick: () => { access(input.value); input.value = ""; } }, "Access"),
        h("button", { class: "w-btn", onclick: () => access("ABCD"[Math.floor(Math.random() * 6)] || "A") }, "Random A–D"),
        h("button", { class: "w-btn", onclick: () => access("ABCDEF"[Math.floor(Math.random() * 6)]) }, "Random A–F"),
        h("button", { class: "w-btn ghost", onclick: () => { order = []; log.innerHTML = "Cache cleared."; paint(); } }, "Clear")
      )
    );
    mount.appendChild(h("div", { class: "w-stage" }, track, log));
    paint();
  };

  /* ---------------------------------------------------------------
     3. CONSISTENT HASHING RING
  --------------------------------------------------------------- */
  Widgets.consistenthash = function (mount) {
    shell(mount, "visualizer", "Consistent Hashing Ring",
      "Keys map clockwise to the next node on the ring. Add or remove a node and notice only a small slice of keys move — that's the whole point.");

    let nodes = ["A", "B", "C"];
    let keys = ["user:42", "cart:7", "img:99", "sess:1"];
    let vnodes = 1;
    const R = 130, CX = 160, CY = 160;
    const svg = svgEl("svg", { class: "ring-svg", viewBox: "0 0 320 320" });
    const colors = { A: "#f5a623", B: "#5eead4", C: "#a78bfa", D: "#fb7185", E: "#bef264", F: "#7cc4ff" };

    const angle = (pos) => (pos / 360) * 2 * Math.PI - Math.PI / 2;
    const pt = (pos, r) => [CX + r * Math.cos(angle(pos)), CY + r * Math.sin(angle(pos))];

    function nodePositions() {
      const list = [];
      nodes.forEach((n) => {
        for (let v = 0; v < vnodes; v++) list.push({ node: n, pos: hashStr(n + "#" + v, 360) });
      });
      return list.sort((a, b) => a.pos - b.pos);
    }
    function ownerOf(keyPos, ring) {
      for (const r of ring) if (r.pos >= keyPos) return r;
      return ring[0]; // wrap around
    }

    const legend = h("div", { class: "w-readout" });

    function draw() {
      svg.innerHTML = "";
      const ring = nodePositions();
      svg.appendChild(svgEl("circle", { class: "ring-circle", cx: CX, cy: CY, r: R }));
      // node markers
      ring.forEach((r) => {
        const [x, y] = pt(r.pos, R);
        const dot = svgEl("circle", { class: "node-dot", cx: x, cy: y, r: 7, fill: colors[r.node] || "#f5a623" });
        svg.appendChild(dot);
        const [lx, ly] = pt(r.pos, R + 18);
        const t = svgEl("text", { class: "node-label", x: lx, y: ly + 3, "text-anchor": "middle", fill: colors[r.node] });
        t.textContent = r.node + (vnodes > 1 ? "·" : "");
        svg.appendChild(t);
      });
      // keys
      const counts = {};
      keys.forEach((k) => {
        const kp = hashStr(k, 360);
        const [kx, ky] = pt(kp, R - 26);
        const owner = ownerOf(kp, ring);
        counts[owner.node] = (counts[owner.node] || 0) + 1;
        const arc = svgEl("line", { class: "key-arc", x1: kx, y1: ky, x2: pt(owner.pos, R)[0], y2: pt(owner.pos, R)[1] });
        svg.appendChild(arc);
        const kd = svgEl("circle", { class: "key-dot", cx: kx, cy: ky, r: 4.5, fill: colors[owner.node] });
        svg.appendChild(kd);
      });
      // legend
      legend.innerHTML = "";
      nodes.forEach((n) =>
        legend.appendChild(h("span", { class: "ro" },
          h("b", { style: `color:${colors[n]}` }, n), ` ${counts[n] || 0} keys`))
      );
    }

    const addNode = () => {
      const next = "ABCDEF".split("").find((c) => !nodes.includes(c));
      if (next) { nodes.push(next); draw(); }
    };
    const removeNode = () => { if (nodes.length > 1) { nodes.pop(); draw(); } };
    const addKey = () => { keys.push("key:" + Math.floor(Math.random() * 900 + 100)); draw(); };

    const vnodeSel = h("select", {},
      h("option", { value: "1" }, "1 (no vnodes)"),
      h("option", { value: "3" }, "3 vnodes"),
      h("option", { value: "8" }, "8 vnodes")
    );
    vnodeSel.addEventListener("change", () => { vnodes = +vnodeSel.value; draw(); });

    mount.appendChild(
      h("div", { class: "widget-controls" },
        h("button", { class: "w-btn primary", onclick: addNode }, "+ Add node"),
        h("button", { class: "w-btn", onclick: removeNode }, "− Remove node"),
        h("button", { class: "w-btn", onclick: addKey }, "+ Add key"),
        h("label", { class: "w-field" }, "virtual nodes ", vnodeSel)
      )
    );
    mount.appendChild(h("div", { class: "w-stage" }, h("div", { class: "ring-wrap" }, svg)));
    mount.appendChild(legend);
    draw();
  };

  /* ---------------------------------------------------------------
     4. CAP THEOREM EXPLORER
  --------------------------------------------------------------- */
  Widgets.cap = function (mount) {
    shell(mount, "explorer", "CAP Theorem Explorer",
      "During a network partition you can keep only two of the three guarantees. Tap two vertices to see what kind of system you've chosen.");

    const verts = {
      C: { x: 190, y: 40, label: "C", name: "Consistency" },
      A: { x: 60, y: 250, label: "A", name: "Availability" },
      P: { x: 320, y: 250, label: "P", name: "Partition tol." }
    };
    const combos = {
      AP: { title: "AP — Available + Partition-tolerant", desc: "Always answers, even during a partition, but replicas may briefly disagree (eventual consistency). The default for internet-scale systems.", ex: ["Cassandra", "DynamoDB", "Riak", "DNS"] },
      CP: { title: "CP — Consistent + Partition-tolerant", desc: "Refuses or blocks requests it can't serve consistently during a partition. Correctness over uptime.", ex: ["HBase", "MongoDB (majority)", "etcd", "ZooKeeper"] },
      CA: { title: "CA — Consistent + Available", desc: "Only achievable when there is NO partition — i.e. a single node or a perfect network. In a real distributed system P is non-negotiable.", ex: ["Single-node Postgres", "(theoretical only)"] }
    };
    let selected = ["A", "P"];

    const svg = svgEl("svg", { class: "cap-svg", viewBox: "0 0 380 300" });
    const edges = [["C", "A"], ["A", "P"], ["P", "C"]];
    const edgeEls = {};
    edges.forEach(([a, b]) => {
      const ln = svgEl("line", { class: "cap-edge", x1: verts[a].x, y1: verts[a].y, x2: verts[b].x, y2: verts[b].y });
      edgeEls[a + b] = ln; svg.appendChild(ln);
    });
    const vertEls = {};
    Object.entries(verts).forEach(([k, v]) => {
      const g = svgEl("g", { style: "cursor:pointer" });
      const c = svgEl("circle", { class: "cap-vertex", cx: v.x, cy: v.y, r: 30 });
      const t = svgEl("text", { class: "cap-vtext", x: v.x, y: v.y + 6, "text-anchor": "middle" });
      t.textContent = v.label;
      g.appendChild(c); g.appendChild(t);
      g.addEventListener("click", () => toggle(k));
      vertEls[k] = { c, t };
      svg.appendChild(g);
    });

    const result = h("div", { class: "cap-result" });

    function edgeKey(a, b) { return edgeEls[a + b] ? a + b : b + a; }
    function toggle(k) {
      if (selected.includes(k)) return; // keep two selected
      selected = [selected[1], k]; // shift queue: always 2
      draw();
    }
    function draw() {
      Object.keys(verts).forEach((k) => {
        const on = selected.includes(k);
        vertEls[k].c.classList.toggle("on", on);
        vertEls[k].t.classList.toggle("on", on);
      });
      Object.values(edgeEls).forEach((e) => e.classList.remove("on"));
      const ek = edgeKey(selected[0], selected[1]);
      if (edgeEls[ek]) edgeEls[ek].classList.add("on");
      const key = ["C", "A", "P"].filter((x) => selected.includes(x)).join("");
      const info = combos[key];
      result.innerHTML = "";
      result.appendChild(h("h4", {}, info.title));
      result.appendChild(h("p", {}, info.desc));
      result.appendChild(h("div", { class: "ex" }, ...info.ex.map((e) => h("span", {}, e))));
    }

    mount.appendChild(h("div", { class: "w-stage" }, h("div", { class: "cap-wrap" }, svg, result)));
    draw();
  };

  /* ---------------------------------------------------------------
     5. TOKEN BUCKET RATE LIMITER
  --------------------------------------------------------------- */
  Widgets.tokenbucket = function (mount) {
    shell(mount, "simulator", "Token Bucket Rate Limiter",
      "Each request spends one token. Tokens refill at a steady rate up to capacity. Bursts are allowed until the bucket runs dry — then requests are dropped.");

    const CAP = 10;
    let tokens = CAP;
    const refillPerSec = 2;

    const water = h("div", { class: "tb-water" });
    const tcount = h("div", { class: "tb-tokens" }, String(tokens));
    const bucket = h("div", { class: "tb-bucket" }, water, tcount);
    const log = h("div", { class: "tb-log" });

    function paint() {
      water.style.height = (tokens / CAP) * 100 + "%";
      tcount.textContent = Math.floor(tokens);
    }
    function logline(txt, cls) {
      const line = h("div", { class: cls }, txt);
      log.insertBefore(line, log.firstChild);
      while (log.children.length > 30) log.removeChild(log.lastChild);
    }
    function request(n = 1) {
      for (let i = 0; i < n; i++) {
        if (tokens >= 1) { tokens -= 1; logline("✓ request allowed · " + Math.floor(tokens) + " left", "ok"); }
        else { logline("✗ request DROPPED · bucket empty (429)", "drop"); }
      }
      paint();
    }
    setInterval(() => { tokens = Math.min(CAP, tokens + refillPerSec / 4); paint(); }, 250);

    mount.appendChild(
      h("div", { class: "widget-controls" },
        h("button", { class: "w-btn primary", onclick: () => request(1) }, "1 request"),
        h("button", { class: "w-btn", onclick: () => request(6) }, "Burst ×6"),
        h("button", { class: "w-btn", onclick: () => request(15) }, "Flood ×15"),
        h("span", { class: "w-field" }, "refill", h("b", { style: "color:var(--accent);font-family:var(--font-mono)" }, "\u00a0" + refillPerSec + "/s"))
      )
    );
    mount.appendChild(h("div", { class: "w-stage" }, h("div", { class: "tb-wrap" }, bucket, log)));
    paint();
    logline("Bucket initialised, full at " + CAP + " tokens.", "ok");
  };

  /* ---------------------------------------------------------------
     6. BLOOM FILTER DEMO
  --------------------------------------------------------------- */
  Widgets.bloom = function (mount) {
    shell(mount, "visualizer", "Bloom Filter Probe",
      "A bloom filter answers \u201cdefinitely not present\u201d or \u201cpossibly present\u201d using k hash functions over m bits. It never has false negatives — but can have false positives.");

    const M = 18, K = 3;
    const bits = new Array(M).fill(0);
    const added = [];
    const bitsRow = h("div", { class: "bloom-bits" });
    const idxRow = h("div", { class: "bloom-bits" });
    const status = h("div", { class: "lru-log", html: "Add a few words, then test membership." });

    function hashes(word) { return [hashStr(word, M, 1), hashStr(word, M, 2), hashStr(word, M, 3)]; }
    function paint(probe) {
      bitsRow.innerHTML = ""; idxRow.innerHTML = "";
      for (let i = 0; i < M; i++) {
        const cls = ["bloom-bit"]; if (bits[i]) cls.push("set"); if (probe && probe.includes(i)) cls.push("probe");
        bitsRow.appendChild(h("div", { class: cls.join(" ") }, String(bits[i])));
        idxRow.appendChild(h("div", { class: "bloom-bit idx" }, String(i)));
      }
    }
    function add(word) {
      word = String(word).trim().toLowerCase(); if (!word) return;
      const idx = hashes(word); idx.forEach((i) => (bits[i] = 1));
      if (!added.includes(word)) added.push(word);
      status.innerHTML = `Added <b style="color:var(--accent)">${word}</b> → set bits [${idx.join(", ")}].`;
      paint(idx);
    }
    function test(word) {
      word = String(word).trim().toLowerCase(); if (!word) return;
      const idx = hashes(word); const all = idx.every((i) => bits[i]);
      if (!all) status.innerHTML = `Testing <b>${word}</b> → <b class="evict">DEFINITELY NOT present</b> (a probed bit is 0).`;
      else if (added.includes(word)) status.innerHTML = `Testing <b>${word}</b> → <b class="hit">possibly present</b> (and it really was added).`;
      else status.innerHTML = `Testing <b>${word}</b> → <b class="miss">possibly present</b> — but never added. That's a <b class="miss">false positive!</b>`;
      paint(idx);
    }

    const inp = h("input", { type: "text", placeholder: "apple" });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { add(inp.value); inp.value = ""; } });

    mount.appendChild(
      h("div", { class: "widget-controls" },
        h("label", { class: "w-field" }, "word ", inp),
        h("button", { class: "w-btn primary", onclick: () => { add(inp.value); inp.value = ""; } }, "Add"),
        h("button", { class: "w-btn", onclick: () => { test(inp.value); inp.value = ""; } }, "Test membership"),
        h("button", { class: "w-btn", onclick: () => { ["apple", "mango", "kiwi"].forEach(add); } }, "Seed words"),
        h("button", { class: "w-btn ghost", onclick: () => { bits.fill(0); added.length = 0; status.innerHTML = "Filter reset."; paint(); } }, "Reset")
      )
    );
    mount.appendChild(h("div", { class: "w-stage" }, bitsRow, idxRow, status));
    paint();
  };

  /* ---------------------------------------------------------------
     7. CACHE WRITE-STRATEGY SANDBOX
  --------------------------------------------------------------- */
  Widgets.cachewrite = function (mount) {
    shell(mount, "explorer", "Cache Write Strategies",
      "See how a write flows through the cache and database under each strategy, and the trade-off each one makes.");

    const data = {
      "write-through": { flow: ["App writes", "→ Cache updated", "→ DB updated (sync)", "✓ ack"], pro: "Cache & DB always consistent; simple reads.", con: "Every write pays DB latency twice (cache + DB).", risk: "Writes are slower." },
      "write-back": { flow: ["App writes", "→ Cache updated", "✓ ack (fast!)", "… DB updated later (async)"], pro: "Very low write latency; absorbs write bursts.", con: "Risk of data loss if cache dies before flush.", risk: "Needs durability strategy." },
      "write-around": { flow: ["App writes", "→ DB updated", "✓ ack", "(cache NOT written)"], pro: "Avoids flooding cache with write-once data.", con: "First read after write is a cache miss.", risk: "Cold reads." }
    };
    let cur = "write-through";

    const stage = h("div", { class: "w-stage" });
    function paint() {
      const d = data[cur];
      stage.innerHTML = "";
      const flow = h("div", { style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:16px" });
      d.flow.forEach((step, i) => {
        flow.appendChild(h("div", {
          class: "lru-cell",
          style: "width:auto;height:auto;padding:10px 14px;font-size:0.82rem;font-family:var(--font-mono)" +
            (step.startsWith("✓") ? ";border-color:var(--cyan);color:var(--cyan)" : "")
        }, step));
      });
      stage.appendChild(flow);
      stage.appendChild(h("div", { class: "w-readout" },
        h("span", { class: "ro" }, h("b", { style: "color:var(--cyan)" }, "✓ Pro "), d.pro),
      ));
      stage.appendChild(h("div", { class: "w-readout", style: "margin-top:8px" },
        h("span", { class: "ro" }, h("b", { style: "color:var(--rose)" }, "✗ Con "), d.con)
      ));
    }
    const seg = h("div", { class: "w-seg" });
    Object.keys(data).forEach((k, i) => {
      const b = h("button", { class: i === 0 ? "active" : "" }, k);
      b.addEventListener("click", () => { cur = k; seg.querySelectorAll("button").forEach((x) => x.classList.remove("active")); b.classList.add("active"); paint(); });
      seg.appendChild(b);
    });
    mount.appendChild(h("div", { class: "widget-controls" }, seg));
    mount.appendChild(stage);
    paint();
  };

  window.Widgets = Widgets;
})();
