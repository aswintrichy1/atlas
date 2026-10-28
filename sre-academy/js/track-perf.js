/* =====================================================================
   BEACON · Capacity, Performance & Load Testing
   window.TRACKS.perf — modules: theory / testing

   Self-contained: this file registers its own widgets (bcLittle,
   bcQueue, bcFanout), its own quizzes (perf-theory, perf-testing) and
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

  function ms(x) { x = fin(x, 0); return x < 1000 ? sig(x) + " ms" : sig(x / 1000) + " s"; }

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

  var Widgets = {};

  /* ==================================================================
     1. bcLittle — L = λW, then instances from per-instance concurrency
  ================================================================== */
  Widgets.bcLittle = function (mount) {
    shell(mount, "calculator", "Little's law sizing",
      "Set the arrival rate and the mean time each request spends in the system. Little's law gives the average number of requests in flight; divide by what one instance can safely hold concurrently to get an instance count, then add a spare.");
    var st = { lambda: 2000, w: 150, per: 40 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var lamLbl = h("b", {}, "");
    var wLbl = h("b", {}, "");
    controls.appendChild(field("arrival rate λ", slider(50, 10000, 50, st.lambda, function (v) { st.lambda = v; paint(); }), lamLbl));
    controls.appendChild(field("latency W", slider(10, 2000, 10, st.w, function (v) { st.w = v; paint(); }), wLbl));
    controls.appendChild(segment([[10, "10 / instance"], [40, "40 / instance"], [100, "100 / instance"], [250, "250 / instance"]], 1,
      function (v) { st.per = v; paint(); }));

    function paint() {
      lamLbl.textContent = st.lambda + " req/s";
      wLbl.textContent = ms(st.w);
      var L = fin(st.lambda * st.w / 1000, 0);
      var per = Math.max(1, st.per);
      var need = Math.max(1, Math.ceil(L / per));
      var withSpare = need + 1;
      var util = L / (withSpare * per);

      clear(stage);
      var show = Math.min(withSpare, 48);
      var cols = 12, cell = 40, gap = 6;
      var rows = Math.ceil(show / cols);
      var W = cols * (cell + gap), H = Math.max(1, rows) * (cell + gap) + 4;
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "instances and their concurrency fill" });
      var remaining = L;
      for (var i = 0; i < show; i++) {
        var x = (i % cols) * (cell + gap), y = Math.floor(i / cols) * (cell + gap) + 2;
        var fillFrac = Math.max(0, Math.min(1, remaining / per));
        remaining -= per;
        svg.appendChild(sv("rect", { x: x, y: y, width: cell, height: cell, rx: 6, fill: "var(--surface-solid)", stroke: "var(--line)" }));
        if (fillFrac > 0) {
          var fh = cell * fillFrac;
          svg.appendChild(sv("rect", { x: x, y: (y + cell - fh).toFixed(1), width: cell, height: fh.toFixed(1), rx: 6, fill: "var(--cyan)" }));
        } else {
          svg.appendChild(sv("text", { x: x + cell / 2, y: y + cell / 2 + 4, "text-anchor": "middle", "font-size": "10", style: "fill:var(--text-dim)" }, "spare"));
        }
      }
      stage.appendChild(svg);
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" },
        withSpare > show ? "showing the first " + show + " of " + withSpare + " instances" : "each square is one instance; the fill is its share of the in-flight requests (spread evenly in reality)"));

      clear(readout);
      readout.appendChild(ro("in flight L = λ × W", sig(L)));
      readout.appendChild(ro("instances needed", need));
      readout.appendChild(ro("with N+1 spare", withSpare));
      readout.appendChild(ro("concurrency utilisation", (util * 100).toFixed(0) + "%"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. bcQueue — M/M/1 response time multiplier 1/(1-ρ)
  ================================================================== */
  Widgets.bcQueue = function (mount) {
    shell(mount, "simulator", "Where the knee is",
      "A single-server queue with random arrivals and random service times. Slide utilisation and watch the mean response time multiplier 1/(1−ρ) climb. The curve is gentle until roughly 70–80% and then turns nearly vertical.");
    var st = { rho: 0.7, s: 50 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var rhoLbl = h("b", {}, "");
    controls.appendChild(field("utilisation ρ", slider(10, 98, 1, st.rho * 100, function (v) { st.rho = v / 100; paint(); }), rhoLbl));
    controls.appendChild(segment([[10, "service 10 ms"], [50, "service 50 ms"], [200, "service 200 ms"]], 1, function (v) { st.s = v; paint(); }));

    var W = 560, H = 210, PL = 34, PB = 26, YMAX = 50;
    function px(r) { return PL + r * (W - PL - 8); }
    function py(m) { return H - PB - Math.min(YMAX, m) / YMAX * (H - PB - 12); }

    function paint() {
      var rho = Math.max(0.1, Math.min(0.98, fin(st.rho, 0.7)));
      rhoLbl.textContent = Math.round(rho * 100) + "%";
      var mult = 1 / (1 - rho);
      var resp = st.s * mult;
      var wait = resp - st.s;

      clear(stage);
      var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", role: "img", "aria-label": "response time multiplier versus utilisation" });
      svg.appendChild(sv("line", { x1: PL, y1: H - PB, x2: W - 8, y2: H - PB, stroke: "var(--line)" }));
      svg.appendChild(sv("line", { x1: PL, y1: 12, x2: PL, y2: H - PB, stroke: "var(--line)" }));
      var ticksX = [0, 0.25, 0.5, 0.75, 1];
      for (var i = 0; i < ticksX.length; i++) {
        svg.appendChild(sv("text", { x: px(ticksX[i]) - 8, y: H - 8, "font-size": "11", style: "fill:var(--text-dim)" }, Math.round(ticksX[i] * 100) + "%"));
      }
      var ticksY = [1, 10, 25, 50];
      for (i = 0; i < ticksY.length; i++) {
        svg.appendChild(sv("text", { x: 2, y: py(ticksY[i]) + 4, "font-size": "11", style: "fill:var(--text-dim)" }, ticksY[i] + "×"));
      }
      var d = "";
      for (var r = 0; r <= 0.98001; r += 0.01) {
        d += (d ? " L" : "M") + px(r).toFixed(1) + " " + py(1 / (1 - r)).toFixed(1);
      }
      svg.appendChild(sv("path", { d: d, fill: "none", stroke: "var(--cyan)", "stroke-width": "2.5" }));
      svg.appendChild(sv("rect", { x: px(0.7), y: 12, width: (px(0.8) - px(0.7)).toFixed(1), height: H - PB - 12, fill: "var(--amber)", opacity: "0.18" }));
      svg.appendChild(sv("text", { x: px(0.7) - 4, y: 24, "font-size": "11", "text-anchor": "end", style: "fill:var(--text)" }, "knee \u2192"));
      var mx = px(rho), my = py(mult);
      svg.appendChild(sv("line", { x1: mx, y1: my, x2: mx, y2: H - PB, stroke: "var(--rose)", "stroke-dasharray": "4 3" }));
      svg.appendChild(sv("circle", { cx: mx, cy: my, r: 6, fill: "var(--rose)" }));
      svg.appendChild(sv("text", { x: Math.max(PL + 4, Math.min(W - 60, mx - 22)), y: Math.max(12, my - 10), "font-size": "12", style: "fill:var(--text)" }, sig(mult) + "×"));
      stage.appendChild(svg);

      clear(readout);
      readout.appendChild(ro("multiplier 1/(1−ρ)", sig(mult) + "×"));
      readout.appendChild(ro("mean response time", ms(resp)));
      readout.appendChild(ro("of which queueing", ms(wait)));
      readout.appendChild(ro("zone", rho < 0.7 ? "comfortable" : rho <= 0.8 ? "at the knee" : "past the knee: small load changes, big latency swings"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. bcFanout — P(at least one slow) = 1 - (1 - p)^N
  ================================================================== */
  Widgets.bcFanout = function (mount) {
    shell(mount, "calculator", "Fan-out tail amplifier",
      "One user request waits for N backend calls. Each backend is slow on a fixed share of calls (its tail). The user sees the slowest of them, so the chance that at least one is slow grows fast with N.");
    var st = { p: 0.01, n: 50 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var nLbl = h("b", {}, "");
    controls.appendChild(segment([[0.1, "slower than p90 (10%)"], [0.01, "slower than p99 (1%)"], [0.001, "slower than p99.9 (0.1%)"]], 1,
      function (v) { st.p = v; paint(); }));
    controls.appendChild(field("fan-out N", slider(1, 200, 1, st.n, function (v) { st.n = Math.round(v); paint(); }), nLbl));

    function paint() {
      var n = Math.max(1, Math.round(fin(st.n, 1)));
      nLbl.textContent = String(n);
      var p = Math.max(0, Math.min(1, fin(st.p, 0.01)));
      var pSlow = 1 - Math.pow(1 - p, n);
      var perUser = pSlow > 0 ? 1 / pSlow : 0;
      var needed = 1 - Math.pow(0.99, 1 / n);

      clear(stage);
      var rows = [["one backend", p, "var(--lime)"], ["user request (N = " + n + ")", pSlow, pSlow > 0.25 ? "var(--rose)" : "var(--amber)"]];
      for (var i = 0; i < rows.length; i++) {
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:170px 1fr 64px;gap:10px;align-items:center;padding:5px 0" },
          h("span", { style: "font-size:0.84rem" }, rows[i][0]),
          bar(rows[i][1], rows[i][2]),
          h("span", { style: "font-family:var(--font-mono);font-size:0.8rem" }, (rows[i][1] * 100).toFixed(1) + "%")));
      }
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-top:4px" }, "bar = probability the request is held up by at least one slow call"));

      clear(readout);
      readout.appendChild(ro("P(at least one slow)", (pSlow * 100).toFixed(1) + "%"));
      readout.appendChild(ro("users hitting a slow call", perUser >= 1.05 ? "about 1 in " + sig(perUser) : "nearly every request"));
      readout.appendChild(ro("per-backend tail needed to keep users at 1%", (needed * 100).toPrecision(2) + "%"));
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
    "perf-theory": {
      title: "Capacity theory checkpoint",
      sub: "Little's law, queueing, headroom and tail latency at scale.",
      questions: [
        {
          q: "A service receives 800 requests per second and the mean time in the system is 250 ms. On average, how many requests are in flight?",
          options: ["32", "3,200", "200", "800"],
          answer: 2,
          explain: "Little's law says L = λ × W, with consistent units. 800 per second times 0.25 seconds is 200 concurrent requests. The distractors come from forgetting to convert milliseconds to seconds or dividing instead of multiplying."
        },
        {
          q: "In a simple single-server queue, mean response time is the service time multiplied by 1/(1−ρ). If utilisation rises from 50% to 90%, the multiplier goes from 2× to what?",
          options: ["10×", "1.8×", "4×", "2.5×"],
          answer: 0,
          explain: "At ρ = 0.9 the multiplier is 1/(1−0.9) = 10. Going from half busy to 90% busy multiplies latency by five even though load only grew 1.8×, which is why capacity targets sit below the knee rather than near 100%."
        },
        {
          q: "A request fans out to 100 backends in parallel and must wait for all of them. Each backend is slower than its p99 on 1% of calls. Roughly what share of user requests sees at least one slow call?",
          options: ["1%", "10%", "About 37%", "About 63%"],
          answer: 3,
          explain: "The chance that every call is fast is 0.99^100, about 0.366, so about 63% of requests hit at least one slow backend. About 37% is the share that stays fast. This is why the per-backend tail has to be far tighter than the user-facing target."
        },
        {
          q: "What is coordinated omission in a load test?",
          options: ["Two load generators coordinate to skip the warm-up period", "A closed-loop generator waits for slow responses before sending the next request, so it sends less during stalls and under-reports tail latency", "Dashboards drop outliers above a fixed percentile", "Trace sampling drops the slowest spans"],
          answer: 1,
          explain: "When each virtual user waits for its response, a stall also pauses the load, so the requests that would have queued behind it are never sent or measured. The fix is an open model with a fixed arrival rate, or recording latency from the intended send time."
        },
        {
          q: "Peak load needs 30 instances' worth of capacity. You run evenly across three zones and must survive losing any one zone at peak. What is the minimum total instance count?",
          options: ["30", "33", "45", "60"],
          answer: 2,
          explain: "After losing a zone, two zones must carry all 30 instances' worth, so each zone needs 15. Three zones times 15 is 45, a 50% overhead. Adding one spare (33) protects against a single host failure, not a zone failure."
        },
        {
          q: "What does the USE method ask you to check for every resource?",
          options: ["Users, sessions and errors", "Utilisation, saturation and errors", "Uptime, SLO and error budget", "Usage, spend and efficiency"],
          answer: 1,
          explain: "For each resource such as CPU, memory, disk, network or a connection pool, look at how busy it is, how much work is queued waiting for it, and whether it is producing errors. Saturation often shows trouble before utilisation reaches 100%."
        }
      ]
    },
    "perf-testing": {
      title: "Load testing checkpoint",
      sub: "Test types, tools and designing tests whose results you can trust.",
      questions: [
        {
          q: "Which kind of test is most likely to expose a slow memory leak or a connection pool that never returns connections?",
          options: ["Spike test", "Soak test", "Smoke test", "Breakpoint test"],
          answer: 1,
          explain: "A soak test holds realistic load for hours, which gives slow resource leaks time to accumulate into visible degradation. Spike, smoke and breakpoint tests are short and answer different questions about bursts, basic health and maximum throughput."
        },
        {
          q: "Your test shows p99 of 120 ms at 3,000 req/s, but production shows 600 ms at the same rate. What is the most likely cause?",
          options: ["The load tool measures latency inaccurately", "The test used too many virtual users", "The test ran during business hours", "The test reused a tiny set of ids, so it hit warm caches that production's long tail of keys never gets"],
          answer: 3,
          explain: "Unrealistic test data is the most common reason results flatter production. A few hundred repeated ids keep every cache hot, while real traffic spreads across millions of keys and misses. Size and distribute test data like production."
        },
        {
          q: "How should pass/fail thresholds for a load test be set?",
          options: ["From the SLO, for example p99 under 300 ms and errors under 0.1% at forecast peak, failing the pipeline when breached", "From whatever the previous run produced", "On average latency only", "By eye, after reviewing the graphs"],
          answer: 0,
          explain: "Thresholds tied to the SLO make a test a decision rather than a chart. Encoding them in the script means CI can block a regression automatically. Averages hide the tail, and baselines from the last run let regressions creep in gradually."
        },
        {
          q: "Which workload model best matches traffic arriving from the internet?",
          options: ["A fixed number of virtual users looping with no pauses", "A fixed number of virtual users with think time", "A constant or ramping arrival rate that does not depend on how fast responses come back", "One virtual user replaying a recorded session"],
          answer: 2,
          explain: "Real users do not slow down because your server did; new requests keep arriving. Arrival-rate executors model that open system and expose queueing. Closed models with fixed users hold back load when the system slows, which hides the problem."
        },
        {
          q: "During a test, the load generator machine sits at 98% CPU. What does that tell you?",
          options: ["The results are suspect because the generator may be the bottleneck; scale it out and check that it can produce the target rate", "The test is applying maximum stress, which is what you want", "Nothing, because only the system under test matters", "Think time should be reduced to compensate"],
          answer: 0,
          explain: "A saturated generator delays sends and inflates measured latency, so you end up measuring the tool. Keep generators well below saturation, distribute them, and confirm the achieved request rate matches the configured one."
        },
        {
          q: "What is the purpose of a breakpoint test?",
          options: ["Confirming a deploy did not break basic functionality", "Running at normal load overnight", "Replaying a single burst from a sale event", "Raising load step by step until the system breaches its SLO or errors climb, to find maximum sustainable throughput and see how it fails"],
          answer: 3,
          explain: "A breakpoint test finds the ceiling and shows what happens at it: graceful shedding, rising latency or a collapse. That number feeds capacity planning. Watching how the system fails matters as much as the number."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.perf = {
    id: "perf",
    name: "Capacity, Performance & Load Testing",
    short: "PERF",
    tagline: "Know your ceiling before your users find it",
    color: "#22d3ee",
    blurb: "The arithmetic behind capacity: Little's law, queueing and the utilisation knee, the USE method, headroom with N+1 and zone loss, growth forecasting and why tail latency explodes under fan-out. Then the practice: load, stress, soak, spike and breakpoint tests, tools such as k6, JMeter, Locust and Gatling, and test designs whose pass/fail lines come straight from your SLOs.",
    modules: [
      {
        id: "theory",
        name: "Capacity Theory",
        icon: "grid",
        lessons: [
          {
            id: "littles-law",
            title: "Little's law: the one equation for concurrency",
            summary: "L = λW turns request rate and latency into in-flight work, and in-flight work into instances, threads and connections.",
            minutes: 8,
            tags: ["littles-law", "concurrency", "capacity"],
            blocks: [
              { t: "p", html: "Picture a shop. Customers walk in at some rate and each stays for some time. The number of people inside at any moment is the arrival rate times the time each one stays. That is <strong>Little's law</strong>: <code class='tok'>L = λ × W</code>. It holds for any stable system averaged over a long enough window, whatever the distribution of arrivals or service times." },
              { t: "table", headers: ["Symbol", "Meaning", "Units"], rows: [
                ["λ (lambda)", "Arrival rate, which equals throughput when the system is stable", "requests per second"],
                ["W", "Mean time a request spends in the system, queueing plus service", "seconds"],
                ["L", "Mean number of requests in the system at once (concurrency)", "requests"]
              ] },
              { t: "h", text: "Worked numbers" },
              { t: "code", lang: "text", code:
                "API tier\n" +
                "  λ = 2,000 req/s, W = 150 ms = 0.15 s\n" +
                "  L = 2,000 × 0.15 = 300 requests in flight\n" +
                "  each instance safely holds 40 concurrent requests (worker pool)\n" +
                "  instances = ceil(300 / 40) = 8, plus a spare -> 9\n\n" +
                "Database connection pool\n" +
                "  700 queries/s, mean query time 20 ms = 0.02 s\n" +
                "  L = 700 × 0.02 = 14 busy connections on average\n" +
                "  pool of 14 runs at 100% -> queueing; size for ~25-30 and cap it\n\n" +
                "Rearranged: throughput ceiling = L / W\n" +
                "  a pool of 50 threads with 250 ms requests tops out at 50 / 0.25 = 200 req/s"
              },
              { t: "widget", id: "bcLittle" },
              { t: "h", text: "Where it bites in practice" },
              { t: "ul", items: [
                "<strong>Latency is capacity.</strong> If a dependency slows from 50 ms to 500 ms at the same traffic, concurrency rises tenfold and your thread pools, sockets and memory fill up even though request volume did not change.",
                "<strong>Fixed pools set a hard ceiling.</strong> Any worker pool, connection pool or semaphore of size L caps throughput at <code class='tok'>L / W</code>. When W grows, throughput falls.",
                "<strong>Use the mean, not a percentile.</strong> The law is about averages. Bursts and the tail are why you add headroom on top of the result.",
                "<strong>Units first.</strong> Most mistakes are milliseconds treated as seconds; write the units next to every number."
              ] },
              { t: "note", variant: "warn", html: "Little's law describes a <em>stable</em> system, where arrivals do not outrun completions over the window. If the queue is growing without bound there is no steady-state L to compute, which is itself the finding: you are over capacity." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Sizing with the mean gives you the minimum that works on an average second. Real traffic arrives in bursts and latency has a tail, so the number from the formula is a floor. Every unit of headroom above it costs money; every unit you skip turns into queueing when a burst or a slow dependency arrives." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"how many threads/connections/pods do we need\", \"the pool is exhausted but traffic is flat\", \"a downstream got slower and we fell over\". All three are L = λW questions." },
              { t: "p", html: "<strong>Interview cue:</strong> \"Concurrency is rate times latency, so 2,000 requests a second at 150 ms is 300 in flight. At 40 per instance that is eight, nine with a spare, and if the dependency doubles its latency I need twice the concurrency at the same traffic.\"" },
              { t: "note", variant: "key", html: "<strong>L = λ × W, in consistent units.</strong> Use it to size pools and instances, and remember the corollary: when latency rises at constant traffic, concurrency rises with it." }
            ]
          },
          {
            id: "queueing",
            title: "Queueing, utilisation and the knee",
            summary: "Why latency is flat until it suddenly is not, and how the USE method finds the saturated resource.",
            minutes: 10,
            tags: ["queueing", "utilisation", "use-method"],
            blocks: [
              { t: "p", html: "A resource that is busy a fraction <code class='tok'>ρ</code> of the time makes new work wait whenever it arrives during a busy period. With random arrivals, the waiting grows slowly at first and then very fast. The point where the curve bends upward is called the <strong>knee</strong>, and it is why a server at 85% CPU can feel dramatically worse than one at 65%." },
              { t: "h", text: "The single-server formula" },
              { t: "code", lang: "text", code:
                "M/M/1 queue (random arrivals, random service times, one server)\n" +
                "  ρ = λ / μ              utilisation = arrival rate / service rate\n" +
                "  R = S / (1 − ρ)        mean response time, S = mean service time\n" +
                "  Wq = ρ·S / (1 − ρ)     mean time spent waiting in the queue\n\n" +
                "  S = 50 ms\n" +
                "  ρ = 0.50  ->  R = 100 ms\n" +
                "  ρ = 0.80  ->  R = 250 ms\n" +
                "  ρ = 0.90  ->  R = 500 ms\n" +
                "  ρ = 0.95  ->  R = 1,000 ms"
              },
              { t: "table", headers: ["Utilisation", "Multiplier 1/(1−ρ)", "What it feels like"], rows: [
                ["50%", "2×", "Comfortable; bursts absorbed"],
                ["70%", "3.3×", "Fine for most services; a common target"],
                ["80%", "5×", "At the knee; small load changes now move latency noticeably"],
                ["90%", "10×", "Fragile; a 5% burst roughly doubles queueing"],
                ["95%", "20×", "Effectively saturated; tail latency and timeouts dominate"]
              ] },
              { t: "widget", id: "bcQueue" },
              { t: "h", text: "Two refinements worth knowing" },
              { t: "ul", items: [
                "<strong>Variability drives the wait.</strong> A rough approximation for one server is that waiting time scales with <code class='tok'>ρ/(1−ρ)</code> times the average of the squared coefficients of variation of arrivals and service. Smoother traffic or more uniform request sizes push the knee to the right; bursty traffic and occasional giant requests pull it left.",
                "<strong>Pooling helps.</strong> Many servers sharing one queue (several workers pulling from a common queue) tolerate higher utilisation than the same servers with separate queues, because an idle server can pick up work that would otherwise wait. That is why a big pool can safely run hotter than a small one."
              ] },
              { t: "h", text: "The USE method" },
              { t: "p", html: "When latency rises, you need to know <em>which</em> resource is near its knee. Walk each one and ask three questions: <strong>Utilisation</strong> (how busy), <strong>Saturation</strong> (how much work is queued or waiting), <strong>Errors</strong> (is it failing)." },
              { t: "table", headers: ["Resource", "Utilisation", "Saturation", "Errors"], rows: [
                ["CPU", "Busy % per core", "Run-queue length, throttled time in containers", "Machine check errors (rare)"],
                ["Memory", "Used vs limit", "Swapping, page faults, OOM-kill pressure", "Allocation failures, OOM kills"],
                ["Disk", "Device busy %", "I/O queue depth, await time", "I/O errors"],
                ["Network", "Throughput vs link", "Socket backlog, retransmits, drops", "Interface errors"],
                ["Connection / thread pool", "Active vs max", "Callers waiting for a slot, wait time", "Acquire timeouts"]
              ] },
              { t: "note", variant: "trap", html: "Container CPU is a classic trap: average utilisation reads 40% while the container is being <em>throttled</em> every scheduling period because bursts exceed its quota. Saturation (throttled time) tells the truth when utilisation does not." },
              { t: "note", variant: "tip", html: "What should a service do when it is pushed past the knee anyway? Rejecting work early beats queueing it. The system design side is covered in <a href='../hld-lld-academy/index.html#/hld/reliability/load-shedding-degradation'>Blueprint: Load shedding and degradation</a>." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Running hot is cheaper per request and latency-expensive; running cool is fast and wastes money. The honest target depends on the latency SLO and how bursty traffic is: latency-sensitive interactive services often plan for 50–70% at peak, while batch workers can run near 90% because nobody waits on any single item." },
              { t: "p", html: "<strong>Interview cue:</strong> \"Latency grows like one over one minus utilisation, so I target about 70% at peak for this service, and I use USE on CPU, memory, disk, network and pools to find which resource is at the knee first.\"" },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>Queueing delay grows like one over one minus utilisation, so I plan to keep busy resources below the knee — roughly 70 to 80% — and watch saturation, not just utilisation.</em>" },
              { t: "note", variant: "key", html: "<strong>Utilisation has a knee, and the knee is well before 100%.</strong> Plan peak utilisation below it, and diagnose with saturation, not just utilisation." }
            ]
          },
          {
            id: "capacity-planning",
            title: "Capacity planning: headroom, N+1 and growth",
            summary: "Turn a load test and a growth curve into an instance count that survives a failure at peak.",
            minutes: 10,
            tags: ["capacity-planning", "headroom", "forecasting"],
            blocks: [
              { t: "p", html: "Capacity planning answers one question with a date on it: <em>will we have enough to serve peak load, with a failure in progress, at the end of the planning horizon?</em> It combines three numbers: what one unit can safely handle, what peak demand will be, and how much spare you need to lose something and keep going." },
              { t: "h", text: "Step 1: safe throughput per unit" },
              { t: "p", html: "Run a breakpoint test against one instance with a realistic workload. Note the throughput where the latency SLO is first breached, then plan at a fraction of it so you stay below the knee. If one instance breaches p99 at 600 req/s, planning at about two thirds of that, 400 req/s, is a reasonable starting point." },
              { t: "h", text: "Step 2: forecast the peak" },
              { t: "code", lang: "text", code:
                "today's peak             = 12,000 req/s (busiest minute last quarter)\n" +
                "organic growth           = 8% per month, compounding\n" +
                "horizon                  = 6 months (lead time to get quota + hardware)\n" +
                "forecast peak            = 12,000 × 1.08^6 ≈ 12,000 × 1.587 ≈ 19,000 req/s\n" +
                "known event (launch)     = +20% on top            ≈ 22,800 req/s\n\n" +
                "safe per instance        = 400 req/s\n" +
                "instances at peak        = 22,800 / 400 = 57\n\n" +
                "survive one of 3 zones   = each zone must carry 57 / 2 = 28.5 -> 29\n" +
                "total                    = 3 × 29 = 87 instances"
              },
              { t: "h", text: "Step 3: redundancy" },
              { t: "table", headers: ["Scheme", "Survives", "Overhead for 3 zones"], rows: [
                ["N", "Nothing; any failure at peak means overload", "0%"],
                ["N+1", "One instance or host failing", "Small: one extra unit"],
                ["N+2", "One failure while another unit is down for deploy or maintenance", "Two extra units"],
                ["Zone-redundant", "Loss of a whole availability zone", "50% with 3 zones, 33% with 4"],
                ["Region-redundant", "Loss of a region, if the other region can absorb its traffic", "Up to 100% for two regions"]
              ] },
              { t: "note", variant: "warn", html: "Autoscaling is not headroom. Scaling takes minutes (new nodes, image pull, warm-up, cache fill), while a zone failure or a traffic spike moves load in seconds. Keep enough <em>running</em> spare to absorb the step, and let autoscaling restore the margin afterwards." },
              { t: "h", text: "Forecasting without fooling yourself" },
              { t: "ul", items: [
                "Forecast the <strong>peak</strong>, not the daily average; peak-to-average ratios of 2–4× are common for consumer traffic.",
                "Model the business driver (users, orders, devices) and derive requests from it; requests per user changes when the product does.",
                "Add known events from the calendar: launches, sales, seasonal peaks, marketing pushes.",
                "Track forecast against actual monthly and re-plan when the error exceeds an agreed band.",
                "Plan the slowest resource, not only compute: database write capacity, storage growth and third-party rate limits usually take longest to raise."
              ] },
              { t: "table", headers: ["Tier", "Approach", "Weakness or strength"], rows: [
                ["Naive", "\"CPU is at 40%, we're fine\"", "Ignores the peak, failure scenarios and non-CPU bottlenecks"],
                ["Solid", "Per-instance safe throughput from a load test × forecast peak, with N+1", "Survives a host failure; may not survive a zone loss or launch spike"],
                ["Standout", "Safe throughput at the knee, forecast peak with growth and events, zone-loss redundancy, the slowest resource planned with its lead time, reviewed against actuals monthly", "Gives a date by which each resource runs out and what to order now"]
              ] },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Every scheme above trades money for survivable failure. Zone redundancy across three zones costs roughly 50% more compute than bare N, and that is often the right price for an interactive tier. A batch tier that can fall behind for an hour may run at N+1 and catch up later." },
              { t: "p", html: "<strong>Interview cue:</strong> \"I'd take safe per-instance throughput from a breakpoint test, forecast peak with compounding growth plus known events, size so two of three zones carry the whole peak, and check the database and quotas, because those have the longest lead time.\"" },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I forecast peak demand from growth, convert it to instances with Little's law and a utilisation target, add N+1 or zone headroom, and set a lead-time trigger for ordering capacity.</em>" },
              { t: "note", variant: "key", html: "<strong>Plan for peak, during a failure, at the end of the lead time.</strong> Safe throughput per unit × forecast peak × redundancy for the failure you must survive gives the count; the slowest resource sets the deadline." }
            ]
          },
          {
            id: "tail-latency",
            title: "Tail latency at scale",
            summary: "Why the p99 of one backend becomes the median of a fan-out request, and the techniques that tame it.",
            minutes: 10,
            tags: ["tail-latency", "fan-out", "hedged-requests", "coordinated-omission"],
            blocks: [
              { t: "p", html: "When one user request waits for many backend calls, the user experiences the <em>slowest</em> of them. A backend that is slow on only 1% of calls becomes the common case once a page fans out to dozens of them. At scale, tail latency stops being a statistic about rare users and becomes the experience of most users." },
              { t: "code", lang: "text", code:
                "P(at least one slow call) = 1 − (1 − p)^N, with p = per-call slow probability\n\n" +
                "p = 1% (calls slower than that backend's p99)\n" +
                "  N = 1    -> 1.0%\n" +
                "  N = 10   -> 9.6%\n" +
                "  N = 50   -> 39.5%\n" +
                "  N = 100  -> 63.4%\n\n" +
                "To keep the user-facing request at 1% slow with N = 100,\n" +
                "each backend needs roughly a 0.01% slow rate: its p99.99 must meet the bar."
              },
              { t: "widget", id: "bcFanout" },
              { t: "h", text: "Where the tail comes from" },
              { t: "ul", items: [
                "Queueing behind a burst or a large request (head-of-line blocking).",
                "Garbage collection pauses, JIT warm-up and cold caches after a deploy.",
                "Noisy neighbours on shared hosts, CPU throttling in containers.",
                "Background work: compaction, log rotation, backups, index rebuilds.",
                "Retries after a timeout, which add a full timeout to the request's latency."
              ] },
              { t: "h", text: "Techniques that cut it" },
              { t: "table", headers: ["Technique", "How it works", "Cost"], rows: [
                ["Hedged requests", "Send the call; if no reply by roughly that backend's p95, send a second copy to another replica and use whichever answers first", "A few percent extra load; only safe for idempotent reads"],
                ["Tied requests", "Send to two replicas at once, each told about the other, and cancel the second when the first starts work", "More coordination; less wasted work than blind duplication"],
                ["Fewer, fatter calls", "Batch or co-locate data so a page needs fewer backends", "Design effort; larger payloads"],
                ["Partial results", "Return what arrived within the deadline and mark the rest missing", "Product must accept incomplete answers"],
                ["Fix the source", "Tune GC, isolate background work, pin noisy neighbours, pre-warm after deploy", "Engineering time, but it helps every caller"]
              ] },
              { t: "h", text: "Measuring the tail honestly: coordinated omission" },
              { t: "p", html: "A closed-loop load tool sends a request, waits for the reply, then sends the next. If the server stalls for two seconds, that virtual user also stops for two seconds, so the requests that a real user population would have sent during the stall, and that would have queued behind it, are never sent or measured. The tool reports a good p99 for a system that was frozen. This is <strong>coordinated omission</strong>." },
              { t: "compare",
                bad: { title: "Hides the stall", items: ["Fixed virtual users, each waiting on its own response", "Latency measured from the actual send time", "Send rate quietly drops when the server slows"] },
                good: { title: "Shows the stall", items: ["Open model: a fixed arrival rate regardless of responses", "Latency measured from the intended send time", "Check that the achieved rate equals the configured rate"] } },
              { t: "note", variant: "tip", html: "Percentile maths, and why you cannot average percentiles across hosts, is covered in <a href='#/slo/sli/percentiles'>Percentiles and histograms</a>." },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Hedging trades extra load for lower tail latency, and it can make overload worse if it fires during a widespread slowdown, so cap hedges to a small share of traffic. Partial results trade correctness for speed. Fixing the source costs the most engineering time and helps every caller." },
              { t: "p", html: "<strong>Interview cue:</strong> \"With a fan-out of 100, the backend's p99 is roughly the user's median, so I'd set per-backend targets at p99.9 or tighter, hedge idempotent reads after the p95 with a cap, and measure with an open-model load test so coordinated omission doesn't hide stalls.\"" },
              { t: "quiz", id: "perf-theory" },
              { t: "note", variant: "key", html: "<strong>Fan-out turns rare into common: 1 − (1 − p)^N.</strong> Tighten per-backend tails, hedge carefully, and measure from intended send times so the tail you report is the tail users feel." }
            ]
          }
        ]
      },
      {
        id: "testing",
        name: "Load Testing in Practice",
        icon: "wrench",
        lessons: [
          {
            id: "load-test-types",
            title: "Load, stress, soak, spike and breakpoint tests",
            summary: "Each test shape answers a different question; pick the shape from the question.",
            minutes: 8,
            tags: ["load-testing", "stress", "soak", "spike"],
            blocks: [
              { t: "p", html: "\"Run a load test\" is not a plan. Each test shape answers one question about the system, and the shape of the traffic curve (how fast you ramp, how high, how long you hold) is what makes it answer that question. Start from the question and choose the shape." },
              { t: "table", headers: ["Type", "Shape", "Typical duration", "Question it answers"], rows: [
                ["Smoke", "A handful of users", "1–5 min", "Does the script and the environment work at all?"],
                ["Load", "Ramp to expected peak, hold", "30–60 min", "Do we meet the SLO at the load we expect?"],
                ["Stress", "Ramp beyond peak (1.5–3×)", "30–60 min", "How do we behave past capacity: shed, slow, or collapse?"],
                ["Soak (endurance)", "Hold realistic load", "4–24 h", "Do leaks, fragmentation, log growth or pool exhaustion appear over time?"],
                ["Spike", "Jump from normal to many times normal in seconds", "Minutes", "Do autoscaling, caches and queues cope with a sudden burst, and do we recover?"],
                ["Breakpoint (capacity)", "Step up load until the SLO breaks", "Until failure", "What is the maximum sustainable throughput, and what fails first?"]
              ] },
              { t: "code", lang: "text", code:
                "req/s\n" +
                "  ^            stress          spike\n" +
                "  |           _______           |\n" +
                "  |   load   /       \\          |\\\n" +
                "  |  _______/         \\      ___| \\___\n" +
                "  | /                  \\    /\n" +
                "  |/  soak: a long flat line at the load level, for hours\n" +
                "  +-----------------------------------------> time"
              },
              { t: "h", text: "Open versus closed workloads" },
              { t: "p", html: "In a <strong>closed</strong> model a fixed number of virtual users each loop through requests; if the system slows, they send less. In an <strong>open</strong> model requests arrive at a set rate regardless of response time, like real internet traffic. Use open models when you care about latency under load, and closed models for things like a fixed pool of internal workers." },
              { t: "note", variant: "warn", html: "A stress test that only proves \"it falls over at 2.5×\" has missed half its value. Record <em>how</em> it failed: did it shed with fast 503s, slow down for everyone, or collapse and stay down after load dropped? A system that does not recover when load returns to normal is in a metastable failure, and that is the finding to fix." },
              { t: "ul", items: [
                "Run smoke on every change, load in CI on a schedule or before releases, and soak, stress, spike and breakpoint before major launches and after architecture changes.",
                "Every run should name the question, the shape, the target and what result counts as a pass.",
                "Watch the system under test (USE on every resource, plus dependencies), not just the client-side numbers."
              ] },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Longer and bigger tests find more, and they cost environment time, generator capacity and sometimes real money in cloud spend or third-party calls. Short smoke and load tests catch regressions cheaply; reserve the expensive shapes for the questions only they answer." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"memory grows over the weekend\" (soak), \"flash sale at noon\" (spike), \"how many users can we take\" (breakpoint), \"what happens if we get double traffic\" (stress), \"will we meet the SLO at launch\" (load)." },
              { t: "p", html: "<strong>Interview cue:</strong> \"I'd pick the test from the question: load to verify the SLO at forecast peak, breakpoint to find the ceiling for capacity planning, soak for leaks, and spike for autoscaling, all with an open arrival-rate model.\"" },
              { t: "note", variant: "key", html: "<strong>The question picks the shape.</strong> Load verifies, stress and breakpoint find limits and failure behaviour, soak finds slow decay, spike tests reaction; record how it failed, not just when." }
            ]
          },
          {
            id: "load-tools",
            title: "Load tools: k6, JMeter, Locust and Gatling",
            summary: "What each tool family is good at, with a k6 script and a Locust file you can adapt.",
            minutes: 11,
            tags: ["k6", "jmeter", "locust", "gatling"],
            blocks: [
              { t: "p", html: "Every mainstream load tool can generate HTTP traffic. They differ in how you write tests, how efficiently one machine generates load, how they model arrivals, and how well they fit into code review and CI. Choose the one whose scripting language your team already reads in review." },
              { t: "table", headers: ["Tool", "Scripts in", "Strengths", "Watch out for"], rows: [
                ["k6", "JavaScript", "Tests as code, built-in thresholds that fail the run, arrival-rate executors, light on resources", "Not a browser or Node runtime; npm packages need bundling"],
                ["JMeter", "XML plans built in a GUI", "Huge protocol coverage (JDBC, JMS, LDAP and more), mature plugins", "Plans are hard to review in diffs; heavy per thread at high concurrency"],
                ["Locust", "Python", "Readable user classes, easy custom logic and protocols, distributed workers", "Python per-worker throughput is lower; plan more workers for high rates"],
                ["Gatling", "Scala, Java or Kotlin DSL", "Very efficient asynchronous engine, open injection profiles, detailed reports", "JVM build tooling; DSL has a learning curve"]
              ] },
              { t: "h", text: "k6: an open-model test with SLO thresholds" },
              { t: "code", lang: "javascript", code:
                "// load.js — run with: k6 run -e BASE_URL=\"$STAGING_BASE_URL\" load.js\n" +
                "// BASE_URL is the base address of the staging api.shop.example, injected by CI.\n" +
                "import http from \"k6/http\";\n" +
                "import { check, sleep } from \"k6\";\n\n" +
                "const BASE = __ENV.BASE_URL;\n\n" +
                "export const options = {\n" +
                "  scenarios: {\n" +
                "    shoppers: {\n" +
                "      executor: \"ramping-arrival-rate\",   // open model: new journeys per second\n" +
                "      startRate: 20, timeUnit: \"1s\",\n" +
                "      preAllocatedVUs: 200, maxVUs: 2000,\n" +
                "      stages: [\n" +
                "        { target: 150, duration: \"5m\" },   // ramp\n" +
                "        { target: 150, duration: \"20m\" },  // hold at forecast peak\n" +
                "        { target: 0, duration: \"2m\" }      // ramp down\n" +
                "      ]\n" +
                "    }\n" +
                "  },\n" +
                "  thresholds: {\n" +
                "    http_req_failed: [\"rate<0.001\"],                              // < 0.1% errors\n" +
                "    \"http_req_duration{name:product}\": [\"p(95)<250\", \"p(99)<600\"], // from the SLO\n" +
                "    checks: [\"rate>0.99\"]\n" +
                "  }\n" +
                "};\n\n" +
                "export default function () {\n" +
                "  const id = Math.floor(Math.random() * 50000) + 1;     // spread across the catalogue\n" +
                "  const res = http.get(`${BASE}/products/${id}`, { tags: { name: \"product\" } });\n" +
                "  check(res, { \"status 200\": (r) => r.status === 200 });\n" +
                "  sleep(1 + Math.random() * 2);                         // think time inside the journey\n" +
                "  http.post(`${BASE}/cart`, JSON.stringify({ sku: `SKU-${id}`, qty: 1 }),\n" +
                "    { headers: { \"Content-Type\": \"application/json\" }, tags: { name: \"cart\" } });\n" +
                "}"
              },
              { t: "h", text: "Locust: user behaviour in Python" },
              { t: "code", lang: "python", code:
                "# locustfile.py — run headless:\n" +
                "#   locust -f locustfile.py --host \"$STAGING_BASE_URL\" --headless \\\n" +
                "#          --users 600 --spawn-rate 20 --run-time 25m\n" +
                "import random\n" +
                "from locust import HttpUser, task, between\n\n" +
                "class Shopper(HttpUser):\n" +
                "    wait_time = between(1, 3)          # think time between tasks\n\n" +
                "    @task(6)\n" +
                "    def browse(self):\n" +
                "        self.client.get(\"/products?page=%d\" % random.randint(1, 200), name=\"list\")\n\n" +
                "    @task(3)\n" +
                "    def view(self):\n" +
                "        pid = random.randint(1, 50000)\n" +
                "        self.client.get(\"/products/%d\" % pid, name=\"product\")\n\n" +
                "    @task(1)\n" +
                "    def add_to_cart(self):\n" +
                "        pid = random.randint(1, 50000)\n" +
                "        self.client.post(\"/cart\", json={\"sku\": \"SKU-%d\" % pid, \"qty\": 1}, name=\"cart\")"
              },
              { t: "note", variant: "trap", html: "Locust's <code class='tok'>users</code> are a closed model: each user waits for its response before its next task. If you need a fixed arrival rate, use a constant-throughput pacing approach or a tool with arrival-rate executors, and always compare the achieved request rate with the one you intended." },
              { t: "h", text: "JMeter and Gatling at a glance" },
              { t: "ul", items: [
                "<strong>JMeter</strong> builds test plans from thread groups, samplers, timers and assertions, saved as XML. Run it headless in CI with the non-GUI mode, and use its wide protocol support when you must load a message broker, a directory or a database directly.",
                "<strong>Gatling</strong> describes scenarios in a code DSL and injects users with open profiles such as constant or ramping users per second. Its asynchronous engine generates high rates from modest hardware, and its HTML report is detailed."
              ] },
              { t: "h", text: "Generating load you can trust" },
              { t: "ul", items: [
                "Keep generator CPU well below saturation; a hot generator inflates latency and under-delivers rate.",
                "Distribute generators when one machine cannot produce the rate, and run them close to where real users enter (same region, through the same edge if possible).",
                "Tag requests by endpoint name so ids in paths do not explode the metrics into thousands of series.",
                "Never point a load test at production or a third party without an agreed plan, a kill switch and the owner's consent."
              ] },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Code-first tools (k6, Locust, Gatling) make tests reviewable and CI-friendly but need engineers to write them. GUI-built JMeter plans are approachable and cover more protocols but are hard to diff and maintain. Efficiency matters at high rates: a less efficient tool simply needs more generator machines." },
              { t: "p", html: "<strong>Interview cue:</strong> \"I'd use k6 for HTTP services because tests live in the repo, thresholds come from the SLO and fail the CI job, and the arrival-rate executor avoids coordinated omission; Locust if the team prefers Python or needs custom protocol logic.\"" },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I choose a load tool by its workload model — open arrival-rate generators avoid coordinated omission — keep scripts in version control, and wire thresholds to SLOs so the test fails itself.</em>" },
              { t: "note", variant: "key", html: "<strong>Pick the tool your team will review, then make it honest.</strong> Tests as code, an open arrival model, SLO thresholds that fail the run and an unsaturated generator matter more than the brand." }
            ]
          },
          {
            id: "test-design",
            title: "Designing a load test you can trust",
            summary: "Realistic workload, think time, ramps, data and environment parity, with pass/fail lines taken from the SLO.",
            minutes: 10,
            tags: ["test-design", "workload-model", "thresholds"],
            blocks: [
              { t: "p", html: "A load test is an experiment: it predicts how production behaves at a load you have not seen yet. The prediction is only as good as the resemblance between the test and reality. Every shortcut (one endpoint, ten test users, a half-size database) makes the result look better than production will be." },
              { t: "h", text: "The six design decisions" },
              { t: "table", headers: ["Decision", "Realistic choice", "Common shortcut and its effect"], rows: [
                ["Workload mix", "Endpoint ratios taken from production access logs, for example 60% browse, 30% product, 8% cart, 2% checkout", "Hammering one endpoint misses contention between paths"],
                ["Arrival model", "Open arrival rate shaped like the real daily peak", "Fixed users with no think time hide queueing"],
                ["Think time", "Randomised pauses within a user journey, from real session data", "No pauses turn 500 users into an unrealistic flood or a mis-modelled closed loop"],
                ["Ramp", "Warm-up, gradual ramp, steady hold, ramp down", "Instant full load measures cold caches and connection storms"],
                ["Test data", "Production-sized datasets, many distinct users and keys, a realistic hot/cold distribution", "A few ids keep every cache hot and flatter latency"],
                ["Environment", "Same instance types, configs, versions, topology and dependency behaviour as production", "Smaller instances or mocked dependencies make results non-transferable"]
              ] },
              { t: "h", text: "Pass/fail lines from the SLO" },
              { t: "p", html: "Start from the service's SLO and the forecast peak. If the SLO is \"99% of product requests under 600 ms and 99.9% success\", the load test asserts those at the forecast peak plus headroom, and the CI job fails if they are breached. See <a href='#/slo/budgets/slo-setting'>Setting SLOs</a> for where those targets come from." },
              { t: "code", lang: "yaml", code:
                "# perf-plan.yaml — reviewed with the change, consumed by the CI job\n" +
                "service: catalog-api\n" +
                "question: Do we meet the SLO at forecast Q4 peak with one zone drained?\n" +
                "target_rate: 22800        # req/s, forecast peak from the capacity plan\n" +
                "zones_available: 2        # one of three drained to model zone loss\n" +
                "mix: { list: 0.60, product: 0.30, cart: 0.08, checkout: 0.02 }\n" +
                "think_time_s: [1, 3]\n" +
                "ramp: { warmup: 5m, ramp: 10m, hold: 30m, down: 3m }\n" +
                "data: { products: 2000000, users: 500000, hot_key_share: 0.2 }\n" +
                "pass:\n" +
                "  product_p99_ms: 600\n" +
                "  error_rate: 0.001\n" +
                "  db_cpu_max: 0.75        # leave headroom on the slowest resource\n" +
                "abort_if:\n" +
                "  error_rate: 0.05        # stop early, something is badly wrong"
              },
              { t: "h", text: "Running it" },
              { t: "ol", items: [
                "Smoke the script at a trivial rate to prove it works and the environment is healthy.",
                "Announce the run to anyone sharing the environment and its dependencies.",
                "Watch the system under test live: USE on every resource, dependency latency, queue depths, GC, autoscaling events.",
                "Confirm the achieved rate matched the target and the generator stayed unsaturated.",
                "Record the result against the plan and keep the raw data so later runs can be compared."
              ] },
              { t: "note", variant: "warn", html: "Environment parity is the hardest decision and the easiest to fudge. If you must test on a smaller environment, test one production-sized instance to find per-instance throughput, and scale the result only for the stateless tier. Shared resources such as the database do not scale linearly with a smaller copy." },
              { t: "table", headers: ["Tier", "Test design", "What you learn"], rows: [
                ["Naive", "One endpoint, 100 looping users, no think time, small staging database, pass if \"it looked fine\"", "Little; results do not transfer to production"],
                ["Solid", "Production mix, arrival-rate ramp, realistic data, SLO thresholds that fail CI", "Whether the release meets the SLO at expected peak"],
                ["Standout", "All of Solid, plus failure modes during load (zone drained, slow dependency), resource headroom assertions, and trend tracking across releases", "Whether you meet the SLO at peak during a failure, and which resource runs out first"]
              ] },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Realism costs money and time: production-sized environments, data and generators are expensive, and long runs slow release cadence. Balance it by running a cheap, fast, realistic-mix load test on every release and the full production-parity test on a schedule and before major events." },
              { t: "p", html: "<strong>Interview cue:</strong> \"I'd model the mix from access logs, drive an open arrival rate to forecast peak with one zone drained, use production-sized data so caches behave, and fail CI on the SLO thresholds plus a headroom limit on the database.\"" },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>A load test is only as good as its workload model: realistic mix, think time, data and ramp, run in an environment close to production, with pass/fail lines taken from the SLO.</em>" },
              { t: "quiz", id: "perf-testing" },
              { t: "note", variant: "key", html: "<strong>A load test is only as good as its resemblance to production.</strong> Real mix, open arrivals, think time, realistic data and parity, with pass/fail taken from the SLO, turn a chart into a release decision." }
            ]
          }
        ]
      }
    ]
  };
})();
