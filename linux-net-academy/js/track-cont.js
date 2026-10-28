/* =====================================================================
   KERNEL · Containers Under the Hood
   window.TRACKS.cont — modules: iso

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
     1. contNamespaces — what does a process see?
  ================================================================== */
  var NS = [
    { id: "pid", label: "pid", host: "$ ps -e | wc -l\n312\n$ echo $$\n48211", inner: "$ ps -e\n  PID TTY  TIME CMD\n    1 ?    0:00 sh\n    7 ?    0:00 ps\n$ echo $$\n1", why: "Its own PID numbering: the first process is PID 1 and host processes are invisible." },
    { id: "net", label: "net", host: "$ ip -br addr\nlo    UNKNOWN 127.0.0.1/8\neth0  UP      10.20.37.140/26\ndocker0 UP    172.17.0.1/16", inner: "$ ip -br addr\nlo    UNKNOWN 127.0.0.1/8\neth0@if9 UP   172.17.0.5/16", why: "Its own interfaces, routes, firewall rules and ports. Linked to the host by a veth pair." },
    { id: "mnt", label: "mnt", host: "$ ls /\nbin boot dev etc home lib opt proc root run srv sys tmp usr var", inner: "$ ls /\nbin dev etc home lib proc root sys tmp usr var   (the image's rootfs)", why: "Its own mount table, so it can have a different root filesystem from the image." },
    { id: "uts", label: "uts", host: "$ hostname\nweb1.lab.example", inner: "$ hostname\n3f9c1a2b7d4e", why: "Its own hostname and domain name." },
    { id: "user", label: "user", host: "$ id\nuid=1001(ana) gid=1001(ana)", inner: "$ id\nuid=0(root) gid=0(root)\n# host sees this process as uid 101000", why: "UIDs are mapped: root inside can be an unprivileged user outside (rootless containers)." },
    { id: "ipc", label: "ipc", host: "$ ipcs -m | wc -l\n14", inner: "$ ipcs -m\n------ Shared Memory Segments --------\n(none)", why: "Separate System V IPC and POSIX message queues." },
    { id: "cgroup", label: "cgroup", host: "$ cat /proc/self/cgroup\n0::/user.slice/user-1001.slice/session-4.scope", inner: "$ cat /proc/self/cgroup\n0::/", why: "Hides the host's cgroup paths: the container sees its own cgroup as the root." }
  ];

  Widgets.contNamespaces = function (mount) {
    shell(mount, "simulator", "Unshare one namespace at a time",
      "Toggle the namespaces a process gets. For each, compare what the host shell sees with what the process sees. A container is simply a process with all of them turned on.");
    var on = { pid: true, net: true, mnt: false, uts: true, user: false, ipc: false, cgroup: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var controls = h("div", { class: "widget-controls" });
    NS.forEach(function (n) {
      var b = h("button", { type: "button", class: "w-btn" + (on[n.id] ? " primary" : " ghost") }, n.label);
      b.addEventListener("click", function () { on[n.id] = !on[n.id]; b.className = "w-btn" + (on[n.id] ? " primary" : " ghost"); paint(n.id); });
      controls.appendChild(b);
    });
    function paint(focus) {
      try {
        clear(stage);
        var flags = [];
        NS.forEach(function (n) { if (on[n.id]) flags.push("--" + n.id); });
        stage.appendChild(term("$ sudo unshare " + (flags.length ? flags.join(" ") : "(no namespaces)") + (on.pid ? " --fork --mount-proc" : "") + " sh"));
        var g = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:10px" });
        NS.forEach(function (n) {
          var box = h("div", {});
          box.appendChild(h("div", { style: "font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:" + (on[n.id] ? "var(--accent-ink)" : "var(--text-faint)") + ";margin:2px 0 4px" },
            n.label + (on[n.id] ? " namespace: isolated" : " namespace: shared with host")));
          box.appendChild(term(on[n.id] ? n.inner : n.host));
          g.appendChild(box);
        });
        stage.appendChild(g);
        clear(readout);
        readout.appendChild(ro("isolated", flags.length + " / 7"));
        var f = null;
        NS.forEach(function (n) { if (n.id === focus) f = n; });
        readout.appendChild(roLine(f ? f.label + ": " + f.why : "Each namespace isolates one kind of global resource. Toggle one to see its effect."));
      } catch (e) { clear(readout); readout.appendChild(roLine("Could not render namespaces.")); }
    }
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint(null);
  };

  /* ==================================================================
     2. contOverlay — copy-up and whiteouts
  ================================================================== */
  Widgets.contOverlay = function (mount) {
    shell(mount, "simulator", "overlayfs: layers, copy-up and whiteouts",
      "Two read-only image layers sit under a writable upper layer. Perform file operations in the container and watch what lands in the upper directory and what the merged view shows.");
    var st;
    function reset() {
      st = {
        lower1: { "/etc/os-release": "Base 12", "/usr/bin/curl": "(binary 240 KB)", "/etc/app.conf": "port=8080" },
        lower2: { "/srv/app/server.js": "(app code)", "/etc/app.conf": "port=9000" },
        upper: {},
        whiteouts: {}
      };
    }
    reset();
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function merged() {
      var m = {}, k;
      for (k in st.lower1) m[k] = [st.lower1[k], "lower 1 (base)"];
      for (k in st.lower2) m[k] = [st.lower2[k], "lower 2 (app)"];
      for (k in st.whiteouts) delete m[k];
      for (k in st.upper) m[k] = [st.upper[k], "upper (container)"];
      return m;
    }
    function act(kind) {
      var msg, m = merged();
      if (kind === "read") msg = m["/etc/app.conf"] ? "cat /etc/app.conf → " + m["/etc/app.conf"][0] + ", served from " + m["/etc/app.conf"][1] + ". The topmost layer wins; reads never copy anything." : "cat: /etc/app.conf: No such file or directory";
      else if (kind === "edit") {
        if (!m["/etc/app.conf"]) msg = "Nothing to edit: the file was deleted.";
        else { st.upper["/etc/app.conf"] = "port=9443"; delete st.whiteouts["/etc/app.conf"]; msg = "sed -i on /etc/app.conf → copy-up: the whole file is copied into upper, then modified. Lower layers are untouched, so the image stays shareable."; }
      } else if (kind === "rm") {
        if (!m["/usr/bin/curl"]) msg = "/usr/bin/curl is already gone from the merged view.";
        else { delete st.upper["/usr/bin/curl"]; st.whiteouts["/usr/bin/curl"] = true; msg = "rm /usr/bin/curl → a whiteout (a 0/0 character device) is created in upper to hide the lower file. The image does not get smaller: the bytes still live in lower 1."; }
      } else if (kind === "new") {
        st.upper["/var/log/app.log"] = "(1.2 GB of logs)"; msg = "Writing logs inside the container → they land in upper, on the host's disk under the runtime's storage directory, and vanish with the container. Use a volume for data you keep.";
      }
      paint(msg);
    }
    function paint(msg) {
      try {
        clear(stage);
        var m = merged(), keys = Object.keys(m).sort();
        function list(obj) { var a = Object.keys(obj).sort(); return a.length ? a.map(function (k) { return k + "  " + obj[k]; }).join("\n") : "(empty)"; }
        var up = {};
        for (var u in st.upper) up[u] = st.upper[u];
        for (var w in st.whiteouts) up[w] = "c--------- 0,0  (whiteout)";
        var g = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px" });
        [["merged view (what the container sees)", keys.map(function (k) { return k + "  " + m[k][0] + "   ← " + m[k][1]; }).join("\n")],
         ["upperdir (writable, per container)", list(up)],
         ["lowerdir 2 (image layer, read-only)", list(st.lower2)],
         ["lowerdir 1 (image layer, read-only)", list(st.lower1)]].forEach(function (p) {
          g.appendChild(h("div", {}, h("div", { style: "font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-faint);margin:2px 0 4px" }, p[0]), term(p[1])));
        });
        stage.appendChild(g);
        clear(readout);
        readout.appendChild(ro("files visible", keys.length));
        readout.appendChild(ro("upper entries", Object.keys(up).length));
        readout.appendChild(roLine(msg || "mount -t overlay overlay -o lowerdir=L2:L1,upperdir=U,workdir=W /merged"));
      } catch (e) { clear(readout); readout.appendChild(roLine("Could not render layers.")); }
    }
    var c = h("div", { class: "widget-controls" });
    [["read", "cat /etc/app.conf"], ["edit", "edit /etc/app.conf"], ["rm", "rm /usr/bin/curl"], ["new", "write /var/log/app.log"]].forEach(function (p) {
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
    "cont-iso": {
      title: "Containers under the hood checkpoint",
      sub: "Namespaces, cgroups, overlayfs and building a container by hand.",
      questions: [
        {
          q: "Which kernel feature makes a containerised process believe it is PID 1?",
          options: ["cgroups", "The PID namespace", "overlayfs", "seccomp"],
          answer: 1,
          explain: "A new PID namespace starts its own numbering, so the first process inside is PID 1 and host processes are invisible. On the host the same process has an ordinary PID. cgroups limit resources; they do not change what a process sees."
        },
        {
          q: "A container has `memory.max` set to 512M. What happens when its processes try to use more?",
          options: ["The host swaps the whole container out", "The kernel reclaims within the cgroup, and if that fails the OOM killer kills a process inside it", "The container is paused", "Nothing; limits are advisory"],
          answer: 1,
          explain: "memory.max is a hard limit enforced by the memory controller. The kernel first reclaims page cache charged to the cgroup, then invokes the OOM killer scoped to that cgroup. memory.events counts oom and oom_kill events, and the runtime reports OOMKilled."
        },
        {
          q: "A service in a container shows low average CPU but suffers latency spikes. cpu.stat shows nr_throttled rising. What is going on?",
          options: ["The host is out of memory", "The cgroup's CPU quota (cpu.max) is being exhausted within each period, so its threads wait until the next period", "Disk I/O is slow", "The container has too many namespaces"],
          answer: 1,
          explain: "CFS bandwidth control gives a cgroup a quota per period, often 100 ms. A multi-threaded burst can use the whole quota early and then sit throttled for the rest of the period. Raise the limit, reduce parallelism, or rely on CPU shares (weight) instead of hard quotas."
        },
        {
          q: "You delete a 300 MB file inside a running container that came from the image. What happens to disk usage?",
          options: ["It drops by 300 MB", "Nothing is freed: overlayfs records a whiteout in the upper layer while the bytes remain in the read-only image layer", "The image is rewritten", "The container restarts"],
          answer: 1,
          explain: "Lower layers are read-only and shared between containers, so deletion only hides the file in the merged view. The same applies inside a Dockerfile: deleting in a later layer does not shrink the image. Remove files in the same build step that created them."
        },
        {
          q: "Why does Docker on macOS run a Linux virtual machine?",
          options: ["For licensing reasons", "Containers share the host kernel, and namespaces and cgroups are Linux kernel features that macOS does not have", "To speed up builds", "Because macOS has no network stack"],
          answer: 1,
          explain: "A Linux container is a Linux process using Linux kernel isolation features. macOS has a different kernel, so desktop container tools run a lightweight Linux VM and forward files and ports into it. That is also why bind-mount performance and file watching differ on a Mac."
        },
        {
          q: "What is the purpose of `pivot_root` (or chroot) when building a container by hand?",
          options: ["To limit CPU", "To make the image's root filesystem the process's / so host files are not visible", "To assign an IP address", "To enable user namespaces"],
          answer: 1,
          explain: "Inside a new mount namespace, pivot_root swaps the root to the extracted image filesystem and lets you unmount the old root completely. chroot only changes path resolution and is easier to escape. Together with the other namespaces it gives the process its own view of the filesystem."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.cont = {
    id: "cont",
    name: "Containers Under the Hood",
    short: "CTR",
    tagline: "Namespaces, cgroups and layered filesystems",
    color: "#22d3ee",
    blurb: "Containers are not tiny VMs: they are Linux processes with their own namespaces, resource limits from cgroups, and a layered root filesystem from overlayfs. See each mechanism on its own, then assemble a container by hand from plain kernel features.",
    modules: [
      {
        id: "iso",
        name: "Isolation primitives",
        icon: "cube",
        lessons: [
          {
            id: "namespaces",
            title: "Namespaces",
            summary: "The seven main namespace types, unshare and nsenter, how container networking uses veth pairs, and user namespaces.",
            minutes: 11,
            tags: ["namespaces", "unshare", "nsenter"],
            blocks: [
              { t: "p", html: "A <b>namespace</b> wraps a global system resource so that processes inside it see their own isolated instance. Docker, Podman, containerd and Kubernetes all build on the same handful of kernel namespaces. For the Docker and Kubernetes tooling itself, see the container track in the Forge academy; this lesson is about the kernel underneath." },
              { t: "diagram", id: "namespaces-cgroups", caption: "Namespaces decide what a process can see; cgroups decide how much it may use." },
              { t: "table", headers: ["Namespace", "Isolates", "Flag"], rows: [
                ["pid", "Process IDs", "<code>--pid</code>"],
                ["net", "Interfaces, routes, iptables, ports", "<code>--net</code>"],
                ["mnt", "Mount table", "<code>--mount</code>"],
                ["uts", "Hostname", "<code>--uts</code>"],
                ["ipc", "System V IPC, POSIX queues", "<code>--ipc</code>"],
                ["user", "UID and GID mappings, capabilities", "<code>--user</code>"],
                ["cgroup", "View of the cgroup hierarchy", "<code>--cgroup</code>"],
                ["time", "Boot and monotonic clocks", "<code>--time</code>"]
              ] },
              { t: "widget", id: "contNamespaces" },
              { t: "code", lang: "bash", code: "lsns                                   # namespaces on the host and their owners\nls -l /proc/$$/ns                      # this shell's namespace handles\nsudo unshare --uts --fork sh -c 'hostname lab; hostname'   # lab, host unaffected\n\n# Enter a running container's network namespace with host tools\npid=$(docker inspect -f '{{.State.Pid}}' web)\nsudo nsenter -t \"$pid\" -n ip addr\nsudo nsenter -t \"$pid\" -n ss -tlnp\nsudo nsenter -t \"$pid\" -n tcpdump -ni eth0 port 8080" },
              { t: "h", text: "How container networking is wired" },
              { t: "p", html: "The runtime creates a network namespace and a <b>veth pair</b>, a virtual cable. One end becomes <code>eth0</code> inside the container; the other attaches to a host bridge such as <code>docker0</code>. Outbound traffic is NATed by iptables or nftables MASQUERADE rules; published ports are DNAT rules." },
              { t: "note", variant: "tip", html: "<code>nsenter -n</code> is the cleanest way to debug a minimal container image that has no <code>ip</code>, <code>ss</code> or <code>curl</code>: you run the host's binaries inside the container's network view." },
              { t: "note", variant: "warn", html: "Namespaces isolate visibility, not the kernel itself. Every container shares the host kernel, so a kernel vulnerability or an over-privileged container (<code>--privileged</code>, host PID or network namespace, a mounted Docker socket) can reach the host." },
              { t: "cue", html: "<b>In the field:</b> user namespaces make root inside a container an unprivileged UID outside. Rootless Podman and Docker use them; check the mapping in <code>/proc/PID/uid_map</code>." },
              { t: "note", variant: "tip", html: "Namespaces are a Linux kernel feature; macOS has nothing equivalent. Every container on a Mac really runs inside a lightweight Linux VM (Docker Desktop, Colima, OrbStack), so try <code>unshare</code> and <code>nsenter</code> in a Linux VM." },
              { t: "note", variant: "key", html: "Namespaces give a process private views of PIDs, network, mounts, hostname, IPC, users and cgroups; nsenter lets you debug inside them with host tools." }
            ]
          },
          {
            id: "cgroups",
            title: "cgroups v2",
            summary: "The unified hierarchy, CPU, memory, I/O and PID controllers, throttling and OOM inside a cgroup, and systemd slices.",
            minutes: 10,
            tags: ["cgroups", "limits", "throttling"],
            blocks: [
              { t: "p", html: "<b>Control groups</b> organise processes into a tree and let controllers account for and limit what each group uses. cgroup v2, the default on current distributions, has a single unified hierarchy under <code>/sys/fs/cgroup</code>." },
              { t: "code", lang: "bash", code: "stat -fc %T /sys/fs/cgroup            # cgroup2fs means v2\ncat /proc/2210/cgroup                  # 0::/system.slice/orders.service\ncd /sys/fs/cgroup/system.slice/orders.service\ncat memory.max memory.current memory.events\ncat cpu.max cpu.stat                   # quota period; nr_throttled, throttled_usec\ncat pids.max pids.current\nsystemd-cgtop                          # top-like view per cgroup" },
              { t: "table", headers: ["File", "Controls", "Example"], rows: [
                ["<code>cpu.max</code>", "Quota per period (hard cap)", "<code>50000 100000</code> = half a CPU"],
                ["<code>cpu.weight</code>", "Relative share under contention", "100 default; 200 = twice the share"],
                ["<code>memory.max</code>", "Hard limit; OOM inside the group", "<code>512M</code>"],
                ["<code>memory.high</code>", "Throttle and reclaim above this", "<code>400M</code>"],
                ["<code>io.max</code>", "Per-device bandwidth / IOPS caps", "<code>8:0 rbps=10485760</code>"],
                ["<code>pids.max</code>", "Maximum tasks", "Stops fork bombs"]
              ] },
              { t: "h", text: "Two surprises worth knowing" },
              { t: "ul", items: [
                "<b>CPU throttling</b>: with <code>cpu.max</code>, a burst of threads can spend a 100 ms period's quota in 20 ms and then wait 80 ms. Averages look low while p99 latency suffers. Watch <code>nr_throttled</code>.",
                "<b>Memory is charged with page cache</b>: files a container reads count toward its memory usage. Usually reclaimable, but it surprises people who read memory.current as heap size."
              ] },
              { t: "code", lang: "bash", code: "# The same knobs through systemd (persisted in drop-ins)\nsudo systemctl set-property orders.service MemoryMax=2G CPUQuota=150% TasksMax=512\nsystemd-run --scope -p MemoryMax=300M -p CPUQuota=50% ./batch-job.sh\n\n# Container runtimes write the same files\ndocker run --memory 512m --cpus 1.5 --pids-limit 256 app:1.4" },
              { t: "note", variant: "trap", html: "Many runtimes and libraries read the host's CPU count and memory, not the cgroup's, and size thread pools or heaps accordingly. Modern JVMs and Go respect cgroup limits; older software may not, and sizes itself to the whole host." },
              { t: "note", variant: "tip", html: "PSI exists per cgroup too: <code>memory.pressure</code> and <code>cpu.pressure</code> show how much time a single service spent stalled." },
              { t: "cue", html: "<b>In the field:</b> before raising a container's CPU limit to fix latency, read <code>cpu.stat</code>. If throttling is zero, the limit is not your problem." },
              { t: "code", lang: "bash", code: "cat /proc/self/cgroup                              # 0::/user.slice/... on cgroup v2\nsystemd-cgtop                                      # live CPU, memory and I/O per cgroup\ncat /sys/fs/cgroup/system.slice/orders.service/memory.events\n# oom_kill 3   <- this service hit MemoryMax three times\nsystemctl set-property orders.service CPUQuota=150% MemoryMax=2G" },
              { t: "note", variant: "tip", html: "macOS has no cgroups. Docker Desktop's resource sliders set the limits of its Linux VM, and per-container <code>--memory</code> and <code>--cpus</code> limits are enforced by cgroups inside that VM." },
              { t: "note", variant: "key", html: "cgroups account and limit CPU, memory, I/O and PIDs per group; watch throttling and memory events, and set limits through systemd or the runtime." }
            ]
          },
          {
            id: "overlayfs",
            title: "overlayfs and image layers",
            summary: "Lower, upper and merged directories, copy-up, whiteouts, why deleting files does not shrink images, and where container data lives.",
            minutes: 9,
            tags: ["overlayfs", "layers", "images"],
            blocks: [
              { t: "p", html: "A container image is a stack of read-only layers. At runtime, <b>overlayfs</b> merges them under a thin writable layer so the container sees one ordinary filesystem, while dozens of containers share the same image bytes on disk." },
              { t: "code", lang: "bash", code: "sudo mount -t overlay overlay \\\n  -o lowerdir=/img/l2:/img/l1,upperdir=/ctr/upper,workdir=/ctr/work /ctr/merged\nfindmnt -t overlay                        # running containers' mounts\ndocker inspect -f '{{json .GraphDriver.Data}}' web | jq ." },
              { t: "widget", id: "contOverlay" },
              { t: "table", headers: ["Operation", "What overlayfs does"], rows: [
                ["Read", "Serve the file from the topmost layer that has it"],
                ["Modify a lower file", "Copy-up: copy the whole file to upper, then write"],
                ["Delete a lower file", "Create a whiteout in upper to hide it"],
                ["Create a file", "Write it in upper only"],
                ["Remove the container", "Delete upper; lower layers untouched"]
              ] },
              { t: "note", variant: "trap", html: "Copy-up copies the <i>whole</i> file. A container that appends to a large file shipped in the image (a database file, a big log) triggers a full copy on first write, a slow surprise and a doubling of disk use." },
              { t: "note", variant: "warn", html: "Deleting a file in a later Dockerfile instruction does not shrink the image; the bytes remain in the earlier layer. Download, use and delete in the same RUN step, or use a multi-stage build." },
              { t: "h", text: "Where data should live" },
              { t: "p", html: "The upper layer is per container and disappears with it. Persistent data belongs in volumes or bind mounts, which bypass overlayfs entirely and perform like the underlying disk. Container logs written to stdout go to the runtime's log driver, not the upper layer." },
              { t: "cue", html: "<b>In the field:</b> a host disk filling under <code>/var/lib/docker</code> or <code>/var/lib/containerd</code> is usually unused images, stopped containers' upper layers, or logs. <code>docker system df</code> breaks it down." },
              { t: "h", text: "Looking at the layers" },
              { t: "code", lang: "bash", code: "docker image history --no-trunc shop/api:1.4      # which instruction made which layer\ndocker inspect -f '{{json .GraphDriver.Data}}' shop-api | jq\n# LowerDir: read-only image layers, UpperDir: this container's writes, MergedDir: what it sees\nmount -t overlay                                   # overlay mounts on the host\ndocker system df -v                                # space per image, container and volume" },
              { t: "ul", items: [
                  "Deleting a file in a later layer only hides it with a <b>whiteout</b>; the bytes stay in the image. Remove secrets and caches in the same <code>RUN</code> that created them.",
                  "Writing to a big file copies the whole file up into UpperDir first (copy-up). Put databases and logs on volumes.",
                  "Order instructions from least to most frequently changing so the build cache keeps the early layers."
                ] },
              { t: "note", variant: "tip", html: "On macOS, Docker Desktop runs a Linux VM. The overlay mounts live inside that VM, not on your Mac's disk, so <code>mount -t overlay</code> on the Mac shows nothing." },
              { t: "note", variant: "key", html: "Images are read-only layers merged under a writable upper; writes copy up, deletes leave whiteouts, and anything you want to keep goes in a volume." }
            ]
          },
          {
            id: "container-by-hand",
            title: "A container by hand",
            summary: "Assemble a container from an image rootfs, namespaces, a cgroup, pivot_root and dropped privileges, then compare with what runtimes add.",
            minutes: 11,
            tags: ["unshare", "pivot_root", "runtimes"],
            blocks: [
              { t: "p", html: "Once you have built a container from plain kernel features, runtimes stop being magic. This walk-through uses a Linux VM you are free to break; run it as root, and never on a production host." },
              { t: "code", lang: "bash", code: "# 1. A root filesystem: export one from any image\nmkdir -p /tmp/ctr/rootfs\ndocker export $(docker create alpine:3.20) | tar -x -C /tmp/ctr/rootfs\n\n# 2. A cgroup with limits\nmkdir /sys/fs/cgroup/handmade\necho 100M > /sys/fs/cgroup/handmade/memory.max\necho \"50000 100000\" > /sys/fs/cgroup/handmade/cpu.max\necho 64 > /sys/fs/cgroup/handmade/pids.max\necho $$ > /sys/fs/cgroup/handmade/cgroup.procs     # this shell and its children\n\n# 3. New namespaces, then switch root inside them\nunshare --pid --fork --mount --uts --ipc --net --mount-proc=/tmp/ctr/rootfs/proc \\\n  chroot /tmp/ctr/rootfs /bin/sh -c 'hostname handmade; exec /bin/sh'\n\n# inside: ps shows PID 1, hostname is handmade, ip addr shows only lo" },
              { t: "note", variant: "tip", html: "This uses <code>chroot</code> for brevity. Real runtimes use <code>pivot_root</code> in the new mount namespace and then unmount the old root, so there is no path back to host files." },
              { t: "h", text: "Giving it a network" },
              { t: "code", lang: "bash", code: "# On the host, with PID = the unshared shell's host PID\nip link add veth-h type veth peer name veth-c\nip link set veth-c netns \"$PID\"\nip addr add 10.99.0.1/24 dev veth-h && ip link set veth-h up\nnsenter -t \"$PID\" -n sh -c 'ip addr add 10.99.0.2/24 dev veth-c; ip link set veth-c up; ip link set lo up; ip route add default via 10.99.0.1'\nsysctl -w net.ipv4.ip_forward=1\nnft add table ip nat\nnft add chain ip nat post '{ type nat hook postrouting priority 100; }'\nnft add rule ip nat post ip saddr 10.99.0.0/24 masquerade" },
              { t: "h", text: "What a real runtime adds" },
              { t: "table", headers: ["Layer", "Purpose"], rows: [
                ["overlayfs layers", "Shared, cached image storage instead of a copied rootfs"],
                ["Dropped capabilities", "Root inside cannot load modules, change the clock, etc."],
                ["seccomp profile", "Blocks dangerous system calls"],
                ["AppArmor / SELinux label", "Mandatory access control on files and operations"],
                ["User namespace (rootless)", "Root inside maps to an unprivileged host UID"],
                ["Init and signal handling", "Optional tiny init as PID 1 to reap zombies"],
                ["OCI spec", "A standard config.json that runc, crun and others execute"]
              ] },
              { t: "note", variant: "warn", html: "Each item in that table is a security boundary. Flags like <code>--privileged</code> or <code>--cap-add=SYS_ADMIN</code> remove several at once; treat them as giving the container root on the host." },
              { t: "cue", html: "<b>In the field:</b> <code>runc spec</code> generates an OCI config.json; reading it is the fastest way to see every namespace, mount, capability and limit a runtime applies." },
              { t: "note", variant: "tip", html: "Run this exercise in a disposable Linux VM. It needs root and a Linux kernel. On a Mac, <code>multipass launch</code>, <code>lima</code> or a Docker Desktop privileged container gives you one in a minute." },
              { t: "quiz", id: "cont-iso" },
              { t: "note", variant: "key", html: "A container is a process with namespaces, a cgroup and a new root; runtimes add layered storage plus capability, seccomp and MAC restrictions on top." }
            ]
          }
        ]
      }
    ]
  };
})();
