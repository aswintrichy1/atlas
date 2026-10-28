/* =====================================================================
   BEACON · Incident Management & Postmortems
   window.TRACKS.inc — modules: response / learning

   Self-contained: this file registers its own widgets (bcSeverity,
   bcMttx), its own quizzes (inc-response, inc-learning) and its track
   data.
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
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

  function tagged(label, ctl) {
    return h("span", { class: "w-field" }, label + " ", ctl);
  }

  function mins(m) {
    m = Math.round(fin(m, 0));
    if (m < 120) return m + " min";
    return (Math.round(m / 6) / 10) + " h";
  }

  var Widgets = {};

  /* ==================================================================
     1. bcSeverity — impact facts in, SEV level and reasons out
  ================================================================== */
  var SEV_RESPONSE = {
    1: { page: "on-call + IC + comms lead, exec notified", cadence: "every 30 min", ic: "yes, dedicated", pm: "required" },
    2: { page: "on-call + IC", cadence: "every 60 min", ic: "yes", pm: "required" },
    3: { page: "on-call (business hours ok)", cadence: "at milestones", ic: "on-call acts as IC", pm: "optional, team decides" },
    4: { page: "no page: ticket", cadence: "none", ic: "no", pm: "no" }
  };

  Widgets.bcSeverity = function (mount) {
    shell(mount, "classifier", "Severity picker",
      "Describe what you know right now. The picker applies a sample severity matrix: user impact sets the base level, and duration, revenue path, data loss and security can only raise it. Every rule that fired is listed, because a severity nobody can explain will be argued about mid-incident.");
    var st = { impact: 15, dur: 0, dataLoss: false, security: false, revenue: false };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    var impLbl = h("b", {}, st.impact + "%");
    var impIn = h("input", { type: "range", min: "0", max: "100", step: "1", value: String(st.impact) });
    impIn.addEventListener("input", function () {
      var v = parseInt(impIn.value, 10);
      st.impact = isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
      paint();
    });
    controls.appendChild(field("users affected", impIn, impLbl));
    controls.appendChild(segment([[0, "< 30 min"], [1, "30 min - 2 h"], [2, "> 2 h"]], 0, function (v) { st.dur = v; paint(); }));
    controls.appendChild(tagged("data loss", segment([[false, "no"], [true, "yes"]], 0, function (v) { st.dataLoss = v; paint(); })));
    controls.appendChild(tagged("security", segment([[false, "no"], [true, "yes"]], 0, function (v) { st.security = v; paint(); })));
    controls.appendChild(tagged("revenue path", segment([[false, "no"], [true, "yes"]], 0, function (v) { st.revenue = v; paint(); })));

    function classify() {
      var sev, reasons = [];
      if (st.impact >= 50) { sev = 1; reasons.push("impact >= 50% of users: SEV1 base"); }
      else if (st.impact >= 10) { sev = 2; reasons.push("impact 10-49%: SEV2 base"); }
      else if (st.impact >= 1) { sev = 3; reasons.push("impact 1-9%: SEV3 base"); }
      else { sev = 4; reasons.push("no measurable user impact: SEV4 base"); }
      if (st.revenue && st.impact >= 1 && sev > 1) { sev--; reasons.push("revenue path affected: raised one level"); }
      if (st.dur === 2 && sev > 1) { sev--; reasons.push("impact over 2 h: raised one level"); }
      if (st.dataLoss && sev > 2) { sev = 2; reasons.push("data loss: at least SEV2"); }
      if (st.security && sev > 2) { sev = 2; reasons.push("security involvement: at least SEV2, engage security response"); }
      if (st.security && st.dataLoss && sev > 1) { sev = 1; reasons.push("security + data loss: possible breach, SEV1"); }
      return { sev: sev, reasons: reasons };
    }

    function paint() {
      impLbl.textContent = st.impact + "%";
      var c = classify(), i;
      clear(stage);
      var ladder = h("div", { style: "display:grid;grid-template-columns:repeat(4,1fr);gap:6px" });
      for (i = 1; i <= 4; i++) {
        var on = i === c.sev;
        var fill = i === 1 ? "var(--rose)" : i === 2 ? "var(--amber)" : i === 3 ? "var(--cyan)" : "var(--lime)";
        ladder.appendChild(h("div", { style: "padding:10px 6px;text-align:center;border-radius:8px;font-weight:700;font-family:var(--font-mono);border:1px solid var(--line);" +
          (on ? "background:" + fill + ";color:var(--on-accent)" : "background:var(--surface-solid);color:var(--text-dim)") }, "SEV" + i));
      }
      stage.appendChild(ladder);
      var list = h("ul", { style: "margin:10px 0 0;padding-left:18px;font-size:0.85rem;color:var(--text)" });
      for (i = 0; i < c.reasons.length; i++) list.appendChild(h("li", {}, c.reasons[i]));
      stage.appendChild(list);

      var r = SEV_RESPONSE[c.sev];
      clear(readout);
      readout.appendChild(ro("severity", "SEV" + c.sev));
      readout.appendChild(ro("rules fired", c.reasons.length));
      readout.appendChild(ro("who is engaged", r.page));
      readout.appendChild(ro("status updates", r.cadence));
      readout.appendChild(ro("incident commander", r.ic));
      readout.appendChild(ro("postmortem", r.pm));
    }

    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. bcMttx — mean vs median over a small, skewed incident log
  ================================================================== */
  var INCIDENTS = [
    { id: "INC-401", sev: 2, ack: 4, ttr: 38, what: "Bad config push" },
    { id: "INC-402", sev: 3, ack: 95, ttr: 55, what: "Ticket-routed overnight" },
    { id: "INC-403", sev: 1, ack: 2, ttr: 95, what: "Region failover" },
    { id: "INC-404", sev: 3, ack: 25, ttr: 41, what: "Search index lag" },
    { id: "INC-405", sev: 2, ack: 6, ttr: 1320, what: "Silent data corruption" },
    { id: "INC-406", sev: 3, ack: 9, ttr: 30, what: "Cache eviction storm" },
    { id: "INC-407", sev: 2, ack: 3, ttr: 62, what: "Dependency timeout" },
    { id: "INC-408", sev: 1, ack: 1, ttr: 48, what: "Checkout deploy rollback" }
  ];

  function mean(a) { if (!a.length) return 0; var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s / a.length; }
  function median(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  Widgets.bcMttx = function (mount) {
    shell(mount, "analysis", "MTTA / MTTR explorer",
      "Eight synthetic incidents from one quarter. Switch between mean and median and filter by severity. One slow data-corruption incident dominates the mean, which is the whole point: the headline number moves for reasons that say nothing about typical response.");
    var st = { stat: "mean", sev: 0 };
    var controls = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    controls.appendChild(segment([["mean", "mean"], ["median", "median"]], 0, function (v) { st.stat = v; paint(); }));
    controls.appendChild(segment([[0, "all"], [1, "SEV1"], [2, "SEV2"], [3, "SEV3"]], 0, function (v) { st.sev = v; paint(); }));

    function paint() {
      var rows = [], i;
      for (i = 0; i < INCIDENTS.length; i++) if (!st.sev || INCIDENTS[i].sev === st.sev) rows.push(INCIDENTS[i]);
      var acks = [], ttrs = [], maxT = 1, total = 0, longest = null;
      for (i = 0; i < rows.length; i++) {
        acks.push(rows[i].ack); ttrs.push(rows[i].ttr); total += rows[i].ttr;
        if (rows[i].ttr > maxT) maxT = rows[i].ttr;
        if (!longest || rows[i].ttr > longest.ttr) longest = rows[i];
      }
      var f = st.stat === "mean" ? mean : median;
      var other = st.stat === "mean" ? median : mean;

      clear(stage);
      for (i = 0; i < rows.length; i++) {
        var r = rows[i], isMax = r === longest && rows.length > 1;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:72px 44px 1fr 70px;gap:8px;align-items:center;padding:3px 0;font-size:0.82rem" },
          h("span", { style: "font-family:var(--font-mono);color:var(--text)" }, r.id),
          h("span", { style: "color:var(--text-dim)" }, "SEV" + r.sev),
          h("span", { title: r.what, style: "display:block;height:10px;background:var(--surface-solid);border-radius:6px;overflow:hidden" },
            h("i", { style: "display:block;height:100%;width:" + Math.max(1, Math.round(r.ttr / maxT * 100)) + "%;background:" + (isMax ? "var(--rose)" : "var(--cyan)") })),
          h("span", { style: "font-family:var(--font-mono);color:var(--text)" }, mins(r.ttr))));
      }
      stage.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-top:6px" }, "bars = time to restore; rose = the longest incident in the current filter"));

      var rest = [];
      for (i = 0; i < rows.length; i++) if (rows[i] !== longest) rest.push(rows[i].ttr);
      clear(readout);
      readout.appendChild(ro("incidents", rows.length));
      readout.appendChild(ro("MTTA (" + st.stat + ")", mins(f(acks))));
      readout.appendChild(ro("MTTR (" + st.stat + ")", mins(f(ttrs))));
      readout.appendChild(ro("MTTR (" + (st.stat === "mean" ? "median" : "mean") + ")", mins(other(ttrs))));
      readout.appendChild(ro("longest incident share of repair time", total ? Math.round((longest ? longest.ttr : 0) / total * 100) + "%" : "0%"));
      readout.appendChild(ro("mean MTTR without the longest", rest.length ? mins(mean(rest)) : "n/a (single incident)"));
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
    "inc-response": {
      title: "Incident response checkpoint",
      sub: "Severity, roles, communication and mitigation.",
      questions: [
        {
          q: "When should you declare an incident?",
          options: ["Only once the root cause is known", "Only when a senior leader asks for one", "After an hour of confirmed impact", "As soon as impact plausibly meets your severity criteria; downgrading or closing later is cheap"],
          answer: 3,
          explain: "Declaring early buys coordination, communication and the right people before the damage compounds. A false alarm costs a few minutes and a closed channel; a late declaration costs the first, most valuable half hour."
        },
        {
          q: "What is the incident commander's main job?",
          options: ["Typing the fix, since they are usually the most senior engineer", "Coordinating: owning decisions, assigning roles and setting the update cadence, while staying out of hands-on debugging", "Writing the postmortem alone afterwards", "Talking to every customer directly"],
          answer: 1,
          explain: "An IC who debugs stops seeing the whole incident: nobody tracks parallel workstreams, decisions stall and updates slip. The IC delegates the technical work to an ops lead and subject experts and keeps the response moving."
        },
        {
          q: "A SEV1 started two minutes after a deploy. What should happen first?",
          options: ["Roll back the deploy to restore service, then investigate the cause", "Read the diff until the bug is found", "Wait for the change author to come online", "Write and ship a forward fix"],
          answer: 0,
          explain: "A rollback to a known-good version is the fastest, best-understood way to stop the bleeding. Root cause can be found afterwards with the system healthy; a forward fix under pressure risks a second incident."
        },
        {
          q: "Which status update is best?",
          options: ["A detailed list of every hypothesis the team is testing", "\"We are looking into it.\"", "Current user impact, what is being done, and when the next update will be sent", "The names of the engineers whose change caused the problem"],
          answer: 2,
          explain: "Stakeholders need impact, action and a promise of the next update, so they can plan and stop asking. Speculation creates confusion, an empty update creates more questions and naming people breaks blameless culture."
        },
        {
          q: "What does the scribe do?",
          options: ["Keeps a timestamped log of observations, decisions and actions in the incident channel", "Handles press and social media", "Approves every rollback", "Implements the fix"],
          answer: 0,
          explain: "The scribe's log becomes the backbone of the postmortem timeline and lets newcomers catch up without interrupting. Decisions stay with the IC, external communication with the comms lead."
        },
        {
          q: "What does shedding load mean during an incident?",
          options: ["Adding more servers until the problem disappears", "Deleting old data to free resources", "Restarting every pod at once", "Deliberately rejecting or degrading lower-priority traffic so that critical requests keep succeeding"],
          answer: 3,
          explain: "When demand exceeds what a struggling system can serve, serving everyone badly fails everyone. Rejecting background, bot or non-critical requests early keeps checkout or login working while capacity recovers."
        }
      ]
    },
    "inc-learning": {
      title: "Learning from incidents checkpoint",
      sub: "Blameless postmortems, action items and incident metrics.",
      questions: [
        {
          q: "What does \"blameless\" mean in a postmortem?",
          options: ["Nobody is accountable for anything", "The timeline must never mention a person", "The review asks how the system and context made each action seem reasonable at the time, so people share full detail without fear", "Blame moves to the vendor instead of the team"],
          answer: 2,
          explain: "Blameless is about incentives: if honesty is punished, people hide the details you need. Accountability remains for fixing the system; what disappears is punishment for decisions that were reasonable given what was known."
        },
        {
          q: "Why prefer contributing factors over a single root cause?",
          options: ["Complex failures need several conditions at once, and listing them gives several places to intervene", "It makes the document shorter", "Auditors forbid the phrase root cause", "It removes the need for action items"],
          answer: 0,
          explain: "A deploy bug, a missing check, a stale alert and a confusing dashboard often combine to make an outage. Stopping at one root cause fixes one of them and leaves the others waiting for the next trigger."
        },
        {
          q: "Which is the best postmortem action item?",
          options: ["Be more careful when deploying", "Add a pre-deploy check that rejects configs with zero replicas; owner: payments-platform; due 15 Dec; tracked in the team backlog", "Improve monitoring", "Retrain the engineer who deployed"],
          answer: 1,
          explain: "A good action item is specific, has one owner and a date, and lives in the same tracker as normal work. Vague items never close and retraining a person targets the human rather than the system that allowed the mistake."
        },
        {
          q: "Why report the median rather than the mean MTTR for a quarter with eight incidents?",
          options: ["The median is always larger and therefore more conservative", "The mean cannot be computed for small samples", "The median automatically excludes low-severity incidents", "One very long incident dominates the mean, so the median plus the full distribution describes typical response better"],
          answer: 3,
          explain: "Incident durations are heavily skewed. A single 22-hour incident can quadruple the mean while the typical incident is unchanged; the median resists that, and showing the outliers separately keeps them visible."
        },
        {
          q: "What is the main risk of setting \"fewer incidents per quarter\" as a team target?",
          options: ["It improves reliability automatically", "It encourages under-declaring and downgrading incidents, so the number improves while learning gets worse", "It makes postmortems longer", "It increases the number of pages"],
          answer: 1,
          explain: "When a count becomes a goal, people change what they count. Teams stop declaring borderline incidents, which removes coordination and postmortems exactly where they were needed; SLO attainment is a better outcome measure."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.inc = {
    id: "inc",
    name: "Incident Management & Postmortems",
    short: "INC",
    tagline: "Declare early, mitigate first, learn without blame",
    color: "#f472b6",
    blurb: "Run incidents as a practised routine: classify severity with a matrix, declare early, staff the incident commander, ops, comms and scribe roles, and send updates on a cadence. Restore service first with rollbacks, flags, failover and load shedding, then learn: blameless postmortems built on contributing factors, action items that actually close, and incident metrics that do not lie.",
    modules: [
      {
        id: "response",
        name: "Incident response",
        icon: "compass",
        lessons: [
          {
            id: "severity",
            title: "Severity levels and declaring early",
            summary: "A severity matrix everyone can apply in thirty seconds, and why declaring early is cheap.",
            minutes: 10,
            tags: ["incident", "severity", "declaration"],
            blocks: [
              { t: "p", html: "Severity is a shared shortcut. One word, <em>SEV2</em>, tells everyone how many people to wake, how often to update and whether a postmortem is owed. It only works if the definition is written down and based on <strong>observable impact</strong>, not on how loud the reporter is." },
              { t: "table", headers: ["Level", "Typical criteria", "Response"], rows: [
                ["SEV1", "Most users or a core journey down; confirmed data loss with exposure; security breach", "All hands: IC, ops lead, comms lead, exec notified; updates every 30 min"],
                ["SEV2", "Significant share of users degraded; revenue path impaired; data loss contained", "IC + on-call + experts; updates hourly; postmortem required"],
                ["SEV3", "Small share of users or a non-critical feature degraded; workaround exists", "On-call handles, business hours acceptable; postmortem optional"],
                ["SEV4", "No user impact yet; risk identified (e.g. redundancy lost)", "Ticket; fix in normal work"]
              ] },
              { t: "widget", id: "bcSeverity" },
              { t: "h", text: "Declare early, adjust freely" },
              { t: "ul", items: [
                "Declare as soon as impact <em>plausibly</em> meets a level. You can downgrade in five minutes; you cannot buy back the first thirty.",
                "Anyone can declare. Requiring permission to declare guarantees late declarations.",
                "Severity can change during the incident; announce every change in the incident channel.",
                "When two levels seem to fit, pick the higher one and revisit at the next update."
              ] },
              { t: "compare",
                bad: { title: "Late, political declaration", items: ["Wait for root cause before declaring", "Severity negotiated by seniority", "No incident because it might look bad", "Customers report it first"] },
                good: { title: "Early, criteria-based declaration", items: ["Declare on plausible impact", "Severity read from the matrix", "False alarms closed without blame", "Coordination starts in minutes"] } },
              { t: "p", html: "The trade-off: declaring early means some incidents turn out to be nothing, which costs a little attention. That cost is small and predictable; under-declaring costs unpredictable, sometimes enormous, damage. Track the false-declaration rate only to improve the matrix, never to discourage declaring." },
              { t: "note", variant: "tip", html: "Security incidents follow the same severity logic but add a parallel security response, evidence preservation and often legal involvement. For how detections feed that process, see <a href='../cyber-academy/index.html#/defense/detect/logging-siem'>Citadel: Logging and SIEM</a>." },
              { t: "note", variant: "trap", html: "Severity by revenue alone hides incidents that hurt trust without hurting today's revenue, such as data exposure or a broken login for free users. Keep data and security criteria in the matrix explicitly." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I would define severity by observable user impact with explicit data and security escalators, let anyone declare, and treat downgrading as normal rather than as a failure.</em>" },
              { t: "note", variant: "key", html: "<strong>Severity is a written matrix, not a mood.</strong> Base it on user impact, let data loss and security only raise it, and declare as soon as impact is plausible." }
            ]
          },
          {
            id: "ics-roles",
            title: "Incident command roles",
            summary: "Incident commander, ops lead, comms lead, scribe and subject experts, and why they are separate.",
            minutes: 10,
            tags: ["incident", "roles", "incident-command"],
            blocks: [
              { t: "p", html: "Incidents fail in a predictable way: everyone debugs, nobody coordinates. Borrowing from emergency-services incident command, you separate <strong>deciding</strong>, <strong>doing</strong> and <strong>telling</strong> into distinct roles, so each gets someone's full attention." },
              { t: "diagram", id: "incident-roles", caption: "The incident commander coordinates; the ops lead directs hands-on work with subject experts; the comms lead handles stakeholders; the scribe records everything." },
              { t: "table", headers: ["Role", "Owns", "Does not"], rows: [
                ["Incident commander (IC)", "Decisions, priorities, role assignment, update cadence, declaring resolution", "Debug or type commands"],
                ["Ops lead", "Technical investigation and mitigation; directs subject experts", "Talk to executives mid-mitigation"],
                ["Comms lead", "Status updates, stakeholder questions, status page", "Speculate about cause"],
                ["Scribe", "Timestamped log of observations, decisions, actions", "Filter what seems unimportant"],
                ["Subject-matter experts", "Deep knowledge of a component; execute assigned tasks", "Start uncoordinated changes"]
              ] },
              { t: "ul", items: [
                "<strong>Small incidents</strong>: one on-call person holds IC and ops lead; still name the IC explicitly.",
                "<strong>SEV1/SEV2</strong>: separate the IC from the ops lead at minimum, and add a comms lead once stakeholders start asking.",
                "The IC announces role assignments in the channel: <em>I am IC, Priya is ops lead, Sam is comms.</em>",
                "Handing over IC is explicit: <em>You are now IC</em>, acknowledged, and logged by the scribe.",
                "Every change to production during the incident goes through the ops lead, so two people never fix the same thing in opposite directions."
              ] },
              { t: "table", headers: ["Tier", "Incident structure", "What happens"], rows: [
                ["Naive", "Everyone joins a call and debugs", "Parallel conflicting changes, no updates, nobody decides"],
                ["Solid", "Named IC and ops lead, one channel, regular updates", "Clear decisions, fewer collisions"],
                ["Standout", "Full roles for SEV1/2, trained IC rotation, explicit handovers, scribe log feeds the postmortem", "Response quality no longer depends on who happens to be online"]
              ] },
              { t: "h", text: "The incident commander's first five minutes" },
              { t: "code", lang: "text", code:
                "IC script (say it in the channel, the scribe logs it)\n" +
                "1. \"I am IC for this incident. Severity is SEV2 until we know more.\"\n" +
                "2. \"Ops lead: Priya. Comms: Sam. Scribe: Lee.\"\n" +
                "3. \"Current impact: ~18% checkout failures, EU only, since 13:58.\"\n" +
                "4. \"Priya, first question: what changed in the last two hours?\"\n" +
                "5. \"Sam, first update to #status-internal by 14:15, then every 30 minutes.\"\n" +
                "6. \"Everyone else: stay in the thread, no production changes without Priya.\"\n" +
                "Every 10-15 min: re-state impact, hypotheses, current action, next decision point."
              },
              { t: "p", html: "Notice what the IC asks rather than does: they turn the crowd into a small set of owned questions, set a clock for the next decision, and keep checking whether the severity still fits. If the incident grows (more services, customers noticing, data at risk) the IC raises the severity and pulls in more roles; if it shrinks they release people back to normal work." },
              { t: "p", html: "The trade-off: roles cost people. Pulling a strong engineer into IC removes them from debugging. That is the point: one person seeing the whole board is worth more than one more person staring at logs." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>The first thing I do as IC is name the roles and the next update time, then convert the debugging crowd into two or three owned questions, starting with what changed.</em>" },
              { t: "note", variant: "tip", html: "For the leadership side of running incidents across teams and with executives, see <a href='../techno-managerial-academy/index.html#/hld/operations/incident-hld'>TechLead: Incident leadership</a>." },
              { t: "note", variant: "warn", html: "The most senior engineer is often the worst IC choice, because they are the most valuable debugger and the most tempted to grab the keyboard. Train ICs as a rotation so the role does not default to rank." },
              { t: "note", variant: "key", html: "<strong>Separate deciding, doing and telling.</strong> A named incident commander who never debugs is what turns a crowd on a call into a response." }
            ]
          },
          {
            id: "comms",
            title: "Incident communication",
            summary: "Update cadence, a status template and tailoring messages to each audience.",
            minutes: 9,
            tags: ["incident", "communication", "status"],
            blocks: [
              { t: "p", html: "During an incident, silence is interpreted as either incompetence or catastrophe. Regular updates, even when nothing changed, buy you the quiet you need to work. The rule: <strong>always say when the next update is coming, and keep that promise.</strong>" },
              { t: "table", headers: ["Severity", "Internal update", "External status page", "Executive summary"], rows: [
                ["SEV1", "Every 30 min", "Within 15 min of declaring, then every 30–60 min", "At declaration and every hour"],
                ["SEV2", "Every 60 min", "If customers can notice", "At declaration and resolution"],
                ["SEV3", "At milestones", "Usually not", "No"],
                ["SEV4", "In the ticket", "No", "No"]
              ] },
              { t: "code", lang: "text", code:
                "[SEV2] Checkout errors — update #3 — 14:40 UTC\n" +
                "Impact:   About 18% of checkout attempts fail in the EU region. Other regions normal.\n" +
                "Status:   Mitigating. Traffic is being shifted to a healthy region; errors are falling.\n" +
                "Actions:  Rollback of the 13:55 pricing deploy is complete. Failover 60% done.\n" +
                "Asks:     Support: tell affected customers to retry; no data has been lost.\n" +
                "Next:     Update at 15:10 UTC or sooner if impact changes.\n" +
                "IC: Priya   Comms: Sam   Channel: #inc-2026-10-28-checkout"
              },
              { t: "table", headers: ["Audience", "Wants", "Avoid"], rows: [
                ["Responders", "Facts, decisions, assignments", "Repeating stakeholder questions into the working channel"],
                ["Support and account teams", "Impact, workaround, what to tell customers", "Internal jargon and component names"],
                ["Executives", "Business impact, ETA confidence, decisions needed from them", "Hypotheses presented as facts"],
                ["Customers (status page)", "Is it me, what is affected, when will I hear more", "Blame on a vendor or person; premature promises"]
              ] },
              { t: "compare",
                bad: { title: "Updates that create work", items: ["\"Investigating\" with no next-update time", "Guessing at root cause", "Stakeholders ask in the working channel", "ETA promised and missed"] },
                good: { title: "Updates that buy quiet", items: ["Impact, status, actions, next-update time", "Facts only; unknowns stated as unknown", "Separate channel for stakeholders", "Confidence stated instead of a hard ETA"] } },
              { t: "h", text: "The customer-facing version" },
              { t: "p", html: "The status page is a different document from the internal update. It is written for someone who does not know your architecture and is deciding whether to wait, retry or call support. Keep it short, plain and honest about what is unknown." },
              { t: "code", lang: "text", code:
                "status.shop.example — Investigating — 14:12 UTC\n" +
                "Some customers in Europe may see errors when completing checkout.\n" +
                "Browsing and existing orders are not affected. We are working on a fix\n" +
                "and will update this page by 14:45 UTC.\n" +
                "\n" +
                "Resolved — 15:02 UTC\n" +
                "Checkout errors in Europe between 13:58 and 14:51 UTC have been resolved.\n" +
                "Orders placed during this time that showed an error were not charged."
              },
              { t: "p", html: "Pre-write templates for the common states (investigating, identified, monitoring, resolved) and pre-agree who can publish without approval. Waiting forty minutes for legal sign-off on <em>we are investigating</em> is a communication failure of its own." },
              { t: "p", html: "The trade-off: a comms lead is one more person off the technical work, and frequent updates take time to write. For SEV1 and SEV2 that time is repaid many times over in interruptions that never happen." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>Every update carries impact, status, actions and a next-update time; I keep stakeholders in a separate channel and publish customer updates from pre-approved templates.</em>" },
              { t: "note", variant: "trap", html: "Never give an ETA you cannot defend. Say <em>we expect recovery within the hour if the failover completes; next update 15:10</em> rather than <em>fixed by 15:00</em>." },
              { t: "note", variant: "key", html: "<strong>Impact, status, actions, next update — every time, on time.</strong> Predictable communication is what lets responders keep working." }
            ]
          },
          {
            id: "mitigation-first",
            title: "Mitigate first, root-cause later",
            summary: "Stop the user impact with rollbacks, flags, failover and load shedding before you diagnose.",
            minutes: 10,
            tags: ["incident", "mitigation", "rollback"],
            blocks: [
              { t: "p", html: "During an incident your goal is to <strong>end user impact</strong>, not to understand the bug. Those are different jobs. Mitigation is usually generic and fast; diagnosis is specific and slow. Do the fast one first." },
              { t: "table", headers: ["Lever", "Use when", "Speed", "Risk"], rows: [
                ["Roll back the deploy", "Impact started near a release", "Minutes", "Low if the previous version is known good and schemas are compatible"],
                ["Disable a feature flag", "A new code path is failing", "Seconds", "Low; feature unavailable"],
                ["Fail over / drain a region or zone", "Damage is localised", "Minutes", "Capacity in the remaining region must cover the load"],
                ["Shed load or rate-limit", "Demand exceeds what the system can serve", "Minutes", "Some users rejected on purpose"],
                ["Scale out", "Resource saturation with healthy code", "Minutes", "Does not help if the bottleneck is shared, such as one database"],
                ["Block a bad client or input", "A single caller or payload triggers failure", "Minutes", "Collateral if the block is too broad"]
              ] },
              { t: "ol", items: [
                "What changed? Check deploys, flags and config changes in the last few hours.",
                "If something changed and the timing fits, reverse it. Do not wait for proof.",
                "If damage is local, move traffic away from it.",
                "If the system is overloaded, shed the least important traffic.",
                "Once impact is stopped, declare mitigated, keep monitoring, then start diagnosis."
              ] },
              { t: "code", lang: "bash", code:
                "# Typical first moves, each reversible\n" +
                "kubectl -n shop rollout undo deployment/checkout          # back to the previous ReplicaSet\n" +
                "flagctl set checkout.new-pricing=false --env prod          # turn off the new path\n" +
                "trafficctl drain --region eu-1 --service checkout          # move users to healthy regions\n" +
                "ratelimit set --service search --class bot --limit 0       # shed non-critical traffic"
              },
              { t: "compare",
                bad: { title: "Diagnose first", items: ["Read the diff while errors climb", "Wait for the author", "Forward-fix under pressure", "Two hours of impact for a ten-minute fix"] },
                good: { title: "Mitigate first", items: ["Roll back on suspicion", "Flags and drains as first moves", "Diagnose on a healthy system", "Root cause found calmly, afterwards"] } },
              { t: "p", html: "The trade-off: mitigation can destroy evidence. A rollback or restart clears the broken state you might want to inspect. Capture what is cheap first (a heap dump, a log snapshot, a copy of the bad config) in parallel, but never let evidence collection delay mitigation of a SEV1." },
              { t: "p", html: "Every mitigation needs a <strong>verification step</strong>. Watch the SLI that paged you, not a proxy: the error ratio back under the SLO for several minutes, burn-rate alerts resolved, and no new alerts elsewhere (a failover can move the problem). Only then declare the incident mitigated and lower the update cadence." },
              { t: "note", variant: "tip", html: "Practise this under time pressure in the <a href='#/simulator'>incident simulator</a>: pick the right mitigation lever before diagnosing and watch the impact curve respond." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I ask what changed, reverse it on suspicion if the timing fits, and verify recovery on the paging SLI before anyone starts root-cause work.</em>" },
              { t: "note", variant: "warn", html: "Rollbacks are only safe if releases are backwards compatible. A deploy that ran an irreversible schema migration may not roll back cleanly; that is why expand-then-contract migrations exist." },
              { t: "quiz", id: "inc-response" },
              { t: "note", variant: "key", html: "<strong>Stop the bleeding, then find the cause.</strong> Reverse recent change, move traffic, shed load — all before you understand the bug." }
            ]
          }
        ]
      },
      {
        id: "learning",
        name: "Learning from incidents",
        icon: "map",
        lessons: [
          {
            id: "blameless-postmortems",
            title: "Blameless postmortems",
            summary: "Structure, facilitation and contributing factors instead of a single root cause.",
            minutes: 11,
            tags: ["postmortem", "blameless", "learning"],
            blocks: [
              { t: "p", html: "A postmortem exists to make the next incident less likely or less damaging. It only works if people tell the whole truth, including the parts where they made a call that turned out badly. <strong>Blameless</strong> means you ask <em>why did this action make sense at the time?</em> instead of <em>who did this?</em>" },
              { t: "ol", items: [
                "<strong>Summary</strong>: what happened, user impact, duration, severity, in five lines.",
                "<strong>Impact</strong>: users affected, SLO budget consumed, data, revenue, support load.",
                "<strong>Timeline</strong>: timestamped from the first trigger to resolution, built from the scribe's log.",
                "<strong>Contributing factors</strong>: technical, process and organisational conditions that combined.",
                "<strong>What went well, what went poorly, where we got lucky.</strong>",
                "<strong>Action items</strong>: owned, dated, tracked.",
                "<strong>Open questions</strong>: what we still do not understand."
              ] },
              { t: "table", headers: ["Single root cause", "Contributing factors"], rows: [
                ["\"An engineer pushed a bad config.\"", "Config had no schema validation; the deploy tool allowed zero replicas; canary was skipped for config changes; the alert fired 20 minutes late"],
                ["Ends at the first human action", "Continues to ask why that action was possible and why it was not caught"],
                ["One fix", "Several independent fixes, each reducing risk"],
                ["Invites blame", "Invites system improvement"]
              ] },
              { t: "compare",
                bad: { title: "Blame-seeking review", items: ["Starts from who", "Ends at human error", "People share less next time", "Same failure repeats with a different person"] },
                good: { title: "Blameless review", items: ["Starts from what and how", "Treats human error as a symptom of the system", "Full detail shared freely", "Multiple safeguards added"] } },
              { t: "table", headers: ["Trigger", "Postmortem?"], rows: [
                ["Any SEV1 or SEV2", "Required, reviewed within five working days"],
                ["One incident consumed more than 20% of the monthly error budget", "Required"],
                ["Data loss or a security-relevant event", "Required, with the security team"],
                ["Manual intervention was needed by on-call to avoid impact (a near miss)", "Recommended \u2014 near misses are cheap lessons"],
                ["SEV3 with a novel failure mode", "Lightweight template"]
              ] },
              { t: "code", lang: "text", code:
                "Timeline excerpt (UTC) \u2014 facts, not judgements\n" +
                "13:55  pricing-config change merged; CI passed (no schema check exists)\n" +
                "13:58  checkout 5xx ratio rises from 0.1% to 18%\n" +
                "14:04  fast burn-rate alert pages primary on-call\n" +
                "14:06  page acknowledged; SEV2 declared, IC + comms assigned\n" +
                "14:17  config change identified as likely trigger via deploy log\n" +
                "14:21  config reverted; errors fall to 0.2% by 14:24\n" +
                "14:34  recovery verified on SLI; incident mitigated"
              },
              { t: "p", html: "Write the timeline as observations and decisions with timestamps, and include what responders believed at each point. <em>14:12 \u2014 team suspected the database because latency rose</em> is valuable: it shows which signals misled people, which is often the best action item of all." },
              { t: "h", text: "Running the review" },
              { t: "ul", items: [
                "Hold it within about five working days, while memory is fresh.",
                "A facilitator who was not deeply involved runs it; the IC and responders contribute.",
                "Read the timeline together before discussing causes.",
                "Ban counterfactual phrasing like <em>should have</em>; ask what information people had.",
                "Publish widely; postmortems hidden in a team folder teach one team."
              ] },
              { t: "note", variant: "tip", html: "Run a full incident in the <a href='#/simulator'>incident simulator</a>, then write its postmortem using this structure. Practising on a synthetic incident makes the first real one far easier." },
              { t: "p", html: "The trade-off: thorough postmortems take hours from several people. Require them for SEV1 and SEV2, make them optional for SEV3, and keep a lightweight template so the cost matches the incident." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I would run a blameless review that lists contributing factors across technology, process and organisation, and I would expect several action items rather than one root-cause fix.</em>" },
              { t: "note", variant: "key", html: "<strong>Ask how the system made the mistake easy, not who made it.</strong> Contributing factors give you several places to intervene; blame gives you silence next time." }
            ]
          },
          {
            id: "action-items",
            title: "Action items that actually close",
            summary: "Specific, owned, dated and tracked — and balanced across prevent, detect and mitigate.",
            minutes: 9,
            tags: ["postmortem", "action-items", "follow-up"],
            blocks: [
              { t: "p", html: "A postmortem without completed action items is a story, not an improvement. Most organisations do not fail at writing action items; they fail at finishing them. Design the items so they can be finished." },
              { t: "table", headers: ["Tier", "Action item", "Why it scores that way"], rows: [
                ["Naive", "\"Be more careful with config changes.\"", "Not specific, no owner, impossible to verify"],
                ["Solid", "\"Add schema validation to the config repo CI.\" Owner: platform team. Due: 30 Nov.", "Specific, owned, dated"],
                ["Standout", "Solid, plus: a ticket in the team backlog, a priority agreed with the product owner, and a check in the next postmortem review that it shipped", "Tracked like product work and verified done"]
              ] },
              { t: "ul", items: [
                "<strong>Specific</strong>: someone else could tell when it is done.",
                "<strong>Measurable</strong>: a check, a test, a metric, not a feeling.",
                "<strong>Achievable</strong>: weeks of work, not a quarter-long rewrite hidden in one line.",
                "<strong>Relevant</strong>: tied to a listed contributing factor.",
                "<strong>Time-bound</strong>: has a due date and one named owner (a person or a team with a lead)."
              ] },
              { t: "table", headers: ["Category", "Example", "Reduces"], rows: [
                ["Prevent", "Reject configs with zero replicas in CI", "Likelihood"],
                ["Detect", "Burn-rate alert on checkout errors", "Detection time"],
                ["Mitigate", "One-command regional drain in the runbook", "Repair time"],
                ["Process", "Canary applies to config changes too", "Likelihood and blast radius"]
              ] },
              { t: "code", lang: "text", code:
                "Postmortem action tracking (reviewed monthly)\n" +
                "ID      Item                                   Owner            Due     Status\n" +
                "AI-118  Schema validation for pricing config   platform-team    30 Nov  in progress\n" +
                "AI-119  Burn-rate alert for checkout           payments-sre     15 Nov  done\n" +
                "AI-120  Canary for config pushes               release-eng      15 Dec  not started\n" +
                "Overdue items: 0   Completion within due date (last quarter): 78%"
              },
              { t: "note", variant: "warn", html: "Watch the overdue list, not the created list. A team that writes ten items per postmortem and closes two is generating guilt, not reliability. Fewer, higher-leverage items beat long wish lists." },
              { t: "h", text: "Keeping items alive after the meeting" },
              { t: "ul", items: [
                "File every item in the owning team's normal backlog, not a separate postmortem tracker nobody opens.",
                "Tag items with the incident id so you can query completion per incident and per team.",
                "Review the overdue list in a recurring operations review; an item twice overdue is re-scoped or explicitly dropped with a reason.",
                "When the same contributing factor appears in a second postmortem, escalate the open item's priority rather than writing a new one.",
                "Close the loop: the postmortem doc links each item and shows its final status."
              ] },
              { t: "p", html: "The trade-off: action items compete with roadmap work. If they never get prioritised, the <a href='#/slo/budgets/budget-policy'>error budget policy</a> is the lever: an exhausted budget is the agreed signal that reliability work comes first." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I want few action items, each tied to a contributing factor, owned by one team, dated, tracked in their backlog, and reviewed until done \u2014 and I measure completion rate, not item count.</em>" },
              { t: "note", variant: "key", html: "<strong>One owner, one date, one tracker.</strong> Balance prevent, detect and mitigate items, and measure completion, not creation." }
            ]
          },
          {
            id: "incident-metrics",
            title: "Incident metrics and their pitfalls",
            summary: "MTTA, MTTR and friends: what they measure, how they mislead and what to use instead.",
            minutes: 11,
            tags: ["incident", "metrics", "mttr"],
            blocks: [
              { t: "p", html: "Incident metrics are tempting because they turn messy events into one number. The danger is that the number is noisy, skewed and easy to game. Use them to ask questions, not to set targets." },
              { t: "table", headers: ["Metric", "Measures", "Watch out for"], rows: [
                ["MTTD (detect)", "Impact start to detection", "Impact start is often estimated after the fact"],
                ["MTTA (acknowledge)", "Page to human acknowledgement", "Quick acks without action look great"],
                ["MTTR (restore)", "Impact start (or detection) to service restored", "Definitions differ: restore, repair, resolve"],
                ["MTBF (between failures)", "Time between incidents", "Depends on what you choose to declare"],
                ["Incident count", "Number of declared incidents", "Falls when people stop declaring"]
              ] },
              { t: "widget", id: "bcMttx" },
              { t: "p", html: "In the explorer, the mean MTTR across all eight incidents is about 3.5 hours while the median is under an hour. One slow data-corruption incident accounts for most of the total repair time. Report the mean and you would conclude the team is slow; it is not, it had one hard incident." },
              { t: "h", text: "Why MTTR is a weak target" },
              { t: "ul", items: [
                "<strong>Skew</strong>: durations are long-tailed, so the mean is dominated by rare outliers.",
                "<strong>Small samples</strong>: with a handful of incidents per quarter, quarter-to-quarter changes are mostly noise.",
                "<strong>Mixed populations</strong>: a config rollback and a data corruption are not the same kind of event.",
                "<strong>Gaming</strong>: closing incidents early or splitting one into several makes the number look better.",
                "<strong>Counting incidents as a target</strong> discourages declaring, which removes coordination and learning exactly when they matter."
              ] },
              { t: "compare",
                bad: { title: "Metrics as targets", items: ["\"Cut MTTR by 20% this quarter\"", "\"Fewer than 5 incidents per quarter\"", "Single mean in a slide", "Teams compared on raw counts"] },
                good: { title: "Metrics as questions", items: ["Distribution and median, outliers listed", "SLO attainment and budget consumed as the outcome", "Trends over several quarters", "Each long incident studied individually"] } },
              { t: "table", headers: ["Instead of", "Report", "Because"], rows: [
                ["Mean MTTR", "Median plus the slowest incidents named", "Resistant to skew; outliers get attention"],
                ["Incident count", "Error budget consumed per service", "Measures user impact, not declaration habits"],
                ["MTTA alone", "Time to mitigation and pages per shift", "Ties response to outcome and to on-call load"],
                ["One number per quarter", "Rolling trend over a year", "Small samples need a longer view"]
              ] },
              { t: "note", variant: "trap", html: "If leadership asks for one incident number, give SLO attainment or error budget consumed. It reflects what users experienced and cannot be improved by declaring fewer incidents." },
              { t: "cue", html: "<strong>Interview cue:</strong> <em>I would report medians and distributions rather than mean MTTR, treat incident counts as a health signal rather than a goal, and anchor reliability reporting on SLO attainment.</em>" },
              { t: "quiz", id: "inc-learning" },
              { t: "note", variant: "key", html: "<strong>Incident metrics are skewed, small and gameable.</strong> Use medians and distributions to ask questions, and let SLO attainment be the number you actually manage." }
            ]
          }
        ]
      }
    ]
  };
})();
