/* =====================================================================
   KERNEL · Performance & Troubleshooting
   window.TRACKS.perf — modules: observe / trace / incidents

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

  function slider(lbl, min, max, step, val, unit, onChange) {
    var out = h("b", { style: "font-family:var(--font-mono);color:var(--accent-ink);min-width:64px;text-align:right" }, val + unit);
    var inp = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(val), "aria-label": lbl, style: "flex:1" });
    inp.addEventListener("input", function () {
      var n = parseFloat(inp.value);
      if (isNaN(n)) n = min;
      out.textContent = n + unit;
      onChange(n);
    });
    return { el: h("label", { class: "w-field", style: "display:flex;gap:8px;align-items:center" }, h("span", { style: "min-width:150px" }, lbl), inp, out), set: function (n) { inp.value = String(n); out.textContent = n + unit; } };
  }
  function grid2() { return h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px 18px;margin-bottom:12px" }); }

  /* ==================================================================
     1. perfLoad — what makes up a load average?
  ================================================================== */
  Widgets.perfLoad = function (mount) {
    shell(mount, "simulator", "Decompose a load average",
      "Set the core count, the tasks wanting CPU and the tasks blocked on I/O. The panel shows what uptime, vmstat and top would report and how to read it.");
    var S = { cores: 8, run: 6, dstate: 0 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var g = grid2();
    var sc = slider("CPU cores", 1, 64, 1, S.cores, "", function (n) { S.cores = n; paint(); });
    var sr = slider("runnable tasks (R)", 0, 64, 1, S.run, "", function (n) { S.run = n; paint(); });
    var sd = slider("blocked on I/O (D)", 0, 64, 1, S.dstate, "", function (n) { S.dstate = n; paint(); });
    g.appendChild(sc.el); g.appendChild(sr.el); g.appendChild(sd.el);
    function paint() {
      try {
        var load = S.run + S.dstate;
        var busy = Math.min(S.run, S.cores);
        var us = Math.round(busy / S.cores * 100);
        var wa = S.dstate > 0 ? Math.min(100 - us, Math.round(Math.min(S.dstate, S.cores - busy) / S.cores * 100)) : 0;
        var idle = Math.max(0, 100 - us - wa);
        var queue = Math.max(0, S.run - S.cores);
        clear(stage);
        stage.appendChild(term(
          "$ uptime\n 09:30:01 up 12 days,  3 users,  load average: " + load.toFixed(2) + ", " + load.toFixed(2) + ", " + load.toFixed(2) + "\n\n" +
          "$ vmstat 1 2\nprocs -----------cpu-----------\n r  b  us sy id wa st\n" +
          (" " + S.run).slice(-2) + " " + (" " + S.dstate).slice(-2) + " " + (" " + Math.round(us * 0.85)).slice(-2) + " " + (" " + Math.round(us * 0.15)).slice(-2) + " " + (" " + idle).slice(-2) + " " + (" " + wa).slice(-2) + "  0"));
        var per = load / S.cores;
        clear(readout);
        readout.appendChild(ro("load", load.toFixed(2)));
        readout.appendChild(ro("per core", per.toFixed(2)));
        readout.appendChild(ro("waiting for a CPU", queue));
        var verdict;
        if (S.dstate >= S.run && S.dstate > 0 && per >= 1) verdict = "High load with idle CPUs: it is I/O, not computation. Look at iostat -xz (await, aqu-sz) and for processes in D state (ps -eo stat,pid,cmd | grep ^D).";
        else if (queue > 0) verdict = "CPU saturation: " + queue + " task(s) wait in the run queue, adding latency. Find the top consumers (top, pidstat 1) or add cores.";
        else if (per < 0.7) verdict = "Comfortable: there is spare CPU. Load below the core count means no queueing.";
        else verdict = "Busy but not queueing. Watch the trend across the 1, 5 and 15 minute values.";
        readout.appendChild(roLine(verdict + " On macOS, load average counts only runnable threads, not disk waits."));
      } catch (e) { clear(readout); readout.appendChild(roLine("Could not compute load for these values.")); }
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      h("button", { type: "button", class: "w-btn ghost", onclick: function () { S.cores = 8; S.run = 20; S.dstate = 0; sc.set(8); sr.set(20); sd.set(0); paint(); } }, "Preset: CPU bound"),
      h("button", { type: "button", class: "w-btn ghost", onclick: function () { S.cores = 8; S.run = 1; S.dstate = 23; sc.set(8); sr.set(1); sd.set(23); paint(); } }, "Preset: NFS hang"),
      h("button", { type: "button", class: "w-btn ghost", onclick: function () { S.cores = 32; S.run = 12; S.dstate = 0; sc.set(32); sr.set(12); sd.set(0); paint(); } }, "Preset: big box, fine")));
    mount.appendChild(g);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. perfFree — page cache, available memory and the OOM cliff
  ================================================================== */
  Widgets.perfFree = function (mount) {
    shell(mount, "simulator", "Read free -m correctly",
      "Grow the application's memory and watch the kernel reclaim page cache first, then swap, then invoke the OOM killer. Numbers are in MiB on a 16 GiB host.");
    var TOTAL = 16000, KERNEL = 600;
    var S = { app: 5000, files: 8000, swap: 2048 };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var g = grid2();
    g.appendChild(slider("app memory (anon)", 500, 20000, 250, S.app, " MiB", function (n) { S.app = n; paint(); }).el);
    g.appendChild(slider("recently read files", 0, 12000, 250, S.files, " MiB", function (n) { S.files = n; paint(); }).el);
    g.appendChild(slider("swap size", 0, 8192, 512, S.swap, " MiB", function (n) { S.swap = n; paint(); }).el);
    function bar(parts) {
      var b = h("div", { style: "display:flex;height:22px;border-radius:8px;overflow:hidden;margin-top:12px;border:1px solid var(--line);background:var(--surface-solid)" });
      parts.forEach(function (p) { if (p[1] > 0) b.appendChild(h("i", { title: p[0], style: "display:block;height:100%;width:" + (p[1] / TOTAL * 100).toFixed(2) + "%;background:" + p[2] })); });
      return b;
    }
    function paint() {
      try {
        var room = TOTAL - KERNEL;
        var appRam = Math.min(S.app, room);
        var over = Math.max(0, S.app - room);
        var swapUsed = Math.min(over, S.swap);
        var oom = over > S.swap;
        var cache = Math.max(0, Math.min(S.files, room - appRam - 200));
        var used = KERNEL + appRam;
        var free = Math.max(0, TOTAL - used - cache);
        var avail = Math.max(0, free + Math.round(cache * 0.9));
        clear(stage);
        stage.appendChild(term("$ free -m\n               total        used        free      shared  buff/cache   available\n" +
          "Mem:   " + pad(TOTAL) + pad(used) + pad(free) + pad(120) + pad(cache) + pad(avail) + "\n" +
          "Swap:  " + pad(S.swap) + pad(swapUsed) + pad(S.swap - swapUsed) +
          (oom ? "\n\n$ dmesg -T | tail -2\n[Wed Oct 28 09:41:07 2026] Out of memory: Killed process 2210 (java) total-vm:21GB, anon-rss:15.2GB\n[Wed Oct 28 09:41:07 2026] oom_reaper: reaped process 2210 (java)" : "")));
        stage.appendChild(bar([["kernel", KERNEL, "var(--text-faint)"], ["app", appRam, "var(--rose-ink)"], ["page cache", cache, "var(--cyan-ink)"], ["free", free, "var(--lime-ink)"]]));
        stage.appendChild(h("div", { style: "display:flex;gap:14px;flex-wrap:wrap;margin-top:6px;font-size:0.78rem;color:var(--text-dim)" },
          h("span", {}, "■ kernel"), h("span", { style: "color:var(--rose-ink)" }, "■ application"), h("span", { style: "color:var(--cyan-ink)" }, "■ page cache"), h("span", { style: "color:var(--lime-ink)" }, "■ free")));
        clear(readout);
        readout.appendChild(ro("free", free + " MiB"));
        readout.appendChild(ro("available", avail + " MiB"));
        readout.appendChild(ro("swap used", swapUsed + " MiB"));
        readout.appendChild(roLine(oom ? "RAM and swap are exhausted: the OOM killer picked the process with the highest oom_score and sent SIGKILL (exit 137)." :
          swapUsed > 0 ? "The app no longer fits in RAM, so pages are being swapped. Expect latency spikes long before any OOM kill; watch si/so in vmstat." :
          free < 500 && avail > 2000 ? "'free' is tiny but 'available' is healthy: the kernel is using spare RAM as page cache and will hand it back on demand. This is normal." :
          "Plenty of headroom. Alert on 'available' (or PSI memory pressure), not on 'free'."));
      } catch (e) { clear(readout); readout.appendChild(roLine("Could not compute memory for these values.")); }
    }
    function pad(n) { return ("            " + n).slice(-12); }
    mount.appendChild(g);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. perfUse — run the USE checklist on a symptom
  ================================================================== */
  var USE_CASES = {
    cpu: { label: "slow API, high CPU", cells: {
      "CPU|U": ["98% us+sy", true], "CPU|S": ["run queue 19 on 8 cores", true], "CPU|E": ["none", false],
      "Memory|U": ["61% used", false], "Memory|S": ["no swapping, PSI some 0.0", false], "Memory|E": ["none", false],
      "Disk|U": ["%util 4", false], "Disk|S": ["aqu-sz 0.1", false], "Disk|E": ["none", false],
      "Network|U": ["120 Mbit/s of 10G", false], "Network|S": ["no drops", false], "Network|E": ["none", false] },
      verdict: "CPU is utilised and saturated. Profile it: perf top, or pidstat 1 to find the process, then a flame graph." },
    disk: { label: "timeouts, idle CPU", cells: {
      "CPU|U": ["12% us, 40% wa", false], "CPU|S": ["r 1, b 14", false], "CPU|E": ["none", false],
      "Memory|U": ["55% used", false], "Memory|S": ["none", false], "Memory|E": ["none", false],
      "Disk|U": ["%util 100 on nvme1n1", true], "Disk|S": ["aqu-sz 48, r_await 180 ms", true], "Disk|E": ["none", false],
      "Network|U": ["low", false], "Network|S": ["none", false], "Network|E": ["none", false] },
      verdict: "The data disk is saturated: deep queue and high await. Find who is doing I/O with iotop or pidstat -d, and check for a backup or compaction job." },
    mem: { label: "random restarts", cells: {
      "CPU|U": ["35%", false], "CPU|S": ["none", false], "CPU|E": ["none", false],
      "Memory|U": ["available 180 MiB of 16 GiB", true], "Memory|S": ["si/so 900 pages/s, PSI full 22%", true], "Memory|E": ["oom-kill events in dmesg", true],
      "Disk|U": ["%util 70 (swap device)", false], "Disk|S": ["moderate", false], "Disk|E": ["none", false],
      "Network|U": ["low", false], "Network|S": ["none", false], "Network|E": ["none", false] },
      verdict: "Memory is exhausted: swapping and OOM kills. Find the growing process (ps --sort=-rss), check for a leak, and right-size limits." },
    net: { label: "intermittent errors", cells: {
      "CPU|U": ["30%", false], "CPU|S": ["none", false], "CPU|E": ["none", false],
      "Memory|U": ["50%", false], "Memory|S": ["none", false], "Memory|E": ["none", false],
      "Disk|U": ["low", false], "Disk|S": ["none", false], "Disk|E": ["none", false],
      "Network|U": ["940 Mbit/s on a 1G NIC", true], "Network|S": ["TCP retransmits 3%, ring drops", true], "Network|E": ["rx_crc_errors rising", true] },
      verdict: "The NIC is saturated and showing errors: a bad cable or port plus a link that is too small. Check ip -s link, ethtool -S, and nstat for retransmits." }
  };
  var RES = ["CPU", "Memory", "Disk", "Network"];
  var USE_CMDS = { CPU: "mpstat -P ALL 1 · vmstat 1 (r)", Memory: "free -m · vmstat (si/so) · dmesg | grep -i oom", Disk: "iostat -xz 1 · df -h", Network: "ip -s link · ss -s · nstat" };

  Widgets.perfUse = function (mount) {
    shell(mount, "checklist", "Apply the USE method",
      "Pick a symptom. For each resource the grid lists Utilization, Saturation and Errors as the standard tools would show them; flagged cells point at the bottleneck.");
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var pairs = [];
    for (var k in USE_CASES) if (Object.prototype.hasOwnProperty.call(USE_CASES, k)) pairs.push([k, USE_CASES[k].label]);
    function paint(id) {
      try {
        var c = USE_CASES[id] || USE_CASES.cpu;
        clear(stage);
        var tbl = h("div", { style: "display:grid;grid-template-columns:110px repeat(3,minmax(120px,1fr));gap:6px;font-size:0.8rem" });
        ["resource", "Utilization", "Saturation", "Errors"].forEach(function (t) { tbl.appendChild(h("b", { style: "color:var(--text-dim)" }, t)); });
        var flagged = 0;
        RES.forEach(function (r) {
          tbl.appendChild(h("span", { style: "color:var(--text);font-weight:700", title: USE_CMDS[r] }, r));
          ["U", "S", "E"].forEach(function (m) {
            var cell = c.cells[r + "|" + m] || ["n/a", false];
            if (cell[1]) flagged++;
            tbl.appendChild(h("span", { style: "padding:6px 8px;border-radius:8px;border:1px solid " + (cell[1] ? "var(--rose-ink)" : "var(--line)") + ";color:" + (cell[1] ? "var(--rose-ink)" : "var(--text-dim)") + ";background:var(--surface-solid)" }, (cell[1] ? "⚑ " : "") + cell[0]));
          });
        });
        stage.appendChild(tbl);
        stage.appendChild(term(RES.map(function (r) { return r + ": " + USE_CMDS[r]; }).join("\n")));
        clear(readout);
        readout.appendChild(ro("flagged cells", flagged + " / 12"));
        readout.appendChild(roLine(c.verdict));
      } catch (e) { clear(readout); readout.appendChild(roLine("Could not render this case.")); }
    }
    mount.appendChild(h("div", { class: "widget-controls" }, segment(pairs, 0, paint)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint("cpu");
  };

  /* ==================================================================
     4. perfIncident — triage drill: investigate, then choose a fix
  ================================================================== */
  var INCIDENTS = {
    disk: {
      title: "Alert: / is 100% full on web1",
      cmds: [
        ["df -h /", "Filesystem      Size  Used Avail Use% Mounted on\n/dev/nvme0n1p1   50G   50G     0 100% /"],
        ["sudo du -xh --max-depth=1 / | sort -h | tail -3", "1.9G  /usr\n3.1G  /var\n5.2G  /"],
        ["sudo lsof +L1", "COMMAND  PID USER FD  TYPE SIZE/OFF NLINK NODE NAME\njava    2210 app  7w  REG     44G     0 1311 /var/log/app/app.log (deleted)"]
      ],
      fixes: [
        ["Delete more files under /var/log", false, "du already shows /var is small. The space is held by a deleted file that is still open."],
        ["Truncate via /proc/2210/fd/7, then fix logrotate (copytruncate or a reopen signal)", true, "Correct: the space returns immediately and the app keeps running. Then make rotation signal the app to reopen its log."],
        ["Reboot the server", false, "It would free the space, but with an outage and without explaining the cause; it will happen again."]
      ]
    },
    oom: {
      title: "Service orders restarts every few hours",
      cmds: [
        ["systemctl status orders", "Active: active (running) since 09:41:09; 2min ago\nProcess: 2210 ExecStart=... (code=killed, signal=KILL)"],
        ["journalctl -k -b | grep -i oom | tail -2", "Out of memory: Killed process 2210 (java) anon-rss:15.2GB\noom_reaper: reaped process 2210 (java)"],
        ["ps -o pid,rss,cmd -C java", "  PID   RSS CMD\n 2290 9.8G java -Xmx14g -jar orders.jar"]
      ],
      fixes: [
        ["Disable the OOM killer with vm.overcommit_memory=2 and move on", false, "Allocations would then fail inside random processes instead. The process still needs more memory than the host has."],
        ["Size the heap to fit the host (e.g. -Xmx10g plus headroom), and investigate growth with a heap dump", true, "Correct: -Xmx14g on a 16 GiB host leaves no room for the JVM's non-heap memory and the OS. Right-size, then confirm whether it leaks."],
        ["Add a cron job that restarts the service hourly", false, "That hides the symptom and still kills in-flight requests."]
      ]
    },
    zombie: {
      title: "PID count climbing: thousands of <defunct> processes",
      cmds: [
        ["ps -eo stat | grep -c ^Z", "4817"],
        ["ps -eo pid,ppid,stat,cmd | awk '$3 ~ /^Z/' | head -3", " 9011  3120 Z    [convert] <defunct>\n 9012  3120 Z    [convert] <defunct>\n 9013  3120 Z    [convert] <defunct>"],
        ["ps -o pid,cmd -p 3120", "  PID CMD\n 3120 /usr/bin/python3 thumbnailer.py"]
      ],
      fixes: [
        ["kill -9 every zombie PID", false, "Zombies are already dead; signals do nothing to them."],
        ["Restart thumbnailer.py and fix it to wait() on its children", true, "Correct: when the parent exits, PID 1 adopts and reaps the zombies. The code must reap children (subprocess wait, or SIGCHLD handling)."],
        ["Raise kernel.pid_max", false, "This buys time but the leak continues."]
      ]
    },
    cpu: {
      title: "Laptop fan screaming, build is slow",
      cmds: [
        ["top -o cpu   (macOS)  or  top   (Linux, press P)", "  PID COMMAND      %CPU\n 7714 node         398.2\n  611 mds_stores    12.0"],
        ["ps -o pid,ppid,etime,command -p 7714", "  PID  PPID  ELAPSED COMMAND\n 7714     1 03:12:44 node watch-assets.js --poll"],
        ["lsof -p 7714 | wc -l", "    23104"]
      ],
      fixes: [
        ["kill -9 7714 immediately", false, "It works, but try SIGTERM first so the watcher can clean up; and you still need to know why it ran away."],
        ["kill 7714 (TERM), then fix the watcher: polling a huge tree with no ignore list", true, "Correct: an orphaned watcher (parent 1) polling node_modules burns all cores. Stop it gracefully and exclude large directories."],
        ["renice it to 19 and leave it", false, "Lower priority helps other work, but it still burns energy and its output is useless."]
      ]
    }
  };

  Widgets.perfIncident = function (mount) {
    shell(mount, "drill", "Incident triage drill",
      "Pick an incident, run the investigation commands in order, then choose the fix. You score a point for a correct fix chosen after at least two observations.");
    var cur = "disk", seen = 0, score = 0, attempts = 0;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var cmdBar = h("div", { class: "widget-controls" });
    var fixBar = h("div", { class: "widget-controls" });
    var log = [];
    function load(id) {
      cur = id; seen = 0; log = ["# " + INCIDENTS[id].title];
      clear(cmdBar); clear(fixBar);
      INCIDENTS[id].cmds.forEach(function (c, i) {
        cmdBar.appendChild(h("button", { type: "button", class: "w-btn ghost", onclick: function () {
          log.push("$ " + c[0] + "\n" + c[1]);
          seen = Math.max(seen, i + 1);
          paint("Observation " + (i + 1) + " recorded.");
        } }, "run: " + c[0].split(" ")[0] + (c[0].indexOf("|") > -1 ? " …" : " " + (c[0].split(" ")[1] || ""))));
      });
      INCIDENTS[id].fixes.forEach(function (f) {
        fixBar.appendChild(h("button", { type: "button", class: "w-btn", onclick: function () {
          attempts++;
          if (f[1] && seen >= 2) score++;
          paint((f[1] ? "✔ " : "✘ ") + f[2] + (f[1] && seen < 2 ? " (Right answer, but gather evidence first next time.)" : ""));
        } }, f[0]));
      });
      paint("Run the commands to gather evidence.");
    }
    function paint(msg) {
      clear(stage);
      stage.appendChild(term(log.join("\n\n")));
      clear(readout);
      readout.appendChild(ro("observations", seen + " / 3"));
      readout.appendChild(ro("score", score + " / " + attempts));
      readout.appendChild(roLine(msg));
    }
    mount.appendChild(h("div", { class: "widget-controls" }, segment([["disk", "disk full"], ["oom", "OOM kills"], ["zombie", "zombies"], ["cpu", "runaway CPU"]], 0, load)));
    mount.appendChild(cmdBar);
    mount.appendChild(stage);
    mount.appendChild(h("div", { style: "font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-faint);margin:10px 0 4px" }, "choose a fix"));
    mount.appendChild(fixBar);
    mount.appendChild(readout);
    load("disk");
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "perf-observe": {
      title: "Observing a system checkpoint",
      sub: "Load average, CPU, memory and disk I/O.",
      questions: [
        {
          q: "A 16-core Linux server shows load average 30 but `top` reports 85% idle. What is the most likely explanation?",
          options: ["top is broken", "Many tasks are in uninterruptible sleep (D state) waiting on I/O, which Linux counts in load", "The server has hyper-threading disabled", "Load average is measured in percent"],
          answer: 1,
          explain: "Linux load includes tasks in uninterruptible sleep, typically blocked on disk or NFS. So high load with idle CPUs points at storage, not computation. Check vmstat's b column, iostat await and ps for D-state processes."
        },
        {
          q: "`free -m` shows 300 MiB free and 9 GiB available on a 16 GiB host. Should you worry?",
          options: ["Yes, the host is about to run out of memory", "No: most RAM is page cache that the kernel reclaims on demand; available is the figure that matters", "Yes, add swap immediately", "Only if swap is zero"],
          answer: 1,
          explain: "Linux deliberately fills spare RAM with cached file data. available estimates what applications can still get without swapping, and 9 GiB is plenty. Alert on low available memory or on memory pressure (PSI), not on low free."
        },
        {
          q: "In `iostat -xz 1`, which pair best indicates a saturated disk?",
          options: ["High r/s and low %util", "High aqu-sz (queue size) and high r_await / w_await", "Low rkB/s", "High %idle"],
          answer: 1,
          explain: "A long queue with rising latency per request means the device cannot keep up. %util near 100 is a hint, but on SSDs and RAID arrays that process requests in parallel it can read 100 well before true saturation. Latency and queue depth are the better signals."
        },
        {
          q: "On a VM, `top` shows %st (steal) at 25%. What does it mean?",
          options: ["Another process is stealing your CPU", "The hypervisor gave the physical CPU to other guests 25% of the time your vCPU wanted to run", "Memory is being swapped", "The CPU is throttled by temperature"],
          answer: 1,
          explain: "Steal time is time your virtual CPU was ready to run but the host was busy with other tenants. Your code cannot fix it. Move to a larger or dedicated instance, or a less contended host."
        },
        {
          q: "Which tool on macOS gives you the closest equivalent to Linux `vmstat` memory statistics?",
          options: ["free", "vm_stat", "iostat -m", "sar"],
          answer: 1,
          explain: "macOS has no free command; vm_stat prints page counts for free, active, inactive, wired and compressed memory, and memory_pressure summarises the state. Activity Monitor's Memory Pressure graph shows the same idea visually."
        }
      ]
    },
    "perf-trace": {
      title: "Tracing and profiling checkpoint",
      sub: "The USE method, strace, lsof and perf.",
      questions: [
        {
          q: "What does the USE method ask you to check for every resource?",
          options: ["Users, Services, Events", "Utilization, Saturation, Errors", "Uptime, Swap, Entropy", "Usage, Speed, Efficiency"],
          answer: 1,
          explain: "For each resource (CPU, memory, disk, network, and software resources like locks or thread pools), check how busy it is, how much work is queued for it, and whether it reports errors. It is a quick, complete checklist that avoids tunnel vision."
        },
        {
          q: "A process seems stuck. `strace -p PID` shows it repeatedly blocked in `futex(...)`. What does that suggest?",
          options: ["It is waiting on disk I/O", "Its threads are waiting on a lock or condition variable held by another thread", "It is out of memory", "It is sending network packets"],
          answer: 1,
          explain: "futex is the kernel primitive behind user-space locks and condition variables. A thread parked in futex is waiting for another thread to release or signal. Look at all threads with strace -f, or take a thread dump with the language's own tooling."
        },
        {
          q: "Why is running `strace` against a busy production process risky?",
          options: ["It modifies the program's code", "ptrace stops the process at every syscall, which can slow it dramatically", "It requires a reboot", "It disables logging"],
          answer: 1,
          explain: "strace relies on ptrace, which context-switches into the tracer for each system call. A syscall-heavy server can slow by an order of magnitude. Prefer strace -c for a short summary, filter with -e, or use eBPF-based tools or perf trace with much lower overhead."
        },
        {
          q: "Which command shows which process is listening on port 8080 on both Linux and macOS?",
          options: ["netstat -tlnp", "lsof -nP -iTCP:8080 -sTCP:LISTEN", "ss -tlnp", "fuser 8080"],
          answer: 1,
          explain: "lsof works on both systems and the -nP flags skip DNS and port-name lookups. ss -tlnp is the fast Linux tool but does not exist on macOS, and netstat's -p flag means something different on BSD."
        },
        {
          q: "In a CPU flame graph, what does a wide plateau at the top of a tower mean?",
          options: ["That function was called first", "That function itself was on-CPU in a large share of the samples", "That function uses the most memory", "The stack trace was truncated"],
          answer: 1,
          explain: "Width is the proportion of samples containing that frame, and the top edge is the code actually running. A wide top frame is where CPU time is spent. The x-axis is sorted alphabetically, so left to right does not mean time order."
        }
      ]
    },
    "perf-incidents": {
      title: "Incident triage checkpoint",
      sub: "Disk full, OOM kills, zombies and runaway processes.",
      questions: [
        {
          q: "A daemon's log was deleted to free space, yet df still shows the disk full. What frees the space without losing the daemon?",
          options: ["Run sync", "Truncate the open file through /proc/PID/fd/N or make the daemon reopen its logs", "Delete the parent directory", "Run fsck while mounted"],
          answer: 1,
          explain: "The inode is still referenced by the daemon's open descriptor. Truncating it through /proc empties it in place, and a reopen signal (often SIGHUP or USR1) makes the daemon start a new file. Restarting the daemon also works but causes a blip."
        },
        {
          q: "A container exits with code 137 and its status says OOMKilled. What does it tell you?",
          options: ["The application threw an exception", "The kernel killed it with SIGKILL because the container's cgroup reached its memory limit", "The disk is full", "The container image is corrupt"],
          answer: 1,
          explain: "137 is 128 plus 9, and the OOMKilled flag confirms the memory cgroup limit was hit. The kernel kills a process inside the cgroup even if the host has free memory. Compare memory.max with the process's real footprint, including non-heap memory."
        },
        {
          q: "Which statement about zombie processes is correct?",
          options: ["They consume CPU", "They hold memory until killed with -9", "They are exited processes waiting for their parent to collect the status; only the parent (or its death) clears them", "They are processes stuck in D state"],
          answer: 2,
          explain: "A zombie has released its memory and other resources and keeps only a process-table entry with its exit status. It cannot be signalled. Fixing or restarting the parent lets PID 1 reap the orphans."
        },
        {
          q: "During an incident, what should you do before restarting the misbehaving service?",
          options: ["Nothing; restart first, ask later", "Capture evidence quickly: status, recent logs, top or ps output, and a thread or heap dump if relevant", "Reboot the host", "Disable monitoring to reduce noise"],
          answer: 1,
          explain: "A restart destroys the state that explains the failure. Spending a minute on systemctl status, journalctl, ps and a dump usually preserves the root cause. Mitigate fast, but take the snapshot first when you safely can."
        },
        {
          q: "/var keeps filling with journal files. What is the durable fix?",
          options: ["rm -rf /var/log/journal weekly", "Set SystemMaxUse= in journald.conf and restart systemd-journald", "Disable logging", "Move /var to tmpfs"],
          answer: 1,
          explain: "journald honours size and age limits in its configuration, and the vacuum options trim existing files. Setting a limit keeps logs useful while capping disk use. Deleting active journal files by hand can corrupt them and loses evidence."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.perf = {
    id: "perf",
    name: "Performance & Troubleshooting",
    short: "PERF",
    tagline: "Measure first, then fix the right thing",
    color: "#f97316",
    blurb: "Read load average, CPU, memory and disk metrics correctly; apply the USE method; trace processes with strace, lsof and perf; and work the classic incidents (full disks, OOM kills, zombies and runaway processes) from first alert to durable fix.",
    modules: [
      {
        id: "observe",
        name: "Observing a system",
        icon: "trend",
        lessons: [
          {
            id: "load-average",
            title: "Load average, decoded",
            summary: "What load average counts on Linux and macOS, how to compare it with cores, and how to read the 1, 5 and 15 minute trend.",
            minutes: 9,
            tags: ["load average", "uptime", "vmstat"],
            blocks: [
              { t: "p", html: "<code>uptime</code> prints three numbers: the 1, 5 and 15 minute load averages. On Linux each is an exponentially damped average of tasks that are <b>runnable</b> (on a CPU or waiting for one) <b>plus</b> tasks in <b>uninterruptible sleep</b>, usually waiting for disk." },
              { t: "code", lang: "bash", code: "uptime\n#  09:30:01 up 12 days,  3 users,  load average: 11.92, 6.40, 3.15\nnproc          # 8 cores on this host\ncat /proc/loadavg\n# 11.92 6.40 3.15 14/1302 88123   (running/total tasks, last PID)" },
              { t: "widget", id: "perfLoad" },
              { t: "h", text: "Reading it" },
              { t: "ul", items: [
                "Compare with the number of CPUs: a load of 8 on 8 cores is fully busy with no queue; 16 means tasks wait.",
                "Read the trend: 11.9, 6.4, 3.2 is <b>rising</b> fast; 3.2, 6.4, 11.9 is recovering.",
                "High load with idle CPU means I/O (D state), not computation.",
                "Load says nothing about which process; follow up with <code>vmstat 1</code> (r and b columns) and <code>top</code>."
              ] },
              { t: "table", headers: ["Host (cores)", "Load 1 / 5 / 15", "vmstat r / b", "Reading"], rows: [
                ["web (8)", "7.8 / 7.5 / 7.1", "8 / 0", "Busy but steady; no queue. Watch, do not page."],
                ["batch (4)", "15.9 / 9.1 / 4.0", "16 / 0", "CPU queue building fast: 4x oversubscribed and rising."],
                ["db (8)", "30.1 / 28.4 / 19.0", "1 / 29", "CPUs idle, 29 tasks blocked on I/O: a disk problem."],
                ["nfs client (4)", "60.0 / 60.0 / 60.0", "0 / 60", "Flat and huge: tasks stuck on a dead NFS mount, not real work."]
              ] },
              { t: "note", variant: "warn", html: "macOS (and other BSDs) count only runnable threads, not disk waits, so the same workload shows different numbers. Never compare load averages across operating systems." },
              { t: "h", text: "Pressure stall information" },
              { t: "p", html: "Modern Linux kernels expose <b>PSI</b> in <code>/proc/pressure/cpu</code>, <code>memory</code> and <code>io</code>: the percentage of time tasks were stalled waiting for that resource. It is a far more direct answer to \"is this host short of X?\" than load." },
              { t: "code", lang: "bash", code: "cat /proc/pressure/io\n# some avg10=34.12 avg60=20.55 avg300=8.01 total=982341234\n# full avg10=21.07 avg60=12.90 avg300=4.70 total=551234890" },
              { t: "cue", html: "<b>In the field:</b> alert on load divided by core count staying above about 1.5 for several minutes, or on PSI, rather than on a fixed load number that means different things on different machines." },
              { t: "note", variant: "key", html: "Linux load = runnable + uninterruptible tasks; divide by cores, read the trend, and confirm with vmstat or PSI." }
            ]
          },
          {
            id: "cpu-memory",
            title: "CPU and memory",
            summary: "CPU time categories in top and mpstat, per-core hot spots, steal; RSS versus virtual memory, page cache, swap and memory pressure.",
            minutes: 11,
            tags: ["top", "free", "swap"],
            blocks: [
              { t: "p", html: "CPU time is split into categories, and the split tells you what kind of work is happening. Memory is subtler: Linux uses every spare byte for caching, so \"almost no free memory\" is the normal, healthy state." },
              { t: "table", headers: ["CPU field", "Meaning", "High value suggests"], rows: [
                ["us", "User-space code", "Application work; profile it"],
                ["sy", "Kernel on behalf of processes", "Many syscalls, context switches, networking"],
                ["wa", "Idle while I/O is outstanding", "Storage latency (a hint, not proof)"],
                ["st", "Stolen by the hypervisor", "Noisy neighbours, undersized VM"],
                ["si / hi", "Interrupt handling", "Very high packet rates"]
              ] },
              { t: "code", lang: "bash", code: "mpstat -P ALL 1 3      # per core: one core at 100% = single-threaded bottleneck\npidstat -u 1 5         # per process CPU over time\ntop -H -p 2210         # threads of one process\nps -eo pid,rss,vsz,cmd --sort=-rss | head    # biggest resident memory" },
              { t: "h", text: "Memory, honestly" },
              { t: "widget", id: "perfFree" },
              { t: "ul", items: [
                "<b>RSS</b>: resident pages a process uses now (shared libraries counted in each). <b>VSZ</b>: mapped address space, often huge and mostly irrelevant.",
                "<b>buff/cache</b>: page cache, reclaimable. <b>available</b>: what new allocations can get without swapping.",
                "<b>Swap</b> activity (vmstat <code>si</code>/<code>so</code> non-zero) hurts latency; some swap used but idle is fine.",
                "<code>/proc/meminfo</code> holds the detail; <code>smem</code> or <code>/proc/PID/smaps_rollup</code> give fairer per-process numbers (PSS)."
              ] },
              { t: "note", variant: "tip", html: "On macOS, <code>top -o mem</code>, <code>vm_stat</code> and <code>memory_pressure</code> replace free. macOS compresses memory before swapping, so a large \"compressed\" figure is the first sign of pressure." },
              { t: "note", variant: "trap", html: "A JVM, Node or Go process's heap limit is not its memory footprint. Thread stacks, metaspace, native buffers and the runtime itself add more, which is why setting the heap to the full container limit leads to OOM kills." },
              { t: "cue", html: "<b>In the field:</b> if one core sits at 100% while the others idle, adding cores will not help: the workload is single-threaded, or one interrupt queue is pinned to that core." },
              { t: "h", text: "Which process, and is it really memory pressure?" },
              { t: "code", lang: "bash", code: "ps -eo pid,comm,%cpu,rss --sort=-rss | head        # biggest resident sets\npidstat -u -r 1 5                                 # per-process CPU and memory over time\ncat /proc/pressure/memory                          # PSI: time stalled waiting for memory\n# some avg10=0.00 ... full avg10=0.00  <- near zero means no real pressure\nvmstat 1 5                                         # si/so > 0 = swapping now" },
              { t: "note", variant: "tip", html: "macOS reports memory differently. Use <code>vm_stat</code>, <code>memory_pressure</code> and Activity Monitor's pressure graph. Compressed memory is normal there, and \"free\" is always low by design." },
              { t: "note", variant: "key", html: "Split CPU time to learn what kind of work it is; judge memory by available and swap activity, never by free." }
            ]
          },
          {
            id: "disk-io",
            title: "Disk I/O",
            summary: "iostat columns that matter, latency versus throughput, finding the process doing I/O, and filesystem-level checks.",
            minutes: 9,
            tags: ["iostat", "iotop", "latency"],
            blocks: [
              { t: "p", html: "Storage problems show up as latency: requests waiting longer for the disk. Throughput (MB/s) and IOPS tell you how much work is done; <b>await</b> and <b>queue size</b> tell you whether the device keeps up." },
              { t: "code", lang: "bash", code: "iostat -xz 1\n# Device   r/s   w/s  rkB/s  wkB/s r_await w_await aqu-sz %util\n# nvme0n1  12.0  40.0  480.0 2100.0   0.21    0.40   0.02   2.1\n# nvme1n1 910.0  15.0 116k    90.0  180.40    3.10  48.00 100.0" },
              { t: "table", headers: ["Column", "Meaning", "Worry when"], rows: [
                ["r/s, w/s", "Requests per second", "Compared against the device's rated IOPS"],
                ["rkB/s, wkB/s", "Throughput", "Near the device or volume limit"],
                ["r_await, w_await", "Average ms per request, including queueing", "Well above the device's normal (SSD: under 1 ms; cloud volumes: a few ms)"],
                ["aqu-sz", "Average queue length", "Persistently above the device's parallelism"],
                ["%util", "Time the device was busy", "Misleading on SSD/RAID; trust await and queue"]
              ] },
              { t: "h", text: "Who is doing the I/O?" },
              { t: "code", lang: "bash", code: "sudo iotop -oPa          # accumulated I/O per process, only active ones\npidstat -d 1             # read/write kB/s per process\nps -eo stat,pid,cmd | awk '$1 ~ /^D/'   # tasks stuck waiting on I/O\ncat /proc/2210/io        # one process's I/O counters" },
              { t: "note", variant: "warn", html: "Cloud block volumes often have a burst budget. When credits run out, IOPS drop to the baseline and await rises sharply, with no change in your workload. Check the provider's volume metrics." },
              { t: "note", variant: "tip", html: "Writes are usually absorbed by the page cache and flushed later; a sudden flush (<code>Dirty</code> and <code>Writeback</code> in /proc/meminfo) can stall writers. fsync-heavy databases feel write latency directly." },
              { t: "p", html: "On macOS, <code>iostat -w 1</code> gives per-disk throughput, and <code>sudo fs_usage -f diskio</code> shows which process is touching which file in real time." },
              { t: "cue", html: "<b>In the field:</b> a database that becomes slow every night at the same time is often sharing a disk with a backup or log-compression job. Correlate iostat spikes with cron and timer schedules." },
              { t: "note", variant: "tip", html: "macOS has no <code>iostat -x</code> extended statistics or <code>iotop</code>. Use <code>iostat -w 1</code> for throughput, <code>sudo fs_usage -f diskio</code> to see which process touches which file, and Activity Monitor's Disk tab." },
              { t: "quiz", id: "perf-observe" },
              { t: "note", variant: "key", html: "Judge disks by latency and queue depth, find the process with iotop or pidstat -d, and remember burst budgets on cloud volumes." }
            ]
          }
        ]
      },
      {
        id: "trace",
        name: "Method and tracing",
        icon: "wrench",
        lessons: [
          {
            id: "use-method",
            title: "The USE method",
            summary: "A complete, fast checklist: utilization, saturation and errors for every resource, with the commands for each.",
            minutes: 9,
            tags: ["USE method", "methodology"],
            blocks: [
              { t: "p", html: "Under pressure, people run the tools they know and stop at the first odd number. The <b>USE method</b> replaces that with a checklist: for every resource, check <b>U</b>tilization (how busy), <b>S</b>aturation (how much work is queued) and <b>E</b>rrors." },
              { t: "widget", id: "perfUse" },
              { t: "table", headers: ["Resource", "Utilization", "Saturation", "Errors"], rows: [
                ["CPU", "mpstat %usr+%sys per core", "vmstat r > cores; PSI cpu", "Machine-check events in dmesg"],
                ["Memory", "free: used vs available", "vmstat si/so; PSI memory; OOM kills", "EDAC / ECC errors"],
                ["Disk", "iostat %util", "iostat aqu-sz, await; PSI io", "dmesg I/O errors, SMART"],
                ["Network", "ip -s link, sar -n DEV vs link speed", "Drops, ss send queues, retransmits", "ip -s link errors, ethtool -S"],
                ["Software", "Thread pool busy, connection pool in use", "Request queue length", "Rejected or timed-out requests"]
              ] },
              { t: "note", variant: "tip", html: "Saturation is usually the most telling: a resource can be 70% utilised and fine, or 70% utilised with a queue because the work is bursty." },
              { t: "h", text: "A 60-second pass" },
              { t: "code", lang: "bash", code: "uptime; dmesg -T | tail -5\nvmstat 1 5\nmpstat -P ALL 1 2\npidstat 1 2\niostat -xz 1 2\nfree -m\nsar -n DEV,TCP,ETCP 1 2     # throughput, connections, retransmits\ntop -b -n 1 | head -20" },
              { t: "h", text: "Worked example: p99 latency tripled" },
              { t: "ol", items: [
                "<b>CPU</b>: mpstat shows 35% busy, vmstat r = 3 on 16 cores. Utilization moderate, no saturation. Move on.",
                "<b>Memory</b>: available 9 GiB, si/so zero, no OOM lines in <code>journalctl -k</code>. Move on.",
                "<b>Disk</b>: r_await 0.3 ms, aqu-sz 0.1. Move on.",
                "<b>Network</b>: <code>nstat -az TcpRetransSegs</code> climbing by about 400/s; <code>ip -s link</code> shows RX drops on eth0. Saturation and errors found.",
                "Drill in: <code>ethtool -S eth0 | grep -i drop</code> shows rx ring overflows. Fix: larger ring (<code>ethtool -G</code>) or spread interrupts across cores, then re-check retransmits."
              ] },
              { t: "p", html: "The checklist found it in a few minutes without anyone guessing. It also documents what you ruled out, which is half of a good incident write-up." },
              { t: "note", variant: "tip", html: "On macOS the same checklist works with different tools: <code>top -l 1</code> and <code>powermetrics</code> for CPU, <code>vm_stat</code> and <code>memory_pressure</code> for memory, <code>iostat -w 1</code> for disk, <code>netstat -s</code> and <code>nettop</code> for network." },
              { t: "note", variant: "trap", html: "Do not forget software resources. A thread pool of 10 handling slow upstream calls saturates while CPU, memory, disk and network all look idle." },
              { t: "cue", html: "<b>In the field:</b> write the checklist for your own stack, with the exact commands and normal values, before the incident. Under stress, nobody remembers which column of iostat matters." },
              { t: "note", variant: "key", html: "For every resource, hardware and software, check utilization, saturation and errors before you start guessing." }
            ]
          },
          {
            id: "strace-lsof",
            title: "strace and lsof",
            summary: "Seeing a process's system calls and open files: hung processes, missing files, permission errors, and macOS alternatives.",
            minutes: 10,
            tags: ["strace", "lsof", "syscalls"],
            blocks: [
              { t: "p", html: "Every interaction a program has with the outside world (files, sockets, processes, time) goes through a <b>system call</b>. <code>strace</code> prints them; <code>lsof</code> lists what a process has open. Together they answer \"what is it actually doing?\" without the source code." },
              { t: "code", lang: "bash", code: "strace -f -e trace=openat,connect -o trace.txt ./app   # files and connections, children too\nstrace -p 2210 -f -tt -T          # attach; timestamps and time spent per call\nstrace -c -p 2210                 # Ctrl-C after a few seconds: summary table\n\n# Typical findings\n# openat(AT_FDCWD, \"/etc/app/config.yml\", O_RDONLY) = -1 ENOENT (No such file or directory)\n# connect(5, {sa_family=AF_INET, sin_port=htons(5432), sin_addr=inet_addr(\"10.0.3.7\")}, 16) = -1 ETIMEDOUT\n# read(7, <unfinished ...>        <- blocked reading fd 7: what is fd 7?" },
              { t: "code", lang: "bash", code: "lsof -p 2210                      # everything open by a process\nls -l /proc/2210/fd/7             # what fd 7 is (Linux)\nlsof -nP -iTCP -sTCP:ESTABLISHED  # all established TCP connections\nlsof /var/log/app/app.log         # who has this file open\nlsof +D /data                     # everything open under a directory (slow)" },
              { t: "table", headers: ["Error", "Usually means"], rows: [
                ["ENOENT", "Wrong path, missing file, bad working directory"],
                ["EACCES / EPERM", "Permissions, ACL, SELinux/AppArmor, capabilities"],
                ["ECONNREFUSED", "Reached the host; nothing listening"],
                ["ETIMEDOUT / EAGAIN", "Network drop or a non-blocking call with no data yet"],
                ["EMFILE", "Per-process open file limit reached (ulimit -n)"]
              ] },
              { t: "h", text: "Practical: \"Too many open files\"" },
              { t: "code", lang: "bash", code: "# The app logs: accept4: Too many open files (EMFILE)\nls /proc/2210/fd | wc -l             # descriptors in use: 1024\ngrep 'open files' /proc/2210/limits  # Max open files  1024  524288  files\nlsof -p 2210 | awk '{print $5}' | sort | uniq -c | sort -rn | head\n#  980 IPv4      <- sockets dominate: a connection leak, not files\nlsof -nP -p 2210 -iTCP -sTCP:CLOSE_WAIT | wc -l   # 940 in CLOSE_WAIT\n\n# Short-term: raise the soft limit in the unit, then restart\n# [Service]\n# LimitNOFILE=65536" },
              { t: "p", html: "Many sockets in <code>CLOSE_WAIT</code> means the peer closed but the application never called <code>close()</code>: a bug in the app. Raising <code>LimitNOFILE</code> buys time; fixing the leak ends the incident. Note that <code>ulimit -n</code> in your shell does not affect a service started by systemd." },
              { t: "note", variant: "warn", html: "strace stops the traced process on every syscall and can slow it many times over. Use <code>-c</code> or a narrow <code>-e trace=</code> filter, keep the window short, and prefer eBPF tools (<code>opensnoop</code>, <code>execsnoop</code>) or <code>perf trace</code> in production." },
              { t: "note", variant: "tip", html: "macOS has no strace. <code>sudo fs_usage -w -f filesys PID</code> shows file activity, <code>sudo dtruss -p PID</code> traces syscalls, and <code>lsof</code> is built in. System Integrity Protection blocks dtruss on Apple-signed binaries." },
              { t: "cue", html: "<b>In the field:</b> \"it just hangs\" → <code>strace -p PID</code> for two seconds. If it is sitting in <code>connect</code>, <code>read</code> on a socket or <code>futex</code>, you instantly know whether to look at the network, a peer, or a lock." },
              { t: "note", variant: "key", html: "strace shows what a process asks the kernel for and what fails; lsof shows what it has open. Keep tracing short in production." }
            ]
          },
          {
            id: "perf-profiling",
            title: "Profiling with perf and flame graphs",
            summary: "Sampling profilers, perf top and perf record, reading flame graphs, symbols, and when to use language-level profilers.",
            minutes: 9,
            tags: ["perf", "flame graphs", "profiling"],
            blocks: [
              { t: "p", html: "When CPU is the bottleneck, the question becomes <i>which code</i>. A <b>sampling profiler</b> interrupts the CPU many times per second and records the stack each time; code that shows up in many samples is where the time goes." },
              { t: "code", lang: "bash", code: "sudo perf top -g                       # live view of hottest functions\nsudo perf record -F 99 -g -p 2210 -- sleep 30   # sample one process for 30 s\nsudo perf report --stdio | head -40\nsudo perf stat -p 2210 -- sleep 10      # counters: context switches, cache misses, IPC" },
              { t: "note", variant: "tip", html: "Sample at an odd rate like 99 Hz so sampling does not line up with periodic work and bias the result." },
              { t: "h", text: "Reading a flame graph" },
              { t: "ul", items: [
                "Each box is a function in a stack; boxes stack upward from callers to callees.",
                "<b>Width</b> is the share of samples. The x-axis is sorted alphabetically, not by time.",
                "Look for wide boxes at the <b>top</b>: that code is on-CPU itself.",
                "A wide box with many narrow children is a caller spreading work; optimise the children."
              ] },
              { t: "h", text: "Symbols and runtimes" },
              { t: "p", html: "perf needs symbols to print names. Native code needs debug info or frame pointers. JIT runtimes need a map file: Java with an agent or <code>-XX:+PreserveFramePointer</code>, Node with <code>--perf-basic-prof</code>. Otherwise you see hex addresses." },
              { t: "table", headers: ["Situation", "Tool"], rows: [
                ["Whole system, any language", "perf, eBPF profilers"],
                ["JVM", "async-profiler, JFR"],
                ["Python", "py-spy (attaches without restart)"],
                ["Go", "pprof"],
                ["macOS", "Instruments, sample PID, spindump"]
              ] },
              { t: "note", variant: "warn", html: "Profilers show on-CPU time. If a request is slow because it <i>waits</i> (locks, I/O, network), it barely appears. Use off-CPU analysis or tracing for those." },
              { t: "cue", html: "<b>In the field:</b> on a Mac, <code>sample PID 5</code> captures a five-second call-tree profile of any process from the terminal, no setup needed." },
              { t: "code", lang: "bash", code: "sudo perf top -p $(pgrep -o orders)                # live hottest functions\nsudo perf record -F 99 -g -p $(pgrep -o orders) -- sleep 30\nsudo perf report --stdio | head -40\n# Flame graph (FlameGraph scripts from a local checkout):\nsudo perf script | ./stackcollapse-perf.pl | ./flamegraph.pl > orders.svg" },
              { t: "note", variant: "warn", html: "JIT runtimes (JVM, Node) show <code>[unknown]</code> frames unless they export symbol maps: <code>-XX:+PreserveFramePointer</code> with perf-map-agent for Java, <code>node --perf-basic-prof</code> for Node." },
              { t: "note", variant: "tip", html: "perf is Linux-only. On macOS, use Instruments (Time Profiler) or <code>sample PID 10</code> for a quick call-tree snapshot." },
              { t: "quiz", id: "perf-trace" },
              { t: "note", variant: "key", html: "Sample stacks with perf or a runtime profiler, read width as time and the top edge as hot code, and remember waits do not show up on-CPU." }
            ]
          }
        ]
      },
      {
        id: "incidents",
        name: "Incident playbooks",
        icon: "broom",
        lessons: [
          {
            id: "disk-full",
            title: "Disk full",
            summary: "Blocks versus inodes, finding what grew, deleted-but-open files, safe cleanup and prevention.",
            minutes: 9,
            tags: ["df", "du", "incident"],
            blocks: [
              { t: "p", html: "A full filesystem breaks everything at once: databases stop writing, logs fail, package installs abort and SSH logins may hang. Work through it in a fixed order so you free space safely and learn why it happened." },
              { t: "widget", id: "perfIncident" },
              { t: "ol", items: [
                "<b>Which filesystem?</b> <code>df -hT</code>. Is it blocks or inodes (<code>df -i</code>)?",
                "<b>What grew?</b> <code>sudo du -xh --max-depth=1 /var | sort -h</code>, drilling down. <code>-x</code> stays on one filesystem.",
                "<b>Does du disagree with df?</b> Look for deleted-but-open files: <code>sudo lsof +L1</code>.",
                "<b>Free space safely</b>: truncate active logs (<code>: &gt; file</code>), vacuum the journal, clear package caches, remove old kernels with the package manager.",
                "<b>Prevent</b>: rotation, journald limits, alerts at 80% with a growth projection."
              ] },
              { t: "code", lang: "bash", code: "sudo journalctl --vacuum-size=500M\nsudo apt-get clean          # or: dnf clean all\nsudo docker system df       # container images and volumes are often the culprit\nsudo find /var/log -name '*.gz' -mtime +14 -delete\n\n# Inodes exhausted? find directories with huge file counts\nsudo find /var -xdev -type f | cut -d/ -f2-4 | sort | uniq -c | sort -rn | head" },
              { t: "note", variant: "trap", html: "ext4 reserves about 5% of blocks for root, so a non-root process sees 'No space left on device' while df still shows some space free. Do not set the reservation to zero on the root filesystem; it is what lets root clean up." },
              { t: "note", variant: "warn", html: "Never <code>rm</code> a database's data files or a log being written by a running process to \"make room\". Truncate logs, and handle data with the database's own tools." },
              { t: "cue", html: "<b>In the field:</b> on macOS, \"System Data\" filling the disk is usually local Time Machine snapshots (<code>tmutil listlocalsnapshots /</code>), Docker's VM disk image or Xcode caches in <code>~/Library/Developer</code>." },
              { t: "h", text: "Hunting the growth fast" },
              { t: "code", lang: "bash", code: "sudo du -xh --max-depth=1 / 2>/dev/null | sort -h | tail\nsudo find /var -xdev -type f -size +500M -printf '%s\\t%p\\n' 2>/dev/null | sort -n | tail\nsudo find /var/log -xdev -type f -mmin -10                     # written in the last 10 minutes\ndf -i /                                                        # IUse% 100% = millions of tiny files\nsudo find / -xdev -type d -size +2M 2>/dev/null                # directories with huge entry lists" },
              { t: "table", headers: ["Symptom", "Likely cause", "Fix"], rows: [
                  ["df 100%, du far smaller", "Deleted file still open", "Truncate via /proc/PID/fd, or restart the holder"],
                  ["df -i 100%, df -h fine", "Inode exhaustion (session files, mail queue, cache)", "Delete the small files in batches with find -delete"],
                  ["Space returns, then fills again", "Runaway logging or a crash loop writing dumps", "Fix the writer, cap with logrotate and journald limits"],
                  ["Only the container fails", "Overlay or volume full inside Docker's storage", "docker system df, prune unused images"]
                ] },
              { t: "note", variant: "key", html: "Check blocks and inodes, find growth with du -x, catch deleted-but-open files with lsof +L1, truncate rather than delete, then add rotation and alerts." }
            ]
          },
          {
            id: "oom",
            title: "Out of memory and the OOM killer",
            summary: "How the kernel picks a victim, finding evidence, cgroup limits, overcommit, and fixing rather than hiding the cause.",
            minutes: 10,
            tags: ["OOM", "memory", "cgroups"],
            blocks: [
              { t: "p", html: "When the kernel cannot reclaim enough memory to satisfy an allocation, it invokes the <b>OOM killer</b>: it scores processes, picks one (usually the largest non-exempt one) and sends SIGKILL. In a container, the same happens when the cgroup's limit is reached, even with free RAM on the host." },
              { t: "code", lang: "bash", code: "journalctl -k -b | grep -iE 'out of memory|oom-kill|killed process'\n# Memory cgroup out of memory: Killed process 2210 (java) total-vm:21GB, anon-rss:15.2GB, oom_score_adj:0\n\ncat /proc/2210/oom_score        # current badness score\nsystemctl show orders -p MemoryMax,MemoryCurrent\ncat /sys/fs/cgroup/system.slice/orders.service/memory.events\n# oom 3\n# oom_kill 3" },
              { t: "h", text: "Why the box ran out" },
              { t: "ul", items: [
                "A real leak: memory grows steadily until killed. Graph RSS over time.",
                "A sizing error: heap or buffer pool configured larger than the host or container allows.",
                "A spike: an unbounded query, a huge upload, a cache without a size cap.",
                "Too many workers: each fine alone, together over the limit."
              ] },
              { t: "table", headers: ["Knob", "Effect", "Use"], rows: [
                ["<code>oom_score_adj</code> (-1000..1000)", "Bias victim selection", "Protect sshd or the database; never all processes"],
                ["<code>MemoryMax=</code> / <code>memory.max</code>", "Hard cgroup limit", "Contain one service so it cannot take the host down"],
                ["<code>MemoryHigh=</code>", "Throttle and reclaim before the hard limit", "Softer back-pressure"],
                ["<code>vm.overcommit_memory</code>", "Whether allocations beyond RAM are promised", "Leave the default unless you know why"]
              ] },
              { t: "note", variant: "trap", html: "Turning swap off or tuning overcommit does not create memory. It only changes <i>how</i> things fail: random allocation errors instead of a clean kill." },
              { t: "note", variant: "tip", html: "Userspace OOM daemons such as systemd-oomd act earlier, on sustained memory pressure, killing a whole cgroup before the host becomes unresponsive." },
              { t: "cue", html: "<b>In the field:</b> the first question after an OOM kill is \"was it the biggest process because it leaked, or because it was configured to be big?\" A heap limit near the container limit answers it in seconds." },
              { t: "h", text: "Choosing what dies" },
              { t: "code", lang: "bash", code: "cat /proc/$(pgrep -o orders)/oom_score            # higher = more likely victim\n# protect a critical daemon (systemd):  OOMScoreAdjust=-500\n# make a batch job the preferred victim: OOMScoreAdjust=500\njournalctl -k | grep -A12 'invoked oom-killer'     # the full memory report at kill time\ncat /sys/fs/cgroup/system.slice/orders.service/memory.events   # cgroup-level OOMs" },
              { t: "ul", items: [
                  "A <b>cgroup OOM</b> (container or <code>MemoryMax</code>) kills inside that group even when the host has plenty free.",
                  "<code>systemd-oomd</code> can act earlier, on PSI pressure, killing a whole cgroup before the kernel OOM killer fires.",
                  "A container showing exit code 137 means it received SIGKILL (128 + 9), usually from the OOM killer."
                ] },
              { t: "note", variant: "tip", html: "macOS has no OOM killer in the Linux sense. It compresses and swaps memory, then shows the \"Your system has run out of application memory\" dialog; its memorystatus (jetsam) mechanism may also terminate idle background apps." },
              { t: "note", variant: "key", html: "OOM kills are SIGKILL from the kernel or a cgroup; confirm in the kernel log, compare usage against limits, then fix sizing or the leak." }
            ]
          },
          {
            id: "zombies-runaway",
            title: "Zombies, runaways and fork bombs",
            summary: "Zombie accumulation, runaway CPU processes, file descriptor leaks, process limits and containing a misbehaving process.",
            minutes: 9,
            tags: ["zombies", "ulimit", "nice"],
            blocks: [
              { t: "p", html: "Some incidents are about too many processes, or one process consuming far too much. The tools are the same: identify, contain, then fix the cause." },
              { t: "h", text: "Zombies" },
              { t: "code", lang: "bash", code: "ps -eo stat | grep -c '^Z'\nps -eo ppid,stat | awk '$2 ~ /^Z/ {print $1}' | sort | uniq -c | sort -rn | head\n#   4817 3120        <- one parent owns them all\nps -o pid,cmd -p 3120" },
              { t: "p", html: "One parent with many zombie children is a bug in that parent: it never calls <code>wait()</code>. Restarting it re-parents the zombies to PID 1, which reaps them. Zombies only cost PIDs, but <code>pid_max</code> or a cgroup <code>pids.max</code> can be exhausted." },
              { t: "h", text: "Runaway CPU" },
              { t: "code", lang: "bash", code: "top -o %CPU                      # Linux; macOS: top -o cpu\nrenice +19 -p 7714               # lower its priority right now\nsudo systemctl set-property orders.service CPUQuota=50%   # cap a service\nkill 7714; sleep 5; kill -0 7714 && kill -9 7714" },
              { t: "h", text: "Leaks of descriptors and processes" },
              { t: "table", headers: ["Symptom", "Check", "Limit"], rows: [
                ["Too many open files", "<code>ls /proc/PID/fd | wc -l</code>", "<code>ulimit -n</code>, <code>LimitNOFILE=</code>"],
                ["fork: Resource temporarily unavailable", "<code>ps -u user | wc -l</code>", "<code>ulimit -u</code>, <code>TasksMax=</code>, pids.max"],
                ["Thousands of CLOSE_WAIT sockets", "<code>ss -tan state close-wait</code>", "App never closes sockets: a bug"]
              ] },
              { t: "note", variant: "warn", html: "A fork bomb multiplies processes until the process table is full, and then you cannot even start <code>kill</code>. Per-user process limits and systemd's TasksMax exist precisely to stop that." },
              { t: "note", variant: "tip", html: "<code>kill -STOP PID</code> freezes a runaway without losing its state, so you can inspect it (<code>lsof</code>, a thread dump) before deciding to kill it. <code>kill -CONT</code> resumes." },
              { t: "cue", html: "<b>In the field:</b> on a laptop, an orphaned file watcher (parent PID 1) polling a giant <code>node_modules</code> tree is the classic runaway. Exclude big directories in the watcher config." },
              { t: "h", text: "Contain with cgroups instead of guesswork" },
              { t: "code", lang: "bash", code: "# Cap an already-running service without restarting it\nsudo systemctl set-property --runtime batch.service CPUQuota=50% TasksMax=200\n# Run a one-off command inside its own limits\nsudo systemd-run --scope -p MemoryMax=1G -p CPUQuota=100% ./reindex.sh\n# A per-user process cap that stops fork bombs at login\necho '* hard nproc 4096' | sudo tee /etc/security/limits.d/90-nproc.conf" },
              { t: "note", variant: "tip", html: "On macOS, use <code>ulimit -u</code> and <code>launchctl limit maxproc</code> for process caps. <code>taskpolicy -b -p PID</code> pushes a runaway into the background QoS tier, roughly what <code>renice +19</code> plus <code>ionice -c3</code> do on Linux." },
              { t: "quiz", id: "perf-incidents" },
              { t: "note", variant: "key", html: "Fix zombies through their parent, contain runaways with renice, quotas or STOP, and cap descriptors and processes with limits." }
            ]
          }
        ]
      }
    ]
  };
})();
