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
