/* =====================================================================
   TECHLEAD · HLD Leadership track  (curriculum + quizzes + widgets)

   Self-contained: registers window.TRACKS.hld, its hld-* quizzes, and the
   six widgets those lessons mount.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     WIDGET HELPERS
     ===================================================================== */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  }
  /* one-of-N segmented control */
  function seg(opts, getCur, onPick) {
    var wrap = h("div", { class: "w-seg" });
    opts.forEach(function (o) {
      var b = h("button", { class: "w-seg-btn" + (o.v === getCur() ? " active" : ""), type: "button" }, o.label);
      b.addEventListener("click", function () {
        onPick(o.v);
        var all = wrap.querySelectorAll("button");
        for (var i = 0; i < all.length; i++) all[i].classList.remove("active");
        b.classList.add("active");
      });
      wrap.appendChild(b);
    });
    return wrap;
  }
  /* independent on/off toggle */
  function toggle(label, getOn, onFlip) {
    var b = h("button", { class: "w-btn" + (getOn() ? " primary" : ""), type: "button" }, label);
    b.addEventListener("click", function () {
      onFlip();
      b.className = "w-btn" + (getOn() ? " primary" : "");
    });
    return b;
  }
  function ro(label, value, accent) {
    return h("span", { class: "ro" }, label + " ", h("b", accent ? { style: "color:var(--accent-ink)" } : {}, String(value)));
  }
  function rowsTable(headers, rows, markIdx) {
    var t = h("table", { class: "w-mini-table", style: "width:100%;border-collapse:collapse;font-size:.72rem" });
    var hr = h("tr", {});
    headers.forEach(function (x) {
      hr.appendChild(h("th", { style: "text-align:left;padding:5px 8px;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);border-bottom:1px solid var(--border)" }, x));
    });
    t.appendChild(hr);
    rows.forEach(function (r, ri) {
      var tr = h("tr", markIdx === ri ? { style: "background:color-mix(in srgb, var(--accent) 12%, transparent)" } : {});
      r.forEach(function (cell, ci) {
        tr.appendChild(h("td", { style: "padding:6px 8px;border-bottom:1px solid var(--border)" + (ci === 0 ? ";font-weight:600" : ";color:var(--text-dim)") }, String(cell)));
      });
      t.appendChild(tr);
    });
    return t;
  }

  var Widgets = {};

  /* ---------------------------------------------------------------
     1. STORY-STRUCTURE SCORER
     Toggle the elements actually present in a project deep dive and
     see which missing one costs the most credit.
     --------------------------------------------------------------- */
  Widgets["tm-story-scorer"] = function (mount) {
    shell(mount, "scorer", "Project deep-dive scorer",
      "Toggle the parts your answer actually contains. The score is not about completeness for its own sake \u2014 each element is worth what it proves about you.");

    var ELEMENTS = [
      { id: "problem", label: "Business problem", weight: 2, proves: "that you know why the work existed", gap: "Without it the story is a task list and nobody can tell whether the work mattered." },
      { id: "constraint", label: "The hard constraint", weight: 3, proves: "that there was a real decision to make", gap: "This is the single most expensive omission: with no constraint, every choice you describe sounds free." },
      { id: "options", label: "Options considered", weight: 2, proves: "that you compared rather than defaulted", gap: "Skipping it reads as picking the first idea, or as hiding an option you cannot defend." },
      { id: "decision", label: "Your own decision", weight: 3, proves: "your personal ownership, not the team's", gap: "\u201cWe decided\u201d is the most common way a strong project produces a weak answer." },
      { id: "outcome", label: "Measured outcome", weight: 2, proves: "that you checked whether it worked", gap: "An unmeasured result is an opinion, and the panel will treat it as one." },
      { id: "aftermath", label: "What changed afterwards", weight: 2, proves: "that the learning outlived the project", gap: "A runbook, a test, an alert, a decision record \u2014 without one, nothing was institutionalised." }
    ];
    var on = { problem: true, constraint: false, decision: false, options: false, outcome: false, aftermath: false };

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var total = 0, max = 0, missing = null;
      ELEMENTS.forEach(function (e) {
        max += e.weight;
        if (on[e.id]) total += e.weight;
        else if (!missing || e.weight > missing.weight) missing = e;
      });
      var pct = Math.round((total / max) * 100);
      var band = pct >= 90 ? "senior signal" : pct >= 65 ? "solid baseline" : pct >= 40 ? "partial \u2014 reads as a status update" : "tool list";

      stage.innerHTML = "";
      stage.appendChild(rowsTable(
        ["Element", "In your answer", "What it proves"],
        ELEMENTS.map(function (e) { return [e.label, on[e.id] ? "yes" : "\u2014", e.proves]; })
      ));
      stage.appendChild(h("p", { style: "margin-top:10px;font-size:.76rem;color:var(--text-dim)" },
        missing
          ? h("span", {}, h("b", { style: "color:var(--accent-ink)" }, "Biggest gap: " + missing.label + ". "), missing.gap)
          : h("span", {}, h("b", { style: "color:var(--accent-ink)" }, "Nothing missing. "), "Now cut it to three minutes \u2014 length is the next thing that costs you.")));

      readout.innerHTML = "";
      readout.appendChild(ro("weighted score", total + " / " + max, true));
      readout.appendChild(ro("reads as", band));
      readout.appendChild(ro("elements present", Object.keys(on).filter(function (k) { return on[k]; }).length + " / 6"));
    }

    var controls = h("div", { class: "widget-controls" });
    ELEMENTS.forEach(function (e) {
      controls.appendChild(toggle(e.label, function () { return on[e.id]; }, function () { on[e.id] = !on[e.id]; paint(); }));
    });
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     2. STAKEHOLDER TRADE-OFF EXPLORER
     --------------------------------------------------------------- */
  Widgets["tm-stakeholder-map"] = function (mount) {
    shell(mount, "explorer", "Stakeholder trade-off explorer",
      "Pick a decision and read the room. Nobody here is being unreasonable \u2014 each group is protecting a different cost, and the artifact column is what you actually owe them.");

    var DECISIONS = [
      {
        v: "early", label: "Launch two weeks early",
        rows: [
          ["Product", 2, "Revenue starts sooner and the roadmap slips less", "A scoped release plan naming what is deferred"],
          ["Security", -2, "Two controls move to post-launch, unreviewed", "A written risk acceptance with an owner and a date"],
          ["Finance", 1, "Earlier revenue, unchanged run cost", "The cost model for the reduced scope"],
          ["Support", -1, "Fewer self-service paths on day one", "A runbook and an escalation path for the gaps"],
          ["Customers", 0, "Value sooner, rough edges sooner", "Honest release notes about known limits"]
        ]
      },
      {
        v: "encrypt", label: "Add tenant-level encryption",
        rows: [
          ["Product", -2, "Six weeks that buy no visible feature", "The deals or renewals this unblocks, named"],
          ["Security", 2, "Blast radius of a key compromise drops to one tenant", "A threat model and a key-rotation design"],
          ["Finance", -1, "Higher compute and key-management spend", "Cost per tenant, and which segment absorbs it"],
          ["Support", -1, "A new class of ticket nobody has debugged yet", "A decryption-failure runbook before launch"],
          ["Customers", 1, "A control enterprise buyers ask about directly", "A statement of what is and is not encrypted"]
        ]
      },
      {
        v: "inhouse", label: "Replace the vendor with in-house",
        rows: [
          ["Product", -1, "A quarter of capacity spent reaching parity", "The capability the vendor structurally cannot give you"],
          ["Security", 1, "Data stops leaving your boundary", "A review of what the vendor path exposed"],
          ["Finance", 1, "Licence spend ends; engineering spend starts", "Total cost of ownership over three years, not year one"],
          ["Support", -2, "Escalation stops being someone else's pager", "An on-call rota and a documented degraded mode"],
          ["Customers", 0, "Nothing visible, unless it breaks", "A migration window with no data loss"]
        ]
      }
    ];
    var cur = "early";

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var d = DECISIONS.filter(function (x) { return x.v === cur; })[0];
      var net = 0, worst = null, worstIdx = -1;
      d.rows.forEach(function (r, i) {
        net += r[1];
        if (worst === null || r[1] < worst[1]) { worst = r; worstIdx = i; }
      });
      var stance = function (n) { return n === 2 ? "strongly for" : n === 1 ? "for" : n === 0 ? "neutral" : n === -1 ? "against" : "strongly against"; };

      stage.innerHTML = "";
      stage.appendChild(rowsTable(
        ["Stakeholder", "Position", "Why", "What you owe them"],
        d.rows.map(function (r) { return [r[0], stance(r[1]), r[2], r[3]]; }),
        worstIdx
      ));
      stage.appendChild(h("p", { style: "margin-top:10px;font-size:.76rem;color:var(--text-dim)" },
        h("b", { style: "color:var(--accent-ink)" }, "Do not average this. "),
        "A net-positive score with one strongly-against stakeholder is not consensus \u2014 it is an unresolved objection that will resurface at the worst moment. Name " + worst[0] + "'s cost out loud and say who accepts it."));

      readout.innerHTML = "";
      readout.appendChild(ro("net position", (net > 0 ? "+" : "") + net, true));
      readout.appendChild(ro("hardest objection", worst[0]));
      readout.appendChild(ro("artifacts owed", d.rows.length));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      seg(DECISIONS.map(function (d) { return { v: d.v, label: d.label }; }), function () { return cur; }, function (v) { cur = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     3. ADR BUILDER
     --------------------------------------------------------------- */
  Widgets["tm-adr-builder"] = function (mount) {
    shell(mount, "builder", "Decision-record builder",
      "Switch sections on and watch what the record becomes. The last two are the ones people skip, and they are the two that decide whether the argument stays closed.");

    var SECTIONS = [
      { id: "context", label: "Context", weight: 2, line: "Why this decision, now: the constraint and the deadline that forced it.", gap: "With no context, a future reader cannot tell whether the constraint still holds \u2014 so they either obey a stale decision or ignore a live one." },
      { id: "decision", label: "Decision", weight: 2, line: "What we are doing, stated in one sentence a newcomer could repeat.", gap: "A record without a decision is meeting notes." },
      { id: "rejected", label: "Options rejected", weight: 2, line: "What else was on the table, and the specific reason each lost.", gap: "Omitting it guarantees the same option is proposed again next quarter, by someone who assumes you never considered it." },
      { id: "consequences", label: "Consequences", weight: 2, line: "What this costs: money, risk, migration work, and who absorbs it.", gap: "Presenting a decision as free is the fastest way to lose credibility when the cost arrives." },
      { id: "owner", label: "Owner", weight: 1, line: "The named person accountable for the outcome, not the author.", gap: "Unowned decisions decay into folklore." },
      { id: "trigger", label: "Revisit trigger", weight: 2, line: "The measurable condition that would reopen this: a threshold, a date, a dependency change.", gap: "Without a trigger the record is either permanent or reopened on vibes, and both are worse than a stated expiry." }
    ];
    var on = { context: true, decision: true, rejected: false, consequences: false, owner: false, trigger: false };

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var score = 0, max = 0, missing = [];
      SECTIONS.forEach(function (s) {
        max += s.weight;
        if (on[s.id]) score += s.weight;
        else missing.push(s);
      });
      var verdict = score === max ? "durable decision record"
        : score >= 8 ? "usable, with a known gap"
        : score >= 5 ? "a memo, not a decision"
        : "meeting notes";

      stage.innerHTML = "";
      var doc = h("div", { style: "font-family:var(--font-mono);font-size:.7rem;line-height:1.7" });
      SECTIONS.forEach(function (s) {
        var present = on[s.id];
        doc.appendChild(h("div", { style: "padding:4px 0;border-bottom:1px solid var(--border);color:" + (present ? "var(--text)" : "var(--text-faint)") },
          h("b", { style: "color:" + (present ? "var(--accent-ink)" : "var(--text-faint)") }, "## " + s.label + (present ? "" : "  (missing)")),
          h("div", { style: "padding-left:14px" }, present ? s.line : s.gap)));
      });
      stage.appendChild(doc);

      readout.innerHTML = "";
      readout.appendChild(ro("completeness", score + " / " + max, true));
      readout.appendChild(ro("verdict", verdict));
      readout.appendChild(ro("sections missing", missing.length));
    }

    var controls = h("div", { class: "widget-controls" });
    SECTIONS.forEach(function (s) {
      controls.appendChild(toggle(s.label, function () { return on[s.id]; }, function () { on[s.id] = !on[s.id]; paint(); }));
    });
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     4. BLAST-RADIUS ESTIMATOR
     --------------------------------------------------------------- */
  Widgets["tm-blast-radius"] = function (mount) {
    shell(mount, "estimator", "Cutover blast-radius estimator",
      "A rollout plan is a device for shrinking two numbers: how many people meet the bug, and how long they stay there. Change the shape and watch both move.");

    var TENANTS = 400, USERS = 240000;
    var SHAPES = [
      { v: "bigbang", label: "Big-bang cutover", exposure: 1, detect: 40 },
      { v: "canary1", label: "Canary 1%", exposure: 0.01, detect: 25 },
      { v: "ramp", label: "1% \u2192 10% \u2192 50%", exposure: 0.1, detect: 15 },
      { v: "parallel", label: "Parallel run, no cutover", exposure: 0, detect: 5 }
    ];
    var COHORTS = [
      { v: "all", label: "All tenants", share: 1 },
      { v: "region", label: "One region", share: 0.22 },
      { v: "pilot", label: "One pilot tenant", share: 1 / TENANTS }
    ];
    var UNDO = [
      { v: "flag", label: "Feature flag off", minutes: 2, repair: false },
      { v: "redeploy", label: "Redeploy previous build", minutes: 25, repair: false },
      { v: "repair", label: "Data repair required", minutes: 240, repair: true }
    ];
    var shape = "bigbang", cohort = "all", undo = "redeploy";

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var s = SHAPES.filter(function (x) { return x.v === shape; })[0];
      var c = COHORTS.filter(function (x) { return x.v === cohort; })[0];
      var u = UNDO.filter(function (x) { return x.v === undo; })[0];

      var exposedUsers = Math.max(0, Math.round(USERS * c.share * s.exposure));
      var exposedTenants = Math.max(0, Math.round(TENANTS * c.share * s.exposure));
      if (s.exposure > 0 && c.share > 0 && exposedTenants === 0) exposedTenants = 1;
      var minutes = s.detect + u.minutes;
      var userMinutes = exposedUsers * minutes;

      var band = exposedUsers === 0 ? "no user exposure"
        : userMinutes > 4000000 ? "unacceptable \u2014 do not ship this shape"
        : userMinutes > 400000 ? "high \u2014 needs an executive risk acceptance"
        : userMinutes > 20000 ? "moderate \u2014 acceptable with comms ready"
        : "low";

      stage.innerHTML = "";
      stage.appendChild(rowsTable(
        ["Factor", "Chosen", "Effect"],
        [
          ["Rollout shape", s.label, s.exposure === 0 ? "nobody is served the new path at all" : "first failure reaches " + Math.round(s.exposure * 100) + "% of the cohort"],
          ["Cohort", c.label, exposedTenants + " tenant(s) in the blast radius"],
          ["Undo path", u.label, u.minutes + " min to reverse" + (u.repair ? ", plus a correctness backfill nobody has rehearsed" : "")],
          ["Detection", s.detect + " min", "smaller slices are noticed faster because the signal is cleaner"]
        ]
      ));
      stage.appendChild(h("p", { style: "margin-top:10px;font-size:.76rem;color:var(--text-dim)" },
        h("b", { style: "color:var(--accent-ink)" }, "Read the product, not the parts. "),
        u.repair
          ? "A data-repair undo path is the one that turns a bad hour into a bad quarter, because the customer-visible damage outlives the rollback. Buy reversibility before you buy speed."
          : "Exposed users multiplied by minutes exposed is the number worth arguing about. Halving either one is a real mitigation; asserting the change is low-risk is not."));

      readout.innerHTML = "";
      readout.appendChild(ro("users exposed", exposedUsers.toLocaleString(), true));
      readout.appendChild(ro("minutes to mitigate", minutes));
      readout.appendChild(ro("user-minutes of harm", userMinutes.toLocaleString()));
      readout.appendChild(ro("risk band", band));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      seg(SHAPES.map(function (x) { return { v: x.v, label: x.label }; }), function () { return shape; }, function (v) { shape = v; paint(); }),
      seg(COHORTS.map(function (x) { return { v: x.v, label: x.label }; }), function () { return cohort; }, function (v) { cohort = v; paint(); }),
      seg(UNDO.map(function (x) { return { v: x.v, label: x.label }; }), function () { return undo; }, function (v) { undo = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     5. INCIDENT SEVERITY TRIAGE DRILL
     --------------------------------------------------------------- */
  Widgets["tm-severity-triage"] = function (mount) {
    shell(mount, "drill", "Severity triage drill",
      "Severity is a decision about who gets woken and how often you speak \u2014 not a description of how bad the graph looks. Set the four inputs and read the call.");

    var IMPACT = [
      { v: "none", label: "No user impact", score: 0 },
      { v: "degraded", label: "Journey degraded", score: 2 },
      { v: "blocked", label: "Core journey blocked", score: 4 }
    ];
    var SCOPE = [
      { v: "one", label: "One tenant", score: 1 },
      { v: "region", label: "One region", score: 2 },
      { v: "all", label: "Everyone", score: 3 }
    ];
    var DATA = [
      { v: "clean", label: "Data correct", score: 0 },
      { v: "suspect", label: "Data suspect", score: 2 },
      { v: "corrupt", label: "Data corrupted", score: 4 }
    ];
    var WORK = [
      { v: "yes", label: "Workaround exists", score: 0 },
      { v: "no", label: "No workaround", score: 2 }
    ];
    var impact = "degraded", scope = "region", data = "clean", work = "yes";

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function pick(list, v) { return list.filter(function (x) { return x.v === v; })[0]; }

    function paint() {
      var i = pick(IMPACT, impact), s = pick(SCOPE, scope), d = pick(DATA, data), w = pick(WORK, work);
      var score = i.score + s.score + d.score + w.score;

      /* Money and correctness escalate regardless of the arithmetic: a
         corrupted ledger for one tenant is not a minor incident. */
      var sev;
      if (d.v === "corrupt") sev = score >= 8 ? "S1" : "S2";
      else if (score >= 10) sev = "S1";
      else if (score >= 7) sev = "S2";
      else if (score >= 4) sev = "S3";
      else sev = "S4";

      var PLAY = {
        S1: ["page the on-call and the incident commander now", "every 30 min, whether or not anything changed", "yes \u2014 leadership and affected customers", "mitigate first; root cause after the bleeding stops"],
        S2: ["page the on-call", "hourly", "internal stakeholders; customers if it persists past the hour", "mitigate, then diagnose while the workaround holds"],
        S3: ["assign in hours", "at the next working checkpoint", "no", "diagnose properly \u2014 you have the time, use it"],
        S4: ["queue it", "on close", "no", "fix the class of problem, not the instance"]
      }[sev];

      stage.innerHTML = "";
      stage.appendChild(rowsTable(
        ["Input", "Chosen", "Why it moves severity"],
        [
          ["User impact", i.label, "the only input the customer experiences directly"],
          ["Scope", s.label, "decides comms breadth, not urgency on its own"],
          ["Data correctness", d.label, d.v === "corrupt" ? "overrides the arithmetic \u2014 wrong data outlives the outage" : "suspect data widens the recovery, not just the fix"],
          ["Workaround", w.label, w.v === "no" ? "removes the option to wait for a proper fix" : "buys you diagnosis time you should actually use"]
        ]
      ));
      stage.appendChild(h("div", { style: "margin-top:10px" }, rowsTable(
        ["Call", "Action"],
        [
          ["Who", PLAY[0]],
          ["Update cadence", PLAY[1]],
          ["External comms", PLAY[2]],
          ["First move", PLAY[3]]
        ]
      )));

      readout.innerHTML = "";
      readout.appendChild(ro("severity", sev, true));
      readout.appendChild(ro("triage score", score + " / 13"));
      readout.appendChild(ro("override", d.v === "corrupt" ? "data corruption floor applied" : "none"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      seg(IMPACT.map(function (x) { return { v: x.v, label: x.label }; }), function () { return impact; }, function (v) { impact = v; paint(); }),
      seg(SCOPE.map(function (x) { return { v: x.v, label: x.label }; }), function () { return scope; }, function (v) { scope = v; paint(); }),
      seg(DATA.map(function (x) { return { v: x.v, label: x.label }; }), function () { return data; }, function (v) { data = v; paint(); }),
      seg(WORK.map(function (x) { return { v: x.v, label: x.label }; }), function () { return work; }, function (v) { work = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     6. MULTI-REGION PICKER
     Choose a topology against a downtime cost and a recovery target,
     and see whether it meets the target and whether it pays for
     itself on expected loss.
     --------------------------------------------------------------- */
  Widgets["tm-region-picker"] = function (mount) {
    shell(mount, "trade-off", "Multi-region picker",
      "Pick a topology, what an hour of downtime costs, the recovery target you have promised, and whether failover is rehearsed. Illustrative numbers: 600k a year of base infrastructure, and a region-level event roughly once every three years lasting eight hours.");

    var BASE = 600000, EVENTS = 0.3, OUTAGE = 8;
    var TOPO = [
      { v: "single", label: "Single region", rto: 8, rpo: "last backup, ~4 h", mult: 1.0, burden: "restore runbook only; a region loss is a long outage" },
      { v: "warm", label: "Warm standby", rto: 1, rpo: "~5 min, async", mult: 1.35, burden: "scaled-down copy that must be scaled up during failover" },
      { v: "hot", label: "Hot standby", rto: 0.25, rpo: "~30 s, async", mult: 1.9, burden: "full idle capacity; replication lag decides the data loss" },
      { v: "active", label: "Active-active", rto: 0.03, rpo: "~0 local; conflicts on global writes", mult: 2.5, burden: "conflict resolution, routing and residency in every feature" }
    ];
    var COST = [{ v: 5000, label: "5k / hour" }, { v: 40000, label: "40k / hour" }, { v: 250000, label: "250k / hour" }];
    var NEED = [{ v: 8, label: "Same day" }, { v: 1, label: "1 hour" }, { v: 0.25, label: "15 minutes" }];
    var DRILL = [{ v: "never", label: "Never rehearsed" }, { v: "quarterly", label: "Rehearsed quarterly" }];
    var topo = "active", cost = 40000, need = 1, drill = "never";

    function money(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : Math.round(n / 1000) + "k"; }
    function hours(x) { return x < 1 ? Math.max(1, Math.round(x * 60)) + " min" : x + " h"; }
    function effRto(t) {
      if (t.v === "single" || t.v === "active") return t.rto;
      return drill === "never" ? Math.min(OUTAGE, t.rto * 4) : t.rto;
    }
    function evalT(t) {
      var r = effRto(t);
      var loss = EVENTS * r * cost;
      var avoided = EVENTS * OUTAGE * cost - loss;
      var extra = (t.mult - 1) * BASE;
      return { t: t, r: r, loss: loss, avoided: avoided, extra: extra, meets: r <= need };
    }
    function labelRow(text) {
      return h("span", { style: "font-family:var(--font-mono);font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);min-width:140px" }, text);
    }

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var all = TOPO.map(evalT);
      var idx = TOPO.map(function (t) { return t.v; }).indexOf(topo);
      var cur = all[idx];
      var cheaper = all.filter(function (e, i) { return i < idx && e.meets; })[0];

      var verdict, why;
      if (!cur.meets) {
        verdict = "misses the target";
        why = (drill === "never" && cur.t.rto <= need)
          ? "On paper it meets the target. An unrehearsed failover takes several times longer than the design says \u2014 rehearsal is the gap, not the topology."
          : "Even working as designed, this topology cannot recover inside the promised window. Either buy more, or renegotiate the promise.";
      } else if (cur.extra === 0) {
        verdict = "meets it, no extra spend";
        why = "The target allows a restore from backup. Spending on standby capacity here would buy nothing the commitment asks for.";
      } else if (cur.extra > cur.avoided) {
        verdict = "meets it, does not pay back";
        why = "Costs " + money(cur.extra - cur.avoided) + " a year more than the expected loss it avoids. That can still be right \u2014 a contract penalty, a regulator or a reputational cliff \u2014 but say that is the reason, rather than expected value.";
      } else {
        verdict = "meets it and pays back";
        why = "Avoids " + money(cur.avoided) + " a year of expected loss for " + money(cur.extra) + " of extra spend. At this downtime cost the investment justifies itself on expected value alone.";
      }
      if (cur.meets && cheaper) why += " " + cheaper.t.label + " also meets this target for " + money(cur.extra - cheaper.extra) + " a year less.";

      stage.innerHTML = "";
      stage.appendChild(rowsTable(
        ["Topology", "Recovery (as run)", "Data loss", "Extra / yr", "Expected loss / yr", "Meets target"],
        all.map(function (e) { return [e.t.label, hours(e.r), e.t.rpo, e.extra ? money(e.extra) : "\u2014", money(e.loss), e.meets ? "yes" : "no"]; }),
        idx
      ));
      stage.appendChild(h("p", { style: "margin-top:10px;font-size:.76rem;color:var(--text-dim)" },
        h("strong", {}, cur.t.label + ": "), why + " Operating burden: " + cur.t.burden + "."));

      readout.innerHTML = "";
      readout.appendChild(ro("verdict", verdict, true));
      readout.appendChild(ro("recovery", hours(cur.r) + " vs " + hours(need) + " promised"));
      readout.appendChild(ro("extra spend", cur.extra ? money(cur.extra) + " / yr" : "none"));
      readout.appendChild(ro("loss avoided", money(cur.avoided) + " / yr"));
    }

    var controls = h("div", { style: "display:flex;flex-direction:column;gap:8px;margin-bottom:18px" });
    [
      ["Topology", TOPO, function () { return topo; }, function (v) { topo = v; }],
      ["Downtime cost", COST, function () { return cost; }, function (v) { cost = v; }],
      ["Recovery target", NEED, function () { return need; }, function (v) { need = v; }],
      ["Failover", DRILL, function () { return drill; }, function (v) { drill = v; }]
    ].forEach(function (c) {
      controls.appendChild(h("div", { style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center" },
        labelRow(c[0]),
        seg(c[1].map(function (x) { return { v: x.v, label: x.label }; }), c[2], function (v) { c[3](v); paint(); })));
    });
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "hld-framing": {
      title: "Framing checkpoint",
      sub: "Reading the round, converting goals into drivers, mapping stakeholders, and making uncertainty explicit.",
      questions: [
        {
          q: "A stakeholder says the new reporting service must be \u201centerprise ready\u201d. What makes that statement usable as an architecture driver?",
          options: [
            "Selecting a vendor whose product has an enterprise tier",
            "Restating it as testable constraints \u2014 tenant isolation, audit retention, a recovery-time target",
            "Adding more reviewers to the design document",
            "Deferring it until after the first launch"
          ],
          answer: 1,
          explain: "An adjective cannot be designed against or verified, so it lets everyone in the room agree while picturing a different system. Naming who is isolated from whom, how long audit records are kept, and how fast recovery must be gives you something to build and something to test. That translation is the first thing this round is checking you can do."
        },
        {
          q: "You are asked to walk through your most complex project in three minutes. Which opening earns the most credit?",
          options: [
            "The technology stack, in the order you adopted it",
            "The team size and how long the project ran",
            "A chronological account starting from the kickoff",
            "The business problem, the constraint that made it hard, and what you decided"
          ],
          answer: 3,
          explain: "Judgment only becomes visible where there was a constraint and a decision, so that is what you spend your opening on. Stack lists, headcount and chronology are all things an observer could recite without having made a single call. Lead with problem, constraint and decision and you reach the signal before the three minutes are gone."
        },
        {
          q: "Which of these is a decision trigger rather than a risk?",
          options: [
            "If reconciliation mismatch exceeds 0.1% of rows, we pause the cutover",
            "The vendor API may not sustain our peak throughput",
            "Finance is uncomfortable with the timeline",
            "The migration touches unfamiliar legacy code"
          ],
          answer: 0,
          explain: "A risk names something that could go wrong; a trigger names the measurable threshold at which you change plan, agreed before the pressure arrives. The other three are concerns, and concerns without thresholds get re-argued weekly by whoever is most anxious that day. Attaching a number is what converts worry into governance."
        },
        {
          q: "A one-way-door decision differs from a reversible one mainly in that it\u2026",
          options: [
            "Should be delegated to the most senior engineer available",
            "Needs less evidence, because irreversibility means moving fast",
            "Warrants more evidence and earlier escalation, because undoing it has material cost",
            "Does not need to be written down once made"
          ],
          answer: 2,
          explain: "Reversibility is what should set your governance level. Where a mistake can be undone cheaply, deciding fast and learning is correct and over-analysis is waste. Where it cannot \u2014 a data migration, a public contract, a vendor commitment \u2014 the cost of being wrong justifies slower evidence and pulling the decision up earlier."
        },
        {
          q: "Product wants a faster launch; security wants two more controls. What is the strongest framing?",
          options: [
            "Escalate immediately and let a director choose",
            "Ship on the product timeline and add the controls in the next release",
            "Implement one of the two controls as a compromise",
            "State the criteria, present both options with residual risk, recommend one, and name who accepts that risk"
          ],
          answer: 3,
          explain: "Both parties are being rational about costs they own, so picking a winner just relocates the conflict. Criteria, options, a recommendation and a named risk-acceptor turn a standoff into a decision that someone is accountable for. Splitting the difference is the worst of the four, because it produces a control set nobody designed."
        },
        {
          q: "Your design depends on a vendor API whose real throughput ceiling you do not know. What belongs in the design document?",
          options: [
            "An assumption with its source, a risk with an owner, and the load test that would resolve it",
            "A note that the vendor is reputable and their documentation looks sound",
            "A higher instance count to absorb whatever the ceiling turns out to be",
            "Nothing \u2014 unknowns are resolved during implementation"
          ],
          answer: 0,
          explain: "The point of writing it down is to make the uncertainty someone's job rather than a shared hope. An assumption records what you are relying on and where the belief came from; the paired risk gives it an owner; the test names what would close it. Over-provisioning hides the question without answering it, and \u201cwe will find out later\u201d means finding out during the launch."
        }
      ]
    },

    "hld-execution": {
      title: "Trade-offs checkpoint",
      sub: "Cost as a design constraint, altitude in executive communication, architecture reviews that decide, and decisions that stay decided.",
      questions: [
        {
          q: "Which cost figure is most useful for deciding what to change in an architecture?",
          options: [
            "Spend attributed to a user-visible journey",
            "Total monthly platform spend",
            "Year-on-year percentage growth in spend",
            "Spend as a proportion of revenue"
          ],
          answer: 0,
          explain: "The total tells you the size of the problem but not where to push, so it produces blanket cuts that land on whoever argues least. Attributing spend to a journey \u2014 a search, an export, a payout run \u2014 points at a specific design decision you can change. The other two are useful for reporting upward and useless for choosing an action."
        },
        {
          q: "An executive asks why a migration needs two more weeks. Which answer is pitched at the right altitude?",
          options: [
            "The dual-write path needs a reconciliation job and the schema change is not backwards compatible",
            "The team is at capacity and the estimate was optimistic",
            "We follow a phased migration pattern for changes of this size",
            "Two weeks of parallel running is what lets us cut over without risking the quarter-close numbers, and here is the alternative if you want the original date"
          ],
          answer: 3,
          explain: "Altitude means leading with the consequence the listener owns, then offering the choice. The mechanism answer is true but asks a non-technical reader to derive the risk themselves. Capacity framing sounds like an excuse, and citing a pattern answers a question nobody asked."
        },
        {
          q: "What most reliably stops an architecture argument from being re-litigated every quarter?",
          options: [
            "A more detailed design diagram",
            "A record of the options rejected and the reason each lost",
            "Agreement from the most senior engineer in the room",
            "A longer design review with more attendees"
          ],
          answer: 1,
          explain: "Arguments return because the reasoning was never durable, so the next person assumes the alternative was simply never considered. Writing down what lost and why makes re-proposing it cheap to answer instead of a fresh debate. Diagrams describe the outcome, and seniority settles a room for exactly as long as that person stays."
        },
        {
          q: "Which of these decisions least justifies a written decision record?",
          options: [
            "Choosing events over synchronous calls between two teams' services",
            "Selecting the primary datastore for a new tenant-facing service",
            "Naming convention for internal helper functions in one module",
            "Committing to a vendor for identity, with a three-year contract"
          ],
          answer: 2,
          explain: "Records are worth their cost when a decision shapes teams, data, money, or reversibility \u2014 the other three do all of that. A local naming convention is cheap to change, affects nobody outside the module, and needs a linter rather than a record. Writing records for everything is how teams learn to ignore them."
        },
        {
          q: "A proposal stores every event indefinitely \u201cbecause storage is cheap\u201d. What is the strongest objection?",
          options: [
            "Object storage costs more than the proposal assumes",
            "Nobody will query events older than a year",
            "The events should be aggregated before storage",
            "Retained data carries query cost, compliance obligations and breach exposure that grow with the retention window"
          ],
          answer: 3,
          explain: "Storage price is usually the smallest of the costs and the easiest to defend, which is why the argument gets framed that way. The real bill is scan cost on wide tables, a retention obligation you now have to honour under regulation, and a larger set of records exposed if you are breached. The other objections may be true but are guesses about usage rather than structural costs."
        },
        {
          q: "Teams have started bringing designs to the architecture review only after the code is written. What is the most effective fix?",
          options: [
            "Make review mandatory before any merge to the main branch",
            "Add more senior reviewers so the feedback is harder to ignore",
            "Review early drafts against a short written pre-read, tier reviews by reversibility, and end every review with a recorded decision and owner",
            "Publish a list of approved architecture patterns so review becomes unnecessary"
          ],
          answer: 2,
          explain: "Teams arrive late when review is expensive and rarely decides anything, so the rational move is to show up with a finished design that is hard to reject. Reviewing drafts makes feedback cheap to act on, tiering keeps the board off reversible trivia, and a recorded outcome makes the meeting worth attending. A merge gate just moves the same late arrival one step earlier, and more seniority raises the cost of attending without changing the incentive."
        }
      ]
    },

    "hld-operations": {
      title: "Operations checkpoint",
      sub: "Ownership and alerting, phased rollout, re-platforming, multi-region trade-offs, and leading an incident before you understand it.",
      questions: [
        {
          q: "Which alert is most likely to be worth waking someone for?",
          options: [
            "Checkout success rate below its floor for two consecutive minutes",
            "CPU on the service fleet above 80% for five minutes",
            "A single upstream request returning a 500",
            "Queue depth above its usual daytime level"
          ],
          answer: 0,
          explain: "An alert should fire on something a user is experiencing, because that is the only thing that justifies the interruption. CPU and queue depth are symptoms that are often perfectly healthy under load, and a single error is noise. Alerting on internals is how teams end up with a pager nobody trusts and a real outage that arrives unannounced."
        },
        {
          q: "Old and new systems disagree on 0.3% of rows during a parallel run, and the difference is in monetary amounts. Quarter close is in a week. What is the right call?",
          options: [
            "Cut over \u2014 0.3% is within normal tolerance for a migration",
            "Cut over for read traffic only and leave writes on the old path",
            "Hold the cutover, since an unexplained money variance before close is exactly what a freeze window exists for",
            "Cut over and reconcile the difference afterwards with a backfill"
          ],
          answer: 2,
          explain: "The percentage is not the deciding factor \u2014 the fact that the variance is unexplained and lands on money is. An unexplained difference means you do not yet know whether it is 0.3% or the visible edge of something larger, and quarter close is when a wrong number becomes a restatement. Cutting over with a promise to reconcile later trades a schedule win for a correctness problem in the worst possible week."
        },
        {
          q: "A deploy causes elevated latency with no hard errors. What should you do first?",
          options: [
            "Roll back, then investigate what the deploy changed",
            "Read through the diff to find the likely cause before touching production",
            "Add capacity to absorb the latency while you investigate",
            "Wait for the next data point to confirm the trend is real"
          ],
          answer: 0,
          explain: "You have a known recent change correlated with user-visible harm, so the cheapest path back to a good state is to undo it. Understanding comes afterwards, from the same diff, with nobody suffering while you read. Adding capacity treats a symptom and can mask the signal, and waiting for confirmation is how a five-minute event becomes a thirty-minute one."
        },
        {
          q: "Your service depends on three downstream APIs. What belongs in the high-level design?",
          options: [
            "Retry counts and timeout values for each dependency",
            "A named owner for each dependency at the vendor or team",
            "The behaviour the user sees when each dependency is unavailable",
            "A dashboard showing the latency of all three"
          ],
          answer: 2,
          explain: "The design-level question is what happens to the customer when a dependency is gone, because that is the decision only you can make and the one that has product consequences. Timeouts, owners and dashboards all matter, but they are implementation and operations detail that follow from the degraded-mode choice. Undesigned, every dependency failure becomes a full outage by default."
        },
        {
          q: "A postmortem produces the finding \u201cwe should have caught this in review\u201d. What turns that into prevention?",
          options: [
            "Circulating the postmortem more widely so the lesson spreads",
            "Adding a review checklist item, an automated check that fails the build, an owner and a date",
            "Assigning the review to a more senior engineer next time",
            "Recording the finding in the incident tracker for future reference"
          ],
          answer: 1,
          explain: "A finding prevents nothing until it exists in a form that outlives the memory of the incident, which means a check something else runs plus a person and a date. Wider circulation and a tracker entry are records, not controls. Relying on a more senior reviewer replaces a systemic gap with a personal dependency, which fails the moment that person is busy."
        },
        {
          q: "A junior engineer's change caused a production issue. What is the strongest sequence?",
          options: [
            "Coach privately, then mitigate once you understand what happened",
            "Mitigate, then coach privately, then fix the system gap that let the change reach production",
            "Mitigate, then discuss it openly in the team retro so everyone learns",
            "Mitigate, then remove that engineer's deploy access until they have been trained"
          ],
          answer: 1,
          explain: "User harm comes first, always \u2014 no coaching conversation is more urgent than stopping the bleeding. Then the private conversation, because a public one buys you nothing the private one does not and costs the person's willingness to raise the next problem early. The third step is the one leaders skip: a change that could reach production and break it is a gap in your gates, not only in someone's judgment."
        },
        {
          q: "Leadership asks for active-active across two regions \u201cfor reliability\u201d. Most of last year's downtime came from bad deploys and config changes. What is the strongest response?",
          options: [
            "Agree \u2014 active-active is the highest-availability topology available",
            "Show that active-active would not have prevented most of last year's downtime, derive the recovery target from the cost of an hour down, and propose the cheapest topology that meets it alongside deploy safety work",
            "Decline \u2014 multi-region is too complex for the team to operate",
            "Propose a warm standby as a compromise between cost and availability"
          ],
          answer: 1,
          explain: "A second region protects against region loss, and a bad deploy rolled out to both regions takes both down. Starting from the actual causes of downtime and an explicit recovery target turns the request into a decision you can cost. Agreeing buys the most expensive option for the wrong failure mode, a flat refusal ignores a real requirement, and picking warm standby as a compromise is still choosing a topology before knowing the target."
        },
        {
          q: "A team wants to rewrite a legacy billing platform from scratch and switch over in one release. Which risk is most often underestimated?",
          options: [
            "Reaching parity with years of undocumented behaviour that customers and other systems depend on",
            "Choosing the right programming language for the new platform",
            "Hiring enough engineers who know the new technology",
            "The licence cost of the new platform's dependencies"
          ],
          answer: 0,
          explain: "Legacy systems encode years of edge cases, workarounds and implicit contracts that nobody wrote down, and a rewrite has to rediscover each one \u2014 usually in production. That is why parity is the item that slips, and why incremental replacement behind a facade, with characterisation of current behaviour and a decision about which features to retire rather than port, beats a single cutover. The other three are real but visible and plannable."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.hld = {
    id: "hld",
    name: "HLD Leadership",
    short: "HLD",
    tagline: "Architecture you can defend to the business",
    color: "#d97706",
    blurb: "The high-level design round as a technical leader sits it: converting business goals into architecture drivers, reading a room full of stakeholders with different costs, treating spend and reversibility as design constraints, writing decisions that stay decided, and owning the rollout and the incident that follows.",
    modules: [
      {
        id: "framing",
        name: "Framing and Decisions",
        icon: "compass",
        lessons: [
          {
            id: "round-decoder",
            title: "What the round really tests",
            summary: "Not a culture chat and not a pure design exercise \u2014 a test of whether technical judgment survives ambiguity, people, and consequences.",
            minutes: 9,
            tags: ["framing", "signals"],
            blocks: [
              { t: "p", html: "Hold this picture: the panel is not trying to find out whether you know what a message queue is. They are sampling <strong>how you behave when the problem is underspecified, the stakeholders disagree, and the consequence of being wrong lands on a customer</strong>. Every question is a probe for the same thing \u2014 do your technical instincts still work once people and money are in the room." },
              { t: "stat", items: [
                { v: "3 min", k: "target length for a deep dive" },
                { v: "6", k: "elements a strong answer carries" },
                { v: "1", k: "decision you must own personally" }
              ] },
              { t: "h", text: "What the panel is actually sampling" },
              { t: "ul", items: [
                "<strong>Name the business problem before you name a component.</strong> An answer that opens with technology has skipped the only part that proves you understood why the work existed.",
                "<strong>Separate your ownership from the team's output.</strong> \u201cWe migrated the platform\u201d tells them nothing about you; \u201cI chose to run both paths for six weeks because finance close was inside the window\u201d does.",
                "<strong>Say what changed after the project.</strong> A runbook, a test, an alert, a process, a decision record \u2014 one artifact that outlived the launch is the difference between having done the work and having improved the system.",
                "<strong>Volunteer the cost.</strong> Every choice you present as free reads as a choice you have not thought about."
              ] },
              { t: "table",
                headers: ["Reading", "What the answer sounds like"],
                rows: [
                  ["Strong signal", "Constraint, options, the decision you made, the measured result, and what you would keep from it."],
                  ["Weak signal", "A tool list, unattributed teamwork, no numbers, and no trade-off anywhere in three minutes."]
                ]
              },
              { t: "h", text: "The answer shape" },
              { t: "p", html: "Structure buys you the same thing in every round: it stops you discovering at minute two that you have spent your whole budget on background. Rehearse against a clock, out loud, once." },
              { t: "code", lang: "text", code:
                "0:00  Problem      one sentence: who was hurting and why it mattered\n" +
                "0:20  Constraint   the thing that made it hard (deadline, data, cost, people)\n" +
                "0:45  Options      two you considered, and what each cost\n" +
                "1:15  Decision     what *I* chose, and the criterion I chose on\n" +
                "2:00  Outcome      the number that moved, and how you knew\n" +
                "2:30  Aftermath    the artifact that outlived it\n" +
                "-----------------------------------------------------------\n" +
                "Anything past 3:00 is the interviewer's follow-up, not your monologue."
              },
              { t: "widget", id: "tm-story-scorer" },
              { t: "compare",
                bad: { title: "Ownership blurred", items: ["\u201cWe decided to move to events.\u201d", "\u201cThe team improved latency by 40%.\u201d", "\u201cWe had some issues with the vendor.\u201d"] },
                good: { title: "Ownership stated", items: ["\u201cI proposed events; the alternative was a synchronous call I could not make idempotent.\u201d", "\u201cI owned the caching change; p99 went from 1.4s to 380ms.\u201d", "\u201cI escalated the vendor throughput gap and paused the cutover.\u201d"] }
              },
              { t: "note", variant: "trap", html: "<strong>Over-correcting into \u201cI\u201d is its own tell.</strong> A leader who narrates every contribution as personal reads as someone who does not develop people. State your decision, then credit the work \u2014 both, explicitly, in the same answer." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Describes the work accurately and can defend the implementation choices."],
                  ["Senior", "Names the constraint, the options and the trade-off, with a measured outcome."],
                  ["Staff", "Explains why this problem was worth solving at all, what was deliberately not built, and what changed in how the organisation works afterwards."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Reach for this shape whenever a question starts with <em>\u201ctell me about a time\u201d</em>, <em>\u201cwalk me through\u201d</em>, or <em>\u201cwhat was the most complex\u2026\u201d</em>. All three are the same request: show me a decision you owned." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cWalk me through your most complex project. Keep it under three minutes.\u201d Record yourself once. Almost everyone runs long on background and never reaches the outcome." },
              { t: "note", variant: "key", html: "<strong>This round scores decisions, not systems.</strong> The system you built is only evidence; what is being assessed is whether you can name the constraint you were under, the option you rejected, and the cost you accepted. An answer with no cost in it has no decision in it." }
            ]
          },
          {
            id: "business-drivers",
            title: "Business goals to architecture drivers",
            summary: "Turning \u201cfast\u201d, \u201creliable\u201d and \u201centerprise ready\u201d into numbers a design can be built against and tested against.",
            minutes: 9,
            tags: ["framing", "requirements"],
            blocks: [
              { t: "p", html: "A business goal is a direction; an <strong>architecture driver</strong> is a constraint. The gap between them is where most designs go wrong, because an adjective lets everyone in the room agree while picturing a different system. Your first job in the round is to close that gap out loud, in front of the person who gave you the adjective." },
              { t: "table",
                headers: ["Business ask", "Architecture driver it becomes"],
                rows: [
                  ["\u201cThe dashboard should be fast\u201d", "p95 under 800ms for the default view at 200 concurrent users, on a 90-day window."],
                  ["\u201cWe need to launch in new regions\u201d", "Data residency per region, an operational coverage window, and a latency budget from the nearest edge."],
                  ["\u201cIt has to be enterprise ready\u201d", "Tenant isolation, audit retention with a stated period, change management, and a support escalation path."],
                  ["\u201cReduce the support load\u201d", "Observability that answers the top three ticket types without engineering, plus a self-service path for the fourth."],
                  ["\u201cLaunch quickly\u201d", "A reversible first slice: what ships behind a flag, and what is deliberately deferred."]
                ]
              },
              { t: "h", text: "How to run the translation" },
              { t: "ul", items: [
                "<strong>Ask what decision the number changes.</strong> If nothing changes at 800ms versus 1.5s, you are being sold a preference, not a requirement.",
                "<strong>Get the population and the percentile together.</strong> \u201cFast for whom, at what load\u201d is one question, and an average is not an answer.",
                "<strong>Find the cost the stakeholder is protecting.</strong> \u201cEnterprise ready\u201d usually means a specific deal, an audit, or a renewal \u2014 name it and the requirement gets concrete immediately.",
                "<strong>Write down the driver where they can see it.</strong> Half of all requirement disputes are resolved by the stakeholder reading your restatement and saying \u201cno, not that\u201d."
              ] },
              { t: "code", lang: "text", code:
                "\"The dashboard is slow.\"  ->  five questions that produce drivers\n" +
                "\n" +
                "1. Which view, and which customer told you?      (scope)\n" +
                "2. Slow at what time of day, at what load?       (population)\n" +
                "3. What were they trying to decide?              (value of latency)\n" +
                "4. What number would you call acceptable?         (target)\n" +
                "5. What happens today when it is slow?           (cost of failure)\n" +
                "\n" +
                "Answers -> driver: \"p95 < 800ms on the exec summary view,\n" +
                "weekday 09:00-10:00 peak, because it blocks the morning\n" +
                "trading review; today they export to a spreadsheet instead.\""
              },
              { t: "note", variant: "trap", html: "<strong>Accepting an adjective is the cheapest way to fail this round.</strong> It feels cooperative, it saves two minutes, and it guarantees you design a system that gets rejected at review for missing a requirement nobody ever stated." },
              { t: "table",
                headers: ["Tier", "Latency requirement", "Why it lands there"],
                rows: [
                  ["Naive", "\u201cThe dashboard must be fast\u201d", "Unfalsifiable. Cannot be designed against, tested, or signed off."],
                  ["Naive", "\u201cAverage response under one second\u201d", "An average hides the tail, which is the only part users complain about."],
                  ["Solid", "\u201cp95 under 800ms at peak concurrency\u201d", "Testable, and it names the population and the load."],
                  ["Standout", "\u201cp95 under 800ms at peak, because it blocks a 09:00 decision; beyond 3s the user exports instead\u201d", "Carries the business consequence, so a trade-off conversation can happen without re-deriving why the number exists."]
                ]
              },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Asks clarifying questions and restates the requirement before designing."],
                  ["Senior", "Turns every adjective into a numbered, testable driver and says which drivers conflict."],
                  ["Staff", "Ranks the drivers by business value, names the one the design will sacrifice first, and gets that ranking agreed before the design review."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Every time a requirement arrives as an adjective \u2014 <em>fast, scalable, secure, enterprise-grade, real-time</em> \u2014 that is the trigger to stop and translate. Do it before you draw anything." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A VP tells you the dashboard is slow. Ask the five questions that turn that complaint into design targets, then read your restatement back to them." },
              { t: "note", variant: "key", html: "<strong>You cannot design against an adjective, and you cannot be held to one either.</strong> Translating goals into numbered drivers is not pedantry \u2014 it is how you get a requirement you can satisfy, a test that proves you did, and a defence when someone later remembers wanting something else." }
            ]
          },
          {
            id: "stakeholder-map",
            title: "Stakeholder mapping for HLD decisions",
            summary: "The same architecture is a different proposal to product, security, finance, support and the customer. Read the room before you recommend.",
            minutes: 9,
            tags: ["framing", "stakeholders"],
            blocks: [
              { t: "p", html: "Picture the decision as a table with five seats, each occupied by someone protecting a different cost. <strong>None of them is being unreasonable</strong> \u2014 security is right that unreviewed controls are a liability, and product is right that a slipped launch has a price. Your job is not to find the person who is wrong; it is to make the trade visible and say who accepts it." },
              { t: "table",
                headers: ["Stakeholder", "Cost they are protecting", "Artifact that unblocks them"],
                rows: [
                  ["Product", "Time to value, and roadmap credibility", "A scoped plan naming what is deferred and when it returns"],
                  ["Security", "Authorization, secrets, audit, tenancy", "A threat model and a written risk acceptance with an owner"],
                  ["Finance", "Run cost, vendor lock-in, measurable return", "A cost model with the three-year view, not month one"],
                  ["Support", "Ticket volume and escalation load", "Runbooks, a degraded-mode description, and customer messaging"],
                  ["Operations", "Pager load and change risk", "Ownership, alerts tied to user impact, and a rollback path"],
                  ["Customer", "Trust, and their own commitments", "Honest release notes and a migration window with no data loss"]
                ]
              },
              { t: "widget", id: "tm-stakeholder-map" },
              { t: "h", text: "Running the conversation" },
              { t: "ul", items: [
                "<strong>State each group's concern before your recommendation.</strong> People concede a point far more readily once they have heard it said accurately by the person about to overrule it.",
                "<strong>Be explicit about who approves what.</strong> A design that needs security sign-off and does not have it is not a design, it is a proposal.",
                "<strong>Bring the artifact, not the argument.</strong> Most objections are requests for a document: a cost model, a threat model, a runbook, a decision record.",
                "<strong>Do not average the positions.</strong> A net-positive room with one strong objector is an unresolved risk, not consensus."
              ] },
              { t: "compare",
                bad: { title: "Picking a winner", items: ["\u201cSecurity's concerns are overblown here.\u201d", "\u201cProduct always wants it yesterday.\u201d", "Deciding in a side channel and announcing it."] },
                good: { title: "Naming the trade", items: ["\u201cThis defers two controls; the residual risk is X and I am asking you to accept it until March.\u201d", "\u201cThe date is achievable at this scope. Here is what comes out.\u201d", "Deciding in the room, with the cost stated and written down."] }
              },
              { t: "note", variant: "trap", html: "<strong>Casting a stakeholder as the villain is the fastest way to lose the room</strong> \u2014 including the people who agree with you, who now know what you say about absent colleagues." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Lists who is affected by the design."],
                  ["Senior", "States each stakeholder\u2019s real cost and what would move them, and restates the opposing position accurately."],
                  ["Staff", "Shapes the decision forum itself \u2014 who decides, who is consulted, by when \u2014 so the disagreement is resolved once instead of in every meeting."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> When a question contains two named groups who want different things \u2014 <em>\u201cproduct wants\u2026 but security wants\u2026\u201d</em> \u2014 you are being asked to hold a trade-off without flattening it, not to choose a side quickly." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Product wants speed, security wants two more controls. Frame the decision in four sentences without making either side the villain, and end by naming who accepts the residual risk." },
              { t: "note", variant: "key", html: "<strong>A trade-off that has been averaged has not been made.</strong> The senior move is to state each cost accurately, recommend one option, and name the person who owns the risk you are choosing to carry \u2014 because the accountability, not the choice, is what makes the decision hold." }
            ]
          },
          {
            id: "assumptions-risks",
            title: "Assumptions, risks and decision triggers",
            summary: "Senior designs make uncertainty explicit and assign it. Four categories, one owner each, and a threshold that changes the plan.",
            minutes: 9,
            tags: ["framing", "risk"],
            blocks: [
              { t: "p", html: "Most designs are presented as if the future were known, and everyone in the room silently discounts them for it. The alternative is not hedging \u2014 it is <strong>separating what you are relying on from what could go wrong from what you have not decided yet</strong>, and giving each one a name and an owner." },
              { t: "table",
                headers: ["Category", "What it means", "Example"],
                rows: [
                  ["Assumption", "Something you are relying on being true", "The vendor API sustains 1,000 requests per second at our payload size"],
                  ["Risk", "Something that could go wrong, with a consequence", "A dual-write mismatch could corrupt the finance close"],
                  ["Dependency", "Someone else's work you cannot start without", "The identity team's tenant claim ships in the same quarter"],
                  ["Open question", "A decision deliberately not yet made", "Whether pilot tenants keep the old export format"]
                ]
              },
              { t: "h", text: "Give every material risk an owner and a trigger" },
              { t: "ul", items: [
                "<strong>An owner is a person, not a team.</strong> Teams do not notice thresholds; people do.",
                "<strong>A trigger is a number and an action.</strong> \u201cIf mismatch exceeds 0.1%, we pause the cutover\u201d is governance; \u201cwe will monitor closely\u201d is a feeling.",
                "<strong>Escalate one-way doors earlier.</strong> Reversibility, not size, is what should decide how much evidence a decision needs.",
                "<strong>Record what would close each assumption.</strong> A load test, a spike, a contract clause \u2014 name the thing that turns the belief into a fact."
              ] },
              { t: "code", lang: "text", code:
                "RISK-3  Dual-write mismatch corrupts the finance close\n" +
                "  likelihood   medium   (schema differs on two nullable columns)\n" +
                "  impact       high     (restatement risk, external auditors)\n" +
                "  owner        named engineer, not \"the platform team\"\n" +
                "  trigger      mismatch > 0.1% of rows in any daily run\n" +
                "  action       pause cutover, keep old path authoritative\n" +
                "  closes when  7 consecutive clean parallel runs"
              },
              { t: "table",
                headers: ["Tier", "Risk statement", "Why it lands there"],
                rows: [
                  ["Naive", "\u201cThe vendor integration is risky\u201d", "No consequence, no owner, nothing anyone can act on."],
                  ["Solid", "\u201cVendor throughput may be below our peak, which would queue payouts\u201d", "Names the mechanism and the consequence."],
                  ["Standout", "The same, plus an owner, a load test that closes it, and \u201cif measured throughput is under 600/s we shard by tenant instead\u201d", "The plan already contains the branch, so nobody has to invent one under pressure."]
                ]
              },
              { t: "note", variant: "trap", html: "<strong>A risk without a trigger gets re-argued every week</strong> by whoever is most anxious that day, and then quietly ignored. The threshold is the whole point: it decides in advance, while everyone is calm." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Names the main risks when asked."],
                  ["Senior", "Separates assumptions from facts and gives each material risk an owner and a measurable trigger."],
                  ["Staff", "Spends evidence in proportion to reversibility \u2014 spikes the one-way doors early, lets the reversible ones ride \u2014 and says so explicitly."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> If you catch yourself saying <em>\u201cwe will keep an eye on it\u201d</em>, <em>\u201cwe should be fine\u201d</em>, or <em>\u201cworst case we can always\u2026\u201d</em>, you have found an unowned risk. Give it a number and a name." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Write three risks for a vendor integration whose throughput you have not measured \u2014 each with an owner, a trigger, and the test that would close it." },
              { t: "note", variant: "key", html: "<strong>Uncertainty is not a weakness in a design; unassigned uncertainty is.</strong> Naming what you are relying on, who owns it, and the threshold at which the plan changes is what lets you hold a risky plan without being reckless \u2014 and it is the single clearest seniority signal in this round." },
              { t: "quiz", id: "hld-framing" }
            ]
          }
        ]
      },
      {
        id: "execution",
        name: "Trade-offs and Execution",
        icon: "trend",
        lessons: [
          {
            id: "cost-aware-hld",
            title: "Cost-aware high-level design",
            summary: "Spend is a product constraint that shapes architecture, not a finance problem discovered after launch.",
            minutes: 9,
            tags: ["execution", "cost"],
            blocks: [
              { t: "p", html: "Treat cost the way you treat latency: a budget, decided up front, that some designs fit and others do not. The failure mode is not overspending \u2014 it is <strong>arriving at a cost conversation with only a total</strong>, at which point the only available action is a blanket cut that lands on whoever argues least." },
              { t: "stat", items: [
                { v: "6", k: "cost surfaces, not one" },
                { v: "per journey", k: "the unit that drives action" },
                { v: "3 yr", k: "horizon a buy decision needs" }
              ] },
              { t: "h", text: "Where the money actually goes" },
              { t: "table",
                headers: ["Cost source", "Control lever", "What the lever costs you"],
                rows: [
                  ["Wide analytical scans", "Partitioning, pruning, materialization", "Layout work, and pruning that breaks silently when a filter changes"],
                  ["Always-on compute", "Autoscaling, schedules, async work", "Cold-start latency and a more complex failure surface"],
                  ["Cross-region traffic", "Locality, batching, replication choice", "Staleness, or a harder consistency story"],
                  ["Observability volume", "Sampling, cardinality limits, retention", "Blind spots exactly where you sampled away"],
                  ["Non-production environments", "Ephemeral environments, shared fixtures", "Slower feedback and flakier tests"],
                  ["Human operations", "Automation, runbooks, fewer failure modes", "Engineering time now, against toil forever"]
                ]
              },
              { t: "ul", items: [
                "<strong>Attribute before you optimise.</strong> Spend by workload, team, warehouse and query pattern turns an argument into a list.",
                "<strong>Compare cost per journey, not the monthly bill.</strong> The bill sizes the problem; cost per search, per export, per payout run points at the design decision to change.",
                "<strong>Protect high-value workloads explicitly.</strong> A cut that slows the executive dashboard to save a rounding error is a loss dressed as a win.",
                "<strong>Count the human cost.</strong> Toil is the line item nobody invoices and everybody pays."
              ] },
              { t: "code", lang: "text", code:
                "Cost per journey, worked\n" +
                "\n" +
                "monthly warehouse spend     = 42,000\n" +
                "share attributed to export  = 31%      -> 13,000\n" +
                "exports per month           = 5,200\n" +
                "cost per export             ~= 2.50\n" +
                "\n" +
                "Now the conversation is possible:\n" +
                "  revenue per export        ~= 0.40   -> the feature loses money\n" +
                "  after partition pruning   ~= 0.35   -> it does not\n" +
                "The total bill could never have told you which feature to fix."
              },
              { t: "note", variant: "trap", html: "<strong>\u201cStorage is cheap\u201d is almost always the wrong axis.</strong> The bill for retained data is scan cost on wider tables, a retention obligation you now owe a regulator, and a larger blast radius if you are breached \u2014 none of which appear on the storage line." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows the main cost drivers and can name the standard levers."],
                  ["Senior", "Attributes spend to workloads and proposes changes with their trade-offs stated."],
                  ["Staff", "Sets a cost budget as a design constraint before the design exists, and can say which workloads are worth protecting when the budget binds."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> The moment a design includes the words <em>retain everything</em>, <em>real-time for all of it</em>, or <em>we can always scale up</em>, a cost constraint has gone unstated. Say the number." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A proposal stores every event forever. Name the four costs that decision creates and the two questions you would ask before approving it." },
              { t: "note", variant: "key", html: "<strong>Cost only becomes a design input once it is attributed.</strong> A total invites indiscriminate cuts; spend per journey names the specific architecture decision that is expensive, which is the only version of the conversation that produces a better system rather than a smaller one." }
            ]
          },
          {
            id: "executive-hld",
            title: "Executive-friendly design storytelling",
            summary: "The same design needs a different first sentence for a VP than for a staff engineer. Altitude is a skill, not a simplification.",
            minutes: 8,
            tags: ["execution", "communication"],
            blocks: [
              { t: "p", html: "Altitude means <strong>leading with the consequence the listener owns</strong>, and holding the mechanism until it is asked for. Getting it wrong is expensive in both directions: mechanism-first reads as evasive to an executive, and outcome-only reads as hand-waving to an engineer. Same content, different entry point." },
              { t: "compare",
                bad: { title: "Mechanism first", items: ["\u201cWe need an event bus because the coupling between checkout and payouts is synchronous.\u201d", "\u201cThe schema change is not backwards compatible.\u201d", "\u201cWe are seeing p99 regressions under fan-out.\u201d"] },
                good: { title: "Consequence first", items: ["\u201cToday a slow payout calculation can block a customer checking out. Decoupling them removes that failure mode.\u201d", "\u201cThis change cannot be rolled back cleanly, so I want two weeks of parallel running before we commit.\u201d", "\u201cThe slowest 1% of page loads got worse, and that 1% is disproportionately our largest accounts.\u201d"] }
              },
              { t: "h", text: "The five lines" },
              { t: "ul", items: [
                "<strong>Outcome</strong> \u2014 what will be true when this is done, in business terms.",
                "<strong>Impact</strong> \u2014 who is affected, and what it is worth or costs.",
                "<strong>Options</strong> \u2014 two, with what each buys and what each gives up.",
                "<strong>Recommendation</strong> \u2014 one, stated as a choice you are making, not a menu you are presenting.",
                "<strong>Ask</strong> \u2014 the specific decision, resource or acceptance you need from this person, today."
              ] },
              { t: "code", lang: "text", code:
                "Executive update, five lines\n" +
                "\n" +
                "OUTCOME  Payout delays stop blocking checkout.\n" +
                "IMPACT   ~2% of checkouts are exposed today; the largest\n" +
                "         three accounts are over-represented in that 2%.\n" +
                "OPTIONS  (a) Decouple now: 3 weeks, no launch slip, adds a\n" +
                "             queue we must operate.\n" +
                "         (b) Patch timeouts: 3 days, removes the symptom,\n" +
                "             leaves the coupling.\n" +
                "RECOMMEND (a). The coupling is the actual defect and it will\n" +
                "         resurface at higher volume.\n" +
                "ASK      Approve 3 weeks, or accept the residual risk of (b)\n" +
                "         in writing."
              },
              { t: "table",
                headers: ["Tier", "The update", "Why it lands there"],
                rows: [
                  ["Naive", "\u201cWe should adopt an event bus \u2014 it is the scalable pattern.\u201d", "A technology preference presented as a conclusion. Nothing to decide."],
                  ["Naive", "\u201cThings are mostly fine, some risk around payouts.\u201d", "Reassurance without information. The listener now has to guess."],
                  ["Solid", "Outcome, impact, two options, a recommendation.", "Decidable. The listener knows what changes and what it costs."],
                  ["Standout", "The same, plus the explicit ask and what you will do if the answer is no.", "Removes the follow-up meeting, and shows you have thought past the approval."]
                ]
              },
              { t: "note", variant: "trap", html: "<strong>Burying the ask is the most common failure.</strong> A well-structured update that never says what you need produces a nod, no decision, and the same conversation in two weeks." },
              { t: "note", variant: "trap", html: "<strong>Altitude is not vagueness.</strong> If you cannot produce the mechanism on request in the next sentence, you were not being concise \u2014 you were guessing." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Can summarise a design without jargon."],
                  ["Senior", "Leads with the consequence the listener owns, offers two options and a recommendation, and ends with an explicit ask."],
                  ["Staff", "Pitches the same substance at three altitudes in the same week \u2014 VP, peer lead, engineer \u2014 and answers the obvious follow-up inside the first update."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> When you hear <em>\u201cjust give me the summary\u201d</em> or <em>\u201cwhy does this need two more weeks\u201d</em>, that is a request for consequence-first framing with an explicit ask at the end." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Explain to a non-technical leader why a phased migration needs two extra weeks. Five lines, ending with the decision you want from them." },
              { t: "note", variant: "key", html: "<strong>An update without an ask is not communication, it is narration.</strong> Lead with the consequence your listener owns, give them two options and your recommendation, and finish by naming the decision you need \u2014 otherwise you have transferred information and no accountability." }
            ]
          },
          {
            id: "architecture-review",
            title: "Leading architecture reviews that decide things",
            summary: "A review exists to surface risk while it is cheap and to end with a decision. Most fail by becoming a presentation with an audience.",
            minutes: 9,
            tags: ["execution", "review"],
            blocks: [
              { t: "p", html: "An architecture review has one job: <strong>produce a decision on a proposal that affects more than the team writing it, while the risks are still cheap to address</strong>. The common failure is not bad feedback \u2014 it is a meeting with no decision owner, no closing outcome, and comments that arrive as opinions about a design that is already half built." },
              { t: "p", html: "The written half of the process \u2014 proposal format, reviewers, closing dates \u2014 is covered in <a class='inline' href='#/strategy/execution/rfc-review'>RFCs and design review that scale</a>. This lesson is about leading the review itself, and about what a reviewer is actually checking." },
              { t: "table",
                headers: ["Stage", "What the lead does", "Failure it prevents"],
                rows: [
                  ["Triage", "Choose the review tier by reversibility and blast radius, not by team or seniority", "Over-reviewing trivia while one-way doors slip through on a chat thread"],
                  ["Pre-read", "Circulate a short written proposal two days ahead, with the specific questions the author wants answered", "A meeting spent reading, and feedback on whatever the loudest reviewer noticed"],
                  ["In the room", "Open with the author\u2019s questions, timebox, and separate correctness and risk from preference", "An hour on naming while the failure modes go undiscussed"],
                  ["Outcome", "Name one of: approved, approved with conditions, spike needed, or rejected \u2014 and who decided", "\u201cGood discussion\u201d with no outcome, and the same review next month"],
                  ["Follow-through", "Record the conditions with owners and dates, and check them before launch", "Conditions agreed in the room and quietly forgotten"]
                ]
              },
              { t: "h", text: "What a reviewer should actually check" },
              { t: "ul", items: [
                "<strong>Drivers as numbers.</strong> Load, latency, recovery target, cost ceiling \u2014 if they are adjectives, stop and fix that first (see <a class='inline' href='#/hld/framing/business-drivers'>business goals to architecture drivers</a>).",
                "<strong>Failure modes.</strong> The degraded mode per dependency, and what the user sees while it is broken.",
                "<strong>Data.</strong> Who owns it, how it migrates, and which parts are one-way doors.",
                "<strong>Operability.</strong> Who is on call, what pages them, and how the change is rolled back.",
                "<strong>Cost at expected load and at ten times it.</strong> The second number is where designs that look cheap stop being cheap.",
                "<strong>Security boundaries.</strong> Where sensitive data crosses a trust boundary, and who reviewed that path."
              ] },
              { t: "code", lang: "text", code:
                "Review outcome, as recorded\n" +
                "\n" +
                "PROPOSAL   Move invoice generation to an async worker\n" +
                "TIER       2 \u2014 changes another team's failure mode; reversible\n" +
                "DECISION   Approved with conditions (decided: payments lead)\n" +
                "CONDITIONS 1. Idempotency key on invoice creation   owner: Ravi  by: 12 Mar\n" +
                "           2. Alert on invoice queue age > 15 min    owner: Mei   by: launch\n" +
                "           3. Rollback rehearsed in staging          owner: Ravi  by: launch\n" +
                "NOT RAISED Language choice, folder layout (preference; author's call)\n" +
                "REOPEN IF  invoice volume > 5x forecast, or p99 > 2 s for a week"
              },
              { t: "note", variant: "trap", html: "<strong>A review board that approves everything late is worse than none.</strong> Teams learn to bring finished designs, so feedback arrives when it can no longer change anything, and the board becomes a toll gate people schedule around. Review at thirty percent done, when changing direction costs an afternoon." },
              { t: "p", html: "For the system-design substance a reviewer is checking \u2014 capacity, failure domains, tenant isolation \u2014 Blueprint\u2019s <a class='inline' href='../hld-lld-academy/index.html#/hld/cases/saas-reliability-review'>multi-tenant reliability review capstone</a> works through a full example. Here, the skill is running the room." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Brings a clear design to review and responds to feedback."],
                  ["Senior", "Runs reviews that end with a recorded outcome, conditions with owners, and preference separated from risk."],
                  ["Staff", "Designs the review system itself \u2014 tiers, timing, who decides \u2014 so teams bring drafts early because it saves them time."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Prompts like <em>\u201chow do you run design reviews\u201d</em>, <em>\u201ca team shipped without review\u201d</em> or <em>\u201creviews have become a bottleneck\u201d</em> are asking about the review system \u2014 tiering, timing and outcomes \u2014 not about your opinion of a particular design." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A team bypassed architecture review and shipped a design that now pages another team nightly. Say what you change in the review process, not just what you say to the team." },
              { t: "note", variant: "key", html: "<strong>A review is measured by the decisions it produces early, not by the issues it finds late.</strong> Tier it by reversibility, review drafts against a written pre-read, and end every session with an outcome, an owner and conditions someone will check \u2014 otherwise it is a presentation, and teams will treat it as one." }
            ]
          },
          {
            id: "adr-leadership",
            title: "Decisions that stay decided",
            summary: "Architecture decision records turn an argument into a durable choice by naming context, rejected options, consequences and the trigger to revisit.",
            minutes: 9,
            tags: ["execution", "adr"],
            blocks: [
              { t: "p", html: "The problem a decision record solves is not documentation \u2014 it is <strong>re-litigation</strong>. Without one, the same option is proposed again next quarter by someone who assumes you never considered it, and the argument is settled by whoever is most senior or most persistent that week rather than by the reasoning." },
              { t: "table",
                headers: ["Section", "Purpose", "What its absence causes"],
                rows: [
                  ["Context", "The constraint and the deadline that forced the decision", "A future reader cannot tell whether the constraint still holds"],
                  ["Decision", "One sentence a newcomer could repeat accurately", "The record becomes meeting notes"],
                  ["Options rejected", "What else was considered, and why each lost", "The same proposal returns, framed as a new idea"],
                  ["Consequences", "Cost, risk, migration work, and who absorbs it", "The decision looks free until the bill arrives"],
                  ["Owner", "The person accountable for the outcome", "The decision decays into folklore"],
                  ["Revisit trigger", "The measurable condition that reopens it", "Either permanent by accident, or reopened on mood"]
                ]
              },
              { t: "widget", id: "tm-adr-builder" },
              { t: "h", text: "When one is worth the cost" },
              { t: "ul", items: [
                "<strong>Write one when the decision shapes teams, data, money or reversibility.</strong> Service boundaries, datastore choice, event-versus-call, vendor commitments, tenancy model.",
                "<strong>Do not write one for things a linter should own.</strong> Naming conventions and file layout are cheap to change and cost you credibility when recorded as decisions.",
                "<strong>Record rejected options respectfully.</strong> Someone in the room advocated for each one; the record is read by them.",
                "<strong>State what would change your mind.</strong> A decision with no revisit condition is either dogma or an accident."
              ] },
              { t: "note", variant: "trap", html: "<strong>A record written after the fact to justify a decision already made is worse than none.</strong> People can tell, and it teaches the team that the process is theatre \u2014 after which nobody brings a real disagreement to it again." },
              { t: "table",
                headers: ["Situation", "Record it?"],
                rows: [
                  ["Choosing events over synchronous calls between two teams", "Yes \u2014 shapes both teams' failure modes and is hard to reverse"],
                  ["Primary datastore for a new tenant-facing service", "Yes \u2014 data migrations are the definitive one-way door"],
                  ["Helper-function naming inside one module", "No \u2014 cheap to change, invisible outside the module"],
                  ["Three-year identity vendor contract", "Yes \u2014 money, lock-in, and an exit path someone will need"],
                  ["Retry count on an internal call", "No, unless it changes user-visible behaviour"]
                ]
              },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Writes down what was decided."],
                  ["Senior", "Records the rejected options fairly, with a measurable revisit trigger and an owner."],
                  ["Staff", "Decides which decisions warrant a record at all, keeps the set small enough to be read, and actually reopens them when a trigger fires."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> The signal that you need a record is hearing <em>\u201cdidn't we already decide this?\u201d</em> \u2014 or realising that you cannot answer it yourself." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Draft the title and the revisit trigger for a decision to use events rather than direct API calls between two teams' services." },
              { t: "note", variant: "key", html: "<strong>The two sections everyone skips are the two that make a decision durable: the options rejected and the trigger to revisit.</strong> Without the first, the argument returns; without the second, the decision either becomes dogma or gets reopened on a mood. Both are cheap to write and expensive to omit." },
              { t: "quiz", id: "hld-execution" }
            ]
          }
        ]
      },
      {
        id: "operations",
        name: "Operations and Migration",
        icon: "shield",
        lessons: [
          {
            id: "operating-model",
            title: "The operating model belongs in the design",
            summary: "A design is not finished until someone is on call for it, the alerts fire on user impact, and the degraded mode is a decision rather than an accident.",
            minutes: 9,
            tags: ["operations", "ownership"],
            blocks: [
              { t: "p", html: "A high-level design that stops at the box diagram has answered the easy half. The other half is <strong>who owns this at 3am, what tells them, and what the customer sees while it is broken</strong> \u2014 and unlike the boxes, those three cannot be retrofitted cheaply." },
              { t: "table",
                headers: ["Failure mode", "How you detect it", "What the user gets"],
                rows: [
                  ["Dependency timeout", "Error-rate and p99 alert on the calling path", "Cached or stale result, with the staleness shown"],
                  ["Dependency down entirely", "Circuit breaker open, alert on breaker state", "Degraded mode: the core journey without the enrichment"],
                  ["Bad data published", "Reconciliation check against the source of truth", "Publish paused, last-good served, caveat displayed"],
                  ["Overload", "Saturation plus queue-age alert", "Load shed on the lowest-value traffic first, deliberately chosen"],
                  ["Silent partial failure", "Business-metric alert, not an infrastructure one", "Nothing visible \u2014 which is exactly why the business metric is the alert"]
                ]
              },
              { t: "h", text: "Three things to name explicitly" },
              { t: "ul", items: [
                "<strong>Build-time owner and run-time owner.</strong> They are often different people, and assuming they are the same is how services end up unowned six months after launch.",
                "<strong>Alerts tied to user impact.</strong> Alert on the journey failing, not on CPU. Symptom alerts train people to ignore the pager.",
                "<strong>The degraded mode, as a product decision.</strong> Stale reads, queued writes, a cached price \u2014 someone has to choose which, and the choice has customer consequences.",
                "<strong>The rollback path, rehearsed.</strong> An untested rollback is a plan, not a capability."
              ] },
              { t: "code", lang: "text", code:
                "Two alerts on the same outage\n" +
                "\n" +
                "  BAD   cpu_utilisation > 80% for 5m\n" +
                "        fires under healthy load; fires during backfills;\n" +
                "        does not fire when the service is up and wrong\n" +
                "\n" +
                "  GOOD  checkout_success_rate < 99.2% for 2m\n" +
                "        fires when a customer cannot buy something, which\n" +
                "        is the only condition that justifies the pager\n" +
                "\n" +
                "Keep the CPU signal. Put it on a dashboard, not a pager."
              },
              { t: "compare",
                bad: { title: "Undesigned operations", items: ["Every dependency failure becomes a full outage", "Alerts on internals; the real outage arrives by customer email", "Rollback discovered during the incident"] },
                good: { title: "Designed operations", items: ["Each dependency has a stated degraded mode", "Alerts on journeys; internals live on dashboards", "Rollback rehearsed, with a known duration"] }
              },
              { t: "note", variant: "trap", html: "<strong>An alert nobody can act on is worse than no alert.</strong> It consumes the attention you will need for the real one, and it teaches the team that paging is noise." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows the service needs monitoring and an on-call owner."],
                  ["Senior", "Names the degraded mode per dependency and alerts on user journeys rather than internals."],
                  ["Staff", "Treats operability as a launch criterion, sets the build-versus-run ownership split, and budgets the toil before it exists."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Whenever a design introduces a dependency, that is the trigger to state its degraded mode out loud. \u201cWhat does the user see when this is gone\u201d is the question that separates a diagram from a design." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Your service calls three downstream APIs. For each, state the detection signal, the degraded behaviour, and who owns the pager." },
              { t: "note", variant: "key", html: "<strong>Undesigned, every dependency failure becomes an outage by default.</strong> Naming the degraded mode is the cheapest reliability work available, and it is a product decision \u2014 which means it belongs in the design review, not in the incident." }
            ]
          },
          {
            id: "migration-strategy",
            title: "Phased delivery and migration strategy",
            summary: "Good architecture still fails if the rollout is reckless. Shrink the blast radius, agree go/no-go before the pressure, and know your undo path.",
            minutes: 10,
            tags: ["operations", "migration"],
            blocks: [
              { t: "p", html: "A rollout plan exists to shrink two numbers: <strong>how many people meet the bug, and how long they stay there</strong>. Everything else \u2014 canaries, flags, parallel runs, cohorts \u2014 is a mechanism for moving one of those two. If a plan does not reduce either, it is a schedule, not a risk control." },
              { t: "table",
                headers: ["Pattern", "Use when", "What it costs"],
                rows: [
                  ["Feature flag", "Behaviour change you may want to undo in minutes", "Flag debt, and two code paths to reason about"],
                  ["Canary cohort", "You need production signal before broad exposure", "Slower rollout, and metrics too thin to read at 1%"],
                  ["Strangler", "Replacing legacy behaviour incrementally", "A long period running two systems, and a facade to maintain"],
                  ["Parallel run", "Correctness must be proven before cutover", "Double compute, plus a reconciliation process nobody budgets for"],
                  ["Big-bang cutover", "Genuinely atomic changes with a rehearsed rollback", "Full blast radius on the first failure"]
                ]
              },
              { t: "widget", id: "tm-blast-radius" },
              { t: "h", text: "Agree the gates before you need them" },
              { t: "ul", items: [
                "<strong>Write go/no-go criteria before the migration pressure arrives.</strong> Written during it, they are negotiated down to whatever the current state happens to be.",
                "<strong>Name the undo path and its duration.</strong> \u201cFlag off, two minutes\u201d and \u201cdata repair, four hours\u201d are different decisions, and only one of them is reversible in any useful sense.",
                "<strong>Give the parallel run a reconciliation owner.</strong> A comparison nobody reads is worse than no comparison, because it manufactures confidence.",
                "<strong>Decide what \u201cexplainable\u201d means in advance.</strong> A timing difference you understand is a note; a money variance you do not is a stop."
              ] },
              { t: "code", lang: "text", code:
                "Go / no-go, agreed two weeks before cutover\n" +
                "\n" +
                "GO requires all of:\n" +
                "  7 consecutive parallel runs with row counts equal\n" +
                "  aggregate variance < 0.01% on all monetary columns\n" +
                "  100 sampled rows matched on business rules, by a human\n" +
                "  rollback rehearsed end to end, duration recorded\n" +
                "  named owner online for the 4h after cutover\n" +
                "\n" +
                "NO-GO on any of:\n" +
                "  any unexplained monetary variance, at any size\n" +
                "  reconciliation owner unavailable\n" +
                "  inside the finance freeze window"
              },
              { t: "note", variant: "trap", html: "<strong>Matching row counts is the trap.</strong> Counts are the cheapest check and the first to pass; amounts are where the defect usually lives. A migration that reconciles on counts alone has verified that it lost nothing, not that it computed anything correctly." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows the rollout patterns and can pick a reasonable one."],
                  ["Senior", "Sizes the blast radius, names the undo path, and sets go/no-go criteria up front."],
                  ["Staff", "Decides which correctness evidence is worth the calendar it costs, and can say no to a cutover with the business consequence stated."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Any question containing <em>cutover</em>, <em>go-live</em>, <em>we are behind</em>, or <em>the numbers do not quite match</em> is asking whether you will trade correctness for a date, and whether you decided that in advance or under pressure." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Old and new disagree on 0.3% of rows during the parallel run, the difference is in amounts, and close is in a week. Make the call and justify it in three sentences." },
              { t: "note", variant: "key", html: "<strong>Criteria written under pressure are not criteria.</strong> Decide the thresholds and the undo path while everyone is calm, and the hard call on cutover day becomes reading a number out loud rather than negotiating with people who very much want to ship." }
            ]
          },
          {
            id: "replatforming",
            title: "Re-platforming: evolve, replace or rewrite",
            summary: "Most re-platforming programmes fail on parity, not technology. Decide whether the pain is structural before choosing how to move.",
            minutes: 10,
            tags: ["operations", "migration", "strategy"],
            blocks: [
              { t: "p", html: "\u201cWe need to get off this platform\u201d is a conclusion, not a requirement. The first question is whether the pain is <strong>structural</strong> \u2014 the platform cannot meet a driver you have, such as tenant isolation, a recovery target or a cost ceiling \u2014 or <strong>local</strong>: code that is hard to change but sits on a perfectly adequate foundation. Local pain is fixed with refactoring; only structural pain justifies the calendar a re-platform costs." },
              { t: "table",
                headers: ["Approach", "Fits when", "What it really costs"],
                rows: [
                  ["Evolve in place", "The platform can meet the drivers; the code cannot", "Sustained refactoring budget and the discipline to measure it"],
                  ["Strangle onto a new platform", "Structural limits, but the system can be sliced by journey or tenant", "A long period of two systems, a routing facade, and duplicated operations"],
                  ["Replace with a bought product", "The capability is not a differentiator and a product covers most of it", "Customisation limits, data migration, and an exit path you must plan on day one"],
                  ["Rewrite and cut over", "Small, well-specified system with a rehearsed rollback", "Parity risk concentrated into one date, with no partial value before it"]
                ]
              },
              { t: "h", text: "The questions that decide it" },
              { t: "ul", items: [
                "<strong>Which driver can the current platform not meet, by how much, and by when?</strong> If you cannot name one, you are proposing a refactor with a bigger budget.",
                "<strong>What is the freeze cost?</strong> Every month the team spends porting is a month of roadmap that does not ship. Put that number next to the benefit.",
                "<strong>What will you deliberately not port?</strong> Usage data on legacy features is the cheapest scope reduction available; a feature nobody used last quarter is a candidate for retirement, not migration.",
                "<strong>How will you know behaviour is preserved?</strong> Characterisation tests and parallel runs on the journeys that carry money or contracts \u2014 not a promise of feature parity.",
                "<strong>Where is the first slice of value?</strong> A plan that delivers nothing until the final cutover concentrates all the risk in one weekend."
              ] },
              { t: "code", lang: "text", code:
                "Re-platform case, one page\n" +
                "\n" +
                "STRUCTURAL GAP  Shared database cannot isolate tenants; two\n" +
                "                enterprise deals require it by Q3.\n" +
                "COST OF STAYING ~1 sev-2 a month from noisy neighbours; both deals\n" +
                "                at risk (combined ~1.8M ARR).\n" +
                "APPROACH        Strangle by tenant: new platform for new and\n" +
                "                enterprise tenants first; long tail later.\n" +
                "NOT PORTING     Legacy report builder (3 tenants used it last\n" +
                "                quarter; offered an export instead).\n" +
                "FREEZE COST     ~40% of team capacity for two quarters.\n" +
                "FIRST VALUE     First enterprise tenant isolated in 10 weeks.\n" +
                "STOP IF         Slice 1 takes > 16 weeks, or parity defects on\n" +
                "                invoicing exceed 2 per tenant migrated."
              },
              { t: "note", variant: "trap", html: "<strong>\u201cFeature parity\u201d as the goal is the classic trap.</strong> A legacy system contains years of undocumented behaviour that someone depends on, and a rewrite rediscovers it one production incident at a time. Define parity per journey, characterise it before you start, and retire what nobody uses instead of porting it." },
              { t: "p", html: "The rollout mechanics \u2014 canaries, parallel runs, go/no-go \u2014 are in <a class='inline' href='#/hld/operations/migration-strategy'>phased delivery and migration strategy</a>, and the last mile of moving reluctant consumers is in <a class='inline' href='#/strategy/execution/deprecations'>deprecations people actually finish</a>. For the data side, Blueprint covers <a class='inline' href='../hld-lld-academy/index.html#/hld/data/zero-downtime-data-migrations'>zero-downtime data migrations</a> and a worked <a class='inline' href='../hld-lld-academy/index.html#/breakdowns/wild/wild-wide-column-migration'>store-to-store migration</a>." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Can describe the target platform and a migration sequence."],
                  ["Senior", "Names the structural gap, the freeze cost and the first slice of value, and plans parity per journey."],
                  ["Staff", "Decides whether to re-platform at all, retires scope rather than porting it, and sets the stop condition before the programme starts."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> <em>\u201cOur platform is legacy\u201d</em>, <em>\u201cwe want to rewrite it\u201d</em> or <em>\u201cthe new platform is late and parity keeps slipping\u201d</em> are asking whether you separate structural from local pain, and whether you can find value before the final cutover." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Your team wants to rewrite a ten-year-old order system. Ask the three questions that decide whether to evolve, strangle or rewrite, and say which answer would change your recommendation." },
              { t: "note", variant: "key", html: "<strong>Re-platform only for a structural gap you can name, and never for parity you cannot measure.</strong> Price the freeze, retire what nobody uses, slice by journey or tenant so value arrives early, and agree the stop condition before the first line of new code." }
            ]
          },
          {
            id: "multi-region",
            title: "Multi-region: buying availability honestly",
            summary: "A second region is bought with money, complexity and consistency. Derive the recovery target from the cost of downtime before choosing a topology.",
            minutes: 10,
            tags: ["operations", "reliability", "cost"],
            blocks: [
              { t: "p", html: "\u201cWe should be multi-region\u201d usually means \u201cwe should not go down\u201d, and those are different requests. A second region protects against <strong>losing a region</strong>. It does nothing for a bad deploy, a broken config push or a failing dependency \u2014 which together cause most real downtime \u2014 and an automated rollout can carry the same defect into both regions within minutes." },
              { t: "stat", items: [
                { v: "RTO", k: "how long you may be down" },
                { v: "RPO", k: "how much data you may lose" },
                { v: "1.3\u20132.5\u00d7", k: "typical infrastructure multiple" }
              ] },
              { t: "table",
                headers: ["Topology", "Recovery time", "Data loss", "What it costs besides money"],
                rows: [
                  ["Single region, backups elsewhere", "Hours to a day", "Since the last backup", "A region loss is a long outage, and the restore is rarely rehearsed"],
                  ["Warm standby", "Tens of minutes to an hour", "Minutes (async replication)", "A scaled-down copy that must scale up mid-incident"],
                  ["Hot standby", "Minutes", "Seconds (replication lag)", "Paying for a full idle copy; lag decides what is lost"],
                  ["Active-active", "Seconds", "Near zero locally; conflicts on global writes", "Conflict resolution, routing and data residency in every feature, forever"]
                ]
              },
              { t: "widget", id: "tm-region-picker" },
              { t: "h", text: "How to reason about it" },
              { t: "ul", items: [
                "<strong>Start from the cost of an hour down.</strong> Lost revenue, contract penalties, regulatory exposure. That number, not ambition, sets the recovery target.",
                "<strong>Check what actually caused last year\u2019s downtime.</strong> If it was deploys and config, fund progressive delivery and fast rollback first; they are cheaper and help in every topology.",
                "<strong>Make only the critical journey multi-region.</strong> Checkout and login may need it; the reporting suite almost certainly does not.",
                "<strong>Rehearse the failover.</strong> An unexercised failover takes several times longer than the design says, and sometimes does not work at all.",
                "<strong>Decide consistency per data type.</strong> Balances and inventory need a single writer or a conflict rule; preferences and carts can merge."
              ] },
              { t: "code", lang: "text", code:
                "Does warm standby pay for itself? (illustrative)\n" +
                "\n" +
                "base infrastructure          600k / yr\n" +
                "region-level event           ~0.3 / yr, ~8 h without failover\n" +
                "\n" +
                "at 40k per hour down\n" +
                "  expected loss, single      0.3 x 8 h x 40k  =  96k / yr\n" +
                "  expected loss, warm (1 h)  0.3 x 1 h x 40k  =  12k / yr\n" +
                "  loss avoided                                 84k / yr\n" +
                "  extra spend (0.35 x 600k)                   210k / yr\n" +
                "  -> does not pay on expected value; justify it with the\n" +
                "     contract or the regulator, or do not buy it\n" +
                "\n" +
                "at 250k per hour down\n" +
                "  loss avoided  0.3 x 7 h x 250k  = 525k / yr  -> pays back"
              },
              { t: "note", variant: "trap", html: "<strong>Active-active chosen \u201cfor reliability\u201d without a conflict model is how teams buy a new class of outage.</strong> Two regions accepting writes to the same balance will disagree eventually, and the incident that follows is a data-correctness incident \u2014 slower to detect and harder to undo than the region loss it was meant to prevent." },
              { t: "p", html: "The mechanics \u2014 replication modes, traffic steering, failure domains \u2014 are covered in depth in Blueprint\u2019s <a class='inline' href='../hld-lld-academy/index.html#/hld/reliability/multi-region-resilience'>multi-region resilience</a> lesson. Here the job is deciding how much to buy and saying why." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows the topologies and that more regions cost more."],
                  ["Senior", "Derives the recovery target from the cost of downtime, scopes multi-region to the critical journey, and insists on rehearsed failover."],
                  ["Staff", "Shows whether the spend pays back, redirects it to the actual causes of downtime when it does not, and owns the consistency model per data type."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> <em>\u201cShould we go multi-region?\u201d</em>, <em>\u201cwe need five nines\u201d</em> or <em>\u201ca cloud region went down last week\u201d</em> is asking whether you will convert an availability wish into a recovery target with a price." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A VP asks for active-active after a competitor\u2019s regional outage made the news. Respond in five lines: target, cause of your own downtime, recommendation, cost, and the decision you need." },
              { t: "note", variant: "key", html: "<strong>Buy recovery against a target derived from the cost of downtime, not against fear.</strong> Fix the causes of your own outages first, make only the critical journey multi-region, rehearse the failover, and say plainly whether the spend pays back or is being bought for a contract." }
            ]
          },
          {
            id: "incident-hld",
            title: "Incident leadership",
            summary: "Incident answers reveal the order of your instincts. Mitigate, communicate, then diagnose \u2014 and turn the finding into something that outlives your memory.",
            minutes: 9,
            tags: ["operations", "incident"],
            blocks: [
              { t: "p", html: "This is the question where the order of your sentences is the answer. The panel is listening for whether you <strong>reduce harm before you satisfy your curiosity</strong>, because under pressure most engineers want to understand first \u2014 and understanding is not what the customer needs from you in the first ten minutes." },
              { t: "table",
                headers: ["Phase", "The move", "What you say"],
                rows: [
                  ["Triage", "Classify impact, scope and reversibility; assign a commander", "\u201cCore journey degraded, one region, no data risk \u2014 S2, I am commanding.\u201d"],
                  ["Mitigate", "Roll back, flag off, fail over, or degrade", "\u201cRolling back the 14:10 deploy now. Diagnosis after.\u201d"],
                  ["Communicate", "State impact, confidence, and the next update time", "\u201cCheckout is failing for ~4% of sessions. Next update in 30 minutes.\u201d"],
                  ["Diagnose", "Find the cause with the pressure off", "\u201cMitigated. Now working the cause; no further customer impact.\u201d"],
                  ["Recover", "Verify the journey and the data, not just the graph", "\u201cSuccess rate normal, and I have reconciled the 40 minutes of writes.\u201d"],
                  ["Prevent", "Convert the finding into a check with an owner and a date", "\u201cTwo actions: a build-failing check, and an alert on the business metric.\u201d"]
                ]
              },
              { t: "widget", id: "tm-severity-triage" },
              { t: "h", text: "The moves that separate levels" },
              { t: "ul", items: [
                "<strong>Mitigate before perfect root cause.</strong> A known recent change correlated with user harm should be undone, then read.",
                "<strong>Set a comms cadence and hold it.</strong> The next-update time is what stops a stream of individual pings and buys the team room to work.",
                "<strong>Say what you do not know.</strong> \u201cCounts reconciled, amounts still under review\u201d is more trustworthy than composure, and stakeholders act on it correctly.",
                "<strong>Verify recovery on the journey and the data.</strong> A green dashboard with 40 minutes of unreconciled writes is not recovered.",
                "<strong>Separate accountability from blame.</strong> A change that could reach production and break it is a gap in your gates, not only in someone's judgment."
              ] },
              { t: "compare",
                bad: { title: "Curiosity first", items: ["Reading the diff while the error rate climbs", "\u201cInvestigating\u201d as the only status, for an hour", "Root cause found, nothing changed structurally"] },
                good: { title: "Harm first", items: ["Roll back, confirm recovery, then read the diff", "Impact, confidence, next update time \u2014 every 30 minutes", "Two prevention items with owners and dates"] }
              },
              { t: "note", variant: "trap", html: "<strong>Debugging in the open channel is the classic senior mistake.</strong> Hypotheses posted to a stakeholder channel get read as facts, quoted upward, and then have to be retracted \u2014 which costs more trust than the incident did." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Follows the incident process and helps diagnose."],
                  ["Senior", "Mitigates before diagnosing, holds a communication cadence, and states confidence honestly."],
                  ["Staff", "Turns the finding into a control that removes a class of failure, and runs the review so the next person escalates earlier, not later."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Any prompt of the form <em>\u201ca deploy causes\u2026\u201d</em>, <em>\u201cusers report\u2026\u201d</em>, or <em>\u201cyou get paged at 3am\u2026\u201d</em> is testing sequence. Lead with the mitigation, not the hypothesis." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A deploy causes high latency but no hard errors. Walk the first ten minutes in order, and state what you would post to stakeholders at minute five." },
              { t: "note", variant: "key", html: "<strong>The first move is always harm reduction, and the last move is always a control that outlives you.</strong> Everything between \u2014 the cadence, the honesty about confidence, the separation of accountability from blame \u2014 is what makes people willing to tell you about the next incident early." },
              { t: "quiz", id: "hld-operations" }
            ]
          }
        ]
      }
    ]
  };
})();
