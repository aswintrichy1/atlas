/* =====================================================================
   NIMBUS · Storage & Managed Data
   window.TRACKS.data — modules: storage / databases / analytics

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

  /* A <select class="w-field">. `pairs` is [[value, label], ...]; values are numbers. */
  function picker(pairs, initial, onPick) {
    var sel;
    sel = h("select", { class: "w-field", onchange: function () {
      var v = parseFloat(sel.value);
      if (!isNaN(v)) onPick(v);
    } });
    for (var i = 0; i < pairs.length; i++) {
      sel.appendChild(h("option", { value: String(pairs[i][0]), selected: pairs[i][0] === initial ? "selected" : null }, pairs[i][1]));
    }
    return sel;
  }

  function ro(label, value) {
    return h("span", { class: "ro" }, label + " ", h("b", {}, String(value)));
  }

  function labelled(text, control) {
    return h("div", { style: "display:flex;flex-direction:column;gap:4px" },
      h("span", { style: "font-size:0.74rem;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.04em" }, text),
      control);
  }

  function commas(n) {
    var x = Math.round(isFinite(n) ? n : 0);
    var neg = x < 0;
    var s = String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + s;
  }

  function money(n) {
    if (!isFinite(n)) n = 0;
    return Math.abs(n) >= 100 ? "$" + commas(n) : "$" + n.toFixed(2);
  }

  var Widgets = {};

  /* ==================================================================
     1. dataS3Lifecycle — 12 months of storage + retrieval cost
     ILLUSTRATIVE per-GB rates, a single cohort written at month 0,
     request charges ignored. The point is the shape, not the bill.
  ================================================================== */
  var S3_RATE = {
    std: 0.023,       // Standard, $/GB-month
    ia: 0.0125,       // Standard-IA
    gfr: 0.0036,      // Glacier Flexible Retrieval
    itArch: 0.004,    // Intelligent-Tiering archive instant access tier
    itMon: 0.00016,   // monitoring fee per GB-month, assuming ~16 MB average objects
    iaGet: 0.01,      // retrieval $/GB from Standard-IA
    gfrGet: 0.01      // restore $/GB from Glacier Flexible (standard tier)
  };
  var S3_READS = { frequent: 2, monthly: 0.25, rarely: 0.01 };

  function s3Month(policy, access, gb, m) {
    var reads = S3_READS[access] || 0.25;
    var r = Math.min(1, reads);
    var store = 0, get = 0;
    if (policy === "std") {
      store = gb * S3_RATE.std;
    } else if (policy === "ia30") {
      if (m === 1) store = gb * S3_RATE.std;
      else { store = gb * S3_RATE.ia; get = gb * reads * S3_RATE.iaGet; }
    } else if (policy === "gfr90") {
      if (m <= 3) store = gb * S3_RATE.std;
      else { store = gb * S3_RATE.gfr; get = gb * reads * S3_RATE.gfrGet; }
    } else {
      if (m === 1) store = gb * S3_RATE.std;
      else if (m <= 3) store = gb * (r * S3_RATE.std + (1 - r) * S3_RATE.ia);
      else {
        var arch = Math.pow(1 - r, 3);
        var inf = Math.max(0, (1 - r) - arch);
        store = gb * (r * S3_RATE.std + inf * S3_RATE.ia + arch * S3_RATE.itArch);
      }
      store += gb * S3_RATE.itMon;
    }
    return { store: store, get: get };
  }

  Widgets.dataS3Lifecycle = function (mount) {
    shell(mount, "cost model", "Lifecycle policy versus 12 months of cost",
      "Illustrative per-GB rates only (Standard $0.023, Standard-IA $0.0125, Glacier Flexible $0.0036, Intelligent-Tiering archive-instant $0.004 per GB-month; retrieval $0.01/GB). One dataset written in month 1, request fees ignored. Violet bars are 'leave it in Standard'; pink is your policy, amber its retrieval fees.");

    var tb = 10, access = "monthly", policy = "ia30";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var gb = tb * 1024;
      var months = [], totalP = 0, totalS = 0, totalGet = 0, maxBar = 0, m;
      for (m = 1; m <= 12; m++) {
        var p = s3Month(policy, access, gb, m);
        var s = s3Month("std", access, gb, m);
        months.push({ p: p, s: s.store });
        totalP += p.store + p.get;
        totalGet += p.get;
        totalS += s.store;
        if (p.store + p.get > maxBar) maxBar = p.store + p.get;
        if (s.store > maxBar) maxBar = s.store;
      }
      maxBar = Math.max(maxBar, 0.0001);
      clear(stage);
      var chart = h("div", { style: "display:flex;align-items:flex-end;gap:6px;height:150px;padding:6px 2px;border-bottom:1px solid var(--line-strong)" });
      for (m = 0; m < 12; m++) {
        var mo = months[m];
        var sH = Math.max(2, Math.round(mo.s / maxBar * 140));
        var pS = Math.max(2, Math.round(mo.p.store / maxBar * 140));
        var pG = mo.p.get > 0 ? Math.max(1, Math.round(mo.p.get / maxBar * 140)) : 0;
        chart.appendChild(h("div", { style: "flex:1;display:flex;align-items:flex-end;gap:2px;min-width:0", title: "month " + (m + 1) + ": policy " + money(mo.p.store + mo.p.get) + ", Standard " + money(mo.s) },
          h("i", { style: "display:block;flex:1;height:" + sH + "px;background:var(--violet);border-radius:3px 3px 0 0;opacity:0.8" }),
          h("span", { style: "flex:1;display:flex;flex-direction:column;justify-content:flex-end" },
            pG ? h("i", { style: "display:block;height:" + pG + "px;background:var(--amber);border-radius:3px 3px 0 0" }) : null,
            h("i", { style: "display:block;height:" + pS + "px;background:var(--accent);" + (pG ? "" : "border-radius:3px 3px 0 0") }))));
      }
      stage.appendChild(chart);
      stage.appendChild(h("div", { style: "display:flex;justify-content:space-between;font-size:0.74rem;color:var(--text-dim);font-family:var(--font-mono);padding-top:4px" },
        h("span", {}, "month 1"), h("span", {}, "month 6"), h("span", {}, "month 12")));

      var diff = totalS - totalP;
      var warnText = "";
      if (policy === "std") warnText = access === "rarely" ? "No minimum durations, but you are paying the top rate for data nobody reads." : "No minimum durations or retrieval fees — the right answer for hot data.";
      else if (policy === "ia30") warnText = "Standard-IA bills a 30-day minimum and a 128 KB minimum object size, and lifecycle can move objects there only after 30 days in Standard." + (access === "frequent" ? " At this read rate, retrieval fees outweigh the storage saving." : "");
      else if (policy === "gfr90") warnText = "Glacier Flexible Retrieval bills a 90-day minimum and needs a restore (minutes to hours) before any read." + (access !== "rarely" ? " Regular reads mean regular restore jobs — Glacier Instant Retrieval or Standard-IA fits this access pattern better." : "");
      else warnText = "No retrieval fees and no minimum duration; a small per-object monitoring fee applies (modelled assuming ~16 MB objects), and objects under 128 KB are not auto-tiered.";

      clear(readout);
      readout.appendChild(ro("12-month total", money(totalP)));
      readout.appendChild(ro("all-Standard", money(totalS)));
      readout.appendChild(ro(diff >= 0 ? "saves" : "costs more", money(Math.abs(diff)) + " (" + Math.round(Math.abs(diff) / Math.max(totalS, 0.0001) * 100) + "%)"));
      readout.appendChild(ro("of which retrieval", money(totalGet)));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5;color:var(--text-dim)" }, "Note: " + warnText));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-wrap:wrap;gap:12px" },
      labelled("dataset", segment([[1, "1 TB"], [10, "10 TB"], [100, "100 TB"]], 1, function (v) { tb = v; paint(); })),
      labelled("access pattern", segment([["frequent", "Frequent"], ["monthly", "Monthly"], ["rarely", "Rarely"]], 1, function (v) { access = v; paint(); })),
      labelled("lifecycle policy", segment([["std", "Stay Standard"], ["ia30", "→ IA at 30d"], ["gfr90", "→ Glacier Flexible at 90d"], ["it", "Intelligent-Tiering"]], 1, function (v) { policy = v; paint(); }))
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. dataDynamoCapacity — RCU / WCU calculator with a hot-key check
     Integer math with Math.ceil. Per-partition ceilings are the
     commonly cited ~3,000 RCU and ~1,000 WCU.
  ================================================================== */
  function dynamoMath(sizeKb, reads, writes, mode, hotPct) {
    var rUnits = Math.max(1, Math.ceil(sizeKb / 4));
    var wUnits = Math.max(1, Math.ceil(sizeKb / 1));
    var rcu;
    if (mode === "eventual") rcu = Math.ceil(reads * rUnits / 2);
    else if (mode === "strong") rcu = reads * rUnits;
    else rcu = reads * rUnits * 2;
    var wcu = writes * wUnits * (mode === "transactional" ? 2 : 1);
    var hotR = Math.ceil(rcu * hotPct / 100);
    var hotW = Math.ceil(wcu * hotPct / 100);
    var parts = Math.max(1, Math.ceil(rcu / 3000 + wcu / 1000));
    return { rUnits: rUnits, wUnits: wUnits, rcu: rcu, wcu: wcu, hotR: hotR, hotW: hotW, parts: parts };
  }

  Widgets.dataDynamoCapacity = function (mount) {
    shell(mount, "calculator", "DynamoDB capacity and the hot key",
      "Reads are billed in 4 KB units (strong = 1 RCU, eventual = 0.5, transactional = 2 per unit); writes in 1 KB units (transactional = 2 WCU per unit). The bars show how much of one partition's ceiling the hottest key would use.");

    var size = 3, reads = 1000, writes = 100, mode = "eventual", hot = 10;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function bar(label, value, ceiling) {
      var pct = Math.min(100, Math.round(value / Math.max(1, ceiling) * 100));
      var overflow = value > ceiling;
      return h("div", { style: "display:grid;grid-template-columns:minmax(120px,1fr) minmax(120px,3fr) minmax(90px,auto);gap:12px;align-items:center;padding:6px 0" },
        h("span", { style: "font-size:0.84rem;color:var(--text)" }, label),
        h("span", { style: "display:block;background:var(--surface-solid);border:1px solid var(--line);border-radius:6px;overflow:hidden" },
          h("i", { style: "display:block;height:10px;width:" + Math.max(2, pct) + "%;background:" + (overflow ? "var(--rose)" : "var(--accent)") })),
        h("span", { style: "font-family:var(--font-mono);font-size:0.82rem;color:var(--text-dim)" }, commas(value) + " / " + commas(ceiling)));
    }

    function paint() {
      var r = dynamoMath(size, reads, writes, mode, hot);
      clear(stage);
      stage.appendChild(h("pre", { style: "margin:0 0 10px;font-family:var(--font-mono);font-size:0.8rem;line-height:1.6;color:var(--text);white-space:pre-wrap" },
        "read units per item  = ceil(" + size + " KB / 4) = " + r.rUnits + "\n" +
        "RCU = " + commas(reads) + " reads/s x " + r.rUnits + (mode === "eventual" ? " / 2 (eventual)" : mode === "strong" ? " (strong)" : " x 2 (transactional)") + " = " + commas(r.rcu) + "\n" +
        "write units per item = ceil(" + size + " KB / 1) = " + r.wUnits + "\n" +
        "WCU = " + commas(writes) + " writes/s x " + r.wUnits + (mode === "transactional" ? " x 2 (transactional)" : "") + " = " + commas(r.wcu)));
      stage.appendChild(bar("hottest key RCU", r.hotR, 3000));
      stage.appendChild(bar("hottest key WCU", r.hotW, 1000));
      var hotNote = (r.hotR > 3000 || r.hotW > 1000)
        ? "Hot partition: one key value needs " + commas(r.hotR) + " RCU / " + commas(r.hotW) + " WCU, above the ~3,000 / ~1,000 a single partition serves. Adding table capacity will not help — shard the key (e.g. a 0-9 suffix), cache reads with DAX, or redesign the access pattern."
        : "The hottest key fits inside one partition's ceilings. Adaptive capacity can absorb moderate skew, but keep watching throttled-request metrics.";
      clear(readout);
      readout.appendChild(ro("RCU", commas(r.rcu)));
      readout.appendChild(ro("WCU", commas(r.wcu)));
      readout.appendChild(ro("hot key", hot + "% of traffic"));
      readout.appendChild(ro("partitions for throughput (illustrative)", "≥ " + commas(r.parts)));
      readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5;color:var(--text-dim)" }, hotNote));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "flex-wrap:wrap;gap:12px" },
      labelled("item size", picker([[0.5, "0.5 KB"], [1, "1 KB"], [3, "3 KB"], [4, "4 KB"], [6, "6 KB"], [10, "10 KB"], [40, "40 KB"], [100, "100 KB"], [400, "400 KB (max)"]], 3, function (v) { size = v; paint(); })),
      labelled("reads / s", picker([[100, "100"], [1000, "1,000"], [5000, "5,000"], [20000, "20,000"]], 1000, function (v) { reads = v; paint(); })),
      labelled("writes / s", picker([[10, "10"], [100, "100"], [1000, "1,000"], [5000, "5,000"]], 100, function (v) { writes = v; paint(); })),
      labelled("consistency", segment([["eventual", "Eventual"], ["strong", "Strong"], ["transactional", "Transactional"]], 0, function (v) { mode = v; paint(); })),
      labelled("hottest key share", segment([[1, "1%"], [10, "10%"], [50, "50%"]], 1, function (v) { hot = v; paint(); }))
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "data-storage": {
      title: "Object, block and file storage checkpoint",
      sub: "S3 security and consistency, storage classes, lifecycle, EBS, EFS and FSx.",
      questions: [
        {
          q: "What is the minimum storage duration billed for S3 Glacier Flexible Retrieval?",
          options: ["None", "30 days", "90 days", "180 days"],
          answer: 2,
          explain: "Glacier Flexible Retrieval and Glacier Instant Retrieval bill a 90-day minimum, Standard-IA and One Zone-IA 30 days, and Deep Archive 180 days. Deleting or transitioning early still charges the remainder. That is why lifecycle rules should only push data into cold classes it will actually stay in."
        },
        {
          q: "How does reading an object in GCS Archive differ from reading one in S3 Glacier Flexible Retrieval?",
          options: ["GCS Archive returns data in milliseconds (with a retrieval fee); Glacier Flexible needs a restore that takes minutes to hours", "Both require a restore job that takes hours", "Both return data in milliseconds with no fee", "GCS Archive needs a 15-hour rehydration, Glacier Flexible is instant"],
          answer: 0,
          explain: "All GCS storage classes serve reads with the same low latency; colder classes trade that for retrieval fees and minimum durations. S3 Glacier Flexible and Deep Archive, and Azure Blob's Archive tier, need a restore or rehydration first. This is one of the most important places the cross-cloud mapping is loose."
        },
        {
          q: "An EBS volume lives in us-east-1a. You need its data on an instance in us-east-1b. What do you do?",
          options: ["Attach it directly; EBS is regional", "Snapshot it and create a new volume from the snapshot in us-east-1b", "Enable Multi-Attach across the two AZs", "Mount it over NFS from the other AZ"],
          answer: 1,
          explain: "EBS volumes are AZ-scoped and attach only to instances in their own AZ. Snapshots are stored regionally, so you can create a volume from one in any AZ of the region (or copy it to another region). Multi-Attach works only within one AZ, and only for io1/io2 volumes."
        },
        {
          q: "Compliance requires that audit objects cannot be deleted or overwritten by anyone, including the root user, for seven years. What do you use?",
          options: ["Versioning alone", "S3 Object Lock in compliance mode with a seven-year retention period", "A lifecycle expiration rule at seven years", "MFA delete"],
          answer: 1,
          explain: "Object Lock in compliance mode makes retention unremovable for its duration, even by the account root user. Governance mode can be bypassed by principals with a special permission, and versioning or MFA delete only make deletion harder. Expiration rules delete data; they never protect it."
        },
        {
          q: "Several Linux instances across three AZs need one shared POSIX file system that grows automatically. Which service fits?",
          options: ["EBS io2 with Multi-Attach", "Instance store volumes", "S3 Standard mounted through a FUSE client", "Amazon EFS"],
          answer: 3,
          explain: "EFS is a regional NFS file system mounted from every AZ that grows and shrinks with the data. io2 Multi-Attach is single-AZ and needs a cluster-aware file system, instance store vanishes with the instance, and S3 behind FUSE is not a POSIX file system. On Azure the analogue is Azure Files (NFS) and on GCP Filestore."
        }
      ]
    },
    "data-databases": {
      title: "Managed databases checkpoint",
      sub: "RDS, Aurora, DynamoDB, and their Azure and GCP counterparts.",
      questions: [
        {
          q: "In a classic RDS Multi-AZ instance deployment, what is the standby used for?",
          options: ["Serving read traffic to offload the primary", "Nothing until failover; it is a synchronously replicated standby that is not readable", "Asynchronous cross-region disaster recovery", "Running a different database engine"],
          answer: 1,
          explain: "The single-standby Multi-AZ deployment replicates synchronously to another AZ purely for failover and does not serve reads. Read scaling comes from read replicas, which are asynchronous. The newer Multi-AZ DB cluster option has two readable standbys, so be precise about which one you mean."
        },
        {
          q: "Items are 6 KB and the app does 100 strongly consistent reads per second. How many RCUs does that need?",
          options: ["100", "150", "200", "300"],
          answer: 2,
          explain: "Reads are billed in 4 KB units, rounded up, so a 6 KB item is ceil(6/4) = 2 units. Strongly consistent reads cost one RCU per unit, giving 100 x 2 = 200 RCU. Eventually consistent reads would halve that to 100, and transactional reads would double it to 400."
        },
        {
          q: "Which read consistency do DynamoDB global secondary indexes support?",
          options: ["Strongly consistent reads, if you ask for them", "Eventually consistent reads only", "Transactional reads only", "Whatever the base table uses"],
          answer: 1,
          explain: "GSIs are maintained asynchronously from the base table, so they only offer eventually consistent reads. Local secondary indexes share the base partition and can be read strongly, but must be created with the table. If a read must reflect the last write, read the base table by its key."
        },
        {
          q: "What is distinctive about Aurora's storage layer compared with standard RDS?",
          options: ["It uses one large EBS volume per instance", "Data is kept as six copies across three AZs in a shared volume that the writer and all replicas read", "It stores tables as objects in your S3 bucket", "It runs on instance store for speed"],
          answer: 1,
          explain: "Aurora separates compute from a distributed storage service that keeps six copies across three AZs and uses write quorums. Replicas read the same volume rather than replaying a copy, so replica lag is typically small and failover is fast. AlloyDB on GCP and Hyperscale on Azure SQL use a similar disaggregated idea."
        },
        {
          q: "You need a relational database with strong consistency across regions and horizontally scalable writes on GCP. Which service?",
          options: ["Cloud SQL for PostgreSQL", "AlloyDB", "Spanner", "Firestore"],
          answer: 2,
          explain: "Spanner shards data automatically and uses synchronised clocks to give externally consistent transactions across regions. Cloud SQL and AlloyDB are single-writer PostgreSQL-family databases with read replicas, and Firestore is a document database. AWS's closest newer option is Aurora DSQL; Azure has no exact equivalent."
        }
      ]
    },
    "data-analytics": {
      title: "Streaming and analytics checkpoint",
      sub: "Kinesis, MSK, Firehose, Event Hubs, Pub/Sub, data lakes and warehouses.",
      questions: [
        {
          q: "What is the write capacity of one provisioned Kinesis Data Streams shard?",
          options: ["1 MB/s or 1,000 records/s, whichever comes first", "2 MB/s or 2,000 records/s", "10 MB/s with no record limit", "Unlimited; shards only limit reads"],
          answer: 0,
          explain: "Each shard accepts up to 1 MB/s or 1,000 records per second of writes, and serves 2 MB/s of reads shared across standard consumers (or 2 MB/s per consumer with enhanced fan-out). Producers exceeding that get throttled. On-demand mode manages shard count for you at a different price shape."
        },
        {
          q: "Which change most reduces Athena query cost on a large S3 dataset?",
          options: ["Store data as gzip CSV in one big file per day", "Store columnar Parquet, partitioned by a column queries filter on, and filter on it", "Increase the number of Kinesis shards", "Run Athena on a larger instance type"],
          answer: 1,
          explain: "Athena bills by bytes scanned, so the levers are scanning fewer columns (Parquet or ORC), fewer files (partition pruning) and compressed data. A query that reads three columns from one day's partition can scan a tiny fraction of the table. Athena has no instance size to change."
        },
        {
          q: "How does Amazon Data Firehose differ from Kinesis Data Streams?",
          options: ["Firehose is a managed delivery service that buffers records and writes them to destinations near-real-time; Data Streams is a replayable stream you read with your own consumers", "They are the same service with two names", "Firehose keeps data for 365 days for replay", "Data Streams writes to S3 automatically without any consumer"],
          answer: 0,
          explain: "Firehose has no consumers to write: it batches by size or time, optionally converts to Parquet, and lands data in S3, Redshift, OpenSearch and others. Data Streams stores ordered records per shard for a retention window so many consumers can read and replay them. Event Hubs Capture and Pub/Sub BigQuery subscriptions are the loose equivalents of Firehose."
        },
        {
          q: "Under BigQuery on-demand pricing, what drives query cost?",
          options: ["Node-hours of the cluster", "Bytes processed by each query (storage is billed separately)", "Number of rows returned to the client", "Number of users with access"],
          answer: 1,
          explain: "On-demand BigQuery charges by the bytes a query processes, which is why partitioning, clustering and selecting only needed columns matter. Capacity pricing instead buys slots for predictable spend. Storage is a separate line item, which is the storage-compute separation in practice."
        },
        {
          q: "Compared with Kinesis Data Streams, what capacity unit do you not manage in GCP Pub/Sub?",
          options: ["IAM permissions on topics", "Shards or partitions", "Subscriptions", "Message schemas"],
          answer: 1,
          explain: "Pub/Sub scales topics automatically with no shard or partition count to plan, and delivers per message with acknowledgements. You still manage IAM, subscriptions and schemas. Ordering is opt-in per ordering key, unlike the per-shard ordering Kinesis and Kafka give by design."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.data = {
    id: "data",
    name: "Storage & Managed Data",
    short: "DATA",
    tagline: "Store it safely, query it cheaply",
    color: "#a78bfa",
    blurb: "Object, block and file storage; relational and NoSQL managed databases; streams, data lakes and warehouses. S3, EBS, RDS, Aurora, DynamoDB, Kinesis, Athena and Redshift — each mapped to Azure Blob, Managed Disks, Azure SQL, Cosmos DB, Event Hubs and Synapse/Fabric, and to GCS, Persistent Disk, Cloud SQL, Spanner, Pub/Sub and BigQuery. Encrypted at rest, private by default.",
    modules: [
      {
        id: "storage",
        name: "Object, Block & File Storage",
        icon: "grid",
        lessons: [
          {
            id: "s3-model",
            title: "The S3 model: buckets, keys, consistency and security",
            summary: "How object storage actually behaves, and the five settings that keep a bucket private and intact.",
            minutes: 10,
            tags: ["s3", "object-storage", "encryption", "bucket-policy", "object-lock"],
            blocks: [
              { t: "p", html: "Object storage is a <strong>giant key-value store for files</strong>. A bucket holds objects; each object is a key (a string that merely looks like a path), the bytes, and metadata. There are no directories and no in-place edits: you write a whole object, read a whole object or a byte range, and delete it." },
              { t: "h", text: "The mechanics worth knowing" },
              { t: "ul", items: [
                "<strong>Strong read-after-write consistency</strong> for every PUT, overwrite, DELETE and LIST, at no extra cost. Code that sleeps and retries waiting for S3 to 'catch up' is solving a problem that no longer exists.",
                "Bucket names are global across all AWS accounts; objects can be up to 5 TB, and anything over ~100 MB should use multipart upload.",
                "Throughput scales per key prefix — at least 3,500 writes and 5,500 reads per second per prefix — so high-rate workloads spread keys across prefixes.",
                "Durability is designed for eleven nines across multiple AZs for most classes; availability is a separate, lower number."
              ] },
              { t: "h", text: "Mapped across clouds" },
              { t: "table", headers: ["Concept", "AWS", "Azure", "GCP"], rows: [
                ["Container of objects", "Bucket", "Storage account → container", "Bucket"],
                ["Default encryption at rest", "SSE-S3 on by default; SSE-KMS for key control", "Microsoft-managed keys by default; customer-managed keys in Key Vault", "Google-managed by default; CMEK with Cloud KMS"],
                ["Block anonymous access", "Block Public Access (on by default for new buckets)", "'Allow blob anonymous access' disabled", "Public access prevention"],
                ["Authorisation model", "IAM + bucket policies; ACLs disabled by default", "Entra ID RBAC; SAS tokens for delegated access", "IAM with uniform bucket-level access"],
                ["WORM retention", "Object Lock (governance / compliance)", "Immutable storage policies (time-based, legal hold)", "Bucket Lock / object retention lock"]
              ] },
              { t: "h", text: "Encryption choices" },
              { t: "table", headers: ["Option", "Who holds the key", "Use when"], rows: [
                ["SSE-S3", "S3 manages AES-256 keys", "The baseline; already on for every new object"],
                ["SSE-KMS", "A KMS key you control (policy, rotation, CloudTrail of every use)", "You need key-level access control, separation of duties, or crypto-shredding — enable S3 Bucket Keys to cut KMS request cost"],
                ["DSSE-KMS", "Two layers of KMS-based encryption", "A regulator explicitly asks for dual-layer encryption"],
                ["SSE-C", "You send the key with every request", "Rarely; you now own key storage and loss"]
              ] },
              { t: "h", text: "A bucket policy worth copying" },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"Version\": \"2012-10-17\",\n" +
                "  \"Statement\": [\n" +
                "    { \"Sid\": \"DenyInsecureTransport\", \"Effect\": \"Deny\", \"Principal\": \"*\", \"Action\": \"s3:*\",\n" +
                "      \"Resource\": [\"arn:aws:s3:::orders-exports-<ACCOUNT_ID>\", \"arn:aws:s3:::orders-exports-<ACCOUNT_ID>/*\"],\n" +
                "      \"Condition\": { \"Bool\": { \"aws:SecureTransport\": \"false\" } } },\n" +
                "    { \"Sid\": \"DenyWrongKmsKey\", \"Effect\": \"Deny\", \"Principal\": \"*\", \"Action\": \"s3:PutObject\",\n" +
                "      \"Resource\": \"arn:aws:s3:::orders-exports-<ACCOUNT_ID>/*\",\n" +
                "      \"Condition\": { \"StringNotEqualsIfExists\": {\n" +
                "        \"s3:x-amz-server-side-encryption-aws-kms-key-id\": \"arn:aws:kms:<REGION>:<ACCOUNT_ID>:key/<KEY_ID>\" } } }\n" +
                "  ]\n" +
                "}"
              },
              { t: "code", lang: "javascript", code:
                "// ANTI-PATTERN: never ship this. It makes every object readable by anyone on the internet,\n" +
                "// and it only works if Block Public Access has been switched off first.\n" +
                "{ \"Effect\": \"Allow\", \"Principal\": \"*\", \"Action\": \"s3:GetObject\",\n" +
                "  \"Resource\": \"arn:aws:s3:::orders-exports-<ACCOUNT_ID>/*\" }"
              },
              { t: "note", variant: "tip", html: "Public website assets belong behind a CDN (CloudFront with origin access control, Azure Front Door, Cloud CDN) reading from a <strong>private</strong> bucket. Nothing legitimate needs a world-readable bucket." },
              { t: "h", text: "Protecting data from deletion" },
              { t: "compare",
                bad: { title: "Hoping nobody deletes it", items: ["No versioning: an overwrite destroys the old object", "Admins can delete anything", "Backups in the same account as the data"] },
                good: { title: "Designed to survive mistakes and ransomware", items: ["Versioning on, with lifecycle expiring old versions", "Object Lock compliance mode for regulated records", "Replication to a separate account with its own keys"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'immutable audit logs', 'ransomware', 'regulator requires WORM' point to Object Lock compliance mode; 'control who can decrypt' points to SSE-KMS with a key policy; 'serve images publicly' points to a CDN in front of a private bucket." },
              { t: "note", variant: "key", html: "<strong>Object storage is strongly consistent, private and encrypted by default — keep it that way.</strong> Leave Block Public Access on, require TLS and your KMS key in the bucket policy, and turn on versioning plus Object Lock where deletion would be a disaster." }
            ]
          },
          {
            id: "storage-classes",
            title: "Storage classes, lifecycle rules and cold-tier traps",
            summary: "Match class to access pattern, automate the moves, and respect minimum durations and retrieval latency.",
            minutes: 11,
            tags: ["s3", "storage-classes", "lifecycle", "glacier", "blob-tiers", "gcs"],
            blocks: [
              { t: "p", html: "Storage classes trade <strong>cheaper storage for more expensive or slower access</strong>. Each colder class lowers the per-GB price and adds some combination of retrieval fees, minimum storage durations, minimum billable object sizes and — for archive tiers — restore latency." },
              { t: "h", text: "S3 classes" },
              { t: "table", headers: ["Class", "Min duration", "Retrieval", "Fits"], rows: [
                ["Standard", "None", "Milliseconds, no fee", "Hot data, unknown patterns at first"],
                ["Intelligent-Tiering", "None", "Milliseconds, no fee; small monitoring fee per object", "Unknown or changing access patterns"],
                ["Standard-IA", "30 days", "Milliseconds, per-GB fee", "Read about monthly, needs multi-AZ resilience"],
                ["One Zone-IA", "30 days", "Milliseconds, per-GB fee", "Re-creatable data; lost if the AZ is lost"],
                ["Glacier Instant Retrieval", "90 days", "Milliseconds, higher per-GB fee", "Archives read a few times a year, instantly"],
                ["Glacier Flexible Retrieval", "90 days", "Restore: minutes (expedited) to hours (standard / bulk)", "Backups and archives with planned access"],
                ["Glacier Deep Archive", "180 days", "Restore: within about 12 hours, or longer for bulk", "Compliance archives kept for years"]
              ] },
              { t: "note", variant: "warn", html: "The IA and Glacier Instant classes bill a <strong>128 KB minimum object size</strong>, and archive classes add per-object overhead. Millions of tiny objects can cost more after a lifecycle transition than before. Aggregate small files, or filter lifecycle rules by object size." },
              { t: "h", text: "Azure Blob tiers and GCS classes" },
              { t: "table", headers: ["Temperature", "AWS S3", "Azure Blob", "GCS", "Where the mapping is loose"], rows: [
                ["Hot", "Standard", "Hot", "Standard", "Close"],
                ["Monthly", "Standard-IA (30d)", "Cool (30d)", "Nearline (30d)", "Close"],
                ["Quarterly", "Glacier Instant (90d)", "Cold (90d)", "Coldline (90d)", "Close: all online, millisecond reads"],
                ["Archive", "Glacier Flexible (90d) / Deep Archive (180d)", "Archive (180d), rehydrate in hours", "Archive (365d), <strong>millisecond reads</strong>", "GCS Archive needs no restore; S3 Glacier Flexible / Deep and Azure Archive do"],
                ["Automatic", "Intelligent-Tiering", "Lifecycle management rules (last-access-time based)", "Autoclass", "Different fee models and tier sets"]
              ] },
              { t: "h", text: "Lifecycle rules" },
              { t: "code", lang: "javascript", code:
                "{\n" +
                "  \"Rules\": [{\n" +
                "    \"ID\": \"logs-tiering\",\n" +
                "    \"Filter\": { \"And\": { \"Prefix\": \"app-logs/\", \"ObjectSizeGreaterThan\": 131072 } },\n" +
                "    \"Status\": \"Enabled\",\n" +
                "    \"Transitions\": [\n" +
                "      { \"Days\": 30,  \"StorageClass\": \"STANDARD_IA\" },\n" +
                "      { \"Days\": 120, \"StorageClass\": \"GLACIER\" }\n" +
                "    ],\n" +
                "    \"Expiration\": { \"Days\": 400 },\n" +
                "    \"NoncurrentVersionExpiration\": { \"NoncurrentDays\": 30 },\n" +
                "    \"AbortIncompleteMultipartUpload\": { \"DaysAfterInitiation\": 7 }\n" +
                "  }]\n" +
                "}"
              },
              { t: "ul", items: [
                "Lifecycle can only move objects to Standard-IA after they have been in Standard for at least 30 days.",
                "Expire <strong>noncurrent versions</strong>, or versioning quietly doubles your bill on overwrite-heavy prefixes.",
                "Abort incomplete multipart uploads — orphaned parts are billed and invisible in a normal listing."
              ] },
              { t: "widget", id: "dataS3Lifecycle" },
              { t: "p", html: "Try 'Frequent' with 'IA at 30d': retrieval fees overtake the storage discount. Try 'Monthly' with 'Glacier Flexible': the bill looks fine, but every read is a restore job measured in hours. Intelligent-Tiering is rarely the cheapest in hindsight and rarely badly wrong — which is exactly its value when you do not know the pattern yet." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'access pattern unknown' points to Intelligent-Tiering or Autoclass; 'keep seven years, almost never read' points to Deep Archive or Azure Archive; 'archive but must open instantly' points to Glacier Instant Retrieval, Azure Cold or GCS Archive." },
              { t: "note", variant: "key", html: "<strong>Colder is cheaper to keep and dearer to touch.</strong> Pick the class from the read pattern, automate moves with lifecycle rules, and check minimum durations, small-object minimums and restore latency before you transition anything." }
            ]
          },
          {
            id: "block-file",
            title: "Block and file storage: EBS, EFS and FSx",
            summary: "Disks attached to one VM, file systems shared by many, and the AZ boundaries that shape both.",
            minutes: 10,
            tags: ["ebs", "efs", "fsx", "managed-disks", "persistent-disk", "filestore"],
            blocks: [
              { t: "p", html: "<strong>Block storage</strong> is a virtual disk: one VM formats it and owns it, so it is fast and simple. <strong>File storage</strong> is a network file system many machines mount at once. Object storage is neither: it is accessed over an API, not mounted. Picking wrong here causes most 'why is this so slow / so expensive' storage incidents." },
              { t: "h", text: "EBS in practice" },
              { t: "table", headers: ["Volume", "Performance model", "Use it for"], rows: [
                ["gp3 (SSD)", "Baseline 3,000 IOPS and 125 MB/s at any size; buy more IOPS and throughput independently", "The default boot and data volume"],
                ["io2 Block Express (SSD)", "Provisioned IOPS into the hundreds of thousands, sub-millisecond latency, higher durability", "Large, latency-sensitive databases"],
                ["st1 / sc1 (HDD)", "Throughput-oriented, cheap per GB", "Sequential scans, logs, cold data"],
                ["Instance store", "Local NVMe on the host; gone when the instance stops or fails", "Caches, scratch space, replicated data stores"]
              ] },
              { t: "ul", items: [
                "Volumes are <strong>AZ-scoped</strong>: they attach only to instances in the same AZ.",
                "<strong>Snapshots</strong> are incremental and regional; restore into any AZ, copy to other regions or accounts, and automate them with Data Lifecycle Manager or AWS Backup.",
                "Turn on <strong>EBS encryption by default</strong> per region so no unencrypted volume can be created; snapshots of encrypted volumes stay encrypted.",
                "Migrating gp2 to gp3 is an online change and usually cuts cost while decoupling performance from size."
              ] },
              { t: "h", text: "Shared file systems" },
              { t: "table", headers: ["Need", "AWS", "Azure", "GCP"], rows: [
                ["Linux NFS shared across AZs", "EFS (regional, elastic)", "Azure Files (NFS) or Azure NetApp Files", "Filestore"],
                ["Windows SMB with Active Directory", "FSx for Windows File Server", "Azure Files (SMB)", "NetApp Volumes, or Filestore for NFS only"],
                ["HPC scratch, S3-linked", "FSx for Lustre", "Azure Managed Lustre", "Managed Lustre / Parallelstore"],
                ["Enterprise NAS features (multi-protocol, snapshots, SnapMirror)", "FSx for NetApp ONTAP", "Azure NetApp Files", "Google Cloud NetApp Volumes"]
              ] },
              { t: "h", text: "Block storage mapped" },
              { t: "table", headers: ["Concept", "AWS", "Azure", "GCP"], rows: [
                ["General SSD disk", "EBS gp3", "Premium SSD / Premium SSD v2", "Persistent Disk balanced, Hyperdisk Balanced"],
                ["Top-end IOPS", "io2 Block Express", "Ultra Disk", "Hyperdisk Extreme"],
                ["Zone scope", "Single AZ", "Zonal (LRS); ZRS disks replicate across zones", "Zonal; <strong>regional PD</strong> replicates synchronously across two zones"],
                ["Point-in-time copy", "Snapshots (regional)", "Incremental snapshots", "Snapshots (multi-regional or regional)"]
              ] },
              { t: "note", variant: "warn", html: "Azure ZRS disks and GCP regional Persistent Disk replicate a disk across zones; EBS has no direct equivalent. On AWS you get cross-AZ resilience from the application (database replication, Multi-AZ RDS) or from EFS — a real gap to mention when mapping designs." },
              { t: "compare",
                bad: { title: "Wrong tool", items: ["EFS for a single database's data files", "EBS 'shared' by rsyncing between instances", "Instance store holding the only copy of anything"] },
                good: { title: "Right tool", items: ["EBS gp3 or io2 for one database instance", "EFS or FSx when many hosts need the same files", "Instance store only for caches or replicated data"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'lift-and-shift Windows file share' points to FSx for Windows or Azure Files; 'shared home directories for a Linux fleet' points to EFS or Filestore; 'database needs 100k IOPS' points to io2, Ultra Disk or Hyperdisk Extreme." },
              { t: "quiz", id: "data-storage" },
              { t: "note", variant: "key", html: "<strong>One host, use a disk; many hosts, use a file system; an API, use objects.</strong> EBS is AZ-bound and recovered through snapshots, so design cross-AZ resilience above it — and encrypt every volume by default." }
            ]
          }
        ]
      },
      {
        id: "databases",
        name: "Managed Databases",
        icon: "database",
        lessons: [
          {
            id: "relational",
            title: "Managed relational: RDS, Aurora, Azure SQL, Cloud SQL and Spanner",
            summary: "High availability versus read scaling, backups and PITR, and when a distributed SQL engine is worth it.",
            minutes: 12,
            tags: ["rds", "aurora", "azure-sql", "cloud-sql", "alloydb", "spanner"],
            blocks: [
              { t: "p", html: "A managed relational database is still the database you know — PostgreSQL, MySQL, SQL Server — with the cloud running patching, backups, replication and failover. Keep two ideas apart: <strong>high availability</strong> (a standby that takes over) and <strong>read scaling</strong> (replicas that serve queries). Many designs confuse the two." },
              { t: "h", text: "RDS: three ways to add a second copy" },
              { t: "table", headers: ["Option", "Replication", "Readable?", "Purpose"], rows: [
                ["Multi-AZ instance", "Synchronous to one standby in another AZ", "No", "Automatic failover, typically one to two minutes"],
                ["Multi-AZ DB cluster (MySQL, PostgreSQL)", "Semi-synchronous to two standbys", "Yes", "Faster failover, typically well under a minute, plus read capacity"],
                ["Read replica", "Asynchronous, same or another region", "Yes", "Read scaling and DR; promote manually"]
              ] },
              { t: "h", text: "Backups and point-in-time recovery" },
              { t: "ul", items: [
                "Automated backups take daily snapshots plus transaction logs, kept for 1–35 days, so you can restore to any second in that window (the latest restorable time is typically a few minutes ago).",
                "A restore always creates a <strong>new</strong> instance; repointing the application is part of the runbook.",
                "Manual snapshots persist until deleted; copy them to another region and another account for real DR.",
                "Encryption at rest is set at creation, and backups, snapshots and replicas inherit it. Enable it on every instance."
              ] },
              { t: "h", text: "Aurora: compute separated from storage" },
              { t: "p", html: "Aurora keeps your data in a distributed storage layer — <strong>six copies across three AZs</strong>, written with quorums — shared by the writer and up to 15 readers. Replicas do not replay a copy of the data, so replica lag is typically milliseconds and failover usually completes in well under a minute." },
              { t: "stat", items: [
                { v: "6 × 3", k: "copies × AZs" },
                { v: "15", k: "read replicas" },
                { v: "< 1 s", k: "typical global DB lag" },
                { v: "ACUs", k: "Serverless v2 unit" }
              ] },
              { t: "ul", items: [
                "<strong>Serverless v2</strong> scales capacity in fine-grained ACU steps within a min/max you set, and newer versions can pause at zero when idle. Great for spiky or dev workloads; a fixed instance is cheaper at steady high load.",
                "<strong>Global Database</strong> replicates storage to secondary regions with typically sub-second lag, and supports managed switchover and failover for regional DR.",
                "Choose the <strong>I/O-Optimized</strong> configuration when I/O charges become a large share of the bill."
              ] },
              { t: "diagram", id: "dr-tiers", caption: "Aurora Global Database sits in the warm-standby to active/passive range: low RPO, minutes of RTO." },
              { t: "h", text: "Mapped across clouds" },
              { t: "table", headers: ["Need", "AWS", "Azure", "GCP", "Where it is loose"], rows: [
                ["Managed PostgreSQL / MySQL", "RDS", "Azure Database for PostgreSQL / MySQL Flexible Server", "Cloud SQL", "Close; HA options and failover times differ"],
                ["Managed SQL Server", "RDS for SQL Server", "Azure SQL Database, SQL Managed Instance", "Cloud SQL for SQL Server", "Azure's PaaS SQL is the deepest offering here"],
                ["Cloud-native storage-separated engine", "Aurora", "Azure SQL Hyperscale", "AlloyDB (PostgreSQL)", "Similar idea, different engines and limits"],
                ["Serverless autoscaling relational", "Aurora Serverless v2", "Azure SQL Database serverless tier", "AlloyDB / Cloud SQL do not scale to zero the same way", "Loose"],
                ["Globally distributed, strongly consistent SQL", "Aurora DSQL (newer)", "No exact equivalent", "Spanner", "Spanner is the most mature here"]
              ] },
              { t: "note", variant: "trap", html: "Never put a database in a public subnet or open its port to <code class='tok'>0.0.0.0/0</code>. Keep it in private data subnets, allow only the app tier's security group, require TLS, and use IAM database authentication or a secrets manager with rotation instead of passwords in config." },
              { t: "h", text: "Naive / Solid / Standout" },
              { t: "table", headers: ["Tier", "Answer to 'make the orders DB highly available'", "Why it scores that way"], rows: [
                ["Naive", "'Add a read replica'", "Asynchronous replicas lose recent writes on failover and are not automatic"],
                ["Solid", "Multi-AZ (or Aurora with a replica in another AZ), PITR with 35-day retention, replicas for read scaling, encrypted and private", "Separates HA from read scaling and covers recovery"],
                ["Standout", "Solid, plus states RTO/RPO targets, adds cross-region snapshot copies or Global Database for regional DR, tests restores on a schedule, and puts a connection proxy (RDS Proxy) in front for failover and connection storms", "Turns availability into numbers that are rehearsed"]
              ] },
              { t: "note", variant: "key", html: "<strong>Standbys keep you up; replicas make you fast; backups bring you back.</strong> Name which one you are adding, map it to Azure and GCP, and reach for Spanner-class distributed SQL only when one writer region truly cannot cope." }
            ]
          },
          {
            id: "dynamodb",
            title: "DynamoDB: keys, capacity and hot partitions",
            summary: "Design the key for the access pattern, compute RCUs and WCUs, and keep any one key under its partition ceiling.",
            minutes: 12,
            tags: ["dynamodb", "partition-key", "rcu", "wcu", "gsi", "ttl", "streams"],
            blocks: [
              { t: "p", html: "DynamoDB is a key-value and document store that hashes each item's <strong>partition key</strong> to a partition, then orders items in that partition by an optional <strong>sort key</strong>. Reads by key are single-digit milliseconds at almost any scale — as long as the key spreads traffic evenly. Everything else follows from that." },
              { t: "h", text: "Keys are your query plan" },
              { t: "ul", items: [
                "<code class='tok'>GetItem</code> needs the full key; <code class='tok'>Query</code> needs a partition key and optionally a sort-key condition; <code class='tok'>Scan</code> reads everything and is almost always the wrong answer in production.",
                "Choose a high-cardinality partition key that matches how you read: <code class='tok'>customerId</code>, <code class='tok'>deviceId</code>, <code class='tok'>orderId</code> — not <code class='tok'>status</code> or <code class='tok'>date</code>.",
                "Items are capped at 400 KB; large blobs go to S3 with a pointer in the item."
              ] },
              { t: "h", text: "Capacity units" },
              { t: "code", lang: "text", code:
                "RCU: one strongly consistent read per second of an item up to 4 KB\n" +
                "     eventually consistent = 0.5 RCU per 4 KB, transactional = 2 RCU per 4 KB\n" +
                "WCU: one write per second of an item up to 1 KB; transactional = 2 WCU per 1 KB\n\n" +
                "example: 3 KB items, 1,000 eventual reads/s, 100 writes/s\n" +
                "  reads:  ceil(3/4) = 1 unit x 1,000 x 0.5 = 500 RCU\n" +
                "  writes: ceil(3/1) = 3 units x 100       = 300 WCU\n\n" +
                "per-partition ceiling (commonly cited): ~3,000 RCU and ~1,000 WCU"
              },
              { t: "widget", id: "dataDynamoCapacity" },
              { t: "p", html: "Push the hottest-key share to 50% at 5,000 writes per second and the bar turns rose: no amount of table capacity helps, because one key value lives on one partition. The fixes are <strong>write sharding</strong> (append a suffix such as <code class='tok'>#0</code>–<code class='tok'>#9</code> and fan reads across them), caching reads with DAX, or rethinking the key." },
              { t: "h", text: "On-demand versus provisioned" },
              { t: "compare",
                bad: { title: "Provisioned (with auto scaling)", items: ["You set RCU/WCU; auto scaling adjusts within bounds", "Cheapest for steady, predictable traffic", "Reserved capacity can cut cost further", "Sudden spikes can throttle before scaling reacts"] },
                good: { title: "On-demand", items: ["Pay per request; no capacity planning", "Absorbs spikes well, within per-partition limits", "Costs more per request at steady high volume", "The sensible default for new or spiky tables"] } },
              { t: "h", text: "Indexes, TTL and streams" },
              { t: "table", headers: ["Feature", "What it does", "Gotcha"], rows: [
                ["Global secondary index", "A second key schema over the same items, with its own capacity", "Eventually consistent only; an under-provisioned GSI throttles writes to the base table"],
                ["Local secondary index", "Alternate sort key, same partition key", "Must be created with the table; caps each partition-key collection at 10 GB"],
                ["TTL", "Deletes items after an epoch timestamp attribute passes, at no write cost", "Deletion is lazy, typically within a few days — filter expired items in queries"],
                ["Streams", "Ordered per-item change log for 24 hours", "Drive Lambda for projections and fan-out; handlers must be idempotent"]
              ] },
              { t: "note", variant: "tip", html: "Encryption at rest is always on (AWS-owned key by default; choose a customer-managed KMS key when you need key control). Turn on point-in-time recovery and deletion protection for any table you would hate to lose." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'millions of writes per second', 'single-digit millisecond lookups by id', 'unpredictable spikes' point to DynamoDB on-demand; 'one celebrity user', 'one viral product' point to a hot partition and write sharding; 'expire sessions after 24 hours' points to TTL." },
              { t: "note", variant: "key", html: "<strong>Design the key before the table.</strong> Capacity is simple arithmetic in 4 KB read and 1 KB write units, but one key value can never exceed one partition's ceiling — so spread the hot keys or cache them." }
            ]
          },
          {
            id: "nosql-design",
            title: "Single-table design, Cosmos DB, Firestore and Bigtable",
            summary: "When to pack entities into one table, and how the other clouds' NoSQL services differ in model and consistency.",
            minutes: 10,
            tags: ["single-table", "cosmos-db", "firestore", "bigtable", "nosql"],
            blocks: [
              { t: "p", html: "NoSQL modelling starts from <strong>access patterns</strong>, not entities. You list every query the application makes, then shape keys so each query is a single <code class='tok'>Query</code> or <code class='tok'>GetItem</code>. Single-table design takes that to its conclusion: different entity types share one table so related items sit together under one partition key." },
              { t: "code", lang: "text", code:
                "PK               SK                      attributes\n" +
                "CUST#c-42        PROFILE                 name, email, tier\n" +
                "CUST#c-42        ORDER#2026-10-01#o-981  total, status\n" +
                "CUST#c-42        ORDER#2026-10-14#o-994  total, status\n" +
                "ORDER#o-994      ITEM#sku-7              qty, price\n\n" +
                "GSI1: GSI1PK = STATUS#SHIPPED   GSI1SK = 2026-10-14#o-994\n\n" +
                "'customer and recent orders' = Query PK = CUST#c-42, SK begins_with ORDER#, newest first"
              },
              { t: "h", text: "The trade-off, said plainly" },
              { t: "compare",
                bad: { title: "Costs of single-table design", items: ["Hard to read and onboard onto", "New access patterns can mean backfills or new GSIs", "Ad-hoc analytics need an export to S3 and Athena", "Tooling shows generic PK/SK columns"] },
                good: { title: "What it buys", items: ["One round trip for related data", "Fewer tables to provision, back up and secure", "Predictable latency at any scale", "Natural fit for well-known, stable access patterns"] } },
              { t: "note", variant: "tip", html: "Multiple tables are fine when entities have unrelated access patterns, different lifecycles or different owners. Single-table design is a tool for known, latency-critical patterns, not a rule." },
              { t: "h", text: "The NoSQL landscape mapped" },
              { t: "table", headers: ["Shape", "AWS", "Azure", "GCP", "Where the mapping is loose"], rows: [
                ["Key-value / document at scale", "DynamoDB", "Cosmos DB (NoSQL API)", "Firestore (document), Bigtable (wide-column)", "Capacity models and consistency options differ a lot"],
                ["Wide-column, very high write throughput", "Keyspaces (Cassandra-compatible)", "Cosmos DB for Apache Cassandra, Managed Instance for Cassandra", "Bigtable", "Bigtable is HBase-like with row-key range scans; Keyspaces follows CQL"],
                ["MongoDB-compatible documents", "DocumentDB", "Cosmos DB for MongoDB", "Firestore with MongoDB compatibility (newer)", "Compatibility levels vary; test your driver features"],
                ["Multi-region active-active", "DynamoDB global tables", "Cosmos DB multi-region writes", "Spanner, or Bigtable replication", "Conflict resolution and consistency semantics differ"]
              ] },
              { t: "h", text: "What is genuinely different" },
              { t: "ul", items: [
                "<strong>Cosmos DB</strong> bills in request units (a 1 KB point read is about 1 RU) and offers five consistency levels — strong, bounded staleness, session, consistent prefix, eventual — chosen per account and relaxable per request. DynamoDB offers eventual or strong per read.",
                "<strong>Firestore</strong> is serverless with strongly consistent queries and real-time listeners for mobile and web clients, but guidance limits sustained writes to a single document to roughly one per second.",
                "<strong>Bigtable</strong> is a provisioned-node, wide-column store sorted by row key. Range scans are its superpower; monotonically increasing keys such as timestamps create hotspots, so key design (reversing or prefixing) matters as much as DynamoDB's.",
                "Everything is encrypted at rest by default on all three; use customer-managed keys where policy requires them."
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'tunable consistency per request' points to Cosmos DB; 'mobile app with offline sync and live updates' points to Firestore; 'IoT time series, petabytes, range scans by device and time' points to Bigtable or Keyspaces; 'known access patterns, single-digit ms' points to DynamoDB with single-table design." },
              { t: "quiz", id: "data-databases" },
              { t: "note", variant: "key", html: "<strong>Model the queries, then the keys.</strong> Single-table design trades readability and flexibility for one-round-trip reads, and DynamoDB, Cosmos DB, Firestore and Bigtable differ in capacity units and consistency even where the names suggest a match." }
            ]
          }
        ]
      },
      {
        id: "analytics",
        name: "Streaming & Analytics",
        icon: "trend",
        lessons: [
          {
            id: "streaming",
            title: "Streams: Kinesis, MSK, Firehose, Event Hubs and Pub/Sub",
            summary: "Partitioned logs versus managed delivery, how throughput is provisioned, and what ordering really means.",
            minutes: 11,
            tags: ["kinesis", "msk", "kafka", "firehose", "event-hubs", "pub-sub"],
            blocks: [
              { t: "p", html: "A stream is an <strong>append-only, replayable log</strong> split into partitions. Producers write records with a key; records with the same key land in the same partition and stay in order; consumers track their own position and can rewind. That is different from a queue, where a message is gone once consumed." },
              { t: "h", text: "Kinesis Data Streams" },
              { t: "stat", items: [
                { v: "1 MB/s", k: "write per shard (or 1,000 rec/s)" },
                { v: "2 MB/s", k: "read per shard, shared" },
                { v: "24 h → 365 d", k: "retention range" },
                { v: "per key", k: "ordering scope" }
              ] },
              { t: "code", lang: "text", code:
                "sizing a provisioned stream (illustrative):\n" +
                "  peak ingest  = 12,000 events/s x 0.8 KB = 9.6 MB/s\n" +
                "  write shards = max(9.6 MB/s / 1 MB/s, 12,000 / 1,000) = 12\n" +
                "  3 consumer apps x 9.6 MB/s = 28.8 MB/s read -> 15 shards on shared reads,\n" +
                "     or keep 12 shards and use enhanced fan-out (2 MB/s per consumer per shard)\n" +
                "  or: on-demand mode and let Kinesis manage shards"
              },
              { t: "p", html: "A badly chosen partition key (a constant, or a tenant that sends half the traffic) concentrates writes on one shard, which throttles while others idle — the same hot-key lesson as DynamoDB." },
              { t: "h", text: "MSK: managed Apache Kafka" },
              { t: "p", html: "<strong>Amazon MSK</strong> runs Kafka brokers for you (provisioned clusters, or MSK Serverless). You get the Kafka API, ecosystem (Connect, Streams, schema registries) and topic/partition model; you still plan partitions, broker sizing and storage on provisioned clusters. Choose it when you already speak Kafka or need its ecosystem; choose Kinesis when you want the most AWS-native, least-operated option." },
              { t: "h", text: "Firehose: delivery, not a stream you consume" },
              { t: "ul", items: [
                "Buffers records by size or time, then writes to S3, Redshift, OpenSearch, Splunk, Snowflake or HTTP endpoints.",
                "Can convert JSON to Parquet using a Glue table schema and partition S3 output dynamically.",
                "Near-real-time by design: latency is the buffer interval, seconds to minutes — not milliseconds.",
                "No replay: once delivered, the source of truth is the destination."
              ] },
              { t: "h", text: "Mapped across clouds" },
              { t: "table", headers: ["Role", "AWS", "Azure", "GCP", "Where it is loose"], rows: [
                ["Partitioned stream", "Kinesis Data Streams (shards)", "Event Hubs (partitions; throughput or processing units)", "Pub/Sub (no partitions to manage)", "Pub/Sub acknowledges per message and orders only per ordering key, if enabled"],
                ["Managed Kafka", "MSK", "Event Hubs Kafka endpoint (protocol-compatible); HDInsight Kafka", "Managed Service for Apache Kafka", "Event Hubs speaks Kafka's protocol but is not Kafka; Confluent Cloud runs on all three"],
                ["Delivery to storage", "Firehose", "Event Hubs Capture", "Pub/Sub BigQuery and Cloud Storage subscriptions", "Different formats and buffering controls"],
                ["Stream processing", "Managed Service for Apache Flink", "Stream Analytics, or Flink / Spark on Databricks", "Dataflow (Apache Beam)", "Different programming models"]
              ] },
              { t: "note", variant: "warn", html: "Every one of these is at-least-once by default. Consumers must be idempotent or deduplicate on an event id. 'Exactly-once' features exist (Kafka transactions, Pub/Sub exactly-once delivery for pull, Flink checkpoints) but each has a narrow, specific meaning — say which one you mean." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'replay last week', 'multiple independent consumers' point to a stream (Kinesis, Kafka, Event Hubs); 'land clickstream in S3 as Parquet with no code' points to Firehose or Event Hubs Capture; 'global fan-out without capacity planning' points to Pub/Sub." },
              { t: "note", variant: "key", html: "<strong>A stream is a partitioned, replayable log; delivery services just move data.</strong> Size shards or partitions from bytes and records per second, pick keys that spread load, and design consumers for at-least-once." }
            ]
          },
          {
            id: "data-lake",
            title: "A data lake on S3: zones, Parquet, Glue, Lake Formation and Athena",
            summary: "Lay out the lake, make files cheap to scan, catalogue them, and govern access by column and row.",
            minutes: 11,
            tags: ["data-lake", "parquet", "glue", "lake-formation", "athena", "iceberg"],
            blocks: [
              { t: "p", html: "A data lake is <strong>object storage plus a catalogue plus engines</strong>. Data lands as files in S3, a catalogue records what tables those files form, and engines (Athena, Spark, Redshift Spectrum) read them in place. Compute is rented per query or per job; storage stays cheap and durable." },
              { t: "h", text: "Zones" },
              { t: "table", headers: ["Zone", "Contents", "Rules"], rows: [
                ["Raw (landing)", "Source data as received: JSON, CSV, CDC files", "Immutable, append-only, short retention or archived; few readers"],
                ["Curated (cleaned)", "Validated, deduplicated, typed Parquet or Iceberg tables", "Partitioned, schema-checked, the main analytical source"],
                ["Consumption (serving)", "Aggregates and data products for BI and ML", "Owned per domain, documented, access-controlled"]
              ] },
              { t: "h", text: "Make files cheap to scan" },
              { t: "ul", items: [
                "<strong>Columnar formats</strong> (Parquet, ORC) let engines read only the columns a query touches, compressed.",
                "<strong>Partitioning</strong> by a column queries filter on (usually date) lets engines skip whole prefixes. Do not partition by a high-cardinality column like user id.",
                "<strong>File size</strong>: aim for files in the hundreds of MB; thousands of tiny files make every query slow. Compact them.",
                "<strong>Open table formats</strong> (Apache Iceberg, Delta Lake, Hudi) add ACID updates, schema evolution and time travel on top of files — the basis of the lakehouse."
              ] },
              { t: "code", lang: "sql", code:
                "-- Athena: an Iceberg table in the curated zone\n" +
                "CREATE TABLE curated.orders (\n" +
                "  order_id     string,\n" +
                "  customer_id  string,\n" +
                "  amount_cents bigint,\n" +
                "  status       string,\n" +
                "  created_at   timestamp)\n" +
                "PARTITIONED BY (day(created_at))\n" +
                "LOCATION 's3://shop-lake-<ACCOUNT_ID>/curated/orders/'\n" +
                "TBLPROPERTIES ('table_type' = 'ICEBERG');\n\n" +
                "-- scans one day's files and two columns, not the whole table\n" +
                "SELECT status, sum(amount_cents) / 100.0 AS revenue\n" +
                "FROM curated.orders\n" +
                "WHERE created_at >= TIMESTAMP '2026-10-27 00:00:00'\n" +
                "  AND created_at <  TIMESTAMP '2026-10-28 00:00:00'\n" +
                "GROUP BY status;"
              },
              { t: "note", variant: "tip", html: "Athena bills by data scanned (illustratively a few dollars per TB). Converting raw JSON to partitioned Parquet commonly cuts scanned bytes by an order of magnitude or more — the single biggest cost lever in a lake." },
              { t: "h", text: "Catalogue and governance" },
              { t: "ul", items: [
                "<strong>Glue Data Catalog</strong>: the Hive-compatible metastore shared by Athena, EMR, Glue jobs and Redshift Spectrum. Crawlers can infer schemas, but in production define tables in code.",
                "<strong>Lake Formation</strong>: grants on databases, tables, columns and rows (and tag-based access with LF-Tags), enforced across integrated engines — instead of hand-writing S3 bucket policies per team.",
                "Encrypt every zone with SSE-KMS, use separate keys or buckets per sensitivity level, and keep the lake buckets private with Block Public Access on."
              ] },
              { t: "h", text: "Mapped across clouds" },
              { t: "table", headers: ["Layer", "AWS", "Azure", "GCP"], rows: [
                ["Lake storage", "S3 (or S3 Tables for managed Iceberg)", "ADLS Gen2 (Blob with hierarchical namespace), Fabric OneLake", "Cloud Storage"],
                ["Catalogue", "Glue Data Catalog", "Unity Catalog (Databricks), Microsoft Purview, Fabric", "Dataplex / BigLake metastore"],
                ["Fine-grained governance", "Lake Formation", "Unity Catalog, Purview policies", "BigLake tables with Dataplex policies"],
                ["Serverless SQL on files", "Athena", "Synapse serverless SQL, Fabric SQL endpoint", "BigQuery external / BigLake tables"],
                ["Spark", "EMR, Glue jobs", "Databricks, Fabric Spark, Synapse Spark", "Dataproc, Serverless Spark"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'queries are slow and expensive on JSON in S3' points to Parquet, partitioning and compaction; 'analysts may see salary only for their department' points to Lake Formation row and column filters; 'need updates and deletes for GDPR on lake data' points to Iceberg or Delta." },
              { t: "note", variant: "key", html: "<strong>A lake is files, a catalogue and governance — in that order of neglect.</strong> Store curated data as partitioned Parquet or Iceberg, register it in one catalogue, and grant access by column and row through Lake Formation or its equivalent." }
            ]
          },
          {
            id: "warehouses",
            title: "Warehouses: Redshift, BigQuery and Synapse / Fabric",
            summary: "Provisioned versus serverless, storage-compute separation, and the pricing shapes that decide the bill.",
            minutes: 10,
            tags: ["redshift", "bigquery", "synapse", "fabric", "warehouse"],
            blocks: [
              { t: "p", html: "A cloud warehouse is a massively parallel SQL engine over columnar storage. The modern ones all <strong>separate storage from compute</strong>, so you pay to keep data and pay separately to query it. The differences that matter are how compute is bought and how the bill responds to a bad query." },
              { t: "h", text: "Side by side" },
              { t: "table", headers: ["Dimension", "Redshift", "BigQuery", "Synapse / Fabric"], rows: [
                ["Provisioned option", "RA3 clusters (nodes) with managed storage", "Capacity pricing: reserved slots via editions", "Synapse dedicated SQL pools (DWUs, pausable); Fabric capacities (F SKUs)"],
                ["Serverless option", "Redshift Serverless (RPU-hours, base capacity you set)", "On-demand: billed per bytes processed", "Synapse serverless SQL (per TB processed); Fabric warehouse on shared capacity"],
                ["Storage-compute separation", "Yes with RA3 / Serverless (managed storage on S3)", "Yes, fundamental", "Yes; Fabric stores tables as Delta in OneLake"],
                ["Query the lake in place", "Redshift Spectrum, zero-ETL integrations", "External and BigLake tables", "Serverless SQL over ADLS; Fabric shortcuts"],
                ["Main performance levers", "Distribution and sort keys, materialized views, concurrency scaling", "Partitioning, clustering, BI Engine", "Distribution, indexing and result caching (dedicated); V-Order (Fabric)"]
              ] },
              { t: "note", variant: "warn", html: "Microsoft's strategic direction is <strong>Fabric</strong>; Synapse remains but new analytics designs on Azure increasingly start there. Say both names, and do not assume features are identical between them." },
              { t: "h", text: "Pricing shapes" },
              { t: "code", lang: "text", code:
                "illustrative shapes, not quotes:\n\n" +
                "BigQuery on-demand: cost ~ bytes processed per query (a few $ per TiB)\n" +
                "  -> one unfiltered SELECT * on a 50 TiB table is a very expensive mistake\n" +
                "BigQuery capacity:  cost ~ slots reserved x hours, whatever the bytes\n" +
                "Redshift Serverless: cost ~ RPUs x seconds while queries run (with a minimum per query)\n" +
                "Redshift provisioned / Synapse dedicated / Fabric: cost ~ capacity x hours provisioned\n" +
                "  -> pause or scale down out of hours, or pay for idle"
              },
              { t: "code", lang: "sql", code:
                "-- BigQuery: make scans small by design, and make full scans impossible\n" +
                "CREATE TABLE shop.orders (\n" +
                "  order_id     STRING,\n" +
                "  customer_id  STRING,\n" +
                "  amount_cents INT64,\n" +
                "  created_at   TIMESTAMP)\n" +
                "PARTITION BY DATE(created_at)\n" +
                "CLUSTER BY customer_id\n" +
                "OPTIONS (require_partition_filter = TRUE);"
              },
              { t: "h", text: "Naive / Solid / Standout" },
              { t: "table", headers: ["Tier", "Answer to 'which warehouse?'", "Why it scores that way"], rows: [
                ["Naive", "'BigQuery, because it is serverless and fast'", "No mention of the per-bytes cost model or the existing cloud and skills"],
                ["Solid", "Picks the warehouse native to the primary cloud, explains serverless versus provisioned pricing, and partitions or clusters the big tables", "Ties the choice to workload and cost shape"],
                ["Standout", "Solid, plus: sets cost guardrails (maximum bytes billed per query, workload management queues, budgets), keeps curated data in an open format in the lake so engines stay swappable, and moves steady heavy workloads to capacity pricing once usage is known", "Controls cost risk and keeps the exit door open"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'unpredictable ad-hoc queries from analysts' points to serverless with per-query guardrails; 'steady dashboard load all day' points to provisioned or capacity pricing; 'data already in Parquet on S3' points to Spectrum, Athena or an open-table lakehouse before copying anything." },
              { t: "quiz", id: "data-analytics" },
              { t: "note", variant: "key", html: "<strong>Every modern warehouse separates storage from compute; the pricing model is the real choice.</strong> Per-bytes serverless rewards partitioning and punishes careless scans, provisioned capacity rewards steady load, and an open lake format keeps both options available." }
            ]
          }
        ]
      }
    ]
  };
})();
