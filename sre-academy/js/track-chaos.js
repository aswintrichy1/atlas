/* =====================================================================
   BEACON · Resilience & Chaos Engineering
   window.TRACKS.chaos — modules: patterns / experiments

   Self-contained: this file registers its own widgets (bcRetryStorm,
   bcBreaker, bcRtoRpo), its own quizzes (chaos-patterns,
   chaos-experiments) and its track data.
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

  function field(label, input, tail) {
    return h("label", { class: "w-field" }, label + " ", input, tail ? " " : null, tail || null);
  }

  function slider(min, max, step, value, onChange) {
    var input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value) });
    input.addEventListener("input", function () {
      var v = parseFloat(input.value);
      onChange(isFinite(v) ? Math.max(min, Math.min(max, v)) : value);
    });
    return input;
  }

  function bar(fraction, fill) {
    var f = Math.max(0, Math.min(1, fin(fraction, 0)));
    return h("span", { style: "display:block;height:12px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
      h("i", { style: "display:block;height:100%;width:" + (f * 100).toFixed(1) + "%;background:" + fill }));
  }

  function barRow(label, fraction, fill, value) {
    return h("div", { style: "display:grid;grid-template-columns:150px 1fr 120px;gap:10px;align-items:center;padding:4px 0" },
      h("span", { style: "font-size:0.84rem" }, label),
      bar(fraction, fill),
      h("span", { style: "font-family:var(--font-mono);font-size:0.8rem" }, value));
  }

  var Widgets = {};

  /* ==================================================================
     1. bcRetryStorm — (r+1)^layers and the controls that cap it
  ================================================================== */
  Widgets.bcRetryStorm = function (mount) {
    shell(mount, "simulator", "Retry storm amplifier",
      "The bottom dependency is hard down. Every layer above it retries each failed call. Choose retries per layer, the depth of the call chain and a retry policy, and see how many calls one user request turns into at each tier.");
    var st = { r: 3, layers: 3, mode: "naive" };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var rLbl = h("b", {}, ""), lLbl = h("b", {}, "");
    controls.appendChild(field("retries per layer", slider(0, 5, 1, st.r, function (v) { st.r = Math.round(v); paint(); }), rLbl));
    controls.appendChild(field("layers", slider(1, 6, 1, st.layers, function (v) { st.layers = Math.round(v); paint(); }), lLbl));
    controls.appendChild(segment([["naive", "immediate retries"], ["jitter", "backoff + jitter"], ["budget", "retry budget 10%"], ["edge", "retry at edge only"]], 0,
      function (v) { st.mode = v; paint(); }));

    function perTier(k) {
      var a = st.r + 1;
      if (st.mode === "budget") return Math.pow(Math.min(a, 1.1), k);
      if (st.mode === "edge") return a;
      return Math.pow(a, k);
    }

    function paint() {
      rLbl.textContent = String(st.r);
      lLbl.textContent = String(st.layers);
      var total = fin(perTier(st.layers), 1);
      var spread = st.mode === "jitter" ? Math.max(1, st.r + 1) : 1;
      var peak = total / spread;
      var maxV = Math.max(1, Math.pow(st.r + 1, st.layers));
      var logMax = Math.log(1 + maxV);

      clear(stage);
      for (var k = 1; k <= st.layers; k++) {
        var v = fin(perTier(k), 1);
        var frac = logMax > 0 ? Math.log(1 + v) / logMax : 0;
        var fill = v >= 20 ? "var(--rose)" : v >= 4 ? "var(--amber)" : "var(--lime)";
        stage.appendChild(barRow("calls into tier " + k, frac, fill, sig(v) + "× per request"));
      }
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-top:4px" },
        "log-scale bars · tier " + st.layers + " is the failing dependency"));

      clear(readout);
      readout.appendChild(ro("amplification at the bottom", sig(total) + "×"));
      readout.appendChild(ro("worst case (r+1)^layers", sig(maxV) + "×"));
      readout.appendChild(ro("peak burst (model)", sig(peak) + "×"));
      readout.appendChild(ro("verdict", st.mode === "jitter" ? "same total work, spread out in time" :
        total > 10 ? "retry storm: the outage is now also an overload" : total > 2 ? "noticeable extra load" : "contained"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. bcBreaker — step-through circuit breaker state machine
  ================================================================== */
  Widgets.bcBreaker = function (mount) {
    shell(mount, "step-through", "Circuit breaker state machine",
      "Drive a breaker by hand. In closed it counts consecutive failures; at the threshold it opens and fails calls fast without touching the dependency. After the cooldown it goes half-open and lets one trial call decide whether to close or reopen.");
    var st = { state: "closed", fails: 0, threshold: 5, shorted: 0, reached: 0, log: ["breaker created: closed"] };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function note(msg) { st.log.unshift(msg); if (st.log.length > 5) st.log.length = 5; }

    function send(ok) {
      if (st.state === "open") { st.shorted++; note("rejected fast: breaker is open, dependency not called"); return paint(); }
      st.reached++;
      if (st.state === "half-open") {
        if (ok) { st.state = "closed"; st.fails = 0; note("trial call succeeded: half-open → closed"); }
        else { st.state = "open"; note("trial call failed: half-open → open, cooldown restarts"); }
        return paint();
      }
      if (ok) { if (st.fails) note("success: failure count reset from " + st.fails); else note("success"); st.fails = 0; }
      else {
        st.fails++;
        if (st.fails >= st.threshold) { st.state = "open"; note("failure " + st.fails + "/" + st.threshold + ": closed → open"); }
        else note("failure " + st.fails + "/" + st.threshold);
      }
      paint();
    }
    function cooldown() {
      if (st.state === "open") { st.state = "half-open"; note("cooldown elapsed: open → half-open"); }
      else note("cooldown only matters while open");
      paint();
    }

    controls.appendChild(h("button", { type: "button", class: "w-btn primary", onclick: function () { send(false); } }, "send failing request"));
    controls.appendChild(h("button", { type: "button", class: "w-btn", onclick: function () { send(true); } }, "send ok request"));
    controls.appendChild(h("button", { type: "button", class: "w-btn", onclick: cooldown }, "advance cooldown"));
    controls.appendChild(segment([[3, "threshold 3"], [5, "threshold 5"]], 1, function (v) {
      st.threshold = v; if (st.state === "closed" && st.fails >= v) { st.state = "open"; note("threshold lowered: closed → open"); } paint();
    }));
    controls.appendChild(h("button", { type: "button", class: "w-btn ghost", onclick: function () {
      st.state = "closed"; st.fails = 0; st.shorted = 0; st.reached = 0; st.log = ["reset: closed"]; paint();
    } }, "reset"));

    var STATES = [["closed", "CLOSED", 20], ["open", "OPEN", 210], ["half-open", "HALF-OPEN", 400]];
    function paint() {
      clear(stage);
      var svg = sv("svg", { viewBox: "0 0 560 110", width: "100%", role: "img", "aria-label": "breaker state" });
      for (var i = 0; i < STATES.length; i++) {
        var on = STATES[i][0] === st.state;
        svg.appendChild(sv("rect", { x: STATES[i][2], y: 20, width: 140, height: 54, rx: 10,
          fill: on ? (st.state === "open" ? "var(--rose)" : st.state === "closed" ? "var(--lime)" : "var(--amber)") : "var(--surface-solid)", stroke: "var(--line)" }));
        svg.appendChild(sv("text", { x: STATES[i][2] + 70, y: 52, "text-anchor": "middle", "font-size": "14", "font-weight": "700",
          style: "fill:" + (on ? "var(--on-accent)" : "var(--text)") }, STATES[i][1]));
      }
      svg.appendChild(sv("line", { x1: 160, y1: 47, x2: 210, y2: 47, stroke: "var(--text-dim)", "stroke-width": "2" }));
      svg.appendChild(sv("line", { x1: 350, y1: 47, x2: 400, y2: 47, stroke: "var(--text-dim)", "stroke-width": "2" }));
      svg.appendChild(sv("path", { d: "M470 74 Q 290 112 90 74", fill: "none", stroke: "var(--text-dim)", "stroke-width": "2", "stroke-dasharray": "4 3" }));
      svg.appendChild(sv("text", { x: 185, y: 14, "text-anchor": "middle", "font-size": "11", style: "fill:var(--text-dim)" }, "threshold hit"));
      svg.appendChild(sv("text", { x: 375, y: 14, "text-anchor": "middle", "font-size": "11", style: "fill:var(--text-dim)" }, "cooldown"));
      svg.appendChild(sv("text", { x: 280, y: 106, "text-anchor": "middle", "font-size": "11", style: "fill:var(--text-dim)" }, "trial ok → closed · trial fails → open"));
      stage.appendChild(svg);
      var list = h("ul", { style: "margin:6px 0 0;padding-left:18px;font-size:0.82rem" });
      for (var j = 0; j < st.log.length; j++) list.appendChild(h("li", { style: j === 0 ? "color:var(--text)" : "color:var(--text-dim)" }, st.log[j]));
      stage.appendChild(list);

      clear(readout);
      readout.appendChild(ro("state", st.state));
      readout.appendChild(ro("consecutive failures", st.fails + " / " + st.threshold));
      readout.appendChild(ro("calls reaching dependency", st.reached));
      readout.appendChild(ro("short-circuited", st.shorted));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. bcRtoRpo — DR strategy vs RTO, RPO and cost
  ================================================================== */
  var DR = [
    { id: "backup", name: "Backup & restore", rto: 480, rpo: 1440, rtoTxt: "~8 h", rpoTxt: "up to 24 h (nightly)", cost: 0.1, costTxt: "+5–10%" },
    { id: "pilot", name: "Pilot light", rto: 60, rpo: 5, rtoTxt: "~1 h", rpoTxt: "~5 min (async replica)", cost: 0.25, costTxt: "+15–25%" },
    { id: "warm", name: "Warm standby", rto: 15, rpo: 1, rtoTxt: "~15 min", rpoTxt: "~1 min", cost: 0.5, costTxt: "+40–60%" },
    { id: "active", name: "Active-active", rto: 1, rpo: 0.1, rtoTxt: "~1 min", rpoTxt: "seconds (0 if synchronous)", cost: 1, costTxt: "+100% or more" }
  ];
  var TARGETS = [
    [{ rto: 1440, rpo: 1440 }, "target 24 h / 24 h"],
    [{ rto: 120, rpo: 15 }, "target 2 h / 15 min"],
    [{ rto: 15, rpo: 1 }, "target 15 min / 1 min"],
    [{ rto: 2, rpo: 0.5 }, "target 2 min / ~0"]
  ];

  Widgets.bcRtoRpo = function (mount) {
    shell(mount, "compare", "DR strategy chooser",
      "Pick a disaster recovery strategy and a business target. Bars show typical recovery time (RTO), data-loss window (RPO) and the added running cost relative to a single region. Real numbers vary with your system; the ordering does not.");
    var st = { s: 1, t: 1 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var pairs = [];
    for (var i = 0; i < DR.length; i++) pairs.push([i, DR[i].name]);
    controls.appendChild(segment(pairs, st.s, function (v) { st.s = v; paint(); }));
    var tpairs = [];
    for (i = 0; i < TARGETS.length; i++) tpairs.push([i, TARGETS[i][1]]);
    controls.appendChild(segment(tpairs, st.t, function (v) { st.t = v; paint(); }));

    var LOGMAX = Math.log(1 + 1440);
    function meets(d, t) { return d.rto <= t.rto && d.rpo <= t.rpo; }

    function paint() {
      var d = DR[st.s] || DR[0], t = (TARGETS[st.t] || TARGETS[0])[0];
      clear(stage);
      stage.appendChild(barRow("RTO (downtime)", Math.log(1 + d.rto) / LOGMAX, d.rto <= t.rto ? "var(--lime)" : "var(--rose)", d.rtoTxt));
      stage.appendChild(barRow("RPO (data loss)", Math.log(1 + d.rpo) / LOGMAX, d.rpo <= t.rpo ? "var(--lime)" : "var(--rose)", d.rpoTxt));
      stage.appendChild(barRow("added cost", d.cost, "var(--violet)", d.costTxt));
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-top:4px" },
        "time bars are log scale (1 min to 24 h) · green meets the selected target, rose misses it"));

      var cheapest = "none of these";
      for (var j = 0; j < DR.length; j++) if (meets(DR[j], t)) { cheapest = DR[j].name; break; }
      clear(readout);
      readout.appendChild(ro("strategy", d.name));
      readout.appendChild(ro("meets target", meets(d, t) ? "yes" : "no"));
      readout.appendChild(ro("cheapest that meets it", cheapest));
      readout.appendChild(ro("relative cost", d.costTxt));
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
    "chaos-patterns": {
      title: "Resilience patterns checkpoint",
      sub: "Failure modes, timeouts, retries, breakers, bulkheads and degradation.",
      questions: [
        {
          q: "Which situation best describes a gray failure?",
          options: ["A process crashes and the orchestrator restarts it", "A disk fills up and writes fail with clear errors", "A DNS provider is completely unreachable", "Health checks keep passing while a share of real user requests fail or are very slow"],
          answer: 3,
          explain: "A gray failure is one where the system's own view of its health disagrees with what users experience. Crashes and clear errors are easy to detect and route around; gray failures need user-facing signals such as success-rate SLIs from the caller side."
        },
        {
          q: "A call chain has three layers and each layer makes up to 4 attempts (1 try plus 3 retries) on failure. If the bottom dependency is down, how many calls can one user request produce at the bottom?",
          options: ["12", "64", "9", "4"],
          answer: 1,
          explain: "Retries multiply across layers: 4 × 4 × 4 = 64 calls into the failing dependency per user request. That turns an outage into an overload, which is why retries should happen at one layer and be capped by a retry budget."
        },
        {
          q: "Why add random jitter to exponential backoff?",
          options: ["It desynchronises clients so their retries do not arrive in waves at the same moments", "It reduces the total number of retries to zero", "It makes each timeout longer", "It is required for requests to be idempotent"],
          answer: 0,
          explain: "Clients that failed together and back off by identical delays retry together, hitting the recovering service in synchronised spikes. Randomising the delay spreads those retries out. It does not reduce total retry work, which is what budgets are for."
        },
        {
          q: "What happens in the half-open state of a circuit breaker?",
          options: ["All traffic flows normally while failures are counted", "Every call is rejected immediately", "A limited number of trial calls are allowed through; success closes the breaker and failure reopens it", "The breaker is disabled until someone resets it"],
          answer: 2,
          explain: "Half-open is the probe phase after the cooldown. A small number of trial calls tests whether the dependency recovered without exposing it to full load. Closed counts failures and open rejects everything, so neither is half-open."
        },
        {
          q: "When is it safe for a client to retry a timed-out POST that creates a payment?",
          options: ["Never; POST requests must not be retried", "When the request carries an idempotency key the server uses to deduplicate, so a repeat returns the original result", "When the client doubles the timeout first", "Only when the client is a mobile app"],
          answer: 1,
          explain: "A timeout does not tell you whether the server processed the request. With an idempotency key, the server records the outcome and returns it for repeats instead of charging twice. Without one, a retry can create a duplicate payment."
        },
        {
          q: "A service is overloaded. Where should it shed load?",
          options: ["As early and cheaply as possible, at the edge or on admission, by priority, before expensive work starts", "At the database, once queries begin to time out", "After processing, by dropping the responses", "Nowhere; autoscaling will catch up"],
          answer: 0,
          explain: "Rejecting a request before it consumes CPU, memory and downstream calls is cheap and keeps the remaining work fast. Shedding late wastes the work already done, and autoscaling is far too slow to absorb a sudden overload."
        }
      ]
    },
    "chaos-experiments": {
      title: "Chaos and DR checkpoint",
      sub: "Experiment design, game days, RTO, RPO and recovery drills.",
      questions: [
        {
          q: "What is a steady-state hypothesis in a chaos experiment?",
          options: ["A measurable statement of normal behaviour, such as checkout success above 99.5% and p99 under 400 ms, that you expect to hold during the fault", "A claim that the system never fails", "A requirement that CPU stays below 50%", "A promise that no alerts will fire"],
          answer: 0,
          explain: "The hypothesis is defined in terms of user-facing outputs you can measure, and the experiment tries to disprove it. Internal metrics like CPU may change a lot without users noticing, and alerts firing can be the correct response to the fault."
        },
        {
          q: "How should your first chaos experiment in production be scoped?",
          options: ["Take a whole region offline to get the most learning", "Inject the fault on every host at once", "Start with a small blast radius, such as one instance or 1% of traffic, with automatic abort conditions", "Run it without telling on-call so the response is realistic"],
          answer: 2,
          explain: "A small blast radius limits user impact if the hypothesis is wrong, and automatic abort conditions stop the experiment when the SLI dips. You widen scope only after smaller experiments pass. Surprising on-call turns an experiment into an unplanned incident."
        },
        {
          q: "During a game day, who should decide to stop the exercise?",
          options: ["The newest engineer on the team", "The vendor of the chaos tool", "Whoever is watching the main dashboard", "The facilitator, using abort criteria agreed before the exercise started"],
          answer: 3,
          explain: "A single named person with pre-agreed abort criteria avoids hesitation and debate when users start to be affected. The facilitator owns safety and pacing; responders focus on the response and observers on taking notes."
        },
        {
          q: "What does RPO measure?",
          options: ["How long it takes to restore service", "The maximum acceptable data loss, measured as time before the failure", "The person who owns the recovery process", "The number of requests per operation during failover"],
          answer: 1,
          explain: "Recovery point objective is how far back in time you can afford to lose writes: a 5-minute RPO means losing at most the last five minutes of data. Recovery time objective (RTO) is how long service may be down."
        },
        {
          q: "How do you know your backups work?",
          options: ["The backup job exits with status 0", "The backup files have a plausible size", "Copies are stored in two regions", "You restore them regularly into an isolated environment, time it against the RTO and validate the data"],
          answer: 3,
          explain: "A backup that has never been restored is a hope, not a control. Restore drills prove the files are complete and usable, that the team knows the procedure, and that the restore fits within the RTO. Exit codes and sizes do not prove any of that."
        },
        {
          q: "The business needs an RTO of 15 minutes and an RPO of 1 minute. Using typical figures, which is the cheapest strategy that meets both?",
          options: ["Backup and restore", "Pilot light", "Warm standby", "Active-active"],
          answer: 2,
          explain: "Backup and restore takes hours and loses up to a backup interval. Pilot light usually needs around an hour to scale up. Warm standby runs a scaled-down live copy with near-continuous replication and can take over in minutes. Active-active also meets the target but costs considerably more."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.chaos = {
    id: "chaos",
    name: "Resilience & Chaos Engineering",
    short: "CHAOS",
    tagline: "Design for failure, then go looking for it",
    color: "#fb923c",
    blurb: "How distributed systems actually fail (crashes, slowness, partial and gray failures, dependencies, overload) and the patterns that contain it: timeout budgets, retries with backoff, jitter and budgets, idempotency, circuit breakers, bulkheads, load shedding and graceful degradation. Then prove it: chaos experiments with steady-state hypotheses and abort conditions, game days, and DR drills that measure RTO and RPO for real.",
    modules: [
      {
        id: "patterns",
        name: "Resilience Patterns",
        icon: "shield",
        lessons: [
          {
            id: "failure-modes",
            title: "How distributed systems fail",
            summary: "Crash, slow, partial, gray, dependency and overload failures, and why slow is worse than dead.",
            minutes: 9,
            tags: ["failure-modes", "gray-failure", "overload"],
            blocks: [
              { t: "p", html: "The failure you design for is usually a clean crash: a process dies, a health check notices, traffic moves elsewhere. Most painful incidents are not like that. They are a dependency that answers in eight seconds instead of eighty milliseconds, a shard that fails one request in twenty, or a node that passes every health check while users time out. Resilience starts with naming those shapes." },
              { t: "table", headers: ["Failure mode", "What it looks like", "How you detect it", "First response"], rows: [
                ["Crash (fail-stop)", "Process or host gone; connections refused", "Health checks, missing heartbeats", "Restart and route around; usually automatic"],
                ["Slow", "Responses arrive, but late; threads and connections pile up", "Latency SLIs, pool saturation, rising concurrency", "Timeouts, breakers, shed load"],
                ["Partial", "Some requests, keys, shards or customers fail; others are fine", "Error rate sliced by shard, tenant, zone or version", "Isolate the bad slice, drain or roll back"],
                ["Gray", "The system thinks it is healthy, users disagree", "Caller-side and user-side SLIs, synthetic probes from outside", "Trust user-facing signals; eject on outlier detection"],
                ["Dependency", "A database, queue, cache or third party degrades", "Per-dependency latency and errors from the client side", "Fallbacks, cached or partial responses, breakers"],
                ["Overload", "Demand exceeds capacity; latency and errors climb together", "Saturation, queue depth, rising rejects", "Shed early, by priority; stop retries"]
              ] },
              { t: "h", text: "Why slow is worse than dead" },
              { t: "p", html: "A dead dependency fails fast: you get an error in milliseconds and can fall back. A slow one holds every caller's thread, connection and memory for the full timeout. By Little's law, if latency goes from 50 ms to 5 s at the same traffic, in-flight requests rise a hundredfold and the <em>caller</em> runs out of resources. Slowness spreads upstream; crashes mostly do not." },
              { t: "note", variant: "warn", html: "Watch for <strong>metastable failures</strong>: an overload triggered by a short spike that keeps itself going after the spike ends, because retries, cache misses or queue backlogs keep demand above capacity. The fix is to break the feedback loop (stop retries, shed, drain queues), not to wait." },
              { t: "h", text: "Correlated failure" },
              { t: "ul", items: [
                "Replicas fail together when they share something: a bad config push, a certificate expiring, a dependency, a zone, a kernel bug, a leap second.",
                "Redundancy only helps against <em>independent</em> failures, so ask what your replicas have in common.",
                "Stagger risky changes across zones and cohorts so one bad change cannot reach every replica at once."
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"health checks are green but users complain\" (gray), \"only EU customers\" or \"only shard 7\" (partial), \"thread pool exhausted after the payment provider slowed\" (slow dependency), \"it stayed down after traffic dropped\" (metastable overload)." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Detecting subtle failures needs more telemetry: slicing errors by shard, tenant and version, caller-side SLIs and external probes. That costs cardinality and engineering time. Skipping it means the failures you can detect are only the easy ones." },
              { t: "p", html: "<strong>Interview cue:</strong> \"I'd design for slow and partial failures, not just crashes: timeouts everywhere so slowness can't spread, user-facing SLIs so gray failures show up, and error rates sliced by zone, shard and version so partial failures are visible.\"" },
              { t: "note", variant: "key", html: "<strong>Crashes are the easy case.</strong> Plan for slow, partial, gray and overload failures, and remember that slowness spreads upstream while crashes fail fast." }
            ]
          },
          {
            id: "timeouts-retries",
            title: "Timeouts, retries, backoff and idempotency",
            summary: "Budget time end to end, retry once at the right layer with jitter, and make retries safe.",
            minutes: 11,
            tags: ["timeouts", "retries", "backoff", "idempotency", "retry-budget"],
            blocks: [
              { t: "p", html: "A timeout is how a caller limits how long it will wait for one dependency. A retry is a bet that the next attempt will succeed where this one failed. Used well, they hide brief blips from users. Used carelessly, they multiply an outage into an overload. The rules are short; the discipline is in applying them everywhere." },
              { t: "h", text: "Timeouts as a budget" },
              { t: "code", lang: "text", code:
                "User-facing deadline at the edge: 2,000 ms\n\n" +
                "edge gateway   receives deadline 2,000 ms, keeps 100 ms for itself\n" +
                "  -> orders    gets 1,900 ms remaining, spends ~150 ms on its own work\n" +
                "     -> pricing   per-call timeout 300 ms (its p99.9 is ~180 ms)\n" +
                "     -> inventory per-call timeout 400 ms (its p99.9 is ~250 ms)\n" +
                "     -> payments  timeout = min(1,200 ms, remaining deadline − margin)\n\n" +
                "Rules\n" +
                "  * every network call has a timeout; no library defaults of 'infinite'\n" +
                "  * a callee's timeout must be shorter than its caller's\n" +
                "  * pass the remaining deadline downstream (header or RPC deadline)\n" +
                "  * stop work when the deadline has passed; nobody is waiting for it"
              },
              { t: "p", html: "Set each per-call timeout from the dependency's observed latency (around its p99.9 plus a margin), not from a round number. Too long and slowness spreads upstream; too short and you fail requests that would have succeeded." },
              { t: "h", text: "Retries that help instead of hurt" },
              { t: "ul", items: [
                "<strong>Retry only retryable errors</strong>: timeouts, connection resets, 503 and 429. Never retry 400-class client errors other than 429.",
                "<strong>Exponential backoff with full jitter</strong>: wait a random time between 0 and <code class='tok'>min(cap, base × 2^attempt)</code>, so clients that failed together do not retry together.",
                "<strong>Retry at one layer</strong>, usually the one closest to the user or the one with the most context. If every layer retries, attempts multiply.",
                "<strong>Retry budgets</strong>: let retries be at most about 10% of a client's requests over a window. When the dependency is truly down, the budget empties and retries stop on their own.",
                "<strong>Respect the deadline</strong>: never start an attempt that cannot finish before the caller's deadline."
              ] },
              { t: "code", lang: "python", code:
                "import random, time\n\n" +
                "class RetryBudget:\n" +
                "    \"\"\"Allow retries up to `ratio` of recent requests (token bucket).\"\"\"\n" +
                "    def __init__(self, ratio=0.1, max_tokens=50):\n" +
                "        self.ratio, self.tokens, self.max = ratio, max_tokens, max_tokens\n" +
                "    def on_request(self):\n" +
                "        self.tokens = min(self.max, self.tokens + self.ratio)\n" +
                "    def try_spend(self):\n" +
                "        if self.tokens >= 1:\n" +
                "            self.tokens -= 1\n" +
                "            return True\n" +
                "        return False\n\n" +
                "def call_with_retries(fn, budget, deadline, attempts=3, base=0.05, cap=1.0):\n" +
                "    budget.on_request()\n" +
                "    for attempt in range(attempts):\n" +
                "        remaining = deadline - time.monotonic()\n" +
                "        if remaining <= 0:\n" +
                "            raise TimeoutError(\"deadline exceeded\")\n" +
                "        try:\n" +
                "            return fn(timeout=remaining)\n" +
                "        except RetryableError:\n" +
                "            if attempt == attempts - 1 or not budget.try_spend():\n" +
                "                raise\n" +
                "            delay = random.uniform(0, min(cap, base * 2 ** attempt))  # full jitter\n" +
                "            if time.monotonic() + delay >= deadline:\n" +
                "                raise\n" +
                "            time.sleep(delay)"
              },
              { t: "widget", id: "bcRetryStorm" },
              { t: "h", text: "Idempotency makes retries safe" },
              { t: "p", html: "A timeout does not tell you whether the server did the work. Retrying a read is harmless; retrying \"charge this card\" may charge twice. Make mutating endpoints idempotent: the client sends an <code class='tok'>Idempotency-Key</code> header (a unique id per logical operation), and the server stores the key with the result and returns the stored result for any repeat." },
              { t: "compare",
                bad: { title: "Retry storm recipe", items: ["Every layer retries 3 times immediately", "No per-call timeouts, or 30-second defaults", "Retries on 400 and 500 alike", "Non-idempotent writes retried blindly"] },
                good: { title: "Safe retries", items: ["One layer retries, with backoff and full jitter", "Timeouts from observed p99.9, inside a propagated deadline", "Retry budget around 10%, only on retryable errors", "Idempotency keys on every mutating call"] } },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Retries buy availability against brief blips at the price of extra load and added latency for the retried request. Budgets and single-layer retries cap that price, but they also mean some requests that might have succeeded on a fourth try will fail. That is the right trade during a real outage." },
              { t: "p", html: "<strong>Interview cue:</strong> \"Every call gets a timeout derived from the dependency's p99.9 and the remaining deadline; we retry at one layer with full-jitter backoff under a 10% retry budget, and every write takes an idempotency key so a retry can't double-charge.\"" },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>Timeouts come from the caller's latency budget, retries live at one layer with exponential backoff, jitter and a retry budget, and only idempotent operations are retried.</em>" },
              { t: "note", variant: "key", html: "<strong>Timeouts bound the wait; budgets bound the retries.</strong> Propagate deadlines, retry at one layer with jittered backoff, cap retries to a share of traffic, and make writes idempotent." }
            ]
          },
          {
            id: "circuit-breakers",
            title: "Circuit breakers and bulkheads",
            summary: "Fail fast when a dependency is sick, and keep one sick dependency from taking every thread with it.",
            minutes: 10,
            tags: ["circuit-breaker", "bulkhead", "isolation"],
            blocks: [
              { t: "p", html: "Timeouts make each call give up eventually. A <strong>circuit breaker</strong> notices that calls to a dependency keep failing and stops making them for a while, failing fast instead. That protects the caller's resources, gives the dependency room to recover, and lets you serve a fallback immediately rather than after a timeout." },
              { t: "diagram", id: "circuit-breaker", caption: "Closed counts failures, open fails fast for a cooldown, half-open sends trial calls that decide whether to close or reopen." },
              { t: "table", headers: ["State", "Behaviour", "Leaves when"], rows: [
                ["Closed", "Calls go through; failures and slow calls are counted over a sliding window", "Failure rate crosses the threshold (with a minimum call count) -> open"],
                ["Open", "Calls are rejected immediately with a fast error or a fallback", "Cooldown elapses -> half-open"],
                ["Half-open", "A small number of trial calls are allowed through", "Trials succeed -> closed; any trial fails -> open again"]
              ] },
              { t: "widget", id: "bcBreaker" },
              { t: "h", text: "A typical configuration" },
              { t: "code", lang: "yaml", code:
                "# client-side breaker for the payments dependency\n" +
                "circuitBreaker:\n" +
                "  payments-client:\n" +
                "    slidingWindowType: COUNT_BASED\n" +
                "    slidingWindowSize: 20              # judge the last 20 calls\n" +
                "    minimumNumberOfCalls: 10           # don't trip on 2 failures out of 2\n" +
                "    failureRateThreshold: 50           # percent\n" +
                "    slowCallDurationThreshold: 800ms   # slow counts as failure\n" +
                "    slowCallRateThreshold: 60          # percent\n" +
                "    waitDurationInOpenState: 30s       # cooldown\n" +
                "    permittedNumberOfCallsInHalfOpenState: 5\n" +
                "    recordExceptions: [TimeoutException, ConnectException, Http5xxException]"
              },
              { t: "note", variant: "trap", html: "One breaker for a whole dependency trips for everyone when only one replica is bad. If the dependency has many hosts, combine a per-service breaker with <em>outlier ejection</em> in the load balancer or mesh, so one bad host is removed without cutting off the healthy ones." },
              { t: "h", text: "Bulkheads" },
              { t: "p", html: "A ship's bulkheads keep one flooded compartment from sinking the whole hull. In software, a <strong>bulkhead</strong> gives each dependency or workload its own bounded pool of threads, connections or concurrency slots. When the recommendations service hangs, it can exhaust only its own 20 slots, and checkout keeps its own." },
              { t: "ul", items: [
                "Separate connection pools or concurrency limits per downstream dependency.",
                "Separate worker pools or queues for interactive and batch traffic.",
                "Cell-based architecture at a larger scale: independent stacks per group of customers, so one bad cell affects only its share.",
                "Size each bulkhead with Little's law: expected rate × timeout, plus a little spare."
              ] },
              { t: "note", variant: "tip", html: "For the system design view of breakers, backpressure and how they compose across services, see <a href='../hld-lld-academy/index.html#/hld/reliability/circuit-breakers-backpressure'>Blueprint: Circuit breakers and backpressure</a>." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "A breaker turns some requests that might have succeeded into fast failures, and a badly tuned one flaps or trips on noise. Bulkheads leave capacity idle in one pool while another is full. Both trade peak efficiency for containment, and both need a fallback decision: what do you return when the breaker is open?" },
              { t: "p", html: "<strong>Interview cue:</strong> \"Each dependency gets its own bulkhead sized by rate times timeout and a breaker that trips on failure and slow-call rate over a sliding window, with a defined fallback; outlier ejection handles single bad hosts so the breaker doesn't cut off healthy ones.\"" },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>A breaker trips on failure rate over a minimum request volume, fails fast with a fallback while open, probes with a few requests when half-open, and is tuned per dependency rather than globally.</em>" },
              { t: "note", variant: "key", html: "<strong>Breakers fail fast, bulkheads contain.</strong> Trip on failure and slowness with a minimum sample, probe in half-open, and give each dependency its own bounded pool so one sick service cannot drain the rest." }
            ]
          },
          {
            id: "graceful-degradation",
            title: "Load shedding and graceful degradation",
            summary: "When demand exceeds capacity, choose what to drop on purpose instead of letting everything get slow.",
            minutes: 10,
            tags: ["load-shedding", "degradation", "kill-switch", "brownout"],
            blocks: [
              { t: "p", html: "Every system has a ceiling. Past it, you have two choices: let every request get slower until they all time out, or deliberately refuse or simplify some work so the rest stays fast. <strong>Load shedding</strong> refuses work; <strong>graceful degradation</strong> does less work per request. Both keep goodput (useful completed work) high when demand spikes or capacity drops." },
              { t: "h", text: "Shedding well" },
              { t: "ul", items: [
                "<strong>Shed early and cheaply</strong>: at the edge or on admission, before you parse bodies, open transactions or call dependencies.",
                "<strong>Shed by priority</strong>: checkout over browse, interactive over batch, paying customers over free tier, health checks never.",
                "<strong>Use a concurrency limit, not just a rate limit</strong>: cap in-flight requests (Little's law again), and reject with 503 or 429 plus a <code class='tok'>Retry-After</code> when full.",
                "<strong>Bound queues by time</strong>: drop requests that have already waited longer than the caller will wait; serving them wastes capacity on answers nobody reads.",
                "<strong>Adaptive limits</strong>: adjust the concurrency limit from observed latency, shrinking it when latency rises."
              ] },
              { t: "h", text: "A degradation ladder" },
              { t: "table", headers: ["Step", "What you turn off or simplify", "User impact"], rows: [
                ["1", "Personalised recommendations, A/B experiments, analytics beacons", "Barely noticeable"],
                ["2", "Serve stale cache for product and price pages with a short staleness limit", "Slightly out-of-date data"],
                ["3", "Disable expensive search filters, reduce result counts", "Less rich results"],
                ["4", "Read-only mode for non-critical features; queue writes for later", "Some actions deferred"],
                ["5", "Shed free-tier and batch traffic; keep checkout and login", "Lower-priority users refused"]
              ] },
              { t: "p", html: "Wire each step to a <strong>kill switch</strong> or feature flag that on-call can flip in seconds, document it in the runbook, and test it, because a switch that has never been flipped often does not work when you need it." },
              { t: "compare",
                bad: { title: "Uncontrolled overload", items: ["Unbounded queues fill up", "Every request slows until all time out", "Retries pile on, goodput collapses", "Recovery needs a full restart"] },
                good: { title: "Controlled degradation", items: ["Concurrency limits reject early with Retry-After", "Low-priority work shed first", "Optional features switched off by flag", "Goodput stays near capacity; recovery is automatic"] } },
              { t: "note", variant: "tip", html: "The architecture side (admission control, priority queues and how to design degradation into a system) is covered in <a href='../hld-lld-academy/index.html#/hld/reliability/load-shedding-degradation'>Blueprint: Load shedding and degradation</a>." },
              { t: "note", variant: "warn", html: "Degraded modes are code paths that rarely run, which makes them some of the least-tested code you own. Exercise them in game days and chaos experiments, or they will fail exactly when you rely on them." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Shedding refuses real users and degradation shows them a worse product. Both are better than an outage for everyone, but they need product agreement in advance on what is optional and who gets priority, and that is a business decision, not just an engineering one." },
              { t: "p", html: "<strong>Interview cue:</strong> \"Past capacity I'd keep goodput up with an adaptive concurrency limit at the edge that sheds by priority, time-bounded queues, and a tested degradation ladder behind kill switches, agreed with product beforehand.\"" },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I rank features by criticality ahead of time so that under stress we drop recommendations before search and search before checkout, and I test those degraded modes on purpose.</em>" },
              { t: "quiz", id: "chaos-patterns" },
              { t: "note", variant: "key", html: "<strong>Choose what to drop before overload chooses for you.</strong> Shed early by priority, bound queues by time, degrade optional features behind tested kill switches, and protect goodput." }
            ]
          }
        ]
      },
      {
        id: "experiments",
        name: "Chaos & Recovery Drills",
        icon: "bolt",
        lessons: [
          {
            id: "chaos-principles",
            title: "Chaos engineering principles",
            summary: "Experiments with a steady-state hypothesis, a small blast radius and automatic abort conditions.",
            minutes: 10,
            tags: ["chaos-engineering", "steady-state", "blast-radius"],
            blocks: [
              { t: "p", html: "Chaos engineering is the scientific method applied to resilience. You state what normal looks like, inject a realistic fault, and check whether normal held. It is not random breakage: every experiment has a hypothesis, a limited blast radius, a way to stop, and a person who will act on the result." },
              { t: "h", text: "The experiment loop" },
              { t: "ol", items: [
                "<strong>Define steady state</strong> in user-facing terms you already measure: checkout success rate, p99 latency, orders per minute.",
                "<strong>Hypothesise</strong> that steady state holds during the fault: \"losing one cache node keeps checkout success above 99.5%\".",
                "<strong>Choose a realistic fault</strong>: instance loss, added latency on a dependency, packet loss, DNS failure, a full disk, a zone drained, clock skew.",
                "<strong>Limit the blast radius</strong>: one host, one cell, 1% of traffic, internal users first.",
                "<strong>Set abort conditions</strong> that stop injection automatically when the SLI crosses a line.",
                "<strong>Run, observe, and compare</strong> against the control group or the baseline.",
                "<strong>Fix what you learned</strong>, then widen scope or automate the experiment as a regression test."
              ] },
              { t: "code", lang: "yaml", code:
                "# experiment: cache-node-loss.yaml\n" +
                "title: Losing one cache node does not hurt checkout\n" +
                "owner: team-checkout\n" +
                "steady_state:\n" +
                "  - sli: checkout_success_ratio      # from the SLO dashboard\n" +
                "    expect: \">= 0.995\"\n" +
                "  - sli: checkout_latency_p99_ms\n" +
                "    expect: \"< 400\"\n" +
                "fault:\n" +
                "  type: terminate-instance\n" +
                "  target: cache-cluster, 1 of 6 nodes, zone b\n" +
                "blast_radius: production, 5% of checkout traffic via canary cell\n" +
                "duration: 10m\n" +
                "abort_when:\n" +
                "  - checkout_success_ratio < 0.99 for 1m\n" +
                "  - on-call or facilitator calls stop\n" +
                "rollback: restore node from autoscaling group; flush nothing\n" +
                "comms: announce in #ops 30 min before; on-call is aware"
              },
              { t: "h", text: "Production or staging?" },
              { t: "table", headers: ["Where", "What it proves", "Risk"], rows: [
                ["Staging", "Mechanics work: the fault tool, the dashboards, basic fallbacks", "Low; but traffic, data and scale differ, so confidence is limited"],
                ["Production, small blast radius", "Real behaviour under real traffic and real dependencies", "Some user impact if the hypothesis is wrong; bounded by scope and aborts"],
                ["Production, automated and continuous", "Resilience does not regress as the system changes", "Needs mature observability, aborts and buy-in"]
              ] },
              { t: "table", headers: ["Tier", "Practice", "Why it scores that way"], rows: [
                ["Naive", "Randomly kill things in production to \"see what happens\"", "No hypothesis, no abort, no learning loop; erodes trust"],
                ["Solid", "Hypothesis on SLIs, staging first, then small production scope with manual stop", "Real learning with bounded risk"],
                ["Standout", "Automated experiments in CI and production with SLI-based aborts, tied to error budget so they pause when budget is low, results fed into action items", "Resilience becomes a tested, continuously verified property"]
              ] },
              { t: "note", variant: "warn", html: "Prerequisites come first. Do not run chaos in production without SLIs that would show the impact, an on-call rotation that knows about the experiment, and a tested way to stop. If you cannot see the damage, you cannot limit it. Experiments also spend error budget; see <a href='#/slo/budgets/error-budgets'>Error budgets</a>." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Experiments in production can cause the incident they are meant to prevent, on your schedule instead of at 3 a.m. The bet is that a small, controlled, well-observed failure now is cheaper than a large, surprising one later. That bet only pays if you act on the findings." },
              { t: "p", html: "<strong>Interview cue:</strong> \"I'd write a steady-state hypothesis on the checkout SLI, inject a single realistic fault in a 5% canary cell with automatic aborts when success drops below 99%, and turn every finding into an action item before widening the scope.\"" },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>Every experiment starts from a steady-state hypothesis on an SLI, limits blast radius, defines abort conditions in advance and grows scope only after the small version passes.</em>" },
              { t: "note", variant: "key", html: "<strong>Hypothesis, small blast radius, automatic abort, act on findings.</strong> Chaos engineering is controlled experiments on user-facing SLIs, not random breakage." }
            ]
          },
          {
            id: "game-days",
            title: "Planning and running a game day",
            summary: "A rehearsed failure with roles, a script, safety rails and a debrief that produces real fixes.",
            minutes: 9,
            tags: ["game-day", "facilitation", "exercise"],
            blocks: [
              { t: "p", html: "A game day is a scheduled exercise where a team practises responding to a failure, either injected for real or simulated on paper. Chaos experiments test the system; game days test the system <em>and</em> the people: alerts, dashboards, runbooks, access, communication and decision-making." },
              { t: "table", headers: ["Format", "How it runs", "Best for"], rows: [
                ["Tabletop", "Facilitator narrates a scenario; responders talk through what they would check and do", "New teams, sensitive systems, testing comms and escalation cheaply"],
                ["Live in staging", "Real faults injected into a staging environment while responders work it", "Validating runbooks and tooling end to end"],
                ["Live in production", "Small-scope real fault in production with aborts and full observability", "Mature teams proving real resilience and real response"]
              ] },
              { t: "h", text: "Roles" },
              { t: "table", headers: ["Role", "Responsibility"], rows: [
                ["Facilitator", "Owns the plan, pacing and safety; makes the call to pause or abort"],
                ["Injector", "Executes the faults exactly as scripted, and reverses them on request"],
                ["Responders", "Work the incident as they would for real, using normal tools and runbooks"],
                ["Observers / scribe", "Record timestamps, decisions, confusion and gaps; do not help"],
                ["Stakeholder liaison", "Keeps support, product and anyone affected informed"]
              ] },
              { t: "h", text: "The plan" },
              { t: "ol", items: [
                "<strong>Objective</strong>: one or two questions, such as \"can on-call detect and fail over a database primary loss within 15 minutes using only the runbook?\"",
                "<strong>Scenario and script</strong>: faults, timing and any injects (\"at T+10 the status page tool is also unavailable\").",
                "<strong>Safety rails</strong>: blast radius, abort criteria, rollback steps, a quiet time window, no overlap with launches.",
                "<strong>Comms</strong>: announce date and scope in advance; tell support; decide whether responders know the scenario.",
                "<strong>Success criteria</strong>: time to detect, time to mitigate, runbook steps that worked, alerts that fired.",
                "<strong>Debrief</strong> within a day, blameless, with owners and dates on every action item."
              ] },
              { t: "note", variant: "tip", html: "Want to practise the responder seat first? Run a scenario in the <a href='#/simulator'>incident simulator</a>, then use its timeline as the script for a tabletop with your team." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we have runbooks but nobody has used them\", \"new on-call rotation\", \"we just built failover and never tried it\", \"how would we know our alerts work?\". Each one is a game day waiting to be scheduled." },
              { t: "note", variant: "warn", html: "The most common game day finding is not a software bug. It is missing access, an out-of-date runbook, an alert routed to a deleted channel, or a dashboard nobody can find. Those findings are the point; fix them with the same priority as code defects." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Game days cost a block of time from several engineers and, when live, some risk. Tabletops are cheap and safe but cannot reveal that a failover script is broken. Mix both: frequent tabletops for people and process, periodic live exercises for the mechanics." },
              { t: "p", html: "<strong>Interview cue:</strong> \"I'd run a game day with a clear objective, a facilitator who owns safety and aborts, observers capturing every gap, and a blameless debrief that turns findings into owned, dated action items, including the boring ones like access and stale runbooks.\"" },
              { t: "note", variant: "key", html: "<strong>Game days test people and process, not just code.</strong> Plan an objective, assign a facilitator with abort authority, capture gaps, and fix them like defects. Mitigation habits from <a href='#/inc/response/mitigation-first'>mitigation first</a> are what you are rehearsing." }
            ]
          },
          {
            id: "dr-drills",
            title: "Disaster recovery drills: RTO, RPO and region evacuation",
            summary: "Pick a DR strategy from the RTO and RPO the business needs, then prove it with restores and evacuations.",
            minutes: 11,
            tags: ["disaster-recovery", "rto", "rpo", "backups", "region-evacuation"],
            blocks: [
              { t: "p", html: "Disaster recovery is what you do when redundancy inside a region is not enough: a region outage, data corruption, a deleted account, ransomware. Two numbers drive every DR decision. <strong>RTO</strong> (recovery time objective) is how long the service may be down. <strong>RPO</strong> (recovery point objective) is how much recent data you may lose, measured in time." },
              { t: "stat", items: [
                { v: "RTO", k: "maximum tolerable downtime" },
                { v: "RPO", k: "maximum tolerable data loss, in time" },
                { v: "0", k: "untested DR plans you should trust" }
              ] },
              { t: "h", text: "Strategies, cheapest to most expensive" },
              { t: "table", headers: ["Strategy", "What runs in the recovery site", "Typical RTO", "Typical RPO"], rows: [
                ["Backup and restore", "Nothing; backups copied to another region", "Hours", "Hours to a day (backup interval), less with log shipping"],
                ["Pilot light", "Data replicated continuously; core services provisioned but scaled to zero or minimal", "Tens of minutes to an hour", "Minutes"],
                ["Warm standby", "A scaled-down but fully working copy, with live replication", "Minutes", "Seconds to a minute"],
                ["Active-active", "Full capacity serving traffic in two or more regions", "Near zero (traffic shift)", "Near zero; zero only with synchronous writes"]
              ] },
              { t: "widget", id: "bcRtoRpo" },
              { t: "h", text: "Backups are tested by restoring them" },
              { t: "ul", items: [
                "Schedule restore drills (monthly for critical data): restore the latest backup into an isolated environment and time it against the RTO.",
                "Validate the result, not the file: row counts, checksums, application-level smoke tests against the restored data.",
                "Keep at least one copy that production credentials cannot delete or modify (separate account, immutability lock), so ransomware or a bad script cannot remove it.",
                "Practise point-in-time recovery to just before a corrupting change; logical corruption replicates to every replica, so only backups help.",
                "Record restore time and data loss per drill and trend them; a restore that grows from 40 minutes to 5 hours as data grows silently breaks the RTO."
              ] },
              { t: "h", text: "Region evacuation drill" },
              { t: "ol", items: [
                "Confirm the surviving region has capacity for the full peak (or that you will shed by priority) and quotas to scale.",
                "Check replication lag on every data store; it is your actual RPO at that moment.",
                "Promote replicas or switch write leadership, following the runbook exactly.",
                "Shift traffic with global load balancing or DNS; account for DNS TTLs and clients that cache addresses.",
                "Verify the hidden dependencies: identity, secrets, config, container registry, CI/CD and observability must also work from the surviving region.",
                "Hold for long enough to see real behaviour, then fail back, which is its own risky change and needs its own steps."
              ] },
              { t: "note", variant: "trap", html: "The classic DR surprise is a control-plane dependency that only lives in the failed region: the login service, the secrets store, the deploy pipeline or the monitoring stack. Evacuation drills find these; architecture diagrams usually do not." },
              { t: "note", variant: "tip", html: "During a real regional incident, restoring service beats diagnosing it. Evacuating is often the fastest mitigation, which is why the habits in <a href='#/inc/response/mitigation-first'>mitigation first</a> and a rehearsed evacuation runbook belong together." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Each step down in RTO and RPO costs more: warm standby can add around half again to running cost, and active-active roughly doubles it while adding data consistency problems. Let the business price an hour of downtime and a minute of lost data, then choose the cheapest strategy that meets both, and prove it with drills." },
              { t: "p", html: "<strong>Interview cue:</strong> \"I'd get RTO and RPO from the business, pick the cheapest strategy that meets them, warm standby for a 15-minute RTO and 1-minute RPO, and prove it with monthly restore drills and a quarterly region evacuation that checks the hidden control-plane dependencies.\"" },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I state RTO and RPO per service, choose the cheapest DR strategy that meets them, and prove both with timed restore and region-evacuation drills — an untested backup is a hope.</em>" },
              { t: "quiz", id: "chaos-experiments" },
              { t: "note", variant: "key", html: "<strong>RTO and RPO pick the strategy; drills prove it.</strong> Backups count only when restored and timed, evacuations only when practised, and the control plane must survive the region you lose." }
            ]
          }
        ]
      }
    ]
  };
})();
