/* =====================================================================
   KERNEL · Processes & Services
   window.TRACKS.proc — modules: model / services

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
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
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
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
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function roLine(text) { return h("span", { class: "ro", style: "flex-basis:100%;line-height:1.5" }, text); }
  var PRE = "margin:0;padding:12px 14px;border-radius:10px;background:var(--surface-solid);color:var(--text);" +
    "border:1px solid var(--line);font-family:var(--font-mono);font-size:0.8rem;line-height:1.55;white-space:pre-wrap;overflow-x:auto";
  function term(text) { return h("pre", { style: PRE }, text); }
  function label(text) {
    return h("div", { style: "font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-faint);margin:10px 0 4px" }, text);
  }

  var Widgets = {};

  /* ==================================================================
     1. procStates — drive one process through its lifecycle
  ================================================================== */
  var PSTATE = {
    none: { code: "-", name: "not created", desc: "The parent has not forked yet." },
    R: { code: "R", name: "runnable / running", desc: "On a CPU or waiting in the run queue. Counts toward load average." },
    S: { code: "S", name: "interruptible sleep", desc: "Waiting for an event (socket data, a timer, a child). Signals wake it. Most processes spend most of their life here." },
    D: { code: "D", name: "uninterruptible sleep", desc: "Inside the kernel waiting on I/O that cannot be abandoned (disk, NFS). Even SIGKILL waits. Counts toward Linux load average." },
    T: { code: "T", name: "stopped", desc: "Frozen by SIGSTOP or SIGTSTP (Ctrl-Z), or by a debugger. SIGCONT resumes it." },
    Z: { code: "Z", name: "zombie", desc: "Exited. Only its exit status and PID remain until the parent calls wait()." },
    gone: { code: "-", name: "reaped", desc: "The parent collected the status; the PID can be reused." }
  };
  var PEVENTS = [
    { id: "fork", label: "fork()", from: ["none", "gone"], to: "R", note: "The child starts as a copy of the parent and becomes runnable." },
    { id: "sleep", label: "read() on socket", from: ["R"], to: "S", note: "No data yet, so the task blocks in interruptible sleep." },
    { id: "wake", label: "event arrives", from: ["S", "D"], to: "R", note: "The awaited data or I/O completion arrived; back on the run queue." },
    { id: "disk", label: "read() from slow disk", from: ["R"], to: "D", note: "Blocked in the block layer. It ignores signals until the I/O completes." },
    { id: "stop", label: "SIGSTOP / Ctrl-Z", from: ["R", "S"], to: "T", note: "Stopped. A shell lists it as a stopped job." },
    { id: "cont", label: "SIGCONT", from: ["T"], to: "R", note: "Resumed where it left off." },
    { id: "kill", label: "SIGKILL", from: ["R", "S", "T"], to: "Z", note: "Terminated immediately; becomes a zombie until reaped." },
    { id: "exit", label: "exit(0)", from: ["R"], to: "Z", note: "Finished normally; the kernel keeps the exit status for the parent." },
    { id: "reap", label: "parent wait()", from: ["Z"], to: "gone", note: "Status collected. If the parent had died first, init (PID 1) would reap it instead." }
  ];

  Widgets.procStates = function (mount) {
    shell(mount, "state machine", "Walk a process through its states",
      "Fire events at a single process and watch the STAT letter ps would show. Events that are impossible in the current state are refused with the reason.");
    var cur = "none";
    var history = [];
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var controls = h("div", { class: "widget-controls" });

    function paint(msg) {
      var st = PSTATE[cur];
      clear(stage);
      var row = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px" });
      ["R", "S", "D", "T", "Z"].forEach(function (k) {
        var active = k === cur;
        row.appendChild(h("span", {
          style: "padding:8px 12px;border-radius:10px;border:1px solid " + (active ? "var(--accent)" : "var(--line)") +
            ";font-family:var(--font-mono);font-weight:700;" + (active ? "background:var(--accent);color:var(--on-accent)" : "color:var(--text-dim)")
        }, k + " " + PSTATE[k].name));
      });
      stage.appendChild(row);
      stage.appendChild(term("$ ps -o pid,stat,cmd -p 4242\n  PID STAT CMD\n" +
        (cur === "none" || cur === "gone" ? "(no such process)" : " 4242 " + st.code + "    worker --queue=orders" + (cur === "Z" ? " <defunct>" : "")) +
        (history.length ? "\n\n# events: " + history.join(" → ") : "")));
      clear(readout);
      readout.appendChild(ro("state", st.code + " (" + st.name + ")"));
      readout.appendChild(ro("events", history.length));
      readout.appendChild(roLine(msg || st.desc));
    }
    PEVENTS.forEach(function (ev) {
      var b = h("button", { type: "button", class: "w-btn ghost" }, ev.label);
      b.addEventListener("click", function () {
        if (ev.from.indexOf(cur) === -1) {
          var why = cur === "D" && ev.id === "kill" ? "SIGKILL is queued but cannot take effect until the uninterruptible I/O finishes. This is why D-state processes survive kill -9." :
            cur === "Z" ? "A zombie has already exited; signals do nothing. Only the parent's wait() (or the parent dying) removes it." :
            "Not possible from state " + PSTATE[cur].code + " (" + PSTATE[cur].name + ").";
          paint(why);
          return;
        }
        cur = ev.to;
        history.push(ev.label);
        if (history.length > 8) history.shift();
        paint(ev.note + " " + PSTATE[cur].desc);
      });
      controls.appendChild(b);
    });
    var reset = h("button", { type: "button", class: "w-btn" }, "Reset");
    reset.addEventListener("click", function () { cur = "none"; history = []; paint(); });
    controls.appendChild(reset);
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. procSignals — what does this signal do to this process?
  ================================================================== */
  var SIGS = [
    ["HUP", "1 SIGHUP"], ["INT", "2 SIGINT"], ["TERM", "15 SIGTERM"], ["KILL", "9 SIGKILL"], ["STOP", "19 SIGSTOP"], ["USR1", "10 SIGUSR1"]
  ];
  var TARGETS = [
    ["plain", "script, default handlers"],
    ["server", "server with a TERM handler"],
    ["nohup", "started with nohup"],
    ["dstate", "stuck in D state"]
  ];
  function sigOutcome(sig, tgt) {
    if (tgt === "dstate") {
      if (sig === "KILL" || sig === "TERM" || sig === "INT" || sig === "HUP")
        return ["pending", "The signal is marked pending, but the task is inside an uninterruptible kernel wait. Nothing happens until the I/O completes or the device recovers."];
      if (sig === "STOP") return ["pending", "Even stopping waits until the task leaves the uninterruptible section."];
      return ["pending", "Delivered only when the task returns from the kernel."];
    }
    if (sig === "KILL") return ["killed", "Cannot be caught, blocked or ignored. No cleanup handlers run, buffers are not flushed and temp files stay behind. Exit status 137."];
    if (sig === "STOP") return ["stopped", "Cannot be caught. The process freezes (state T) until SIGCONT."];
    if (sig === "HUP") {
      if (tgt === "nohup") return ["ignored", "nohup set SIGHUP to ignored before exec, so closing the terminal does not kill it. Output went to nohup.out."];
      if (tgt === "server") return ["handled", "Many daemons treat HUP as 'reload configuration' (nginx, sshd). The process stays up and re-reads its config."];
      return ["killed", "Default action is terminate. This is what happens to your jobs when an SSH session drops."];
    }
    if (sig === "TERM") {
      if (tgt === "server") return ["handled", "The handler stops accepting connections, finishes in-flight requests and exits cleanly. This is what systemctl stop and container runtimes send first."];
      return ["killed", "Default action is terminate (exit status 143). The polite way to ask, and the default for kill."];
    }
    if (sig === "INT") {
      if (tgt === "server") return ["killed", "Without an INT handler the default action applies: terminate. Some servers treat INT like TERM."];
      return ["killed", "Ctrl-C sends SIGINT to the whole foreground process group. Exit status 130."];
    }
    if (sig === "USR1") {
      if (tgt === "server") return ["handled", "Application-defined. Common uses: reopen log files after rotation, or dump status."];
      return ["killed", "With no handler installed, the default action for SIGUSR1 is terminate. Check before sending it."];
    }
    return ["unknown", "No outcome modelled."];
  }

  Widgets.procSignals = function (mount) {
    shell(mount, "simulator", "Send a signal",
      "Choose a signal and a target process. The panel explains what the kernel and the process do with it.");
    var S = { sig: "TERM", tgt: "plain" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var r = sigOutcome(S.sig, S.tgt);
      clear(stage);
      stage.appendChild(term("$ kill -" + S.sig + " 4242" + (S.sig === "KILL" ? "    # same as kill -9" : "")));
      clear(readout);
      readout.appendChild(ro("signal", "SIG" + S.sig));
      readout.appendChild(ro("outcome", r[0]));
      readout.appendChild(roLine(r[1]));
    }
    mount.appendChild(h("div", { class: "widget-controls" }, segment(SIGS, 2, function (v) { S.sig = v; paint(); })));
    mount.appendChild(h("div", { class: "widget-controls" }, segment(TARGETS, 0, function (v) { S.tgt = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. procCron — read a crontab schedule and list the next runs
  ================================================================== */
  var CRON_FIELDS = [
    { name: "minute", min: 0, max: 59 }, { name: "hour", min: 0, max: 23 },
    { name: "day of month", min: 1, max: 31 }, { name: "month", min: 1, max: 12 },
    { name: "day of week", min: 0, max: 7 }
  ];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function parseField(txt, f) {
    var set = {}, any = txt === "*";
    var parts = txt.split(",");
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], step = 1, m;
      if ((m = /^(.*)\/(\d+)$/.exec(p))) { p = m[1]; step = parseInt(m[2], 10); if (!step) throw new Error("step 0 in " + f.name); }
      var lo, hi;
      if (p === "*") { lo = f.min; hi = f.max; }
      else if ((m = /^(\d+)-(\d+)$/.exec(p))) { lo = +m[1]; hi = +m[2]; }
      else if (/^\d+$/.test(p)) { lo = +p; hi = m === null && step > 1 ? f.max : +p; }
      else throw new Error("cannot read '" + parts[i] + "' in " + f.name);
      if (lo < f.min || hi > f.max || lo > hi) throw new Error(f.name + " must be " + f.min + "-" + f.max);
      for (var v = lo; v <= hi; v += step) set[v === 7 && f.max === 7 ? 0 : v] = true;
    }
    return { set: set, any: any };
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  Widgets.procCron = function (mount) {
    shell(mount, "calculator", "When will this cron job run?",
      "Type the five schedule fields of a crontab line or pick a preset. The panel validates each field and lists the next runs after Wed 28 Oct 2026 09:00.");
    var expr = "*/15 9-17 * * 1-5";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var inp = h("input", { type: "text", "aria-label": "cron expression", spellcheck: "false",
      style: "background:var(--surface-solid);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-family:var(--font-mono);font-size:0.85rem;width:200px" });
    inp.value = expr;
    inp.addEventListener("input", function () { expr = String(inp.value || ""); paint(); });
    function paint() {
      clear(stage); clear(readout);
      try {
        var f = expr.trim().split(/\s+/);
        if (f.length !== 5) throw new Error("expected 5 fields (minute hour day-of-month month day-of-week), got " + (expr.trim() ? f.length : 0));
        var P = [];
        for (var i = 0; i < 5; i++) P.push(parseField(f[i], CRON_FIELDS[i]));
        var lines = [];
        for (var j = 0; j < 5; j++) lines.push(pad2(CRON_FIELDS[j].name) + f[j] + (P[j].any ? "   (every)" : ""));
        stage.appendChild(term(lines.join("\n")));
        var d = new Date(2026, 9, 28, 9, 0, 0), runs = [], guard = 0;
        var domR = !P[2].any, dowR = !P[4].any;
        while (runs.length < 5 && guard++ < 200000) {
          d = new Date(d.getTime() + 60000);
          if (!P[0].set[d.getMinutes()] || !P[1].set[d.getHours()] || !P[3].set[d.getMonth() + 1]) continue;
          var domOk = !!P[2].set[d.getDate()], dowOk = !!P[4].set[d.getDay()];
          var dayOk = domR && dowR ? (domOk || dowOk) : (domOk && dowOk);
          if (!dayOk) continue;
          runs.push(DOW[d.getDay()] + " " + d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()));
        }
        stage.appendChild(term("next runs:\n" + (runs.length ? runs.join("\n") : "(none in the next ~4 months)")));
        readout.appendChild(ro("fields", "valid"));
        readout.appendChild(ro("next", runs[0] || "none"));
        readout.appendChild(roLine(domR && dowR ? "Both day-of-month and day-of-week are restricted, so cron runs when EITHER matches, not both. A common surprise." :
          "Cron uses the daemon's time zone and a minimal environment (short PATH, no profile). Use absolute paths and redirect output to a log."));
      } catch (e) {
        readout.appendChild(ro("fields", "invalid"));
        readout.appendChild(roLine(String(e && e.message ? e.message : "could not parse")));
      }
    }
    function pad2(s) { return (s + ":                ").slice(0, 15); }
    var presets = [["*/15 9-17 * * 1-5", "office hours"], ["0 3 * * *", "nightly 03:00"], ["30 2 1 * *", "monthly"], ["0 0 13 * 5", "13th or Friday"], ["5 4 * * 0", "Sunday 04:05"]];
    mount.appendChild(h("div", { class: "widget-controls" }, h("label", { class: "w-field" }, "schedule", inp)));
    mount.appendChild(h("div", { class: "widget-controls" }, segment(presets, 0, function (v) { expr = v; inp.value = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "proc-model": {
      title: "Process model checkpoint",
      sub: "States, fork and exec, signals, jobs and sessions.",
      questions: [
        {
          q: "`ps` shows a process in state D that ignores `kill -9`. What is happening?",
          options: ["It installed a SIGKILL handler", "It is in uninterruptible sleep inside the kernel, usually waiting on disk or NFS I/O", "It is a zombie", "It belongs to root"],
          answer: 1,
          explain: "SIGKILL cannot be caught, but delivery waits until the task leaves an uninterruptible kernel wait. D state almost always means stuck storage: a failing disk, a hung NFS server or a saturated device. Fix the I/O path; the signal then takes effect."
        },
        {
          q: "After fork(), which statement is true?",
          options: ["The child gets a new copy of the program loaded from disk", "The child is a near-identical copy of the parent, including open file descriptors, and runs the same code", "The child shares the parent's PID", "The parent stops until the child exits"],
          answer: 1,
          explain: "fork duplicates the calling process using copy-on-write memory, and the child inherits descriptors, environment and working directory. Only the return value differs: 0 in the child and the child's PID in the parent. Loading a different program is the job of exec."
        },
        {
          q: "A host shows dozens of `<defunct>` processes with the same parent. What fixes it?",
          options: ["kill -9 each defunct PID", "Fix or restart the parent so it reaps its children; if the parent dies, init adopts and reaps them", "Reboot is the only option", "Increase the PID limit"],
          answer: 1,
          explain: "Zombies have already exited, so signals cannot affect them. They remain until the parent calls wait(). Restarting the parent makes PID 1 adopt the orphans and reap them. Zombies use only a process-table slot, but thousands can exhaust PIDs."
        },
        {
          q: "You started a long job in an SSH session and need to log out without killing it. What works after the fact?",
          options: ["Ctrl-C then rerun with &", "Ctrl-Z, bg, then disown", "kill -HUP the job", "exit twice"],
          answer: 1,
          explain: "Ctrl-Z stops the job, bg resumes it in the background, and disown removes it from the shell's job table so the shell does not send it SIGHUP on exit. Next time, start such work inside tmux or with nohup from the beginning."
        },
        {
          q: "Which signal should you send first to stop a service gracefully?",
          options: ["SIGKILL", "SIGTERM", "SIGSTOP", "SIGSEGV"],
          answer: 1,
          explain: "SIGTERM can be caught, letting the program finish requests, flush data and remove lock files. Send SIGKILL only if it does not exit within a reasonable timeout. systemd and container runtimes follow exactly this TERM, wait, KILL sequence."
        },
        {
          q: "What does exit status 143 from a process usually mean?",
          options: ["It ran out of memory", "It was terminated by SIGTERM (128 + 15)", "The command was not found", "It completed successfully"],
          answer: 1,
          explain: "Shells report death by signal as 128 plus the signal number. 143 is SIGTERM, 137 is SIGKILL and 130 is SIGINT. Seeing 143 after a deploy is normal: the old instance was asked to stop."
        }
      ]
    },
    "proc-services": {
      title: "Services checkpoint",
      sub: "systemd units, journalctl, cron and timers.",
      questions: [
        {
          q: "You edited /etc/systemd/system/api.service. What must you run before restarting the service?",
          options: ["systemctl reload api", "systemctl daemon-reload", "systemctl enable api", "journalctl --rotate"],
          answer: 1,
          explain: "systemd caches parsed unit files. daemon-reload makes it re-read them; without it, a restart uses the old definition and systemctl status warns that the unit changed on disk. reload asks the service itself to reload its own config, which is different."
        },
        {
          q: "What is the recommended way to change one setting of a unit shipped by a package?",
          options: ["Edit the file under /usr/lib/systemd/system directly", "Create a drop-in with systemctl edit api, which writes an override.conf", "Copy the unit into your home directory", "Add the option to /etc/environment"],
          answer: 1,
          explain: "Drop-ins in /etc/systemd/system/api.service.d/ override individual settings and survive package upgrades, which overwrite files under /usr/lib. systemctl edit creates the file and reloads for you. systemctl cat shows the merged result."
        },
        {
          q: "Which command shows only error-level and worse messages from the nginx unit since the current boot?",
          options: ["journalctl -u nginx -b -p err", "journalctl nginx --errors", "journalctl -f -n err", "systemctl status nginx -p err"],
          answer: 0,
          explain: "-u filters by unit, -b limits to the current boot, and -p err includes priorities err, crit, alert and emerg. Add --since and --until to narrow the window, or -o json for machine-readable output."
        },
        {
          q: "A script works in your shell but fails from cron with 'command not found'. Most likely cause?",
          options: ["cron runs as root", "cron uses a minimal environment with a short PATH and no profile", "cron does not support bash", "The script needs a .cron extension"],
          answer: 1,
          explain: "cron starts jobs with a tiny environment, often just /usr/bin:/bin on PATH, and does not read your shell profile. Use absolute paths or set PATH at the top of the crontab, and redirect output to a log so errors are visible."
        },
        {
          q: "What advantage does a systemd timer with `Persistent=true` have over a cron entry?",
          options: ["It runs faster", "If the machine was off at the scheduled time, the job runs once at the next boot", "It does not need a service unit", "It works on macOS"],
          answer: 1,
          explain: "Persistent=true records the last run and catches up missed schedules after downtime. Timers also log to the journal, inherit unit sandboxing and resource limits, and show their next run in systemctl list-timers. macOS uses launchd instead."
        },
        {
          q: "A unit has `Restart=on-failure` but keeps restarting in a tight loop and then stops trying. Why does it stop?",
          options: ["on-failure only restarts once", "The start rate limit (StartLimitBurst within StartLimitIntervalSec) was hit and the unit entered a failed state", "systemd ran out of memory", "Restart only works for timers"],
          answer: 1,
          explain: "systemd limits how many starts are allowed in an interval to stop crash loops consuming the machine. Once the limit is hit the unit is marked failed until reset-failed or the interval passes. Add RestartSec to space retries and fix the root cause shown in the journal."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.proc = {
    id: "proc",
    name: "Processes & Services",
    short: "PROC",
    tagline: "From fork and exec to systemd and cron",
    color: "#fbbf24",
    blurb: "What a process really is, how the shell creates one, the states you see in ps, signals and job control, and then the service layer: systemd units, the journal, and scheduled work with cron and timers, with launchd notes for the Mac.",
    modules: [
      {
        id: "model",
        name: "The process model",
        icon: "cube",
        lessons: [
          {
            id: "process-model",
            title: "What a process is",
            summary: "PIDs, parents, credentials, file descriptors and memory; reading ps and /proc; process states.",
            minutes: 10,
            tags: ["ps", "/proc", "PID"],
            blocks: [
              { t: "p", html: "A <b>process</b> is a running instance of a program: an address space, one or more threads, a set of open file descriptors, credentials (user and group IDs), a current directory, an environment and a parent. The kernel tracks each one by a numeric <b>PID</b>." },
              { t: "code", lang: "bash", code: "ps -eo pid,ppid,user,stat,%cpu,%mem,etime,cmd --sort=-%cpu | head\n#   PID  PPID USER  STAT %CPU %MEM  ELAPSED CMD\n#  2210     1 app   Ssl  88.0  6.1 02:11:09 /usr/bin/java -jar orders.jar\n#   951     1 root  Ss    0.1  0.2 9-03:14 /usr/sbin/sshd -D\n\npstree -p 951    # the tree under sshd: sessions, shells, children" },
              { t: "h", text: "Reading STAT" },
              { t: "table", headers: ["Letter", "Meaning"], rows: [
                ["R", "Running or runnable"],
                ["S", "Interruptible sleep (waiting for an event)"],
                ["D", "Uninterruptible sleep (usually I/O)"],
                ["T", "Stopped (Ctrl-Z, SIGSTOP, debugger)"],
                ["Z", "Zombie: exited, not yet reaped"],
                ["s, l, +, &lt;, N", "Session leader, multithreaded, foreground group, high / low priority"]
              ] },
              { t: "widget", id: "procStates" },
              { t: "h", text: "/proc: the kernel's view" },
              { t: "p", html: "On Linux every process has a directory <code>/proc/&lt;pid&gt;</code>. Tools like <code>ps</code> and <code>top</code> just read it." },
              { t: "code", lang: "bash", code: "cat /proc/2210/status | grep -E 'State|VmRSS|Threads'\nls -l /proc/2210/fd | head        # open descriptors\ncat /proc/2210/cmdline | tr '\\0' ' '; echo\ntr '\\0' '\\n' < /proc/2210/environ | grep ^JAVA   # needs same user or root\nreadlink /proc/2210/cwd           # current directory" },
              { t: "note", variant: "warn", html: "macOS has no <code>/proc</code>. Use <code>ps</code>, <code>lsof -p PID</code> for descriptors and <code>vmmap</code> for memory. BSD <code>ps</code> also wants <code>ps aux</code> or <code>ps -axo pid,ppid,stat,command</code>; GNU-style <code>--sort</code> is missing." },
              { t: "note", variant: "tip", html: "<code>pgrep -fa worker</code> finds processes by their full command line and prints it; <code>pidof nginx</code> finds them by program name." },
              { t: "cue", html: "<b>In the field:</b> <code>ls -l /proc/PID/fd | wc -l</code> against <code>grep 'open files' /proc/PID/limits</code> tells you in seconds whether a \"too many open files\" error is a leak." },
              { t: "h", text: "Reading a process from /proc" },
              { t: "code", lang: "bash", code: "pid=$(pgrep -o nginx)\ncat /proc/$pid/status | grep -E 'State|PPid|Threads|VmRSS'\nls -l /proc/$pid/cwd /proc/$pid/exe\ntr '\\0' ' ' < /proc/$pid/cmdline; echo\nls /proc/$pid/fd | wc -l            # open descriptors\ncat /proc/$pid/limits | grep 'open files'" },
              { t: "note", variant: "tip", html: "macOS has no <code>/proc</code>. Use <code>ps -o pid,ppid,stat,rss,command -p PID</code>, <code>lsof -p PID</code> for descriptors and <code>vmmap PID</code> for memory regions." },
              { t: "note", variant: "key", html: "A process is an address space plus descriptors, credentials and a parent; ps STAT and /proc tell you what it is doing right now." }
            ]
          },
          {
            id: "fork-exec",
            title: "fork, exec, wait: how processes are born",
            summary: "The fork and exec split, what is inherited, wait and exit status, orphans and zombies, and why it matters to the shell.",
            minutes: 9,
            tags: ["fork", "exec", "zombie"],
            blocks: [
              { t: "p", html: "Unix creates processes in two steps. <code>fork()</code> clones the caller; <code>exec()</code> replaces the clone's program with a new one. Splitting them lets the child adjust its environment (redirect descriptors, drop privileges, change directory) between the two calls." },
              { t: "diagram", id: "fork-exec", caption: "The shell forks, the child execs the program, the parent waits; the child stays a zombie until reaped." },
              { t: "h", text: "What survives each step" },
              { t: "table", headers: ["Attribute", "After fork", "After exec"], rows: [
                ["PID", "New for child", "Unchanged"],
                ["Memory", "Copy-on-write copy", "Replaced by the new program"],
                ["Open file descriptors", "Inherited", "Kept, unless marked close-on-exec"],
                ["Environment, cwd, umask", "Inherited", "Kept (exec may pass a new env)"],
                ["Signal handlers", "Inherited", "Reset to default; ignored stays ignored"]
              ] },
              { t: "note", variant: "tip", html: "\"Ignored stays ignored across exec\" is exactly how <code>nohup</code> works: it ignores SIGHUP, then execs your command, which inherits the ignore." },
              { t: "h", text: "wait, orphans and zombies" },
              { t: "ul", items: [
                "When a child exits, the kernel keeps its exit status until the parent calls <code>wait()</code>. Until then it is a <b>zombie</b>.",
                "If the parent dies first, the child is an <b>orphan</b> and is re-parented to PID 1 (or a subreaper), which reaps it.",
                "Zombies cannot be killed: they are already dead. Fix the parent."
              ] },
              { t: "code", lang: "bash", code: "# See it in the shell: a subshell forks, exec replaces\nbash -c 'echo \"child $$\"; exec sleep 60' &\nps -o pid,ppid,stat,cmd -p $!     # same PID now shows sleep\n\n# Find zombies and their parents\nps -eo pid,ppid,stat,cmd | awk '$3 ~ /^Z/'" },
              { t: "note", variant: "trap", html: "In a container, your application often runs as PID 1. It then inherits init's duty to reap orphans and gets no default signal handling for SIGTERM. Use a tiny init (the runtime's <code>--init</code> option) if your program does not handle this." },
              { t: "cue", html: "<b>In the field:</b> <code>exec</code> at the end of a wrapper script (<code>exec java -jar app.jar</code>) replaces the shell so signals reach the real program directly." },
              { t: "h", text: "Watching it happen" },
              { t: "code", lang: "bash", code: "strace -f -e trace=clone,execve,wait4 bash -c 'ls | wc -l'\n# clone(...)                       = 4120   <- child for ls\n# [pid 4120] execve(\"/usr/bin/ls\", ...)\n# clone(...)                       = 4121   <- child for wc\n# [pid 4121] execve(\"/usr/bin/wc\", ...)\n# wait4(-1, ...)                   = 4120   <- parent reaps" },
              { t: "p", html: "Modern Linux implements fork with <code>clone()</code> and copy-on-write pages, so forking a large process is cheap until either side writes to memory. That is also why a forking server can briefly double its apparent memory use under write-heavy load." },
              { t: "note", variant: "tip", html: "On macOS, <code>strace</code> does not exist. <code>dtruss</code> is the closest equivalent but needs System Integrity Protection relaxed. For teaching purposes, run these traces in a Linux VM or container." },
              { t: "note", variant: "key", html: "fork clones, exec replaces, wait reaps; descriptors and ignored signals cross exec, which is how redirection and nohup work." }
            ]
          },
          {
            id: "signals",
            title: "Signals",
            summary: "Default actions, catchable and uncatchable signals, sending them with kill and pkill, and graceful shutdown.",
            minutes: 9,
            tags: ["signals", "kill", "SIGTERM"],
            blocks: [
              { t: "p", html: "A <b>signal</b> is a small asynchronous notification the kernel delivers to a process. Each has a default action (terminate, ignore, stop, or terminate with a core dump), and a program can install a handler for most of them." },
              { t: "table", headers: ["Signal", "Number (Linux x86)", "Default", "Typical use"], rows: [
                ["SIGHUP", "1", "Terminate", "Terminal closed; daemons: reload config"],
                ["SIGINT", "2", "Terminate", "Ctrl-C"],
                ["SIGQUIT", "3", "Core dump", "Ctrl-\\; JVM: thread dump"],
                ["SIGKILL", "9", "Terminate", "Cannot be caught or ignored"],
                ["SIGUSR1", "10", "Terminate", "App-defined: reopen logs"],
                ["SIGTERM", "15", "Terminate", "Polite stop; kill's default"],
                ["SIGSTOP / SIGCONT", "19 / 18", "Stop / continue", "Freeze and resume"],
                ["SIGCHLD", "17", "Ignore", "A child changed state"]
              ] },
              { t: "widget", id: "procSignals" },
              { t: "code", lang: "bash", code: "kill 2210                # SIGTERM\nkill -HUP $(cat /run/nginx.pid)   # reload nginx config\npkill -TERM -f 'worker --queue=old'\nkill -0 2210 && echo alive  # signal 0: existence and permission check only\nkill -l                  # list names and numbers on this system" },
              { t: "note", variant: "warn", html: "Signal numbers differ between systems. On macOS SIGUSR1 is 30 and SIGSTOP is 17. Always use names (<code>kill -USR1</code>) in scripts, never numbers other than 9 and 15." },
              { t: "h", text: "Graceful shutdown" },
              { t: "p", html: "Supervisors stop services in two phases: send SIGTERM, wait a grace period, then send SIGKILL. systemd's default timeout is about 90 seconds; Kubernetes uses 30. Your program should handle TERM by refusing new work, draining what is in flight and exiting." },
              { t: "compare", bad: { title: "Reflex", items: ["kill -9 first", "Lost writes, stale lock files, half-written output", "No chance to deregister from a load balancer"] }, good: { title: "Discipline", items: ["kill (TERM), wait, check", "kill -9 only after the grace period", "Read the logs for why it would not stop"] } },
              { t: "cue", html: "<b>In the field:</b> a Java service that hangs on stop? <code>kill -QUIT PID</code> prints a full thread dump to its stdout without killing it, showing exactly what it is stuck on." },
              { t: "h", text: "Handling signals in your own scripts" },
              { t: "code", lang: "bash", code: "#!/usr/bin/env bash\nset -euo pipefail\nstop=0\ntrap 'stop=1' TERM INT        # finish the current item, then exit\ntrap 'echo reload; load_cfg' HUP\nwhile [ \"$stop\" -eq 0 ]; do\n  work_one_item\ndone\necho \"drained cleanly\"" },
              { t: "table", headers: ["Situation", "Send", "Why"], rows: [
                  ["Ask a daemon to reread config", "<code>kill -HUP</code> or <code>systemctl reload</code>", "Most daemons treat HUP as reload; check the man page first"],
                  ["Polite shutdown", "<code>kill -TERM</code> (the default)", "Lets the program flush, close and clean up"],
                  ["Hung after TERM for its grace period", "<code>kill -KILL</code>", "Cannot be caught, so nothing gets cleaned up"],
                  ["Pause and resume", "<code>kill -STOP</code> / <code>-CONT</code>", "Freezes a runaway job without losing it"]
                ] },
              { t: "note", variant: "tip", html: "macOS uses the same signal names but some numbers differ (for example SIGUSR1 is 30 on macOS and 10 on Linux). Always send by name: <code>kill -USR1 pid</code>, never <code>kill -10</code>." },
              { t: "note", variant: "key", html: "Signals have default actions most programs can override; KILL and STOP cannot be caught, so always try TERM first." }
            ]
          },
          {
            id: "jobs-sessions",
            title: "Jobs, sessions, nohup and tmux",
            summary: "Foreground and background jobs, process groups and SIGHUP, keeping work alive after logout, and tmux basics.",
            minutes: 9,
            tags: ["jobs", "tmux", "nohup"],
            blocks: [
              { t: "p", html: "Your terminal session is a <b>session</b> containing <b>process groups</b>, one per pipeline. One group is in the foreground and receives keyboard signals; the others are background jobs. When the terminal goes away, the kernel sends SIGHUP to the session." },
              { t: "code", lang: "bash", code: "make build           # foreground\n# Ctrl-Z             -> [1]+ Stopped  make build\nbg %1                # continue it in the background\njobs -l              # list jobs with PIDs\nfg %1                # bring it back\n./long-task.sh &     # start in the background directly\nwait                 # wait for all background jobs" },
              { t: "h", text: "Surviving logout" },
              { t: "table", headers: ["Tool", "How it survives", "Can you reattach?"], rows: [
                ["<code>nohup cmd &amp;</code>", "Ignores SIGHUP; output to nohup.out", "No"],
                ["<code>disown</code>", "Removes a running job from the shell's table", "No"],
                ["<code>setsid cmd</code>", "Starts it in a new session with no terminal", "No"],
                ["<code>tmux</code> / <code>screen</code>", "The server process owns the terminal", "Yes"],
                ["<code>systemd-run --user</code>", "Runs as a transient unit", "Logs via journalctl"]
              ] },
              { t: "h", text: "tmux in five keys" },
              { t: "code", lang: "bash", code: "tmux new -s deploy      # new named session\n# Ctrl-b d              -> detach; everything keeps running\ntmux ls                 # list sessions\ntmux attach -t deploy   # come back later, even from another SSH login\n# Ctrl-b c  new window   Ctrl-b %  split   Ctrl-b [  scroll mode" },
              { t: "note", variant: "tip", html: "Start a tmux session <i>before</i> any long migration or upgrade on a remote box. A Wi-Fi drop then costs you nothing." },
              { t: "note", variant: "warn", html: "On systemd hosts, <code>KillUserProcesses=yes</code> in logind.conf kills everything in your session at logout, including nohup jobs and even tmux. Use <code>loginctl enable-linger</code> or a proper service for long-lived work." },
              { t: "cue", html: "<b>In the field:</b> anything that must outlive you for more than a day belongs in a systemd unit or timer, not in a forgotten tmux window." },
              { t: "table", headers: ["Need", "Tool", "Survives logout?"], rows: [
                  ["Background a command for a minute", "<code>cmd &amp;</code>, <code>jobs</code>, <code>fg</code>", "No"],
                  ["Detach an already-running job", "<code>Ctrl-Z</code>, <code>bg</code>, <code>disown -h %1</code>", "Yes, but output is lost"],
                  ["Start something long and walk away", "<code>nohup cmd &gt; out.log 2&gt;&amp;1 &amp;</code>", "Yes"],
                  ["Reattach later and see the screen", "<code>tmux new -s deploy</code> / <code>tmux attach -t deploy</code>", "Yes"],
                  ["It must keep running and restart", "A systemd unit, or <code>systemd-run --user</code>", "Yes, and supervised"]
                ] },
              { t: "note", variant: "warn", html: "With <code>KillUserProcesses=yes</code> in logind, systemd kills everything in your session scope at logout, nohup included. Use <code>loginctl enable-linger</code> or a proper unit for work that must outlive you." },
              { t: "note", variant: "tip", html: "tmux behaves the same on macOS (<code>brew install tmux</code>). macOS has no logind, so the session-scope surprise above is Linux-only." },
              { t: "quiz", id: "proc-model" },
              { t: "note", variant: "key", html: "Closing a terminal sends SIGHUP to its session; use tmux for work you want to reattach to and a service for work that must persist." }
            ]
          }
        ]
      },
      {
        id: "services",
        name: "Services and scheduling",
        icon: "bolt",
        lessons: [
          {
            id: "systemd-units",
            title: "systemd units",
            summary: "Unit types, writing a service file, dependencies and ordering, restart policy, drop-ins and sandboxing.",
            minutes: 11,
            tags: ["systemd", "systemctl", "units"],
            blocks: [
              { t: "p", html: "systemd is PID 1 on most Linux distributions. It starts and supervises everything else from declarative <b>unit files</b>: services, sockets, timers, mounts and targets (groups of units)." },
              { t: "code", lang: "text", code: "# /etc/systemd/system/orders.service\n[Unit]\nDescription=Orders API\nWants=network-online.target\nAfter=network-online.target postgresql.service\n\n[Service]\nType=simple\nUser=orders\nWorkingDirectory=/srv/orders\nEnvironmentFile=/etc/orders/env\nExecStart=/srv/orders/bin/orders --port 8080\nRestart=on-failure\nRestartSec=5\nTimeoutStopSec=30\nNoNewPrivileges=yes\nProtectSystem=strict\nReadWritePaths=/var/lib/orders\n\n[Install]\nWantedBy=multi-user.target" },
              { t: "h", text: "Hardening a unit in a few lines" },
              { t: "code", lang: "ini", code: "[Service]\nUser=orders\nNoNewPrivileges=yes\nProtectSystem=strict\nProtectHome=yes\nReadWritePaths=/var/lib/orders\nPrivateTmp=yes\nMemoryMax=2G\nRestart=on-failure\nRestartSec=2s" },
              { t: "p", html: "<code>systemd-analyze security orders.service</code> scores a unit's exposure and lists which directives would shrink it. Add them one at a time and restart, because over-tight sandboxing shows up as confusing permission errors." },
              { t: "note", variant: "tip", html: "On macOS, launchd plays the init and supervisor role. <code>launchctl print system/com.example.agent</code> is the rough equivalent of <code>systemctl status</code>." },
              { t: "note", variant: "key", html: "<code>After=</code> only orders startup; it does not pull the other unit in. <code>Wants=</code> / <code>Requires=</code> create the dependency. You usually need both." },
              { t: "h", text: "Daily commands" },
              { t: "code", lang: "bash", code: "sudo systemctl daemon-reload            # after editing unit files\nsudo systemctl enable --now orders      # start now and at boot\nsystemctl status orders                 # state, main PID, last log lines\nsudo systemctl restart orders\nsystemctl cat orders                    # the unit plus drop-ins\nsudo systemctl edit orders              # create a drop-in override\nsystemctl list-units --failed\nsystemctl show orders -p MainPID,NRestarts,ActiveState" },
              { t: "table", headers: ["Type=", "systemd considers it started when"], rows: [
                ["simple", "The process has been forked (default)"],
                ["exec", "The binary was executed successfully"],
                ["forking", "The parent exits (legacy daemons); set PIDFile"],
                ["notify", "The service sends READY=1 via sd_notify"],
                ["oneshot", "The command finishes (setup tasks)"]
              ] },
              { t: "note", variant: "tip", html: "Put secrets in a root-only <code>EnvironmentFile</code> or use <code>LoadCredential=</code>, never inline in <code>ExecStart</code>; the command line is visible to every user through <code>ps</code>." },
              { t: "h", text: "Restart policy and crash loops" },
              { t: "p", html: "<code>Restart=on-failure</code> restarts after a non-zero exit or a crash. To protect the host, systemd stops after <code>StartLimitBurst</code> starts within <code>StartLimitIntervalSec</code> (5 in 10 seconds by default) and marks the unit failed. <code>systemctl reset-failed</code> clears it." },
              { t: "note", variant: "warn", html: "macOS has no systemd. Its equivalent is <b>launchd</b> with plist files in <code>~/Library/LaunchAgents</code> or <code>/Library/LaunchDaemons</code>, managed with <code>launchctl bootstrap</code>, <code>bootout</code> and <code>kickstart</code>. Homebrew's <code>brew services</code> wraps it." },
              { t: "cue", html: "<b>In the field:</b> <code>systemd-analyze security orders</code> scores the unit's sandboxing and lists options you could add, such as <code>PrivateTmp</code> and <code>ProtectHome</code>." },
              { t: "note", variant: "key", html: "Describe the service once in a unit; use Wants plus After for dependencies, drop-ins for overrides, and daemon-reload after edits." }
            ]
          },
          {
            id: "journalctl",
            title: "journald and journalctl",
            summary: "Querying logs by unit, boot, priority and time; following and exporting; persistence and disk limits.",
            minutes: 9,
            tags: ["journalctl", "logging"],
            blocks: [
              { t: "p", html: "systemd's <b>journal</b> collects stdout and stderr of every unit, kernel messages and syslog into an indexed binary store. Because each entry carries metadata (unit, PID, priority, boot ID), you can filter precisely instead of grepping files." },
              { t: "code", lang: "bash", code: "journalctl -u orders -f                    # follow one unit\njournalctl -u orders --since '10 min ago'\njournalctl -u orders -b -1                 # previous boot\njournalctl -p err -b                       # errors and worse, this boot\njournalctl -k | grep -i -E 'oom|i/o error' # kernel ring buffer\njournalctl _PID=2210                       # by field\njournalctl -u orders -o json-pretty -n 1   # every field of the last entry\njournalctl --list-boots" },
              { t: "table", headers: ["Priority", "Number", "Example"], rows: [
                ["emerg", "0", "System unusable"],
                ["alert / crit", "1 / 2", "Immediate action needed"],
                ["err", "3", "Request failed"],
                ["warning", "4", "Retrying"],
                ["notice / info", "5 / 6", "Normal events"],
                ["debug", "7", "Verbose diagnostics"]
              ] },
              { t: "note", variant: "tip", html: "<code>-p err</code> means err <i>and everything more severe</i>. Use a range like <code>-p warning..err</code> to exclude the most severe levels." },
              { t: "h", text: "Persistence and disk use" },
              { t: "p", html: "If <code>/var/log/journal</code> exists, logs persist across reboots; otherwise they live in <code>/run</code> and vanish. Cap disk use in <code>/etc/systemd/journald.conf</code> with <code>SystemMaxUse=</code>, and check usage with <code>journalctl --disk-usage</code>." },
              { t: "code", lang: "bash", code: "journalctl --disk-usage\n# Archived and active journals take up 3.9G in the file system.\nsudo journalctl --vacuum-size=500M   # trim archived files now\nsudo journalctl --vacuum-time=14d" },
              { t: "note", variant: "warn", html: "Only users in the <code>systemd-journal</code> or <code>adm</code> group (or root) can read all system logs. Without it you silently see only your own user's entries." },
              { t: "p", html: "On macOS the unified log plays the same role: <code>log show --last 1h --predicate 'process == \"sshd\"'</code> and <code>log stream</code> for a live view." },
              { t: "cue", html: "<b>In the field:</b> after an unexpected reboot, <code>journalctl -b -1 -n 100</code> shows the last hundred lines before the crash, often naming the cause." },
              { t: "h", text: "Keeping the journal healthy" },
              { t: "code", lang: "bash", code: "journalctl --disk-usage\nsudo journalctl --vacuum-size=500M      # trim archived files now\nsudo journalctl --vacuum-time=14d\n# persistent limits: /etc/systemd/journald.conf\n#   Storage=persistent\n#   SystemMaxUse=1G\n#   RateLimitIntervalSec=30s  RateLimitBurst=10000\njournalctl -u nginx -o json-pretty -n 1   # every field, including _PID and _SYSTEMD_UNIT" },
              { t: "note", variant: "warn", html: "If <code>/var/log/journal</code> does not exist and <code>Storage=auto</code> is set, the journal lives in <code>/run</code> and disappears at reboot. That is exactly when you wanted the logs from before the crash." },
              { t: "note", variant: "tip", html: "macOS has no journald. Its equivalent is the unified log: <code>log show --last 1h --predicate 'process == \"sshd\"'</code> and <code>log stream</code> for live output." },
              { t: "note", variant: "key", html: "Filter the journal by unit, boot, priority and time instead of grepping; make it persistent and cap its size." }
            ]
          },
          {
            id: "cron-timers",
            title: "cron and systemd timers",
            summary: "Crontab syntax, the cron environment, logging and overlap, systemd timers, and launchd on macOS.",
            minutes: 10,
            tags: ["cron", "timers", "launchd"],
            blocks: [
              { t: "p", html: "Scheduled work is where silent failures hide: nobody is watching when it runs. Choose the scheduler deliberately and make every job log and alert." },
              { t: "code", lang: "text", code: "# crontab -e   (fields: minute hour day-of-month month day-of-week command)\nSHELL=/bin/bash\nPATH=/usr/local/bin:/usr/bin:/bin\nMAILTO=\"\"\n\n*/15 9-17 * * 1-5  /usr/local/bin/sync-catalog >> /var/log/sync.log 2>&1\n0 3 * * *          flock -n /run/lock/backup.lock /usr/local/bin/backup.sh\n@reboot            /usr/local/bin/warm-cache" },
              { t: "widget", id: "procCron" },
              { t: "h", text: "cron gotchas" },
              { t: "ul", items: [
                "Minimal environment: short PATH, no profile, no aliases. Use absolute paths.",
                "<code>%</code> is special in a crontab line (newline); escape it as <code>\\%</code> in <code>date +\\%F</code>.",
                "Output is mailed or discarded; redirect to a log.",
                "If both day-of-month and day-of-week are restricted, either match triggers a run.",
                "Long jobs can overlap the next run; guard with <code>flock</code>."
              ] },
              { t: "h", text: "systemd timers" },
              { t: "code", lang: "text", code: "# /etc/systemd/system/backup.timer\n[Timer]\nOnCalendar=*-*-* 03:00:00\nRandomizedDelaySec=15m\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n\n# backup.service runs the job (Type=oneshot)\n# systemctl enable --now backup.timer ; systemctl list-timers" },
              { t: "compare", bad: { title: "cron", items: ["Output mailed or lost", "Missed runs are skipped while the host is down", "No built-in overlap control or resource limits"] }, good: { title: "systemd timer", items: ["Logs in the journal per run", "Persistent=true catches up after downtime", "Only one instance runs; unit limits and sandboxing apply"] } },
              { t: "note", variant: "warn", html: "On macOS cron still exists but needs Full Disk Access for many paths; the native scheduler is launchd's <code>StartCalendarInterval</code> in a plist. launchd also runs a missed job once when the Mac wakes." },
              { t: "note", variant: "tip", html: "Test the schedule with <code>systemd-analyze calendar 'Mon..Fri 09..17:00/15'</code>, which prints the next elapse time." },
              { t: "cue", html: "<b>In the field:</b> add a dead-man's-switch: the job pings a monitoring endpoint when it succeeds, and you alert when the ping stops arriving." },
              { t: "h", text: "Debugging a job that never ran" },
              { t: "ol", items: [
                  "Is the scheduler looking at it? <code>systemctl list-timers --all</code>, or <code>crontab -l</code> for the right user.",
                  "Did it start? <code>journalctl -u backup.service</code> or <code>grep CRON /var/log/syslog</code>.",
                  "Did it fail because of the environment? cron runs with a tiny <code>PATH</code> and no login profile: use absolute paths.",
                  "Is <code>%</code> unescaped in the crontab line? cron turns it into a newline."
                ] },
              { t: "compare", bad: { title: "cron habits that bite", items: ["Relative paths and a bare PATH", "Output mailed to nobody, so errors vanish", "Two overlapping runs of a slow job"] }, good: { title: "Safer", items: ["Absolute paths, or set PATH at the top of the crontab", "Log to the journal: systemd-cat -t backup /usr/local/bin/backup", "flock -n /run/backup.lock /usr/local/bin/backup"] } },
              { t: "note", variant: "tip", html: "macOS has cron, but launchd is the native scheduler: a plist in <code>~/Library/LaunchAgents</code> with <code>StartCalendarInterval</code>, loaded with <code>launchctl bootstrap gui/$UID file.plist</code>." },
              { t: "quiz", id: "proc-services" },
              { t: "note", variant: "key", html: "Schedule with cron for simple jobs and timers for anything that needs logs, catch-up or limits; always log, lock and alert." }
            ]
          }
        ]
      }
    ]
  };
})();
