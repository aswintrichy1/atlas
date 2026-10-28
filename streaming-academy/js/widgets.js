/* =====================================================================
   PULSE · Interactive labs
   Registers: pl-partitions, pl-isr, pl-lag, pl-watermark, pl-checkpoint,
   pl-capacity. Every simulation is deterministic so the same inputs always
   draw the same picture.
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
      el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }

  function sv(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    if (text != null) el.textContent = String(text);
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

  function slider(controls, label, min, max, step, value, fmt, onChange) {
    var out = h("b", {}, fmt(value));
    var rng = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value), "aria-label": label });
    rng.addEventListener("input", function () {
      var v = parseFloat(rng.value);
      if (!isFinite(v)) return;
      v = Math.max(min, Math.min(max, v));
      out.textContent = fmt(v);
      onChange(v);
    });
    controls.appendChild(h("label", { class: "w-field" }, label + " ", rng, " ", out));
    return rng;
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function fmt1(x) { return (Math.round(x * 10) / 10).toString(); }
  function id(x) { return String(x); }

  /* Tinted chip: a 28% wash of the hue over the surface keeps body text
     readable in both themes; the hue itself only colours the border. */
  function chip(text, color, extra) {
    return h("span", {
      style: "display:inline-flex;align-items:center;justify-content:center;min-width:2.6em;padding:3px 7px;border-radius:8px;font-family:var(--font-mono);font-size:0.76rem;" +
        "border:1px solid " + color + ";background:color-mix(in srgb, " + color + " 28%, var(--surface-solid));color:var(--text);" + (extra || "")
    }, text);
  }

  var PALETTE = ["#22d3ee", "#a78bfa", "#f472b6", "#facc15", "#34d399", "#fb923c", "#60a5fa", "#f87171", "#c084fc", "#4ade80", "#e879f9", "#38bdf8"];

  var Widgets = {};

  /* ==================================================================
     1. pl-partitions — consumer-group assignment and rebalance
  ================================================================== */
  function assign(parts, consumers, strategy, prev) {
    var out = new Array(parts);
    var i;
    if (consumers <= 0) { for (i = 0; i < parts; i++) out[i] = -1; return out; }
    if (strategy === "range") {
      var per = Math.floor(parts / consumers), extra = parts % consumers, p = 0;
      for (var c = 0; c < consumers; c++) {
        var n = per + (c < extra ? 1 : 0);
        for (var j = 0; j < n; j++) out[p++] = c;
      }
      return out;
    }
    if (strategy === "roundrobin" || !prev) {
      for (i = 0; i < parts; i++) out[i] = i % consumers;
      return out;
    }
    /* sticky: each consumer gets floor(P/C) or one more; current owners keep
       what fits in their quota, and only the overflow and orphans move. */
    var base = Math.floor(parts / consumers), extra = parts % consumers;
    var held = [];
    for (i = 0; i < consumers; i++) held.push(0);
    for (i = 0; i < parts; i++) if (prev[i] >= 0 && prev[i] < consumers) held[prev[i]]++;
    var order = held.map(function (n, ci) { return ci; }).sort(function (a, b) { return held[b] - held[a] || a - b; });
    var quota = [];
    for (i = 0; i < consumers; i++) quota.push(base);
    for (i = 0; i < extra; i++) quota[order[i]]++;
    var load = [];
    for (i = 0; i < consumers; i++) load.push(0);
    var orphans = [];
    for (i = 0; i < parts; i++) {
      var o = prev[i];
      if (o >= 0 && o < consumers && load[o] < quota[o]) { out[i] = o; load[o]++; }
      else orphans.push(i);
    }
    orphans.forEach(function (pi) {
      for (var k = 0; k < consumers; k++) if (load[k] < quota[k]) { out[pi] = k; load[k]++; return; }
    });
    return out;
  }

  Widgets["pl-partitions"] = function (mount) {
    shell(mount, "simulator", "Consumer group rebalance",
      "Set the partition count, then add or remove consumers. Each partition is owned by exactly one consumer in the group; watch how many move on every change and which consumers sit idle.");
    var st = { parts: 12, consumers: 3, strategy: "sticky", protocol: "cooperative" };
    var prev = assign(st.parts, st.consumers, "roundrobin", null);
    var current = prev.slice();
    var lastMoved = 0, lastEvent = "initial assignment";
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function recompute(eventText) {
      var next = assign(st.parts, st.consumers, st.strategy, current);
      var moved = 0;
      for (var i = 0; i < st.parts; i++) if (next[i] !== current[i]) moved++;
      lastMoved = moved;
      lastEvent = eventText;
      prev = current; current = next;
      paint();
    }

    slider(controls, "partitions", 1, 24, 1, st.parts, id, function (v) {
      st.parts = v; current = assign(st.parts, st.consumers, "roundrobin", null); prev = current.slice();
      lastMoved = 0; lastEvent = "topic recreated with " + v + " partitions"; paint();
    });
    controls.appendChild(segment([["sticky", "sticky"], ["range", "range"], ["roundrobin", "round-robin"]], 0, function (v) { st.strategy = v; recompute("assignor changed to " + v); }));
    controls.appendChild(segment([["cooperative", "cooperative"], ["eager", "eager"]], 0, function (v) { st.protocol = v; paint(); }));
    controls.appendChild(h("button", { type: "button", class: "w-btn", onclick: function () { if (st.consumers < 12) { st.consumers++; recompute("consumer C" + st.consumers + " joined"); } } }, "+ consumer"));
    controls.appendChild(h("button", { type: "button", class: "w-btn", onclick: function () { if (st.consumers > 1) { st.consumers--; recompute("consumer C" + (st.consumers + 1) + " left"); } } }, "\u2212 consumer"));

    function paint() {
      clear(stage);
      var grid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px" });
      for (var i = 0; i < st.parts; i++) {
        var o = current[i];
        var moved = prev[i] !== o && lastMoved > 0;
        grid.appendChild(h("div", { style: "display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;border-radius:8px;border:1px " + (moved ? "dashed var(--rose)" : "solid var(--line)") },
          h("span", { style: "font-size:0.7rem;color:var(--text-dim)" }, "P" + i),
          chip("C" + (o + 1), PALETTE[o % PALETTE.length])));
      }
      stage.appendChild(grid);
      var counts = [];
      for (var c = 0; c < st.consumers; c++) counts.push(0);
      current.forEach(function (o) { if (o >= 0) counts[o]++; });
      var legend = h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;padding-top:10px" });
      counts.forEach(function (n, ci) { legend.appendChild(chip("C" + (ci + 1) + " \u00b7 " + n + "p", PALETTE[ci % PALETTE.length], n === 0 ? "opacity:0.55;border-style:dashed" : "")); });
      stage.appendChild(legend);

      var idle = counts.filter(function (n) { return n === 0; }).length;
      var mx = Math.max.apply(null, counts), mn = Math.min.apply(null, counts);
      clear(readout);
      readout.appendChild(ro("last event", lastEvent));
      readout.appendChild(ro("partitions moved", lastMoved + " / " + st.parts));
      readout.appendChild(ro("partitions paused during rebalance", st.protocol === "eager" ? st.parts + " (eager revokes all)" : lastMoved + " (only movers)"));
      readout.appendChild(ro("idle consumers", idle));
      readout.appendChild(ro("skew (max \u2212 min)", (mx - mn) + " partitions"));
      readout.appendChild(ro("verdict", idle > 0 ? "more consumers than partitions: extras do nothing" : mx - mn > 1 ? "uneven: the heaviest consumer sets group lag" : "balanced"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. pl-isr — replication factor, min.insync.replicas and acks
  ================================================================== */
  Widgets["pl-isr"] = function (mount) {
    shell(mount, "simulator", "Replication, ISR and producer acks",
      "Pick a replication factor, min.insync.replicas and acks, then fail brokers. The readouts say whether writes are accepted and what an acknowledged write would survive.");
    var st = { rf: 3, minIsr: 2, acks: "all", failed: 0, unclean: false };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var minR, failR;

    slider(controls, "replication factor", 1, 5, 1, st.rf, id, function (v) { st.rf = v; if (st.minIsr > v) st.minIsr = v; if (st.failed > v) st.failed = v; minR.max = String(v); failR.max = String(v); paint(); });
    minR = slider(controls, "min.insync.replicas", 1, 5, 1, st.minIsr, id, function (v) { st.minIsr = Math.min(v, st.rf); paint(); });
    failR = slider(controls, "failed brokers", 0, 5, 1, st.failed, id, function (v) { st.failed = Math.min(v, st.rf); paint(); });
    controls.appendChild(segment([["all", "acks=all"], ["1", "acks=1"], ["0", "acks=0"]], 0, function (v) { st.acks = v; paint(); }));
    controls.appendChild(segment([[false, "clean election"], [true, "unclean allowed"]], 0, function (v) { st.unclean = v; paint(); }));

    function paint() {
      var alive = st.rf - st.failed;
      clear(stage);
      var row = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px" });
      for (var i = 0; i < st.rf; i++) {
        var dead = i >= alive;
        var role = dead ? "down" : i === 0 ? "leader" : "follower (ISR)";
        row.appendChild(h("div", { style: "flex:1 1 110px;padding:10px;border-radius:10px;text-align:center;border:1px " + (dead ? "dashed var(--rose)" : "solid var(--line-strong)") + ";background:" + (dead ? "transparent" : "color-mix(in srgb, var(--accent) 14%, var(--surface-solid))") },
          h("div", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text)" }, "broker " + (i + 1)),
          h("div", { style: "font-size:0.74rem;color:" + (dead ? "var(--rose-ink)" : "var(--text-dim)") }, role)));
      }
      stage.appendChild(row);

      var accepted, survives, note;
      if (alive === 0) { accepted = "no \u2014 partition offline"; survives = "\u2014"; note = st.unclean ? "an out-of-sync replica could return, silently dropping acknowledged writes" : "unavailable until an in-sync replica returns"; }
      else if (st.acks === "all") {
        if (alive < st.minIsr) { accepted = "no \u2014 NotEnoughReplicas"; survives = "\u2014"; note = "writes refused to protect durability; reads still work"; }
        else { accepted = "yes"; survives = (alive - 1) + " more broker loss(es)"; note = alive - 1 === 0 ? "acknowledged by one copy only: the next failure loses data" : "acknowledged once every in-sync replica has it"; }
      } else if (st.acks === "1") { accepted = "yes"; survives = "0 guaranteed (leader only at ack time)"; note = "a leader crash before followers fetch loses acknowledged writes"; }
      else { accepted = "yes (fire and forget)"; survives = "none guaranteed"; note = "the producer never learns whether the write landed"; }

      clear(readout);
      readout.appendChild(ro("alive replicas", alive + " / " + st.rf));
      readout.appendChild(ro("writes accepted", accepted));
      readout.appendChild(ro("an acked write survives", survives));
      readout.appendChild(ro("tolerated failures before writes stop (acks=all)", Math.max(0, st.rf - st.minIsr)));
      readout.appendChild(ro("note", note));
      if (st.minIsr === st.rf && st.rf > 1) readout.appendChild(ro("warning", "min ISR = RF: any single broker restart blocks writes"));
      if (st.minIsr === 1 && st.acks === "all") readout.appendChild(ro("warning", "min ISR 1 lets acks=all degrade to one copy"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. pl-lag — consumer lag, spikes and time to drain
  ================================================================== */
  Widgets["pl-lag"] = function (mount) {
    shell(mount, "simulator", "Consumer lag and time to drain",
      "Lag grows whenever producers outrun the group. Set the rates, inject a traffic spike, and see how many consumers you need — and why adding more than the partition count does not help.");
    var st = { produce: 40, perConsumer: 12, consumers: 3, partitions: 6, spike: 3, spikeMin: 10 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    slider(controls, "produce (k msg/s)", 5, 120, 5, st.produce, id, function (v) { st.produce = v; paint(); });
    slider(controls, "per-consumer (k msg/s)", 2, 40, 1, st.perConsumer, id, function (v) { st.perConsumer = v; paint(); });
    slider(controls, "consumers", 1, 16, 1, st.consumers, id, function (v) { st.consumers = v; paint(); });
    slider(controls, "partitions", 1, 16, 1, st.partitions, id, function (v) { st.partitions = v; paint(); });
    slider(controls, "spike \u00d7", 1, 5, 0.5, st.spike, fmt1, function (v) { st.spike = v; paint(); });
    slider(controls, "spike minutes", 0, 30, 1, st.spikeMin, id, function (v) { st.spikeMin = v; paint(); });

    function paint() {
      var effective = Math.min(st.consumers, st.partitions);
      var capacity = effective * st.perConsumer; /* k msg/s */
      var lag = 0, peak = 0, series = [], drainedAt = null, T = 90;
      for (var m = 0; m <= T; m++) {
        var inSpike = m >= 10 && m < 10 + st.spikeMin;
        var rate = st.produce * (inSpike ? st.spike : 1);
        if (m > 0) lag = Math.max(0, lag + (rate - capacity) * 60); /* k msgs per minute step */
        if (lag > peak) peak = lag;
        if (m >= 10 + st.spikeMin && drainedAt === null && lag === 0 && peak > 0) drainedAt = m;
        series.push(lag);
      }
      var W = 560, H = 160, pad = 28, max = Math.max(peak, 1);
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "lag over 90 minutes" });
      svg.appendChild(sv("rect", { x: pad + (10 / T) * (W - pad * 2), y: 26, width: (st.spikeMin / T) * (W - pad * 2), height: H - pad - 26, fill: "var(--rose)", opacity: "0.12" }));
      var d = series.map(function (v, i) { return (i ? "L" : "M") + (pad + (i / T) * (W - pad * 2)).toFixed(1) + " " + (H - pad - (v / max) * (H - pad - 12)).toFixed(1); }).join(" ");
      svg.appendChild(sv("line", { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, stroke: "var(--line-strong)" }));
      svg.appendChild(sv("path", { d: d, fill: "none", stroke: "var(--accent-ink)", "stroke-width": "2.5" }));
      svg.appendChild(sv("text", { x: pad, y: H - 8, fill: "var(--text-dim)", "font-size": "11" }, "0 min"));
      svg.appendChild(sv("text", { x: W - pad - 40, y: H - 8, fill: "var(--text-dim)", "font-size": "11" }, T + " min"));
      svg.appendChild(sv("text", { x: pad + 4, y: 20, fill: "var(--text-dim)", "font-size": "11" }, "peak lag " + Math.round(peak / 1000 * 10) / 10 + " M msgs"));
      clear(stage);
      stage.appendChild(svg);

      var steadyGrowth = st.produce - capacity;
      var needed = Math.ceil(st.produce * st.spike / st.perConsumer);
      clear(readout);
      readout.appendChild(ro("effective consumers", effective + (st.consumers > st.partitions ? " (" + (st.consumers - st.partitions) + " idle)" : "")));
      readout.appendChild(ro("group capacity", capacity + "k msg/s"));
      readout.appendChild(ro("steady state", steadyGrowth > 0 ? "lag grows " + steadyGrowth + "k msg/s forever" : "keeps up with " + (-steadyGrowth) + "k msg/s headroom"));
      readout.appendChild(ro("peak lag", Math.round(peak / 1000 * 10) / 10 + "M msgs"));
      readout.appendChild(ro("peak lag in time", capacity > 0 ? fmt1(peak / capacity / 60) + " min of work" : "\u221e"));
      readout.appendChild(ro("drained by", steadyGrowth >= 0 ? "never" : drainedAt !== null ? "minute " + drainedAt : peak === 0 ? "no backlog" : "after the 90-minute window"));
      readout.appendChild(ro("consumers to absorb spike live", needed + (needed > st.partitions ? " \u2014 needs more partitions too" : "")));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     4. pl-watermark — event time, watermarks, lateness
  ================================================================== */
  /* [eventTime, arrivalTime] in seconds; a fixed, slightly disordered stream */
  var EVENTS = [[1, 2], [3, 4], [2, 6], [6, 7], [8, 9], [5, 11], [11, 12], [13, 13], [9, 15], [16, 17], [14, 18], [19, 20], [12, 22], [22, 23], [24, 25], [21, 27], [27, 28], [18, 30], [29, 31], [31, 32], [26, 34], [34, 35], [36, 37], [33, 39], [38, 40], [17, 44], [41, 45], [44, 46]];

  Widgets["pl-watermark"] = function (mount) {
    shell(mount, "simulator", "Windows, watermarks and late data",
      "Each dot is an event placed by its event time; arrival order is shuffled. The watermark trails the largest event time seen by a fixed delay. A window fires when the watermark passes its end; events that arrive after that are late.");
    var st = { size: 10, delay: 3, lateness: 0 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    slider(controls, "window (s)", 5, 20, 5, st.size, id, function (v) { st.size = v; paint(); });
    slider(controls, "watermark delay (s)", 0, 15, 1, st.delay, id, function (v) { st.delay = v; paint(); });
    slider(controls, "allowed lateness (s)", 0, 15, 1, st.lateness, id, function (v) { st.lateness = v; paint(); });

    function paint() {
      var maxEt = -Infinity, fired = {}, results = {}, dropped = 0, updates = 0, onTime = 0, latencies = [];
      var cls = [];
      EVENTS.forEach(function (ev) {
        var et = ev[0], at = ev[1];
        var w = Math.floor(et / st.size);
        var wEnd = (w + 1) * st.size;
        var wmBefore = maxEt - st.delay;
        var kind;
        if (wmBefore < wEnd) { kind = "on-time"; onTime++; results[w] = (results[w] || 0) + 1; }
        else if (wmBefore < wEnd + st.lateness) { kind = "late-accepted"; updates++; results[w] = (results[w] || 0) + 1; }
        else { kind = "dropped"; dropped++; }
        cls.push(kind);
        if (et > maxEt) maxEt = et;
        var wm = maxEt - st.delay;
        Object.keys(results).forEach(function (k) {
          var end = (Number(k) + 1) * st.size;
          if (!fired[k] && wm >= end) { fired[k] = at; latencies.push(at - end); }
        });
      });
      var W = 560, H = 150, pad = 24, tMax = 48;
      var x = function (t) { return pad + (t / tMax) * (W - pad * 2); };
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "events by event time and arrival time" });
      for (var w = 0; w * st.size < tMax; w++) {
        svg.appendChild(sv("rect", { x: x(w * st.size), y: 10, width: x(st.size) - pad, height: H - 40, fill: w % 2 ? "var(--surface-2)" : "transparent", stroke: "var(--line)" }));
        svg.appendChild(sv("text", { x: x(w * st.size) + 4, y: 22, fill: "var(--text-dim)", "font-size": "10" }, "w" + w));
      }
      var color = { "on-time": "var(--accent-ink)", "late-accepted": "var(--violet-ink)", "dropped": "var(--rose-ink)" };
      EVENTS.forEach(function (ev, i) {
        var y = 30 + (ev[1] / tMax) * (H - 70);
        svg.appendChild(sv("circle", { cx: x(ev[0]), cy: y, r: 5, fill: color[cls[i]], stroke: "var(--surface-solid)" }));
      });
      svg.appendChild(sv("text", { x: pad, y: H - 10, fill: "var(--text-dim)", "font-size": "10" }, "x = event time \u00b7 y = arrival (later is lower)"));
      clear(stage);
      stage.appendChild(svg);
      var legend = h("div", { style: "display:flex;gap:8px;flex-wrap:wrap;padding-top:6px" },
        chip("on time", "var(--accent)"), chip("late, accepted (update)", "var(--violet)"), chip("dropped", "var(--rose)"));
      stage.appendChild(legend);

      var avg = latencies.length ? latencies.reduce(function (a, b) { return a + b; }, 0) / latencies.length : 0;
      clear(readout);
      readout.appendChild(ro("on time", onTime + " / " + EVENTS.length));
      readout.appendChild(ro("late but accepted (result revised)", updates));
      readout.appendChild(ro("dropped", dropped));
      readout.appendChild(ro("avg wait after window end before firing", fmt1(avg) + " s"));
      readout.appendChild(ro("trade-off", st.delay === 0 ? "fastest results, most late data" : dropped === 0 ? "complete results, paid for in latency" : "balanced: some late data dropped"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     5. pl-checkpoint — checkpoints, recovery and failure injection
  ================================================================== */
  Widgets["pl-checkpoint"] = function (mount) {
    shell(mount, "simulator", "Checkpoints, recovery and failure injection",
      "A job reads 1,000 records per second. Pick a checkpoint interval, inject a failure, and choose the sink. Recovery rewinds to the last completed checkpoint and replays; the sink decides whether replay becomes duplicates.");
    var st = { interval: 30, failAt: 95, sink: "2pc", restart: 20, ckptCost: 2 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    slider(controls, "checkpoint interval (s)", 5, 120, 5, st.interval, id, function (v) { st.interval = v; paint(); });
    slider(controls, "failure at (s)", 10, 170, 5, st.failAt, id, function (v) { st.failAt = v; paint(); });
    slider(controls, "restart time (s)", 5, 90, 5, st.restart, id, function (v) { st.restart = v; paint(); });
    controls.appendChild(segment([["alo", "plain sink (at-least-once)"], ["idem", "idempotent upsert"], ["2pc", "transactional (2PC)"]], 2, function (v) { st.sink = v; paint(); }));

    function paint() {
      var rate = 1000;
      var lastCk = Math.floor(st.failAt / st.interval) * st.interval;
      var replaySec = st.failAt - lastCk;
      var replayed = replaySec * rate;
      var catchUpRate = 3000; /* records/s while replaying + catching up */
      var backlog = (replaySec + st.restart) * rate;
      var catchUp = backlog / (catchUpRate - rate);
      var dup, visible;
      if (st.sink === "alo") { dup = replayed; visible = "immediately, duplicates included"; }
      else if (st.sink === "idem") { dup = 0; visible = "immediately; replays overwrite the same keys"; }
      else { dup = 0; visible = "only at checkpoint commit (up to " + st.interval + " s later)"; }

      var W = 560, H = 96, pad = 20, T = 180;
      var x = function (t) { return pad + (t / T) * (W - pad * 2); };
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "checkpoint timeline" });
      svg.appendChild(sv("line", { x1: pad, y1: 50, x2: W - pad, y2: 50, stroke: "var(--line-strong)", "stroke-width": "2" }));
      for (var t = st.interval; t <= T; t += st.interval) {
        var done = t <= st.failAt;
        svg.appendChild(sv("rect", { x: x(t) - 3, y: 38, width: 6, height: 24, rx: 2, fill: done ? "var(--accent-ink)" : "var(--line-strong)" }));
      }
      svg.appendChild(sv("rect", { x: x(lastCk), y: 44, width: Math.max(1, x(st.failAt) - x(lastCk)), height: 12, fill: "var(--violet)", opacity: "0.45" }));
      svg.appendChild(sv("line", { x1: x(st.failAt), y1: 14, x2: x(st.failAt), y2: 82, stroke: "var(--rose-ink)", "stroke-width": "2.5", "stroke-dasharray": "4 3" }));
      svg.appendChild(sv("text", { x: Math.min(x(st.failAt) + 4, W - 70), y: 22, fill: "var(--rose-ink)", "font-size": "11" }, "failure"));
      svg.appendChild(sv("text", { x: pad, y: 90, fill: "var(--text-dim)", "font-size": "10" }, "bars = completed checkpoints \u00b7 shaded = replayed after restore"));
      clear(stage);
      stage.appendChild(svg);

      clear(readout);
      readout.appendChild(ro("restored from checkpoint at", lastCk + " s" + (lastCk === 0 ? " (job start)" : "")));
      readout.appendChild(ro("records replayed", replayed.toLocaleString()));
      readout.appendChild(ro("duplicates visible downstream", dup.toLocaleString()));
      readout.appendChild(ro("output visible", visible));
      readout.appendChild(ro("time to catch up after restart", fmt1(catchUp) + " s"));
      readout.appendChild(ro("checkpoint overhead", fmt1((st.ckptCost / st.interval) * 100) + "% of time (\u2248" + st.ckptCost + " s each)"));
      readout.appendChild(ro("trade-off", st.interval <= 10 ? "fast recovery, heavy checkpoint load" : st.interval >= 90 ? "cheap checkpoints, long replay and stale transactional output" : "balanced"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     6. pl-capacity — partitions, brokers and storage for a topic
  ================================================================== */
  Widgets["pl-capacity"] = function (mount) {
    shell(mount, "calculator", "Topic and cluster sizing",
      "Back-of-envelope sizing for one hot topic. Partition count comes from the larger of produce and consume throughput per partition; storage from rate \u00d7 retention \u00d7 replication. Treat every per-partition figure as a number you must measure on your own hardware.");
    var st = { mbps: 120, retention: 3, rf: 3, perPartProduce: 10, perPartConsume: 20, consumerMbps: 5, brokerDisk: 8, brokerNet: 300, headroom: 40 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var readout = h("div", { class: "w-readout" });
    slider(controls, "ingest MB/s", 5, 1000, 5, st.mbps, id, function (v) { st.mbps = v; paint(); });
    slider(controls, "retention days", 1, 30, 1, st.retention, id, function (v) { st.retention = v; paint(); });
    slider(controls, "replication", 1, 5, 1, st.rf, id, function (v) { st.rf = v; paint(); });
    slider(controls, "per-consumer MB/s", 1, 50, 1, st.consumerMbps, id, function (v) { st.consumerMbps = v; paint(); });
    slider(controls, "broker disk TB", 1, 40, 1, st.brokerDisk, id, function (v) { st.brokerDisk = v; paint(); });
    slider(controls, "headroom %", 0, 100, 10, st.headroom, id, function (v) { st.headroom = v; paint(); });

    function paint() {
      var target = st.mbps * (1 + st.headroom / 100);
      var byProduce = Math.ceil(target / st.perPartProduce);
      var byConsume = Math.ceil(target / st.consumerMbps);
      var parts = Math.max(byProduce, byConsume);
      var storageTB = st.mbps * 86400 * st.retention * st.rf / 1e6;
      var byDisk = Math.ceil(storageTB * (1 + st.headroom / 100) / st.brokerDisk);
      var netPerBroker = st.mbps * (st.rf + 1); /* produce-in + replication-out + one consumer group out, cluster-wide */
      var byNet = Math.ceil(netPerBroker * (1 + st.headroom / 100) / st.brokerNet);
      var brokers = Math.max(st.rf, byDisk, byNet);
      clear(readout);
      readout.appendChild(ro("partitions (produce-bound)", byProduce));
      readout.appendChild(ro("partitions (consumer-bound)", byConsume));
      readout.appendChild(ro("recommended partitions", parts + (parts > 1000 ? " \u2014 consider splitting the topic" : "")));
      readout.appendChild(ro("retained storage incl. replicas", fmt1(storageTB) + " TB"));
      readout.appendChild(ro("brokers for disk", byDisk));
      readout.appendChild(ro("brokers for network", byNet));
      readout.appendChild(ro("brokers (at least RF)", brokers));
      readout.appendChild(ro("binding constraint", brokers === st.rf ? "replication factor" : byDisk >= byNet ? "disk (look at tiered storage)" : "network"));
    }

    mount.appendChild(controls);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);
})();
