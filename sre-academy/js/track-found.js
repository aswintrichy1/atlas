/* =====================================================================
   BEACON · SRE Foundations
   window.TRACKS.found — modules: principles / practice

   Self-contained: this file registers its own widgets (bcNines, bcToil),
   its own quizzes (found-principles, found-practice) and its track data.
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

  /* minutes -> human duration */
  function dur(min) {
    min = fin(min, 0);
    if (min <= 0) return "0 s";
    if (min < 1) return sig(min * 60) + " s";
    if (min < 120) return sig(min) + " min";
    if (min < 48 * 60) return sig(min / 60) + " h";
    return sig(min / 1440) + " days";
  }

  function bar(pct, color) {
    pct = Math.max(0, Math.min(100, fin(pct, 0)));
    return h("span", { style: "display:block;height:12px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
      h("i", { style: "display:block;height:100%;width:" + pct.toFixed(1) + "%;background:" + color }));
  }

  var Widgets = {};

  /* ==================================================================
     1. bcNines — target availability vs serial hard dependencies
  ================================================================== */
  var DEP_AVAIL = 99.95;

  Widgets.bcNines = function (mount) {
    shell(mount, "calculator", "Nines and the dependency ceiling",
      "Pick an availability target, then add serial hard dependencies (each at " + DEP_AVAIL + "%). Availability multiplies along a serial chain, so the dependencies cap what you can ever deliver.");
    var st = { target: 99.9, deps: 3 };
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var depLabel = h("b", {}, String(st.deps));

    controls.appendChild(segment([[99, "99%"], [99.5, "99.5%"], [99.9, "99.9%"], [99.95, "99.95%"], [99.99, "99.99%"], [99.999, "99.999%"]], 2,
      function (v) { st.target = v; paint(); }));
    var rng = h("input", { type: "range", min: "0", max: "8", step: "1", value: String(st.deps) });
    rng.addEventListener("input", function () {
      var v = parseInt(rng.value, 10);
      st.deps = isFinite(v) ? Math.max(0, Math.min(8, v)) : 0;
      paint();
    });
    controls.appendChild(h("label", { class: "w-field" }, "hard dependencies ", rng, " ", depLabel));

    function row(label, pct, color, value) {
      return h("div", { style: "display:grid;grid-template-columns:190px 1fr 90px;gap:10px;align-items:center;padding:4px 0" },
        h("span", { style: "font-size:0.84rem;color:var(--text)" }, label),
        bar(pct, color),
        h("span", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text-dim)" }, value));
    }

    function paint() {
      depLabel.textContent = String(st.deps);
      var down = 1 - st.target / 100;
      var per30 = down * 43200, perYear = down * 525600, perWeek = down * 10080;
      var ceiling = Math.pow(DEP_AVAIL / 100, st.deps);
      var depDown30 = (1 - ceiling) * 43200;
      var effective = (st.target / 100) * ceiling;
      var scale = Math.max(per30, depDown30, 0.0001);

      clear(stage);
      stage.appendChild(row("your downtime budget / 30d", per30 / scale * 100, "var(--cyan)", dur(per30)));
      stage.appendChild(row("eaten by dependencies / 30d", depDown30 / scale * 100, st.deps === 0 ? "var(--lime)" : "var(--rose)", dur(depDown30)));
      var chips = h("div", { style: "display:flex;flex-wrap:wrap;gap:6px;padding-top:8px" });
      chips.appendChild(h("span", { style: "padding:2px 8px;border-radius:10px;background:var(--accent);color:var(--on-accent);font-size:0.78rem" }, "your service"));
      for (var i = 0; i < st.deps; i++) {
        chips.appendChild(h("span", { style: "padding:2px 8px;border-radius:10px;border:1px solid var(--line);color:var(--text-dim);font-size:0.78rem" }, "dep " + (i + 1) + " · " + DEP_AVAIL + "%"));
      }
      stage.appendChild(chips);

      clear(readout);
      readout.appendChild(ro("allowed downtime / 30 days", dur(per30)));
      readout.appendChild(ro("per year", dur(perYear)));
      readout.appendChild(ro("per week", dur(perWeek)));
      readout.appendChild(ro("dependency ceiling", (ceiling * 100).toFixed(3) + "%"));
      readout.appendChild(ro("best case if you hit target", (effective * 100).toFixed(3) + "%"));
      readout.appendChild(ro("verdict", ceiling * 100 < st.target ? "unreachable: dependencies alone exceed your budget" : depDown30 > per30 * 0.5 ? "tight: dependencies eat over half the budget" : "feasible"));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. bcToil — how much of the team is a single chore eating?
  ================================================================== */
  Widgets.bcToil = function (mount) {
    shell(mount, "calculator", "Toil budget and automation payback",
      "Describe one recurring chore and the toil you already carry. The readouts show the share of team capacity it consumes (40 h per engineer per week) and how fast automating it pays back.");
    var st = { mins: 20, perWeek: 30, team: 6, autoHours: 40, existing: 25 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function field(label, key, min, max, step) {
      var inp = h("input", { type: "number", min: String(min), max: String(max), step: String(step), value: String(st[key]), style: "width:5.5em" });
      inp.addEventListener("input", function () {
        var v = parseFloat(inp.value);
        if (!isFinite(v)) return;
        st[key] = Math.max(min, Math.min(max, v));
        paint();
      });
      controls.appendChild(h("label", { class: "w-field" }, label + " ", inp));
    }
    field("task minutes", "mins", 1, 480, 1);
    field("times / week", "perWeek", 0, 1000, 1);
    field("team size", "team", 1, 50, 1);
    field("hours to automate", "autoHours", 0, 2000, 1);
    var exLabel = h("b", {}, st.existing + "%");
    var ex = h("input", { type: "range", min: "0", max: "60", step: "1", value: String(st.existing) });
    ex.addEventListener("input", function () {
      var v = parseInt(ex.value, 10);
      st.existing = isFinite(v) ? Math.max(0, Math.min(60, v)) : 0;
      paint();
    });
    controls.appendChild(h("label", { class: "w-field" }, "toil already carried ", ex, " ", exLabel));

    function seg(pct, color, title) {
      pct = Math.max(0, fin(pct, 0));
      return h("i", { title: title, style: "display:block;height:100%;width:" + pct.toFixed(1) + "%;background:" + color });
    }

    function paint() {
      exLabel.textContent = st.existing + "%";
      var toilH = st.mins * st.perWeek / 60;
      var capacity = Math.max(1, st.team) * 40;
      var taskPct = toilH / capacity * 100;
      var total = st.existing + taskPct;
      var shownTask = Math.max(0, Math.min(100 - st.existing, taskPct));
      var payback = toilH > 0 ? st.autoHours / toilH : -1;

      clear(stage);
      var track = h("div", { style: "position:relative;display:flex;height:22px;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
        seg(st.existing, "var(--amber)", "existing toil"),
        seg(shownTask, "var(--rose)", "this task"),
        h("span", { style: "position:absolute;left:50%;top:0;bottom:0;width:2px;background:var(--text)" }));
      stage.appendChild(track);
      stage.appendChild(h("div", { style: "display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-dim);padding-top:6px" },
        h("span", {}, "amber: existing toil · rose: this task"),
        h("span", {}, "line: 50% cap"),
        h("span", {}, "rest: engineering time")));

      clear(readout);
      readout.appendChild(ro("this task", sig(toilH) + " h/week"));
      readout.appendChild(ro("share of team capacity", sig(taskPct) + "%"));
      readout.appendChild(ro("total toil", sig(total) + "%"));
      readout.appendChild(ro("automation payback", payback < 0 ? "no recurring cost to recover" : payback === 0 ? "immediate" : sig(payback) + " weeks"));
      var verdict;
      if (total > 50) verdict = "over the 50% cap: automate or hand work back";
      else if (total > 40) verdict = "near the cap: schedule the automation now";
      else if (payback >= 0 && payback <= 26) verdict = "under the cap, and automation pays back within six months";
      else verdict = "under the cap; automate when it grows or recurs";
      readout.appendChild(ro("verdict", verdict));
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
    "found-principles": {
      title: "What SRE is — checkpoint",
      sub: "SRE versus DevOps, reliability as a feature, and the arithmetic of nines.",
      questions: [
        {
          q: "Which statement best describes how SRE relates to DevOps?",
          options: [
            "SRE replaces DevOps and makes its ideas obsolete",
            "SRE is a concrete way of implementing DevOps ideas, with prescriptive practices such as SLOs, error budgets and a cap on operational work",
            "SRE is a team that only carries the pager so developers never have to",
            "SRE is a category of monitoring tools"
          ],
          answer: 1,
          explain: "DevOps describes a culture and a set of goals: shared ownership, fast flow, feedback. SRE turns those goals into specific mechanisms — measurable reliability targets, budgets that govern release pace, and engineers who treat operations as a software problem. The two are complementary, not competing."
        },
        {
          q: "Why do SRE teams cap operational work (tickets, pages, manual tasks) at roughly half of each engineer's time?",
          options: [
            "Because on-call pay is expensive",
            "Because regulators require it",
            "Because operational work is less important than features",
            "So there is always time left to engineer away the sources of that operational load; without the cap the team drifts into a pure ops team"
          ],
          answer: 3,
          explain: "Operational load tends to grow with the size of the service. If nothing protects engineering time, the team spends all of it reacting and never builds the automation that would shrink the load. The cap is a forcing function: exceed it and work flows back to the developers or gets automated."
        },
        {
          q: "A service targets 99.95% availability. Roughly how much downtime does that allow in a 30-day window?",
          options: ["4.32 minutes", "43.2 minutes", "21.6 minutes", "2.16 hours"],
          answer: 2,
          explain: "Thirty days is 43,200 minutes. The allowed unavailability is 0.05%, and 0.0005 × 43,200 = 21.6 minutes. A quick anchor: 99.9% is 43.2 minutes per 30 days, so each halving of the unavailability halves the budget."
        },
        {
          q: "Your service needs four serial hard dependencies to answer a request, each running at 99.9%. Ignoring your own failures, what is the best availability you can deliver?",
          options: ["About 99.6%", "99.9%", "99.99%", "About 96%"],
          answer: 0,
          explain: "Serial availability multiplies: 0.999⁴ ≈ 0.996, or about 99.6%. Every hard dependency you add in series lowers your ceiling, which is why reliable systems cache, degrade gracefully or make dependencies soft rather than promising more nines than their dependencies can support."
        },
        {
          q: "Why is 100% availability usually the wrong target for a consumer-facing service?",
          options: [
            "Because 100% is impossible to measure",
            "Because users prefer occasional outages",
            "Because lower targets make dashboards greener",
            "Because users cannot perceive reliability beyond that of their own networks and devices, while each extra nine costs far more and freezes change"
          ],
          answer: 3,
          explain: "Past a certain point, the phone, the home Wi-Fi and the mobile network fail far more often than your service does, so extra nines are invisible to users. Each additional nine costs roughly an order of magnitude more in redundancy and process and leaves almost no room to ship. The right target is the one users actually notice."
        },
        {
          q: "Who ultimately judges whether a service is reliable?",
          options: [
            "The infrastructure team, using host uptime",
            "The monitoring system, using CPU and memory graphs",
            "The users, through whether the things they try to do actually succeed quickly enough",
            "The vendor's status page"
          ],
          answer: 2,
          explain: "Healthy hosts do not mean happy users: a load balancer misroute or a bad config can fail every request while every machine looks fine. Reliability is a property of the user's experience, so it must be measured as close to that experience as practical and expressed in terms users would recognise."
        }
      ]
    },
    "found-practice": {
      title: "Running SRE — checkpoint",
      sub: "Toil, engagement models, readiness reviews and safe change.",
      questions: [
        {
          q: "Which of these is toil?",
          options: [
            "Manually restarting a stuck consumer, with the same steps, every time the queue backs up",
            "Writing the design doc for a new sharding scheme",
            "Running a blameless postmortem review",
            "Building an autoscaler that removes a weekly capacity chore"
          ],
          answer: 0,
          explain: "Toil is manual, repetitive, automatable, tactical work with no enduring value that grows with the service. The restart fits every trait. Design work, learning reviews and building automation are engineering: they leave the system permanently better."
        },
        {
          q: "A chore takes 15 minutes and happens 40 times a week. Automating it would take 60 engineer-hours. Roughly when does the automation pay for itself?",
          options: ["After about 15 weeks", "After about 10 weeks", "After about 6 weeks", "After about 4 weeks"],
          answer: 2,
          explain: "15 minutes × 40 = 600 minutes, or 10 hours a week. 60 hours of automation divided by 10 hours saved per week is a 6-week payback. Real ROI is usually better, because automation also removes errors and interruptions that the simple sum ignores."
        },
        {
          q: "A product team is in a reliability crisis and needs deep, hands-on help for a quarter. Which engagement model fits best?",
          options: [
            "Consulting: a one-hour review and a written report",
            "Kitchen-sink: the SRE team takes the pager for everything indefinitely",
            "Platform: wait for the next platform release",
            "Embedded: an SRE joins the team for a fixed period to fix the worst problems and transfer the practices"
          ],
          answer: 3,
          explain: "Embedding puts an SRE inside the team's code, standups and incidents, which is what a crisis needs. The fixed term matters: the goal is to leave the team able to run its own service well, not to create a permanent dependency."
        },
        {
          q: "In a production readiness review, which missing item is most likely to block a launch on its own?",
          options: [
            "Dashboards are not yet colour-coded",
            "There is no tested rollback path for the release",
            "The runbook has a few typos",
            "The service has not been load tested at ten times expected peak"
          ],
          answer: 1,
          explain: "Without a tested way back, every bad release becomes a forward-fix under pressure, which is exactly when outages get long. Readiness reviews prioritise the controls that bound the damage of a failure: SLOs and alerts to notice it, rollback to undo it, and an owner on call to act."
        },
        {
          q: "Most outages are triggered by change. Which practice best limits the damage of a bad change?",
          options: [
            "Requiring more approvers on every change",
            "Batching changes into a large monthly release",
            "Progressive rollout with canaries compared against a control group, and automatic rollback on SLO regression",
            "Banning deploys on weekdays"
          ],
          answer: 2,
          explain: "Progressive rollout limits blast radius: a bad change hurts a small slice of traffic before automated analysis catches it and rolls it back. More approvers and bigger batches slow delivery without bounding impact, and big batches make the cause harder to find."
        },
        {
          q: "What is the main hidden cost of a long change freeze?",
          options: [
            "Changes pile up, so the first release after the freeze is larger and riskier than any normal one",
            "Monitoring stops working during the freeze",
            "Error budgets cannot be calculated during a freeze",
            "Engineers forget how to deploy"
          ],
          answer: 0,
          explain: "A freeze defers risk rather than removing it. The queued work lands together, with less context and many interacting changes, which raises the chance of an incident just after the freeze. Short, targeted freezes plus safe rollout mechanics beat long blanket ones."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.found = {
    id: "found",
    name: "SRE Foundations",
    short: "FND",
    color: "#facc15",
    tagline: "Treat operations as a software problem",
    blurb: "What SRE actually is and is not, why reliability is a product feature, and why 100% is the wrong target. Then the daily practice: measuring and cutting toil, choosing a team model, running production readiness reviews and making change safe enough to ship often.",
    modules: [
      {
        id: "principles",
        name: "What SRE Is",
        icon: "compass",
        lessons: [
          {
            id: "sre-vs-devops",
            title: "SRE vs DevOps vs platform engineering",
            summary: "Three overlapping ideas, one shared goal: SRE is the version that comes with numbers and guardrails.",
            minutes: 8,
            tags: ["sre", "devops", "platform-engineering", "culture"],
            blocks: [
              { t: "p", html: "Hold this picture: <strong>DevOps</strong> is a set of goals (shared ownership, fast flow, fast feedback), <strong>SRE</strong> is one concrete way to reach them, and <strong>platform engineering</strong> is the product that makes the paved road cheap for everyone else. They are layers, not rivals." },
              { t: "h", text: "Operations as a software problem" },
              { t: "p", html: "The founding move of SRE is to staff operations with people who write software and to give them an explicit mandate: <em>if a human does it twice, consider making a machine do it</em>. Reliability work is then measured the way product work is — against targets — rather than by how busy the ops team looks." },
              { t: "table", headers: ["Aspect", "DevOps", "SRE", "Platform engineering"], rows: [
                ["What it is", "A culture and set of principles", "A job function with prescriptive practices", "An internal product team"],
                ["Core artefact", "Pipelines, shared on-call, feedback loops", "SLOs, error budgets, postmortems, toil cap", "Golden paths, self-service infra, templates"],
                ["Success measured by", "Flow metrics (deploy frequency, lead time)", "SLO attainment, budget burn, toil share", "Adoption and developer time saved"],
                ["Typical failure mode", "A rebranded ops team with a new title", "A pager-only team with no time to engineer", "A platform nobody asked for"]
              ] },
              { t: "h", text: "The 50% cap on operational work" },
              { t: "p", html: "SRE teams cap tickets, pages and manual chores at roughly <strong>half</strong> of each engineer's time. The rest goes to engineering that removes future load. When the cap is breached for long, operational work flows back to the developers who own the service, which keeps the incentive to build operable software where it belongs." },
              { t: "ul", items: [
                "Track operational load weekly (tickets, pages, toil hours), not just at review time.",
                "Breaching the cap triggers a conversation, not heroics: hand back work, add people, or cut scope.",
                "On-call is part of the operational half; a good rotation is a few pages per shift, not dozens."
              ] },
              { t: "compare",
                bad: { title: "SRE in name only", items: ["Same ops team, new title", "No SLOs; success is 'no one complained'", "100% of time is tickets and pages", "Developers throw releases over the wall"] },
                good: { title: "SRE as engineering", items: ["Targets agreed with product owners", "Error budgets govern release pace", "Half the time spent removing toil", "Developers share the pager and the fixes"] } },
              { t: "table", headers: ["Tier", "How you introduce SRE to an org"], rows: [
                ["Naive", "Rename the ops team and buy a monitoring tool"],
                ["Solid", "Pick one critical service, agree SLOs with its product owner, enforce the toil cap"],
                ["Standout", "Do that, then publish the engagement model and error-budget policy so other teams can opt in on clear terms"]
              ] },
              { t: "note", variant: "warn", html: "Platform engineering does not replace SRE. A great platform reduces the toil per service, but someone still has to set targets, run incidents and decide when reliability beats features." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'our ops team is drowning', 'should we hire SREs or DevOps engineers', 'who owns production'. <strong>Say it out loud:</strong> 'DevOps sets the goals; SRE makes them measurable with SLOs and protects engineering time with a cap on ops work.'" },
              { t: "note", variant: "key", html: "<strong>SRE is DevOps with numbers and guardrails.</strong> Measurable targets, budgets that govern change, and a hard cap on toil are what separate it from a renamed ops team." }
            ]
          },
          {
            id: "reliability-feature",
            title: "Reliability is a feature",
            summary: "Users judge reliability, it competes with velocity for the same engineers, and it belongs in the product requirements.",
            minutes: 7,
            tags: ["reliability", "product", "velocity"],
            blocks: [
              { t: "p", html: "Think of reliability as the feature every other feature depends on. A checkout page with a brilliant new design that fails one request in fifty is a worse product than last year's plain one that works. Users do not separate 'features' from 'uptime'; they separate 'it worked' from 'it did not'." },
              { t: "h", text: "Users are the judge" },
              { t: "p", html: "Your hosts can all be green while users fail: a bad route at the load balancer, an expired certificate, a config that sends every request to an empty shard. Reliability is therefore measured from the outside in — <em>did the user's request succeed, fast enough, with correct data</em> — not from CPU graphs." },
              { t: "stat", items: [
                { v: "64%", k: "chance a 50-request session hits an error at a 2% failure rate" },
                { v: "~10×", k: "rough cost growth per extra nine" },
                { v: "50%", k: "cap on ops work in an SRE team" }
              ] },
              { t: "h", text: "The reliability vs velocity tension" },
              { t: "table", headers: ["Push harder on…", "You gain", "You pay"], rows: [
                ["Velocity", "Features sooner, faster learning", "More change, which is where most incidents start"],
                ["Reliability", "Fewer incidents, user trust", "Slower releases, more redundancy cost, less experimentation"],
                ["Neither, by negotiation", "Endless arguments between dev and ops", "Decisions made by whoever shouts loudest"]
              ] },
              { t: "p", html: "SRE resolves the tension with a shared, numeric agreement: an <strong>SLO</strong> that says how reliable is reliable enough, and an <strong>error budget</strong> that says how much unreliability you can spend on shipping. Inside the budget, ship; outside it, fix. Nobody has to win an argument." },
              { t: "h", text: "Making it a product requirement" },
              { t: "ul", items: [
                "Write reliability targets into the product spec next to functional requirements, with the user journey they protect.",
                "Price unreliability: lost orders per minute of checkout downtime, support tickets per incident, churn after outages.",
                "Give the product owner, not only engineering, a say in the SLO, because they own the trade-off against features."
              ] },
              { t: "compare",
                bad: { title: "Reliability as an afterthought", items: ["'Make it highly available' with no number", "Measured by host uptime", "Owned by ops alone", "Discussed only after an outage"] },
                good: { title: "Reliability as a feature", items: ["A target per critical user journey", "Measured on user requests", "Agreed with product", "Reviewed every planning cycle"] } },
              { t: "note", variant: "trap", html: "Promising 'five nines' in a sales deck before anyone has measured the current level is a commitment the engineers will pay for. Targets come from user needs and measured reality, never from aspiration alone." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'product wants features, ops wants stability', 'how reliable should this be', 'the CEO wants zero downtime'. <strong>Say it out loud:</strong> 'Reliability competes with features for the same people, so we make it a numeric requirement the product owner signs, and spend the leftover as an error budget.'" },
              { t: "note", variant: "key", html: "<strong>Reliability is the feature users feel first.</strong> Measure it on user requests, price its absence, and settle the velocity argument with an agreed target instead of opinions." }
            ]
          },
          {
            id: "embracing-risk",
            title: "Embracing risk: why 100% is the wrong target",
            summary: "The nines table, why serial dependencies multiply, and why each extra nine costs about ten times more.",
            minutes: 10,
            tags: ["availability", "nines", "risk", "dependencies"],
            blocks: [
              { t: "p", html: "The mental model: reliability is a dial, not a switch, and every notch costs more than the last. The job is to pick the notch users actually notice, then <em>spend</em> the remaining risk on change rather than hoard it." },
              { t: "h", text: "The nines table" },
              { t: "table", headers: ["Availability", "Downtime / year", "Downtime / 30 days", "Downtime / day"], rows: [
                ["99%", "3.65 days", "7.2 h", "14.4 min"],
                ["99.5%", "1.83 days", "3.6 h", "7.2 min"],
                ["99.9%", "8.76 h", "43.2 min", "1.44 min"],
                ["99.95%", "4.38 h", "21.6 min", "43.2 s"],
                ["99.99%", "52.6 min", "4.32 min", "8.64 s"],
                ["99.999%", "5.26 min", "25.9 s", "0.86 s"]
              ] },
              { t: "code", lang: "text", code:
                "minutes in 30 days = 30 * 24 * 60      = 43,200\n" +
                "minutes in a year  = 365 * 24 * 60     = 525,600\n\n" +
                "99.9%   -> 0.001  * 43,200  = 43.2 min / 30d\n" +
                "99.99%  -> 0.0001 * 43,200  = 4.32 min / 30d\n" +
                "99.95%  -> 0.0005 * 525,600 = 262.8 min = 4.38 h / year"
              },
              { t: "h", text: "Dependency math: serial availability multiplies" },
              { t: "p", html: "If a request needs every one of N hard dependencies to succeed, the best you can do is the product of their availabilities. Five dependencies at 99.95% give a ceiling of 0.9995⁵ ≈ <strong>99.75%</strong> — below a 99.9% target before you ship a single bug of your own." },
              { t: "code", lang: "text", code:
                "A_total = A_you * A_dep1 * A_dep2 * ... * A_depN\n\n" +
                "3 deps @ 99.95%  -> 0.9995^3 = 0.99850  (99.85%)\n" +
                "5 deps @ 99.95%  -> 0.9995^5 = 0.99750  (99.75%)\n" +
                "4 deps @ 99.9%   -> 0.999^4  = 0.99601  (99.60%)\n\n" +
                "Parallel redundancy goes the other way:\n" +
                "2 replicas @ 99% each, independent -> 1 - 0.01^2 = 99.99%"
              },
              { t: "ul", items: [
                "Make dependencies <strong>soft</strong> where you can: serve cached or degraded results instead of failing.",
                "Watch for correlated failures; two replicas in one zone are not independent, so the parallel formula overstates them.",
                "A dependency's SLO is only useful to you if it is <em>stricter</em> than yours, typically by about one nine."
              ] },
              { t: "widget", id: "bcNines" },
              { t: "h", text: "The cost curve of each extra nine" },
              { t: "table", headers: ["Target", "What it typically takes", "What users notice"], rows: [
                ["99%", "One region, basic monitoring, manual recovery", "Regular, visible outages"],
                ["99.9%", "Redundant instances, automated deploys and rollback, on-call", "An occasional bad hour per quarter"],
                ["99.99%", "Multi-zone, automated failover, progressive rollout, strict change control", "Rarely anything at all"],
                ["99.999%", "Multi-region active-active, heavy automation, very slow change", "Indistinguishable from 99.99% on most consumer networks"]
              ] },
              { t: "table", headers: ["Tier", "Choosing a target"], rows: [
                ["Naive", "'As close to 100% as possible'"],
                ["Solid", "The level users notice, checked against the dependency ceiling"],
                ["Standout", "That level per user journey, with the leftover risk explicitly budgeted for launches and experiments"]
              ] },
              { t: "note", variant: "warn", html: "Beyond about four nines for a consumer service, the user's phone, Wi-Fi and mobile network fail far more often than you do. Extra nines past that point are invisible to them and very visible on your cost and release calendar." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we need five nines', 'our dependency is at 99.9% but we promise 99.99%', 'how much downtime can we afford'. <strong>Say it out loud:</strong> 'Serial dependencies multiply, so my ceiling is their product; I pick the nine users notice and spend the rest as budget.'" },
              { t: "quiz", id: "found-principles" },
              { t: "note", variant: "key", html: "<strong>Each nine costs about ten times more and users stop noticing after a point.</strong> Know the table by heart, multiply your dependencies before you promise anything, and spend leftover risk on change." }
            ]
          }
        ]
      },
      {
        id: "practice",
        name: "Running SRE",
        icon: "wrench",
        lessons: [
          {
            id: "toil",
            title: "Toil: spotting it, measuring it, cutting it",
            summary: "A precise definition of toil, how to measure it weekly, and the payback math that justifies automation.",
            minutes: 9,
            tags: ["toil", "automation", "capacity"],
            blocks: [
              { t: "p", html: "Toil is the work that keeps the lights on today and leaves nothing behind for tomorrow. The mental model: every hour of toil is a tax that grows with the service, and automation is the only way to stop paying it." },
              { t: "h", text: "The six traits of toil" },
              { t: "table", headers: ["Trait", "Test", "Example"], rows: [
                ["Manual", "A human has to run it", "SSH in and clear a disk"],
                ["Repetitive", "You have done it before and will again", "Weekly certificate rotation by hand"],
                ["Automatable", "A machine could do it as well", "Resizing a queue by a known formula"],
                ["Tactical", "Interrupt-driven, not planned", "Restarting a stuck consumer on page"],
                ["No enduring value", "The system is no better afterwards", "Re-running a flaky batch job"],
                ["Scales with the service", "Doubles when traffic or tenants double", "Onboarding each new customer by ticket"]
              ] },
              { t: "p", html: "Work does not need all six traits to be toil, but the more it has, the surer you can be. Overhead such as meetings and planning is <em>not</em> toil; neither is incident analysis or design, because they leave the system better." },
              { t: "h", text: "Measuring it" },
              { t: "ol", items: [
                "Tag tickets and on-call tasks as toil or engineering when they are closed, not from memory at quarter end.",
                "Sample: once a week each engineer estimates hours spent on toil; trend it per person and per service.",
                "Rank chores by <code class='tok'>minutes × occurrences</code>, then by error-proneness. The top three are your automation backlog."
              ] },
              { t: "code", lang: "text", code:
                "toil hours / week  = task_minutes * occurrences_per_week / 60\n" +
                "share of capacity  = toil_hours / (team_size * 40)\n" +
                "payback (weeks)    = hours_to_automate / toil_hours_per_week\n\n" +
                "example: 20 min * 30 / week = 10 h/week\n" +
                "         team of 6          = 10 / 240 = 4.2% of capacity\n" +
                "         40 h to automate   = payback in 4 weeks"
              },
              { t: "widget", id: "bcToil" },
              { t: "compare",
                bad: { title: "Cutting toil badly", items: ["A wiki page of manual steps", "Hero engineers who 'just know'", "Scripts on one laptop", "Automating rare, low-cost chores first"] },
                good: { title: "Cutting toil well", items: ["Remove the cause, not just the steps", "Self-service for requesters", "Automation in version control with tests", "Highest minutes × frequency first"] } },
              { t: "table", headers: ["Tier", "Response to a recurring disk-full page"], rows: [
                ["Naive", "Write a runbook to delete old logs by hand"],
                ["Solid", "Automate log rotation and alert on growth rate before the disk fills"],
                ["Standout", "Ship logs off-host, cap local retention by design, and delete the alert because the failure mode no longer exists"]
              ] },
              { t: "note", variant: "trap", html: "Automation is code, and code has maintenance cost. A brittle script that pages someone when it breaks can create more toil than it removed. Count the upkeep in the payback." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we restart it every morning', 'onboarding takes a ticket per customer', 'the team has no time for projects'. <strong>Say it out loud:</strong> 'I'd measure toil weekly, rank it by minutes times frequency, and keep it under half of team time by automating the top of the list.'" },
              { t: "note", variant: "key", html: "<strong>Toil is manual, repetitive and grows with the service.</strong> Measure it weekly, automate by minutes × frequency, prefer removing causes over scripting steps, and defend the 50% cap." }
            ]
          },
          {
            id: "sre-team-models",
            title: "SRE team models and engagement",
            summary: "Embedded, consulting, platform and kitchen-sink teams, and how services move on and off SRE support.",
            minutes: 8,
            tags: ["team-topology", "engagement", "organisation"],
            blocks: [
              { t: "p", html: "There is no single SRE team shape. The mental model: SRE is a scarce, expensive skill, so the model you pick decides <em>where</em> that skill is applied and whether it multiplies or just absorbs work." },
              { t: "table", headers: ["Model", "How it works", "Strength", "Risk"], rows: [
                ["Embedded", "An SRE sits inside a product team for a fixed term", "Deep context, fast fixes", "Becomes that team's ops person forever"],
                ["Consulting", "SREs review designs and advise, hands off", "Wide reach, cheap per team", "Advice without follow-through"],
                ["Platform / infrastructure", "SREs build shared tooling and infra for everyone", "Leverage across all services", "Distance from real user pain"],
                ["Kitchen-sink", "One SRE team covers everything in production", "Simple to start", "Scope creep, burnout, no depth"],
                ["Product-aligned SRE", "A standing SRE team per product area, sharing on-call", "Ownership plus depth", "Needs headcount and mature SLOs"]
              ] },
              { t: "h", text: "Handoff: taking a service on" },
              { t: "ol", items: [
                "The service passes a production readiness review: SLOs defined, alerts tied to them, runbooks exist.",
                "Operational load is measured and under an agreed threshold (for example, a few pages per week).",
                "SRE shadows the developers' on-call, then reverses roles, before owning the pager outright.",
                "Both sides sign the terms: what SRE owns, what the developers still own, and when it reverts."
              ] },
              { t: "h", text: "Hand-back: giving a service back" },
              { t: "p", html: "If a supported service repeatedly blows its error budget or its operational load exceeds the cap, SRE can hand the pager back to the developers. This is not a punishment; it puts the cost of unreliability with the people who can fix the code. The terms must be written down <em>before</em> they are needed." },
              { t: "table", headers: ["Tier", "Engagement design"], rows: [
                ["Naive", "SRE takes on any service that asks, with no entry criteria"],
                ["Solid", "Readiness review at entry, an operational-load threshold, a documented hand-back trigger"],
                ["Standout", "All of that, plus a menu of engagement levels (consult, embed, full support) so most teams get help without SRE headcount growing linearly"]
              ] },
              { t: "note", variant: "tip", html: "Start with consulting and embedding while SLO practice is young. Full ownership only works once the service has SLOs and alerts worth inheriting." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'one SRE team for forty services', 'should SREs own the pager', 'the SRE team became the ops team'. <strong>Say it out loud:</strong> 'I'd pick the engagement model per service, gate entry with a readiness review, and agree the hand-back trigger up front.'" },
              { t: "note", variant: "key", html: "<strong>The team model decides whether SRE multiplies or just absorbs work.</strong> Gate entry with readiness, cap operational load, and write the hand-back terms before you need them." }
            ]
          },
          {
            id: "production-readiness",
            title: "Production readiness reviews",
            summary: "A practical checklist for launching or onboarding a service, and how to run the review without it becoming a gate nobody passes.",
            minutes: 8,
            tags: ["prr", "launch", "checklist"],
            blocks: [
              { t: "p", html: "A production readiness review (PRR) asks one question: <em>if this service fails at 3 a.m., will we notice, know what to do, and be able to undo it?</em> Everything on the checklist serves one of those three verbs." },
              { t: "table", headers: ["Area", "Ready means", "Red flag"], rows: [
                ["SLOs", "SLIs defined per critical user journey with agreed targets", "'We will add SLOs after launch'"],
                ["Alerts", "Paging alerts on SLO burn; causes go to tickets or dashboards", "Pages on CPU over 80%"],
                ["Runbooks", "Each paging alert links to a runbook with diagnosis and mitigation", "Alerts with no owner or link"],
                ["Capacity", "Load tested beyond expected peak; headroom and scaling limits known", "Sized from a guess"],
                ["Rollback", "Tested, one-command rollback; schema changes backward compatible", "'We roll forward'"],
                ["Dependencies", "Every hard dependency listed with its SLO, timeouts and fallback", "Unknown downstream calls"],
                ["On-call", "A staffed rotation that has shadowed real incidents", "One person who knows the system"],
                ["Data", "Backups exist and a restore has been tested", "Backups never restored"]
              ] },
              { t: "h", text: "Running the review" },
              { t: "ol", items: [
                "Start the PRR early, at design time, so findings change the design rather than delay the launch.",
                "The owning team fills in the checklist; SRE reviews evidence (dashboards, test results), not promises.",
                "Classify findings: launch-blocking, fix within 30 days, or accepted risk with an owner.",
                "Re-run a light version yearly and after major architecture changes."
              ] },
              { t: "code", lang: "yaml", code:
                "# prr/checkout-api.yaml — a PRR record kept in version control\n" +
                "service: checkout-api\n" +
                "owner: team-payments\n" +
                "slos:\n" +
                "  - journey: place-order\n" +
                "    sli: ratio of POST /orders returning non-5xx within 800ms\n" +
                "    target: 99.9%\n" +
                "    window: 28d\n" +
                "rollback: { method: helm-rollback, tested: 2026-09-14 }\n" +
                "dependencies:\n" +
                "  - { name: payments-gateway, slo: 99.95%, timeout_ms: 600, fallback: queue-and-retry }\n" +
                "  - { name: inventory, slo: 99.95%, timeout_ms: 300, fallback: last-known-stock }\n" +
                "findings:\n" +
                "  - { id: PRR-3, severity: blocking, item: restore test missing, owner: team-payments }"
              },
              { t: "compare",
                bad: { title: "PRR as a bureaucratic gate", items: ["Run the week before launch", "Hundred-item checklist, all equal weight", "Pass or fail, no follow-up", "Evidence is 'yes we did it'"] },
                good: { title: "PRR as risk reduction", items: ["Starts at design time", "Short list, weighted by blast radius", "Findings tracked with owners and dates", "Evidence is a link to a test or dashboard"] } },
              { t: "note", variant: "warn", html: "A checklist nobody can pass gets bypassed. Keep the blocking items few — SLOs, paging alerts with runbooks, rollback, on-call — and let the rest be tracked follow-ups." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we launch next week', 'SRE is taking over this service', 'what do you check before go-live'. <strong>Say it out loud:</strong> 'Before launch I want to know we'll notice failure, know what to do and be able to undo it: SLO alerts, runbooks, tested rollback, staffed on-call.'" },
              { t: "note", variant: "key", html: "<strong>Readiness means: notice, act, undo.</strong> SLO-based alerts, linked runbooks, a tested rollback and a staffed rotation are the blocking minimum; start the review at design time." }
            ]
          },
          {
            id: "safe-change",
            title: "Simplicity and safe change",
            summary: "Most outages start with a change. Progressive rollout, feature flags and reversible changes turn that risk into something you can spend.",
            minutes: 10,
            tags: ["release-engineering", "canary", "feature-flags", "rollback"],
            blocks: [
              { t: "p", html: "The mental model: a large share of incidents are triggered by something you did — a binary, a config push, a schema migration, a flag flip. You cannot stop changing, so make every change <strong>small, observable, gradual and reversible</strong>." },
              { t: "stat", items: [
                { v: "majority", k: "of outages follow a change" },
                { v: "1% → 100%", k: "typical progressive rollout" },
                { v: "minutes", k: "target time to roll back" }
              ] },
              { t: "h", text: "Progressive rollout and canaries" },
              { t: "table", headers: ["Stage", "Traffic", "Bake time", "Gate to continue"], rows: [
                ["Canary", "1%", "15–30 min", "Canary vs control: error ratio and p99 within tolerance"],
                ["Early", "10%", "1 h", "SLO burn rate normal; no new error signatures"],
                ["Half", "50%", "1–2 h", "Same, across all zones"],
                ["Full", "100%", "—", "Keep the previous version ready for fast rollback"]
              ] },
              { t: "p", html: "Compare the canary against a <em>control</em> group of the same size running the old version, not against the whole fleet. Equal-sized groups see the same traffic mix, so a difference is the change, not noise." },
              { t: "code", lang: "yaml", code:
                "# illustrative canary analysis gate\n" +
                "analysis:\n" +
                "  interval: 5m\n" +
                "  failureLimit: 1\n" +
                "  metrics:\n" +
                "    - name: error-ratio-vs-control\n" +
                "      query: canary_error_ratio - control_error_ratio\n" +
                "      successCondition: result < 0.002\n" +
                "    - name: p99-latency-vs-control\n" +
                "      query: canary_p99_ms / control_p99_ms\n" +
                "      successCondition: result < 1.2\n" +
                "onFailure: rollback"
              },
              { t: "h", text: "Feature flags and reversible changes" },
              { t: "ul", items: [
                "Separate <strong>deploy</strong> (code reaches servers) from <strong>release</strong> (users see it) with flags; turning a flag off is faster than any rollback.",
                "Make schema changes expand-then-contract: add the new column, dual-write, migrate readers, then drop the old one in a later release.",
                "Prefer changes you can undo in one step; treat irreversible ones (data deletes, key rotations) as their own high-ceremony event.",
                "Remove stale flags; every long-lived flag doubles a code path you have to test."
              ] },
              { t: "h", text: "Change freezes, and why simplicity wins" },
              { t: "p", html: "Freezes around peak events can be sensible, but long blanket freezes just queue risk: the first release afterwards carries weeks of changes at once. Better to keep shipping small changes with strong rollout gates, and freeze only the riskiest classes of change. Simplicity is the same idea in design: fewer moving parts and less clever code mean fewer ways for a change to surprise you." },
              { t: "table", headers: ["Tier", "Release approach"], rows: [
                ["Naive", "Deploy to all servers at once and watch the dashboards"],
                ["Solid", "Canary to a small slice, manual check, then full rollout with a rollback script"],
                ["Standout", "Automated canary analysis against a control, SLO-aware gates, flags to separate deploy from release, and rollback in minutes"]
              ] },
              { t: "note", variant: "tip", html: "Safe change limits the blast radius of your own mistakes; <a href='#/chaos/patterns/graceful-degradation'>graceful degradation</a> limits the blast radius of everyone else's." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'the outage started after a deploy', 'we freeze for a month every December', 'config push took down every region'. <strong>Say it out loud:</strong> 'Most outages follow a change, so I make changes small, roll them out progressively against a control, and keep rollback to minutes.'" },
              { t: "quiz", id: "found-practice" },
              { t: "note", variant: "key", html: "<strong>Small, observable, gradual, reversible.</strong> Canary against a control, gate on SLOs, separate deploy from release with flags, and treat rollback time as a metric." }
            ]
          }
        ]
      }
    ]
  };
})();
