/* =====================================================================
   CITADEL · Network Defense & Operations curriculum
   window.TRACKS.defense  ·  block grammar documented in curriculum-core.js
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.defense = {
  id: "defense",
  name: "Network Defense & Ops",
  short: "DEFENSE",
  tagline: "Detect, contain, recover",
  color: "#fb7185",
  blurb: "Operating a defense: firewalls and segmentation, secure transport, zero-trust architecture, logging and SIEM, intrusion detection, recognizing attacks, the incident-response lifecycle, system hardening, and how a security operations team actually runs.",
  modules: [
    /* ============================ NETWORK ============================ */
    {
      id: "network",
      name: "Network defense",
      icon: "share",
      lessons: [
        {
          id: "network-security",
          title: "Firewalls & segmentation",
          summary: "Control what can talk to what. A flat network turns one foothold into total compromise.",
          minutes: 8,
          tags: ["network", "firewall"],
          blocks: [
            { t: "p", html: "Network defense starts with one question: <em>what is allowed to talk to what?</em> A <strong>firewall</strong> enforces rules on traffic; <strong>segmentation</strong> divides the network so a breach in one zone can't freely reach the rest." },
            { t: "h", text: "How a firewall decides" },
            { t: "p", html: "A rule set is evaluated <strong>top to bottom</strong>; the first match wins, and a <strong>default-deny</strong> rule sits at the bottom. Order matters \u2014 a broad allow above a specific deny silently defeats it. Step packets through a rule set below." },
            { t: "widget", id: "firewall" },
            { t: "h", text: "Firewall generations" },
            {
              t: "table",
              headers: ["Type", "Decides on"],
              rows: [
                ["Packet filter", "IP, port, protocol (stateless)"],
                ["Stateful", "Connection state (tracks established flows)"],
                ["Next-gen (NGFW)", "App awareness, IDS/IPS, TLS inspection"],
                ["WAF", "HTTP layer \u2014 blocks web attacks like SQLi/XSS"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Segmentation contains blast radius.</strong> Put the database in a tier that only the app tier can reach; keep user laptops off the server VLANs. When something is popped, segmentation decides whether it's one box or the whole estate." },
            { t: "note", variant: "trap", html: "<strong>Flat networks</strong> \u2014 everything can reach everything \u2014 are how ransomware spreads from one phished laptop to every server in hours. Segment by sensitivity and default-deny between zones." }
          ]
        },
        {
          id: "secure-transport",
          title: "Securing data in transit",
          summary: "Encrypt the wire so a foothold on the network doesn't mean reading everyone's traffic.",
          minutes: 6,
          tags: ["network", "encryption"],
          blocks: [
            { t: "p", html: "Assume the network is hostile \u2014 coffee-shop Wi-Fi or a compromised internal switch. <strong>Encryption in transit</strong> means that capturing packets yields ciphertext, not secrets. TLS is the backbone; several other tools build on the same primitives." },
            {
              t: "table",
              headers: ["Tool", "Protects"],
              rows: [
                ["<strong>TLS / HTTPS</strong>", "Application traffic, server (and optionally client) identity"],
                ["<strong>mTLS</strong>", "Both ends authenticate \u2014 common for service-to-service"],
                ["<strong>VPN / WireGuard</strong>", "Tunnels whole networks or remote users"],
                ["<strong>SSH</strong>", "Encrypted admin access and tunnels"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Encrypt internal traffic too.</strong> The old model trusted the LAN and encrypted only the edge. Modern designs encrypt service-to-service with mTLS \u2014 a captured internal link should reveal nothing. This is the network face of zero trust." },
            { t: "h", text: "Getting transport right" },
            {
              t: "ul", items: [
                "Disable SSL and TLS 1.0/1.1; require TLS 1.2+ with modern cipher suites.",
                "Use <strong>HSTS</strong> so browsers refuse to downgrade to HTTP.",
                "Prefer forward-secret key exchange (ECDHE) everywhere.",
                "Manage certificate lifecycles \u2014 expiry causes outages and panic-driven mistakes."
              ]
            },
            { t: "note", variant: "trap", html: "Stripping or downgrading TLS is a classic on-path attack. Without HSTS, a single plaintext request can be hijacked before the redirect to HTTPS ever happens." }
          ]
        },
        {
          id: "zero-trust",
          title: "Zero-trust architecture",
          summary: "'Never trust, always verify.' Drop the idea of a safe inside and a dangerous outside.",
          minutes: 7,
          tags: ["zero-trust", "architecture"],
          blocks: [
            { t: "p", html: "The old <strong>perimeter</strong> model trusted anything inside the firewall \u2014 a hard shell around a soft center. One phished laptop, and the attacker roamed freely. <strong>Zero trust</strong> discards \u201cinside = trusted\u201d: every request is authenticated, authorized and encrypted, regardless of origin." },
            { t: "compare",
              bad: { title: "Perimeter (castle-and-moat)", items: ["Trust the internal network", "Authenticate once at the edge", "Flat, reachable internals", "VPN in \u2192 broad access"] },
              good: { title: "Zero trust", items: ["Trust no network location", "Verify every request, continuously", "Per-resource access decisions", "Least privilege + micro-segmentation"] }
            },
            { t: "h", text: "The core principles" },
            {
              t: "ul", items: [
                "<strong>Verify explicitly</strong> \u2014 authenticate and authorize on identity, device health and context for every access.",
                "<strong>Least-privilege access</strong> \u2014 just enough, just in time.",
                "<strong>Assume breach</strong> \u2014 segment, encrypt end-to-end, and minimize blast radius.",
                "Strong identity is the new perimeter \u2014 which is why phishing-resistant MFA is foundational."
              ]
            },
            { t: "note", variant: "key", html: "Zero trust is an architecture and a journey, not a product you buy. It leans on everything you've learned: strong authentication, least privilege, segmentation, encryption in transit, and continuous monitoring." },
            { t: "quiz", id: "defense-network" }
          ]
        }
      ]
    },
    /* ============================ DETECT ============================ */
    {
      id: "detect",
      name: "Detection & monitoring",
      icon: "trend",
      lessons: [
        {
          id: "logging-siem",
          title: "Logging, monitoring & SIEM",
          summary: "You can't respond to what you can't see. Logging is the difference between knowing and guessing.",
          minutes: 7,
          tags: ["logging", "siem"],
          blocks: [
            { t: "p", html: "OWASP lists <strong>logging and monitoring failures</strong> for a reason: the average breach goes undetected for <em>months</em>. Without good telemetry, you learn about an incident from a customer, a regulator, or the attacker's ransom note." },
            { t: "h", text: "What to log (and what not to)" },
            {
              t: "ul", items: [
                "Authentication events \u2014 logins, failures, MFA prompts, password changes.",
                "Authorization failures and access to sensitive data.",
                "Administrative and configuration changes.",
                "Input-validation failures and application errors.",
                "<strong>Never</strong> log secrets, full card numbers, passwords or session tokens."
              ]
            },
            { t: "note", variant: "key", html: "A <strong>SIEM</strong> (Security Information and Event Management) centralizes logs from across the estate and correlates them \u2014 a failed login here plus a privilege change there plus data egress becomes one alert. Centralization also stops attackers from erasing local logs to cover their tracks." },
            { t: "h", text: "Good logs share traits" },
            {
              t: "table",
              headers: ["Trait", "Why"],
              rows: [
                ["Centralized & tamper-evident", "Attackers can't quietly delete them"],
                ["Time-synced (NTP)", "Correlate events across systems"],
                ["Structured (e.g. JSON)", "Machine-parseable for detection"],
                ["Retained appropriately", "Investigations span weeks/months"]
              ]
            },
            { t: "note", variant: "tip", html: "Logging without alerting is just expensive storage. Define detections for the events that matter and tune them \u2014 an ignored, noisy alert console is the same as no monitoring at all." }
          ]
        },
        {
          id: "ids-ips",
          title: "Intrusion detection & prevention",
          summary: "Systems that watch for attacks — and, when you let them, block in real time.",
          minutes: 6,
          tags: ["ids", "ips"],
          blocks: [
            { t: "p", html: "An <strong>IDS</strong> (Intrusion Detection System) watches traffic or host activity and <em>alerts</em> on suspicious patterns. An <strong>IPS</strong> sits inline and can <em>block</em>. Same brain, different placement: detection vs prevention." },
            {
              t: "table",
              headers: ["", "Signature-based", "Anomaly-based"],
              rows: [
                ["Detects", "Known patterns/IOCs", "Deviations from a baseline"],
                ["Strength", "Accurate on known threats", "Can catch novel attacks"],
                ["Weakness", "Misses new/zero-day", "More false positives"]
              ]
            },
            { t: "note", variant: "key", html: "The hard part is the trade-off between <strong>false positives</strong> (crying wolf \u2014 analysts tune out) and <strong>false negatives</strong> (missing the real thing). An IPS set too aggressively can also block legitimate traffic, so prevention is tuned carefully." },
            { t: "h", text: "Beyond the network" },
            {
              t: "ul", items: [
                "<strong>EDR</strong> \u2014 endpoint detection & response watches process/host behavior.",
                "<strong>NDR</strong> \u2014 network detection & response analyzes traffic patterns.",
                "<strong>XDR</strong> \u2014 correlates across endpoint, network, identity and cloud.",
                "Threat-intelligence feeds supply known-bad indicators (IOCs)."
              ]
            },
            { t: "note", variant: "tip", html: "Detection works best in <strong>layers</strong>, mapped to attacker behavior. Frameworks like MITRE ATT&CK help you ask \u201cwhich techniques can we actually see?\u201d and find the blind spots." }
          ]
        },
        {
          id: "threat-detection",
          title: "Recognizing attacks: the kill chain",
          summary: "Attacks unfold in stages. Spot one stage and you can break the whole chain — starting with phishing.",
          minutes: 8,
          tags: ["kill-chain", "phishing"],
          blocks: [
            { t: "p", html: "Intrusions aren't single events \u2014 they progress through stages. The <strong>cyber kill chain</strong> models that progression. Each stage is a chance to detect and disrupt; you don't have to catch the first move to win." },
            { t: "diagram", id: "kill-chain", caption: "Detect and break any single link to disrupt the whole intrusion." },
            { t: "h", text: "The stages, briefly" },
            {
              t: "ul", items: [
                "<strong>Reconnaissance</strong> \u2014 researching the target.",
                "<strong>Weaponization & delivery</strong> \u2014 crafting and sending the lure (often a phishing email).",
                "<strong>Exploitation & installation</strong> \u2014 the payload runs and gains a foothold.",
                "<strong>Command & control</strong> \u2014 the foothold phones home.",
                "<strong>Actions on objectives</strong> \u2014 data theft, encryption, fraud."
              ]
            },
            { t: "note", variant: "key", html: "<strong>Phishing</strong> is the most common delivery mechanism by far. Most intrusions begin with a human clicking something \u2014 which is why recognizing a malicious message or link is a frontline skill, not just an IT concern." },
            { t: "h", text: "Inspect a suspicious link" },
            { t: "p", html: "Defenders read URLs carefully. Paste a link below to highlight the real registrable domain and common deception tricks \u2014 lookalike domains, the <code>@</code> trick, punycode, and credential-in-URL." },
            { t: "widget", id: "phish" },
            { t: "note", variant: "trap", html: "The weakest link is rarely the firewall \u2014 it's a tired human at 4:59pm. Technical controls (MFA, email filtering, link rewriting) must assume someone <em>will</em> click, and limit what that click can do." },
            { t: "quiz", id: "defense-detect" }
          ]
        }
      ]
    },
    /* ============================ RESPOND ============================ */
    {
      id: "respond",
      name: "Response & operations",
      icon: "wrench",
      lessons: [
        {
          id: "incident-response",
          title: "The incident-response lifecycle",
          summary: "When prevention fails — and it will — a calm, practiced process limits the damage.",
          minutes: 8,
          tags: ["incident-response", "process"],
          blocks: [
            { t: "p", html: "Incidents are inevitable; chaos during one is optional. The widely used <strong>NIST / SANS lifecycle</strong> gives teams a rehearsed sequence so decisions are made by plan, not panic." },
            {
              t: "ol", items: [
                "<strong>Preparation</strong> \u2014 plans, tooling, access, and runbooks <em>before</em> anything happens.",
                "<strong>Identification</strong> \u2014 detect and confirm: is this real, and how bad?",
                "<strong>Containment</strong> \u2014 stop the bleeding (short-term isolate, then longer-term).",
                "<strong>Eradication</strong> \u2014 remove the foothold: malware, accounts, persistence.",
                "<strong>Recovery</strong> \u2014 restore clean systems and validate they're healthy.",
                "<strong>Lessons learned</strong> \u2014 a blameless post-mortem that fixes root causes."
              ]
            },
            { t: "note", variant: "key", html: "<strong>Containment usually comes before eradication.</strong> Isolate affected systems to stop spread first; investigate and remove second. Preserve evidence (don't just wipe and reboot) if the incident may be legal or regulated." },
            { t: "h", text: "Decisions that go better when pre-made" },
            {
              t: "ul", items: [
                "Who declares an incident, and who can authorize taking systems offline?",
                "How and when do you involve legal, comms, leadership and regulators?",
                "What are your notification obligations and their deadlines?",
                "How do you communicate when normal channels may be compromised?"
              ]
            },
            { t: "note", variant: "trap", html: "An untested plan is a wish. Run <strong>tabletop exercises</strong> \u2014 walk through a realistic scenario \u2014 so people know their roles before the real 3am call. Practice is what converts a plan into competence." }
          ]
        },
        {
          id: "hardening",
          title: "Hardening & patching",
          summary: "Shrink the attack surface before anyone attacks it. Most breaches exploit the known and unpatched.",
          minutes: 6,
          tags: ["hardening", "patching"],
          blocks: [
            { t: "p", html: "<strong>Hardening</strong> means reducing what an attacker can reach or abuse: fewer services, fewer accounts, fewer defaults, fewer known holes. It's unglamorous and it prevents an enormous share of real incidents." },
            { t: "h", text: "A practical baseline" },
            {
              t: "ul", items: [
                "<strong>Patch</strong> on a schedule and prioritize actively-exploited vulnerabilities (CISA KEV).",
                "Disable unused services, ports and default/sample accounts.",
                "Enforce MFA and strong, unique service credentials.",
                "Apply CIS Benchmarks / vendor hardening guides.",
                "Encrypt data at rest; back up and <strong>test restores</strong>.",
                "Use least-privilege and application allow-listing where feasible."
              ]
            },
            { t: "note", variant: "key", html: "<strong>Most breaches exploit known vulnerabilities with available patches.</strong> Attackers don't need a zero-day when last quarter's unpatched CVE is sitting on an internet-facing box. Patch management is unsexy and it wins." },
            { t: "note", variant: "trap", html: "Backups aren't a recovery plan until you've <strong>restored from them</strong>. Ransomware specifically hunts and encrypts backups \u2014 keep offline/immutable copies and rehearse the restore." },
            { t: "stat", items: [
              { v: "Patch", k: "close known holes first" },
              { v: "Minimize", k: "fewer services = smaller surface" },
              { v: "MFA", k: "kill credential replay" },
              { v: "Restore", k: "a tested backup is the real control" }
            ] }
          ]
        },
        {
          id: "security-operations",
          title: "Security operations & culture",
          summary: "Tools don't defend organizations — people and process running continuously do.",
          minutes: 6,
          tags: ["soc", "culture"],
          blocks: [
            { t: "p", html: "All of this comes together in <strong>security operations</strong>: the ongoing practice of monitoring, detecting, responding and improving. Whether it's a 24/7 SOC or one engineer with good automation, the loop is the same \u2014 and it never stops." },
            { t: "h", text: "Red, blue & purple" },
            {
              t: "table",
              headers: ["Team", "Role"],
              rows: [
                ["<strong>Blue</strong>", "Defend: monitor, detect, respond, harden"],
                ["<strong>Red</strong>", "Attack (authorized): test defenses like a real adversary"],
                ["<strong>Purple</strong>", "Red + blue collaborating to improve detection"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Authorization is the line</strong> between security testing and a crime. Red teams, pen tests and bug bounties operate under explicit written permission and a defined scope. The skills in this atlas are for defending systems and testing your own \u2014 with consent." },
            { t: "h", text: "Security is a culture, not a gate" },
            {
              t: "ul", items: [
                "<strong>Shift left</strong> \u2014 build security in during design and development, not as a final gate.",
                "Make the secure path the easy path (paved roads, safe defaults).",
                "Blameless post-mortems \u2014 people report mistakes when they aren't punished.",
                "Ongoing awareness \u2014 the human layer is part of the defense.",
                "Measure what matters: time-to-detect and time-to-respond."
              ]
            },
            { t: "note", variant: "tip", html: "You've now walked the full loop \u2014 foundations, cryptography, application security, and defensive operations. Real skill comes from doing: build something, threat-model it, then try to break it (with permission) and watch your own logs light up." },
            { t: "quiz", id: "defense-respond" }
          ]
        }
      ]
    }
  ]
};
