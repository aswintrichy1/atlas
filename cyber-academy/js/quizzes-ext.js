/* =====================================================================
   CITADEL · Quiz bank — expansion pack
   Merged into window.QUIZZES (loaded after quizzes.js, before app.js).
   Offensive · Threats/Forensics · Domains.  Answers hand-verified.
   ===================================================================== */
window.QUIZZES = Object.assign(window.QUIZZES || {}, {
  /* ---------------- OFFENSIVE ---------------- */
  "offensive-methodology": {
    title: "Ethical hacking checkpoint",
    sub: "Authorization, the pentest lifecycle, and recon.",
    questions: [
      {
        q: "What single thing makes security testing legal rather than criminal?",
        options: ["Using professional tools", "Explicit, written authorization within a defined scope", "Good intentions", "Testing only at night"],
        answer: 1,
        explain: "Authorization is the bright line. Without written permission and a scope, the same scan that helps a defender is unauthorized access — a crime in most jurisdictions, regardless of intent."
      },
      {
        q: "A 'grey box' penetration test means the tester is given",
        options: ["nothing but a target", "some access or documentation, like a normal user account", "full source code and architecture", "permission to attack anything"],
        answer: 1,
        explain: "Grey box hands the tester partial knowledge (often a user account), simulating an insider or phished employee. It skips weeks of front-door brute-forcing and spends budget on deeper flaws."
      },
      {
        q: "Passive reconnaissance is attractive to attackers because it",
        options: ["is faster than scanning", "gathers information without touching the target, so it's invisible", "requires no skill", "is always legal"],
        answer: 1,
        explain: "Passive recon uses public sources (DNS, certificate logs, social media, breach data) without sending the target packets — so a detailed profile can be built with nothing for the target to detect."
      },
      {
        q: "The best defense against OSINT-based attacks is to",
        options: ["block all search engines", "reduce your own public footprint and scrub metadata", "use a stronger firewall", "rotate IP addresses"],
        answer: 1,
        explain: "Since OSINT mines public data, defense means minimizing what's exposed: scrub file metadata, keep internal hostnames out of public DNS, monitor certificate-transparency logs, and train staff on what they post."
      }
    ]
  },
  "offensive-findingflaws": {
    title: "Finding flaws checkpoint",
    sub: "Scanning, CVE/CVSS, exploits and disclosure.",
    questions: [
      {
        q: "In scanning, the difference between a port scan and enumeration is that enumeration",
        options: ["is automated while scanning is manual", "pulls specific detail (users, shares, versions) from the services found", "only works on Windows", "is the same thing"],
        answer: 1,
        explain: "Scanning answers 'what's open?'; enumeration answers 'what exactly is it?' — extracting usernames, shares, directories, and version banners from the services discovered."
      },
      {
        q: "A CVE identifier (like CVE-2021-44228) is",
        options: ["a severity score from 0 to 10", "a unique public name for a specific vulnerability", "a type of exploit", "a patch"],
        answer: 1,
        explain: "CVE gives each public vulnerability a unique identifier so everyone refers to the same bug. CVSS is the separate 0–10 severity score; they work together."
      },
      {
        q: "Why shouldn't you prioritize patching by CVSS base score alone?",
        options: ["CVSS is always wrong", "It ignores exposure and asset value — context determines real risk", "Higher scores are less urgent", "CVSS only applies to web apps"],
        answer: 1,
        explain: "Risk = severity × exposure × asset value. A 9.8 on an isolated box can matter less than a 6 on your internet-facing login. Signals like EPSS and CISA KEV add the real-world exploitation context."
      },
      {
        q: "The responsible way to handle a vulnerability you find in someone else's product is",
        options: ["publish a working exploit immediately", "coordinated disclosure — report privately and give time to patch", "sell it to the highest bidder", "demand payment to stay silent"],
        answer: 1,
        explain: "Coordinated disclosure reports privately (via a security contact, VDP, or bug bounty), allows reasonable time to fix, then publishes after a patch. Full-drop or extortion crosses into harm and crime."
      }
    ]
  },
  "offensive-webhacking": {
    title: "Web hacking checkpoint",
    sub: "Testing methodology, post-exploitation, and reporting.",
    questions: [
      {
        q: "In a web-app test, the highest-value findings most often come from",
        options: ["automated scanners", "manually testing access control — reaching data and actions that should be off-limits", "checking TLS configuration", "counting open ports"],
        answer: 1,
        explain: "Broken access control is consistently the #1 web risk and usually needs a human who understands what the app should allow. Scanners catch the easy categories; logic and authorization flaws need judgment."
      },
      {
        q: "Which defensive principle most directly limits an attacker's lateral movement after a foothold?",
        options: ["Output encoding", "Network segmentation", "Password hashing", "HSTS"],
        answer: 1,
        explain: "Segmentation stops a compromised host from freely reaching others. Least privilege blunts privilege escalation; segmentation blunts lateral movement — the post-exploitation chain is the argument for both."
      },
      {
        q: "'Assume breach' is a design stance that means",
        options: ["give up on prevention", "design as if an attacker already holds a valid account, and limit how far they get", "breach yourself first", "only the firewall matters"],
        answer: 1,
        explain: "Assume-breach accepts that a foothold will happen and asks how far it spreads. If the answer is 'everywhere', the network is flat and privileges are too broad — drive both down."
      },
      {
        q: "In a penetration test, the actual product delivered to the client is",
        options: ["a shell on the server", "a clear, reproducible, risk-rated report with remediation", "a list of open ports", "the exploit code"],
        answer: 1,
        explain: "The report is the deliverable. A good finding is reproducible, rated by real risk, paired with a specific fix, and closed only after a retest confirms it's gone."
      }
    ]
  },

  /* ---------------- THREATS / FORENSICS ---------------- */
  "threats-intel": {
    title: "Threat intelligence checkpoint",
    sub: "CTI, MITRE ATT&CK, IOCs and hunting.",
    questions: [
      {
        q: "MITRE ATT&CK organizes adversary behavior into",
        options: ["severity scores", "tactics (the goal) and techniques (how it's achieved)", "CVE numbers", "firewall rules"],
        answer: 1,
        explain: "ATT&CK is a knowledge base of tactics (the attacker's goal at each stage) and techniques (how they accomplish it), giving defenders one vocabulary and a way to map detection coverage."
      },
      {
        q: "On the Pyramid of Pain, which indicator is MOST painful for an attacker to change?",
        options: ["A file hash", "An IP address", "A domain name", "TTPs (their tools and behaviors)"],
        answer: 3,
        explain: "Hashes change with a recompile and IPs rotate hourly — trivial for the attacker. Forcing them to change their tools, techniques and procedures means re-tooling their whole method: the most durable defensive win."
      },
      {
        q: "An indicator of attack (IOA) differs from an indicator of compromise (IOC) in that an IOA",
        options: ["is always a file hash", "describes behavior of an attack in progress, catching novel tools", "can only be shared in reports", "is less useful"],
        answer: 1,
        explain: "IOCs are evidence an attack happened (a known-bad hash). IOAs describe behavior happening now (a document spawning PowerShell that connects out), so they catch attacks no one has seen before."
      },
      {
        q: "Threat hunting is best described as",
        options: ["waiting for alerts to fire", "proactively searching for adversaries that evaded automated detection", "running a vulnerability scan", "blocking IP addresses"],
        answer: 1,
        explain: "Hunting assumes an attacker is already inside and goes looking via hypotheses tested against your data. Its best output is often a new automated detection rule born from a successful hunt."
      }
    ]
  },
  "threats-malware": {
    title: "Malware checkpoint",
    sub: "Types, analysis, and evasion.",
    questions: [
      {
        q: "What distinguishes a worm from a virus?",
        options: ["A worm self-propagates across networks without user action", "A worm is always ransomware", "A virus is harmless", "There is no difference"],
        answer: 0,
        explain: "A virus attaches to a file and spreads when that file is run; a worm propagates by itself across networks with no user needed — which is why worms exploit unpatched, internet-facing services."
      },
      {
        q: "Dynamic malware analysis must always be performed",
        options: ["on a production server for realism", "in strict isolation — a disposable sandbox or air-gapped VM with snapshots", "on the analyst's daily laptop", "only after disabling antivirus everywhere"],
        answer: 1,
        explain: "Running malware to watch its behavior is powerful but dangerous. Isolation is non-negotiable: a sandbox or air-gapped VM that can't reach production or the internet, with snapshots to revert."
      },
      {
        q: "Most evasion techniques that defeat static signatures are beaten by",
        options: ["longer signatures", "behavioral detection — watching what the malware actually does at runtime", "blocking all email", "renaming files"],
        answer: 1,
        explain: "Packing, obfuscation, and novelty hide a file's contents, but to do anything the malware must act — spawn processes, touch the registry, reach the network. Behavioral detection catches it there."
      },
      {
        q: "'Living off the land' refers to attackers",
        options: ["growing their own malware", "abusing legitimate built-in tools so activity blends into normal operations", "using only zero-days", "attacking farms"],
        answer: 1,
        explain: "Instead of dropping obvious malware, attackers abuse trusted built-in utilities (scripting engines, admin tools). Defense is baselining — flagging unusual use of legitimate tools, not just known-bad files."
      }
    ]
  },
  "threats-forensics": {
    title: "Digital forensics checkpoint",
    sub: "Chain of custody, volatility, and artifacts.",
    questions: [
      {
        q: "Why does the 'order of volatility' say to capture RAM before powering off?",
        options: ["RAM is the easiest to image", "Memory holds running processes, keys, and network state that vanish on shutdown", "Disk evidence is worthless", "It's required by law everywhere"],
        answer: 1,
        explain: "The most volatile evidence disappears first. RAM contains running malware, decryption keys, and live connections — including fileless malware that never touches disk — so capture it before pulling the plug."
      },
      {
        q: "Chain of custody primarily ensures that",
        options: ["evidence is encrypted", "there's a documented, unbroken record of who handled evidence, keeping it trustworthy", "the attacker is identified", "logs are deleted"],
        answer: 1,
        explain: "Evidence is only as trustworthy as its handling record. Document who collected what and when, hash on acquisition, work on copies not originals — break the chain and the evidence may be worthless."
      },
      {
        q: "Which evidence domain best answers 'what was happening right now', including fileless malware?",
        options: ["Disk", "Memory (RAM)", "Printed reports", "The CVE database"],
        answer: 1,
        explain: "Memory forensics is the modern crown jewel: fileless malware, injected code, decryption keys, and live C2 connections exist only in RAM, invisible to disk-only analysis."
      },
      {
        q: "A suspiciously cleared event log is, to an investigator,",
        options: ["proof of innocence", "itself an indicator of compromise — the attempt to hide leaves a trace", "irrelevant", "a normal maintenance event"],
        answer: 1,
        explain: "Anti-forensics often is the evidence. A cleared log, wiped history, or impossible timestamps are strong signs of compromise — Locard's principle: the attempt to hide leaves its own trace."
      }
    ]
  },

  /* ---------------- DOMAINS ---------------- */
  "domains-infra": {
    title: "Infrastructure checkpoint",
    sub: "Networking, Linux permissions, and wireless.",
    questions: [
      {
        q: "In CIDR notation, what does the /24 in 192.168.1.0/24 indicate?",
        options: ["24 total hosts", "The first 24 bits are the network portion, leaving 256 addresses", "24 open ports", "TLS version 24"],
        answer: 1,
        explain: "The /24 means 24 network bits and 8 host bits → 256 addresses (254 usable). Subnetting is exactly how you define which hosts a firewall rule or segment covers."
      },
      {
        q: "On Linux, a file with permissions rwxr-xr-x is written in octal as",
        options: ["644", "755", "777", "700"],
        answer: 1,
        explain: "rwx=7 for owner, r-x=5 for group, r-x=5 for other → 755. Read=4, write=2, execute=1, summed per group. 755 is the classic 'owner can write, everyone can read/execute'."
      },
      {
        q: "A common Linux privilege-escalation surface is",
        options: ["the desktop wallpaper", "misconfigured sudo or SUID binaries that run as root", "the font cache", "disabled logging"],
        answer: 1,
        explain: "Most Linux escalation chains a normal-user foothold into root via misconfigured sudo, risky SUID binaries, or world-writable privileged scripts. Least privilege and a minimal SUID set close these paths."
      },
      {
        q: "Which Wi-Fi security standard should you use on a modern network?",
        options: ["WEP", "Original WPA", "WPA2 at minimum, WPA3 where possible", "No encryption"],
        answer: 2,
        explain: "WEP and original WPA are broken — treat them as plaintext. WPA3 is best (with protected management frames); WPA2 with a long, unique passphrase is the minimum acceptable."
      }
    ]
  },
  "domains-modern": {
    title: "Cloud & modern checkpoint",
    sub: "Shared responsibility, DevSecOps, and tooling.",
    questions: [
      {
        q: "Under the cloud shared-responsibility model, the customer is always responsible for",
        options: ["the physical data center", "the hypervisor", "their data, identities, and configuration", "the provider's network hardware"],
        answer: 2,
        explain: "The provider secures the cloud infrastructure; you secure what you put in it — data, access/IAM, and configuration. The split shifts by service model (IaaS/PaaS/SaaS) but data and access are always yours."
      },
      {
        q: "The most common root cause of cloud breaches is",
        options: ["the provider being hacked", "customer-side misconfiguration like public buckets or over-broad IAM", "weak encryption algorithms", "physical theft"],
        answer: 1,
        explain: "Almost every cloud breach is a customer misconfiguration — a world-readable bucket, a wildcard IAM role, an exposed database. The provider's data center is rarely the problem; your settings are."
      },
      {
        q: "'Shift left' in DevSecOps means",
        options: ["deploy to the left region first", "build security in early during development, where issues are cheapest to fix", "move servers physically", "use left-handed keyboards"],
        answer: 1,
        explain: "Shift left integrates security into development and CI (SAST/DAST/SCA, IaC scanning) so flaws are caught early and cheaply, rather than bolted on at the end or found in production."
      },
      {
        q: "When learning the security tool landscape, what matters most first?",
        options: ["memorizing every product name", "understanding the category — what job a class of tool does", "buying commercial licenses", "the tool's logo"],
        answer: 1,
        explain: "Specific products are interchangeable; the category (recon, scanner, proxy, SIEM, EDR, forensics) is what you reason about. Methodology drives results — tools just apply concepts faster."
      }
    ]
  },
  "domains-path": {
    title: "Your path checkpoint",
    sub: "CTFs, home labs, careers and ethics.",
    questions: [
      {
        q: "Capture the Flag (CTF) events are valuable for learning because they",
        options: ["let you attack real companies legally", "provide safe, legal, permission-rich challenges with instant feedback", "require no thinking", "replace all other study"],
        answer: 1,
        explain: "CTFs are purpose-built playgrounds — no real victims, full permission, immediate feedback. Their categories (web, pwn, crypto, forensics, reversing, OSINT) mirror the real disciplines."
      },
      {
        q: "When building a home lab with intentionally vulnerable machines, you must",
        options: ["expose them to the internet for realism", "isolate them on a host-only/internal network so nothing leaks", "disable snapshots", "use your main laptop as the target"],
        answer: 1,
        explain: "Vulnerable-by-design machines are magnets for real malware. Keep them on an isolated network that can't reach the internet or your real devices, and use snapshots to revert to clean state."
      },
      {
        q: "Regarding certifications, the healthiest mindset is that they are",
        options: ["a substitute for hands-on skill", "signals that complement real skill, not replacements for it", "useless", "only for management"],
        answer: 1,
        explain: "Certs signal breadth or capability, but skills come first. A home lab, CTF results, and write-ups often speak louder — and make the cert exam straightforward when you take it."
      },
      {
        q: "Across every offensive skill in this atlas, the non-negotiable rule is",
        options: ["always use the newest tools", "operate ethically and only within explicit authorization", "never write reports", "work alone"],
        answer: 1,
        explain: "The skills are for defending systems and testing your own — with permission. Authorization and ethics are what separate a security professional from a criminal, and your reputation is your career."
      }
    ]
  }
});
