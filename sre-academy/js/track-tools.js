/* =====================================================================
   BEACON · Observability Tooling
   window.TRACKS.tools — modules: metrics / logs-traces

   Self-contained: this file registers its own widget (bcPromql), its own
   quizzes (tools-metrics, tools-logs-traces) and its track data.
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

  var Widgets = {};

  /* ==================================================================
     1. bcPromql — query patterns over a fixed synthetic 30-minute series
        one sample per minute; instance "b" restarts at minute 17;
        an incident (extra load, 5xx and slow responses) runs 20..23
  ================================================================== */
  var MIN = 31, RESET_AT = 17, INC_FROM = 20, INC_TO = 23;
  var LE = [0.05, 0.1, 0.25, 0.5, 1, 2.5, Infinity];
  var CDF_OK = [0.45, 0.80, 0.96, 0.993, 0.999, 1, 1];
  var CDF_BAD = [0.15, 0.35, 0.60, 0.80, 0.93, 0.99, 1];

  function incident(t) { return t >= INC_FROM && t <= INC_TO; }

  var DATA = (function () {
    var incA = [], incB = [], incE = [], cntA = [], cntB = [], t;
    for (t = 0; t < MIN; t++) {
      var ra = 10 + 3 * Math.sin(t / 3) + (incident(t) ? 6 : 0);
      var rb = 6 + 2 * Math.cos(t / 4);
      incA.push(ra * 60);
      incB.push(rb * 60);
      incE.push((ra + rb) * 60 * (incident(t) ? 0.065 : 0.005));
      cntA.push(t === 0 ? 50000 : cntA[t - 1] + incA[t]);
      cntB.push(t === 0 ? 20000 : t === RESET_AT ? Math.round(incB[t] * 0.5) : cntB[t - 1] + incB[t]);
    }
    return { incA: incA, incB: incB, incE: incE, cntA: cntA, cntB: cntB };
  })();

  /* reset-aware increase over the last w samples (no extrapolation) */
  function increaseAt(cnt, t, w) {
    var sum = 0;
    for (var i = t - w + 1; i <= t; i++) {
      var d = cnt[i] - cnt[i - 1];
      sum += d >= 0 ? d : cnt[i];
    }
    return sum;
  }

  function windowSum(arr, t, w) {
    var s = 0;
    for (var i = t - w + 1; i <= t; i++) s += arr[i];
    return s;
  }

  function quantileAt(t, w, q) {
    var B = [], j, i;
    for (j = 0; j < LE.length; j++) B.push(0);
    for (i = t - w + 1; i <= t; i++) {
      var cdf = incident(i) ? CDF_BAD : CDF_OK, n = DATA.incA[i] + DATA.incB[i];
      for (j = 0; j < LE.length; j++) B[j] += n * cdf[j];
    }
    var total = B[LE.length - 1];
    if (!(total > 0)) return 0;
    var rank = q * total;
    for (j = 0; j < LE.length; j++) {
      if (B[j] >= rank) {
        if (j === LE.length - 1) return LE[LE.length - 2];
        var lower = j === 0 ? 0 : LE[j - 1], prev = j === 0 ? 0 : B[j - 1];
        var span = B[j] - prev;
        return span > 0 ? lower + (LE[j] - lower) * (rank - prev) / span : LE[j];
      }
    }
    return LE[LE.length - 2];
  }

  var PATTERNS = {
    raw: { label: "raw counter", unit: "count", usesB: true, windowed: false,
      q: function () { return "http_requests_total{job=\"checkout\", instance=\"b\"}"; },
      at: function (t) { return DATA.cntB[t]; } },
    rate: { label: "rate()", unit: "req/s", usesB: true, windowed: true,
      q: function (w) { return "rate(http_requests_total{job=\"checkout\", instance=\"b\"}[" + w + "m])"; },
      at: function (t, w) { return increaseAt(DATA.cntB, t, w) / (w * 60); } },
    increase: { label: "increase()", unit: "requests", usesB: true, windowed: true,
      q: function (w) { return "increase(http_requests_total{job=\"checkout\", instance=\"b\"}[" + w + "m])"; },
      at: function (t, w) { return increaseAt(DATA.cntB, t, w); } },
    sumby: { label: "sum by", unit: "req/s", usesB: true, windowed: true,
      q: function (w) { return "sum by (job) (rate(http_requests_total{job=\"checkout\"}[" + w + "m]))"; },
      at: function (t, w) { return (increaseAt(DATA.cntA, t, w) + increaseAt(DATA.cntB, t, w)) / (w * 60); } },
    p99: { label: "histogram_quantile", unit: "s", usesB: false, windowed: true,
      q: function (w) { return "histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{job=\"checkout\"}[" + w + "m])))"; },
      at: function (t, w) { return quantileAt(t, w, 0.99); } },
    ratio: { label: "error ratio", unit: "ratio", usesB: false, windowed: true,
      q: function (w) { return "sum(rate(http_requests_total{job=\"checkout\", code=~\"5..\"}[" + w + "m]))\n  / sum(rate(http_requests_total{job=\"checkout\"}[" + w + "m]))"; },
      at: function (t, w) {
        var tot = windowSum(DATA.incA, t, w) + windowSum(DATA.incB, t, w);
        return tot > 0 ? windowSum(DATA.incE, t, w) / tot : 0;
      } }
  };

  function fmt(v, unit) {
    v = fin(v, 0);
    if (unit === "req/s") return v.toFixed(2) + " req/s";
    if (unit === "s") return v.toFixed(3) + " s";
    if (unit === "ratio") return (v * 100).toFixed(2) + "%";
    return commas(v);
  }

  Widgets.bcPromql = function (mount) {
    shell(mount, "query lab", "PromQL pattern lab",
      "A fixed 30-minute synthetic dataset for a checkout job with two instances, one sample a minute. Instance b restarts at minute 17, and an incident adds load, 5xx errors and slow responses from minute 20 to 23. Pick a query pattern and a range window and read what Prometheus would return.");
    var st = { p: "rate", w: 5 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var order = ["raw", "rate", "increase", "sumby", "p99", "ratio"], pairs = [];
    for (var i = 0; i < order.length; i++) pairs.push([order[i], PATTERNS[order[i]].label]);
    controls.appendChild(segment(pairs, 1, function (v) { st.p = v; paint(); }));
    controls.appendChild(segment([[2, "[2m]"], [5, "[5m]"], [10, "[10m]"]], 1, function (v) { st.w = v; paint(); }));

    var W = 560, H = 180, PL = 8, PB = 22, PT = 16;

    function paint() {
      var P = PATTERNS[st.p] || PATTERNS.rate;
      var w = st.w, from = P.windowed ? w : 0, pts = [], t, maxV = 0, maxT = from;
      for (t = from; t < MIN; t++) {
        var v = fin(P.at(t, w), 0);
        pts.push([t, v]);
        if (v > maxV) { maxV = v; maxT = t; }
      }
      var top = maxV > 0 ? maxV * 1.12 : 1;
      function x(tt) { return PL + tt / (MIN - 1) * (W - PL * 2); }
      function y(vv) { return PT + (1 - vv / top) * (H - PT - PB); }

      clear(stage);
      stage.appendChild(h("pre", { style: "margin:0 0 8px;white-space:pre-wrap;font-family:var(--font-mono);font-size:0.8rem;color:var(--accent-ink)" }, P.q(w)));
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "query result over 30 minutes" });
      svg.appendChild(sv("rect", { x: x(INC_FROM), y: PT, width: (x(INC_TO) - x(INC_FROM)).toFixed(1), height: H - PT - PB, fill: "var(--rose)", opacity: "0.18" }));
      if (P.usesB) svg.appendChild(sv("line", { x1: x(RESET_AT), y1: PT, x2: x(RESET_AT), y2: H - PB, stroke: "var(--amber)", "stroke-dasharray": "4 3" }));
      svg.appendChild(sv("line", { x1: PL, y1: H - PB, x2: W - PL, y2: H - PB, stroke: "var(--line)" }));
      var d = "";
      for (var k = 0; k < pts.length; k++) d += (k ? " L" : "M") + x(pts[k][0]).toFixed(1) + " " + y(pts[k][1]).toFixed(1);
      if (d) svg.appendChild(sv("path", { d: d, fill: "none", stroke: "var(--accent)", "stroke-width": "2" }));
      for (k = 0; k < pts.length; k++) svg.appendChild(sv("circle", { cx: x(pts[k][0]).toFixed(1), cy: y(pts[k][1]).toFixed(1), r: 2, fill: "var(--accent)" }));
      svg.appendChild(sv("text", { x: PL + 2, y: 12, "font-size": "11", style: "fill:var(--text-dim)" }, "max " + fmt(maxV, P.unit)));
      var xt = [[0, "-30m"], [15, "-15m"], [MIN - 1, "now"]];
      for (k = 0; k < xt.length; k++) svg.appendChild(sv("text", { x: Math.min(W - 28, Math.max(2, x(xt[k][0]) - 10)), y: H - 6, "font-size": "11", style: "fill:var(--text-dim)" }, xt[k][1]));
      stage.appendChild(svg);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" },
        "rose band = incident (minutes 20 to 23)" + (P.usesB ? " · amber dashed line = instance b restart (counter reset)" : "") + (P.windowed ? " · first " + w + " minutes have no full window" : "")));

      var now = pts.length ? pts[pts.length - 1][1] : 0;
      clear(readout);
      readout.appendChild(ro("result now", fmt(now, P.unit)));
      readout.appendChild(ro("peak", fmt(maxV, P.unit) + " at -" + (MIN - 1 - maxT) + "m"));
      readout.appendChild(ro("points", pts.length));
      readout.appendChild(ro("counter reset", P.usesB ? (st.p === "raw" ? "visible as a drop" : "handled by the function") : "not involved"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "tools-metrics": {
      title: "Metrics tooling checkpoint",
      sub: "Prometheus, PromQL, rules and Grafana.",
      questions: [
        {
          q: "What does Prometheus's pull model give you that a push-only model does not, out of the box?",
          options: ["Lower network usage in every case", "Automatic long-term storage", "A built-in health signal: if a scrape fails, the up metric for that target drops to 0", "The ability to store logs"],
          answer: 2,
          explain: "Because Prometheus initiates each scrape, it knows when a target did not answer and records up == 0 for it. In a push model, silence is ambiguous: the service may be down or just idle. Pull also centralises the target list in service discovery rather than in every client."
        },
        {
          q: "A counter is graphed raw and shows a sawtooth that drops to near zero every few hours. What is the right fix?",
          options: ["Wrap it in rate() or increase(), which treat a decrease as a reset and keep counting", "Switch the metric to a gauge", "Delete samples after each drop", "Use avg_over_time() on the raw counter"],
          answer: 0,
          explain: "Counters restart at zero when the process restarts, so the raw value is not meaningful on its own. rate() and increase() detect a decrease, assume a reset and add the new value, giving a continuous rate. Changing the type to a gauge would lose that reset handling."
        },
        {
          q: "Your scrape interval is 30 s. Which range for rate() is a sensible minimum for a dashboard panel?",
          options: ["[30s]", "[45s]", "[1m]", "[2m], about four scrape intervals, so every window holds several samples even if one scrape is missed"],
          answer: 3,
          explain: "rate() needs at least two samples in the window, and real scrapes jitter or fail. A window of roughly four scrape intervals tolerates a missed scrape without gaps. In Grafana, $__rate_interval computes a safe value for you from the scrape interval and the panel step."
        },
        {
          q: "Why is histogram_quantile usually written as histogram_quantile(0.99, sum by (le) (rate(x_bucket[5m])))?",
          options: ["The le label is optional", "Buckets must be rated and summed across instances while keeping le, so the quantile is computed from the combined distribution", "sum by (le) removes the +Inf bucket", "It makes the query return a counter"],
          answer: 1,
          explain: "Bucket counters are cumulative and must be turned into rates first. Summing by le merges the distributions of all instances while preserving the bucket boundaries the function needs. Dropping le, or computing a quantile per instance and averaging, gives a wrong answer."
        },
        {
          q: "When should you create a recording rule?",
          options: ["For every metric, by default", "Only for alerts that page", "Never, because Grafana caches queries", "When an expensive expression is evaluated often by dashboards or alerts, or feeds an SLO calculation"],
          answer: 3,
          explain: "Recording rules precompute an expression on a schedule and store the result as a new, low-cardinality series. They make heavy dashboards fast and keep alert and SLO expressions consistent. Recording everything wastes storage and adds series nobody reads."
        },
        {
          q: "Which dashboard layout best supports on-call triage for a request-driven service?",
          options: ["Top row of rate, errors and duration per service, then saturation of the resources behind it, with drill-down links", "Fifty panels of host metrics in alphabetical order", "One panel per pod", "A single big number showing CPU"],
          answer: 0,
          explain: "Starting from user-facing RED signals tells the responder whether users are hurt and where. Resource saturation below explains why. Variables and links lead into the detail, so the top of the dashboard stays small and readable under pressure."
        }
      ]
    },
    "tools-logs-traces": {
      title: "Logs, traces and platforms checkpoint",
      sub: "Log stores, trace backends, and buy-versus-build decisions.",
      questions: [
        {
          q: "What is the core design difference between Loki and an Elasticsearch or OpenSearch log cluster?",
          options: ["Loki cannot store JSON", "Loki indexes only a small set of labels and scans compressed chunks at query time, while the search engines build a full-text index over the content", "OpenSearch has no query language", "Loki only runs in the cloud"],
          answer: 1,
          explain: "Indexing only labels keeps ingestion and storage cheap, and pushes cost to query time, which suits 'filter by service, then grep'. A full inverted index makes arbitrary text search fast at the price of heavier ingestion and storage. Pick by how you query, not by brand."
        },
        {
          q: "Your team wants to find traces by any attribute, such as all traces where cart.items > 50, using cheap object storage. Which property matters most?",
          options: ["The backend's dashboard colours", "Whether it supports Zipkin's JSON format", "A query language over span attributes that works on columnar data in object storage, rather than only trace-ID lookup", "The number of exporters in the SDK"],
          answer: 2,
          explain: "Object-storage trace backends were originally strongest at fetching a trace by id. Attribute search over object storage needs a columnar format and a query language over spans. Without it you can only reach traces through exemplars or logs that already carry the id."
        },
        {
          q: "Which factor typically drives cost most on a commercial observability platform?",
          options: ["Volume of data ingested and indexed, the number of custom metric series, hosts or containers monitored, and retention", "The number of dashboards", "How many people read the documentation", "The programming language of the services"],
          answer: 0,
          explain: "Pricing models vary, but they meter what you send and keep: gigabytes of logs, indexed spans, custom series, monitored hosts and how long data is retained. Controlling cardinality, sampling and retention is how you control the bill on any platform."
        },
        {
          q: "What is the most effective way to keep the option of switching observability vendors later?",
          options: ["Sign a longer contract", "Use only the vendor's proprietary agent", "Store dashboards as screenshots", "Instrument with OpenTelemetry and route through your own Collector, so changing backends is an exporter change"],
          answer: 3,
          explain: "Lock-in lives mostly in instrumentation. If every service uses vendor-specific SDKs, switching means touching every codebase. With OTel and a Collector you control, the backend is configuration; dashboards and alert rules still need porting, so keep those as code too."
        },
        {
          q: "When is self-hosting an open-source observability stack usually the better choice than buying?",
          options: ["Always, because software is free", "When you have a platform team to operate it, data volumes that make metered pricing painful, or data residency requirements", "When you have one small service", "When nobody wants to be on call for it"],
          answer: 1,
          explain: "Open-source stacks have no licence fee, but storage, scaling, upgrades and on-call for the observability system itself are real costs. They pay off with scale, strong platform skills or strict data constraints. Small teams usually get more value from a managed service."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.tools = {
    id: "tools",
    name: "Observability Tooling",
    short: "TOOL",
    color: "#34d399",
    tagline: "Run the stack, write the queries, choose what to buy",
    blurb: "Get hands-on with the tools that store and query telemetry. Prometheus's pull model, storage and scaling options; PromQL from rate() to histogram_quantile; recording and alerting rules as code; and Grafana dashboards that help on-call instead of overwhelming them. Then compare log stores, trace backends and commercial platforms by how they index, what drives their cost and how to stay portable.",
    modules: [
      {
        id: "metrics",
        name: "Metrics Stack",
        icon: "trend",
        lessons: [
          {
            id: "prometheus",
            title: "Prometheus: pull, store, scale",
            summary: "A pull-based time-series database with service discovery, a local TSDB and clear limits that remote write and long-term stores address.",
            minutes: 10,
            tags: ["prometheus", "tsdb", "scraping"],
            blocks: [
              { t: "p", html: "Prometheus works by <strong>pulling</strong>. It discovers targets, fetches a plain-text page of metrics from each one on a fixed interval, attaches target labels and appends the samples to a local time-series database. Everything else, from alert rules to dashboards, queries that database." },
              { t: "h", text: "The exposition format" },
              { t: "code", lang: "text", code:
                "# HELP http_requests_total Requests served, by route and status code.\n" +
                "# TYPE http_requests_total counter\n" +
                "http_requests_total{method=\"GET\",route=\"/cart\",code=\"200\"} 48213\n" +
                "http_requests_total{method=\"POST\",route=\"/orders\",code=\"500\"} 37\n" +
                "# TYPE process_resident_memory_bytes gauge\n" +
                "process_resident_memory_bytes 2.81e+08"
              },
              { t: "h", text: "A scrape config" },
              { t: "code", lang: "yaml", code:
                "global:\n" +
                "  scrape_interval: 30s\n" +
                "  evaluation_interval: 30s\n" +
                "  external_labels: { cluster: prod-eu-1 }\n\n" +
                "scrape_configs:\n" +
                "  - job_name: checkout\n" +
                "    kubernetes_sd_configs:\n" +
                "      - role: pod\n" +
                "    relabel_configs:\n" +
                "      - source_labels: [__meta_kubernetes_pod_label_app]\n" +
                "        regex: checkout\n" +
                "        action: keep\n" +
                "      - source_labels: [__meta_kubernetes_namespace]\n" +
                "        target_label: namespace\n" +
                "    metric_relabel_configs:          # drop noisy series before storage\n" +
                "      - source_labels: [__name__]\n" +
                "        regex: go_gc_duration_seconds.*\n" +
                "        action: drop\n\n" +
                "remote_write:\n" +
                "  - url: <long-term-store-push-endpoint>      # set per environment\n" +
                "    basic_auth:\n" +
                "      username: prom-prod-eu-1\n" +
                "      password_file: /etc/prometheus/secrets/remote-write   # mounted from the secret store"
              },
              { t: "h", text: "Inside the TSDB" },
              { t: "ul", items: [
                "New samples land in an in-memory <strong>head block</strong>, protected by a write-ahead log so a crash does not lose them.",
                "Every two hours the head is cut into an immutable block on disk; background compaction merges blocks into larger ones.",
                "Retention defaults to 15 days and is set with <code class='tok'>--storage.tsdb.retention.time</code> or a size limit.",
                "Memory scales with the number of <strong>active series</strong>, which is why cardinality, not sample rate, is usually what breaks a server. See <a href='#/otel/pipeline/cardinality'>Cardinality</a>."
              ] },
              { t: "h", text: "Scaling past one server" },
              { t: "table", headers: ["Approach", "What it does", "Trade-off"], rows: [
                ["Functional sharding", "One Prometheus per team, cluster or job set", "Simple; no global view without another layer"],
                ["Federation", "A parent scrapes aggregated series from children", "Fine for a few rolled-up series; not for raw data"],
                ["Remote write to a long-term store", "Stream samples to a horizontally scalable, object-storage-backed system (the Thanos, Mimir and Cortex category)", "Global queries and long retention; another distributed system to run or buy"],
                ["Agent mode", "Prometheus scrapes and forwards only, with no local querying", "Light at the edge; all querying happens centrally"]
              ] },
              { t: "note", variant: "warn", html: "Short-lived batch jobs may finish before a scrape. A push gateway can hold their last values, but it never forgets a job that stopped, and it hides whether the job is alive. Prefer having the job push to the Collector via OTLP, or record a last-success timestamp and alert on its age." },
              { t: "table", headers: ["Tier", "Metrics platform for 40 services"], rows: [
                ["Naive", "One Prometheus with 1-year retention on a big disk, scraping everything"],
                ["Solid", "Prometheus per cluster with 15-day local retention, remote write to a long-term store, relabel rules that drop unused series"],
                ["Standout", "That, plus per-team series budgets, recording rules for SLOs, and the Prometheus servers themselves monitored and alerted on by a separate meta-monitor"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'Prometheus keeps running out of memory', 'we need a year of metrics', 'global view across clusters'. <strong>Say it out loud:</strong> 'Prometheus scales with active series, so I control cardinality first, keep local retention short, and remote write to an object-storage-backed store for global, long-term queries.'" },
              { t: "note", variant: "key", html: "<strong>Pull, store locally, ship long-term elsewhere.</strong> The pull model gives free liveness via up, memory follows active series, and remote write is the scaling escape hatch." }
            ]
          },
          {
            id: "promql",
            title: "PromQL patterns that matter",
            summary: "Six patterns cover most real queries: selectors, rate and increase, aggregation, quantiles, ratios and absence.",
            minutes: 11,
            tags: ["promql", "queries", "histograms"],
            blocks: [
              { t: "p", html: "PromQL works on two shapes of data. An <strong>instant vector</strong> is one sample per series at a moment. A <strong>range vector</strong>, written with <code class='tok'>[5m]</code>, is every sample per series over a window. Functions such as <code class='tok'>rate()</code> turn a range vector back into an instant vector you can graph and aggregate." },
              { t: "widget", id: "bcPromql" },
              { t: "h", text: "rate, irate and increase" },
              { t: "table", headers: ["Function", "Computes", "Use for"], rows: [
                ["rate(c[5m])", "Per-second average increase over the window, reset-aware and extrapolated to the window edges", "Dashboards and alerts: smooth and stable"],
                ["irate(c[5m])", "Per-second rate from only the last two samples in the window", "Zoomed-in, fast-moving graphs; too jumpy for alerts"],
                ["increase(c[1h])", "rate × window: total increase over the window", "'How many errors in the last hour' panels"]
              ] },
              { t: "note", variant: "trap", html: "Always apply <code class='tok'>rate()</code> <em>before</em> <code class='tok'>sum()</code>. Summing raw counters first hides each instance's reset inside the total, and rate then sees the drop as a giant spike or a negative step." },
              { t: "h", text: "Aggregation: by and without" },
              { t: "code", lang: "promql", code:
                "# per-route request rate across all pods\n" +
                "sum by (route) (rate(http_requests_total{job=\"checkout\"}[5m]))\n\n" +
                "# same, but keep every label except pod and instance\n" +
                "sum without (pod, instance) (rate(http_requests_total{job=\"checkout\"}[5m]))"
              },
              { t: "h", text: "Quantiles, ratios and absence" },
              { t: "code", lang: "promql", code:
                "# fleet p99 latency: rate the buckets, sum keeping le, then estimate\n" +
                "histogram_quantile(0.99,\n" +
                "  sum by (le) (rate(http_request_duration_seconds_bucket{job=\"checkout\"}[5m])))\n\n" +
                "# error ratio, the availability SLI's complement\n" +
                "sum(rate(http_requests_total{job=\"checkout\", code=~\"5..\"}[5m]))\n" +
                "  / sum(rate(http_requests_total{job=\"checkout\"}[5m]))\n\n" +
                "# fires when the series vanishes entirely (target gone, renamed metric)\n" +
                "absent(up{job=\"checkout\"})\n\n" +
                "# compare with the same time yesterday\n" +
                "sum(rate(http_requests_total{job=\"checkout\"}[5m]))\n" +
                "  / sum(rate(http_requests_total{job=\"checkout\"}[5m] offset 1d))"
              },
              { t: "ul", items: [
                "Make the range at least about four scrape intervals so a missed scrape does not create gaps; in Grafana use <code class='tok'>$__rate_interval</code>.",
                "<code class='tok'>histogram_quantile</code> interpolates inside a bucket, so its answer is only as precise as your bucket boundaries near the value.",
                "An alert on <code class='tok'>rate(errors) &gt; 0</code> is silent when the metric does not exist at all. Pair important alerts with an <code class='tok'>absent()</code> or <code class='tok'>up == 0</code> check."
              ] },
              { t: "table", headers: ["Tier", "Querying checkout latency"], rows: [
                ["Naive", "avg(http_request_duration_seconds_sum / http_request_duration_seconds_count)"],
                ["Solid", "histogram_quantile(0.99, sum by (le) (rate(..._bucket[5m])))"],
                ["Standout", "That, split by route with sum by (le, route), plus the share of requests under the SLO threshold as an exact bucket ratio for the SLI"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'write the query for error rate', 'why does my graph spike after deploys', 'p99 across pods'. <strong>Say it out loud:</strong> 'Rate the counter first, then aggregate, keep le for quantiles, divide two rates for a ratio, and back critical alerts with absent().'" },
              { t: "note", variant: "key", html: "<strong>Rate, then sum; keep le; divide rates.</strong> Those three habits avoid most wrong PromQL, and absent() catches the failure where the data disappears." }
            ]
          },
          {
            id: "recording-rules",
            title: "Recording and alerting rules as code",
            summary: "Precompute what dashboards and SLOs read often, alert on symptoms with a for duration, and test rules before they ship.",
            minutes: 9,
            tags: ["prometheus", "rules", "alerting"],
            blocks: [
              { t: "p", html: "Prometheus evaluates <strong>rule groups</strong> on a schedule. A <strong>recording rule</strong> stores the result of an expression as a new series. An <strong>alerting rule</strong> turns an expression into firing alerts that are sent to Alertmanager. Both are YAML in version control, reviewed like code." },
              { t: "code", lang: "yaml", code:
                "groups:\n" +
                "  - name: checkout-slo\n" +
                "    interval: 30s\n" +
                "    rules:\n" +
                "      # naming convention  level:metric:operations\n" +
                "      - record: job:http_requests:rate5m\n" +
                "        expr: sum by (job) (rate(http_requests_total{job=\"checkout\"}[5m]))\n" +
                "      - record: job:http_requests_errors:rate5m\n" +
                "        expr: sum by (job) (rate(http_requests_total{job=\"checkout\", code=~\"5..\"}[5m]))\n" +
                "      - record: job:http_requests_error_ratio:rate5m\n" +
                "        expr: job:http_requests_errors:rate5m / job:http_requests:rate5m\n\n" +
                "  - name: checkout-alerts\n" +
                "    rules:\n" +
                "      - alert: CheckoutHighErrorRatio\n" +
                "        expr: job:http_requests_error_ratio:rate5m{job=\"checkout\"} > 0.02\n" +
                "        for: 5m                       # must hold for 5 minutes before firing\n" +
                "        labels:\n" +
                "          severity: page\n" +
                "          team: checkout\n" +
                "        annotations:\n" +
                "          summary: \"Checkout 5xx ratio {{ $value | humanizePercentage }} over 5m\"\n" +
                "          runbook: runbooks.internal.example/checkout/high-error-ratio\n" +
                "      - alert: CheckoutTargetsMissing\n" +
                "        expr: absent(up{job=\"checkout\"} == 1)\n" +
                "        for: 10m\n" +
                "        labels: { severity: ticket, team: checkout }"
              },
              { t: "h", text: "When to record" },
              { t: "ul", items: [
                "An expression is expensive and evaluated often: dashboards opened by many people, or many alerts sharing it.",
                "An SLO calculation needs the same number in a dashboard, an alert and a report. Record it once so all three agree.",
                "You want to aggregate away a high-cardinality label (such as pod) and keep only the cheap aggregate long-term."
              ] },
              { t: "h", text: "Testing rules" },
              { t: "code", lang: "bash", code:
                "promtool check rules rules/checkout.yaml          # syntax and expression parsing\n" +
                "promtool test rules tests/checkout_test.yaml     # feed synthetic series, assert alerts fire"
              },
              { t: "note", variant: "tip", html: "A fixed 2% threshold is a reasonable start, but SLO-based alerts fire on <em>how fast the budget is burning</em> across two windows. See <a href='#/slo/budgets/burn-rate'>Burn-rate alerting</a>, and alert on symptoms rather than causes as in <a href='#/alert/alerting/symptom-vs-cause'>Symptom vs cause</a>." },
              { t: "compare",
                bad: { title: "Rules nobody trusts", items: ["Thresholds copied from a blog of a different system", "No for duration: fires on every blip", "No runbook, no owner label", "Edited in the UI, never reviewed"] },
                good: { title: "Rules people act on", items: ["Thresholds tied to an SLO", "for long enough to skip blips, short enough to matter", "Owner, severity and runbook on every alert", "In Git, with promtool tests in CI"] } },
              { t: "table", headers: ["Tier", "Alert definition practice"], rows: [
                ["Naive", "Alert on CPU > 80% for every host"],
                ["Solid", "Alert on user-facing error ratio and latency with for, severity, team and runbook"],
                ["Standout", "Multi-window burn-rate alerts built on recording rules, unit-tested with promtool, and absent() guards on every critical signal"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'dashboards are slow', 'alerts are flappy', 'the SLO number differs between the dashboard and the report'. <strong>Say it out loud:</strong> 'I record shared expressions once, alert on symptoms with a for duration and an owner, and unit-test the rules in CI.'" },
              { t: "note", variant: "key", html: "<strong>Record once, alert on symptoms, test in CI.</strong> Recording rules make numbers fast and consistent; alert rules need for, owner, severity and a runbook to be worth waking up for." }
            ]
          },
          {
            id: "grafana",
            title: "Grafana dashboards that help on-call",
            summary: "Lay dashboards out from user impact down to resources, use variables instead of copies, and treat dashboards as owned code.",
            minutes: 9,
            tags: ["grafana", "dashboards", "red", "use"],
            blocks: [
              { t: "p", html: "Grafana is a visualization layer: it stores no telemetry itself and queries data sources such as Prometheus, Loki, Tempo, SQL databases and commercial backends. Its value comes from <strong>layout</strong>: a responder opening a dashboard at 3 a.m. should know within ten seconds whether users are hurt and where to look next." },
              { t: "h", text: "Two layouts that work" },
              { t: "table", headers: ["Method", "For", "Rows"], rows: [
                ["RED", "Request-driven services", "Rate, Errors, Duration per service or route"],
                ["USE", "Resources: CPU, memory, disks, queues, connection pools", "Utilization, Saturation, Errors per resource"]
              ] },
              { t: "ol", items: [
                "<strong>Top row</strong>: SLO status and error-budget remaining, then RED for the service.",
                "<strong>Second row</strong>: RED per route or per dependency, so the failing part stands out.",
                "<strong>Third row</strong>: USE for the resources behind it (pods, database pool, queue depth).",
                "<strong>Annotations</strong>: deploys, feature-flag flips and incidents drawn on every panel.",
                "<strong>Links</strong>: to the logs and traces of the same service and time range, and to the runbook."
              ] },
              { t: "h", text: "Variables and intervals" },
              { t: "code", lang: "promql", code:
                "# panel query using dashboard variables: one dashboard for every cluster and service\n" +
                "sum by (route) (\n" +
                "  rate(http_requests_total{cluster=\"$cluster\", job=\"$service\", code=~\"5..\"}[$__rate_interval]))\n" +
                "/ sum by (route) (\n" +
                "  rate(http_requests_total{cluster=\"$cluster\", job=\"$service\"}[$__rate_interval]))"
              },
              { t: "h", text: "Avoiding dashboard sprawl" },
              { t: "compare",
                bad: { title: "Sprawl", items: ["Copies per environment that drift apart", "Hundreds of dashboards, no owner", "Edited in the UI, never reviewed", "Panels nobody can explain"] },
                good: { title: "Curated", items: ["One templated dashboard with variables", "Folder per team; an owner on every dashboard", "Provisioned from Git (JSON or a generator)", "Unused dashboards archived on a schedule"] } },
              { t: "note", variant: "tip", html: "Delivery metrics belong on dashboards too. For DORA keys and the security metrics to pair with them, see <a href='../devsecops-academy/index.html#/prog/feedback/metrics'>Forge: DORA and security metrics</a>." },
              { t: "note", variant: "warn", html: "A dashboard is not an alert. Nobody watches a wall of graphs continuously; anything that needs action must be an alert rule with an owner, and the dashboard is where that alert links to." },
              { t: "table", headers: ["Tier", "Service dashboard"], rows: [
                ["Naive", "Thirty host-metric panels, cloned per environment"],
                ["Solid", "RED on top, USE below, cluster and service variables, deploy annotations"],
                ["Standout", "That, plus SLO and budget panels, exemplar links into traces, log links with the same time range, all provisioned from Git with an owner"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we have too many dashboards', 'on-call does not know where to look', 'design a service dashboard'. <strong>Say it out loud:</strong> 'User impact on top with RED and SLO status, resources below with USE, variables instead of copies, and every dashboard owned and provisioned from Git.'" },
              { t: "quiz", id: "tools-metrics" },
              { t: "note", variant: "key", html: "<strong>Impact first, cause second, one templated copy.</strong> RED and SLO status on top, USE below, links into logs and traces, and dashboards treated as owned code." }
            ]
          }
        ]
      },
      {
        id: "logs-traces",
        name: "Logs, Traces & Platforms",
        icon: "database",
        lessons: [
          {
            id: "log-stacks",
            title: "Log stores: index everything or index labels",
            summary: "Full-text search engines and label-indexed log stores make opposite bets on where to pay: at ingest or at query.",
            minutes: 9,
            tags: ["logs", "loki", "elk", "opensearch"],
            blocks: [
              { t: "p", html: "Every log store answers the same question, 'show me the lines that match', but they pay for it at different times. A <strong>search engine</strong> such as Elasticsearch or OpenSearch builds an inverted index of every term at ingest, so any search is fast and storage is heavy. A <strong>label-indexed</strong> store such as Loki indexes only a few labels (service, namespace, level) and scans compressed chunks at query time, so ingest is cheap and wide searches are slow." },
              { t: "table", headers: ["", "Search engine (ELK / OpenSearch)", "Label-indexed (Loki)"], rows: [
                ["Indexes", "Every field and term", "A small set of stream labels"],
                ["Ingest and storage cost", "High: index often rivals or exceeds raw size", "Low: compressed chunks in object storage"],
                ["Fast queries", "Arbitrary full-text and field search, aggregations", "Filter by labels, then grep and parse a narrow slice"],
                ["Slow queries", "Rarely; cost is paid up front", "Needle-in-haystack across all services and long ranges"],
                ["Cardinality risk", "Field mapping explosions", "High-cardinality labels create too many streams"]
              ] },
              { t: "h", text: "The same question in both styles" },
              { t: "code", lang: "text", code:
                "# LogQL: choose streams by label, then filter and parse lines\n" +
                "{namespace=\"shop\", app=\"payment-svc\"} |= \"timeout\" | json | duration_ms > 1500\n\n" +
                "# Search-engine query string: every field is already indexed\n" +
                "service.name:\"payment-svc\" AND message:timeout AND duration_ms:>1500"
              },
              { t: "h", text: "Controlling cost on either" },
              { t: "ul", items: [
                "Drop or sample DEBUG and per-request success lines in the Collector before they are stored.",
                "Tier retention: days in hot storage, weeks in cheaper warm storage, longer only for audit streams that require it.",
                "Keep labels bounded in Loki (never user or request ids) and put ids in the line, where <code class='tok'>| json</code> can still filter them.",
                "In search engines, define mappings explicitly so a new dynamic field per request does not explode the index."
              ] },
              { t: "note", variant: "tip", html: "Structured JSON with trace ids makes both styles far more useful. See <a href='#/otel/signals/structured-logs'>Structured logs</a>." },
              { t: "note", variant: "trap", html: "Security investigations often need long retention and fast arbitrary search across everything, which is the opposite of the cheapest debug setup. Decide per stream: audit and security events may need a different store and retention from application debug logs." },
              { t: "table", headers: ["Tier", "Logging for 40 services"], rows: [
                ["Naive", "Ship everything at DEBUG into one cluster with 90-day retention"],
                ["Solid", "Structured logs, INFO by default, label-indexed store for debugging with 14-day retention, sampling of success lines"],
                ["Standout", "That, plus separate audit streams with longer retention, per-team ingest budgets enforced in the Collector, and trace-id links from every line"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'our log cluster is the biggest cost', 'searches time out', 'pick a log store'. <strong>Say it out loud:</strong> 'A full index pays at ingest for fast arbitrary search; a label index pays at query time for cheap storage. I pick by how we query, and cut volume in the pipeline before choosing either.'" },
              { t: "note", variant: "key", html: "<strong>Pay at ingest or pay at query.</strong> Search engines index everything; label-indexed stores index little and scan. Volume control in the pipeline matters more than the choice." }
            ]
          },
          {
            id: "trace-backends",
            title: "Trace backends: Jaeger, Tempo and friends",
            summary: "Trace stores differ in how you find a trace: by indexed attributes, by trace id from another signal, or by a query language over spans.",
            minutes: 9,
            tags: ["tracing", "jaeger", "tempo"],
            blocks: [
              { t: "p", html: "A trace backend stores spans and lets you find and render traces. Every modern one accepts OTLP, so the real differences are <strong>storage</strong>, <strong>how you search</strong> and <strong>what it derives</strong> from spans, such as service graphs and RED metrics." },
              { t: "table", headers: ["", "Jaeger", "Tempo"], rows: [
                ["Storage", "Pluggable: Cassandra, Elasticsearch or OpenSearch, or local stores for small setups", "Object storage (columnar blocks) with no separate index cluster"],
                ["Finding traces", "Search by service, operation, tags and duration over an index", "Trace-ID lookup plus TraceQL queries over span attributes"],
                ["Strength", "Mature UI, familiar search, flexible storage", "Very cheap storage at high volume; tight links from metrics and logs"],
                ["Cost driver", "Index cluster size and retention", "Object storage plus query compute"]
              ] },
              { t: "code", lang: "text", code:
                "# TraceQL: find slow checkout traces that touched the payment service with an error\n" +
                "{ resource.service.name = \"checkout-svc\" && duration > 2s }\n" +
                "  >> { resource.service.name = \"payment-svc\" && status = error }"
              },
              { t: "h", text: "Getting to the right trace" },
              { t: "ol", items: [
                "<strong>From a metric</strong>: an exemplar on a slow latency bucket carries a trace id; click it.",
                "<strong>From a log</strong>: the trace_id field on an error line opens the trace.",
                "<strong>From search</strong>: attribute queries when you do not have an id yet, such as 'all traces for tenant gold with status error in the last hour'.",
                "<strong>From a service graph</strong>: an edge with a high error rate leads to example traces for that call."
              ] },
              { t: "note", variant: "warn", html: "Sampling decides what any backend can show. If you head-sample at 1%, 99% of failed requests have no trace no matter which store you pick. Decide sampling and backend together. See <a href='#/otel/pipeline/sampling'>Head and tail sampling</a>." },
              { t: "table", headers: ["Tier", "Tracing backend choice"], rows: [
                ["Naive", "Pick the one with the nicest demo and keep every span for a year"],
                ["Solid", "Pick by storage the team can run and by search needs; set retention to days or weeks; connect exemplars and log links"],
                ["Standout", "That, plus tail sampling sized to the backend budget, span-derived RED metrics computed before sampling, and TraceQL or tag search for investigations without an id"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'Jaeger or Tempo', 'traces are too expensive to store', 'we can never find the trace'. <strong>Say it out loud:</strong> 'Both take OTLP. I choose by storage cost and how we search: index-backed attribute search, or object storage with trace-ID lookups reached from exemplars and logs, plus a span query language.'" },
              { t: "note", variant: "key", html: "<strong>Storage and search path, not features.</strong> Every backend takes OTLP; choose by what storage you can afford and how responders will find a trace." }
            ]
          },
          {
            id: "vendor-platforms",
            title: "Commercial platforms: build, buy and stay portable",
            summary: "Compare categories, not logos: understand the cost drivers, where lock-in lives, and how OpenTelemetry keeps you free to move.",
            minutes: 10,
            tags: ["vendors", "cost", "lock-in", "opentelemetry"],
            blocks: [
              { t: "p", html: "Most organisations end up with a mix: some open-source components they run, some managed services, and often a commercial platform. The decision is not 'which logo is best' but <strong>what you want to operate yourself, what you will pay for per unit, and how hard it would be to leave</strong>." },
              { t: "h", text: "Categories" },
              { t: "table", headers: ["Category", "Examples", "Typical strength", "Typical caution"], rows: [
                ["Full-stack SaaS observability", "Datadog, New Relic and similar", "Metrics, logs, traces, RUM and profiling in one UI, quick to start", "Metered on many dimensions; proprietary agents and query languages"],
                ["Log and security analytics platforms", "Splunk and similar", "Powerful search, long retention, strong security use cases", "Ingest volume drives cost; heavy for simple debugging"],
                ["Managed open-source", "Cloud-managed Prometheus, Grafana, OpenSearch", "Familiar open tools without running the storage", "Still your dashboards, rules and cardinality to manage"],
                ["Self-hosted open-source", "Prometheus, Grafana, Loki, Tempo, Jaeger, OpenSearch", "No licence fees, full control, data stays in your network", "You run storage, upgrades, scaling and on-call for it"]
              ] },
              { t: "h", text: "Cost drivers to model before signing" },
              { t: "ul", items: [
                "Ingested volume: gigabytes of logs per day, spans per second, samples per second.",
                "Indexed or analysed volume, which can be priced separately from ingested volume.",
                "Custom metric series, which is where cardinality turns directly into money.",
                "Monitored hosts, containers or functions, and the add-ons per host.",
                "Retention length per signal, and the cost to rehydrate archived data.",
                "Seats or users, and the price of features such as RUM, synthetics and security modules."
              ] },
              { t: "note", variant: "trap", html: "Model cost on your own volumes and growth, not on a list price. The same workload can cost very different amounts depending on how many custom series you emit, how much you index and how long you keep it, and those are levers you control." },
              { t: "h", text: "Where lock-in lives" },
              { t: "table", headers: ["Layer", "Lock-in risk", "Portable choice"], rows: [
                ["Instrumentation", "High: vendor SDKs in every codebase", "OpenTelemetry SDKs and semantic conventions"],
                ["Pipeline", "Medium: vendor agent on every host", "Your own Collector with per-backend exporters"],
                ["Queries and dashboards", "Medium: proprietary query language", "Dashboards and rules kept as code; PromQL-compatible where possible"],
                ["Alerts and on-call wiring", "Medium", "Alert definitions in Git; routing in a separate paging tool"],
                ["Historical data", "Low to medium", "Accept that history rarely migrates; overlap during a switch"]
              ] },
              { t: "h", text: "Build versus buy" },
              { t: "compare",
                bad: { title: "Buy is likely better when", items: ["A small platform team or none", "You need RUM, synthetics and APM quickly", "Volumes are modest and predictable", "Nobody wants to be on call for the observability stack"] },
                good: { title: "Build is likely better when", items: ["A platform team already runs stateful systems", "Volumes make metered pricing painful", "Data residency or air-gapped requirements", "You want one open query language across everything"] } },
              { t: "note", variant: "tip", html: "Whatever you choose, route telemetry through an OpenTelemetry Collector you control. Then a trial of another backend is a second exporter, not a re-instrumentation project. See <a href='#/otel/pipeline/collector'>The Collector</a>." },
              { t: "table", headers: ["Tier", "Platform decision"], rows: [
                ["Naive", "Choose by the best demo, install the vendor agent everywhere"],
                ["Solid", "Model cost on real volumes, instrument with OTel, keep dashboards and alerts as code"],
                ["Standout", "That, plus a Collector that can dual-ship during evaluations, per-team usage budgets and showback, and a documented exit plan"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'should we buy a platform', 'our observability bill is out of control', 'how do we avoid lock-in'. <strong>Say it out loud:</strong> 'I compare by category and cost drivers on our own volumes, instrument with OpenTelemetry through our own Collector, and keep dashboards and alerts as code, so the backend stays a replaceable choice.'" },
              { t: "quiz", id: "tools-logs-traces" },
              { t: "note", variant: "key", html: "<strong>Own the instrumentation and the pipeline; rent the storage if it pays.</strong> OpenTelemetry plus your own Collector keeps every backend, open-source or commercial, a reversible decision." }
            ]
          }
        ]
      }
    ]
  };
})();
