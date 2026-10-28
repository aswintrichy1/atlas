/* =====================================================================
   LEDGER · Replication & Distribution
   window.TRACKS.dist — modules: replication / partition / consensus

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
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

  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
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

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function btn(label, cls, onClick) {
    var b = h("button", { type: "button", class: "w-btn" + (cls ? " " + cls : "") }, label);
    b.addEventListener("click", onClick);
    return b;
  }

  function slider(label, min, max, value, onChange) {
    var out = h("b", {}, String(value));
    var input = h("input", { type: "range", min: String(min), max: String(max), value: String(value), step: "1" });
    input.addEventListener("input", function () { onChange(parseInt(input.value, 10) || min); });
    var field = h("label", { class: "w-field", style: "display:flex;align-items:center;gap:8px;font-size:0.86rem" },
      h("span", {}, label), input, out);
    return { field: field, input: input, out: out };
  }

  /* FNV-1a 32-bit — deterministic, good enough to spread demo keys */
  function hash32(str) {
    var x = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      x ^= str.charCodeAt(i);
      x = Math.imul(x, 0x01000193) >>> 0;
    }
    x ^= x >>> 15;
    x = Math.imul(x, 0x2c1b3c6d) >>> 0;
    x ^= x >>> 12;
    return x >>> 0;
  }

  function pct(x) { return (Math.round(x * 1000) / 10) + "%"; }

  var Widgets = {};

  /* ==================================================================
     1. distQuorum — N / W / R overlap and availability under failures
     Worst-case placement: the write lands on the FIRST W live replicas,
     the read asks the LAST R live replicas. If they still intersect,
     the read is guaranteed to see the write.
  ================================================================== */
  Widgets.distQuorum = function (mount) {
    shell(mount, "quorum", "Quorum overlap lab",
      "Set the replication factor N, write quorum W and read quorum R, then knock replicas over. The write lands on the first W live replicas and the read deliberately asks the last R live ones: the adversarial case. If R + W > N they still meet on at least one replica.");
    var st = { n: 3, w: 2, r: 2, down: [false, false, false, false, false, false, false] };
    var controls = h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:12px;align-items:center" });
    var nodeBar = h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:6px" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var sN = slider("N", 1, 7, st.n, function (v) {
      st.n = v;
      if (st.w > v) st.w = v;
      if (st.r > v) st.r = v;
      for (var i = v; i < st.down.length; i++) st.down[i] = false;
      paint();
    });
    var sW = slider("W", 1, 7, st.w, function (v) { st.w = Math.min(v, st.n); paint(); });
    var sR = slider("R", 1, 7, st.r, function (v) { st.r = Math.min(v, st.n); paint(); });
    controls.appendChild(sN.field);
    controls.appendChild(sW.field);
    controls.appendChild(sR.field);
    controls.appendChild(btn("Heal all", "ghost", function () {
      for (var i = 0; i < st.down.length; i++) st.down[i] = false;
      paint();
    }));

    function paint() {
      var i;
      sW.input.setAttribute("max", String(st.n));
      sR.input.setAttribute("max", String(st.n));
      sN.input.value = String(st.n); sN.out.textContent = String(st.n);
      sW.input.value = String(st.w); sW.out.textContent = String(st.w);
      sR.input.value = String(st.r); sR.out.textContent = String(st.r);

      var live = [];
      for (i = 0; i < st.n; i++) if (!st.down[i]) live.push(i);
      var writeOk = live.length >= st.w;
      var readOk = live.length >= st.r;
      var wset = {}, rset = {};
      if (writeOk) for (i = 0; i < st.w; i++) wset[live[i]] = true;
      if (readOk) for (i = 0; i < st.r; i++) rset[live[live.length - 1 - i]] = true;
      var overlap = 0;
      for (i = 0; i < st.n; i++) if (wset[i] && rset[i]) overlap++;
      var fresh = writeOk && readOk && overlap > 0;

      clear(nodeBar);
      for (i = 0; i < st.n; i++) {
        (function (idx) {
          nodeBar.appendChild(btn("R" + (idx + 1) + (st.down[idx] ? " down" : " up"), st.down[idx] ? "ghost" : "", function () {
            st.down[idx] = !st.down[idx];
            paint();
          }));
        })(i);
      }

      clear(stage);
      var row = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px" });
      for (i = 0; i < st.n; i++) {
        var dn = st.down[i];
        var tags = [];
        if (wset[i]) tags.push("W");
        if (rset[i]) tags.push("R");
        var ver = dn ? "offline" : wset[i] ? "v2 (new)" : "v1 (old)";
        row.appendChild(h("div", {
          style: "min-width:84px;padding:8px 10px;border-radius:10px;font-family:var(--font-mono);font-size:0.82rem;" +
            "border:2px " + (dn ? "dashed var(--rose)" : "solid " + (wset[i] && rset[i] ? "var(--lime)" : "var(--line)")) + ";" +
            "background:" + (dn ? "transparent" : "var(--surface-solid)") + ";color:" + (dn ? "var(--text-dim)" : "var(--text)")
        },
          h("div", { style: "font-weight:700" }, "R" + (i + 1)),
          h("div", { style: "color:var(--text-dim)" }, ver),
          h("div", { style: "color:var(--accent-ink);font-weight:700" }, tags.length ? tags.join(" + ") : "\u2014")));
      }
      stage.appendChild(row);
      var msg;
      if (!writeOk) msg = "Only " + live.length + " of " + st.n + " replicas are up, fewer than W = " + st.w + ". A strict quorum refuses the write.";
      else if (!readOk) msg = "The write succeeded, but only " + live.length + " replicas are up, fewer than R = " + st.r + ". The read is refused.";
      else if (fresh) msg = "Write and read sets share " + overlap + " replica(s), so the coordinator sees v2 and returns it (and can read-repair the stale ones).";
      else msg = "The read set never touched a replica holding v2. The client gets the old value: a stale read, even though both operations reported success.";
      stage.appendChild(h("p", { style: "font-size:0.86rem;color:var(--text-dim);margin-top:10px;line-height:1.5" }, msg));

      clear(readout);
      readout.appendChild(ro("R + W", (st.r + st.w) + (st.r + st.w > st.n ? " > " : " \u2264 ") + "N = " + st.n));
      readout.appendChild(ro("overlap guaranteed", st.r + st.w > st.n ? "yes" : "no"));
      readout.appendChild(ro("writes", writeOk ? "available" : "unavailable"));
      readout.appendChild(ro("reads", readOk ? "available" : "unavailable"));
      readout.appendChild(ro("this read", !writeOk ? "\u2014" : !readOk ? "refused" : fresh ? "fresh (v2)" : "stale (v1)"));
      readout.appendChild(ro("failures tolerated (W / R)", (st.n - st.w) + " / " + (st.n - st.r)));
    }

    mount.appendChild(controls);
    mount.appendChild(nodeBar);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. distShard — hash-mod-N vs consistent hashing vs range
     1,200 keys. Add or remove a node and count how many keys change
     owner. Write pattern toggles uniform vs time-ordered inserts.
  ================================================================== */
  var KEYS = 1200, VNODES = 24, MIN_NODES = 2, MAX_NODES = 8;
  var KEY_HASH = [];
  (function () { for (var i = 0; i < KEYS; i++) KEY_HASH.push(hash32("key-" + i)); })();
  var UNIFORM_WRITES = [];
  (function () { for (var j = 0; j < 300; j++) UNIFORM_WRITES.push(hash32("write-" + j) % KEYS); })();
  var RECENT_WRITES = [];
  (function () { for (var j = KEYS - 150; j < KEYS; j++) RECENT_WRITES.push(j); })();

  Widgets.distShard = function (mount) {
    shell(mount, "partitioning", "Rebalancing cost explorer",
      "1,200 keys spread over a cluster. Pick a placement scheme, then add or remove a node and see how many keys must move. Flip the write pattern to time-ordered keys to see which scheme turns the newest partition into a hot spot.");
    var st = { scheme: "mod", pattern: "uniform", nodes: [], nextId: 1, ranges: [], moved: null, ideal: null, last: "" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function equalRanges() {
      st.ranges = [];
      var n = st.nodes.length;
      for (var i = 0; i < n; i++) {
        st.ranges.push({ node: st.nodes[i], lo: Math.floor(i * KEYS / n), hi: Math.floor((i + 1) * KEYS / n) });
      }
    }

    function reset() {
      st.nodes = [1, 2, 3, 4];
      st.nextId = 5;
      st.moved = null; st.ideal = null; st.last = "Fresh cluster of 4 nodes.";
      equalRanges();
    }

    function ringOwners() {
      var pts = [], i, v;
      for (i = 0; i < st.nodes.length; i++) {
        for (v = 0; v < VNODES; v++) pts.push({ pos: hash32("node-" + st.nodes[i] + "-vnode-" + v), node: st.nodes[i] });
      }
      pts.sort(function (a, b) { return a.pos - b.pos; });
      var out = [];
      for (i = 0; i < KEYS; i++) {
        var hk = KEY_HASH[i], lo = 0, hi = pts.length;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (pts[mid].pos < hk) lo = mid + 1; else hi = mid; }
        out.push(pts[lo === pts.length ? 0 : lo].node);
      }
      return out;
    }

    function owners() {
      var out = [], i, j;
      if (st.scheme === "ring") return ringOwners();
      for (i = 0; i < KEYS; i++) {
        if (st.scheme === "mod") out.push(st.nodes[KEY_HASH[i] % st.nodes.length]);
        else {
          var own = st.ranges.length ? st.ranges[st.ranges.length - 1].node : st.nodes[0];
          for (j = 0; j < st.ranges.length; j++) if (i >= st.ranges[j].lo && i < st.ranges[j].hi) { own = st.ranges[j].node; break; }
          out.push(own);
        }
      }
      return out;
    }

    function diff(a, b) {
      var c = 0;
      for (var i = 0; i < KEYS; i++) if (a[i] !== b[i]) c++;
      return c / KEYS;
    }

    function addNode() {
      if (st.nodes.length >= MAX_NODES) { st.last = "Demo cap is " + MAX_NODES + " nodes."; paint(); return; }
      var before = owners();
      var id = st.nextId++;
      st.nodes.push(id);
      if (st.scheme === "range") {
        var wi = 0;
        for (var i = 0; i < st.ranges.length; i++) {
          if (st.ranges[i].hi - st.ranges[i].lo >= st.ranges[wi].hi - st.ranges[wi].lo) wi = i;
        }
        var seg = st.ranges[wi];
        var mid = Math.floor((seg.lo + seg.hi) / 2);
        st.ranges.splice(wi + 1, 0, { node: id, lo: mid, hi: seg.hi });
        seg.hi = mid;
      }
      st.moved = diff(before, owners());
      st.ideal = 1 / st.nodes.length;
      st.last = "Added N" + id + ".";
      paint();
    }

    function removeNode() {
      if (st.nodes.length <= MIN_NODES) { st.last = "Keep at least " + MIN_NODES + " nodes."; paint(); return; }
      var before = owners();
      var oldN = st.nodes.length;
      var id = st.nodes.pop();
      if (st.scheme === "range") {
        for (var i = 0; i < st.ranges.length; i++) {
          if (st.ranges[i].node === id) {
            if (i > 0) st.ranges[i - 1].hi = st.ranges[i].hi;
            else if (st.ranges.length > 1) st.ranges[1].lo = st.ranges[i].lo;
            st.ranges.splice(i, 1);
            break;
          }
        }
      }
      st.moved = diff(before, owners());
      st.ideal = 1 / oldN;
      st.last = "Removed N" + id + ".";
      paint();
    }

    function paint() {
      var own = owners(), i, n = st.nodes.length;
      var keyCount = {}, writeCount = {};
      for (i = 0; i < n; i++) { keyCount[st.nodes[i]] = 0; writeCount[st.nodes[i]] = 0; }
      for (i = 0; i < KEYS; i++) keyCount[own[i]] = (keyCount[own[i]] || 0) + 1;
      var writes = st.pattern === "uniform" ? UNIFORM_WRITES : RECENT_WRITES;
      for (i = 0; i < writes.length; i++) writeCount[own[writes[i]]] = (writeCount[own[writes[i]]] || 0) + 1;
      var maxW = 0;
      for (i = 0; i < n; i++) if (writeCount[st.nodes[i]] > maxW) maxW = writeCount[st.nodes[i]];
      var skew = maxW / (writes.length / n);

      clear(stage);
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:56px 1fr 52px 1fr 52px;gap:6px 10px;align-items:center;font-size:0.8rem;color:var(--text-dim)" },
        h("span", {}, "node"), h("span", {}, "keys owned"), h("span", {}, ""), h("span", {}, "share of new writes"), h("span", {}, "")));
      for (i = 0; i < n; i++) {
        var id = st.nodes[i];
        var kp = keyCount[id] / KEYS, wp = writeCount[id] / writes.length;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:56px 1fr 52px 1fr 52px;gap:6px 10px;align-items:center;padding:3px 0;font-size:0.82rem" },
          h("span", { style: "font-family:var(--font-mono);font-weight:700;color:var(--text)" }, "N" + id),
          h("span", { style: "display:block;height:10px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
            h("i", { style: "display:block;height:100%;width:" + Math.min(100, kp * 100) + "%;background:var(--cyan)" })),
          h("span", { style: "font-family:var(--font-mono);color:var(--text)" }, pct(kp)),
          h("span", { style: "display:block;height:10px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
            h("i", { style: "display:block;height:100%;width:" + Math.min(100, wp * 100) + "%;background:" + (wp > 2 / n ? "var(--rose)" : "var(--lime)") })),
          h("span", { style: "font-family:var(--font-mono);color:var(--text)" }, pct(wp))));
      }
      var note = st.scheme === "mod" ? "hash(key) mod N: adding one node changes the divisor, so most keys land somewhere new."
        : st.scheme === "ring" ? "Consistent hashing, " + VNODES + " virtual nodes per server: only keys in the arcs a node gains or loses move."
        : "Range partitioning by key order: a split or merge moves one contiguous range (so a new node may start below its fair share), and ordered keys keep scans cheap.";
      stage.appendChild(h("p", { style: "font-size:0.84rem;color:var(--text-dim);margin-top:10px;line-height:1.5" }, st.last + " " + note));

      clear(readout);
      readout.appendChild(ro("nodes", n));
      readout.appendChild(ro("keys moved (last change)", st.moved == null ? "\u2014" : pct(st.moved)));
      readout.appendChild(ro("fair share per node", st.ideal == null ? "\u2014" : pct(st.ideal)));
      readout.appendChild(ro("write skew (max / avg)", (Math.round(skew * 100) / 100) + "\u00d7"));
    }

    reset();
    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center" },
      segment([["mod", "hash mod N"], ["ring", "Consistent hash + vnodes"], ["range", "Range"]], 0, function (v) {
        st.scheme = v; st.moved = null; st.ideal = null; equalRanges();
        st.last = "Scheme switched; placement recomputed for " + st.nodes.length + " nodes.";
        paint();
      }),
      segment([["uniform", "Uniform writes"], ["recent", "Time-ordered keys"]], 0, function (v) { st.pattern = v; paint(); }),
      btn("Add node", "primary", addNode),
      btn("Remove node", "", removeNode),
      btn("Reset", "ghost", function () { reset(); paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. distRaft — deterministic five-node Raft script
     Each step is a full snapshot: [role, term, votedFor, log, commit].
     Roles: F follower, C candidate, L leader, D crashed.
     Log string: "term:cmd,term:cmd" (index = position, 1-based).
  ================================================================== */
  var LA = "1:x=1", LB = "1:x=1,1:x=2", LC = "1:x=1,1:x=2,1:x=9",
      LD = "1:x=1,1:x=2,3:noop", LE = "1:x=1,1:x=2,3:noop,3:x=3";
  var RAFT_SCRIPT = [
    { msg: "S1 is the leader for term 1. Every node holds entry 1 (x=1), and it is committed everywhere.",
      n: [["L", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1]] },
    { msg: "A client sends x=2. The leader appends it to its own log at index 2 (term 1). It is not committed yet: only one copy exists.",
      n: [["L", 1, "S1", LB, 1], ["F", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1]] },
    { msg: "AppendEntries(prevIndex=1, prevTerm=1, entry 2) reaches S2 and S3. Their entry 1 matches, so they append. S4 and S5 are slow and have not received it.",
      n: [["L", 1, "S1", LB, 1], ["F", 1, "S1", LB, 1], ["F", 1, "S1", LB, 1], ["F", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1]] },
    { msg: "S1 now has entry 2 on 3 of 5 nodes, a majority, in its own term: commitIndex = 2. It applies x=2, answers the client, and the next heartbeat tells S2 and S3.",
      n: [["L", 1, "S1", LB, 2], ["F", 1, "S1", LB, 2], ["F", 1, "S1", LB, 2], ["F", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1]] },
    { msg: "A client sends x=9. S1 appends it at index 3, then crashes before sending it to anyone. That entry exists on exactly one disk and was never acknowledged.",
      n: [["D", 1, "S1", LC, 2], ["F", 1, "S1", LB, 2], ["F", 1, "S1", LB, 2], ["F", 1, "S1", LA, 1], ["F", 1, "S1", LA, 1]] },
    { msg: "Heartbeats stop. S4's randomized election timeout fires first: it becomes a candidate, bumps to term 2, votes for itself and sends RequestVote(lastIndex=1, lastTerm=1).",
      n: [["D", 1, "S1", LC, 2], ["F", 1, "S1", LB, 2], ["F", 1, "S1", LB, 2], ["C", 2, "S4", LA, 1], ["F", 1, "S1", LA, 1]] },
    { msg: "S5's log is no newer than S4's, so it grants its vote. S2 and S3 refuse: their last entry is (term 1, index 2), more up to date than S4's. They still adopt term 2. S4 has 2 votes and needs 3.",
      n: [["D", 1, "S1", LC, 2], ["F", 2, "\u2014", LB, 2], ["F", 2, "\u2014", LB, 2], ["C", 2, "S4", LA, 1], ["F", 2, "S4", LA, 1]] },
    { msg: "Term 2 elects nobody. S3 times out next: candidate for term 3, votes for itself, RequestVote(lastIndex=2, lastTerm=1).",
      n: [["D", 1, "S1", LC, 2], ["F", 2, "\u2014", LB, 2], ["C", 3, "S3", LB, 2], ["C", 2, "S4", LA, 1], ["F", 2, "S4", LA, 1]] },
    { msg: "S2, S4 and S5 see a higher term and a log at least as up to date as theirs, so all three grant. S3 has 4 votes: leader for term 3. S4 steps down to follower.",
      n: [["D", 1, "S1", LC, 2], ["F", 3, "S3", LB, 2], ["L", 3, "S3", LB, 2], ["F", 3, "S3", LA, 1], ["F", 3, "S3", LA, 1]] },
    { msg: "S3 appends a no-op at index 3 (term 3). For S4 and S5 the consistency check at prevIndex 2 fails, so S3 backs nextIndex up and resends entry 2 too. Once a majority holds the term-3 entry, everything up to index 3 is committed.",
      n: [["D", 1, "S1", LC, 2], ["F", 3, "S3", LD, 3], ["L", 3, "S3", LD, 3], ["F", 3, "S3", LD, 3], ["F", 3, "S3", LD, 3]] },
    { msg: "A client sends x=3. S3 appends it at index 4, replicates to the four live nodes, commits at index 4, and followers advance on the next heartbeat.",
      n: [["D", 1, "S1", LC, 2], ["F", 3, "S3", LE, 4], ["L", 3, "S3", LE, 4], ["F", 3, "S3", LE, 4], ["F", 3, "S3", LE, 4]] },
    { msg: "S1 restarts. Raft nodes always restart as followers, so S1 is a follower in term 1 with a stale log that still contains the uncommitted x=9.",
      n: [["F", 1, "S1", LC, 2], ["F", 3, "S3", LE, 4], ["L", 3, "S3", LE, 4], ["F", 3, "S3", LE, 4], ["F", 3, "S3", LE, 4]] },
    { msg: "S3's heartbeat carries term 3, so S1 adopts it. At index 3 S1 has term 1 but the leader has term 3: conflict. S1 deletes x=9 and everything after it, then copies the leader's entries. x=9 was never committed, so dropping it breaks no promise.",
      n: [["F", 3, "S3", LE, 4], ["F", 3, "S3", LE, 4], ["L", 3, "S3", LE, 4], ["F", 3, "S3", LE, 4], ["F", 3, "S3", LE, 4]] }
  ];

  function roleInfo(r) {
    if (r === "L") return { label: "leader", color: "var(--lime-ink)", border: "var(--lime)" };
    if (r === "C") return { label: "candidate", color: "var(--amber-ink)", border: "var(--amber)" };
    if (r === "D") return { label: "crashed", color: "var(--rose-ink)", border: "var(--rose)" };
    return { label: "follower", color: "var(--text-dim)", border: "var(--line)" };
  }

  Widgets.distRaft = function (mount) {
    shell(mount, "consensus", "Raft, one message at a time",
      "Five servers, one scripted history: replicate and commit, crash the leader, a failed election, a successful one, log repair, and the old leader rejoining. Step through it and watch roles, terms, logs and commit indexes change.");
    var step = 0;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var backBtn = btn("Back", "ghost", function () { if (step > 0) { step--; paint(); } });
    var stepBtn = btn("Step", "primary", function () { if (step < RAFT_SCRIPT.length - 1) { step++; paint(); } });
    var resetBtn = btn("Reset", "ghost", function () { step = 0; paint(); });

    function paint() {
      var snap = RAFT_SCRIPT[step] || RAFT_SCRIPT[0];
      var i, j, leader = null, leaderTerm = 0, maxTerm = 0, alive = 0;
      clear(stage);
      var grid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px" });
      for (i = 0; i < snap.n.length; i++) {
        var nd = snap.n[i];
        var info = roleInfo(nd[0]);
        if (nd[0] !== "D") alive++;
        if (nd[0] === "L") { leader = "S" + (i + 1); leaderTerm = nd[1]; }
        if (nd[1] > maxTerm) maxTerm = nd[1];
        var entries = nd[3] ? nd[3].split(",") : [];
        var logRow = h("div", { style: "display:flex;flex-wrap:wrap;gap:3px;margin-top:6px" });
        for (j = 0; j < entries.length; j++) {
          var parts = entries[j].split(":");
          var committed = j + 1 <= nd[4];
          logRow.appendChild(h("span", {
            style: "font-family:var(--font-mono);font-size:0.78rem;padding:2px 5px;border-radius:5px;color:var(--text);" +
              "border:1px " + (committed ? "solid var(--lime)" : "dashed var(--line)") + ";" +
              "background:" + (committed ? "color-mix(in srgb, var(--lime) 14%, transparent)" : "transparent")
          }, (j + 1) + "\u00b7t" + parts[0] + " " + parts[1]));
        }
        grid.appendChild(h("div", {
          style: "padding:8px 10px;border-radius:10px;background:var(--surface-solid);border:2px " +
            (nd[0] === "D" ? "dashed " : "solid ") + info.border + ";opacity:" + (nd[0] === "D" ? "0.85" : "1")
        },
          h("div", { style: "display:flex;justify-content:space-between;gap:6px;font-size:0.84rem" },
            h("b", { style: "color:var(--text)" }, "S" + (i + 1)),
            h("span", { style: "font-weight:700;color:" + info.color }, info.label)),
          h("div", { style: "font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim);margin-top:4px" },
            "term " + nd[1] + " \u00b7 voted " + nd[2] + " \u00b7 commit " + nd[4]),
          logRow));
      }
      stage.appendChild(grid);
      stage.appendChild(h("p", { style: "font-size:0.86rem;color:var(--text);margin-top:10px;line-height:1.55" },
        "Step " + step + ": " + snap.msg));
      stage.appendChild(h("p", { style: "font-size:0.8rem;color:var(--text-dim);margin:4px 0 0" },
        "Solid green border = committed on that node. Dashed = in the log but not known committed."));

      backBtn.disabled = step === 0;
      stepBtn.disabled = step === RAFT_SCRIPT.length - 1;
      var leaderCommit = 0;
      for (i = 0; i < snap.n.length; i++) if (snap.n[i][0] === "L") leaderCommit = snap.n[i][4];

      clear(readout);
      readout.appendChild(ro("step", step + " / " + (RAFT_SCRIPT.length - 1)));
      readout.appendChild(ro("leader", leader ? leader + " (term " + leaderTerm + ")" : "none"));
      readout.appendChild(ro("highest term", maxTerm));
      readout.appendChild(ro("leader commit index", leader ? leaderCommit : "\u2014"));
      readout.appendChild(ro("live nodes", alive + " / 5 (majority = 3)"));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:8px" }, backBtn, stepBtn, resetBtn));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     4. distClocks — Lamport and vector timestamps, step by step
  ================================================================== */
  var CLOCK_SCRIPT = [
    { p: 0, kind: "local", name: "a", text: "P1 does local work" },
    { p: 0, kind: "send", name: "b", to: 1, msg: "m1", text: "P1 sends m1 to P2" },
    { p: 1, kind: "local", name: "c", text: "P2 does local work (before m1 arrives)" },
    { p: 1, kind: "recv", name: "d", msg: "m1", text: "P2 receives m1" },
    { p: 2, kind: "local", name: "e", text: "P3 does local work, unaware of anyone" },
    { p: 1, kind: "send", name: "f", to: 2, msg: "m2", text: "P2 sends m2 to P3" },
    { p: 2, kind: "recv", name: "g", msg: "m2", text: "P3 receives m2" },
    { p: 0, kind: "local", name: "h", text: "P1 does more local work" },
    { p: 2, kind: "send", name: "i", to: 0, msg: "m3", text: "P3 sends m3 to P1" },
    { p: 0, kind: "recv", name: "j", msg: "m3", text: "P1 receives m3" }
  ];

  function runClocks(upto) {
    var L = [0, 0, 0], V = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], inflight = {}, out = [];
    for (var s = 0; s < upto && s < CLOCK_SCRIPT.length; s++) {
      var ev = CLOCK_SCRIPT[s], p = ev.p, k;
      if (ev.kind === "recv" && inflight[ev.msg]) {
        var m = inflight[ev.msg];
        L[p] = Math.max(L[p], m.l) + 1;
        for (k = 0; k < 3; k++) V[p][k] = Math.max(V[p][k], m.v[k]);
        V[p][p]++;
      } else {
        L[p]++;
        V[p][p]++;
      }
      if (ev.kind === "send") inflight[ev.msg] = { l: L[p], v: V[p].slice() };
      out.push({ ev: ev, l: L[p], v: V[p].slice() });
    }
    return out;
  }

  function vcCompare(a, b) {
    var le = true, ge = true;
    for (var k = 0; k < 3; k++) { if (a[k] > b[k]) le = false; if (a[k] < b[k]) ge = false; }
    if (le && ge) return "equal";
    if (le) return "before";
    if (ge) return "after";
    return "concurrent";
  }

  Widgets.distClocks = function (mount) {
    shell(mount, "clocks", "Lamport vs vector clocks",
      "Three processes exchange three messages. Step through the history and watch both clocks tick, then compare any two events: the vector clock can tell 'happened before' from 'concurrent'; the Lamport number cannot.");
    var step = CLOCK_SCRIPT.length;
    var pickA = "c", pickB = "e";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var back = btn("Back", "ghost", function () { if (step > 0) { step--; paint(); } });
    var fwd = btn("Step", "primary", function () { if (step < CLOCK_SCRIPT.length) { step++; paint(); } });
    var reset = btn("Reset", "ghost", function () { step = 0; paint(); });
    function sel(initial, onPick) {
      var s = h("select", { "aria-label": "Event" });
      CLOCK_SCRIPT.forEach(function (ev) {
        var o = h("option", { value: ev.name }, ev.name + " (P" + (ev.p + 1) + ")");
        if (ev.name === initial) o.setAttribute("selected", "selected");
        s.appendChild(o);
      });
      s.addEventListener("change", function () { onPick(s.value); paint(); });
      return s;
    }
    var selA = sel(pickA, function (v) { pickA = v; });
    var selB = sel(pickB, function (v) { pickB = v; });

    function paint() {
      var done = runClocks(step), byName = {}, i, p;
      for (i = 0; i < done.length; i++) byName[done[i].ev.name] = done[i];
      clear(stage);
      var grid = h("div", { style: "display:grid;grid-template-columns:44px repeat(" + CLOCK_SCRIPT.length + ",minmax(54px,1fr));gap:4px;overflow-x:auto;font-family:var(--font-mono);font-size:0.78rem" });
      for (p = 0; p < 3; p++) {
        grid.appendChild(h("div", { style: "color:var(--text);font-weight:700;align-self:center" }, "P" + (p + 1)));
        for (i = 0; i < CLOCK_SCRIPT.length; i++) {
          var ev = CLOCK_SCRIPT[i], hit = byName[ev.name];
          if (ev.p !== p) { grid.appendChild(h("div", { style: "border-bottom:1px dashed var(--line)" })); continue; }
          var chosen = ev.name === pickA || ev.name === pickB;
          grid.appendChild(h("div", {
            style: "padding:4px;border-radius:8px;text-align:center;line-height:1.35;color:var(--text);" +
              "background:var(--surface-solid);border:" + (chosen ? "2px solid var(--accent-ink)" : "1px solid var(--line)") +
              ";opacity:" + (hit ? "1" : "0.45")
          },
            h("b", {}, ev.name + (ev.kind === "send" ? " \u2192" : ev.kind === "recv" ? " \u2190" : "")),
            h("div", { style: "color:var(--violet-ink)" }, hit ? "L=" + hit.l : "L=?"),
            h("div", { style: "color:var(--cyan-ink)" }, hit ? "[" + hit.v.join(",") + "]" : "[?]")));
        }
      }
      stage.appendChild(grid);
      var last = done.length ? done[done.length - 1] : null;
      stage.appendChild(h("p", { style: "font-size:0.86rem;color:var(--text);margin:10px 0 0;line-height:1.55" },
        last ? "Step " + step + ": " + last.ev.text + ". " + (last.ev.kind === "recv" ? "Receive rule: take the max of local and message clocks, then tick." : "Local or send: tick your own entry.") : "Step 0: no events yet."));
      back.disabled = step === 0;
      fwd.disabled = step === CLOCK_SCRIPT.length;

      clear(readout);
      readout.appendChild(ro("step", step + " / " + CLOCK_SCRIPT.length));
      var a = byName[pickA], b = byName[pickB];
      if (a && b) {
        var rel = vcCompare(a.v, b.v);
        var lam = a.l < b.l ? pickA + " has the smaller Lamport number" : a.l > b.l ? pickB + " has the smaller Lamport number" : "equal Lamport numbers";
        readout.appendChild(ro("Lamport", "L(" + pickA + ")=" + a.l + ", L(" + pickB + ")=" + b.l + " \u2014 " + lam));
        readout.appendChild(ro("vector verdict", rel === "before" ? pickA + " happened before " + pickB : rel === "after" ? pickB + " happened before " + pickA : rel === "equal" ? "same event" : "concurrent (no causal path)"));
      } else {
        readout.appendChild(ro("compare", "step forward until both events have happened"));
      }
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:8px;align-items:center" },
      back, fwd, reset,
      h("label", { class: "w-field" }, h("span", {}, "Compare"), selA),
      h("label", { class: "w-field" }, h("span", {}, "with"), selB)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "dist-replication": {
      title: "Replication checkpoint",
      sub: "What gets shipped, when a commit returns, lag, and failing over safely.",
      questions: [
        {
          q: "Why can statement-based replication leave a replica with different data from its leader?",
          options: ["It ships more bytes than row-based replication", "It requires both servers to share an identical page layout", "Non-deterministic expressions such as NOW(), RAND() or UUID() are re-evaluated on the replica and produce different values", "It cannot replicate DDL statements at all"],
          answer: 2,
          explain: "Statement-based replication re-executes the SQL text on every replica. Anything whose result depends on time, randomness, row order or server state can evaluate differently there. Row-based (logical) replication ships the resulting row images instead, which is why MySQL moved its default to ROW."
        },
        {
          q: "A Postgres primary runs synchronous_commit = on with a single named synchronous standby. That standby crashes. What happens to new commits?",
          options: ["They wait indefinitely for an acknowledgement that cannot arrive, until the standby returns or you change synchronous_standby_names", "Postgres silently falls back to asynchronous replication after ten seconds", "They commit locally and the standby catches up later with no visible effect", "The primary shuts itself down to protect durability"],
          answer: 0,
          explain: "Postgres never downgrades a synchronous guarantee on its own: a commit waits until a synchronous standby confirms the flush. With one sync standby, losing it stalls writes. The usual fix is listing several candidates, for example ANY 1 (a, b), so one survivor is enough. MySQL semi-sync is the one that falls back to async after a timeout."
        },
        {
          q: "A user edits their profile, refreshes, and sees the old value because the read hit a lagging replica. What is the cheapest targeted fix?",
          options: ["Make all replication fully synchronous", "Add more read replicas to spread the load", "Switch from row-based to statement-based replication", "Send that user's reads to the leader for a short window after a write, or to a replica whose replay position has passed the write's LSN"],
          answer: 3,
          explain: "Read-your-writes is a per-session guarantee, so solve it per session. Routing recent writers to the leader, or carrying the commit LSN and waiting until a replica has replayed past it, fixes the anomaly without slowing every commit in the system. Full synchronous replication would work but pays latency on every write."
        },
        {
          q: "During failover, what is the purpose of fencing the old leader?",
          options: ["To speed up WAL shipping to the new leader", "To guarantee the old leader can no longer accept writes once a new leader is promoted, preventing split brain", "To encrypt the replication stream between data centres", "To pick the replica with the lowest replication lag"],
          answer: 1,
          explain: "A leader that only looks dead (paused, partitioned) may keep serving writes. If a replica is promoted while that happens, two nodes accept conflicting writes. Fencing (power off, revoke storage or address, expired lease, or a fencing token that storage checks) makes the old leader's writes impossible or rejected."
        },
        {
          q: "With asynchronous replication, the leader dies and a replica that was 2 seconds behind is promoted. What happens to transactions committed on the old leader in those 2 seconds?",
          options: ["Clients automatically resend them to the new leader", "The new leader recovers them from its relay log", "They are missing from the new leader's history even though clients were told they committed; if the old leader returns, its divergent tail must be discarded or reconciled by hand", "They are rolled back on the clients through a compensation message"],
          answer: 2,
          explain: "Async replication acknowledges commits before any replica has them, so the unreplicated tail is the data-loss window. The promoted replica starts a new timeline without those writes. Tools like pg_rewind bring the old leader back by throwing that tail away, so any recovery of it is a manual reconciliation job."
        },
        {
          q: "A service updates an order in Postgres and then publishes an OrderShipped event to Kafka from application code. Occasionally events go missing after crashes. What is the robust fix?",
          options: ["Publish to Kafka before the database commit", "Retry the publish three times", "Write the event to an outbox table in the same transaction and let log-based CDC publish committed outbox rows", "Poll the orders table every few seconds for status changes"],
          answer: 2,
          explain: "Two independent writes cannot be made atomic by retries. The outbox puts the event in the same transaction as the change, so both commit or neither does, and CDC reads only committed rows from the log. Delivery is then at least once, so consumers should be idempotent."
        }
      ]
    },
    "dist-partition": {
      title: "Partitioning, quorums and consistency checkpoint",
      sub: "Placement schemes, rebalancing, secondary indexes, N/W/R and the consistency ladder.",
      questions: [
        {
          q: "A cache cluster places keys with hash(key) mod 4. You add a fifth node and switch to mod 5. Roughly what fraction of keys change owner?",
          options: ["About 20%", "About 80%", "About 50%", "None, hashing is stable"],
          answer: 1,
          explain: "A key stays put only if hash mod 4 equals hash mod 5, which happens for 4 out of every 20 hash values, so about 20% stay and 80% move. The minimum possible is about 1/5, the share the new node must own. Consistent hashing gets close to that minimum."
        },
        {
          q: "Why do consistent-hashing systems give each physical server many virtual nodes on the ring?",
          options: ["To keep keys sorted so range scans are cheap", "To reduce the replication factor needed for durability", "To eliminate hot keys entirely", "So each server owns many small arcs: load evens out, and a joining or leaving server exchanges data with many peers instead of one neighbour"],
          answer: 3,
          explain: "With one token per server the arcs are uneven and a new server steals from a single neighbour. Many tokens per server average out arc sizes and spread rebalancing traffic across the cluster. Vnodes do nothing for a single hot key, which still lives on one replica set."
        },
        {
          q: "A leaderless store runs N = 3, W = 2, R = 2. One replica goes down. What is true?",
          options: ["Reads and writes still succeed, and every read quorum still overlaps every write quorum", "Writes fail but reads still succeed", "Only reads at consistency level ONE succeed", "Both reads and writes fail until the replica returns"],
          answer: 0,
          explain: "Two live replicas still satisfy W = 2 and R = 2, and because R + W = 4 > 3 any two-replica read set shares at least one replica with any two-replica write set. Lose a second replica and both operations become unavailable under a strict quorum."
        },
        {
          q: "What is the main cost of a global (term-partitioned) secondary index compared with a local one?",
          options: ["Every index read must scatter to all partitions", "It cannot be built on a hash-partitioned table", "One base-table write may have to update index partitions on other nodes, so the index is often maintained asynchronously and can be briefly stale", "It forces the base table to be range partitioned"],
          answer: 2,
          explain: "A global index is partitioned by the indexed value, so the index entry for a row usually lives on a different node from the row. Reads become a single targeted lookup, but writes turn into a distributed update. Many systems apply it asynchronously, which is why global index reads can lag the table."
        },
        {
          q: "Which guarantee does causal consistency give that plain eventual consistency does not?",
          options: ["Every read returns the most recent write in real time", "If a reply was written after its author read a post, no reader can see the reply without also seeing the post", "All replicas apply all writes in a single global order", "Acknowledged writes can never be lost"],
          answer: 1,
          explain: "Causal consistency preserves happened-before: effects never appear without their causes. It does not order concurrent writes and does not promise real-time recency, which is what linearizability adds. Eventual consistency only promises convergence once writes stop, so a reply could show up before the post."
        }
      ]
    },
    "dist-consensus": {
      title: "Consensus and distributed transactions checkpoint",
      sub: "Raft elections and commits, two-phase commit blocking, TrueTime and hybrid clocks.",
      questions: [
        {
          q: "A Raft cluster has 5 voting members. How many can fail at once while the cluster still elects a leader and commits writes?",
          options: ["1", "4", "2", "3"],
          answer: 2,
          explain: "Raft needs a majority, floor(5/2) + 1 = 3 nodes, to elect a leader and to commit an entry. Five nodes therefore survive two failures. That is why clusters use odd sizes: a sixth node raises the majority to 4 and still only tolerates two failures."
        },
        {
          q: "A Raft follower receives RequestVote with a higher term than its own, and it has not voted in that term. Why might it still refuse?",
          options: ["The candidate's log is less up to date: its last entry has a lower term, or the same term and a lower index", "The candidate has a lower server id", "The follower is still the leader of the previous term", "The candidate's wall clock is behind the follower's"],
          answer: 0,
          explain: "The election restriction compares last log term first, then last log index. A voter refuses anyone whose log is behind its own, which guarantees the winner holds every committed entry. Server ids and wall clocks play no part in Raft's safety."
        },
        {
          q: "In two-phase commit, every participant voted yes and then the coordinator crashed before sending the decision. What do the participants do?",
          options: ["Abort after a timeout, which is always safe", "Commit after a timeout, since everyone voted yes", "Elect a new coordinator by running two-phase commit among themselves", "Stay in doubt, holding their locks, until the coordinator recovers or they learn its decision; none of them can decide alone"],
          answer: 3,
          explain: "A yes vote is a promise to commit if told to, so a prepared participant cannot abort on its own: the coordinator may already have logged commit and told someone else. It cannot commit alone either, because the coordinator may have decided abort. That is the blocking problem, which is why production systems replicate the coordinator's state with consensus."
        },
        {
          q: "What does Spanner's commit wait achieve?",
          options: ["It waits for a Paxos majority to acknowledge the write", "It delays acknowledging and exposing a commit until TrueTime guarantees its timestamp has passed on every clock, so timestamp order matches real-time order", "It waits until every replica in every region has applied the write", "It waits for garbage collection of old versions before committing"],
          answer: 1,
          explain: "TrueTime returns an interval guaranteed to contain true time. The leader picks a commit timestamp at the top of that interval and waits out the uncertainty, typically a few milliseconds, before releasing locks. Any transaction that starts afterwards gets a larger timestamp, giving external consistency without a central clock."
        },
        {
          q: "In CockroachDB a read at timestamp t finds a committed value written at a slightly later timestamp, still within the maximum clock offset. What happens?",
          options: ["The value is ignored because it is in the future", "The query fails with a clock-skew error every time", "The value is uncertain, so the read restarts at a higher timestamp rather than risk missing a write that really happened first", "The read waits for a TrueTime interval to elapse"],
          answer: 2,
          explain: "Hybrid logical clocks keep timestamps close to physical time but cannot prove ordering across nodes within the skew bound. A value inside the uncertainty window might have committed before the read began in real time, so the transaction bumps its timestamp and retries. That costs latency under contention but avoids specialised clock hardware."
        }
      ]
    },
    "dist-time": {
      title: "Time, clocks and convergence",
      sub: "Lamport and vector clocks, clock skew, HLC, TrueTime and CRDTs",
      questions: [
        {
          q: "Event a has Lamport timestamp 3 and event b, on another node, has Lamport timestamp 7. What can you conclude?",
          options: ["a happened before b", "b did not happen before a; a may have happened before b or the two may be concurrent", "a and b are concurrent", "b happened before a"],
          answer: 1,
          explain: "Lamport clocks guarantee that if b happened before a then L(b) < L(a). Since 7 is not less than 3, b cannot have happened before a. Beyond that the numbers say nothing: a might precede b or the two might be concurrent. Vector clocks are needed to tell those cases apart."
        },
        {
          q: "Two replicas hold version vectors [3,1,0] and [2,2,0] for the same key. What should a Dynamo-style store do?",
          options: ["Keep [3,1,0] because its first entry is larger", "Keep [2,2,0] because its total is the same and it is newer", "Treat the writes as concurrent and keep both as siblings for a merge, since neither vector dominates the other", "Discard both and return an error"],
          answer: 2,
          explain: "One vector dominates another only if every entry is less than or equal. Here the first is larger in slot one and the second in slot two, so the writes are concurrent. Keeping both lets the application or a merge rule resolve them instead of silently losing one."
        },
        {
          q: "A store resolves conflicts by last-writer-wins on server wall-clock time, and one node's clock runs 80 ms fast. What is the risk?",
          options: ["Writes through that node win races they should have lost, and the overwritten writes are acknowledged then silently discarded", "The store refuses writes from the fast node", "Reads become slower but no data is lost", "NTP stops the problem because it corrects clocks instantly"],
          answer: 0,
          explain: "Last-writer-wins compares timestamps only. A fast clock stamps its writes later than writes that actually came after them, so those later writes lose without any error. That is why LWW is reserved for data where losing a concurrent update is acceptable."
        },
        {
          q: "Which statement about hybrid logical clocks is correct?",
          options: ["They require GPS and atomic clocks in every datacentre", "They make wall-clock skew irrelevant, so no maximum offset is needed", "They are vector clocks with one entry per node", "They never go backwards, respect happens-before, and stay close to physical time, but still need an assumed maximum clock offset to reason about real-time order"],
          answer: 3,
          explain: "An HLC combines the largest physical time seen with a logical counter. It is monotonic, causality-respecting and close to wall time. It cannot prove real-time order between nodes on its own, so systems like CockroachDB assume a maximum offset and restart reads that fall inside the uncertainty window."
        },
        {
          q: "Why does a G-Counter keep one slot per replica instead of a single shared integer?",
          options: ["To use less memory", "So the merge (per-slot maximum) is idempotent and order-independent: re-sending state never double-counts and concurrent increments are never lost", "Because counters must be strictly ordered", "So the counter can also be decremented"],
          answer: 1,
          explain: "With one integer, merging by max loses concurrent increments and merging by sum double-counts repeated syncs. Per-replica slots, each only incremented by its owner, make max a correct merge, and the value is the sum of slots. Decrements need a second counter (a PN-Counter)."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.dist = {
    id: "dist",
    name: "Replication & Distribution",
    short: "DIST",
    tagline: "Copies, shards, quorums and consensus",
    color: "#34d399",
    blurb: "How one database becomes many machines without lying to you. What a replication stream actually carries, change data capture and the outbox, when a commit really returns, why failover loses data, how keys are placed and moved, what N, W and R buy, the consistency ladder, Raft step by step, two-phase commit and its blocking problem, how Spanner and CockroachDB stitch it all together, and finally Lamport, vector and hybrid clocks, TrueTime and CRDTs.",
    modules: [
      {
        id: "replication",
        name: "Replication",
        icon: "share",
        lessons: [
          {
            id: "leader-follower",
            title: "Leader–follower replication: what actually travels",
            summary: "Statement, physical WAL and logical row replication: what each ships, where each breaks, and which engines use which.",
            minutes: 10,
            tags: ["replication", "wal", "binlog", "logical-decoding"],
            blocks: [
              { t: "p", html: "Hold this picture: <strong>one node accepts writes, turns them into an ordered change stream, and every follower replays that stream in the same order</strong>. The leader is the only place where ordering is decided, so followers never have to agree with each other about anything. The interesting question is what the stream contains, because that decides what can go wrong." },
              { t: "h", text: "Three things you can ship" },
              { t: "table", headers: ["Method", "What travels", "Where you meet it", "Breaks when"], rows: [
                ["Statement-based", "The SQL text of each write", "MySQL <code class='tok'>binlog_format=STATEMENT</code>", "Non-deterministic SQL: <code class='tok'>NOW()</code>, <code class='tok'>RAND()</code>, <code class='tok'>UUID()</code>, <code class='tok'>UPDATE ... LIMIT</code> without <code class='tok'>ORDER BY</code>, triggers with side effects"],
                ["Physical (WAL shipping)", "Byte-level page changes from the write-ahead log", "Postgres streaming replication, Oracle physical standby", "Replica must run the same major version and platform; you get the whole cluster or nothing"],
                ["Logical (row-based)", "Before/after row images keyed by primary key", "MySQL <code class='tok'>ROW</code> binlog, Postgres publications and subscriptions", "Tables without a key or replica identity; Postgres logical replication does not carry DDL; huge transactions"]
              ] },
              { t: "h", text: "Physical replication, mechanically" },
              { t: "p", html: "In Postgres a <strong>walsender</strong> process on the primary streams WAL records to a <strong>walreceiver</strong> on the standby, which writes them to its own <code class='tok'>pg_wal</code>. The standby's startup process then replays them exactly as crash recovery would. The standby is a byte-for-byte copy of the primary's 8 KB pages, which is why it can serve read-only queries (<code class='tok'>hot_standby</code>) but cannot have its own extra tables or indexes." },
              { t: "code", lang: "sql", code:
                "-- On the primary: one row per connected standby\n" +
                "SELECT application_name, state, sent_lsn, write_lsn,\n" +
                "       flush_lsn, replay_lsn, replay_lag\n" +
                "FROM pg_stat_replication;\n\n" +
                "-- Logical replication: publish one table, subscribe elsewhere\n" +
                "CREATE PUBLICATION orders_pub FOR TABLE orders;\n" +
                "-- on the subscriber (any newer major version is fine)\n" +
                "CREATE SUBSCRIPTION orders_sub\n" +
                "  CONNECTION 'host=primary.example dbname=shop user=replicator'\n" +
                "  PUBLICATION orders_pub;" },
              { t: "h", text: "Why logical decoding exists" },
              { t: "p", html: "Physical streams are perfect high-availability copies and useless for anything else. You cannot replicate one table, feed a search index, or upgrade across major versions with them. <strong>Logical decoding</strong> reads the same WAL and turns it into row-level inserts, updates and deletes (Postgres needs <code class='tok'>wal_level = logical</code>). Change-data-capture pipelines into Kafka, zero-downtime major upgrades and selective replication all sit on this." },
              { t: "note", variant: "trap", html: "A logical <strong>replication slot</strong> pins WAL on the primary until its consumer confirms it. If the consumer dies and nobody drops the slot, WAL piles up until the disk fills and the primary stops. Monitor <code class='tok'>pg_replication_slots</code> and cap retention with <code class='tok'>max_slot_wal_keep_size</code>." },
              { t: "compare",
                bad: { title: "Statement-based", items: ["Compact: one line of SQL can touch a million rows", "Replica re-runs the work, so CPU is duplicated", "Silent divergence on non-deterministic expressions", "Readable audit trail of what the app issued"] },
                good: { title: "Row-based / logical", items: ["Deterministic: replicas apply resulting values", "A bulk UPDATE becomes one event per row, so the stream is large", "Requires a key to locate each row on the replica", "Feeds CDC, cross-version upgrades and filtering"] } },
              { t: "stat", items: [
                { v: "1", k: "writable leader per replication group; that is the whole point" },
                { v: "ROW", k: "MySQL default binlog format since 5.7.7" },
                { v: "8 KB", k: "Postgres page that physical replication copies byte for byte" }
              ] },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "What you say", "Why it lands that way"], rows: [
                ["Naive", "The leader sends its data to the replicas.", "No idea what the stream contains, so no idea how it fails"],
                ["Solid", "Postgres ships physical WAL; MySQL ships a row-based binlog; statement-based breaks on non-deterministic SQL.", "Names the mechanism and its classic failure"],
                ["Standout", "Physical for HA copies, logical for CDC and upgrades, and watch slots because they pin WAL on the primary.", "Matches the mechanism to the job and knows the operational trap"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"read replicas\", \"standby\", \"stream changes to another system\", \"upgrade without downtime\", \"replica has different data\". Ask first: is the stream physical pages or logical rows?" },
              { t: "note", variant: "key", html: "<strong>Replication is replaying one ordered log.</strong> Physical WAL gives exact copies of the whole cluster; logical rows give flexible, filterable streams; statement text is compact but diverges on anything non-deterministic." }
            ]
          },
          {
            id: "sync-vs-async",
            title: "Sync, async and semi-sync: when does commit return?",
            summary: "The acknowledgement point decides durability and latency, and replication lag creates read anomalies you fix per session.",
            minutes: 11,
            tags: ["replication", "durability", "lag", "read-your-writes"],
            blocks: [
              { t: "p", html: "The only question that matters is <strong>what has to be true before the client hears \"committed\"</strong>. Every replication mode is an answer: the leader's own disk, one replica's memory, one replica's disk, or one replica having applied the change. Moving that point later buys durability and costs a round trip on every commit." },
              { t: "table", headers: ["Mode", "Commit returns after", "If the leader dies", "Latency cost"], rows: [
                ["Asynchronous", "Local WAL flush only", "Unreplicated tail is lost", "None"],
                ["Semi-sync (MySQL)", "Local flush plus at least one replica acknowledging receipt into its relay log", "No acknowledged commit lost, unless it already fell back to async", "One network round trip"],
                ["Synchronous, flush (Postgres <code class='tok'>on</code>)", "A synchronous standby has flushed the WAL to its disk", "No acknowledged commit lost", "Round trip plus remote fsync"],
                ["Synchronous, apply (Postgres <code class='tok'>remote_apply</code>)", "A synchronous standby has replayed it, so reads there see it", "No loss, and read-your-writes on that standby", "Highest: includes replay time"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Postgres: wait for any one of two standbys\n" +
                "ALTER SYSTEM SET synchronous_standby_names = 'ANY 1 (replica_a, replica_b)';\n" +
                "ALTER SYSTEM SET synchronous_commit = 'on';\n" +
                "SELECT pg_reload_conf();\n\n" +
                "-- Downgrade one low-value transaction to local-only durability\n" +
                "BEGIN;\n" +
                "SET LOCAL synchronous_commit = 'local';\n" +
                "INSERT INTO page_views (user_id, url) VALUES (42, '/home');\n" +
                "COMMIT;" },
              { t: "p", html: "MySQL semi-sync with the <code class='tok'>AFTER_SYNC</code> wait point (the default since 5.7) writes and syncs the binlog, waits for a replica to confirm receipt, and only then commits in InnoDB and replies. If no replica answers within <code class='tok'>rpl_semi_sync_source_timeout</code> (10 seconds by default) it <strong>falls back to async</strong> and keeps going." },
              { t: "note", variant: "warn", html: "Postgres never falls back. If your only synchronous standby dies, every commit waits. Name several candidates (<code class='tok'>ANY 1 (a, b)</code> or <code class='tok'>FIRST 1 (a, b)</code>) so one survivor is enough. MySQL's fallback is the opposite trade: writes stay up, but your durability promise silently weakens until the replica returns." },
              { t: "h", text: "Replication lag is normal, then suddenly huge" },
              { t: "p", html: "An async replica usually trails by milliseconds. A long-running bulk update, a big index build, a network blip, a replica with slower disks, or a single-threaded apply process can stretch that to minutes. Measure it in both time and bytes." },
              { t: "code", lang: "sql", code:
                "-- Postgres replica: time since the last replayed commit\n" +
                "SELECT now() - pg_last_xact_replay_timestamp() AS replay_delay;\n\n" +
                "-- Postgres primary: bytes each standby is behind\n" +
                "SELECT application_name,\n" +
                "       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS bytes_behind\n" +
                "FROM pg_stat_replication;\n\n" +
                "-- MySQL replica\n" +
                "SHOW REPLICA STATUS;   -- look at Seconds_Behind_Source" },
              { t: "h", text: "The anomalies lag creates, and their fixes" },
              { t: "table", headers: ["Guarantee broken", "What the user sees", "Targeted fix"], rows: [
                ["Read-your-writes", "Their own edit vanishes after a refresh", "Read from the leader for a few seconds after a write, or wait until the replica has replayed past the commit LSN"],
                ["Monotonic reads", "Data goes back in time between two page loads", "Pin each session to one replica, for example by hashing the user id"],
                ["Consistent prefix", "An answer appears before its question", "Keep causally related writes in one partition or one ordered stream"]
              ] },
              { t: "code", lang: "sql", code:
                "-- After the write, on the primary: hand this token back to the client\n" +
                "SELECT pg_current_wal_lsn();          -- e.g. 0/3A2F1B8\n\n" +
                "-- Before the read, on a replica: is it caught up to that token?\n" +
                "SELECT pg_last_wal_replay_lsn() >= '0/3A2F1B8'::pg_lsn AS caught_up;" },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"user doesn't see their change\", \"we can't lose a payment\", \"replicas in another region\", \"commit latency doubled after enabling HA\". Name the acknowledgement point, then fix read anomalies per session instead of globally." },
              { t: "note", variant: "key", html: "<strong>Durability lives where the acknowledgement waits.</strong> Async is fast and loses the tail; sync costs a round trip per commit and can stall; lag anomalies are session problems, solved with leader reads or LSN tokens." }
            ]
          },
          {
            id: "cdc-logical-decoding",
            title: "Change data capture: log decoding, Debezium and the outbox",
            summary: "Why log-based CDC beats polling and triggers, how a Debezium-style connector snapshots then streams, and how the outbox pattern removes dual writes.",
            minutes: 11,
            tags: ["cdc", "debezium", "logical-decoding", "outbox", "binlog"],
            blocks: [
              { t: "p", html: "The database already writes every committed change to an ordered log for its own recovery. <strong>Change data capture (CDC) means reading that log and publishing each row change as an event</strong>, so search indexes, caches, warehouses and other services can follow the source of truth without querying it." },
              { t: "h", text: "Three ways to capture changes" },
              { t: "table", headers: ["Approach", "How it works", "Misses or costs"], rows: [
                ["Polling", "<code class='tok'>SELECT ... WHERE updated_at &gt; :last_seen</code> on a timer", "Hard deletes vanish; rows updated twice between polls show only the last state; clock and same-timestamp edge cases; constant load on the source"],
                ["Triggers", "A trigger copies each change into an audit table", "Every write does extra work inside the user's transaction; triggers are easy to disable or forget on new tables"],
                ["Log-based", "Decode the WAL (Postgres) or row binlog (MySQL) after commit", "Needs log retention and a replication slot or binlog position; DDL handling is the hard part"]
              ] },
              { t: "h", text: "What sits underneath in Postgres" },
              { t: "ul", items: [
                "<code class='tok'>wal_level = logical</code> adds enough information to the WAL to rebuild row images.",
                "A <strong>logical replication slot</strong> remembers how far the consumer has confirmed (<code class='tok'>confirmed_flush_lsn</code>) and keeps older WAL until then.",
                "An <strong>output plugin</strong> turns decoded changes into a wire format: <code class='tok'>pgoutput</code> ships with Postgres and is what logical replication and most connectors use.",
                "<code class='tok'>REPLICA IDENTITY</code> decides how much of the old row an UPDATE or DELETE carries: by default only the primary key, with <code class='tok'>FULL</code> the whole previous row.",
                "Changes are emitted <strong>at commit, in commit order</strong>; an aborted transaction never appears in the stream."
              ] },
              { t: "code", lang: "sql", code:
                "-- Prepare a table for CDC and inspect the slot's WAL retention\n" +
                "ALTER TABLE orders REPLICA IDENTITY FULL;   -- old row images on update/delete\n" +
                "CREATE PUBLICATION cdc_pub FOR TABLE orders, order_lines;\n\n" +
                "SELECT slot_name, plugin, active, confirmed_flush_lsn,\n" +
                "       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS wal_held\n" +
                "FROM pg_replication_slots;" },
              { t: "p", html: "MySQL's equivalent is the binary log with <code class='tok'>binlog_format = ROW</code> and <code class='tok'>binlog_row_image = FULL</code>. Connectors record their position as a binlog file and offset, or better as a <strong>GTID set</strong>, which still makes sense after failing over to a replica with different file names." },
              { t: "h", text: "How a Debezium-style connector behaves" },
              { t: "ol", items: [
                "<strong>Initial snapshot.</strong> Creates the slot (or records the binlog position) first, then reads existing rows in a consistent snapshot and emits them as read events.",
                "<strong>Streaming.</strong> Switches to the log at exactly the position captured before the snapshot, so nothing falls between the two phases.",
                "<strong>Keys and ordering.</strong> Each event's message key is the row's primary key, so a partitioned topic keeps all changes to one row in order. There is no ordering across different rows on different partitions.",
                "<strong>Offsets.</strong> The connector stores its last processed log position and resumes from it after a restart. Events since the last stored offset are sent again, so delivery is <strong>at least once</strong>."
              ] },
              { t: "code", lang: "text", code:
                "key:   { \"id\": 4417 }\n" +
                "value: {\n" +
                "  \"op\": \"u\",                       // c = insert, u = update, d = delete, r = snapshot read\n" +
                "  \"before\": { \"id\": 4417, \"status\": \"PAID\" },\n" +
                "  \"after\":  { \"id\": 4417, \"status\": \"SHIPPED\" },\n" +
                "  \"source\": { \"lsn\": 98123776, \"txId\": 77120, \"table\": \"orders\" },\n" +
                "  \"ts_ms\": 1767225600000\n" +
                "}" },
              { t: "note", variant: "tip", html: "Because duplicates happen, make consumers <strong>idempotent</strong>: upsert by primary key, and ignore an event whose source position is not newer than the one already applied for that key." },
              { t: "h", text: "The dual-write problem and the outbox" },
              { t: "p", html: "An application that updates its database and then publishes to a message broker has two independent writes. A crash between them leaves the database changed and no event sent, or an event announcing a change that was rolled back. Retries cannot fix this because neither system knows about the other. The <strong>transactional outbox</strong> removes the second write: insert the event into an <code class='tok'>outbox</code> table in the <em>same</em> transaction as the business change, and let CDC publish outbox rows. Either both commit or neither does." },
              { t: "compare",
                bad: { title: "Dual write from application code", items: ["UPDATE orders, then publish to the broker", "Crash in between leaves the two out of sync", "Publishing before commit can announce a change that later rolls back", "Retry logic grows without ever becoming correct"] },
                good: { title: "Outbox plus CDC", items: ["INSERT INTO outbox in the same transaction as the change", "The connector reads committed outbox rows from the log", "At-least-once delivery, made safe by idempotent consumers", "Delete or partition old outbox rows on a schedule"] } },
              { t: "note", variant: "warn", html: "Operational traps: an abandoned slot pins WAL until the disk fills; Postgres logical decoding does not carry DDL, so schema changes must be coordinated with consumers (a schema registry helps); and without <code class='tok'>REPLICA IDENTITY FULL</code>, unchanged large TOASTed columns can be left out of update events." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Answer to \"keep the search index in sync with Postgres\"", "Why"], rows: [
                ["Naive", "Poll the table every minute for changed rows.", "Misses deletes and intermediate states, and loads the primary"],
                ["Solid", "Log-based CDC with a Debezium connector into Kafka, keyed by primary key, consumers upsert.", "Ordered per key and captures deletes"],
                ["Standout", "Also: snapshot-then-stream handoff, at-least-once with idempotent sinks, outbox for domain events, slot monitoring and a DDL plan.", "Covers correctness and the ways it fails in production"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"keep the cache, search index or warehouse in sync\", \"publish an event when an order changes\", \"we lost events when the service crashed\", \"Debezium\", \"Kafka Connect\". Reach for log-based CDC, and for the outbox when the app needs to emit domain events." },
              { t: "note", variant: "key", html: "<strong>CDC turns the database's own log into an event stream.</strong> It captures deletes and commit order without touching user transactions, delivers at least once (so consumers must be idempotent), and paired with an outbox table it replaces fragile dual writes." }
            ]
          },
          {
            id: "failover",
            title: "Failover: promotion, split brain and the loss window",
            summary: "Detecting a dead leader, promoting the right replica, fencing the old one, and knowing exactly what you can lose.",
            minutes: 11,
            tags: ["replication", "failover", "fencing", "split-brain"],
            blocks: [
              { t: "p", html: "Failover is three decisions made under uncertainty: <strong>is the leader really dead, which replica replaces it, and how do you make sure the old one stops</strong>. Getting the first wrong causes needless outages, the second loses data, and the third corrupts it." },
              { t: "ol", items: [
                "<strong>Detect.</strong> Missed heartbeats for longer than a timeout, ideally confirmed by more than one observer so one partitioned monitor cannot trigger it.",
                "<strong>Choose.</strong> Pick the replica with the most of the leader's history: highest received or replayed LSN in Postgres, the most complete GTID set in MySQL.",
                "<strong>Promote.</strong> Stop replaying and start accepting writes (<code class='tok'>SELECT pg_promote();</code>). Postgres starts a new <strong>timeline</strong> so the fork is recorded.",
                "<strong>Redirect.</strong> Move clients: virtual IP, DNS, a proxy, or service discovery. Other replicas re-point at the new leader.",
                "<strong>Fence.</strong> Make the old leader incapable of accepting writes, even if it wakes up and believes it is still in charge."
              ] },
              { t: "h", text: "Split brain" },
              { t: "p", html: "A leader paused by a long garbage-collection stall, a hung disk, or a network partition looks dead from the outside but is alive inside. If a replica gets promoted while some clients can still reach the old leader, <strong>both accept writes</strong>. You get two histories, duplicate auto-increment ids, and no automatic way to merge them." },
              { t: "compare",
                bad: { title: "Promotion without fencing", items: ["Old leader keeps its address and its connections", "Writes land on both sides of the partition", "Reconciliation is manual, row by row", "Conflicting ids break foreign keys downstream"] },
                good: { title: "Promotion with fencing", items: ["Old leader is powered off or loses its storage or address (STONITH)", "Leader holds a lease and stops writing when it expires", "A fencing token or epoch number rises on each promotion; storage rejects lower ones", "Consensus-based managers (an etcd-backed leader key, for example) let only one holder write"] } },
              { t: "h", text: "The data-loss window" },
              { t: "code", lang: "text", code:
                "async replication, failover to the most caught-up replica\n\n" +
                "commit rate          = 2,000 commits/s\n" +
                "replica lag at crash = 1.5 s\n" +
                "acknowledged but lost ~= 2,000 * 1.5 = ~3,000 commits\n\n" +
                "Clients were told every one of those committed." },
              { t: "table", headers: ["Setup", "RPO (data lost)", "Typical RTO", "Catch"], rows: [
                ["Async, manual failover", "Lag at the moment of failure", "Minutes to hours, waiting on a human", "Humans are slow at 3 a.m."],
                ["Async, automated manager", "Lag at the moment of failure", "Tens of seconds", "Cap allowed lag for promotion, or you promote a stale replica"],
                ["Sync or semi-sync quorum, automated", "Zero for acknowledged commits", "Tens of seconds", "Commit latency on every write"],
                ["Consensus-replicated (Raft groups)", "Zero for committed entries", "About an election timeout, often seconds", "A majority must survive"]
              ] },
              { t: "note", variant: "trap", html: "The detection timeout is a trade, not a constant. Too short and a load spike or a stall triggers <strong>flapping failovers</strong>, each one risking data loss. Too long and a real crash becomes a long outage. Tens of seconds is common for database leaders." },
              { t: "p", html: "When the old leader comes back it has a tail of writes the new timeline never saw. In Postgres, <code class='tok'>pg_rewind</code> rewinds it to the fork point so it can follow the new leader. That tail is thrown away unless someone extracts it first." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Answer to \"how do you handle leader failure?\"", "Gap"], rows: [
                ["Naive", "Promote a replica when the leader goes down.", "Ignores split brain and data loss"],
                ["Solid", "Detect with heartbeats, promote the most caught-up replica, repoint clients, fence the old leader.", "Does not quantify the loss"],
                ["Standout", "Also states the RPO as lag times commit rate, caps promotable lag, uses fencing tokens, and picks sync or consensus where zero loss is a requirement.", "None: risk is explicit and priced"]
              ] },
              { t: "quiz", id: "dist-replication" },
              { t: "note", variant: "key", html: "<strong>Failover is detect, choose, promote, redirect, fence.</strong> Without fencing you risk split brain; with async replication you lose roughly lag times commit rate of acknowledged writes, so say that number out loud." }
            ]
          }
        ]
      },
      {
        id: "partition",
        name: "Partitioning & Quorums",
        icon: "grid",
        lessons: [
          {
            id: "partitioning-sharding",
            title: "Partitioning: range, hash, consistent hashing",
            summary: "How keys are placed, what each scheme costs when nodes join or leave, hot keys, rebalancing and secondary indexes.",
            minutes: 12,
            tags: ["partitioning", "sharding", "consistent-hashing", "rebalancing"],
            blocks: [
              { t: "p", html: "Replication copies the same data to several machines; <strong>partitioning gives each machine a different slice</strong>. Real systems do both: each partition is replicated. The placement function decides three things at once: whether range scans are cheap, whether load is even, and how much data moves when the cluster changes size." },
              { t: "table", headers: ["Scheme", "Placement", "Range scans", "Even load", "Cost of adding a node"], rows: [
                ["Range", "Sorted key ranges with split points", "Cheap, one or few partitions", "Only if keys arrive evenly", "Split one range; moves about half of it"],
                ["Hash mod N", "<code class='tok'>hash(key) % N</code>", "Scatter to every partition", "Good", "Most keys move: about N/(N+1)"],
                ["Consistent hashing", "Key goes to the next token clockwise on a ring", "Scatter to every partition", "Good with many virtual nodes", "Near minimum: about 1/(N+1)"]
              ] },
              { t: "code", lang: "text", code:
                "hash mod N, growing from 4 to 5 nodes\n\n" +
                "key stays only if h % 4 == h % 5\n" +
                "over any 20 consecutive hash values that is h = 0,1,2,3  -> 4 of 20\n" +
                "stay = 20%    move = 80%\n\n" +
                "lower bound for any scheme: the new node must take ~1/5 = 20%" },
              { t: "h", text: "Consistent hashing and virtual nodes" },
              { t: "p", html: "Map both servers and keys onto the same hash ring; a key belongs to the first server token at or after its position. Adding a server only claims the arcs just before its tokens. With one token per server the arcs are wildly uneven, so systems give each server many <strong>virtual nodes</strong>: Cassandra historically defaulted to 256 tokens per node and newer versions default to 16 with a smarter allocator. More tokens means smoother load and rebalancing spread across many peers, at the cost of more metadata and more ranges to repair." },
              { t: "widget", id: "distShard" },
              { t: "h", text: "Hot keys and hot ranges" },
              { t: "p", html: "No placement function fixes a single celebrity key: every read of it hits the same replica set. Range partitioning adds a second failure mode: <strong>monotonic keys</strong> such as timestamps or auto-increment ids send every new insert to the last range. Fixes are prefixing time-ordered keys with a hash or bucket, and <strong>salting</strong> a hot key into several sub-keys that reads must combine." },
              { t: "code", lang: "python", code:
                "import random\n\n" +
                "BUCKETS = 8   # spread one hot counter over 8 partitions\n\n" +
                "def write_like(post_id):\n" +
                "    key = f\"likes:{post_id}:{random.randrange(BUCKETS)}\"\n" +
                "    incr(key)                      # lands on one of 8 partitions\n\n" +
                "def read_likes(post_id):\n" +
                "    return sum(get(f\"likes:{post_id}:{b}\") for b in range(BUCKETS))  # 8 reads" },
              { t: "h", text: "Rebalancing strategies" },
              { t: "table", headers: ["Strategy", "How it works", "Used by", "Trade-off"], rows: [
                ["Fixed many partitions", "Create far more partitions than nodes up front; move whole partitions", "Elasticsearch shards, Couchbase vBuckets", "Partition count is hard to change later"],
                ["Dynamic splitting", "Split a range when it grows past a size threshold; merge small ones", "HBase regions, CockroachDB ranges, TiKV regions", "Fresh tables start as one range until they split"],
                ["Tokens per node", "Each node owns a set number of ring tokens", "Cassandra, ScyllaDB", "Streaming on join and leave touches many peers"]
              ] },
              { t: "h", text: "Secondary indexes across partitions" },
              { t: "compare",
                bad: { title: "Local (document-partitioned) index", items: ["Each partition indexes only its own rows", "Writes stay on one partition: cheap", "Query by indexed column must ask every partition and merge", "Tail latency is the slowest partition"] },
                good: { title: "Global (term-partitioned) index", items: ["Index is partitioned by the indexed value", "Query by indexed column hits one index partition", "One row write may update index partitions on other nodes", "Often maintained asynchronously, so reads can be stale"] } },
              { t: "note", variant: "tip", html: "Say which one you mean. \"Add an index on email\" in a sharded system is either a scatter-gather read path or a distributed write path. There is no third option that is free." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"too much data for one machine\", \"add nodes without downtime\", \"one tenant is huge\", \"look up by a column that is not the shard key\". Choose the partition key from the dominant access pattern, then say what happens to the other patterns." },
              { t: "note", variant: "key", html: "<strong>The partition key is the most consequential choice in a distributed database.</strong> Range keeps scans cheap but invites hot spots; hash spreads load but scatters scans; consistent hashing with virtual nodes moves only the minimum when the cluster changes." }
            ]
          },
          {
            id: "quorums",
            title: "Quorums: N, W, R and leaderless replication",
            summary: "Why R + W > N makes reads find writes, what it does not promise, and how sloppy quorums, hints and read repair fill the gaps.",
            minutes: 11,
            tags: ["quorum", "leaderless", "dynamo", "read-repair"],
            blocks: [
              { t: "p", html: "Leaderless stores in the Dynamo style (Cassandra, ScyllaDB, Riak) drop the single leader. A coordinator sends each write to all <strong>N</strong> replicas of a key and reports success after <strong>W</strong> acknowledge; a read asks <strong>R</strong> replicas and returns the newest version it sees. The mental model is pigeonhole: if the two groups are big enough, they must share a member." },
              { t: "code", lang: "text", code:
                "N = 3 replicas: A B C        W = 2, R = 2\n\n" +
                "write acknowledged by:  A B\n" +
                "read asks (worst case):   B C\n" +
                "                          ^ shared replica B holds the new version\n\n" +
                "rule: R + W > N  =>  every read set intersects every write set" },
              { t: "table", headers: ["N / W / R", "Write survives", "Read survives", "Good for"], rows: [
                ["3 / 2 / 2", "1 replica down", "1 replica down", "Balanced default (QUORUM / QUORUM)"],
                ["3 / 3 / 1", "0 replicas down", "2 replicas down", "Read-heavy, writes can stall"],
                ["3 / 1 / 3", "2 replicas down", "0 replicas down", "Write-heavy ingestion, slow reads"],
                ["5 / 3 / 3", "2 replicas down", "2 replicas down", "Higher fault tolerance, more fan-out"],
                ["3 / 1 / 1", "2 replicas down", "2 replicas down", "Lowest latency; reads may be stale (R + W = 2)"]
              ] },
              { t: "widget", id: "distQuorum" },
              { t: "h", text: "Why R + W > N is not linearizability" },
              { t: "ul", items: [
                "<strong>Failed writes are not rolled back.</strong> A write that reached only one replica reports failure but stays there, and later reads may or may not see it.",
                "<strong>Concurrent writes need a winner.</strong> Last-write-wins by timestamp silently drops one of them, and clock skew decides which.",
                "<strong>A read racing a write</strong> can see the new value on one replica and a later read can miss it, unless reads repair before returning.",
                "<strong>Sloppy quorums</strong> (below) let W be satisfied by nodes outside the key's home replicas, so overlap is no longer guaranteed."
              ] },
              { t: "h", text: "Sloppy quorums and hinted handoff" },
              { t: "p", html: "When home replicas are unreachable, a Dynamo-style system can accept the write on other healthy nodes, each holding a <strong>hint</strong> naming the intended owner, and hand it off when the owner returns. That keeps writes available through failures, but a read quorum taken from home replicas may miss those hinted copies until handoff finishes. Cassandra stores hints for down replicas but only lets them count toward success at consistency level <code class='tok'>ANY</code>." },
              { t: "h", text: "Read repair and anti-entropy" },
              { t: "p", html: "When a read sees divergent versions, the coordinator can write the newest one back to the stale replicas: <strong>read repair</strong>. It only fixes keys that get read. Cold keys are reconciled by background <strong>anti-entropy</strong>, which compares Merkle trees of hashes per token range so only mismatched ranges are streamed." },
              { t: "code", lang: "sql", code:
                "-- cqlsh: consistency is chosen per request, not per table\n" +
                "CONSISTENCY QUORUM;\n" +
                "INSERT INTO users (id, email) VALUES (42, 'ana@shop.example');\n\n" +
                "-- multi-datacentre: majority inside the local DC only\n" +
                "CONSISTENCY LOCAL_QUORUM;\n" +
                "SELECT email FROM users WHERE id = 42;" },
              { t: "note", variant: "warn", html: "Last-write-wins makes clocks part of correctness. If one node's clock runs 200 ms fast, its writes beat genuinely newer writes from other nodes for that long. Use it only where losing a concurrent update is acceptable, or model updates as commutative (counters, sets) instead." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"always writable\", \"multi-datacentre\", \"tunable consistency\", \"no single point of failure\", \"Cassandra\". Reach for N/W/R, then name what happens to concurrent writes and to reads during handoff." },
              { t: "note", variant: "key", html: "<strong>R + W > N makes read and write sets overlap; it does not make the system linearizable.</strong> Partial failures, last-write-wins and sloppy quorums all leak staleness, and read repair plus anti-entropy clean up afterwards." }
            ]
          },
          {
            id: "consistency-models",
            title: "Consistency models, from linearizable to eventual",
            summary: "What each model promises about reads, what it costs, and how not to confuse linearizability with serializability.",
            minutes: 10,
            tags: ["consistency", "linearizability", "causal", "cap"],
            blocks: [
              { t: "p", html: "A consistency model is a <strong>contract about which values a read may return</strong> when writes are happening concurrently on several machines. Stronger contracts make the system feel like one copy; weaker ones let replicas answer without talking to each other. Every step down the ladder buys latency and availability and costs you application logic." },
              { t: "table", headers: ["Model", "Promise", "Cost", "Where you meet it"], rows: [
                ["Linearizable", "Each operation appears to happen at one instant between its start and its reply; real-time order is respected", "Coordination on every operation; the minority side of a partition must refuse", "etcd reads and writes, ZooKeeper writes, Spanner, single-key operations in CockroachDB"],
                ["Sequential", "All clients see one total order that respects each client's own order, but not real time", "Still needs a global order of writes", "ZooKeeper reads served by followers, CPU memory models"],
                ["Causal", "If A could have influenced B, everyone sees A before B; concurrent writes may appear in different orders", "Track dependencies (version vectors, session tokens)", "MongoDB causally consistent sessions, many geo-replicated stores"],
                ["Eventual", "If writes stop, replicas converge", "None at write time; conflict handling later", "Async replicas, DNS, Cassandra at consistency ONE"]
              ] },
              { t: "code", lang: "text", code:
                "A linearizability violation, in real time\n\n" +
                "client 1: write x=2 ----[ack]\n" +
                "client 2:                       read x -> 2\n" +
                "client 3:                              read x -> 1   <-- not allowed\n\n" +
                "client 3 started after client 2 already saw 2.\n" +
                "A single copy could never go back to 1. A lagging replica can." },
              { t: "h", text: "Session guarantees: the cheap middle" },
              { t: "ul", items: [
                "<strong>Read-your-writes:</strong> a client always sees its own earlier writes.",
                "<strong>Monotonic reads:</strong> once a client has seen a value, it never sees an older one.",
                "<strong>Monotonic writes:</strong> a client's writes are applied in the order it issued them.",
                "<strong>Writes-follow-reads:</strong> a write made after reading something is ordered after that thing everywhere."
              ] },
              { t: "p", html: "Together these give each user a causally consistent view without global coordination, which is why they are the usual answer to \"the app is behaving strangely on replicas\"." },
              { t: "h", text: "CAP and PACELC, stated precisely" },
              { t: "p", html: "CAP says that <strong>during a network partition</strong> a replicated system must either refuse some requests (stay consistent, meaning linearizable) or answer them with possibly stale data (stay available). It says nothing about normal operation. PACELC adds that half: <strong>else, when there is no partition, you still trade latency against consistency</strong>, because coordination costs round trips." },
              { t: "note", variant: "trap", html: "<strong>Linearizability is not serializability.</strong> Linearizability is about recency of single objects in real time. Serializability is about multi-object transactions behaving as if run in <em>some</em> serial order, which may not match real time. <strong>Strict serializability</strong> is both, and is what Spanner calls external consistency." },
              { t: "compare",
                bad: { title: "\"We need strong consistency\"", items: ["Undefined: which model, for which operations?", "Usually forces coordination everywhere", "Hides which features actually need it"] },
                good: { title: "\"Balances need linearizable writes; feeds can be causal\"", items: ["Names the model per operation", "Pays coordination only where invariants live", "Explains behaviour during a partition"] } },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "What you say", "Why"], rows: [
                ["Naive", "Strong consistency for everything, or eventual for everything.", "No model per operation, no cost awareness"],
                ["Solid", "Names linearizable, causal and eventual, and explains CAP as a partition-time choice.", "Correct vocabulary, correct scope"],
                ["Standout", "Assigns a model per feature, uses session guarantees for the UX anomalies, and distinguishes linearizable from serializable.", "Spends coordination only where it buys an invariant"]
              ] },
              { t: "quiz", id: "dist-partition" },
              { t: "note", variant: "key", html: "<strong>Pick a consistency model per operation, not per system.</strong> Linearizable where an invariant needs recency, causal or session guarantees for user-facing sanity, eventual where convergence is enough, and never confuse linearizable with serializable." }
            ]
          }
        ]
      },
      {
        id: "consensus",
        name: "Consensus & Distributed Transactions",
        icon: "blocks",
        lessons: [
          {
            id: "raft-basics",
            title: "Raft: terms, elections and the replicated log",
            summary: "How Raft elects one leader per term, replicates a log with a consistency check, and decides when an entry is committed.",
            minutes: 12,
            tags: ["consensus", "raft", "leader-election", "replicated-log"],
            blocks: [
              { t: "p", html: "Consensus gives you a <strong>replicated log</strong>: if every server applies the same commands in the same order, every server ends in the same state. Raft gets there by electing a single leader per <strong>term</strong> that decides the order, and by only calling an entry committed once a majority has stored it. Lose a minority and nothing committed is lost; lose a majority and the cluster stops rather than lying." },
              { t: "stat", items: [
                { v: "3 of 5", k: "majority needed; tolerates 2 failures" },
                { v: "2 of 3", k: "majority needed; tolerates 1 failure" },
                { v: "100 ms / 1 s", k: "etcd default heartbeat and election timeout" }
              ] },
              { t: "table", headers: ["Role", "What it does", "Changes when"], rows: [
                ["Follower", "Passive: appends what the leader sends, answers vote requests", "Election timeout fires with no heartbeat: becomes candidate"],
                ["Candidate", "Increments the term, votes for itself, asks everyone for votes", "Wins a majority: leader. Sees a valid leader or higher term: follower. Times out: new election"],
                ["Leader", "Accepts client commands, appends them, replicates, advances the commit index", "Sees a higher term anywhere: steps down to follower"]
              ] },
              { t: "h", text: "Elections" },
              { t: "ol", items: [
                "Each follower waits a <strong>randomized</strong> election timeout. Randomness makes it likely that one node times out first and wins before others start competing.",
                "The candidate increments its term, votes for itself and sends <code class='tok'>RequestVote(term, lastLogIndex, lastLogTerm)</code>.",
                "A voter grants at most one vote per term, and only if the candidate's log is <strong>at least as up to date</strong>: higher last term wins; same last term, longer log wins.",
                "A majority of votes makes it leader; it immediately sends heartbeats to stop other elections."
              ] },
              { t: "h", text: "Log replication and the log matching property" },
              { t: "code", lang: "text", code:
                "AppendEntries(term, leaderId,\n" +
                "              prevLogIndex, prevLogTerm,   <- consistency check\n" +
                "              entries[], leaderCommit)\n\n" +
                "follower: if my entry at prevLogIndex has term != prevLogTerm -> reject\n" +
                "leader:   on reject, decrement nextIndex for that follower and retry\n" +
                "follower: on conflict at an index, delete that entry and all after it,\n" +
                "          then append the leader's entries\n\n" +
                "Log matching: if two logs share (index, term) for an entry,\n" +
                "they are identical up to and including that entry." },
              { t: "diagram", id: "raft-log", caption: "A leader replicating log entries to followers; entries are committed once a majority holds them." },
              { t: "widget", id: "distRaft" },
              { t: "h", text: "The commit rule" },
              { t: "p", html: "The leader advances <code class='tok'>commitIndex</code> to N once a majority has stored entry N <strong>and entry N is from the leader's current term</strong>. Followers learn the commit index from <code class='tok'>leaderCommit</code> in later messages and apply entries in order. This is why a new leader commits a no-op in its own term right away: it drags any older, possibly committed entries over the line safely." },
              { t: "note", variant: "trap", html: "A new leader must not declare an entry from an <em>older</em> term committed just because a majority now holds it. A different leader could still overwrite it in a later term. Counting replicas is only safe for entries from the current term; older entries become committed indirectly behind them." },
              { t: "h", text: "Reads are not free" },
              { t: "p", html: "A leader that has been partitioned away may not know it was replaced, so answering reads from its local state can return stale data. Linearizable reads either confirm leadership with a round of heartbeats first (<strong>ReadIndex</strong>) or rely on a time-bounded <strong>leader lease</strong>, which trades a clock-drift assumption for one fewer round trip." },
              { t: "table", headers: ["System", "What Raft replicates"], rows: [
                ["etcd", "The key-value store behind Kubernetes control-plane state"],
                ["CockroachDB", "Each range of the key space is its own Raft group"],
                ["TiKV", "Each region of the key space is its own Raft group"],
                ["Kafka (KRaft mode)", "Cluster metadata, replacing the external ZooKeeper ensemble"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"no split brain\", \"leader election\", \"metadata store\", \"zero data loss on node failure\", \"coordination service\". Say: majority quorum, terms, election restriction, commit on majority in the current term." },
              { t: "note", variant: "key", html: "<strong>Raft is one leader per term plus majority commit.</strong> The election restriction guarantees the winner has every committed entry, the consistency check repairs follower logs, and a 2f + 1 cluster survives f failures." }
            ]
          },
          {
            id: "two-phase-commit",
            title: "Two-phase commit and the blocking problem",
            summary: "Atomic commit across partitions: prepare, decide, commit, and why a crashed coordinator leaves participants stuck holding locks.",
            minutes: 10,
            tags: ["transactions", "2pc", "atomic-commit", "xa"],
            blocks: [
              { t: "p", html: "Consensus makes many replicas agree on one log. <strong>Atomic commit</strong> makes several different partitions agree on one decision: every participant commits the transaction, or none does. Two-phase commit (2PC) does it with a coordinator and one rule: once a participant votes yes, it has given up the right to change its mind." },
              { t: "ol", items: [
                "<strong>Prepare.</strong> The coordinator asks every participant to prepare. Each one writes all the transaction's changes and a prepare record to its durable log, keeps its locks, and votes yes, or votes no if anything failed.",
                "<strong>Decide.</strong> If every vote is yes, the coordinator writes <strong>commit</strong> to its own log; any no or timeout means abort. That log write is the commit point.",
                "<strong>Commit.</strong> The coordinator tells each participant the decision; they apply it, release locks, and acknowledge. The coordinator retries until every acknowledgement arrives."
              ] },
              { t: "code", lang: "text", code:
                "coordinator            participant A          participant B\n" +
                "  PREPARE ----------->  force-log PREPARED     force-log PREPARED\n" +
                "  <---------------- YES                YES -----------------\n" +
                "  force-log COMMIT    (commit point: decision is now final)\n" +
                "  COMMIT ------------>  log COMMIT, unlock     log COMMIT, unlock\n" +
                "  <---------------- ACK                ACK -----------------\n\n" +
                "cost: 2 round trips, forced log writes on every node" },
              { t: "h", text: "Where it blocks" },
              { t: "table", headers: ["Coordinator fails", "Participants' state", "What they can do"], rows: [
                ["Before sending prepare", "Nothing prepared", "Abort on timeout: safe"],
                ["After some prepares, before a decision", "Some prepared, some not", "Unprepared ones may abort; prepared ones must wait"],
                ["After logging commit, before telling everyone", "Prepared, in doubt", "Wait: the decision exists only in the coordinator's log"],
                ["After all acknowledgements", "Done", "Nothing; the coordinator can forget the transaction"]
              ] },
              { t: "p", html: "A prepared participant is <strong>in doubt</strong>. It cannot abort alone, because the coordinator may have logged commit and told another participant. It cannot commit alone, because the decision may have been abort. It sits there holding row locks until the coordinator comes back. That is the blocking problem." },
              { t: "code", lang: "sql", code:
                "-- Postgres exposes the participant side (needs max_prepared_transactions > 0)\n" +
                "BEGIN;\n" +
                "UPDATE accounts SET balance = balance - 100 WHERE id = 7;\n" +
                "PREPARE TRANSACTION 'xfer-8812';      -- durable, survives restart\n\n" +
                "-- later, from the coordinator\n" +
                "COMMIT PREPARED 'xfer-8812';          -- or ROLLBACK PREPARED\n\n" +
                "-- find orphans\n" +
                "SELECT gid, prepared, owner FROM pg_prepared_xacts;" },
              { t: "note", variant: "warn", html: "An orphaned prepared transaction keeps its locks <em>and</em> holds back the vacuum horizon, so dead tuples pile up across the whole database. Postgres ships with <code class='tok'>max_prepared_transactions = 0</code> for a reason; if you enable it, alert on old rows in <code class='tok'>pg_prepared_xacts</code>." },
              { t: "h", text: "Taking the coordinator off the critical path" },
              { t: "p", html: "The fix used in practice is not a cleverer protocol (three-phase commit assumes bounded delays real networks do not give you) but <strong>making the coordinator's state highly available</strong>. Spanner runs 2PC where every participant and the coordinator is a Paxos-replicated group. CockroachDB stores each transaction's status in a record that is itself Raft-replicated, so any node can find out the decision." },
              { t: "compare",
                bad: { title: "2PC / XA across services", items: ["True atomicity", "Locks held across network round trips", "Coordinator crash blocks participants", "Every participant must support prepare"] },
                good: { title: "Saga of local transactions", items: ["Each step commits locally and quickly", "Failures run compensating actions", "Intermediate states are visible to others", "Fits independent services and third-party APIs"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"transfer between two shards\", \"update two databases atomically\", \"XA\", \"distributed transaction\". Name 2PC, its commit point and its blocking window, then say whether consensus-replicated coordinators or a saga is the better fit." },
              { t: "note", variant: "key", html: "<strong>2PC is atomic but blocking.</strong> A yes vote is a promise, the coordinator's commit log record is the decision, and if the coordinator vanishes prepared participants wait with locks held, which is why real systems replicate it with consensus." }
            ]
          },
          {
            id: "newsql",
            title: "NewSQL: Spanner's TrueTime and CockroachDB's hybrid clocks",
            summary: "How sharded SQL databases combine per-range consensus, 2PC and a timestamp scheme to give serializable transactions across machines.",
            minutes: 11,
            tags: ["newsql", "spanner", "cockroachdb", "clocks"],
            blocks: [
              { t: "p", html: "NewSQL systems are the previous lessons stacked: <strong>range partitioning</strong> splits the key space, <strong>consensus</strong> replicates each range, <strong>2PC</strong> commits across ranges, and a <strong>timestamp scheme</strong> orders transactions globally so reads can use consistent snapshots without locks. The hard part is the timestamps: machines do not share a clock." },
              { t: "h", text: "Spanner: make clock uncertainty explicit" },
              { t: "p", html: "Spanner's <strong>TrueTime</strong> API does not return a time; it returns an interval <code class='tok'>[earliest, latest]</code> guaranteed to contain true time, backed by GPS and atomic clocks in every data centre. The width (epsilon) is typically a few milliseconds. Spanner turns that bound into ordering with <strong>commit wait</strong>." },
              { t: "code", lang: "text", code:
                "commit wait (leader of the transaction)\n\n" +
                "1. acquire locks, run 2PC across Paxos groups\n" +
                "2. pick commit timestamp  s = TT.now().latest\n" +
                "3. wait until             TT.now().earliest > s   (about 2 * epsilon)\n" +
                "4. release locks, make the write visible, ack the client\n\n" +
                "any transaction that starts after the ack sees TT.now() > s,\n" +
                "so it gets a larger timestamp: timestamp order == real-time order" },
              { t: "stat", items: [
                { v: "a few ms", k: "typical TrueTime uncertainty, paid on each read-write commit" },
                { v: "0 locks", k: "taken by read-only transactions at a snapshot timestamp" },
                { v: "external", k: "consistency: strict serializability across the globe" }
              ] },
              { t: "h", text: "CockroachDB: commodity clocks and uncertainty restarts" },
              { t: "p", html: "CockroachDB splits tables into <strong>ranges</strong> (split automatically as they grow, on the order of hundreds of MiB in recent versions), each replicated by its own Raft group, three replicas by default. One replica holds the <strong>lease</strong> and serves reads and coordinates writes for that range. Transactions are serializable by default." },
              { t: "p", html: "Without atomic clocks it uses <strong>hybrid logical clocks</strong>: physical time plus a logical counter, bumped whenever a node sees a higher timestamp in a message. Nodes are assumed to stay within a <strong>maximum clock offset</strong> (500 ms by default), and a node that finds itself too far out of sync with its peers shuts itself down. A read that finds a value with a timestamp just above its own, but within that offset, cannot tell whether the write really came first, so it <strong>restarts at a higher timestamp</strong>." },
              { t: "table", headers: ["", "Spanner", "CockroachDB"], rows: [
                ["Replication per shard", "Paxos group per split", "Raft group per range"],
                ["Clock", "TrueTime: GPS plus atomic clocks, bounded uncertainty", "Hybrid logical clock on ordinary NTP-synced servers"],
                ["Handling uncertainty", "Commit wait on every read-write transaction", "Uncertainty-interval restarts on reads that hit it"],
                ["Guarantee", "External consistency (strict serializability)", "Serializable; single-key linearizable"],
                ["Cross-shard commit", "2PC over Paxos groups", "Transaction record in a range, parallel commits"]
              ] },
              { t: "h", text: "What it costs you" },
              { t: "ul", items: [
                "Every write pays at least one consensus round trip; with replicas in several regions that is tens of milliseconds or more.",
                "Cross-range transactions add 2PC on top, so schema and key design that keeps related rows in one range pays off directly.",
                "Contention shows up as transaction retries; clients must retry serializable aborts, ideally with backoff.",
                "Sequential primary keys concentrate writes on the last range; hashed or UUID keys spread them."
              ] },
              { t: "note", variant: "tip", html: "Locality controls exist for a reason. Pinning a table's lease or replicas to the region where its users live turns cross-ocean consensus round trips into local ones, at the cost of slower access from elsewhere." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Answer to \"how does it give ACID across machines?\"", "Gap"], rows: [
                ["Naive", "It is distributed SQL, it just scales.", "No mechanism"],
                ["Solid", "Ranges replicated by Raft or Paxos, 2PC across ranges, MVCC timestamps for snapshots.", "Skips how timestamps are ordered"],
                ["Standout", "Also explains TrueTime commit wait versus HLC uncertainty restarts, and the latency and retry costs that follow.", "Sees the clock as the core design choice"]
              ] },
              { t: "quiz", id: "dist-consensus" },
              { t: "note", variant: "key", html: "<strong>NewSQL is ranges plus consensus plus 2PC plus a clock.</strong> Spanner pays a few milliseconds of commit wait to make timestamps match real time; CockroachDB uses hybrid clocks and restarts reads inside the uncertainty window instead." }
            ]
          }
        ]
      },
      {
        id: "time",
        name: "Time, Clocks & Convergence",
        icon: "globe",
        lessons: [
          {
            id: "logical-clocks",
            title: "Logical clocks: Lamport timestamps and vector clocks",
            summary: "Happens-before, why wall clocks cannot define it, Lamport's counter, and how vector clocks detect concurrent writes.",
            minutes: 11,
            tags: ["lamport", "vector-clock", "causality", "happens-before"],
            blocks: [
              { t: "p", html: "On one machine, \"earlier\" is easy: compare timestamps. Across machines, clocks disagree by milliseconds or more, so a write stamped 10:00:00.003 on node A may really have happened after one stamped 10:00:00.005 on node B. Distributed systems therefore reason about <strong>causality</strong> instead of wall time." },
              { t: "h", text: "Happens-before" },
              { t: "p", html: "Event <em>a</em> <strong>happens before</strong> event <em>b</em> (written a \u2192 b) if they occur on the same process in that order, or <em>a</em> sends a message that <em>b</em> receives, or there is a chain of such steps between them. If neither a \u2192 b nor b \u2192 a, the events are <strong>concurrent</strong>: neither could have influenced the other. Concurrency here is about information flow, not about overlapping in real time." },
              { t: "h", text: "Lamport timestamps" },
              { t: "ol", items: [
                "Each process keeps one integer counter.",
                "Before any local event or send, increment it; a sent message carries the counter.",
                "On receive, set the counter to max(local, received) and then increment."
              ] },
              { t: "p", html: "This guarantees: if a \u2192 b then L(a) &lt; L(b). The converse does <strong>not</strong> hold. A smaller Lamport number does not mean the event came first; it may simply be concurrent. Lamport clocks still give a <strong>total order</strong> that every node agrees on (break ties by process id), which is enough for things like ordering requests in a replicated state machine." },
              { t: "h", text: "Vector clocks" },
              { t: "p", html: "A vector clock keeps one counter <em>per process</em>. A process increments its own entry on each event; on receive it takes the element-wise maximum with the incoming vector, then increments its own entry. Comparing two vectors gives the full answer: if every entry of A is \u2264 the matching entry of B (and they differ), A happened before B; if some entries are larger on each side, the events are concurrent." },
              { t: "widget", id: "distClocks" },
              { t: "code", lang: "text", code:
                "compare(A, B):\n" +
                "  A = [2,1,0]  B = [2,3,1]   -> every A[i] <= B[i]       -> A happened before B\n" +
                "  A = [1,0,0]  B = [0,0,1]   -> A bigger in one slot,\n" +
                "                                B bigger in another      -> concurrent\n\n" +
                "Lamport numbers for the same pair may be 1 and 1, or 3 and 2:\n" +
                "they cannot tell 'concurrent' apart from 'ordered'." },
              { t: "h", text: "Where databases use them" },
              { t: "ul", items: [
                "<strong>Version vectors</strong> in Dynamo-style stores (the per-replica form of a vector clock) detect that two writes to the same key were concurrent and keep both as <em>siblings</em> for the application or a merge rule to resolve, instead of silently dropping one.",
                "Last-writer-wins stores skip this and pick the larger timestamp, which is simpler and loses concurrent updates by design.",
                "Lamport-style counters appear as <strong>terms</strong> and <strong>epochs</strong> in Raft and Kafka: a monotonically increasing number that lets nodes reject messages from an older leader."
              ] },
              { t: "table", headers: ["", "Lamport", "Vector clock"], rows: [
                ["Size", "One integer", "One integer per participant"],
                ["a \u2192 b implies", "L(a) &lt; L(b)", "V(a) &lt; V(b)"],
                ["Detects concurrency", "No", "Yes"],
                ["Total order", "Yes, with a tie-breaker", "Only a partial order"],
                ["Main cost", "None to speak of", "Grows with the number of writers; needs pruning"]
              ] },
              { t: "note", variant: "trap", html: "Vector clocks grow with the number of distinct writers. Systems that let every client write keep vectors per <em>replica</em> rather than per client, and may prune old entries, which can occasionally turn a true ordering into a false conflict." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"two users edited the same item offline\", \"which write wins\", \"detect conflicting updates\", \"order events across services\". Ask whether you need a total order (Lamport) or to detect concurrency (vector)." },
              { t: "note", variant: "key", html: "<strong>Causality, not wall time.</strong> Lamport timestamps respect happens-before and give a total order but cannot detect concurrency; vector clocks cost one counter per writer and tell ordered events apart from concurrent ones." }
            ]
          },
          {
            id: "hybrid-clocks",
            title: "Physical time: clock skew, hybrid logical clocks and TrueTime",
            summary: "Why NTP-synced clocks still lie, how last-writer-wins loses data, how HLC combines physical and logical time, and when TrueTime is worth the hardware.",
            minutes: 10,
            tags: ["clocks", "ntp", "hlc", "truetime", "lww"],
            blocks: [
              { t: "p", html: "People want timestamps that look like real time, for TTLs, audit logs, \"as of\" queries and snapshot reads. Server clocks can only approximate that. The design question is <strong>how wrong a clock can be, and what the system does about it</strong>." },
              { t: "h", text: "How physical clocks go wrong" },
              { t: "ul", items: [
                "<strong>Drift:</strong> quartz oscillators run fast or slow by tens of parts per million; 20 ppm is roughly 1.7 seconds per day if never corrected.",
                "<strong>Sync error:</strong> NTP typically keeps servers within a few milliseconds of each other on a good network, much worse across congested or asymmetric links.",
                "<strong>Jumps:</strong> a large correction can step the clock backwards; leap seconds are inserted or smeared differently by different providers.",
                "<strong>Pauses:</strong> a garbage-collection pause or a paused virtual machine means a process can read the clock, stop for seconds, and act on a stale reading."
              ] },
              { t: "note", variant: "warn", html: "Use a <strong>monotonic clock</strong> for measuring durations and timeouts inside a process, and never use wall-clock time to decide ordering across nodes unless the system bounds the error explicitly." },
              { t: "h", text: "Last-writer-wins loses data quietly" },
              { t: "p", html: "If replicas resolve conflicts by keeping the write with the larger wall-clock timestamp, a node whose clock runs 50 ms fast wins every race for that window, even against writes that causally came later. The losing writes are acknowledged and then discarded without an error. LWW is acceptable when concurrent updates to one key are rare or harmless, such as caches and sensor readings, and dangerous for counters, carts and balances." },
              { t: "h", text: "Hybrid logical clocks (HLC)" },
              { t: "p", html: "An HLC timestamp is a pair: <strong>(l, c)</strong>, where <em>l</em> is the largest physical time the node has seen and <em>c</em> is a counter that orders events sharing the same <em>l</em>." },
              { t: "code", lang: "text", code:
                "local event or send:\n" +
                "  l' = max(l, physical_now)\n" +
                "  c  = (l' == l) ? c + 1 : 0\n" +
                "  l  = l'\n\n" +
                "receive message stamped (lm, cm):\n" +
                "  l' = max(l, lm, physical_now)\n" +
                "  c  = if l' == l == lm : max(c, cm) + 1\n" +
                "       elif l' == l     : c + 1\n" +
                "       elif l' == lm    : cm + 1\n" +
                "       else             : 0\n" +
                "  l  = l'" },
              { t: "p", html: "The result never goes backwards, respects happens-before like a Lamport clock, fits in 64 bits, and stays within the clock-sync error of real time, so it can be used for snapshot reads and TTLs. What it cannot do alone is prove that two events on different nodes, close together in time, happened in a particular order. CockroachDB and YugabyteDB handle that with a <strong>maximum clock offset</strong> and uncertainty restarts, as the NewSQL lesson showed." },
              { t: "h", text: "TrueTime" },
              { t: "p", html: "Google's TrueTime uses GPS receivers and atomic clocks in every datacentre to return an <em>interval</em> [earliest, latest] guaranteed to contain true time, usually a few milliseconds wide. Spanner waits out that width before acknowledging a commit, which makes timestamp order equal real-time order everywhere. The price is specialised hardware and a few milliseconds of latency on every read-write transaction. Cloud providers now expose precise time services too, which narrows the gap for everyone else." },
              { t: "table", headers: ["Clock", "Captures causality", "Close to real time", "Bounded error", "Typical use"], rows: [
                ["Wall clock (NTP)", "No", "Yes", "No hard bound", "Logs, TTLs, human display"],
                ["Lamport", "Yes (one direction)", "No", "n/a", "Total ordering, terms and epochs"],
                ["Vector clock", "Yes, detects concurrency", "No", "n/a", "Conflict detection, siblings"],
                ["HLC", "Yes (one direction)", "Yes, within skew", "Assumed maximum offset", "CockroachDB, YugabyteDB, MongoDB cluster time"],
                ["TrueTime", "Via commit wait", "Yes", "Yes, measured interval", "Spanner external consistency"]
              ] },
              { t: "note", variant: "trap", html: "Leases based on wall time are only safe if clock error is bounded. A paused leader can wake up believing its lease is still valid. Protect writes to shared resources with a <strong>fencing token</strong> (a number that increases with every new lease) that the storage layer checks, rather than trusting the holder's clock." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"timestamps from different servers\", \"last write wins\", \"snapshot as of time T\", \"lease expired but the old leader still wrote\", \"why does Spanner need atomic clocks\". Say how large the clock error can be and what bounds it." },
              { t: "note", variant: "key", html: "<strong>Physical clocks drift, jump and pause.</strong> Last-writer-wins on wall time silently drops writes; HLC gives monotonic, causality-respecting timestamps that stay near real time; TrueTime bounds the error with hardware and waits it out; fencing tokens protect leases from paused holders." }
            ]
          },
          {
            id: "crdts",
            title: "CRDTs: merging replicas without coordination",
            summary: "State-based and operation-based CRDTs, counters, registers and sets, where they are used, and what they cannot guarantee.",
            minutes: 9,
            tags: ["crdt", "eventual-consistency", "active-active", "merge"],
            blocks: [
              { t: "p", html: "Multi-leader and offline-first systems accept writes on several replicas at once, then exchange them later. A <strong>conflict-free replicated data type (CRDT)</strong> is a data structure whose merge rule guarantees that replicas which have seen the same set of updates end up in the same state, in any delivery order, with no coordination. That property is called <strong>strong eventual consistency</strong>." },
              { t: "h", text: "Two flavours" },
              { t: "table", headers: ["", "State-based (CvRDT)", "Operation-based (CmRDT)"], rows: [
                ["Replicas exchange", "Their whole state (or deltas of it)", "Each operation"],
                ["Merge must be", "Commutative, associative and idempotent (a semilattice join)", "Commutative for concurrent operations"],
                ["Network needs", "Any delivery: duplicates and reordering are fine", "Exactly-once, causally ordered delivery"],
                ["Cost", "Larger messages", "Smaller messages, stricter transport"]
              ] },
              { t: "h", text: "The classic building blocks" },
              { t: "ul", items: [
                "<strong>G-Counter</strong> (grow-only): one slot per replica; each replica increments its own slot; merge takes the per-slot maximum; the value is the sum.",
                "<strong>PN-Counter:</strong> two G-Counters, one for increments and one for decrements; value = P \u2212 N.",
                "<strong>LWW-Register:</strong> keeps the value with the highest timestamp; simple, and loses concurrent writes by design.",
                "<strong>OR-Set</strong> (observed-remove): each add gets a unique tag; a remove deletes only the tags it has seen, so a concurrent add survives (add-wins).",
                "<strong>Sequence CRDTs</strong> such as RGA give every character a stable position identifier, which is what collaborative text editors build on."
              ] },
              { t: "code", lang: "js", code:
                "// G-Counter: state is { replicaId: count }\n" +
                "function increment(state, me) {\n" +
                "  var next = Object.assign({}, state);\n" +
                "  next[me] = (next[me] || 0) + 1;\n" +
                "  return next;\n" +
                "}\n" +
                "function merge(a, b) {            // commutative, associative, idempotent\n" +
                "  var out = Object.assign({}, a);\n" +
                "  Object.keys(b).forEach(function (k) { out[k] = Math.max(out[k] || 0, b[k]); });\n" +
                "  return out;\n" +
                "}\n" +
                "function value(state) {\n" +
                "  return Object.keys(state).reduce(function (s, k) { return s + state[k]; }, 0);\n" +
                "}" },
              { t: "p", html: "Notice why a plain integer counter fails: if two replicas each turn 5 into 6, merging by max gives 6 and merging by sum double-counts on every re-sync. Keeping a slot per replica makes the merge idempotent, so sending the same state twice is harmless." },
              { t: "h", text: "Where you meet them" },
              { t: "p", html: "Riak shipped counters, sets and maps as data types; Redis Enterprise's active-active databases resolve concurrent writes with CRDT semantics; collaborative editors and local-first libraries such as Automerge and Yjs use sequence and map CRDTs; distributed caches use them for counters and presence." },
              { t: "note", variant: "warn", html: "CRDTs cannot enforce invariants that need agreement. \"Balance never below zero\" or \"username is unique\" require coordination, because two replicas can each approve a withdrawal that is fine locally and wrong together. They also accumulate metadata (tags, tombstones, per-replica slots) that needs garbage collection." },
              { t: "compare",
                bad: { title: "Reach for coordination", items: ["Uniqueness constraints", "Non-negative balances and stock levels", "Anything that must reject a write", "Strictly ordered workflows"] },
                good: { title: "CRDTs fit", items: ["Likes, views and other counters", "Shopping carts and tag sets (add-wins)", "Collaborative documents", "Presence and status that converge eventually"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"active-active across regions\", \"works offline and syncs later\", \"Google Docs-style editing\", \"merge without conflicts\". Offer a CRDT, then check whether any invariant forces coordination." },
              { t: "quiz", id: "dist-time" },
              { t: "note", variant: "key", html: "<strong>A CRDT's merge is commutative, associative and idempotent</strong>, so replicas converge regardless of order or duplicates. Counters, add-wins sets and sequence types cover a lot of ground; invariants like uniqueness or non-negative balances still need coordination." }
            ]
          }
        ]
      }
    ]
  };
})();
