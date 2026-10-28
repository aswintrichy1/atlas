/* =====================================================================
   KERNEL · Terminal lab
   window.KernelSimulator = { mount(main) }

   A fully local, scripted terminal. Typed commands are matched against
   each scenario's table of patterns and answered with canned output; no
   command is ever executed and nothing is fetched. Progress is stored in
   localStorage under kn_sim_v1.
   ===================================================================== */
(function () {
  "use strict";

  var STORE = "kn_sim_v1";

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
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }

  function load() {
    try { var v = JSON.parse(localStorage.getItem(STORE) || "{}"); return v && typeof v === "object" ? v : {}; }
    catch (e) { return {}; }
  }
  function save(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

  /* ------------------------------------------------------------------
     Scenarios. cmds: [pattern, output | function(state)]; the first
     matching pattern wins. clue:true marks evidence that counts toward
     progress. fixes: [pattern, message] set state.fixed.
  ------------------------------------------------------------------ */
  var SCENARIOS = [
    {
      id: "disk-full",
      title: "Disk full, but nothing to delete",
      level: "Intermediate",
      host: "web1", user: "ops",
      brief: "PagerDuty: / on web1 is 100% full and the app is failing writes. A colleague already deleted the big log file, but the disk is still full.",
      goal: "Find what is holding the space, free it without an outage, and confirm.",
      hints: ["Start with df -h to confirm which filesystem is full.", "Compare with du: sudo du -xh --max-depth=1 / | sort -h", "When du and df disagree, look for deleted files that are still open: sudo lsof +L1", "Truncate through the process's descriptor: : > /proc/2210/fd/7 (or restart the service)."],
      cmds: [
        [/^(sudo )?df( -h| -hT)?( \/)?$/, function (s) { return s.fixed ?
          "Filesystem      Size  Used Avail Use% Mounted on\n/dev/nvme0n1p1   50G  6.4G   44G  13% /" :
          "Filesystem      Size  Used Avail Use% Mounted on\n/dev/nvme0n1p1   50G   50G     0 100% /"; }, true],
        [/^(sudo )?df -i/, "Filesystem      Inodes  IUsed   IFree IUse% Mounted on\n/dev/nvme0n1p1 3276800 151234 3125566    5% /"],
        [/^(sudo )?du .*/, "1.1G\t/usr/lib\n1.9G\t/usr\n3.1G\t/var\n6.4G\t/", true],
        [/^(sudo )?lsof \+L1|^(sudo )?lsof .*deleted/, function (s) { return s.fixed ? "(no output)" :
          "COMMAND  PID USER FD  TYPE DEVICE SIZE/OFF NLINK  NODE NAME\njava    2210  app  7w  REG  259,1  44.1G     0  1311 /var/log/app/app.log (deleted)"; }, true],
        [/^ls -l \/proc\/2210\/fd\/?7?$/, "l-wx------ 1 app app 64 Oct 28 09:02 7 -> /var/log/app/app.log (deleted)", true],
        [/^(sudo )?ls( -l| -lh| -la)? \/var\/log\/app\/?$/, "total 0\n(app.log was deleted earlier)"],
        [/^(sudo )?systemctl status app/, "● app.service - Orders app\n     Active: active (running) since Mon 2026-10-26 07:00:12 UTC; 2 days ago\n   Main PID: 2210 (java)\nOct 28 09:40:01 web1 app[2210]: ERROR write failed: No space left on device"],
        [/^(sudo )?journalctl/, "Oct 28 09:40:01 web1 app[2210]: ERROR write failed: No space left on device\nOct 28 09:40:02 web1 app[2210]: ERROR write failed: No space left on device"],
        [/^(sudo )?cat \/etc\/logrotate\.d\/app$/, "/var/log/app/*.log {\n    daily\n    rotate 7\n    compress\n    # missing: copytruncate or a postrotate reopen\n}"]
      ],
      fixes: [
        [/^(sudo )?(sh -c ')?(: ?>|truncate -s ?0) ?\/proc\/2210\/fd\/7'?$/, "Truncated the deleted file through its descriptor. Space is released immediately and the app keeps running."],
        [/^(sudo )?systemctl restart app/, "Restarted app: the old descriptor is closed, so the kernel frees the deleted file. (A short blip for users.)"],
        [/^(sudo )?kill -(HUP|USR1) 2210$/, "The app reopened its log file; the old deleted inode has no more references and is freed."]
      ],
      diag: { q: "What was holding the space?", options: ["Inode exhaustion from small files", "A deleted log file still held open by the java process", "Docker images under /var/lib/docker", "A full /boot partition"], answer: 1,
        explain: "du could not see it because the file has no name any more, but its inode is still referenced by PID 2210's descriptor 7. Prevent a repeat with copytruncate or a postrotate reopen in logrotate." }
    },
    {
      id: "port-refused",
      title: "Works on the box, refused from outside",
      level: "Beginner",
      host: "api1", user: "ops",
      brief: "The new orders API answers curl on api1 itself, but the load balancer marks it down and clients get 'Connection refused'.",
      goal: "Find why remote connections are refused, fix it and verify.",
      hints: ["Is anything listening, and on which address? ss -tlnp", "Look at the Local Address column: 127.0.0.1 only accepts loopback connections.", "Check the service's config file: cat /etc/orders/orders.yaml", "Fix the bind address with sed and restart the service."],
      cmds: [
        [/^curl( -v| -sv)? (http:\/\/)?(localhost|127\.0\.0\.1):8080/, "HTTP/1.1 200 OK\n{\"status\":\"ok\"}"],
        [/^curl( -v| -sv)? (http:\/\/)?(10\.0\.4\.21|api1(\.lab\.example)?):8080/, function (s) { return s.fixed ? "*   Trying 10.0.4.21:8080...\n* Connected to 10.0.4.21 port 8080\n< HTTP/1.1 200 OK\n{\"status\":\"ok\"}" :
          "*   Trying 10.0.4.21:8080...\n* connect to 10.0.4.21 port 8080 failed: Connection refused\ncurl: (7) Failed to connect to 10.0.4.21 port 8080: Connection refused"; }, true],
        [/^(sudo )?ss -[a-z]*l[a-z]*/, function (s) { return "State  Recv-Q Send-Q  Local Address:Port  Peer Address:Port Process\nLISTEN 0      128           0.0.0.0:22         0.0.0.0:*     users:((\"sshd\",pid=812))\nLISTEN 0      511     " + (s.fixed ? "      0.0.0.0" : "    127.0.0.1") + ":8080         0.0.0.0:*     users:((\"orders\",pid=3301))"; }, true],
        [/^(sudo )?(lsof|netstat)/, function (s) { return "orders 3301 orders 6u IPv4 TCP " + (s.fixed ? "*" : "127.0.0.1") + ":8080 (LISTEN)"; }, true],
        [/^(sudo )?cat \/etc\/orders\/orders\.ya?ml$/, function (s) { return "server:\n  listen: " + (s.fixed ? "0.0.0.0" : "127.0.0.1") + "\n  port: 8080\nlog_level: info"; }, true],
        [/^(sudo )?(iptables -[SL]|nft list ruleset)/, "table inet filter {\n  chain input { type filter hook input priority 0; policy accept; }\n}\n(no blocking rules)"],
        [/^(sudo )?systemctl status orders/, "● orders.service - Orders API\n     Active: active (running) since Wed 2026-10-28 08:55:01 UTC; 40min ago\n   Main PID: 3301 (orders)"]
      ],
      fixes: [
        [/^(sudo )?sed -i.*127\.0\.0\.1.*0\.0\.0\.0.*orders\.ya?ml.*$/, "Updated listen address to 0.0.0.0 in /etc/orders/orders.yaml. Restart the service to apply it.", "pending"],
        [/^(sudo )?systemctl restart orders/, function (s) { return s.pending ? "Restarted orders. It now listens on all interfaces." : "Restarted orders, but the config still says 127.0.0.1, so nothing changed."; }]
      ],
      fixWhen: function (s) { return !!s.pending && /restart orders/.test(s.lastCmd || ""); },
      diag: { q: "Why were remote connections refused?", options: ["A firewall rule dropped them", "The service was bound to 127.0.0.1, so the kernel answered remote SYNs with RST", "DNS resolved api1 to the wrong address", "The accept queue was full"], answer: 1,
        explain: "A dropping firewall gives a timeout, not a refusal. Refused means the host answered with RST because no socket listened on that address and port: only the loopback address was bound." }
    },
    {
      id: "dns-broken",
      title: "Could not resolve host",
      level: "Beginner",
      host: "build3", user: "ci",
      brief: "CI jobs on build3 fail with 'Could not resolve host: pkg.mirror.example'. Other build hosts are fine.",
      goal: "Find why name resolution fails on this host only, fix it and verify.",
      hints: ["Reproduce: curl -sI https://pkg.mirror.example", "Which resolver does the host use? cat /etc/resolv.conf", "Test that server directly, and a known-good one: dig @10.0.0.99 pkg.mirror.example vs dig @10.0.0.2 pkg.mirror.example", "Point the host at the working resolver (edit resolv.conf or resolvectl dns)."],
      cmds: [
        [/^curl .*pkg\.mirror\.example/, function (s) { return s.fixed ? "HTTP/2 200\ncontent-type: text/html" : "curl: (6) Could not resolve host: pkg.mirror.example"; }, true],
        [/^ping .*pkg\.mirror\.example/, function (s) { return s.fixed ? "PING pkg.mirror.example (198.51.100.80) 56(84) bytes of data.\n64 bytes from 198.51.100.80: icmp_seq=1 ttl=57 time=11.2 ms" : "ping: pkg.mirror.example: Temporary failure in name resolution"; }],
        [/^cat \/etc\/resolv\.conf$/, function (s) { return "# managed by hand (legacy)\nnameserver " + (s.fixed ? "10.0.0.2" : "10.0.0.99") + "\nsearch lab.example"; }, true],
        [/^(dig|nslookup) @?10\.0\.0\.99.*|^dig .*@10\.0\.0\.99.*/, ";; communications error to 10.0.0.99#53: timed out\n;; no servers could be reached", true],
        [/^(dig|nslookup) @?10\.0\.0\.2.*|^dig .*@10\.0\.0\.2.*/, ";; ANSWER SECTION:\npkg.mirror.example.  300  IN  A  198.51.100.80\n;; SERVER: 10.0.0.2#53(10.0.0.2)", true],
        [/^(dig|nslookup|host) .*pkg\.mirror\.example/, function (s) { return s.fixed ? ";; ANSWER SECTION:\npkg.mirror.example.  300  IN  A  198.51.100.80\n;; SERVER: 10.0.0.2#53(10.0.0.2)" : ";; communications error to 10.0.0.99#53: timed out\n;; no servers could be reached"; }, true],
        [/^ping .*10\.0\.0\.99/, "PING 10.0.0.99 56(84) bytes of data.\nFrom 10.0.0.31 icmp_seq=1 Destination Host Unreachable\n(the old resolver was decommissioned last week)", true],
        [/^(resolvectl|systemd-resolve) status/, "resolvectl: systemd-resolved is not running on this host (resolv.conf is static)"],
        [/^cat \/etc\/hosts$/, "127.0.0.1 localhost\n10.0.0.31 build3.lab.example build3"]
      ],
      fixes: [
        [/^(sudo )?sed -i.*10\.0\.0\.99.*10\.0\.0\.2.*resolv\.conf$/, "Updated /etc/resolv.conf to use 10.0.0.2. New lookups use it immediately."],
        [/^(echo .*nameserver 10\.0\.0\.2.*\| ?sudo tee \/etc\/resolv\.conf|sudo resolvectl dns .*10\.0\.0\.2)$/, "Resolver set to 10.0.0.2."]
      ],
      diag: { q: "What broke name resolution on build3?", options: ["The mirror's DNS record was deleted", "build3's static resolv.conf points at a decommissioned resolver", "A firewall blocks HTTPS", "The search domain is wrong"], answer: 1,
        explain: "Other hosts resolve the name and a direct query to 10.0.0.2 works, so the record exists. build3 still uses 10.0.0.99, which no longer answers. Manage resolver settings centrally (DHCP or config management) so retired servers do not linger." }
    },
    {
      id: "oom-loop",
      title: "The service that keeps restarting",
      level: "Intermediate",
      host: "app2", user: "ops",
      brief: "orders on app2 restarts every few hours; users see 502s around each restart. The host has 16 GiB of RAM.",
      goal: "Prove why it dies and apply a durable fix.",
      hints: ["systemctl status orders shows how the last instance ended.", "Kernel log: journalctl -k | grep -i oom", "Compare the configured heap with host memory: systemctl cat orders and free -m", "Lower -Xmx in the unit (systemctl edit orders, or sed on the drop-in), daemon-reload, restart."],
      cmds: [
        [/^(sudo )?systemctl status orders/, function (s) { return s.fixed ? "● orders.service\n     Active: active (running) since 10:02:41; 3h ago\n   Main PID: 4410 (java)\n     Memory: 11.2G" :
          "● orders.service\n     Active: active (running) since 09:41:09; 2min ago\n    Process: 2210 ExecStart=/usr/bin/java -Xmx15g -jar /srv/orders.jar (code=killed, signal=KILL)\n   Main PID: 2290 (java)"; }, true],
        [/^(sudo )?(journalctl -k|dmesg).*/, "Oct 28 09:41:07 app2 kernel: Out of memory: Killed process 2210 (java) total-vm:21004112kB, anon-rss:15688204kB\nOct 28 09:41:07 app2 kernel: oom_reaper: reaped process 2210 (java)", true],
        [/^(sudo )?systemctl cat orders/, function (s) { return "# /etc/systemd/system/orders.service\n[Service]\nExecStart=/usr/bin/java -Xmx" + (s.fixed ? "10g" : "15g") + " -jar /srv/orders.jar\nRestart=on-failure"; }, true],
        [/^free( -m| -h)?$/, "               total        used        free      shared  buff/cache   available\nMem:           15987       14110         301          12        1576        1610\nSwap:              0           0           0", true],
        [/^ps .*(rss|java).*/, "  PID   RSS CMD\n 2290 13.9G /usr/bin/java -Xmx15g -jar /srv/orders.jar", true],
        [/^(sudo )?journalctl -u orders/, "Oct 28 09:41:09 app2 systemd[1]: orders.service: Main process exited, code=killed, status=9/KILL\nOct 28 09:41:09 app2 systemd[1]: orders.service: Failed with result 'oom-kill'."]
      ],
      fixes: [
        [/^(sudo )?sed -i.*Xmx15g.*Xmx(8|9|10|11)g.*orders\.service$/, "Lowered the heap in the unit file. Now run systemctl daemon-reload and restart.", "pending"],
        [/^(sudo )?systemctl edit orders/, "Opened a drop-in; you set ExecStart= (cleared) and ExecStart=/usr/bin/java -Xmx10g -jar /srv/orders.jar. Saved. (systemctl edit reloads for you.)", "pendingReloaded"],
        [/^(sudo )?systemctl daemon-reload$/, function (s) { if (s.pending) s.pendingReloaded = true; return "Reloaded unit files."; }],
        [/^(sudo )?systemctl restart orders/, function (s) { return s.pendingReloaded ? "Restarted orders with -Xmx10g. Leaves room for metaspace, threads, native memory and the OS." : s.pending ? "Restarted, but systemd still uses the cached unit: run systemctl daemon-reload first." : "Restarted orders. Nothing changed, so it will be OOM-killed again."; }]
      ],
      fixWhen: function (s) { return !!s.pendingReloaded && /restart/.test(s.lastCmd || ""); },
      diag: { q: "Why does orders keep dying?", options: ["A segfault in the JVM", "The kernel OOM killer: a 15 GiB heap plus JVM overhead does not fit in 16 GiB with the OS", "systemd's watchdog timeout", "Disk full"], answer: 1,
        explain: "status=9/KILL and the kernel's Out of memory line prove the OOM killer chose java. The heap alone is almost the whole host; non-heap memory pushes it over. Right-size the heap, then check for genuine leaks with a heap dump." }
    },
    {
      id: "perm-denied",
      title: "Permission denied on deploy",
      level: "Intermediate",
      host: "web2", user: "deploy",
      brief: "The deploy user's release script fails: 'cannot create directory /srv/app/releases/2026-10-28: Permission denied'. The releases directory is group-writable.",
      goal: "Find the exact component that denies access and grant the narrowest fix.",
      hints: ["Check who you are and your groups: id", "Check every component of the path: namei -l /srv/app/releases", "Look at the directory's group and mode: ls -ld /srv/app/releases", "Add deploy to the right group with usermod -aG (then a new login), or fix the group ownership."],
      cmds: [
        [/^id( deploy)?$/, function (s) { return s.fixed ? "uid=1002(deploy) gid=1002(deploy) groups=1002(deploy),1050(webapp)" : "uid=1002(deploy) gid=1002(deploy) groups=1002(deploy)"; }, true],
        [/^namei -l .*/, "f: /srv/app/releases\ndrwxr-xr-x root   root   /\ndrwxr-xr-x root   root   srv\ndrwxr-x--x root   webapp app\ndrwxrwsr-x webapp webapp releases", true],
        [/^ls -ld \/srv\/app\/releases\/?$/, "drwxrwsr-x 14 webapp webapp 4096 Oct 27 18:02 /srv/app/releases", true],
        [/^ls -ld \/srv\/app\/?$/, "drwxr-x--x 3 root webapp 4096 Oct 01 12:00 /srv/app"],
        [/^getfacl .*/, "# file: srv/app/releases\n# owner: webapp\n# group: webapp\n# flags: -s-\nuser::rwx\ngroup::rwx\nother::r-x"],
        [/^(mkdir|touch) .*releases.*/, function (s) { return s.fixed ? "(created)" : "mkdir: cannot create directory '/srv/app/releases/2026-10-28': Permission denied"; }, true],
        [/^getent group webapp$/, function (s) { return "webapp:x:1050:" + (s.fixed ? "deploy" : ""); }, true]
      ],
      fixes: [
        [/^sudo usermod -aG webapp deploy$/, "Added deploy to webapp. Group membership applies to new sessions: log out and in, or run newgrp webapp.", "pending"],
        [/^sudo usermod -G webapp deploy$/, "Careful: -G without -a REPLACES all supplementary groups. Here it happened to work, but use -aG.", "pending"],
        [/^(newgrp webapp|exit|su - deploy|sudo -iu deploy)$/, function (s) { return s.pending ? "New session started with the updated group list." : "New session, but nothing changed yet."; }],
        [/^sudo chmod (-R )?(777|o\+w).*/, "That would 'work' by giving every local user write access. Rejected: find the narrow fix."]
      ],
      fixWhen: function (s) { return !!s.pending && /^(newgrp webapp|exit|su - deploy|sudo -iu deploy)$/.test(s.lastCmd || ""); },
      diag: { q: "What denied the write?", options: ["The releases directory lacks group write", "deploy is not in the webapp group, so it only gets the 'others' permissions (r-x)", "An ACL mask", "The disk is read-only"], answer: 1,
        explain: "releases is drwxrwsr-x owned by webapp:webapp; deploy is neither the owner nor in the group, so the others class (r-x) applies. Adding deploy to webapp, plus the setgid bit already on the directory, gives correct shared ownership." }
    },
    {
      id: "io-load",
      title: "Load 30, CPUs idle",
      level: "Advanced",
      host: "db1", user: "ops",
      brief: "The database host db1 is sluggish: queries that take 5 ms now take seconds. Load average is around 30 on 8 cores, yet the CPU graph looks quiet.",
      goal: "Identify the resource and the culprit, and relieve it.",
      hints: ["uptime, then vmstat 1: look at r, b and wa.", "iostat -xz 1 shows per-device await and queue size.", "Who is doing the I/O? sudo iotop -o (or pidstat -d 1)", "Throttle or stop the offender: ionice, or stop the job, then move it to an off-peak timer."],
      cmds: [
        [/^uptime$/, function (s) { return s.fixed ? " 10:15:42 up 41 days, load average: 2.10, 9.80, 24.40" : " 10:05:42 up 41 days, load average: 30.12, 28.40, 19.05"; }, true],
        [/^vmstat( \d+)*$/, function (s) { return "procs ---memory--- ---io--- -----cpu-----\n r  b   free   buff   bi    bo   us sy id wa st\n" + (s.fixed ? " 2  0  2101  8890   40   120   18  4 77  1  0" : " 1 29  2210  8810 98200  410    3  2 51 44  0"); }, true],
        [/^iostat.*/, function (s) { return "Device   r/s   w/s   rkB/s  r_await aqu-sz %util\n" + (s.fixed ? "nvme1n1  140.0  80.0  5600.0   0.40   0.10  12.0" : "nvme1n1 1910.0  12.0 245000.0 151.30  47.80 100.0"); }, true],
        [/^(sudo )?(iotop|pidstat -d).*/, function (s) { return s.fixed ? "  PID  USER   DISK READ  COMMAND\n 1880 postgres 4.10 M/s  postgres: checkpointer" : "  PID  USER   DISK READ  COMMAND\n 9311 backup  238.7 M/s  tar -czf /mnt/backup/db.tgz /var/lib/postgresql\n 1880 postgres  1.20 M/s  postgres: checkpointer"; }, true],
        [/^ps .*(stat|D).*/, " STAT   PID CMD\n D    1902 postgres: worker\n D    1907 postgres: worker\n D    9311 tar -czf /mnt/backup/db.tgz /var/lib/postgresql"],
        [/^(top|htop).*/, "%Cpu(s):  3.0 us,  2.0 sy,  0.0 ni, 51.0 id, 44.0 wa,  0.0 hi,  0.0 si,  0.0 st\n  PID USER     S %CPU COMMAND\n 9311 backup   D  4.0 tar"],
        [/^(sudo )?systemctl list-timers.*/, "NEXT  LEFT  LAST                         PASSED  UNIT           ACTIVATES\n-     -     Wed 2026-10-28 09:30:00 UTC  35min   adhoc-backup   adhoc-backup.service"],
        [/^free.*/, "Mem:  31990  27900  2210  120  1880  3300"]
      ],
      fixes: [
        [/^(sudo )?ionice -c ?3 -p 9311$/, "tar now runs in the idle I/O class: it only gets disk time nobody else wants."],
        [/^(sudo )?kill( -TERM)? 9311$/, "Stopped the ad-hoc backup. Reschedule it for off-peak hours and back up from a replica or with the database's own tool."],
        [/^(sudo )?systemctl stop adhoc-backup.*/, "Stopped adhoc-backup.service."]
      ],
      diag: { q: "What is the bottleneck?", options: ["CPU saturation from queries", "Disk saturation on nvme1n1 caused by an ad-hoc tar backup reading the data directory", "Memory exhaustion and swapping", "Network loss to clients"], answer: 1,
        explain: "29 tasks blocked (b column), 44% iowait, await above 150 ms and a queue near 48 all point at the disk, and iotop names tar. Linux counts D-state tasks in load, which is why load is high while CPUs idle." }
    },
    {
      id: "tls-expired",
      title: "Certificate errors after the weekend",
      level: "Intermediate",
      host: "edge1", user: "ops",
      brief: "Monday morning: browsers show a security warning for shop.example and the mobile app cannot connect. Nothing was deployed.",
      goal: "Confirm the TLS failure, fix it properly and verify.",
      hints: ["Reproduce with curl -v https://shop.example/", "Inspect the served certificate: openssl s_client -connect shop.example:443 -servername shop.example", "Look at notAfter. Is renewal automated? systemctl list-timers | grep certbot", "Renew (sudo certbot renew), then reload nginx so it serves the new file."],
      cmds: [
        [/^curl .*shop\.example.*/, function (s) { return s.fixed ? "* SSL connection using TLSv1.3 / TLS_AES_256_GCM_SHA384\n* Server certificate:\n*  expire date: Jan 26 08:12:00 2027 GMT\n< HTTP/2 200" :
          "* SSL certificate problem: certificate has expired\ncurl: (60) SSL certificate problem: certificate has expired"; }, true],
        [/^(echo \| )?openssl s_client .*/, function (s) { return s.fixed ? "subject=CN = shop.example\nnotBefore=Oct 28 08:12:00 2026 GMT\nnotAfter=Jan 26 08:12:00 2027 GMT\nVerify return code: 0 (ok)" :
          "subject=CN = shop.example\nnotBefore=Jul 27 06:00:00 2026 GMT\nnotAfter=Oct 25 06:00:00 2026 GMT\nVerify return code: 10 (certificate has expired)"; }, true],
        [/^(sudo )?systemctl list-timers.*/, "NEXT LEFT LAST PASSED UNIT ACTIVATES\n(no certbot.timer: it was disabled during last month's migration)", true],
        [/^(sudo )?systemctl status certbot\.timer/, "○ certbot.timer - Run certbot twice daily\n     Loaded: loaded; disabled\n     Active: inactive (dead)", true],
        [/^date.*/, "Mon Oct 28 08:05:11 UTC 2026"],
        [/^(sudo )?nginx -t$/, "nginx: configuration file /etc/nginx/nginx.conf test is successful"]
      ],
      fixes: [
        [/^(sudo )?certbot renew.*/, "Congratulations, all renewals succeeded: /etc/letsencrypt/live/shop.example/fullchain.pem. nginx still serves the old certificate until reloaded.", "pending"],
        [/^(sudo )?systemctl (reload|restart) nginx$/, function (s) { return s.pending ? "nginx reloaded: the new certificate is live." : "nginx reloaded, but the certificate on disk is still the expired one."; }],
        [/^(sudo )?systemctl enable --now certbot\.timer$/, function (s) { s.timer = true; return "Created symlink timers.target.wants/certbot.timer. Renewal is automated again."; }]
      ],
      fixWhen: function (s) { return !!s.pending && /nginx/.test(s.lastCmd || ""); },
      diag: { q: "Root cause?", options: ["A clock skew on clients", "The certificate expired because the renewal timer was disabled during a migration", "A cipher mismatch", "DNS points to the wrong edge"], answer: 1,
        explain: "notAfter is in the past and verify code 10 means expired. Renew, reload, re-enable the timer, and add an expiry check (openssl x509 -checkend) to monitoring so it alerts weeks ahead." }
    }
  ];

  var COMMON = [
    [/^pwd$/, function (s, sc) { return "/home/" + sc.user; }],
    [/^whoami$/, function (s, sc) { return sc.user; }],
    [/^hostname( -f)?$/, function (s, sc) { return sc.host + ".lab.example"; }],
    [/^date$/, function () { return "Wed Oct 28 09:45:00 UTC 2026"; }],
    [/^ls( -la?)?$/, function () { return "notes.txt  runbook.md"; }],
    [/^cat (notes\.txt|runbook\.md)$/, function (s, sc) { return "# " + sc.title + "\n" + sc.goal; }],
    [/^echo (.*)$/, null]
  ];

  function norm(cmd) { return String(cmd || "").replace(/\s+/g, " ").trim(); }

  function mount(main) {
    clear(main);
    var progress = load();
    var page = h("article", { class: "sim-page lesson" });
    main.appendChild(page);

    page.appendChild(h("header", { class: "sim-hero" },
      h("div", { class: "sim-kicker" }, "Kernel · Terminal lab"),
      h("h1", {}, "Troubleshoot a broken box"),
      h("p", { class: "sim-lede" }, "Pick an incident, investigate in a simulated shell, name the root cause and apply a fix. Everything is scripted and local: no command runs on your machine. Type help for the built-in commands.")));

    var picker = h("div", { class: "sim-picker" });
    page.appendChild(picker);
    var grid = h("div", { class: "sim-grid" });
    page.appendChild(grid);
    var left = h("section", { class: "sim-card sim-term-card" });
    var right = h("aside", { class: "sim-card" });
    grid.appendChild(left);
    grid.appendChild(right);

    var screen = h("div", { class: "sim-screen", role: "log", "aria-live": "polite" });
    var input = h("input", { class: "sim-input", type: "text", spellcheck: "false", autocomplete: "off", "aria-label": "Terminal input" });
    var promptEl = h("span", { class: "sim-prompt" }, "");
    left.appendChild(h("div", { class: "sim-term-head" }, h("span", { class: "sim-dot3" }), h("span", { class: "sim-term-title" }, "")));
    left.appendChild(screen);
    left.appendChild(h("form", { class: "sim-input-row", onsubmit: function (e) { e.preventDefault(); run(input.value); input.value = ""; } }, promptEl, input,
      h("button", { type: "submit", class: "w-btn primary sim-run" }, "Run")));

    var sc = null, st = null, hist = [], hpos = 0;

    function out(text, cls) { screen.appendChild(h("pre", { class: "sim-line" + (cls ? " " + cls : "") }, text)); screen.scrollTop = screen.scrollHeight; }
    function promptText() { return sc.user + "@" + sc.host + ":~$ "; }

    function renderPicker() {
      clear(picker);
      SCENARIOS.forEach(function (s) {
        var done = progress.solved && progress.solved[s.id];
        picker.appendChild(h("button", { type: "button", class: "sim-pick" + (sc && sc.id === s.id ? " is-active" : ""), onclick: function () { start(s.id); } },
          h("span", { class: "sim-pick-level" }, s.level + (done ? " · solved" : "")),
          h("span", { class: "sim-pick-title" }, (done ? "✔ " : "") + s.title)));
      });
    }

    function renderSide(msg) {
      clear(right);
      right.appendChild(h("h2", { class: "sim-h" }, sc.title));
      right.appendChild(h("p", { class: "sim-muted" }, sc.brief));
      right.appendChild(h("p", { class: "sim-small" }, "Goal: " + sc.goal));
      var total = 0;
      sc.cmds.forEach(function (c) { if (c[2]) total++; });
      right.appendChild(h("div", { class: "w-readout" },
        h("span", { class: "ro" }, "evidence ", h("b", {}, Object.keys(st.clues).length + " / " + total)),
        h("span", { class: "ro" }, "fix ", h("b", {}, st.fixed ? "applied" : "not yet")),
        h("span", { class: "ro" }, "diagnosis ", h("b", {}, st.diag === null ? "open" : st.diag ? "correct" : "try again"))));
      right.appendChild(h("h3", { class: "sim-h3" }, "Hints"));
      var hl = h("ol", { class: "sim-hints" });
      for (var i = 0; i < st.hints; i++) hl.appendChild(h("li", {}, sc.hints[i]));
      right.appendChild(hl);
      right.appendChild(h("button", { type: "button", class: "w-btn ghost", onclick: function () {
        if (st.hints < sc.hints.length) st.hints++;
        renderSide();
      } }, st.hints < sc.hints.length ? "Show a hint (" + st.hints + "/" + sc.hints.length + ")" : "All hints shown"));
      right.appendChild(h("h3", { class: "sim-h3" }, "Diagnosis: " + sc.diag.q));
      var dl = h("div", { class: "sim-diag" });
      sc.diag.options.forEach(function (o, idx) {
        dl.appendChild(h("button", { type: "button", class: "w-btn" + (st.diagPick === idx ? (idx === sc.diag.answer ? " primary" : "") : " ghost"), onclick: function () {
          st.diagPick = idx;
          st.diag = idx === sc.diag.answer;
          checkSolved();
          renderSide(st.diag ? sc.diag.explain : "Not quite. Look at the evidence again; " + (Object.keys(st.clues).length < 2 ? "gather more first." : "what does it rule out?"));
        } }, o));
      });
      right.appendChild(dl);
      if (msg) right.appendChild(h("p", { class: "sim-small sim-msg" }, msg));
      if (st.solved) right.appendChild(h("p", { class: "sim-status is-passed" }, "Solved: root cause named and fix verified."));
      right.appendChild(h("div", { class: "sim-toolbar" },
        h("button", { type: "button", class: "w-btn", onclick: function () { start(sc.id); } }, "Restart scenario")));
    }

    function checkSolved() {
      if (st.fixed && st.diag && !st.solved) {
        st.solved = true;
        progress.solved = progress.solved || {};
        progress.solved[sc.id] = true;
        save(progress);
        renderPicker();
        out("# Incident resolved. Run the verification command again to see the healthy state.", "sim-ok");
      }
    }

    function run(raw) {
      var cmd = norm(raw);
      if (!sc) return;
      out(promptText() + cmd, "sim-cmd");
      if (!cmd) return;
      hist.push(cmd); hpos = hist.length;
      st.lastCmd = cmd;
      if (cmd === "clear") { clear(screen); return; }
      if (cmd === "help") { out("Built-ins: help, clear, hint, history, reset.\nEverything else is matched against this incident's script: try the commands you would run on a real host (df, du, ss, dig, curl, journalctl, systemctl, iostat, ...)."); return; }
      if (cmd === "hint") { if (st.hints < sc.hints.length) st.hints++; renderSide(); out(st.hints ? "Hint: " + sc.hints[st.hints - 1] : "No hints."); return; }
      if (cmd === "history") { out(hist.map(function (c, i) { return ("   " + (i + 1)).slice(-4) + "  " + c; }).join("\n")); return; }
      if (cmd === "reset") { start(sc.id); return; }
      var i, m;
      for (i = 0; i < sc.fixes.length; i++) {
        if (sc.fixes[i][0].test(cmd)) {
          var f = sc.fixes[i], res = typeof f[1] === "function" ? f[1](st) : f[1];
          if (f[2]) st[f[2]] = true;
          var fixedNow = sc.fixWhen ? sc.fixWhen(st) : !/^That would|^Careful|still|Nothing changed|nothing changed|Rejected/.test(res);
          if (fixedNow && !/Rejected/.test(res)) st.fixed = true;
          out(res, fixedNow ? "sim-ok" : "");
          checkSolved();
          renderSide();
          return;
        }
      }
      for (i = 0; i < sc.cmds.length; i++) {
        if (sc.cmds[i][0].test(cmd)) {
          var c = sc.cmds[i], text = typeof c[1] === "function" ? c[1](st) : c[1];
          if (c[2]) st.clues[i] = true;
          out(text);
          renderSide();
          return;
        }
      }
      for (i = 0; i < COMMON.length; i++) {
        if ((m = COMMON[i][0].exec(cmd))) {
          out(COMMON[i][1] ? COMMON[i][1](st, sc) : m[1].replace(/^["']|["']$/g, ""));
          return;
        }
      }
      if (/^(rm -rf \/|mkfs|dd if=|:\(\)|shutdown|reboot|halt)/.test(cmd)) { out("Refused: destructive commands are blocked in this lab, and on a real host they would end the incident in the worst way.", "sim-err"); return; }
      out(cmd.split(" ")[0] + ": not part of this scenario's script. Type hint for a nudge.", "sim-err");
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp" && hist.length) { hpos = Math.max(0, hpos - 1); input.value = hist[hpos]; e.preventDefault(); }
      else if (e.key === "ArrowDown" && hist.length) { hpos = Math.min(hist.length, hpos + 1); input.value = hist[hpos] || ""; e.preventDefault(); }
    });

    function start(id) {
      sc = SCENARIOS[0];
      for (var i = 0; i < SCENARIOS.length; i++) if (SCENARIOS[i].id === id) sc = SCENARIOS[i];
      st = { clues: {}, fixed: false, diag: null, diagPick: -1, hints: 0, solved: false };
      progress.last = sc.id; save(progress);
      clear(screen);
      promptEl.textContent = promptText();
      var t = left.querySelector(".sim-term-title");
      if (t) t.textContent = sc.user + "@" + sc.host + " — simulated";
      out("# " + sc.brief + "\n# Goal: " + sc.goal + "\n# Type help for built-ins or hint for a nudge.", "sim-note");
      renderPicker();
      renderSide();
    }

    start(progress.last || SCENARIOS[0].id);
  }

  window.KernelSimulator = { mount: mount, scenarios: SCENARIOS.length };
})();
