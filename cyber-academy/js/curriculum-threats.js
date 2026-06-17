/* =====================================================================
   CITADEL · Threats, Malware & Forensics curriculum
   window.TRACKS.threats  ·  block grammar documented in curriculum-core.js
   Defensive framing: understand adversaries, malware behavior, and how
   to investigate after the fact. No malware samples, no weaponization.
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.threats = {
  id: "threats",
  name: "Threats, Malware & Forensics",
  short: "THREATS",
  tagline: "Know the adversary, read the evidence",
  color: "#c084fc",
  blurb: "The intelligence and investigation side of defense: cyber threat intelligence and the MITRE ATT&CK framework, indicators and the Pyramid of Pain, threat hunting, malware families and how analysts study them safely, evasion tricks, and digital forensics from chain of custody to memory, disk and network artifacts.",
  modules: [
    /* ============================ THREAT INTEL ============================ */
    {
      id: "intel",
      name: "Threat intelligence",
      icon: "trend",
      lessons: [
        {
          id: "cti",
          title: "Threat intelligence & MITRE ATT&CK",
          summary: "Turn raw data about attackers into decisions — and use a shared map of adversary behavior to find your blind spots.",
          minutes: 8,
          tags: ["threat-intel", "attack"],
          blocks: [
            { t: "p", html: "<strong>Cyber threat intelligence (CTI)</strong> is knowledge about adversaries \u2014 who they are, what they want, and how they operate \u2014 turned into decisions. It only counts as intelligence if it changes what you <em>do</em>: which detections you build, which assets you harden first." },
            {
              t: "table",
              headers: ["Level", "Audience", "Answers"],
              rows: [
                ["<strong>Strategic</strong>", "Leadership", "Who targets our industry, and why?"],
                ["<strong>Operational</strong>", "Defenders", "Which campaigns & TTPs are active now?"],
                ["<strong>Tactical</strong>", "SOC / tools", "Which specific indicators to detect/block?"]
              ]
            },
            { t: "h", text: "ATT&CK: the shared map of behavior" },
            { t: "p", html: "<strong>MITRE ATT&CK</strong> is a free, community knowledge base of real-world adversary behavior, organized as <strong>tactics</strong> (the attacker's goal at each stage) and <strong>techniques</strong> (how they achieve it). It gives defenders one vocabulary for \u201cwhat are we actually watching for?\u201d" },
            { t: "p", html: "Browse the enterprise tactics below \u2014 each is a stage of an intrusion, with example techniques and the kind of defense that catches them." },
            { t: "widget", id: "attack" },
            { t: "note", variant: "key", html: "ATT&CK's power is <strong>coverage mapping</strong>: list the techniques you can actually detect, and the gaps jump out. \u201cWe have great coverage of execution but nothing for lateral movement\u201d is a roadmap, not a guess." },
            { t: "note", variant: "tip", html: "TTPs \u2014 <strong>Tactics, Techniques, and Procedures</strong> \u2014 describe attacker behavior from general to specific. Behavior is far harder for an adversary to change than an IP or a file hash, which is exactly the point of the next lesson." }
          ]
        },
        {
          id: "pyramid-iocs",
          title: "Indicators & the Pyramid of Pain",
          summary: "Not all detection is equal. Some indicators an attacker swaps in seconds; others cost them their whole playbook.",
          minutes: 7,
          tags: ["iocs", "detection"],
          blocks: [
            { t: "p", html: "An <strong>indicator of compromise (IOC)</strong> is an observable sign of malicious activity \u2014 a file hash, an IP, a domain, a registry key. But blocking IOCs is a treadmill if you pick the wrong ones. The <strong>Pyramid of Pain</strong> ranks indicators by how much it hurts the attacker when you deny them." },
            { t: "p", html: "Click up the pyramid to see how trivially an attacker swaps each indicator \u2014 and why detecting behavior at the top is worth far more than blocking a hash at the bottom." },
            { t: "widget", id: "pyramid" },
            { t: "note", variant: "key", html: "<strong>Hashes are free for the attacker to change</strong> (recompile, and the hash is new). <strong>TTPs are expensive</strong> \u2014 forcing an adversary to re-tool their whole method is the most durable win in defense. Aim your detections high." },
            { t: "h", text: "IOCs vs IOAs" },
            {
              t: "ul", items: [
                "<strong>IOC</strong> \u2014 evidence an attack <em>has happened</em> (a known-bad hash appeared). Reactive, but easy to share.",
                "<strong>IOA (indicator of attack)</strong> \u2014 evidence an attack <em>is happening</em> by behavior (a Word doc spawned PowerShell that opened a network connection). Catches novel tools.",
                "Mature defense uses both: IOCs for fast, cheap blocking; IOAs for the attacks no one has seen before."
              ]
            },
            { t: "note", variant: "trap", html: "A feed of a million IP indicators feels powerful and mostly isn't \u2014 IPs rotate hourly. Quality over quantity: a few solid behavioral detections beat an ocean of stale, bottom-of-the-pyramid indicators." }
          ]
        },
        {
          id: "threat-hunting",
          title: "Threat hunting",
          summary: "Stop waiting for alerts. Hunting is the proactive search for the adversary your tools missed.",
          minutes: 6,
          tags: ["threat-hunting", "detection"],
          blocks: [
            { t: "p", html: "Most detection is reactive \u2014 you wait for a rule to fire. <strong>Threat hunting</strong> flips that: you assume an attacker is already inside and go looking, forming hypotheses and testing them against your data. It finds the intrusions that slipped past automated defenses." },
            { t: "h", text: "Hypothesis-driven hunting" },
            {
              t: "ol", items: [
                "<strong>Hypothesize</strong> \u2014 \u201cif an attacker used technique X, we'd see Y in our logs.\u201d (ATT&CK is a great hypothesis generator.)",
                "<strong>Gather</strong> \u2014 pull the relevant data: endpoint telemetry, network logs, authentication events.",
                "<strong>Analyze</strong> \u2014 look for the pattern; investigate anomalies.",
                "<strong>Respond or refine</strong> \u2014 escalate a find to incident response, or turn a fruitful hunt into a new automated detection."
              ]
            },
            { t: "note", variant: "key", html: "A successful hunt's best output is often a <strong>new detection rule</strong>. You hunted manually once; now the SIEM watches for it forever. Hunting and detection engineering feed each other." },
            { t: "p", html: "Hunting depends on the logging and visibility you built in the Defense track \u2014 you can only hunt through data you actually collect. No telemetry, no hunt." },
            { t: "h", text: "Map your detection coverage" },
            { t: "p", html: "Lay your detections over the ATT&CK tactics and the gaps reveal themselves. Click each technique you could actually <em>detect</em> today \u2014 the tactics that stay empty are your <strong>blind spots</strong>, and they make the best next hunt." },
            { t: "widget", id: "attackmatrix" },
            { t: "note", variant: "tip", html: "Good hunters think in behaviors, not artifacts. \u201cAny process making outbound connections it never made before\u201d catches tomorrow's malware; \u201cthis one bad IP\u201d catches only yesterday's." },
            { t: "quiz", id: "threats-intel" }
          ]
        }
      ]
    },
    /* ============================ MALWARE ============================ */
    {
      id: "malware",
      name: "Malware",
      icon: "bug",
      lessons: [
        {
          id: "malware-types",
          title: "Malware types & families",
          summary: "A field guide to malicious software — what each type does and how it spreads — so the behavior in your logs has a name.",
          minutes: 8,
          tags: ["malware", "fundamentals"],
          blocks: [
            { t: "p", html: "<strong>Malware</strong> is any software written to harm or subvert a system. The categories overlap \u2014 modern threats are modular \u2014 but knowing the archetypes lets you recognize behavior and reason about impact." },
            {
              t: "table",
              headers: ["Type", "Defining behavior"],
              rows: [
                ["<strong>Virus</strong>", "Attaches to a file; spreads when that file runs"],
                ["<strong>Worm</strong>", "Self-propagates across networks, no user needed"],
                ["<strong>Trojan</strong>", "Poses as legitimate software to get run"],
                ["<strong>Ransomware</strong>", "Encrypts data and extorts payment"],
                ["<strong>Rootkit</strong>", "Hides deep in the OS to evade detection"],
                ["<strong>RAT</strong>", "Remote access trojan \u2014 hands-on-keyboard control"],
                ["<strong>Botnet</strong>", "Network of infected hosts under one controller"],
                ["<strong>Spyware / infostealer</strong>", "Quietly harvests data, credentials, keystrokes"],
                ["<strong>Loader / dropper</strong>", "A small first stage that pulls in the rest"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Ransomware is the dominant business threat</strong> \u2014 and it has evolved to <em>double extortion</em>: steal the data first, then encrypt it, so backups alone don't save you from the leak. This is why egress monitoring and offline backups both matter." },
            { t: "h", text: "How it gets in" },
            {
              t: "ul", items: [
                "<strong>Phishing</strong> \u2014 still the number-one delivery vehicle.",
                "<strong>Drive-by & malvertising</strong> \u2014 a compromised or malicious web page.",
                "<strong>Vulnerable services</strong> \u2014 an unpatched, internet-facing app (worms love these).",
                "<strong>Supply chain</strong> \u2014 a trusted update or dependency turned hostile.",
                "<strong>Removable media</strong> \u2014 the USB drop, still effective."
              ]
            },
            { t: "note", variant: "tip", html: "\u201cLiving off the land\u201d is the modern twist: instead of dropping obvious malware, attackers abuse legitimate built-in tools (scripting engines, admin utilities) so their activity blends into normal operations. It's why behavioral detection beats signatures." }
          ]
        },
        {
          id: "malware-analysis",
          title: "Static vs dynamic analysis",
          summary: "How analysts study malicious code without becoming the next victim — two complementary approaches, one safe environment.",
          minutes: 8,
          tags: ["malware-analysis", "reverse-engineering"],
          blocks: [
            { t: "p", html: "When something suspicious lands, analysts need to know what it does \u2014 without detonating it on a real network. <strong>Malware analysis</strong> has two complementary modes, and both happen inside strict isolation." },
            { t: "p", html: "Sort each technique into the right approach \u2014 examining the file at rest, or watching it run." },
            { t: "widget", id: "analysis" },
            {
              t: "table",
              headers: ["", "Static analysis", "Dynamic analysis"],
              rows: [
                ["Approach", "Examine without running it", "Run it and watch behavior"],
                ["Looks at", "Strings, headers, code, hashes", "Files, registry, network, processes"],
                ["Strength", "Safe; sees all code paths", "Reveals real, unpacked behavior"],
                ["Weakness", "Packing/obfuscation hides it", "May miss paths that don't trigger"]
              ]
            },
            { t: "note", variant: "warn", html: "<strong>Isolation is non-negotiable.</strong> Dynamic analysis runs in a disposable sandbox or an air-gapped VM with snapshots, never on a production machine or a network that can reach one. \u201cI'll just quickly run it\u201d is how analysts become incidents." },
            { t: "h", text: "Reverse engineering, briefly" },
            { t: "p", html: "<strong>Reverse engineering</strong> goes deeper than static analysis \u2014 disassembling or decompiling a binary to understand its logic instruction by instruction. It's how analysts extract decryption keys, map command-and-control protocols, and write precise detections. It's a craft of its own, central to malware research and exploit analysis alike." },
            { t: "note", variant: "key", html: "The output of analysis is <strong>actionable defense</strong>: new signatures, behavioral detections, blocked C2 domains, and a clear impact assessment for responders. Analysis that doesn't feed detection is just curiosity." }
          ]
        },
        {
          id: "evasion",
          title: "Evasion & anti-analysis",
          summary: "Malware fights back — hiding from signatures, sandboxes, and analysts. Knowing the tricks shapes how you detect it.",
          minutes: 6,
          tags: ["evasion", "detection"],
          blocks: [
            { t: "p", html: "Malware authors know they're being hunted, so they invest heavily in <strong>evasion</strong>. Understanding these tricks explains why old-school signature scanning isn't enough and why behavioral, layered detection is the modern answer." },
            {
              t: "table",
              headers: ["Evasion trick", "Defender's counter"],
              rows: [
                ["<strong>Packing / encryption</strong> of the payload", "Behavioral detection at runtime (it must unpack to run)"],
                ["<strong>Obfuscation</strong> of code & strings", "Detect behavior, not literal strings"],
                ["<strong>Anti-VM / anti-sandbox</strong> checks", "Hardened, realistic sandboxes; bare-metal analysis"],
                ["<strong>Anti-debugging</strong>", "Specialized tooling; static review"],
                ["<strong>Living off the land</strong>", "Baselining \u2014 flag <em>unusual use</em> of legit tools"],
                ["<strong>Time bombs / sleep</strong>", "Extended detonation; trigger conditions"]
              ]
            },
            { t: "note", variant: "key", html: "Notice the pattern: nearly every evasion of <em>static</em> signatures is defeated by watching <em>behavior</em>. A packed, obfuscated, novel binary still has to <em>act</em> \u2014 spawn a process, touch the registry, beat a path to the network \u2014 and that's where you catch it." },
            { t: "note", variant: "trap", html: "Because evasion keeps improving, no single control is enough. Defense in depth \u2014 email filtering, EDR, network detection, least privilege, segmentation \u2014 means defeating one layer still leaves the attacker facing the next." },
            { t: "quiz", id: "threats-malware" }
          ]
        }
      ]
    },
    /* ============================ REAL ATTACKS ============================ */
    {
      id: "case-studies",
      name: "Real attack case studies",
      icon: "map",
      lessons: [
        {
          id: "log4shell",
          title: "Log4Shell: one log line to remote code",
          summary: "How a logging feature became internet-scale remote code execution, and what the durable fixes looked like.",
          minutes: 8,
          tags: ["case-study", "rce", "patching"],
          blocks: [
            { t: "p", html: "<strong>What happened:</strong> attacker-controlled text reached a logging path in vulnerable Log4j versions. A logging feature then crossed a network boundary and could turn routine application input into code running in the application process." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "A dangerous feature was reachable from untrusted input inside a ubiquitous logging library."],
              ["Impact", "Remote code execution on exposed Java apps, followed by scanning, coin miners, web shells and hands-on intrusion attempts."],
              ["Detection signals", "Lookup patterns in logs, unusual outbound LDAP/RMI/DNS, new child processes from Java services, sudden internet-wide scanning."],
              ["Patch / mitigation", "Upgrade Log4j to a fixed release, remove the vulnerable lookup class only as an emergency stopgap, block unnecessary egress, and inventory transitive dependencies."],
              ["Lesson learned", "Dependency inventory and egress control matter. A library bug becomes catastrophic when every app can reach the internet and no one knows where the library is used."]
            ] },
            { t: "note", variant: "key", html: "The real fix was not a WAF regex. It was <strong>upgrade the vulnerable library everywhere</strong>, then prove everywhere by asset and dependency inventory." }
          ]
        },
        {
          id: "struts-equifax",
          title: "Apache Struts breach: known patch, missed asset",
          summary: "A public-facing framework bug, an unpatched server, and why vulnerability management is an engineering system.",
          minutes: 8,
          tags: ["case-study", "vulnerability-management"],
          blocks: [
            { t: "p", html: "<strong>Known-patch failure:</strong> an internet-facing dispute portal kept a vulnerable Apache Struts component after a fix was available. The missed asset and delayed remediation turned a known flaw into backend data access." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "Patch management and asset ownership failed: a known exploitable framework flaw remained reachable."],
              ["Impact", "Large-scale theft of sensitive personal data and long-running regulatory, legal and trust damage."],
              ["Detection signals", "Unexpected Struts error patterns, suspicious process execution from the web tier, unusual database queries, bulk data movement."],
              ["Patch / mitigation", "Apply the vendor fix, remove exposed vulnerable endpoints, rotate affected credentials, segment the app from sensitive stores, and run emergency scans for the same component."],
              ["Lesson learned", "Severity is not enough. Internet exposure, exploit availability, data sensitivity and ownership decide what must be patched first."]
            ] },
            { t: "note", variant: "trap", html: "A scanner finding is not remediation. The loop closes only when the owner patches, validates, and the asset is rescanned clean." }
          ]
        },
        {
          id: "wannacry",
          title: "WannaCry: ransomware as a worm",
          summary: "How one unpatched network service let ransomware spread without waiting for users to click.",
          minutes: 7,
          tags: ["case-study", "ransomware", "segmentation"],
          blocks: [
            { t: "p", html: "<strong>Spread pattern:</strong> WannaCry used an unpatched SMBv1 flaw to move machine to machine. Flat networks let one infected host become many, then ransomware turned technical compromise into operational outage." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "Legacy SMBv1 and missing MS17-010 patches left hosts exploitable over the network."],
              ["Impact", "Hospitals, businesses and public services lost access to systems and data, causing operational outages far beyond IT."],
              ["Detection signals", "SMB scanning bursts, many failed connections to port 445, sudden file encryption activity, ransom notes and process spikes."],
              ["Patch / mitigation", "Apply MS17-010, disable SMBv1, segment workstation and server networks, restrict east-west traffic, and keep offline or immutable backups."],
              ["Lesson learned", "Ransomware loves flat networks. Patching closes the hole; segmentation decides whether one host becomes the whole company."]
            ] },
            { t: "note", variant: "key", html: "Backups are only a control if restore has been tested and the attacker cannot encrypt the backup copy too." }
          ]
        },
        {
          id: "heartbleed",
          title: "Heartbleed: memory disclosure in TLS",
          summary: "A small bounds-check bug in a trusted crypto library leaked secrets from process memory.",
          minutes: 7,
          tags: ["case-study", "crypto", "tls"],
          blocks: [
            { t: "p", html: "<strong>Failure mode:</strong> a TLS heartbeat bounds-check bug let vulnerable OpenSSL return memory beyond the intended payload. The response could include secrets from the server process, so patching also required key and session rotation decisions." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "Missing bounds validation in a memory-unsafe code path inside a critical cryptographic library."],
              ["Impact", "Confidential data could leak silently. Private keys and session tokens had to be treated as potentially exposed."],
              ["Detection signals", "Hard to prove after the fact; look for heartbeat probes, unusual TLS traffic and vulnerable-version exposure windows."],
              ["Patch / mitigation", "Upgrade OpenSSL, restart dependent services, rotate certificates and private keys, invalidate sessions and reset exposed credentials where needed."],
              ["Lesson learned", "Patching code is only half the response. If secrets may have leaked, rotate the secrets and invalidate what they protected."]
            ] },
            { t: "note", variant: "tip", html: "Crypto failures often become <strong>key-management</strong> incidents. Ask what material might have been exposed, not just whether the package is now fixed." }
          ]
        },
        {
          id: "solarwinds",
          title: "SolarWinds Orion: trusted update, hostile payload",
          summary: "A supply-chain compromise showed why signed software still needs build-system security and runtime detection.",
          minutes: 8,
          tags: ["case-study", "supply-chain"],
          blocks: [
            { t: "p", html: "<strong>Supply-chain path:</strong> the software build process became the compromise point. Customers installed a trusted, signed Orion update, but runtime behavior still needed monitoring because signature trust did not prove benign intent." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "The build pipeline became a trusted distribution channel for attacker-controlled code."],
              ["Impact", "High-value organizations received a stealthy foothold through normal update mechanisms."],
              ["Detection signals", "Unexpected outbound beaconing from Orion servers, unusual identity activity, rare domain lookups, new privileged tokens or service principal use."],
              ["Patch / mitigation", "Install clean vendor builds, isolate affected servers, rotate credentials, review identity logs, rebuild trust in CI/CD, and monitor signed artifacts after deployment."],
              ["Lesson learned", "Code signing proves origin, not intent. Protect the build system like production, and watch trusted software at runtime."]
            ] },
            { t: "note", variant: "key", html: "Supply-chain defense is layered: hardened CI, least-privilege build credentials, reproducible or attestable builds, signed artifacts, and behavioral monitoring after install." }
          ]
        },
        {
          id: "moveit",
          title: "MOVEit Transfer: mass theft through managed file transfer",
          summary: "A file-transfer product became a data-exfiltration gateway because it sat on the internet with sensitive files behind it.",
          minutes: 7,
          tags: ["case-study", "sqli", "data-theft"],
          blocks: [
            { t: "p", html: "<strong>Data-theft path:</strong> an exposed managed file-transfer tier concentrated sensitive files behind one application. Input-handling failure plus broad data reach made the transfer service a high-impact exposure point." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "Input handling failed in an internet-facing managed file transfer app that stored high-value data."],
              ["Impact", "Many organizations suffered downstream data exposure because one file-transfer tier concentrated sensitive files."],
              ["Detection signals", "Unexpected web requests to transfer endpoints, anomalous database access, unknown files or web shells, large downloads from unusual clients."],
              ["Patch / mitigation", "Apply vendor patches, take exposed instances offline during triage if needed, review IOCs, remove unauthorized files, rotate credentials, and notify affected data owners."],
              ["Lesson learned", "Systems that broker sensitive data need extra isolation, aggressive patch SLAs, upload/download monitoring and least-privilege database access."]
            ] },
            { t: "note", variant: "trap", html: "A managed file transfer server is not 'just plumbing'. It often contains the most regulated data in the company." }
          ]
        },
        {
          id: "xz-backdoor",
          title: "XZ Utils backdoor: patient supply-chain insertion",
          summary: "A near-miss in core Linux plumbing showed how social trust and build artifacts can become the attack surface.",
          minutes: 7,
          tags: ["case-study", "open-source", "supply-chain"],
          blocks: [
            { t: "p", html: "<strong>Near miss:</strong> social trust, release artifacts and complex build scripts became the attack surface. The issue was caught before broad production rollout because unusual performance behavior prompted deeper review." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "Maintainer trust, opaque release artifacts and complex build scripts allowed malicious behavior to hide outside the obvious source review path."],
              ["Impact", "Potential remote compromise of systems that shipped affected packages; caught early because performance anomalies triggered investigation."],
              ["Detection signals", "Unexpected CPU usage, suspicious build scripts, differences between repository source and release tarballs, unusual symbol or dependency behavior."],
              ["Patch / mitigation", "Downgrade or upgrade to known-clean packages, verify distribution advisories, compare source to release artifacts, and strengthen maintainer/release controls."],
              ["Lesson learned", "Open source risk is operational, not just technical. Reproducible builds, maintainer support, artifact verification and anomaly reports all matter."]
            ] },
            { t: "note", variant: "key", html: "The save came from curiosity about a small performance regression. Treat weirdness as a signal; many attacks are first noticed as 'that is odd'." }
          ]
        },
        {
          id: "capital-one-ssrf",
          title: "Capital One: SSRF and cloud metadata risk",
          summary: "How a web request primitive became a cloud data breach when metadata credentials had too much reach.",
          minutes: 7,
          tags: ["case-study", "ssrf", "cloud"],
          blocks: [
            { t: "p", html: "<strong>Cloud path:</strong> SSRF let attacker-influenced requests reach metadata services. Temporary credentials from that boundary were then enough to enumerate and access data because the workload role was too broad." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "The app could fetch attacker-influenced destinations, and the attached cloud role had broader permissions than the workload needed."],
              ["Impact", "Sensitive customer data was exposed from cloud storage through valid-but-abused identity permissions."],
              ["Detection signals", "Metadata endpoint access from app workloads, unusual object-storage enumeration, rare role use, large reads outside normal app patterns."],
              ["Patch / mitigation", "Block SSRF with allow-listed outbound destinations, enforce modern metadata protections, reduce IAM scope, and alert on unusual cloud API calls."],
              ["Lesson learned", "In cloud, identity is the blast radius. SSRF becomes severe when metadata credentials can reach valuable data."]
            ] },
            { t: "note", variant: "key", html: "A cloud workload role should answer one question: <em>what exactly must this process do?</em> Anything beyond that is breach fuel." }
          ]
        },
        {
          id: "colonial-pipeline",
          title: "Colonial Pipeline: ransomware as business disruption",
          summary: "A ransomware incident became a fuel-supply crisis because identity, segmentation and recovery all meet in operations.",
          minutes: 7,
          tags: ["case-study", "ransomware", "identity"],
          blocks: [
            { t: "p", html: "<strong>Business disruption path:</strong> compromised remote-access credentials opened business-system access. Ransomware pressure and uncertainty about spread forced decisions that affected operations beyond infected machines." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "Remote access and account hygiene were not strong enough for a critical operational environment."],
              ["Impact", "Business downtime, public disruption, crisis communications pressure and ransom-response decisions."],
              ["Detection signals", "Anomalous VPN login, stale or reused account access, lateral movement, bulk file activity, ransomware staging or encryption."],
              ["Patch / mitigation", "MFA on every remote path, disable stale accounts, segment IT and operational networks, rehearse restore and crisis communications."],
              ["Lesson learned", "Ransomware is a business-continuity event. Technical recovery, legal, communications and operations must already know the playbook."]
            ] },
            { t: "note", variant: "trap", html: "The question during ransomware is not only 'can we decrypt?' It is 'can we safely operate while proving the attacker is contained?'" }
          ]
        },
        {
          id: "mfa-fatigue",
          title: "MFA fatigue: when approval becomes the exploit",
          summary: "Push-based MFA can fail under pressure if attackers can spam prompts and users are trained to make them disappear.",
          minutes: 7,
          tags: ["case-study", "mfa", "identity"],
          blocks: [
            { t: "p", html: "<strong>Identity path:</strong> stolen credentials plus repeated push prompts turned user fatigue into access. Broad internal secrets and privileges then expanded the incident after login." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "MFA approval relied on a weak human signal and internal secrets were reachable after one successful login."],
              ["Impact", "Valid-account access enabled internal enumeration, secret exposure and operational disruption."],
              ["Detection signals", "Repeated MFA denials followed by approval, login from unusual geography or device, access to secret stores, broad internal browsing."],
              ["Patch / mitigation", "Use phishing-resistant MFA where possible, number matching, prompt rate limits, session risk scoring, least-privilege secrets and rapid session revocation."],
              ["Lesson learned", "MFA must resist social pressure. A second factor is only strong when the approval proves intent, not exhaustion."]
            ] },
            { t: "note", variant: "tip", html: "Alert on MFA reset and prompt-spam patterns. Identity recovery and MFA approval are security events, not helpdesk noise." }
          ]
        },
        {
          id: "identity-helpdesk",
          title: "Identity attacks: when the helpdesk becomes the door",
          summary: "Modern intrusions often start by defeating process, not crypto: reset flows, MFA fatigue, and social engineering.",
          minutes: 7,
          tags: ["case-study", "identity", "social-engineering"],
          blocks: [
            { t: "p", html: "<strong>Recovery-path failure:</strong> attackers used employee details to pressure support and reset flows. Once recovery controls issued access, identity systems, SaaS apps and privileged sessions became the real perimeter." },
            { t: "table", headers: ["Question", "Answer"], rows: [
              ["Root issue", "Identity recovery workflows trusted weak human verification and allowed high-impact changes without strong proof."],
              ["Impact", "Valid accounts bypassed perimeter controls, enabling data theft, extortion, lateral movement and business disruption."],
              ["Detection signals", "MFA resets, new devices, impossible travel, helpdesk tickets followed by privileged access, unusual SaaS downloads."],
              ["Patch / mitigation", "Use phishing-resistant MFA, require strong identity proofing for resets, separate helpdesk privileges, alert on recovery events, and revoke sessions after suspicious changes."],
              ["Lesson learned", "Identity is the perimeter. Secure the reset path as strongly as login, because attackers choose the softer one."]
            ] },
            { t: "note", variant: "tip", html: "A mature control is not just 'MFA enabled'. Ask who can reset it, under what evidence, with what audit trail, and who gets alerted." }
          ]
        },
        {
          id: "detection-engineering",
          title: "Detection engineering: from case study to rule",
          summary: "Turn painful incidents into durable detections, tests, false-positive notes and analyst runbooks.",
          minutes: 11,
          tags: ["detection", "soc", "p1"],
          blocks: [
            { t: "p", html: "A case study is useful only if it changes what you do. <strong>Detection engineering</strong> converts attacker behavior into a maintained detection: data source, logic, severity, triage steps, false-positive notes and tests." },
            { t: "ol", items: [
              "<strong>Pick behavior</strong> high on the Pyramid of Pain: process spawning, credential reset, unusual egress, privilege change.",
              "<strong>Confirm telemetry</strong>: which log source proves it, and is it retained long enough?",
              "<strong>Write logic</strong>: start broad, then tune with known-good examples.",
              "<strong>Add a runbook</strong>: what should an analyst check in the first five minutes?",
              "<strong>Test and review</strong>: simulate benign and malicious-looking events; track false positives."
            ] },
            { t: "h", text: "The detection card" },
            { t: "p", html: "A good rule is a small product. It has a clear <strong>hypothesis</strong>, a known telemetry source, logic an analyst can explain in plain language, expected false positives, and a runbook that turns an alert into a decision." },
            { t: "table", headers: ["Field", "What to write"], rows: [
              ["Hypothesis", "If an attacker is using this technique, what behavior should appear?"],
              ["Telemetry source", "Which event proves it: endpoint process events, identity audit logs, proxy, DNS, cloud activity, EDR alerts?"],
              ["Plain-language rule logic", "Describe the condition without query syntax: which events, thresholds, joins, time windows and exclusions?"],
              ["False positives", "Which admin tasks, automation, deployments or maintenance windows can look similar?"],
              ["Runbook", "First five checks, evidence to preserve, escalation path and containment trigger."],
              ["Test cases", "At least one should fire, one should not fire, and one known-benign edge case for tuning."]
            ] },
            { t: "p", html: "Use the builder below to assemble a complete detection card for a fictional identity or endpoint scenario. The output is deliberately plain language so it can be reviewed before anyone writes SIEM syntax." },
            { t: "widget", id: "detectioncard" },
            { t: "note", variant: "key", html: "Every incident should leave behind at least one new or improved control: a detection, a blocked path, a patch SLA, a runbook or an architecture change." },
            { t: "quiz", id: "threats-detection" }
          ]
        },
        {
          id: "breach-capstone",
          title: "Capstone: investigate a breach end to end",
          summary: "Use the whole atlas: identify the attack path, scope impact, contain it, patch root cause and write the lesson learned.",
          minutes: 12,
          tags: ["capstone", "dfir", "incident-response"],
          blocks: [
            { t: "p", html: "Scenario: a public web app shows suspicious requests, the service account accessed data it normally never reads, and an employee reported an MFA reset they did not request. Your job is to build the incident story and response plan." },
            { t: "h", text: "Deliverables" },
            { t: "ol", items: [
              "<strong>Timeline</strong>: first suspicious event, initial access, privilege or identity changes, data access, containment time.",
              "<strong>Root cause</strong>: vulnerable app, weak identity recovery, missing segmentation, or a chain of several.",
              "<strong>Impact</strong>: systems, accounts and data affected; what evidence supports each claim?",
              "<strong>Containment</strong>: isolate hosts, revoke sessions, rotate secrets, block egress, preserve evidence.",
              "<strong>Patch plan</strong>: code/library fix, access-control fix, detection rule, hardening and owner/date.",
              "<strong>Executive summary</strong>: what happened, what changed, and how recurrence is prevented."
            ] },
            { t: "note", variant: "tip", html: "A good capstone answer separates facts from assumptions. If you cannot prove data left, say what evidence you checked and what remains uncertain." },
            { t: "h2", text: "Rubric / checklist" },
            { t: "table", headers: ["Score area", "What a strong answer includes"], rows: [
              ["Incident narrative (20%)", "A timestamped story with evidence for initial access, identity changes, data access, containment and unresolved assumptions."],
              ["Scope and impact (20%)", "Affected systems, accounts, data classes, business impact and confidence level for each claim."],
              ["Containment and evidence (20%)", "Session revocation, host isolation, secret rotation, egress blocks and evidence preservation without destroying volatile artifacts."],
              ["Root cause and prevention (25%)", "Specific fixes for app flaws, identity recovery, IAM scope, segmentation, logging, detection and ownership with due dates."],
              ["Executive communication (15%)", "Plain-language summary, customer/regulator considerations, what changed and residual risk that still needs a named owner."]
            ] },
            { t: "note", variant: "key", html: "Use the <a class=\"inline\" href=\"#/scenarios/breach-triage\">breach triage model-answer outline</a> and <a class=\"inline\" href=\"#/rubrics\">rubric bands</a> to calibrate your answer before marking this capstone complete." },
            { t: "quiz", id: "threats-forensics" }
          ]
        },
        {
          id: "security-architecture-capstone",
          title: "Capstone: secure architecture end to end",
          summary: "Design a defensible system from inventory and threat model through detection, recovery and residual risk.",
          minutes: 12,
          tags: ["capstone", "architecture", "threat-modeling"],
          blocks: [
            { t: "p", html: "Scenario: a team is launching a customer portal with user profiles, billing data, document upload, admin support tools and analytics exports. Your capstone is to design security into the architecture before launch, then define how defenders will know when it fails." },
            { t: "h", text: "Deliverables" },
            { t: "ol", items: [
              "<strong>Asset and data inventory</strong>: systems, owners, identities, service accounts, data classes, retention and where regulated data flows.",
              "<strong>Threat model</strong>: trust boundaries, likely abuse cases, high-value assets, attacker entry points and what success looks like for the adversary.",
              "<strong>Secure architecture</strong>: authentication, authorization, network segmentation, secrets management, upload isolation, encryption, backups and least-privilege service roles.",
              "<strong>Detection plan</strong>: telemetry sources, the first five detections, alert severity, dashboards and ownership for rule tuning.",
              "<strong>Incident and recovery plan</strong>: containment decisions, evidence preservation, session and key rotation, restore sequence, communications and tested RTO/RPO.",
              "<strong>Residual-risk summary</strong>: what risk remains, why it is accepted, the owner, expiry date and the next control that would reduce it."
            ] },
            { t: "table", headers: ["Risk question", "Architecture answer"], rows: [
              ["What data would hurt most if exposed?", "Classify it, minimize it, encrypt it, log access to it and keep it out of broad analytics copies."],
              ["What can a stolen user session do?", "Scope sessions, step up for sensitive actions, rotate on risk and enforce object-level authorization."],
              ["What if document upload is hostile?", "Store outside executable paths, generate server-side names, validate type and size, scan, and serve through an authorization handler."],
              ["What if one service is compromised?", "Segment network paths, use workload identity, least-privilege roles and alert on unusual east-west or data access."],
              ["How do we recover?", "Immutable or offline backups, tested restore order, documented dependencies and recovery drills before production."]
            ] },
            { t: "note", variant: "tip", html: "A strong architecture capstone names the trade-offs. Security design is not pretending risk is zero; it is proving the highest risks have owners, controls, detection and recovery." },
            { t: "h2", text: "Rubric / checklist" },
            { t: "table", headers: ["Score area", "What a strong answer includes"], rows: [
              ["Inventory and data flows (20%)", "Assets, owners, identities, service accounts, data classes, trust boundaries, retention and upload/export paths."],
              ["Threat model (20%)", "Likely abuse cases, entry points, high-value assets, STRIDE-style risks, assumptions and prioritized risk ranking."],
              ["Control design (25%)", "Authentication, object-level authorization, segmentation, secrets, upload isolation, encryption, backups, least-privilege workload roles and secure defaults."],
              ["Detection and response (20%)", "Required telemetry, first five detections, alert ownership, runbooks, containment choices, evidence handling and tested RTO/RPO."],
              ["Risk governance (15%)", "Residual risks, accountable owner, expiry/review date, accepted trade-offs and the next control that would reduce risk."]
            ] },
            { t: "note", variant: "key", html: "Compare your design against the <a class=\"inline\" href=\"#/scenarios/secure-customer-portal\">secure customer portal model-answer outline</a>, then score it with the <a class=\"inline\" href=\"#/rubrics\">practice rubric</a>." },
            { t: "quiz", id: "threats-architecture" }
          ]
        }
      ]
    },
    /* ============================ FORENSICS ============================ */
    {
      id: "forensics",
      name: "Digital forensics",
      icon: "search",
      lessons: [
        {
          id: "dfir",
          title: "DFIR fundamentals",
          summary: "When you need to know exactly what happened — and maybe prove it in court — discipline around evidence is everything.",
          minutes: 8,
          tags: ["forensics", "dfir"],
          blocks: [
            { t: "p", html: "<strong>Digital forensics</strong> is the disciplined recovery and analysis of digital evidence to reconstruct what happened. Paired with incident response, it's <strong>DFIR</strong>. The work may end up in court, so <em>how</em> you handle evidence matters as much as what you find." },
            { t: "note", variant: "key", html: "<strong>Locard's exchange principle:</strong> every interaction leaves a trace. An attacker on a system inevitably leaves artifacts \u2014 logs, files, memory, timestamps. Forensics is the craft of finding and interpreting them without destroying them." },
            { t: "h", text: "Chain of custody" },
            { t: "p", html: "Evidence is only as trustworthy as its <strong>chain of custody</strong> \u2014 a documented, unbroken record of who handled it, when, and how. Break the chain and the evidence may be worthless." },
            {
              t: "ul", items: [
                "Document who collected each item, when, and from where.",
                "Hash evidence on acquisition and verify it never changed.",
                "Work on <strong>copies</strong> (forensic images), never the original.",
                "Store securely with controlled, logged access."
              ]
            },
            { t: "h", text: "Order of volatility" },
            { t: "p", html: "Some evidence vanishes the instant you power off; some survives for years. Collect from <strong>most volatile to least</strong>, or you'll lose it. Put the sources below in the right order." },
            { t: "widget", id: "volatility" },
            { t: "note", variant: "trap", html: "The instinct to \u201cjust reboot it\u201d or \u201cre-image and move on\u201d destroys the most valuable evidence first \u2014 the contents of RAM, where running malware, keys, and network state live. Capture memory <em>before</em> you pull the plug." }
          ]
        },
        {
          id: "disk-memory-net",
          title: "Disk, memory & network forensics",
          summary: "Three rich seams of evidence, each answering different questions about an intrusion.",
          minutes: 7,
          tags: ["forensics", "artifacts"],
          blocks: [
            { t: "p", html: "Investigators pull from three big evidence domains. Each answers different questions, and a real case usually weaves all three into one timeline." },
            {
              t: "table",
              headers: ["Domain", "Rich artifacts", "Answers"],
              rows: [
                ["<strong>Disk</strong>", "Filesystem, deleted files, registry, browser history, logs", "What was installed, run, opened, deleted?"],
                ["<strong>Memory (RAM)</strong>", "Running processes, injected code, keys, network connections, clipboard", "What was happening right now?"],
                ["<strong>Network</strong>", "Packet captures, flow logs, DNS, proxy logs", "What talked to whom, and what left?"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Memory forensics</strong> is the modern crown jewel. Fileless malware that never touches disk, decryption keys, and live C2 connections all live only in RAM \u2014 invisible to disk-only analysis. It's why capturing memory early is worth so much." },
            { t: "h", text: "The humble log, revisited" },
            { t: "p", html: "Logs straddle all three domains and are often the backbone of a timeline: authentication events, process creation, firewall and proxy records. This is the forensic pay-off for the centralized, tamper-evident logging you set up defensively \u2014 and the reason attackers try to clear logs (itself a detectable act)." },
            { t: "note", variant: "tip", html: "Timestamps are gold and treacherous. Time zones, clock skew, and timestamp tampering all bite. Normalizing everything to one synchronized clock (UTC) is what lets you line up evidence from different systems into a coherent story." }
          ]
        },
        {
          id: "timelines-antiforensics",
          title: "Timelines & anti-forensics",
          summary: "The deliverable of an investigation is a defensible story of what happened — even when the attacker tried to erase it.",
          minutes: 6,
          tags: ["forensics", "timeline"],
          blocks: [
            { t: "p", html: "The output of forensics is a <strong>timeline</strong>: a correlated, evidence-backed narrative of what happened, in order. Built well, it answers the questions everyone asks after a breach \u2014 how they got in, what they touched, what left, and whether they're truly gone." },
            { t: "h", text: "The questions a timeline must answer" },
            {
              t: "ul", items: [
                "<strong>Initial access</strong> \u2014 how did they first get in?",
                "<strong>Scope</strong> \u2014 which systems and accounts were affected?",
                "<strong>Actions</strong> \u2014 what did they do once inside?",
                "<strong>Exfiltration</strong> \u2014 did data leave, and what?",
                "<strong>Eradication check</strong> \u2014 is every foothold and persistence mechanism gone?"
              ]
            },
            { t: "note", variant: "key", html: "Forensics closes the incident-response loop. \u201cLessons learned\u201d is only honest when a defensible timeline shows the full picture \u2014 otherwise you may eradicate one foothold and miss the persistence that brings the attacker right back." },
            { t: "h", text: "Anti-forensics" },
            { t: "p", html: "Sophisticated attackers fight the investigation: clearing or tampering with logs, wiping files, manipulating timestamps (\u201ctimestomping\u201d), and working only in memory to leave nothing on disk." },
            { t: "note", variant: "trap", html: "Anti-forensics often <em>is</em> the evidence. A suspiciously empty log, a cleared event history, or impossible timestamps are themselves strong indicators of compromise. The attempt to hide leaves its own trace \u2014 Locard again." },
            { t: "quiz", id: "threats-forensics" }
          ]
        }
      ]
    }
  ]
};
