/* =====================================================================
   BEACON · Incident simulator  (route: #/simulator)
   window.BeaconSimulator = { mount(main) }

   Turn-based and fully local: every action advances a simulated clock,
   so nothing here uses timers or the network. Alerts fire, you choose
   moves as the responder, and the run ends with a scored timeline and a
   draft blameless postmortem.
   ===================================================================== */
(function () {
  "use strict";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) el.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null || kid === false) continue;
      el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stamp(t) { return "T+" + pad(Math.floor(t / 60)) + ":" + pad(Math.round(t % 60)); }
  function pct(x, d) { return (x * 100).toFixed(d == null ? 1 : d) + "%"; }
  function has(arr, v) { return arr.indexOf(v) !== -1; }

  /* ---------------- model ---------------- */
  var SLO = 0.999;
  var WINDOW_MIN = 30 * 24 * 60;
  var BUDGET_BAD_MIN = (1 - SLO) * WINDOW_MIN; // 43.2 fully-bad minutes per 30 days
  var TIME_CAP = 180;

  var ACTIONS = [
    { id: "ack", group: "Coordinate", label: "Acknowledge the page", cost: 1 },
    { id: "declare", group: "Coordinate", label: "Declare an incident + severity", cost: 2 },
    { id: "roles", group: "Coordinate", label: "Assign commander, comms, scribe", cost: 2 },
    { id: "status", group: "Coordinate", label: "Post a status update", cost: 3 },
    { id: "escalate", group: "Coordinate", label: "Page the owning or vendor team", cost: 4 },
    { id: "dash", group: "Investigate", label: "Check the SLO dashboard", cost: 3 },
    { id: "changes", group: "Investigate", label: "Check recent deploys and changes", cost: 4 },
    { id: "logs", group: "Investigate", label: "Search error logs", cost: 5 },
    { id: "traces", group: "Investigate", label: "Inspect failing traces", cost: 5 },
    { id: "rollback", group: "Mitigate", label: "Roll back the last deploy", cost: 8 },
    { id: "flag", group: "Mitigate", label: "Flip a feature-flag kill switch", cost: 3 },
    { id: "restart", group: "Mitigate", label: "Restart the pods", cost: 6 },
    { id: "scale", group: "Mitigate", label: "Scale out replicas", cost: 6 },
    { id: "pool", group: "Mitigate", label: "Raise the DB connection pool", cost: 5 },
    { id: "stopjob", group: "Mitigate", label: "Pause the offending batch job", cost: 3 },
    { id: "failover", group: "Mitigate", label: "Fail traffic over to the other region", cost: 10 },
    { id: "cert", group: "Mitigate", label: "Rotate the edge TLS certificate", cost: 12 },
    { id: "wait", group: "Close", label: "Wait and watch for 10 minutes", cost: 10 },
    { id: "verify", group: "Close", label: "Verify recovery against the SLIs", cost: 5 }
  ];
  function actionById(id) { for (var i = 0; i < ACTIONS.length; i++) if (ACTIONS[i].id === id) return ACTIONS[i]; return null; }

  /* Per-scenario outcomes. kind: mitigate | partial | harm | none.
     needs: a fact you must have discovered for the move to work. */
  var SCENARIOS = [
    {
      id: "bad-deploy", title: "Checkout errors after a Friday deploy", service: "checkout-api",
      brief: "It is 14:05 on a Friday. Your pager goes off for checkout-api: the fast burn-rate alert and the 5xx ratio alert fired together.",
      impact0: 0.18, growth: 0, cap: 0.18, p99: 1400, sat: 0.55,
      alerts: [["CheckoutSLOBurnFast", "14.4x burn over 1h and 5m", "page"], ["Checkout5xxRatioHigh", "5xx above 5% for 5m", "page"], ["PricingClientExceptions", "exception rate above baseline", "ticket"]],
      reveal: {
        dash: ["Errors began at 14:02, three minutes after a rollout finished. Both regions are affected equally.", ["onset-deploy"]],
        changes: ["checkout-api v2.14 finished rolling out at 14:00: a pricing-client refactor guarded by flag new-pricing-path, which shipped ON by default.", ["deploy", "flag-known"]],
        logs: ["NullPointerException in PricingClient.applyPromo for carts holding an expired promo code \u2014 about 18% of carts.", ["defect"]],
        traces: ["Failing traces end in the pricing-client span with status ERROR after 1.2s. Downstream services look healthy.", ["defect"]],
        escalate: ["The pricing team joins, confirms the refactor is the likely trigger and recommends rolling back.", ["deploy"]]
      },
      effects: {
        rollback: { kind: "mitigate", log: "Rollback to v2.13 complete; the 5xx ratio is falling to baseline.", residual: 0.002 },
        flag: { kind: "mitigate", needs: "flag-known", log: "new-pricing-path switched OFF; errors drop to baseline within a minute.", residual: 0.003, miss: "You do not know which flag guards the change yet \u2014 nothing to flip." },
        restart: { kind: "none", log: "Pods restart and the errors resume within a minute: the bug is in the code, not in process state." },
        scale: { kind: "none", log: "More replicas, same bug. The error ratio is unchanged and the bill went up." },
        failover: { kind: "harm", log: "Both regions run v2.14, so failover just moves the errors and adds cold-cache latency.", add: 0.02 },
        pool: { kind: "none", log: "The connection pool is at 30% \u2014 raising it changes nothing." },
        stopjob: { kind: "none", log: "No batch jobs touch checkout right now." },
        cert: { kind: "none", log: "Certificates are valid for another 64 days." }
      },
      rootCause: "a code defect in checkout-api v2.14 (a pricing-client refactor) that threw on carts holding an expired promo code",
      factors: ["The new code path shipped enabled by default instead of being ramped behind its flag.", "There was no canary stage: v2.14 went to 100% of both regions in one step.", "Tests had no case for expired promo codes."],
      lucky: "Only carts with an expired promo code hit the bug; a broader trigger would have taken checkout down completely.",
      items: [["P1", "Add a canary stage with SLO-based automatic rollback", "Release engineering"], ["P1", "Ship risky code paths default-off and ramp them with the flag", "Checkout team"], ["P2", "Add a regression test for expired promo codes", "Checkout team"]]
    },
    {
      id: "db-pool", title: "Orders API slowing to a crawl", service: "orders-api",
      brief: "09:42 on a Tuesday. orders-api latency is climbing and timeouts are rising. It is getting worse every minute.",
      impact0: 0.06, growth: 0.004, cap: 0.35, p99: 3800, sat: 1.0,
      alerts: [["OrdersLatencySLOBurn", "p99 above 1s on 30% of requests", "page"], ["OrdersTimeoutsRising", "client timeouts above 5%", "page"], ["OrdersDBPoolSaturated", "100/100 connections in use", "ticket"]],
      reveal: {
        dash: ["Latency has climbed since 09:40. The DB connection pool is pinned at 100/100 and database CPU sits at 92%.", ["pool"]],
        changes: ["No deploys in 26 hours. A new monthly-revenue-report job was scheduled for 09:35 by the finance squad.", ["job"]],
        logs: ["Thousands of 'timed out waiting for a connection from the pool'. The slow-query log shows a 40s full-table scan from monthly-revenue-report.", ["job", "slowquery"]],
        traces: ["Request spans spend 3\u20135s in db.pool.acquire before their query even starts.", ["pool"]],
        escalate: ["The DBA on call finds the report query (full scan, missing index) and recommends stopping it.", ["job", "slowquery"]]
      },
      effects: {
        stopjob: { kind: "mitigate", needs: "job", log: "monthly-revenue-report paused; the pool drains and p99 returns to 180ms.", residual: 0.002, miss: "Which job? You have not identified one yet." },
        pool: { kind: "harm", log: "Pool raised to 200: the database hits max_connections and CPU 100%. Latency gets worse.", add: 0.08 },
        restart: { kind: "partial", log: "Restarts drain the queued requests: latency briefly improves, then the pool refills within four minutes.", drop: 0.05 },
        scale: { kind: "harm", log: "More replicas open more connections against the same saturated database. Timeouts rise.", add: 0.05 },
        rollback: { kind: "none", log: "Nothing was deployed recently, so the rollback is a no-op." },
        flag: { kind: "none", log: "No flag guards this code path." },
        failover: { kind: "none", log: "Both regions use the same primary database. No change." },
        cert: { kind: "none", log: "Certificates are fine." }
      },
      rootCause: "a newly scheduled reporting job running a full-table scan on the primary database, exhausting the shared connection pool",
      factors: ["A reporting workload ran against the primary OLTP database instead of a replica or the warehouse.", "There was no per-client connection budget, so one job could take the whole pool.", "Pool saturation only raised a ticket; the first page came when users were already hurting."],
      lucky: "It started at 09:40, not at the 12:00 order peak.",
      items: [["P1", "Move reporting workloads to a read replica or the warehouse", "Finance data team"], ["P1", "Add per-client connection limits and statement timeouts", "Platform DB"], ["P2", "Page on pool saturation sustained for 10 minutes", "SRE"]]
    },
    {
      id: "cert-expiry", title: "The mobile app cannot reach the API", service: "api-edge",
      brief: "00:20 on a Sunday. Synthetic probes and the edge availability SLO are both paging. Web traffic looks normal.",
      impact0: 0.35, growth: 0, cap: 0.35, p99: 250, sat: 0.3,
      alerts: [["EdgeAvailabilitySLOBurn", "35% of requests failing", "page"], ["SyntheticProbeFailing", "m-api.shop.example TLS check", "page"]],
      reveal: {
        dash: ["Every failure is on the mobile hostname m-api.shop.example. Web traffic is healthy and server-side 5xx is near zero.", ["edge"]],
        changes: ["No deploys. The certificate inventory shows m-api.shop.example expiring today at 00:00 UTC.", ["cert"]],
        logs: ["Edge logs: 'TLS handshake error: certificate has expired' for m-api.shop.example.", ["cert"]],
        traces: ["No traces exist for the failing requests \u2014 they never reach the application. The absence is the clue.", ["edge"]],
        escalate: ["The edge team confirms automated renewal has been failing for 30 days on a DNS validation error.", ["cert"]]
      },
      effects: {
        cert: { kind: "mitigate", log: "A new certificate is issued and pushed to the edge. Handshakes succeed again.", residual: 0.001 },
        rollback: { kind: "none", log: "There is no recent deploy to roll back." },
        restart: { kind: "none", log: "Restarted edge pods present the same expired certificate." },
        scale: { kind: "none", log: "More edge capacity, same expired certificate." },
        failover: { kind: "none", log: "The other region serves the same expired certificate." },
        pool: { kind: "none", log: "Database pools are irrelevant here." },
        stopjob: { kind: "none", log: "No batch job is involved." },
        flag: { kind: "none", log: "No flag controls TLS termination." }
      },
      rootCause: "an expired TLS certificate on the mobile API hostname after automated renewal failed silently",
      factors: ["Automated renewal had been failing silently for 30 days.", "Nothing alerted on certificates expiring within two weeks.", "Synthetic checks covered the web hostname long before the mobile one."],
      lucky: "Web checkout stayed up because it used a different certificate.",
      items: [["P1", "Alert on any certificate expiring within 21 days", "SRE"], ["P1", "Alert on renewal-job failures", "Platform"], ["P2", "Inventory every hostname and add a synthetic probe per hostname", "SRE"]]
    },
    {
      id: "region-dep", title: "Payments failing in one region", service: "payments-api",
      brief: "18:10 on a Thursday. The payments SLO is burning and accelerating. A provider-error ticket opened a few minutes earlier.",
      impact0: 0.22, growth: 0, cap: 0.22, p99: 2600, sat: 0.4,
      alerts: [["PaymentsSLOBurn", "6x burn over 6h and 30m, accelerating", "page"], ["PSPClientErrors", "provider errors in us-east", "ticket"]],
      reveal: {
        dash: ["Errors come only from us-east (about 45% of traffic). eu-west is healthy and has headroom.", ["region"]],
        changes: ["No deploys in three days. The provider's status feed shows degraded performance on its us-east endpoint.", ["vendor"]],
        logs: ["Upstream 503s and timeouts from psp-us-east.pay.example. Retries are tripling outbound calls.", ["vendor"]],
        traces: ["psp.charge spans time out at 2s and each request retries three times, so failing calls take 6s or more.", ["vendor", "retries"]],
        escalate: ["Provider support confirms an incident in their us-east region. No ETA yet.", ["vendor"]]
      },
      effects: {
        failover: { kind: "mitigate", needs: "region", log: "us-east payment traffic now routes through eu-west. Errors fall to baseline.", residual: 0.004, miss: "Fail over where? You have not confirmed which region is bad." },
        flag: { kind: "mitigate", needs: "vendor", log: "queue-payments degraded mode is ON: charges are accepted and settled later. Errors drop.", residual: 0.01, miss: "Without knowing the provider is the problem, you have no reason to pick a degraded mode." },
        scale: { kind: "harm", log: "More replicas mean more retries against a struggling provider. Errors rise.", add: 0.03 },
        restart: { kind: "none", log: "Restarted pods hit the same degraded provider." },
        rollback: { kind: "none", log: "Nothing was deployed recently." },
        pool: { kind: "none", log: "The database is healthy." },
        stopjob: { kind: "none", log: "No batch job is involved." },
        cert: { kind: "none", log: "Certificates are valid." }
      },
      rootCause: "a regional degradation at the third-party payment provider, amplified by client retries without a budget",
      factors: ["Each region used a single provider endpoint with no automatic failover.", "Client retries had no budget and amplified load on the degraded provider.", "The provider-error alert was a ticket rather than feeding the SLO page."],
      lucky: "eu-west had enough headroom to absorb the failed-over traffic.",
      items: [["P1", "Automate regional failover for the provider client", "Payments"], ["P1", "Add a retry budget and circuit breaker to the provider client", "Payments"], ["P2", "Run a game day for a provider regional outage", "SRE"]]
    }
  ];

  /* ---------------- state ---------------- */
  var main = null;
  var scenIdx = 0;
  var S = null;

  function fresh(sc) {
    return {
      sc: sc, t: 0, impact: sc.impact0, peak: sc.impact0, bad: 0,
      acked: null, declared: null, sev: null, roles: false, statuses: [],
      facts: [], factLog: [], log: [], harmful: 0, wasted: 0, firstFactAt: null,
      mitigated: null, verified: null, escalated: false, ended: false, used: {}
    };
  }
  function note(kind, text) { S.log.push({ t: S.t, kind: kind, text: text }); }

  function advance(minutes) {
    var sc = S.sc;
    for (var i = 0; i < minutes; i++) {
      S.bad += S.impact;
      S.t += 1;
      if (!S.mitigated && sc.growth) S.impact = Math.min(sc.cap + 0.1, S.impact + sc.growth);
      if (S.impact > S.peak) S.peak = S.impact;
      if (!S.acked && !S.escalated && S.t >= 5) {
        S.escalated = true;
        note("warn", "No acknowledgement in 5 minutes \u2014 the page escalated to the secondary on-call.");
      }
    }
  }

  function act(id) {
    if (!S || S.ended) return;
    var a = actionById(id);
    if (!a) return;
    var sc = S.sc;
    advance(a.cost);
    S.used[id] = (S.used[id] || 0) + 1;

    if (id === "ack") {
      if (S.acked != null) note("dim", "Already acknowledged.");
      else { S.acked = S.t; note("ok", "Page acknowledged. You own this until you hand it off."); }
    } else if (id === "declare") {
      if (S.declared != null) note("dim", "The incident is already declared as " + S.sev + ".");
      else {
        S.declared = S.t;
        S.sev = S.impact >= 0.25 ? "SEV1" : "SEV2";
        note("ok", "Incident declared as " + S.sev + " for " + sc.service + ". Channel #inc-" + sc.service + " opened.");
      }
    } else if (id === "roles") {
      if (S.roles) note("dim", "Roles are already assigned.");
      else { S.roles = true; note("ok", "You take incident command; a comms lead and a scribe are assigned. The scribe starts the timeline."); }
    } else if (id === "status") {
      S.statuses.push(S.t);
      note("ok", "Status update posted: impact, what we know, next update in 30 minutes.");
    } else if (id === "wait") {
      note(S.mitigated ? "dim" : "warn", S.mitigated ? "You watch the graphs. They stay flat." : "You watch the graphs while users keep failing. Nothing changes by itself.");
    } else if (id === "verify") {
      if (S.mitigated != null) {
        S.verified = S.t;
        note("ok", "SLIs are back inside the SLO for 5 minutes and burn alerts have resolved. Incident mitigated; root-cause work moves to the postmortem.");
        finish();
        return;
      }
      note("err", "SLIs are still burning \u2014 the error ratio is " + pct(S.impact) + ". Not recovered.");
    } else if (sc.reveal[id]) {
      var r = sc.reveal[id];
      var fresh2 = r[1].filter(function (f) { return !has(S.facts, f); });
      if (id === "escalate") { note("ok", "Paged the owning team. " + r[0]); }
      else note(fresh2.length ? "head" : "dim", (fresh2.length ? "" : "(nothing new) ") + r[0]);
      if (fresh2.length) {
        fresh2.forEach(function (f) { S.facts.push(f); });
        if (S.firstFactAt == null) S.firstFactAt = S.t;
        if (!has(S.factLog, r[0])) S.factLog.push(r[0]);
      }
    } else {
      var e = sc.effects[id] || { kind: "none", log: "That has no visible effect." };
      if (S.mitigated != null && e.kind !== "harm") {
        note("dim", "Already mitigated \u2014 extra changes now only add risk.");
      } else if (e.needs && !has(S.facts, e.needs)) {
        S.wasted += a.cost;
        note("warn", e.miss || "You lack the information to do that safely.");
      } else if (e.kind === "mitigate") {
        S.impact = e.residual;
        S.mitigated = S.t;
        note("ok", e.log + " Now verify recovery.");
      } else if (e.kind === "partial") {
        S.impact = Math.max(0.03, S.impact - (e.drop || 0.05));
        S.wasted += a.cost;
        note("warn", e.log);
      } else if (e.kind === "harm") {
        S.harmful++;
        S.impact = Math.min(0.6, S.impact + (e.add || 0.03));
        if (S.impact > S.peak) S.peak = S.impact;
        note("err", e.log);
      } else {
        S.wasted += a.cost;
        note("dim", e.log);
      }
    }
    if (!S.ended && S.t >= TIME_CAP) {
      note("err", "Three hours in. Leadership calls a hand-off to a fresh team; the run ends here.");
      finish();
      return;
    }
    render();
  }

  function finish() { S.ended = true; render(); }

  /* ---------------- scoring + postmortem ---------------- */
  function score() {
    var parts = [];
    function add(label, got, max, why) { parts.push({ label: label, got: got, max: max, why: why }); }
    var a = S.acked;
    add("Acknowledged fast", a == null ? 0 : a <= 5 ? 15 : a <= 10 ? 8 : 0, 15, a == null ? "never acknowledged" : "acked at " + stamp(a));
    add("Declared early", S.declared != null && S.declared <= 10 ? 10 : S.declared != null ? 5 : 0, 10, S.declared == null ? "never declared" : "declared at " + stamp(S.declared));
    add("Roles assigned", S.roles ? 5 : 0, 5, S.roles ? "commander, comms and scribe" : "you did everything alone");
    var looked = S.mitigated != null && S.firstFactAt != null && S.firstFactAt <= S.mitigated;
    add("Looked before acting", looked ? 10 : 0, 10, looked ? "evidence before the fix" : "mitigation without evidence (or none)");
    var m = S.mitigated;
    add("Time to mitigate", m == null ? 0 : m <= 20 ? 25 : m <= 35 ? 18 : m <= 60 ? 10 : 4, 25, m == null ? "not mitigated" : "mitigated at " + stamp(m));
    var end = m == null ? S.t : m;
    var firstOk = S.statuses.length && S.statuses[0] <= (S.declared != null ? S.declared : 0) + 15;
    var gapOk = true, prev = S.statuses.length ? S.statuses[0] : 0;
    for (var i = 1; i < S.statuses.length; i++) { if (S.statuses[i] - prev > 30 && S.statuses[i] <= end) gapOk = false; prev = S.statuses[i]; }
    if (S.statuses.length && end - prev > 30) gapOk = false;
    add("Communicated", !S.statuses.length ? 0 : firstOk && gapOk ? 15 : 8, 15, S.statuses.length ? S.statuses.length + " update(s)" + (gapOk ? "" : ", gaps over 30 min") : "no status updates");
    add("No harmful moves", Math.max(0, 10 - 5 * S.harmful), 10, S.harmful ? S.harmful + " move(s) made it worse" : "nothing made it worse");
    add("Verified recovery", S.verified != null ? 10 : 0, 10, S.verified != null ? "checked the SLIs" : "never verified");
    var total = 0; parts.forEach(function (p) { total += p.got; });
    var grade = total >= 85 ? "A" : total >= 70 ? "B" : total >= 50 ? "C" : "D";
    return { parts: parts, total: total, grade: grade };
  }

  function budgetPct() { return Math.min(999, (S.bad / BUDGET_BAD_MIN) * 100); }

  function postmortem() {
    var sc = S.sc, sres = score();
    var dur = S.mitigated != null ? S.mitigated : S.t;
    var L = [];
    L.push("POSTMORTEM (draft) \u2014 " + sc.title);
    L.push("Status: draft for review \u00b7 Blameless \u00b7 Simulated incident");
    L.push("");
    L.push("SUMMARY");
    L.push("For " + dur + " minutes " + sc.service + " failed for a peak of " + pct(S.peak) + " of requests. The trigger was " + sc.rootCause + ".");
    L.push("");
    L.push("IMPACT");
    L.push("- Severity: " + (S.sev || "not declared"));
    L.push("- Peak error ratio: " + pct(S.peak) + "; time to mitigate: " + (S.mitigated != null ? dur + " min" : "not mitigated"));
    L.push("- Error budget consumed: " + S.bad.toFixed(1) + " bad-minutes = " + budgetPct().toFixed(0) + "% of the 30-day budget for a 99.9% SLO");
    L.push("");
    L.push("TIMELINE");
    S.log.forEach(function (e) { L.push(stamp(e.t) + "  " + e.text); });
    L.push("");
    L.push("CONTRIBUTING FACTORS");
    sc.factors.forEach(function (f) { L.push("- " + f); });
    L.push("");
    L.push("WHAT WENT WELL");
    var good = [];
    if (S.acked != null && S.acked <= 5) good.push("The page was acknowledged within five minutes.");
    if (S.declared != null && S.declared <= 10) good.push("The incident was declared early, which pulled in help.");
    if (S.firstFactAt != null && S.mitigated != null && S.firstFactAt <= S.mitigated) good.push("Responders gathered evidence before changing production.");
    if (S.mitigated != null && S.mitigated <= 30) good.push("Mitigation came before root-cause analysis, limiting user impact.");
    if (S.statuses.length) good.push("Stakeholders received " + S.statuses.length + " status update(s).");
    if (!good.length) good.push("The incident was eventually handed off rather than left unowned.");
    good.forEach(function (g) { L.push("- " + g); });
    L.push("");
    L.push("WHAT WE WOULD DO DIFFERENTLY");
    var bad = [];
    if (S.acked == null || S.acked > 5) bad.push("Acknowledgement was slow; check paging-device setup and escalation timing.");
    if (S.declared == null) bad.push("No incident was declared, so roles and comms were improvised.");
    if (S.harmful) bad.push(S.harmful + " remediation attempt(s) increased impact; prefer reversible mitigations backed by evidence.");
    if (S.wasted >= 15) bad.push(S.wasted + " minutes went to moves that could not have helped; a runbook would shorten the search.");
    if (!S.statuses.length) bad.push("No status updates were sent while users were affected.");
    if (S.verified == null) bad.push("Recovery was never verified against the SLIs.");
    if (!bad.length) bad.push("Little to change in the response itself; focus on the systemic factors above.");
    bad.forEach(function (b) { L.push("- " + b); });
    L.push("");
    L.push("WHERE WE GOT LUCKY");
    L.push("- " + sc.lucky);
    L.push("");
    L.push("ACTION ITEMS (owner \u00b7 priority)");
    sc.items.forEach(function (it) { L.push("- [" + it[0] + "] " + it[1] + " \u2014 " + it[2]); });
    if (S.wasted >= 15 || S.harmful) L.push("- [P2] Write or update the runbook for " + sc.service + " with the evidence that pointed to the cause \u2014 Service owners");
    L.push("");
    L.push("Response score: " + sres.total + "/100 (" + sres.grade + ")");
    return L.join("\n");
  }

  /* ---------------- rendering ---------------- */
  function signalCard(label, value, cls) {
    return h("div", { class: "sim-sevcard " + (cls || "") }, h("b", {}, value), h("span", {}, label));
  }

  function render() {
    clear(main);
    var page = h("article", { class: "lesson sim-page", style: "--accent:#facc15" });
    page.appendChild(h("nav", { class: "crumbs" }, h("a", { href: "#/" }, "Home"), h("span", { class: "sep" }, "/"), h("span", {}, "Incident simulator")));

    page.appendChild(h("section", { class: "sim-hero" },
      h("div", { class: "sim-kicker" }, "Turn-based \u00b7 fully local \u00b7 every move costs simulated minutes"),
      h("h1", {}, "Incident simulator"),
      h("p", { class: "sim-lede" }, "Alerts fire and the clock runs only when you act. Coordinate, investigate and mitigate as the on-call responder; when you verify recovery you get a scored timeline and a draft blameless postmortem. Error budget assumes a 99.9% SLO over 30 days (" + BUDGET_BAD_MIN.toFixed(1) + " fully-bad minutes).")));

    var sel = h("select", { class: "sim-select", "aria-label": "Scenario" });
    SCENARIOS.forEach(function (sc, i) {
      var o = h("option", { value: String(i) }, sc.title);
      if (i === scenIdx) o.setAttribute("selected", "selected");
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { scenIdx = parseInt(sel.value, 10) || 0; S = null; render(); });
    var startBtn = h("button", { class: "w-btn primary", type: "button" }, S ? "Restart scenario" : "Start incident");
    startBtn.addEventListener("click", function () { S = fresh(SCENARIOS[scenIdx]); note("err", "PAGE: " + S.sc.alerts.filter(function (x) { return x[2] === "page"; }).map(function (x) { return x[0]; }).join(", ") + " firing for " + S.sc.service + "."); render(); });
    var statusCls = !S ? "" : S.ended ? (S.verified != null ? "is-passed" : "is-failed") : S.mitigated != null ? "is-warn" : "is-failed";
    var statusTxt = !S ? "Ready" : S.ended ? (S.verified != null ? "Resolved \u00b7 " + stamp(S.t) : "Ended \u00b7 " + stamp(S.t)) : (S.mitigated != null ? "Mitigated \u00b7 verify" : "Users affected") + " \u00b7 " + stamp(S.t);
    page.appendChild(h("div", { class: "sim-toolbar" }, h("label", { class: "w-field" }, h("span", {}, "Scenario"), sel), startBtn, h("span", { class: "sim-status " + statusCls }, statusTxt)));

    if (!S) {
      var sc0 = SCENARIOS[scenIdx];
      page.appendChild(h("section", { class: "sim-card" },
        h("h2", { class: "sim-h" }, "Briefing: " + sc0.title),
        h("p", { class: "sim-muted" }, sc0.brief),
        h("ul", { class: "sim-reasons" },
          h("li", {}, h("b", {}, "Your goal"), h("span", { class: "sim-hint" }, "Stop user pain fast, keep stakeholders informed, avoid making it worse, and confirm recovery against the SLIs.")),
          h("li", {}, h("b", {}, "How scoring works"), h("span", { class: "sim-hint" }, "Acknowledge, declare, assign roles, gather evidence before changing production, mitigate, communicate on a cadence, then verify. Harmful moves cost points.")),
          h("li", {}, h("b", {}, "Tip"), h("span", { class: "sim-hint" }, "Mitigate first, diagnose later \u2014 but a mitigation picked without any evidence is a gamble.")))));
      main.appendChild(page);
      return;
    }

    var sc = S.sc;
    var grid = h("div", { class: "sim-grid" });
    var left = h("section", { class: "sim-card" });
    left.appendChild(h("h2", { class: "sim-h" }, sc.service + " \u00b7 live signals"));
    var errCls = S.impact >= 0.1 ? "sev-critical" : S.impact >= 0.01 ? "sev-high" : "sev-low";
    var burn = S.impact / (1 - SLO);
    left.appendChild(h("div", { class: "sim-sevs" },
      signalCard("error ratio", pct(S.impact), errCls),
      signalCard("p99 latency", (S.mitigated != null ? 190 : Math.round(sc.p99 * (0.7 + S.impact))) + " ms", S.mitigated != null ? "sev-low" : "sev-high"),
      signalCard("burn rate", burn.toFixed(1) + "x", burn >= 14.4 ? "sev-critical" : burn >= 6 ? "sev-high" : burn > 1 ? "sev-medium" : "sev-low"),
      signalCard("budget used", budgetPct().toFixed(0) + "%", budgetPct() >= 50 ? "sev-critical" : budgetPct() >= 10 ? "sev-high" : "sev-medium")));
    left.appendChild(h("h3", { class: "sim-h3" }, "Alerts"));
    var al = h("ul", { class: "sim-ctr" });
    sc.alerts.forEach(function (x) {
      var resolved = S.mitigated != null;
      al.appendChild(h("li", {}, h("b", {}, (resolved ? "RESOLVED " : x[2] === "page" ? "PAGE " : "TICKET ") + x[0]), " \u2014 " + x[1]));
    });
    left.appendChild(al);
    left.appendChild(h("h3", { class: "sim-h3" }, "What you know"));
    var fl = h("ul", { class: "sim-ctr" });
    if (!S.factLog.length) fl.appendChild(h("li", {}, "Nothing yet. Alerts tell you something is wrong, not why."));
    S.factLog.forEach(function (f) { fl.appendChild(h("li", {}, f)); });
    left.appendChild(fl);
    grid.appendChild(left);

    var right = h("section", { class: "sim-card" });
    right.appendChild(h("h2", { class: "sim-h" }, S.ended ? "Run complete" : "Your move"));
    var groups = ["Coordinate", "Investigate", "Mitigate", "Close"];
    groups.forEach(function (g) {
      right.appendChild(h("h3", { class: "sim-h3" }, g));
      var row = h("div", { class: "sim-actions" });
      ACTIONS.filter(function (a) { return a.group === g; }).forEach(function (a) {
        var b = h("button", { class: "w-btn ghost sim-mini", type: "button", "data-action": a.id }, a.label + " (+" + a.cost + "m)");
        if (S.ended) b.disabled = true;
        b.addEventListener("click", function () { act(a.id); });
        row.appendChild(b);
      });
      right.appendChild(row);
    });
    grid.appendChild(right);
    page.appendChild(grid);

    var logCard = h("section", { class: "sim-card" }, h("h2", { class: "sim-h" }, "Timeline ", h("span", { class: "sim-log-stage" }, "(the scribe's notes)")));
    var pre = h("pre", { class: "sim-log", "aria-live": "polite" });
    S.log.forEach(function (e) {
      var cls = e.kind === "ok" ? "sim-l-ok" : e.kind === "warn" ? "sim-l-warn" : e.kind === "err" ? "sim-l-err" : e.kind === "head" ? "sim-l-head" : "sim-l-dim";
      pre.appendChild(h("span", { class: cls }, stamp(e.t) + "  " + e.text + "\n"));
    });
    logCard.appendChild(pre);
    page.appendChild(logCard);

    if (S.ended) {
      var sres = score();
      var sc2 = h("section", { class: "sim-card" });
      sc2.appendChild(h("h2", { class: "sim-h" }, "Scorecard"));
      sc2.appendChild(h("div", { class: "sim-verdict " + (sres.total >= 70 ? "is-passed" : sres.total >= 50 ? "is-warn" : "is-failed") },
        "Response score " + sres.total + "/100 \u00b7 grade " + sres.grade));
      var tbl = h("table", { class: "data sim-table" }, h("thead", {}, h("tr", {}, h("th", {}, "Behaviour"), h("th", {}, "Points"), h("th", {}, "Why"))));
      var tb = h("tbody");
      sres.parts.forEach(function (p) { tb.appendChild(h("tr", {}, h("td", {}, p.label), h("td", {}, p.got + " / " + p.max), h("td", {}, p.why))); });
      tbl.appendChild(tb);
      sc2.appendChild(h("div", { class: "table-wrap" }, tbl));
      sc2.appendChild(h("div", { class: "w-readout sim-readout" },
        h("span", { class: "ro" }, "time to mitigate ", h("b", {}, S.mitigated != null ? S.mitigated + " min" : "\u2014")),
        h("span", { class: "ro" }, "peak error ratio ", h("b", {}, pct(S.peak))),
        h("span", { class: "ro" }, "budget consumed ", h("b", {}, budgetPct().toFixed(0) + "%")),
        h("span", { class: "ro" }, "wasted minutes ", h("b", {}, String(S.wasted)))));
      page.appendChild(sc2);

      var pmText = postmortem();
      var pm = h("section", { class: "sim-card" });
      var copy = h("button", { class: "w-btn", type: "button" }, "Copy postmortem");
      copy.addEventListener("click", function () {
        var done = function () { copy.textContent = "Copied"; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(pmText).then(done).catch(function () {});
      });
      pm.appendChild(h("div", { class: "sim-toolbar" }, h("h2", { class: "sim-h" }, "Draft blameless postmortem"), copy));
      pm.appendChild(h("pre", { class: "sim-log sim-pm" }, pmText));
      pm.appendChild(h("p", { class: "sim-small" }, "A draft, not a verdict: review it with everyone involved, keep it blameless, and make sure every action item has an owner and a due date. Related lessons: ",
        h("a", { href: "#/inc/learning/blameless-postmortems" }, "Blameless postmortems"), " \u00b7 ",
        h("a", { href: "#/inc/response/mitigation-first" }, "Mitigate first"), " \u00b7 ",
        h("a", { href: "#/slo/budgets/burn-rate" }, "Burn-rate alerting"), "."));
      page.appendChild(pm);
    }
    main.appendChild(page);
  }

  function mount(mainEl) {
    main = mainEl;
    render();
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  window.BeaconSimulator = { mount: mount };
})();
