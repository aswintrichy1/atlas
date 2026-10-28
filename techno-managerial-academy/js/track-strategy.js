/* =====================================================================
   TECHLEAD · Strategy and Execution track (curriculum + quizzes + widgets)

   Self-contained: registers window.TRACKS.strategy, its strategy-* quizzes,
   and the prioritisation calculator, tech-debt portfolio and roadmap
   builder those lessons mount.
   ===================================================================== */
(function () {
  "use strict";

  /* =====================================================================
     WIDGETS
     ===================================================================== */
  var SVGNS = "http://www.w3.org/2000/svg";
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
  function svg(tag, attrs, text) {
    var el = document.createElementNS(SVGNS, tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    if (text != null) el.textContent = text;
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
      hr.appendChild(h("th", { style: "text-align:left;padding:5px 8px;font-family:var(--font-mono);font-size:.6rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);border-bottom:1px solid var(--line)" }, x));
    });
    t.appendChild(hr);
    rows.forEach(function (r, ri) {
      var tr = h("tr", markIdx === ri ? { style: "background:color-mix(in srgb, var(--accent) 12%, transparent)" } : {});
      r.forEach(function (cell, ci) {
        tr.appendChild(h("td", { style: "padding:6px 8px;border-bottom:1px solid var(--line)" + (ci === 0 ? ";font-weight:600" : ";color:var(--text-dim)") }, String(cell)));
      });
      t.appendChild(tr);
    });
    return t;
  }
  function labelRow(text) {
    return h("span", { style: "font-family:var(--font-mono);font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);min-width:150px" }, text);
  }
  function note(lead, body) {
    return h("p", { style: "margin-top:10px;font-size:.76rem;color:var(--text-dim)" },
      h("span", {}, h("b", { style: "color:var(--accent-ink)" }, lead + " "), body));
  }
  function rankOf(list, key) {
    var sorted = list.slice().sort(function (a, b) { return b[key] - a[key]; });
    var out = {};
    sorted.forEach(function (x, i) { out[x.id] = i + 1; });
    return out;
  }

  var Widgets = {};

  /* ---------------------------------------------------------------
     1. PRIORITISATION CALCULATOR
     Same backlog, two formulas. Tune the inputs and watch where the
     rankings disagree \u2014 the disagreement is the conversation.
     --------------------------------------------------------------- */
  Widgets["tm-prioritiser"] = function (mount) {
    shell(mount, "calculator", "RICE and WSJF prioritisation calculator",
      "Five backlog items scored two ways. RICE rewards reach; WSJF rewards urgency and risk reduction relative to size. Pick an item and adjust its inputs \u2014 the rows where the two rankings disagree are where the real argument lives.");

    var ITEMS = [
      { id: "sso", name: "Enterprise SSO", reach: 400, impact: 2, conf: 80, effort: 3, bv: 8, tc: 8, rr: 3, size: 5 },
      { id: "checkout", name: "Checkout latency fix", reach: 20000, impact: 1, conf: 90, effort: 2, bv: 6, tc: 3, rr: 2, size: 3 },
      { id: "audit", name: "Audit-log export", reach: 150, impact: 3, conf: 50, effort: 4, bv: 5, tc: 9, rr: 8, size: 5 },
      { id: "dark", name: "Dark mode", reach: 12000, impact: 0.5, conf: 100, effort: 1, bv: 3, tc: 1, rr: 1, size: 2 },
      { id: "queue", name: "Retire legacy queue", reach: 50, impact: 1, conf: 80, effort: 3, bv: 2, tc: 5, rr: 9, size: 5 }
    ];
    var cur = "audit";

    var sliders = h("div", { style: "display:flex;flex-direction:column;gap:8px;margin-bottom:18px" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function item(id) { return ITEMS.filter(function (x) { return x.id === id; })[0]; }

    function buildSliders() {
      sliders.innerHTML = "";
      var it = item(cur);
      [
        { k: "conf", label: "RICE confidence %", min: 10, max: 100, step: 10 },
        { k: "effort", label: "RICE effort (person-months)", min: 1, max: 8, step: 1 },
        { k: "tc", label: "WSJF time criticality", min: 1, max: 10, step: 1 },
        { k: "rr", label: "WSJF risk reduction", min: 1, max: 10, step: 1 }
      ].forEach(function (f) {
        var val = h("b", { style: "font-family:var(--font-mono);min-width:2.5em" }, String(it[f.k]));
        var input = h("input", { type: "range", min: f.min, max: f.max, step: f.step, value: it[f.k], "aria-label": f.label + " for " + it.name });
        input.addEventListener("input", function () {
          var n = parseFloat(input.value);
          if (!isFinite(n)) return;
          it[f.k] = n;
          val.textContent = String(n);
          paint();
        });
        sliders.appendChild(h("label", { class: "w-field", style: "flex-wrap:wrap" }, labelRow(f.label), input, val));
      });
    }

    function paint() {
      ITEMS.forEach(function (x) {
        x.rice = x.effort > 0 ? (x.reach * x.impact * (x.conf / 100)) / x.effort : 0;
        x.wsjf = x.size > 0 ? (x.bv + x.tc + x.rr) / x.size : 0;
      });
      var rr = rankOf(ITEMS, "rice"), wr = rankOf(ITEMS, "wsjf");
      var biggest = null, disagreements = 0, markIdx = -1;
      ITEMS.forEach(function (x, i) {
        var gap = Math.abs(rr[x.id] - wr[x.id]);
        if (gap >= 2) disagreements++;
        if (!biggest || gap > biggest.gap) biggest = { x: x, gap: gap };
        if (x.id === cur) markIdx = i;
      });
      var riceTop = ITEMS.filter(function (x) { return rr[x.id] === 1; })[0];
      var wsjfTop = ITEMS.filter(function (x) { return wr[x.id] === 1; })[0];

      stage.innerHTML = "";
      stage.appendChild(rowsTable(
        ["Item", "RICE", "RICE rank", "WSJF", "WSJF rank"],
        ITEMS.map(function (x) { return [x.name, Math.round(x.rice).toLocaleString(), "#" + rr[x.id], x.wsjf.toFixed(2), "#" + wr[x.id]]; }),
        markIdx
      ));
      stage.appendChild(biggest && biggest.gap >= 2
        ? note("Biggest disagreement: " + biggest.x.name + " (RICE #" + rr[biggest.x.id] + ", WSJF #" + wr[biggest.x.id] + ").",
            rr[biggest.x.id] < wr[biggest.x.id]
              ? "RICE likes it because many people touch it; WSJF does not, because nothing gets worse if it waits. Ask what it costs to ship it next quarter instead."
              : "WSJF likes it because delay is expensive \u2014 a date, a risk, or a dependency. RICE cannot see that, because it only counts who benefits. Say the deadline or the risk out loud.")
        : note("The two methods broadly agree.", "That is useful evidence in itself: the ranking does not depend on which formula you picked, so stop debating the method and debate the inputs."));

      readout.innerHTML = "";
      readout.appendChild(ro("RICE picks", riceTop.name, true));
      readout.appendChild(ro("WSJF picks", wsjfTop.name, true));
      readout.appendChild(ro("rank disagreements (2+ places)", disagreements));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      labelRow("Tune item"),
      seg(ITEMS.map(function (x) { return { v: x.id, label: x.name }; }), function () { return cur; }, function (v) { cur = v; buildSliders(); paint(); })));
    mount.appendChild(sliders);
    mount.appendChild(stage);
    mount.appendChild(readout);
    buildSliders();
    paint();
  };

  /* ---------------------------------------------------------------
     2. TECH-DEBT PORTFOLIO
     Interest against principal. Fund items within a quarter's
     budget and watch the hours you get back.
     --------------------------------------------------------------- */
  Widgets["tm-debt-portfolio"] = function (mount) {
    shell(mount, "portfolio", "Tech-debt portfolio matrix",
      "Six pieces of debt, plotted by interest (hours lost every sprint) against principal (engineer-weeks to fix). Choose a quarterly budget, then fund items. Two items carry incident risk their interest does not show.");

    var ITEMS = [
      { id: "flaky", n: 1, name: "Flaky integration suite", interest: 14, principal: 2, risk: false },
      { id: "auth", n: 2, name: "Hand-rolled auth middleware", interest: 3, principal: 6, risk: true },
      { id: "build", n: 3, name: "25-minute monolith build", interest: 20, principal: 5, risk: false },
      { id: "cron", n: 4, name: "Unowned cron jobs", interest: 4, principal: 1, risk: true },
      { id: "orm", n: 5, name: "ORM two majors behind", interest: 2, principal: 8, risk: false },
      { id: "pricing", n: 6, name: "Copy-pasted pricing rules", interest: 9, principal: 3, risk: false }
    ];
    var funded = { build: true };
    var budget = 8;

    function quadrant(x) {
      var hi = x.interest >= 8, big = x.principal >= 4;
      if (hi && !big) return "Pay now";
      if (hi && big) return "Plan as a project";
      if (!hi && !big) return "Fix in passing";
      return "Monitor, revisit on a trigger";
    }

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function plot() {
      var W = 520, H = 230, L = 46, R = 14, T = 14, B = 34;
      var xMax = 9, yMax = 22;
      var sx = function (v) { return L + (v / xMax) * (W - L - R); };
      var sy = function (v) { return T + (1 - v / yMax) * (H - T - B); };
      var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Debt items plotted by principal and interest", style: "width:100%;height:auto;display:block;margin-bottom:12px" });
      s.appendChild(svg("rect", { x: L, y: T, width: W - L - R, height: H - T - B, rx: 6, style: "fill:none;stroke:var(--line)" }));
      s.appendChild(svg("line", { x1: sx(4), y1: T, x2: sx(4), y2: H - B, style: "stroke:var(--line);stroke-dasharray:4 4" }));
      s.appendChild(svg("line", { x1: L, y1: sy(8), x2: W - R, y2: sy(8), style: "stroke:var(--line);stroke-dasharray:4 4" }));
      [["Pay now", sx(0.2), sy(8.7)], ["Plan as a project", sx(4.2), sy(8.7)], ["Fix in passing", sx(0.2), sy(0.5)], ["Monitor", sx(4.2), sy(0.5)]].forEach(function (q) {
        s.appendChild(svg("text", { x: q[1], y: q[2], style: "fill:var(--text-dim);font-size:11px;font-family:var(--font-mono)" }, q[0]));
      });
      s.appendChild(svg("text", { x: (L + W - R) / 2, y: H - 8, "text-anchor": "middle", style: "fill:var(--text-dim);font-size:11px" }, "principal \u2192 engineer-weeks to fix"));
      s.appendChild(svg("text", { x: 12, y: (T + H - B) / 2, "text-anchor": "middle", transform: "rotate(-90 12 " + ((T + H - B) / 2) + ")", style: "fill:var(--text-dim);font-size:11px" }, "interest \u2192 h/sprint"));
      ITEMS.forEach(function (x) {
        var on = !!funded[x.id];
        var g = svg("g", {});
        g.appendChild(svg("circle", { cx: sx(x.principal), cy: sy(x.interest), r: 11, style: "fill:" + (on ? "var(--accent)" : "var(--surface-solid)") + ";stroke:" + (x.risk ? "var(--accent-ink)" : "var(--line)") + ";stroke-width:" + (x.risk ? 2.5 : 1.5) }));
        g.appendChild(svg("text", { x: sx(x.principal), y: sy(x.interest) + 4, "text-anchor": "middle", style: "font-size:11px;font-weight:700;fill:" + (on ? "var(--on-accent)" : "var(--text)") }, String(x.n)));
        s.appendChild(g);
      });
      return s;
    }

    function paint() {
      var spent = 0, retired = 0, totalInterest = 0, riskOpen = [];
      ITEMS.forEach(function (x) {
        totalInterest += x.interest;
        if (funded[x.id]) { spent += x.principal; retired += x.interest; }
        else if (x.risk) riskOpen.push(x.name);
      });
      var over = spent - budget;
      var payback = retired > 0 ? (spent * 40) / retired : 0;

      stage.innerHTML = "";
      stage.appendChild(plot());
      stage.appendChild(rowsTable(
        ["#", "Debt", "Interest h/sprint", "Principal wk", "Quadrant", "Funded"],
        ITEMS.map(function (x) { return [x.n, x.name + (x.risk ? " (incident risk)" : ""), x.interest, x.principal, quadrant(x), funded[x.id] ? "yes" : "\u2014"]; })
      ));
      stage.appendChild(over > 0
        ? note("Over budget by " + over + " engineer-week" + (over === 1 ? "" : "s") + ".", "Something has to come out, and the honest way to choose is the hours each item returns per week invested \u2014 or a risk you can name.")
        : riskOpen.length
          ? note("Unfunded risk: " + riskOpen.join(", ") + ".", "Interest only counts the hours you lose on a normal week. These carry the chance of an incident or a breach, which a pure hours ranking will always undervalue \u2014 fund them or write down who accepts the risk.")
          : note("Within budget, risks covered.", "Now attach each funded item to a roadmap milestone it unblocks, so it survives the next priority review."));

      readout.innerHTML = "";
      readout.appendChild(ro("budget used", spent + " / " + budget + " wk", true));
      readout.appendChild(ro("interest retired", retired + " of " + totalInterest + " h/sprint"));
      readout.appendChild(ro("portfolio payback", retired ? payback.toFixed(1) + " sprints" : "\u2014"));
    }

    var funds = h("div", { class: "widget-controls" });
    ITEMS.forEach(function (x) {
      funds.appendChild(toggle(x.n + " \u00b7 " + x.name, function () { return !!funded[x.id]; }, function () { funded[x.id] = !funded[x.id]; paint(); }));
    });
    mount.appendChild(h("div", { class: "widget-controls" },
      labelRow("Quarterly budget"),
      seg([{ v: 4, label: "4 eng-weeks" }, { v: 8, label: "8 eng-weeks" }, { v: 12, label: "12 eng-weeks" }], function () { return budget; }, function (v) { budget = v; paint(); })));
    mount.appendChild(funds);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------------------------------------------------------------
     3. ROADMAP BUILDER
     Place items in now / next / later and see whether the roadmap
     is credible: capacity, certainty, dependencies, commitments.
     --------------------------------------------------------------- */
  Widgets["tm-roadmap-builder"] = function (mount) {
    shell(mount, "builder", "Now / next / later roadmap builder",
      "The team has about 10 points of capacity this quarter. The draft below is what most first roadmaps look like: nearly everything in Now. Move items until the warnings clear.");

    var HZ = ["now", "next", "later", "cut"];
    var HZ_LABEL = { now: "Now", next: "Next", later: "Later", cut: "Cut" };
    var ITEMS = [
      { id: "sso", name: "Enterprise SSO", size: 4, certainty: "high", note: "contracted for this quarter" },
      { id: "authz", name: "Fine-grained permissions", size: 3, certainty: "medium" },
      { id: "api", name: "Public API v2", size: 5, certainty: "medium", needs: "authz" },
      { id: "search", name: "Search rebuild", size: 6, certainty: "low" },
      { id: "mobile", name: "Offline mobile mode", size: 5, certainty: "low" },
      { id: "queue", name: "Retire legacy queue", size: 2, certainty: "high" }
    ];
    var place = { sso: "now", authz: "now", api: "now", search: "now", mobile: "next", queue: "now" };
    var CAP = 10;

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function byId(id) { return ITEMS.filter(function (x) { return x.id === id; })[0]; }

    function warnings() {
      var w = [];
      var load = 0;
      ITEMS.forEach(function (x) { if (place[x.id] === "now") load += x.size; });
      if (load > CAP) w.push("Now holds " + load + " points against a capacity of " + CAP + ". Something in Now is a wish, and everyone will find out which one in week eight.");
      ITEMS.forEach(function (x) {
        if (place[x.id] === "now" && x.certainty === "low") w.push(x.name + " is low-certainty but sits in Now. Now is for things you can describe as solutions; keep this in Next or Later framed as the problem to solve.");
        if (x.needs && place[x.id] !== "cut") {
          var dep = byId(x.needs);
          if (HZ.indexOf(place[x.id]) < HZ.indexOf(place[dep.id])) w.push(x.name + " depends on " + dep.name + ", which is " + (place[dep.id] === "cut" ? "cut" : "scheduled later") + ". Sequence them, or the earlier item stalls when it reaches the dependency.");
        }
        if (x.note && place[x.id] !== "now") w.push(x.name + " is " + x.note + ". Moving it out of Now breaks a commitment \u2014 that is a decision for the account owner, not a roadmap tweak.");
      });
      var hasLater = ITEMS.some(function (x) { return place[x.id] === "later"; });
      if (!hasLater) w.push("Nothing is in Later. A roadmap with no Later says nothing about direction, only about this quarter's queue.");
      return { list: w, load: load };
    }

    function paint() {
      var res = warnings();
      stage.innerHTML = "";
      var cols = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:12px" });
      HZ.forEach(function (z) {
        var items = ITEMS.filter(function (x) { return place[x.id] === z; });
        var pts = items.reduce(function (a, x) { return a + x.size; }, 0);
        var col = h("div", { style: "border:1px solid var(--line);border-radius:10px;padding:8px 10px;min-height:70px" },
          h("div", { style: "font-family:var(--font-mono);font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-faint);margin-bottom:6px" }, HZ_LABEL[z] + " \u00b7 " + pts + " pts"));
        if (!items.length) col.appendChild(h("div", { style: "font-size:.72rem;color:var(--text-dim)" }, "empty"));
        items.forEach(function (x) {
          col.appendChild(h("div", { style: "font-size:.74rem;padding:3px 0;color:var(--text)" }, x.name + " (" + x.size + ", " + x.certainty + ")"));
        });
        cols.appendChild(col);
      });
      stage.appendChild(cols);
      if (res.list.length) {
        stage.appendChild(note(res.list.length + " issue" + (res.list.length === 1 ? "" : "s") + " to resolve.", ""));
        var ul = h("ul", { style: "margin:6px 0 0 18px;font-size:.74rem;color:var(--text-dim)" });
        res.list.forEach(function (t) { ul.appendChild(h("li", { style: "margin-bottom:4px" }, t)); });
        stage.appendChild(ul);
      } else {
        stage.appendChild(note("Credible.", "Now fits capacity and holds only things you are confident in, dependencies are sequenced, the commitment is honoured, and Later says where you are heading. This is a roadmap you can defend line by line."));
      }

      readout.innerHTML = "";
      readout.appendChild(ro("now load", res.load + " / " + CAP + " pts", true));
      readout.appendChild(ro("issues", res.list.length));
      readout.appendChild(ro("verdict", res.list.length ? "not yet credible" : "credible"));
    }

    var controls = h("div", { style: "display:flex;flex-direction:column;gap:8px;margin-bottom:18px" });
    ITEMS.forEach(function (x) {
      controls.appendChild(h("div", { style: "display:flex;flex-wrap:wrap;gap:10px;align-items:center" },
        labelRow(x.name),
        seg(HZ.map(function (z) { return { v: z, label: HZ_LABEL[z] }; }), function () { return place[x.id]; }, function (v) { place[x.id] = v; paint(); })));
    });
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  var COMPASS_SALT = "<a class='inline' href='../behavioral-academy/index.html#/beh/delivery/deliver-salt'>SALT structure in Compass</a>";
  var COMPASS_ANATOMY = "<a class='inline' href='../behavioral-academy/index.html#/story/catalog/story-anatomy'>reusable story anatomy in Compass</a>";

  /* =====================================================================
     QUIZZES
     ===================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "strategy-direction": {
      title: "Strategy and direction checkpoint",
      sub: "Technical strategy, now-next-later roadmaps, and OKRs that steer rather than decorate.",
      questions: [
        {
          q: "What most distinguishes a technical strategy from a list of initiatives?",
          options: [
            "It covers a longer time horizon",
            "It is approved by more senior people",
            "It names a diagnosis of the core problem and makes choices, including what you will not do",
            "It includes a budget"
          ],
          answer: 2,
          explain: "A strategy explains what is actually wrong and commits to a direction that rules some things out; an initiative list says yes to everything and therefore guides nothing. Horizon and approval are properties any plan can have. The test is whether a team could use it to say no to a reasonable-sounding request."
        },
        {
          q: "What belongs in the Later column of a now-next-later roadmap?",
          options: [
            "Problems you intend to solve, stated as problems, with no committed date or solution",
            "Fully specified features scheduled for next year",
            "Items that were rejected",
            "Work blocked by other teams"
          ],
          answer: 0,
          explain: "Later expresses direction while being honest that the solution and timing are not yet known; stating it as a problem keeps options open. A fully specified feature with a date is a commitment and belongs nearer to Now. Rejected items belong in a cut list so they are visibly decided."
        },
        {
          q: "Which is the strongest key result?",
          options: [
            "Launch the new onboarding flow",
            "Run five customer interviews",
            "Improve onboarding",
            "Raise the share of new accounts active in week two from 38% to 50%, with support tickets per new account not increasing"
          ],
          answer: 3,
          explain: "A key result should be a measurable outcome, and a guardrail stops it being hit by shifting cost elsewhere. Launching something and running interviews are outputs or tasks \u2014 they can be done without anything improving. \u201cImprove onboarding\u201d is an objective, not a result."
        },
        {
          q: "A team hits every key result, but customers are no happier. What is the most likely problem?",
          options: [
            "The targets were too ambitious",
            "The key results measured outputs or proxies that the team could move without changing the customer outcome",
            "The team needed more key results",
            "Quarterly cycles are too short"
          ],
          answer: 1,
          explain: "When a metric becomes the target, teams find the cheapest way to move it, and if it is an output or a loose proxy that path need not touch the real outcome. Ambitious targets would cause misses, not hollow hits. Adding more output metrics makes the problem bigger."
        },
        {
          q: "Leadership wants a roadmap with committed dates for every item over the next twelve months. What is the strongest response?",
          options: [
            "Provide dates for everything, padded by 50%",
            "Refuse to give any dates",
            "Commit dates where there is a real external dependency, and give horizons with confidence levels for the rest, revisited on a set cadence",
            "Give dates only for the first quarter and nothing after"
          ],
          answer: 2,
          explain: "Dates are commitments other people plan around, so they should exist where something genuinely depends on them, and the uncertainty elsewhere should be stated rather than hidden in padding. Blanket padding produces dates that are both late and untrusted. Refusing outright loses the conversation and the trust."
        }
      ]
    },

    "strategy-invest": {
      title: "Prioritisation and investment checkpoint",
      sub: "RICE, cost of delay, WSJF, build against buy, vendor evaluation, tech-debt portfolios, and platform cases.",
      questions: [
        {
          q: "RICE ranks a regulatory audit export near the bottom, but WSJF ranks it first. What explains the difference?",
          options: [
            "RICE is more accurate because it includes confidence",
            "One of the calculations is wrong",
            "WSJF ignores how many users benefit",
            "WSJF counts time criticality and risk reduction, which a fixed regulatory date drives up; RICE only counts reach, impact, confidence and effort"
          ],
          answer: 3,
          explain: "A regulatory deadline makes delay very expensive even when few users touch the feature, and only a cost-of-delay formula sees that. RICE is built around how many people benefit and how much, so it structurally undervalues urgency and risk. The disagreement is information, not an error."
        },
        {
          q: "What is the main value of using a prioritisation framework at all?",
          options: [
            "It makes the assumptions behind a ranking explicit, so they can be challenged and revised",
            "It removes judgement from prioritisation",
            "It produces a mathematically optimal order",
            "It ends disagreements with stakeholders"
          ],
          answer: 0,
          explain: "The inputs are estimates, so the output is no more precise than they are; the value is that everyone can see and argue about the same assumptions. Frameworks that are treated as removing judgement produce false precision. They narrow disagreements to specific inputs rather than ending them."
        },
        {
          q: "When comparing two vendors, which comparison is most often skipped and most often regretted?",
          options: [
            "Licence price",
            "Feature checklist coverage",
            "The exit path \u2014 data portability, contract terms and migration cost if you have to leave",
            "Reference customers"
          ],
          answer: 2,
          explain: "Exit cost determines how much leverage you have for the rest of the relationship, and it is invisible at signing time. Licence price and feature lists dominate the evaluation precisely because they are easy to compare. References are useful but rarely tell you how hard it is to leave."
        },
        {
          q: "A debt item costs 2 engineer-weeks to fix and wastes 14 engineer-hours every two-week sprint. Roughly how long until fixing it pays back?",
          options: [
            "About 1 sprint",
            "About 6 sprints",
            "About 14 sprints",
            "It never pays back"
          ],
          answer: 1,
          explain: "Two engineer-weeks is roughly 80 hours; at 14 hours recovered per sprint that is about 5.7 sprints, so roughly six. Framing debt this way \u2014 principal against interest \u2014 is what lets you compare it with feature work in the same currency. Items with high interest and low principal like this one usually belong at the top of the debt list."
        },
        {
          q: "You want funding for an internal deployment platform. What evidence makes the strongest case?",
          options: [
            "A list of features the platform will have",
            "Industry articles about platform engineering",
            "A mandate from leadership that all teams must adopt it",
            "Measured hours teams currently spend on the problem, a pilot team\u2019s before-and-after numbers, and the adoption you expect without a mandate"
          ],
          answer: 3,
          explain: "Investment cases are judged on cost avoided and adoption, and a pilot with measured results turns a promise into evidence. A feature list describes what you will build, not what it is worth. A mandate hides whether the platform is actually better, which is the thing funders most need to know."
        }
      ]
    },

    "strategy-planning": {
      title: "Planning under uncertainty checkpoint",
      sub: "Estimation ranges, risk registers, and budget and headcount planning.",
      questions: [
        {
          q: "A director asks for a single delivery date on a project with two unknown integrations. What is the strongest response?",
          options: [
            "Give a range with a confidence level, name the two unknowns, and say when the range will narrow",
            "Give the most likely date",
            "Give the pessimistic date to be safe",
            "Decline until the integrations are fully understood"
          ],
          answer: 0,
          explain: "A range tied to the specific unknowns tells the director both the plan and what drives its risk, and committing to when it narrows makes it actionable. A single likely date will be quoted as a promise. A pessimistic date is still a single number, and declining gives them nothing to plan with."
        },
        {
          q: "Using a three-point estimate of optimistic 4, most likely 6 and pessimistic 14 weeks, what is the weighted mean (O + 4M + P) / 6?",
          options: [
            "6 weeks",
            "8 weeks",
            "7 weeks",
            "9 weeks"
          ],
          answer: 2,
          explain: "(4 + 24 + 14) / 6 = 42 / 6 = 7 weeks. The mean sits above the most likely value because the pessimistic tail is long, which is exactly the information a single \u201cmost likely\u201d estimate hides. Reporting 6 weeks would quietly assume nothing goes wrong."
        },
        {
          q: "Which risk register entry is most useful?",
          options: [
            "\u201cVendor risk \u2014 high\u201d",
            "\u201cIf the vendor sandbox lacks the refund API by 1 Nov, refunds slip three weeks; owner Ana; trigger: no sandbox access by 25 Oct; action: start the manual-refund fallback\u201d",
            "\u201cIntegration may be difficult\u201d",
            "\u201cThird-party dependency \u2014 monitor\u201d"
          ],
          answer: 1,
          explain: "A useful entry states the mechanism and consequence, has a named owner, and attaches a measurable trigger to a pre-decided action \u2014 that is what turns worry into steering. The others are labels: they cannot be ranked, nobody knows when to act, and \u201cmonitor\u201d assigns no one to do it."
        },
        {
          q: "You will add four engineers next quarter. How should capacity planning treat them?",
          options: [
            "As full capacity from their start date",
            "As zero capacity for the whole quarter",
            "As full capacity, with existing engineers absorbing the onboarding",
            "As partial capacity ramping over months, while also counting the time existing engineers spend onboarding them"
          ],
          answer: 3,
          explain: "New hires ramp gradually and existing engineers lose time to interviews, onboarding and review, so a team can be slower for a period after growing. Counting full capacity from day one is the classic planning error. Zero capacity is too pessimistic and understates what they contribute late in the quarter."
        },
        {
          q: "A late project is offered three extra engineers for its final month. What is the main risk?",
          options: [
            "Higher salary cost",
            "Onboarding and coordination costs can exceed their contribution in the time available, making the project later",
            "The extra engineers will not want to work on it",
            "It will set a precedent for other projects"
          ],
          answer: 1,
          explain: "Adding people to late work costs ramp-up time and extra communication paths before any benefit arrives, and in a single month that cost can dominate. Salary is real but secondary. A better use is often to give them well-separated work that does not need onboarding into the critical path."
        }
      ]
    },

    "strategy-execution": {
      title: "Execution and communication checkpoint",
      sub: "RFC and design review, executive communication, multi-team programs, and deprecations.",
      questions: [
        {
          q: "Which changes most deserve a formal RFC and design review?",
          options: [
            "Every change over a certain number of lines",
            "Only changes requested by leadership",
            "Decisions that are hard to reverse or that affect other teams\u2019 interfaces, data or operations",
            "Any change to a frontend component"
          ],
          answer: 2,
          explain: "Review effort should scale with reversibility and blast radius; that is what keeps the process valuable rather than a queue people route around. Size in lines says little about consequence. Reviewing everything formally trains people to write the minimum to get through."
        },
        {
          q: "A program has been reported green for weeks, then misses its launch by a month. What most likely went wrong in status reporting?",
          options: [
            "Status colours reflected effort and optimism rather than measurable criteria such as milestone dates and burn of known risks",
            "The program had too many workstreams",
            "Status was reported too often",
            "The executives did not read the updates"
          ],
          answer: 0,
          explain: "When colours are self-assessed without criteria, nobody wants to be the first to go amber, so status stays green until it is red. Defining what each colour means \u2014 tied to dates, dependencies and risk triggers \u2014 makes the slide honest. Frequency and readership are not the root cause."
        },
        {
          q: "What should open a one-page update to an executive?",
          options: [
            "Background on how the project started",
            "The decision or outcome they need to know, the impact, and the specific ask",
            "A detailed technical architecture diagram",
            "A list of everything completed since last time"
          ],
          answer: 1,
          explain: "Executives read the top and decide whether to read further, so the decision, impact and ask must come first. Background and completed-work lists bury the point. Architecture detail belongs in an appendix for whoever wants it."
        },
        {
          q: "What is the most important structural element of a multi-team program?",
          options: [
            "A weekly all-hands meeting for everyone on the program",
            "A single detailed Gantt chart",
            "Daily status updates from every engineer",
            "A single accountable owner, with dependencies tracked explicitly between named owners and dates"
          ],
          answer: 3,
          explain: "Multi-team work fails at the seams, so someone must own the whole outcome and every cross-team dependency must have an owner on each side and a date. Large meetings and daily updates add overhead without assigning accountability. A Gantt chart is a view of the plan, not a mechanism for keeping it."
        },
        {
          q: "A deprecation has migrated 85% of callers and has stalled for two months. What is the most effective next step?",
          options: [
            "Announce the shutdown date again",
            "Wait for the remaining teams to find time",
            "Identify each remaining caller and owner, do the migration for the smallest ones, offer tooling or pairing to the rest, and schedule brownouts before the final date",
            "Shut it down immediately"
          ],
          answer: 2,
          explain: "The last callers are stuck for specific reasons \u2014 no owner, no capacity, or a gap in the replacement \u2014 so a list by name with a tailored action is what moves them. Brownouts surface unknown callers safely before the final cut. Repeating the announcement changes nothing, and an immediate shutdown turns a migration into an outage."
        }
      ]
    }
  });

  /* =====================================================================
     CURRICULUM
     ===================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.strategy = {
    id: "strategy",
    name: "Strategy and Execution",
    short: "STRAT",
    tagline: "Choose the work, then land it",
    color: "#fb7185",
    blurb: "Deciding what the organisation should build and then getting it shipped across teams: writing a technical strategy, now-next-later roadmaps, OKRs that steer, RICE, cost of delay and WSJF, build against buy and vendor evaluation, tech debt as a portfolio, platform investment cases, estimation under uncertainty, risk registers, budget and headcount, RFC and design review, executive one-pagers, multi-team programs, and deprecations that actually finish.",
    modules: [
      /* ==================== MODULE 1 · DIRECTION ==================== */
      {
        id: "direction",
        name: "Strategy and Direction",
        icon: "compass",
        lessons: [
          {
            id: "technical-strategy",
            title: "Writing a technical strategy",
            summary: "A diagnosis of the real problem, a direction that rules things out, and the coherent actions that follow \u2014 not a list of everything you would like to do.",
            minutes: 10,
            tags: ["strategy", "writing"],
            blocks: [
              { t: "p", html: "Most documents titled \u201ctechnical strategy\u201d are wishlists: every good idea the team has, in priority order. A strategy is different in one specific way \u2014 <strong>it makes choices</strong>. It names what is actually wrong, picks a direction that rules some reasonable options out, and lists the few actions that follow. The test is whether a team could use it to say no." },
              { t: "table",
                headers: ["Section", "Question it answers", "The smell when it is missing"],
                rows: [
                  ["Diagnosis", "What is actually wrong, and why now?", "Actions with no shared reason; each team picks its favourite"],
                  ["Direction", "Which approach are we choosing, and what are we giving up?", "Everything is a priority, so nothing is"],
                  ["Actions", "What are the few concrete moves for the next two or three quarters?", "A vision with no first step"],
                  ["Non-goals", "What are we explicitly not doing?", "The same rejected idea returns every planning cycle"],
                  ["Signals", "How will we know it is working, or that it is wrong?", "The strategy can never be revised because nothing could falsify it"]
                ]
              },
              { t: "ul", items: [
                "<strong>Spend most of the effort on the diagnosis.</strong> A sharp diagnosis makes the direction feel obvious; a vague one makes every direction look arbitrary.",
                "<strong>Write the trade-off into the direction.</strong> \u201cWe will consolidate onto one queue, accepting a six-month migration and losing two teams\u2019 local tooling.\u201d",
                "<strong>Keep the actions few and sequenced.</strong> Three actions that reinforce each other beat ten that compete for the same people.",
                "<strong>Socialise before you publish.</strong> Walk the diagnosis past the people who will disagree; a strategy that surprises its readers is resisted on principle."
              ] },
              { t: "code", lang: "text", code:
                "Strategy outline \u2014 payments platform, next 18 months\n" +
                "\n" +
                "  DIAGNOSIS  four retry implementations across six services;\n" +
                "             60% of Sev2s trace to retry or timeout behaviour;\n" +
                "             each new provider takes ~10 weeks to integrate\n" +
                "  DIRECTION  one provider gateway owned by one team; all\n" +
                "             services call it. We give up per-team retry\n" +
                "             tuning and accept a 2-quarter migration.\n" +
                "  ACTIONS    Q1 gateway for card provider + idempotency store\n" +
                "             Q2 migrate refunds and payouts; retire 2 clients\n" +
                "             Q3 new-provider integration target: 3 weeks\n" +
                "  NON-GOALS  no multi-region active-active this period\n" +
                "  SIGNALS    retry-related Sev2s halve by Q3, else revisit"
              },
              { t: "compare",
                bad: { title: "A wishlist", items: ["Twelve initiatives, all priority one", "No statement of what is wrong", "No trade-offs mentioned", "Cannot be used to decline anything"] },
                good: { title: "A strategy", items: ["A diagnosis with evidence", "One direction and what it costs", "Three sequenced actions", "Non-goals and a signal that would change the plan"] }
              },
              { t: "note", variant: "trap", html: "<strong>A strategy that offends nobody is usually not a strategy.</strong> If every team reads it and finds their current plan endorsed, it has not made a choice." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Can explain the team\u2019s strategy and how their work fits it."],
                  ["Senior", "Writes a strategy for their area with a diagnosis, a direction with trade-offs, and non-goals."],
                  ["Staff", "Writes strategy that crosses teams, gets it adopted by people they do not manage, and revises it when the signals say so."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cWhere would you take this platform in two years?\u201d or \u201cTell me about a technical direction you set\u201d \u2014 lead with the diagnosis, then the choice and what it cost, then the first action." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you set technical direction for more than one team.\u201d Name the diagnosis, the option you rejected, and the signal you watched. The " + COMPASS_SALT + " keeps the story to the decision rather than the background." },
              { t: "note", variant: "key", html: "<strong>A strategy makes choices.</strong> Diagnose what is actually wrong, choose a direction and state what it gives up, list a few sequenced actions and explicit non-goals, and name the signal that would make you change course \u2014 if it cannot be used to say no, it is a wishlist." }
            ]
          },
          {
            id: "roadmaps",
            title: "Roadmaps: now, next, later",
            summary: "A roadmap communicates intent and confidence. Horizons replace false dates; Now fits capacity, Later states problems, and commitments are explicit.",
            minutes: 9,
            tags: ["strategy", "roadmap"],
            blocks: [
              { t: "p", html: "A twelve-month roadmap with a date on every item is a list of promises nobody can keep, and everyone reading it knows that. <strong>Horizons are more honest</strong>: Now is what the team is confident it is doing, Next is what is likely and being shaped, and Later is the direction, stated as problems rather than solutions." },
              { t: "table",
                headers: ["Horizon", "Certainty", "Granularity", "Commitment"],
                rows: [
                  ["Now", "High \u2014 scoped and staffed", "Solutions, with owners", "Yes, with dates where something depends on them"],
                  ["Next", "Medium \u2014 likely, being shaped", "Bets, with the problem and rough size", "Intent, revisited each cycle"],
                  ["Later", "Low \u2014 direction", "Problems, not solutions", "None; it may change or disappear"],
                  ["Cut", "Decided", "Named, with the reason", "Explicitly not doing"]
                ]
              },
              { t: "widget", id: "tm-roadmap-builder" },
              { t: "ul", items: [
                "<strong>Now must fit capacity, with room for the unplanned.</strong> A Now column at 130% of capacity is a forecast of which items will silently slip.",
                "<strong>Give dates only where something depends on them.</strong> A contract, a regulatory deadline, another team\u2019s launch \u2014 those are commitments; everything else is a horizon.",
                "<strong>Write Later as problems.</strong> \u201cSearch is too slow for large catalogues\u201d leaves room to learn; \u201cRebuild search on engine X\u201d commits to an answer you do not have yet.",
                "<strong>Publish the cut list.</strong> Visibly declined work stops being re-requested every quarter."
              ] },
              { t: "compare",
                bad: { title: "Roadmap as a promise", items: ["Dates on every item for a year", "Solutions specified far in advance", "Everything in the first quarter", "Changes hidden until they become slips"] },
                good: { title: "Roadmap as intent", items: ["Horizons with stated confidence", "Dates only for real dependencies", "Now sized to capacity", "Revised on a published cadence, with a cut list"] }
              },
              { t: "note", variant: "trap", html: "<strong>Putting everything in Now to avoid a difficult conversation guarantees a worse one later.</strong> The trade-off you did not make in planning is made for you in week eight, by whichever item slips first." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cSales wants dates for everything\u201d or \u201cHow do you build a roadmap?\u201d \u2014 the strong answer separates commitments from intent and shows the capacity arithmetic for Now." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> A sales leader asks for committed dates on six features for the next year. Explain in four sentences which you will date, which you will give horizons, and why." },
              { t: "note", variant: "key", html: "<strong>Horizons are honest; dates are commitments.</strong> Keep Now inside capacity and limited to things you are confident in, date only what something depends on, state Later as problems, and publish what you cut \u2014 then revise on a cadence people can rely on." }
            ]
          },
          {
            id: "okrs-metrics",
            title: "OKRs and metrics that steer",
            summary: "Objectives say where; key results measure whether you got there \u2014 as outcomes with guardrails, not task lists.",
            minutes: 9,
            tags: ["strategy", "okrs", "metrics"],
            blocks: [
              { t: "p", html: "OKRs fail in two predictable ways: key results that are really tasks (\u201claunch X\u201d), and key results that can be hit by moving cost somewhere you are not measuring. <strong>A good key result is an outcome a customer or the business would notice, paired with a guardrail</strong> that stops it being gamed." },
              { t: "table",
                headers: ["Key result", "Type", "Problem"],
                rows: [
                  ["Launch the new onboarding flow", "Output", "Can be done without anyone onboarding better"],
                  ["Run five customer interviews", "Task", "An activity, not a result"],
                  ["Reduce onboarding drop-off", "Unmeasured outcome", "No baseline, no target, no date"],
                  ["Week-two activation from 38% to 50%", "Outcome", "Good \u2014 but could be hit by hiding a hard step"],
                  ["\u2026with support tickets per new account flat or lower", "Guardrail", "Stops the cost being moved to support"]
                ]
              },
              { t: "ul", items: [
                "<strong>Three to five key results per objective.</strong> More than that and the team is executing a project plan with extra steps.",
                "<strong>Separate leading from lagging metrics.</strong> Revenue lags by months; activation or latency moves in weeks and tells you sooner if the bet is wrong.",
                "<strong>Say which OKRs are committed and which are aspirational.</strong> Missing an aspirational one at 70% is success; missing a committed one is an incident.",
                "<strong>Grade honestly and publicly.</strong> An OKR system where everything scores green has stopped carrying information."
              ] },
              { t: "code", lang: "text", code:
                "Objective  New customers get value in their first week\n" +
                "\n" +
                "  KR1  week-2 activation 38% -> 50%            (committed)\n" +
                "  KR2  median time to first report 3d -> 1d    (aspirational)\n" +
                "  KR3  setup-related tickets per new account\n" +
                "       no higher than 0.4                       (guardrail)\n" +
                "\n" +
                "  NOT a KR: \"ship the setup wizard\" \u2014 that is how we\n" +
                "  intend to move KR1, and we may be wrong about it."
              },
              { t: "note", variant: "trap", html: "<strong>When a measure becomes a target, people find the cheapest way to move it.</strong> That is not dishonesty; it is optimisation. The guardrail is what keeps the cheapest way from also being the wrong one." },
              { t: "note", variant: "warn", html: "<strong>Tying OKR scores directly to compensation kills ambition.</strong> People set targets they know they can hit, and the system stops telling you anything you did not already know." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you measure your team\u2019s success?\u201d or \u201cYour team hit every target but nothing improved\u201d \u2014 talk about outcomes over outputs, leading signals, and guardrails." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Rewrite \u201cmigrate to the new queue\u201d as an objective with two outcome key results and a guardrail." },
              { t: "note", variant: "key", html: "<strong>Measure outcomes, and guard them.</strong> Key results should be changes someone would notice, with a baseline, a target and a guardrail that stops the cost moving elsewhere \u2014 the work you plan to do is your hypothesis for moving them, not the result itself." },
              { t: "quiz", id: "strategy-direction" }
            ]
          }
        ]
      },

      /* ==================== MODULE 2 · INVEST ==================== */
      {
        id: "invest",
        name: "Prioritisation and Investment",
        icon: "trend",
        lessons: [
          {
            id: "prioritisation",
            title: "Prioritisation frameworks: RICE, cost of delay, WSJF",
            summary: "Frameworks make assumptions explicit so they can be argued about. Where two methods disagree is where the real decision lives.",
            minutes: 11,
            tags: ["invest", "prioritisation"],
            blocks: [
              { t: "p", html: "No formula decides your roadmap; the inputs are estimates and the output is no more precise than they are. What a framework does is <strong>force everyone to state the same assumptions in the same units</strong>, so the argument moves from \u201cmy project matters more\u201d to \u201cI think your reach estimate is ten times too high.\u201d" },
              { t: "table",
                headers: ["Framework", "Formula", "Rewards", "Blind spot"],
                rows: [
                  ["RICE", "Reach \u00d7 Impact \u00d7 Confidence \u00f7 Effort", "Work that helps many people cheaply", "Deadlines, risk reduction and internal work with low reach"],
                  ["Cost of delay", "Value lost per unit of time the work waits", "Urgent work and work that unlocks other work", "Requires an honest estimate of value per week"],
                  ["WSJF", "(Value + Time criticality + Risk reduction) \u00f7 Job size", "Small, urgent, risk-reducing work", "Relative scores drift between scoring sessions"],
                  ["Value against effort grid", "Plot and pick the top-left", "Speed of discussion", "Hides confidence and urgency entirely"]
                ]
              },
              { t: "widget", id: "tm-prioritiser" },
              { t: "code", lang: "text", code:
                "Same backlog, two answers\n" +
                "\n" +
                "  item                  RICE      WSJF\n" +
                "  checkout latency fix  9,000 #1  3.67 #3\n" +
                "  dark mode             6,000 #2  2.50 #5\n" +
                "  enterprise SSO          213 #3  3.80 #2\n" +
                "  audit-log export         56 #4  4.40 #1\n" +
                "  retire legacy queue      13 #5  3.20 #4\n" +
                "\n" +
                "Dark mode: wide reach, no urgency. Audit export: narrow\n" +
                "reach, regulatory date. The formulas are not wrong; they\n" +
                "are answering different questions."
              },
              { t: "ul", items: [
                "<strong>Agree the units before scoring.</strong> Reach per quarter, effort in person-months \u2014 mixing units silently reorders the list.",
                "<strong>Use confidence honestly.</strong> A 50% confidence on an untested bet is information; inflating it to 80% to win the ranking is how frameworks lose credibility.",
                "<strong>Run a sensitivity check.</strong> If changing one estimate by a factor of two flips the top item, the decision is really about that estimate.",
                "<strong>Override with a stated reason.</strong> Strategy, a commitment or a risk can trump the score \u2014 say which, in writing."
              ] },
              { t: "note", variant: "trap", html: "<strong>False precision is worse than no framework.</strong> A RICE score of 213.33 looks authoritative and rests on a reach estimate somebody guessed in the meeting." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cYou have more requests than capacity \u2014 how do you decide?\u201d or \u201cTell me about a time you said no to a senior stakeholder\u201d \u2014 show the framework, the assumption that drove the ranking, and the override you would make and why." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you had to choose between two important projects.\u201d Name the inputs that decided it and the one you were least sure of. Structure the story with the " + COMPASS_SALT + "." },
              { t: "note", variant: "key", html: "<strong>Frameworks expose assumptions; they do not make decisions.</strong> RICE counts who benefits, cost of delay and WSJF count what waiting costs \u2014 where they disagree, the decision is about urgency or reach, and that is the conversation to have out loud." }
            ]
          },
          {
            id: "build-buy-partner",
            title: "Build, buy or partner \u2014 and evaluating vendors",
            summary: "Build what differentiates you, buy what does not, partner where neither fits \u2014 and evaluate vendors on your hardest case and your exit path.",
            minutes: 10,
            tags: ["invest", "vendors", "build-vs-buy"],
            blocks: [
              { t: "p", html: "Build against buy is usually framed as licence cost against engineering cost, which is the least important part of it. The real question is <strong>whether this capability differentiates you</strong>, and the second is what it will cost to leave if you are wrong." },
              { t: "table",
                headers: ["Option", "Fits when", "What it really costs"],
                rows: [
                  ["Build", "It differentiates you, or no product fits your constraints", "Engineering time forever: on-call, upgrades, security, hiring for it"],
                  ["Buy", "It is commodity for you and mature in the market", "Licence, integration, vendor risk, and less control over the roadmap"],
                  ["Partner", "You need capability or reach you cannot buy off the shelf", "Shared roadmap, contract complexity, dependence on another organisation"],
                  ["Open source, self-run", "Commodity, but data or cost constraints rule out a vendor", "All the operational cost of building, with less control over direction"]
                ]
              },
              { t: "h", text: "Evaluating vendors" },
              { t: "ol", items: [
                "<strong>Write requirements before you see demos.</strong> Otherwise the best demo writes your requirements for you.",
                "<strong>Weight criteria before you score.</strong> Agreeing weights after seeing scores is how a favourite wins.",
                "<strong>Run a proof of concept on your hardest case.</strong> Every vendor handles the happy path; your edge case is the evaluation.",
                "<strong>Do security and data review early.</strong> A late veto from security wastes everyone\u2019s quarter.",
                "<strong>Price three years of total cost.</strong> Licence, integration, operations, and the team that owns it.",
                "<strong>Write the exit plan before signing.</strong> Data export format, contract terms, and an estimate of migration cost."
              ] },
              { t: "code", lang: "text", code:
                "Weighted scorecard \u2014 observability vendor (weights set first)\n" +
                "\n" +
                "  criterion                 weight   A    B    C\n" +
                "  hardest-case PoC passed     25     5    3    4\n" +
                "  3-year total cost           20     3    5    4\n" +
                "  security & data residency   20     4    4    2\n" +
                "  exit path / data export     15     2    4    4\n" +
                "  integration effort          10     4    3    3\n" +
                "  support model               10     4    4    3\n" +
                "  weighted total (of 500)          375  385  340\n" +
                "\n" +
                "A and B are within noise. B wins on exit path, which is\n" +
                "the criterion hardest to fix after signing."
              },
              { t: "note", variant: "trap", html: "<strong>Comparing licence price to an engineer\u2019s salary is the classic mistake.</strong> Building means owning it forever \u2014 upgrades, incidents, security patches and the hiring to replace whoever built it." },
              { t: "note", variant: "warn", html: "<strong>Buying something that differentiates you hands your advantage to a vendor\u2019s roadmap.</strong> Building something that does not differentiates you spends your scarcest engineers on solved problems." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Compares tools on features and price for their own use."],
                  ["Senior", "Runs a weighted evaluation with a proof of concept on the hard case and a three-year cost."],
                  ["Staff", "Frames the decision by differentiation, owns the exit plan, and can say when to revisit it."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cWould you build or buy this?\u201d or \u201cHow would you choose a vendor?\u201d \u2014 open with whether it differentiates you, and do not finish without the exit path." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Make the case for buying a feature-flag service rather than building one, in four sentences that include its three-year cost and how you would leave it." },
              { t: "note", variant: "key", html: "<strong>Build what differentiates you; buy what does not; always know how to leave.</strong> Set weights before scores, prove the hardest case, cost three years rather than one, and write the exit plan before you sign." }
            ]
          },
          {
            id: "tech-debt-portfolio",
            title: "Managing tech debt as a portfolio",
            summary: "Debt has principal and interest. Measure the interest, fund a standing allocation, and pick items by return \u2014 and by the risk hours cannot show.",
            minutes: 10,
            tags: ["invest", "tech-debt"],
            blocks: [
              { t: "p", html: "\u201cWe need a quarter for tech debt\u201d rarely wins, because it asks for an unbounded amount of time for an unmeasured benefit. Treat debt like a portfolio instead: each item has <strong>principal</strong> (the cost to fix) and <strong>interest</strong> (what it costs you every sprint you do not). Then the argument is about returns, which a business already knows how to evaluate." },
              { t: "widget", id: "tm-debt-portfolio" },
              { t: "table",
                headers: ["Quadrant", "Interest", "Principal", "Move"],
                rows: [
                  ["Pay now", "High", "Small", "Fund this quarter; fastest payback in the portfolio"],
                  ["Plan as a project", "High", "Large", "Put it on the roadmap with a milestone and an owner"],
                  ["Fix in passing", "Low", "Small", "Boy-scout it when touching that code"],
                  ["Monitor", "Low", "Large", "Leave it; set a trigger that would make it worth paying"]
                ]
              },
              { t: "ul", items: [
                "<strong>Measure interest in hours or incidents, not adjectives.</strong> Build minutes, flaky-test reruns, time-to-onboard and on-call pages are all countable.",
                "<strong>Hold a standing allocation.</strong> A steady share of capacity every sprint beats a heroic debt quarter that gets cancelled.",
                "<strong>Tie debt to roadmap items it unblocks.</strong> \u201cThis enables the new provider in three weeks instead of ten\u201d survives a priority review.",
                "<strong>Treat risk separately from interest.</strong> Unowned jobs or hand-rolled security code may cost few hours a week and still be the most dangerous item on the list."
              ] },
              { t: "code", lang: "text", code:
                "Debt register line\n" +
                "\n" +
                "  ITEM       25-minute monolith build\n" +
                "  INTEREST   ~20 eng-hours/sprint waiting on CI (measured\n" +
                "             from pipeline logs, 6-sprint average)\n" +
                "  PRINCIPAL  ~5 eng-weeks (split build, cache deps)\n" +
                "  PAYBACK    200h / 20h = ~10 sprints\n" +
                "  UNBLOCKS   faster incident fixes; Q2 deploy-frequency KR\n" +
                "  OWNER      build-tools rota    REVIEW  each quarter"
              },
              { t: "note", variant: "trap", html: "<strong>The annual \u201cdebt sprint\u201d is the first thing cancelled under pressure</strong>, and even when it happens it tends to fund whatever the loudest engineer cares about rather than what returns the most." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cProduct wants features, you think debt is slowing you down\u201d \u2014 bring the interest figure, the payback, and the roadmap item it unblocks, then ask for a bounded allocation rather than a quarter." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you convinced the business to invest in tech debt.\u201d Name the interest you measured and the payback. The " + COMPASS_ANATOMY + " helps reuse this for influence prompts." },
              { t: "note", variant: "key", html: "<strong>Price debt as principal and interest, then fund it like a portfolio.</strong> Measure the hours each item costs, pay the high-interest, low-principal items first, keep a standing allocation, and treat incident or security risk as a separate reason to fund \u2014 hours alone will always undervalue it." }
            ]
          },
          {
            id: "platform-investment",
            title: "Making the case for platform investment",
            summary: "A platform is a product with internal customers. The case rests on measured cost today, pilot evidence, and adoption you can earn without a mandate.",
            minutes: 9,
            tags: ["invest", "platform"],
            blocks: [
              { t: "p", html: "Platform proposals are often rejected for the right reason: they describe what will be built rather than what it is worth. <strong>The case for a platform is the cost it removes from other teams, proven on a pilot</strong>, and the adoption it can win on merit. A platform that needs a mandate to be used is telling you something." },
              { t: "table",
                headers: ["Claim", "Evidence that makes it credible"],
                rows: [
                  ["Teams waste time on this today", "Hours measured from tickets, surveys or pipeline data, per team per month"],
                  ["The platform removes that time", "A pilot team\u2019s before-and-after numbers"],
                  ["Teams will adopt it", "Named early adopters, and adoption without a mandate"],
                  ["It is cheaper than the status quo", "Platform team cost against hours saved, over two to three years"],
                  ["It reduces risk", "Incidents or audit findings traceable to the inconsistency it removes"]
                ]
              },
              { t: "ul", items: [
                "<strong>Start with one painful, common path.</strong> A golden path for deploying a service beats a general-purpose platform nobody asked for.",
                "<strong>Treat internal teams as customers.</strong> Docs, support, a roadmap they can influence, and the freedom to not use it.",
                "<strong>Measure adoption and time-to-first-success.</strong> Those are the platform\u2019s product metrics.",
                "<strong>Say what you will stop supporting.</strong> The savings only arrive when the old paths are retired."
              ] },
              { t: "code", lang: "text", code:
                "Investment case \u2014 deployment platform (one page)\n" +
                "\n" +
                "  PROBLEM   14 teams maintain their own pipelines; measured\n" +
                "            ~30 eng-hours/team/month on pipeline upkeep\n" +
                "  PILOT     2 teams, 8 weeks: upkeep 30h -> 6h/month;\n" +
                "            deploy lead time 2d -> 3h\n" +
                "  ASK       4 engineers for 12 months\n" +
                "  RETURN    14 teams x 24h saved = ~336h/month (~2 FTE),\n" +
                "            break-even in ~2 years on hours alone if all\n" +
                "            14 adopt; faster incident fixes not counted\n" +
                "  ADOPTION  6 teams committed; no mandate requested\n" +
                "  RETIRES   3 legacy pipeline templates by month 9"
              },
              { t: "compare",
                bad: { title: "Platform as a project", items: ["Feature list and architecture diagram", "Adoption by mandate", "No pilot", "Old paths kept forever"] },
                good: { title: "Platform as a product", items: ["Measured cost of the problem today", "Pilot with before-and-after numbers", "Earned adoption and named customers", "Old paths retired on a date"] }
              },
              { t: "note", variant: "trap", html: "<strong>\u201cBuild it and they will come\u201d becomes \u201cbuild it and mandate it\u201d within a year.</strong> A mandate hides whether the platform is actually better \u2014 the one fact funders most need to know." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow would you justify a platform team?\u201d or \u201cTeams keep reinventing the same thing\u201d \u2014 lead with measured cost, a pilot, and adoption without a mandate." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Pitch a shared idempotency service to a VP in five sentences: the cost today, the pilot, the ask, the return, and what gets retired." },
              { t: "note", variant: "key", html: "<strong>Fund platforms on evidence, and earn adoption.</strong> Measure the cost teams carry today, prove the saving on a pilot, treat internal teams as customers who could say no, and retire the old paths \u2014 that is where the return actually comes from." },
              { t: "quiz", id: "strategy-invest" }
            ]
          }
        ]
      },

      /* ==================== MODULE 3 · PLANNING ==================== */
      {
        id: "planning",
        name: "Planning Under Uncertainty",
        icon: "diamond",
        lessons: [
          {
            id: "estimation",
            title: "Estimation and planning under uncertainty",
            summary: "Estimate in ranges tied to named unknowns, reduce the unknowns first, and say when the range will narrow.",
            minutes: 10,
            tags: ["planning", "estimation"],
            blocks: [
              { t: "p", html: "Every single-number estimate on uncertain work is wrong; the only question is in which direction and by how much. <strong>A range tied to named unknowns is more useful</strong> \u2014 it tells the listener both the plan and what drives its risk \u2014 and committing to when the range will narrow makes it something they can plan around." },
              { t: "table",
                headers: ["Technique", "Use when", "Trap"],
                rows: [
                  ["Three-point estimate", "Work has a long pessimistic tail", "Treating the most likely value as the plan"],
                  ["Reference class", "Similar past projects exist", "Assuming this project is the exception"],
                  ["Spike first", "One unknown dominates the range", "Spikes that run open-ended"],
                  ["Decomposition", "Work is large but familiar", "Missing integration and testing time between pieces"],
                  ["Throughput forecasting", "A team with stable history on similar-sized items", "Mixing very different item sizes"]
                ]
              },
              { t: "code", lang: "text", code:
                "Three-point estimate \u2014 provider migration\n" +
                "\n" +
                "  optimistic   4 wk   sandbox works, no API gaps\n" +
                "  most likely  6 wk\n" +
                "  pessimistic 14 wk   refund API missing; manual fallback\n" +
                "\n" +
                "  weighted mean = (4 + 4x6 + 14) / 6 = 42 / 6 = 7 wk\n" +
                "\n" +
                "  SAY: \"6 to 10 weeks, most likely around 7. The range\n" +
                "  narrows to +/- 1 week once we have sandbox access,\n" +
                "  expected by 25 Oct.\""
              },
              { t: "ul", items: [
                "<strong>Retire the biggest unknown first.</strong> A two-day spike that removes the pessimistic tail is worth more than any amount of careful estimation of the rest.",
                "<strong>Make the buffer explicit.</strong> Hidden padding gets discovered and spent; a named contingency can be defended.",
                "<strong>Re-estimate at milestones, not on request.</strong> A predictable cadence stops estimates becoming negotiations.",
                "<strong>Look back at your own history.</strong> If your projects run 40% over on average, that is your reference class whether you like it or not."
              ] },
              { t: "note", variant: "trap", html: "<strong>Single-number commitments made under pressure become the baseline everyone remembers.</strong> The range you explained afterwards is forgotten; the number from the first meeting is not." },
              { t: "note", variant: "warn", html: "<strong>Beware the anchor in the question.</strong> \u201cThis should take about a month, right?\u201d pulls every estimate towards a month. Estimate before you hear the number, or say explicitly that you are ignoring it." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Estimates their own tasks and flags when they will miss."],
                  ["Senior", "Gives ranges tied to named unknowns, runs spikes on the biggest one, and re-estimates at milestones."],
                  ["Staff", "Plans multi-team work using reference classes and throughput history, and makes uncertainty visible to executives without losing their confidence."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow long will this take?\u201d, \u201cYour estimate was badly wrong \u2014 what happened?\u201d, or \u201cThe CEO wants a date\u201d \u2014 answer with a range, its drivers, and when it narrows." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time an estimate you gave was badly wrong.\u201d Name what you did not know, when you found out, and what you now do differently. Keep the landing measurable with the " + COMPASS_SALT + "." },
              { t: "note", variant: "key", html: "<strong>Ranges with reasons beat numbers with hope.</strong> Name the unknowns that drive the range, spend effort retiring the largest one first, make buffers explicit, and commit to when the estimate will narrow \u2014 that is a plan people can actually use." }
            ]
          },
          {
            id: "risk-registers",
            title: "Risk registers that change decisions",
            summary: "A risk entry earns its place when it has a mechanism, an owner, a trigger and a pre-decided action \u2014 otherwise it is a worry list.",
            minutes: 8,
            tags: ["planning", "risk"],
            blocks: [
              { t: "p", html: "Most risk registers are filled in at kickoff and read at the postmortem. A register that steers is different: <strong>every entry has a trigger that someone is watching and an action already agreed</strong>, so when the trigger fires nobody convenes a meeting \u2014 they just do the thing. This builds on <a class='inline' href='#/hld/framing/assumptions-risks'>assumptions, risks and decision triggers</a>." },
              { t: "table",
                headers: ["Field", "Weak", "Strong"],
                rows: [
                  ["Statement", "Vendor risk", "If the sandbox lacks the refund API by 1 Nov, refunds slip three weeks"],
                  ["Likelihood \u00d7 impact", "High", "Medium likelihood, three-week slip to a contracted date"],
                  ["Owner", "Team", "Ana"],
                  ["Trigger", "Monitor", "No sandbox access by 25 Oct"],
                  ["Action", "Escalate", "Start the manual-refund fallback; tell the account owner the same day"],
                  ["Closes when", "\u2014", "Refund call succeeds end to end in the sandbox"]
                ]
              },
              { t: "ul", items: [
                "<strong>Keep it short.</strong> Eight live risks with owners beat forty with none; the long tail can live in an appendix.",
                "<strong>Review it on a cadence, in the program meeting.</strong> A risk that is never discussed is not being managed.",
                "<strong>Retire risks visibly.</strong> Closing a risk is progress, and showing it builds confidence in the rest of the register.",
                "<strong>Separate risks from issues.</strong> A risk might happen; an issue already has. Issues need owners and dates, not likelihoods."
              ] },
              { t: "code", lang: "text", code:
                "Risk register \u2014 provider migration (top 3 of 7)\n" +
                "\n" +
                "  R1  refund API missing in sandbox     owner Ana\n" +
                "      trigger: no access by 25 Oct\n" +
                "      action:  manual-refund fallback; notify account\n" +
                "  R2  duplicate charges on retry        owner Ravi\n" +
                "      trigger: >0.01% in shadow traffic for 3 days\n" +
                "      action:  halt cutover; idempotency fix first\n" +
                "  R3  finance freeze from 20 Dec        owner Lin\n" +
                "      trigger: cutover not done by 13 Dec\n" +
                "      action:  defer to January; no exceptions"
              },
              { t: "compare",
                bad: { title: "Register as compliance", items: ["Written at kickoff, read at the postmortem", "Owners are teams", "\u201cMonitor\u201d as the action", "Forty entries, none ranked"] },
                good: { title: "Register as a steering tool", items: ["Reviewed in every program meeting", "One named owner per risk", "Measurable trigger and a pre-agreed action", "Short, ranked, and visibly retired"] }
              },
              { t: "note", variant: "trap", html: "<strong>\u201cEscalate\u201d is not an action.</strong> It postpones the decision to the moment you have the least time to make it. Decide now what you will do when the trigger fires, and escalate the decision itself today if it is not yours." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cWhat are the risks in this plan?\u201d is an invitation to give two or three entries with triggers and actions \u2014 not a list of worries." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Give the top risk for a migration you know in one sentence each for statement, owner, trigger and action." },
              { t: "note", variant: "key", html: "<strong>A risk is managed when its trigger and action are decided in advance.</strong> Name a person, a measurable trigger and the action that follows, review the register in the regular cadence, and retire risks visibly \u2014 a register that only records worries changes nothing." }
            ]
          },
          {
            id: "budget-headcount",
            title: "Budget and headcount planning",
            summary: "Headcount is the slowest and most expensive resource. Plan with ramp time, onboarding cost and attrition, and tie every ask to an outcome.",
            minutes: 9,
            tags: ["planning", "budget", "headcount"],
            blocks: [
              { t: "p", html: "Headcount requests usually arrive as a number: \u201cwe need six more engineers.\u201d The request that gets funded arrives as <strong>a gap between demand and capacity, tied to outcomes the business wants</strong>, with honest arithmetic about how long new people take to help." },
              { t: "table",
                headers: ["Line in the plan", "The question it answers"],
                rows: [
                  ["Demand", "What committed and strategic work needs doing, in engineer-quarters?"],
                  ["Current capacity", "What can the team deliver after on-call, support and maintenance?"],
                  ["Ramp", "How long until new hires are productive \u2014 and what do they cost existing engineers meanwhile?"],
                  ["Attrition", "How many people are you likely to lose and need to replace?"],
                  ["Mix", "Which levels and skills does the gap actually need?"],
                  ["Alternatives", "What would you cut, buy or defer if the answer is no?"]
                ]
              },
              { t: "code", lang: "text", code:
                "Capacity, next two quarters \u2014 8 engineers today\n" +
                "\n" +
                "  gross                       8 x 2 qtr  = 16.0 eng-qtr\n" +
                "  less on-call & support (25%)          = -4.0\n" +
                "  less attrition (1 leaver, end of Q1)  = -1.0\n" +
                "  + 3 hires starting early Q1,\n" +
                "    ramping to ~25% in Q1 and ~75% in Q2 = +3.0\n" +
                "  less onboarding drag on team          = -0.75\n" +
                "  net capacity                          ~ 13.25 eng-qtr\n" +
                "\n" +
                "  demand (committed + strategy)         ~ 17 eng-qtr\n" +
                "  gap ~ 3.75 -> defer search rebuild, or fund 2 more"
              },
              { t: "ul", items: [
                "<strong>Show the alternatives.</strong> \u201cWithout these hires we defer the search rebuild by two quarters\u201d makes the decision the business\u2019s, which is where it belongs.",
                "<strong>Ask for the level mix the work needs.</strong> Hiring only juniors to save cost can lower capacity once mentoring load is counted.",
                "<strong>Plan the hiring pipeline, not just the number.</strong> If hiring takes three months, a Q2 need is a Q4 start.",
                "<strong>Count non-headcount levers.</strong> Buying a tool or cutting a low-value service can close part of the gap faster."
              ] },
              { t: "note", variant: "trap", html: "<strong>Assuming new hires are productive from day one is the most common planning error.</strong> The team is often slower for a period after growing, because existing engineers are interviewing, onboarding and reviewing." },
              { t: "note", variant: "warn", html: "<strong>Adding people to late work rarely saves it.</strong> Onboarding and coordination costs arrive before any benefit; in the final month they often dominate." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow would you justify more headcount?\u201d or \u201cYour budget was cut 20% \u2014 what do you do?\u201d Show demand against capacity, the ramp arithmetic, and what you would cut or defer." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Your budget is cut by two engineers. Say what you defer, what you stop supporting, and how you tell the team, in four sentences." },
              { t: "note", variant: "key", html: "<strong>Ask for headcount as a capacity gap tied to outcomes.</strong> Count on-call, attrition, ramp time and onboarding drag honestly, show what you would defer if the answer is no, and plan the hiring pipeline as well as the number." },
              { t: "quiz", id: "strategy-planning" }
            ]
          }
        ]
      },

      /* ==================== MODULE 4 · EXECUTION ==================== */
      {
        id: "execution",
        name: "Execution and Communication",
        icon: "share",
        lessons: [
          {
            id: "rfc-review",
            title: "RFCs and design review that scale",
            summary: "Write it down for decisions that are hard to reverse or cross team boundaries; keep review fast, time-boxed, and owned.",
            minutes: 9,
            tags: ["execution", "rfc", "design-review"],
            blocks: [
              { t: "p", html: "An RFC process is a way of making consequential decisions in writing, with the right people, before the code exists. It fails in two directions: <strong>too little, and one-way doors are decided in a hallway; too much, and every change waits on a committee</strong>. The scaling rule is the same as for <a class='inline' href='#/hld/execution/adr-leadership'>decision records</a>: effort proportional to reversibility and blast radius." },
              { t: "table",
                headers: ["RFC section", "Purpose"],
                rows: [
                  ["Problem and context", "Why now, and what happens if we do nothing"],
                  ["Proposal", "The design, at the altitude reviewers need"],
                  ["Alternatives", "What else was considered, and why it lost"],
                  ["Risks and rollout", "Failure modes, rollback, migration, and who is affected"],
                  ["Open questions", "What the author wants reviewers to focus on"],
                  ["Decision", "Who decided, what, and when \u2014 filled in at the end"]
                ]
              },
              { t: "ol", items: [
                "<strong>Decide whether it needs an RFC.</strong> Hard to reverse, or crosses another team\u2019s interface, data or on-call? Then yes. Otherwise, a pull request is enough.",
                "<strong>Name the decider and the required reviewers up front.</strong> Optional reviewers comment; required ones must respond.",
                "<strong>Time-box the review.</strong> One to two weeks, then a decision meeting if comments have not converged.",
                "<strong>Record the decision and the rejected options.</strong> The RFC becomes the decision record."
              ] },
              { t: "compare",
                bad: { title: "Review as a gate on everything", items: ["Every change needs an RFC", "No decider named", "Open-ended comment threads", "Approval by whoever is most senior in the room"] },
                good: { title: "Review that scales", items: ["Threshold by reversibility and blast radius", "Named decider and required reviewers", "Time-boxed, then a decision meeting", "Outcome recorded with the rejected options"] }
              },
              { t: "note", variant: "trap", html: "<strong>A design review that nobody can say no in is a presentation.</strong> If reviewers only ever suggest tweaks, either the threshold is too low or the decision was made before the document was written." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you make architecture decisions across teams?\u201d or \u201cYour review process is slowing everyone down\u201d \u2014 talk about the threshold, the named decider and the time box." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Describe the one-sentence rule you would use to decide which changes need an RFC, and defend it against someone who wants every database change reviewed." },
              { t: "note", variant: "key", html: "<strong>Scale review effort to reversibility and blast radius.</strong> Write RFCs for one-way doors and cross-team changes, name the decider, time-box the review and record the outcome with its rejected options \u2014 everything else ships through ordinary code review." }
            ]
          },
          {
            id: "exec-communication",
            title: "Communicating to executives: one-pagers and status",
            summary: "Decision and impact first, mechanism on request. Status colours need criteria, or they stay green until they are red.",
            minutes: 9,
            tags: ["execution", "communication", "status"],
            blocks: [
              { t: "p", html: "Executives read the first two lines and decide whether to read the rest. That makes the <strong>opening the whole message</strong>: what you need them to know or decide, the impact, and the ask. Everything else is supporting evidence for whoever wants it. This extends <a class='inline' href='#/hld/execution/executive-hld'>executive-friendly storytelling</a> from designs to ongoing programs." },
              { t: "table",
                headers: ["Status", "Means \u2014 written down in advance", "What you owe the reader"],
                rows: [
                  ["Green", "All milestones within plan; no risk trigger has fired", "Nothing beyond the regular update"],
                  ["Amber", "A milestone is at risk or a trigger has fired; recovery is within the team\u2019s control", "The cause, the recovery plan, and the date you will know"],
                  ["Red", "A committed date or outcome will be missed without a decision from above", "Options, a recommendation, and the specific decision needed"]
                ]
              },
              { t: "code", lang: "text", code:
                "One-pager \u2014 provider migration, week 9\n" +
                "\n" +
                "  STATUS     AMBER (trigger R1 fired 25 Oct)\n" +
                "  BOTTOM LINE  card payments cut over on plan; refunds\n" +
                "             will slip 3 weeks unless we accept manual\n" +
                "             refunds until 5 Dec\n" +
                "  IMPACT     ~40 refunds/day handled manually by finance ops\n" +
                "  ASK        approve manual refunds (1.5 FTE for 3 weeks)\n" +
                "             by Thursday, or accept the slip\n" +
                "  NEXT       update Monday; R2 shadow results by then\n" +
                "  APPENDIX   timeline, risk register, technical detail"
              },
              { t: "ul", items: [
                "<strong>Lead with the bottom line.</strong> If they read one sentence, it should be the one that matters.",
                "<strong>Quantify impact in their units.</strong> Revenue, customers, dates, people \u2014 not services and tickets.",
                "<strong>Make the ask explicit and dated.</strong> An update with no ask is fine; an update with a buried ask is a missed decision.",
                "<strong>Keep a steady cadence.</strong> A regular short update, even when nothing changed, is what makes the unscheduled one get read."
              ] },
              { t: "note", variant: "trap", html: "<strong>Green outside, red inside.</strong> Self-assessed colours with no criteria stay green because nobody wants to be first to go amber \u2014 until the launch misses by a month and every previous update loses its credibility at once." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cHow do you report status to leadership?\u201d or \u201cWrite the update for a slipping launch\u201d \u2014 open with the bottom line and the ask, and say what your colours mean." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> Give the first two sentences of an update for a launch that will miss by two weeks, including the decision you need." },
              { t: "note", variant: "key", html: "<strong>Bottom line, impact and ask first; evidence after.</strong> Define what each status colour means before the program starts so amber arrives early, quantify impact in the reader\u2019s units, and keep the cadence even when nothing has changed." }
            ]
          },
          {
            id: "program-management",
            title: "Running multi-team programs",
            summary: "One accountable owner, a milestone map, dependencies with an owner on each side, a decision log, and a cadence that surfaces slips early.",
            minutes: 10,
            tags: ["execution", "program-management"],
            blocks: [
              { t: "p", html: "Multi-team work fails at the seams: between teams, between plans, and between what one team assumed another would do. Program management is the discipline of <strong>making the seams visible and owned</strong> \u2014 not of adding meetings." },
              { t: "table",
                headers: ["Artifact", "Purpose", "Smell when missing"],
                rows: [
                  ["Single accountable owner", "Someone owns the whole outcome", "Each team hits its own milestones and the program still fails"],
                  ["Milestone map", "Integration points everyone works towards", "Teams finish in parallel and integrate at the end"],
                  ["Dependency board", "Each dependency has an owner on each side and a date", "Week eight discovery that a team never started its part"],
                  ["Decision log", "What was decided, by whom, and when", "The same argument reopens in every sync"],
                  ["Risk register", "Triggers and pre-agreed actions", "Escalations arrive as surprises"]
                ]
              },
              { t: "ul", items: [
                "<strong>Integrate early and often.</strong> A thin end-to-end slice in the first few weeks finds the seam problems while they are cheap.",
                "<strong>Track dependencies by name and date.</strong> \u201cPlatform team\u201d is not an owner; \u201cRavi, by 14 Nov\u201d is.",
                "<strong>Run a short, regular sync focused on what changed.</strong> Status that does not change can be read; the meeting is for slips and decisions.",
                "<strong>Escalate a dependency the moment its date is at risk.</strong> Waiting for the date to pass costs the downstream team their buffer."
              ] },
              { t: "code", lang: "text", code:
                "Dependency board \u2014 provider migration\n" +
                "\n" +
                "  needs                    from          owner   due     state\n" +
                "  refund API in sandbox    provider      Ana     25 Oct  LATE\n" +
                "  idempotency store        payments      Ravi    1 Nov   on track\n" +
                "  ledger event schema v2   finance eng   Mei     8 Nov   at risk\n" +
                "  feature flag per tenant  platform      Jo      1 Nov   done\n" +
                "\n" +
                "Every row has two named people: the one who needs it and\n" +
                "the one who owes it. Rows with one name are how programs slip."
              },
              { t: "note", variant: "trap", html: "<strong>Integrating at the end is how every team can be green and the program can still be late.</strong> The seams are where the unknowns live, so they are what you test first." },
              { t: "h", text: "How this scores at each level" },
              { t: "table",
                headers: ["Level", "What the bar actually requires"],
                rows: [
                  ["Mid", "Delivers their part on time and flags dependency risk early."],
                  ["Senior", "Runs a two- or three-team effort with a milestone map, a dependency board and an early integration slice."],
                  ["Staff", "Owns a program across many teams, sets the cadence and the decision log, and changes the plan when the triggers fire."]
                ]
              },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cTell me about a project that spanned several teams\u201d or \u201cAnother team is blocking you\u201d \u2014 name the single owner, how dependencies were tracked, and when you integrated." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you led a project across several teams.\u201d Name the seam that nearly failed and the artifact that caught it. The " + COMPASS_ANATOMY + " helps the same story answer ownership and influence prompts." },
              { t: "note", variant: "key", html: "<strong>Programs fail at the seams, so own the seams.</strong> One accountable owner, a milestone map, dependencies with a name on each side and a date, a decision log, and an early end-to-end slice \u2014 meetings are for what changed, not for reading status aloud." }
            ]
          },
          {
            id: "deprecations",
            title: "Deprecations and migrations people actually finish",
            summary: "The last 15% is the hard part. Treat a deprecation as a product with a date, do the migration for small callers, and use brownouts before the cut.",
            minutes: 10,
            tags: ["execution", "deprecation", "migration"],
            blocks: [
              { t: "p", html: "Announcing a deprecation is easy and finishing one is rare. The first 80% of callers move because it is convenient; <strong>the last few are stuck for specific reasons \u2014 no owner, no capacity, or a gap in the replacement</strong> \u2014 and an announcement does nothing for any of them. This complements <a class='inline' href='#/hld/operations/migration-strategy'>phased delivery and migration</a>, which covers the technical rollout." },
              { t: "table",
                headers: ["Phase", "What you do", "Exit criterion"],
                rows: [
                  ["Ready", "Replacement is complete for every real use case", "Top callers have tried it on real traffic"],
                  ["Announce", "Date, reason, migration guide, and a named contact", "Every known caller acknowledged"],
                  ["Migrate", "Tooling, office hours, and doing it yourself for small callers", "Remaining-caller count trending to zero"],
                  ["Brownout", "Scheduled short outages of the old path", "Unknown callers surfaced and contacted"],
                  ["Remove", "Delete code, infrastructure and docs", "Nothing calls it; nothing pages for it"]
                ]
              },
              { t: "ul", items: [
                "<strong>Do not deprecate before the replacement is ready.</strong> Otherwise every team has a legitimate reason to wait.",
                "<strong>Publish a live list of remaining callers and owners.</strong> Visibility does most of the nudging.",
                "<strong>Do the migration for the long tail.</strong> Ten small callers each needing a day is two engineer-weeks for you, and never for them.",
                "<strong>Use brownouts before the final date.</strong> A planned ten-minute outage finds the callers no inventory knew about, while you can still turn it back on."
              ] },
              { t: "code", lang: "text", code:
                "Deprecation timeline \u2014 legacy queue client\n" +
                "\n" +
                "  wk 0   new client GA; migration guide; contact: Jo\n" +
                "  wk 2   announce: removal on wk 16\n" +
                "  wk 2+  remaining-callers dashboard (team, owner, count)\n" +
                "  wk 8   we migrate the 9 smallest callers ourselves\n" +
                "  wk 12  brownout 1: 10 min, announced 1 week ahead\n" +
                "  wk 14  brownout 2: 1 hour\n" +
                "  wk 16  remove; delete infra; close the runbook"
              },
              { t: "note", variant: "trap", html: "<strong>Repeating the announcement is not a strategy for the last 15%.</strong> Each stuck caller is stuck for a reason; find the reason by name and remove it." },
              { t: "cue", html: "<strong>Spotting it in a prompt.</strong> \u201cA migration is 85% done and stalled\u201d or \u201cHow do you retire a widely used system?\u201d \u2014 the strong answer names callers individually, offers to do the work, and uses brownouts before the cut." },
              { t: "note", variant: "tip", html: "<strong>Say it out loud.</strong> \u201cTell me about a time you shut down a system people depended on.\u201d Name how you found the last callers and what you did for them. Use the " + COMPASS_SALT + " so the landing includes what was actually removed." },
              { t: "note", variant: "key", html: "<strong>A deprecation is finished when the code is deleted.</strong> Ship a complete replacement first, publish the remaining callers by name, migrate the long tail yourself, and use announced brownouts to find the callers nobody knew about \u2014 before the final date, not on it." },
              { t: "quiz", id: "strategy-execution" }
            ]
          }
        ]
      }
    ]
  };
})();
