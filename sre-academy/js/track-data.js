/* =====================================================================
   BEACON · Data Pipeline Observability
   window.TRACKS.data — modules: signals / operate

   Self-contained: this file registers its own widgets (bcFreshness,
   bcLineage), its own quizzes (data-signals, data-operate) and its
   track data.
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

  function field(label, input, tail) {
    return h("label", { class: "w-field" }, label + " ", input, tail ? " " : null, tail || null);
  }

  var Widgets = {};

  /* ==================================================================
     1. bcFreshness — 14 daily loads of analytics.orders, judged against
        a freshness SLO and a volume band around the trailing median.
  ================================================================== */
  var FRESH_ROWS = [102, 98, 105, 101, 99, 64, 103, 107, 100, 104, 131, 102, 41, 106];
  var FRESH_LAG = [2.1, 2.4, 1.9, 2.2, 6.8, 2.5, 2.0, 2.3, 9.5, 2.6, 2.2, 3.1, 4.4, 2.0];

  function median(arr) {
    if (!arr.length) return 0;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  Widgets.bcFreshness = function (mount) {
    shell(mount, "simulator", "Freshness and volume monitor",
      "Fourteen days of daily loads into analytics.orders: thousands of rows landed (top) and hours after midnight the load finished (bottom). Tune the freshness SLO and the volume band around the trailing median; any violating day is shaded rose. Day 1 has no history, so it gets no volume check.");
    var st = { slo: 4, thr: 25, win: 7 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var sloLbl = h("b", {}, "");
    var sloIn = h("input", { type: "range", min: "1", max: "12", step: "0.5", value: String(st.slo) });
    sloIn.addEventListener("input", function () {
      var v = parseFloat(sloIn.value);
      st.slo = isFinite(v) ? Math.max(1, Math.min(12, v)) : 4;
      paint();
    });
    var thrLbl = h("b", {}, "");
    var thrIn = h("input", { type: "range", min: "5", max: "60", step: "5", value: String(st.thr) });
    thrIn.addEventListener("input", function () {
      var v = parseFloat(thrIn.value);
      st.thr = isFinite(v) ? Math.max(5, Math.min(60, v)) : 25;
      paint();
    });
    controls.appendChild(field("freshness SLO", sloIn, sloLbl));
    controls.appendChild(field("volume band \u00b1", thrIn, thrLbl));
    controls.appendChild(segment([[3, "median of 3 days"], [7, "median of 7 days"]], 1, function (v) { st.win = v; paint(); }));

    var W = 560, H = 236, SLOT = W / FRESH_ROWS.length;
    var TOP = 18, TOPH = 92, BOT = 140, BOTH = 66, ROWMAX = 140, LAGMAX = 12;

    function evaluate() {
      var out = [];
      for (var i = 0; i < FRESH_ROWS.length; i++) {
        var prior = FRESH_ROWS.slice(Math.max(0, i - st.win), i);
        var base = prior.length ? median(prior) : 0;
        var dev = base > 0 ? (FRESH_ROWS[i] - base) / base * 100 : 0;
        out.push({ rows: FRESH_ROWS[i], lag: FRESH_LAG[i], dev: fin(dev, 0), checked: base > 0,
          vol: base > 0 && Math.abs(dev) > st.thr, fresh: FRESH_LAG[i] > st.slo });
      }
      return out;
    }

    function paint() {
      sloLbl.textContent = st.slo + " h";
      thrLbl.textContent = st.thr + "%";
      var days = evaluate(), i, nFresh = 0, nVol = 0, nBad = 0, worst = 0, worstDay = 1;
      clear(stage);
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "daily rows and landing times" });
      svg.appendChild(sv("text", { x: 2, y: 11, "font-size": "10.5", style: "fill:var(--text-dim)" }, "rows landed (thousands)"));
      svg.appendChild(sv("text", { x: 2, y: BOT - 8, "font-size": "10.5", style: "fill:var(--text-dim)" }, "load finished (hours after midnight)"));
      for (i = 0; i < days.length; i++) {
        var d = days[i], x0 = i * SLOT;
        if (d.fresh) nFresh++;
        if (d.vol) nVol++;
        if (d.fresh || d.vol) {
          nBad++;
          svg.appendChild(sv("rect", { x: (x0 + 1).toFixed(1), y: TOP - 4, width: (SLOT - 2).toFixed(1), height: BOT + BOTH - TOP + 6, fill: "var(--rose)", opacity: "0.12" }));
        }
        if (d.checked && Math.abs(d.dev) > Math.abs(worst)) { worst = d.dev; worstDay = i + 1; }
        var rh = Math.min(ROWMAX, d.rows) / ROWMAX * TOPH;
        svg.appendChild(sv("rect", { x: (x0 + 6).toFixed(1), y: (TOP + TOPH - rh).toFixed(1), width: (SLOT - 12).toFixed(1), height: rh.toFixed(1),
          fill: d.vol ? "var(--rose)" : "var(--cyan)" }));
        var lh = Math.min(LAGMAX, d.lag) / LAGMAX * BOTH;
        svg.appendChild(sv("rect", { x: (x0 + 6).toFixed(1), y: (BOT + BOTH - lh).toFixed(1), width: (SLOT - 12).toFixed(1), height: lh.toFixed(1),
          fill: d.fresh ? "var(--rose)" : "var(--violet)" }));
        svg.appendChild(sv("text", { x: (x0 + SLOT / 2).toFixed(1), y: H - 6, "font-size": "10", "text-anchor": "middle", style: "fill:var(--text-dim)" }, "d" + (i + 1)));
      }
      svg.appendChild(sv("line", { x1: 0, y1: TOP + TOPH, x2: W, y2: TOP + TOPH, stroke: "var(--line)" }));
      svg.appendChild(sv("line", { x1: 0, y1: BOT + BOTH, x2: W, y2: BOT + BOTH, stroke: "var(--line)" }));
      var sy = BOT + BOTH - Math.min(LAGMAX, st.slo) / LAGMAX * BOTH;
      svg.appendChild(sv("line", { x1: 0, y1: sy.toFixed(1), x2: W, y2: sy.toFixed(1), stroke: "var(--amber)", "stroke-width": "1.5", "stroke-dasharray": "5 4" }));
      stage.appendChild(svg);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, "dashed line is the freshness SLO · rose bars break a rule · shaded columns are bad days"));

      var attain = (days.length - nBad) / days.length * 100;
      clear(readout);
      readout.appendChild(ro("freshness breaches", nFresh + " / " + days.length));
      readout.appendChild(ro("volume anomalies", nVol + " / " + (days.length - 1)));
      readout.appendChild(ro("largest deviation", (worst >= 0 ? "+" : "") + fin(worst, 0).toFixed(1) + "% on d" + worstDay));
      readout.appendChild(ro("SLO attainment (good days)", fin(attain, 0).toFixed(1) + "%"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. bcLineage — break one asset in a small DAG and trace the blast
        radius downstream (impact) or the candidates upstream (cause).
  ================================================================== */
  var LIN_NODES = [
    { id: "raw.orders", layer: 0, y: 26, kind: "source", owner: "checkout team" },
    { id: "raw.payments", layer: 0, y: 86, kind: "source", owner: "payments team" },
    { id: "raw.customers", layer: 0, y: 146, kind: "source", owner: "CRM team" },
    { id: "stg.orders", layer: 1, y: 26, kind: "staging", owner: "data platform" },
    { id: "stg.payments", layer: 1, y: 86, kind: "staging", owner: "data platform" },
    { id: "analytics.orders", layer: 2, y: 56, kind: "mart", owner: "analytics engineering" },
    { id: "analytics.customers", layer: 2, y: 146, kind: "mart", owner: "analytics engineering" },
    { id: "dash.revenue", layer: 3, y: 36, kind: "dashboard", owner: "finance" },
    { id: "ml.churn_features", layer: 3, y: 116, kind: "ML feature", owner: "ML platform" }
  ];
  var LIN_EDGES = [
    ["raw.orders", "stg.orders"], ["raw.payments", "stg.payments"],
    ["stg.orders", "analytics.orders"], ["stg.payments", "analytics.orders"],
    ["raw.customers", "analytics.customers"], ["stg.orders", "analytics.customers"],
    ["analytics.orders", "dash.revenue"], ["analytics.orders", "ml.churn_features"],
    ["analytics.customers", "ml.churn_features"]
  ];
  var LIN_LAYERS = ["sources", "staging", "marts", "consumers"];

  function linNode(id) {
    for (var i = 0; i < LIN_NODES.length; i++) if (LIN_NODES[i].id === id) return LIN_NODES[i];
    return LIN_NODES[0];
  }

  function reach(start, downstream) {
    var seen = {}, queue = [start], out = [];
    seen[start] = true;
    while (queue.length) {
      var cur = queue.shift();
      for (var i = 0; i < LIN_EDGES.length; i++) {
        var from = downstream ? LIN_EDGES[i][0] : LIN_EDGES[i][1];
        var to = downstream ? LIN_EDGES[i][1] : LIN_EDGES[i][0];
        if (from === cur && !seen[to]) { seen[to] = true; out.push(to); queue.push(to); }
      }
    }
    return out;
  }

  Widgets.bcLineage = function (mount) {
    shell(mount, "explorer", "Lineage blast radius",
      "Pick an asset to break, by clicking a node or using the selector. Downstream mode shows everything that now serves bad or stale data and who must hear about it; upstream mode shows where to look for the cause.");
    var st = { broken: "stg.payments", down: true };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var sel = h("select", {});
    for (var n = 0; n < LIN_NODES.length; n++) {
      var opt = h("option", { value: LIN_NODES[n].id }, LIN_NODES[n].id);
      if (LIN_NODES[n].id === st.broken) opt.setAttribute("selected", "selected");
      sel.appendChild(opt);
    }
    sel.addEventListener("change", function () { pick(sel.value); });
    controls.appendChild(field("break", sel));
    controls.appendChild(segment([[true, "downstream impact"], [false, "upstream causes"]], 0, function (v) { st.down = v; paint(); }));

    function pick(id) {
      var ok = false;
      for (var i = 0; i < LIN_NODES.length; i++) if (LIN_NODES[i].id === id) ok = true;
      st.broken = ok ? id : "stg.payments";
      sel.value = st.broken;
      paint();
    }

    var W = 572, H = 196, NW = 130, NH = 28, GAP = 145;
    function nx(node) { return 4 + node.layer * GAP; }

    function paint() {
      var hit = reach(st.broken, st.down), set = {}, i;
      for (i = 0; i < hit.length; i++) set[hit[i]] = true;
      clear(stage);
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "lineage graph" });
      for (i = 0; i < LIN_LAYERS.length; i++) {
        svg.appendChild(sv("text", { x: 4 + i * GAP + NW / 2, y: 12, "font-size": "10.5", "text-anchor": "middle", style: "fill:var(--text-dim)" }, LIN_LAYERS[i]));
      }
      for (i = 0; i < LIN_EDGES.length; i++) {
        var a = linNode(LIN_EDGES[i][0]), b = linNode(LIN_EDGES[i][1]);
        var hot = (set[a.id] || a.id === st.broken) && (set[b.id] || b.id === st.broken);
        var x1 = nx(a) + NW, y1 = a.y + NH / 2, x2 = nx(b), y2 = b.y + NH / 2, mx = (x1 + x2) / 2;
        svg.appendChild(sv("path", { d: "M" + x1 + " " + y1 + " C" + mx + " " + y1 + " " + mx + " " + y2 + " " + x2 + " " + y2,
          fill: "none", stroke: hot ? "var(--rose)" : "var(--line)", "stroke-width": hot ? "2" : "1.2" }));
      }
      for (i = 0; i < LIN_NODES.length; i++) {
        (function (node) {
          var isBroken = node.id === st.broken, isHit = !!set[node.id];
          var g = sv("g", { style: "cursor:pointer", tabindex: "0" });
          g.appendChild(sv("title", {}, node.id + " (" + node.kind + ", owner: " + node.owner + ")"));
          g.appendChild(sv("rect", { x: nx(node), y: node.y, width: NW, height: NH, rx: 6, fill: "var(--surface-solid)",
            stroke: isBroken ? "var(--rose)" : isHit ? "var(--amber)" : "var(--line)", "stroke-width": isBroken ? "3" : isHit ? "2.5" : "1" }));
          g.appendChild(sv("circle", { cx: nx(node) + 9, cy: node.y + NH / 2, r: 4,
            fill: isBroken ? "var(--rose)" : isHit ? "var(--amber)" : "var(--lime)" }));
          g.appendChild(sv("text", { x: nx(node) + 18, y: node.y + NH / 2 + 4, "font-size": "10.5", style: "fill:var(--text)" }, node.id));
          g.addEventListener("click", function () { pick(node.id); });
          svg.appendChild(g);
        })(LIN_NODES[i]);
      }
      stage.appendChild(svg);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" },
        "rose outline is the broken asset · amber outlines are " + (st.down ? "impacted downstream" : "upstream candidates") + " · hover a node for its owner"));

      var owners = [], seenOwner = {}, facing = 0;
      for (i = 0; i < hit.length; i++) {
        var nd = linNode(hit[i]);
        if (nd.kind === "dashboard" || nd.kind === "ML feature") facing++;
        if (!seenOwner[nd.owner]) { seenOwner[nd.owner] = true; owners.push(nd.owner); }
      }
      clear(readout);
      readout.appendChild(ro("broken", st.broken));
      if (st.down) {
        readout.appendChild(ro("impacted assets", hit.length));
        readout.appendChild(ro("consumer-facing", facing));
        readout.appendChild(ro("owners to notify", owners.length ? owners.join(", ") : "none: nothing reads this"));
      } else {
        readout.appendChild(ro("upstream candidates", hit.length));
        readout.appendChild(ro("owners to check with", owners.length ? owners.join(", ") : "none: this is a source"));
      }
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
    "data-signals": {
      title: "Data signals checkpoint",
      sub: "Silent failures, the five pillars, freshness, volume, schema and quality checks.",
      questions: [
        {
          q: "Why do data failures usually take longer to detect than service failures?",
          options: [
            "Pipelines run less often, so failures are statistically rarer",
            "Warehouses do not produce any logs or metrics",
            "A job can finish successfully while writing stale, partial or wrong data, so nothing raises an error",
            "Data teams are not usually on call"
          ],
          answer: 2,
          explain: "A service that breaks tends to return errors that users and monitors see immediately. A pipeline that drops half its rows or joins on the wrong key still exits zero, so the failure only shows when someone notices a number looks off. That is why data reliability needs checks on the output, not just on job status."
        },
        {
          q: "What is the most useful definition of freshness for analytics.orders?",
          options: [
            "How long ago the newest data landed (or the newest event time it contains), compared against an agreed bound",
            "The total number of rows currently in the table",
            "How many columns changed in the last week",
            "The average runtime of the job that loads it"
          ],
          answer: 0,
          explain: "Freshness asks whether the data is recent enough for its consumers, so it is a lag measured against now and judged against a bound such as two hours. Row count is volume, column changes are schema, and runtime is pipeline telemetry; each is useful but none tells you whether the dashboard is current."
        },
        {
          q: "Order counts drop about 40% every Sunday. A volume check comparing each day with the trailing 7-day median, using a 25% band, fires every Sunday. What is the best fix?",
          options: [
            "Widen the band to 50% for every day of the week",
            "Disable the volume check, since it is clearly noisy",
            "Alert only when volume rises, never when it falls",
            "Compare each day with the median of the same weekday in prior weeks, so the baseline carries the weekly pattern"
          ],
          answer: 3,
          explain: "The alert is firing on a known, healthy pattern, which means the baseline is wrong rather than the threshold. A seasonal baseline keeps the band tight on weekdays and still catches a Sunday that is unusually low. Widening the band everywhere or disabling the check would hide real drops."
        },
        {
          q: "Some orders.customer_id values have no matching row in customers. Which check catches this?",
          options: [
            "A null-rate check on orders.customer_id",
            "A referential-integrity check that left-joins to customers and counts child rows with no parent",
            "A uniqueness check on orders.order_id",
            "An accepted-range check on orders.amount"
          ],
          answer: 1,
          explain: "Orphaned foreign keys are not null and not duplicated, so null-rate and uniqueness checks pass. Only a join against the parent table reveals keys that point at nothing. Most warehouses do not enforce foreign keys, which is why this check has to live in your test suite."
        },
        {
          q: "What is the main job of a data contract between a producer team and its consumers?",
          options: [
            "To make queries against the table run faster",
            "To replace all downstream quality tests",
            "To make the schema, meaning and service levels an explicit, versioned agreement, so a breaking change is caught before it ships",
            "To encrypt the table at rest"
          ],
          answer: 2,
          explain: "A contract turns implicit assumptions into something a machine can check: required columns, types, semantics, freshness and the compatibility policy. Checked in the producer's CI, it blocks a rename or type change before consumers break. It complements downstream tests rather than replacing them."
        },
        {
          q: "An upstream team renames amount to amount_usd. Where is the earliest and cheapest place to catch it?",
          options: [
            "A schema check in the producer's CI that compares the change with the published contract and fails on a breaking change",
            "Finance noticing that the revenue dashboard shows zero",
            "The monthly data-quality review meeting",
            "A null-rate check on the dashboard's revenue tile"
          ],
          answer: 0,
          explain: "Catching the change before it merges costs a code review comment, while catching it in a dashboard costs an incident and a backfill. Downstream null-rate checks are a useful safety net but fire only after bad data has landed. Shift the check as far left as the producer's pipeline allows."
        }
      ]
    },
    "data-operate": {
      title: "Operating data pipelines checkpoint",
      sub: "Lineage, pipeline telemetry, data incidents and data SLOs.",
      questions: [
        {
          q: "You emit OpenTelemetry signals from an orchestrator. Which value belongs on spans but should NOT be a metric label?",
          options: [
            "pipeline.name",
            "run.id, which is unique for every run",
            "task.id",
            "the run's final status (success or failed)"
          ],
          answer: 1,
          explain: "Every distinct label value creates a new time series, so a per-run identifier makes metric cardinality grow without bound. Spans are individual events, so a unique run id there is cheap and lets you jump from a slow metric to the exact run. Pipeline, task and status have small, bounded value sets and are fine as labels."
        },
        {
          q: "stg.payments has loaded bad data. Which question does downstream lineage answer?",
          options: [
            "Which upstream source caused the problem",
            "How long the staging job has taken over the past month",
            "What the null rate of each column is",
            "Every table, dashboard and feature that reads it, directly or transitively, and who owns each one"
          ],
          answer: 3,
          explain: "Downstream lineage gives you the blast radius: the assets now serving bad data and the owners who need to know. Upstream lineage is the other direction and helps find the cause. Runtimes and null rates are telemetry and quality signals, not graph questions."
        },
        {
          q: "A bad partition landed in analytics.orders at 03:00, and dashboards refresh from it at 06:00. It is 04:00. What do you do first?",
          options: [
            "Stop propagation: pause the downstream refreshes and keep the bad partition from being published, then quarantine it",
            "Start a backfill right away and let the 06:00 refresh run as normal",
            "Begin writing the postmortem while details are fresh",
            "Drop analytics.orders and rebuild it from scratch"
          ],
          answer: 0,
          explain: "The cheapest damage to repair is damage that never spreads, so you contain first. Pausing downstream jobs keeps the bad numbers out of dashboards, features and exports while you work out the fix. A backfill racing the refresh can still lose, and dropping the table destroys evidence and good data."
        },
        {
          q: "What makes a backfill of three corrupted daily partitions safe to rerun?",
          options: [
            "Appending the corrected rows on top of the existing ones",
            "Truncating the whole table and reloading all history",
            "Overwriting exactly the affected partitions, so running it twice gives the same result as running it once",
            "Fixing the numbers by hand in the dashboard tool"
          ],
          answer: 2,
          explain: "Idempotent partition overwrites mean a retry, a partial failure or a second operator cannot double-count. Appending creates duplicates, and a full truncate widens the blast radius to data that was fine. Patching the dashboard leaves the warehouse wrong for every other consumer."
        },
        {
          q: "One source table failing produces 40 alerts across downstream freshness and quality checks. What is the best way to reduce the noise?",
          options: [
            "Mute every check on downstream assets permanently",
            "Use lineage to group the alerts, page once on the root asset, and attach the downstream impact to that one alert",
            "Raise every threshold until only one alert fires",
            "Switch all data alerts to a weekly email digest"
          ],
          answer: 1,
          explain: "The 39 extra alerts describe consequences, not separate problems. Grouping by lineage keeps one actionable page with the impact list attached, which is what the responder needs. Muting or raising thresholds hides real independent failures, and a weekly digest is far too slow for revenue data."
        },
        {
          q: "A revenue dashboard has a freshness SLO of 99% of hourly checks over 28 days. About how many failed hourly checks does the error budget allow?",
          options: [
            "About 67 failed checks",
            "None: any failed check breaks the SLO",
            "Exactly 28, one per day",
            "About 6 or 7 failed checks (1% of 672)"
          ],
          answer: 3,
          explain: "Twenty-eight days of hourly checks is 28 times 24, or 672 checks, and 1% of that is about 6.7. So roughly six bad hours a month keep you within the objective. 67 would be a 90% target, and a zero budget is a 100% target that no real pipeline can sustain."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.data = {
    id: "data",
    name: "Data Pipeline Observability",
    short: "DATA",
    color: "#a3e635",
    tagline: "Catch the failures that never throw an error",
    blurb: "Pipelines fail quietly: the job goes green and the numbers come out wrong. Learn the five pillars of data health, write freshness, volume, schema and quality checks in plain SQL, use lineage to size the blast radius, emit pipeline telemetry with OpenTelemetry, run a data incident from containment to backfill, and finish by designing a data SLO for a revenue dashboard.",
    modules: [
      {
        id: "signals",
        name: "Data Health Signals",
        icon: "database",
        lessons: [
          {
            id: "data-reliability",
            title: "Why data reliability is its own discipline",
            summary: "Services fail loudly, pipelines fail silently. Here are the five pillars and the SLIs that catch silent failure.",
            minutes: 9,
            tags: ["data-reliability", "five-pillars", "data-sli"],
            blocks: [
              { t: "p", html: "Picture two outages. In the first, the checkout API starts returning 503s: error rates spike, the burn-rate alert pages within minutes, and users complain loudly. In the second, a nightly job joins orders to an exchange-rate table that was not refreshed. The job succeeds, the revenue dashboard renders, and every number is 4% wrong. Nobody gets paged. A finance analyst notices nine days later." },
              { t: "p", html: "The second outage is the normal shape of data failure. Your mental model: <strong>a pipeline's exit code tells you that it ran, not that its output is right</strong>. Data reliability means watching the <em>data itself</em>, because the process that produces it will often say everything is fine." },
              { t: "table", headers: ["Dimension", "Service reliability", "Data reliability"], rows: [
                ["Typical failure", "Errors, timeouts, crashes", "Stale, missing, duplicated or wrong rows"],
                ["How it shows up", "Loudly, within seconds", "Silently, often days later"],
                ["Unit of health", "Request", "Table, partition or dataset"],
                ["Blast radius", "Callers right now", "Every downstream table, dashboard, model and export, including history"],
                ["Recovery", "Roll back, restart, fail over", "Stop propagation, fix, backfill, re-publish"],
                ["Who notices first, without monitoring", "Users", "A consumer who knows the numbers well"]
              ] },
              { t: "h", text: "The five pillars" },
              { t: "p", html: "Almost every data failure shows up in one of five places. Treat them as the data equivalent of the golden signals: a checklist you run against any important table." },
              { t: "table", headers: ["Pillar", "Question it answers", "Example signal on analytics.orders"], rows: [
                ["<strong>Freshness</strong>", "Is the data recent enough?", "Hours since the last successful load"],
                ["<strong>Volume</strong>", "Did roughly the right amount arrive?", "Today's row count vs the trailing median"],
                ["<strong>Schema</strong>", "Did the shape change?", "Columns added, dropped, renamed or retyped"],
                ["<strong>Distribution / quality</strong>", "Are the values plausible?", "Null rate of customer_id, negative amounts, duplicate order_id"],
                ["<strong>Lineage</strong>", "What feeds it, and what does it feed?", "Upstream sources and downstream dashboards and features"]
              ] },
              { t: "h", text: "Data SLIs" },
              { t: "p", html: "Data SLIs follow the same <em>good events over valid events</em> recipe as service SLIs; the events are just loads, partitions or rows. Three cover most consumers: <strong>freshness</strong> (was it on time), <strong>completeness</strong> (did all of it arrive) and <strong>correctness</strong> (are the values right). See <a href='#/slo/sli/sli-menu'>the SLI menu</a> for how these sit next to availability and latency." },
              { t: "code", lang: "text", code:
                "freshness    = hourly checks where lag <= 2h        / all hourly checks\n" +
                "completeness = partitions with >= 99.5% of source rows / partitions expected\n" +
                "correctness  = daily loads passing all blocking tests  / daily loads\n\n" +
                "lag          = now - max(loaded_at)        # or now - max(event_ts) for event time"
              },
              { t: "p", html: "The trade-off is coverage versus cost. Every check is a query against the warehouse, and every alert competes for attention. A team with 4,000 tables cannot deeply monitor all of them, so tier your assets: full five-pillar coverage and SLOs for the handful that feed revenue, billing or customer-facing features, cheap freshness and volume checks for the rest." },
              { t: "table", headers: ["Tier", "How do we know the data is healthy?"], rows: [
                ["Naive", "The orchestrator shows every job green"],
                ["Solid", "Freshness and volume checks on key tables, plus not-null and unique tests on primary keys"],
                ["Standout", "Five-pillar checks tiered by business criticality, consumer-facing SLOs on freshness, completeness and correctness, and lineage that routes each failure to an owner"]
              ] },
              { t: "note", variant: "tip", html: "Cascade covers building observable pipelines from the data engineering side; Beacon focuses on running them against SLOs. See <a href='../data-eng-academy/index.html#/orchestration/observability/observability'>Cascade: pipeline observability</a>." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'the job succeeded but the dashboard is wrong', 'finance found the bug before we did', 'how do we monitor our data warehouse'. <strong>Say it out loud:</strong> 'Job status is not data health, so I check the output on five pillars: freshness, volume, schema, distribution and lineage, and I put SLOs on freshness, completeness and correctness for the tables that matter most.'" },
              { t: "note", variant: "key", html: "<strong>Green jobs can ship wrong data.</strong> Monitor the output, not the process: five pillars on every important table, and SLOs on freshness, completeness and correctness for the few that feed money or customers." }
            ]
          },
          {
            id: "freshness-volume",
            title: "Freshness and volume: the two cheapest, highest-yield checks",
            summary: "Measure lag against an agreed bound and row counts against a seasonal baseline, and tune both without drowning in noise.",
            minutes: 10,
            tags: ["freshness", "volume", "anomaly-detection", "sql"],
            blocks: [
              { t: "p", html: "If you only add two checks to a table, make them freshness and volume. Together they catch the most common failures: a job that did not run, ran late, loaded from an empty extract, or loaded the same file twice. Both need nothing beyond one metadata query, so they are cheap enough to run on every table." },
              { t: "h", text: "Freshness" },
              { t: "p", html: "Freshness is <strong>how stale the newest data is right now</strong>. You can measure it in two ways, and they answer different questions. <em>Load time</em> (<code class='tok'>max(loaded_at)</code>) tells you whether the pipeline ran. <em>Event time</em> (<code class='tok'>max(order_ts)</code>) tells you whether the data covers recent reality. A pipeline can run on time and still load yesterday's extract, so for important tables check both." },
              { t: "code", lang: "sql", code:
                "-- Freshness of analytics.orders, in hours (syntax varies a little by warehouse)\n" +
                "SELECT\n" +
                "  MAX(loaded_at)                                                   AS last_load,\n" +
                "  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(loaded_at))) / 3600.0 AS hours_since_load,\n" +
                "  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - MAX(order_ts)))  / 3600.0 AS hours_since_last_event\n" +
                "FROM analytics.orders;"
              },
              { t: "p", html: "The bound comes from the consumer, not the pipeline. If finance reads the revenue dashboard at 08:00, the real requirement is that yesterday's data has landed before about 07:30. Write that down as the SLO and then check it." },
              { t: "h", text: "Volume" },
              { t: "p", html: "Volume compares today's row count against what is normal. Use a <strong>median</strong> of the trailing days rather than the mean, because one bad day should not drag the baseline toward itself. Express the gap as a percentage deviation and alert outside a band." },
              { t: "code", lang: "sql", code:
                "-- Daily row counts vs the median of the prior 7 days\n" +
                "WITH daily AS (\n" +
                "  SELECT CAST(order_ts AS DATE) AS d, COUNT(*) AS n\n" +
                "  FROM analytics.orders\n" +
                "  WHERE order_ts >= CURRENT_DATE - 21\n" +
                "  GROUP BY CAST(order_ts AS DATE)\n" +
                ")\n" +
                "SELECT t.d, t.n, b.median_prior,\n" +
                "       100.0 * (t.n - b.median_prior) / NULLIF(b.median_prior, 0) AS pct_deviation\n" +
                "FROM daily t\n" +
                "CROSS JOIN LATERAL (\n" +
                "  SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY p.n) AS median_prior\n" +
                "  FROM daily p\n" +
                "  WHERE p.d BETWEEN t.d - 7 AND t.d - 1\n" +
                ") b\n" +
                "ORDER BY t.d;"
              },
              { t: "widget", id: "bcFreshness" },
              { t: "p", html: "Try it. At the default 4-hour SLO and a \u00b125% band against the 7-day median, the widget flags three late loads (d5, d9, d13) and three volume anomalies: a drop on d6, a spike on d11 and a partial load on d13. That is five bad days, or about 64% attainment. Tighten the band to 5% and a harmless 6% bump on d8 starts alerting too; relax it to 60% and the partial load on d13 is the only volume problem left." },
              { t: "table", headers: ["Knob", "Too tight", "Too loose", "Starting point"], rows: [
                ["Freshness bound", "Pages on normal jitter in upstream delivery", "Consumers see stale data before you do", "Consumer deadline minus the time you need to fix"],
                ["Volume band", "Fires on weekends, holidays and campaigns", "Misses a 30% drop from a lost source partition", "\u00b120\u201330% on a seasonal baseline, then tune from history"],
                ["Baseline window", "A short window chases recent anomalies", "A long window lags real growth", "Same weekday over the last 4\u20136 weeks"]
              ] },
              { t: "note", variant: "warn", html: "Volume that is <em>too high</em> matters as much as too low. A spike often means a file loaded twice or a join that fanned out, and duplicated revenue is worse than missing revenue because nobody questions a good month." },
              { t: "note", variant: "trap", html: "A single global threshold will page you every Sunday and still miss a quiet Tuesday. Seasonality belongs in the <strong>baseline</strong> (compare with the same weekday), not in a wider band." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'the dashboard was empty this morning', 'we loaded the same file twice', 'how do we know a job ran late'. <strong>Say it out loud:</strong> 'I check freshness on both load time and event time against the consumer's deadline, and volume as percentage deviation from a same-weekday median, alerting on both drops and spikes.'" },
              { t: "note", variant: "key", html: "<strong>Freshness against the consumer's deadline; volume against a seasonal median.</strong> These two cheap checks catch most pipeline failures, as long as the baseline carries the seasonality and the band is tuned from history." }
            ]
          },
          {
            id: "schema-quality",
            title: "Schema changes, data contracts and quality checks",
            summary: "Detect breaking shape changes, make producer promises explicit, and test values with null, uniqueness, integrity and range checks.",
            minutes: 12,
            tags: ["schema", "data-contracts", "data-quality", "sql", "testing"],
            blocks: [
              { t: "p", html: "Freshness and volume tell you that data arrived. Schema and quality checks tell you whether it is the <em>right</em> data. The mental model is a set of gates: catch shape changes before they merge, catch bad values before they publish, and catch drift in the distribution before a consumer does." },
              { t: "diagram", id: "data-checks", caption: "Checks layered along the pipeline: contracts at the producer, schema and quality gates before publish, distribution monitors on published tables." },
              { t: "h", text: "Schema-change detection" },
              { t: "p", html: "The simplest detector snapshots the column list from <code class='tok'>information_schema</code> after each load and compares it with the previous snapshot. A <strong>dropped, renamed or retyped</strong> column is breaking and should block. An added nullable column is usually safe and should only notify." },
              { t: "code", lang: "sql", code:
                "-- Compare today's columns with the last snapshot taken\n" +
                "WITH cur AS (\n" +
                "  SELECT column_name, data_type\n" +
                "  FROM information_schema.columns\n" +
                "  WHERE table_schema = 'analytics' AND table_name = 'orders'\n" +
                ")\n" +
                "SELECT COALESCE(c.column_name, s.column_name) AS column_name,\n" +
                "       CASE WHEN c.column_name IS NULL THEN 'dropped'\n" +
                "            WHEN s.column_name IS NULL THEN 'added'\n" +
                "            ELSE 'retyped' END AS change\n" +
                "FROM cur c\n" +
                "FULL OUTER JOIN monitoring.schema_snapshot s\n" +
                "  ON s.table_name = 'analytics.orders' AND s.column_name = c.column_name\n" +
                "WHERE c.column_name IS NULL OR s.column_name IS NULL OR c.data_type <> s.data_type;"
              },
              { t: "h", text: "Data contracts" },
              { t: "p", html: "Detection after the fact is the safety net. A <strong>data contract</strong> moves the check left: the producing team publishes the schema, meaning and service levels as a versioned file, and their CI fails a change that breaks it. A rename becomes a review comment instead of an incident." },
              { t: "code", lang: "yaml", code:
                "contract: analytics.orders\n" +
                "version: 3\n" +
                "owner: team-checkout\n" +
                "consumers: [finance-revenue, ml-churn]\n" +
                "compatibility: backward      # adding nullable columns is fine; drop, rename or retype needs version 4\n" +
                "columns:\n" +
                "  - { name: order_id,    type: string,        required: true, unique: true }\n" +
                "  - { name: customer_id, type: string,        required: true, references: analytics.customers.customer_id }\n" +
                "  - { name: amount,      type: decimal(12,2), required: true, min: 0 }\n" +
                "  - { name: currency,    type: string,        accepted: [USD, EUR, GBP, INR] }\n" +
                "  - { name: order_ts,    type: timestamp,     required: true }\n" +
                "service_levels:\n" +
                "  freshness: loaded within 2h of hour close, 99% of hours over 28 days\n" +
                "  completeness: at least 99.5% of source orders present per day"
              },
              { t: "h", text: "Quality checks in plain SQL" },
              { t: "p", html: "Four families cover most value problems. Write each one so that it <strong>returns the offending rows</strong> (or a count of them): zero rows means pass, and the rows themselves are your debugging starting point." },
              { t: "code", lang: "sql", code:
                "-- 1. Null rate: fail if more than 0.1% of today's orders have no customer\n" +
                "SELECT AVG(CASE WHEN customer_id IS NULL THEN 1.0 ELSE 0 END) AS null_rate\n" +
                "FROM analytics.orders WHERE CAST(order_ts AS DATE) = CURRENT_DATE - 1\n" +
                "HAVING AVG(CASE WHEN customer_id IS NULL THEN 1.0 ELSE 0 END) > 0.001;\n\n" +
                "-- 2. Uniqueness: any order_id that appears more than once\n" +
                "SELECT order_id, COUNT(*) AS copies\n" +
                "FROM analytics.orders GROUP BY order_id HAVING COUNT(*) > 1;\n\n" +
                "-- 3. Referential integrity: orders pointing at customers that do not exist\n" +
                "SELECT o.order_id, o.customer_id\n" +
                "FROM analytics.orders o\n" +
                "LEFT JOIN analytics.customers c ON c.customer_id = o.customer_id\n" +
                "WHERE o.customer_id IS NOT NULL AND c.customer_id IS NULL;\n\n" +
                "-- 4. Accepted ranges and values\n" +
                "SELECT order_id, amount, currency\n" +
                "FROM analytics.orders\n" +
                "WHERE amount < 0 OR amount > 100000\n" +
                "   OR currency NOT IN ('USD', 'EUR', 'GBP', 'INR');"
              },
              { t: "p", html: "<strong>Distribution checks</strong> go one step further: they watch statistics such as the mean order amount, the share of orders per currency or the distinct count of customers, and flag a shift even when every row individually passes. They catch the subtle failures, like a currency conversion applied twice, that row-level tests cannot see." },
              { t: "h", text: "Tooling, by category" },
              { t: "table", headers: ["Category", "What it gives you", "Where it falls short"], rows: [
                ["Tests in the transformation framework (dbt-tests style)", "Declarative not-null, unique, relationship and accepted-value tests next to the model code, run on every build", "Only tests what someone thought to write"],
                ["Expectation suites (Great Expectations style)", "Rich, reusable assertions on values and distributions, with readable reports", "Suites need upkeep as data evolves"],
                ["Data observability platforms", "Automatic freshness, volume, schema and distribution monitors learned from history, plus lineage", "Cost, and learned thresholds still need tuning"],
                ["Warehouse constraints", "Not-null and type enforcement at write time", "Many warehouses do not enforce unique or foreign keys"]
              ] },
              { t: "p", html: "The trade-off is where a check <em>blocks</em>. A blocking test before publish keeps bad data out but makes the table late, turning a correctness problem into a freshness problem. That is usually the right trade for revenue data and the wrong one for an exploratory sandbox. Decide per table, and mark each test as <strong>block</strong> or <strong>warn</strong>." },
              { t: "table", headers: ["Tier", "Schema and quality coverage"], rows: [
                ["Naive", "Find out about renames and duplicates from broken dashboards"],
                ["Solid", "Not-null and unique tests on keys, referential and accepted-value tests on important columns, schema-diff alerts after each load"],
                ["Standout", "Contracts enforced in the producer's CI, blocking tests before publish on top-tier tables, distribution monitors on published data, and every check tagged block or warn with an owner"]
              ] },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I stop bad data at the boundary with contract and schema checks, add null, uniqueness, referential and range checks on critical tables, and route failures to the owning team with severity.</em>" },
              { t: "quiz", id: "data-signals" },
              { t: "note", variant: "key", html: "<strong>Contracts stop breaking changes, tests stop bad values, monitors catch drift.</strong> Write each check to return the offending rows, and decide per table whether a failure blocks publishing or only warns." }
            ]
          }
        ]
      },
      {
        id: "operate",
        name: "Operating Data Pipelines",
        icon: "blocks",
        lessons: [
          {
            id: "lineage-impact",
            title: "Lineage and impact analysis",
            summary: "Use the dependency graph to size the blast radius downstream and narrow the cause upstream.",
            minutes: 9,
            tags: ["lineage", "impact-analysis", "ownership"],
            blocks: [
              { t: "p", html: "Lineage is the dependency graph of your data: which sources feed which staging tables, which marts read them, and which dashboards, exports and ML features sit at the end. When something breaks, it answers the two questions an incident needs first: <strong>who is affected</strong> (walk downstream) and <strong>where did it start</strong> (walk upstream)." },
              { t: "widget", id: "bcLineage" },
              { t: "p", html: "By default the widget breaks <code class='tok'>stg.payments</code>: three downstream assets are impacted, two of them consumer-facing, and three owners need a message. Break <code class='tok'>stg.orders</code> instead and the blast radius doubles, because it feeds both marts. That asymmetry is exactly what lineage should tell you before an incident, so the most-depended-on assets get the strictest checks." },
              { t: "h", text: "How lineage gets collected" },
              { t: "table", headers: ["Source", "How", "Trade-off"], rows: [
                ["SQL parsing", "Parse model SQL or warehouse query logs to find read and write tables", "Broad coverage; struggles with dynamic SQL and scripts"],
                ["Orchestrator metadata", "Each task declares its inputs and outputs", "Accurate where declared; silent where people forget"],
                ["Run events", "Jobs emit start, complete and fail events naming their datasets, following an open lineage event spec", "Runtime truth, including retries; needs instrumentation in every job"],
                ["Manual catalog entries", "Owners document edges by hand", "Works for edges like spreadsheets and exports that no system can see; goes stale"]
              ] },
              { t: "p", html: "<strong>Table-level</strong> lineage is cheap and covers most incident questions. <strong>Column-level</strong> lineage tells you that only <code class='tok'>amount</code> is affected, not the whole table, which shrinks the blast radius and stops you notifying people whose dashboards are fine. It costs much more to compute and maintain, so add it where false alarms are expensive." },
              { t: "h", text: "Make the graph actionable" },
              { t: "ul", items: [
                "Attach an <strong>owner</strong> and an on-call route to every node, so impact analysis produces a notification list rather than a picture.",
                "Tag a <strong>criticality tier</strong>: anything that feeds revenue reporting, billing or a customer-facing feature is tier 1, and tier 1 inherits upstream, so its sources get tier-1 checks too.",
                "Use lineage to <strong>group alerts</strong>: when a source fails, raise one alert on the root and list the downstream impact on it, instead of paging once per affected table.",
                "Run impact analysis <strong>before</strong> a change: a pull request that alters a column should show which consumers read it."
              ] },
              { t: "note", variant: "tip", html: "For how lineage is modeled and captured in the pipeline itself, see <a href='../data-eng-academy/index.html#/orchestration/observability/lineage'>Cascade: lineage</a>." },
              { t: "table", headers: ["Tier", "Using lineage"], rows: [
                ["Naive", "A wiki diagram drawn once, consulted during incidents and wrong"],
                ["Solid", "Table-level lineage generated from SQL and orchestrator metadata, with owners on every node"],
                ["Standout", "Generated lineage with owners and tiers, used to group alerts on the root cause, inherit criticality upstream, and show consumer impact on every schema-changing pull request"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'who uses this table', 'we got 40 alerts for one failure', 'is it safe to drop this column'. <strong>Say it out loud:</strong> 'I walk the lineage graph downstream for blast radius and owners, upstream for root cause, and use it to collapse cascading alerts into one page on the root asset.'" },
              { t: "note", variant: "key", html: "<strong>Downstream for impact, upstream for cause.</strong> Lineage earns its keep when every node carries an owner and a tier, so a failure becomes one grouped alert and a ready-made notification list." }
            ]
          },
          {
            id: "pipeline-telemetry",
            title: "Pipeline telemetry and alerting on data",
            summary: "Emit duration, lag, retries and row counts from the orchestrator as OpenTelemetry spans and metrics, and alert on outcomes without fatigue.",
            minutes: 11,
            tags: ["telemetry", "opentelemetry", "orchestration", "alerting"],
            blocks: [
              { t: "p", html: "Data checks watch the output; pipeline telemetry watches the machine that produces it. You need both. Telemetry explains <em>why</em> a freshness check failed (the upstream task retried four times, or the warehouse queue was saturated), and often warns you before the check fails at all." },
              { t: "table", headers: ["Signal", "What it tells you", "Example metric"], rows: [
                ["Task duration", "Slowdowns that will become freshness misses", "<code class='tok'>pipeline.task.duration</code> (histogram, seconds)"],
                ["Outcome", "Failures and how often runs succeed", "<code class='tok'>pipeline.task.runs</code> (counter, by status)"],
                ["Retries", "Flaky dependencies hiding behind eventual success", "<code class='tok'>pipeline.task.retries</code> (counter)"],
                ["Lag", "How far processed data trails event time", "<code class='tok'>pipeline.dataset.lag</code> (gauge, seconds)"],
                ["Last success", "Freshness from the pipeline's point of view", "<code class='tok'>pipeline.dataset.last_success</code> (gauge, unix time)"],
                ["Rows in and out", "Volume, and drops between stages", "<code class='tok'>pipeline.rows.written</code> (counter)"]
              ] },
              { t: "h", text: "Emitting OpenTelemetry from tasks" },
              { t: "p", html: "Model each pipeline run as a trace and each task as a span, then record metrics with the same small set of attributes. Some orchestrators can emit this natively; otherwise a thin wrapper around task execution covers it. The endpoint and service name come from the environment, never from code." },
              { t: "code", lang: "python", code:
                "import time\n" +
                "from opentelemetry import trace, metrics\n" +
                "from opentelemetry.trace import Status, StatusCode\n\n" +
                "tracer = trace.get_tracer(\"pipelines.orders\")\n" +
                "meter = metrics.get_meter(\"pipelines.orders\")\n" +
                "task_duration = meter.create_histogram(\"pipeline.task.duration\", unit=\"s\")\n" +
                "rows_written = meter.create_counter(\"pipeline.rows.written\")\n\n" +
                "def run_task(pipeline, task_id, dataset, run_id, fn):\n" +
                "    labels = {\"pipeline.name\": pipeline, \"task.id\": task_id, \"dataset\": dataset}\n" +
                "    with tracer.start_as_current_span(\"task \" + task_id, attributes=labels) as span:\n" +
                "        span.set_attribute(\"run.id\", run_id)      # span only: unique per run\n" +
                "        start = time.monotonic()\n" +
                "        status = \"success\"\n" +
                "        try:\n" +
                "            n = fn()\n" +
                "            rows_written.add(n, labels)\n" +
                "            span.set_attribute(\"rows.written\", n)\n" +
                "            return n\n" +
                "        except Exception as exc:\n" +
                "            status = \"failed\"\n" +
                "            span.record_exception(exc)\n" +
                "            span.set_status(Status(StatusCode.ERROR))\n" +
                "            raise\n" +
                "        finally:\n" +
                "            task_duration.record(time.monotonic() - start, dict(labels, status=status))"
              },
              { t: "code", lang: "bash", code:
                "# Set by the deployment, not in code\n" +
                "export OTEL_SERVICE_NAME=orders-pipeline\n" +
                "export OTEL_EXPORTER_OTLP_ENDPOINT=\"<collector-endpoint-from-deploy-config>\"\n" +
                "export OTEL_RESOURCE_ATTRIBUTES=\"deployment.environment=${DEPLOY_ENV},team=data-platform\""
              },
              { t: "note", variant: "trap", html: "<code class='tok'>run.id</code>, partition dates and file names belong on spans, not on metric labels. Each distinct label value creates a new time series, and per-run values grow it without bound. See <a href='#/otel/pipeline/cardinality'>cardinality</a> and <a href='#/otel/signals/traces-spans'>traces and spans</a>." },
              { t: "h", text: "Alerting on data without fatigue" },
              { t: "p", html: "Data alerting fails in a predictable way: a team adds a test for every column, every test can page, one upstream hiccup sets off forty of them, and within a month the channel is muted. The fix is the same as for services: <strong>page on symptoms that consumers feel, and route everything else to a ticket</strong>." },
              { t: "code", lang: "promql", code:
                "# Page: the revenue mart is more than 2h stale (consumer-facing symptom)\n" +
                "time() - max(pipeline_dataset_last_success{dataset=\"analytics.orders\"}) > 7200\n\n" +
                "# Ticket: a task is retrying far more than usual (cause, not yet a symptom)\n" +
                "sum by (task_id) (increase(pipeline_task_retries_total[6h])) > 10"
              },
              { t: "ul", items: [
                "Page only for <strong>tier-1</strong> assets, and only on freshness, completeness or a blocking correctness test. Other failures open tickets.",
                "<strong>Group by lineage</strong>: one alert on the root asset, with downstream impact attached, instead of one per affected table.",
                "Alert on <strong>SLO burn</strong> rather than every single missed check, so a one-off late hour does not page but a run of them does. See <a href='#/slo/budgets/burn-rate'>burn rate</a>.",
                "Give every data alert an <strong>owner and a runbook link</strong>; an alert nobody owns is an alert nobody fixes. See <a href='#/alert/alerting/alert-quality'>alert quality</a>."
              ] },
              { t: "table", headers: ["Tier", "Alerting on data"], rows: [
                ["Naive", "Every test can page; failures go to a shared channel nobody reads"],
                ["Solid", "Tier-1 freshness and blocking tests page the owning team; everything else opens tickets"],
                ["Standout", "Burn-rate alerts on data SLOs, lineage-grouped incidents on the root asset, pipeline telemetry linked from every alert, and a regular review that deletes alerts nobody acted on"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'our data alerts channel is muted', 'the job is slow but nobody noticed', 'how do we instrument the orchestrator'. <strong>Say it out loud:</strong> 'Each run is a trace and each task a span, with duration, retries, lag and rows as low-cardinality metrics; I page only on consumer-facing data SLO burn and send causes to tickets.'" },
              { t: "note", variant: "key", html: "<strong>Telemetry explains, data checks detect, SLO burn pages.</strong> Emit spans and bounded-label metrics from every task, and page only when a tier-1 consumer is actually affected." }
            ]
          },
          {
            id: "data-incidents",
            title: "Responding to a data incident",
            summary: "Stop propagation, quarantine the bad data, tell consumers, then fix and backfill idempotently.",
            minutes: 10,
            tags: ["incident-response", "quarantine", "backfill", "communication"],
            blocks: [
              { t: "p", html: "A data incident differs from a service incident in one important way: <strong>bad data spreads and persists</strong>. A failing API stops hurting the moment you roll it back. A wrong partition keeps flowing into marts, dashboards, feature stores, exports and other teams' copies until someone stops it, and stays wrong in history until someone repairs it. So the first move is containment, not diagnosis. This is <a href='#/inc/response/mitigation-first'>mitigation first</a>, adapted to data." },
              { t: "ol", items: [
                "<strong>Detect and declare.</strong> A check, a consumer or a reconciliation flags it. Name an incident lead and open a channel, exactly as for a service incident.",
                "<strong>Stop propagation.</strong> Pause downstream jobs, hold the publish step, and turn off any reverse-ETL or export that sends data outside the warehouse.",
                "<strong>Scope with lineage.</strong> Walk downstream to list affected assets and owners, and identify the time range of bad partitions.",
                "<strong>Quarantine.</strong> Move the bad partitions out of the published table so consumers fall back to the last good data, not the wrong data.",
                "<strong>Communicate.</strong> Tell consumers what is affected, which numbers not to trust, since when, and when you will update them next.",
                "<strong>Fix and backfill.</strong> Repair the cause, rerun the affected partitions idempotently, and re-validate with the same checks.",
                "<strong>Re-publish and close.</strong> Lift the pause, confirm downstream refreshes, notify consumers, and schedule the postmortem."
              ] },
              { t: "h", text: "Write, audit, publish" },
              { t: "p", html: "The pattern that makes containment cheap is to <strong>never write straight into the published table</strong>. Load into a staging copy, run the blocking checks against it, and only swap or merge it into the published table when they pass. A failed audit leaves consumers on yesterday's good data automatically, which turns a correctness incident into a short freshness miss." },
              { t: "code", lang: "sql", code:
                "-- Quarantine: move the bad partitions aside (keep them as evidence)\n" +
                "INSERT INTO quarantine.orders\n" +
                "SELECT o.*, CURRENT_TIMESTAMP AS quarantined_at, 'INC-0412' AS incident\n" +
                "FROM analytics.orders o\n" +
                "WHERE CAST(o.order_ts AS DATE) BETWEEN DATE '2026-10-24' AND DATE '2026-10-26';\n\n" +
                "DELETE FROM analytics.orders\n" +
                "WHERE CAST(order_ts AS DATE) BETWEEN DATE '2026-10-24' AND DATE '2026-10-26';\n\n" +
                "-- Backfill: overwrite exactly those partitions from the corrected staging load\n" +
                "-- (run it twice and you get the same result: no appends, no duplicates)\n" +
                "INSERT INTO analytics.orders\n" +
                "SELECT * FROM staging.orders_fixed\n" +
                "WHERE CAST(order_ts AS DATE) BETWEEN DATE '2026-10-24' AND DATE '2026-10-26';"
              },
              { t: "note", variant: "warn", html: "Run the delete and insert inside one transaction, or use your warehouse's partition-overwrite or <code class='tok'>MERGE</code> on the primary key. A backfill that <em>appends</em> is the most common way a data incident turns into a second one: every rerun doubles revenue." },
              { t: "h", text: "Severity for data" },
              { t: "table", headers: ["Severity", "Example", "Response"], rows: [
                ["SEV1", "Wrong numbers in an external report, invoice or customer-facing feature", "Page now, stop exports, notify leadership and affected customers' owners"],
                ["SEV2", "Tier-1 internal dashboard wrong or more than a few hours stale", "Page the owner, pause downstream refreshes, banner on the dashboard"],
                ["SEV3", "Non-critical table stale or failing a warn-level test", "Ticket, fix within the working day"]
              ] },
              { t: "p", html: "Communication matters more than in most service incidents, because consumers may already have <em>acted</em> on the bad numbers: sent a forecast, paused a campaign, retrained a model. Say which figures are wrong, over which dates, and whether earlier decisions need revisiting. A banner on the dashboard reaches people the incident channel never will. See <a href='#/inc/response/comms'>incident communication</a>." },
              { t: "compare",
                bad: { title: "Fix-first response", items: ["Start debugging while downstream jobs keep running", "Append a corrected load on top", "Tell consumers once it is fixed", "Close when the job turns green"] },
                good: { title: "Contain-first response", items: ["Pause downstream and exports within minutes", "Quarantine, then overwrite partitions idempotently", "Tell consumers what not to trust, now and on a schedule", "Close when checks pass and consumers confirm"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we found wrong numbers in last week's report', 'the backfill doubled the totals', 'which dashboards are affected'. <strong>Say it out loud:</strong> 'I stop propagation first, quarantine the bad partitions so consumers fall back to good data, tell consumers what not to trust, then overwrite partitions idempotently and re-validate before re-publishing.'" },
              { t: "note", variant: "key", html: "<strong>Contain, quarantine, communicate, then backfill idempotently.</strong> Bad data spreads and persists, so stopping propagation beats diagnosing, and write-audit-publish makes most correctness failures show up as harmless staleness instead." }
            ]
          },
          {
            id: "data-slo-capstone",
            title: "Capstone: a data SLO for the revenue dashboard",
            summary: "Turn everything in this track into one worked design: consumers, SLIs, targets, budget, checks, alerts and policy.",
            minutes: 13,
            tags: ["capstone", "data-slo", "error-budget", "design"],
            blocks: [
              { t: "p", html: "Finance runs the business off a revenue dashboard built on <code class='tok'>analytics.orders</code> and <code class='tok'>stg.payments</code>. It refreshes hourly; the CFO's team reviews yesterday's numbers at 08:00 and intraday numbers through the day. Last quarter it was wrong twice and stale four times, and trust is low. Your job is to design a data SLO that fixes the trust problem, not just the dashboard." },
              { t: "h", text: "Step 1: start from the consumer" },
              { t: "ul", items: [
                "<strong>Who</strong>: finance analysts and leadership, plus a daily export to the planning model.",
                "<strong>What hurts</strong>: wrong numbers are far worse than late ones, because wrong numbers get acted on and late ones get noticed.",
                "<strong>Deadline</strong>: yesterday complete by 07:30; intraday no more than 2 hours behind during business hours.",
                "<strong>Tolerance</strong>: totals must reconcile with the payments ledger within 0.1%."
              ] },
              { t: "h", text: "Step 2: pick SLIs and targets" },
              { t: "table", headers: ["SLI", "Good event / valid event", "Target (28-day rolling)"], rows: [
                ["Freshness", "Hourly checks where <code class='tok'>now - max(loaded_at)</code> \u2264 2h / all hourly checks", "99%"],
                ["Completeness", "Days where warehouse orders are within 0.5% of the source system count / days", "99% (in practice: no more than one miss a quarter)"],
                ["Correctness", "Daily loads passing all blocking tests and ledger reconciliation within 0.1% <em>before publish</em> / daily loads", "Enforced as a publish gate, not a budget"]
              ] },
              { t: "p", html: "Correctness is handled differently on purpose. You do not want a budget that says a few wrong days a month are acceptable. Instead, the write-audit-publish gate blocks any load that fails reconciliation, so a correctness failure shows up as the dashboard staying on the last good data, which spends <strong>freshness</strong> budget. That converts the worst failure mode into the most visible and least harmful one." },
              { t: "h", text: "Step 3: do the budget math" },
              { t: "code", lang: "text", code:
                "freshness checks / 28 days = 28 x 24          = 672\n" +
                "error budget (1%)          = 672 x 0.01        ~= 6.7  -> 6 bad hours\n" +
                "completeness days / 28     = 28\n" +
                "error budget (1%)          = 28 x 0.01         = 0.28 -> a single miss exhausts it\n\n" +
                "fast burn page: 14.4x over 1h  (consumes 2% of the month's budget in an hour)\n" +
                "slow burn page:  6x over 6h\n" +
                "ticket:          1x over 3d"
              },
              { t: "stat", items: [
                { v: "672", k: "hourly freshness checks per 28 days" },
                { v: "~6", k: "stale hours the budget allows" },
                { v: "0.1%", k: "ledger reconciliation tolerance" },
                { v: "07:30", k: "deadline for yesterday's data" }
              ] },
              { t: "h", text: "Step 4: wire the checks to the pillars" },
              { t: "table", headers: ["Pillar", "Check", "Action on failure"], rows: [
                ["Freshness", "Lag on <code class='tok'>loaded_at</code> and <code class='tok'>order_ts</code>, every 15 minutes", "Feeds the SLI; burn-rate alerts page"],
                ["Volume", "Hourly count vs same-hour, same-weekday median, \u00b125%", "Blocks publish if below \u221250%; warns otherwise"],
                ["Schema", "Contract check in the producer's CI, plus a schema diff after each load", "Blocks the producer's merge; blocks publish on a breaking diff"],
                ["Quality", "Unique order_id, not-null customer_id, amount \u2265 0, accepted currencies, ledger reconciliation", "Blocks publish"],
                ["Lineage", "Owners on every upstream node; impact list attached to each alert", "Routes the page to the root asset's owner"]
              ] },
              { t: "h", text: "Step 5: write the policy" },
              { t: "code", lang: "yaml", code:
                "slo: revenue-dashboard\n" +
                "owner: data-platform\n" +
                "consumers: [finance, planning-export]\n" +
                "window: 28d rolling\n" +
                "objectives:\n" +
                "  - sli: freshness            # hourly, lag <= 2h\n" +
                "    target: 0.99\n" +
                "  - sli: completeness         # daily, within 0.5% of source\n" +
                "    target: 0.99\n" +
                "gates:\n" +
                "  correctness: block_publish  # reconciliation within 0.1%, all blocking tests\n" +
                "budget_policy:\n" +
                "  exhausted: freeze non-urgent model changes upstream of analytics.orders; reliability work first\n" +
                "  incident: any blocked publish over 2h opens a SEV2 with a dashboard banner\n" +
                "  review: monthly with finance; targets revisited quarterly"
              },
              { t: "p", html: "The trade-off you are making out loud: blocking publish on reconciliation means some mornings finance sees yesterday's numbers instead of today's. You are choosing late-and-right over on-time-and-wrong, and the freshness budget is what keeps that choice honest. If gates block too often, the budget runs out and the policy forces reliability work upstream. See <a href='#/slo/budgets/error-budgets'>error budgets</a> and <a href='#/slo/budgets/budget-policy'>budget policy</a>." },
              { t: "table", headers: ["Tier", "Data SLO for the revenue dashboard"], rows: [
                ["Naive", "'The dashboard should always be up to date and correct.' No SLI, no number, no owner, so every miss is a surprise and an argument"],
                ["Solid", "Freshness SLO of 99% of hourly checks within 2h over 28 days, alerting on misses, plus not-null and unique tests on keys"],
                ["Standout", "Freshness and completeness SLOs with burn-rate alerts, correctness enforced as a write-audit-publish gate with ledger reconciliation, contracts upstream, lineage-routed pages, and a budget policy agreed with finance that turns exhausted budget into upstream reliability work"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'design monitoring for our revenue pipeline', 'finance doesn't trust the dashboard', 'what SLO would you set for a data product'. <strong>Say it out loud:</strong> 'I start from the consumer's deadline and tolerance, set freshness and completeness SLOs with burn-rate alerts, enforce correctness as a publish gate so wrong data becomes stale data, and agree a budget policy with the consumer.'" },
              { t: "quiz", id: "data-operate" },
              { t: "note", variant: "key", html: "<strong>Budget freshness and completeness; gate correctness.</strong> A good data SLO starts at the consumer's deadline, turns wrong data into late data through write-audit-publish, and uses the freshness budget to decide when upstream reliability work comes first." }
            ]
          }
        ]
      }
    ]
  };
})();
