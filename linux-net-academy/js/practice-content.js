/* Kernel practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS.shell / text / proc / fs / perf /
   net / tools / cont / ssh. */
window.KernelPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Troubleshooting walkthroughs",
      color: "var(--kn-green)",
      icon: "map",
      summary: "Step-by-step outlines for the Linux and network incidents that come up most, from a full disk to a site that will not load."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#38bdf8",
      icon: "quiz",
      summary: "Timed SRE and sysadmin prompts with what an interviewer listens for and the follow-ups they push on."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#f472b6",
      icon: "star",
      summary: "The dimensions a Linux or networking troubleshooting round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "First-five-minutes commands, subnet math, signal numbers and macOS equivalents worth having in memory."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#a78bfa",
      icon: "lesson",
      summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "site-down",
      title: "\"The website is down\"",
      subtitle: "The classic open-ended troubleshooting prompt: walk the stack from name to response.",
      timebox: "30 min",
      prompt: "Users report that app.shop.example does not load. You have shell access to a client machine and the web server. Find out where it breaks.",
      related: [
        { label: "Troubleshooting flow", route: "#/tools/filter/troubleshoot-flow" },
        { label: "dig and curl", route: "#/tools/probe/dig-curl" },
        { label: "ip and ss", route: "#/tools/inspect/ip-ss" }
      ],
      outline: [
        {
          title: "Scope it first",
          items: [
            "Ask who is affected: everyone, one region, one network, one browser? Since when, and what changed?",
            "Reproduce from a client with curl -v so you see each phase instead of a blank page."
          ]
        },
        {
          title: "Name resolution",
          items: [
            "dig app.shop.example: does it return an answer, the expected address, and a sane TTL?",
            "Compare the system resolver with a direct query to the authoritative server; check for a recent record change."
          ]
        },
        {
          title: "Reachability and transport",
          items: [
            "ping and mtr to the address; treat ICMP loss at middle hops with suspicion unless it persists to the end.",
            "nc -vz host 443: refused means nothing listens; a timeout means a firewall or routing problem."
          ]
        },
        {
          title: "TLS and HTTP",
          items: [
            "openssl s_client -connect host:443 -servername app.shop.example: certificate expiry, chain and name match.",
            "curl -w timings to split DNS, connect, TLS and time to first byte; check the status code and response headers."
          ]
        },
        {
          title: "On the server",
          items: [
            "ss -tlnp to confirm the service listens on the right address and port; systemctl status and journalctl -u for crashes.",
            "Check disk, memory and load quickly with df -h, free -m and uptime before reading application logs."
          ]
        }
      ]
    },
    {
      id: "disk-full",
      title: "Disk full on a production host",
      subtitle: "A pager-style scenario where the obvious cleanup does not free the space.",
      timebox: "25 min",
      prompt: "An alert fires: / is 100% full on a web server and writes are failing. You delete a large log file but df still shows the disk full.",
      related: [
        { label: "Disk full incident", route: "#/perf/incidents/disk-full" },
        { label: "Inodes and links", route: "#/fs/layout/inodes-links" },
        { label: "strace and lsof", route: "#/perf/trace/strace-lsof" }
      ],
      outline: [
        {
          title: "Confirm what is full",
          items: [
            "df -h for blocks and df -i for inodes; a filesystem can run out of either.",
            "Find the mount that is actually full; /var or a container overlay may be a separate filesystem."
          ]
        },
        {
          title: "Find the space",
          items: [
            "du -xh --max-depth=1 / | sort -h walks one filesystem only and ranks directories.",
            "If du is much smaller than df, look for deleted files still held open: lsof +L1."
          ]
        },
        {
          title: "Free it safely",
          items: [
            "Restart or signal the process that holds the deleted file, or truncate it through /proc/<pid>/fd/<n>.",
            "Truncate active logs with : > file rather than rm, so the writer keeps a valid descriptor."
          ]
        },
        {
          title: "Prevent the repeat",
          items: [
            "Configure logrotate with copytruncate or a postrotate reload, and cap journald with SystemMaxUse.",
            "Alert at 80% with a growth-rate projection, not at 100%."
          ]
        }
      ]
    },
    {
      id: "slow-server",
      title: "The server is slow",
      subtitle: "Separate CPU, memory, disk and network causes in the first five minutes.",
      timebox: "30 min",
      prompt: "An API host's p99 latency tripled since this morning. Load average is 24 on an 8-core machine. Diagnose it.",
      related: [
        { label: "Load average", route: "#/perf/observe/load-average" },
        { label: "The USE method", route: "#/perf/trace/use-method" },
        { label: "Disk I/O", route: "#/perf/observe/disk-io" }
      ],
      outline: [
        {
          title: "Read the load correctly",
          items: [
            "Load counts runnable and uninterruptible tasks; compare it with 8 cores and check the 1, 5 and 15 minute trend.",
            "vmstat 1: high r with low idle means CPU saturation; high b and wa means tasks are blocked on I/O."
          ]
        },
        {
          title: "Walk the USE checklist",
          items: [
            "CPU: mpstat -P ALL for one hot core or steal time. Memory: free -m available, si/so swapping.",
            "Disk: iostat -xz 1 for await and aqu-sz. Network: ss -s, retransmits, errors with ip -s link."
          ]
        },
        {
          title: "Find the culprit process",
          items: [
            "top or pidstat to rank by CPU and I/O; processes in D state point at storage or NFS.",
            "perf top or a short perf record for CPU-bound code; strace -c -p for syscall-heavy work, accepting its overhead."
          ]
        },
        {
          title: "Close the loop",
          items: [
            "Correlate with what changed this morning: a deploy, a cron job, a backup, a noisy neighbour.",
            "Mitigate first (throttle, move traffic, restart), then fix and add the missing alert."
          ]
        }
      ]
    },
    {
      id: "oom-container",
      title: "A container keeps restarting with exit code 137",
      subtitle: "Memory limits, the OOM killer and cgroups in one scenario.",
      timebox: "20 min",
      prompt: "A Java service in a container restarts every few hours. The orchestrator reports exit code 137. Explain what is happening and how you would prove it.",
      related: [
        { label: "OOM incidents", route: "#/perf/incidents/oom" },
        { label: "cgroups", route: "#/cont/iso/cgroups" },
        { label: "Memory and CPU", route: "#/perf/observe/cpu-memory" }
      ],
      outline: [
        {
          title: "Decode the signal",
          items: [
            "137 is 128 + 9: SIGKILL. Under a memory limit this is almost always the kernel OOM killer acting inside the cgroup.",
            "Confirm with dmesg or the journal (oom-kill, memory cgroup out of memory) and the orchestrator's OOMKilled reason."
          ]
        },
        {
          title: "Measure against the limit",
          items: [
            "Read memory.max, memory.current and memory.events in the container's cgroup.",
            "Remember that heap is only part of the footprint: thread stacks, metaspace, direct buffers and page cache count too."
          ]
        },
        {
          title: "Fix proportionately",
          items: [
            "Size the runtime to the container (for the JVM, a percentage-based max heap) and leave headroom.",
            "Raise the limit only with evidence; look for leaks with a heap profile if usage grows without bound."
          ]
        }
      ]
    },
    {
      id: "ssh-locked-out",
      title: "Cannot SSH into a new server",
      subtitle: "Authentication, permissions and network causes behind 'Permission denied (publickey)'.",
      timebox: "20 min",
      prompt: "You just provisioned host web1.lab.example and added your public key, but ssh says Permission denied (publickey).",
      related: [
        { label: "SSH keys", route: "#/ssh/remote/ssh-keys" },
        { label: "SSH config", route: "#/ssh/remote/ssh-config" },
        { label: "Permissions", route: "#/fs/perms/permissions" }
      ],
      outline: [
        {
          title: "Read what the client tried",
          items: [
            "ssh -v shows which keys were offered and which methods the server accepts.",
            "Check the user name: many images expect a distribution-specific user rather than root."
          ]
        },
        {
          title: "Check the server side",
          items: [
            "authorized_keys must be in the right home, owned by the user, mode 600; ~/.ssh mode 700; the home directory not group-writable.",
            "From a console, journalctl -u ssh (or sshd) shows the exact reason the key was rejected."
          ]
        },
        {
          title: "Rule out the network",
          items: [
            "A timeout rather than a rejection is a security group, firewall or routing problem, not a key problem.",
            "A host key warning means the server identity changed: verify it out of band before removing the old line."
          ]
        }
      ]
    },
    {
      id: "container-network",
      title: "Container cannot reach the internet",
      subtitle: "Network namespaces, veth pairs, NAT and DNS inside a container.",
      timebox: "25 min",
      prompt: "A container on a Linux host can ping its gateway but curl to pkg.mirror.example hangs. Other containers on the same host work.",
      related: [
        { label: "Namespaces", route: "#/cont/iso/namespaces" },
        { label: "iptables and nftables", route: "#/tools/filter/iptables-nft" },
        { label: "DNS", route: "#/net/app/dns" }
      ],
      outline: [
        {
          title: "Split DNS from connectivity",
          items: [
            "Inside the container, try the IP directly and check /etc/resolv.conf; a hang on the name only is a resolver problem.",
            "Use nsenter -t <pid> -n to run host tools such as ip, ss and tcpdump inside the container's network namespace."
          ]
        },
        {
          title: "Follow the packet",
          items: [
            "ip route inside the namespace, then tcpdump on the host side of the veth and on the uplink.",
            "Packets leaving the veth but not the uplink point at forwarding, NAT (MASQUERADE) or a filter rule."
          ]
        },
        {
          title: "Compare with a working container",
          items: [
            "Diff the network mode, attached network and MTU. An MTU mismatch on a tunnel lets small pings work while TLS handshakes hang.",
            "Fix the specific difference rather than flushing firewall rules."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "url-enter",
      title: "What happens when you type a URL and press Enter?",
      timebox: "20 min",
      prompt: "Walk through everything from typing https://app.shop.example in a browser to the page rendering. Go as deep as you can on the network side.",
      expected: [
        "Resolves the name: browser and OS caches, the stub resolver, a recursive resolver, root, TLD and authoritative servers.",
        "Routes the packet: own subnet check, ARP for the gateway, NAT at the edge.",
        "Opens TCP with the three-way handshake, then the TLS 1.3 handshake with SNI, ALPN and certificate verification.",
        "Sends the HTTP request over HTTP/2 or HTTP/3 and explains connection reuse and caching headers."
      ],
      followups: [
        "Where can each step fail, and which tool would show you that failure?",
        "What changes with HTTP/3?"
      ],
      links: [
        { label: "DNS", route: "#/net/app/dns" },
        { label: "TCP handshake", route: "#/net/transport/tcp-handshake" },
        { label: "TLS", route: "#/net/app/tls" }
      ]
    },
    {
      id: "high-load",
      title: "Load average is high: what next?",
      timebox: "15 min",
      prompt: "You log into a Linux box and uptime shows a load average of 40. Talk through your first five minutes.",
      expected: [
        "Explains that Linux load includes D-state tasks, so it is not only CPU, and compares it with the core count.",
        "Uses vmstat, mpstat, iostat and free to separate CPU, memory pressure and I/O.",
        "Ranks processes with top or pidstat and inspects the stuck ones.",
        "Mentions dmesg for hardware, OOM or storage errors."
      ],
      followups: [
        "Load is 40 but CPUs are 90% idle. What is going on?",
        "How would you tell CPU throttling inside a container from host saturation?"
      ],
      links: [
        { label: "Load average", route: "#/perf/observe/load-average" },
        { label: "The USE method", route: "#/perf/trace/use-method" }
      ]
    },
    {
      id: "fork-exec",
      title: "How does the shell run a command?",
      timebox: "15 min",
      prompt: "Explain what happens, at the process level, when you type ls -l | grep conf in bash and press Enter.",
      expected: [
        "Parses the line, performs expansions, creates a pipe, then forks a child for each side.",
        "Each child rewires its file descriptors with dup2 and calls exec; the program replaces the child image.",
        "The shell waits on both children and reports the last stage's exit status (unless pipefail is set).",
        "Mentions that builtins like cd must run in the shell itself."
      ],
      followups: [
        "Why can a variable set inside a while loop fed by a pipe vanish afterwards?",
        "What is a zombie and who reaps it?"
      ],
      links: [
        { label: "fork and exec", route: "#/proc/model/fork-exec" },
        { label: "Pipes and redirection", route: "#/shell/basics/pipes-redirection" }
      ]
    },
    {
      id: "containers-kernel",
      title: "What is a container, really?",
      timebox: "15 min",
      prompt: "Explain to a colleague what a Linux container is made of, without using the word Docker.",
      expected: [
        "A normal process with its own namespaces (PID, network, mount, UTS, IPC, user, cgroup).",
        "cgroups to limit and account CPU, memory, I/O and process count.",
        "A root filesystem, usually layered with overlayfs, plus a pivot_root or chroot.",
        "Contrasts it with a VM: a shared kernel, which is why kernel bugs and privileges matter."
      ],
      followups: [
        "Why does a container need a VM on macOS?",
        "What does running as root inside a container mean on the host?"
      ],
      links: [
        { label: "Namespaces", route: "#/cont/iso/namespaces" },
        { label: "Container by hand", route: "#/cont/iso/container-by-hand" }
      ]
    },
    {
      id: "permissions",
      title: "Permission denied",
      timebox: "10 min",
      prompt: "A deploy user gets Permission denied writing to /srv/app/releases even though the directory is group-writable. How do you debug it?",
      expected: [
        "Checks every directory on the path needs x for traversal, with namei -l or ls -ld per component.",
        "Confirms the process's effective user and groups with id; new group membership needs a fresh login.",
        "Looks for ACLs (getfacl), read-only mounts, immutable attributes and mandatory access control such as SELinux.",
        "Fixes with the narrowest change rather than chmod 777."
      ],
      followups: [
        "What does the setgid bit do on a shared directory?",
        "Why is sudo with a broad wildcard rule dangerous?"
      ],
      links: [
        { label: "Permissions", route: "#/fs/perms/permissions" },
        { label: "Special bits and ACLs", route: "#/fs/perms/special-bits-acls" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Method — a structured path rather than random commands",
      "Linux depth — processes, memory, filesystems and the kernel's view",
      "Network depth — layers, protocols and where each can fail",
      "Tool fluency — the right command, its flags and its caveats",
      "Safety — reversible actions, backups and production care",
      "Communication — narrating hypotheses and evidence"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Knows individual commands but jumps between them without a hypothesis.",
        signals: [
          "Restarts the service before collecting evidence.",
          "Reads load average as CPU usage.",
          "Treats every traceroute star as packet loss.",
          "Reaches for chmod 777 or flushing the firewall."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Works layer by layer and uses the standard tools correctly, but misses kernel-level causes.",
        signals: [
          "Splits DNS, TCP, TLS and HTTP problems with dig, nc, openssl and curl.",
          "Uses df, du and lsof to explain a full disk.",
          "Knows signals and systemd basics and reads the journal.",
          "Mentions macOS and GNU tool differences when they matter."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Forms and tests hypotheses quickly, explains the kernel behaviour underneath, and fixes safely.",
        signals: [
          "Applies the USE method and explains D-state, steal and throttling.",
          "Reads tcpdump flags and TCP states to pinpoint the failing side.",
          "Explains containers as namespaces, cgroups and overlayfs.",
          "Leaves a timed rollback when changing remote firewall or SSH configuration."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "first-five",
      title: "First five minutes on a sick host",
      summary: "A fixed order so you never skip the obvious.",
      items: [
        "uptime: load trend against core count.",
        "dmesg -T | tail: OOM kills, disk errors, link flaps.",
        "vmstat 1 5: run queue, blocked tasks, swap, iowait.",
        "mpstat -P ALL 1: one hot core, steal time.",
        "free -m: watch 'available', not 'free'.",
        "iostat -xz 1: await, aqu-sz, %util per device.",
        "df -h and df -i: blocks and inodes.",
        "ss -s and ss -tlnp: socket summary and listeners.",
        "top or pidstat 1: who is using it.",
        "journalctl -p err -b: errors since boot."
      ]
    },
    {
      id: "subnets",
      title: "Subnet math",
      summary: "Prefix length to block size without a calculator.",
      items: [
        "Addresses in a block = 2^(32 - prefix). Usable hosts = that minus 2 (except /31 and /32).",
        "/24 = 256, /25 = 128, /26 = 64, /27 = 32, /28 = 16, /29 = 8, /30 = 4.",
        "Mask octets: 128, 192, 224, 240, 248, 252, 254, 255.",
        "Network address = IP AND mask; broadcast = network OR inverted mask.",
        "Private ranges: 10/8, 172.16/12, 192.168/16. Link-local 169.254/16. Loopback 127/8.",
        "Each prefix bit you add halves the block; each one you remove doubles it."
      ]
    },
    {
      id: "signals",
      title: "Signals and exit codes",
      summary: "Numbers you will see in logs.",
      items: [
        "1 SIGHUP: terminal closed, or 'reload config' by convention.",
        "2 SIGINT: Ctrl-C. 3 SIGQUIT: Ctrl-\\ (core dump).",
        "9 SIGKILL: cannot be caught. 15 SIGTERM: polite stop, the default for kill.",
        "18 SIGCONT / 19 SIGSTOP / 20 SIGTSTP (Ctrl-Z) on Linux x86; numbers differ on macOS.",
        "Exit 126: found but not executable. 127: command not found.",
        "Exit 128+N: killed by signal N; 130 = Ctrl-C, 137 = SIGKILL, 143 = SIGTERM."
      ]
    },
    {
      id: "macos-linux",
      title: "macOS vs Linux equivalents",
      summary: "What to type on your laptop versus the server.",
      items: [
        "sed -i '' (BSD) vs sed -i (GNU); install gnu-sed, coreutils, findutils for g-prefixed GNU tools.",
        "ip addr / ip route vs ifconfig / netstat -rn / route -n get.",
        "ss -tlnp vs lsof -nP -iTCP -sTCP:LISTEN.",
        "systemctl / journalctl vs launchctl / log show.",
        "free / vmstat vs vm_stat / memory_pressure; top -o cpu on macOS.",
        "strace vs dtruss (restricted by System Integrity Protection).",
        "Linux date -d vs BSD date -v / -j -f; stat -c vs stat -f."
      ]
    },
    {
      id: "net-triage",
      title: "Network triage ladder",
      summary: "Bottom-up checks with one tool per rung.",
      items: [
        "Link: ip -br link, ip -s link (errors, drops).",
        "Address and route: ip -br addr, ip route get <dst>.",
        "Neighbour: ip neigh (FAILED or INCOMPLETE entries).",
        "Name: dig +short name; dig @server name for a specific resolver.",
        "Port: nc -vz host port (refused vs timeout).",
        "TLS: openssl s_client -connect host:443 -servername name.",
        "HTTP: curl -v and curl -w timings.",
        "Wire: tcpdump -nn -i any host <ip> and port <p>."
      ]
    }
  ],

  glossary: [
    {
      id: "file-descriptor",
      term: "File descriptor",
      definition: "A small integer a process uses to refer to an open file, pipe, socket or device. 0, 1 and 2 are stdin, stdout and stderr by convention.",
      useIt: "Use it to explain redirection: 2>&1 copies descriptor 1 onto descriptor 2.",
      links: [{ label: "Pipes and redirection", route: "#/shell/basics/pipes-redirection" }]
    },
    {
      id: "word-splitting",
      term: "Word splitting",
      definition: "The shell step that breaks the result of an unquoted expansion into separate words on IFS characters, before globbing.",
      useIt: "Say it when explaining why \"$file\" must be quoted for names with spaces.",
      links: [{ label: "Quoting", route: "#/shell/basics/quoting" }]
    },
    {
      id: "regex-flavours",
      term: "BRE vs ERE",
      definition: "Basic and extended POSIX regular expressions. In BRE, +, ?, | and grouping need backslashes; in ERE they do not.",
      useIt: "Explain why grep 'a+' and grep -E 'a+' behave differently.",
      links: [{ label: "grep and ripgrep", route: "#/text/search/grep-rg" }]
    },
    {
      id: "zombie",
      term: "Zombie process",
      definition: "A process that has exited but whose parent has not yet collected its exit status with wait().",
      useIt: "Say that you fix zombies by fixing or restarting the parent, not by killing the zombie.",
      links: [{ label: "Zombies and runaway processes", route: "#/perf/incidents/zombies-runaway" }]
    },
    {
      id: "unit",
      term: "systemd unit",
      definition: "A declarative file describing a service, socket, timer, mount or target, with its dependencies and restart policy.",
      useIt: "Mention Restart=on-failure and a drop-in override instead of editing the vendor unit.",
      links: [{ label: "systemd units", route: "#/proc/services/systemd-units" }]
    },
    {
      id: "inode",
      term: "Inode",
      definition: "The filesystem record holding a file's metadata and data block pointers. Names live in directories, not in the inode.",
      useIt: "Use it to explain hard links and why a filesystem can be 'full' with free blocks.",
      links: [{ label: "Inodes and links", route: "#/fs/layout/inodes-links" }]
    },
    {
      id: "page-cache",
      term: "Page cache",
      definition: "RAM the kernel uses to cache file data. It is reclaimed under memory pressure, so it counts as available memory.",
      useIt: "Say it when someone panics that free shows almost no free memory.",
      links: [{ label: "CPU and memory", route: "#/perf/observe/cpu-memory" }]
    },
    {
      id: "use",
      term: "USE method",
      definition: "A performance checklist: for every resource, check Utilization, Saturation and Errors.",
      useIt: "Name it to show you have a method before you open a profiler.",
      links: [{ label: "The USE method", route: "#/perf/trace/use-method" }]
    },
    {
      id: "cidr",
      term: "CIDR",
      definition: "Classless inter-domain routing notation: an address plus a prefix length, such as 10.20.0.0/16, describing a block.",
      useIt: "Use it to size subnets and to read route tables and firewall rules.",
      links: [{ label: "IP and CIDR", route: "#/net/layers/ip-cidr" }]
    },
    {
      id: "mss-mtu",
      term: "MTU and MSS",
      definition: "MTU is the largest packet a link carries; MSS is the largest TCP payload, typically MTU minus 40 bytes of IP and TCP headers.",
      useIt: "Mention it when small requests work but large transfers or TLS handshakes hang over a VPN or tunnel.",
      links: [{ label: "TCP states", route: "#/net/transport/tcp-states" }]
    },
    {
      id: "recursive-resolver",
      term: "Recursive resolver",
      definition: "The DNS server that chases referrals from the root down on a client's behalf and caches the answers.",
      useIt: "Distinguish it from the authoritative server when debugging stale records.",
      links: [{ label: "DNS", route: "#/net/app/dns" }]
    },
    {
      id: "conntrack",
      term: "Connection tracking",
      definition: "The netfilter subsystem that tracks flows so firewall rules can match ESTABLISHED and RELATED traffic and NAT can translate replies.",
      useIt: "Mention table exhaustion (nf_conntrack: table full) when a busy host drops new connections.",
      links: [{ label: "iptables and nftables", route: "#/tools/filter/iptables-nft" }]
    },
    {
      id: "namespace",
      term: "Namespace",
      definition: "A kernel feature that gives a set of processes an isolated view of one global resource, such as PIDs or the network stack.",
      useIt: "Say a container is a process in its own namespaces, limited by cgroups.",
      links: [{ label: "Namespaces", route: "#/cont/iso/namespaces" }]
    },
    {
      id: "bastion",
      term: "Bastion (jump host)",
      definition: "A hardened host that is the single SSH entry point into a private network.",
      useIt: "Pair it with ProxyJump so private keys never leave your laptop.",
      links: [{ label: "SSH config", route: "#/ssh/remote/ssh-config" }]
    }
  ]
};
