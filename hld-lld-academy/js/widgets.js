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
        h("span", { class: "w-field" }, "capacity ", h("b", { html: "&nbsp;" + CAP, style: "color:var(--accent-ink);font-family:var(--font-mono)" })),
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
        h("span", { class: "w-field" }, "refill", h("b", { style: "color:var(--accent-ink);font-family:var(--font-mono)" }, "\u00a0" + refillPerSec + "/s"))
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
      status.innerHTML = `Added <b style="color:var(--accent-ink)">${word}</b> → set bits [${idx.join(", ")}].`;
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
            (step.startsWith("✓") ? ";border-color:var(--cyan);color:var(--cyan-ink)" : "")
        }, step));
      });
      stage.appendChild(flow);
      stage.appendChild(h("div", { class: "w-readout" },
        h("span", { class: "ro" }, h("b", { style: "color:var(--cyan-ink)" }, "✓ Pro "), d.pro),
      ));
      stage.appendChild(h("div", { class: "w-readout", style: "margin-top:8px" },
        h("span", { class: "ro" }, h("b", { style: "color:var(--rose-ink)" }, "✗ Con "), d.con)
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

  /* ---------------------------------------------------------------
     8. CELL ROUTER DRILL
  --------------------------------------------------------------- */
  Widgets.cellrouter = function (mount) {
    shell(mount, "drill", "Cell Router Drill",
      "Pick a tenant and incident. Compare how much of the customer base is exposed in a shared fleet, a cell-based design, and shuffle-sharded workers.");

    const TENANTS = 240;
    const CELL_COUNT = 8;
    const WORKER_COUNT = 16;
    const SHUFFLE_SIZE = 3;
    const tenants = Array.from({ length: TENANTS }, (_, i) => "tenant-" + String(i + 1).padStart(3, "0"));
    let activeTenant = "tenant-042";
    let scenario = "noisy";

    function cellOf(tenant) {
      return hashStr(tenant, CELL_COUNT);
    }
    function subsetOf(tenant) {
      const set = [];
      let salt = 0;
      while (set.length < SHUFFLE_SIZE) {
        const w = hashStr(tenant + ":" + salt, WORKER_COUNT);
        if (!set.includes(w)) set.push(w);
        salt++;
      }
      return set.sort((a, b) => a - b);
    }
    function sameSubset(a, b) {
      const aa = subsetOf(a), bb = subsetOf(b);
      return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
    }
    function overlapsBadWorker(tenant, badWorker) {
      return subsetOf(tenant).includes(badWorker);
    }
    function pct(n) {
      return ((n / TENANTS) * 100).toFixed(n === TENANTS ? 0 : 1) + "%";
    }

    const seg = h("div", { class: "w-seg" });
    [["noisy", "Noisy tenant"], ["deploy", "Bad deploy"]].forEach(([val, label], idx) => {
      const b = h("button", { class: idx === 0 ? "active" : "" }, label);
      b.addEventListener("click", () => {
        scenario = val;
        seg.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        paint();
      });
      seg.appendChild(b);
    });

    const tenantSelect = h("select", {});
    tenants.forEach((tenant) => {
      const opt = h("option", { value: tenant }, tenant);
      if (tenant === activeTenant) opt.setAttribute("selected", "selected");
      tenantSelect.appendChild(opt);
    });
    tenantSelect.addEventListener("change", () => {
      activeTenant = tenantSelect.value;
      paint();
    });

    const stage = h("div", { class: "w-stage" });
    const readout = h("div", { class: "w-readout" });

    function card(title, value, detail, accent) {
      return h("div", {
        class: "lru-cell",
        style: "width:min(100%, 190px);height:auto;min-height:104px;padding:14px;text-align:left;display:block;border-color:" + accent
      },
        h("div", { class: "srv-name", style: "margin-bottom:8px" }, title),
        h("div", { class: "srv-count", style: "color:oklch(from " + accent + " var(--ink-l) c h);font-size:1.5rem" }, value),
        h("div", { class: "srv-weight", style: "margin-top:8px;line-height:1.35" }, detail)
      );
    }

    function paint() {
      const activeCell = cellOf(activeTenant);
      const activeSubset = subsetOf(activeTenant);
      const badWorker = activeSubset[0];
      const sharedAffected = TENANTS;
      const cellAffected = tenants.filter((t) => cellOf(t) === activeCell).length;
      const shuffleAffected = scenario === "deploy"
        ? tenants.filter((t) => overlapsBadWorker(t, badWorker)).length
        : tenants.filter((t) => sameSubset(t, activeTenant)).length;

      stage.innerHTML = "";
      const grid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px" },
        card("Shared fleet", pct(sharedAffected), "One shared app/queue/worker pool exposes every tenant.", "var(--rose)"),
        card("Cell-based", pct(cellAffected), "Only tenants in cell-" + (activeCell + 1) + " are exposed.", "var(--cyan)"),
        card("Shuffle shard", pct(shuffleAffected), scenario === "deploy"
          ? "Worker-" + (badWorker + 1) + " is bad; tenants using it are exposed."
          : "Only tenants with the same worker subset are exposed.", "var(--accent)")
      );
      const route = h("div", { class: "lru-log", style: "margin-top:16px;line-height:1.6" },
        activeTenant + " -> cell-" + (activeCell + 1) +
        " -> workers [" + activeSubset.map((w) => "w" + (w + 1)).join(", ") + "]"
      );
      stage.appendChild(grid);
      stage.appendChild(route);

      readout.innerHTML = "";
      readout.appendChild(h("span", { class: "ro" }, "tenants ", h("b", {}, String(TENANTS))));
      readout.appendChild(h("span", { class: "ro" }, "cells ", h("b", {}, String(CELL_COUNT))));
      readout.appendChild(h("span", { class: "ro" }, "shuffle subset ", h("b", {}, SHUFFLE_SIZE + "/" + WORKER_COUNT)));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      seg,
      h("label", { class: "w-field" }, "tenant ", tenantSelect),
      h("button", { class: "w-btn", onclick: () => {
        activeTenant = tenants[hashStr(activeTenant + Date.now(), tenants.length)];
        tenantSelect.value = activeTenant;
        paint();
      } }, "Random tenant")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     9. CAPACITY PLANNER
  --------------------------------------------------------------- */
  Widgets.capacitycalc = function (mount) {
    shell(mount, "calculator", "Capacity Calculator",
      "Convert user activity into rough QPS, app instances, database load, queue workers and cache memory. Treat the output as a starting point for load tests, not a promise.");

    const defaults = {
      dau: 2000000,
      actions: 20,
      peak: 5,
      instanceQps: 300,
      headroom: 2,
      readPct: 85,
      cacheHit: 90,
      workerRate: 80,
      hotItemsM: 8,
      itemKb: 2
    };
    const inputs = {};

    function num(name) {
      const v = Number(inputs[name].value);
      return Number.isFinite(v) && v > 0 ? v : 0;
    }
    function clampPct(v) {
      return Math.min(100, Math.max(0, v));
    }
    function fmt(n, digits = 0) {
      if (!Number.isFinite(n)) return "0";
      if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "M";
      if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
      return n.toFixed(digits);
    }
    function field(name, label, suffix, step) {
      const input = h("input", {
        type: "number",
        min: "0",
        step: step || "1",
        value: String(defaults[name]),
        style: "width:92px"
      });
      input.addEventListener("input", paint);
      inputs[name] = input;
      return h("label", { class: "w-field" }, label + " ", input, suffix ? h("b", {}, suffix) : null);
    }
    function metric(title, value, detail, accent) {
      return h("div", {
        class: "lru-cell",
        style: "width:min(100%, 190px);height:auto;min-height:116px;padding:14px;text-align:left;display:block;border-color:" + accent
      },
        h("div", { class: "srv-name", style: "margin-bottom:8px" }, title),
        h("div", { class: "srv-count", style: "color:oklch(from " + accent + " var(--ink-l) c h);font-size:1.45rem" }, value),
        h("div", { class: "srv-weight", style: "margin-top:8px;line-height:1.35" }, detail)
      );
    }

    const controls = h("div", { class: "widget-controls" },
      field("dau", "DAU", "", "1000"),
      field("actions", "actions/day", "", "1"),
      field("peak", "peak x", "", "0.5"),
      field("instanceQps", "safe QPS/instance", "", "10"),
      field("headroom", "N+", "", "1"),
      field("readPct", "read %", "", "5"),
      field("cacheHit", "cache hit %", "", "5"),
      field("workerRate", "worker jobs/s", "", "5"),
      field("hotItemsM", "hot items M", "", "0.5"),
      field("itemKb", "item KB", "", "0.5")
    );
    const stage = h("div", { class: "w-stage" });
    const readout = h("div", { class: "w-readout" });

    function paint() {
      const dau = num("dau");
      const dailyActions = dau * num("actions");
      const avgQps = dailyActions / 86400;
      const peakQps = avgQps * num("peak");
      const appNeeded = Math.ceil(peakQps / Math.max(1, num("instanceQps")));
      const appWithHeadroom = appNeeded + Math.round(num("headroom"));
      const readPct = clampPct(num("readPct"));
      const writePct = Math.max(0, 100 - readPct);
      const cacheHit = clampPct(num("cacheHit"));
      const readQps = peakQps * (readPct / 100);
      const writeQps = peakQps * (writePct / 100);
      const dbReadQps = readQps * (1 - cacheHit / 100);
      const workerNeeded = Math.ceil(writeQps / Math.max(1, num("workerRate")));
      const workerWithHeadroom = workerNeeded + Math.round(num("headroom"));
      const cacheGb = (num("hotItemsM") * 1000000 * num("itemKb")) / (1024 * 1024) * 1.3;

      stage.innerHTML = "";
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px" },
        metric("Average QPS", fmt(avgQps, 1), fmt(dailyActions) + " actions/day / 86,400", "var(--accent)"),
        metric("Peak QPS", fmt(peakQps, 1), "average x " + num("peak") + " peak factor", "var(--cyan)"),
        metric("App instances", String(appWithHeadroom), appNeeded + " for load + N+" + Math.round(num("headroom")), "var(--violet)"),
        metric("DB reads", fmt(dbReadQps, 1), fmt(readQps, 1) + " read QPS after " + cacheHit + "% cache hit", "var(--rose)"),
        metric("DB writes", fmt(writeQps, 1), writePct.toFixed(0) + "% of peak traffic", "var(--amber)"),
        metric("Queue workers", String(workerWithHeadroom), workerNeeded + " to drain writes + headroom", "var(--cyan-deep)"),
        metric("Cache memory", cacheGb.toFixed(cacheGb >= 10 ? 0 : 1) + " GB", "hot set x item size x 1.3 overhead", "var(--accent-2)")
      ));

      readout.innerHTML = "";
      readout.appendChild(h("span", { class: "ro" }, "read/write ", h("b", {}, readPct.toFixed(0) + "/" + writePct.toFixed(0))));
      readout.appendChild(h("span", { class: "ro" }, "cache miss QPS ", h("b", {}, fmt(dbReadQps, 1))));
      readout.appendChild(h("span", { class: "ro" }, "queue drain target ", h("b", {}, "> " + fmt(writeQps, 1) + "/s")));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     ORDERING VISUALIZER — one fixed three-process trace; compare any
     two events by Lamport clock, vector clock or skewed wall clock.
  --------------------------------------------------------------- */
  Widgets.orderingLab = function (mount) {
    shell(mount, "visualizer", "Event Ordering Lab",
      "Three processes exchange three messages. Pick two events and a clock: see what each clock can prove about their order, and where a skewed wall clock gets it wrong.");

    const P = ["P1", "P2", "P3"];
    const SKEW = [0, -30, 25];
    /* t = true time (ms); kind: local | send | recv; msg links send/recv */
    const EV = [
      { id: "a1", p: 0, t: 10, kind: "local" },
      { id: "b1", p: 1, t: 15, kind: "local" },
      { id: "a2", p: 0, t: 20, kind: "send", msg: "m1" },
      { id: "c1", p: 2, t: 30, kind: "local" },
      { id: "b2", p: 1, t: 35, kind: "recv", msg: "m1" },
      { id: "a3", p: 0, t: 40, kind: "local" },
      { id: "b3", p: 1, t: 50, kind: "send", msg: "m2" },
      { id: "c2", p: 2, t: 65, kind: "recv", msg: "m2" },
      { id: "b4", p: 1, t: 70, kind: "local" },
      { id: "c3", p: 2, t: 80, kind: "send", msg: "m3" },
      { id: "a4", p: 0, t: 95, kind: "recv", msg: "m3" }
    ];
    const lam = [0, 0, 0], vec = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], sent = {};
    EV.forEach((e) => {
      if (e.kind === "recv") {
        const s = sent[e.msg];
        lam[e.p] = Math.max(lam[e.p], s.L);
        for (let i = 0; i < 3; i++) vec[e.p][i] = Math.max(vec[e.p][i], s.V[i]);
      }
      lam[e.p] += 1;
      vec[e.p][e.p] += 1;
      e.L = lam[e.p];
      e.V = vec[e.p].slice();
      e.W = e.t + SKEW[e.p];
      if (e.kind === "send") sent[e.msg] = { L: e.L, V: e.V.slice(), from: e };
    });
    const byId = Object.fromEntries(EV.map((e) => [e.id, e]));
    const leq = (x, y) => x.every((v, i) => v <= y[i]);
    function relation(a, b) {
      if (a === b) return "same";
      if (leq(a.V, b.V)) return "before";
      if (leq(b.V, a.V)) return "after";
      return "concurrent";
    }

    let mode = "vector";
    let pick = ["a2", "c1"];

    const W = 620, X0 = 60, SC = 5.6, LANE = [40, 100, 160];
    const xOf = (t) => X0 + t * SC;
    const svg = svgEl("svg", { viewBox: "0 0 " + W + " 200", class: "diagram-svg", role: "img", "aria-label": "Space-time diagram of three processes exchanging messages" });
    const stage = h("div", { class: "w-stage" }, svg);
    const readout = h("div", { class: "w-readout" });

    function label(e) {
      if (mode === "lamport") return String(e.L);
      if (mode === "wall") return e.W + "ms";
      return "[" + e.V.join(",") + "]";
    }

    function paint() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      P.forEach((name, i) => {
        svg.appendChild(svgEl("line", { x1: X0 - 10, y1: LANE[i], x2: W - 20, y2: LANE[i], style: "stroke:var(--line-strong);stroke-width:1.5" }));
        const tx = svgEl("text", { x: 14, y: LANE[i] + 4, style: "fill:var(--text-dim);font-size:12px;font-family:var(--font-mono)" });
        tx.textContent = name + (mode === "wall" ? " (" + (SKEW[i] >= 0 ? "+" : "") + SKEW[i] + ")" : "");
        svg.appendChild(tx);
      });
      Object.values(sent).forEach((s) => {
        const r = EV.find((e) => e.kind === "recv" && e.msg === s.from.msg);
        svg.appendChild(svgEl("line", { x1: xOf(s.from.t), y1: LANE[s.from.p], x2: xOf(r.t), y2: LANE[r.p], style: "stroke:var(--accent);stroke-width:1.5;stroke-dasharray:4 3" }));
      });
      const A = byId[pick[0]], B = byId[pick[1]];
      EV.forEach((e) => {
        const on = e.id === pick[0] || e.id === pick[1];
        const g = svgEl("g", { style: "cursor:pointer" });
        g.appendChild(svgEl("circle", { cx: xOf(e.t), cy: LANE[e.p], r: on ? 8 : 6, style: on ? "fill:var(--accent);stroke:var(--text);stroke-width:2" : "fill:var(--surface-solid);stroke:var(--accent);stroke-width:2" }));
        const t1 = svgEl("text", { x: xOf(e.t), y: LANE[e.p] - 13, "text-anchor": "middle", style: "fill:var(--text);font-size:11px;font-family:var(--font-mono)" });
        t1.textContent = e.id;
        const t2 = svgEl("text", { x: xOf(e.t), y: LANE[e.p] + 22, "text-anchor": "middle", style: "fill:var(--text-dim);font-size:10px;font-family:var(--font-mono)" });
        t2.textContent = label(e);
        g.appendChild(t1); g.appendChild(t2);
        g.addEventListener("click", () => { pick = [pick[1], e.id]; syncSelects(); paint(); });
        svg.appendChild(g);
      });

      const rel = relation(A, B);
      const truth = rel === "before" ? A.id + " happened before " + B.id
        : rel === "after" ? B.id + " happened before " + A.id
        : rel === "same" ? "the same event" : A.id + " and " + B.id + " are concurrent";
      readout.innerHTML = "";
      const ro = (k, v) => h("span", { class: "ro" }, k + " ", h("b", {}, v));
      readout.appendChild(ro("truth (happens-before)", truth));
      let verdict;
      if (mode === "lamport") {
        readout.appendChild(ro("Lamport", "L(" + A.id + ")=" + A.L + ", L(" + B.id + ")=" + B.L));
        verdict = rel === "concurrent"
          ? "Lamport still orders them (" + (A.L < B.L ? A.id : B.id) + " first, or by process id on a tie). That total order is consistent with causality but invents an order between events that never influenced each other."
          : "Causality guarantees the smaller Lamport value goes to the earlier event. The reverse never holds in general: a smaller value alone cannot prove happens-before.";
      } else if (mode === "wall") {
        readout.appendChild(ro("wall clock", A.id + "=" + A.W + "ms, " + B.id + "=" + B.W + "ms"));
        const wallFirst = A.W < B.W ? "a" : A.W > B.W ? "b" : "tie";
        const wrong = (rel === "before" && wallFirst === "b") || (rel === "after" && wallFirst === "a");
        verdict = wrong
          ? "The skewed wall clock puts the effect before its cause. Last-write-wins on these timestamps would keep the wrong value."
          : "The wall clocks agree with causality for this pair \u2014 but only because the skew happened to be small enough here. Try a2 against b2.";
      } else {
        readout.appendChild(ro("vectors", A.id + "=[" + A.V.join(",") + "], " + B.id + "=[" + B.V.join(",") + "]"));
        verdict = rel === "concurrent"
          ? "Neither vector is \u2264 the other in every position, so the clock proves concurrency. A store can surface these two writes as a conflict instead of silently dropping one."
          : "One vector is \u2264 the other in every position, which proves happens-before exactly. The price is one counter per process carried on every message.";
      }
      readout.appendChild(h("span", { class: "ro" }, verdict));
    }

    const selA = h("select", { "aria-label": "First event" });
    const selB = h("select", { "aria-label": "Second event" });
    [selA, selB].forEach((sel, i) => {
      EV.forEach((e) => sel.appendChild(h("option", { value: e.id }, e.id + " \u00b7 " + P[e.p] + " " + e.kind)));
      sel.addEventListener("change", () => { pick[i] = sel.value; paint(); });
    });
    function syncSelects() { selA.value = pick[0]; selB.value = pick[1]; }

    const seg = h("div", { class: "w-seg" });
    [["lamport", "Lamport"], ["vector", "Vector"], ["wall", "Skewed wall clock"]].forEach(([id, txt]) => {
      const b = h("button", { type: "button", class: id === mode ? "active" : "" }, txt);
      b.addEventListener("click", () => {
        mode = id;
        Array.from(seg.children).forEach((c) => c.classList.toggle("active", c === b));
        paint();
      });
      seg.appendChild(b);
    });

    mount.appendChild(h("div", { class: "widget-controls" }, seg));
    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "event A ", selA),
      h("label", { class: "w-field" }, "event B ", selB),
      h("button", { type: "button", class: "w-btn", onclick: () => { pick = ["a2", "b2"]; mode = "wall"; Array.from(seg.children).forEach((c, i) => c.classList.toggle("active", i === 2)); syncSelects(); paint(); } }, "Show a clock-skew bug")
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    syncSelects();
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);
})();
