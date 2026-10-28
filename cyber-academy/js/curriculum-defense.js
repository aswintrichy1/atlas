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
            { t: "note", variant: "tip", html: "<strong>Segmentation contains blast radius.</strong> Put the database in a tier that only the app tier can reach; keep user laptops off the server VLANs. When something is popped, segmentation decides whether it's one box or the whole estate." },
            { t: "note", variant: "trap", html: "<strong>Flat networks</strong> \u2014 everything can reach everything \u2014 are how ransomware spreads from one phished laptop to every server in hours. Segment by sensitivity and default-deny between zones." },
            { t: "note", variant: "key", html: "<strong>A firewall only knows the paths you thought to write down.</strong> Rules govern where traffic may go, never what it carries \u2014 so an attacker who lands on the app tier inherits the app tier's standing permission to reach the database, over a connection that looks identical to every legitimate one. Segmentation buys you fewer paths to watch and more time to notice; deciding that a permitted query is hostile is a job it cannot do for you." }
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
            { t: "note", variant: "tip", html: "<strong>Encrypt internal traffic too.</strong> The old model trusted the LAN and encrypted only the edge. Modern designs encrypt service-to-service with mTLS \u2014 a captured internal link should reveal nothing. This is the network face of zero trust." },
            { t: "h", text: "Getting transport right" },
            {
              t: "ul", items: [
                "Disable SSL and TLS 1.0/1.1; require TLS 1.2+ with modern cipher suites.",
                "Use <strong>HSTS</strong> so browsers refuse to downgrade to HTTP.",
                "Prefer forward-secret key exchange (ECDHE) everywhere.",
                "Manage certificate lifecycles \u2014 expiry causes outages and panic-driven mistakes."
              ]
            },
            { t: "note", variant: "trap", html: "Stripping or downgrading TLS is a classic on-path attack. Without HSTS, a single plaintext request can be hijacked before the redirect to HTTPS ever happens." },
            { t: "note", variant: "key", html: "<strong>Transport encryption proves you reached a name, not that the name deserves your data.</strong> A valid certificate says the far end controls that hostname and that the wire is confidential; it says nothing about whether the code behind it is trustworthy or whether it should be holding what you are about to send. Encrypting the link removes the network as an attacker position and moves the whole fight to the endpoints \u2014 which is where the data is decrypted, and where the breaches are." }
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
            { t: "note", variant: "tip", html: "A <strong>SIEM</strong> (Security Information and Event Management) centralizes logs from across the estate and correlates them \u2014 a failed login here plus a privilege change there plus data egress becomes one alert. Centralization also stops attackers from erasing local logs to cover their tracks." },
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
            { t: "note", variant: "tip", html: "Logging without alerting is just expensive storage. Define detections for the events that matter and tune them \u2014 an ignored, noisy alert console is the same as no monitoring at all." },
            { t: "note", variant: "key", html: "<strong>An investigation can only reach as far back as a decision you made months earlier.</strong> You cannot retroactively collect the event you never enabled, and a retention window silently caps how much of an intrusion you will ever be able to reconstruct \u2014 which turns two boring budget questions, what to log and for how long, into the real limit on what you can discover. Volume is not the measure; the measure is whether the events that would expose an intruder are among the ones you kept." }
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
            { t: "note", variant: "trap", html: "The hard part is the trade-off between <strong>false positives</strong> (crying wolf \u2014 analysts tune out) and <strong>false negatives</strong> (missing the real thing). An IPS set too aggressively can also block legitimate traffic, so prevention is tuned carefully." },
            { t: "h", text: "Beyond the network" },
            {
              t: "ul", items: [
                "<strong>EDR</strong> \u2014 endpoint detection & response watches process/host behavior.",
                "<strong>NDR</strong> \u2014 network detection & response analyzes traffic patterns.",
                "<strong>XDR</strong> \u2014 correlates across endpoint, network, identity and cloud.",
                "Threat-intelligence feeds supply known-bad indicators (IOCs)."
              ]
            },
            { t: "note", variant: "tip", html: "Detection works best in <strong>layers</strong>, mapped to attacker behavior. Frameworks like MITRE ATT&CK help you ask \u201cwhich techniques can we actually see?\u201d and find the blind spots." },
            { t: "note", variant: "key", html: "<strong>A detection system reports what it was taught to look for, and silence is not evidence.</strong> Signatures find what somebody already wrote down, anomaly models find deviation from a baseline that a patient attacker can reshape, and neither has much to say about an intruder using sanctioned tools with valid credentials. So read an empty queue as a question about coverage rather than a statement about safety \u2014 the useful exercise is naming a technique and checking whether any sensor you own would have produced a record of it." }
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
            { t: "note", variant: "tip", html: "<strong>Phishing</strong> is the most common delivery mechanism by far. Most intrusions begin with a human clicking something \u2014 which is why recognizing a malicious message or link is a frontline skill, not just an IT concern." },
            { t: "h", text: "Inspect a suspicious link" },
            { t: "p", html: "Defenders read URLs carefully. Paste a link below to highlight the real registrable domain and common deception tricks \u2014 lookalike domains, the <code>@</code> trick, punycode, and credential-in-URL." },
            { t: "widget", id: "phish" },
            { t: "note", variant: "trap", html: "The weakest link is rarely the firewall \u2014 it's a tired human at 4:59pm. Technical controls (MFA, email filtering, link rewriting) must assume someone <em>will</em> click, and limit what that click can do." },
            { t: "note", variant: "key", html: "<strong>You do not have to catch the first move.</strong> That is the whole reason for staging an intrusion: the callback to command and control, the reuse of a credential somewhere it has never been used, the bulk read that precedes exfiltration \u2014 each is another link, and the later ones are harder for an attacker to avoid than the initial click. Build detection on the assumption that delivery already worked, because a defense that only tries to stop step one gets exactly one chance to be right." },
            { t: "quiz", id: "defense-detect" }
          ]
        },
        {
          id: "detection-engineering",
          title: "Detection engineering: from case study to rule",
          summary: "Turn painful incidents into durable detections, tests, false-positive notes and analyst runbooks.",
          minutes: 11,
          tags: ["practitioner", "detection", "soc", "rule-engineering"],
          blocks: [
            { t: "p", html: "A case study is useful only if it changes what you do. <strong>Detection engineering</strong> converts attacker behavior into a maintained detection: data source, logic, severity, triage steps, false-positive notes and tests." },
            { t: "ol", items: [
              "<strong>Pick behavior</strong> high on the Pyramid of Pain: process spawning, credential reset, unusual egress or privilege change.",
              "<strong>Confirm telemetry</strong>: which log source proves it, and is it retained long enough?",
              "<strong>Write logic</strong>: start broad, then tune with known-good examples.",
              "<strong>Add a runbook</strong>: what should an analyst check in the first five minutes?",
              "<strong>Test and review</strong>: simulate safe fixtures that should and should not match; track false positives."
            ] },
            { t: "h", text: "The detection card" },
            { t: "table", headers: ["Field", "What to write"], rows: [
              ["Hypothesis", "If an attacker is using this technique, what behavior should appear?"],
              ["Telemetry source", "Which endpoint, identity, proxy, DNS or cloud event proves it?"],
              ["Plain-language logic", "Which events, thresholds, joins, time windows and exclusions?"],
              ["False positives", "Which admin tasks, automation or maintenance can look similar?"],
              ["Runbook", "First five checks, evidence, escalation and containment trigger"],
              ["Test cases", "One should fire, one should not and one known-benign edge case"]
            ] },
            { t: "p", html: "Use the builder below to assemble a complete detection card for a fictional identity or endpoint scenario. The output stays in plain language so peers can challenge the hypothesis before anyone writes SIEM syntax." },
            { t: "widget", id: "detectioncard" },
            { t: "quiz", id: "threats-detection" },
            { t: "note", variant: "key", html: "Every incident should leave behind at least one maintained control: a detection, a blocked path, a patch SLA, a runbook or an architecture change." }
          ]
        },
        {
          id: "sigma-kql-spl",
          title: "Portable detection logic: Sigma, KQL and SPL",
          summary: "Express one behavior clearly, then implement it against the fields and time model of each SIEM.",
          minutes: 12,
          tags: ["advanced", "sigma", "kql", "spl", "siem"],
          blocks: [
            { t: "p", html: "<strong>Sigma</strong> is a portable rule format for log detections; <strong>KQL</strong> and <strong>SPL</strong> are query languages used by Microsoft and Splunk ecosystems. Translation is not mechanical: field names, event semantics, joins and ingestion delay differ by data source." },
            { t: "table", headers: ["Layer", "Question", "Example"], rows: [
              ["Hypothesis", "What attacker behavior should be visible?", "A new privileged group member is followed by access from a new device"],
              ["Sigma", "What product-neutral event selection and condition describe it?", "Identity group-change category plus risk filters"],
              ["KQL / SPL", "How do local tables, indexes and fields implement it?", "Normalize actor, target, group, device and event time"],
              ["Runbook", "What evidence makes this benign or urgent?", "Change ticket, approver, source device, follow-on actions"]
            ] },
            { t: "code", lang: "yaml", code:
              "title: Privileged group membership changed\n" +
              "logsource: { category: iam }\n" +
              "detection:\n" +
              "  selection: { action: group_member_added, target_group_class: privileged }\n" +
              "  condition: selection\n" +
              "falsepositives: [approved identity administration]\n" +
              "level: high" },
            { t: "p", html: "A KQL implementation might filter an identity audit table, project normalized fields and join device risk in a bounded time window. An SPL implementation searches the correct index/sourcetype, normalizes with field aliases and uses stats or transaction logic carefully. Preserve the hypothesis when syntax changes." },
            { t: "widget", id: "ruleplanner" },
            { t: "note", variant: "warn", html: "Do not deploy an auto-translated query directly. Verify field coverage, null behavior, time windows and expected volume against safe fixtures and representative benign telemetry." },
            { t: "note", variant: "key", html: "<strong>Portability lives in the hypothesis and tests, not in identical query text.</strong>" }
          ]
        },
        {
          id: "detection-rule-ci",
          title: "Detection rule CI: lint, fixtures, replay, review and release",
          summary: "Treat rules as versioned products with deterministic tests and measurable production health.",
          minutes: 11,
          tags: ["advanced", "detection-as-code", "ci", "testing", "rule-lifecycle"],
          blocks: [
            { t: "ol", items: [
              "<strong>Lint</strong> schema, ids, required metadata, severity and ATT&CK mappings.",
              "<strong>Unit test</strong> synthetic event fixtures: should-fire, should-not-fire and known-benign edge cases.",
              "<strong>Compile</strong> Sigma or templates into the target backend and reject unsupported constructs.",
              "<strong>Replay</strong> against a privacy-safe sample or staging SIEM to estimate volume and cost.",
              "<strong>Peer review</strong> logic, data dependencies, runbook and containment authority.",
              "<strong>Release progressively</strong>: shadow, alert-only, tuned production; monitor misses, noise and data-source health."
            ] },
            { t: "table", headers: ["CI check", "Failure means"], rows: [
              ["Schema and unique id", "The rule cannot be managed reliably"],
              ["Should-fire fixture", "A known behavior is no longer detected"],
              ["Benign fixture", "A normal workflow would page analysts"],
              ["Field contract", "The source stopped sending required normalized fields"],
              ["Volume budget", "The query is too broad or expensive"],
              ["Runbook link / owner", "An alert has no accountable response path"]
            ] },
            { t: "p", html: "Safe fixtures describe fictional events and expected matches; they do not execute attacker procedures. Keep sensitive production logs out of public rule repositories, and test containment automation separately with approvals and dry runs." },
            { t: "quiz", id: "defense-rule-engineering" },
            { t: "note", variant: "key", html: "<strong>A detection without tests is a belief; a detection without an owner is abandoned code.</strong>" }
          ]
        }
      ]
    },
    /* ============================ IDENTITY DEFENSE ============================ */
    {
      id: "identity-defense",
      name: "AD & Kerberos Defense",
      icon: "lock",
      lessons: [
        {
          id: "ad-kerberos-model",
          title: "Active Directory and Kerberos: the defender's model",
          summary: "Understand domains, controllers, tickets and trust so the signals and hardening choices make sense.",
          minutes: 11,
          tags: ["practitioner", "active-directory", "kerberos", "identity"],
          blocks: [
            { t: "p", html: "<strong>Active Directory (AD)</strong> stores enterprise identities, computers, groups, policies and trusts. <strong>Kerberos</strong> is its primary network authentication protocol: the Key Distribution Center on a domain controller issues a ticket-granting ticket (TGT), then service tickets for specific services." },
            { t: "table", headers: ["Component", "Role", "Defensive concern"], rows: [
              ["Domain controller / KDC", "Directory plus ticket issuer", "Tier-zero asset; isolate administration and monitor every change"],
              ["TGT", "Lets a principal request service tickets", "Short lifetime, protected endpoints, revoke by account action and key rotation when required"],
              ["Service ticket", "Presents identity to one service", "Service-account key strength, scope and anomalous request patterns"],
              ["Group / delegation", "Translates identity into privilege", "Nested privilege, stale membership and risky delegation paths"],
              ["Trust", "Allows identity across domains or forests", "Direction, filtering and which identities may cross"]
            ] },
            { t: "p", html: "Kerberos avoids sending the password to each service, but tickets remain bearer-like evidence: a stolen valid ticket can be replayed until it expires or the relevant account keys are rotated. Endpoint protection, time synchronization and narrow privilege still matter." },
            { t: "note", variant: "key", html: "<strong>The directory is both the map and the authority.</strong> Defend the identities and relationships that can change it, not only the servers that store it." }
          ]
        },
        {
          id: "ad-attack-paths",
          title: "AD and Kerberos attack paths: defensive recognition",
          summary: "Recognize ticket abuse, credential exposure, delegation and privilege relationships without reproducing exploit procedures.",
          minutes: 12,
          tags: ["advanced", "active-directory", "attack-path", "credential-theft", "defensive"],
          blocks: [
            { t: "note", variant: "warn", html: "This lesson is defensive only. It names attack classes so defenders can harden and detect them; it does not provide commands, payloads, credential material or exploitation steps." },
            { t: "table", headers: ["Attack class", "What it abuses", "Defender signals"], rows: [
              ["Password or hash reuse", "A reusable authenticator from one host reaches another", "New device, unusual logon type, rapid lateral authentication, privileged logon after endpoint alert"],
              ["Service-ticket cracking pressure", "Weak service-account passwords and broadly discoverable service names", "Unusual bursts of service-ticket requests, old passwords, high-value service principals"],
              ["TGT or service-ticket theft", "Tickets copied from a compromised endpoint", "Ticket use from an unexpected host, impossible sequence, endpoint credential-access telemetry"],
              ["Forged-ticket persistence", "Compromise of highly sensitive domain or service keys", "Ticket anomalies plus directory compromise evidence; requires key-rotation incident runbook"],
              ["Delegation abuse", "A service may impersonate users to other services", "Delegation setting changes, unusual service-to-service identity chains"],
              ["Privilege-path chaining", "Group nesting, ACLs, sessions and local admin relationships", "Graph path to tier zero, newly added edge, high-risk session on lower-tier host"]
            ] },
            { t: "widget", id: "addefense" },
            { t: "p", html: "Investigate the sequence, not one event: source endpoint risk, identity history, ticket requests, target systems, group changes and subsequent data access. Preserve domain-controller and endpoint evidence before rotating the keys that invalidate it." },
            { t: "note", variant: "key", html: "<strong>Most directory compromise is a path, not a single magic ticket.</strong> Break one reusable credential, privileged relationship or unmanaged endpoint edge and the path stops." }
          ]
        },
        {
          id: "ad-hardening-detection",
          title: "AD hardening and detection operations",
          summary: "Tier administration, reduce reusable credentials, govern service accounts and test identity detections.",
          minutes: 12,
          tags: ["advanced", "active-directory", "hardening", "tiering", "detection"],
          blocks: [
            { t: "ul", items: [
              "Treat domain controllers, directory synchronization, certificate services and privileged access systems as tier zero.",
              "Use dedicated privileged admin accounts and hardened admin workstations; never browse email or the web in a tier-zero session.",
              "Prefer managed service accounts with long, automatically rotated keys; inventory every service principal and owner.",
              "Remove legacy protocols where possible, require modern signing/channel protections and keep domain-controller clocks and audit policy healthy.",
              "Minimize delegation, local administrator reuse and standing privileged groups; expire emergency membership.",
              "Continuously graph effective privilege and remediate the shortest paths to tier zero."
            ] },
            { t: "table", headers: ["Detection hypothesis", "Telemetry"], rows: [
              ["Privileged group changed outside approved workflow", "Directory audit plus change ticket and actor device"],
              ["Service-ticket request pattern departs from the account baseline", "KDC ticket events, service principal and source host"],
              ["Privileged identity authenticates from a lower-trust workstation", "Domain logon events, device tier and EDR risk"],
              ["Delegation or trust configuration changed", "Directory configuration audit and owner approval"],
              ["Directory replication behavior appears from a non-controller identity", "Directory-service events and network source"]
            ] },
            { t: "quiz", id: "defense-ad" },
            { t: "note", variant: "key", html: "<strong>Protect tier zero by controlling where its identities may appear, then alert whenever reality violates that map.</strong>" }
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
            { t: "note", variant: "tip", html: "<strong>Containment usually comes before eradication.</strong> Isolate affected systems to stop spread first; investigate and remove second. Preserve evidence (don't just wipe and reboot) if the incident may be legal or regulated." },
            { t: "h", text: "Decisions that go better when pre-made" },
            {
              t: "ul", items: [
                "Who declares an incident, and who can authorize taking systems offline?",
                "How and when do you involve legal, comms, leadership and regulators?",
                "What are your notification obligations and their deadlines?",
                "How do you communicate when normal channels may be compromised?"
              ]
            },
            { t: "note", variant: "trap", html: "An untested plan is a wish. Run <strong>tabletop exercises</strong> \u2014 walk through a realistic scenario \u2014 so people know their roles before the real 3am call. Practice is what converts a plan into competence." },
            { t: "note", variant: "key", html: "<strong>The lifecycle is a structure for making decisions, not a checklist to complete.</strong> What actually goes wrong at 3am is rarely a missing tool; it is a decision made too late or by someone without the authority to make it \u2014 who may take revenue-generating systems offline, when legal and comms are pulled in, whether preserving evidence outranks restoring service. Preparation is the only phase you get to do calmly, and it quietly sets the ceiling on how well every phase after it goes." }
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
            { t: "note", variant: "tip", html: "<strong>Most breaches exploit known vulnerabilities with available patches.</strong> Attackers don't need a zero-day when last quarter's unpatched CVE is sitting on an internet-facing box. Patch management is unsexy and it wins." },
            { t: "note", variant: "trap", html: "Backups aren't a recovery plan until you've <strong>restored from them</strong>. Ransomware specifically hunts and encrypts backups \u2014 keep offline/immutable copies and rehearse the restore." },
            { t: "stat", items: [
              { v: "Patch", k: "close known holes first" },
              { v: "Minimize", k: "fewer services = smaller surface" },
              { v: "MFA", k: "kill credential replay" },
              { v: "Restore", k: "a tested backup is the real control" }
            ] },
            { t: "note", variant: "key", html: "<strong>A hardened system starts drifting the day it goes into service.</strong> A service gets re-enabled for one debugging session, a temporary exception outlives the person who asked for it, a new dependency arrives carrying a default account \u2014 none of which is visible in the build you signed off. So the durable control is not the baseline but continuous measurement against it, paired with a patch cadence you can genuinely hold, because an attacker only has to find the single host that fell out of the pattern." }
          ]
        },
        {
          id: "cyber-resilience-recovery",
          title: "Cyber resilience & recovery",
          summary: "Recovery is designed before the outage. RTO, RPO, backups and communications decide whether an incident becomes a business crisis.",
          minutes: 9,
          tags: ["resilience", "recovery", "ransomware"],
          blocks: [
            { t: "p", html: "<strong>Cyber resilience</strong> asks a blunt question: when security fails, can the organization keep critical functions running and recover cleanly? Prevention matters, but recovery planning decides how much damage becomes permanent." },
            { t: "h", text: "BIA, RTO and RPO" },
            {
              t: "table",
              headers: ["Term", "Meaning", "Example decision"],
              rows: [
                ["BIA", "Business Impact Analysis: which processes matter most and what downtime costs", "Payroll can pause longer than emergency dispatch"],
                ["RTO", "Recovery Time Objective: how quickly a system must return", "Customer login back within 4 hours"],
                ["RPO", "Recovery Point Objective: how much data loss is tolerable", "No more than 15 minutes of orders lost"],
                ["Runbook", "The tested steps, owners and dependencies for recovery", "Restore database, validate app, reopen traffic"]
              ]
            },
            { t: "h", text: "Backups that survive ransomware" },
            {
              t: "ul", items: [
                "<strong>Immutable or offline copies</strong> stop attackers from encrypting or deleting every backup.",
                "Separate backup credentials from production admins; a domain admin compromise should not own recovery.",
                "Test restores on a schedule and measure whether they meet the RTO and RPO.",
                "Keep clean build media, infrastructure templates and key material available for a rebuild."
              ]
            },
            { t: "h", text: "Ransomware decision flow" },
            {
              t: "ol", items: [
                "<strong>Stabilize</strong>: isolate affected systems, preserve evidence and protect backups.",
                "<strong>Assess</strong>: determine business impact, data exposure, restore options and legal obligations.",
                "<strong>Decide</strong>: leadership, legal, security and business owners choose a path using pre-agreed criteria.",
                "<strong>Recover</strong>: rebuild from trusted sources, restore clean data, rotate credentials and monitor for reinfection.",
                "<strong>Communicate</strong>: use crisis channels that do not depend on compromised email or chat."
              ]
            },
            { t: "note", variant: "tip", html: "Crisis communications should be drafted and rehearsed before the incident: who informs employees, customers, regulators, partners and executives, and what channel is trusted if normal collaboration tools are down." },
            { t: "note", variant: "key", html: "<strong>Recovery capability is measured in rehearsals, not in copies.</strong> An RTO and an RPO are promises until someone has restored end to end with the people, credentials, runbooks and dependencies you would actually have on the day \u2014 and the backup estate is targeted precisely because so few organizations have walked that path. The sharpest test is to assume your production administrators are already compromised and ask whether recovery still works; if one credential owns both production and the backups, you do not have two systems." },
            { t: "quiz", id: "defense-resilience" }
          ]
        },
        {
          id: "edge-kev-triage",
          title: "Edge devices & KEV triage",
          summary: "Internet-facing appliances are high-value targets. Triage them by exposure, active exploitation, and recovery impact.",
          minutes: 7,
          tags: ["edge", "kev", "triage", "operations"],
          blocks: [
            { t: "p", html: "<strong>Edge devices</strong> sit where attackers can reach them: VPN concentrators, firewalls, identity proxies, mail gateways, routers, and remote-management appliances. They often have broad network reach, hold sensitive config, and lag behind normal endpoint tooling." },
            { t: "note", variant: "warn", html: "This is defensive triage only. Do not reproduce exploit steps or test live appliances outside an authorized change window. The defender's job is to identify exposure, patch, contain, and verify." },
            { t: "h", text: "Why edge bugs get urgent" },
            {
              t: "ul", items: [
                "They are usually <strong>internet-facing</strong>, so attackers can scan them at scale.",
                "They may sit <strong>before</strong> normal authentication, logging, or endpoint controls.",
                "A compromise can expose VPN sessions, device config, routing, or credentials.",
                "Patching can be operationally sensitive, so teams delay it unless triage is crisp."
              ]
            },
            { t: "h", text: "KEV-driven triage loop" },
            {
              t: "ol", items: [
                "<strong>Inventory</strong> every edge device, firmware version, owner, internet exposure, and management path.",
                "<strong>Match</strong> advisories against CISA KEV, vendor notices, asset criticality, and whether the device is reachable from the internet.",
                "<strong>Prioritize</strong> known-exploited plus exposed devices first, even if another finding has a higher theoretical score.",
                "<strong>Contain</strong> by disabling exposed management, restricting source IPs, rotating device-held secrets, and watching for suspicious sessions.",
                "<strong>Verify</strong> patch level, clean configuration, logs, and backup/restore readiness after remediation."
              ]
            },
            { t: "table",
              headers: ["Signal", "Triage meaning"],
              rows: [
                ["KEV listed", "Treat as active exploitation risk, not a theoretical bug"],
                ["Internet exposed", "Patch or mitigate before internal-only assets"],
                ["Pre-auth path", "Higher urgency because credentials may not be required"],
                ["No EDR/log coverage", "Add network and appliance logging before and after patching"]
              ]
            },
            { t: "stat", items: [
              { v: "Expose", k: "is it reachable?" },
              { v: "KEV", k: "is it exploited?" },
              { v: "Contain", k: "limit management paths" },
              { v: "Verify", k: "patch, logs, secrets" }
            ] },
            { t: "note", variant: "key", html: "<strong>Patching an exposed appliance closes the door; it does not tell you whether anyone already walked through it.</strong> These devices sit in front of your authentication and usually outside your endpoint tooling, so sessions, device-held secrets and configuration each have to be cleared on their own evidence before you call the case shut \u2014 treat a known-exploited flaw on an internet-facing box as an incident until the logs say otherwise. And let exposure plus confirmed exploitation set your order of work; the number attached to the advisory is a distant third." }
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
            { t: "note", variant: "warn", html: "<strong>Authorization is the line</strong> between security testing and a crime. Red teams, pen tests and bug bounties operate under explicit written permission and a defined scope. The skills in this atlas are for defending systems and testing your own \u2014 with consent." },
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
            { t: "note", variant: "key", html: "<strong>Operations is the part of security that compounds.</strong> A control is bought once and decays from there, while the loop \u2014 detect, respond, then push the fix back into the default path everyone already uses \u2014 converts each incident into coverage you keep. That is also why time to detect and time to contain are the numbers worth defending in a review: they describe whether the loop is turning, where counts of tools and blocked events only describe activity." },
            { t: "quiz", id: "defense-respond" }
          ]
        }
      ]
    }
  ]
};
