/* =====================================================================
   KERNEL · Filesystems & Permissions
   window.TRACKS.fs — modules: layout / perms

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

  function modeString(bits, isDir) {
    var s = isDir ? "d" : "-";
    var who = [[0o400, 0o200, 0o100, 0o4000, "s", "S"], [0o40, 0o20, 0o10, 0o2000, "s", "S"], [0o4, 0o2, 0o1, 0o1000, "t", "T"]];
    for (var i = 0; i < 3; i++) {
      var w = who[i];
      s += (bits & w[0]) ? "r" : "-";
      s += (bits & w[1]) ? "w" : "-";
      var x = bits & w[2], sp = bits & w[3];
      s += sp ? (x ? w[4] : w[5]) : (x ? "x" : "-");
    }
    return s;
  }
  function octal(bits, width) { var o = bits.toString(8); while (o.length < width) o = "0" + o; return o; }

  /* ==================================================================
     1. fsChmod — permission builder
  ================================================================== */
  Widgets.fsChmod = function (mount) {
    shell(mount, "builder", "chmod builder",
      "Tick permissions for owner, group and others, plus the special bits. The panel prints the octal and symbolic forms, the ls -l string, and what the mode means in practice.");
    var bits = 0o644, isDir = false;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var grid = h("div", { style: "display:grid;grid-template-columns:auto repeat(3, minmax(56px, auto));gap:6px 12px;align-items:center;margin-bottom:12px" });
    var boxes = [];
    var rowsDef = [["owner (u)", 0o400, 0o200, 0o100], ["group (g)", 0o40, 0o20, 0o10], ["others (o)", 0o4, 0o2, 0o1]];
    grid.appendChild(h("span", {}, ""));
    ["read", "write", "exec"].forEach(function (t) { grid.appendChild(h("b", { style: "color:var(--text-dim);font-size:0.8rem" }, t)); });
    rowsDef.forEach(function (r) {
      grid.appendChild(h("span", { style: "color:var(--text)" }, r[0]));
      for (var c = 1; c <= 3; c++) {
        (function (mask) {
          var cb = h("input", { type: "checkbox", "aria-label": r[0] + " bit " + octal(mask, 4) });
          cb.checked = !!(bits & mask);
          cb.addEventListener("change", function () { bits = cb.checked ? (bits | mask) : (bits & ~mask); paint(); });
          boxes.push([cb, mask]);
          grid.appendChild(h("label", {}, cb));
        })(r[c]);
      }
    });
    var specials = h("div", { class: "widget-controls" });
    [["setuid", 0o4000], ["setgid", 0o2000], ["sticky", 0o1000]].forEach(function (sp) {
      var b = h("button", { type: "button", class: "w-btn ghost" }, sp[0] + ": off");
      b.addEventListener("click", function () {
        bits ^= sp[1];
        b.className = "w-btn" + ((bits & sp[1]) ? " primary" : " ghost");
        b.textContent = sp[0] + ((bits & sp[1]) ? ": on" : ": off");
        paint();
      });
      specials.appendChild(b);
    });
    function sym() {
      var parts = [], names = ["u", "g", "o"], masks = [[0o400, 0o200, 0o100], [0o40, 0o20, 0o10], [0o4, 0o2, 0o1]];
      for (var i = 0; i < 3; i++) {
        var p = (bits & masks[i][0] ? "r" : "") + (bits & masks[i][1] ? "w" : "") + (bits & masks[i][2] ? "x" : "");
        if (i === 0 && bits & 0o4000) p += "s";
        if (i === 1 && bits & 0o2000) p += "s";
        if (i === 2 && bits & 0o1000) p += "t";
        parts.push(names[i] + "=" + p);
      }
      return parts.join(",");
    }
    function meaning() {
      if (bits & 0o2) return isDir ? (bits & 0o1000 ? "World-writable with sticky bit, like /tmp: anyone may create files, but only owners can delete their own." : "World-writable directory without sticky: any user can delete or rename anyone's files. Almost always a mistake.") : "World-writable file: any local user can change it. Dangerous for scripts and configs.";
      if (bits & 0o4000) return isDir ? "setuid on a directory is ignored on Linux." : (bits & 0o100 ? "Runs with the file owner's privileges (like passwd). Audit every SUID binary." : "Capital S: setuid without execute does nothing useful; usually a typo.");
      if (bits & 0o2000) return isDir ? "setgid on a directory: new files inherit the directory's group. Ideal for shared team folders." : "Runs with the file's group privileges.";
      if (isDir && !(bits & 0o100)) return "Without x on a directory, the owner cannot cd into it or reach anything inside, even with r.";
      if (isDir && (bits & 0o400) && !(bits & 0o4) && !(bits & 0o1)) return "Private directory: others can neither list nor traverse it.";
      if (!isDir && (bits & 0o111)) return "Executable. Scripts also need r for the interpreter to read them.";
      return isDir ? "Typical directory mode is 755 (shared) or 700 (private)." : "Typical file modes: 644 for shared, 600 for private keys and secrets.";
    }
    function paint() {
      try {
        for (var i = 0; i < boxes.length; i++) boxes[i][0].checked = !!(bits & boxes[i][1]);
        var name = isDir ? "shared/" : "deploy.sh";
        clear(stage);
        stage.appendChild(term("$ chmod " + octal(bits, bits > 0o777 ? 4 : 3) + " " + name + "\n$ chmod " + sym() + " " + name + "   # same result\n$ ls -l" + (isDir ? "d" : "") + " " + name + "\n" +
          modeString(bits, isDir) + "  1 ana  devs  4096 Oct 28 09:12 " + name));
        clear(readout);
        readout.appendChild(ro("octal", octal(bits, 4)));
        readout.appendChild(ro("symbolic", modeString(bits, isDir)));
        readout.appendChild(roLine(meaning()));
      } catch (e) {
        clear(readout); readout.appendChild(roLine("Could not compute this mode."));
      }
    }
    var presets = [[0o644, "644"], [0o600, "600"], [0o755, "755"], [0o700, "700"], [0o1777, "1777 /tmp"], [0o2775, "2775 team dir"], [0o4755, "4755 SUID"]];
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([["f", "file"], ["d", "directory"]], 0, function (v) { isDir = v === "d"; paint(); }),
      segment(presets, 0, function (v) { bits = v; if (v === 0o1777 || v === 0o2775) isDir = true; paint(); })));
    mount.appendChild(grid);
    mount.appendChild(specials);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     2. fsUmask — what modes will new files get?
  ================================================================== */
  Widgets.fsUmask = function (mount) {
    shell(mount, "calculator", "umask calculator",
      "Pick or type a umask. New files start from 666 and directories from 777; the umask clears bits (a bitwise AND NOT, not a subtraction).");
    var um = 0o22;
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var inp = h("input", { type: "text", "aria-label": "umask in octal", spellcheck: "false", maxlength: "4",
      style: "background:var(--surface-solid);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px 8px;font-family:var(--font-mono);font-size:0.85rem;width:80px" });
    inp.value = "022";
    inp.addEventListener("input", function () {
      var v = String(inp.value || "").trim();
      if (/^[0-7]{1,4}$/.test(v)) { um = parseInt(v, 8) & 0o777; paint(); }
      else { clear(readout); readout.appendChild(ro("umask", "invalid")); readout.appendChild(roLine("Use one to four octal digits, such as 022 or 0077.")); }
    });
    function paint() {
      var f = 0o666 & ~um, d = 0o777 & ~um, naive = 0o666 - um;
      clear(stage);
      stage.appendChild(term("$ umask " + octal(um, 4) + "\n$ touch notes.txt; mkdir reports\n$ ls -ld notes.txt reports\n" +
        modeString(f, false) + "  1 ana ana    0 Oct 28 09:20 notes.txt\n" +
        modeString(d, true) + "  2 ana ana 4096 Oct 28 09:20 reports"));
      clear(readout);
      readout.appendChild(ro("files", octal(f, 3)));
      readout.appendChild(ro("dirs", octal(d, 3)));
      readout.appendChild(roLine(naive !== f ? "Subtracting would give " + (naive >= 0 ? octal(naive, 3) : "a negative number") + ", which is wrong: umask " + octal(um, 3) + " masks bits, and files never start with x set." :
        um === 0o77 ? "077 keeps everything private to you: a good choice for service accounts handling secrets." :
        um === 0o02 ? "002 lets your group write: common with per-user groups and shared project directories." :
        "022 is the usual default: you can write, everyone else can read."));
    }
    mount.appendChild(h("div", { class: "widget-controls" }, h("label", { class: "w-field" }, "umask", inp),
      segment([[0o22, "022"], [0o02, "002"], [0o77, "077"], [0o27, "027"], [0o33, "033"]], 0, function (v) { um = v; inp.value = octal(v, 3); paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     3. fsLinks — hard links, symlinks and what deletion does
  ================================================================== */
  Widgets.fsLinks = function (mount) {
    shell(mount, "simulator", "Hard links versus symlinks",
      "Run the steps in any order. The panel shows directory entries, the inode they point to with its link count, and whether each name still resolves.");
    var st;
    function reset() { st = { names: { "app.conf": { type: "file", ino: 1311 } }, inodes: { 1311: { links: 1, data: "port=8080" } }, log: [] }; }
    reset();
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function resolve(n, depth) {
      var e = st.names[n];
      if (!e) return null;
      if (e.type === "sym") return depth > 5 ? null : resolve(e.target, depth + 1);
      return st.inodes[e.ino] ? e.ino : null;
    }
    function act(kind) {
      var msg;
      if (kind === "hard") {
        var src = st.names["app.conf"];
        if (!src || src.type !== "file") msg = "ln needs an existing file: app.conf is gone.";
        else if (st.names["hard.conf"]) msg = "hard.conf already exists.";
        else { st.names["hard.conf"] = { type: "file", ino: src.ino }; st.inodes[src.ino].links++; msg = "$ ln app.conf hard.conf  → a second name for inode " + src.ino + "; link count is now " + st.inodes[src.ino].links + "."; }
      } else if (kind === "sym") {
        if (st.names["soft.conf"]) msg = "soft.conf already exists.";
        else { st.names["soft.conf"] = { type: "sym", target: "app.conf", ino: 2207 }; msg = "$ ln -s app.conf soft.conf  → a new tiny inode (2207) that stores the path 'app.conf'. Target link count unchanged."; }
      } else if (kind === "rm") {
        var e = st.names["app.conf"];
        if (!e) msg = "app.conf is already removed.";
        else {
          delete st.names["app.conf"];
          var ino = st.inodes[e.ino];
          ino.links--;
          if (ino.links <= 0) { delete st.inodes[e.ino]; msg = "$ rm app.conf  → link count hit 0, so the inode and its data blocks are freed (once no process holds it open)."; }
          else msg = "$ rm app.conf  → only the name is removed. Inode " + e.ino + " survives with link count " + ino.links + ".";
        }
      } else if (kind === "recreate") {
        if (st.names["app.conf"]) msg = "app.conf already exists.";
        else { st.names["app.conf"] = { type: "file", ino: 1408 }; st.inodes[1408] = { links: 1, data: "port=9090" }; msg = "$ echo port=9090 > app.conf  → a brand-new inode 1408. The symlink follows the name; the hard link keeps the old inode."; }
      }
      st.log.push(msg);
      paint(msg);
    }
    function paint(msg) {
      try {
        clear(stage);
        var lines = ["$ ls -li"];
        var names = Object.keys(st.names).sort();
        if (!names.length) lines.push("(directory is empty)");
        for (var i = 0; i < names.length; i++) {
          var n = names[i], e = st.names[n];
          if (e.type === "sym") lines.push(e.ino + " lrwxrwxrwx 1 ana ana  8 " + n + " -> " + e.target);
          else lines.push(e.ino + " -rw-r--r-- " + st.inodes[e.ino].links + " ana ana 10 " + n);
        }
        lines.push("");
        for (var j = 0; j < names.length; j++) {
          var r = resolve(names[j], 0);
          lines.push("$ cat " + names[j] + "   → " + (r ? st.inodes[r].data + "  (inode " + r + ")" : "No such file or directory (dangling)"));
        }
        stage.appendChild(term(lines.join("\n")));
        clear(readout);
        readout.appendChild(ro("names", names.length));
        readout.appendChild(ro("live inodes", Object.keys(st.inodes).length));
        readout.appendChild(roLine(msg || "Start with ln and ln -s, then remove app.conf and see who survives."));
      } catch (e) {
        clear(readout); readout.appendChild(roLine("Could not render the directory."));
      }
    }
    var c = h("div", { class: "widget-controls" });
    [["hard", "ln app.conf hard.conf"], ["sym", "ln -s app.conf soft.conf"], ["rm", "rm app.conf"], ["recreate", "recreate app.conf"]].forEach(function (p) {
      c.appendChild(h("button", { type: "button", class: "w-btn ghost", onclick: function () { act(p[0]); } }, p[1]));
    });
    c.appendChild(h("button", { type: "button", class: "w-btn", onclick: function () { reset(); paint(); } }, "Reset"));
    mount.appendChild(c);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "fs-layout": {
      title: "Filesystem layout checkpoint",
      sub: "FHS, inodes, links and mounts.",
      questions: [
        {
          q: "`df -h` shows / at 100% but `du -sh /*` adds up to far less. What is the most likely cause?",
          options: ["du cannot read compressed files", "A deleted file is still held open by a running process", "df counts inodes, not bytes", "The filesystem is mounted read-only"],
          answer: 1,
          explain: "Deleting a file removes its name, but the inode and blocks stay allocated while any process has it open. du walks names and cannot see it; df asks the filesystem and can. lsof +L1 lists such files; restarting or signalling the holder frees the space."
        },
        {
          q: "Which statement about hard links is true?",
          options: ["They can point to directories freely", "They are separate names for the same inode and must be on the same filesystem", "Deleting the original breaks them", "They store the target's path"],
          answer: 1,
          explain: "A hard link is just another directory entry with the same inode number, which is why it only works within one filesystem. The data survives until the last link is removed. Symlinks, by contrast, store a path and can dangle."
        },
        {
          q: "A filesystem reports 'No space left on device' while df -h shows 40% used. What should you check next?",
          options: ["df -i for inode exhaustion", "free -m", "The swap partition", "dmesg for CPU errors"],
          answer: 0,
          explain: "Every file needs an inode, and a filesystem has a fixed number on ext4. Millions of tiny files, such as session files or a cache, can exhaust inodes while blocks remain free. df -i shows inode usage per filesystem."
        },
        {
          q: "Where should a locally installed, non-packaged application put its variable data according to the FHS?",
          options: ["/usr/bin", "/etc", "/var/lib/<app>", "/boot"],
          answer: 2,
          explain: "/var holds data that changes at runtime: /var/lib for state, /var/log for logs, /var/cache for rebuildable caches. /etc is for configuration, /usr is meant to be read-only and shareable, and /boot holds kernels."
        },
        {
          q: "After adding a line to /etc/fstab, what is a safe way to test it before rebooting?",
          options: ["Reboot and hope", "Run sudo mount -a (or findmnt --verify) and check for errors", "Run fsck on the root filesystem", "Edit /etc/mtab"],
          answer: 1,
          explain: "mount -a mounts everything in fstab that is not already mounted, so a typo shows up immediately rather than dropping the next boot into emergency mode. findmnt --verify checks the syntax. Adding nofail for non-critical disks prevents boot failures if a device is missing."
        }
      ]
    },
    "fs-perms": {
      title: "Permissions checkpoint",
      sub: "Modes, umask, special bits, ACLs, users and sudo.",
      questions: [
        {
          q: "A user can read /srv/app/config.yml (mode 644) yet gets 'Permission denied'. /srv/app is mode 700 owned by root. Why?",
          options: ["644 does not allow reading", "Reaching a file needs x on every directory in the path, and /srv/app denies it to others", "The file needs the sticky bit", "YAML files need execute permission"],
          answer: 1,
          explain: "Path traversal checks search (x) permission on each directory component. Without x on /srv/app, the file's own mode never gets evaluated. namei -l /srv/app/config.yml prints the permissions of every component and finds the blocker quickly."
        },
        {
          q: "With umask 027, what mode does a newly created regular file get?",
          options: ["750", "640", "627", "644"],
          answer: 1,
          explain: "Files start from 666, and the umask clears group write and all of others: 666 AND NOT 027 = 640. Directories start from 777 and get 750. Files are not created executable by default no matter what the umask says."
        },
        {
          q: "What does the sticky bit do on /tmp (mode 1777)?",
          options: ["Keeps files in memory", "Lets only a file's owner (or root) delete or rename it, even though everyone can write the directory", "Makes files immutable", "Runs files as root"],
          answer: 1,
          explain: "Without the sticky bit, write permission on a directory lets anyone remove any entry in it. The sticky bit restricts unlinking and renaming to the file's owner, the directory's owner or root, which is what a shared scratch space needs."
        },
        {
          q: "You need one extra user to have read access to a file without changing its owner or group. What is the cleanest tool?",
          options: ["chmod 777", "A POSIX ACL: setfacl -m u:ana:r file", "Add the user to the root group", "Copy the file to the user's home"],
          answer: 1,
          explain: "ACLs add per-user and per-group entries beyond the three classic classes. getfacl shows them, and ls -l marks such files with a plus sign. Remember the ACL mask entry can limit effective permissions; macOS has a different ACL system managed with chmod +a."
        },
        {
          q: "You added a user to the docker group but `id` in their existing session does not show it. Why?",
          options: ["Group changes require a reboot", "Group membership is read at login; start a new session or use newgrp", "The group name is case-sensitive", "id only shows primary groups"],
          answer: 1,
          explain: "A process's supplementary groups are set when the session starts and inherited by children. Existing shells keep the old list. Log out and back in, or run newgrp docker for a subshell. Also note that the docker group is effectively root-equivalent."
        },
        {
          q: "What is the safest way to edit /etc/sudoers?",
          options: ["sudo nano /etc/sudoers", "sudo visudo, or a file under /etc/sudoers.d edited with visudo -f", "chmod 666 /etc/sudoers first", "Copy it, edit, and mv it back"],
          answer: 1,
          explain: "visudo locks the file and checks the syntax before installing it. A syntax error in sudoers can disable sudo for everyone, which on a server without a root password means console recovery. Drop-in files keep local rules separate from the package's default."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.fs = {
    id: "fs",
    name: "Filesystems & Permissions",
    short: "FS",
    tagline: "Where files live and who may touch them",
    color: "#fb7185",
    blurb: "The directory hierarchy and why it is laid out that way, inodes and links, mounting and fstab, then the permission model end to end: modes and umask, SUID, SGID and sticky, ACLs, users, groups and sudo, with APFS and macOS differences.",
    modules: [
      {
        id: "layout",
        name: "Filesystem layout",
        icon: "grid",
        lessons: [
          {
            id: "fhs",
            title: "The filesystem hierarchy",
            summary: "What lives in /etc, /var, /usr, /opt, /proc, /sys, /run and /tmp, and where macOS differs.",
            minutes: 8,
            tags: ["FHS", "directories"],
            blocks: [
              { t: "p", html: "Linux has a single tree rooted at <code>/</code>; disks, partitions and pseudo-filesystems are attached into it. The <b>Filesystem Hierarchy Standard</b> says roughly where things go, so you can find configs, logs and binaries on any distribution." },
              { t: "table", headers: ["Path", "Holds", "In the field"], rows: [
                ["<code>/etc</code>", "Host configuration (text files)", "Back it up; manage it with config tooling"],
                ["<code>/var</code>", "Data that changes: logs, spools, state, caches", "The directory that fills disks"],
                ["<code>/usr</code>", "Installed software, read-only in principle", "<code>/usr/bin</code>, <code>/usr/lib</code>; packages own it"],
                ["<code>/usr/local</code>, <code>/opt</code>", "Locally built or third-party software", "Not touched by the package manager"],
                ["<code>/home</code>, <code>/root</code>", "User and root home directories", ""],
                ["<code>/tmp</code>, <code>/var/tmp</code>", "Temporary files; /tmp may be RAM-backed and cleared at boot", "/var/tmp survives reboots"],
                ["<code>/run</code>", "Runtime state since boot: PID files, sockets", "tmpfs, gone after reboot"],
                ["<code>/proc</code>, <code>/sys</code>", "Kernel views of processes and devices", "Virtual: they use no disk"],
                ["<code>/dev</code>", "Device nodes", "<code>/dev/sda</code>, <code>/dev/null</code>"],
                ["<code>/boot</code>", "Kernel and initramfs", "Small; old kernels fill it"]
              ] },
              { t: "note", variant: "tip", html: "Many modern distributions merge <code>/bin</code> into <code>/usr/bin</code> and <code>/lib</code> into <code>/usr/lib</code>, leaving symlinks at the old paths." },
              { t: "h", text: "Everything is a file, almost" },
              { t: "p", html: "Devices, kernel parameters and process state appear as files, so ordinary tools work on them: <code>cat /proc/loadavg</code>, <code>cat /sys/class/net/eth0/mtu</code>, <code>echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward</code>." },
              { t: "code", lang: "bash", code: "ls -l /dev/null /dev/sda /dev/tty\n# crw-rw-rw- 1 root root 1, 3 ... /dev/null   (c = character device)\n# brw-rw---- 1 root disk 8, 0 ... /dev/sda    (b = block device)\nfile -s /dev/sda1      # what filesystem is on a partition\nlsblk -f               # block devices, filesystems and mount points" },
              { t: "h", text: "macOS is laid out differently" },
              { t: "ul", items: [
                "User data lives under <code>/Users</code>, not <code>/home</code>.",
                "<code>/etc</code>, <code>/tmp</code> and <code>/var</code> are symlinks into <code>/private</code>.",
                "The system volume is read-only and sealed; your writable data is on a separate APFS volume.",
                "Homebrew installs into <code>/opt/homebrew</code> on Apple silicon and <code>/usr/local</code> on Intel.",
                "Apps and frameworks live in <code>/Applications</code> and <code>/Library</code>."
              ] },
              { t: "cue", html: "<b>In the field:</b> when you do not know where a package put its files, ask the package manager: <code>dpkg -L nginx</code> or <code>rpm -ql nginx</code>." },
              { t: "note", variant: "key", html: "Configuration in /etc, changing data in /var, software in /usr, runtime state in /run, kernel views in /proc and /sys." }
            ]
          },
          {
            id: "inodes-links",
            title: "Inodes, hard links and symlinks",
            summary: "What an inode stores, how directories map names to inodes, hard versus symbolic links, and deleted-but-open files.",
            minutes: 10,
            tags: ["inodes", "links", "lsof"],
            blocks: [
              { t: "p", html: "A file on a Unix filesystem has two halves. The <b>inode</b> holds metadata (type, mode, owner, size, timestamps, link count) and pointers to data blocks. A <b>directory</b> is a list of name-to-inode-number entries. The name is not part of the file at all." },
              { t: "diagram", id: "inode-links", caption: "Two directory entries share one inode (a hard link); a symlink is a separate inode that stores a path." },
              { t: "code", lang: "bash", code: "ls -li app.conf\n# 1311 -rw-r--r-- 1 ana ana 10 Oct 28 09:12 app.conf\n#  ^inode           ^link count\nstat app.conf               # full inode metadata (GNU)\nstat -f '%i %l %Sp' app.conf  # macOS/BSD stat syntax differs" },
              { t: "widget", id: "fsLinks" },
              { t: "table", headers: ["", "Hard link", "Symbolic link"], rows: [
                ["Is", "Another name for the same inode", "A small file containing a path"],
                ["Across filesystems", "No", "Yes"],
                ["To directories", "No (except . and ..)", "Yes"],
                ["If the target is deleted", "Data survives", "Link dangles"],
                ["Created with", "<code>ln a b</code>", "<code>ln -s a b</code>"]
              ] },
              { t: "note", variant: "trap", html: "A symlink's target is resolved relative to the <i>link's</i> directory, not your current directory. <code>ln -s ../shared/app.conf conf/app.conf</code> is evaluated from <code>conf/</code>." },
              { t: "h", text: "Deleted but still open" },
              { t: "p", html: "Space is freed when the link count is zero <i>and</i> no process holds the file open. That is why deleting a huge log that a daemon is still writing does not free the disk." },
              { t: "code", lang: "bash", code: "sudo lsof +L1                       # open files with link count < 1\n# java 2210 app 7w REG 8,1 41G 1311 /var/log/app/app.log (deleted)\n: > /proc/2210/fd/7                 # truncate it through the descriptor\nsudo systemctl restart app          # or restart the holder" },
              { t: "note", variant: "tip", html: "Atomic replacement works because of inodes: write a new file, then <code>mv new.conf app.conf</code>. Readers see either the old inode or the new one, never a half-written file." },
              { t: "cue", html: "<b>In the field:</b> timestamps matter: <code>mtime</code> is content change, <code>ctime</code> is inode change (mode, owner, links), and <code>atime</code> is access, often disabled or relaxed with <code>noatime</code> / <code>relatime</code>." },
              { t: "code", lang: "bash", code: "stat -c '%i %h %n' a.txt b.txt          # inode and link count (GNU)\nfind / -xdev -samefile a.txt 2>/dev/null # every hard link to the same inode\nfind -L /etc -type l 2>/dev/null         # broken symlinks\nreadlink -f /usr/bin/python3             # resolve the whole chain" },
              { t: "note", variant: "tip", html: "BSD <code>stat</code> on macOS uses <code>-f</code>, not <code>-c</code>: <code>stat -f '%i %l %N' a.txt</code>. <code>readlink -f</code> exists only on macOS 12.3 and later; <code>realpath</code> is portable." },
              { t: "note", variant: "key", html: "Names live in directories, metadata in inodes; hard links share an inode, symlinks store a path, and space returns only when no name and no open descriptor remain." }
            ]
          },
          {
            id: "mounts",
            title: "Mounts, fstab and disk space",
            summary: "Mounting filesystems, mount options, fstab and UUIDs, tmpfs and bind mounts, and reading df and du correctly.",
            minutes: 10,
            tags: ["mount", "fstab", "df"],
            blocks: [
              { t: "p", html: "Mounting attaches a filesystem to a directory in the tree, the <b>mount point</b>. Whatever was in that directory is hidden until you unmount." },
              { t: "code", lang: "bash", code: "findmnt                                # tree of everything mounted\nfindmnt -T /var/lib/postgresql         # which filesystem holds this path?\nlsblk -f                               # devices, filesystem types, UUIDs\nsudo mount /dev/nvme1n1p1 /data\nsudo mount -o remount,ro /data         # change options in place\nsudo umount /data                      # 'target is busy'? see lsof +D /data\nsudo mount --bind /srv/app/shared /var/www/shared" },
              { t: "h", text: "fstab" },
              { t: "code", lang: "text", code: "# <device>                                <mount>  <type> <options>                  <dump> <pass>\nUUID=7d1c2e4a-0b5f-4c3a-9e6d-1f2a3b4c5d6e  /data    ext4   defaults,noatime,nofail    0      2\ntmpfs                                      /scratch tmpfs  size=2G,mode=1777          0      0" },
              { t: "note", variant: "warn", html: "Use UUIDs or labels, never <code>/dev/sdb1</code>, which can change between boots. Add <code>nofail</code> for non-essential disks, and test with <code>sudo mount -a</code> before rebooting so a typo does not leave the host in emergency mode." },
              { t: "table", headers: ["Option", "Effect"], rows: [
                ["<code>ro</code> / <code>rw</code>", "Read-only or read-write"],
                ["<code>noatime</code>", "Do not update access times: fewer writes"],
                ["<code>noexec</code>, <code>nosuid</code>, <code>nodev</code>", "Hardening for /tmp, removable media"],
                ["<code>nofail</code>", "Do not fail boot if the device is missing"],
                ["<code>_netdev</code>", "Wait for the network (NFS, iSCSI)"]
              ] },
              { t: "h", text: "Reading disk space" },
              { t: "code", lang: "bash", code: "df -hT                 # per filesystem, with type\ndf -i                  # inode usage\nsudo du -xh --max-depth=1 /var | sort -h     # biggest directories, one filesystem\nsudo du -sh /var/log/* | sort -h | tail\nncdu -x /              # interactive, if installed" },
              { t: "note", variant: "tip", html: "On macOS, <code>du -d 1</code> replaces <code>--max-depth=1</code>, <code>diskutil list</code> replaces <code>lsblk</code>, and APFS volumes share one container's free space, so df figures for several volumes look identical." },
              { t: "cue", html: "<b>In the field:</b> a disk that mysteriously fills under a mount point may be filling the directory <i>underneath</i> it while unmounted. Bind-mount / elsewhere (<code>mount --bind / /mnt/root</code>) and run du there to look beneath." },
              { t: "h", text: "Bind mounts and tmpfs" },
              { t: "code", lang: "bash", code: "sudo mount --bind /data/uploads /srv/app/uploads     # same files, second path\nsudo mount -o remount,bind,ro /srv/app/uploads        # make that view read-only\nsudo mount -t tmpfs -o size=512M,mode=1777 tmpfs /mnt/scratch\nfindmnt -no SOURCE,FSTYPE,OPTIONS /srv/app/uploads\nsudo mount -a && echo 'fstab parses'                  # test before rebooting" },
              { t: "note", variant: "warn", html: "An fstab typo can drop the next boot into emergency mode. Always run <code>sudo mount -a</code> (and <code>sudo findmnt --verify</code> on newer util-linux) after editing, and add <code>nofail</code> to non-essential mounts." },
              { t: "quiz", id: "fs-layout" },
              { t: "note", variant: "key", html: "Mount by UUID with sensible options, test fstab with mount -a, and read space with df (filesystem) plus du (names) plus df -i (inodes)." }
            ]
          }
        ]
      },
      {
        id: "perms",
        name: "Permissions and identity",
        icon: "shield",
        lessons: [
          {
            id: "permissions",
            title: "Modes, chmod, chown and umask",
            summary: "The rwx model for files and directories, octal and symbolic chmod, ownership, and how umask sets defaults.",
            minutes: 10,
            tags: ["chmod", "chown", "umask"],
            blocks: [
              { t: "p", html: "Every inode has an owner, a group and nine permission bits: read, write and execute for the <b>owner</b>, the <b>group</b> and <b>others</b>. The kernel checks exactly one class: owner if you own it, else group if you are in it, else others." },
              { t: "table", headers: ["Bit", "On a file", "On a directory"], rows: [
                ["r (4)", "Read contents", "List names (ls)"],
                ["w (2)", "Modify contents", "Create, delete, rename entries (needs x too)"],
                ["x (1)", "Execute as a program", "Traverse: cd into it, reach entries by name"]
              ] },
              { t: "widget", id: "fsChmod" },
              { t: "code", lang: "bash", code: "chmod 640 app.env              # rw- r-- ---\nchmod u+x,go-w deploy.sh       # symbolic: add and remove\nchmod -R g+rwX shared/         # capital X: x only on dirs and already-executable files\nsudo chown app:app /var/lib/app\nsudo chown -R --from=old:old new:new /srv   # GNU only\nnamei -l /srv/app/config.yml   # permissions of every path component" },
              { t: "note", variant: "trap", html: "Owner permissions are checked even if they are stricter than others'. A file with mode <code>047</code> denies its owner while letting everyone else write. Classes are not cumulative." },
              { t: "h", text: "umask sets the defaults" },
              { t: "widget", id: "fsUmask" },
              { t: "p", html: "Set the umask in a shell profile, in a systemd unit (<code>UMask=0027</code>) or at the top of a script. It is inherited by child processes, so a daemon's umask decides the mode of every file it writes." },
              { t: "h", text: "Triage order for Permission denied" },
              { t: "ol", items: [
                "Who is really asking? <code>id</code>, or <code>ps -o user,group,supgrp -p PID</code> for a daemon. Services often run as a different user than you expect.",
                "Every directory on the path: <code>namei -l /full/path</code>. A missing x on any parent denies everything below it.",
                "The file's mode and owner, then a trailing <code>+</code> in <code>ls -l</code> that means an ACL is present.",
                "Mount options: <code>findmnt -T /path</code> for <code>ro</code>, <code>noexec</code> or <code>nosuid</code>.",
                "Mandatory controls: SELinux (<code>ausearch -m avc -ts recent</code>) or AppArmor (<code>journalctl -k | grep apparmor</code>), and on macOS, TCC privacy prompts and SIP."
              ] },
              { t: "note", variant: "warn", html: "<code>chmod -R 777</code> is never the fix. Find who needs access (<code>id user</code>, <code>namei -l path</code>) and grant exactly that with a group, setgid directory or ACL." },
              { t: "cue", html: "<b>In the field:</b> SSH refuses private keys readable by others and the <code>authorized_keys</code> file if your home or <code>~/.ssh</code> is group-writable. Check modes before debugging anything else." },
              { t: "note", variant: "key", html: "One class is checked (owner, group, or others); x on directories means traverse; the umask clears bits from 666 and 777 for new files and directories." }
            ]
          },
          {
            id: "special-bits-acls",
            title: "SUID, SGID, sticky and ACLs",
            summary: "The three special bits, why SUID binaries are audited, shared directories with setgid, POSIX ACLs, and immutable files.",
            minutes: 10,
            tags: ["SUID", "SGID", "ACL"],
            blocks: [
              { t: "p", html: "Beyond rwx there are three special bits, shown as a fourth leading octal digit, plus optional access control lists for finer-grained rules." },
              { t: "table", headers: ["Bit", "Octal", "On a file", "On a directory", "ls shows"], rows: [
                ["setuid", "4000", "Runs as the file's owner", "Ignored on Linux", "<code>rws</code> in owner"],
                ["setgid", "2000", "Runs with the file's group", "New entries inherit the dir's group", "<code>rws</code> in group"],
                ["sticky", "1000", "Unused today", "Only owners may delete their entries", "<code>rwt</code> in others"]
              ] },
              { t: "code", lang: "bash", code: "ls -l /usr/bin/passwd\n# -rwsr-xr-x 1 root root 68208 ... /usr/bin/passwd   (SUID root)\nls -ld /tmp\n# drwxrwxrwt 18 root root 4096 ... /tmp             (sticky)\n\n# Team directory: everything created inside belongs to group devs\nsudo install -d -m 2775 -g devs /srv/shared\n\n# Audit SUID/SGID binaries on the root filesystem\nsudo find / -xdev -perm /6000 -type f -exec ls -l {} + 2>/dev/null" },
              { t: "note", variant: "warn", html: "Every SUID-root program is a privilege boundary: a bug in it can give an attacker root. Keep the list short, compare it against a baseline, and mount data filesystems with <code>nosuid</code>." },
              { t: "h", text: "POSIX ACLs" },
              { t: "code", lang: "bash", code: "setfacl -m u:ana:rw report.csv          # one extra user\nsetfacl -m g:auditors:r -R /srv/reports   # a group, recursively\nsetfacl -d -m g:devs:rwX /srv/shared     # default ACL for new files\ngetfacl report.csv\n# user::rw-\n# user:ana:rw-\n# group::r--\n# mask::rw-\n# other::---\nsetfacl -b report.csv                     # remove all ACL entries" },
              { t: "note", variant: "trap", html: "The ACL <code>mask</code> caps the effective permissions of named users and groups. A later <code>chmod g-w</code> lowers the mask and silently removes write from every ACL entry. getfacl shows <code>#effective:</code> when this happens." },
              { t: "h", text: "Other controls you will meet" },
              { t: "ul", items: [
                "<code>chattr +i file</code> makes a file immutable on ext4, even for root; <code>lsattr</code> shows it.",
                "Capabilities split root's powers: <code>setcap cap_net_bind_service=+ep ./server</code> lets a binary bind port 80 without SUID.",
                "SELinux and AppArmor add mandatory rules on top; a Permission denied with correct modes may come from them (<code>ausearch -m avc</code>, <code>dmesg</code>).",
                "macOS uses its own ACLs (<code>chmod +a \"ana allow read\" f</code>, <code>ls -le</code>), file flags (<code>chflags</code>) and System Integrity Protection."
              ] },
              { t: "cue", html: "<b>In the field:</b> a <code>+</code> after the mode in <code>ls -l</code> means an ACL is present. Run getfacl before you conclude the mode is the whole story." },
              { t: "note", variant: "key", html: "SUID and SGID change who a program runs as, setgid directories share group ownership, sticky protects shared dirs, and ACLs add per-user rules capped by the mask." }
            ]
          },
          {
            id: "users-sudo",
            title: "Users, groups and sudo",
            summary: "UIDs and GIDs, /etc/passwd and /etc/shadow, service accounts, group membership, and writing safe sudoers rules.",
            minutes: 10,
            tags: ["users", "groups", "sudo"],
            blocks: [
              { t: "p", html: "The kernel only knows numbers: a process has a user ID and a list of group IDs, and every inode has an owner UID and GID. Names come from lookup databases, normally <code>/etc/passwd</code> and <code>/etc/group</code>, or a directory service." },
              { t: "code", lang: "bash", code: "id ana\n# uid=1001(ana) gid=1001(ana) groups=1001(ana),27(sudo),998(docker)\ngetent passwd ana\n# ana:x:1001:1001:Ana:/home/ana:/bin/bash\n#  name:pw:uid:gid:comment:home:shell   (the x means: hash lives in /etc/shadow)\n\nsudo useradd --system --no-create-home --shell /usr/sbin/nologin orders\nsudo usermod -aG devs ana        # -a appends; without it you REPLACE all groups\nsudo passwd -l olduser           # lock the password" },
              { t: "note", variant: "trap", html: "<code>usermod -G devs ana</code> without <code>-a</code> removes ana from every other supplementary group, including sudo. Always use <code>-aG</code>." },
              { t: "table", headers: ["UID range", "Used for"], rows: [
                ["0", "root"],
                ["1-999 (distro dependent)", "System and service accounts"],
                ["1000+", "Human users"],
                ["65534", "nobody: unprivileged placeholder"]
              ] },
              { t: "h", text: "sudo done carefully" },
              { t: "code", lang: "text", code: "# /etc/sudoers.d/deploy   (edit with: sudo visudo -f /etc/sudoers.d/deploy)\nCmnd_Alias APP_CTL = /usr/bin/systemctl restart orders, /usr/bin/systemctl status orders\ndeploy ALL=(root) NOPASSWD: APP_CTL\n\n%sre   ALL=(ALL:ALL) ALL" },
              { t: "code", lang: "bash", code: "sudo -l                 # what may I run here?\nsudo -u orders -- /srv/orders/bin/migrate   # run as a service user\nsudo -i                 # login shell as root (prefer single commands)\nsudo journalctl -u sudo --since today      # audit trail on systemd hosts" },
              { t: "note", variant: "warn", html: "Rules that allow editors, pagers, <code>tar</code>, <code>find</code> or wildcards in arguments usually allow a full root shell, because those programs can run commands. Grant exact commands with fixed arguments." },
              { t: "note", variant: "tip", html: "On macOS, users live in Directory Services, not <code>/etc/passwd</code>: query with <code>dscl . -read /Users/ana</code> or <code>id</code>. Admin rights come from the <code>admin</code> group." },
              { t: "cue", html: "<b>In the field:</b> run services under their own system user with a nologin shell and no home. A compromise then reaches only that account's files." },
              { t: "code", lang: "bash", code: "sudo -l                                   # what am I allowed to run?\nsudo visudo -f /etc/sudoers.d/deploy      # always edit with visudo: it syntax-checks\n# deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart orders\ngetent passwd deploy; id deploy           # works with LDAP/SSSD too, unlike reading /etc/passwd" },
              { t: "note", variant: "tip", html: "macOS keeps users in Directory Services, not <code>/etc/passwd</code>. Use <code>dscl . -read /Users/name</code> and <code>dseditgroup</code>. Admins are members of the <code>admin</code> group, which sudoers grants by default." },
              { t: "quiz", id: "fs-perms" },
              { t: "note", variant: "key", html: "Identity is numeric UIDs and GIDs; append groups with -aG, give services dedicated accounts, and grant sudo for exact commands edited through visudo." }
            ]
          }
        ]
      }
    ]
  };
})();
