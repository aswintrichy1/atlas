/* =====================================================================
   NIMBUS · Observability on Cloud
   window.TRACKS.obs — modules: stack / native

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.

   Block grammar (rendered by app.js):
     {t:'p', html}              paragraph (inline HTML allowed)
     {t:'h', text}              section heading
     {t:'h2', text}             sub heading
     {t:'ul'|'ol', items:[]}    list (items are inline HTML)
     {t:'code', lang, code}     code card
     {t:'note', variant, html}  callout: tip|key|warn|trap
     {t:'table', headers, rows} data table
     {t:'compare', bad, good}   two-column contrast
     {t:'stat', items}          metric row [{v,k}]
     {t:'cue', html}            "spotting it" callout
     {t:'diagram', id}          inline SVG from app.js DIAGRAMS
     {t:'widget', id}           interactive widget
     {t:'quiz', id}             quiz
   ===================================================================== */
(function () {
  "use strict";

  /* ==================================================================
     0. DOM helpers (local to this file so load order never matters)
  ================================================================== */
  var SVG_NS = "http://www.w3.org/2000/svg";

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
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function svg(tag, attrs, text) {
    var el = document.createElementNS(SVG_NS, tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, String(attrs[k]));
    }
    if (text != null) el.appendChild(document.createTextNode(String(text)));
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

  /* A .w-seg group. `pairs` is [[value, label], ...]; onPick gets the value. */
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

  function selectField(label, pairs, initialValue, onPick) {
    var sel = h("select", { class: "w-field", "aria-label": label });
    for (var i = 0; i < pairs.length; i++) {
      var opt = h("option", { value: String(pairs[i][0]) }, pairs[i][1]);
      if (String(pairs[i][0]) === String(initialValue)) opt.setAttribute("selected", "selected");
      sel.appendChild(opt);
    }
    sel.addEventListener("change", function () { onPick(sel.value); });
    return h("label", { class: "w-field" }, label + " ", sel);
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  var Widgets = {};

  /* ==================================================================
     1. obsAlarmTuner — threshold / N / M / missing-data tuning
     Fixed 60-point p99 latency series (ms, one point per minute):
     a one-minute spike at 12, a two-minute blip at 27-28, missing data
     at 33-35, and a real ten-minute incident at 40-49.
  ================================================================== */
  var INCIDENT_START = 40, INCIDENT_END = 49, INCIDENT_GRACE = 5;
  var SERIES = (function () {
    var s = [], i;
    for (i = 0; i < 60; i++) s.push(200 + ((i * 37) % 60));
    s[12] = 880;
    s[27] = 760; s[28] = 810;
    s[33] = null; s[34] = null; s[35] = null;
    var inc = [620, 700, 760, 840, 900, 870, 820, 760, 690, 640];
    for (i = 0; i < inc.length; i++) s[INCIDENT_START + i] = inc[i];
    return s;
  })();

  function simulate(threshold, n, m, missing) {
    var states = [], state = "OK", transitions = 0, pages = [], i, j;
    if (m > n) m = n;
    for (i = 0; i < SERIES.length; i++) {
      var cur = SERIES[i];
      if (missing === "ignore" && cur === null) { states.push(state); continue; }
      var win = [];
      for (j = i; j >= 0 && win.length < n; j--) {
        var v = SERIES[j];
        if (v === null) {
          if (missing === "ignore") continue;
          win.push(missing === "breaching");
        } else win.push(v > threshold);
      }
      if (win.length < n) { states.push(state); continue; }
      var breaches = 0;
      for (j = 0; j < win.length; j++) if (win[j]) breaches++;
      var next = breaches >= m ? "ALARM" : "OK";
      if (next !== state) {
        transitions++;
        if (next === "ALARM") pages.push(i);
        state = next;
      }
      states.push(state);
    }
    var falsePages = 0, caughtAt = -1, alarmMins = 0;
    for (i = 0; i < pages.length; i++) {
      if (pages[i] >= INCIDENT_START && pages[i] <= INCIDENT_END + INCIDENT_GRACE) { if (caughtAt < 0) caughtAt = pages[i]; }
      else falsePages++;
    }
    for (i = 0; i < states.length; i++) {
      if (states[i] === "ALARM") {
        alarmMins++;
        if (caughtAt < 0 && i >= INCIDENT_START && i <= INCIDENT_END + INCIDENT_GRACE) caughtAt = i;
      }
    }
    return { states: states, transitions: transitions, pages: pages.length, falsePages: falsePages, caughtAt: caughtAt, alarmMins: alarmMins, m: m };
  }

  Widgets.obsAlarmTuner = function (mount) {
    shell(mount, "tuner", "Alarm tuner: threshold, N and M",
      "One hour of p99 latency, one point per minute. There is a one-minute spike, a two-minute blip, three minutes of missing data, and one real ten-minute incident (shaded). Tune the alarm so it pages for the incident and nothing else.");

    var threshold = 500, n = 1, m = 1, missing = "notBreaching";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var W = 600, TOP = 10, BASE = 140, MAXV = 1000;
    function yOf(v) { return BASE - Math.max(0, Math.min(MAXV, v)) / MAXV * (BASE - TOP); }

    function paint() {
      var r = simulate(threshold, n, m, missing);
      clear(stage);
      var chart = svg("svg", { viewBox: "0 0 " + W + " 176", width: "100%", role: "img", "aria-label": "Latency series with threshold line and alarm state band", style: "display:block;max-width:100%" });
      chart.appendChild(svg("rect", { x: INCIDENT_START * 10, y: TOP, width: (INCIDENT_END - INCIDENT_START + 1) * 10, height: BASE - TOP, style: "fill:var(--violet);fill-opacity:0.16" }));
      chart.appendChild(svg("line", { x1: 0, y1: BASE, x2: W, y2: BASE, style: "stroke:var(--line-strong);stroke-width:1" }));
      for (var i = 0; i < SERIES.length; i++) {
        var v = SERIES[i];
        if (v === null) {
          chart.appendChild(svg("rect", { x: i * 10 + 2, y: BASE - 4, width: 6, height: 4, style: "fill:var(--amber)" }));
        } else {
          var y = yOf(v);
          chart.appendChild(svg("rect", { x: i * 10 + 1, y: y.toFixed(1), width: 8, height: Math.max(1, BASE - y).toFixed(1), rx: 1.5, style: "fill:" + (v > threshold ? "var(--rose)" : "var(--cyan)") }));
        }
        if (r.states[i] === "ALARM") chart.appendChild(svg("rect", { x: i * 10, y: 148, width: 10, height: 8, style: "fill:var(--rose)" }));
      }
      chart.appendChild(svg("rect", { x: 0, y: 148, width: W, height: 8, style: "fill:none;stroke:var(--line);stroke-width:1" }));
      var ty = yOf(threshold);
      chart.appendChild(svg("line", { x1: 0, y1: ty.toFixed(1), x2: W, y2: ty.toFixed(1), style: "stroke:var(--amber);stroke-width:2;stroke-dasharray:6 4" }));
      chart.appendChild(svg("text", { x: W - 4, y: Math.max(TOP + 10, ty - 4).toFixed(1), "text-anchor": "end", style: "fill:var(--text);font-size:11px;font-family:var(--font-mono)" }, "threshold " + threshold + " ms"));
      chart.appendChild(svg("text", { x: INCIDENT_START * 10 + 2, y: TOP - 2, style: "fill:var(--text);font-size:9px;font-family:var(--font-mono)" }, "real incident"));
      chart.appendChild(svg("text", { x: 0, y: 172, style: "fill:var(--text-dim);font-size:10px;font-family:var(--font-mono)" }, "0 min"));
      chart.appendChild(svg("text", { x: W / 2, y: 172, "text-anchor": "middle", style: "fill:var(--text-dim);font-size:10px;font-family:var(--font-mono)" }, "ALARM state band (red = in alarm)"));
      chart.appendChild(svg("text", { x: W, y: 172, "text-anchor": "end", style: "fill:var(--text-dim);font-size:10px;font-family:var(--font-mono)" }, "59 min"));
      stage.appendChild(chart);
      stage.appendChild(h("p", { style: "font-size:0.78rem;color:var(--text-dim);margin:8px 0 0" },
        "Bars above the line breach. Short amber marks at minutes 33-35 are missing datapoints. An alarm needs M breaching points out of the last N evaluated."));

      var caught = r.caughtAt >= 0;
      var verdict;
      if (caught && r.falsePages === 0) verdict = "Clean: one page for the real incident, no noise.";
      else if (caught) verdict = "Caught the incident, but " + r.falsePages + " false page" + (r.falsePages === 1 ? "" : "s") + " will train on-call to ignore this alarm.";
      else if (r.falsePages > 0) verdict = "Worst case: noise pages and the real incident was missed.";
      else verdict = "Silent: no false pages, but the real incident was missed. Too strict.";

      clear(readout);
      readout.appendChild(ro("rule", r.m + " of " + n + " > " + threshold + " ms"));
      readout.appendChild(ro("pages", r.pages));
      readout.appendChild(ro("state transitions", r.transitions));
      readout.appendChild(ro("incident caught", caught ? "yes" : "no"));
      readout.appendChild(ro("detection delay", caught ? (r.caughtAt - INCIDENT_START) + " min" : "n/a"));
      readout.appendChild(ro("false pages", r.falsePages));
      readout.appendChild(ro("minutes in ALARM", r.alarmMins));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, verdict + (m > n ? " (M was capped at N.)" : "")));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      selectField("threshold", [[250, "250 ms"], [400, "400 ms"], [500, "500 ms"], [600, "600 ms"], [700, "700 ms"], [800, "800 ms"]], threshold, function (v) { threshold = parseInt(v, 10) || 500; paint(); }),
      selectField("evaluation periods N", [[1, "1"], [2, "2"], [3, "3"], [5, "5"]], n, function (v) { n = parseInt(v, 10) || 1; paint(); }),
      selectField("datapoints to alarm M", [[1, "1"], [2, "2"], [3, "3"], [5, "5"]], m, function (v) { m = parseInt(v, 10) || 1; paint(); })
    ));
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["notBreaching", "missing = not breaching"], ["breaching", "missing = breaching"], ["ignore", "missing = ignore"]], 0, function (v) { missing = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. obsK8sTriage — symptom to signal, per cloud
  ================================================================== */
  var TRIAGE = {
    pending: {
      label: "Pods stuck Pending",
      signal: "Scheduler events and node capacity: kube-state-metrics pending pod count, cluster autoscaler or Karpenter logs",
      causes: ["No node fits the CPU or memory requests", "Subnet out of IP addresses (VPC CNI assigns a VPC IP per pod)", "Taints, affinity or a topology spread rule nothing satisfies", "Autoscaler at its maximum or blocked by a quota"],
      aws: "Container Insights pending pods; Karpenter or cluster autoscaler logs in CloudWatch Logs; EC2 and VPC IP quota",
      azure: "Container Insights in Azure Monitor; cluster autoscaler events; subnet IP usage for Azure CNI",
      gcp: "GKE workload and node metrics in Cloud Monitoring; autoscaler visibility logs in Cloud Logging"
    },
    crash: {
      label: "CrashLoopBackOff",
      signal: "Container logs from the previous instance, restart count, and the pod's events",
      causes: ["Application error at start-up, such as missing configuration or a secret it cannot read", "Liveness probe failing before the app is ready", "Dependency unreachable from the pod network"],
      aws: "Logs via Fluent Bit to CloudWatch Logs; Container Insights restart counts; Pod Identity or IRSA errors in the logs",
      azure: "Container Insights logs (ContainerLogV2) queried with KQL",
      gcp: "Cloud Logging container logs, filtered by namespace and pod"
    },
    oom: {
      label: "OOMKilled",
      signal: "Container memory working set against its limit, and the termination reason",
      causes: ["Memory limit lower than the real working set", "Memory leak under load", "JVM or runtime heap not aware of the container limit"],
      aws: "Container Insights memory utilisation against limit; Managed Prometheus with cAdvisor metrics",
      azure: "Container Insights memory working set; managed Prometheus",
      gcp: "GKE container memory metrics; Managed Service for Prometheus"
    },
    latency: {
      label: "p99 latency high, CPU looks fine",
      signal: "Traces: which span carries the time; then CPU throttling and dependency metrics",
      causes: ["CPU throttling from a tight CPU limit (average CPU looks low)", "A slow downstream dependency or connection-pool exhaustion", "Cross-AZ or NAT hops added to the request path"],
      aws: "Application Signals or X-Ray traces via ADOT; container_cpu_cfs_throttled metrics in Managed Prometheus",
      azure: "Application Insights dependency tracking and application map",
      gcp: "Cloud Trace latency breakdown; GKE container CPU throttling metrics"
    },
    notready: {
      label: "Node NotReady",
      signal: "Node conditions (memory, disk, PID pressure), kubelet logs, and the instance's own health",
      causes: ["Disk pressure from logs or images", "The kubelet or container runtime is unhealthy", "Underlying instance failure or a Spot interruption"],
      aws: "Container Insights node metrics; EC2 status checks; Spot interruption events in EventBridge",
      azure: "Node conditions in Container Insights; VM health events",
      gcp: "GKE node metrics and auto-repair events"
    }
  };

  Widgets.obsK8sTriage = function (mount) {
    shell(mount, "triage", "Kubernetes triage: symptom to signal",
      "Pick what on-call sees. The panel shows which signal answers it, the usual causes, and where that signal lives on EKS, AKS and GKE.");
    var pick = "pending";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var t = TRIAGE[pick];
      clear(stage);
      stage.appendChild(h("div", { style: "font-size:0.86rem;color:var(--text);margin-bottom:8px" }, h("b", { style: "color:var(--accent-ink)" }, "Look first at: "), t.signal));
      var ul = h("ul", { style: "margin:0 0 10px;padding-left:18px;font-size:0.84rem;color:var(--text)" });
      for (var i = 0; i < t.causes.length; i++) ul.appendChild(h("li", {}, t.causes[i]));
      stage.appendChild(ul);
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:70px minmax(0,1fr);gap:6px 12px;font-size:0.84rem;color:var(--text)" },
        h("b", { style: "color:var(--accent-ink)" }, "EKS"), h("span", {}, t.aws),
        h("b", { style: "color:var(--accent-ink)" }, "AKS"), h("span", {}, t.azure),
        h("b", { style: "color:var(--accent-ink)" }, "GKE"), h("span", {}, t.gcp)));
      clear(readout);
      readout.appendChild(ro("symptom", t.label));
      readout.appendChild(ro("likely causes", t.causes.length));
    }

    var pairs = [];
    for (var k in TRIAGE) if (Object.prototype.hasOwnProperty.call(TRIAGE, k)) pairs.push([k, TRIAGE[k].label]);
    mount.appendChild(h("div", { class: "widget-controls", style: "flex-wrap:wrap" }, segment(pairs, 0, function (v) { pick = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "obs-native": {
      title: "Cloud-native monitoring checkpoint",
      sub: "CloudWatch in practice, containers and Kubernetes, tracing and synthetics, and multi-account security monitoring.",
      questions: [
        {
          q: "A Lambda function needs custom business metrics without the latency of PutMetricData calls. What is the idiomatic approach?",
          options: ["Write metrics to S3", "Emit structured logs in CloudWatch Embedded Metric Format, which CloudWatch extracts into metrics asynchronously", "Call PutMetricData once per request", "Use X-Ray annotations"],
          answer: 1,
          explain: "EMF lets the function print a JSON log line that CloudWatch turns into metrics, with no extra API call in the request path. Keep dimension cardinality low, because each unique combination becomes a billed metric."
        },
        {
          q: "Fifty workload accounts need one place to search logs, metrics and traces. What does CloudWatch provide for that?",
          options: ["Nothing; you must copy everything to S3", "Cross-account observability: link source accounts to a central monitoring account", "One dashboard per account only", "A separate CloudWatch region"],
          answer: 1,
          explain: "Cross-account observability links source accounts (often an entire organization or OU) to a monitoring account that can query their telemetry in place. Azure uses workspaces and Azure Monitor at management-group scope; Google Cloud uses metrics scopes and log views across projects."
        },
        {
          q: "A team runs EKS and wants PromQL dashboards and alerts without running Prometheus servers. What is the managed combination?",
          options: ["CloudWatch Logs Insights", "Amazon Managed Service for Prometheus with Amazon Managed Grafana, fed by a collector such as ADOT or the managed scraper", "X-Ray only", "Security Hub"],
          answer: 1,
          explain: "Managed Prometheus stores and queries Prometheus metrics; Managed Grafana visualizes them with SSO. Azure (managed Prometheus and Azure Managed Grafana) and GKE (Managed Service for Prometheus) offer the same pattern."
        },
        {
          q: "What does a CloudWatch Synthetics canary give you that server-side metrics do not?",
          options: ["Lower log costs", "A scripted user journey run on a schedule from outside your service, which catches failures even when no real users are active", "CPU metrics", "Threat detection"],
          answer: 1,
          explain: "Canaries detect broken logins, certificates or DNS before customers do, including at 3 a.m. when there is no traffic to generate errors. Real user monitoring complements them with what actual browsers experience."
        },
        {
          q: "In a multi-account AWS organization, where should GuardDuty, Security Hub and Config aggregation be administered?",
          options: ["In the management account", "In a dedicated security tooling account set as delegated administrator, with auto-enable for new accounts", "Separately in each workload account", "In the log archive account"],
          answer: 1,
          explain: "Delegated administration keeps day-to-day security work out of the management account, aggregates findings from every account and region, and auto-enables new accounts. The log archive account stores evidence; the security account acts on it."
        },
        {
          q: "When does a CNAPP such as Wiz add the most on top of native GuardDuty, Security Hub and Config?",
          options: ["Never; they are identical", "When you need one risk graph across clouds that joins vulnerabilities, identities, network exposure and data into prioritized attack paths", "Only for billing", "Only for on-premises servers"],
          answer: 1,
          explain: "Native services are strong and cheap per cloud. A CNAPP correlates findings across AWS, Azure and Google Cloud, so a public VM with a critical vulnerability and an admin role ranks above a thousand isolated medium findings."
        }
      ]
    },
    "obs-stack": {
      title: "Observability on cloud checkpoint",
      sub: "Native telemetry stacks, alarm tuning, audit trails and observability cost.",
      questions: [
        {
          q: "Which query language do you use against an Azure Log Analytics workspace?",
          options: ["CloudWatch Logs Insights syntax", "PromQL", "Kusto Query Language (KQL)", "Standard SQL only"],
          answer: 2,
          explain: "Log Analytics, Application Insights and most Azure Monitor log experiences are queried with KQL, a pipe-based language. CloudWatch Logs Insights has its own pipe syntax, and GCP Log Analytics exposes logs through SQL. Knowing the query language per cloud matters because runbooks and alerts are written in it."
        },
        {
          q: "A CloudWatch alarm has evaluation periods = 5 and datapoints to alarm = 3. When does it go to ALARM?",
          options: ["When 3 consecutive datapoints breach", "When any 3 of the last 5 datapoints breach", "Only when all 5 datapoints breach", "When the average of 5 datapoints exceeds the threshold"],
          answer: 1,
          explain: "M of N alarms look at the last N evaluation periods and fire when at least M of them breach, consecutive or not. This filters one-off spikes while still catching an incident that flaps around the threshold. Requiring all N breaches is stricter and slower to detect."
        },
        {
          q: "What is true of CloudTrail data events such as S3 object-level reads?",
          options: ["They are recorded by default in event history at no charge", "They are identical to management events", "They can only be queried in Logs Insights", "They are off by default, must be enabled on a trail or event data store, and are billed by volume"],
          answer: 3,
          explain: "Management events (control-plane calls) appear in event history by default. Data events are high volume, so you opt in per resource type and pay per event. Enabling them selectively, for example on buckets with sensitive data, is the usual compromise."
        },
        {
          q: "Which GCP audit log type is always on and cannot be disabled?",
          options: ["Admin Activity audit logs", "Data Access audit logs", "VPC Flow Logs", "Firewall Rules Logging"],
          answer: 0,
          explain: "Admin Activity logs record configuration changes and are always written at no charge. Data Access logs are off by default for most services because they are large and billable. That mirrors AWS management versus data events and Azure's Activity Log versus resource logs."
        },
        {
          q: "For most teams, which lever moves the observability bill the most?",
          options: ["The number of dashboards", "The number of alarms", "Log ingestion volume and retention, then metric cardinality", "Which region the monitoring console is opened in"],
          answer: 2,
          explain: "Logs are typically billed per GB ingested plus storage over time, so verbose debug logging and long hot retention dominate. High-cardinality custom metrics are the next surprise, because each unique dimension combination is a billed series. Dashboards and alarms are usually a small fraction."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.obs = {
    id: "obs",
    name: "Observability on Cloud",
    short: "OBS",
    tagline: "Telemetry, alarms and audit trails that earn their cost",
    color: "#a3e635",
    blurb: "Cloud-native monitoring on AWS, Azure and GCP: the native metrics, logs and tracing stacks side by side; alarms that page for real incidents; audit trails and a central logging account; CloudWatch in practice, containers and Kubernetes, tracing and synthetics, and multi-account security monitoring; and keeping telemetry cost in check. SRE theory (SLOs, alert design, OpenTelemetry internals) lives in Beacon and is linked rather than repeated.",
    modules: [
      {
        id: "stack",
        name: "Telemetry on Cloud",
        icon: "trend",
        lessons: [
          {
            id: "signals",
            title: "Metrics, logs and traces on three clouds",
            summary: "The three signals, what each native stack calls them, and where OpenTelemetry fits.",
            minutes: 10,
            tags: ["metrics", "logs", "traces", "cloudwatch", "azure-monitor", "cloud-monitoring", "opentelemetry"],
            blocks: [
              { t: "p", html: "Observability is being able to answer a question you did not plan for, from the outside, without shipping new code. Three signals carry most of it: <strong>metrics</strong> say <em>that</em> something is wrong (cheap, aggregated numbers), <strong>logs</strong> say <em>what</em> happened (detailed events), and <strong>traces</strong> say <em>where</em> the time went (one request followed across services)." },
              { t: "table", headers: ["Signal", "Shape", "Cost profile", "Best for"], rows: [
                ["Metrics", "Numeric series with dimensions, often 1-minute points", "Cheap per point; expensive with high cardinality", "Alarms, dashboards, SLOs"],
                ["Logs", "Timestamped events, ideally structured JSON", "Billed per GB ingested and stored", "Debugging, audit, forensics"],
                ["Traces", "Spans with parent IDs and timings", "Billed per span or trace; usually sampled", "Latency breakdown, dependency maps"]
              ] },
              { t: "h", text: "The native stacks, side by side" },
              { t: "table", headers: ["Job", "AWS", "Azure", "GCP"], rows: [
                ["Metrics store", "CloudWatch metrics", "Azure Monitor Metrics", "Cloud Monitoring"],
                ["Log store", "CloudWatch Logs (log groups and streams)", "Log Analytics workspace (Azure Monitor Logs)", "Cloud Logging (log buckets)"],
                ["Log query", "CloudWatch Logs Insights", "KQL", "Logs Explorer query language; SQL in Log Analytics"],
                ["Tracing / APM", "X-Ray, CloudWatch Application Signals", "Application Insights", "Cloud Trace (plus Cloud Profiler)"],
                ["Alerting", "CloudWatch alarms to SNS", "Azure Monitor alerts to action groups", "Alerting policies to notification channels"],
                ["Routing logs", "Subscription filters, Firehose", "Diagnostic settings", "Log Router sinks"],
                ["Prometheus", "Amazon Managed Service for Prometheus", "Azure Monitor managed Prometheus", "Managed Service for Prometheus"]
              ] },
              { t: "note", variant: "warn", html: "The mapping is loose in places. Azure Monitor splits platform metrics from logs and routes resource logs only once you add diagnostic settings; GCP collects many platform logs automatically into Cloud Logging; AWS services each publish to CloudWatch in their own way. Check per service, not per cloud." },
              { t: "h", text: "OpenTelemetry: instrument once" },
              { t: "p", html: "OpenTelemetry (OTel) is the vendor-neutral standard for generating metrics, logs and traces. Instrument the application with OTel SDKs, run a collector, and export to whichever backend you choose. AWS ships it as the AWS Distro for OpenTelemetry (ADOT), Azure Monitor and Application Insights accept OTel through its distro, and Google Cloud accepts OTLP for traces and metrics." },
              { t: "code", lang: "text", code:
                "# OpenTelemetry Collector sketch (YAML)\n" +
                "receivers:\n" +
                "  otlp: { protocols: { grpc: {}, http: {} } }\n" +
                "processors:\n" +
                "  batch: {}\n" +
                "  tail_sampling:\n" +
                "    policies:\n" +
                "      - { name: errors, type: status_code, status_code: { status_codes: [ERROR] } }\n" +
                "      - { name: slow,   type: latency,     latency: { threshold_ms: 1000 } }\n" +
                "      - { name: base,   type: probabilistic, probabilistic: { sampling_percentage: 5 } }\n" +
                "exporters:\n" +
                "  awsxray: {}          # or azuremonitor / googlecloud\n" +
                "service:\n" +
                "  pipelines:\n" +
                "    traces: { receivers: [otlp], processors: [tail_sampling, batch], exporters: [awsxray] }"
              },
              { t: "h", text: "Make the signals joinable" },
              { t: "ul", items: [
                "Emit structured JSON logs with a <code class='tok'>trace_id</code> field so a slow trace links to its log lines.",
                "Use the same service name and environment attributes on all three signals.",
                "Derive metrics from logs sparingly (metric filters, log-based metrics); emitting metrics directly is usually cheaper at volume."
              ] },
              { t: "note", variant: "tip", html: "This track stays cloud-specific. For the signal theory itself, see <a href='../sre-academy/index.html#/otel/signals/three-signals'>Beacon: Metrics, logs and traces</a> and <a href='../sre-academy/index.html#/otel/pipeline/collector'>Beacon: The OpenTelemetry Collector</a>." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we have logs but cannot tell which service is slow' means tracing; 'vendor lock-in' or 'multi-cloud' means OpenTelemetry at the source; 'what changed at 14:02' means logs plus audit trails." },
              { t: "note", variant: "key", html: "<strong>Metrics detect, logs explain, traces locate.</strong> Each cloud has a native trio (CloudWatch and X-Ray, Azure Monitor and Application Insights, Cloud Monitoring, Logging and Trace); instrument with OpenTelemetry so the backend stays a choice." }
            ]
          },
          {
            id: "alarms",
            title: "Alarms that page well",
            summary: "SLO-based paging, M-of-N evaluation, missing data, composite alarms and anomaly detection.",
            minutes: 11,
            tags: ["alarms", "slo", "composite-alarms", "anomaly-detection", "on-call"],
            blocks: [
              { t: "p", html: "A page should mean <strong>a user is hurting now and a human must act</strong>. Every page that fails that test teaches on-call to ignore the next one. Good alarms are built from symptoms users feel (errors, latency, availability), tuned to ignore blips, and routed by severity." },
              { t: "h", text: "The knobs on a CloudWatch alarm" },
              { t: "table", headers: ["Setting", "Meaning", "Typical starting point"], rows: [
                ["Period", "Length of each evaluated datapoint", "60 seconds for user-facing metrics"],
                ["Statistic", "Average, Sum, or a percentile such as p99", "p99 or p95 for latency; Sum for errors"],
                ["Evaluation periods (N)", "How many recent periods are considered", "3 to 5"],
                ["Datapoints to alarm (M)", "How many of those N must breach", "M less than N to tolerate a flap; M = N for strictness"],
                ["Treat missing data", "missing, notBreaching, breaching or ignore", "notBreaching for sparse error counts; breaching for heartbeats"]
              ] },
              { t: "widget", id: "obsAlarmTuner" },
              { t: "p", html: "Try 500 ms with N = 1: it pages three times and two are noise. Raise N and M to 3 and the blips vanish, at the cost of two minutes' detection delay. Then flip missing data to breaching and watch a silent metric page you at 3 a.m. That trade (noise against delay) is the whole craft." },
              { t: "h", text: "Page on the SLO, not on the cause" },
              { t: "p", html: "Define a service level objective, for example <em>99.9% of checkout requests succeed over 30 days</em>. That leaves an error budget of 0.1%. Page when the budget is burning fast enough to run out soon, and open a ticket when it burns slowly." },
              { t: "code", lang: "text", code:
                "SLO 99.9% over 30 days -> error budget = 0.1% of requests\n\n" +
                "burn rate = observed error ratio / 0.001\n" +
                "  burn 14.4 sustained for 1 h  -> ~2% of the monthly budget gone -> PAGE\n" +
                "  burn 6    sustained for 6 h  -> ~5% gone                       -> PAGE\n" +
                "  burn 1    sustained for 3 d  -> on track to exactly exhaust     -> TICKET\n\n" +
                "Pair a long window with a short one (1 h AND 5 min) so the alarm\n" +
                "also clears quickly once the incident ends."
              },
              { t: "h", text: "Tools that cut noise" },
              { t: "table", headers: ["Tool", "AWS", "Azure", "GCP"], rows: [
                ["Combine conditions", "Composite alarms (AND, OR, NOT over other alarms)", "Alert processing rules; multi-condition log alerts", "Multi-condition alerting policies"],
                ["Learned baseline", "Anomaly detection bands", "Dynamic thresholds", "Forecast and anomaly-style conditions (varies by metric)"],
                ["SLO tooling", "Application Signals SLOs", "Service level indicators in Azure Monitor (evolving)", "Service Monitoring SLOs with burn-rate alerts"],
                ["Suppress during change", "Composite alarm with an ActionsSuppressor", "Alert processing rules for maintenance windows", "Snooze"]
              ] },
              { t: "compare",
                bad: { title: "Cause-based paging", items: ["CPU above 80% pages at night", "Every dependency has its own page", "Threshold copied from a blog, never revisited"] },
                good: { title: "Symptom-based paging", items: ["Error-budget burn pages; CPU goes to a dashboard", "Composite alarm pages once per user-facing symptom", "Every page reviewed weekly: actionable or deleted"] } },
              { t: "note", variant: "tip", html: "Choosing SLIs and setting burn-rate windows is SRE practice, covered in depth in <a href='../sre-academy/index.html#/slo/budgets/burn-rate'>Beacon: Burn-rate alerting</a> and <a href='../sre-academy/index.html#/alert/alerting/symptom-vs-cause'>Beacon: Symptom-based vs cause-based alerting</a>. Here the focus is wiring them into each cloud's alarm system." },
              { t: "note", variant: "trap", html: "Treating missing data as breaching is right for a heartbeat (silence is the failure) and wrong for a sparse error counter (silence is good news). Pick per metric, not per account." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'alert fatigue', 'on-call ignores pages' or 'we got paged for a blip' means M-of-N, composite alarms and SLO burn rates; 'nobody noticed for an hour' means a missing symptom alarm or wrong missing-data handling." },
              { t: "note", variant: "key", html: "<strong>Page on user symptoms with M-of-N evaluation and burn rates.</strong> Every knob trades noise for detection delay; composite alarms and anomaly bands cut noise, and missing-data handling must match what silence means for that metric." }
            ]
          },
          {
            id: "audit",
            title: "Audit trails and centralised logging",
            summary: "CloudTrail, Azure Activity Log and Cloud Audit Logs, management versus data events, and the log archive account.",
            minutes: 10,
            tags: ["cloudtrail", "activity-log", "audit-logs", "log-archive", "landing-zone"],
            blocks: [
              { t: "p", html: "Operational logs tell you what your code did; <strong>audit logs tell you what people and machines did to your cloud</strong>: who created the user, opened the security group, read the bucket. In an incident they are the first thing responders ask for, and the first thing an attacker tries to switch off." },
              { t: "table", headers: ["Category", "AWS", "Azure", "GCP"], rows: [
                ["Control-plane changes", "CloudTrail management events", "Activity Log (subscription level)", "Admin Activity audit logs (always on)"],
                ["Data-plane access", "CloudTrail data events (opt in, billed)", "Resource logs via diagnostic settings", "Data Access audit logs (mostly opt in, billed)"],
                ["Identity sign-ins", "CloudTrail sign-in events, IAM Identity Center logs", "Entra ID sign-in and audit logs", "Cloud Identity / Workspace audit logs"],
                ["Org-wide collection", "Organization trail", "Diagnostic settings applied by Azure Policy", "Aggregated sinks at organization or folder"],
                ["Default retention", "Event history: 90 days of management events", "Activity Log: 90 days", "Admin Activity: 400 days in the required bucket"]
              ] },
              { t: "h", text: "Management versus data events" },
              { t: "p", html: "Management events cover calls such as <code class='tok'>CreateUser</code>, <code class='tok'>PutBucketPolicy</code> or <code class='tok'>AuthorizeSecurityGroupIngress</code>. Data events cover calls against the data itself: <code class='tok'>GetObject</code>, Lambda invocations, DynamoDB item reads. Data events are orders of magnitude more numerous, so enable them selectively, for example on buckets holding regulated data." },
              { t: "h", text: "The log archive pattern" },
              { t: "diagram", id: "landing-zone", caption: "A landing zone keeps a dedicated log archive account (Azure: subscription, GCP: project) that workloads can write to but not delete from." },
              { t: "ol", items: [
                "Create an <strong>organization trail</strong> (or aggregated sink, or policy-driven diagnostic settings) so every new account is covered automatically.",
                "Deliver to a bucket in a <strong>dedicated log archive account</strong> that workload admins cannot reach.",
                "Turn on <strong>immutability</strong>: S3 Object Lock, immutable blob storage, or bucket lock on GCS retention policies.",
                "Enable <strong>log file integrity validation</strong> on CloudTrail so tampering is detectable.",
                "Feed a security tooling account or SIEM from the archive, not from workload accounts."
              ] },
              { t: "code", lang: "javascript", code:
                "// SCP guardrail: no one in member accounts may stop or delete the org trail\n" +
                "{\n" +
                "  \"Effect\": \"Deny\",\n" +
                "  \"Action\": [\"cloudtrail:StopLogging\", \"cloudtrail:DeleteTrail\", \"cloudtrail:UpdateTrail\"],\n" +
                "  \"Resource\": \"arn:aws:cloudtrail:*:<ACCOUNT_ID>:trail/org-trail\"\n" +
                "}"
              },
              { t: "note", variant: "warn", html: "Audit logs prove intent only if the attacker could not edit them. Logs stored in the same account an attacker compromised, with the same admin role able to delete them, are evidence you cannot trust." },
              { t: "table", headers: ["Tier", "Audit design", "Why"], rows: [
                ["Naive", "Default event history only", "90 days, per account, no data events, deletable trails"],
                ["Solid", "Organization trail to a locked log archive account, integrity validation on, SCP protecting the trail", "Complete, tamper-evident control-plane history"],
                ["Standout", "Solid, plus selective data events on sensitive stores, detections in a SIEM, and the same pattern for Azure and GCP", "Answers who read the data, not just who changed config"]
              ] },
              { t: "note", variant: "key", html: "<strong>Collect audit logs org-wide into an account the workloads cannot touch.</strong> Management events are the baseline, data events are opt-in and billed, and immutability plus a guardrail on the trail is what makes the log evidence." }
            ]
          },
          {
            id: "cost",
            title: "The cost of observability",
            summary: "Where the money goes (ingestion, retention, cardinality, traces) and the levers that cut it without going blind.",
            minutes: 9,
            tags: ["cost", "retention", "sampling", "cardinality", "logs"],
            blocks: [
              { t: "p", html: "Observability bills grow quietly because every engineer can add a log line and nobody owns the total. The mental model: <strong>you pay to ingest, you pay to keep, and you pay for every unique series</strong>. Cut volume at the source first, then shorten hot retention, then sample." },
              { t: "table", headers: ["Cost driver", "How it is billed (typical)", "Lever"], rows: [
                ["Log ingestion", "Per GB ingested", "Drop debug logs in production; filter at the agent or collector"],
                ["Log retention", "Per GB-month stored", "Short hot retention, archive to object storage, lifecycle to cold tiers"],
                ["Log queries", "Per GB scanned in some query engines", "Narrow time ranges, partitioned destinations, saved queries"],
                ["Custom metrics", "Per series per month", "Cap dimension cardinality: never a user ID or request ID as a dimension"],
                ["Traces", "Per span or trace ingested", "Head sampling for baseline, tail sampling to keep errors and slow requests"]
              ] },
              { t: "stat", items: [
                { v: "~$0.50/GB", k: "illustrative log ingestion price on one cloud" },
                { v: "50 GiB", k: "illustrative free monthly logging allotment per project on another" },
                { v: "100x", k: "series growth from one high-cardinality dimension" }
              ] },
              { t: "code", lang: "text", code:
                "Illustrative prices only - check current pricing.\n\n" +
                "200 services x 2 GB/day of logs       = 400 GB/day = ~12 TB/month\n" +
                "12,000 GB x $0.50/GB ingest           = ~$6,000 / month\n\n" +
                "After: drop DEBUG, sample 200-OK access logs at 10%\n" +
                "~3 TB/month x $0.50/GB                = ~$1,500 / month\n" +
                "Hot retention 30 d, then object storage = storage line shrinks too"
              },
              { t: "h", text: "The cheaper tiers each cloud offers" },
              { t: "table", headers: ["Cloud", "Cheaper log option", "What you give up"], rows: [
                ["AWS", "CloudWatch Logs Infrequent Access class; S3 via Firehose with Athena", "Fewer features (for example some live-tail and metric-filter uses); slower queries"],
                ["Azure", "Basic and Auxiliary log tables; archive tier", "Limited KQL, per-query charges, longer search times"],
                ["GCP", "Shorter retention in the default bucket; sinks to Cloud Storage or BigQuery", "Querying moves to another tool"]
              ] },
              { t: "compare",
                bad: { title: "Log everything forever", items: ["DEBUG enabled in production", "Never-expire retention on every log group", "Every request traced at 100%"] },
                good: { title: "Budgeted telemetry", items: ["Structured INFO, sampled access logs", "Retention set by IaC per log class", "Tail sampling keeps every error and slow trace"] } },
              { t: "note", variant: "trap", html: "CloudWatch log groups default to never expire. A retention setting in your IaC module for every log group is one of the cheapest savings available, and it is easy to forget for log groups that services create on your behalf." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'the monitoring bill doubled', 'logs cost more than compute' or 'we cannot afford tracing' means volume at the source, retention tiers, cardinality caps and tail sampling, in that order." },
              { t: "quiz", id: "obs-stack" },
              { t: "note", variant: "key", html: "<strong>Pay for signal, not volume.</strong> Cut log volume at the source, set retention per log class, keep metric dimensions low-cardinality, and tail-sample traces so errors and slow requests are always kept." }
            ]
          }
        ]
      },
      {
        id: "native",
        name: "Cloud-Native Monitoring in Practice",
        icon: "grid",
        lessons: [
          {
            id: "cloudwatch-practice",
            title: "CloudWatch in practice: metric math, Logs Insights, EMF and cross-account",
            summary: "The CloudWatch features teams actually use day to day, the cheap way to emit custom metrics, and one monitoring account for a whole organization, with Azure Monitor and Cloud Monitoring alongside.",
            minutes: 11,
            tags: ["cloudwatch", "logs-insights", "emf", "metric-math", "cross-account"],
            blocks: [
              { t: "p", html: "Every AWS service publishes into CloudWatch, so most teams start there. Used well it covers a lot; used naively it produces dashboards nobody reads and a surprising bill. These are the features worth knowing." },
              { t: "table", headers: ["Feature", "What it does", "Use it for"], rows: [
                ["Namespaces and dimensions", "Metrics are grouped by namespace and identified by dimension sets", "Per-service and per-environment views; keep dimensions low-cardinality"],
                ["Resolution", "Standard one-minute points; high-resolution down to one second for custom metrics", "Fast-moving signals only; high resolution costs more"],
                ["Metric math", "Expressions over metrics, such as error rate = errors / requests", "Alarm on ratios rather than raw counts"],
                ["Metrics Insights", "SQL-like queries across many metrics at once", "Top-N views such as 'highest CPU across all instances'"],
                ["Logs Insights", "Pipe-based query language over log groups", "Ad hoc investigation and dashboard widgets"],
                ["Contributor Insights", "Top contributors in log or metric data", "Which client IP or API key drives the errors"],
                ["Live Tail", "Streaming view of incoming log events", "Watching a deploy or reproducing an issue"]
              ] },
              { t: "code", lang: "text", code:
                "# Logs Insights: 5xx rate and p99 latency per route, last hour\n" +
                "fields @timestamp, route, status, latency_ms\n" +
                "| filter ispresent(route)\n" +
                "| stats count(*) as requests,\n" +
                "        sum(status >= 500) as errors,\n" +
                "        pct(latency_ms, 99) as p99\n" +
                "  by route\n" +
                "| sort errors desc\n" +
                "| limit 20"
              },
              { t: "h", text: "Custom metrics without API calls: EMF" },
              { t: "p", html: "The <strong>Embedded Metric Format</strong> lets code print a structured JSON log line that CloudWatch extracts into metrics asynchronously. No <code class='tok'>PutMetricData</code> call sits in the request path, and the same line stays searchable as a log. Libraries exist for the common runtimes, and Lambda Powertools uses it under the hood." },
              { t: "code", lang: "javascript", code:
                "// One log line, two metrics (OrdersPlaced, OrderValue) with low-cardinality dimensions\n" +
                "{\n" +
                "  \"_aws\": { \"Timestamp\": 1767225600000, \"CloudWatchMetrics\": [{\n" +
                "    \"Namespace\": \"Orders\", \"Dimensions\": [[\"Service\", \"Env\"]],\n" +
                "    \"Metrics\": [{ \"Name\": \"OrdersPlaced\", \"Unit\": \"Count\" }, { \"Name\": \"OrderValue\", \"Unit\": \"None\" }] }] },\n" +
                "  \"Service\": \"checkout\", \"Env\": \"prod\",\n" +
                "  \"OrdersPlaced\": 1, \"OrderValue\": 42.5,\n" +
                "  \"orderId\": \"o-123\"\n" +
                "}"
              },
              { t: "note", variant: "trap", html: "Put identifiers like <code class='tok'>orderId</code> in the log body, never in <code class='tok'>Dimensions</code>. Every unique dimension combination is a separate billed metric. Beacon explains the general problem in <a href='../sre-academy/index.html#/otel/pipeline/cardinality'>Cardinality: the metric bill you did not plan</a>." },
              { t: "h", text: "One pane for many accounts" },
              { t: "p", html: "<strong>CloudWatch cross-account observability</strong> links source accounts (individually, or a whole OU or organization) to a central <strong>monitoring account</strong>. Engineers query metrics, logs and traces from every linked account in place, without copying data. Pair it with the log archive pattern for long-term retention." },
              { t: "table", headers: ["Job", "AWS", "Azure", "Google Cloud"], rows: [
                ["Query logs", "Logs Insights", "KQL in Log Analytics", "Logs Explorer; SQL in Log Analytics"],
                ["Metric expressions", "Metric math, Metrics Insights", "Metrics explorer, KQL over metrics", "PromQL or MQL in Cloud Monitoring"],
                ["Custom metrics from code", "EMF, PutMetricData, OpenTelemetry", "Application Insights SDK or OpenTelemetry", "OpenTelemetry, log-based metrics"],
                ["Many accounts in one view", "Cross-account observability (monitoring account)", "Workspaces plus Azure Monitor at management-group scope", "Metrics scopes; log views and aggregated sinks"],
                ["Dashboards", "CloudWatch dashboards, Managed Grafana", "Workbooks, Azure Managed Grafana", "Cloud Monitoring dashboards, Grafana"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'we need business metrics from Lambda', 'every team has its own CloudWatch and we cannot see across them', 'which customer is causing the errors' — EMF, a monitoring account, and Contributor Insights." },
              { t: "note", variant: "key", html: "<strong>Use ratios, queries and EMF, and centralize the view.</strong> Alarm on metric math, investigate with Logs Insights, emit custom metrics as EMF logs with low-cardinality dimensions, and link every account to one monitoring account." }
            ]
          },
          {
            id: "containers-k8s",
            title: "Monitoring containers and Kubernetes: Container Insights, Prometheus and Grafana",
            summary: "What to collect from ECS, EKS, AKS and GKE, the managed Prometheus and Grafana services, control-plane logs, and a symptom-first triage map.",
            minutes: 11,
            tags: ["containers", "kubernetes", "container-insights", "prometheus", "grafana"],
            blocks: [
              { t: "p", html: "Containers add two layers to monitor: the <strong>orchestrator</strong> (is the cluster scheduling and healthy?) and the <strong>workloads</strong> (are pods running, within limits, and serving?). Each cloud offers a native agent-based view and a managed Prometheus path; most mature teams use both." },
              { t: "h", text: "The collection layer" },
              { t: "table", headers: ["Signal", "AWS (ECS and EKS)", "Azure (AKS)", "Google Cloud (GKE)"], rows: [
                ["Curated container metrics", "CloudWatch Container Insights (enhanced observability for EKS)", "Container Insights in Azure Monitor", "GKE system metrics in Cloud Monitoring (on by default)"],
                ["Prometheus metrics", "Amazon Managed Service for Prometheus, managed scraper or ADOT collector", "Azure Monitor managed Prometheus", "Managed Service for Prometheus"],
                ["Dashboards", "Amazon Managed Grafana", "Azure Managed Grafana", "Cloud Monitoring dashboards; Grafana"],
                ["Container logs", "Fluent Bit (FireLens on ECS) to CloudWatch Logs", "Container Insights logs (ContainerLogV2)", "Cloud Logging (on by default)"],
                ["Control-plane logs", "EKS control-plane logging: api, audit, authenticator, scheduler, controller manager (opt in)", "AKS resource logs via diagnostic settings", "GKE control-plane logs in Cloud Logging"]
              ] },
              { t: "note", variant: "warn", html: "EKS control-plane logs are off by default and billed as CloudWatch Logs once enabled. Turn on at least <code class='tok'>audit</code> and <code class='tok'>authenticator</code> for security investigations, and set retention." },
              { t: "h", text: "The metrics that matter" },
              { t: "table", headers: ["Layer", "Watch", "Why"], rows: [
                ["Workload", "Restarts, OOMKilled terminations, CPU throttling, ready replicas versus desired", "The first signs of bad limits or a failing release"],
                ["Scheduling", "Pending pods, autoscaler or Karpenter activity, node provisioning time", "Capacity problems before users notice"],
                ["Node", "Memory, disk and PID pressure; NotReady nodes", "Node-level failures that evict many pods at once"],
                ["Network", "Pod IP exhaustion in VPC CNI subnets, DNS (CoreDNS) errors and latency", "Two classic EKS outage causes"],
                ["Service", "Request rate, errors, latency per service (from traces or the mesh)", "What users actually feel"]
              ] },
              { t: "widget", id: "obsK8sTriage" },
              { t: "note", variant: "tip", html: "Average CPU hides throttling. A pod with a tight CPU limit can sit at 40% average and still be throttled during every burst. Alert on the throttled-periods ratio, not on CPU utilization alone." },
              { t: "p", html: "Dashboard design and recording rules are general SRE craft; see <a href='../sre-academy/index.html#/tools/metrics/grafana'>Beacon: Grafana dashboards that help on-call</a> and <a href='../sre-academy/index.html#/tools/metrics/recording-rules'>Beacon: Recording and alerting rules as code</a>." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'pods keep restarting', 'deploys hang', 'latency spikes but CPU is low' — restarts and termination reasons, pending pods and IP capacity, and CPU throttling plus traces." },
              { t: "note", variant: "key", html: "<strong>Monitor the cluster and the workloads separately, and start from the symptom.</strong> Use Container Insights or its Azure and GKE equivalents for curated views, managed Prometheus and Grafana for depth, and enable control-plane audit logs." }
            ]
          },
          {
            id: "tracing-apm",
            title: "Tracing, APM and synthetics: ADOT, X-Ray, Application Signals, canaries and RUM",
            summary: "Instrumenting with OpenTelemetry on each cloud, what Application Signals and Application Insights add, and outside-in monitoring with synthetic canaries and real user monitoring.",
            minutes: 10,
            tags: ["tracing", "adot", "x-ray", "application-signals", "synthetics", "rum"],
            blocks: [
              { t: "p", html: "Server-side metrics tell you a service is slow; traces tell you <em>which hop</em> is slow; synthetic and real-user monitoring tell you what the customer actually saw. Each cloud now builds its APM on OpenTelemetry, which keeps instrumentation portable." },
              { t: "h", text: "Inside-out: traces and APM" },
              { t: "table", headers: ["Capability", "AWS", "Azure", "Google Cloud"], rows: [
                ["Instrumentation", "AWS Distro for OpenTelemetry (ADOT); AWS now recommends OpenTelemetry over the older X-Ray SDKs", "Azure Monitor OpenTelemetry distro", "OpenTelemetry with the Google Cloud exporters or OTLP"],
                ["Trace store and map", "X-Ray traces and trace map", "Application Insights application map", "Cloud Trace"],
                ["Auto-instrumented APM", "CloudWatch Application Signals (service dashboards, SLOs)", "Application Insights auto-instrumentation", "Cloud Trace with Cloud Run and GKE integrations"],
                ["Serverless", "Lambda active tracing; ADOT Lambda layer", "Functions integration with Application Insights", "Cloud Run trace propagation"]
              ] },
              { t: "p", html: "Sampling and context propagation work the same everywhere and are covered in Beacon: <a href='../sre-academy/index.html#/otel/pipeline/sampling'>Head and tail sampling</a> and <a href='../sre-academy/index.html#/otel/pipeline/context-propagation'>Context propagation</a>. The cloud-specific part is making sure managed services (load balancers, API Gateway, queues) pass the trace header through, or the trace breaks at the first managed hop." },
              { t: "h", text: "Outside-in: synthetics and real users" },
              { t: "table", headers: ["Capability", "AWS", "Azure", "Google Cloud"], rows: [
                ["Uptime and API checks", "Route 53 health checks; CloudWatch Synthetics canaries", "Application Insights availability (standard) tests", "Uptime checks"],
                ["Scripted user journeys", "Synthetics canaries (browser scripts on a schedule)", "Availability tests with custom code via Functions", "Synthetic monitors"],
                ["Real user monitoring", "CloudWatch RUM", "Application Insights browser SDK", "Third-party or OpenTelemetry web instrumentation"],
                ["Internet path", "CloudWatch Internet Monitor", "Connection Monitor", "Network Intelligence Center"]
              ] },
              { t: "code", lang: "text", code:
                "Synthetic canary for checkout (pseudo-steps, runs every 5 min from 2 regions)\n" +
                "  1. GET  https://shop.example/            expect 200 < 800 ms\n" +
                "  2. POST /login   (test account, secret from the secret store)\n" +
                "  3. add item, GET /cart                   expect item present\n" +
                "  4. POST /checkout?dry_run=true           expect 200\n" +
                "Alarm: 2 of 3 consecutive runs fail -> page"
              },
              { t: "note", variant: "warn", html: "Canaries need credentials for the user journey. Use a dedicated test account with minimal rights, fetch its password from Secrets Manager or Key Vault at run time, and make sure test orders are flagged so they never ship or bill." },
              { t: "compare",
                bad: { title: "Inside-out only", items: ["Dashboards green while DNS or a certificate is broken", "Nobody notices a broken login at 3 a.m.", "Traces stop at the API Gateway"] },
                good: { title: "Inside-out and outside-in", items: ["Canaries walk the critical journeys from two regions", "RUM shows real browser latency by country", "Trace headers propagate through every managed hop"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'customers reported it before we did' means synthetics and RUM; 'we cannot see where the time goes across services' means OpenTelemetry tracing with an APM view; 'traces are broken into pieces' means header propagation." },
              { t: "note", variant: "key", html: "<strong>Instrument with OpenTelemetry, view in the native APM, and watch from the outside.</strong> ADOT and X-Ray or Application Signals, Application Insights, and Cloud Trace cover inside-out; canaries and real user monitoring catch what server-side metrics miss." }
            ]
          },
          {
            id: "security-monitoring",
            title: "Multi-account security monitoring: org trail, Config, GuardDuty and Security Hub",
            summary: "The native detective controls on AWS wired organization-wide through a delegated security account, their Azure and Google Cloud counterparts, and where a CNAPP such as Wiz fits.",
            minutes: 11,
            tags: ["guardduty", "security-hub", "aws-config", "delegated-admin", "cnapp"],
            blocks: [
              { t: "p", html: "Security monitoring in a multi-account estate has one shape on every cloud: <strong>collect everywhere automatically, administer from a dedicated security account, and route findings to owners</strong>. The audit lesson covered the evidence (the organization trail and log archive); this lesson covers the detectors that read it." },
              { t: "h", text: "The native AWS detective stack" },
              { t: "table", headers: ["Service", "What it does", "Org-wide setup"], rows: [
                ["CloudTrail organization trail", "Every API call in every account, to the log archive", "Created once in the management account or by the landing zone"],
                ["AWS Config", "Records resource configuration over time and evaluates rules and conformance packs", "Aggregator in the security account; organization rules and conformance packs"],
                ["GuardDuty", "Threat detection from CloudTrail, VPC flow logs, DNS logs, plus optional S3, EKS, runtime, malware and RDS protection", "Delegated administrator; auto-enable for new accounts"],
                ["Security Hub", "Aggregates findings, runs posture standards such as AWS Foundational Security Best Practices and CIS", "Delegated administrator; cross-region aggregation; central configuration"],
                ["IAM Access Analyzer", "External and unused access findings", "Organization-level analyzer"],
                ["Inspector", "Vulnerability scanning for EC2, container images and Lambda", "Delegated administrator; auto-enable"],
                ["Detective / Security Lake", "Investigation graphs; a normalized (OCSF) security data lake for a SIEM", "Optional, in the security account"]
              ] },
              { t: "note", variant: "tip", html: "AWS has been folding these into a broader Security Hub experience; the original findings-and-standards capability is now referred to as Security Hub CSPM. The architecture below is unchanged: one delegated admin account, organization-wide enablement, findings routed by automation." },
              { t: "diagram", id: "landing-zone", caption: "Detectors run in every account; the security tooling account is delegated administrator; evidence lands in the log archive." },
              { t: "ol", items: [
                "Make the <strong>security tooling account</strong> the delegated administrator for GuardDuty, Security Hub, Config aggregation, Inspector and Access Analyzer.",
                "<strong>Auto-enable</strong> for every existing and future account, in every region you allow (deny the rest with an SCP).",
                "Protect the detectors with SCPs: deny disabling GuardDuty, deleting Config recorders and leaving the organization.",
                "Route findings through <strong>EventBridge</strong> to ticketing, chat or SOAR by severity and account owner tag; use Security Hub automation rules to suppress accepted risks with an expiry.",
                "Send everything to the SIEM from the security account, not from workload accounts."
              ] },
              { t: "code", lang: "javascript", code:
                "// EventBridge rule in the security account: high-severity GuardDuty findings to the on-call queue\n" +
                "{\n" +
                "  \"source\": [\"aws.guardduty\"],\n" +
                "  \"detail-type\": [\"GuardDuty Finding\"],\n" +
                "  \"detail\": { \"severity\": [{ \"numeric\": [\">=\", 7] }] }\n" +
                "}"
              },
              { t: "h", text: "The same pattern on Azure and Google Cloud" },
              { t: "table", headers: ["Job", "AWS", "Azure", "Google Cloud"], rows: [
                ["Configuration history and rules", "AWS Config", "Azure Resource Graph, Azure Policy compliance", "Cloud Asset Inventory, Organization Policy"],
                ["Threat detection", "GuardDuty", "Microsoft Defender for Cloud plans", "Security Command Center threat detection"],
                ["Posture and findings hub", "Security Hub", "Defender for Cloud (secure score, recommendations)", "Security Command Center"],
                ["SIEM", "Security Lake plus a SIEM of choice", "Microsoft Sentinel", "Google Security Operations"],
                ["Org-wide enablement", "Delegated administrator", "Defender plans assigned at management group with Azure Policy", "SCC activated at organization level"]
              ] },
              { t: "h", text: "Where a CNAPP fits" },
              { t: "p", html: "Native detectors are strong, cheap and deep within one cloud. A <strong>cloud-native application protection platform</strong> such as Wiz adds a single risk graph across AWS, Azure and Google Cloud, joining vulnerabilities, identities, network exposure and sensitive data into prioritized attack paths, plus code-to-cloud tracing back to the repository. Many enterprises run both: native services for detection and evidence, the CNAPP for cross-cloud prioritization." },
              { t: "p", html: "Forge covers Wiz in depth: <a href='../devsecops-academy/index.html#/wiz/platform/cnapp'>What a CNAPP is</a>, <a href='../devsecops-academy/index.html#/wiz/platform/posture'>CSPM, CIEM, DSPM and KSPM</a> and <a href='../devsecops-academy/index.html#/wiz/platform/security-graph'>the Security Graph and attack paths</a>." },
              { t: "table", headers: ["Tier", "Security monitoring", "Gap"], rows: [
                ["Naive", "GuardDuty turned on in a few accounts by hand", "New accounts are blind; findings go nowhere"],
                ["Solid", "Delegated admin, auto-enable everywhere, SCPs protecting detectors, findings routed by EventBridge", "Prioritization across clouds is manual"],
                ["Standout", "Solid on every cloud, SIEM fed centrally, a CNAPP risk graph for prioritization, and response runbooks per finding type", "Ongoing tuning effort"]
              ] },
              { t: "quiz", id: "obs-native" },
              { t: "note", variant: "key", html: "<strong>Enable detectors everywhere, administer them from one security account, and route every finding to an owner.</strong> Config, GuardDuty, Security Hub and Inspector on AWS; Defender for Cloud and Sentinel on Azure; Security Command Center on Google Cloud; and a CNAPP when you need one risk view across all three." }
            ]
          }
        ]
      }
    ]
  };
})();
