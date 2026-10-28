/* =====================================================================
   LEDGER · Postgres in Practice
   window.TRACKS.pg — modules: vacuum / ops / perf

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.

   Defaults quoted here match recent PostgreSQL releases (13–17). Where a
   setting changed between versions the lesson says so.
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

  function btn(label, cls, onClick) {
    var b = h("button", { type: "button", class: "w-btn" + (cls ? " " + cls : "") }, label);
    b.addEventListener("click", onClick);
    return b;
  }

  function fmt(n) {
    n = Math.round(n);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function pct(a, b) { return b > 0 ? Math.round((a / b) * 1000) / 10 : 0; }

  function legend(color, label) {
    return h("span", { style: "display:inline-flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-dim)" },
      h("i", { style: "display:inline-block;width:12px;height:12px;border-radius:3px;border:1px solid var(--line);background:" + color }),
      label);
  }

  var Widgets = {};

  /* ==================================================================
     1. pgVacuum — dead tuples, VACUUM, and a transaction pinning xmin
     Slots model the heap: live rows, dead-but-reclaimable versions,
     dead versions still visible to an old snapshot, and free space.
  ================================================================== */
  var ROWS_PER_PAGE = 60;

  Widgets.pgVacuum = function (mount) {
    shell(mount, "simulator", "Dead tuples, VACUUM and the xmin horizon",
      "Every UPDATE writes a new row version and leaves the old one dead. Run update batches, open a long transaction that pins the xmin horizon, and see what VACUUM, autovacuum and VACUUM FULL can and cannot reclaim. Rough model: about 60 rows per 8 KB page.");

    var n = 10000, sf = 0.2, longTxn = false;
    var st = null;

    function reset() {
      st = { live: n, deadOk: 0, deadPinned: 0, free: 0, msg: "Fresh table: every slot holds a live row, no dead tuples yet." };
    }

    function total() { return st.live + st.deadOk + st.deadPinned + st.free; }
    function threshold() { return 50 + sf * st.live; }

    function doUpdate(frac) {
      var k = Math.round(st.live * frac);
      if (longTxn) st.deadPinned += k; else st.deadOk += k;
      var reuse = Math.min(st.free, k);
      st.free -= reuse;
      var grew = k - reuse;
      st.msg = "UPDATE touched " + fmt(k) + " rows: " + fmt(k) + " new versions written (" + fmt(reuse) + " into free space, " +
        fmt(grew) + " by extending the table), " + fmt(k) + " old versions now dead" + (longTxn ? " and still visible to the open snapshot." : ".");
    }

    function doVacuum(label) {
      var got = st.deadOk;
      st.free += got;
      st.deadOk = 0;
      st.msg = label + " removed " + fmt(got) + " dead tuples and marked their space reusable. The file did not shrink." +
        (st.deadPinned ? " " + fmt(st.deadPinned) + " dead tuples are newer than the oldest open snapshot, so they must stay." : "");
    }

    function doAuto() {
      var dead = st.deadOk + st.deadPinned;
      var t = threshold();
      if (dead > t) doVacuum("Autovacuum (dead " + fmt(dead) + " > threshold " + fmt(t) + ")");
      else st.msg = "Autovacuum skipped: " + fmt(dead) + " dead tuples is not above the threshold 50 + " + sf + " \u00d7 " + fmt(st.live) + " = " + fmt(t) + ".";
    }

    function doFull() {
      if (longTxn) {
        st.msg = "VACUUM FULL is waiting: it needs an ACCESS EXCLUSIVE lock, and the long transaction holds ACCESS SHARE on this table. Every new query on the table now queues behind it too.";
        return;
      }
      var removed = st.deadOk + st.free;
      st.deadOk = 0;
      st.free = 0;
      st.msg = "VACUUM FULL rewrote the table into a new file: " + fmt(removed) + " slots of dead and free space returned to the OS. Reads and writes were blocked for the whole rewrite.";
    }

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function paint() {
      var T = total();
      clear(stage);
      var bar = h("div", { style: "display:flex;height:22px;border-radius:6px;overflow:hidden;border:1px solid var(--line);background:var(--surface-solid)" });
      var parts = [
        [st.live, "var(--accent)"],
        [st.deadOk, "var(--rose)"],
        [st.deadPinned, "var(--amber)"],
        [st.free, "var(--ink-800)"]
      ];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i][0] <= 0) continue;
        bar.appendChild(h("i", { style: "display:block;height:100%;width:" + (parts[i][0] / T * 100) + "%;background:" + parts[i][1] }));
      }
      stage.appendChild(bar);
      stage.appendChild(h("div", { style: "display:flex;flex-wrap:wrap;gap:14px;margin-top:8px" },
        legend("var(--accent)", "live rows"),
        legend("var(--rose)", "dead, reclaimable"),
        legend("var(--amber)", "dead, pinned by old snapshot"),
        legend("var(--ink-800)", "free space (reusable, not returned)")));
      stage.appendChild(h("p", { style: "font-size:0.86rem;color:var(--text);margin-top:10px;line-height:1.5" }, st.msg));

      var dead = st.deadOk + st.deadPinned;
      var t = threshold();
      clear(readout);
      readout.appendChild(ro("live", fmt(st.live)));
      readout.appendChild(ro("dead", fmt(dead)));
      readout.appendChild(ro("reclaimable now", fmt(st.deadOk)));
      readout.appendChild(ro("table pages", fmt(Math.ceil(T / ROWS_PER_PAGE))));
      readout.appendChild(ro("bloat", pct(dead + st.free, T) + "%"));
      readout.appendChild(ro("autovacuum threshold", fmt(t)));
      readout.appendChild(ro("autovacuum due", dead > t ? "yes" : "no"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([[1000, "1k rows"], [10000, "10k rows"], [1000000, "1M rows"]], 1, function (v) { n = v; reset(); paint(); }),
      segment([[0.2, "scale_factor 0.2"], [0.05, "0.05"], [0.01, "0.01"]], 0, function (v) { sf = v; paint(); }),
      segment([[false, "No long txn"], [true, "Long txn holds xmin"]], 0, function (v) {
        longTxn = v;
        if (!v && st.deadPinned) {
          st.deadOk += st.deadPinned;
          st.msg = "The long transaction ended. The xmin horizon advanced, so " + fmt(st.deadPinned) + " previously pinned dead tuples are now reclaimable.";
          st.deadPinned = 0;
        } else if (v) {
          st.msg = "A transaction opened a snapshot and is sitting idle. Anything that dies from now on stays visible to it.";
        }
        paint();
      })
    ));
    mount.appendChild(h("div", { class: "widget-controls" },
      btn("UPDATE 10%", "primary", function () { doUpdate(0.1); paint(); }),
      btn("UPDATE 40%", "", function () { doUpdate(0.4); paint(); }),
      btn("VACUUM", "", function () { doVacuum("VACUUM"); paint(); }),
      btn("Autovacuum check", "", function () { doAuto(); paint(); }),
      btn("VACUUM FULL", "", function () { doFull(); paint(); }),
      btn("Reset", "ghost", function () { reset(); paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    reset();
    paint();
  };

  /* ==================================================================
     2. pgPool — app instances x pool size vs max_connections
  ================================================================== */
  var MB_PER_BACKEND = 10;

  Widgets.pgPool = function (mount) {
    shell(mount, "capacity", "Connection pooling: who holds a server connection?",
      "Each app instance keeps its own client-side pool. Without a pooler every client connection is a Postgres backend process. Put PgBouncer in front and choose session or transaction pooling to see how many backends you actually need. Memory uses a rough planning figure of ~10 MB per idle backend, before work_mem.");

    var s = { inst: 12, pool: 20, maxConn: 200, mode: "direct", bouncer: 40, busy: 0.2 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function range(label, key, min, max, step) {
      var val = h("b", {}, String(s[key]));
      var input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(s[key]) });
      input.addEventListener("input", function () {
        var v = parseInt(input.value, 10);
        s[key] = isNaN(v) ? min : v;
        val.textContent = String(s[key]);
        paint();
      });
      return h("label", { class: "w-field", style: "display:flex;align-items:center;gap:8px;font-size:0.84rem" }, label, input, val);
    }

    function paint() {
      var clients = s.inst * s.pool;
      var server, queued = 0, status, note;
      if (s.mode === "direct") {
        server = clients;
        if (clients > s.maxConn) {
          status = "connection errors";
          note = fmt(clients - s.maxConn) + " client connections are refused with \u201csorry, too many clients already\u201d. Raising max_connections only trades this for memory and contention.";
          server = s.maxConn;
        } else {
          status = "ok";
          note = "Every client connection is a dedicated backend process, idle or not. Most of them are idle most of the time.";
        }
      } else if (s.mode === "session") {
        var capS = Math.min(s.bouncer, s.maxConn);
        server = Math.min(clients, capS);
        queued = Math.max(0, clients - capS);
        status = queued ? "clients waiting" : "ok";
        note = queued ? fmt(queued) + " client connections wait for another client to disconnect entirely: in session mode a server connection is pinned for the whole client session, so long-lived app pools starve the pooler."
          : "Session mode is safe for any feature (SET, temp tables, advisory locks) but saves nothing when app pools hold connections open.";
      } else {
        var capT = Math.min(s.bouncer, s.maxConn);
        var concurrent = Math.ceil(clients * s.busy);
        server = Math.min(concurrent, capT);
        queued = Math.max(0, concurrent - capT);
        status = queued ? "transactions queue" : "ok";
        note = (queued ? fmt(queued) + " concurrent transactions wait briefly for a free server connection. "
          : "Only clients that are inside a transaction right now hold a backend. ") +
          "Caveat: session state (SET, session advisory locks, LISTEN, temp tables, WITH HOLD cursors) does not survive between transactions.";
      }
      if (s.mode !== "direct" && s.bouncer > s.maxConn) note += " The PgBouncer pool is larger than max_connections, so the server would refuse the extra backends.";

      clear(stage);
      var used = Math.min(server, s.maxConn);
      var bar = h("div", { style: "height:18px;border-radius:6px;overflow:hidden;border:1px solid var(--line);background:var(--surface-solid)" },
        h("i", { style: "display:block;height:100%;width:" + Math.min(100, used / s.maxConn * 100) + "%;background:" + (status === "ok" ? "var(--accent)" : "var(--rose)") }));
      stage.appendChild(h("div", { style: "font-size:0.82rem;color:var(--text-dim);margin-bottom:6px" },
        "Server backends used: " + fmt(used) + " of max_connections " + fmt(s.maxConn)));
      stage.appendChild(bar);
      stage.appendChild(h("p", { style: "font-size:0.86rem;color:var(--text);margin-top:10px;line-height:1.5" }, note));

      clear(readout);
      readout.appendChild(ro("client connections", fmt(clients)));
      readout.appendChild(ro("server backends", fmt(server)));
      readout.appendChild(ro("backend memory", "~" + fmt(server * MB_PER_BACKEND) + " MB"));
      readout.appendChild(ro("waiting", fmt(queued)));
      readout.appendChild(ro("status", status));
    }

    mount.appendChild(h("div", { class: "widget-controls", style: "display:flex;flex-wrap:wrap;gap:12px" },
      range("App instances", "inst", 1, 40, 1),
      range("Pool per instance", "pool", 5, 50, 5),
      range("PgBouncer pool", "bouncer", 10, 200, 10)
    ));
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["direct", "No pooler"], ["session", "PgBouncer session"], ["transaction", "PgBouncer transaction"]], 0, function (v) { s.mode = v; paint(); }),
      segment([[100, "max_conn 100"], [200, "200"], [500, "500"]], 1, function (v) { s.maxConn = v; paint(); }),
      segment([[0.05, "5% busy"], [0.2, "20% busy"], [0.5, "50% busy"]], 1, function (v) { s.busy = v; paint(); })
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
    "pg-vacuum": {
      title: "VACUUM and bloat checkpoint",
      sub: "Dead tuples, freezing, HOT, autovacuum thresholds and what blocks cleanup.",
      questions: [
        {
          q: "You run UPDATE accounts SET balance = balance - 10 WHERE id = 7. What happens to the old row on disk?",
          options: [
            "It is overwritten in place and the old value goes only to the WAL",
            "It is moved to a separate undo segment and purged at commit",
            "It stays in the heap with xmax set to the updating transaction, becoming a dead tuple once no snapshot can see it",
            "It is deleted immediately and its slot reused by the new version"
          ],
          answer: 2,
          explain: "Postgres keeps row versions in the table itself. The UPDATE writes a new tuple and stamps the old one's xmax; older snapshots can still read it. Only after every snapshot that could see it has ended does it become removable, and VACUUM is what removes it."
        },
        {
          q: "A table has about 1,000,000 rows and default autovacuum settings. Roughly how many dead tuples must accumulate before autovacuum vacuums it?",
          options: ["More than 50", "More than 100,050", "More than 200,050", "More than 1,000,050"],
          answer: 2,
          explain: "The trigger is autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor \u00d7 reltuples, which is 50 + 0.2 \u00d7 1,000,000 = 200,050. On large tables that is a lot of dead rows, which is why big, hot tables usually get a smaller per-table scale factor."
        },
        {
          q: "VACUUM VERBOSE on a busy table reports many dead row versions that 'cannot be removed yet'. What is the most likely cause?",
          options: [
            "Something is holding back the xmin horizon: a long or idle-in-transaction session, a stale replication slot, or hot_standby_feedback from a lagging replica",
            "maintenance_work_mem is too small",
            "The table has no primary key",
            "autovacuum_naptime is too long"
          ],
          answer: 0,
          explain: "VACUUM may only remove versions that no running snapshot can see. The oldest xmin anywhere in the cluster sets that horizon, so one forgotten transaction, a prepared transaction, or a slot can pin cleanup for every table. Find it in pg_stat_activity and pg_replication_slots."
        },
        {
          q: "Which condition lets an UPDATE be a HOT (heap-only tuple) update?",
          options: [
            "The table has fillfactor 100",
            "The transaction runs at SERIALIZABLE",
            "The row was recently vacuumed",
            "No indexed column changes and the new version fits on the same heap page"
          ],
          answer: 3,
          explain: "A HOT update chains the new version on the same page and skips writing new index entries, because the index keys did not change. It needs free space on that page, which is why lowering fillfactor on update-heavy tables raises the HOT ratio."
        },
        {
          q: "A 400 GB table is 60% bloated and you need the disk back without blocking writes for hours. What do you reach for?",
          options: [
            "VACUUM FULL during business hours",
            "pg_repack, which rebuilds the table online and takes a heavy lock only briefly at the swap",
            "Plain VACUUM, which returns all free space to the operating system",
            "REINDEX on the primary key"
          ],
          answer: 1,
          explain: "Plain VACUUM makes space reusable inside the file but generally cannot shrink it (it only truncates empty pages at the very end). VACUUM FULL shrinks it but holds ACCESS EXCLUSIVE for the whole rewrite. pg_repack copies the table online with a trigger capturing changes, then swaps with a short exclusive lock; it still needs roughly the table's size in spare disk."
        }
      ]
    },
    "pg-ops": {
      title: "Postgres operations checkpoint",
      sub: "Pooling modes, the statistics views and declarative partitioning.",
      questions: [
        {
          q: "After moving an app behind PgBouncer in transaction mode, which pattern is most likely to break?",
          options: [
            "Plain single-statement SELECTs",
            "Multi-statement transactions wrapped in BEGIN/COMMIT",
            "INSERT ... RETURNING",
            "Relying on SET search_path or a session-level advisory lock persisting across transactions"
          ],
          answer: 3,
          explain: "In transaction mode a client gets a server connection only for the duration of one transaction, and the next transaction may land on a different backend. Anything stored in session state (SET, session advisory locks, LISTEN, temp tables, older-style protocol prepared statements) can vanish or leak to another client. Use SET LOCAL and transaction-level locks instead."
        },
        {
          q: "Which query is the right starting point for finding indexes nobody uses?",
          options: [
            "pg_stat_user_indexes where idx_scan = 0, checked across the primary and every replica since the last stats reset",
            "pg_stat_activity where state = 'idle'",
            "pg_locks where granted = false",
            "pg_stat_statements ordered by calls"
          ],
          answer: 0,
          explain: "idx_scan counts index scans per index. Zero is a candidate, not proof: counters are per node and reset on stats reset, replicas have their own counters, and unique or primary key indexes enforce constraints even if never scanned. Confirm over a full business cycle before dropping."
        },
        {
          q: "You want to rank queries by the total database time they consume. Where do you look?",
          options: [
            "pg_stat_activity ordered by query_start",
            "pg_stat_user_tables ordered by seq_scan",
            "pg_stat_statements ordered by total_exec_time",
            "pg_locks joined to pg_class"
          ],
          answer: 2,
          explain: "pg_stat_statements aggregates normalized query text with calls, total and mean execution time, rows and buffer counts. Total time finds the queries that cost the most overall, which is often a cheap query called millions of times rather than the slowest single query. It must be loaded via shared_preload_libraries."
        },
        {
          q: "An events table is range-partitioned by month. What is the cheapest way to enforce 13-month retention?",
          options: [
            "DELETE FROM events WHERE created_at < now() - interval '13 months' every night",
            "DETACH PARTITION the oldest month (CONCURRENTLY on 14+) and then DROP it",
            "VACUUM FULL the parent table weekly",
            "Add a CHECK constraint on the parent"
          ],
          answer: 1,
          explain: "Dropping a partition removes a whole file in a metadata operation: no dead tuples, no vacuum debt, no WAL for every row. A bulk DELETE does the opposite, producing millions of dead tuples and a long vacuum afterwards. Retention is one of the best reasons to partition at all."
        },
        {
          q: "Why is opening 2,000 direct connections to one Postgres server a problem even if most are idle?",
          options: [
            "Postgres caps connections at 1,024",
            "Idle connections hold row locks",
            "Idle connections disable autovacuum",
            "Each connection is a separate backend process with its own memory and snapshot bookkeeping, so many backends waste RAM and add contention"
          ],
          answer: 3,
          explain: "Postgres forks one process per connection. Each costs memory for catalog caches and private state, and every snapshot has to consider all backends, so throughput tends to drop well before you reach thousands. A pooler keeps a small number of busy backends instead."
        }
      ]
    },
    "pg-perf": {
      title: "Locks, memory and replication checkpoint",
      sub: "Lock queues, configuration arithmetic, slots and logical replication.",
      questions: [
        {
          q: "A migration runs ALTER TABLE orders ADD COLUMN note text while a 20-minute report is reading orders. Within seconds the app's simple SELECTs on orders start hanging. Why?",
          options: [
            "ADD COLUMN rewrites the table and saturates disk I/O",
            "The ALTER waits for ACCESS EXCLUSIVE behind the report, and every new query queues behind the waiting ALTER",
            "The report escalated its row locks to a table lock",
            "SELECTs always block during DDL in Postgres"
          ],
          answer: 1,
          explain: "Lock requests queue in order. The ALTER cannot get ACCESS EXCLUSIVE until the report's ACCESS SHARE is released, and new ACCESS SHARE requests conflict with the queued exclusive request, so they wait behind it. Set lock_timeout (for example a few seconds) on migrations and retry, so the ALTER gives up instead of stalling everyone."
        },
        {
          q: "work_mem is 64 MB. A reporting query has 4 sort and hash nodes, and 50 copies run at once. What is the rough worst case for that memory?",
          options: ["64 MB", "3.2 GB", "About 12.8 GB, more if hash nodes use hash_mem_multiplier", "256 MB"],
          answer: 2,
          explain: "work_mem is a per-node, per-backend budget, not a per-server cap: 64 MB \u00d7 4 nodes \u00d7 50 backends = 12,800 MB. Hash nodes may use work_mem \u00d7 hash_mem_multiplier, and parallel workers each get their own allowance. Raise work_mem per session or per role for reports rather than globally."
        },
        {
          q: "What does raising effective_cache_size from 4 GB to 48 GB actually do?",
          options: [
            "Nothing is allocated; the planner assumes more data is cached and favours index scans more often",
            "Postgres reserves 48 GB of shared memory at startup",
            "Each backend may use up to 48 GB for sorts",
            "The OS page cache is resized to 48 GB"
          ],
          answer: 0,
          explain: "effective_cache_size is only a planner estimate of how much of the data is likely cached between shared_buffers and the OS page cache. It changes cost estimates for repeated index access, not memory use. shared_buffers is the setting that actually allocates memory."
        },
        {
          q: "The primary's disk is filling up with WAL, and nobody changed the workload. pg_replication_slots shows a slot with active = false. What is happening?",
          options: [
            "Checkpoints are disabled",
            "archive_mode is off",
            "synchronous_commit is set to off",
            "The inactive slot is forcing the primary to retain all WAL since its restart_lsn, because its consumer stopped reading"
          ],
          answer: 3,
          explain: "A slot guarantees that WAL its consumer has not confirmed is kept. If the consumer disappears, WAL grows without bound. Drop the slot if the consumer is gone, and set max_slot_wal_keep_size (13+) so a dead slot is invalidated before it fills the disk."
        },
        {
          q: "You set up logical replication from an old cluster to a new one for a major-version upgrade. What will NOT be carried across by the subscription?",
          options: [
            "INSERTs on published tables",
            "UPDATEs on tables with a primary key",
            "Schema changes such as ALTER TABLE ADD COLUMN",
            "DELETEs on tables with a primary key"
          ],
          answer: 2,
          explain: "Logical replication decodes row changes for published tables; it does not replicate DDL, and by default it does not sync sequence values either. Freeze schema changes during the migration or apply them on both sides, and reset sequences on the target before cutover."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.pg = {
    id: "pg",
    name: "Postgres in Practice",
    short: "PG",
    tagline: "Run the engine, not just the queries",
    color: "#60a5fa",
    blurb: "Everything that bites real Postgres deployments: why MVCC needs VACUUM, bloat and how to measure it, autovacuum thresholds and the transactions that block cleanup, transaction ID wraparound, connection pooling with PgBouncer, the statistics views, declarative partitioning, lock queues during migrations, memory settings and checkpoints, and physical versus logical replication.",
    modules: [
      {
        id: "vacuum",
        name: "VACUUM, Bloat & Autovacuum",
        icon: "broom",
        lessons: [
          {
            id: "vacuum-basics",
            title: "Why MVCC needs VACUUM: dead tuples, the visibility map and freezing",
            summary: "Postgres keeps old row versions in the table itself, so someone has to clean them up and keep transaction IDs from wrapping around.",
            minutes: 11,
            tags: ["postgres", "vacuum", "mvcc", "wraparound", "visibility-map"],
            blocks: [
              { t: "p", html: "Hold this picture: a Postgres table is an <strong>append-mostly heap of row versions</strong>. Every tuple carries <code class='tok'>xmin</code> (the transaction that created it) and <code class='tok'>xmax</code> (the one that deleted or replaced it). Readers decide what they can see by comparing those IDs with their snapshot. Nothing is overwritten in place, so nothing old disappears on its own." },
              { t: "diagram", id: "mvcc-chain", caption: "An UPDATE adds a new version and stamps the old one's xmax; both live in the heap until VACUUM removes the dead one." },
              { t: "h", text: "What an UPDATE really writes" },
              { t: "code", lang: "sql", code:
                "CREATE TABLE accounts (id int PRIMARY KEY, balance numeric);\n" +
                "INSERT INTO accounts VALUES (7, 100);\n\n" +
                "SELECT ctid, xmin, xmax, * FROM accounts WHERE id = 7;\n" +
                "--  ctid  | xmin | xmax | id | balance\n" +
                "-- (0,1)  | 7101 |    0 |  7 |     100\n\n" +
                "UPDATE accounts SET balance = 90 WHERE id = 7;\n\n" +
                "SELECT ctid, xmin, xmax, * FROM accounts WHERE id = 7;\n" +
                "-- (0,2)  | 7102 |    0 |  7 |      90   <- new version\n" +
                "-- tuple (0,1) still sits on the page with xmax = 7102: a dead tuple"
              },
              { t: "p", html: "The old tuple becomes <strong>dead</strong> once no running snapshot could still see it. Until VACUUM visits, it occupies space on the page, its index entries still point at it, and every scan has to step over it. A DELETE works the same way: it only sets <code class='tok'>xmax</code>." },
              { t: "h", text: "What VACUUM does, step by step" },
              { t: "ol", items: [
                "Reads the <strong>visibility map</strong> and skips pages already marked all-visible (nothing to clean there).",
                "Scans remaining heap pages and collects the TIDs of tuples dead to <em>every</em> snapshot, limited by the oldest xmin in the cluster.",
                "Removes the matching index entries from each index (the expensive part on wide-indexed tables; memory for the TID list comes from <code class='tok'>maintenance_work_mem</code>).",
                "Marks the heap slots unused and records free space in the <strong>free space map</strong> so future inserts and updates reuse it.",
                "Sets all-visible and all-frozen bits, freezes old tuples, and advances <code class='tok'>relfrozenxid</code>. It can truncate empty pages at the very end of the file, but otherwise does not shrink it."
              ] },
              { t: "h", text: "The visibility map" },
              { t: "table", headers: ["Bit per heap page", "Meaning", "Who benefits"], rows: [
                ["all-visible", "Every tuple on the page is visible to all current and future snapshots", "VACUUM skips the page; <strong>index-only scans</strong> skip the heap fetch"],
                ["all-frozen", "Every tuple is frozen, so no XID on it can ever wrap", "Anti-wraparound (aggressive) vacuums skip the page"]
              ] },
              { t: "note", variant: "tip", html: "If index-only scans in <code class='tok'>EXPLAIN (ANALYZE)</code> show a large <code class='tok'>Heap Fetches</code> count, the visibility map is stale. A vacuum, not a new index, is the fix." },
              { t: "h", text: "Freezing and transaction ID wraparound" },
              { t: "p", html: "Transaction IDs are 32-bit and compared in a circle: roughly 2 billion IDs count as the past and 2 billion as the future. A tuple whose <code class='tok'>xmin</code> drifts more than about 2^31 transactions behind would suddenly look like it was created in the future and vanish. <strong>Freezing</strong> marks old tuples as visible to everyone regardless of XID, so the comparison never matters again." },
              { t: "stat", items: [
                { v: "~2.1 B", k: "XIDs of headroom before wraparound" },
                { v: "200 M", k: "autovacuum_freeze_max_age default: forced anti-wraparound vacuum" },
                { v: "8 KB", k: "heap page; two visibility-map bits each" }
              ] },
              { t: "code", lang: "sql", code:
                "-- how close is each database / table to forced freezing?\n" +
                "SELECT datname, age(datfrozenxid) AS xid_age\n" +
                "FROM pg_database ORDER BY xid_age DESC;\n\n" +
                "SELECT c.oid::regclass AS table_name, age(c.relfrozenxid) AS xid_age,\n" +
                "       pg_size_pretty(pg_total_relation_size(c.oid)) AS size\n" +
                "FROM pg_class c WHERE c.relkind IN ('r','m','t')\n" +
                "ORDER BY age(c.relfrozenxid) DESC LIMIT 10;"
              },
              { t: "note", variant: "warn", html: "Anti-wraparound vacuums run even when autovacuum is disabled for a table, and they cannot be skipped. If age keeps climbing toward 2 billion anyway, Postgres eventually <strong>refuses to assign new XIDs</strong> to protect data, which is a full write outage. Alert on <code class='tok'>age(datfrozenxid)</code> well before that, for example at 500 million to 1 billion." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'table keeps growing although row count is flat', 'index-only scan still hits the heap', 'autovacuum running on a table nobody writes to' (an anti-wraparound vacuum) — all of these are MVCC cleanup questions." },
              { t: "note", variant: "key", html: "<strong>MVCC writes new versions; VACUUM is the garbage collector.</strong> It removes versions no snapshot can see, keeps the visibility map fresh for index-only scans, and freezes old tuples so 32-bit XIDs never wrap." }
            ]
          },
          {
            id: "bloat",
            title: "Table and index bloat: estimating it, HOT updates and fillfactor",
            summary: "Measure how much of a relation is dead or empty space, prevent it with HOT updates, and pick the right tool to reclaim it.",
            minutes: 11,
            tags: ["postgres", "bloat", "hot", "fillfactor", "pg_repack"],
            blocks: [
              { t: "p", html: "<strong>Bloat</strong> is the gap between the bytes a relation occupies and the bytes its live rows need. Some is healthy: free space inside pages lets future updates land on the same page. Problems start when dead tuples pile up faster than vacuum removes them, or when one cleanup outage leaves a table permanently oversized." },
              { t: "h", text: "Where bloat comes from" },
              { t: "ul", items: [
                "Update- or delete-heavy tables where autovacuum's default thresholds are too lax for the table size.",
                "Something pinning the xmin horizon (long transaction, stale slot), so vacuum runs but removes nothing.",
                "Bulk <code class='tok'>DELETE</code> of a large share of a table: space becomes reusable but the file stays the same size.",
                "Index bloat: B-tree pages split on insert and only partly refill, especially with random keys or keys deleted in ranges."
              ] },
              { t: "h", text: "Estimating it" },
              { t: "code", lang: "sql", code:
                "-- cheap signal from the statistics collector\n" +
                "SELECT relname, n_live_tup, n_dead_tup,\n" +
                "       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,\n" +
                "       last_autovacuum, autovacuum_count\n" +
                "FROM pg_stat_user_tables\n" +
                "ORDER BY n_dead_tup DESC LIMIT 15;"
              },
              { t: "code", lang: "sql", code:
                "-- exact (reads the whole relation) vs approximate (uses the visibility map)\n" +
                "CREATE EXTENSION IF NOT EXISTS pgstattuple;\n" +
                "SELECT tuple_percent, dead_tuple_percent, free_percent\n" +
                "FROM pgstattuple('public.orders');\n\n" +
                "SELECT approx_tuple_percent, dead_tuple_percent, approx_free_percent\n" +
                "FROM pgstattuple_approx('public.orders');\n\n" +
                "-- B-tree index density: avg_leaf_density well under ~70% suggests bloat\n" +
                "SELECT avg_leaf_density, leaf_fragmentation\n" +
                "FROM pgstatindex('public.orders_customer_id_idx');"
              },
              { t: "note", variant: "tip", html: "The catalog-only estimate queries that circulate widely compare <code class='tok'>relpages</code> with an expected size from column widths. They are fast and good for ranking, but can be off by tens of percent. Confirm the top candidates with <code class='tok'>pgstattuple_approx</code> before scheduling work." },
              { t: "h", text: "HOT updates and fillfactor" },
              { t: "p", html: "A <strong>heap-only tuple (HOT)</strong> update happens when no indexed column changes and the new version fits on the same page. The new version is chained from the old one, no index gets a new entry, and the dead version can be pruned by any later page access, not only by VACUUM. Leaving room on each page with <code class='tok'>fillfactor</code> makes HOT far more likely." },
              { t: "code", lang: "sql", code:
                "-- leave ~20% of each heap page free for same-page updates\n" +
                "ALTER TABLE sessions SET (fillfactor = 80);\n" +
                "-- applies to newly written pages; rewrite (pg_repack / VACUUM FULL) to apply everywhere\n\n" +
                "SELECT relname, n_tup_upd, n_tup_hot_upd,\n" +
                "       round(100.0 * n_tup_hot_upd / nullif(n_tup_upd, 0), 1) AS hot_pct\n" +
                "FROM pg_stat_user_tables ORDER BY n_tup_upd DESC LIMIT 10;"
              },
              { t: "compare",
                bad: { title: "Index every column 'just in case'", items: ["Any update to an indexed column defeats HOT", "Every update writes every index", "More index bloat, more WAL, slower vacuum"] },
                good: { title: "Index what queries need, lower fillfactor on hot tables", items: ["Status or counter updates stay HOT", "Pages self-prune between vacuums", "Table default fillfactor is 100; B-tree default is 90"] } },
              { t: "h", text: "VACUUM vs VACUUM FULL vs pg_repack" },
              { t: "table", headers: ["Tool", "Lock", "Returns disk to OS?", "Cost"], rows: [
                ["<code class='tok'>VACUUM</code>", "SHARE UPDATE EXCLUSIVE (reads and writes continue)", "Only empty pages at the end of the file", "I/O; makes space reusable"],
                ["<code class='tok'>VACUUM FULL</code>", "ACCESS EXCLUSIVE for the whole rewrite", "Yes, rewrites a compact copy", "Downtime for that table; needs space for the copy"],
                ["<code class='tok'>pg_repack</code> (extension)", "Brief ACCESS EXCLUSIVE at start and swap", "Yes, online rebuild", "Spare disk about the table size; trigger overhead during the copy; needs a primary key or unique index"],
                ["<code class='tok'>REINDEX CONCURRENTLY</code> (12+)", "Does not block reads or writes", "Rebuilds bloated indexes", "Extra build time and temporary disk"]
              ] },
              { t: "table", headers: ["Tier", "Answer to 'this table is 3x its expected size'"], rows: [
                ["Naive", "Run VACUUM FULL tonight"],
                ["Solid", "Measure with pgstattuple, rebuild online with pg_repack, REINDEX CONCURRENTLY the bloated indexes"],
                ["Standout", "Also find why it happened (pinned xmin, lax thresholds, low HOT ratio) and fix that, or the bloat comes back"]
              ] },
              { t: "widget", id: "pgVacuum" },
              { t: "note", variant: "key", html: "<strong>Plain VACUUM makes space reusable; only a rewrite gives it back.</strong> Measure first, prefer HOT-friendly schemas and fillfactor to prevent bloat, and rebuild online with pg_repack or REINDEX CONCURRENTLY rather than VACUUM FULL." }
            ]
          },
          {
            id: "autovacuum-tuning",
            title: "Autovacuum tuning and the transactions that block it",
            summary: "The trigger formula, per-table overrides, worker throughput, and finding whatever is holding back the xmin horizon.",
            minutes: 12,
            tags: ["postgres", "autovacuum", "xmin", "replication-slots", "tuning"],
            blocks: [
              { t: "p", html: "Autovacuum is a launcher that wakes every <code class='tok'>autovacuum_naptime</code> (default 1 minute), checks each table's counters, and hands work to a small pool of workers (<code class='tok'>autovacuum_max_workers</code>, default 3). Tuning it means answering two questions: <strong>when</strong> does a table qualify, and <strong>how fast</strong> may a worker go once it does." },
              { t: "h", text: "When a table qualifies" },
              { t: "code", lang: "text", code:
                "vacuum  if  n_dead_tup        > autovacuum_vacuum_threshold  + autovacuum_vacuum_scale_factor  * reltuples\n" +
                "                                  (default 50)                   (default 0.2)\n\n" +
                "analyze if  n_mod_since_analyze > autovacuum_analyze_threshold + autovacuum_analyze_scale_factor * reltuples\n" +
                "                                  (default 50)                   (default 0.1)\n\n" +
                "13+: insert-only tables also qualify via autovacuum_vacuum_insert_threshold (1000)\n" +
                "     + autovacuum_vacuum_insert_scale_factor (0.2) * reltuples"
              },
              { t: "table", headers: ["reltuples", "Dead tuples before vacuum (defaults)", "Changed rows before analyze"], rows: [
                ["10,000", "2,050", "1,050"],
                ["1,000,000", "200,050", "100,050"],
                ["100,000,000", "20,000,050", "10,000,050"]
              ] },
              { t: "p", html: "The scale factor is proportional, so the bigger the table, the more garbage it carries before cleanup starts. A 100-million-row table waits for 20 million dead tuples, and then the vacuum that finally runs is huge. The fix is per-table settings, not a global change that makes small tables vacuum constantly." },
              { t: "h", text: "Per-table overrides" },
              { t: "code", lang: "sql", code:
                "-- large, update-heavy table: vacuum after ~1% churn instead of 20%\n" +
                "ALTER TABLE orders SET (\n" +
                "  autovacuum_vacuum_scale_factor  = 0.01,\n" +
                "  autovacuum_vacuum_threshold     = 10000,\n" +
                "  autovacuum_analyze_scale_factor = 0.02,\n" +
                "  autovacuum_vacuum_cost_limit    = 2000   -- let this table's worker go faster\n" +
                ");\n\n" +
                "SELECT relname, reloptions FROM pg_class WHERE reloptions IS NOT NULL;"
              },
              { t: "h", text: "How fast a worker may go" },
              { t: "table", headers: ["Setting", "Default", "Effect"], rows: [
                ["<code class='tok'>autovacuum_vacuum_cost_limit</code>", "-1 (uses vacuum_cost_limit = 200)", "Cost budget per sleep cycle, <em>shared</em> across all running workers"],
                ["<code class='tok'>autovacuum_vacuum_cost_delay</code>", "2 ms (12+; was 20 ms)", "Sleep after each budget is spent"],
                ["<code class='tok'>autovacuum_max_workers</code>", "3", "More workers do not add throughput if the shared cost limit is unchanged"],
                ["<code class='tok'>maintenance_work_mem</code> / <code class='tok'>autovacuum_work_mem</code>", "64 MB / -1", "Memory for dead TIDs; too little forces multiple index passes"]
              ] },
              { t: "note", variant: "trap", html: "Raising <code class='tok'>autovacuum_max_workers</code> alone often makes each worker <em>slower</em>, because the cost limit is divided among them. Raise the cost limit together with the worker count, and check that storage can absorb the extra I/O." },
              { t: "h", text: "What keeps vacuum from removing anything" },
              { t: "ul", items: [
                "<strong>Long-running or idle-in-transaction sessions</strong>: their snapshot's xmin pins every table in the database cluster.",
                "<strong>Replication slots</strong>: a logical slot's <code class='tok'>catalog_xmin</code> and a physical slot's <code class='tok'>xmin</code> (with feedback) hold back cleanup, even when the consumer is offline.",
                "<strong>hot_standby_feedback = on</strong>: a long query on a replica holds back vacuum on the primary.",
                "<strong>Orphaned prepared transactions</strong> from two-phase commit (<code class='tok'>pg_prepared_xacts</code>)."
              ] },
              { t: "code", lang: "sql", code:
                "-- who holds the oldest snapshot?\n" +
                "SELECT pid, usename, state, backend_xmin, age(backend_xmin) AS xmin_age,\n" +
                "       now() - xact_start AS xact_duration, left(query, 60) AS query\n" +
                "FROM pg_stat_activity\n" +
                "WHERE backend_xmin IS NOT NULL\n" +
                "ORDER BY age(backend_xmin) DESC LIMIT 5;\n\n" +
                "SELECT slot_name, slot_type, active, xmin, catalog_xmin\n" +
                "FROM pg_replication_slots;\n\n" +
                "SELECT gid, prepared, owner FROM pg_prepared_xacts;\n\n" +
                "-- guard rail: end sessions that sit idle inside a transaction\n" +
                "ALTER SYSTEM SET idle_in_transaction_session_timeout = '5min';"
              },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'autovacuum runs constantly but dead tuples keep rising', 'bloat started the day we added a replica', 'n_dead_tup is huge on a 500M-row table that autovacuum rarely touches'. The first two are a pinned horizon; the third is the proportional threshold." },
              { t: "quiz", id: "pg-vacuum" },
              { t: "note", variant: "key", html: "<strong>Trigger = 50 + 0.2 \u00d7 reltuples (analyze 50 + 0.1).</strong> Lower the scale factor per table for big hot tables, raise the shared cost limit if workers cannot keep up, and always check the xmin horizon first: no tuning helps while one session or slot pins it." }
            ]
          }
        ]
      },
      {
        id: "ops",
        name: "Pooling, Stats & Partitioning",
        icon: "wrench",
        lessons: [
          {
            id: "connection-pooling",
            title: "Connection pooling: process-per-connection and PgBouncer modes",
            summary: "Why Postgres connections are expensive, what each PgBouncer mode returns and when, and which features each one breaks.",
            minutes: 11,
            tags: ["postgres", "pgbouncer", "connections", "pooling"],
            blocks: [
              { t: "p", html: "Postgres forks one <strong>backend process per connection</strong>. That process owns private memory, catalog caches and a slot in the shared proc array that every snapshot must scan. A thousand mostly idle connections are a thousand processes: they cost RAM and make every snapshot a little slower, and throughput tends to peak at a small multiple of CPU cores." },
              { t: "stat", items: [
                { v: "100", k: "max_connections default" },
                { v: "~5\u201310 MB", k: "typical baseline per backend, before work_mem" },
                { v: "1 process", k: "per connection; no built-in thread pool" }
              ] },
              { t: "h", text: "Why many connections hurt" },
              { t: "ul", items: [
                "Each new connection pays fork plus authentication cost, often a few milliseconds, which dominates short requests.",
                "Every backend can allocate <code class='tok'>work_mem</code> per sort or hash node, so the worst-case memory scales with connection count.",
                "Snapshot computation and lock-manager work grow with the number of backends, even idle ones (newer releases improved this, but did not remove it).",
                "App fleets multiply: 30 pods \u00d7 a pool of 20 is 600 connections before anyone runs a migration."
              ] },
              { t: "h", text: "PgBouncer pooling modes" },
              { t: "table", headers: ["Mode", "Server connection returned", "Breaks or needs care", "Use when"], rows: [
                ["session", "When the client disconnects", "Nothing; full feature set", "Clients connect briefly, or need session features"],
                ["transaction", "At COMMIT / ROLLBACK", "SET (use SET LOCAL), session advisory locks, LISTEN/NOTIFY, temp tables across transactions, WITH HOLD cursors; protocol prepared statements need PgBouncer 1.21+ with max_prepared_statements", "Default choice for web apps with many idle client connections"],
                ["statement", "After every statement", "Multi-statement transactions are refused", "Autocommit-only workloads"]
              ] },
              { t: "code", lang: "text", code:
                "; pgbouncer.ini (excerpt)\n" +
                "[databases]\n" +
                "appdb = host=10.0.0.12 port=5432 dbname=appdb\n\n" +
                "[pgbouncer]\n" +
                "listen_port        = 6432\n" +
                "auth_type          = scram-sha-256\n" +
                "auth_file          = /etc/pgbouncer/userlist.txt\n" +
                "pool_mode          = transaction\n" +
                "default_pool_size  = 40      ; server connections per (db, user) pair\n" +
                "max_client_conn    = 5000    ; cheap: clients are sockets, not processes\n" +
                "max_prepared_statements = 200 ; 1.21+: track protocol-level prepared statements\n" +
                "server_reset_query = DISCARD ALL ; used in session mode"
              },
              { t: "compare",
                bad: { title: "Session state leaks in transaction mode", items: ["SET search_path = tenant_42 sticks to a backend another client gets next", "pg_advisory_lock() taken in one transaction, released on a different backend", "Driver caches a server-side prepared statement that does not exist on the new backend"] },
                good: { title: "Transaction-scoped equivalents", items: ["SET LOCAL inside the transaction, or schema-qualified names", "pg_advisory_xact_lock(), released automatically at commit", "Enable PgBouncer prepared statement tracking, or disable server-side prepares in the driver"] } },
              { t: "widget", id: "pgPool" },
              { t: "h", text: "Sizing the server side" },
              { t: "p", html: "Start the server pool near a small multiple of CPU cores (for example 2\u20134 \u00d7 cores for an OLTP mix), measure, and adjust. A queue in PgBouncer is cheap and visible (<code class='tok'>SHOW POOLS</code> reports waiting clients); a queue of runnable backends fighting for CPU and locks inside Postgres is neither." },
              { t: "note", variant: "warn", html: "Keep a direct, non-pooled path for migrations, <code class='tok'>pg_dump</code> and admin sessions, and reserve headroom under <code class='tok'>max_connections</code> for them (plus <code class='tok'>superuser_reserved_connections</code>, default 3)." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'too many clients already', 'we scaled pods and the database fell over', 'serverless functions open a connection per invocation' — the answer starts with a pooler in transaction mode and a smaller server pool." },
              { t: "note", variant: "key", html: "<strong>Clients are cheap, backends are not.</strong> Put PgBouncer in transaction mode in front of many small app pools, keep server connections near a few times core count, and replace session state with transaction-scoped equivalents." }
            ]
          },
          {
            id: "pg-stat-views",
            title: "The statistics views: activity, statements, tables, indexes and locks",
            summary: "Five views that answer most production questions, with the queries worth keeping in your runbook.",
            minutes: 11,
            tags: ["postgres", "observability", "pg_stat_statements", "pg_locks"],
            blocks: [
              { t: "p", html: "Postgres exposes its internals as ordinary views. Learn five and you can answer most 'why is the database slow' questions without installing anything beyond one extension." },
              { t: "table", headers: ["View", "Question it answers"], rows: [
                ["<code class='tok'>pg_stat_activity</code>", "What is every backend doing right now, and what is it waiting on?"],
                ["<code class='tok'>pg_stat_statements</code>", "Which normalized queries consume the most time, I/O and calls since the last reset?"],
                ["<code class='tok'>pg_stat_user_tables</code>", "How is each table scanned, modified and vacuumed?"],
                ["<code class='tok'>pg_stat_user_indexes</code>", "Which indexes are used, and which are dead weight?"],
                ["<code class='tok'>pg_locks</code>", "Who holds or waits for which lock?"]
              ] },
              { t: "h", text: "pg_stat_activity" },
              { t: "code", lang: "sql", code:
                "SELECT pid, usename, application_name, state,\n" +
                "       wait_event_type, wait_event,\n" +
                "       now() - query_start AS running_for, left(query, 80) AS query\n" +
                "FROM pg_stat_activity\n" +
                "WHERE state <> 'idle' AND pid <> pg_backend_pid()\n" +
                "ORDER BY running_for DESC NULLS LAST;\n\n" +
                "-- cancel the query, or end the whole session\n" +
                "SELECT pg_cancel_backend(12345);\n" +
                "SELECT pg_terminate_backend(12345);"
              },
              { t: "h", text: "pg_stat_statements" },
              { t: "code", lang: "sql", code:
                "-- postgresql.conf: shared_preload_libraries = 'pg_stat_statements' (restart)\n" +
                "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;\n\n" +
                "SELECT calls, round(total_exec_time) AS total_ms,\n" +
                "       round(mean_exec_time::numeric, 2) AS mean_ms, rows,\n" +
                "       shared_blks_hit, shared_blks_read, left(query, 70) AS query\n" +
                "FROM pg_stat_statements\n" +
                "ORDER BY total_exec_time DESC LIMIT 10;"
              },
              { t: "note", variant: "tip", html: "Sort by <strong>total</strong> time to find what costs the server most, by <strong>mean</strong> time to find what hurts individual users, and by <code class='tok'>shared_blks_read</code> to find what misses cache. Column names changed in 13 (<code class='tok'>total_time</code> became <code class='tok'>total_exec_time</code>)." },
              { t: "h", text: "pg_stat_user_tables" },
              { t: "code", lang: "sql", code:
                "-- big tables read mostly by sequential scan are index candidates\n" +
                "SELECT relname, seq_scan, seq_tup_read, idx_scan,\n" +
                "       n_live_tup, n_dead_tup, last_autovacuum, last_autoanalyze\n" +
                "FROM pg_stat_user_tables\n" +
                "WHERE seq_scan > 0\n" +
                "ORDER BY seq_tup_read DESC LIMIT 10;"
              },
              { t: "h", text: "Unused indexes in pg_stat_user_indexes" },
              { t: "code", lang: "sql", code:
                "SELECT s.relname AS table_name, s.indexrelname AS index_name, s.idx_scan,\n" +
                "       pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size\n" +
                "FROM pg_stat_user_indexes s\n" +
                "JOIN pg_index i ON i.indexrelid = s.indexrelid\n" +
                "WHERE s.idx_scan = 0\n" +
                "  AND NOT i.indisunique          -- constraints still need these\n" +
                "ORDER BY pg_relation_size(s.indexrelid) DESC;"
              },
              { t: "note", variant: "trap", html: "Counters are <strong>per node</strong> and reset with <code class='tok'>pg_stat_reset()</code> or after a crash. An index unused on the primary may serve every report on a replica. Check every node over a full business cycle (month-end included) before you drop it." },
              { t: "h", text: "pg_locks: who is blocking whom" },
              { t: "code", lang: "sql", code:
                "SELECT a.pid AS waiting_pid, left(a.query, 50) AS waiting_query,\n" +
                "       b.pid AS blocking_pid, left(b.query, 50) AS blocking_query,\n" +
                "       b.state AS blocking_state\n" +
                "FROM pg_stat_activity a\n" +
                "JOIN LATERAL unnest(pg_blocking_pids(a.pid)) AS bp(pid) ON true\n" +
                "JOIN pg_stat_activity b ON b.pid = bp.pid;\n\n" +
                "SELECT locktype, relation::regclass, mode, granted, pid\n" +
                "FROM pg_locks WHERE NOT granted;"
              },
              { t: "note", variant: "key", html: "<strong>Activity for now, statements for history, tables and indexes for access patterns, locks for blocking.</strong> Keep these queries in your runbook, and treat any 'unused' verdict as per-node and since-last-reset." }
            ]
          },
          {
            id: "table-partitioning",
            title: "Declarative partitioning: range, list, hash, pruning and retention",
            summary: "Split one logical table into many physical ones so queries touch less data and old data leaves with a metadata operation.",
            minutes: 12,
            tags: ["postgres", "partitioning", "pruning", "retention"],
            blocks: [
              { t: "p", html: "A partitioned table is a <strong>routing layer</strong>: the parent holds no rows, and each partition is an ordinary table with its own heap, indexes and vacuum schedule. The win is not raw speed on every query; it is that queries filtered on the partition key touch fewer files, and that old data can be detached and dropped instead of deleted." },
              { t: "table", headers: ["Strategy", "Key fits", "Typical use"], rows: [
                ["RANGE", "Time or a monotonically growing id", "Events, logs, orders by month; retention by dropping old ranges"],
                ["LIST", "A small set of discrete values", "Region, tenant tier, status"],
                ["HASH", "No natural range; spread evenly", "Splitting a huge table by customer_id to keep each partition's vacuum and indexes small"]
              ] },
              { t: "code", lang: "sql", code:
                "CREATE TABLE events (\n" +
                "  id          bigint GENERATED ALWAYS AS IDENTITY,\n" +
                "  tenant_id   int         NOT NULL,\n" +
                "  created_at  timestamptz NOT NULL,\n" +
                "  payload     jsonb,\n" +
                "  PRIMARY KEY (id, created_at)          -- unique keys must include the partition key\n" +
                ") PARTITION BY RANGE (created_at);\n\n" +
                "CREATE TABLE events_2026_10 PARTITION OF events\n" +
                "  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');\n" +
                "CREATE TABLE events_2026_11 PARTITION OF events\n" +
                "  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');\n" +
                "CREATE TABLE events_default PARTITION OF events DEFAULT;\n\n" +
                "-- an index on the parent is created on every partition\n" +
                "CREATE INDEX ON events (tenant_id, created_at);"
              },
              { t: "h", text: "Partition pruning" },
              { t: "p", html: "The planner removes partitions whose bounds cannot match the WHERE clause. Pruning happens at plan time for constants and, since 11, at <strong>execution time</strong> for parameters and values from joins. It only works when the predicate is on the partition key in a form the planner can compare with the bounds." },
              { t: "code", lang: "sql", code:
                "EXPLAIN SELECT count(*) FROM events\n" +
                "WHERE created_at >= '2026-11-01' AND created_at < '2026-11-08';\n" +
                "--  Aggregate\n" +
                "--    ->  Seq Scan on events_2026_11 events     <- one partition only\n\n" +
                "-- defeats pruning: the key is hidden inside an expression\n" +
                "EXPLAIN SELECT count(*) FROM events\n" +
                "WHERE date_trunc('month', created_at) = '2026-11-01';\n" +
                "--  scans every partition"
              },
              { t: "note", variant: "trap", html: "Queries that do <em>not</em> filter on the partition key get slower: they scan every partition and pay planning overhead per partition. Hundreds of partitions are fine on recent releases; tens of thousands usually are not." },
              { t: "h", text: "Attaching, detaching and retention" },
              { t: "code", lang: "sql", code:
                "-- load next month offline, then attach; a matching CHECK lets Postgres skip the validation scan\n" +
                "CREATE TABLE events_2026_12 (LIKE events INCLUDING DEFAULTS);\n" +
                "ALTER TABLE events_2026_12 ADD CONSTRAINT chk_range\n" +
                "  CHECK (created_at >= '2026-12-01' AND created_at < '2027-01-01');\n" +
                "ALTER TABLE events ATTACH PARTITION events_2026_12\n" +
                "  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');\n\n" +
                "-- retention: detach without blocking queries (14+), then drop\n" +
                "ALTER TABLE events DETACH PARTITION events_2025_09 CONCURRENTLY;\n" +
                "DROP TABLE events_2025_09;"
              },
              { t: "compare",
                bad: { title: "Retention by DELETE", items: ["Millions of dead tuples and WAL for every row", "Long vacuum afterwards; bloat if it falls behind", "Holds row locks and competes with live traffic"] },
                good: { title: "Retention by DROP partition", items: ["Metadata operation, file unlinked", "No dead tuples, no vacuum debt", "Predictable and fast, even for billions of rows"] } },
              { t: "table", headers: ["Tier", "Answer to 'our 2 TB events table is slow and we keep 13 months'"], rows: [
                ["Naive", "Add more indexes and a nightly DELETE"],
                ["Solid", "Range-partition by month on created_at, drop old partitions for retention, make sure hot queries filter on created_at"],
                ["Standout", "Also pre-create future partitions on a schedule, keep a default partition monitored at zero rows, include the key in unique constraints, and size partitions so the count stays in the hundreds"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'keep N months of data', 'nightly purge takes hours', 'queries almost always filter by date', 'vacuum on the giant table never finishes' — reach for range partitioning on the time column." },
              { t: "quiz", id: "pg-ops" },
              { t: "note", variant: "key", html: "<strong>Partition for pruning and for retention.</strong> Pick a key your hot queries filter on, keep partition counts sane, and let old data leave with DETACH and DROP instead of DELETE." }
            ]
          }
        ]
      },
      {
        id: "perf",
        name: "Locks, Memory & Replication",
        icon: "bolt",
        lessons: [
          {
            id: "locks-and-waits",
            title: "Lock levels, lock queues and safe migrations",
            summary: "Which statements take which table lock, why one waiting ALTER can stall a whole application, and how to ship DDL safely.",
            minutes: 12,
            tags: ["postgres", "locks", "migrations", "lock_timeout"],
            blocks: [
              { t: "p", html: "Every statement takes a <strong>table-level lock</strong> in one of eight modes, in addition to any row locks. Most modes are compatible with each other, which is why reads and writes rarely block one another. The dangerous one is <code class='tok'>ACCESS EXCLUSIVE</code>, which conflicts with everything, including a plain SELECT." },
              { t: "table", headers: ["Mode", "Taken by", "Blocks"], rows: [
                ["ACCESS SHARE", "SELECT", "Only ACCESS EXCLUSIVE"],
                ["ROW SHARE", "SELECT ... FOR UPDATE / FOR SHARE", "EXCLUSIVE, ACCESS EXCLUSIVE"],
                ["ROW EXCLUSIVE", "INSERT, UPDATE, DELETE, MERGE", "SHARE and stronger"],
                ["SHARE UPDATE EXCLUSIVE", "VACUUM, ANALYZE, CREATE INDEX CONCURRENTLY, some ALTER TABLE forms", "Itself and stronger (two vacuums cannot run on one table)"],
                ["SHARE", "CREATE INDEX (non-concurrent)", "All writes"],
                ["SHARE ROW EXCLUSIVE / EXCLUSIVE", "CREATE TRIGGER, REFRESH MATERIALIZED VIEW CONCURRENTLY", "Writes, and more"],
                ["ACCESS EXCLUSIVE", "Most ALTER TABLE, DROP, TRUNCATE, VACUUM FULL, plain REFRESH MATERIALIZED VIEW", "Everything, including SELECT"]
              ] },
              { t: "h", text: "The lock queue" },
              { t: "p", html: "Lock requests wait in order. A new request that conflicts with one <em>already waiting</em> in the queue waits behind it, even if it would be compatible with the lock currently held. That is how a fast DDL statement causes an outage." },
              { t: "code", lang: "text", code:
                "t=0s    report   SELECT ... FROM orders            holds ACCESS SHARE (runs 20 min)\n" +
                "t=5s    deploy   ALTER TABLE orders ADD COLUMN ...  wants ACCESS EXCLUSIVE -> waits for report\n" +
                "t=6s    app      SELECT * FROM orders WHERE id=$1   wants ACCESS SHARE -> queues behind ALTER\n" +
                "t=6s+   app      every request on orders queues; pool exhausts; site is down\n" +
                "t=20m   report finishes -> ALTER runs in milliseconds -> queue drains"
              },
              { t: "code", lang: "sql", code:
                "-- migration session: fail fast instead of queueing everyone, then retry\n" +
                "SET lock_timeout = '3s';\n" +
                "SET statement_timeout = '15min';\n" +
                "ALTER TABLE orders ADD COLUMN note text;\n" +
                "-- ERROR: canceling statement due to lock timeout  -> back off and retry"
              },
              { t: "h", text: "Safer forms of common DDL" },
              { t: "table", headers: ["Goal", "Risky form", "Safer form"], rows: [
                ["Add an index", "CREATE INDEX (blocks writes for the build)", "CREATE INDEX CONCURRENTLY (slower, cannot run in a transaction, check for INVALID on failure)"],
                ["Add a column with default", "Rewrite on old versions", "11+: a non-volatile default is metadata-only; still needs a brief ACCESS EXCLUSIVE, so use lock_timeout"],
                ["Add a foreign key or CHECK", "ADD CONSTRAINT (scans while holding a strong lock)", "ADD CONSTRAINT ... NOT VALID, then VALIDATE CONSTRAINT under a weaker lock"],
                ["Make a column NOT NULL", "SET NOT NULL (full scan under ACCESS EXCLUSIVE)", "12+: add CHECK (col IS NOT NULL) NOT VALID, validate it, then SET NOT NULL skips the scan"],
                ["Change a column type", "ALTER COLUMN TYPE (often a rewrite)", "Add a new column, backfill in batches, switch reads, drop the old column"]
              ] },
              { t: "h", text: "Seeing waits" },
              { t: "code", lang: "sql", code:
                "SELECT wait_event_type, wait_event, count(*)\n" +
                "FROM pg_stat_activity\n" +
                "WHERE state = 'active'\n" +
                "GROUP BY 1, 2 ORDER BY 3 DESC;\n" +
                "-- Lock/relation      -> table lock queue (check pg_blocking_pids)\n" +
                "-- Lock/transactionid -> row-level conflict: waiting for another txn to finish\n" +
                "-- LWLock/...         -> internal contention (buffers, WAL insertion)\n" +
                "-- IO/DataFileRead    -> reading pages that are not cached"
              },
              { t: "note", variant: "warn", html: "Deadlocks are detected, not prevented: after <code class='tok'>deadlock_timeout</code> (default 1 s) a waiting backend checks for a cycle and one transaction is aborted. Taking row locks in a consistent order (for example sorted by id) removes most of them." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'a migration that takes milliseconds caused a 10-minute outage', 'all queries on one table hung during deploy' — this is a lock queue behind ACCESS EXCLUSIVE; answer with lock_timeout plus retry and concurrent or NOT VALID forms." },
              { t: "note", variant: "key", html: "<strong>The danger is not holding ACCESS EXCLUSIVE, it is waiting for it.</strong> A queued exclusive request blocks every newcomer. Set lock_timeout on every migration, retry, and prefer CONCURRENTLY and NOT VALID forms." }
            ]
          },
          {
            id: "memory-and-config",
            title: "Memory and configuration: shared_buffers, work_mem and checkpoints",
            summary: "What each memory setting really allocates, the arithmetic that makes work_mem dangerous, and how checkpoints shape write I/O.",
            minutes: 11,
            tags: ["postgres", "configuration", "work_mem", "checkpoints"],
            blocks: [
              { t: "p", html: "Postgres uses two caches stacked on top of each other: its own <strong>shared_buffers</strong> pool of 8 KB pages, and the operating system's page cache underneath. That double buffering is why shared_buffers is usually a fraction of RAM rather than most of it, and why some settings allocate memory while others only inform the planner." },
              { t: "table", headers: ["Setting", "Default", "What it is", "Common starting point"], rows: [
                ["<code class='tok'>shared_buffers</code>", "128 MB", "Shared page cache, allocated at startup (restart to change)", "Around 25% of RAM on a dedicated server"],
                ["<code class='tok'>work_mem</code>", "4 MB", "Per sort / hash / materialize node, per backend, before spilling to disk", "Small globally (8\u201364 MB); larger per role or session for reports"],
                ["<code class='tok'>maintenance_work_mem</code>", "64 MB", "VACUUM, CREATE INDEX, ALTER TABLE ADD FOREIGN KEY", "512 MB\u20132 GB when RAM allows"],
                ["<code class='tok'>effective_cache_size</code>", "4 GB", "Planner hint only: how much data is likely cached overall; allocates nothing", "50\u201375% of RAM"],
                ["<code class='tok'>max_wal_size</code>", "1 GB", "Soft cap on WAL between checkpoints before one is forced", "Several GB to tens of GB on write-heavy systems"],
                ["<code class='tok'>checkpoint_timeout</code>", "5 min", "Maximum time between checkpoints", "10\u201330 min, balanced against crash recovery time"]
              ] },
              { t: "h", text: "The work_mem multiplication" },
              { t: "code", lang: "text", code:
                "worst case  ~= work_mem x (sort/hash nodes per query) x concurrent backends\n\n" +
                "work_mem 64 MB x 4 nodes x 50 backends = 12,800 MB\n" +
                "hash nodes may use work_mem x hash_mem_multiplier (default 2.0 on 15+)\n" +
                "parallel workers each get their own allowance"
              },
              { t: "note", variant: "trap", html: "A global <code class='tok'>work_mem = 256MB</code> looks harmless on a 64 GB box until 100 connections each run a query with three hash joins. Set it modestly in <code class='tok'>postgresql.conf</code> and raise it where needed: <code class='tok'>ALTER ROLE reporting SET work_mem = '256MB'</code>." },
              { t: "code", lang: "sql", code:
                "-- is this sort spilling to disk?\n" +
                "EXPLAIN (ANALYZE, BUFFERS)\n" +
                "SELECT customer_id, sum(total) FROM orders GROUP BY 1 ORDER BY 2 DESC;\n" +
                "--  Sort Method: external merge  Disk: 412000kB   <- spilled\n" +
                "--  after SET work_mem = '512MB':\n" +
                "--  Sort Method: quicksort  Memory: 380000kB\n\n" +
                "-- cluster-wide spill signal\n" +
                "SELECT datname, temp_files, pg_size_pretty(temp_bytes) FROM pg_stat_database;"
              },
              { t: "h", text: "Checkpoints and max_wal_size" },
              { t: "p", html: "A <strong>checkpoint</strong> flushes every dirty buffer to the data files so crash recovery can start replaying WAL from that point. It is triggered by <code class='tok'>checkpoint_timeout</code> or by accumulating <code class='tok'>max_wal_size</code> of WAL, whichever comes first. Writes are spread over <code class='tok'>checkpoint_completion_target</code> (0.9 by default on 14+) of the interval to avoid I/O spikes." },
              { t: "p", html: "After each checkpoint, the first change to any page writes a <strong>full page image</strong> into WAL (with <code class='tok'>full_page_writes</code> on) to protect against torn pages. Frequent checkpoints therefore multiply WAL volume, which in turn triggers more checkpoints and more replication traffic." },
              { t: "code", lang: "sql", code:
                "-- requested (forced by WAL volume) vs timed checkpoints\n" +
                "-- 17+: pg_stat_checkpointer (num_timed, num_requested); older: pg_stat_bgwriter\n" +
                "SELECT checkpoints_timed, checkpoints_req FROM pg_stat_bgwriter;\n\n" +
                "-- log_checkpoints = on also prints 'checkpoints are occurring too frequently'"
              },
              { t: "compare",
                bad: { title: "Small max_wal_size on a write-heavy box", items: ["Checkpoints forced every minute or so", "Full-page-image storm after each one", "I/O spikes and extra WAL shipped to replicas"] },
                good: { title: "Checkpoints mostly timed", items: ["max_wal_size large enough that most checkpoints are by timeout", "Writes spread smoothly by completion_target", "Trade-off: longer crash recovery, more WAL on disk"] } },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'OOM killer took out Postgres during month-end reports' (work_mem multiplication), 'periodic I/O spikes every few minutes' (forced checkpoints), 'we set shared_buffers to 90% of RAM' (double buffering, starved OS cache)." },
              { t: "note", variant: "key", html: "<strong>shared_buffers allocates, effective_cache_size only advises, work_mem multiplies.</strong> Keep work_mem small globally and raise it per role; size max_wal_size so checkpoints are timed, not forced." }
            ]
          },
          {
            id: "replication-in-pg",
            title: "Replication in Postgres: streaming, slots and logical replication",
            summary: "Physical WAL streaming for replicas and failover, replication slots and their disk risk, and logical replication for selective and cross-version copies.",
            minutes: 12,
            tags: ["postgres", "replication", "replication-slots", "logical-replication", "wal"],
            blocks: [
              { t: "p", html: "Everything starts with the WAL. <strong>Physical (streaming) replication</strong> ships WAL bytes to standbys that replay them into a block-for-block copy of the whole cluster. <strong>Logical replication</strong> decodes WAL into row changes for chosen tables and applies them as SQL-level operations on an independent database." },
              { t: "diagram", id: "wal-buffer", caption: "Changes reach WAL before data pages; standbys replay the same WAL stream the primary uses for crash recovery." },
              { t: "h", text: "Streaming replication and lag" },
              { t: "code", lang: "sql", code:
                "-- on the primary\n" +
                "SELECT application_name, state, sync_state,\n" +
                "       pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes,\n" +
                "       write_lag, flush_lag, replay_lag\n" +
                "FROM pg_stat_replication;\n\n" +
                "-- on a standby\n" +
                "SELECT pg_is_in_recovery(), now() - pg_last_xact_replay_timestamp() AS replay_delay;"
              },
              { t: "table", headers: ["synchronous_commit", "COMMIT returns after", "Lose on primary crash?"], rows: [
                ["off", "WAL is in memory locally (flushed shortly after)", "Recent commits may be lost, no corruption"],
                ["local", "Local WAL flush only", "Commits not yet on the standby"],
                ["remote_write", "Standby received and wrote WAL to its OS", "Only if both machines fail together"],
                ["on (with synchronous_standby_names)", "Standby flushed WAL to disk", "No acknowledged commit lost"],
                ["remote_apply", "Standby replayed it, so reads there see it", "No; also gives read-your-writes on that standby"]
              ] },
              { t: "note", variant: "warn", html: "Synchronous replication with a single named standby means the primary <strong>stops committing</strong> if that standby goes away. Use a quorum such as <code class='tok'>synchronous_standby_names = 'ANY 1 (s1, s2)'</code> so one standby can fail." },
              { t: "p", html: "Long queries on a standby can conflict with cleanup arriving from the primary. Postgres cancels them after <code class='tok'>max_standby_streaming_delay</code> (default 30 s), or you set <code class='tok'>hot_standby_feedback = on</code> so the primary holds back vacuum for them. That second choice moves the cost to the primary as bloat." },
              { t: "h", text: "Replication slots" },
              { t: "p", html: "A slot makes the primary <strong>retain WAL</strong> (and, for logical slots, catalog rows) until its consumer confirms it. That prevents a standby from falling off the end of the WAL, but a consumer that disappears turns the slot into an unbounded disk leak and a pinned xmin horizon." },
              { t: "code", lang: "sql", code:
                "SELECT slot_name, slot_type, active,\n" +
                "       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal,\n" +
                "       wal_status            -- 13+: reserved / extended / unreserved / lost\n" +
                "FROM pg_replication_slots;\n\n" +
                "-- cap the damage (13+): invalidate a slot rather than fill the disk\n" +
                "ALTER SYSTEM SET max_slot_wal_keep_size = '100GB';\n" +
                "SELECT pg_drop_replication_slot('old_cdc_slot');"
              },
              { t: "h", text: "Logical replication" },
              { t: "code", lang: "sql", code:
                "-- source: wal_level = logical (restart)\n" +
                "CREATE PUBLICATION orders_pub FOR TABLE orders, order_items;\n\n" +
                "-- target: tables must already exist with compatible columns\n" +
                "CREATE SUBSCRIPTION orders_sub\n" +
                "  CONNECTION 'host=src.db.internal.example dbname=shop user=replicator'\n" +
                "  PUBLICATION orders_pub;   -- copies existing rows, then streams changes\n\n" +
                "-- UPDATE/DELETE need a replica identity (primary key by default)\n" +
                "ALTER TABLE audit_log REPLICA IDENTITY FULL;  -- last resort: logs whole old rows"
              },
              { t: "table", headers: ["", "Physical streaming", "Logical"], rows: [
                ["Unit", "WAL blocks for the whole cluster", "Row changes for published tables"],
                ["Target", "Read-only, same major version and architecture", "Writable, can be a different major version"],
                ["DDL", "Replicated (it is just WAL)", "Not replicated; apply schema changes yourself"],
                ["Sequences", "Replicated", "Not synced by default; reset before cutover"],
                ["Typical use", "HA failover, read replicas, PITR base", "Major-version upgrades, selective copies, CDC into other systems"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> 'upgrade with near-zero downtime' (logical replication then cutover), 'primary disk full of WAL' (inactive slot), 'replica queries get cancelled' (standby conflicts vs hot_standby_feedback), 'no acknowledged write may be lost' (synchronous commit with a quorum)." },
              { t: "quiz", id: "pg-perf" },
              { t: "note", variant: "key", html: "<strong>Physical replication copies the cluster, logical replication copies rows.</strong> Choose synchronous_commit per durability need, use a standby quorum, and treat every replication slot as a disk and vacuum liability that needs monitoring and a max_slot_wal_keep_size cap." }
            ]
          }
        ]
      }
    ]
  };
})();
