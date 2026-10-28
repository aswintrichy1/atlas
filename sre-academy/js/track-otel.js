/* =====================================================================
   BEACON · Telemetry with OpenTelemetry
   window.TRACKS.otel — modules: signals / pipeline

   Self-contained: this file registers its own widgets (bcTraceWaterfall,
   bcSampling, bcCardinality), its own quizzes (otel-signals,
   otel-pipeline) and its track data.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
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

  function fin(x, fallback) { return (typeof x === "number" && isFinite(x)) ? x : fallback; }

  function commas(n) {
    n = Math.round(fin(n, 0));
    var s = String(Math.abs(n)), out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (n < 0 ? "-" : "") + s + out;
  }

  function big(n) {
    n = fin(n, 0);
    if (n >= 1e12) return n.toExponential(1).replace("e+", " × 10^");
    return commas(n);
  }

  function bytes(b) {
    b = fin(b, 0);
    var u = ["B", "KB", "MB", "GB", "TB", "PB"], i = 0;
    while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
    if (i === u.length - 1 && b >= 1000) return "> 1,000 PB";
    return (b >= 100 ? Math.round(b) : b.toFixed(1)) + " " + u[i];
  }

  function field(label, input, tail) {
    return h("label", { class: "w-field" }, label + " ", input, tail ? " " : null, tail || null);
  }

  /* deterministic 0..1 hash for index i */
  function hash01(i, salt) {
    var x = Math.sin((i + 1) * 12.9898 + (salt || 0) * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  var Widgets = {};

  /* ==================================================================
     1. bcTraceWaterfall — one checkout request across five services
  ================================================================== */
  var SVC_FILL = { gateway: "var(--violet)", checkout: "var(--accent)", auth: "var(--cyan)", cart: "var(--lime)", payment: "var(--amber)", db: "var(--cyan)" };

  function span(id, parent, svc, op, start, end, err) {
    return { id: id, parent: parent, svc: svc, op: op, start: start, end: end, err: !!err };
  }

  var TRACES = {
    healthy: [
      span("s1", null, "gateway", "GET /checkout", 0, 182),
      span("s2", "s1", "checkout", "POST /orders", 6, 176),
      span("s3", "s2", "auth", "verify token", 10, 28),
      span("s4", "s2", "cart", "GET /cart", 30, 62),
      span("s5", "s4", "db", "SELECT cart_items", 34, 56),
      span("s6", "s2", "payment", "charge", 64, 150),
      span("s7", "s2", "db", "INSERT orders", 152, 170)
    ],
    slowdb: [
      span("s1", null, "gateway", "GET /checkout", 0, 566),
      span("s2", "s1", "checkout", "POST /orders", 6, 560),
      span("s3", "s2", "auth", "verify token", 10, 28),
      span("s4", "s2", "cart", "GET /cart", 30, 446),
      span("s5", "s4", "db", "SELECT cart_items", 34, 440),
      span("s6", "s2", "payment", "charge", 448, 534),
      span("s7", "s2", "db", "INSERT orders", 536, 554)
    ],
    retry: [
      span("s1", null, "gateway", "GET /checkout", 0, 612),
      span("s2", "s1", "checkout", "POST /orders", 6, 606),
      span("s3", "s2", "auth", "verify token", 10, 28),
      span("s4", "s2", "cart", "GET /cart", 30, 62),
      span("s5", "s4", "db", "SELECT cart_items", 34, 56),
      span("s6", "s2", "payment", "charge #1 (timeout)", 64, 264, true),
      span("s6b", "s2", "payment", "charge #2 (timeout)", 274, 474, true),
      span("s6c", "s2", "payment", "charge #3", 494, 582),
      span("s7", "s2", "db", "INSERT orders", 584, 600)
    ]
  };

  function childrenOf(spans, id) {
    var out = [];
    for (var i = 0; i < spans.length; i++) if (spans[i].parent === id) out.push(spans[i]);
    return out;
  }

  /* walk backwards from a span's end: the child that finished last before
     the current point is on the critical path, then repeat from its start */
  function critical(spans, sp, acc) {
    acc[sp.id] = true;
    var kids = childrenOf(spans, sp.id), used = {}, t = sp.end;
    for (var guard = 0; guard < 20; guard++) {
      var best = null;
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (used[k.id] || k.end > t + 0.5) continue;
        if (!best || k.end > best.end) best = k;
      }
      if (!best) break;
      used[best.id] = true;
      critical(spans, best, acc);
      t = best.start;
    }
    return acc;
  }

  Widgets.bcTraceWaterfall = function (mount) {
    shell(mount, "trace", "Span waterfall: where did the time go?",
      "One checkout request crosses a gateway, the checkout service, auth, cart, payment and a database. Switch scenarios and read the critical path: the chain of spans that, if any one got faster, would make the whole request faster.");
    var st = { sc: "healthy" };
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    controls.appendChild(segment([["healthy", "Healthy"], ["slowdb", "Slow DB query"], ["retry", "Retry storm"]], 0, function (v) { st.sc = v; paint(); }));

    var W = 600, LABEL = 200, ROW = 24, TOP = 22;

    function depth(spans, sp) {
      var d = 0, cur = sp;
      for (var g = 0; g < 10 && cur && cur.parent; g++) {
        var p = null;
        for (var i = 0; i < spans.length; i++) if (spans[i].id === cur.parent) p = spans[i];
        cur = p; d++;
      }
      return d;
    }

    function paint() {
      var spans = TRACES[st.sc] || TRACES.healthy;
      var root = spans[0];
      var total = Math.max(1, root.end - root.start);
      var crit = critical(spans, root, {});
      var Hh = TOP + spans.length * ROW + 8;
      var plotW = W - LABEL - 50;
      function x(t) { return LABEL + (t - root.start) / total * plotW; }

      clear(stage);
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + Hh, width: "100%", role: "img", "aria-label": "trace waterfall" });
      var ticks = [0, 0.25, 0.5, 0.75, 1];
      for (var t = 0; t < ticks.length; t++) {
        var tx = x(root.start + ticks[t] * total);
        svg.appendChild(sv("line", { x1: tx, y1: TOP - 4, x2: tx, y2: Hh - 4, stroke: "var(--line)" }));
        svg.appendChild(sv("text", { x: Math.min(W - 40, tx + 2), y: 12, "font-size": "10", style: "fill:var(--text-dim)" }, Math.round(ticks[t] * total) + " ms"));
      }
      var maxSelf = null, errs = 0;
      for (var i = 0; i < spans.length; i++) {
        var sp = spans[i], y = TOP + i * ROW;
        var kids = childrenOf(spans, sp.id), kidSum = 0;
        for (var k = 0; k < kids.length; k++) kidSum += kids[k].end - kids[k].start;
        var self = Math.max(0, (sp.end - sp.start) - kidSum);
        if (!maxSelf || self > maxSelf.self) maxSelf = { sp: sp, self: self };
        if (sp.err) errs++;
        var d = depth(spans, sp);
        svg.appendChild(sv("text", { x: 4 + d * 10, y: y + 15, "font-size": "11", style: "fill:var(--text)" }, sp.svc + " · " + sp.op));
        var bx = x(sp.start), bw = Math.max(2, x(sp.end) - bx);
        var attrs = { x: bx.toFixed(1), y: y + 4, width: bw.toFixed(1), height: ROW - 8, rx: 3, fill: sp.err ? "var(--rose)" : (SVC_FILL[sp.svc] || "var(--accent)") };
        if (crit[sp.id]) { attrs.stroke = "var(--text)"; attrs["stroke-width"] = "1.5"; }
        svg.appendChild(sv("rect", attrs));
        svg.appendChild(sv("text", { x: Math.min(W - 44, bx + bw + 4), y: y + 15, "font-size": "10", style: "fill:var(--text-dim)" }, (sp.end - sp.start) + " ms"));
      }
      stage.appendChild(svg);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, "outlined bars are on the critical path · rose bars ended with status ERROR · indentation shows the parent span"));

      var chain = [];
      var mid = childrenOf(spans, "s2");
      mid.sort(function (a, b) { return a.start - b.start; });
      for (var m = 0; m < mid.length; m++) if (crit[mid[m].id]) chain.push(mid[m].svc + (mid[m].err ? " (err)" : ""));

      clear(readout);
      readout.appendChild(ro("total latency", total + " ms"));
      readout.appendChild(ro("critical path", chain.join(" → ") || "root only"));
      readout.appendChild(ro("largest self time", maxSelf ? maxSelf.sp.svc + " " + maxSelf.sp.op + " (" + Math.round(maxSelf.self) + " ms)" : "none"));
      readout.appendChild(ro("spans", spans.length));
      readout.appendChild(ro("error spans", errs));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. bcSampling — head versus tail sampling on a fixed population
  ================================================================== */
  Widgets.bcSampling = function (mount) {
    shell(mount, "simulator", "Head vs tail sampling",
      "A service emits 10,000 traces a minute; a slice of them fail and 2% are slow. Head sampling decides at the root span by coin flip. Tail sampling waits for the whole trace, keeps every error and slow trace, and samples the rest. Compare what you keep and what it costs.");
    var st = { mode: "head", rate: 10, err: 0.01 };
    var N = 10000, SLOW = 0.02, KB = 20, DOTS = 200, WAIT = 10;
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    controls.appendChild(segment([["head", "Head (at root)"], ["tail", "Tail (after trace ends)"]], 0, function (v) { st.mode = v; paint(); }));
    var rateLbl = h("b", {}, st.rate + "%");
    var rateIn = h("input", { type: "range", min: "1", max: "100", step: "1", value: String(st.rate) });
    rateIn.addEventListener("input", function () {
      var v = parseInt(rateIn.value, 10);
      st.rate = isFinite(v) ? Math.max(1, Math.min(100, v)) : 10;
      paint();
    });
    controls.appendChild(field("sample rate", rateIn, rateLbl));
    controls.appendChild(segment([[0.001, "0.1% errors"], [0.01, "1% errors"], [0.05, "5% errors"]], 1, function (v) { st.err = v; paint(); }));

    function paint() {
      rateLbl.textContent = st.rate + "%";
      var r = st.rate / 100;
      var errN = N * st.err, slowN = N * SLOW, restN = Math.max(0, N - errN - slowN);
      var kept, errKept, slowKept;
      if (st.mode === "head") {
        kept = N * r; errKept = errN * r; slowKept = slowN * r;
      } else {
        kept = errN + slowN + restN * r; errKept = errN; slowKept = slowN;
      }
      var storage = kept * KB * 1000 * 43200;
      var buffer = st.mode === "tail" ? (N / 60) * WAIT * KB * 1000 : 0;

      var nErrDots = Math.max(1, Math.round(DOTS * st.err)), nSlowDots = Math.round(DOTS * SLOW);
      var kind = [], i;
      for (i = 0; i < DOTS; i++) kind.push("ok");
      for (i = 0; i < nErrDots; i++) kind[(i * 37 + 5) % DOTS] = "err";
      var placed = 0;
      for (i = 0; placed < nSlowDots && i < DOTS * 2; i++) {
        var idx = (i * 53 + 11) % DOTS;
        if (kind[idx] === "ok") { kind[idx] = "slow"; placed++; }
      }

      clear(stage);
      var COLS = 25, CELL = 22, Wd = COLS * CELL, Hd = Math.ceil(DOTS / COLS) * CELL;
      var svg = sv("svg", { viewBox: "0 0 " + Wd + " " + Hd, width: "100%", role: "img", "aria-label": "sampled traces" });
      for (i = 0; i < DOTS; i++) {
        var keep = st.mode === "head" ? hash01(i, 3) < r : (kind[i] !== "ok" || hash01(i, 3) < r);
        var fill = !keep ? "none" : kind[i] === "err" ? "var(--rose)" : kind[i] === "slow" ? "var(--amber)" : "var(--cyan)";
        var stroke = kind[i] === "err" ? "var(--rose)" : kind[i] === "slow" ? "var(--amber)" : "var(--line)";
        svg.appendChild(sv("circle", { cx: (i % COLS) * CELL + CELL / 2, cy: Math.floor(i / COLS) * CELL + CELL / 2, r: 7, fill: fill, stroke: stroke, "stroke-width": "1.5" }));
      }
      stage.appendChild(svg);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, "each dot is a trace · filled = kept, hollow = dropped · rose = error, amber = slow, cyan = normal"));

      clear(readout);
      readout.appendChild(ro("kept traces / min", commas(kept) + " of " + commas(N)));
      readout.appendChild(ro("error traces kept", (errN > 0 ? Math.round(errKept / errN * 100) : 0) + "%"));
      readout.appendChild(ro("slow traces kept", Math.round(slowKept / slowN * 100) + "%"));
      readout.appendChild(ro("storage / 30 days", bytes(storage)));
      readout.appendChild(ro("collector buffer", st.mode === "tail" ? bytes(buffer) + " (" + WAIT + " s decision wait)" : "none, decided at root"));
      readout.appendChild(ro("needs trace-ID routing", st.mode === "tail" ? "yes" : "no"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. bcCardinality — series count is the product of label values
  ================================================================== */
  var LABELS = [
    { k: "method", n: 5, on: true },
    { k: "status_code", n: 12, on: true },
    { k: "route", n: 40, on: true },
    { k: "pod", n: 60, on: false },
    { k: "region", n: 4, on: false },
    { k: "user_agent", n: 2000, on: false },
    { k: "customer_id", n: 50000, on: false },
    { k: "request_id", n: 1000000, on: false }
  ];

  Widgets.bcCardinality = function (mount) {
    shell(mount, "calculator", "Cardinality explosion",
      "Every distinct combination of label values is its own time series. Toggle labels on a request metric and watch the series count multiply. Thresholds are rough guides for a single metric on a typical Prometheus-class backend.");
    var on = {}, type = 1, i;
    for (i = 0; i < LABELS.length; i++) on[LABELS[i].k] = LABELS[i].on;
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var toggles = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var btns = [];

    controls.appendChild(segment([[1, "counter (×1)"], [13, "histogram, 10 buckets (×13)"]], 0, function (v) { type = v; paint(); }));
    for (i = 0; i < LABELS.length; i++) {
      (function (L) {
        var b = h("button", { type: "button", class: "w-btn" }, L.k + " · " + commas(L.n));
        b.addEventListener("click", function () { on[L.k] = !on[L.k]; paint(); });
        btns.push({ b: b, k: L.k });
        toggles.appendChild(b);
      })(LABELS[i]);
    }

    function paint() {
      var series = type, top = null, j;
      for (j = 0; j < btns.length; j++) btns[j].b.className = "w-btn " + (on[btns[j].k] ? "primary" : "ghost");
      for (j = 0; j < LABELS.length; j++) {
        if (!on[LABELS[j].k]) continue;
        series *= LABELS[j].n;
        if (!top || LABELS[j].n > top.n) top = LABELS[j];
      }
      series = fin(series, 1e300);
      var verdict, ink, fill;
      if (series <= 10000) { verdict = "healthy"; ink = "var(--lime-ink)"; fill = "var(--lime)"; }
      else if (series <= 100000) { verdict = "watch it"; ink = "var(--amber-ink)"; fill = "var(--amber)"; }
      else if (series <= 1000000) { verdict = "expensive"; ink = "var(--rose-ink)"; fill = "var(--rose)"; }
      else { verdict = "explosion"; ink = "var(--rose-ink)"; fill = "var(--rose)"; }

      var fix = "none needed";
      if (top && top.n >= 1000) fix = "drop " + top.k + " from the metric; keep it as a span or log attribute";
      else if (series > 100000 && on.pod) fix = "aggregate pod away in a recording rule; alert on the aggregate";
      else if (series > 10000) fix = "bucket status_code into classes (2xx, 4xx, 5xx)";

      clear(stage);
      var Wb = 560, Hb = 54;
      var svg = sv("svg", { viewBox: "0 0 " + Wb + " " + Hb, width: "100%", role: "img", "aria-label": "series count on a log scale" });
      function lx(v) { return Math.max(0, Math.min(1, Math.log(Math.max(1, v)) / Math.LN10 / 8)) * Wb; }
      svg.appendChild(sv("rect", { x: 0, y: 8, width: Wb, height: 18, rx: 6, fill: "var(--surface-solid)", stroke: "var(--line)" }));
      svg.appendChild(sv("rect", { x: 0, y: 8, width: Math.max(4, lx(series)).toFixed(1), height: 18, rx: 6, fill: fill }));
      var marks = [[1e4, "10k"], [1e5, "100k"], [1e6, "1M"], [1e8, "100M"]];
      for (j = 0; j < marks.length; j++) {
        var mx = lx(marks[j][0]);
        svg.appendChild(sv("line", { x1: mx, y1: 4, x2: mx, y2: 30, stroke: "var(--text-dim)", "stroke-dasharray": "3 3" }));
        svg.appendChild(sv("text", { x: Math.min(Wb - 30, mx + 3), y: 44, "font-size": "11", style: "fill:var(--text-dim)" }, marks[j][1]));
      }
      stage.appendChild(svg);
      var active = [];
      for (j = 0; j < LABELS.length; j++) if (on[LABELS[j].k]) active.push(LABELS[j].n);
      stage.appendChild(h("div", { style: "font-size:0.82rem;color:var(--text-dim);font-family:var(--font-mono)" },
        "series = " + (type > 1 ? type + " × " : "") + (active.length ? active.join(" × ") : "1") + " = " + big(series)));
      stage.appendChild(h("div", { style: "font-size:0.85rem;font-weight:600;color:" + ink }, "verdict: " + verdict));

      clear(readout);
      readout.appendChild(ro("active series", big(series)));
      readout.appendChild(ro("verdict", verdict));
      readout.appendChild(ro("rough memory (~4 KB/series)", bytes(series * 4000)));
      readout.appendChild(ro("biggest multiplier", top ? top.k + " (" + commas(top.n) + ")" : "none"));
      readout.appendChild(ro("fix", fix));
    }

    mount.appendChild(controls);
    mount.appendChild(toggles);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "otel-signals": {
      title: "Signals checkpoint",
      sub: "Metrics, logs, traces, instrument types and span anatomy.",
      questions: [
        {
          q: "Users report that one checkout in fifty takes over five seconds. Which signal is best placed to show you which downstream call caused a specific slow checkout?",
          options: ["A request-rate counter", "A CPU gauge on each host", "A distributed trace of that request", "An uptime check on the checkout endpoint"],
          answer: 2,
          explain: "Metrics aggregate away individual requests, so they tell you that latency is bad but not which call inside one request was slow. A trace records every span of that request with timing, so the slow hop is visible directly. Use the metric to notice, and the trace to explain."
        },
        {
          q: "You need to track the number of messages currently waiting in a queue, which rises and falls. Which OpenTelemetry instrument fits?",
          options: ["UpDownCounter or an observable gauge", "Counter", "Histogram", "A span event"],
          answer: 0,
          explain: "A Counter must only increase, so it cannot model a value that goes down. Queue depth is a current level, which is what an UpDownCounter (if you track adds and removes) or an observable gauge (if you read the depth) represents. Histograms describe distributions of measurements, not levels."
        },
        {
          q: "Why do teams record latency as a histogram rather than exporting a pre-computed p99 gauge from each instance?",
          options: ["Gauges cannot hold decimal values", "Histograms use less storage than one gauge", "Gauges are not supported by OpenTelemetry", "Percentiles cannot be averaged across instances, but histogram buckets can be summed and a percentile computed afterwards"],
          answer: 3,
          explain: "The average of ten instances' p99 values is not the fleet p99, and there is no correct way to combine them. Histogram bucket counts add up across instances and time, so you can compute any percentile for any aggregation at query time. That flexibility is worth the extra series."
        },
        {
          q: "What is the most useful field to add to every structured log line emitted while handling a traced request?",
          options: ["The host's uptime", "The active trace_id and span_id", "A random UUID per log line", "The full request body"],
          answer: 1,
          explain: "Carrying the trace and span ids lets you jump from a log line to the exact trace, and from a span to every log it produced. A per-line UUID correlates nothing, and full request bodies risk leaking personal data and secrets while inflating cost."
        },
        {
          q: "A payment call returns HTTP 503 and your client code retries successfully. How should the first attempt's CLIENT span be recorded?",
          options: ["Delete the span so the trace looks clean", "Status Unset, because the overall request succeeded", "Status Error with the response code as an attribute, as its own span alongside the successful retry", "As a log line instead of a span"],
          answer: 2,
          explain: "Each attempt is a real operation and deserves its own span with honest status. Marking the failed attempt as Error with the status code attribute is what lets you see retry storms in a waterfall. Hiding it makes latency look mysterious, because the time spent is still there."
        },
        {
          q: "Which attribute belongs on the Resource rather than on individual spans?",
          options: ["service.name", "http.response.status_code", "db.statement", "The user's cart size"],
          answer: 0,
          explain: "Resource attributes describe the entity producing telemetry, such as the service, its version, the host and the deployment environment, and apply to every signal it emits. Status codes, statements and cart sizes vary per operation, so they are span attributes."
        }
      ]
    },
    "otel-pipeline": {
      title: "Pipeline checkpoint",
      sub: "Propagation, the Collector, sampling and cardinality.",
      questions: [
        {
          q: "A trace breaks into two disconnected pieces at a message queue. What is the most likely cause?",
          options: ["The Collector batch processor is too small", "The producer did not inject trace context into the message headers, or the consumer did not extract it", "The sampling rate is set to 100%", "The queue is too slow"],
          answer: 1,
          explain: "Context only crosses a process boundary if someone writes it into the carrier and the receiver reads it back. HTTP auto-instrumentation usually does this for you, while queue clients often need explicit inject and extract calls. Without it, the consumer starts a fresh trace."
        },
        {
          q: "Which statement about W3C baggage is correct?",
          options: ["It is encrypted end to end by default", "It is only visible to the service that set it", "It replaces the traceparent header", "It travels to every downstream hop, including third parties you call, so it must never carry secrets or personal data"],
          answer: 3,
          explain: "Baggage is plain key-value text in a header, propagated wherever context goes. Anything you put there can reach external services and their logs. Keep it to small, non-sensitive values such as a tenant tier, and copy it into span attributes only deliberately."
        },
        {
          q: "Why run an agent Collector next to each workload and a separate gateway Collector tier?",
          options: ["Agents offload SDK export quickly and add host metadata; the gateway centralises sampling, scrubbing, routing and credentials to backends", "Gateways are required by the OTLP protocol", "Agents store data permanently", "It halves the number of spans"],
          answer: 0,
          explain: "Agents keep export cheap and local for the application and can enrich data with host and pod attributes. A gateway tier is the single place to enforce policy, hold backend credentials and run stateful processing such as tail sampling. The cost is one more tier to scale and monitor."
        },
        {
          q: "You switch from 10% head sampling to tail sampling that keeps all errors and 10% of the rest. What new requirement appears?",
          options: ["The SDK must stop creating spans", "Logs must be disabled", "All spans of a trace must reach the same Collector instance, usually via trace-ID-aware load balancing, and that instance must buffer them until the decision", "Each service must pick its own sampling rate"],
          answer: 2,
          explain: "A tail decision needs the whole trace in one place. That means routing by trace ID to a fixed gateway instance and holding spans in memory for the decision wait. The payoff is keeping every error trace; the cost is memory, an extra hop and a stateful tier."
        },
        {
          q: "A developer adds a customer_id label to the request-latency histogram. What is the main risk?",
          options: ["Queries become case-sensitive", "Series count multiplies by the number of customers, which can exhaust memory and inflate cost on the metrics backend", "Histograms cannot have labels", "The metric name becomes invalid"],
          answer: 1,
          explain: "Every distinct label combination is its own time series, and a histogram already multiplies by its bucket count. Tens of thousands of customers turns a manageable metric into millions of series. Put high-cardinality identifiers on spans or logs, where per-event detail is expected."
        },
        {
          q: "Which Collector processor should run first in a pipeline to protect the process under a traffic spike?",
          options: ["batch", "attributes", "resource", "memory_limiter"],
          answer: 3,
          explain: "The memory limiter refuses data when memory crosses its limit, pushing back to senders instead of letting the Collector run out of memory and crash. Putting it first means data is refused before any other processor allocates for it. Batch usually goes last, just before export."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.otel = {
    id: "otel",
    name: "Telemetry with OpenTelemetry",
    short: "OTEL",
    color: "#a78bfa",
    tagline: "Emit signals you can join, then ship only what you can afford",
    blurb: "Learn the signals that make a system explainable: metrics, structured logs and traces, and the instrument types behind them. Then follow the data out of the process: context propagation across services and queues, the OpenTelemetry Collector as agent and gateway, head and tail sampling, and the cardinality discipline that keeps your metrics bill and your backend alive.",
    modules: [
      {
        id: "signals",
        name: "Signals",
        icon: "share",
        lessons: [
          {
            id: "three-signals",
            title: "Metrics, logs and traces: what each one is for",
            summary: "Three signals answer three different questions; observability comes from joining them, not from collecting more of one.",
            minutes: 8,
            tags: ["observability", "signals", "opentelemetry"],
            blocks: [
              { t: "p", html: "Picture an incident timeline. A <strong>metric</strong> tells you <em>that</em> something changed: error rate jumped at 14:02. A <strong>trace</strong> tells you <em>where</em>: requests that failed all crossed the payment service. A <strong>log</strong> tells you <em>why</em>: the payment client logged a TLS handshake timeout to its card processor. Each signal is cheap at what it does well and expensive at what it does badly." },
              { t: "table", headers: ["Signal", "Unit of data", "Answers", "Cost profile"], rows: [
                ["Metrics", "A number per time series per scrape or export interval", "Is it broken? How much? Since when?", "Cheap per event; cost grows with series count (cardinality)"],
                ["Logs", "A timestamped record of one event, ideally structured", "What exactly happened in this code path?", "Cost grows with volume; easy to overspend on debug noise"],
                ["Traces", "A tree of spans for one request across services", "Where did this request spend its time or fail?", "Cost grows with request volume; controlled by sampling"]
              ] },
              { t: "h", text: "Two newer signals" },
              { t: "ul", items: [
                "<strong>Profiles</strong>: continuous, low-overhead stack sampling that shows which functions burn CPU or allocate memory. OpenTelemetry is adding profiles as a fourth signal so a slow span can link to the code that was hot during it.",
                "<strong>Events</strong>: named, structured occurrences (a deploy, a feature-flag flip, a client crash) modelled as a special kind of log record. They are what you overlay on dashboards to explain a step change."
              ] },
              { t: "h", text: "What OpenTelemetry actually is" },
              { t: "p", html: "OpenTelemetry (OTel) is a vendor-neutral <em>specification</em>, a set of language <em>APIs and SDKs</em>, a wire protocol called <strong>OTLP</strong>, shared naming rules called <strong>semantic conventions</strong>, and the <strong>Collector</strong>. It does not store or display anything. That separation is the point: you instrument once and choose, or change, the backend later." },
              { t: "stat", items: [
                { v: "1", k: "instrumentation API per language" },
                { v: "OTLP", k: "one wire protocol for all signals" },
                { v: "N", k: "backends you can switch between" }
              ] },
              { t: "compare",
                bad: { title: "Three silos", items: ["Metrics, logs and traces from three agents", "No shared service name or ids", "Pivoting means copying timestamps between tabs", "Every backend change means re-instrumenting"] },
                good: { title: "One correlated stream", items: ["One SDK emits all signals with the same Resource", "Logs carry trace_id and span_id", "Metrics link to example traces (exemplars)", "Backends swap behind the Collector"] } },
              { t: "table", headers: ["Tier", "Observability for a new service"], rows: [
                ["Naive", "Turn on debug logging everywhere and grep during incidents"],
                ["Solid", "RED metrics per endpoint, structured logs, auto-instrumented traces, all tagged with service.name and version"],
                ["Standout", "That, plus exemplars from latency histograms to traces, trace ids in every log, and a sampling and retention budget agreed before launch"]
              ] },
              { t: "note", variant: "tip", html: "For how observability fits into the delivery pipeline and security feedback, see <a href='../devsecops-academy/index.html#/prog/feedback/observability'>Forge: Observability</a>. For how it fits into a system design answer, see <a href='../hld-lld-academy/index.html#/hld/reliability/observability'>Blueprint: Observability</a>." },
              { t: "note", variant: "trap", html: "Monitoring and observability are not synonyms. Monitoring checks for failures you predicted; observability lets you ask questions you did not predict. Dashboards alone are monitoring." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we have logs but cannot find the cause', 'which service is slow', 'how would you instrument this'. <strong>Say it out loud:</strong> 'Metrics detect, traces locate, logs explain. I emit all three through one OpenTelemetry SDK with a shared Resource, so I can pivot between them by trace id instead of by timestamp.'" },
              { t: "note", variant: "key", html: "<strong>Metrics detect, traces locate, logs explain.</strong> The value is in the joins: one Resource, shared ids and exemplars turn three signals into one investigation." }
            ]
          },
          {
            id: "metric-types",
            title: "Counters, gauges and histograms",
            summary: "Pick the instrument by the question you will ask later, because the type decides which aggregations are even correct.",
            minutes: 9,
            tags: ["metrics", "histograms", "instruments"],
            blocks: [
              { t: "p", html: "A metric is a stream of numbers with a name and labels (OTel calls them <em>attributes</em>). The <strong>instrument type</strong> tells the backend how those numbers may be combined. Choose wrong and your dashboards will show values that are arithmetically meaningless." },
              { t: "table", headers: ["Instrument", "Value behaves like", "Example", "Correct aggregation"], rows: [
                ["Counter", "Only goes up (resets on restart)", "requests served, bytes sent", "rate or increase over time, then sum"],
                ["UpDownCounter", "Goes up and down by deltas", "active connections, items in a queue", "sum across instances"],
                ["Gauge (observable)", "A sampled current level", "CPU temperature, memory in use, queue depth", "last value, min, max, avg; never rate"],
                ["Histogram", "A distribution of measurements", "request duration, payload size", "sum buckets, then compute quantiles"]
              ] },
              { t: "h", text: "Explicit-bucket histograms" },
              { t: "p", html: "A classic histogram counts observations into fixed buckets. In Prometheus form it becomes one cumulative series per bucket boundary (<code class='tok'>le</code>), plus <code class='tok'>_sum</code> and <code class='tok'>_count</code>. Quantiles are estimated by interpolating inside the bucket where the rank falls, so <strong>accuracy depends on where you put the boundaries</strong>." },
              { t: "code", lang: "text", code:
                "http_server_request_duration_seconds_bucket{le=\"0.1\"}   8120\n" +
                "http_server_request_duration_seconds_bucket{le=\"0.25\"}  9640\n" +
                "http_server_request_duration_seconds_bucket{le=\"0.5\"}   9910\n" +
                "http_server_request_duration_seconds_bucket{le=\"1\"}     9985\n" +
                "http_server_request_duration_seconds_bucket{le=\"+Inf\"} 10000\n" +
                "http_server_request_duration_seconds_sum   1430.2\n" +
                "http_server_request_duration_seconds_count 10000\n\n" +
                "p99 rank = 0.99 * 10000 = 9900  -> falls in the (0.25, 0.5] bucket\n" +
                "estimate = 0.25 + (9900 - 9640) / (9910 - 9640) * 0.25  ~= 0.49 s"
              },
              { t: "h", text: "Exponential histograms" },
              { t: "p", html: "An <strong>exponential histogram</strong> picks bucket boundaries automatically on a base-2 scale, so relative error is bounded everywhere instead of only near the boundaries you guessed. The SDK starts at a fine scale and coarsens it when the range of values would need more than its maximum bucket count (160 by default). Prometheus native histograms follow the same idea." },
              { t: "compare",
                bad: { title: "Explicit buckets", items: ["You must guess boundaries up front", "Good accuracy only near your SLO threshold", "One series per bucket per label set", "Universally supported"] },
                good: { title: "Exponential buckets", items: ["Boundaries chosen automatically", "Bounded relative error across the range", "Compact sparse encoding", "Needs backend support for the type"] } },
              { t: "note", variant: "warn", html: "Do not pre-compute percentiles per instance and average them. The mean of ten p99 values is not the fleet p99. Ship histograms and compute quantiles after aggregating." },
              { t: "note", variant: "tip", html: "Put an explicit bucket boundary exactly at your latency SLO threshold, for example 0.3 s. Then the share of requests under the threshold is an exact bucket ratio, not an interpolation. See <a href='#/slo/sli/percentiles'>Percentiles</a> for why this matters." },
              { t: "table", headers: ["Tier", "Recording request latency"], rows: [
                ["Naive", "A gauge of average latency per instance"],
                ["Solid", "A histogram with buckets that bracket the SLO threshold, aggregated before computing p95 and p99"],
                ["Standout", "An exponential histogram where the backend supports it, exemplars linking slow buckets to traces, and the SLO threshold as an exact boundary on explicit buckets elsewhere"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'what metric type would you use', 'how do you get p99 across the fleet', 'our percentile graph looks wrong'. <strong>Say it out loud:</strong> 'Counters for things that accumulate, gauges for levels, histograms for anything I will want a percentile of, because buckets aggregate and percentiles do not.'" },
              { t: "note", variant: "key", html: "<strong>The type decides the math.</strong> Rate a counter, read a gauge, sum histogram buckets before taking a quantile, and never average percentiles." }
            ]
          },
          {
            id: "structured-logs",
            title: "Structured logs that join to traces",
            summary: "Emit logs as typed key-value records with a trace id, a severity and a stable event name, and stop logging what you will never query.",
            minutes: 8,
            tags: ["logs", "json", "correlation"],
            blocks: [
              { t: "p", html: "A free-text log line is written for a human reading one file. A <strong>structured</strong> log record is written for a machine querying millions of them: fixed field names, typed values, and the ids that connect it to everything else." },
              { t: "compare",
                bad: { title: "Free text", items: ["'Payment failed for order 8812 after 3 tries'", "Parse with a regex that breaks on the next wording change", "No link to the request that caused it", "Severity guessed from the word 'failed'"] },
                good: { title: "Structured", items: ["event=payment.failed, order_id, attempts=3", "Query any field directly", "trace_id and span_id join it to the trace", "severity_number set by the logger"] } },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"timestamp\": \"2026-10-28T13:02:41.318Z\",\n" +
                "  \"severity_text\": \"ERROR\",\n" +
                "  \"event\": \"payment.charge.failed\",\n" +
                "  \"message\": \"card processor timed out\",\n" +
                "  \"service.name\": \"payment-svc\",\n" +
                "  \"service.version\": \"4.12.0\",\n" +
                "  \"deployment.environment\": \"prod\",\n" +
                "  \"trace_id\": \"5c2e9a7f0b1d4e3a8f6c2b9d0e1a7f34\",\n" +
                "  \"span_id\": \"a1b2c3d4e5f60718\",\n" +
                "  \"order_id\": \"ord-8812\",\n" +
                "  \"attempt\": 3,\n" +
                "  \"processor.host\": \"cards.processor.example\",\n" +
                "  \"duration_ms\": 2004\n" +
                "}"
              },
              { t: "h", text: "How the ids get there" },
              { t: "ul", items: [
                "Use a logging bridge or appender for your language's logger. While a span is active, it reads the current context and stamps <code class='tok'>trace_id</code> and <code class='tok'>span_id</code> on every record.",
                "Export logs through the SDK as OTLP, or keep writing JSON to stdout and let the Collector's file or container log receiver parse it. Both preserve the ids.",
                "Set <strong>Resource</strong> attributes (service, version, environment) once; do not repeat them by hand in each call."
              ] },
              { t: "h", text: "What not to log" },
              { t: "table", headers: ["Category", "Why", "Instead"], rows: [
                ["Secrets, tokens, session cookies", "Logs are copied widely and kept for months", "Redact at the logger; scrub again in the Collector"],
                ["Full request or response bodies", "Personal data and huge volume", "Log ids, sizes and a hash if you need to match"],
                ["Per-iteration debug in hot loops", "Can exceed the cost of the service itself", "A counter metric, or sampled debug logs"],
                ["Success lines for every request", "Duplicates what traces and metrics already show", "Keep errors and notable events; sample the rest"]
              ] },
              { t: "note", variant: "warn", html: "Log levels are a cost control, not decoration. Make the production default INFO or WARN, and allow a temporary per-service DEBUG switch with an expiry instead of shipping DEBUG forever." },
              { t: "note", variant: "tip", html: "Security teams consume the same records for detection. Their needs (audit events, actor, outcome, tamper-resistant storage) are covered in <a href='../cyber-academy/index.html#/defense/detect/logging-siem'>Citadel: Logging and SIEM</a>." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'logs are too expensive', 'we cannot find the log for this request', 'grep across services'. <strong>Say it out loud:</strong> 'I log structured events with a stable event name, severity and the active trace id, redact at the source, and sample success noise so the log bill tracks incidents, not traffic.'" },
              { t: "note", variant: "key", html: "<strong>Structure, ids, restraint.</strong> Typed fields make logs queryable, trace ids make them joinable, and logging less on the happy path makes them affordable." }
            ]
          },
          {
            id: "traces-spans",
            title: "Traces and spans",
            summary: "A trace is a tree of timed spans; read it for the critical path, and record each span with honest kind, attributes and status.",
            minutes: 10,
            tags: ["tracing", "spans", "critical-path"],
            blocks: [
              { t: "p", html: "A <strong>trace</strong> is one request's journey, identified by a 16-byte trace id. It is made of <strong>spans</strong>: named, timed operations, each with an 8-byte span id and a pointer to its parent. Lay the spans out on a time axis and you get a <em>waterfall</em> that shows sequence, parallelism and waiting at a glance." },
              { t: "h", text: "Anatomy of a span" },
              { t: "table", headers: ["Field", "Example", "Notes"], rows: [
                ["Name", "POST /orders, SELECT cart_items", "Low cardinality: use the route template, never the raw URL with ids"],
                ["Kind", "SERVER, CLIENT, PRODUCER, CONSUMER, INTERNAL", "Lets backends pair client and server sides and draw service maps"],
                ["Start and end time", "Nanosecond timestamps", "Duration includes time spent in children"],
                ["Attributes", "http.request.method, http.route, db.system", "Follow semantic conventions so tools understand them"],
                ["Events", "exception, retry, cache.miss", "Timestamped points inside the span"],
                ["Links", "Batch job span links to the 50 messages it consumed", "Relate spans that are not parent and child"],
                ["Status", "Unset, Ok, Error", "Set Error on failure; Ok is for explicit overrides"]
              ] },
              { t: "code", lang: "python", code:
                "from opentelemetry import trace\n" +
                "from opentelemetry.trace import Status, StatusCode\n\n" +
                "tracer = trace.get_tracer(\"payment-svc\")\n\n" +
                "def charge(order):\n" +
                "    with tracer.start_as_current_span(\"charge\", kind=trace.SpanKind.CLIENT) as span:\n" +
                "        span.set_attribute(\"payment.method\", order.method)   # low cardinality\n" +
                "        span.set_attribute(\"order.id\", order.id)            # fine on a span, not on a metric\n" +
                "        try:\n" +
                "            return processor.charge(order)\n" +
                "        except TimeoutError as exc:\n" +
                "            span.record_exception(exc)\n" +
                "            span.set_status(Status(StatusCode.ERROR, \"processor timeout\"))\n" +
                "            raise"
              },
              { t: "h", text: "Reading a waterfall" },
              { t: "p", html: "The <strong>critical path</strong> is the chain of spans that determines total latency: shorten anything on it and the request gets faster; shorten anything off it and nothing changes. <strong>Self time</strong> is a span's duration minus its children; a parent with large self time is doing slow work itself, or waiting on something it did not instrument." },
              { t: "widget", id: "bcTraceWaterfall" },
              { t: "ul", items: [
                "<strong>Slow DB query</strong>: the cart span is long, but its self time is tiny; the database child owns the time. Fix the query or the index, not the cart service.",
                "<strong>Retry storm</strong>: two 200 ms timeouts sit on the critical path before the success. The fix is a tighter timeout, a retry budget and backoff, not a faster payment call. See <a href='#/chaos/patterns/timeouts-retries'>Timeouts and retries</a>.",
                "A gap between sibling spans with no child usually means uninstrumented work, such as a lock, a GC pause or a library you did not wrap."
              ] },
              { t: "note", variant: "trap", html: "Do not put raw URLs with ids in span names, such as <code class='tok'>GET /users/88121</code>. Backends group by name, and unique names destroy every latency breakdown. Use the route template and put the id in an attribute." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'the p99 is high but every service says it is fast', 'which hop is slow', 'how do you debug latency across microservices'. <strong>Say it out loud:</strong> 'I pull an exemplar trace from the slow bucket, find the critical path, and look at self time to tell a slow service from one that is waiting on a dependency.'" },
              { t: "quiz", id: "otel-signals" },
              { t: "note", variant: "key", html: "<strong>Follow the critical path, then read self time.</strong> Spans with honest kinds, templated names, semantic attributes and Error status make that reading possible." }
            ]
          }
        ]
      },
      {
        id: "pipeline",
        name: "The Telemetry Pipeline",
        icon: "queue",
        lessons: [
          {
            id: "context-propagation",
            title: "Context propagation: traceparent and baggage",
            summary: "Traces only connect across processes if every hop injects and extracts context, including queues, threads and async callbacks.",
            minutes: 8,
            tags: ["propagation", "w3c", "baggage"],
            blocks: [
              { t: "p", html: "Inside one process, the SDK keeps the active span in a <strong>context</strong> object that follows your code. Between processes, nothing follows automatically: the sender must <em>inject</em> the context into the carrier (HTTP headers, message headers, gRPC metadata) and the receiver must <em>extract</em> it and continue the trace." },
              { t: "h", text: "The traceparent header" },
              { t: "code", lang: "text", code:
                "traceparent: 00-5c2e9a7f0b1d4e3a8f6c2b9d0e1a7f34-a1b2c3d4e5f60718-01\n" +
                "             |  |                                |                |\n" +
                "             |  trace-id (16 bytes, 32 hex)       parent span id   flags\n" +
                "             version                             (8 bytes, 16 hex) 01 = sampled\n\n" +
                "tracestate:  vendorx=opaque-value       # optional vendor-specific data\n" +
                "baggage:     tenant.tier=gold,app.region=eu-west"
              },
              { t: "p", html: "The receiver creates a new span whose parent is the span id from the header, with the same trace id. The <strong>sampled flag</strong> carries the head-sampling decision downstream, so every service keeps or drops the same traces and you do not get fragments." },
              { t: "h", text: "Baggage" },
              { t: "p", html: "<strong>Baggage</strong> is arbitrary key-value context that rides along with the trace, readable by any downstream service. It is useful for routing hints and for tagging telemetry with a value only the edge knows, such as a tenant tier. It is <em>not</em> automatically added to spans; you copy chosen keys into attributes on purpose." },
              { t: "note", variant: "warn", html: "Baggage is plain text that crosses every hop, including calls to third parties. Never put tokens, emails or other personal data in it, and strip inbound baggage at your trust boundary so callers cannot inject values you will trust." },
              { t: "h", text: "Where propagation breaks" },
              { t: "table", headers: ["Boundary", "Why it breaks", "Fix"], rows: [
                ["Message queues", "Client libraries often lack auto-instrumentation for headers", "Inject on publish, extract on consume; use links for batch consumers"],
                ["Thread pools and async callbacks", "Context is thread-local and is not copied to the worker", "Wrap executors or pass context explicitly"],
                ["Proxies and gateways", "Some strip unknown headers", "Allow traceparent, tracestate and baggage through"],
                ["Mixed propagation formats", "Old services speak a legacy header format", "Configure composite propagators during migration"]
              ] },
              { t: "code", lang: "bash", code:
                "# SDK environment configuration (no code change)\n" +
                "export OTEL_SERVICE_NAME=checkout-svc\n" +
                "export OTEL_PROPAGATORS=tracecontext,baggage\n" +
                "export OTEL_EXPORTER_OTLP_ENDPOINT=${OTEL_AGENT_ENDPOINT}   # e.g. the local agent on port 4317\n" +
                "export OTEL_RESOURCE_ATTRIBUTES=deployment.environment=${DEPLOY_ENV},service.version=${APP_VERSION}"
              },
              { t: "table", headers: ["Tier", "Tracing through a queue"], rows: [
                ["Naive", "Producer and consumer traces exist separately; join them by timestamp"],
                ["Solid", "Inject traceparent into message headers; the consumer span is a child of the producer span"],
                ["Standout", "That, plus span links for batch consumers (one span, many parents), and queue wait time recorded as its own attribute"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'traces stop at the queue', 'orphan spans', 'async jobs show up as separate traces'. <strong>Say it out loud:</strong> 'Context crosses a process only if it is injected and extracted. I check each boundary type: HTTP is usually automatic, queues and thread pools usually are not.'" },
              { t: "note", variant: "key", html: "<strong>No inject, no extract, no trace.</strong> W3C traceparent carries ids and the sampling decision; baggage carries extra context and must stay free of secrets." }
            ]
          },
          {
            id: "collector",
            title: "The OpenTelemetry Collector",
            summary: "Receivers, processors and exporters in pipelines, deployed as agents near workloads and as a gateway tier that owns policy.",
            minutes: 10,
            tags: ["collector", "pipeline", "otlp"],
            blocks: [
              { t: "p", html: "The SDK in your process creates telemetry. The <strong>Collector</strong> is a separate binary that receives it, transforms it and sends it on. Putting it in between means the application only ever talks OTLP to something nearby, and every decision about scrubbing, sampling and destinations lives in config you can change without redeploying services." },
              { t: "diagram", id: "otel-pipeline", caption: "SDKs export OTLP to a local agent Collector, which forwards to a gateway tier that samples, scrubs and fans out to metrics, logs and trace backends." },
              { t: "table", headers: ["Component", "Job", "Examples"], rows: [
                ["Receivers", "Accept or pull data in", "otlp, prometheus (scrape), filelog, hostmetrics, kubeletstats"],
                ["Processors", "Transform, filter, enrich, batch", "memory_limiter, batch, resource, attributes, k8sattributes, filter, tail_sampling"],
                ["Exporters", "Send data out", "otlp, otlphttp, prometheusremotewrite, loadbalancing, debug"],
                ["Connectors", "Exporter of one pipeline and receiver of another", "spanmetrics (derive RED metrics from spans), routing"],
                ["Extensions", "Non-data helpers", "health_check, pprof, auth extensions"]
              ] },
              { t: "h", text: "An agent config" },
              { t: "code", lang: "yaml", code:
                "# otel-agent.yaml (runs as a DaemonSet or sidecar next to workloads)\n" +
                "receivers:\n" +
                "  otlp:\n" +
                "    protocols:\n" +
                "      grpc:\n" +
                "        endpoint: ${env:MY_POD_IP}:4317\n" +
                "      http:\n" +
                "        endpoint: ${env:MY_POD_IP}:4318\n" +
                "  hostmetrics:\n" +
                "    collection_interval: 30s\n" +
                "    scrapers: { cpu: {}, memory: {}, filesystem: {} }\n\n" +
                "processors:\n" +
                "  memory_limiter:            # first: refuse data before running out of memory\n" +
                "    check_interval: 1s\n" +
                "    limit_percentage: 80\n" +
                "    spike_limit_percentage: 20\n" +
                "  k8sattributes: {}          # add pod, namespace, node to the Resource\n" +
                "  resource:\n" +
                "    attributes:\n" +
                "      - key: deployment.environment\n" +
                "        value: ${env:DEPLOY_ENV}\n" +
                "        action: upsert\n" +
                "  attributes/scrub:\n" +
                "    actions:\n" +
                "      - key: http.request.header.authorization\n" +
                "        action: delete\n" +
                "  batch:                     # last: fewer, larger export requests\n" +
                "    send_batch_size: 8192\n" +
                "    timeout: 5s\n\n" +
                "exporters:\n" +
                "  otlp/gateway:\n" +
                "    endpoint: otel-gateway.observability.example:4317\n" +
                "    headers:\n" +
                "      x-gateway-auth: ${env:OTEL_GATEWAY_TOKEN}   # injected from the secret store\n\n" +
                "service:\n" +
                "  pipelines:\n" +
                "    traces:\n" +
                "      receivers: [otlp]\n" +
                "      processors: [memory_limiter, k8sattributes, resource, attributes/scrub, batch]\n" +
                "      exporters: [otlp/gateway]\n" +
                "    metrics:\n" +
                "      receivers: [otlp, hostmetrics]\n" +
                "      processors: [memory_limiter, k8sattributes, resource, batch]\n" +
                "      exporters: [otlp/gateway]\n" +
                "    logs:\n" +
                "      receivers: [otlp]\n" +
                "      processors: [memory_limiter, k8sattributes, resource, attributes/scrub, batch]\n" +
                "      exporters: [otlp/gateway]"
              },
              { t: "h", text: "Agent versus gateway" },
              { t: "table", headers: ["Pattern", "Buys you", "Costs you"], rows: [
                ["SDK exports straight to a backend", "Fewest moving parts", "Credentials and backend choice baked into every app; no central scrubbing"],
                ["Agent per node or sidecar", "Fast local export, host and pod enrichment, buffering on backend outages", "One more process per node to run and upgrade"],
                ["Agent plus gateway tier", "One place for sampling, scrubbing, routing and backend credentials", "A stateful tier to scale, load-balance and monitor"]
              ] },
              { t: "note", variant: "warn", html: "Monitor the Collector itself. Watch its own metrics for refused, dropped and failed-to-send data, and queue size. A silent pipeline looks exactly like a healthy, quiet system." },
              { t: "note", variant: "tip", html: "The <code class='tok'>spanmetrics</code> connector derives request rate, error rate and duration histograms from spans before sampling, so your RED dashboards stay accurate even when you keep only a fraction of traces." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'switch vendors', 'redact personal data from telemetry', 'too many agents on each host'. <strong>Say it out loud:</strong> 'Apps speak OTLP to a local agent; a gateway tier owns sampling, scrubbing and backend credentials, so policy and vendor changes are config, not code.'" },
              { t: "note", variant: "key", html: "<strong>Receivers in, processors in order, exporters out.</strong> Memory limiter first, batch last, secrets from env references, and a gateway tier wherever policy must be central." }
            ]
          },
          {
            id: "sampling",
            title: "Head and tail sampling",
            summary: "Decide at the root for cheap, uniform sampling, or after the trace ends to keep what matters, and pay for the buffering.",
            minutes: 9,
            tags: ["sampling", "tracing", "cost"],
            blocks: [
              { t: "p", html: "Keeping every trace at scale is rarely worth it: most successful requests look alike. <strong>Sampling</strong> keeps a representative subset. The design question is <em>when</em> you decide: before you know how the request went, or after." },
              { t: "table", headers: ["", "Head sampling", "Tail sampling"], rows: [
                ["Decided", "At the root span, before any work", "After the trace completes, in a Collector"],
                ["Based on", "Trace id ratio, or simple attributes at start", "Anything: status, latency, attributes, span count"],
                ["Keeps errors", "Only in proportion to the rate", "All of them, if a policy says so"],
                ["Overhead", "Near zero; unsampled spans are not exported", "All spans exported and buffered for the decision wait"],
                ["Infrastructure", "SDK setting", "Gateway tier with trace-ID-aware load balancing"]
              ] },
              { t: "widget", id: "bcSampling" },
              { t: "h", text: "Head sampling in the SDK" },
              { t: "code", lang: "bash", code:
                "# keep 10% of new traces; children follow the parent's decision\n" +
                "export OTEL_TRACES_SAMPLER=parentbased_traceidratio\n" +
                "export OTEL_TRACES_SAMPLER_ARG=0.1"
              },
              { t: "h", text: "Tail sampling in a gateway" },
              { t: "code", lang: "yaml", code:
                "processors:\n" +
                "  tail_sampling:\n" +
                "    decision_wait: 10s        # buffer spans this long before deciding\n" +
                "    num_traces: 100000        # traces held in memory\n" +
                "    policies:\n" +
                "      - name: keep-errors\n" +
                "        type: status_code\n" +
                "        status_code: { status_codes: [ERROR] }\n" +
                "      - name: keep-slow\n" +
                "        type: latency\n" +
                "        latency: { threshold_ms: 1000 }\n" +
                "      - name: baseline\n" +
                "        type: probabilistic\n" +
                "        probabilistic: { sampling_percentage: 5 }"
              },
              { t: "p", html: "Tail sampling needs every span of a trace on the same gateway instance. Put a first Collector layer in front using the <code class='tok'>loadbalancing</code> exporter keyed on trace id, and size the gateway's memory for <em>traces per second × decision wait × trace size</em>." },
              { t: "note", variant: "trap", html: "Sampled traces are not counts. If you keep 5% of traces, a trace-derived error count is 5% of the truth unless the backend re-weights it. Compute rates and SLIs from metrics, or derive metrics from spans before sampling." },
              { t: "table", headers: ["Tier", "Sampling strategy"], rows: [
                ["Naive", "Keep 100% until the bill arrives, then drop to 1% everywhere"],
                ["Solid", "Parent-based head sampling at a rate sized to budget; RED metrics from unsampled data"],
                ["Standout", "Tail sampling that keeps all errors and slow traces plus a small baseline, per-service rates for very hot endpoints, and span-derived metrics computed before the sampler"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'tracing costs too much', 'we never have the trace for the failed request', 'can we trace 100%'. <strong>Say it out loud:</strong> 'Head sampling is cheap and uniform but blind to outcome; tail sampling keeps every error at the cost of a stateful gateway. Either way, I count from metrics, not from sampled traces.'" },
              { t: "note", variant: "key", html: "<strong>Head is cheap and blind; tail is smart and stateful.</strong> Choose by whether you can afford to buffer, and never compute SLIs from sampled traces." }
            ]
          },
          {
            id: "cardinality",
            title: "Cardinality: the metric bill you did not plan",
            summary: "Series count is the product of label values; unbounded labels belong on spans and logs, not on metrics.",
            minutes: 9,
            tags: ["cardinality", "metrics", "cost"],
            blocks: [
              { t: "p", html: "A time series is one metric name plus one exact set of label values. Add a label with 40 values and you have 40 times the series. Labels <strong>multiply</strong>, and the multiplication is what fills memory on the metrics backend and drives most metric bills." },
              { t: "code", lang: "text", code:
                "http_requests_total{method, status_code, route}\n" +
                "  = 5 methods * 12 codes * 40 routes          =     2,400 series\n" +
                "+ pod (60 replicas)                           =   144,000 series\n" +
                "+ customer_id (50,000)                        = 7.2 billion  -> outage of the metrics system\n\n" +
                "as a 10-bucket histogram: multiply by 13 (10 buckets + +Inf + _sum + _count)"
              },
              { t: "widget", id: "bcCardinality" },
              { t: "h", text: "Where the explosions come from" },
              { t: "ul", items: [
                "<strong>Identifiers</strong>: user, customer, order, session, request or trace ids as labels.",
                "<strong>Raw paths</strong>: <code class='tok'>/users/88121</code> instead of the route template <code class='tok'>/users/{id}</code>.",
                "<strong>Free-form text</strong>: error messages, user agents, SQL statements as label values.",
                "<strong>Churn</strong>: pod names in autoscaled or frequently redeployed workloads create new series every rollout, even when the live count stays flat."
              ] },
              { t: "h", text: "Fixes, cheapest first" },
              { t: "table", headers: ["Fix", "Where", "Trade-off"], rows: [
                ["Do not add the label", "Code review and instrumentation guidelines", "You lose per-entity breakdowns on metrics; use traces for them"],
                ["Template or bucket values", "Instrumentation (route templates, status classes)", "Less detail, usually none you needed"],
                ["Drop or rewrite attributes", "Collector attributes or transform processor; metric views in the SDK", "Central control; must be maintained as code changes"],
                ["Aggregate away a label", "Recording rules or Collector aggregation", "Raw series may still be ingested unless dropped earlier"],
                ["Per-tenant series limits", "Metrics backend", "Protects the system but silently drops data when hit"]
              ] },
              { t: "note", variant: "tip", html: "An <strong>exemplar</strong> gives you the per-request detail you were tempted to add as a label. The histogram stays low-cardinality; each bucket carries a sample trace id you can click through to." },
              { t: "note", variant: "warn", html: "Cardinality limits fail quietly. When a backend hits its per-metric or per-tenant cap, new series are dropped, and a dashboard can look normal while the newest pods are missing. Alert on the backend's own rejected-series counters." },
              { t: "table", headers: ["Tier", "Handling a request to add customer_id to a latency metric"], rows: [
                ["Naive", "Add it; the dashboard looks great in staging with five customers"],
                ["Solid", "Refuse it on the metric; put customer_id on spans and logs and query those per customer"],
                ["Standout", "That, plus a bounded customer_tier label for SLOs, exemplars for drill-down, and a cardinality budget per service enforced in the Collector"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'Prometheus is out of memory', 'our metrics bill tripled', 'can we see latency per user'. <strong>Say it out loud:</strong> 'Series are the product of label values, so I keep metric labels bounded, put unbounded ids on traces and logs, and enforce a cardinality budget in the pipeline.'" },
              { t: "quiz", id: "otel-pipeline" },
              { t: "note", variant: "key", html: "<strong>Labels multiply.</strong> Bounded labels on metrics, unbounded ids on spans and logs, exemplars to bridge them, and a budget enforced before data reaches the backend." }
            ]
          }
        ]
      }
    ]
  };
})();
