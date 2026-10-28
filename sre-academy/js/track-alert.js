/* =====================================================================
   BEACON · Alerting & On-call
   window.TRACKS.alert — modules: alerting / oncall

   Self-contained: this file registers its own widgets (bcAlertTuner,
   bcOncall), its own quizzes (alert-alerting, alert-oncall) and its
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

  function clamp(x, lo, hi, dflt) { x = fin(x, dflt); return Math.max(lo, Math.min(hi, x)); }

  function sig(x) { x = fin(x, 0); return x === 0 ? "0" : String(parseFloat(x.toPrecision(3))); }

  function field(label, input, tail) {
    return h("label", { class: "w-field" }, label + " ", input, tail ? " " : null, tail || null);
  }

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

  var Widgets = {};

  /* ==================================================================
     1. bcAlertTuner — threshold + for: over a synthetic error-rate series
        240 one-minute samples; real incident at minutes 150-189; blips.
  ================================================================== */
  var INC_START = 150, INC_END = 190, MINUTES = 240;
  var SERIES = (function () {
    var rnd = mulberry32(4242), out = [], i, j;
    for (i = 0; i < MINUTES; i++) out.push(0.25 + rnd() * 0.55);
    var blips = [[28, [2.6, 4.2]], [71, [3.1, 5.8, 3.4]], [95, [1.4, 1.6, 1.7, 1.5, 1.6, 1.4]], [118, [1.8, 2.4, 3.6, 2.2]], [212, [4.6, 2.1]]];
    for (i = 0; i < blips.length; i++) for (j = 0; j < blips[i][1].length; j++) out[blips[i][0] + j] = blips[i][1][j];
    for (i = INC_START; i < INC_END; i++) out[i] = i < INC_START + 6 ? 1.2 + (i - INC_START) * 0.9 : 6.5 + rnd() * 2.5;
    return out;
  })();

  function evaluateAlert(thr, forMin) {
    var run = 0, firing = false, cur = null, eps = [], i;
    for (i = 0; i < MINUTES; i++) {
      var on = SERIES[i] > thr;
      run = on ? run + 1 : 0;
      if (!firing && on && run >= forMin + 1) { firing = true; cur = { start: i, end: i, resolved: null }; eps.push(cur); }
      if (firing) {
        if (on) cur.end = i;
        else { firing = false; cur.resolved = i; }
      }
    }
    for (i = 0; i < eps.length; i++) eps[i].tp = eps[i].start < INC_END && eps[i].end >= INC_START;
    return eps;
  }

  Widgets.bcAlertTuner = function (mount) {
    shell(mount, "simulator", "Alert tuner",
      "Four hours of synthetic one-minute error-rate samples. One real incident (shaded) starts at minute 150 and lasts 40 minutes; everything else is noise and short blips. Move the threshold and the for: duration and watch which pages fire, how precise they are and how late the real incident is caught.");
    var st = { thr: 2, forMin: 0 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var thrLbl = h("b", {}, st.thr + "%");
    var thrIn = h("input", { type: "range", min: "0.5", max: "9", step: "0.5", value: String(st.thr) });
    thrIn.addEventListener("input", function () { st.thr = clamp(parseFloat(thrIn.value), 0.5, 9, 2); paint(); });
    var forLbl = h("b", {}, st.forMin + " min");
    var forIn = h("input", { type: "range", min: "0", max: "15", step: "1", value: String(st.forMin) });
    forIn.addEventListener("input", function () { st.forMin = Math.round(clamp(parseInt(forIn.value, 10), 0, 15, 0)); paint(); });
    controls.appendChild(field("threshold", thrIn, thrLbl));
    controls.appendChild(field("for:", forIn, forLbl));

    var W = 560, H = 200, PADB = 24, TOP = 22, YMAX = 10;
    function x(m) { return m / MINUTES * W; }
    function y(v) { return TOP + (1 - Math.min(YMAX, Math.max(0, v)) / YMAX) * (H - PADB - TOP); }

    function paint() {
      thrLbl.textContent = st.thr + "%";
      forLbl.textContent = st.forMin + " min";
      var eps = evaluateAlert(st.thr, st.forMin), i;
      var tp = 0, fp = 0, firstTp = null, resetMin = null;
      for (i = 0; i < eps.length; i++) {
        if (eps[i].tp) { tp++; if (firstTp === null) firstTp = eps[i]; if (eps[i].resolved !== null) resetMin = eps[i].resolved - INC_END; }
        else fp++;
      }

      clear(stage);
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "error rate with alert firings" });
      svg.appendChild(sv("rect", { x: x(INC_START), y: TOP, width: x(INC_END) - x(INC_START), height: H - PADB - TOP, fill: "var(--rose)", opacity: "0.18" }));
      var pts = [];
      for (i = 0; i < MINUTES; i++) pts.push(x(i).toFixed(1) + "," + y(SERIES[i]).toFixed(1));
      svg.appendChild(sv("polyline", { points: pts.join(" "), fill: "none", stroke: "var(--cyan)", "stroke-width": "1.5" }));
      svg.appendChild(sv("line", { x1: 0, y1: y(st.thr), x2: W, y2: y(st.thr), stroke: "var(--amber)", "stroke-dasharray": "5 3", "stroke-width": "1.5" }));
      svg.appendChild(sv("line", { x1: 0, y1: H - PADB, x2: W, y2: H - PADB, stroke: "var(--line)" }));
      for (i = 0; i < eps.length; i++) {
        var endM = eps[i].resolved !== null ? eps[i].resolved : MINUTES;
        svg.appendChild(sv("rect", { x: x(eps[i].start).toFixed(1), y: 4, width: Math.max(3, x(endM) - x(eps[i].start)).toFixed(1), height: 10, rx: 2,
          fill: eps[i].tp ? "var(--lime)" : "var(--rose)" }));
      }
      var ticks = [0, 60, 120, 180, 240];
      for (i = 0; i < ticks.length; i++) svg.appendChild(sv("text", { x: Math.min(W - 34, x(ticks[i]) + 2), y: H - 8, "font-size": "11", style: "fill:var(--text-dim)" }, ticks[i] + " min"));
      svg.appendChild(sv("text", { x: 4, y: y(st.thr) - 4, "font-size": "11", style: "fill:var(--text)" }, "threshold " + st.thr + "%"));
      stage.appendChild(svg);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" },
        "top strip: lime = page during the real incident, rose = false page · dashed line = threshold · y axis 0-10% errors"));

      clear(readout);
      readout.appendChild(ro("pages fired", eps.length));
      readout.appendChild(ro("true positives", tp));
      readout.appendChild(ro("false positives", fp));
      readout.appendChild(ro("precision", eps.length ? Math.round(tp / eps.length * 100) + "%" : "n/a (no pages)"));
      readout.appendChild(ro("incident detected", firstTp ? "yes (recall 100%)" : "no (recall 0%)"));
      readout.appendChild(ro("detection delay", firstTp ? Math.max(0, firstTp.start - INC_START) + " min" : "missed"));
      readout.appendChild(ro("reset after recovery", firstTp ? (resetMin !== null ? Math.max(0, resetMin) + " min" : "still firing") : "n/a"));
      if (tp > 1) readout.appendChild(ro("flapping", tp + " pages for one incident"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. bcOncall — rotation load per person
  ================================================================== */
  Widgets.bcOncall = function (mount) {
    shell(mount, "calculator", "On-call load calculator",
      "Set team size, rotation length, shift model and how often the service pages. The grid shows one engineer's year (52 weeks across, 7 days down): rose is primary, amber is secondary. The readout compares the load with a sustainable target of at most two incidents per shift.");
    var st = { team: 6, rot: 7, pages: 10, shiftH: 24, secondary: true };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var teamLbl = h("b", {}, String(st.team));
    var teamIn = h("input", { type: "range", min: "2", max: "16", step: "1", value: String(st.team) });
    teamIn.addEventListener("input", function () { st.team = Math.round(clamp(parseInt(teamIn.value, 10), 2, 16, 6)); paint(); });
    var pagesIn = h("input", { type: "number", min: "0", max: "100", step: "1", value: String(st.pages), style: "width:5em" });
    pagesIn.addEventListener("input", function () { st.pages = Math.round(clamp(parseInt(pagesIn.value, 10), 0, 100, 0)); paint(); });
    controls.appendChild(field("team size", teamIn, teamLbl));
    controls.appendChild(segment([[1, "daily"], [7, "1-week"], [14, "2-week"]], 1, function (v) { st.rot = v; paint(); }));
    controls.appendChild(field("pages / week", pagesIn));
    controls.appendChild(segment([[24, "24 h single site"], [12, "12 h follow-the-sun"]], 0, function (v) { st.shiftH = v; paint(); }));
    controls.appendChild(segment([[true, "primary + secondary"], [false, "primary only"]], 0, function (v) { st.secondary = v; paint(); }));

    var CELL = 10, W = 52 * CELL, H = 7 * CELL + 18;

    function paint() {
      teamLbl.textContent = String(st.team);
      var n = Math.max(2, st.team), rot = Math.max(1, st.rot), d;
      var prim = 0, sec = 0, roles = [];
      for (d = 0; d < 364; d++) {
        var slot = Math.floor(d / rot) % n;
        var role = slot === 0 ? 1 : (st.secondary && slot === n - 1 ? 2 : 0);
        roles.push(role);
        if (role === 1) prim++; else if (role === 2) sec++;
      }
      var pps = st.pages * st.shiftH / 168;
      var perStint = st.pages * rot / 7;
      var nightPerWeek = st.shiftH === 24 ? st.pages * 8 / 24 : 0;
      var share = (prim + sec) / 364;
      var load = pps <= 2 ? "sustainable (<= 2 per shift)" : pps <= 4 ? "strained: fix noisy alerts" : "unsustainable: stop and reduce pages";
      var minTeam = st.secondary ? 8 : 4;

      clear(stage);
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "one engineer's on-call year" });
      for (d = 0; d < 364; d++) {
        var r = roles[d];
        svg.appendChild(sv("rect", { x: Math.floor(d / 7) * CELL + 1, y: (d % 7) * CELL + 1, width: CELL - 2, height: CELL - 2, rx: 2,
          fill: r === 1 ? "var(--rose)" : r === 2 ? "var(--amber)" : "var(--surface-solid)" }));
      }
      svg.appendChild(sv("text", { x: 0, y: H - 3, "font-size": "11", style: "fill:var(--text-dim)" }, "week 1"));
      svg.appendChild(sv("text", { x: W - 46, y: H - 3, "font-size": "11", style: "fill:var(--text-dim)" }, "week 52"));
      stage.appendChild(svg);

      clear(readout);
      readout.appendChild(ro("primary weeks / year", sig(prim / 7)));
      if (st.secondary) readout.appendChild(ro("secondary weeks / year", sig(sec / 7)));
      readout.appendChild(ro("time on call", Math.round(share * 100) + "%"));
      readout.appendChild(ro("pages per shift", sig(pps)));
      readout.appendChild(ro("pages per stint", sig(perStint)));
      readout.appendChild(ro("night pages / on-call week", sig(nightPerWeek)));
      readout.appendChild(ro("load", load));
      readout.appendChild(ro("team size check", n >= minTeam ? "ok (>= " + minTeam + ")" : "below " + minTeam + ": burnout risk"));
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
    "alert-alerting": {
      title: "Alerting checkpoint",
      sub: "Symptoms vs causes, alert quality, routing and runbooks.",
      questions: [
        {
          q: "Which of these is the best candidate for a page on a checkout service?",
          options: ["CPU above 80% on any node for 5 minutes", "Database connection pool above 90% utilisation", "Checkout error ratio burning the error budget fast enough to exhaust it within hours", "Any pod restart in the namespace"],
          answer: 2,
          explain: "A page should fire on a symptom users feel and that needs a human now. The error-budget burn condition is both. CPU, pool usage and restarts are causes that often self-heal or never reach users, so they belong on dashboards or tickets."
        },
        {
          q: "What does adding for: 10m to a Prometheus alerting rule do?",
          options: ["The condition must hold on every evaluation for 10 minutes before the alert fires, filtering short blips at the cost of 10 extra minutes of detection delay", "The alert re-notifies every 10 minutes while firing", "The alert automatically resolves after 10 minutes", "The rule is evaluated every 10 minutes instead of every interval"],
          answer: 0,
          explain: "The alert sits in a pending state until the expression has been true for the whole duration. Blips shorter than that never page, but a real incident is also detected that much later, which is the trade-off you tune."
        },
        {
          q: "An alert fired 40 times last month and 10 of those firings matched real incidents. What is its precision?",
          options: ["10%", "40%", "75%", "25%"],
          answer: 3,
          explain: "Precision is true positives divided by all firings: 10 / 40 = 25%. Three of every four pages woke someone for nothing, which is exactly how on-call engineers learn to ignore an alert."
        },
        {
          q: "What is an Alertmanager inhibition rule for?",
          options: ["Muting alerts during a planned time window", "Suppressing dependent alerts while a broader alert is firing, such as per-service errors during a whole-cluster outage, matched on shared labels", "Batching alerts with the same labels into one notification", "Escalating alerts nobody acknowledged"],
          answer: 1,
          explain: "Inhibition says: if a source alert matching these labels is firing, drop target alerts that share the listed labels. Time-boxed muting is a silence, batching is grouping and escalation lives in the incident platform."
        },
        {
          q: "In an Alertmanager route, what does group_wait control?",
          options: ["How often a still-firing group is re-sent", "How long the alert expression must be true", "How long Alertmanager waits after the first alert of a new group before notifying, so related alerts arrive in the same message", "How long a silence lasts"],
          answer: 2,
          explain: "group_wait buffers the first notification of a new group (30 seconds by default) so a burst becomes one page. group_interval governs updates to an existing group and repeat_interval governs re-sending an unchanged one."
        },
        {
          q: "Which runbook property matters most at 3 a.m.?",
          options: ["It opens with what the alert means for users and the first safe mitigation steps, with copy-pasteable commands and a clear escalation path", "It contains the full architecture history of the service", "It lists every engineer who has ever owned the service", "It repeats the root-cause analysis of the last incident"],
          answer: 0,
          explain: "A tired responder needs to know how bad it is and what is safe to try in the first five minutes. Background and history are useful later, but they belong below the triage steps or in linked documents."
        }
      ]
    },
    "alert-oncall": {
      title: "On-call checkpoint",
      sub: "Rotation design, paging hygiene and the tools that deliver pages.",
      questions: [
        {
          q: "A team of four runs a primary-only rotation with one-week shifts. How many weeks per year is each person on call?",
          options: ["4", "13", "26", "52"],
          answer: 1,
          explain: "52 weeks divided across 4 people is 13 weeks each, one week in four. Add a secondary rotation and each person carries 26 weeks of some on-call duty, which is why small teams struggle to staff both roles."
        },
        {
          q: "What is the main benefit of a follow-the-sun rotation?",
          options: ["It halves tooling costs", "It removes the need for alerts", "It eliminates handoffs between people", "Nobody is paged during their night, because each region covers its own daytime hours"],
          answer: 3,
          explain: "Two or three regions split the day so night pages disappear. The cost is more handoffs and the need for consistent runbooks and tooling across sites, since context must survive every switch."
        },
        {
          q: "What belongs in an on-call handoff?",
          options: ["Open incidents, active silences and their expiry, risky changes scheduled for the coming shift, and noisy alerts worth watching", "Only swapping names in the scheduling tool", "Deleting all silences so the next person starts clean", "Reassigning every open ticket to the incoming engineer"],
          answer: 0,
          explain: "A handoff transfers context, not just a pager. Without the list of in-flight problems and silences, the incoming engineer either re-investigates known issues or misses one whose silence is about to expire."
        },
        {
          q: "Which metric best reveals that a rotation is drowning in noise?",
          options: ["Total number of alert rules defined", "Average CPU across the fleet", "Share of pages that needed no action from the responder", "Number of dashboards the team owns"],
          answer: 2,
          explain: "The non-actionable rate measures how often a page wasted someone's attention. A high value means alerts need deleting, tuning or demoting to tickets; rule counts and dashboards say nothing about the responder's experience."
        },
        {
          q: "How do you make sure the paging path itself still works?",
          options: ["Rely on the vendor's uptime commitment", "Run an always-firing watchdog alert and have an independent dead-man's-switch check page when that heartbeat stops arriving", "Send a test page once a year", "Send every alert to two separate chat channels"],
          answer: 1,
          explain: "If the monitoring or routing stack fails, no alert fires and silence looks like health. A heartbeat that must keep arriving turns a broken pipeline into a page, delivered by something that does not share the pipeline's failure modes."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.alert = {
    id: "alert",
    name: "Alerting & On-call",
    short: "ALRT",
    tagline: "Page on pain, route with care, keep humans rested",
    color: "#fb7185",
    blurb: "Decide what deserves a human: alert on symptoms users feel, measure alerts by precision, recall, detection and reset time, route and group them through Alertmanager, and back every page with a runbook. Then design on-call rotations people can sustain, track paging hygiene and choose incident tooling by capability rather than brand.",
    modules: [
      {
        id: "alerting",
        name: "Alerting that people trust",
        icon: "bolt",
        lessons: [
          {
            id: "symptom-vs-cause",
            title: "Symptom-based vs cause-based alerting",
            summary: "Page on what users feel; keep causes on dashboards and tickets.",
            minutes: 9,
            tags: ["alerting", "symptoms", "paging"],
            blocks: [
              { t: "p", html: "Every page interrupts a person, often at night. So the first question for any alert is not <em>is this bad?</em> but <em>does a human need to act on this right now, and would users notice if nobody did?</em> If the answer is no, it is not a page." },
              { t: "p", html: "A <strong>symptom</strong> is something users experience: errors, slowness, missing data. A <strong>cause</strong> is a reason the system might produce symptoms: high CPU, a full queue, a dead replica. Systems have endless causes and only a handful of symptoms, so alerting on symptoms covers failures you never predicted." },
              { t: "table", headers: ["Signal", "Symptom or cause", "Where it belongs"], rows: [
                ["Checkout error ratio above SLO burn threshold", "Symptom", "Page"],
                ["p99 latency of search above objective for 10 min", "Symptom", "Page"],
                ["CPU at 85% on one node", "Cause", "Dashboard"],
                ["One of three replicas down, traffic healthy", "Cause", "Ticket (fix next business day)"],
                ["Disk will be full in 4 hours at current rate", "Cause, but imminent and certain", "Page (predictive)"],
                ["TLS certificate expires in 10 days", "Cause, slow", "Ticket"]
              ] },
              { t: "h", text: "Page vs ticket vs dashboard" },
              { t: "ul", items: [
                "<strong>Page</strong>: user impact now or within hours, and a human can change the outcome. Requires an acknowledgement.",
                "<strong>Ticket</strong>: needs a human, but next business day is fine. Goes to a queue, never to a phone.",
                "<strong>Dashboard / log</strong>: useful during diagnosis; nobody is notified.",
                "Anything that pages and is routinely ignored is a ticket that is wearing the wrong clothes."
              ] },
              { t: "code", lang: "yaml", code:
                "# Symptom alert: users of checkout are seeing errors.\n" +
                "groups:\n" +
                "  - name: checkout-symptoms\n" +
                "    rules:\n" +
                "      - alert: CheckoutErrorRatioHigh\n" +
                "        expr: |\n" +
                "          sum(rate(http_requests_total{service=\"checkout\",code=~\"5..\"}[5m]))\n" +
                "            /\n" +
                "          sum(rate(http_requests_total{service=\"checkout\"}[5m])) > 0.02\n" +
                "        for: 5m\n" +
                "        labels: { severity: page, team: payments }\n" +
                "        annotations:\n" +
                "          summary: \"Checkout error ratio above 2% for 5 minutes\"\n" +
                "          runbook: \"runbooks.shop.example/payments/checkout-errors\"\n" +
                "      - alert: CheckoutReplicaDown        # cause: ticket, not page\n" +
                "        expr: kube_deployment_status_replicas_available{deployment=\"checkout\"} < 3\n" +
                "        for: 30m\n" +
                "        labels: { severity: ticket, team: payments }"
              },
              { t: "compare",
                bad: { title: "Cause-first alerting", items: ["One alert per resource metric", "Pages for problems that self-heal", "Misses failure modes nobody predicted", "Hundreds of rules, low trust"] },
                good: { title: "Symptom-first alerting", items: ["A few alerts per user journey", "Pages only when users hurt", "Catches unknown failure modes", "Causes stay on dashboards for diagnosis"] } },
              { t: "p", html: "The trade-off: symptom alerts tell you <em>that</em> something is wrong, not <em>why</em>. You pay for that with good dashboards and runbooks that walk from the symptom to likely causes. Some causes are still worth a page when failure is both certain and close, such as a disk filling in hours; alert on the predicted time to exhaustion, not on a static percentage." },
              { t: "note", variant: "tip", html: "For how symptom alerts fit into the wider reliability picture of a system design, see <a href='../hld-lld-academy/index.html#/hld/reliability/observability'>Blueprint: Observability</a>." },
              { t: "note", variant: "trap", html: "\"Alert on everything, we can tune later\" never gets tuned. Each new rule should justify itself as a page, a ticket or nothing before it merges." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we get paged for high CPU\", \"too many alerts\", \"we missed an outage even though we had 400 alerts\" — all point to cause-based alerting. Out loud: <em>I would page on SLO symptoms per user journey and demote resource alerts to dashboards or tickets.</em>" },
              { t: "note", variant: "key", html: "<strong>Page on symptoms, diagnose with causes.</strong> A page means users hurt now and a human can help; everything else is a ticket or a graph." }
            ]
          },
          {
            id: "alert-quality",
            title: "Alert quality: precision, recall, detection and reset time",
            summary: "Four numbers that tell you whether an alert deserves to exist.",
            minutes: 11,
            tags: ["alerting", "precision", "recall", "tuning"],
            blocks: [
              { t: "p", html: "Treat every alert as a detector and grade it like one. A detector can be wrong in two ways: it fires when nothing is wrong, or it stays quiet when something is. It can also be right but late, or right but slow to stop." },
              { t: "stat", items: [
                { v: "Precision", k: "of the pages, how many were real" },
                { v: "Recall", k: "of the real incidents, how many paged" },
                { v: "Detection time", k: "incident start to page" },
                { v: "Reset time", k: "recovery to alert resolved" }
              ] },
              { t: "table", headers: ["Measure", "Formula", "Too low means"], rows: [
                ["Precision", "true pages / all pages", "Responders learn to ignore the alert"],
                ["Recall", "incidents caught / all incidents", "Users or support find outages first"],
                ["Detection time", "first page − impact start", "Budget burns before anyone looks"],
                ["Reset time", "alert resolved − impact end", "Stale pages, confusing all-clear, re-pages"]
              ] },
              { t: "widget", id: "bcAlertTuner" },
              { t: "p", html: "Try it: at a 2% threshold with no <code class='tok'>for:</code>, every blip pages. Add <code class='tok'>for: 5m</code> and the blips vanish, but the incident pages a few minutes later. Push the threshold above the incident's level and recall drops to zero: a perfectly quiet, perfectly useless alert." },
              { t: "h", text: "The knobs and what they cost" },
              { t: "table", headers: ["Knob", "Raises", "Costs"], rows: [
                ["Higher threshold", "Precision", "Recall; slow-burn incidents never cross it"],
                ["Longer for:", "Precision (filters blips)", "Detection time, one-for-one"],
                ["Longer rate window ([5m] → [30m])", "Stability", "Detection time and reset time"],
                ["keep_firing_for", "Stops flapping pages", "Reset time"],
                ["Burn-rate on an SLO, two windows", "Precision and recall together", "More rules to understand"]
              ] },
              { t: "code", lang: "yaml", code:
                "- alert: SearchLatencyBurn\n" +
                "  expr: |\n" +
                "    job:slo_errors:ratio_rate1h{service=\"search\"} > (14.4 * 0.001)\n" +
                "    and\n" +
                "    job:slo_errors:ratio_rate5m{service=\"search\"} > (14.4 * 0.001)\n" +
                "  for: 2m\n" +
                "  keep_firing_for: 10m      # hysteresis: do not resolve on one good sample\n" +
                "  labels: { severity: page, team: search }"
              },
              { t: "p", html: "The two-window form above is the standout answer: the long window gives precision, the short window lets the alert reset quickly once the problem stops. The full derivation lives in <a href='#/slo/budgets/burn-rate'>Burn-rate alerting</a>." },
              { t: "table", headers: ["Tier", "Alert design", "Why"], rows: [
                ["Naive", "Static threshold on a raw error count", "Scales with traffic; pages at peak, misses at night"],
                ["Solid", "Error ratio with a for: duration", "Traffic-independent, filters blips, but detection lag is fixed"],
                ["Standout", "Multiwindow burn rate on the SLO, reviewed against last quarter's incidents", "Pages scale with budget damage; precision and recall are measured, not hoped for"]
              ] },
              { t: "note", variant: "warn", html: "You cannot measure precision without labelling pages. Have the responder tag each page <em>actionable</em> or <em>not</em> in the incident tool; a month of tags is enough to rank your worst alerts." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I would grade each page by precision and recall against our incident log, and tune for: and windows knowing every minute of filtering is a minute of detection delay.</em>" },
              { t: "note", variant: "key", html: "<strong>Every alert is a detector with four scores.</strong> Precision and recall trade against each other through thresholds and durations; burn-rate alerts move both in the right direction at once." }
            ]
          },
          {
            id: "routing",
            title: "Routing, grouping, inhibition and silences",
            summary: "How Alertmanager turns a storm of firing rules into one useful page.",
            minutes: 12,
            tags: ["alertmanager", "routing", "grouping", "silences"],
            blocks: [
              { t: "p", html: "Rules decide <em>whether</em> something is wrong. Routing decides <em>who hears about it, how, and how often</em>. Without it a single database failure becomes eighty pages to three teams in two minutes." },
              { t: "diagram", id: "alert-pipeline", caption: "Rules evaluate and fire; Alertmanager groups, inhibits, silences and routes; receivers deliver to an incident platform or a ticket queue." },
              { t: "ol", items: [
                "<strong>Evaluate</strong>: Prometheus (or another rule engine) evaluates rules and sends firing alerts with labels.",
                "<strong>Group</strong>: alerts sharing the <code class='tok'>group_by</code> labels are bundled into one notification.",
                "<strong>Inhibit</strong>: alerts made redundant by a broader firing alert are dropped.",
                "<strong>Silence</strong>: alerts matching an active, time-boxed silence are muted.",
                "<strong>Route</strong>: the label tree picks a receiver: incident platform for pages, queue for tickets.",
                "<strong>Notify and repeat</strong>: the receiver sends; still-firing groups are re-sent on <code class='tok'>repeat_interval</code>."
              ] },
              { t: "code", lang: "yaml", code:
                "# alertmanager.yml — no secrets in the file; keys come from the secret store\n" +
                "route:\n" +
                "  receiver: default-tickets\n" +
                "  group_by: [alertname, service, cluster]\n" +
                "  group_wait: 30s        # buffer the first notification of a new group\n" +
                "  group_interval: 5m     # wait before sending changes to an existing group\n" +
                "  repeat_interval: 4h    # re-send an unchanged, still-firing group\n" +
                "  routes:\n" +
                "    - matchers: [ 'severity=\"page\"', 'team=\"payments\"' ]\n" +
                "      receiver: payments-pager\n" +
                "    - matchers: [ 'severity=\"page\"' ]\n" +
                "      receiver: platform-pager\n" +
                "    - matchers: [ 'severity=\"ticket\"' ]\n" +
                "      receiver: default-tickets\n" +
                "      repeat_interval: 24h\n\n" +
                "inhibit_rules:\n" +
                "  - source_matchers: [ 'alertname=\"ClusterUnreachable\"' ]\n" +
                "    target_matchers: [ 'severity=~\"page|ticket\"' ]\n" +
                "    equal: [cluster]      # only inhibit alerts from the same cluster\n\n" +
                "receivers:\n" +
                "  - name: payments-pager\n" +
                "    pagerduty_configs:\n" +
                "      - routing_key: <from-secret-store>   # injected at deploy time\n" +
                "  - name: platform-pager\n" +
                "    pagerduty_configs:\n" +
                "      - routing_key: <from-secret-store>\n" +
                "  - name: default-tickets\n" +
                "    email_configs:\n" +
                "      - to: oncall-tickets@shop.example\n" +
                "        smarthost: smtp.shop.example:587\n" +
                "        auth_username: alertmanager\n" +
                "        auth_password_file: /etc/alertmanager/secrets/smtp-password"
              },
              { t: "table", headers: ["Mechanism", "Question it answers", "Typical mistake"], rows: [
                ["Grouping", "Which alerts belong in one message?", "group_by on instance: one page per pod"],
                ["Inhibition", "Which alerts are redundant right now?", "No equal labels: one cluster down mutes every cluster"],
                ["Silence", "Which alerts do we knowingly ignore, until when?", "Week-long silence that outlives the maintenance"],
                ["Routing tree", "Who owns this and how urgent is it?", "Missing team label falls through to a catch-all nobody watches"],
                ["repeat_interval", "How often to remind while still firing?", "15 minutes: the pager becomes white noise"]
              ] },
              { t: "code", lang: "bash", code:
                "# Time-boxed silence for a planned database failover (amtool reads its config file)\n" +
                "amtool silence add cluster=eu-1 service=orders-db \\\n" +
                "  --duration=90m --comment=\"Planned failover, change CHG-1042, owner: on-call\"\n" +
                "amtool silence query cluster=eu-1      # verify, then let it expire on its own"
              },
              { t: "compare",
                bad: { title: "Alert storm", items: ["Grouped by instance", "No inhibition", "Open-ended silences", "Every alert pages"] },
                good: { title: "One actionable page", items: ["Grouped by service and cluster", "Broad outage inhibits dependents", "Silences carry a reason and expiry", "Severity label picks page vs ticket"] } },
              { t: "p", html: "The trade-off: aggressive grouping and inhibition reduce noise but can hide a second, independent failure inside the first one's group. Keep <code class='tok'>equal</code> labels tight and make sure the grouped page lists every alert it contains." },
              { t: "note", variant: "warn", html: "Silences are the most dangerous button in alerting. Require a comment, prefer durations measured in hours, and review active silences at every on-call handoff." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>Alertmanager routes by labels to the owning team, groups related alerts into one notification, inhibits symptoms when a broader cause is firing, and silences are time-boxed with an owner.</em>" },
              { t: "note", variant: "key", html: "<strong>Group by owner and blast radius, inhibit the redundant, silence with an expiry.</strong> Routing turns many firing rules into one page that reaches the team that can fix it." }
            ]
          },
          {
            id: "runbooks",
            title: "Runbooks responders actually use",
            summary: "Structure a runbook for a tired human at 3 a.m., and keep it alive.",
            minutes: 9,
            tags: ["runbooks", "alerting", "on-call"],
            blocks: [
              { t: "p", html: "An alert without a runbook transfers the problem from a machine to a person without transferring any knowledge. A good runbook makes a competent engineer who has never seen this service effective in five minutes." },
              { t: "ol", items: [
                "<strong>What this means</strong>: one sentence on user impact and which SLO is burning.",
                "<strong>Check first</strong>: the two or three graphs or queries that confirm or dismiss it.",
                "<strong>Safe mitigations</strong>: rollback, feature flag, failover, scale out — with exact commands.",
                "<strong>Escalate when</strong>: explicit conditions and who to page next.",
                "<strong>Background</strong>: architecture notes, dependencies, past incidents — below the fold."
              ] },
              { t: "code", lang: "text", code:
                "RUNBOOK  CheckoutErrorRatioHigh          owner: payments   reviewed: 2026-09-14\n" +
                "------------------------------------------------------------------------\n" +
                "Meaning   More than 2% of checkout requests fail. Customers cannot pay.\n" +
                "Check     1. Errors by route and code on the checkout dashboard\n" +
                "          2. Deploys in the last hour (deploy log for service=checkout)\n" +
                "          3. Payment-provider dependency latency panel\n" +
                "Mitigate  - Recent deploy?  roll back:  deployctl rollback checkout --to previous\n" +
                "          - New feature path failing?  disable flag  checkout.new-pricing\n" +
                "          - One region only?  shift traffic away from that region\n" +
                "Escalate  No improvement in 15 min, or provider-side errors -> page payments-secondary\n" +
                "          and open an incident at SEV2.\n" +
                "Context   Depends on orders-db and the payment gateway. See past incidents INC-311, INC-342."
              },
              { t: "table", headers: ["Tier", "Runbook", "Effect at 3 a.m."], rows: [
                ["Naive", "A wiki page titled after the alert with a paragraph of history", "Responder reads, then calls the author"],
                ["Solid", "Meaning, checks, mitigations, escalation; linked from the alert annotation", "Most pages handled by whoever is on call"],
                ["Standout", "Same, plus reviewed after every use, safe steps automated behind one command, and dead runbooks fail a lint check", "Common pages mitigate in minutes; runbooks stay true"]
              ] },
              { t: "ul", items: [
                "Link the runbook from the alert itself (an annotation), so the page carries it.",
                "Write commands that can be pasted, with placeholders clearly marked.",
                "Prefer reversible actions first; flag the irreversible ones in bold.",
                "If a runbook says \"just restart it\" every time, automate the restart and fix the cause.",
                "Review the runbook in the postmortem of every incident that used it."
              ] },
              { t: "note", variant: "trap", html: "A runbook that has not been touched in a year is probably wrong. Store runbooks next to the alert rules in version control and show a review date on each one." },
              { t: "p", html: "The trade-off is maintenance: every runbook is documentation that rots. Keep fewer, better alerts and the runbook burden shrinks with them." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I link a runbook from every paging alert with meaning, two or three checks, reversible mitigations with exact commands and explicit escalation conditions — and I review it after every incident that used it.</em>" },
              { t: "quiz", id: "alert-alerting" },
              { t: "note", variant: "key", html: "<strong>Meaning, check, mitigate, escalate — in that order.</strong> A runbook exists to make the first five minutes safe; everything else goes below the fold." }
            ]
          }
        ]
      },
      {
        id: "oncall",
        name: "On-call that people can sustain",
        icon: "shield",
        lessons: [
          {
            id: "oncall-design",
            title: "Designing on-call rotations",
            summary: "Primary and secondary, follow-the-sun, handoffs, compensation and burnout.",
            minutes: 11,
            tags: ["on-call", "rotations", "burnout"],
            blocks: [
              { t: "p", html: "On-call is a promise that someone competent will respond within minutes, at any hour. A rotation spreads that promise across a team. The design goal is that the promise holds <em>and</em> the people holding it are still around next year." },
              { t: "table", headers: ["Model", "How it works", "Good for", "Costs"], rows: [
                ["Primary + secondary, single site", "One person takes pages for 24 h a day during their shift; a secondary backs them up", "Most teams in one region", "Night pages; needs about 8 people to stay humane"],
                ["Follow-the-sun", "Two or three regions each cover their daytime hours", "Global teams, high page volume", "More handoffs; tooling and runbooks must be uniform"],
                ["Business hours + best-effort", "Pages only in working hours; nights go to tickets", "Internal tools with relaxed SLOs", "Only valid if the SLO tolerates a night of impact"],
                ["Shared platform rotation", "One rotation covers several small services", "Small services with low page volume", "Responders know each service less deeply"]
              ] },
              { t: "widget", id: "bcOncall" },
              { t: "p", html: "Mechanism worth stating out loud: a team of <em>N</em> on a primary-only rotation spends <em>1/N</em> of the year on call; adding a secondary doubles it to <em>2/N</em>. Keeping total on-call time near a quarter of working time is why roughly eight people per 24-hour primary/secondary rotation, or six per site for follow-the-sun, is a common floor." },
              { t: "h", text: "Handoffs" },
              { t: "ol", items: [
                "Open incidents and their current state.",
                "Active silences, why they exist and when they expire.",
                "Risky changes scheduled during the next shift.",
                "Alerts that were noisy this shift and the tickets filed for them.",
                "Anything the outgoing person is still holding, explicitly released or handed over."
              ] },
              { t: "h", text: "Compensation and burnout" },
              { t: "ul", items: [
                "Pay or time off for on-call, and extra for pages outside working hours; unpaid on-call signals that interruptions are free.",
                "Protect the morning after a night page: the responder starts late or the day is lighter.",
                "On-call engineers do not carry sprint commitments; their shift work is interrupts, toil reduction and alert tuning.",
                "Watch the trend of pages per shift and night pages per person, not just the total."
              ] },
              { t: "table", headers: ["Tier", "Rotation", "Result"], rows: [
                ["Naive", "Whoever wrote the service carries the pager indefinitely", "Single point of failure, burnout, attrition"],
                ["Solid", "Weekly primary/secondary across 8 people, paid, with a written handoff", "Predictable load, shared knowledge"],
                ["Standout", "Solid plus a page budget (at most two incidents per shift) that triggers alert work when exceeded", "Load is measured and actively kept sustainable"]
              ] },
              { t: "note", variant: "warn", html: "A rotation of three or four people on 24-hour coverage looks fine on a calendar and breaks people in practice. If the team is that small, merge rotations, buy follow-the-sun coverage or relax the SLO for nights." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I size a rotation so each person is on call about one week in six to eight, cap incidents per shift, pair primary with secondary, and protect recovery time after night pages.</em>" },
              { t: "note", variant: "key", html: "<strong>Rotation design is load management.</strong> Size the team so on-call is about a quarter of anyone's time, keep pages per shift at two or fewer, and hand off context, not just the pager." }
            ]
          },
          {
            id: "paging-hygiene",
            title: "Paging hygiene: measure the pager",
            summary: "The handful of metrics and the weekly ritual that keep page volume honest.",
            minutes: 9,
            tags: ["on-call", "metrics", "alert-fatigue"],
            blocks: [
              { t: "p", html: "Alert fatigue is gradual. Nobody decides to ignore pages; they just learn, one false alarm at a time, that most pages do not matter. The fix is to measure the pager the way you measure the service." },
              { t: "table", headers: ["Metric", "Definition", "Healthy target"], rows: [
                ["Pages per shift", "Pages received during one on-call shift", "2 or fewer on average"],
                ["Non-actionable rate", "Share of pages where the responder did nothing useful", "Under 10–20%"],
                ["Off-hours share", "Pages between, say, 22:00 and 07:00 local", "Trending down; each one reviewed"],
                ["Time to acknowledge", "Page sent to human acknowledgement", "Within the agreed response time (often 5–15 min)"],
                ["Auto-resolved before ack", "Pages that cleared themselves before anyone looked", "Near zero; these are blips"],
                ["Top-N noisy alerts", "Alerts ranked by page count", "Top three account for most pages: fix those"],
                ["Runbook coverage", "Paging alerts with a linked runbook", "100%"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Weekly review: which alerts cost the most attention?\n" +
                "SELECT alert_name,\n" +
                "       COUNT(*)                                          AS pages,\n" +
                "       AVG(CASE WHEN actionable THEN 0 ELSE 1 END)       AS non_actionable_rate,\n" +
                "       SUM(CASE WHEN off_hours THEN 1 ELSE 0 END)        AS night_pages,\n" +
                "       SUM(CASE WHEN resolved_before_ack THEN 1 ELSE 0 END) AS self_resolved\n" +
                "FROM   pages\n" +
                "WHERE  sent_at >= CURRENT_DATE - 7\n" +
                "GROUP  BY alert_name\n" +
                "ORDER  BY pages DESC\n" +
                "LIMIT  10;"
              },
              { t: "ol", items: [
                "Every week, the outgoing on-call reviews the page log with the team for 15 minutes.",
                "For each noisy alert pick one action: delete, tune (threshold, for:, window), demote to ticket, or fix the underlying cause.",
                "File the action as a ticket with an owner; track it like any other work.",
                "Report pages per shift and non-actionable rate monthly next to the SLO report."
              ] },
              { t: "compare",
                bad: { title: "Unmeasured pager", items: ["Volume known only by complaint", "Same noisy alert for months", "Tuning happens after someone quits", "Nights treated like days"] },
                good: { title: "Measured pager", items: ["Pages tagged actionable or not", "Top three noisy alerts fixed each month", "Page budget per shift with a trigger", "Night pages individually reviewed"] } },
              { t: "note", variant: "trap", html: "Auto-resolving alerts feel harmless because they close themselves. They still woke someone. A page that resolves before acknowledgement is the clearest sign of a missing <code class='tok'>for:</code> or a too-short window." },
              { t: "p", html: "The trade-off: tuning away pages can lower recall. Check every change against the incident log: if a past incident would no longer have paged, the change went too far." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"on-call is exhausting\", \"people mute the channel\", \"the pager goes off but it's usually nothing\". Out loud: <em>I would tag pages as actionable, rank alerts by noise weekly, and hold a page budget of two per shift.</em>" },
              { t: "note", variant: "key", html: "<strong>Measure the pager like a production service.</strong> Pages per shift, non-actionable rate and night pages tell you when alerting itself has become the incident." }
            ]
          },
          {
            id: "paging-tools",
            title: "Paging and incident tooling",
            summary: "Choose tools by capability: scheduling, escalation, routing, chat and status.",
            minutes: 9,
            tags: ["tooling", "on-call", "incident-platform"],
            blocks: [
              { t: "p", html: "Alertmanager decides <em>what</em> to send; something else must make sure a human actually receives it, acknowledges it and escalates when they do not. That is the job of an <strong>incident platform</strong>: the PagerDuty- or Opsgenie-style category of hosted on-call and incident tools." },
              { t: "table", headers: ["Capability", "What it does", "Must-have detail"], rows: [
                ["On-call scheduling", "Rotations, overrides, follow-the-sun layers", "Easy swaps and overrides without admin help"],
                ["Escalation policies", "Who to page next if nobody acknowledges", "Time-based steps, ending at a manager or secondary"],
                ["Multi-channel delivery", "Push, SMS, voice call", "Voice call as the last resort that wakes people"],
                ["Event routing and dedup", "Merge duplicate events into one incident", "Dedup key from alert labels"],
                ["Chat integration", "Incident channel, commands, timeline capture", "Actions in chat logged automatically"],
                ["Status communication", "Internal and external status pages", "Templates per severity"],
                ["Analytics", "Pages per person, ack times, noisy services", "Exportable for the weekly review"]
              ] },
              { t: "code", lang: "yaml", code:
                "# Escalation policy, expressed generically (most platforms model it this way)\n" +
                "escalation_policy: payments-critical\n" +
                "steps:\n" +
                "  - after: 0m\n" +
                "    notify: schedule/payments-primary     # push, then SMS\n" +
                "  - after: 10m                             # not acknowledged\n" +
                "    notify: schedule/payments-secondary\n" +
                "  - after: 25m\n" +
                "    notify: user/payments-eng-manager\n" +
                "repeat: 2\n" +
                "integration_key: <from-secret-store>"
              },
              { t: "h", text: "Monitor the monitor" },
              { t: "p", html: "If Prometheus, Alertmanager or the network path to the incident platform dies, no alert fires and silence looks like health. Send a heartbeat that must keep arriving and have the receiving side page when it stops." },
              { t: "code", lang: "yaml", code:
                "- alert: Watchdog\n" +
                "  expr: vector(1)                 # always firing, by design\n" +
                "  labels: { severity: heartbeat }\n" +
                "  annotations:\n" +
                "    summary: \"Alerting pipeline heartbeat; absence must page via an independent check\""
              },
              { t: "ul", items: [
                "Host the paging path outside the infrastructure it watches; a region outage must not take out its own pager.",
                "Test escalation quarterly with a real page to a real phone.",
                "Keep integration keys in the secret store and rotate them like any credential.",
                "Export page data; the weekly hygiene review depends on it."
              ] },
              { t: "note", variant: "tip", html: "Build vs buy: self-hosting scheduling and phone delivery is rarely worth it. Buy the delivery and escalation layer, and keep the alert logic (rules, routing, runbooks) in your own version control so you can switch vendors." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I pick paging tools by capability — schedules, escalation, dedup, chat timeline, analytics — host the paging path outside what it watches, and run a dead-man's-switch heartbeat so silence never looks like health.</em>" },
              { t: "quiz", id: "alert-oncall" },
              { t: "note", variant: "key", html: "<strong>Rules decide, platforms deliver, heartbeats prove it works.</strong> Pick incident tooling by scheduling, escalation and analytics, and make the paging path independent of what it monitors." }
            ]
          }
        ]
      }
    ]
  };
})();
