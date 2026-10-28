/* =====================================================================
   TECHLEAD · Data Engineering Leadership track (curriculum + quizzes + widget)

   Self-contained: registers window.TRACKS.data, its data-* quizzes, and the
   reconciliation-bridge lab those lessons mount.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     WIDGET
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

  var Widgets = {};

  /* ---------------------------------------------------------------
     RECONCILIATION BRIDGE
     Finance says one number, the dashboard says another. Explain the
     gap one cause at a time and watch the unexplained residual shrink.
     --------------------------------------------------------------- */
  Widgets["tm-reconciliation"] = function (mount) {
    shell(mount, "lab", "Reconciliation bridge",
      "Finance reports 4,182,600. The dashboard says 4,061,450. Switch on each explanation you have actually verified \u2014 the number that matters is what is left over.");

    var FINANCE = 4182600;
    var CAUSES = [
      { id: "timing", label: "Timing cut-off", delta: 61200, why: "Finance closes at 23:59 in the reporting entity's timezone; the pipeline cuts at 00:00 UTC. One evening of orders lands on different days." },
      { id: "grain", label: "Definition / grain", delta: 38400, why: "Finance counts one row per invoice; the dashboard counts one row per order line. Multi-line orders are double-counted on one side." },
      { id: "scope", label: "Scope filter", delta: 14750, why: "The dashboard excludes internal test tenants; the finance extract does not filter them at all." },
      { id: "fx", label: "Currency conversion", delta: 5300, why: "Finance converts at the month-end rate; the pipeline converts at transaction date. Same money, two rates." },
      { id: "late", label: "Late adjustments", delta: 1500, why: "Credit notes raised after the pipeline ran are in the finance figure and not yet in the warehouse." }
    ];
    var on = { timing: false, grain: false, scope: false, fx: false, late: false };

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var running = FINANCE;
      var rows = [["Finance figure", "", running.toLocaleString()]];
      var explained = 0;
      CAUSES.forEach(function (c) {
        if (!on[c.id]) return;
        explained += c.delta;
        running -= c.delta;
        rows.push([c.label, "\u2212 " + c.delta.toLocaleString(), running.toLocaleString()]);
      });
      var residual = running - 4061450;
      rows.push(["Dashboard figure", "", (4061450).toLocaleString()]);

      stage.innerHTML = "";
      var t = h("table", { style: "width:100%;border-collapse:collapse;font-size:.72rem" });
      var hr = h("tr", {});
      ["Step", "Delta", "Running total"].forEach(function (x) {
        hr.appendChild(h("th", { style: "text-align:left;padding:5px 8px;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);border-bottom:1px solid var(--border)" }, x));
      });
      t.appendChild(hr);
      rows.forEach(function (r) {
        var tr = h("tr", {});
        r.forEach(function (cell, ci) {
          tr.appendChild(h("td", { style: "padding:6px 8px;border-bottom:1px solid var(--border);font-family:" + (ci ? "var(--font-mono)" : "inherit") + (ci === 0 ? ";font-weight:600" : ";color:var(--text-dim)") }, String(cell)));
        });
        t.appendChild(tr);
      });
      stage.appendChild(t);

      var openCause = null;
      for (var i = 0; i < CAUSES.length; i++) if (!on[CAUSES[i].id]) { openCause = CAUSES[i]; break; }
      stage.appendChild(h("p", { style: "margin-top:10px;font-size:.76rem;color:var(--text-dim)" },
        residual === 0
          ? h("span", {}, h("b", { style: "color:var(--accent-ink)" }, "Residual zero. "), "Every unit of the gap now has a named cause, which means you can tell the executive which parts are definitional and which are a defect. Nothing here required changing a single query.")
          : h("span", {}, h("b", { style: "color:var(--accent-ink)" }, "Unexplained: " + residual.toLocaleString() + ". "),
              openCause ? "Next candidate \u2014 " + openCause.label.toLowerCase() + ": " + openCause.why : "You have run out of explanations, so what remains is the actual bug.")));

      readout.innerHTML = "";
      readout.appendChild(ro("explained", explained.toLocaleString(), true));
      readout.appendChild(ro("unexplained residual", residual.toLocaleString()));
      readout.appendChild(ro("causes verified", Object.keys(on).filter(function (k) { return on[k]; }).length + " / 5"));
      readout.appendChild(ro("verdict", residual === 0 ? "fully bridged" : residual > 50000 ? "do not present this yet" : "narrowing"));
    }

    var controls = h("div", { class: "widget-controls" });
    CAUSES.forEach(function (c) {
      controls.appendChild(toggle(c.label, function () { return on[c.id]; }, function () { on[c.id] = !on[c.id]; paint(); }));
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
    "data-trust": {
      title: "Trust and quality checkpoint",
      sub: "Metric ownership, lineage, quality controls, and leading a data incident.",
      questions: [
        {
          q: "A VP says the dashboard disagrees with the finance extract. What do you do first?",
          options: [
            "Compare definition, grain, filters, time window and late adjustments before changing anything",
            "Rewrite the dashboard query against the finance source",
            "Escalate to the finance data owner",
            "Add a caveat to the dashboard while you investigate"
          ],
          answer: 0,
          explain: "Most of these escalations are two correct queries answering two different questions, so the first move is to establish what each number actually counts. Changing a query before you know that produces a figure that matches today and is wrong in a new way tomorrow. The caveat and the escalation both have their place, but after you know whether this is a definition gap or a defect."
        },
        {
          q: "Which field makes a metric definition usable by someone who did not write it?",
          options: [
            "The dashboard it appears on",
            "The refresh schedule",
            "The grain \u2014 what exactly one row or one data point represents",
            "The chart type"
          ],
          answer: 2,
          explain: "Grain is what tells a reader whether they may sum, average or filter the number without producing nonsense. Without it, two people can query the same table correctly and disagree, which is the origin of most reconciliation escalations. Schedule matters for freshness, and presentation matters not at all to correctness."
        },
        {
          q: "Counts reconcile perfectly between source and target, but monetary amounts differ for some partners. What does that pattern suggest?",
          options: [
            "Rows were dropped during the load",
            "A transformation or join is altering values \u2014 currency, rounding, or a fan-out that duplicates on one side",
            "The target table needs reindexing",
            "The source system is the one at fault"
          ],
          answer: 1,
          explain: "Equal counts mean nothing was lost or added at row level, so the defect is in what happened to the values along the way. Currency handling, rounding, and joins that multiply rows for some keys all produce exactly this signature. It is also why reconciling on counts alone is the classic false reassurance in a migration."
        },
        {
          q: "The daily revenue table is four hours late. What belongs in your first stakeholder update?",
          options: [
            "The root cause, as soon as you have identified it",
            "An apology and a commitment to prevent recurrence",
            "Which consumers and decisions are affected, the workaround, and the time of the next update",
            "The name of the upstream team responsible for the delay"
          ],
          answer: 2,
          explain: "Stakeholders need to know what they cannot do right now and when they will hear from you again \u2014 that is what lets them make their own calls instead of pinging you every ten minutes. Root cause is useful later and often wrong early. Naming another team in a first update reads as deflection whether or not it is accurate."
        },
        {
          q: "What is lineage most useful for in day-to-day leadership?",
          options: [
            "Producing a complete diagram of every table in the platform",
            "Answering who breaks if this column changes, in minutes rather than by asking around",
            "Proving to auditors that the platform is documented",
            "Choosing which datasets to deprecate"
          ],
          answer: 1,
          explain: "The practical value is blast radius on demand: change review and incident response both stall on not knowing who consumes a dataset. Exhaustive diagrams are expensive to maintain and usually stale exactly where you need them. Audit evidence and deprecation decisions are real benefits, but they are downstream of that first capability."
        }
      ]
    },

    "data-platform": {
      title: "Platform trade-offs checkpoint",
      sub: "Platform strategy, mesh against central ownership, batch against streaming, cost attribution, and governance that does not become a bottleneck.",
      questions: [
        {
          q: "Leadership asks for every dashboard to be real time. What is the strongest response?",
          options: [
            "Agree, and add streaming ingestion across the platform",
            "Decline, on the grounds that batch is more reliable",
            "Reduce all batch schedules to every five minutes",
            "Ask which decisions lose value while waiting, and make only those real time"
          ],
          answer: 3,
          explain: "\u201cReal time\u201d is a proxy for someone being blocked, and the useful question is which decisions actually decay in seconds \u2014 fraud holds and dispatch do, a quarter-close report does not. That question turns a platform-wide programme into a short list. Blanket agreement buys enormous operational cost for mostly cosmetic freshness, and blanket refusal loses you the conversation."
        },
        {
          q: "Warehouse spend jumps 40% after an analytics launch. What comes first?",
          options: [
            "Attribute the increase by workload, warehouse, user group and query pattern",
            "Reduce warehouse size and ask teams to run fewer queries",
            "Introduce a per-team query budget",
            "Move the heaviest tables to cheaper storage"
          ],
          answer: 0,
          explain: "Without attribution, every remedy is applied to the whole platform and lands hardest on whoever complains least, including the workloads you most wanted to protect. Attribution usually shows a small number of query patterns causing most of the increase, which makes the fix specific and cheap. Budgets and storage changes may follow, but they are choices you cannot make well while blind."
        },
        {
          q: "Which control most reduces sensitive-data exposure without slowing teams down?",
          options: [
            "Requiring a ticket for every new query",
            "Column masking and row policies enforced inside the platform",
            "A quarterly access review",
            "Restricting access to a central analytics team"
          ],
          answer: 1,
          explain: "Enforcement inside the platform applies to every consumer automatically, including the ones nobody remembered, and it costs analysts nothing at query time. Ticket queues and centralised access shift the cost onto delivery speed and reliably produce shadow copies of the data. Access reviews are necessary but periodic, so they catch drift rather than preventing exposure."
        },
        {
          q: "Which workload is the weakest candidate for streaming?",
          options: [
            "Fraud holds on card transactions",
            "Dispatch assignment for a delivery fleet",
            "The quarter-close revenue report",
            "Alerting on a production sensor threshold"
          ],
          answer: 2,
          explain: "The test is whether the value of the decision decays within seconds, and a quarter-close report is the opposite \u2014 correctness, reproducibility and replay matter far more than latency. The other three all involve a decision that is worthless if it arrives late. Streaming a close report buys you a faster wrong number and a harder audit."
        },
        {
          q: "A team's dashboard is slow and expensive because it scans a full history every load. Which change addresses the cause?",
          options: [
            "Give that warehouse more compute",
            "Cache the dashboard result for an hour",
            "Partition and cluster on the filtered columns so the engine can prune",
            "Move the dashboard to a different tool"
          ],
          answer: 2,
          explain: "The cost is the volume being read, so the only structural fix is making most of that volume skippable. More compute buys speed at proportionally more money and stops helping once the scan dominates. Caching helps the second viewer and does nothing for the first, and the tool is not what is reading the data."
        },
        {
          q: "A new head of data asks for a platform strategy. Which opening is strongest?",
          options: [
            "A comparison of the leading warehouse and lakehouse products",
            "A diagnosis of which decisions and products the platform must serve and where it fails them today, followed by a small set of supported paths and what will be retired",
            "A target architecture diagram covering every tool the team might need",
            "A survey of every team's preferred tools, adopted as the standard"
          ],
          answer: 1,
          explain: "A platform strategy starts from what the platform is for and where it is failing, because that is what makes the choices defensible \u2014 including the choice to retire tools. Tool comparisons and target diagrams answer how before why, and adopting everyone's preferences is a census rather than a strategy: it guarantees five ways to do everything and no paved road."
        },
        {
          q: "Leadership wants to move to a data mesh. Domains have no data engineers and publishing a dataset takes a ticket to the central team. What is the right call?",
          options: [
            "Reorganise into domain data teams immediately, since ownership drives quality",
            "Reject the idea \u2014 central teams are always more efficient",
            "Invest first in a self-serve platform and federated standards, pilot domain ownership with one or two domains that have capacity, and keep the central team for the rest",
            "Rename the central backlog into per-domain queues and call it a mesh"
          ],
          answer: 2,
          explain: "Domain ownership only works when domains have engineering capacity and publishing a governed dataset is cheap; without both, a reorganisation moves the bottleneck and lowers quality. A platform-first pilot tests the model where its preconditions hold. A blanket refusal ignores a real scaling problem, and renaming queues changes the labels without changing who owns anything."
        }
      ]
    },

    "data-governance": {
      title: "Governance and cutover checkpoint",
      sub: "Migration evidence, data contracts and ownership, metric contracts, and communicating confidence under pressure.",
      questions: [
        {
          q: "A new pipeline matches the old one on row counts but differs on aggregates. What is the right decision?",
          options: [
            "Cut over, because counts are the authoritative check",
            "Cut over for a pilot cohort and compare aggregates in production",
            "Cut over and schedule a backfill to correct the aggregates",
            "Hold, because an unexplained aggregate difference means the transformation is not yet proven"
          ],
          answer: 3,
          explain: "Matching counts prove nothing was lost or duplicated at row level; differing aggregates say the values themselves are being changed somewhere. Until you can name the cause \u2014 currency, rounding, a fan-out join \u2014 you do not know whether the difference is small or just the visible edge of something larger. A backfill promises to fix a defect you have not diagnosed."
        },
        {
          q: "A team wants to redefine \u201cactive customer\u201d. What makes the change safe?",
          options: [
            "Versioning the definition, keeping the old one available, and getting sign-off from the metric owner",
            "Announcing it in advance so consumers can adjust",
            "Updating every dashboard on the same day",
            "Adding a footnote explaining the new definition"
          ],
          answer: 0,
          explain: "A definition change breaks comparability with every report and commitment that used the old one, so consumers need a period where both exist and a named owner has agreed to the switch. Announcements and footnotes inform people without giving them a migration path. A same-day cutover across all dashboards guarantees that some historical comparison silently becomes wrong."
        },
        {
          q: "Amounts are under review during a reporting incident, but counts have reconciled. What should you tell an executive?",
          options: [
            "That the numbers are being investigated and you will report when complete",
            "Exactly that \u2014 counts reconciled, amounts still under review, and which decisions are therefore unsafe today",
            "A conservative estimate of the final figure so they can plan",
            "That the issue is minor and confined to a small number of partners"
          ],
          answer: 1,
          explain: "Stating what is known, what is not, and which decisions are blocked is what actually lets a leader act, and it is the part people withhold in an effort to look composed. A blanket \u201cinvestigating\u201d gives them nothing to work with. Offering an estimate you cannot support is how a data incident becomes a credibility incident, because that number will be quoted."
        },
        {
          q: "Which item is the weakest form of reconciliation evidence for a cutover?",
          options: [
            "Aggregate variance within a stated tolerance on monetary columns",
            "A screenshot of both dashboards showing similar figures",
            "Sampled rows checked against business rules by a person",
            "Row counts equal across seven consecutive runs"
          ],
          answer: 1,
          explain: "A screenshot proves two views looked alike at one moment, at whatever precision the chart rendered, with no record of what was filtered. The other three are repeatable checks with stated thresholds that another person could re-run. Visual comparison is the evidence people reach for when they want reassurance rather than proof."
        },
        {
          q: "What most reliably prevents the same metric dispute recurring every quarter?",
          options: [
            "A glossary page listing the definitions",
            "Restricting who can build dashboards",
            "More frequent reconciliation between finance and analytics",
            "Centrally owned definitions with a named owner, a regression test on known figures, and versioning on meaning changes"
          ],
          answer: 3,
          explain: "Disputes recur because the definition lives in several places at once, so any fix has to make one place authoritative and make drift detectable. An owner settles the question, a regression test on a known fixture catches silent change, and versioning keeps history comparable. A glossary documents intent without enforcing it, and restricting builders just moves the divergence into spreadsheets."
        },
        {
          q: "An upstream team renamed a column and three downstream dashboards broke silently over a weekend. Which change prevents the class of problem?",
          options: [
            "Ask upstream teams to announce schema changes in a shared channel",
            "Add more data tests to the downstream dashboards",
            "Make downstream teams copy the upstream data into their own tables",
            "A data contract owned by the producer \u2014 schema, meaning, freshness and a change policy \u2014 checked in the producer's CI, with a registered consumer list"
          ],
          answer: 3,
          explain: "The break happened because nothing stopped the producer from shipping an incompatible change, and nobody knew who depended on the column. A producer-owned contract checked in the producer's pipeline catches the rename before it merges, and the consumer list says who to talk to. Channel announcements rely on memory, downstream tests detect the damage after it happens, and private copies multiply the drift."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.data = {
    id: "data",
    name: "Data Engineering Leadership",
    short: "DATA",
    tagline: "Own the numbers people bet on",
    color: "#10b981",
    blurb: "Leading a data platform where trust, freshness, lineage, governance, cost and stakeholder confidence matter as much as the pipelines. Metric ownership and reconciliation, quality as an operating model, data incidents, the real-time question, cost attribution, governance without bottlenecks, and cutovers you can defend at quarter close.",
    modules: [
      {
        id: "trust",
        name: "Trust and Quality",
        icon: "database",
        lessons: [
          {
            id: "metric-ownership",
            title: "Metrics that decisions are made on",
            summary: "A trusted metric has a grain, an owner, a source of truth and a stated freshness \u2014 and most disagreements are definitional, not defects.",
            minutes: 10,
            tags: ["trust", "metrics"],
            blocks: [
              { t: "p", html: "The moment two people compare numbers and disagree, the instinct is to look for a bug. Resist it. <strong>Most of the time both queries are correct and they are answering different questions</strong>, and until you have established what each number counts, every fix you ship is a coincidence." },
              { t: "table",
                headers: ["Field", "Why it matters", "What goes wrong without it"],
                rows: [
                  ["Grain", "What exactly one row or one point represents", "Partner, order and customer totals get compared as if interchangeable"],
                  ["Owner", "Who decides what it means", "Dashboard politics: the loudest definition wins"],
                  ["Source of truth", "Which system is authoritative", "Two systems patch towards each other forever"],
                  ["Time window", "Cut-off, timezone, and business calendar", "One evening of activity lands on different days"],
                  ["Freshness", "How stale it may be and still be usable", "Stale gets reported as wrong, which burns the incident process"],
                  ["Late adjustments", "How corrections after the fact are handled", "Yesterday's number changes and nobody can explain why"]
                ]
              },
              { t: "widget", id: "tm-reconciliation" },
              { t: "h", text: "Running the reconciliation" },
              { t: "ul", items: [
                "<strong>Separate decision metrics from vanity metrics.</strong> If no decision changes when it moves, it does not deserve an incident process.",
                "<strong>Name a temporary source of truth on the call.</strong> Not the permanent answer \u2014 just something to reconcile against so the work can start.",
                "<strong>Build the bridge before you touch a query.</strong> Timing, definition, scope, currency, late adjustments, then residual. What is left over is the actual bug.",
                "<strong>Preserve the audit trail.</strong> If you change the semantic model mid-investigation, you have destroyed the ability to explain last month."
              ] },
              { t: "code", lang: "text", code:
                "Reconciliation bridge \u2014 the shape, always\n" +
                "\n" +
                "  finance figure                    4,182,600\n" +
                "    less timing cut-off (UTC vs local)  61,200\n" +
                "    less grain (invoice vs order line)  38,400\n" +
                "    less scope (test tenants excluded)  14,750\n" +
                "    less FX (month-end vs txn date)      5,300\n" +
                "    less late credit notes               1,500\n" +
                "  ------------------------------------------\n" +
                "  dashboard figure                  4,061,450\n" +
                "  residual                                  0\n" +
                "\n" +
                "A non-zero residual is the defect. Everything above it is a\n" +
                "definitional difference that needed explaining, not fixing."
              },
              { t: "note", variant: "trap", html: "<strong>Patching the query to match the number is the most tempting and most expensive move.</strong> It matches today, it is wrong in a new way next month, and you have thrown away the explanation you will need at the next close." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Can find and fix a discrepancy in a query."],
                  ["Senior", "Establishes definitions and grain first, builds a bridge, and communicates which parts are definitional."],
                  ["Staff", "Makes the class of dispute stop happening: an owned semantic layer, regression fixtures on finance-facing metrics, and versioning on meaning changes."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Whenever you hear <em>\u201cthe numbers don't match\u201d</em>, <em>\u201cfinance says something different\u201d</em>, or <em>\u201cthe dashboard is wrong\u201d</em>, the first question is never about SQL. It is: what does one row mean on each side?" },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Payout numbers differ across finance, sales and analytics. Lead the reconciliation in four sentences, naming what you would establish before writing any query." },
              { t: "note", variant: "key", html: "<strong>Build the bridge before you touch the query.</strong> Timing, grain, scope, currency and late adjustments explain most of any gap, and the residual after those is the only part that is actually a bug \u2014 which is also the only part worth an engineer's afternoon." }
            ]
          },
          {
            id: "lineage-impact",
            title: "Lineage for trust and impact",
            summary: "Lineage earns its cost when it answers who breaks if I change this \u2014 in minutes, on the critical path only.",
            minutes: 8,
            tags: ["trust", "lineage"],
            blocks: [
              { t: "p", html: "Lineage projects fail by aiming for completeness. The value is not a wall-sized diagram; it is <strong>being able to answer \u201cwho breaks if I change this column\u201d before you change it</strong>, and \u201cwho is affected\u201d during an incident. Both are minutes-scale questions, and both are answered by covering the critical path well rather than everything badly." },
              { t: "table",
                headers: ["Field you capture", "The question it answers"],
                rows: [
                  ["Source", "Where did this actually come from, originally"],
                  ["Transform", "What happened to the values on the way"],
                  ["Consumer", "Who breaks if I change it \u2014 the blast radius"],
                  ["Owner", "Who to tell, and who signs off on a change"],
                  ["SLA", "How urgent this is when it is late or wrong"]
                ]
              },
              { t: "ul", items: [
                "<strong>Cover the critical path first.</strong> Finance-facing, customer-facing and regulatory datasets earn maintained lineage; a staging table used by one analyst does not.",
                "<strong>Use it in change review, not just diagrams.</strong> A schema change with an attached consumer list is a different conversation from one without.",
                "<strong>Use it in the incident.</strong> \u201cThese six consumers, these two decisions blocked\u201d is the first useful sentence of a data incident update.",
                "<strong>Prefer stale-but-honest to complete-but-unmaintained.</strong> Lineage that is wrong where it matters is worse than lineage that is absent, because people trust it."
              ] },
              { t: "code", lang: "text", code:
                "Schema change request, with lineage attached\n" +
                "\n" +
                "  CHANGE   rename partner_amt -> partner_amount_eur\n" +
                "  CONSUMERS\n" +
                "    exec_revenue_daily      owner: finance    SLA 08:00\n" +
                "    partner_payout_run      owner: payments   SLA 02:00\n" +
                "    partner_portal_api      owner: platform   customer-facing\n" +
                "    ad_hoc_2023_analysis    owner: unknown    no SLA\n" +
                "  DECISION\n" +
                "    add the new column, dual-write for 30 days, deprecate\n" +
                "    the old one after the three owned consumers migrate\n" +
                "\n" +
                "Without the consumer list this is a one-line rename that\n" +
                "breaks a payout run at 02:00 on a Saturday."
              },
              { t: "note", variant: "trap", html: "<strong>An unowned consumer is not a reason to stop, but it is a reason to say so out loud.</strong> Breaking something with no owner is a decision, and it should be a stated one rather than a discovery." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Can trace where a table comes from."],
                  ["Senior", "Answers \u201cwho breaks if this column changes\u201d in minutes, including downstream owners and SLAs."],
                  ["Staff", "Makes lineage a precondition for change \u2014 impact analysis runs before a producer ships \u2014 rather than a diagram consulted after the incident."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> The trigger is any change to a column, a grain or a schedule. Before it ships, the useful sentence is: here is who consumes this, and here is what each of them needs from me." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A schema change breaks an executive dashboard the day before a quarterly review. Walk the response, then say what lineage would have changed about the day before." },
              { t: "note", variant: "key", html: "<strong>Lineage is a blast-radius tool, not a documentation project.</strong> Maintain it where the consumers matter and use it in change review and incident response \u2014 exhaustive coverage nobody updates is worse than none, because people believe it." }
            ]
          },
          {
            id: "quality-operating-model",
            title: "Data quality as an operating model",
            summary: "Checks are the easy part. Quality needs ownership, thresholds, triage and a remediation path \u2014 or it becomes an ignored alert channel.",
            minutes: 9,
            tags: ["trust", "quality"],
            blocks: [
              { t: "p", html: "Every platform eventually has a wall of quality checks and no improvement in trust. The reason is that a check is only the detector: <strong>without an owner, a threshold and a remediation path, it produces an alert channel people mute</strong>. Design the response before you add the check." },
              { t: "table",
                headers: ["Dimension", "What it catches", "Example check"],
                rows: [
                  ["Completeness", "Missing arrivals", "All expected partitions present by 02:00"],
                  ["Accuracy", "Values that are wrong but present", "Amounts reconcile to the source within tolerance"],
                  ["Freshness", "Stale data being read as current", "Maximum event timestamp within the stated window"],
                  ["Uniqueness", "Duplicates from replays or fan-out", "No duplicate business key per grain"],
                  ["Validity", "Values outside the domain", "Currency in the allowed set; amount not negative"],
                  ["Consistency", "Cross-table disagreement", "Order total equals the sum of its lines"]
                ]
              },
              { t: "h", text: "Place checks where meaning lives" },
              { t: "ul", items: [
                "<strong>Check close to business meaning, not just at ingest.</strong> An ingest check confirms the file arrived; a business check confirms the payout is computable.",
                "<strong>Set thresholds deliberately.</strong> Every false positive spends attention you will need for a true one, and a check that fires weekly for no reason is already muted.",
                "<strong>Give each check an owner and a runbook line.</strong> \u201cWho acts on this, and what do they do\u201d is part of the check, not a follow-up.",
                "<strong>Decide the blocking behaviour up front.</strong> Some checks should halt the publish; most should annotate it. Getting this backwards either stops the business or ships bad data."
              ] },
              { t: "compare",
                bad: { title: "Checks as decoration", items: ["Fifty checks, no owners", "Thresholds copied between datasets", "Every failure is a warning", "Nobody can say what fired last week"] },
                good: { title: "Checks as an operating model", items: ["Checks on the critical path, each owned", "Thresholds set from observed variance", "Blocking checks separated from advisory ones", "A weekly review of what fired and what it cost"] }
              },
              { t: "note", variant: "trap", html: "<strong>Counts matching while amounts are wrong is the signature failure of count-only checking.</strong> It is also the most reassuring one, which is why it survives so long \u2014 the dashboard is green and the money is not." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Adds data tests to pipelines."],
                  ["Senior", "Places checks where business meaning lives, with thresholds, owners and a remediation path, and separates blocking from advisory."],
                  ["Staff", "Runs quality as an operating model with tiers and reviews, so the number of checks grows with risk rather than with anxiety."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> When a problem is described as <em>\u201ccounts match but the values are off for some partners\u201d</em>, you are being asked for accuracy and consistency controls, not more completeness checks." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Counts match but amounts are wrong for a subset of partners. Design the three controls you would add, with thresholds and owners." },
              { t: "note", variant: "key", html: "<strong>A check without an owner, a threshold and a remediation path is an alert channel, not a control.</strong> Design the response first, place the check where business meaning lives, and separate blocking from advisory \u2014 otherwise the wall of green tells you nothing." }
            ]
          },
          {
            id: "data-sla-incident",
            title: "Data SLAs and incident leadership",
            summary: "A data incident is a communication problem as much as a recovery problem. Quantify impact, state confidence, and give a next-update time.",
            minutes: 9,
            tags: ["trust", "incident"],
            blocks: [
              { t: "p", html: "The recovery is usually a rerun. What separates leaders here is <strong>what stakeholders know while it happens</strong> \u2014 because a wrong number that people act on costs more than a late number they were warned about, and the warning is entirely within your control." },
              { t: "table",
                headers: ["Situation", "The leadership move"],
                rows: [
                  ["Job delayed, data will be correct", "State the workaround and an ETA; nobody needs the cause yet"],
                  ["Bad data already published", "Pause the publish, caveat what is live, then backfill"],
                  ["Impact unknown", "Quantify the window and the consumer list before promising anything"],
                  ["Partially correct \u2014 counts fine, amounts suspect", "Say exactly that, and name which decisions are unsafe today"],
                  ["Recovered", "Verify against the source, then say what changed to prevent it"]
                ]
              },
              { t: "h", text: "The four fields of a useful update" },
              { t: "ul", items: [
                "<strong>Impact, quantified.</strong> Records, money, tenants, time window, and the decisions that are blocked. \u201cSome data is delayed\u201d is not impact.",
                "<strong>Confidence, stated.</strong> Which parts you have verified and which you have not. This is the field people omit to look composed, and it is the one that earns trust.",
                "<strong>Workaround, if there is one.</strong> Yesterday's snapshot, a direct extract, a manual figure \u2014 tell them what to use in the meantime.",
                "<strong>Next update time.</strong> The single most valuable line: it stops a stream of individual pings and buys the team room to work."
              ] },
              { t: "code", lang: "text", code:
                "First update, four hours late, cause unknown\n" +
                "\n" +
                "  IMPACT      Daily revenue table is 4h late. Affects the\n" +
                "              exec summary and the partner payout preview.\n" +
                "              2.3% of partner rows are involved. No customer-\n" +
                "              facing surface is affected.\n" +
                "  CONFIDENCE  Row counts reconciled against source. Monetary\n" +
                "              columns still under review \u2014 do not use today's\n" +
                "              figure for partner communications.\n" +
                "  WORKAROUND  Yesterday's close is correct and available.\n" +
                "  NEXT        Update at 14:30, or sooner if amounts clear.\n" +
                "\n" +
                "No cause. No apology paragraph. Nothing anyone has to decode."
              },
              { t: "note", variant: "trap", html: "<strong>Offering an estimate you cannot support is how a data incident becomes a credibility incident.</strong> That number will be repeated in a meeting you are not in, and it will be attributed to you." },
              { t: "note", variant: "warn", html: "<strong>Stale and wrong are different incidents.</strong> Conflating them trains stakeholders to treat every freshness alert as a correctness event, after which they stop reading both." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Reruns the failed job and reports when it is done."],
                  ["Senior", "Sends impact, confidence, workaround and a next-update time before the cause is known."],
                  ["Staff", "Sets SLA tiers so only decision-driving datasets page anyone, and turns each incident into a detection improvement."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Any prompt of the form <em>\u201cthe table is late\u201d</em> or <em>\u201cthe report is wrong and the review is tomorrow\u201d</em> is asking for impact, confidence, workaround and a next-update time \u2014 in that order, before any cause." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> The daily revenue table is four hours late. Write the first update in four lines, with no root cause in it." },
              { t: "note", variant: "key", html: "<strong>State what you know, what you do not, and when you will speak again.</strong> Withholding the uncertainty to appear in control is the most common failure here, and it costs far more trust than the incident itself ever does." },
              { t: "quiz", id: "data-trust" }
            ]
          }
        ]
      },
      {
        id: "platform",
        name: "Platform Trade-offs",
        icon: "queue",
        lessons: [
          {
            id: "platform-strategy",
            title: "Data platform strategy",
            summary: "A platform strategy names what the data must make possible, chooses a few paved roads, and says what will be retired. A tool list is not a strategy.",
            minutes: 10,
            tags: ["platform", "strategy"],
            blocks: [
              { t: "p", html: "Most data platforms are not designed; they accumulate. Three orchestrators, two warehouses, a lake nobody trusts and a dozen ingestion scripts are what happens when every team solves its own problem well. A strategy reverses that by starting from <strong>which decisions and products the data must serve, where the platform fails them today, and the small number of supported paths that will fix it</strong> \u2014 the same diagnosis, policy and actions shape as any <a class='inline' href='#/strategy/direction/technical-strategy'>technical strategy</a>." },
              { t: "table",
                headers: ["Decision", "Options", "What usually decides it"],
                rows: [
                  ["Storage and compute", "Warehouse, lakehouse, or both with a clear split", "Workload mix: governed SQL analytics favours a warehouse; large-scale ML and open formats favour a lakehouse"],
                  ["Managed or self-run", "Managed service vs operating open-source yourself", "Whether running it is a differentiator; it almost never is for a data platform team under twenty people"],
                  ["Orchestration", "One supported orchestrator vs team choice", "One, unless a workload genuinely cannot run on it; every extra one doubles on-call knowledge"],
                  ["Ingestion", "Central connectors vs self-serve with templates", "Self-serve with templates once there are more sources than the central team can maintain"],
                  ["Serving", "Semantic layer, extracts, reverse ETL, APIs", "Who consumes the data and how much they need definitions enforced"]
                ]
              },
              { t: "h", text: "What the strategy has to say" },
              { t: "ul", items: [
                "<strong>Who the platform serves, ranked.</strong> Finance close, product analytics, ML features and operational dashboards want different things; saying which comes first is what makes trade-offs decidable.",
                "<strong>The paved roads.</strong> One supported way to ingest, store, transform, test and serve \u2014 documented, templated, and faster than doing it yourself.",
                "<strong>What will be retired, and when.</strong> A strategy that only adds is an inventory. Name the second orchestrator and the legacy extracts, with dates.",
                "<strong>Measures.</strong> Time for a new team to publish its first governed dataset, cost per query or per decision, incidents per month, and share of usage on the paved roads.",
                "<strong>The operating model.</strong> Who builds the platform, who builds on it, and what the platform team will not do (see <a class='inline' href='#/data/platform/mesh-vs-central'>data mesh or a central team</a>)."
              ] },
              { t: "code", lang: "text", code:
                "Data platform strategy, one page\n" +
                "\n" +
                "DIAGNOSIS  Finance close takes 6 days, 2 of them reconciling\n" +
                "           conflicting extracts. New sources take ~5 weeks to\n" +
                "           onboard through the central team.\n" +
                "SERVES    1. finance and partner payouts  2. product analytics\n" +
                "           3. ML features (best effort this year)\n" +
                "PAVED     ingest: templated connectors, self-serve\n" +
                "  ROADS   store: one warehouse; lake for raw and ML only\n" +
                "          transform + test: one framework, contracts in CI\n" +
                "          serve: semantic layer for finance metrics\n" +
                "RETIRE    second orchestrator by Q3; 14 legacy extracts by Q4\n" +
                "MEASURES  first governed dataset < 1 week; close in 4 days;\n" +
                "          80% of queries on paved roads by year end"
              },
              { t: "note", variant: "trap", html: "<strong>A tool-led strategy is the usual failure.</strong> \u201cWe will move to a lakehouse\u201d is a migration plan without a reason, and it will be judged on whether the migration finished rather than whether finance closes faster. Lead with the decisions the data serves; let the tools follow." },
              { t: "p", html: "For the storage trade-offs underneath these choices, Cascade covers <a class='inline' href='../data-eng-academy/index.html#/storage/lakehouse/warehouse'>the data warehouse</a> and <a class='inline' href='../data-eng-academy/index.html#/storage/lakehouse/table-formats'>lakehouse table formats</a> in depth." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows the main platform components and their trade-offs."],
                  ["Senior", "Ties platform choices to the workloads they serve and defines paved roads with measurable adoption."],
                  ["Staff", "Writes a diagnosis-led strategy that ranks consumers, retires tools with dates, and is judged on business outcomes rather than migration progress."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> <em>\u201cOur data stack has grown organically\u201d</em>, <em>\u201cshould we move to a lakehouse\u201d</em> or <em>\u201cwhat would your first 90 days as data platform lead look like\u201d</em> is asking for a diagnosis and paved roads, not a product comparison." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> You inherit two warehouses, three orchestrators and a finance team that does not trust either warehouse. Give the diagnosis, the first paved road, and the first thing you would retire." },
              { t: "note", variant: "key", html: "<strong>A data platform strategy is judged by the decisions it makes possible, not the tools it adopts.</strong> Rank who the platform serves, build a few paved roads that are faster than going around them, retire the rest with dates, and measure time-to-first-dataset and cost per decision." }
            ]
          },
          {
            id: "mesh-vs-central",
            title: "Data mesh or a central data team",
            summary: "Domain ownership scales when domains can carry it and the platform makes publishing cheap. Without those, a mesh just relocates the bottleneck.",
            minutes: 9,
            tags: ["platform", "organisation", "ownership"],
            blocks: [
              { t: "p", html: "The central data team becomes a bottleneck at roughly the point where it no longer understands the domains it models. Data mesh answers that by moving ownership of data products to the domains that produce the data. The idea is sound; <strong>the preconditions are where most adoptions fail</strong>, and an interview answer that names them reads very differently from one that names the trend." },
              { t: "table",
                headers: ["Model", "Works when", "Fails when"],
                rows: [
                  ["Central data team", "Few domains, one main consumer such as finance, a small team that knows the business", "Domains multiply; the backlog grows faster than headcount; modellers lose domain context"],
                  ["Central platform with embedded analysts", "Domains need analysis capacity but not engineering; one platform team keeps standards", "Embedded people drift from standards; the platform team still builds every pipeline"],
                  ["Domain-owned data products (mesh)", "Domains have engineering capacity, publishing is self-serve, and standards are enforced by the platform", "Domains have no data engineers, or governance is manual, or nobody owns the cross-domain metrics"]
                ]
              },
              { t: "h", text: "The preconditions, honestly" },
              { t: "ul", items: [
                "<strong>Domains with capacity.</strong> A domain that cannot staff an on-call for its pipelines cannot own a data product. Count the engineers before drawing the org chart.",
                "<strong>A self-serve platform.</strong> If publishing a governed dataset still needs a ticket to a central team, you have renamed the bottleneck, not removed it.",
                "<strong>Federated standards, enforced in the platform.</strong> Naming, contracts, classification and quality checks applied automatically \u2014 otherwise each domain invents its own.",
                "<strong>A product owner per data product.</strong> Someone accountable for consumers, SLAs and the change policy, not just the pipeline code.",
                "<strong>An owner for cross-domain metrics.</strong> Revenue and active customers span domains. Somebody still has to own them centrally."
              ] },
              { t: "code", lang: "text", code:
                "Readiness check before decentralising (score 0-2 each)\n" +
                "\n" +
                "  domains with data engineering capacity          1\n" +
                "  publish a governed dataset without a ticket     0\n" +
                "  contracts and classification enforced in CI     1\n" +
                "  named owner per candidate data product          2\n" +
                "  central owner for cross-domain metrics          2\n" +
                "  -------------------------------------------------\n" +
                "  total 6 / 10  ->  platform first; pilot ownership with\n" +
                "                    the two domains that scored 2 on capacity"
              },
              { t: "note", variant: "trap", html: "<strong>Reorganising before building the platform is the common failure.</strong> Teams are told they own their data, discover that publishing is still a ticket and governance still a review queue, and quietly hand it back \u2014 with the added cost that nobody is now clearly accountable." },
              { t: "p", html: "Cascade\u2019s <a class='inline' href='../data-eng-academy/index.html#/modeling/methodology/data-mesh-operating-model'>data mesh operating model</a> lesson covers the mechanics of data products and federated governance. Here the leadership question is when to move, how far, and what must exist first." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Can describe the central and mesh models."],
                  ["Senior", "Names the preconditions, checks them honestly, and proposes a pilot where they hold."],
                  ["Staff", "Sequences the move \u2014 platform, standards, pilot, scale \u2014 keeps central ownership of cross-domain metrics, and can say when to stop decentralising."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> <em>\u201cThe data team is a bottleneck\u201d</em>, <em>\u201cleadership wants a data mesh\u201d</em> or <em>\u201cwho should own the data\u201d</em> is asking whether you can separate the ownership idea from its preconditions." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Your CTO read about data mesh and wants it in place next quarter. Give your answer in four sentences, including what you would pilot and what you would refuse to do yet." },
              { t: "note", variant: "key", html: "<strong>Decentralise ownership only as fast as the platform makes ownership cheap.</strong> Check domain capacity, self-serve publishing and enforced standards first, pilot where they hold, and keep a central owner for the metrics that span domains." }
            ]
          },
          {
            id: "batch-streaming",
            title: "Batch and streaming trade-offs",
            summary: "Challenge vague real-time requirements by asking which decisions lose value while waiting \u2014 then make only those streaming.",
            minutes: 9,
            tags: ["platform", "streaming"],
            blocks: [
              { t: "p", html: "\u201cReal time\u201d is almost never a requirement; it is a proxy for someone being blocked. The question that dissolves the argument is <strong>which decision loses value while we wait, and how much</strong> \u2014 and it usually turns a platform-wide programme into a list of two or three surfaces." },
              { t: "table",
                headers: ["Need", "Fit", "Why"],
                rows: [
                  ["Fraud hold on a transaction", "Streaming or micro-batch", "The decision is worthless after the payment settles"],
                  ["Dispatch assignment", "Streaming", "The world has moved by the time a batch lands"],
                  ["Operational dashboard", "Freshness set by the decision it drives", "Often 15 minutes is indistinguishable from instant"],
                  ["Quarter-close reporting", "Batch, with strong reconciliation", "Correctness, reproducibility and replay dominate; latency is irrelevant"],
                  ["Ad-hoc analysis", "Batch", "The analyst's own iteration loop is the bottleneck, not the pipeline"]
                ]
              },
              { t: "ul", items: [
                "<strong>Ask for the decision, not the latency.</strong> \u201cWho does what differently at 30 seconds versus 30 minutes\u201d gets you a real answer or exposes that there is none.",
                "<strong>Price the operational cost honestly.</strong> Streaming brings a different on-call profile, harder debugging and replay complexity \u2014 all of which somebody has to carry.",
                "<strong>Plan late data either way.</strong> Events arrive out of order in both models; batch hides it behind a cut-off, streaming makes you face it in the design.",
                "<strong>Keep one reconciled source of record.</strong> A fast path and a correct path are fine; two independent sources of truth are not."
              ] },
              { t: "code", lang: "text", code:
                "\"Make everything real time\"  ->  four questions\n" +
                "\n" +
                "1. Which decision are you making with this number?\n" +
                "2. What do you do differently if it is 30 min old?\n" +
                "3. What does it cost when the answer arrives late today?\n" +
                "4. Would you accept a fast approximate number, with the\n" +
                "   reconciled one an hour later?\n" +
                "\n" +
                "Typical outcome: 2 of 14 dashboards genuinely need minutes,\n" +
                "and one of those wants the approximate/reconciled split."
              },
              { t: "note", variant: "trap", html: "<strong>A fast wrong number is worse than a slow right one</strong> in every reporting context \u2014 and worse still if both exist, because now people choose the one that supports their argument." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows the difference between batch and streaming."],
                  ["Senior", "Derives latency from the decision it serves and prices the operational cost of streaming honestly."],
                  ["Staff", "Keeps one reconciled source of record while allowing a fast approximate path, and declines platform-wide real time with the cost stated."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> The trigger phrase is <em>\u201cwe need this in real time\u201d</em>. Treat it as an unfinished sentence and ask which decision is waiting, before you cost anything." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Product asks for real-time payout visibility. Decide what must genuinely be real time and justify what stays on batch." },
              { t: "note", variant: "key", html: "<strong>Latency requirements come from decisions, not from dashboards.</strong> Ask what someone would do differently with a fresher number; where the answer is \u201cnothing\u201d, batch with good reconciliation is the better engineering choice even though it sounds less ambitious." }
            ]
          },
          {
            id: "platform-cost",
            title: "Cost leadership in data platforms",
            summary: "Control spend without breaking trust, SLAs or adoption \u2014 which means attributing before optimising and protecting what matters.",
            minutes: 9,
            tags: ["platform", "cost"],
            blocks: [
              { t: "p", html: "A cost mandate arrives as a percentage and lands as damage, because a blanket cut falls hardest on whoever argues least \u2014 frequently the workloads you most wanted to protect. <strong>Attribution is what converts a percentage into a list</strong>, and a list is something you can act on without breaking anything." },
              { t: "table",
                headers: ["Cost driver", "Lever", "What the lever costs"],
                rows: [
                  ["Full-table scans", "Partitioning, clustering, materialization", "Layout work, and pruning that breaks silently when filters change"],
                  ["Idle compute", "Auto-suspend, schedules", "Cold-start latency on the first query"],
                  ["Backfills and reruns", "Capacity windows, prioritization", "Slower recovery when something genuinely breaks"],
                  ["Over-refreshed dashboards", "Freshness set by decision value", "A conversation with each owner about what they actually need"],
                  ["Duplicated pipelines", "Consolidation onto one owned dataset", "A migration, and one team losing local control"]
                ]
              },
              { t: "h", text: "The sequence that works" },
              { t: "ul", items: [
                "<strong>Attribute by workload, warehouse, user group, schedule and query pattern.</strong> Usually a handful of patterns account for most of an increase.",
                "<strong>Protect high-value workloads explicitly.</strong> Name them before you start cutting, so they are not collateral.",
                "<strong>Use showback before chargeback.</strong> Visibility changes behaviour on its own and costs far less political capital.",
                "<strong>Report cost per decision, not just spend.</strong> \u201cThe partner report costs 40 per run and drives a weekly pricing decision\u201d is a sentence a business can evaluate."
              ] },
              { t: "code", lang: "text", code:
                "40% increase, attributed\n" +
                "\n" +
                "  new analytics workspace        +26 pts\n" +
                "     of which: 3 dashboards on 5-min refresh   +19 pts\n" +
                "               1 unpartitioned full-scan query  +6 pts\n" +
                "  backfill from the schema change  +9 pts   (one-off)\n" +
                "  organic growth                   +5 pts\n" +
                "\n" +
                "Action: change 3 refresh schedules, partition 1 table.\n" +
                "Recovers ~24 pts and nobody loses a capability.\n" +
                "A blanket 40% cut would have hit the payout run instead."
              },
              { t: "note", variant: "trap", html: "<strong>Cutting warehouse size before attribution</strong> slows every workload equally, including the executive dashboard you will be asked about on Monday. It also removes the headroom you need to investigate." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows the main cost levers in the warehouse."],
                  ["Senior", "Attributes spend before cutting and names the workloads being protected."],
                  ["Staff", "Puts cost per decision next to reliability on the same dashboard, uses showback to change behaviour, and sets budgets before launches rather than after."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> When cost arrives as a percentage \u2014 <em>\u201creduce warehouse spend by 30%\u201d</em> \u2014 the first deliverable is not a plan, it is the attribution table." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Warehouse cost jumps 40% after an analytics launch. Recommend changes in three sentences, naming what you would protect." },
              { t: "note", variant: "key", html: "<strong>Attribute, then optimise, and say out loud what you are protecting.</strong> A percentage target invites indiscriminate cuts; a list of query patterns lets you recover most of the increase without anyone losing a capability they were relying on." }
            ]
          },
          {
            id: "governance-speed",
            title: "Governance without bottlenecks",
            summary: "Practical governance makes teams faster because trust is built into the path \u2014 enforcement in the platform, not a ticket queue.",
            minutes: 8,
            tags: ["platform", "governance"],
            blocks: [
              { t: "p", html: "Governance gets a bad name when it is implemented as a queue. The version that works pushes enforcement <strong>into the platform, where it applies to every consumer automatically</strong> and costs an analyst nothing at query time \u2014 which is also the only version that survives someone new joining." },
              { t: "table",
                headers: ["Control", "Purpose", "Where it belongs"],
                rows: [
                  ["Classification", "Decide what protection each dataset needs", "At dataset registration, once"],
                  ["Column masking", "Reduce sensitive exposure by default", "In the platform, applied to every consumer"],
                  ["Row policy", "Tenant and role isolation", "In the platform, not in each query"],
                  ["Least privilege", "Limit what a compromise reaches", "In role definitions, reviewed periodically"],
                  ["Retention", "Legal obligation and storage discipline", "Automated per classification"],
                  ["Audit evidence", "Prove the controls ran", "Generated, never assembled by hand"]
                ]
              },
              { t: "ul", items: [
                "<strong>Classify first.</strong> Every control downstream is derived from classification, so guessing it makes everything else arbitrary.",
                "<strong>Automate the evidence.</strong> If proving compliance is manual, it will be done once a year and it will be wrong.",
                "<strong>Make the compliant path the easy path.</strong> A governed dataset that is faster to use than an export is the only durable defence against shadow copies.",
                "<strong>Review access on a schedule.</strong> Access accretes; nobody has ever asked to have permissions removed."
              ] },
              { t: "compare",
                bad: { title: "Governance as a queue", items: ["A ticket per query", "Access granted permanently, reviewed never", "Audit evidence assembled by hand", "Analysts keeping local extracts to avoid the process"] },
                good: { title: "Governance in the platform", items: ["Masking and row policies applied automatically", "Time-bounded access with scheduled review", "Evidence generated from the platform's own logs", "The governed path is the fastest path available"] }
              },
              { t: "note", variant: "trap", html: "<strong>Every bottleneck you add produces shadow data.</strong> A spreadsheet extracted to work around your process has none of your controls and none of your lineage, and it is now the version being presented to executives." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows which data is sensitive and follows the access rules."],
                  ["Senior", "Pushes enforcement into the platform \u2014 classification, masking, row policy \u2014 so approvals become routine."],
                  ["Staff", "Makes the governed path the fastest path, tracks shadow copies as a metric, and generates audit evidence continuously."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> When a new product needs customer, partner and financial data together, the question is not who approves it \u2014 it is which controls can be enforced by the platform so that approval becomes routine." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A new analytics product needs customer, partner and financial data. Name the controls you would put in the platform and the one thing you would still require a human to approve." },
              { t: "note", variant: "key", html: "<strong>Enforcement belongs in the platform; approval queues belong nowhere.</strong> Controls that apply automatically to every consumer are the only ones that hold as teams change, and making the governed path the fast path is what stops shadow copies from becoming the real source of truth." },
              { t: "quiz", id: "data-platform" }
            ]
          }
        ]
      },
      {
        id: "governance",
        name: "Governance and Cutover",
        icon: "map",
        lessons: [
          {
            id: "migration-cutover",
            title: "Migration and cutover leadership",
            summary: "Data migrations need acceptance criteria agreed before the pressure arrives \u2014 and counts are the check that reassures without proving anything.",
            minutes: 9,
            tags: ["governance", "migration"],
            blocks: [
              { t: "p", html: "A data cutover is a correctness decision wearing a schedule. The pressure will be real and the evidence will be ambiguous, which is exactly why <strong>the criteria have to exist before either of those things is true</strong>. Written on the day, they get negotiated down to whatever the current state happens to be." },
              { t: "table",
                headers: ["Evidence", "What it proves", "What it does not"],
                rows: [
                  ["Row counts equal", "Nothing was lost or duplicated at row level", "That any value was computed correctly"],
                  ["Aggregate variance in tolerance", "The values agree in bulk", "That individual rows are right"],
                  ["Sampled rows checked by a person", "Business rules hold on real examples", "That the tail is clean"],
                  ["Business-rule assertions", "The rules you thought to encode hold", "The rules nobody wrote down"],
                  ["Two dashboards looking similar", "Almost nothing", "Anything you could defend at close"]
                ]
              },
              { t: "h", text: "Deciding on the day" },
              { t: "table",
                headers: ["Mismatch", "Decision"],
                rows: [
                  ["Explainable timing difference", "Document it, monitor it, proceed"],
                  ["Monetary variance, cause understood and bounded", "Proceed only with the owner's written acceptance"],
                  ["Monetary variance, cause unknown", "No cutover, at any percentage"],
                  ["Counts match, aggregates differ", "No cutover \u2014 the transformation is not yet proven"],
                  ["Inside a finance freeze window", "No cutover, regardless of the evidence"]
                ]
              },
              { t: "ul", items: [
                "<strong>Parallel-run on counts, aggregates, samples and business rules.</strong> Any one of the four alone will pass while something is wrong.",
                "<strong>Give the parallel run a named reconciliation owner.</strong> A comparison nobody reads manufactures confidence, which is worse than having no comparison.",
                "<strong>Define \u201cexplainable\u201d in advance.</strong> A timing difference you understand is a note; an unexplained money variance is a stop, and that distinction must not be invented under pressure.",
                "<strong>Make go/no-go a business decision with the owners present.</strong> It is their number and their close."
              ] },
              { t: "note", variant: "trap", html: "<strong>\u201cWe will reconcile after cutover\u201d is a promise to diagnose a defect you have not found, while it is live and while people are reporting from it.</strong> The right time to understand a variance is when the old path is still authoritative." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Runs the new pipeline alongside the old and compares counts."],
                  ["Senior", "Sets acceptance criteria across counts, aggregates, samples and business rules, plus a rehearsed rollback, before cutover pressure arrives."],
                  ["Staff", "Refuses a cutover when the evidence is not there, states the business cost of holding, and owns the decision afterwards."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Any question shaped like <em>\u201cthe new pipeline mostly matches\u2026\u201d</em> is testing whether you know that counts are the cheapest check and amounts are where defects live." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A new pipeline matches on counts but differs on aggregates, and close is in a week. Make the call, name the evidence you would need to change it." },
              { t: "note", variant: "key", html: "<strong>Unexplained variance in money is a stop at any size.</strong> Agree the four kinds of evidence and the meaning of \u201cexplainable\u201d before the pressure arrives, and cutover day becomes reading a number out loud rather than negotiating with people who badly want to ship." }
            ]
          },
          {
            id: "semantic-layer",
            title: "Semantic layer and metric contracts",
            summary: "A semantic layer is a product contract with owners, versions and regression tests \u2014 not a dashboard convenience.",
            minutes: 8,
            tags: ["governance", "semantics"],
            blocks: [
              { t: "p", html: "The reason the same metric dispute recurs every quarter is that the definition lives in several places at once. A semantic layer fixes it only if it is treated as a <strong>contract with an owner, a version and a test</strong> \u2014 as a convenience layer it becomes one more place a definition can drift." },
              { t: "table",
                headers: ["Contract item", "Example", "Who owns it"],
                rows: [
                  ["Definition", "Bookings exclude cancellations recorded after period close", "Finance, with the data team implementing"],
                  ["Grain", "One row per booking, per period", "Data team"],
                  ["Owner", "A named person who approves changes", "Named individual, not a team"],
                  ["Regression test", "A known partner's payout for a fixed month", "Data team, run on every change"],
                  ["Version", "Bumped whenever meaning changes, not shape", "Data team, visible to consumers"]
                ]
              },
              { t: "h", text: "Handling a definition change safely" },
              { t: "ul", items: [
                "<strong>Version, do not overwrite.</strong> A definition change breaks comparability with every report and commitment made under the old one.",
                "<strong>Run both for a stated window.</strong> Consumers need a period where they can see the difference on their own numbers.",
                "<strong>Get the owner's sign-off, in writing.</strong> This is the step that stops a well-meaning change from becoming a restatement.",
                "<strong>Add a regression fixture for the new meaning.</strong> Otherwise the next change drifts silently past it."
              ] },
              { t: "code", lang: "text", code:
                "\"Active customer\" redefinition\n" +
                "\n" +
                "  v1  any login in the last 90 days\n" +
                "  v2  a billable event in the last 30 days\n" +
                "\n" +
                "SAFE PATH\n" +
                "  1. publish v2 alongside v1, both queryable\n" +
                "  2. show the delta per segment to each consumer\n" +
                "  3. finance and product sign off on the switch date\n" +
                "  4. regression fixture pinned for both versions\n" +
                "  5. v1 deprecated with a date, after consumers migrate\n" +
                "\n" +
                "UNSAFE PATH\n" +
                "  edit the definition; every historical comparison in every\n" +
                "  deck silently becomes wrong, and nobody can date the break."
              },
              { t: "note", variant: "trap", html: "<strong>The dangerous definition change is the one that keeps every dashboard working.</strong> Nothing errors, the numbers just quietly mean something else, and the first person to notice is comparing against a deck from last quarter." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Reuses shared metric definitions where they exist."],
                  ["Senior", "Gives each critical metric an owner, a grain, a regression test and a versioned change process."],
                  ["Staff", "Decides which metrics are contract-grade and which stay local, so central ownership is spent where disagreements are expensive."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> When a team proposes to \u201cfix\u201d or \u201ctighten\u201d a metric definition, treat it as a versioned contract change with an owner and a migration window \u2014 not a bug fix." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A team wants to redefine \u201cactive customer\u201d. Walk the safe path in four steps and say what you would refuse to do." },
              { t: "note", variant: "key", html: "<strong>Version meaning changes and pin them with a regression fixture.</strong> A definition edited in place breaks comparability everywhere at once without producing a single error, which is why it is the most expensive silent change a data platform can ship." }
            ]
          },
          {
            id: "data-contracts",
            title: "Data ownership and contracts between teams",
            summary: "Downstream breakages stop when producers own a contract checked in their own pipeline, and every dataset has an owner, consumers and an SLA tier.",
            minutes: 9,
            tags: ["governance", "ownership", "contracts"],
            blocks: [
              { t: "p", html: "Most data incidents are not pipeline bugs. They are <strong>an upstream team changing something it did not know anyone depended on</strong> \u2014 a renamed column, a new status value, a changed meaning of \u201cactive\u201d. The fix is ownership made explicit: every dataset has a producing owner, a list of consumers, a contract describing what they can rely on, and an SLA tier that says how much it matters." },
              { t: "table",
                headers: ["Contract field", "Example", "Who enforces it"],
                rows: [
                  ["Schema", "Columns, types, nullability, allowed values", "Producer\u2019s CI: incompatible changes fail before merge"],
                  ["Semantics", "\u201cactive_customer: one paid order in the last 30 days, UTC\u201d", "Owner sign-off on change; versioned when meaning moves"],
                  ["Freshness", "Complete by 06:00 UTC on business days", "Platform monitor; pages the producer for tier-1 datasets"],
                  ["Quality thresholds", "Duplicates below 0.01%; amounts reconcile to source within 0.1%", "Checks at publish; a breach blocks publication for tier 1"],
                  ["Change policy", "30 days\u2019 notice for breaking changes; consumers notified", "Registry of consumers; the owner runs the migration"],
                  ["Owner and tier", "Payments data team; tier 1", "Catalogue entry, reviewed quarterly"]
                ]
              },
              { t: "h", text: "SLA tiers keep it affordable" },
              { t: "ul", items: [
                "<strong>Tier 1</strong> \u2014 drives money, customer-facing numbers or regulatory reports. Full contract, publish-blocking checks, on-call for the producer.",
                "<strong>Tier 2</strong> \u2014 drives internal decisions. Contract and checks, alerts in working hours, no paging.",
                "<strong>Tier 3</strong> \u2014 exploratory or team-local. An owner and a description; no SLA, and a label saying so.",
                "<strong>Promotion is explicit.</strong> A dataset moves up a tier when someone starts making decisions on it, and the owner agrees \u2014 not when a dashboard quietly starts depending on it."
              ] },
              { t: "code", lang: "text", code:
                "contract: partner_payouts_daily     tier: 1\n" +
                "owner:    payments-data (on-call: payments-data-primary)\n" +
                "consumers: finance-close, partner-portal, payout-forecast\n" +
                "schema:\n" +
                "  payout_id      string, unique, not null\n" +
                "  partner_id     string, not null\n" +
                "  amount_minor   integer, >= 0\n" +
                "  currency       string, ISO 4217\n" +
                "  status         enum [pending, paid, reversed]\n" +
                "freshness: complete by 06:00 UTC, business days\n" +
                "quality:   amount total reconciles to ledger within 0.1%\n" +
                "change:    breaking -> new version, 30 days' notice,\n" +
                "           all consumers acknowledged before removal"
              },
              { t: "note", variant: "trap", html: "<strong>A contract that is only a document is a wish.</strong> If nothing fails in the producer\u2019s pipeline when the schema changes incompatibly, the contract will be broken on the first busy Friday, and the consumer will find out from a stakeholder on Monday." },
              { t: "p", html: "For implementation detail \u2014 contract formats, schema enforcement, running contracts in CI \u2014 see Cascade\u2019s <a class='inline' href='../data-eng-academy/index.html#/orchestration/quality/contracts'>data contracts and schema enforcement</a> and <a class='inline' href='../data-eng-academy/index.html#/orchestration/quality/contracts-ci'>data contracts in CI</a>. Responding when a tier-1 SLA is breached is covered in <a class='inline' href='#/data/trust/data-sla-incident'>data SLAs and incident leadership</a>." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Knows which upstream tables their pipelines depend on."],
                  ["Senior", "Puts producer-owned contracts with CI enforcement on the datasets that matter, with a consumer list and a change policy."],
                  ["Staff", "Sets the ownership model and SLA tiers for the organisation, so contracts are applied in proportion to risk and promotion between tiers is explicit."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> <em>\u201cAn upstream change broke our dashboards\u201d</em>, <em>\u201cnobody knows who owns this table\u201d</em> or <em>\u201chow do you set data SLAs\u201d</em> is asking for producer ownership, enforcement in the producer\u2019s pipeline, and tiers \u2014 not more downstream tests." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> An upstream team renamed a column and broke three dashboards over a weekend. Describe the contract you would introduce, where it is enforced, and which datasets get it first." },
              { t: "note", variant: "key", html: "<strong>Ownership is only real when the producer\u2019s pipeline enforces it.</strong> Give every dataset an owner, consumers and a tier; put contracts with CI enforcement on tier 1 first; and make promotion between tiers an explicit decision rather than an accident of dependency." }
            ]
          },
          {
            id: "data-communication",
            title: "Communicating data confidence",
            summary: "Say what is known, unknown, usable and unsafe. Withholding uncertainty to look composed is the most expensive habit in this role.",
            minutes: 8,
            tags: ["governance", "communication"],
            blocks: [
              { t: "p", html: "A data leader's product is not the table; it is <strong>the confidence a decision-maker can place in it</strong>. That means routinely publishing what you do not know, which feels like admitting weakness and is in fact the thing that makes you the person they come to first." },
              { t: "table",
                headers: ["Field", "Example"],
                rows: [
                  ["Impact", "2.3% of partner rows are delayed; the payout preview is affected"],
                  ["Confidence", "Counts reconciled against source; monetary columns still under review"],
                  ["Usable today", "Yesterday's close, and the volume metrics"],
                  ["Unsafe today", "Anything partner-facing, and the revenue summary"],
                  ["Next update", "14:30, or sooner if the amounts clear"]
                ]
              },
              { t: "ul", items: [
                "<strong>Publish a confidence level with the number.</strong> \u201cReconciled\u201d, \u201cprovisional\u201d and \u201cunder review\u201d are three different products and should not look identical in a dashboard.",
                "<strong>Name the blocked decisions.</strong> That is what a stakeholder actually needs, and it is far more useful than a percentage.",
                "<strong>Never use a screenshot as reconciliation proof.</strong> It shows two views looked alike once, at chart precision, with no record of the filters.",
                "<strong>Keep the cadence even when nothing has changed.</strong> Silence is read as either resolved or out of control, and both are wrong."
              ] },
              { t: "compare",
                bad: { title: "Composure over clarity", items: ["\u201cWe are investigating.\u201d", "An estimate offered to be helpful", "Confidence implied by a clean dashboard", "Going quiet until it is fixed"] },
                good: { title: "Clarity over composure", items: ["\u201cCounts reconciled, amounts under review.\u201d", "\u201cI will not give a figure I cannot support.\u201d", "A provisional badge on the affected metric", "An update at the promised time, even if it is \u2018no change\u2019"] }
              },
              { t: "note", variant: "trap", html: "<strong>An unsupported estimate offered to be helpful is the most damaging sentence available to you.</strong> It will be repeated in a room you are not in, attributed to you, and remembered long after the correct figure lands." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Reports the number and where it came from."],
                  ["Senior", "States which parts are reconciled, which are provisional, and which decisions are unsafe today."],
                  ["Staff", "Builds confidence into the product itself \u2014 freshness badges, caveat labels, reconciled-as-of stamps \u2014 so stakeholders stop needing to ask."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> Whenever you are about to write \u201cwe are looking into it\u201d, replace it with impact, confidence, what is usable, what is not, and when you will speak again." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Write the executive update for a reporting discrepancy where counts reconcile and amounts do not, without offering a figure you cannot defend." },
              { t: "note", variant: "key", html: "<strong>Publishing uncertainty is what makes the certainty worth anything.</strong> State what is reconciled, what is provisional, which decisions are unsafe today, and when you will speak next \u2014 and refuse to supply a number you cannot defend, however much the room wants one." },
              { t: "quiz", id: "data-governance" }
            ]
          }
        ]
      }
    ]
  };
})();
