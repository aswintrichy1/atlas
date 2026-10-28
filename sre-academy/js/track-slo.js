/* =====================================================================
   BEACON · SLIs, SLOs & Error Budgets
   window.TRACKS.slo — modules: sli / budgets

   Self-contained: this file registers its own widgets (bcPercentiles,
   bcBudget, bcBurnRate), its own quizzes (slo-sli, slo-budgets) and
   its track data.
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

  function sig(x) { x = fin(x, 0); return x === 0 ? "0" : String(parseFloat(x.toPrecision(3))); }

  function commas(n) {
    n = Math.round(fin(n, 0));
    var s = String(Math.abs(n)), out = "";
    while (s.length > 3) { out = "," + s.slice(-3) + out; s = s.slice(0, -3); }
    return (n < 0 ? "-" : "") + s + out;
  }

  function count(n) { n = fin(n, 0); return n < 100 ? sig(n) : commas(n); }

  function pct(x, digits) { return (fin(x, 0) * 100).toFixed(digits == null ? 1 : digits) + "%"; }

  /* minutes -> human duration */
  function dur(min) {
    min = fin(min, 0);
    if (min <= 0) return "0 s";
    if (min < 1) return sig(min * 60) + " s";
    if (min < 120) return sig(min) + " min";
    if (min < 48 * 60) return sig(min / 60) + " h";
    return sig(min / 1440) + " days";
  }

  function ms(x) { x = fin(x, 0); return x < 1000 ? Math.round(x) + " ms" : sig(x / 1000) + " s"; }

  function field(label, input, tail) {
    return h("label", { class: "w-field" }, label + " ", input, tail ? " " : null, tail || null);
  }

  var Widgets = {};

  /* ==================================================================
     1. bcPercentiles — a seeded latency distribution with a slow tail
  ================================================================== */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function latencySamples(tailPct, tailMs) {
    var rnd = mulberry32(20261028);
    var n = 1000, out = [], tailN = Math.round(n * tailPct / 100);
    for (var i = 0; i < n; i++) {
      var u1 = 1 - rnd(), u2 = rnd();
      var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      var v = i < tailN ? tailMs * Math.exp(0.25 * z) : 80 * Math.exp(0.35 * z);
      out.push(Math.max(1, fin(v, 80)));
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  function quantile(sorted, p) {
    if (!sorted.length) return 0;
    var idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
    return sorted[idx];
  }

  Widgets.bcPercentiles = function (mount) {
    shell(mount, "simulator", "Why averages lie",
      "1,000 synthetic requests: most are log-normal around 80 ms, and a configurable slice forms a slow tail. Move the tail and the threshold and watch the mean, the percentiles and the threshold-based latency SLI react differently.");
    var st = { tail: 5, tailMs: 1000, thr: 300 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var tailLbl = h("b", {}, st.tail + "%");
    var tailIn = h("input", { type: "range", min: "0", max: "20", step: "1", value: String(st.tail) });
    tailIn.addEventListener("input", function () {
      var v = parseInt(tailIn.value, 10);
      st.tail = isFinite(v) ? Math.max(0, Math.min(20, v)) : 0;
      paint();
    });
    var thrLbl = h("b", {}, ms(st.thr));
    var thrIn = h("input", { type: "range", min: "50", max: "3000", step: "50", value: String(st.thr) });
    thrIn.addEventListener("input", function () {
      var v = parseInt(thrIn.value, 10);
      st.thr = isFinite(v) ? Math.max(50, Math.min(3000, v)) : 300;
      paint();
    });
    controls.appendChild(field("slow tail", tailIn, tailLbl));
    controls.appendChild(segment([[300, "tail 300 ms"], [1000, "tail 1 s"], [3000, "tail 3 s"]], 1, function (v) { st.tailMs = v; paint(); }));
    controls.appendChild(field("threshold", thrIn, thrLbl));

    var W = 560, H = 190, PADB = 28, LO = 10, HI = 10000, BINS = 36;
    function x(v) { var c = Math.max(LO, Math.min(HI, v)); return Math.log(c / LO) / Math.log(HI / LO) * W; }

    function paint() {
      tailLbl.textContent = st.tail + "%";
      thrLbl.textContent = ms(st.thr);
      var s = latencySamples(st.tail, st.tailMs);
      var sum = 0, under = 0, i;
      for (i = 0; i < s.length; i++) { sum += s[i]; if (s[i] <= st.thr) under++; }
      var mean = sum / s.length;
      var p50 = quantile(s, 0.5), p90 = quantile(s, 0.9), p99 = quantile(s, 0.99);

      var bins = [];
      for (i = 0; i < BINS; i++) bins.push(0);
      for (i = 0; i < s.length; i++) {
        var b = Math.floor(x(s[i]) / W * BINS);
        bins[Math.max(0, Math.min(BINS - 1, b))]++;
      }
      var maxBin = 1;
      for (i = 0; i < BINS; i++) if (bins[i] > maxBin) maxBin = bins[i];

      clear(stage);
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "latency histogram" });
      var bw = W / BINS, plotH = H - PADB - 22;
      for (i = 0; i < BINS; i++) {
        var hgt = bins[i] / maxBin * plotH;
        var binHiMs = LO * Math.pow(HI / LO, (i + 1) / BINS);
        svg.appendChild(sv("rect", { x: (i * bw + 1).toFixed(1), y: (H - PADB - hgt).toFixed(1), width: (bw - 2).toFixed(1), height: hgt.toFixed(1),
          fill: binHiMs <= st.thr ? "var(--cyan)" : "var(--rose)" }));
      }
      svg.appendChild(sv("line", { x1: 0, y1: H - PADB, x2: W, y2: H - PADB, stroke: "var(--line)" }));
      var ticks = [10, 100, 1000, 10000];
      for (i = 0; i < ticks.length; i++) {
        svg.appendChild(sv("text", { x: Math.min(W - 24, x(ticks[i]) + 2), y: H - 10, "font-size": "11", style: "fill:var(--text-dim)" }, ms(ticks[i])));
      }
      var marks = [["mean", mean, "var(--amber)"], ["p50", p50, "var(--lime)"], ["p90", p90, "var(--violet)"], ["p99", p99, "var(--accent)"]];
      for (i = 0; i < marks.length; i++) {
        var mx = x(marks[i][1]);
        svg.appendChild(sv("line", { x1: mx, y1: 14, x2: mx, y2: H - PADB, stroke: marks[i][2], "stroke-width": "2" }));
        svg.appendChild(sv("text", { x: Math.min(W - 30, mx + 3), y: 12 + (i % 2) * 11, "font-size": "11", style: "fill:var(--text)" }, marks[i][0]));
      }
      var tx = x(st.thr);
      svg.appendChild(sv("line", { x1: tx, y1: 30, x2: tx, y2: H - PADB, stroke: "var(--text)", "stroke-dasharray": "4 3" }));
      stage.appendChild(svg);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, "log-scale x axis · cyan bins are under the threshold (dashed), rose bins over it"));

      clear(readout);
      readout.appendChild(ro("mean", ms(mean)));
      readout.appendChild(ro("p50", ms(p50)));
      readout.appendChild(ro("p90", ms(p90)));
      readout.appendChild(ro("p99", ms(p99)));
      readout.appendChild(ro("under " + ms(st.thr) + " (latency SLI)", pct(under / s.length, 1)));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. bcBudget — how much error budget is left, and at what pace?
  ================================================================== */
  Widgets.bcBudget = function (mount) {
    shell(mount, "calculator", "Error budget tracker",
      "Set an SLO, a window and traffic, then say how many bad events you have had and how far into the window you are. The tracker converts the budget into minutes and requests and projects where you will land at the current pace.");
    var st = { slo: 99.9, win: 30, monthly: 10000000, badFrac: 0.4, elapsed: 15 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    controls.appendChild(segment([[99, "99%"], [99.5, "99.5%"], [99.9, "99.9%"], [99.95, "99.95%"], [99.99, "99.99%"]], 2, function (v) { st.slo = v; paint(); }));
    controls.appendChild(segment([[7, "7 d"], [28, "28 d"], [30, "30 d"]], 2, function (v) { st.win = v; st.elapsed = Math.min(st.elapsed, v); paint(); }));
    var vol = h("select", {},
      h("option", { value: "1000000" }, "1M / month"),
      h("option", { value: "10000000", selected: "selected" }, "10M / month"),
      h("option", { value: "100000000" }, "100M / month"),
      h("option", { value: "1000000000" }, "1B / month"));
    vol.addEventListener("change", function () {
      var v = parseInt(vol.value, 10);
      st.monthly = isFinite(v) && v > 0 ? v : 10000000;
      paint();
    });
    controls.appendChild(field("requests", vol));

    var badLbl = h("b", {}, "0");
    var badIn = h("input", { type: "range", min: "0", max: "100", step: "1", value: "0" });
    badIn.addEventListener("input", function () {
      var v = parseFloat(badIn.value);
      var budget = budgetReq();
      st.badFrac = isFinite(v) && budget > 0 ? Math.max(0, v / budget) : 0;
      paint(true);
    });
    var dayLbl = h("b", {}, String(st.elapsed));
    var dayIn = h("input", { type: "range", min: "1", max: String(st.win), step: "1", value: String(st.elapsed) });
    dayIn.addEventListener("input", function () {
      var v = parseInt(dayIn.value, 10);
      st.elapsed = isFinite(v) ? Math.max(1, Math.min(st.win, v)) : 1;
      paint(true);
    });
    controls.appendChild(field("bad events so far", badIn, badLbl));
    controls.appendChild(field("days elapsed", dayIn, dayLbl));

    function budgetReq() { return (1 - st.slo / 100) * st.monthly * st.win / 30; }

    function paint(fromSlider) {
      var budget = budgetReq();
      var budgetMin = (1 - st.slo / 100) * st.win * 1440;
      var maxBad = Math.max(1, Math.ceil(budget * 2));
      var step = Math.max(1, Math.round(maxBad / 200));
      var bad = Math.round(st.badFrac * budget);
      if (!fromSlider) {
        badIn.setAttribute("max", String(maxBad));
        badIn.setAttribute("step", String(step));
        badIn.value = String(Math.min(maxBad, bad));
        dayIn.setAttribute("max", String(st.win));
        dayIn.value = String(st.elapsed);
      }
      badLbl.textContent = count(bad);
      dayLbl.textContent = st.elapsed + " / " + st.win;

      var consumed = budget > 0 ? bad / budget : 0;
      var remaining = Math.max(0, budget - bad);
      var projected = consumed * st.win / Math.max(1, st.elapsed);
      var status = consumed >= 1 ? "exhausted" : projected > 1.0005 ? "at risk" : "healthy";
      var fill = status === "exhausted" ? "var(--rose)" : status === "at risk" ? "var(--amber)" : "var(--lime)";
      var ink = status === "exhausted" ? "var(--rose-ink)" : status === "at risk" ? "var(--amber-ink)" : "var(--lime-ink)";

      clear(stage);
      var paceX = Math.min(100, st.elapsed / st.win * 100);
      stage.appendChild(h("div", { style: "position:relative;height:22px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
        h("i", { style: "display:block;height:100%;width:" + Math.min(100, consumed * 100).toFixed(1) + "%;background:" + fill }),
        h("span", { style: "position:absolute;top:0;bottom:0;left:" + paceX.toFixed(1) + "%;width:2px;background:var(--text)" })));
      stage.appendChild(h("div", { style: "display:flex;justify-content:space-between;gap:10px;font-size:0.78rem;color:var(--text-dim);padding-top:6px" },
        h("span", {}, "bar: budget consumed"),
        h("span", {}, "line: share of window elapsed (on-pace mark)"),
        h("span", { style: "color:" + ink + ";font-weight:600" }, status)));

      clear(readout);
      readout.appendChild(ro("total budget", dur(budgetMin) + " · " + count(budget) + " requests"));
      readout.appendChild(ro("consumed", pct(consumed, 1)));
      readout.appendChild(ro("remaining", count(remaining) + " requests (" + dur(Math.max(0, 1 - consumed) * budgetMin) + ")"));
      readout.appendChild(ro("projected at window end", pct(projected, 0)));
      readout.appendChild(ro("status", status));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. bcBurnRate — burn rate, time to exhaustion and which tier fires
  ================================================================== */
  var TIERS = [
    { min: 14.4, name: "page (fast burn: 2% of budget in 1 h)", fill: "var(--rose)", ink: "var(--rose-ink)" },
    { min: 6, name: "page (slow burn: 5% of budget in 6 h)", fill: "var(--rose)", ink: "var(--rose-ink)" },
    { min: 1, name: "ticket (10% of budget in 3 d)", fill: "var(--amber)", ink: "var(--amber-ink)" },
    { min: 0, name: "none", fill: "var(--lime)", ink: "var(--lime-ink)" }
  ];

  Widgets.bcBurnRate = function (mount) {
    shell(mount, "calculator", "Burn-rate alert tiers",
      "Pick an SLO and a sustained error ratio over a 30-day window. The readouts show the burn rate, how long until the budget is gone, and which tier of a multiwindow multi-burn-rate policy would fire if the ratio held steady across both windows.");
    var st = { slo: 99.9, err: 0.01 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    controls.appendChild(segment([[99.9, "99.9%"], [99.95, "99.95%"], [99.99, "99.99%"]], 0, function (v) { st.slo = v; paint(); }));
    var opts = [["0.0001", "0.01%"], ["0.0005", "0.05%"], ["0.001", "0.1%"], ["0.002", "0.2%"], ["0.005", "0.5%"], ["0.01", "1%"], ["0.02", "2%"], ["0.05", "5%"], ["0.1", "10%"]];
    var sel = h("select", {});
    for (var i = 0; i < opts.length; i++) {
      var o = h("option", { value: opts[i][0] }, opts[i][1]);
      if (opts[i][0] === "0.01") o.setAttribute("selected", "selected");
      sel.appendChild(o);
    }
    sel.addEventListener("change", function () {
      var v = parseFloat(sel.value);
      st.err = isFinite(v) && v >= 0 ? v : 0.01;
      paint();
    });
    controls.appendChild(field("error ratio", sel));

    var W = 560, H = 70, LO = 0.1, HI = 1000;
    function x(v) { var c = Math.max(LO, Math.min(HI, v)); return Math.log(c / LO) / Math.log(HI / LO) * W; }

    function paint() {
      var allowed = 1 - st.slo / 100;
      var burn = allowed > 0 ? st.err / allowed : 0;
      var windowH = 720;
      var tteH = burn > 0 ? windowH / burn : -1;
      var c1 = burn / windowH, c6 = burn * 6 / windowH;
      var tier = TIERS[TIERS.length - 1];
      for (var t = 0; t < TIERS.length; t++) if (burn >= TIERS[t].min) { tier = TIERS[t]; break; }

      clear(stage);
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "burn rate scale" });
      svg.appendChild(sv("rect", { x: 0, y: 22, width: x(1), height: 14, fill: "var(--lime)" }));
      svg.appendChild(sv("rect", { x: x(1), y: 22, width: x(6) - x(1), height: 14, fill: "var(--amber)" }));
      svg.appendChild(sv("rect", { x: x(6), y: 22, width: W - x(6), height: 14, fill: "var(--rose)" }));
      var marks = [[1, "1×"], [6, "6×"], [14.4, "14.4×"]];
      for (var m = 0; m < marks.length; m++) {
        svg.appendChild(sv("line", { x1: x(marks[m][0]), y1: 18, x2: x(marks[m][0]), y2: 40, stroke: "var(--text)" }));
        svg.appendChild(sv("text", { x: x(marks[m][0]) + 3, y: 14, "font-size": "11", style: "fill:var(--text-dim)" }, marks[m][1]));
      }
      var bx = x(burn > 0 ? burn : LO);
      svg.appendChild(sv("path", { d: "M" + bx.toFixed(1) + " 40 l-6 10 h12 z", fill: "var(--text)" }));
      svg.appendChild(sv("text", { x: Math.max(4, Math.min(W - 80, bx - 20)), y: 64, "font-size": "11", style: "fill:var(--text)" }, "burn " + sig(burn) + "×"));
      stage.appendChild(svg);
      stage.appendChild(h("div", { style: "font-size:0.82rem;color:" + tier.ink + ";font-weight:600" }, "tier: " + tier.name));

      clear(readout);
      readout.appendChild(ro("burn rate", sig(burn) + "×"));
      readout.appendChild(ro("time to exhaust 30-day budget", tteH < 0 ? "never at this rate" : dur(tteH * 60)));
      readout.appendChild(ro("budget used in 1 h", c1 >= 1 ? "100% (exhausted)" : pct(c1, 2)));
      readout.appendChild(ro("budget used in 6 h", c6 >= 1 ? "100% (exhausted)" : pct(c6, 1)));
      readout.appendChild(ro("fires", tier.name));
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
    "slo-sli": {
      title: "Choosing SLIs — checkpoint",
      sub: "Good over valid, where to measure, and why percentiles beat averages.",
      questions: [
        {
          q: "Which of these is a well-formed SLI?",
          options: [
            "CPU utilisation averaged over five minutes",
            "The number of incidents per quarter",
            "The proportion of valid events that were good, such as successful requests divided by all valid requests",
            "The contractual penalty paid per hour of downtime"
          ],
          answer: 2,
          explain: "An SLI is a ratio of good events to valid events, so it ranges from 0% to 100% and maps directly to user experience. CPU is a cause-level signal, incident counts are an outcome of process, and penalties belong to an SLA, not to measurement."
        },
        {
          q: "Which measurement point catches failures that happen before a request ever reaches your servers, such as DNS or CDN problems?",
          options: [
            "Client-side instrumentation or synthetic probes from outside your network",
            "Application server logs",
            "Load balancer access logs",
            "The database slow-query log"
          ],
          answer: 0,
          explain: "Server and load balancer logs only see requests that arrived. If DNS fails or the CDN misroutes, those logs look perfectly healthy. Client telemetry and external probes see what users see, at the cost of more noise and less control over the measurement."
        },
        {
          q: "Server A reports a p99 of 200 ms and server B a p99 of 800 ms, with equal traffic. What is the p99 across both?",
          options: [
            "500 ms, the average of the two",
            "800 ms, the larger of the two",
            "200 ms, the smaller of the two",
            "It cannot be derived from those two numbers; you need the merged distribution, for example by summing histogram buckets"
          ],
          answer: 3,
          explain: "Percentiles do not average. The combined p99 depends on the shape of both distributions, so it can sit anywhere between the two values. Store histograms, sum their buckets across servers, then compute the quantile from the merged buckets."
        },
        {
          q: "95% of requests take 80 ms and 5% take 2 s. Roughly what is the mean latency?",
          options: ["About 80 ms", "About 176 ms", "About 1 s", "About 2 s"],
          answer: 1,
          explain: "0.95 × 80 + 0.05 × 2000 = 76 + 100 = 176 ms. The mean describes nobody: most users see 80 ms and one in twenty waits two full seconds. That is why latency SLIs use thresholds or percentiles rather than averages."
        },
        {
          q: "A daily revenue dashboard must show yesterday's figures by 06:00. Which SLI type fits best?",
          options: [
            "Availability of the dashboard web server",
            "Throughput of the ingestion job in rows per second",
            "Freshness: the proportion of time, or of reads, where the data is newer than the agreed age",
            "Durability of the underlying storage"
          ],
          answer: 2,
          explain: "The user cares that the numbers are recent, not that the page loads or that the job is fast. A freshness SLI measures exactly that. Throughput and availability can both look fine while the dashboard still shows two-day-old data."
        },
        {
          q: "What is the main advantage of a threshold-based latency SLI, such as 'proportion of requests faster than 300 ms'?",
          options: [
            "It is a good/valid ratio, so it aggregates correctly across servers and plugs straight into an error budget",
            "It is cheaper to store than any other metric",
            "It hides slow requests from dashboards",
            "It removes the need for histograms anywhere"
          ],
          answer: 0,
          explain: "Counting requests under a threshold yields good and valid counts that you can sum across servers, regions and time, unlike percentiles. The result is a ratio, so it shares the same error-budget arithmetic as availability. You still want histograms to choose and revisit the threshold."
        }
      ]
    },
    "slo-budgets": {
      title: "SLOs & error budgets — checkpoint",
      sub: "Targets, budget arithmetic, burn rates and policy.",
      questions: [
        {
          q: "How much unavailability does a 99.9% SLO allow over a 30-day window?",
          options: ["4.32 minutes", "8.76 hours", "21.6 minutes", "43.2 minutes"],
          answer: 3,
          explain: "Thirty days is 43,200 minutes, and 0.1% of that is 43.2 minutes. 8.76 hours is the yearly figure for 99.9%, and 4.32 minutes is the 30-day figure for 99.99%, so both are common mix-ups."
        },
        {
          q: "A service handles 10 million requests in a 30-day window with a 99.95% SLO. How many failed requests does the budget allow?",
          options: ["500", "5,000", "50,000", "50"],
          answer: 1,
          explain: "The budget is 1 − 0.9995 = 0.05% of requests, and 0.0005 × 10,000,000 = 5,000. Request-based budgets make the arithmetic independent of when failures happen, which suits services whose traffic varies by time of day."
        },
        {
          q: "With a 30-day window, how much of the error budget does a 14.4× burn rate consume in one hour?",
          options: ["2%", "14.4%", "0.2%", "5%"],
          answer: 0,
          explain: "One hour is 1/720 of a 30-day window, so a 1× burn uses 1/720 of the budget per hour. At 14.4×, that is 14.4 / 720 = 0.02, or 2%. Losing 2% in an hour means the budget would be gone in about two days, which is why this tier pages."
        },
        {
          q: "A service is burning error budget at a steady 2× over a 30-day window. When will the budget be exhausted?",
          options: ["After 30 days", "After 60 days", "After 15 days", "After 2 days"],
          answer: 2,
          explain: "Time to exhaustion is the window divided by the burn rate: 30 / 2 = 15 days. A burn rate of 1× is defined as exactly using the whole budget by the end of the window, so anything above 1× ends early."
        },
        {
          q: "How should a customer-facing SLA relate to the internal SLO for the same service?",
          options: [
            "The SLA should be stricter than the SLO so customers see the best number",
            "They should be identical so there is only one number to track",
            "SLAs are internal targets and SLOs are external contracts",
            "The SLA should be looser than the internal SLO, so you are warned and can act before contractual penalties apply"
          ],
          answer: 3,
          explain: "The SLA carries money or credits, so it is the line you must never cross. Keeping the SLO stricter gives you an early-warning margin: you start protecting reliability while you are still inside the contract."
        },
        {
          q: "A service has exhausted its error budget mid-window. What does a typical error-budget policy require?",
          options: [
            "Paging the whole engineering organisation until the budget recovers",
            "Lowering the SLO target permanently so the budget refills",
            "Pausing non-critical feature launches and prioritising reliability work until the service is back within budget, with documented exceptions",
            "Ignoring it until the next quarterly planning cycle"
          ],
          answer: 2,
          explain: "The policy turns the budget into a decision rule: when it is spent, the next engineering hours go to reliability. Exceptions such as security fixes are allowed but recorded. Quietly lowering the target defeats the purpose unless the review shows the target itself was wrong."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.slo = {
    id: "slo",
    name: "SLIs, SLOs & Error Budgets",
    short: "SLO",
    color: "#38bdf8",
    tagline: "Measure what users feel, then spend the leftover risk",
    blurb: "Pick indicators that reflect real user experience, from availability and latency to data freshness, and learn why percentiles beat averages. Then set targets users care about, turn them into error budgets you can count in minutes and requests, alert on burn rate, and write the policy that decides what happens when the budget runs out.",
    modules: [
      {
        id: "sli",
        name: "Choosing SLIs",
        icon: "trend",
        lessons: [
          {
            id: "sli-basics",
            title: "SLIs: measuring what users feel",
            summary: "An SLI is good events over valid events, measured as close to the user as you can afford.",
            minutes: 8,
            tags: ["sli", "measurement", "user-experience"],
            blocks: [
              { t: "p", html: "Picture a user tapping a button. A <strong>service level indicator</strong> answers one question about that tap: <em>did it go well?</em> Count the taps that went well, divide by the taps that count, and you have an SLI between 0% and 100%." },
              { t: "code", lang: "text", code:
                "SLI = good events / valid events * 100%\n\n" +
                "availability: requests not returning 5xx   / all valid requests\n" +
                "latency:      requests served under 300 ms / all valid requests\n\n" +
                "example: 9,982,000 good of 10,000,000 valid -> 99.82%"
              },
              { t: "h", text: "Good, valid, and what to exclude" },
              { t: "ul", items: [
                "<strong>Valid</strong> excludes events that say nothing about user experience: health checks, load-test traffic, requests rejected for malformed input.",
                "Client errors (4xx) are usually excluded or counted as good, unless your own bug causes them, such as a broken auth flow returning 401 to everyone.",
                "<strong>Good</strong> must be strict enough to matter: a 200 with an empty or wrong body is not good, so add correctness checks where you can."
              ] },
              { t: "h", text: "Where to measure" },
              { t: "table", headers: ["Point", "Sees", "Misses", "Cost and noise"], rows: [
                ["Application server", "Detailed status and latency per endpoint", "Requests that never arrive; load balancer and network failures", "Cheap, precise, but optimistic"],
                ["Load balancer", "Every request that reached your edge, including backend timeouts", "DNS, CDN and client network problems", "Cheap, a good default"],
                ["Client (browser, app)", "What the user actually experienced, end to end", "Users who could not load the client at all", "Noisy: user networks, devices, ad blockers"],
                ["Synthetic probes", "Known journeys from known places, even with zero traffic", "Real user diversity and rare paths", "Cheap per probe; low volume, so coarse"]
              ] },
              { t: "p", html: "Most teams start at the load balancer because it is cheap, complete for arriving traffic and hard to fool. Add client telemetry or synthetic probes for journeys where failures upstream of you are common, such as mobile apps or global sites." },
              { t: "compare",
                bad: { title: "Indicators that mislead", items: ["CPU and memory usage", "Host uptime", "Average latency", "'No errors in the app log'"] },
                good: { title: "Indicators users would recognise", items: ["Share of checkouts that succeed", "Share of searches under 300 ms", "Share of pages with fresh data", "Measured at the edge or the client"] } },
              { t: "table", headers: ["Tier", "SLI for a login API"], rows: [
                ["Naive", "Server uptime from the host monitoring agent"],
                ["Solid", "Non-5xx responses under 500 ms over all valid login requests, measured at the load balancer"],
                ["Standout", "That, plus a synthetic login probe per region to catch failures before traffic arrives, and correctness checks that a session token was actually issued"]
              ] },
              { t: "note", variant: "trap", html: "Resource metrics are causes, not symptoms. A CPU at 95% may be perfectly fine for users, and a CPU at 20% may sit behind a misconfigured route that fails every request. Keep resource metrics for diagnosis, not for SLIs." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'how do we know the service is healthy', 'dashboards are green but users complain', 'what should we alert on'. <strong>Say it out loud:</strong> 'I define each SLI as good over valid events, measured at the load balancer by default, and add client or synthetic measurement where failures happen before requests reach us.'" },
              { t: "note", variant: "key", html: "<strong>Good over valid, measured near the user.</strong> Exclude events that say nothing about experience, make 'good' strict, and choose the measurement point by what it can and cannot see." }
            ]
          },
          {
            id: "sli-menu",
            title: "The SLI menu",
            summary: "Standard SLI types for request-driven services, data pipelines and storage, and how to tie them to critical user journeys.",
            minutes: 9,
            tags: ["sli", "pipelines", "storage", "user-journeys"],
            blocks: [
              { t: "p", html: "You rarely need to invent an SLI. Think of a short <strong>menu</strong> organised by what the system does for its users, and pick the two or three items that the users of <em>this</em> journey would complain about first." },
              { t: "h", text: "Request / response services" },
              { t: "table", headers: ["SLI", "Good event", "Example"], rows: [
                ["Availability", "Request answered without a server-side error", "Non-5xx responses / valid requests"],
                ["Latency", "Answered faster than a threshold", "Requests under 300 ms / valid requests"],
                ["Quality", "Answered without degradation", "Responses not served from a fallback / valid responses"]
              ] },
              { t: "h", text: "Data processing pipelines" },
              { t: "table", headers: ["SLI", "Good event", "Example"], rows: [
                ["Freshness", "Data is newer than an agreed age when read", "Reads where data age < 1 h / all reads"],
                ["Correctness", "Output matches what a known-good check expects", "Records passing validation / records processed"],
                ["Coverage", "Input that made it to output", "Partitions processed / partitions expected"],
                ["Throughput", "Processing rate above a floor", "Minutes where rate > 5k events/s / minutes measured"]
              ] },
              { t: "h", text: "Storage" },
              { t: "p", html: "<strong>Durability</strong> is the proportion of written data that can still be read back intact. You cannot wait for loss to measure it, so teams combine regular restore tests and checksum scrubbing with modelled durability from replication and repair times." },
              { t: "h", text: "Specification versus implementation" },
              { t: "table", headers: ["Layer", "Says", "Example for checkout"], rows: [
                ["SLI specification", "What users care about, in plain words", "Placing an order succeeds and confirms quickly"],
                ["SLI implementation", "Exactly how and where you count it", "POST /orders at the load balancer, non-5xx and under 800 ms, excluding synthetic traffic"]
              ] },
              { t: "p", html: "Keep the two separate. The specification survives a migration from one load balancer to another; the implementation changes. When someone challenges a number, you can show both what you meant and how you measured it." },
              { t: "h", text: "Critical user journeys" },
              { t: "ol", items: [
                "List the journeys that matter most to users and the business: sign in, search, add to cart, check out.",
                "For each, choose SLIs from the menu: usually availability plus latency, plus freshness if data is involved.",
                "Map each journey to the requests or jobs that implement it, so the SLI measures the journey, not a random endpoint.",
                "Rank journeys; give the top few real SLOs and leave the rest on dashboards until they earn one."
              ] },
              { t: "code", lang: "yaml", code:
                "# sli/checkout.yaml — one journey, two SLIs\n" +
                "journey: place-order\n" +
                "slis:\n" +
                "  - name: availability\n" +
                "    spec: placing an order succeeds\n" +
                "    good: lb_requests{route=\"/orders\",method=\"POST\",code!~\"5..\"}\n" +
                "    valid: lb_requests{route=\"/orders\",method=\"POST\",synthetic=\"false\"}\n" +
                "  - name: latency\n" +
                "    spec: confirmation appears quickly\n" +
                "    good: lb_requests{route=\"/orders\",method=\"POST\",le=\"0.8\"}\n" +
                "    valid: lb_requests{route=\"/orders\",method=\"POST\",synthetic=\"false\"}"
              },
              { t: "note", variant: "tip", html: "If a journey spans several services, measure it once at the entry point. Per-service SLIs are useful for the owning teams, but the user only experiences the journey." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'what SLIs for a batch job', 'our pipeline is late but nobody alerts', 'which endpoints get SLOs'. <strong>Say it out loud:</strong> 'I start from critical user journeys, pick availability and latency for request paths and freshness, correctness and coverage for pipelines, and write the spec separately from the implementation.'" },
              { t: "note", variant: "key", html: "<strong>Order from the menu by journey.</strong> Request paths get availability, latency and quality; pipelines get freshness, correctness, coverage and throughput; storage gets durability — each with a spec and an implementation." }
            ]
          },
          {
            id: "percentiles",
            title: "Percentiles, histograms and why averages lie",
            summary: "Read p50 to p99.9, never average percentiles, store histograms, and prefer threshold-based latency SLIs.",
            minutes: 11,
            tags: ["latency", "percentiles", "histograms", "promql"],
            blocks: [
              { t: "p", html: "Latency is a distribution, not a number. The mental model: a long, thin <strong>tail</strong> of slow requests hides behind a pleasant average, and that tail is exactly where users give up." },
              { t: "h", text: "Reading percentiles" },
              { t: "table", headers: ["Percentile", "Meaning", "Who it describes"], rows: [
                ["p50 (median)", "Half of requests are faster than this", "The typical request"],
                ["p90", "One request in ten is slower", "Common slowness, often visible to every user per session"],
                ["p99", "One in a hundred is slower", "The tail; heavy users hit it many times a day"],
                ["p99.9", "One in a thousand is slower", "Rare events: GC pauses, cold caches, retries"]
              ] },
              { t: "p", html: "A page that makes 50 backend calls is slowed by the slowest of them. With a per-call p99 of 1 s, the chance that at least one of the 50 calls exceeds it is 1 − 0.99⁵⁰ ≈ <strong>39%</strong>. Tail latency at the backend becomes typical latency at the page." },
              { t: "h", text: "Why averages lie" },
              { t: "code", lang: "text", code:
                "95% of requests at 80 ms, 5% at 2,000 ms\n\n" +
                "mean = 0.95 * 80 + 0.05 * 2000 = 76 + 100 = 176 ms\n" +
                "p50  = 80 ms      (nobody actually waits 176 ms)\n" +
                "p99  = 2,000 ms   (one request in twenty waits 2 s)"
              },
              { t: "h", text: "Never average percentiles" },
              { t: "p", html: "If server A has p99 = 200 ms and server B has p99 = 800 ms, the fleet p99 is <em>not</em> 500 ms. It depends on both distributions. The same goes for averaging p99 across minutes to get an hourly p99. Store the raw distribution as a <strong>histogram</strong> (counts per latency bucket), sum the buckets across servers and time, and only then compute the quantile." },
              { t: "code", lang: "promql", code:
                "# p99 across all checkout pods over 5 minutes: sum buckets first, then quantile\n" +
                "histogram_quantile(0.99,\n" +
                "  sum by (le) (rate(http_request_duration_seconds_bucket{job=\"checkout\"}[5m])))\n\n" +
                "# threshold-based latency SLI: share of requests under 300 ms\n" +
                "  sum(rate(http_request_duration_seconds_bucket{job=\"checkout\",le=\"0.3\"}[5m]))\n" +
                "/ sum(rate(http_request_duration_seconds_count{job=\"checkout\"}[5m]))"
              },
              { t: "h", text: "Threshold-based latency SLIs" },
              { t: "p", html: "For SLOs, count requests faster than a threshold instead of tracking a percentile: 'proportion of requests under 300 ms'. It is a good/valid ratio, so it sums cleanly across servers and windows and drops straight into error-budget math. Put a bucket boundary exactly at the threshold, or the estimate will be interpolated." },
              { t: "widget", id: "bcPercentiles" },
              { t: "table", headers: ["Tier", "Latency objective"], rows: [
                ["Naive", "Average latency under 200 ms"],
                ["Solid", "p99 under 800 ms on a dashboard, computed from summed histograms"],
                ["Standout", "Two threshold SLIs — 90% under 300 ms and 99% under 1 s — with bucket boundaries at both thresholds, so the SLO tracks the typical and the tail experience"]
              ] },
              { t: "note", variant: "warn", html: "Percentiles from low traffic are noisy: a p99 over 50 requests is decided by a single request. Use longer windows or threshold ratios when volume is small." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'average latency looks fine but users say it's slow', 'combine p99 across regions', 'what latency SLO should we set'. <strong>Say it out loud:</strong> 'Averages hide the tail and percentiles don't average, so I store histograms, sum buckets before computing quantiles, and set the SLO as the share of requests under a threshold.'" },
              { t: "quiz", id: "slo-sli" },
              { t: "note", variant: "key", html: "<strong>The tail is the experience.</strong> Read p50 through p99.9, never average percentiles, sum histogram buckets first, and express latency SLOs as the share of requests under a threshold." }
            ]
          }
        ]
      },
      {
        id: "budgets",
        name: "SLOs & Error Budgets",
        icon: "diamond",
        lessons: [
          {
            id: "slo-setting",
            title: "Setting SLOs",
            summary: "Targets come from user needs, not from last month's dashboard; choose a window, keep the SLA looser, and start with few.",
            minutes: 9,
            tags: ["slo", "sla", "targets", "windows"],
            blocks: [
              { t: "p", html: "An <strong>SLO</strong> is an SLI plus a target plus a window: '99.9% of checkout requests succeed, measured over 28 days'. The mental model: the SLO is the line between 'users are happy enough' and 'users are starting to notice'." },
              { t: "h", text: "Targets from user needs, not current performance" },
              { t: "ol", items: [
                "Ask what users and the business need: at what failure rate do support tickets, abandonment or churn rise?",
                "Check the measured history: what have you actually delivered over the last few windows?",
                "Check the dependency ceiling: what do your hard dependencies allow?",
                "Pick a target users would notice falling below and you can realistically meet; revisit after a quarter."
              ] },
              { t: "p", html: "Setting the SLO to whatever you hit last month locks in accidental performance. If you were lucky at 99.99%, every future dip becomes a crisis; if you were unlucky at 99%, you normalise bad service." },
              { t: "h", text: "Rolling versus calendar windows" },
              { t: "table", headers: ["Window", "How it works", "Good for", "Watch out for"], rows: [
                ["Rolling (e.g. 28 days)", "Always the last N days, recomputed continuously", "Engineering decisions; matches user memory", "A bad day haunts the number for four weeks"],
                ["Calendar (e.g. month, quarter)", "Resets at a fixed boundary", "Business reporting and SLAs", "Budget 'refills' on the 1st, inviting end-of-month risk"]
              ] },
              { t: "p", html: "A 28-day rolling window contains exactly four of each weekday, so weekly traffic patterns do not skew it. Many teams use a rolling window for engineering and a calendar window for reporting." },
              { t: "h", text: "SLO versus SLA" },
              { t: "code", lang: "text", code:
                "SLI  : share of valid checkout requests that are non-5xx and under 800 ms\n" +
                "SLO  : 99.9% over a rolling 28 days     (internal, drives engineering)\n" +
                "SLA  : 99.5% per calendar month         (contract, credits if missed)\n\n" +
                "margin: the SLO trips long before the SLA does, so you act first"
              },
              { t: "table", headers: ["Kind", "Purpose", "Example"], rows: [
                ["Achievable SLO", "What you commit to now and enforce with an error-budget policy", "99.9% checkout availability"],
                ["Aspirational SLO", "Where you want to be; tracked, not enforced", "99.95% once the database migration lands"]
              ] },
              { t: "ul", items: [
                "Start with <strong>few</strong> SLOs: one or two per critical journey. Twenty SLOs nobody reads are worse than three everybody does.",
                "Write down the rationale next to each target so the next review can challenge the reasoning, not just the number.",
                "Review SLOs every quarter or after major changes; tighten only when users need it and you can afford it."
              ] },
              { t: "table", headers: ["Tier", "Setting a checkout SLO"], rows: [
                ["Naive", "'Five nines', copied from a competitor's marketing page"],
                ["Solid", "99.9% over 28 days, based on user impact and three months of measured history"],
                ["Standout", "That, plus an explicit dependency-ceiling check, a looser SLA with margin, an aspirational target with a dated plan, and a quarterly review"]
              ] },
              { t: "note", variant: "trap", html: "An SLO stricter than users need is not 'extra safe'. It burns engineering time on invisible improvements and blocks launches for no user benefit." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'what target should we set', 'the SLA says 99.9%, so is our SLO 99.9%', 'monthly or rolling'. <strong>Say it out loud:</strong> 'I set targets from user impact and measured history, keep the SLA looser than the SLO, use a rolling 28-day window for engineering, and start with one or two per journey.'" },
              { t: "note", variant: "key", html: "<strong>An SLO is SLI + target + window, chosen from user needs.</strong> Keep the SLA looser, prefer rolling windows for engineering, separate achievable from aspirational, and start with few." }
            ]
          },
          {
            id: "error-budgets",
            title: "Error budgets: the currency of risk",
            summary: "The budget is 1 − SLO, countable in minutes or requests, and meant to be spent on launches and experiments.",
            minutes: 10,
            tags: ["error-budget", "slo", "risk"],
            blocks: [
              { t: "p", html: "If the SLO says how reliable is reliable enough, the <strong>error budget</strong> is everything left over: the amount of unreliability you are allowed to have. The mental model is a bank account that refills over the window and that you are <em>expected</em> to spend." },
              { t: "code", lang: "text", code:
                "error budget = 1 - SLO\n\n" +
                "99.9% over 30 days\n" +
                "  time-based:    0.001 * 43,200 min   = 43.2 min of full outage\n" +
                "  request-based: 0.001 * 10,000,000   = 10,000 failed requests\n\n" +
                "99.99% over 30 days -> 4.32 min, or 1,000 failures per 10M requests"
              },
              { t: "stat", items: [
                { v: "43.2 min", k: "99.9% over 30 days" },
                { v: "0.1%", k: "of requests may fail at 99.9%" },
                { v: "4.32 min", k: "99.99% over 30 days" }
              ] },
              { t: "p", html: "Request-based budgets are usually better for request-driven services: a failure at 3 a.m. with little traffic costs less than one at peak, which matches user impact. Time-based budgets suit things without request counts, such as a batch platform or a network link." },
              { t: "diagram", id: "error-budget-loop", caption: "The SLO defines the budget, releases and incidents spend it, and the remaining balance decides whether the next sprint ships features or reliability work." },
              { t: "h", text: "Spending the budget" },
              { t: "table", headers: ["Spend on", "Why it is worth it", "Typical cost"], rows: [
                ["Feature launches", "Shipping is the point; some risk comes with every change", "A canary that misbehaves for a few minutes"],
                ["Experiments", "Trying a new cache, runtime or database version", "Short regressions caught by automated rollback"],
                ["Planned maintenance", "Upgrades that need a brief degradation", "Minutes of reduced capacity"],
                ["Chaos experiments", "Learning how the system fails before users find out", "Small, controlled error bursts"]
              ] },
              { t: "widget", id: "bcBudget" },
              { t: "compare",
                bad: { title: "Hoarding the budget", items: ["Budget always at 100%: you are over-investing in reliability", "Launches delayed 'just in case'", "No experiments", "The SLO is quietly too loose to matter"] },
                good: { title: "Spending the budget deliberately", items: ["Budget spent mostly on planned change", "Releases speed up when budget is healthy", "Experiments scheduled early in the window", "Incidents still leave margin"] } },
              { t: "note", variant: "tip", html: "Beacon goes operational depth here — tracking, alerting and policy. For error budgets as a design concern, see <a href='../hld-lld-academy/index.html#/hld/reliability/slo-error-budgets'>Blueprint: SLOs and error budgets</a>." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'can we ship this risky change', 'dev and ops disagree on release pace', 'how much downtime is 99.9%'. <strong>Say it out loud:</strong> 'The budget is 1 minus the SLO — 43.2 minutes or 0.1% of requests a month at three nines — and while it lasts we spend it on launches and experiments.'" },
              { t: "note", variant: "key", html: "<strong>Budget = 1 − SLO, and it is meant to be spent.</strong> Count it in requests where you can, in minutes where you must, and let the balance decide release pace." }
            ]
          },
          {
            id: "burn-rate",
            title: "Burn-rate alerting",
            summary: "Alert on how fast the budget is burning, using paired long and short windows, so you page for real threats and ticket for slow leaks.",
            minutes: 12,
            tags: ["burn-rate", "alerting", "promql", "multiwindow"],
            blocks: [
              { t: "p", html: "Alerting on 'error ratio above the SLO' either pages for every blip or reacts far too late. The better mental model is a fuel gauge: alert on <strong>how fast</strong> the budget is draining relative to how fast it is allowed to drain." },
              { t: "h", text: "Burn rate" },
              { t: "code", lang: "text", code:
                "burn rate = observed error ratio / (1 - SLO)\n\n" +
                "1x    -> exactly exhausts the budget at the end of the window\n" +
                "time to exhaustion = window / burn rate\n\n" +
                "SLO 99.9%, error ratio 1%  -> burn = 0.01 / 0.001 = 10x\n" +
                "30-day window / 10         -> budget gone in 3 days\n\n" +
                "budget used = burn * (alert window / SLO window)\n" +
                "14.4x for 1 h -> 14.4 * 1/720  = 0.02 -> 2%\n" +
                "6x    for 6 h -> 6 * 6/720     = 0.05 -> 5%\n" +
                "1x    for 3 d -> 1 * 72/720    = 0.10 -> 10%"
              },
              { t: "h", text: "Multiwindow, multi-burn-rate policy" },
              { t: "table", headers: ["Severity", "Burn rate", "Long window", "Short window", "Budget used when it fires"], rows: [
                ["Page", "14.4×", "1 h", "5 min", "2%"],
                ["Page", "6×", "6 h", "30 min", "5%"],
                ["Ticket", "1×", "3 days", "6 h", "10%"]
              ] },
              { t: "p", html: "Each alert fires only when <strong>both</strong> windows exceed the burn rate. The long window proves the burn is significant, not a 30-second blip. The short window proves it is still happening, so the alert resets within minutes of a fix instead of staying red for the rest of the hour." },
              { t: "code", lang: "yaml", code:
                "# Prometheus rules: checkout, 99.9% SLO over 30 days (budget ratio 0.001)\n" +
                "groups:\n" +
                "  - name: checkout-slo-burn\n" +
                "    rules:\n" +
                "      - record: job:slo_errors:ratio_rate5m\n" +
                "        expr: |\n" +
                "          sum(rate(http_requests_total{job=\"checkout\",code=~\"5..\"}[5m]))\n" +
                "          / sum(rate(http_requests_total{job=\"checkout\"}[5m]))\n" +
                "      - record: job:slo_errors:ratio_rate1h\n" +
                "        expr: |\n" +
                "          sum(rate(http_requests_total{job=\"checkout\",code=~\"5..\"}[1h]))\n" +
                "          / sum(rate(http_requests_total{job=\"checkout\"}[1h]))\n" +
                "      - alert: CheckoutErrorBudgetFastBurn\n" +
                "        expr: |\n" +
                "          job:slo_errors:ratio_rate1h > (14.4 * 0.001)\n" +
                "          and\n" +
                "          job:slo_errors:ratio_rate5m > (14.4 * 0.001)\n" +
                "        for: 2m\n" +
                "        labels: { severity: page }\n" +
                "        annotations:\n" +
                "          summary: checkout is burning error budget at over 14.4x (2% per hour)\n" +
                "          runbook: runbooks/checkout-error-budget.md"
              },
              { t: "p", html: "The 6× and 1× tiers repeat the pattern with 6 h / 30 min and 3 d / 6 h recording rules. Recording the ratios once keeps the alert expressions cheap and identical across tiers." },
              { t: "widget", id: "bcBurnRate" },
              { t: "table", headers: ["Tier", "SLO alerting"], rows: [
                ["Naive", "Page when the 5-minute error ratio exceeds 0.1%"],
                ["Solid", "Page on a single 1-hour burn-rate window above 14.4×"],
                ["Standout", "Multiwindow, multi-burn-rate: two paging tiers and one ticket tier, each requiring both a long and a short window, with a runbook per alert"]
              ] },
              { t: "note", variant: "warn", html: "Low-traffic services break burn-rate math: ten requests an hour with one failure is a 10% error ratio. Add a minimum request count to the alert, lengthen the windows, or use synthetic traffic to give the SLI enough events." },
              { t: "note", variant: "tip", html: "Burn-rate pages are symptom alerts by construction; see <a href='#/alert/alerting/symptom-vs-cause'>symptom vs cause alerting</a> for how they fit with everything else that might page." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'our SLO alerts are noisy', 'we found out about the outage from Twitter', 'alert on error ratio over the SLO'. <strong>Say it out loud:</strong> 'I alert on burn rate with paired windows: 14.4× over an hour with a 5-minute check pages at 2% of budget, 6× over 6 hours pages at 5%, and 1× over 3 days opens a ticket.'" },
              { t: "note", variant: "key", html: "<strong>Alert on burn rate, not raw error ratio.</strong> Burn = error ratio ÷ (1 − SLO); time to exhaustion = window ÷ burn; pair each long window with a short one so alerts are both significant and current." }
            ]
          },
          {
            id: "budget-policy",
            title: "Error-budget policy and SLO governance",
            summary: "Write down, in advance, what happens when the budget runs out, who can grant exceptions, and how often targets are reviewed.",
            minutes: 10,
            tags: ["policy", "governance", "error-budget"],
            blocks: [
              { t: "p", html: "An error budget without a policy is just a chart. The <strong>policy</strong> is the agreement, signed before anyone is under pressure, that turns the chart into decisions: what changes when the budget is low, who decides, and how disputes escalate." },
              { t: "h", text: "What happens at each budget state" },
              { t: "table", headers: ["Budget state", "Release posture", "Engineering focus"], rows: [
                ["Healthy (projected under 100%)", "Normal release cadence; experiments welcome", "Roadmap work"],
                ["At risk (projected over 100%)", "Extra canary bake time; risky launches need sign-off", "Fix the top contributor to burn"],
                ["Exhausted", "Freeze non-critical feature launches", "Reliability work until back within budget"],
                ["Exhausted by one incident", "Freeze until postmortem actions for that incident are done", "The postmortem's prevention items"]
              ] },
              { t: "h", text: "A sample policy" },
              { t: "code", lang: "text", code:
                "ERROR-BUDGET POLICY — checkout-api (owner: team-payments)\n\n" +
                "SLO      99.9% of valid POST /orders succeed under 800 ms, rolling 28 days\n" +
                "Signers  payments engineering lead, checkout product owner, SRE lead\n\n" +
                "1. While budget remains, releases follow the normal process.\n" +
                "2. If the budget is exhausted, non-critical feature launches pause.\n" +
                "   The team works on reliability items until the 28-day SLI is back\n" +
                "   above 99.9%.\n" +
                "3. If a single incident consumes more than 20% of the budget, a\n" +
                "   postmortem is required, with at least one P0 prevention item.\n" +
                "4. Exceptions: security fixes, legal requirements, and changes that\n" +
                "   reduce burn. Each is logged with a reason and an approver.\n" +
                "5. Disputes escalate to the engineering director, who decides within\n" +
                "   two working days.\n" +
                "6. The SLO and this policy are reviewed every quarter."
              },
              { t: "h", text: "Exceptions and escalation" },
              { t: "ul", items: [
                "Exceptions are expected: security patches, regulatory deadlines, and fixes that reduce burn should always ship.",
                "Every exception is logged with who approved it and why; a long exception log is a signal the SLO or policy is wrong.",
                "If the budget was blown by a dependency outside your control, the policy can say so and point the fix at the dependency instead of freezing your team.",
                "Escalation names a single decider and a deadline, so a frozen team is never stuck waiting for a meeting."
              ] },
              { t: "h", text: "Governance cadence" },
              { t: "table", headers: ["Cadence", "Who", "Question"], rows: [
                ["Weekly", "Owning team + SRE", "How much budget did we spend, and on what?"],
                ["Monthly", "Engineering and product leads", "Are any services repeatedly at risk or exhausted?"],
                ["Quarterly", "Signers of the policy", "Is each target still right for users? Tighten, loosen or keep?"]
              ] },
              { t: "table", headers: ["Tier", "Error-budget governance"], rows: [
                ["Naive", "Budgets on a dashboard; nobody agreed what happens when they run out"],
                ["Solid", "A signed policy with a freeze rule, logged exceptions and a quarterly review"],
                ["Standout", "That, plus states short of exhaustion that change release posture early, a single-incident rule tied to postmortems, and SLO review driven by user-impact data rather than by how often the budget ran out"]
              ] },
              { t: "note", variant: "warn", html: "If teams lower the SLO every time the budget runs out, the policy is decorative. Loosening a target is allowed, but only through the quarterly review and with evidence that users do not need the stricter level." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we keep missing our SLO but nothing changes', 'product overrides every freeze', 'who decides when to stop shipping'. <strong>Say it out loud:</strong> 'The policy is signed in advance by engineering and product: exhausted budget pauses non-critical launches, exceptions are logged, one person decides disputes, and targets get reviewed quarterly.'" },
              { t: "quiz", id: "slo-budgets" },
              { t: "note", variant: "key", html: "<strong>Agree the consequences before you need them.</strong> A signed policy turns budget state into release decisions, logs every exception, names one decider, and reviews targets on a fixed cadence." }
            ]
          }
        ]
      }
    ]
  };
})();
