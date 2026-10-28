/* =====================================================================
   LEDGER · Transactions & Concurrency
   window.TRACKS.txn — modules: acid / control / practice

   Self-contained: this file registers its own widgets (txnIsolation,
   txnDeadlock, txnMvcc), its own quizzes (txn-acid, txn-control,
   txn-practice) and its own track data. Nothing else needs editing.

   The isolation simulator models PostgreSQL semantics with explicit,
   hand-checked per-scenario scripts rather than a general engine, so
   every outcome it shows is deterministic.
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

  function svg(tag, attrs) {
    var el = document.createElementNS(SVG_NS, tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k) && attrs[k] != null) el.setAttribute(k, attrs[k]);
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

  function button(label, cls, onClick) {
    var b = h("button", { type: "button", class: "w-btn" + (cls ? " " + cls : "") }, label);
    b.addEventListener("click", onClick);
    return b;
  }

  function ro(label, value, color) {
    return h("span", { class: "ro" }, label + " ",
      h("b", color ? { style: "color:" + color } : {}, String(value)));
  }

  function statusColor(s) {
    if (s === "committed") return "var(--lime-ink)";
    if (s === "blocked" || s === "waiting") return "var(--amber-ink)";
    if (s === "aborted" || s === "rolled back") return "var(--rose-ink)";
    if (s === "active" || s === "running") return "var(--cyan-ink)";
    return "var(--text-dim)";
  }

  function miniTable(cols, rows) {
    var t = h("table", { style: "border-collapse:collapse;font-family:var(--font-mono);font-size:0.8rem;width:100%" });
    var hr = h("tr", {});
    for (var i = 0; i < cols.length; i++) {
      hr.appendChild(h("th", { style: "text-align:left;padding:3px 6px;border-bottom:1px solid var(--line);color:var(--text-dim);font-weight:600" }, cols[i]));
    }
    t.appendChild(hr);
    for (var r = 0; r < rows.length; r++) {
      var tr = h("tr", {});
      for (var c = 0; c < rows[r].length; c++) {
        tr.appendChild(h("td", { style: "padding:3px 6px;border-bottom:1px solid var(--line);color:var(--text)" }, String(rows[r][c])));
      }
      t.appendChild(tr);
    }
    return t;
  }

  function panel(title, body) {
    return h("div", { style: "border:1px solid var(--line);border-radius:10px;padding:8px 10px;background:var(--surface-solid);min-width:0" },
      h("div", { style: "font-size:0.78rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-dim);margin-bottom:6px" }, title),
      body);
  }

  var Widgets = {};

  /* ==================================================================
     1. txnIsolation — FLAGSHIP isolation-anomaly simulator.
     Each scenario is an explicit script. A step may override fields per
     level under `by` (rc also covers ru, because Postgres runs READ
     UNCOMMITTED as READ COMMITTED). Fields: res (result text), note,
     read (true = goes into that txn's view), s1/s2 (status change),
     state (committed table after this step).
  ================================================================== */
  var ERR_CONCURRENT = "ERROR: could not serialize access due to concurrent update";
  var ERR_RW = "ERROR: could not serialize access due to read/write dependencies among transactions";

  var ISO_LEVELS = [
    ["ru", "Read uncommitted"],
    ["rc", "Read committed"],
    ["rr", "Repeatable read (snapshot)"],
    ["ser", "Serializable (SSI)"]
  ];

  var ISO_LEVEL_NOTES = {
    ru: "Postgres accepts READ UNCOMMITTED but runs it exactly as READ COMMITTED: there is no dirty-read mode. The steps below are the READ COMMITTED script.",
    rc: "Postgres READ COMMITTED: every statement takes a fresh snapshot of committed data. Writers take row locks; a blocked UPDATE re-checks the newest row version once the lock holder finishes.",
    rr: "Postgres REPEATABLE READ is snapshot isolation: one snapshot for the whole transaction, taken at its first statement. Updating a row that a concurrent transaction changed and committed aborts the second updater.",
    ser: "Postgres SERIALIZABLE is snapshot isolation plus SSI: it tracks read/write dependencies and aborts one transaction when they could form a cycle. Readers never block."
  };

  var ISO = {
    dirty: {
      label: "Dirty read",
      goal: "Can T2 read a value T1 wrote but never committed?",
      cols: ["id", "balance"],
      init: [["A", "100"]],
      steps: [
        { tx: 1, sql: "BEGIN;", res: "transaction started", s1: "active" },
        { tx: 2, sql: "BEGIN;", res: "transaction started", s2: "active" },
        { tx: 1, sql: "UPDATE acct SET balance = 50 WHERE id = 'A';", res: "1 row updated; the new version is visible only to T1 until it commits" },
        { tx: 2, sql: "SELECT balance FROM acct WHERE id = 'A';", res: "100", read: true,
          note: "Other transactions only ever see committed versions.",
          ruNote: "A literal READ UNCOMMITTED engine (for example SQL Server under NOLOCK) would return 50 here." },
        { tx: 1, sql: "ROLLBACK;", res: "T1's new version is discarded", s1: "rolled back" },
        { tx: 2, sql: "SELECT balance FROM acct WHERE id = 'A';", res: "100", read: true },
        { tx: 2, sql: "COMMIT;", res: "committed", s2: "committed" }
      ],
      verdict: {
        ru: ["safe", "Prevented (Postgres has no dirty reads)", "READ UNCOMMITTED ran as READ COMMITTED, so T2 read 100 both times. In an engine that implements the level literally, T2's first read would have returned 50 — a value that was rolled back and never existed."],
        rc: ["safe", "Prevented", "READ COMMITTED never exposes uncommitted versions. T2 read 100 both times; the rolled-back 50 never leaked."],
        rr: ["safe", "Prevented", "T2's snapshot contains only committed data, so T1's uncommitted 50 was invisible."],
        ser: ["safe", "Prevented", "Every Postgres level blocks dirty reads; SERIALIZABLE adds nothing here because T2 never saw T1's write."]
      }
    },

    nonrep: {
      label: "Non-repeatable read",
      goal: "Does T1 get the same answer when it reads the same row twice?",
      cols: ["id", "balance"],
      init: [["A", "100"]],
      steps: [
        { tx: 1, sql: "BEGIN;", res: "transaction started", s1: "active" },
        { tx: 1, sql: "SELECT balance FROM acct WHERE id = 'A';", res: "100", read: true,
          by: { rr: { note: "First statement: T1's snapshot is taken now, not at BEGIN." }, ser: { note: "First statement: T1's snapshot is taken now, not at BEGIN." } } },
        { tx: 2, sql: "BEGIN;", res: "transaction started", s2: "active" },
        { tx: 2, sql: "UPDATE acct SET balance = 40 WHERE id = 'A';", res: "1 row updated (not committed yet)" },
        { tx: 2, sql: "COMMIT;", res: "committed", s2: "committed", state: [["A", "40"]] },
        { tx: 1, sql: "SELECT balance FROM acct WHERE id = 'A';", res: "40", read: true,
          note: "New statement, new snapshot: T2's commit is now visible. Same query, different answer.",
          by: {
            rr: { res: "100", note: "Same snapshot as the first read: T2's commit stays invisible." },
            ser: { res: "100", note: "Same snapshot as the first read: T2's commit stays invisible." }
          } },
        { tx: 1, sql: "COMMIT;", res: "committed", s1: "committed" }
      ],
      verdict: {
        ru: ["anomaly", "Non-repeatable read occurs", "Running as READ COMMITTED, T1 read 100 and then 40 for the same row inside one transaction. Any decision T1 made from the first read is now based on stale data."],
        rc: ["anomaly", "Non-repeatable read occurs", "T1 read 100 and then 40 for the same row inside one transaction, because each statement takes a fresh snapshot."],
        rr: ["safe", "Prevented", "The transaction-wide snapshot kept T1's reads stable at 100. T1 only read, so committing is equivalent to running T1 entirely before T2."],
        ser: ["safe", "Prevented, no abort needed", "Same stable snapshot as REPEATABLE READ. The only dependency is T1 read before T2 wrote, which is a valid serial order (T1 then T2), so SSI lets both commit."]
      }
    },

    phantom: {
      label: "Phantom",
      goal: "T1 books room 7 at 09:00 only if two checks find no booking. T2 books the same slot concurrently.",
      cols: ["room", "slot", "guest"],
      init: [["7", "10:00", "carol"]],
      steps: [
        { tx: 1, sql: "BEGIN;", res: "transaction started", s1: "active" },
        { tx: 1, sql: "SELECT count(*) FROM bookings WHERE room = 7 AND slot = '09:00';", res: "0", read: true, note: "The slot looks free." },
        { tx: 2, sql: "BEGIN;", res: "transaction started", s2: "active" },
        { tx: 2, sql: "SELECT count(*) FROM bookings WHERE room = 7 AND slot = '09:00';", res: "0", read: true },
        { tx: 2, sql: "INSERT INTO bookings VALUES (7, '09:00', 'bob');", res: "1 row inserted (not committed yet)" },
        { tx: 2, sql: "COMMIT;", res: "committed", s2: "committed", state: [["7", "10:00", "carol"], ["7", "09:00", "bob"]] },
        { tx: 1, sql: "SELECT count(*) FROM bookings WHERE room = 7 AND slot = '09:00';  -- re-check", res: "1", read: true,
          note: "Phantom: a row matching T1's predicate appeared between two identical reads.",
          by: {
            rr: { res: "0", note: "The snapshot hides bob's row. Postgres REPEATABLE READ shows no phantoms, which is stricter than the SQL standard requires." },
            ser: { res: "0", note: "The snapshot hides bob's row, but SSI has recorded that T1 read the predicate T2 wrote into." }
          } },
        { tx: 1, sql: "INSERT INTO bookings VALUES (7, '09:00', 'alice');", res: "skipped: the re-check found the slot taken, so the app backs off",
          by: {
            rr: { res: "1 row inserted (not committed yet)", note: "Both checks said 0, so the app books." },
            ser: { res: "1 row inserted (not committed yet)", note: "Both checks said 0, so the app books." }
          } },
        { tx: 1, sql: "COMMIT;", res: "committed (nothing was written)", s1: "committed",
          by: {
            rr: { res: "committed", state: [["7", "10:00", "carol"], ["7", "09:00", "bob"], ["7", "09:00", "alice"]] },
            ser: { res: ERR_RW, s1: "aborted", note: "Each transaction read the predicate the other wrote into: a dependency cycle. Postgres may raise this at the INSERT or at COMMIT depending on timing." }
          } }
      ],
      verdict: {
        ru: ["anomaly", "Phantom read occurs", "Running as READ COMMITTED, T1's second count returned 1 where the first returned 0. Here the phantom happened to save the app, but only by timing: had T2 committed after T1's re-check, READ COMMITTED would have double-booked."],
        rc: ["anomaly", "Phantom read occurs", "T1's second count returned 1 where the first returned 0. The phantom happened to save the app here, but only by timing: had T2 committed after T1's re-check, READ COMMITTED would have double-booked."],
        rr: ["anomaly", "Double booking (write skew through a predicate)", "The snapshot hid the phantom, so T1 never noticed bob and inserted alice for the same slot. Snapshot isolation only detects two writers on the same row; these were two different new rows."],
        ser: ["abort", "T1 aborted, invariant kept", "SSI saw read/write dependencies in both directions and aborted T1. On retry, T1's check sees bob's booking and backs off. Your code must catch SQLSTATE 40001 and retry."]
      }
    },

    lost: {
      label: "Lost update",
      goal: "Two deposits (+10 and +25) computed in the app from a balance of 100. The correct final balance is 135.",
      cols: ["id", "balance"],
      init: [["A", "100"]],
      steps: [
        { tx: 1, sql: "BEGIN;", res: "transaction started", s1: "active" },
        { tx: 1, sql: "SELECT balance FROM acct WHERE id = 'A';", res: "100", read: true },
        { tx: 2, sql: "BEGIN;", res: "transaction started", s2: "active" },
        { tx: 2, sql: "SELECT balance FROM acct WHERE id = 'A';", res: "100", read: true },
        { tx: 1, sql: "UPDATE acct SET balance = 110 WHERE id = 'A';  -- 100 + 10 in app", res: "1 row updated; T1 now holds the row lock" },
        { tx: 2, sql: "UPDATE acct SET balance = 125 WHERE id = 'A';  -- 100 + 25 in app", res: "waiting: the row is locked by T1", s2: "blocked" },
        { tx: 1, sql: "COMMIT;", s1: "committed", state: [["A", "110"]],
          res: "committed. T2 wakes, re-reads the newest row version, and applies its write (balance = 125)", s2: "active",
          by: {
            rr: { res: "committed. T2 wakes and fails: " + ERR_CONCURRENT, s2: "aborted" },
            ser: { res: "committed. T2 wakes and fails: " + ERR_CONCURRENT, s2: "aborted" }
          } },
        { tx: 2, sql: "COMMIT;", res: "committed", s2: "committed", state: [["A", "125"]],
          by: {
            rr: { res: "ROLLBACK (the transaction had already failed)", s2: "aborted", state: [["A", "110"]] },
            ser: { res: "ROLLBACK (the transaction had already failed)", s2: "aborted", state: [["A", "110"]] }
          } }
      ],
      verdict: {
        ru: ["anomaly", "Lost update occurs", "Running as READ COMMITTED, T2 overwrote T1's committed 110 with 125, a value computed from a stale read. T1's +10 vanished. Fix with an atomic UPDATE ... SET balance = balance + 25, a SELECT ... FOR UPDATE, or a stronger level."],
        rc: ["anomaly", "Lost update occurs", "T2 overwrote T1's committed 110 with 125, computed from a stale read of 100, so T1's +10 vanished. Fix with an atomic UPDATE ... SET balance = balance + 25, a SELECT ... FOR UPDATE, or a stronger level."],
        rr: ["abort", "T2 aborted (first updater wins)", "T2 tried to update a row that a transaction committed after T2's snapshot had already changed, so Postgres aborted it. A retry reads 110 and writes 135. The same error fires even if T1 had committed before T2's UPDATE started."],
        ser: ["abort", "T2 aborted (first updater wins)", "SERIALIZABLE inherits snapshot isolation's write-write check, so the second updater fails with a serialization error. Retry the whole transaction and it reads 110 and writes 135."]
      }
    },

    skew: {
      label: "Write skew",
      goal: "Invariant: at least one doctor on call. Alice and Bob each go off call if they see two on call.",
      cols: ["doctor", "on_call"],
      init: [["alice", "true"], ["bob", "true"]],
      steps: [
        { tx: 1, sql: "BEGIN;", res: "transaction started", s1: "active" },
        { tx: 1, sql: "SELECT count(*) FROM doctors WHERE on_call;", res: "2", read: true, note: "Two on call, so Alice may leave." },
        { tx: 2, sql: "BEGIN;", res: "transaction started", s2: "active" },
        { tx: 2, sql: "SELECT count(*) FROM doctors WHERE on_call;", res: "2", read: true, note: "Two on call, so Bob may leave." },
        { tx: 1, sql: "UPDATE doctors SET on_call = false WHERE doctor = 'alice';", res: "1 row updated (not committed yet)" },
        { tx: 2, sql: "UPDATE doctors SET on_call = false WHERE doctor = 'bob';", res: "1 row updated: a different row, so no lock conflict" },
        { tx: 1, sql: "COMMIT;", res: "committed", s1: "committed", state: [["alice", "false"], ["bob", "true"]] },
        { tx: 2, sql: "COMMIT;", res: "committed", s2: "committed", state: [["alice", "false"], ["bob", "false"]],
          by: {
            ser: { res: ERR_RW, s2: "aborted", state: [["alice", "false"], ["bob", "true"]], note: "T1 read what T2 wrote and T2 read what T1 wrote: a cycle. Postgres may raise this at the UPDATE or at COMMIT depending on timing." }
          } }
      ],
      verdict: {
        ru: ["anomaly", "Write skew: invariant broken", "Running as READ COMMITTED, both doctors went off call. Each transaction's check was true when it ran, and their writes touched different rows, so nothing conflicted."],
        rc: ["anomaly", "Write skew: invariant broken", "Both doctors went off call. Each check was true when it ran, and the writes touched different rows, so row locks never conflicted."],
        rr: ["anomaly", "Write skew: invariant broken", "Snapshot isolation only aborts when two transactions write the same row. Alice's and Bob's rows differ, so both commits succeed and nobody is on call."],
        ser: ["abort", "T2 aborted, invariant kept", "SSI found rw-antidependencies in both directions between T1 and T2 and aborted the later committer. Bob stays on call; on retry his check sees only one doctor on call and he cannot leave."]
      }
    }
  };

  var ISO_ORDER = [["dirty", "Dirty read"], ["nonrep", "Non-repeatable read"], ["phantom", "Phantom"], ["lost", "Lost update"], ["skew", "Write skew"]];

  function isoPick(step, lv, field) {
    var key = lv === "ru" ? "rc" : lv;
    if (step.by && step.by[key] && step.by[key][field] !== undefined) return step.by[key][field];
    return step[field];
  }

  Widgets.txnIsolation = function (mount) {
    shell(mount, "simulator", "Isolation anomaly simulator",
      "Two concurrent transactions, one operation at a time. Pick a scenario and an isolation level, then step through and watch what each transaction reads, what is committed, and whether the anomaly happens, is prevented, or forces an abort. Semantics follow PostgreSQL.");

    var scen = "dirty", level = "rc", pos = 0;
    var levelNote = h("p", { style: "font-size:0.82rem;color:var(--text-dim);margin:0 0 10px;line-height:1.5" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function compute(sc, upto) {
      var st1 = "not started", st2 = "not started", table = sc.init, reads = { 1: [], 2: [] };
      for (var i = 0; i < upto; i++) {
        var s = sc.steps[i];
        var a = isoPick(s, level, "s1"), b = isoPick(s, level, "s2"), t = isoPick(s, level, "state");
        if (a) st1 = a;
        if (b) st2 = b;
        if (t) table = t;
        if (isoPick(s, level, "read")) reads[s.tx].push("step " + (i + 1) + ": " + isoPick(s, level, "res"));
      }
      return { st1: st1, st2: st2, table: table, reads: reads };
    }

    function stepCell(sc, i, done, current) {
      var s = sc.steps[i];
      var res = isoPick(s, level, "res");
      var note = isoPick(s, level, "note");
      var isErr = typeof res === "string" && res.indexOf("ERROR") >= 0;
      var cell = h("div", {
        style: "padding:6px 8px;border-radius:8px;min-width:0;border:1px solid " + (current ? "var(--accent)" : "var(--line)") +
          ";background:" + (current ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-solid)")
      });
      cell.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.8rem;word-break:break-word;color:" + (done ? "var(--text)" : "var(--text-dim)") }, s.sql));
      if (done) {
        cell.appendChild(h("div", { style: "font-size:0.8rem;margin-top:3px;font-weight:600;color:" + (isErr ? "var(--rose-ink)" : s.tx === 1 ? "var(--cyan-ink)" : "var(--violet-ink)") }, "\u2192 " + res));
        if (note) cell.appendChild(h("div", { style: "font-size:0.78rem;margin-top:2px;color:var(--text-dim);line-height:1.4" }, note));
        if (level === "ru" && s.ruNote) cell.appendChild(h("div", { style: "font-size:0.78rem;margin-top:2px;color:var(--amber-ink);line-height:1.4" }, s.ruNote));
      }
      return cell;
    }

    function paint() {
      var sc = ISO[scen] || ISO.dirty;
      var total = sc.steps.length;
      if (pos > total) pos = total;
      var c = compute(sc, pos);
      var done = pos >= total;
      levelNote.textContent = ISO_LEVEL_NOTES[level];

      clear(stage);
      stage.appendChild(h("p", { style: "font-size:0.86rem;margin:0 0 8px;color:var(--text)" }, h("strong", {}, sc.label + ": "), sc.goal));

      var grid = h("div", { style: "display:grid;grid-template-columns:28px minmax(0,1fr) minmax(0,1fr);gap:6px;align-items:start" });
      grid.appendChild(h("span", { style: "font-size:0.78rem;color:var(--text-dim)" }, "#"));
      grid.appendChild(h("span", { style: "font-size:0.8rem;font-weight:700;color:var(--cyan-ink)" }, "T1 \u00b7 " + c.st1));
      grid.appendChild(h("span", { style: "font-size:0.8rem;font-weight:700;color:var(--violet-ink)" }, "T2 \u00b7 " + c.st2));
      for (var i = 0; i < total; i++) {
        var s = sc.steps[i];
        var isDone = i < pos, isCur = i === pos - 1;
        grid.appendChild(h("span", { style: "font-family:var(--font-mono);font-size:0.78rem;padding-top:7px;color:" + (isCur ? "var(--accent-ink)" : "var(--text-dim)") }, String(i + 1)));
        var cell = stepCell(sc, i, isDone, isCur);
        if (s.tx === 1) { grid.appendChild(cell); grid.appendChild(h("span", {})); }
        else { grid.appendChild(h("span", {})); grid.appendChild(cell); }
      }
      stage.appendChild(grid);

      function readList(arr) {
        if (!arr.length) return h("div", { style: "font-size:0.8rem;color:var(--text-dim)" }, "no reads yet");
        var ul = h("div", {});
        for (var k = 0; k < arr.length; k++) ul.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text)" }, arr[k]));
        return ul;
      }
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:12px" },
        panel("T1 saw", readList(c.reads[1])),
        panel("T2 saw", readList(c.reads[2])),
        panel("Committed table", miniTable(sc.cols, c.table))));

      var v = sc.verdict[level];
      var kindCol = v[0] === "anomaly" ? "rose" : v[0] === "abort" ? "amber" : "lime";
      if (done) {
        stage.appendChild(h("div", { style: "margin-top:12px;padding:10px 12px;border-radius:10px;border:1px solid var(--" + kindCol + ");background:color-mix(in srgb, var(--" + kindCol + ") 10%, transparent)" },
          h("div", { style: "font-weight:700;font-size:0.9rem;color:var(--" + kindCol + "-ink)" }, v[1]),
          h("div", { style: "font-size:0.84rem;margin-top:4px;line-height:1.5;color:var(--text)" }, v[2])));
      } else {
        stage.appendChild(h("p", { style: "margin:12px 0 0;font-size:0.82rem;color:var(--text-dim)" }, pos === 0 ? "Press Step to run the first operation, or Run all." : "Keep stepping to reach the verdict."));
      }

      clear(readout);
      readout.appendChild(ro("step", pos + " / " + total));
      readout.appendChild(ro("T1", c.st1, statusColor(c.st1)));
      readout.appendChild(ro("T2", c.st2, statusColor(c.st2)));
      readout.appendChild(ro("outcome", done ? (v[0] === "anomaly" ? "anomaly occurs" : v[0] === "abort" ? "one txn aborts" : "prevented") : "in progress",
        done ? "var(--" + kindCol + "-ink)" : null));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment(ISO_ORDER, 0, function (v) { scen = v; pos = 0; paint(); }),
      segment(ISO_LEVELS, 1, function (v) { level = v; paint(); }),
      h("div", { style: "display:flex;gap:6px;flex-wrap:wrap" },
        button("Step", "primary", function () { var sc = ISO[scen]; if (sc && pos < sc.steps.length) pos++; paint(); }),
        button("Run all", "", function () { var sc = ISO[scen]; if (sc) pos = sc.steps.length; paint(); }),
        button("Reset", "ghost", function () { pos = 0; paint(); }))));
    mount.appendChild(levelNote);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. txnDeadlock — row locks, waits-for graph, detection vs timeout.
     Each tick every live txn (in id order) tries its next lock; a txn
     holding all its locks commits and releases them. Detection checks
     the waits-for graph after every tick and aborts the youngest txn in
     a cycle. Timeout mode aborts one waiter per tick once it has waited
     TIMEOUT ticks, without looking at the graph.
  ================================================================== */
  var DL_TIMEOUT = 5;
  var DL_SCEN = {
    opp2: { label: "2 txns, opposite order", orders: [["A", "B"], ["B", "A"]] },
    same2: { label: "2 txns, same order", orders: [["A", "B"], ["A", "B"]] },
    cyc3: { label: "3 txns in a ring", orders: [["A", "B"], ["B", "C"], ["C", "A"]] },
    ord3: { label: "3 txns, sorted order", orders: [["A", "B"], ["B", "C"], ["A", "C"]] }
  };

  Widgets.txnDeadlock = function (mount) {
    shell(mount, "locks", "Deadlock lab: waits-for graph",
      "Transactions lock rows in the order shown. Step through ticks and watch the waits-for graph. Compare cycle detection (abort the youngest transaction in the cycle) with a plain lock timeout, and see how a consistent lock order removes deadlocks entirely.");

    var scen = "opp2", mode = "detect", S = null;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function reset() {
      var sc = DL_SCEN[scen] || DL_SCEN.opp2;
      var txns = [];
      for (var i = 0; i < sc.orders.length; i++) {
        txns.push({ id: "T" + (i + 1), order: sc.orders[i], next: 0, status: "running", waitFor: null, waited: 0 });
      }
      S = { txns: txns, locks: {}, tick: 0, log: ["Ready. Each transaction will lock its rows in order, then commit."], deadlocks: 0, waitTicks: 0, cycle: null };
    }

    function release(t) {
      for (var r in S.locks) if (Object.prototype.hasOwnProperty.call(S.locks, r) && S.locks[r] === t.id) delete S.locks[r];
    }

    function byId(id) {
      for (var i = 0; i < S.txns.length; i++) if (S.txns[i].id === id) return S.txns[i];
      return null;
    }

    function findCycle() {
      for (var i = 0; i < S.txns.length; i++) {
        var path = [], cur = S.txns[i];
        while (cur && cur.status === "waiting") {
          var at = path.indexOf(cur.id);
          if (at >= 0) return path.slice(at);
          path.push(cur.id);
          cur = byId(cur.waitFor);
        }
      }
      return null;
    }

    function finished() {
      for (var i = 0; i < S.txns.length; i++) if (S.txns[i].status === "running" || S.txns[i].status === "waiting") return false;
      return true;
    }

    function tick() {
      if (finished()) return;
      S.tick++;
      S.cycle = null;
      for (var i = 0; i < S.txns.length; i++) {
        var t = S.txns[i];
        if (t.status !== "running" && t.status !== "waiting") continue;
        if (t.next >= t.order.length) {
          release(t);
          t.status = "committed"; t.waitFor = null;
          S.log.push("tick " + S.tick + ": " + t.id + " commits and releases its locks");
          continue;
        }
        var row = t.order[t.next], holder = S.locks[row];
        if (!holder || holder === t.id) {
          S.locks[row] = t.id; t.next++; t.status = "running"; t.waitFor = null; t.waited = 0;
          S.log.push("tick " + S.tick + ": " + t.id + " locks row " + row);
        } else {
          if (t.status !== "waiting") S.log.push("tick " + S.tick + ": " + t.id + " waits for row " + row + " (held by " + holder + ")");
          t.status = "waiting"; t.waitFor = holder; t.waited++; S.waitTicks++;
        }
      }
      if (mode === "detect") {
        var cyc = findCycle();
        if (cyc) {
          S.deadlocks++;
          S.cycle = cyc.slice();
          var victim = byId(cyc[0]);
          for (var c = 1; c < cyc.length; c++) { var cand = byId(cyc[c]); if (cand && Number(cand.id.slice(1)) > Number(victim.id.slice(1))) victim = cand; }
          release(victim); victim.status = "aborted"; victim.waitFor = null;
          S.log.push("tick " + S.tick + ": deadlock " + cyc.join(" \u2192 ") + " \u2192 " + cyc[0] + "; victim " + victim.id + " (youngest) aborted");
        }
      } else {
        var worst = null;
        for (var k = 0; k < S.txns.length; k++) {
          var w = S.txns[k];
          if (w.status === "waiting" && w.waited >= DL_TIMEOUT && (!worst || w.waited > worst.waited)) worst = w;
        }
        if (worst) {
          release(worst); worst.status = "aborted"; worst.waitFor = null;
          S.log.push("tick " + S.tick + ": " + worst.id + " hit the " + DL_TIMEOUT + "-tick lock timeout and aborted (the timer cannot tell whether a cycle existed)");
        }
      }
    }

    function drawGraph() {
      var n = S.txns.length;
      var pts = n === 2 ? [[90, 80], [270, 80]] : [[180, 34], [292, 132], [68, 132]];
      var s = svg("svg", { viewBox: "0 0 360 170", width: "100%", style: "max-width:420px;display:block;margin:0 auto", role: "img", "aria-label": "Waits-for graph" });
      var cyc = S.cycle || [];
      function idx(id) { return Number(id.slice(1)) - 1; }
      function edge(a, b, hot) {
        var p = pts[a], q = pts[b];
        var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
        var ux = dx / len, uy = dy / len, r = 26;
        var off = n === 2 ? 10 : 0;
        var x1 = p[0] + ux * r - uy * off, y1 = p[1] + uy * r + ux * off;
        var x2 = q[0] - ux * r - uy * off, y2 = q[1] - uy * r + ux * off;
        var col = hot ? "var(--rose-ink)" : "var(--amber-ink)";
        s.appendChild(svg("line", { x1: x1, y1: y1, x2: x2, y2: y2, style: "stroke:" + col + ";stroke-width:2.2" + (hot ? "" : ";stroke-dasharray:5 4") }));
        var hx = x2 - ux * 10, hy = y2 - uy * 10;
        s.appendChild(svg("polygon", { points: x2 + "," + y2 + " " + (hx - uy * 5) + "," + (hy + ux * 5) + " " + (hx + uy * 5) + "," + (hy - ux * 5), style: "fill:" + col }));
      }
      var drawn = {};
      for (var c = 0; c < cyc.length; c++) {
        var a = cyc[c], b = cyc[(c + 1) % cyc.length];
        edge(idx(a), idx(b), true); drawn[a + ">" + b] = true;
      }
      for (var i = 0; i < n; i++) {
        var t = S.txns[i];
        if (t.status === "waiting" && t.waitFor && !drawn[t.id + ">" + t.waitFor]) edge(i, idx(t.waitFor), false);
      }
      for (var j = 0; j < n; j++) {
        var tx = S.txns[j];
        s.appendChild(svg("circle", { cx: pts[j][0], cy: pts[j][1], r: 24, style: "fill:var(--surface-solid);stroke:" + statusColor(tx.status) + ";stroke-width:2.5" }));
        var lab = svg("text", { x: pts[j][0], y: pts[j][1] + 5, "text-anchor": "middle", style: "fill:var(--text);font-size:14px;font-weight:700" });
        lab.textContent = tx.id;
        s.appendChild(lab);
        var st = svg("text", { x: pts[j][0], y: pts[j][1] + (pts[j][1] < 60 ? -30 : 40), "text-anchor": "middle", style: "fill:var(--text-dim);font-size:11px" });
        st.textContent = tx.status;
        s.appendChild(st);
      }
      return s;
    }

    function paint() {
      clear(stage);
      var rows = [], i;
      var allRows = ["A", "B", "C"];
      for (i = 0; i < allRows.length; i++) {
        var r = allRows[i], waiters = [];
        for (var k = 0; k < S.txns.length; k++) {
          var t = S.txns[k];
          if (t.status === "waiting" && t.order[t.next] === r) waiters.push(t.id);
        }
        var used = false;
        for (k = 0; k < S.txns.length; k++) if (S.txns[k].order.indexOf(r) >= 0) used = true;
        if (used) rows.push([r, S.locks[r] || "free", waiters.length ? waiters.join(", ") : "none"]);
      }
      var orders = [];
      for (i = 0; i < S.txns.length; i++) {
        var tt = S.txns[i];
        orders.push([tt.id, tt.order.join(" then "), String(tt.next) + " / " + tt.order.length, tt.status]);
      }
      stage.appendChild(h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;align-items:start" },
        panel("Waits-for graph (arrow = waits for)", drawGraph()),
        h("div", { style: "display:grid;gap:8px" },
          panel("Transactions", miniTable(["txn", "lock order", "held", "status"], orders)),
          panel("Row locks", miniTable(["row", "holder", "waiting"], rows)))));
      var logBox = h("div", {});
      var start = Math.max(0, S.log.length - 6);
      for (i = start; i < S.log.length; i++) {
        var hot = S.log[i].indexOf("deadlock") >= 0 || S.log[i].indexOf("timeout") >= 0;
        logBox.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.78rem;line-height:1.5;color:" + (hot ? "var(--rose-ink)" : "var(--text)") }, S.log[i]));
      }
      stage.appendChild(h("div", { style: "margin-top:10px" }, panel("Event log", logBox)));

      var committed = 0, aborted = 0;
      for (i = 0; i < S.txns.length; i++) {
        if (S.txns[i].status === "committed") committed++;
        if (S.txns[i].status === "aborted") aborted++;
      }
      clear(readout);
      readout.appendChild(ro("tick", S.tick));
      readout.appendChild(ro("committed", committed + " / " + S.txns.length, "var(--lime-ink)"));
      readout.appendChild(ro("aborted", aborted, aborted ? "var(--rose-ink)" : null));
      readout.appendChild(ro("cycles detected", S.deadlocks));
      readout.appendChild(ro("ticks spent waiting", S.waitTicks));
      readout.appendChild(ro("state", finished() ? "finished" : "running"));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["opp2", DL_SCEN.opp2.label], ["same2", DL_SCEN.same2.label], ["cyc3", DL_SCEN.cyc3.label], ["ord3", DL_SCEN.ord3.label]], 0,
        function (v) { scen = v; reset(); paint(); }),
      segment([["detect", "Cycle detection"], ["timeout", "Lock timeout (" + DL_TIMEOUT + " ticks)"]], 0,
        function (v) { mode = v; reset(); paint(); }),
      h("div", { style: "display:flex;gap:6px;flex-wrap:wrap" },
        button("Step", "primary", function () { tick(); paint(); }),
        button("Run all", "", function () { var guard = 0; while (!finished() && guard < 60) { tick(); guard++; } paint(); }),
        button("Reset", "ghost", function () { reset(); paint(); }))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    reset();
    paint();
  };

  /* ==================================================================
     3. txnMvcc — Postgres-style tuple visibility.
     A tuple is visible when its xmin is visible to the snapshot and its
     xmax is unset or not visible. An xid is visible when it is the
     reader's own xid, or it is below the snapshot's xmax, was not in
     progress when the snapshot was taken, and committed.
  ================================================================== */
  var MV_TUPLES = [
    { row: "1", ver: "v1", xmin: 100, xmax: 105, bal: 100 },
    { row: "1", ver: "v2", xmin: 105, xmax: 112, bal: 80 },
    { row: "1", ver: "v3", xmin: 112, xmax: 0, bal: 95 },
    { row: "2", ver: "v1", xmin: 103, xmax: 0, bal: 50 },
    { row: "3", ver: "v1", xmin: 110, xmax: 0, bal: 70 },
    { row: "4", ver: "v1", xmin: 101, xmax: 108, bal: 20 }
  ];
  var MV_SNAPS = {
    s104: { label: "Early (xmax 104)", desc: "Taken when the next xid to be assigned was 104. Nothing running.", xmax: 104, running: [], self: 0 },
    s110: { label: "Mid (xmax 110, 105 running)", desc: "Taken when 110 was next and xid 105 was still in progress.", xmax: 110, running: [105], self: 0 },
    s113: { label: "Late (xmax 113, 112 running)", desc: "Taken when 113 was next and xid 112 was still in progress.", xmax: 113, running: [112], self: 0 },
    own: { label: "Inside xid 112", desc: "The snapshot of transaction 112 itself, before it ends. A transaction always sees its own writes.", xmax: 113, running: [], self: 112 },
    s120: { label: "After everything (xmax 120)", desc: "Taken when 120 was next. Nothing running, so every finished xid's outcome counts.", xmax: 120, running: [], self: 0 }
  };

  Widgets.txnMvcc = function (mount) {
    shell(mount, "mvcc", "MVCC visibility: which version does this snapshot see?",
      "Six heap tuples, Postgres style: every version carries xmin (the inserting xid) and xmax (the deleting or superseding xid, 0 if none). Choose a reader's snapshot and the fate of xid 112, and see which version of each row is visible and why.");

    var snapKey = "s104", fate112 = "committed";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function xidStatus(x) {
      if (x === 112) return fate112;
      if (x === 110) return "aborted";
      return "committed";
    }

    function why(x, snap) {
      if (x === snap.self) return "own xid";
      if (x >= snap.xmax) return "xid " + x + " started after the snapshot";
      if (snap.running.indexOf(x) >= 0) return "xid " + x + " was in progress at snapshot time";
      if (xidStatus(x) === "aborted") return "xid " + x + " aborted";
      return "";
    }

    function seen(x, snap) { return why(x, snap) === "" || x === snap.self; }

    function paint() {
      var snap = MV_SNAPS[snapKey] || MV_SNAPS.s104;
      clear(stage);
      stage.appendChild(h("p", { style: "font-size:0.84rem;margin:0 0 8px;color:var(--text-dim);line-height:1.5" }, snap.desc));
      var t = h("table", { style: "border-collapse:collapse;width:100%;font-size:0.8rem" });
      var heads = ["row", "ver", "xmin", "xmax", "balance", "visible?", "why"];
      var hr = h("tr", {});
      for (var i = 0; i < heads.length; i++) hr.appendChild(h("th", { style: "text-align:left;padding:4px 6px;border-bottom:1px solid var(--line);color:var(--text-dim)" }, heads[i]));
      t.appendChild(hr);
      var visible = 0, row1 = "none";
      for (i = 0; i < MV_TUPLES.length; i++) {
        var tp = MV_TUPLES[i];
        var insOk = seen(tp.xmin, snap);
        var delOk = tp.xmax !== 0 && seen(tp.xmax, snap);
        var vis = insOk && !delOk;
        var reason;
        if (!insOk) reason = "insert not visible: " + why(tp.xmin, snap);
        else if (delOk) reason = tp.xmax === snap.self ? "superseded by this transaction's own update" : "deleted or superseded by xid " + tp.xmax + ", which this snapshot sees";
        else if (tp.xmax !== 0) reason = "live for this snapshot: xmax " + tp.xmax + " not visible (" + why(tp.xmax, snap) + ")";
        else reason = tp.xmin === snap.self ? "inserted by this transaction" : "live: inserted by a visible committed xid";
        if (vis) { visible++; if (tp.row === "1") row1 = String(tp.bal); }
        var tr = h("tr", { style: vis ? "background:color-mix(in srgb, var(--lime) 12%, transparent)" : "" });
        var cells = [tp.row, tp.ver, tp.xmin + " (" + xidStatus(tp.xmin) + ")", tp.xmax ? tp.xmax + " (" + xidStatus(tp.xmax) + ")" : "0", String(tp.bal)];
        for (var c = 0; c < cells.length; c++) tr.appendChild(h("td", { style: "padding:4px 6px;border-bottom:1px solid var(--line);font-family:var(--font-mono);color:var(--text)" }, cells[c]));
        tr.appendChild(h("td", { style: "padding:4px 6px;border-bottom:1px solid var(--line);font-weight:700;color:" + (vis ? "var(--lime-ink)" : "var(--rose-ink)") }, vis ? "yes" : "no"));
        tr.appendChild(h("td", { style: "padding:4px 6px;border-bottom:1px solid var(--line);color:var(--text-dim)" }, reason));
        t.appendChild(tr);
      }
      stage.appendChild(h("div", { style: "overflow-x:auto" }, t));
      stage.appendChild(h("p", { style: "font-size:0.8rem;color:var(--text-dim);margin:8px 0 0;line-height:1.5" },
        "Row 3 was inserted by aborted xid 110, so no snapshot ever sees it; VACUUM can reclaim it. Old versions of row 1 stay on the page until no running snapshot could still need them."));
      clear(readout);
      readout.appendChild(ro("snapshot", snap.label));
      readout.appendChild(ro("visible tuples", visible + " / " + MV_TUPLES.length));
      readout.appendChild(ro("row 1 balance seen", row1, "var(--accent-ink)"));
      readout.appendChild(ro("xid 112", fate112));
    }

    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["s104", MV_SNAPS.s104.label], ["s110", MV_SNAPS.s110.label], ["s113", MV_SNAPS.s113.label], ["own", MV_SNAPS.own.label], ["s120", MV_SNAPS.s120.label]], 0,
        function (v) { snapKey = v; paint(); }),
      segment([["committed", "xid 112 commits"], ["aborted", "xid 112 aborts"]], 0, function (v) { fate112 = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "txn-acid": {
      title: "ACID and anomalies checkpoint",
      sub: "What each letter really guarantees, the isolation ladder, and naming anomalies precisely.",
      questions: [
        {
          q: "Which ACID property is mostly the application's responsibility rather than something the engine can guarantee on its own?",
          options: ["Atomicity", "Durability", "Consistency", "Isolation"],
          answer: 2,
          explain: "The engine enforces declared constraints, but whether a transaction moves the data from one valid business state to another is defined by your invariants. Atomicity, isolation and durability are mechanisms the engine supplies; consistency is the goal you build with them."
        },
        {
          q: "In Postgres at READ COMMITTED, T1 runs the same SELECT twice and gets a different value the second time because T2 updated the row and committed in between. What is this anomaly?",
          options: ["Non-repeatable read", "Dirty read", "Write skew", "Dirty write"],
          answer: 0,
          explain: "A non-repeatable (fuzzy) read is re-reading one row inside a transaction and seeing a newly committed value. It is not a dirty read because T2 had committed; READ COMMITTED takes a new snapshot per statement, so this is allowed."
        },
        {
          q: "You run SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED in Postgres and read a row another session has updated but not committed. What do you see?",
          options: ["The uncommitted new value", "An error saying the level is unsupported", "Nothing: the row is skipped while locked", "The last committed value, because Postgres runs READ UNCOMMITTED as READ COMMITTED"],
          answer: 3,
          explain: "Postgres accepts the syntax but maps READ UNCOMMITTED to READ COMMITTED. MVCC gives readers a committed version for free, so there is no performance reason to expose uncommitted data. Lock-based engines such as SQL Server under NOLOCK really can return the dirty value."
        },
        {
          q: "Two on-call doctors each check that two doctors are on call, then each takes only themselves off call, updating different rows. Both commit under snapshot isolation. Which anomaly is this?",
          options: ["Lost update", "Write skew", "Phantom read", "Dirty read"],
          answer: 1,
          explain: "Write skew is two transactions reading an overlapping set, then writing disjoint rows based on what they read, so a cross-row invariant breaks. Snapshot isolation only catches two writers of the same row, which is why it misses this; a lost update would require both to write the same row."
        },
        {
          q: "Which anomaly does the SQL standard still permit at REPEATABLE READ, yet Postgres's REPEATABLE READ never shows to plain reads?",
          options: ["Dirty read", "Lost update on an atomic increment", "Phantom read", "Dirty write"],
          answer: 2,
          explain: "The standard only forbids phantoms at SERIALIZABLE. Postgres implements REPEATABLE READ as snapshot isolation, and a snapshot taken once cannot see rows inserted later, so re-running a range query returns the same set. Write skew is still possible, though, so snapshot isolation is not serializable."
        }
      ]
    },
    "txn-control": {
      title: "Concurrency control checkpoint",
      sub: "Two-phase locking, MVCC in Postgres and InnoDB, and serializable snapshot isolation.",
      questions: [
        {
          q: "What distinguishes strict two-phase locking from basic two-phase locking?",
          options: ["Strict 2PL acquires every lock at transaction start", "Strict 2PL holds exclusive locks until commit or abort, so no one reads uncommitted data and aborts never cascade", "Strict 2PL never takes shared locks", "Strict 2PL releases locks after each statement"],
          answer: 1,
          explain: "Basic 2PL only requires that no lock is acquired after any lock is released, which is enough for serializability but lets others read data that may still roll back. Holding write locks to the end removes cascading aborts and is what real lock-based engines do."
        },
        {
          q: "In Postgres, what does an UPDATE that changes one column of a row do in the heap?",
          options: ["Overwrites the tuple in place and copies the old value to an undo log", "Bumps a per-row version counter only", "Rewrites the whole table file", "Writes a new tuple version with a new xmin and stamps the old version's xmax with the updating xid"],
          answer: 3,
          explain: "Postgres keeps old versions in the table itself: an update is effectively insert-new plus mark-old. That is why updates create dead tuples that VACUUM must reclaim, and why HOT updates exist to avoid touching indexes when no indexed column changes."
        },
        {
          q: "Where does InnoDB keep the older row versions that a consistent read may need?",
          options: ["In undo log records reached through the row's roll pointer", "In separate heap tuples beside the current row", "In the redo log only", "In the doublewrite buffer"],
          answer: 0,
          explain: "InnoDB updates the clustered-index row in place and writes the before-image to the undo log; each row carries a roll pointer to it. A reader whose read view cannot see the current version walks that chain backwards. Purge removes undo once no read view needs it."
        },
        {
          q: "In serializable snapshot isolation, what pattern makes the engine abort a transaction?",
          options: ["Any two transactions writing the same row", "A transaction reading more than a set number of rows", "Two consecutive rw-antidependencies T1 \u2192 T2 \u2192 T3 among concurrent transactions, which every cycle must contain", "A cycle in the waits-for graph"],
          answer: 2,
          explain: "Theory shows every non-serializable snapshot-isolation history contains a pivot with an incoming and an outgoing rw-antidependency between concurrent transactions. SSI watches for that dangerous structure and aborts one participant, rather than tracking full cycles."
        },
        {
          q: "Why does SSI sometimes abort a transaction whose outcome would actually have been serializable?",
          options: ["Its read locks block writers and time out", "It aborts the longest-running transaction on a schedule", "It picks victims at random to keep contention low", "It reacts to a structure that might be part of a cycle, and may coarsen read tracking to page or relation level, accepting false positives so that nobody ever blocks"],
          answer: 3,
          explain: "SSI is conservative: a dangerous structure is necessary for an anomaly but not sufficient, and summarising many fine-grained read locks into coarser ones adds more false conflicts. The pay-off is that readers and writers never wait on each other; the cost is retries."
        },
        {
          q: "Why do lock managers place IX (intention exclusive) locks on a table when a transaction locks individual rows exclusively?",
          options: ["So a later request for a table-level S or X lock can detect the conflict by checking the table alone instead of scanning every row lock", "To escalate to a table lock immediately", "To let other transactions read the locked rows", "Because rows cannot be locked without first locking the whole table exclusively"],
          answer: 0,
          explain: "Intention locks summarise what is held below. IX is compatible with other IS and IX locks, so row writers do not block each other at the table level, but a request for a table S or X lock sees the IX and waits. Without it the engine would have to examine every row lock."
        },
        {
          q: "A web app lets users edit a record for several minutes before saving. Which concurrency approach fits best?",
          options: ["SELECT ... FOR UPDATE when the form opens, released on save", "Optimistic concurrency: store the version read, then UPDATE ... WHERE id = :id AND version = :seen, treating zero rows updated as a conflict", "SERIALIZABLE isolation for the whole editing session", "Lock the table in exclusive mode during the edit"],
          answer: 1,
          explain: "Holding a database lock or transaction open for minutes blocks others and ties up connections. A version check at write time costs nothing while the user thinks, and detects the rare conflicting save so the app can reload or merge."
        }
      ]
    },
    "txn-practice": {
      title: "Concurrency in practice checkpoint",
      sub: "Deadlocks, write-skew fixes, and what real databases default to.",
      questions: [
        {
          q: "With default settings, how long does Postgres wait on a lock before it runs its deadlock check?",
          options: ["0 ms; it checks on every wait", "50 seconds", "Until lock_timeout fires", "About 1 second (deadlock_timeout)"],
          answer: 3,
          explain: "Postgres assumes most waits resolve quickly, so it only builds the waits-for graph after deadlock_timeout, 1 second by default. lock_timeout is disabled by default, and 50 seconds is InnoDB's innodb_lock_wait_timeout."
        },
        {
          q: "Two code paths both update rows A and B and occasionally deadlock. Which change most reliably removes the deadlock?",
          options: ["Raise the lock wait timeout", "Always lock rows in the same global order, for example by primary key", "Switch to READ COMMITTED", "Add more connections to the pool"],
          answer: 1,
          explain: "A deadlock needs a cycle in the waits-for graph, and a cycle needs two transactions acquiring the same resources in opposite orders. A global order makes cycles impossible; timeouts and isolation levels only change how the deadlock is noticed or which locks exist."
        },
        {
          q: "A booking service checks for overlapping bookings and inserts if there are none. Why does adding SELECT ... FOR UPDATE to the check not fix the race?",
          options: ["FOR UPDATE is ignored at READ COMMITTED", "FOR UPDATE blocks every reader of the table", "When no overlapping rows exist there is nothing to lock, so both transactions pass the check", "FOR UPDATE only works on primary-key lookups"],
          answer: 2,
          explain: "Row locks protect rows that exist. The conflict here is about a row that does not exist yet, which is a phantom. Fix it with an exclusion constraint, by materializing the conflict as lockable slot rows, or with SERIALIZABLE."
        },
        {
          q: "What is the default transaction isolation level of MySQL with InnoDB?",
          options: ["REPEATABLE READ", "READ COMMITTED", "SERIALIZABLE", "SNAPSHOT"],
          answer: 0,
          explain: "InnoDB defaults to REPEATABLE READ: plain SELECTs read from a consistent snapshot, while locking reads and writes use next-key locks on the latest version. Postgres, Oracle and SQL Server default to READ COMMITTED."
        },
        {
          q: "Your service runs Postgres at SERIALIZABLE. What must the application do that it could skip at READ COMMITTED?",
          options: ["Nothing; serializable transactions never fail", "Catch SQLSTATE 40001 serialization failures and retry the whole transaction from the start", "Add FOR UPDATE to every SELECT", "Turn off autovacuum on hot tables"],
          answer: 1,
          explain: "SSI resolves conflicts by aborting, so retries are part of the contract. The retry must re-run the reads too, not just the failed statement, because the decision logic depended on them. Deadlocks (40P01) deserve the same handling at any level."
        },
        {
          q: "Inside one explicit Snowflake transaction, two identical SELECTs return different totals. Why?",
          options: ["Snowflake reads uncommitted data from other sessions", "Micro-partition pruning is non-deterministic", "The result cache returned a stale value the first time", "Snowflake tables run at READ COMMITTED: each statement sees data committed before it started, so a commit by another session between the two SELECTs is visible to the second"],
          answer: 3,
          explain: "Snowflake supports only READ COMMITTED for standard tables, with a snapshot per statement rather than per transaction. To compare against a fixed point, query with Time Travel (AT a timestamp or statement) instead of relying on transaction scope."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.txn = {
    id: "txn",
    name: "Transactions & Concurrency",
    short: "TXN",
    tagline: "What really happens when two transactions touch the same data",
    color: "#fb7185",
    blurb: "Go under the ACID acronym. See exactly which anomalies each isolation level allows on paper and in real engines, how two-phase locking, intention locks, lock escalation, optimistic concurrency, MVCC and serializable snapshot isolation work inside Postgres, InnoDB, SQL Server and Snowflake, how deadlocks are found and avoided, and the concrete fixes for write skew and lost updates that interviewers expect you to name.",
    modules: [
      {
        id: "acid",
        name: "ACID & Isolation",
        icon: "shield",
        lessons: [
          {
            id: "acid-unpacked",
            title: "ACID, unpacked into mechanisms",
            summary: "Each letter is a different machine: undo or version visibility, your invariants, concurrency control, and a flushed log.",
            minutes: 9,
            tags: ["acid", "atomicity", "durability", "wal"],
            blocks: [
              { t: "p", html: "Treat ACID as four separate promises built by four separate pieces of the engine. When an interviewer asks <em>how</em> a database guarantees atomicity, the answer is never the word; it is the mechanism. Hold this picture: <strong>atomicity</strong> is about cleaning up after failure, <strong>consistency</strong> is your invariants, <strong>isolation</strong> is about concurrent transactions not seeing each other's mess, and <strong>durability</strong> is a log record that reached stable storage before you said yes." },
              { t: "h", text: "One transfer, four guarantees" },
              { t: "code", lang: "sql", code:
                "BEGIN;\n" +
                "UPDATE accounts SET balance = balance - 100 WHERE id = 1;\n" +
                "UPDATE accounts SET balance = balance + 100 WHERE id = 2;\n" +
                "COMMIT;   -- returns only after the commit record is durable\n\n" +
                "-- Invariant you care about: SUM(balance) is unchanged, no balance < 0" },
              { t: "table", headers: ["Letter", "Promise", "Mechanism in a real engine"], rows: [
                ["Atomicity", "All of the transaction's writes happen, or none do", "Postgres: aborted xid is marked in the commit log, so its tuples are simply invisible. InnoDB: undo log replays before-images to roll back."],
                ["Consistency", "A committed transaction moves data from one valid state to another", "Declared constraints (PK, FK, CHECK, UNIQUE, exclusion) plus your application logic"],
                ["Isolation", "Concurrent transactions behave as if run in some order (to a degree you choose)", "Locks (2PL), multiversion snapshots (MVCC), SSI dependency tracking"],
                ["Durability", "Once COMMIT returns, a crash cannot undo it", "Write-ahead log flushed (fsync) at commit; redo during recovery"]
              ] },
              { t: "h", text: "Durability has a price tag" },
              { t: "p", html: "A commit must wait for the log flush, so commit latency is bounded below by your storage's flush latency: often well under a millisecond on enterprise SSDs with power-loss protection, and several milliseconds on cheaper or networked disks. Engines amortise that with <strong>group commit</strong>: many transactions waiting together share one flush." },
              { t: "stat", items: [
                { v: "1 fsync", k: "per commit group, shared by every waiting transaction" },
                { v: "on", k: "Postgres synchronous_commit default" },
                { v: "1", k: "InnoDB innodb_flush_log_at_trx_commit default (flush every commit)" }
              ] },
              { t: "compare",
                bad: { title: "Relaxed durability", items: ["Postgres synchronous_commit = off, or InnoDB flush setting 2 or 0", "Much higher commit throughput on slow disks", "A crash can lose roughly the last fraction of a second of acknowledged commits", "Data stays consistent: you lose recent transactions, not integrity"] },
                good: { title: "Default durability", items: ["Every acknowledged commit survives a crash", "Commit latency includes a log flush", "Group commit recovers most throughput under concurrency", "The right default for money, orders, anything you would apologise for losing"] } },
              { t: "note", variant: "trap", html: "Consistency is the odd letter out. The engine cannot know that your on-call rota needs at least one doctor unless you encode it. Isolation weaker than serializable can let two individually valid transactions jointly break such an invariant, which is the whole subject of this track." },
              { t: "h", text: "Atomicity is not the same in every engine" },
              { t: "p", html: "Postgres never overwrites a row in place, so rolling back costs almost nothing: the aborted transaction's new tuples stay on disk but every reader ignores them, and VACUUM cleans them later. InnoDB updates rows in place, so a rollback has to apply undo records, and a huge rolled-back transaction can take as long to undo as it took to run." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"what happens if the server crashes right after COMMIT returns\" (durability, WAL flush), \"half the transfer applied\" (atomicity), \"two requests at the same time\" (isolation), \"balance went negative even though we check it\" (consistency broken by weak isolation)." },
              { t: "note", variant: "tip", html: "Out loud, map each letter to a component: \"atomicity comes from undo or version visibility, isolation from the concurrency-control scheme, durability from flushing the WAL before acknowledging the commit; consistency is our invariants, which the other three let us maintain.\"" },
              { t: "note", variant: "key", html: "<strong>ACID is four mechanisms, not one feature.</strong> Name the mechanism behind each letter, remember that durability costs a log flush per commit group, and treat consistency as your job that weak isolation can quietly undermine." }
            ]
          },
          {
            id: "isolation-levels",
            title: "Isolation levels: the standard versus reality",
            summary: "The SQL standard defines levels by forbidden phenomena; real engines implement locks or snapshots and land somewhere else.",
            minutes: 10,
            tags: ["isolation", "sql-standard", "snapshot-isolation"],
            blocks: [
              { t: "p", html: "An isolation level is a contract about which interleavings you are willing to tolerate in exchange for concurrency. The catch: the SQL standard wrote the contract in terms of three phenomena, assuming a lock-based engine, and modern engines are mostly multiversion. So the names on the tin and the behaviour in the box differ, and interviewers love that gap." },
              { t: "h", text: "What the standard says" },
              { t: "table", headers: ["Level", "Dirty read", "Non-repeatable read", "Phantom"], rows: [
                ["READ UNCOMMITTED", "possible", "possible", "possible"],
                ["READ COMMITTED", "prevented", "possible", "possible"],
                ["REPEATABLE READ", "prevented", "prevented", "possible"],
                ["SERIALIZABLE", "prevented", "prevented", "prevented"]
              ] },
              { t: "p", html: "Two problems with this table. First, it is defined by what is forbidden, so an engine can satisfy the letter of REPEATABLE READ and still allow anomalies the table never mentions, like write skew. Second, SERIALIZABLE is defined properly elsewhere in the standard as <em>equivalent to some serial order</em>, which is much stronger than \"none of these three\"." },
              { t: "h", text: "What engines actually do" },
              { t: "table", headers: ["Name you set", "Postgres", "MySQL InnoDB", "Oracle"], rows: [
                ["READ UNCOMMITTED", "Runs as READ COMMITTED", "Truly allows dirty reads", "Not offered"],
                ["READ COMMITTED", "Snapshot per statement", "Snapshot per statement (consistent read)", "Snapshot per statement (default)"],
                ["REPEATABLE READ", "Snapshot isolation; no phantoms on plain reads; first updater wins", "Snapshot for plain reads; writes and locking reads see the latest version with next-key locks (default)", "Not offered"],
                ["SERIALIZABLE", "True serializability via SSI", "Plain SELECTs become locking reads (2PL-like)", "Snapshot isolation, so write skew is possible"]
              ] },
              { t: "note", variant: "warn", html: "<strong>Snapshot isolation is not in the standard's table at all.</strong> It prevents all three listed phenomena, which is why Oracle could historically call it SERIALIZABLE, yet it allows write skew. Postgres before 9.1 did the same; since 9.1 its SERIALIZABLE adds SSI on top." },
              { t: "h", text: "Choosing a level: Naive / Solid / Standout" },
              { t: "table", headers: ["Tier", "Answer", "Why it scores that way"], rows: [
                ["Naive", "\"Use SERIALIZABLE everywhere, it's safest\"", "Ignores retries, abort rates under contention, and that most code was never written to retry"],
                ["Solid", "\"Default READ COMMITTED; use atomic updates, row locks or constraints for the specific invariants that need them\"", "Matches how most production Postgres and Oracle systems run; protects hot spots explicitly"],
                ["Standout", "Names the exact anomaly each code path risks, picks the cheapest fix per path, and runs SERIALIZABLE with a retry wrapper where invariants span rows", "Shows you know levels are a per-transaction tool, not a global setting"]
              ] },
              { t: "code", lang: "sql", code:
                "-- per transaction (Postgres)\n" +
                "BEGIN ISOLATION LEVEL REPEATABLE READ;\n" +
                "-- ... statements ...\n" +
                "COMMIT;\n\n" +
                "-- per session (MySQL)\n" +
                "SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;" },
              { t: "p", html: "The next lesson walks through every anomaly with a script you can step, under each level, using Postgres semantics." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we use REPEATABLE READ so we're safe\" (ask: which engine, and what about write skew?), \"Oracle SERIALIZABLE\" (it is snapshot isolation), \"migrating from MySQL to Postgres and behaviour changed\" (different defaults and different meanings of the same name)." },
              { t: "note", variant: "key", html: "<strong>The level's name is not its behaviour.</strong> The standard forbids three phenomena; engines implement locks or snapshots. Always say which engine, and remember snapshot isolation blocks all three phenomena yet still allows write skew." }
            ]
          },
          {
            id: "anomalies",
            title: "Every anomaly, by name and by example",
            summary: "Dirty write and read, non-repeatable read, read skew, phantom, lost update and write skew, with the interleaving that causes each.",
            minutes: 12,
            tags: ["anomalies", "write-skew", "lost-update", "phantom", "read-skew"],
            blocks: [
              { t: "p", html: "An anomaly is an outcome no serial execution could produce. Learn each one as a tiny two-transaction script: who reads, who writes, in what order. If you can draw the interleaving, you can name the cheapest fix." },
              { t: "table", headers: ["Anomaly", "Interleaving (T1, T2)", "Smallest level that stops it in Postgres"], rows: [
                ["Dirty write", "T1 writes x, T2 overwrites x before T1 ends", "All levels (row write locks)"],
                ["Dirty read", "T2 reads x written by uncommitted T1, T1 aborts", "All levels (READ UNCOMMITTED runs as READ COMMITTED)"],
                ["Non-repeatable read", "T1 reads x, T2 updates x and commits, T1 reads x again", "REPEATABLE READ"],
                ["Read skew", "T1 reads x, T2 updates x and y and commits, T1 reads y", "REPEATABLE READ"],
                ["Phantom", "T1 reads rows matching P, T2 inserts a row matching P and commits, T1 re-reads", "REPEATABLE READ for plain reads; decisions based on P need SERIALIZABLE"],
                ["Lost update", "T1 and T2 read x, both write x computed from the old value", "REPEATABLE READ (second updater aborts)"],
                ["Write skew", "T1 and T2 read an overlapping set, write different rows, invariant breaks", "SERIALIZABLE"]
              ] },
              { t: "h", text: "Read skew: the quiet one" },
              { t: "p", html: "Accounts x and y hold 500 each. T1 reads x = 500. T2 moves 100 from x to y and commits. T1 reads y = 600 and concludes the customer has 1100. No single read was wrong; the <em>combination</em> came from two points in time. Backups, reports and integrity checks are the usual victims, which is why long analytical reads want one snapshot." },
              { t: "h", text: "Lost update versus write skew" },
              { t: "compare",
                bad: { title: "Lost update", items: ["Both transactions write the <strong>same</strong> row", "Classic shape: read, compute in the app, write back", "Snapshot isolation catches it (first updater wins)", "Cheapest fix: <code class='tok'>SET balance = balance + 25</code>"] },
                good: { title: "Write skew", items: ["Each transaction writes a <strong>different</strong> row", "Both based their decision on a read the other invalidated", "Snapshot isolation misses it: no row was written twice", "Fix: lock what you read, materialize the conflict, a constraint, or SERIALIZABLE"] } },
              { t: "widget", id: "txnIsolation" },
              { t: "p", html: "Try write skew under REPEATABLE READ and SERIALIZABLE back to back: identical steps, but SERIALIZABLE aborts the second committer. Then run lost update under READ COMMITTED and REPEATABLE READ to watch first-updater-wins turn a silent overwrite into an error you can retry." },
              { t: "note", variant: "trap", html: "An atomic <code class='tok'>UPDATE ... SET n = n + 1</code> is <em>not</em> lost in Postgres READ COMMITTED: the blocked updater re-reads the newest committed version after the lock is released and applies its increment to that. The lost update needs the read-compute-write round trip through the application." },
              { t: "p", html: "One more for the advanced round: under snapshot isolation even a <strong>read-only</strong> transaction can observe a state no serial order explains, if it reads between two concurrent writers' commits in an unlucky order. SSI handles this too, which is one reason Postgres offers <code class='tok'>SERIALIZABLE READ ONLY DEFERRABLE</code> for long reports that must never abort." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"check then act\" across rows (write skew), \"counter is lower than the number of clicks\" (lost update), \"report totals don't add up\" (read skew), \"two bookings for the same slot\" (phantom-driven write skew)." },
              { t: "quiz", id: "txn-acid" },
              { t: "note", variant: "key", html: "<strong>Name the anomaly by who writes what.</strong> Same row written twice is a lost update, which snapshot isolation catches. Different rows written after overlapping reads is write skew, which only serializability, explicit locks, or constraints catch." }
            ]
          }
        ]
      },
      {
        id: "control",
        name: "Concurrency Control",
        icon: "blocks",
        lessons: [
          {
            id: "two-phase-locking",
            title: "Two-phase locking and its strict variant",
            summary: "Shared and exclusive locks, the growing and shrinking phases, predicate and next-key locks, and what blocking costs.",
            minutes: 10,
            tags: ["2pl", "locking", "next-key-locks", "serializability"],
            blocks: [
              { t: "p", html: "Pessimistic concurrency control assumes conflicts will happen and prevents them up front: before you touch data, you lock it. Two-phase locking (2PL) is the rule that turns ordinary locking into a serializability guarantee." },
              { t: "h", text: "Lock modes" },
              { t: "table", headers: ["Requested \\ Held", "Shared (S)", "Exclusive (X)"], rows: [
                ["Shared (S)", "compatible", "wait"],
                ["Exclusive (X)", "wait", "wait"]
              ] },
              { t: "p", html: "Readers take S, writers take X. Many readers can share a row; a writer excludes everyone. Real engines add intention locks (IS, IX) on tables and pages so a table-level lock request does not have to scan every row lock to detect a conflict." },
              { t: "h", text: "The two phases" },
              { t: "ol", items: [
                "<strong>Growing phase:</strong> the transaction may acquire locks but never releases any.",
                "<strong>Shrinking phase:</strong> once it releases any lock, it may never acquire another.",
                "Theorem: if every transaction obeys this, every schedule is conflict-serializable, ordered by each transaction's lock point (the moment it holds its last new lock)."
              ] },
              { t: "compare",
                bad: { title: "Basic 2PL", items: ["May release write locks before commit", "Others can read data that later rolls back", "Abort of T1 forces abort of everyone who read its writes (cascading aborts)", "Rarely used as-is"] },
                good: { title: "Strict 2PL", items: ["Holds exclusive locks until commit or abort", "No one ever reads uncommitted data", "No cascading aborts; recovery stays simple", "What lock-based engines actually implement (rigorous 2PL holds shared locks to the end too)"] } },
              { t: "h", text: "Phantoms need more than row locks" },
              { t: "p", html: "Locking every row a query returned does not stop someone inserting a <em>new</em> row that matches the query. The textbook answer is a predicate lock on the condition itself, which is expensive to check. Engines approximate it with index-range locks. InnoDB's <strong>next-key lock</strong> locks an index record plus the gap before it, so inserts into a scanned range block until the scanner commits." },
              { t: "code", lang: "sql", code:
                "-- MySQL InnoDB, REPEATABLE READ\n" +
                "BEGIN;\n" +
                "SELECT * FROM bookings WHERE room = 7 AND slot BETWEEN 9 AND 11 FOR UPDATE;\n" +
                "-- next-key locks cover the scanned index range and its gaps;\n" +
                "-- another session's INSERT of (7, 10) now waits until we commit" },
              { t: "stat", items: [
                { v: "readers block writers", k: "and writers block readers under pure 2PL" },
                { v: "deadlocks", k: "are a normal, expected outcome, not a bug" }
              ] },
              { t: "note", variant: "warn", html: "The cost of 2PL is <strong>blocking</strong>. A long report holding shared locks stalls every writer on those rows, and lock waits form cycles. That pain is why most engines moved plain reads to MVCC snapshots and kept locks only for writes and explicit locking reads." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"readers block writers\" (lock-based isolation), \"gap lock\" or \"next-key lock\" (InnoDB phantom protection), \"why do we see deadlocks only at SERIALIZABLE in MySQL\" (plain SELECTs become shared locking reads)." },
              { t: "note", variant: "key", html: "<strong>2PL buys serializability with blocking.</strong> Never acquire after releasing; hold write locks to commit (strict 2PL) to avoid cascading aborts; and remember phantoms need range or next-key locks, not just row locks." }
            ]
          },
          {
            id: "lock-granularity-occ",
            title: "Lock modes, granularity, escalation and optimistic concurrency",
            summary: "Intention locks and the compatibility matrix, row versus page versus table locks, when engines escalate, InnoDB gap locks, and version-column optimistic concurrency.",
            minutes: 11,
            tags: ["locks", "intention-locks", "lock-escalation", "occ", "gap-locks"],
            blocks: [
              { t: "p", html: "Two-phase locking says <em>when</em> to take and release locks. Real engines also have to decide <strong>what</strong> to lock (a row, a page, a whole table) and <strong>in which mode</strong>, while keeping the lock manager cheap enough that millions of locks do not eat the server's memory." },
              { t: "h", text: "Lock modes beyond S and X" },
              { t: "ul", items: [
                "<strong>S</strong> (shared) for reading and <strong>X</strong> (exclusive) for writing, as before.",
                "<strong>U</strong> (update), in SQL Server: taken while searching for rows to modify. Only one transaction can hold U on a row, which avoids the classic deadlock where two readers both try to upgrade S to X.",
                "<strong>Intention locks</strong> on the parent object announce what you hold underneath: <strong>IS</strong> (some rows locked S), <strong>IX</strong> (some rows locked X), <strong>SIX</strong> (whole table read, some rows written)."
              ] },
              { t: "p", html: "Intention locks make <strong>multiple-granularity locking</strong> cheap. A transaction that wants an X lock on the whole table only has to check the table's lock list: if anyone holds IX or IS there, it must wait. Without intention locks it would have to inspect every row lock in the table." },
              { t: "table", headers: ["Held \\ Requested", "IS", "IX", "S", "SIX", "X"], rows: [
                ["IS", "yes", "yes", "yes", "yes", "no"],
                ["IX", "yes", "yes", "no", "no", "no"],
                ["S", "yes", "no", "yes", "no", "no"],
                ["SIX", "yes", "no", "no", "no", "no"],
                ["X", "no", "no", "no", "no", "no"]
              ] },
              { t: "h", text: "Granularity and lock escalation" },
              { t: "p", html: "Fine-grained locks give more concurrency but cost memory and lock-manager time for every row touched. Some engines respond by <strong>escalating</strong>: when one statement accumulates too many row or page locks on a single object, they are traded for one table lock." },
              { t: "table", headers: ["Engine", "Where row locks live", "Escalation"], rows: [
                ["SQL Server", "In-memory lock manager", "Yes: roughly 5,000 locks on one object by one statement triggers an attempt (also under lock-memory pressure); can be limited per table with <code class='tok'>LOCK_ESCALATION</code>"],
                ["Oracle", "In the data block itself (interested transaction list)", "Never; row locks cost no lock-manager memory"],
                ["PostgreSQL", "In the tuple header (<code class='tok'>xmax</code> plus flags); the shared lock table holds table-level and advisory locks", "No for row locks; SSI predicate locks can coarsen from tuple to page to relation"],
                ["MySQL InnoDB", "Lock structures with one bitmap per page", "No; but next-key locks cover ranges, not just rows"]
              ] },
              { t: "note", variant: "warn", html: "Escalation is a classic production surprise in SQL Server: a large UPDATE or DELETE that touches one table suddenly holds a table X lock, and every other session on that table queues behind it. Batch big writes into chunks of a few thousand rows, or index the predicate so fewer rows are locked." },
              { t: "h", text: "InnoDB: record, gap and next-key locks" },
              { t: "p", html: "InnoDB locks <em>index records</em>, not table rows. A <strong>record lock</strong> covers one index entry; a <strong>gap lock</strong> covers the space between two entries so nobody can insert there; a <strong>next-key lock</strong> is both. Under REPEATABLE READ, locking reads and updates take next-key locks on the range they scan, which prevents phantoms but means an unindexed predicate can lock far more than the rows you meant." },
              { t: "code", lang: "sql", code:
                "-- InnoDB, REPEATABLE READ: locks the matching index range AND the gaps\n" +
                "SELECT * FROM bookings\n" +
                " WHERE room_id = 12 AND day BETWEEN '2026-11-01' AND '2026-11-03'\n" +
                "   FOR UPDATE;\n" +
                "-- Another session's INSERT for room 12 on 2026-11-02 now waits.\n" +
                "-- Without an index on (room_id, day) the scan, and the locks, cover far more." },
              { t: "p", html: "Postgres also has eight <strong>table-level</strong> lock modes, from ACCESS SHARE (taken by every SELECT) to ACCESS EXCLUSIVE (taken by most ALTER TABLE forms). The Postgres track covers how a waiting ACCESS EXCLUSIVE request can stall every query behind it." },
              { t: "h", text: "Optimistic concurrency control" },
              { t: "p", html: "Locking is <strong>pessimistic</strong>: it assumes conflicts and prevents them up front. <strong>Optimistic concurrency control (OCC)</strong> assumes conflicts are rare: work without locks, then check at the end that nothing you depended on changed, and retry if it did. Formally it has three phases: read, validate, write." },
              { t: "p", html: "The most common application form is a <strong>version column</strong> (or an updated-at timestamp, or an HTTP ETag) used as compare-and-set:" },
              { t: "code", lang: "sql", code:
                "-- read: remember the version the user saw\n" +
                "SELECT id, title, body, version FROM articles WHERE id = 42;   -- version = 7\n\n" +
                "-- write: succeed only if nobody changed it in between\n" +
                "UPDATE articles\n" +
                "   SET title = :title, body = :body, version = version + 1\n" +
                " WHERE id = 42 AND version = 7;\n" +
                "-- 1 row updated  -> success\n" +
                "-- 0 rows updated -> someone else won: reload, merge or show a conflict" },
              { t: "p", html: "This is the right tool when a user holds an edit form open for minutes: holding a database lock that long is out of the question. Engines use OCC internally too: SQL Server's in-memory OLTP and FoundationDB validate read sets at commit time instead of blocking, and Postgres SSI is optimistic in spirit, aborting at commit when a dangerous pattern appears." },
              { t: "compare",
                bad: { title: "Pessimistic (locks)", items: ["Wins under high contention: waiting beats repeated retries", "Readers or writers may block each other", "Deadlocks are possible and must be detected", "Unsuitable for long user think time"] },
                good: { title: "Optimistic (validate at end)", items: ["Wins when conflicts are rare: no lock overhead", "Never blocks; losers retry", "Throughput collapses into retries under hot-spot contention", "Fits web forms, REST updates with ETags, and caches"] } },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Tier", "Answer to \"two admins edit the same product\"", "Why"], rows: [
                ["Naive", "Last save wins.", "A lost update, accepted without noticing"],
                ["Solid", "Version column; UPDATE ... WHERE version = :seen; zero rows means conflict.", "Correct, lock-free, fits long think time"],
                ["Standout", "Also explains when to switch to SELECT ... FOR UPDATE (short, hot transactions), and how escalation or gap locks change the blast radius of locking writes.", "Chooses by contention and knows engine lock behaviour"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"big delete blocked the whole table\" (escalation), \"insert waits although no row matches\" (gap lock), \"user edits a form for ten minutes\" or \"ETag\" (optimistic), \"two readers deadlocked upgrading\" (update locks)." },
              { t: "note", variant: "key", html: "<strong>Intention locks let coarse and fine locks coexist cheaply; escalation trades many row locks for one table lock (SQL Server does, Postgres, Oracle and InnoDB do not); InnoDB locks index ranges.</strong> Optimistic concurrency validates with a version check at write time and wins when conflicts are rare." }
            ]
          },
          {
            id: "mvcc",
            title: "MVCC: Postgres tuples versus InnoDB undo",
            summary: "Readers see a snapshot of versions instead of waiting; where the old versions live decides your cleanup bill.",
            minutes: 12,
            tags: ["mvcc", "postgres", "innodb", "undo", "vacuum"],
            blocks: [
              { t: "p", html: "Multiversion concurrency control keeps several versions of a row so a reader can see the version that was committed as of its snapshot, while a writer creates the next one. The headline benefit: <strong>readers do not block writers and writers do not block readers</strong>. Writers still block writers on the same row." },
              { t: "h", text: "A snapshot is three things" },
              { t: "ul", items: [
                "<strong>xmin</strong>: every xid below this had finished when the snapshot was taken.",
                "<strong>xmax</strong>: every xid at or above this had not started yet, so is invisible.",
                "<strong>in-progress list</strong>: xids between the two that were still running, also invisible.",
                "A version is visible if its creator is visible (committed and not excluded) and its deleter is not."
              ] },
              { t: "h", text: "Postgres: versions live in the table" },
              { t: "p", html: "Each heap tuple carries <code class='tok'>xmin</code> (inserting xid) and <code class='tok'>xmax</code> (deleting or superseding xid). An UPDATE writes a whole new tuple and stamps the old one's xmax. Old versions sit on the same 8 KB pages as live ones until VACUUM removes those no snapshot can still see." },
              { t: "diagram", id: "mvcc-chain", caption: "A row's version chain: each update creates a new version, and a snapshot picks the one whose creator it can see and whose deleter it cannot." },
              { t: "code", lang: "sql", code:
                "-- Postgres exposes the system columns\n" +
                "SELECT xmin, xmax, ctid, balance FROM accounts WHERE id = 1;\n" +
                "--  xmin | xmax | ctid  | balance\n" +
                "--  1051 |    0 | (0,7) |      95\n" +
                "SELECT txid_current();   -- your own xid (pg_current_xact_id() in 13+)" },
              { t: "widget", id: "txnMvcc" },
              { t: "h", text: "InnoDB: versions live in undo" },
              { t: "p", html: "InnoDB updates the row in place in the clustered index (16 KB pages) and writes the before-image to the <strong>undo log</strong>. Each row has a hidden transaction id and a roll pointer to its previous version in undo. A consistent read compares the row's trx id with its <strong>read view</strong> and walks the undo chain backwards until it finds a version it may see. A background <strong>purge</strong> thread discards undo no read view needs." },
              { t: "table", headers: ["", "Postgres (append in heap)", "InnoDB (in place + undo)"], rows: [
                ["Where old versions live", "Same table pages as live rows", "Undo tablespace, reached by roll pointer"],
                ["Cost of an update", "New tuple; index entries too unless it is a HOT update", "Modify row in place, write undo record"],
                ["Cost of rollback", "Near zero: mark xid aborted", "Apply undo records, proportional to work done"],
                ["Cleanup", "VACUUM removes dead tuples, freezes old xids", "Purge trims undo once read views move on"],
                ["Long-running transaction hurts by", "Table and index bloat; VACUUM cannot reclaim", "Undo history grows; old reads walk long chains"]
              ] },
              { t: "note", variant: "trap", html: "One idle-in-transaction session holding an old snapshot pins cleanup for <em>every</em> table in Postgres, and the bloat it causes does not shrink by itself once the session ends; VACUUM only marks space reusable. Oracle's equivalent symptom is the classic \"snapshot too old\" error when undo needed by a long query has been overwritten." },
              { t: "p", html: "Postgres xids are 32-bit, so old tuples must be <strong>frozen</strong> (marked as visible to everyone) before the counter wraps around about 2 billion transactions later. Autovacuum does this in the background; neglecting it eventually forces the database to stop accepting writes to protect itself." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"table keeps growing though row count is flat\" (dead tuples, blocked VACUUM), \"history list length\" (InnoDB undo backlog), \"long report slows everything\" (old snapshot pinning cleanup), \"why is rollback instant in Postgres\"." },
              { t: "note", variant: "key", html: "<strong>MVCC trades storage and cleanup for non-blocking reads.</strong> Postgres keeps versions in the heap (cheap rollback, VACUUM and bloat); InnoDB keeps them in undo (in-place updates, purge and long chains). Either way, long transactions are what make the bill explode." }
            ]
          },
          {
            id: "ssi",
            title: "Serializable snapshot isolation",
            summary: "Keep snapshots and non-blocking reads, but track rw-antidependencies and abort when a cycle becomes possible.",
            minutes: 11,
            tags: ["ssi", "serializable", "postgres", "rw-antidependency"],
            blocks: [
              { t: "p", html: "Snapshot isolation is fast and almost right; the gap is write skew. Serializable snapshot isolation (SSI) closes the gap without returning to blocking reads: run everything on snapshots as before, watch for a specific dependency pattern, and abort one transaction when it appears. Postgres has used SSI for SERIALIZABLE since 9.1." },
              { t: "h", text: "Dependencies between transactions" },
              { t: "table", headers: ["Edge", "Meaning", "Snapshot isolation handles it?"], rows: [
                ["wr (T1 \u2192 T2)", "T2 reads a version T1 wrote", "Yes: T2 only sees it if T1 committed before T2's snapshot"],
                ["ww (T1 \u2192 T2)", "T2 overwrites T1's version", "Yes: first updater wins, the other aborts"],
                ["rw (T1 \u2192 T2)", "T1 read a version that T2 then superseded; T1 did not see T2's write", "No: this rw-antidependency is invisible to plain SI"]
              ] },
              { t: "p", html: "A history is serializable exactly when its dependency graph has no cycle. Under snapshot isolation, researchers proved every cycle must contain a <strong>dangerous structure</strong>: two consecutive rw-antidependencies <code class='tok'>T1 \u2192 T2 \u2192 T3</code> between concurrent transactions, where T3 commits first (T1 and T3 may be the same transaction, as in write skew). T2 is the <em>pivot</em>." },
              { t: "code", lang: "text", code:
                "Write skew on the on-call rota:\n" +
                "  T1 reads {alice, bob}, writes alice\n" +
                "  T2 reads {alice, bob}, writes bob\n\n" +
                "  T1 --rw--> T2   (T1 read bob, T2 wrote bob)\n" +
                "  T2 --rw--> T1   (T2 read alice, T1 wrote alice)\n\n" +
                "Two consecutive rw edges between concurrent txns: abort one." },
              { t: "h", text: "How Postgres tracks reads" },
              { t: "ul", items: [
                "Reads take <strong>SIREAD locks</strong> (predicate locks) on tuples, pages or whole relations. They never block anyone; they only record who read what.",
                "When a write touches something covered by another transaction's SIREAD lock, the engine records an rw edge.",
                "If a transaction ends up with both an incoming and an outgoing rw edge in the right commit order, one participant fails with SQLSTATE 40001.",
                "To bound memory, many fine-grained SIREAD locks are promoted to page or relation granularity, which creates extra false conflicts."
              ] },
              { t: "compare",
                bad: { title: "Strict 2PL serializable", items: ["Readers and writers block each other", "Deadlocks under contention", "Never aborts for being merely suspicious", "Throughput collapses with long reads"] },
                good: { title: "SSI serializable", items: ["Nobody blocks for reads", "Aborts on dangerous structures, including some false positives", "Long read-only reports can run DEFERRABLE and never abort", "Requires a retry loop in application code"] } },
              { t: "code", lang: "python", code:
                "def run_serializable(conn, work, attempts=5):\n" +
                "    for i in range(attempts):\n" +
                "        try:\n" +
                "            with conn.transaction(isolation='serializable'):\n" +
                "                return work(conn)          # re-run ALL reads and writes\n" +
                "        except SerializationFailure:      # SQLSTATE 40001\n" +
                "            backoff(i)                     # small jittered sleep\n" +
                "    raise TooMuchContention()" },
              { t: "note", variant: "tip", html: "Keep serializable transactions short and declare read-only ones as <code class='tok'>READ ONLY</code>: SSI can then skip some tracking and abort less. For reports, <code class='tok'>SERIALIZABLE READ ONLY DEFERRABLE</code> waits for a safe snapshot and then runs with no risk of serialization failure." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"we need serializable but can't afford blocking reads\" (SSI), \"could not serialize access due to read/write dependencies\" (Postgres SSI abort, retry it), \"invariant across many rows, no single row to lock\"." },
              { t: "quiz", id: "txn-control" },
              { t: "note", variant: "key", html: "<strong>SSI = snapshot isolation + rw-antidependency tracking.</strong> Every anomaly needs two consecutive rw edges between concurrent transactions; abort a participant when you see them. Reads never block, but your code must retry on 40001." }
            ]
          }
        ]
      },
      {
        id: "practice",
        name: "Concurrency in Practice",
        icon: "wrench",
        lessons: [
          {
            id: "deadlocks",
            title: "Deadlocks: graphs, timeouts and lock ordering",
            summary: "How engines find waits-for cycles, pick a victim, and how a consistent lock order prevents cycles in the first place.",
            minutes: 10,
            tags: ["deadlocks", "waits-for-graph", "lock-ordering"],
            blocks: [
              { t: "p", html: "A deadlock is a cycle of transactions each waiting for a lock another one holds. No amount of waiting resolves it; someone must be aborted. Picture the <strong>waits-for graph</strong>: a node per transaction, an arrow from waiter to holder. A cycle in that graph is a deadlock, by definition." },
              { t: "code", lang: "text", code:
                "T1: lock A ............ wants B  (held by T2)  -> waits\n" +
                "T2: ......... lock B .. wants A  (held by T1)  -> waits\n\n" +
                "waits-for:  T1 -> T2 -> T1   cycle: abort one of them" },
              { t: "h", text: "Three ways to deal with it" },
              { t: "table", headers: ["Strategy", "How", "Trade-off"], rows: [
                ["Detection", "Build the waits-for graph, find a cycle, abort a victim", "Exact, but graph checks cost CPU under heavy lock traffic"],
                ["Timeout", "Abort any transaction that waits longer than N", "Cheap and simple; slow to resolve real deadlocks and kills innocent long waiters"],
                ["Prevention", "Never let a cycle form: global lock order, or wait-die / wound-wait by transaction age", "No detection needed; may abort transactions that would never have deadlocked"]
              ] },
              { t: "widget", id: "txnDeadlock" },
              { t: "p", html: "In the lab, compare the ring of three under detection and under timeout: detection aborts one transaction the moment the cycle closes, while the timeout waits several ticks and can abort a second waiter that was merely queued. Then pick a sorted order and watch the deadlock disappear entirely." },
              { t: "h", text: "What real engines do" },
              { t: "table", headers: ["Engine", "Behaviour", "Error you see"], rows: [
                ["Postgres", "Waits deadlock_timeout (1 s default), then checks the graph; usually aborts the transaction whose check found the cycle", "SQLSTATE 40P01 deadlock detected"],
                ["MySQL InnoDB", "Detects cycles immediately on wait (innodb_deadlock_detect, on by default); victim is the transaction with less work to roll back. Separate innodb_lock_wait_timeout of 50 s", "Error 1213 (deadlock), 1205 (lock wait timeout)"],
                ["SQL Server", "Background monitor checks every few seconds, more often when deadlocks are frequent; DEADLOCK_PRIORITY influences the victim", "Error 1205"],
                ["Oracle", "Detects automatically; rolls back the statement that detected it, not the whole transaction", "ORA-00060"]
              ] },
              { t: "note", variant: "warn", html: "Some very high-concurrency InnoDB deployments turn deadlock detection off because the graph check itself becomes the bottleneck when thousands of transactions queue on one hot row, and rely on a short lock wait timeout instead. That is a deliberate trade, not a default." },
              { t: "h", text: "Preventing them in your code" },
              { t: "ul", items: [
                "<strong>Lock in a global order</strong>, for example ascending primary key: <code class='tok'>SELECT ... WHERE id IN (7, 3) ORDER BY id FOR UPDATE</code>.",
                "<strong>Keep transactions short</strong>: no network calls or user think-time while holding locks.",
                "<strong>Lock the parent first</strong> when updating a parent and its children, consistently everywhere.",
                "<strong>Index your foreign keys and predicates</strong> so updates lock a few rows, not a scanned range.",
                "<strong>Retry on 40P01 or 1213</strong>: deadlocks are rare-but-normal events, not exceptions to page someone about."
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"two transfers between the same two accounts in opposite directions\" (classic opposite-order deadlock; lock lower account id first), \"deadlocks appeared after adding a trigger\" (new lock acquired in a different order), \"requests hang for 50 seconds\" (InnoDB lock wait timeout)." },
              { t: "note", variant: "key", html: "<strong>A deadlock is a cycle in the waits-for graph.</strong> Engines detect it (or time out) and abort a victim; you prevent it by acquiring locks in one global order, keeping transactions short, and retrying the victim." }
            ]
          },
          {
            id: "write-skew-patterns",
            title: "Fixing write skew and lost updates",
            summary: "Atomic updates, locking reads, materialized conflicts, constraints, optimistic versions and SERIALIZABLE, and when each one works.",
            minutes: 11,
            tags: ["write-skew", "lost-update", "for-update", "constraints"],
            blocks: [
              { t: "p", html: "Most production systems run at READ COMMITTED, so the real skill is protecting the handful of invariants that matter without raising the level for everything. Start from the anomaly's shape: does the conflict land on <strong>one existing row</strong>, on <strong>several existing rows</strong>, or on a <strong>row that does not exist yet</strong>?" },
              { t: "table", headers: ["Conflict shape", "Example", "Cheapest correct fix"], rows: [
                ["One row, read-modify-write", "Counter, balance, stock level", "Atomic update in SQL, or SELECT ... FOR UPDATE, or a version column"],
                ["Several existing rows", "On-call rota, budget split across rows", "SELECT ... FOR UPDATE on every row the decision read"],
                ["A row that does not exist yet", "Double booking, unique username", "Constraint (UNIQUE, exclusion), or materialize the conflict as lockable rows"],
                ["Complex, many tables", "Multi-entity business rules", "SERIALIZABLE with a retry loop"]
              ] },
              { t: "h", text: "Lost update fixes" },
              { t: "code", lang: "sql", code:
                "-- 1. Let the database compute it (no read in the app)\n" +
                "UPDATE stock SET qty = qty - 1 WHERE sku = 'X1' AND qty > 0;\n\n" +
                "-- 2. Pessimistic: lock the row you are about to change\n" +
                "BEGIN;\n" +
                "SELECT qty FROM stock WHERE sku = 'X1' FOR UPDATE;\n" +
                "UPDATE stock SET qty = 41 WHERE sku = 'X1';\n" +
                "COMMIT;\n\n" +
                "-- 3. Optimistic: compare-and-set on a version column\n" +
                "UPDATE stock SET qty = 41, version = version + 1\n" +
                " WHERE sku = 'X1' AND version = 17;   -- 0 rows updated => retry" },
              { t: "h", text: "Write skew fixes" },
              { t: "code", lang: "sql", code:
                "-- On-call rota: lock every row the check depends on\n" +
                "BEGIN;\n" +
                "SELECT doctor FROM doctors WHERE shift_id = 42 AND on_call FOR UPDATE;\n" +
                "-- the second transaction now waits here, then re-counts after T1 commits\n" +
                "UPDATE doctors SET on_call = false WHERE doctor = 'alice' AND shift_id = 42;\n" +
                "COMMIT;" },
              { t: "note", variant: "trap", html: "<code class='tok'>FOR UPDATE</code> only locks rows that exist. For a booking check that finds <em>no</em> overlapping rows, there is nothing to lock and both transactions sail through. Phantom-shaped conflicts need a constraint, a materialized row, or SERIALIZABLE." },
              { t: "code", lang: "sql", code:
                "-- Postgres: let the engine forbid overlaps outright\n" +
                "CREATE EXTENSION IF NOT EXISTS btree_gist;\n" +
                "ALTER TABLE bookings ADD CONSTRAINT no_overlap\n" +
                "  EXCLUDE USING gist (room WITH =, during WITH &&);\n\n" +
                "-- Materializing the conflict: pre-create one row per (room, slot)\n" +
                "SELECT * FROM room_slots WHERE room = 7 AND slot = '09:00' FOR UPDATE;" },
              { t: "h", text: "Naive / Solid / Standout" },
              { t: "table", headers: ["Tier", "Fix for double booking", "What it misses or adds"], rows: [
                ["Naive", "Check in the app, then insert", "Races at every isolation level below SERIALIZABLE"],
                ["Solid", "SELECT ... FOR UPDATE on materialized slot rows, or a unique index on (room, slot)", "Correct; slot rows add maintenance, unique index only works for fixed slots"],
                ["Standout", "Exclusion constraint for arbitrary ranges, plus a friendly error mapped from the constraint violation; SERIALIZABLE with retries for rules a constraint cannot express", "Invariant enforced by the engine no matter which code path writes"]
              ] },
              { t: "p", html: "Postgres also offers lighter row-lock modes: <code class='tok'>FOR NO KEY UPDATE</code> (what a plain UPDATE takes, so foreign-key checks can proceed), <code class='tok'>FOR SHARE</code> and <code class='tok'>FOR KEY SHARE</code>. And <code class='tok'>SKIP LOCKED</code> turns a table into a work queue where each worker grabs rows nobody else holds." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"check availability then reserve\" (phantom; constraint or materialize), \"decrement inventory\" (atomic update with a guard), \"at least one must remain\" (write skew; lock the rows you counted), \"oversold\" or \"double-booked\"." },
              { t: "note", variant: "key", html: "<strong>Match the fix to the conflict's shape.</strong> One row: atomic update, FOR UPDATE, or a version check. Several existing rows: lock all of them. A row that does not exist yet: a constraint or a materialized lock row. Too complex for any of those: SERIALIZABLE plus retries." }
            ]
          },
          {
            id: "isolation-in-real-dbs",
            title: "Isolation in real databases",
            summary: "Defaults and quirks across Postgres, MySQL, Oracle, SQL Server, Snowflake and distributed SQL, and how to write portable retry-safe code.",
            minutes: 10,
            tags: ["postgres", "mysql", "oracle", "sql-server", "snowflake", "defaults"],
            blocks: [
              { t: "p", html: "The same SQL can behave differently on two engines because both the default level and the meaning of each level differ. Before reasoning about a race, pin down the engine, the level actually in effect, and whether reads are snapshot reads or locking reads." },
              { t: "table", headers: ["Engine", "Default level", "What that default really is"], rows: [
                ["PostgreSQL", "READ COMMITTED", "Per-statement snapshot; blocked writers re-check the newest row version"],
                ["MySQL InnoDB", "REPEATABLE READ", "Snapshot for plain SELECT; UPDATE, DELETE and locking reads act on the latest committed version with next-key locks"],
                ["Oracle", "READ COMMITTED", "Per-statement snapshot from undo; SERIALIZABLE is snapshot isolation (ORA-08177 on conflict)"],
                ["SQL Server", "READ COMMITTED", "Lock-based by default; with READ_COMMITTED_SNAPSHOT on (the default in Azure SQL Database) it reads row versions instead"],
                ["CockroachDB", "SERIALIZABLE", "Serializable by default across nodes; clients must retry on 40001"],
                ["SQLite", "SERIALIZABLE", "One writer at a time, so transactions are effectively serial"]
              ] },
              { t: "h", text: "The MySQL REPEATABLE READ surprise" },
              { t: "p", html: "In InnoDB, a plain SELECT inside a REPEATABLE READ transaction reads the snapshot, but an UPDATE in the same transaction reads and modifies the <em>latest</em> committed version. So a read-modify-write through the app is <strong>not</strong> aborted the way Postgres REPEATABLE READ aborts it: the second writer just waits for the lock and then overwrites. Lost updates remain your problem unless you use atomic updates or <code class='tok'>FOR UPDATE</code>. (MariaDB's recent releases add a setting that makes this case fail instead.)" },
              { t: "compare",
                bad: { title: "Assuming the name means the same thing", items: ["\"We're on REPEATABLE READ, lost updates are impossible\" (true in Postgres, false in MySQL)", "\"Oracle SERIALIZABLE prevents write skew\" (it is snapshot isolation)", "\"READ UNCOMMITTED is faster in Postgres\" (it is identical to READ COMMITTED)"] },
                good: { title: "Reasoning per engine", items: ["Name the engine and the level in effect", "Ask whether each read is a snapshot read or a locking read", "Protect invariants with constraints and explicit locks that behave the same everywhere", "Wrap every transaction in retry logic for 40001 and deadlock errors"] } },
              { t: "h", text: "SQL Server's two worlds" },
              { t: "p", html: "Classic SQL Server READ COMMITTED takes short shared locks, so readers block behind writers. Turning on <code class='tok'>READ_COMMITTED_SNAPSHOT</code> switches the same level to statement-level row versioning in tempdb, and the separate <code class='tok'>SNAPSHOT</code> level gives transaction-level snapshot isolation with update-conflict errors. Many teams flip the first setting to stop reader-writer blocking." },
              { t: "h", text: "Distributed SQL" },
              { t: "p", html: "Spanner offers external consistency (strict serializability) using synchronized clocks with bounded uncertainty; CockroachDB defaults to SERIALIZABLE and newer versions also offer READ COMMITTED. In distributed engines, retries are more frequent because clock uncertainty and contention across nodes both surface as restart errors." },
              { t: "code", lang: "text", code:
                "Errors to treat as 'retry the whole transaction':\n" +
                "  Postgres / CockroachDB  40001 serialization_failure, 40P01 deadlock_detected\n" +
                "  MySQL                   1213 deadlock, 1205 lock wait timeout (configurable)\n" +
                "  Oracle                  ORA-08177 can't serialize, ORA-00060 deadlock\n" +
                "  SQL Server              1205 deadlock victim, 3960 snapshot update conflict" },
              { t: "h", text: "Snowflake and other warehouses" },
              { t: "p", html: "Analytical warehouses keep isolation simple because they optimise for large scans rather than many small conflicting writes. Snowflake supports <strong>READ COMMITTED</strong> for standard tables and nothing else: each statement sees data committed before that statement began, plus the uncommitted changes of its own transaction. Two SELECTs in the same explicit transaction can therefore see different data if another session commits in between." },
              { t: "ul", items: [
                "Storage is immutable micro-partitions, so every committed write produces new table versions; readers never block writers or other readers.",
                "UPDATE, DELETE and MERGE take locks that make concurrent modifications of the same table queue behind each other; plain INSERTs generally do not block one another.",
                "Time Travel exposes earlier versions (<code class='tok'>AT(TIMESTAMP =&gt; ...)</code>, <code class='tok'>BEFORE(STATEMENT =&gt; ...)</code>), which is how you get a repeatable view of the past when you need one.",
                "Long-running explicit transactions can hold those locks; <code class='tok'>LOCK_TIMEOUT</code> and <code class='tok'>SHOW LOCKS</code> help when writes pile up."
              ] },
              { t: "table", headers: ["Question", "Postgres", "MySQL InnoDB", "Snowflake"], rows: [
                ["Default level", "READ COMMITTED", "REPEATABLE READ", "READ COMMITTED (only option)"],
                ["Snapshot scope at default", "Per statement", "Per transaction for plain SELECT", "Per statement"],
                ["Serializable available", "Yes (SSI)", "Yes (locking reads everywhere)", "No"],
                ["Concurrent writers to one table", "Row-level locks", "Row and gap locks", "DML on the same table largely serialised"],
                ["Typical concurrency pain", "Write skew under RC/RR", "Lost updates despite RR; gap-lock waits", "Queued MERGE and UPDATE jobs"]
              ] },
              { t: "note", variant: "tip", html: "In a warehouse, design pipelines so that only one job modifies a given table at a time (or each job owns its own partitions), and make every load idempotent so a retried MERGE does not double-apply." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Level", "What the answer includes"], rows: [
                ["Mid", "Knows defaults (Postgres RC, MySQL RR), can name dirty read, lost update and phantom"],
                ["Senior", "Explains snapshot isolation versus serializable, write skew, FOR UPDATE, and adds retry logic"],
                ["Staff", "Predicts behaviour per engine (MySQL RR lost updates, Oracle SI, SQL Server RCSI), picks constraint-first designs, and sizes retry and contention costs"]
              ] },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"works on Postgres, broke on MySQL\" (different REPEATABLE READ), \"readers block in SQL Server\" (locking RC; consider RCSI), \"we moved to CockroachDB and see retry errors\" (serializable by default)." },
              { t: "quiz", id: "txn-practice" },
              { t: "note", variant: "key", html: "<strong>Defaults: Postgres, Oracle and SQL Server use READ COMMITTED; InnoDB uses REPEATABLE READ; CockroachDB and SQLite are serializable.</strong> The same level name means different things per engine, so enforce critical invariants with constraints and explicit locks, and always retry 40001 and deadlock errors." }
            ]
          }
        ]
      }
    ]
  };
})();
