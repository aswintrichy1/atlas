/* =====================================================================
   CITADEL · Quiz bank — expansion pack
   Merged into window.QUIZZES (loaded after quizzes.js, before app.js).
   Offensive · Threats/Forensics · Domains.  Answers hand-verified.
   ===================================================================== */
window.QUIZZES = Object.assign(window.QUIZZES || {}, {
  /* ---------------- CORE / IDENTITY ---------------- */
  "core-federated-identity": {
    title: "Federated identity checkpoint",
    sub: "OIDC, OAuth, SAML assertions, refresh tokens, and recovery abuse.",
    questions: [
      {
        q: "In OpenID Connect, the ID token is primarily meant to",
        options: ["prove to a client who authenticated", "authorize API calls to any resource", "encrypt the browser session", "replace all server-side authorization"],
        answer: 0,
        explain: "An ID token carries signed identity claims for the client. Access tokens are for APIs, and neither token replaces resource-level authorization."
      },
      {
        q: "Why must a SAML assertion or JWT audience be validated?",
        options: ["To make the token shorter", "To ensure the assertion was issued for this exact app or API", "To disable MFA", "To convert it into a password"],
        answer: 1,
        explain: "Audience validation prevents a token minted for one service from being replayed to another. Issuer, signature and time checks are necessary too, but audience binds trust to the intended receiver."
      },
      {
        q: "A refresh token is high risk because it can",
        options: ["only display a username", "make TLS optional", "mint new access tokens over time if stolen", "validate CSS"],
        answer: 2,
        explain: "A stolen refresh token can keep generating fresh access tokens. Treat it like a long-lived credential: protect it from script access, rotate it, bind it where possible, and revoke it on risk."
      },
      {
        q: "A secure logout or account-risk response should",
        options: ["only hide the current page", "clear local UI state but leave refresh tokens active", "depend on the user closing the browser", "revoke server-side sessions and tokens that can still be used"],
        answer: 3,
        explain: "Logout and risk events must invalidate usable credentials server-side. Clearing a local page does not stop a stolen token or another active SaaS session."
      },
      {
        q: "Why are helpdesk MFA reset flows a security boundary?",
        options: ["They can bypass strong login if an attacker socially engineers recovery", "They are only a convenience feature", "They only affect UI themes", "They remove the need for audit logs"],
        answer: 0,
        explain: "Attackers often target recovery because it can defeat strong MFA. Use verified channels, step-up checks, cooldowns, user alerts and audit logs for reset approvals."
      }
    ]
  },

  /* ---------------- APPSEC / API ---------------- */
  "appsec-api-security": {
    title: "API security checkpoint",
    sub: "BOLA, BFLA, BOPLA, schemas, business abuse, and API inventory.",
    questions: [
      {
        q: "Broken Object Level Authorization (BOLA) happens when an API",
        options: ["fails to encrypt CSS", "does not verify the caller may access the specific object requested", "uses JSON instead of XML", "has too many unit tests"],
        answer: 1,
        explain: "BOLA is the API form of missing object ownership or tenant checks. Scope object lookups to the caller and deny when the object is outside their authorization boundary."
      },
      {
        q: "Broken Function Level Authorization (BFLA) asks which missing question?",
        options: ["Does the token use Base64?", "Is the response compressed?", "May this caller invoke this operation at all?", "Is the endpoint name short enough?"],
        answer: 2,
        explain: "BFLA occurs when a user can call functions or routes they should not, such as admin actions. The server must authorize methods and operations, not rely on hidden UI controls."
      },
      {
        q: "Broken Object Property Level Authorization (BOPLA) is best prevented by",
        options: ["returning every database field and trusting the client", "making object ids sequential", "using a single global admin role", "explicit input/output DTOs and field-level read/write allow-lists"],
        answer: 3,
        explain: "BOPLA is about sensitive fields, not just whole objects. Separate DTOs and field-level allow-lists prevent overexposure and unauthorized field updates."
      },
      {
        q: "Why is schema validation alone insufficient for API authorization?",
        options: ["A request can be well-formed and still ask for forbidden data or actions", "Schemas cannot parse JSON", "Schemas always disable logging", "Authorization only belongs in the browser"],
        answer: 0,
        explain: "Schemas prove shape and type. Authorization decides permission. A valid REST body, GraphQL query or protobuf message still needs object, property and function checks."
      },
      {
        q: "Mass assignment is dangerous because",
        options: ["it reduces file size", "the API may write fields the UI never exposed, such as roles or flags", "it prevents validation", "it only affects static images"],
        answer: 1,
        explain: "Binding an entire request body to a model can let callers set privileged fields directly. Use operation-specific DTOs and explicit writable-field allow-lists."
      },
      {
        q: "Which control best addresses expensive GraphQL queries and business-flow abuse?",
        options: ["A single per-IP request counter only", "Disabling all logs", "Query complexity limits, action-aware quotas, idempotency and anomaly alerts", "Trusting the mobile app"],
        answer: 2,
        explain: "Abuse is often about cost or workflow, not just raw request count. Combine complexity limits, per-user/tenant quotas, idempotency keys and monitoring for unusual patterns."
      },
      {
        q: "An API inventory should track",
        options: ["nothing once an endpoint is internal", "only the endpoint font", "only successful responses", "owner, exposure, auth method, data classification, version and deprecation status"],
        answer: 3,
        explain: "Unknown APIs become unpatched APIs. Inventory lets teams find owners, assess exposure and retire old versions that often retain stale authorization behavior."
      }
    ]
  },

  /* ---------------- APPSEC / AI ---------------- */
  "appsec-ai": {
    title: "LLM security checkpoint",
    sub: "Prompt injection, RAG authorization, agency, and tools.",
    questions: [
      {
        q: "Why is prompt injection not solved by telling the model to ignore malicious instructions?",
        options: ["Instructions are guidance, not an enforceable security boundary", "The model cannot read instructions", "Prompt injection only affects images", "It is fixed by longer prompts"],
        answer: 0,
        explain: "A model can be guided by instructions, but untrusted user or retrieved text still enters the same reasoning context. Enforce boundaries in application code: authorization, data filtering, tool allow-lists, and approvals."
      },
      {
        q: "In a RAG system, when should document authorization be enforced?",
        options: ["Only after the model writes an answer", "Before documents are retrieved or passed to the model", "Only in the browser", "Never, because embeddings are anonymous"],
        answer: 1,
        explain: "Retrieval must be scoped before context assembly. If unauthorized chunks reach the model, the answer may leak them even if the UI later tries to filter the output."
      },
      {
        q: "Excessive agency in an AI agent means the system",
        options: ["has too few tokens", "uses a small model", "lets the model take high-impact actions without deterministic controls or approval", "stores prompts locally"],
        answer: 2,
        explain: "Agency becomes risky when model output can directly trigger sensitive actions. Keep tools scoped, use schemas and dry-run previews, and require policy or human approval for high-impact changes."
      },
      {
        q: "The safest way to expose tools or plugins to a support bot is to",
        options: ["give every tool full admin rights for flexibility", "trust the model to refuse dangerous calls", "hide tool names in the prompt", "scope each tool to the task, deny by default, log calls, and gate sensitive actions"],
        answer: 3,
        explain: "Tools need normal least-privilege engineering: narrow permissions, explicit schemas, audit logs, and approval gates. A hidden prompt is not access control."
      },
      {
        q: "A safe way for defenders to use AI during alert triage is to",
        options: ["summarize evidence and suggest first checks for an analyst to verify", "let it silently close alerts", "paste raw secrets into the prompt", "turn every suggestion into a blocking rule automatically"],
        answer: 0,
        explain: "AI is useful for compressing noisy evidence into a draft. The analyst still verifies with telemetry, and any detection or containment action needs tests and review."
      },
      {
        q: "Why should AI-generated detections be tested before production use?",
        options: ["AI rules are always malicious", "They may overfit, miss context, or create noisy false positives", "Testing only matters for code", "A longer prompt guarantees correctness"],
        answer: 1,
        explain: "Generated rules are drafts. Validate them against real benign and suspicious telemetry, tune false positives, and document the response action before they page or block."
      },
      {
        q: "When discussing attacker use of AI, the defensible training focus is",
        options: ["step-by-step phishing and malware generation", "secret prompt templates", "high-level misuse patterns and the controls that reduce their impact", "bypassing security tools"],
        answer: 2,
        explain: "Safe security education explains how AI changes attacker scale and deception, then maps those patterns to controls like phishing-resistant MFA, behavior detection, and helpdesk verification."
      },
      {
        q: "In an AI SOC copilot workflow, which action should require analyst or policy approval?",
        options: ["Summarizing related events", "Drafting a timeline", "Grouping duplicate alerts", "Isolating a host or disabling an account"],
        answer: 3,
        explain: "Summaries and grouping are low-risk drafts. Containment actions affect production and users, so they need deterministic policy or analyst approval."
      },
      {
        q: "The safest role for AI in secure code review is to",
        options: ["flag risky patterns and suggest tests for a human reviewer to verify", "replace review entirely", "approve its own patches", "ignore local standards"],
        answer: 0,
        explain: "AI can accelerate review by finding candidate risks, but correctness comes from tests, local standards, and human judgment."
      },
      {
        q: "AI governance primarily answers",
        options: ["which prompt sounds best", "who can use which models/tools with what data, logging, retention and approval boundaries", "how to remove all human review", "how to hide model use from auditors"],
        answer: 1,
        explain: "Governance defines approved models, data handling, tool permissions, audit logs, retention and review gates so AI features remain accountable."
      }
    ]
  },
  "appsec-secure-coding": {
    title: "Secure coding checkpoint",
    sub: "Safe APIs, encoding, files, parsers, and logging.",
    questions: [
      {
        q: "The primary defense against SQL injection is to",
        options: ["escape quotes by hand", "hide database errors", "use prepared statements or bind parameters", "rename database tables"],
        answer: 2,
        explain: "Prepared statements and bind parameters keep query structure separate from user data, so input cannot become SQL syntax."
      },
      {
        q: "Framework output encoding helps prevent XSS because it",
        options: ["removes the need for authorization", "encrypts the browser session", "blocks every network request", "turns user-controlled text into inert text for the destination context"],
        answer: 3,
        explain: "The browser executes markup and script, so output must be encoded for its context. Framework auto-escaping is valuable unless developers bypass it."
      },
      {
        q: "A safer file-upload design is to",
        options: ["generate server-side names, validate content, isolate storage, and authorize downloads", "store uploads under a public executable path", "trust the uploaded filename", "accept any file if the user is logged in"],
        answer: 0,
        explain: "Uploads are untrusted files. Strong handling limits filename abuse, type spoofing, malicious content, direct execution, and unauthorized reads."
      },
      {
        q: "When parsing XML from an untrusted source, a secure parser should",
        options: ["allow external entities for compatibility", "disable DTDs, external entities, and network fetches", "run on the production database host", "ignore document size limits"],
        answer: 1,
        explain: "DTD and external entity support can enable XXE, local-file disclosure, SSRF, and entity expansion. Harden parser settings before parsing."
      },
      {
        q: "Good security logging should",
        options: ["record passwords for later debugging", "store raw session IDs in every message", "capture useful structured context while redacting secrets", "disable logs on authentication failures"],
        answer: 2,
        explain: "Logs should support detection and response with request IDs, user/session references, and decisions, but credentials, tokens, and raw secrets must be redacted."
      }
    ]
  },

  /* ---------------- OFFENSIVE ---------------- */
  "offensive-methodology": {
    title: "Ethical hacking checkpoint",
    sub: "Authorization, the pentest lifecycle, and recon.",
    questions: [
      {
        q: "What single thing makes security testing legal rather than criminal?",
        options: ["Using professional tools", "Testing only at night", "Good intentions", "Explicit, written authorization within a defined scope"],
        answer: 3,
        explain: "Authorization is the bright line. Without written permission and a scope, the same scan that helps a defender is unauthorized access — a crime in most jurisdictions, regardless of intent."
      },
      {
        q: "A 'grey box' penetration test means the tester is given",
        options: ["some access or documentation, like a normal user account", "nothing but a target", "full source code and architecture", "permission to attack anything"],
        answer: 0,
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
        options: ["block all search engines", "use a stronger firewall", "reduce your own public footprint and scrub metadata", "rotate IP addresses"],
        answer: 2,
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
        options: ["is automated while scanning is manual", "is the same thing", "only works on Windows", "pulls specific detail (users, shares, versions) from the services found"],
        answer: 3,
        explain: "Scanning answers 'what's open?'; enumeration answers 'what exactly is it?' — extracting usernames, shares, directories, and version banners from the services discovered."
      },
      {
        q: "A CVE identifier (like CVE-2021-44228) is",
        options: ["a unique public name for a specific vulnerability", "a severity score from 0 to 10", "a type of exploit", "a patch"],
        answer: 0,
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
        options: ["publish a working exploit immediately", "sell it to the highest bidder", "coordinated disclosure — report privately and give time to patch", "demand payment to stay silent"],
        answer: 2,
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
        options: ["automated scanners", "counting open ports", "checking TLS configuration", "manually testing access control — reaching data and actions that should be off-limits"],
        answer: 3,
        explain: "Broken access control is consistently the #1 web risk and usually needs a human who understands what the app should allow. Scanners catch the easy categories; logic and authorization flaws need judgment."
      },
      {
        q: "Which defensive principle most directly limits an attacker's lateral movement after a foothold?",
        options: ["Network segmentation", "Output encoding", "Password hashing", "HSTS"],
        answer: 0,
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
        options: ["a shell on the server", "a list of open ports", "a clear, reproducible, risk-rated report with remediation", "the exploit code"],
        answer: 2,
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
        options: ["severity scores", "firewall rules", "CVE numbers", "tactics (the goal) and techniques (how it's achieved)"],
        answer: 3,
        explain: "ATT&CK is a knowledge base of tactics (the attacker's goal at each stage) and techniques (how they accomplish it), giving defenders one vocabulary and a way to map detection coverage."
      },
      {
        q: "On the Pyramid of Pain, which indicator is MOST painful for an attacker to change?",
        options: ["TTPs (their tools and behaviors)", "An IP address", "A domain name", "A file hash"],
        answer: 0,
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
        options: ["waiting for alerts to fire", "running a vulnerability scan", "proactively searching for adversaries that evaded automated detection", "blocking IP addresses"],
        answer: 2,
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
        options: ["There is no difference", "A worm is always ransomware", "A virus is harmless", "A worm self-propagates across networks without user action"],
        answer: 3,
        explain: "A virus attaches to a file and spreads when that file is run; a worm propagates by itself across networks with no user needed — which is why worms exploit unpatched, internet-facing services."
      },
      {
        q: "Dynamic malware analysis must always be performed",
        options: ["in strict isolation — a disposable sandbox or air-gapped VM with snapshots", "on a production server for realism", "on the analyst's daily laptop", "only after disabling antivirus everywhere"],
        answer: 0,
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
        options: ["growing their own malware", "using only zero-days", "abusing legitimate built-in tools so activity blends into normal operations", "attacking farms"],
        answer: 2,
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
        options: ["RAM is the easiest to image", "It's required by law everywhere", "Disk evidence is worthless", "Memory holds running processes, keys, and network state that vanish on shutdown"],
        answer: 3,
        explain: "The most volatile evidence disappears first. RAM contains running malware, decryption keys, and live connections — including fileless malware that never touches disk — so capture it before pulling the plug."
      },
      {
        q: "Chain of custody primarily ensures that",
        options: ["there's a documented, unbroken record of who handled evidence, keeping it trustworthy", "evidence is encrypted", "the attacker is identified", "logs are deleted"],
        answer: 0,
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
        options: ["proof of innocence", "irrelevant", "itself an indicator of compromise — the attempt to hide leaves a trace", "a normal maintenance event"],
        answer: 2,
        explain: "Anti-forensics often is the evidence. A cleared log, wiped history, or impossible timestamps are strong signs of compromise — Locard's principle: the attempt to hide leaves its own trace."
      }
    ]
  },
  "threats-detection": {
    title: "Detection engineering checkpoint",
    sub: "Hypotheses, telemetry, rule logic, runbooks, and tests.",
    questions: [
      {
        q: "A detection hypothesis should state",
        options: ["the SIEM vendor name", "the exact incident owner before triage", "the color of the dashboard", "the attacker behavior you expect to see in telemetry"],
        answer: 3,
        explain: "Hypothesis-driven detection starts with behavior: if this technique happened, what observable events would prove or disprove it?"
      },
      {
        q: "Why is telemetry selection part of detection engineering?",
        options: ["A rule can only detect what the environment actually collects and retains", "Telemetry is only useful after containment", "It replaces runbooks", "It prevents all false positives"],
        answer: 0,
        explain: "No data means no detection. Engineers must know which source has the needed fields, how long it is retained, and whether it is trustworthy."
      },
      {
        q: "Plain-language rule logic is useful because it",
        options: ["makes the alert secret", "lets reviewers validate intent before query syntax hides mistakes", "removes the need for testing", "guarantees zero false positives"],
        answer: 1,
        explain: "Before writing SIEM syntax, the team should understand the behavior, time window, threshold, joins, and exclusions in ordinary language."
      },
      {
        q: "False-positive notes should include",
        options: ["only attacker examples", "user passwords", "known benign activity that can look similar", "the vendor sales contact"],
        answer: 2,
        explain: "Tuning depends on known-good examples: admin work, deployments, onboarding, backups, support resets, and maintenance windows."
      },
      {
        q: "A healthy detection test set includes",
        options: ["only the perfect malicious case", "only screenshots", "no tests until after production", "a should-fire case, a should-not-fire case, and a benign edge case"],
        answer: 3,
        explain: "Tests prevent silent drift. Include positive, negative, and edge cases so the rule catches the intended behavior without paging on common benign activity."
      }
    ]
  },
  "threats-architecture": {
    title: "Architecture capstone checkpoint",
    sub: "Inventory, threat model, architecture, detection, recovery, and residual risk.",
    questions: [
      {
        q: "The first artifact in an end-to-end security architecture capstone should usually be",
        options: ["an asset and data inventory", "a color palette", "a list of exploit names", "a press release"],
        answer: 0,
        explain: "You cannot protect what you cannot name. Inventory establishes systems, owners, identities, data classes, retention, and sensitive data flows."
      },
      {
        q: "A threat model is strongest when it focuses on",
        options: ["only firewall brands", "trust boundaries, likely abuse cases, high-value assets, and attacker entry points", "only low-risk assets", "removing all user features"],
        answer: 1,
        explain: "Threat modeling connects assets and trust boundaries to plausible attacker goals, then drives concrete architecture controls."
      },
      {
        q: "A detection plan belongs in architecture review because",
        options: ["secure systems never need logs", "it replaces authorization", "defenders need telemetry and rules before production incidents happen", "it is only useful for forensics exams"],
        answer: 2,
        explain: "Detection is a design requirement. Decide the telemetry sources, first detections, ownership, and tuning process while the system is being built."
      },
      {
        q: "An incident and recovery plan should define",
        options: ["only who writes the final report", "no business owners", "the attacker's identity in advance", "containment, evidence preservation, rotation, restore order, communications, and tested RTO/RPO"],
        answer: 3,
        explain: "Recovery is a rehearsed sequence, not hope. The plan should cover technical containment and restoration plus evidence and stakeholder communication."
      },
      {
        q: "A residual-risk summary is complete only when it names",
        options: ["the risk, why it remains, owner, review date, and next reduction step", "the oldest server", "every possible vulnerability on the internet", "the most optimistic assumption"],
        answer: 0,
        explain: "Residual risk is accountable risk. It needs a reason, owner, expiry/review date, and a path to reduce it later."
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
        options: ["the desktop wallpaper", "the font cache", "misconfigured sudo or SUID binaries that run as root", "disabled logging"],
        answer: 2,
        explain: "Most Linux escalation chains a normal-user foothold into root via misconfigured sudo, risky SUID binaries, or world-writable privileged scripts. Least privilege and a minimal SUID set close these paths."
      },
      {
        q: "Which Wi-Fi security standard should you use on a modern network?",
        options: ["WEP", "Original WPA", "No encryption", "WPA2 at minimum, WPA3 where possible"],
        answer: 3,
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
        options: ["their data, identities, and configuration", "the hypervisor", "the physical data center", "the provider's network hardware"],
        answer: 0,
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
        options: ["deploy to the left region first", "move servers physically", "build security in early during development, where issues are cheapest to fix", "use left-handed keyboards"],
        answer: 2,
        explain: "Shift left integrates security into development and CI (SAST/DAST/SCA, IaC scanning) so flaws are caught early and cheaply, rather than bolted on at the end or found in production."
      },
      {
        q: "When learning the security tool landscape, what matters most first?",
        options: ["memorizing every product name", "the tool's logo", "buying commercial licenses", "understanding the category — what job a class of tool does"],
        answer: 3,
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
        options: ["provide safe, legal, permission-rich challenges with instant feedback", "let you attack real companies legally", "require no thinking", "replace all other study"],
        answer: 0,
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
        options: ["a substitute for hands-on skill", "useless", "signals that complement real skill, not replacements for it", "only for management"],
        answer: 2,
        explain: "Certs signal breadth or capability, but skills come first. A home lab, CTF results, and write-ups often speak louder — and make the cert exam straightforward when you take it."
      },
      {
        q: "Across every offensive skill in this atlas, the non-negotiable rule is",
        options: ["always use the newest tools", "work alone", "never write reports", "operate ethically and only within explicit authorization"],
        answer: 3,
        explain: "The skills are for defending systems and testing your own — with permission. Authorization and ethics are what separate a security professional from a criminal, and your reputation is your career."
      }
    ]
  },
  "domains-cloud-native": {
    title: "Cloud-native checkpoint",
    sub: "IAM, Kubernetes, serverless, telemetry and guardrails.",
    questions: [
      {
        q: "In cloud-native systems, why are workload identities safer than long-lived access keys in files or environment variables?",
        options: ["They issue scoped, short-lived credentials tied to the workload", "They make logging unnecessary", "They disable all network access", "They only work for administrators"],
        answer: 0,
        explain: "Workload identities reduce key sprawl by letting the platform issue limited, short-lived credentials to a specific service, pod or function. That shrinks the blast radius if the workload is abused."
      },
      {
        q: "Why is an instance or pod metadata service a security-sensitive surface?",
        options: ["It stores public documentation", "It can provide temporary credentials to the workload", "It only returns CPU metrics", "It blocks all SSRF by default"],
        answer: 1,
        explain: "Metadata services often hand out identity tokens or cloud credentials. SSRF, container escape paths or over-broad roles can turn metadata access into data access."
      },
      {
        q: "Which Kubernetes control is best described as preventing privileged or policy-breaking pods from being admitted?",
        options: ["Network policy", "Horizontal scaling", "Admission policy", "A service name"],
        answer: 2,
        explain: "Admission policy checks objects before they enter the cluster, blocking risky patterns such as privileged pods, host mounts, untrusted images or missing required labels."
      },
      {
        q: "Serverless event permissions should be designed so that",
        options: ["every function shares one admin role", "deploy permissions and runtime permissions are always identical", "event payloads are trusted automatically", "only approved sources can invoke the function and the runtime role is least privilege"],
        answer: 3,
        explain: "In serverless, invocation rights and runtime rights both matter. Restrict who can trigger the function, validate event payloads, and give the function only the actions it needs."
      },
      {
        q: "A cloud guardrail is most useful when it",
        options: ["continuously prevents or detects forbidden configurations", "runs once during onboarding", "replaces all incident response", "depends on developers remembering every rule"],
        answer: 0,
        explain: "Cloud environments change constantly. Guardrails such as policy checks, audit-log alerts and config rules need to run continuously so drift and risky changes are caught quickly."
      }
    ]
  },
  "domains-data-privacy": {
    title: "Data protection checkpoint",
    sub: "Classification, retention, keys, access logging and DLP.",
    questions: [
      {
        q: "Why does data classification come before many other data-security controls?",
        options: ["It replaces encryption", "It tells the organization how sensitive data is and how it must be handled", "It deletes all old records", "It only helps designers choose colors"],
        answer: 1,
        explain: "Classification gives handling rules to data. Without knowing whether data is public, internal, confidential or restricted, access controls, retention, DLP and encryption choices are guesswork."
      },
      {
        q: "Retention and disposal controls primarily answer",
        options: ["how to bypass approvals", "which font reports use", "how long data is kept and how it is removed when no longer needed", "which employee owns every laptop"],
        answer: 2,
        explain: "Privacy improves when data is kept only as long as needed for business, legal or safety reasons, then deleted or made unrecoverable through a provable process."
      },
      {
        q: "Why is key ownership a data-access issue?",
        options: ["Keys only affect performance", "Encryption removes the need for authorization", "Keys are never rotated", "Anyone who can use or administer decryption keys may effectively access the data"],
        answer: 3,
        explain: "Encryption is only as strong as key governance. If broad admins can use or change keys, they may be able to decrypt sensitive stores even if database permissions look restricted."
      },
      {
        q: "Sensitive access logging should focus on",
        options: ["reads, exports and unusual access to high-value data with user and purpose context", "only failed logins", "raw passwords for auditing", "deleting evidence after review"],
        answer: 0,
        explain: "For sensitive data, defenders need to see who read or exported it, from where, under what purpose and whether the volume or destination looks abnormal. Never log secrets themselves."
      },
      {
        q: "DLP and exfiltration monitoring are meant to detect",
        options: ["only malware files", "data leaving expected boundaries through email, file sharing, endpoints, SaaS exports or cloud storage", "CPU overheating", "whether users like a policy"],
        answer: 1,
        explain: "DLP looks for sensitive data patterns and unusual movement across outbound channels. It complements access control by watching where data actually goes."
      }
    ]
  },
  "domains-mobile": {
    title: "Mobile security checkpoint",
    sub: "Secure storage, permissions, TLS, backend trust and revocation.",
    questions: [
      {
        q: "Where should a mobile app store long-lived tokens if it must keep them on device?",
        options: ["A plain text file", "The clipboard", "Platform secure storage such as the system keychain or keystore", "A comment in source code"],
        answer: 2,
        explain: "Mobile platforms provide protected storage backed by OS controls. Plain files, clipboards and source-code constants are much easier to extract or leak."
      },
      {
        q: "The safest mobile permission pattern is to",
        options: ["ask for every permission at install", "treat denied permissions as proof of compromise", "hide permission prompts", "request only the permission needed for a feature, when the user uses that feature"],
        answer: 3,
        explain: "Least privilege applies to devices too. Ask for the minimum permission at the moment it is needed, and design the app to degrade gracefully when it is denied."
      },
      {
        q: "Why is disabling TLS certificate validation dangerous in a mobile app?",
        options: ["It allows impostor servers to intercept or alter traffic", "It makes the app too fast", "It prevents all testing", "It only affects images"],
        answer: 0,
        explain: "If certificate validation is disabled, the app cannot reliably know it is talking to the real backend. Fix test certificates instead of teaching the app to trust anything."
      },
      {
        q: "A mobile backend should trust",
        options: ["hidden flags sent by the app", "server-side authentication and authorization checks on every request", "the app package name alone", "any request from a phone"],
        answer: 1,
        explain: "Clients are inspectable and modifiable. The backend must enforce authorization, fraud checks, rate limits and business rules on the server."
      },
      {
        q: "Lost-device handling should include",
        options: ["disabling all user accounts forever", "waiting for tokens to expire next year", "remote logout and revocation of refresh/session tokens", "sharing the user's password with support"],
        answer: 2,
        explain: "When a device is lost, the user needs a way to revoke that device's sessions or refresh tokens quickly while keeping the account recoverable."
      }
    ]
  },
  "domains-ot-product": {
    title: "OT and product security checkpoint",
    sub: "Safety, PLC/SCADA, zones, patch constraints and firmware trust.",
    questions: [
      {
        q: "In OT environments, which security objective often competes most directly with normal IT patch urgency?",
        options: ["Search ranking", "Color accuracy", "Browser compatibility", "Availability and safety of the physical process"],
        answer: 3,
        explain: "OT systems control physical processes. A rushed change can affect safety or production, so patching needs tested windows and compensating controls while risk is managed."
      },
      {
        q: "A PLC is best described as",
        options: ["a controller that reads sensors and drives actuators", "a password list compiler", "a public cloud billing report", "a browser plugin"],
        answer: 0,
        explain: "Programmable Logic Controllers connect software decisions to physical equipment. That safety context changes how defenders plan access, changes and monitoring."
      },
      {
        q: "Zones and conduits help OT security by",
        options: ["removing the need for monitoring", "grouping similar assets and controlling communication paths between them", "making every device internet-facing", "forcing all devices to run the same OS"],
        answer: 1,
        explain: "Zones group assets with similar trust and safety needs. Conduits define the controlled paths between zones, giving segmentation a physical-process-aware structure."
      },
      {
        q: "Signed firmware and secure boot primarily help ensure that",
        options: ["network policies are unnecessary", "passwords are shorter", "devices only run trusted code from an approved source", "all bugs disappear"],
        answer: 2,
        explain: "Firmware trust controls make unauthorized code harder to install and run. They are essential in products that may live in customer environments for years."
      },
      {
        q: "A mature product security lifecycle includes",
        options: ["using one default password for support", "ignoring customer reports", "never updating firmware", "design review, vulnerability intake, patch delivery and end-of-life communication"],
        answer: 3,
        explain: "Connected products need a full lifecycle: secure design, coordinated disclosure, update mechanisms, customer communication and a responsible end-of-life plan."
      }
    ]
  },
  "domains-grc": {
    title: "GRC checkpoint",
    sub: "Risk registers, control mapping, third parties and exceptions.",
    questions: [
      {
        q: "A useful risk register entry should include",
        options: ["asset, threat, weakness, impact, owner, treatment and review date", "only a scary title", "private passwords", "only the auditor's name"],
        answer: 0,
        explain: "A risk register drives action when each risk has context, an owner, a treatment decision and a review date. Otherwise it is just a list of worries."
      },
      {
        q: "Control mapping is the practice of",
        options: ["mapping office Wi-Fi coverage", "showing how specific controls satisfy policies, standards, laws or framework requirements", "guessing risk scores randomly", "hiding failed audits"],
        answer: 1,
        explain: "Mapping connects implemented controls to the requirements they satisfy, reducing duplicate work and making audits evidence-based."
      },
      {
        q: "Which statement best distinguishes policy, standard and procedure?",
        options: ["They are identical", "A procedure is optional but a policy is code", "Policy states intent, a standard sets the required baseline, and a procedure gives the steps", "Only vendors need them"],
        answer: 2,
        explain: "Policies define what must be true, standards define measurable baselines, and procedures tell people how to perform the work consistently."
      },
      {
        q: "Third-party risk focuses on",
        options: ["making all vendors administrators", "only employee lunch choices", "never asking vendors questions", "the security impact of vendors and partners that handle data, access or critical services"],
        answer: 3,
        explain: "Vendors can extend your attack surface and privacy obligations. Assess their access, data handling, controls, contracts and incident-notification commitments."
      },
      {
        q: "A risk acceptance or exception should be",
        options: ["temporary, owned, documented and reviewed", "silent and permanent", "approved by whoever wants the shortcut", "used to hide every failed control"],
        answer: 0,
        explain: "Exceptions are controlled risk decisions. They need an accountable owner, expiration or review date, compensating controls where possible and visibility to governance."
      }
    ]
  },
  "defense-resilience": {
    title: "Resilience checkpoint",
    sub: "BIA, RTO/RPO, backups, restore testing and crisis response.",
    questions: [
      {
        q: "A Business Impact Analysis primarily identifies",
        options: ["which logo to use", "which business processes are critical and what disruption costs", "the exact attacker identity", "how to disable logging"],
        answer: 1,
        explain: "A BIA ranks processes by business impact so recovery planning focuses on what matters most and sets realistic recovery priorities."
      },
      {
        q: "RTO and RPO differ in that",
        options: ["they mean the same thing", "RTO is encryption and RPO is logging", "RTO is restore speed while RPO is tolerable data loss", "RPO only applies to laptops"],
        answer: 2,
        explain: "Recovery Time Objective asks how quickly the system must return. Recovery Point Objective asks how much recent data loss the business can tolerate."
      },
      {
        q: "Why do ransomware plans emphasize immutable or offline backups?",
        options: ["They are cheaper than all storage", "They guarantee no breach occurred", "They remove the need for patching", "They are harder for attackers to encrypt or delete after compromising production"],
        answer: 3,
        explain: "Ransomware often hunts backup systems. Immutable or offline copies preserve a clean recovery path even if production credentials are compromised."
      },
      {
        q: "The strongest evidence that a backup strategy works is",
        options: ["a successful restore test that meets the required RTO and RPO", "a screenshot of a backup job name", "a larger hard drive", "a policy nobody has practiced"],
        answer: 0,
        explain: "Restore testing proves the data, access, runbook, dependencies and staff process actually work. Backups that have never been restored are unproven."
      },
      {
        q: "During a ransomware incident, crisis communications should",
        options: ["depend only on the possibly compromised email system", "use pre-planned trusted channels and clear owners for employees, customers, regulators and executives", "wait until every forensic detail is known", "be improvised by the first responder"],
        answer: 1,
        explain: "Communication plans need trusted channels and named owners before the incident. Normal collaboration tools may be unavailable or untrusted during a compromise."
      }
    ]
  },
  "core-federation-defense": {
    title: "Federation defense checkpoint",
    sub: "OAuth, OIDC and SAML transaction binding, token purpose and replay defense.",
    questions: [
      { q: "What does PKCE protect in an OAuth authorization-code flow?", options: ["The resource owner's password", "An intercepted authorization code by requiring the original client to prove a one-time verifier", "The TLS certificate", "The API schema"], answer: 1,
        explain: "The client commits to a challenge before authorization and later presents the verifier. An interceptor holding only the code cannot redeem it." },
      { q: "Which value binds an OAuth response to the browser flow that started it?", options: ["scope", "state", "audience", "issuer"], answer: 1,
        explain: "A high-entropy state value bound to the browser session prevents login CSRF and response mix-up. OIDC nonce separately binds an ID token to the authentication request." },
      { q: "Why is validating only a JWT signature insufficient?", options: ["Signatures never work", "A correctly signed token can still have the wrong issuer, audience, purpose or time window", "It makes tokens too short", "It disables encryption"], answer: 1,
        explain: "The signature authenticates the issuer's key. The receiver must still prove the token was issued by the configured issuer, for this audience, for this purpose and within time." },
      { q: "What is the core SAML signature-wrapping defense?", options: ["Parse any assertion with the right username", "Use the exact element whose signature was validated and reject ambiguous or duplicate assertions", "Disable audience checks", "Accept unsigned role claims"], answer: 1,
        explain: "A hardened library must bind business logic to the precise signed element. Looking up a different duplicate element after signature validation creates ambiguity attackers can abuse." },
      { q: "How should federated group claims become application roles?", options: ["Every new group becomes admin", "Through an explicit allow-listed mapping with least privilege and review", "By string length", "They should bypass authorization"], answer: 1,
        explain: "Claims are inputs, not authority by themselves. A controlled mapping prevents unexpected or externally managed group names from creating privilege." }
    ]
  },
  "defense-ad": {
    title: "AD & Kerberos defense checkpoint",
    sub: "Tickets, service identities, tier zero, attack paths and detection.",
    questions: [
      { q: "What is a Kerberos service ticket for?", options: ["Changing the domain schema", "Presenting authenticated identity to one specific service", "Replacing backups", "Encrypting every file"], answer: 1,
        explain: "The KDC issues a service ticket for a named service after the client has a TGT. Scope and lifetime limit where and how long it is useful." },
      { q: "Why prefer managed service accounts?", options: ["They never need owners", "They support strong automatically rotated credentials and reduce long-lived human-chosen passwords", "They grant domain admin", "They disable logging"], answer: 1,
        explain: "Managed identities reduce password age and manual handling, but still need a named owner, narrow permissions and monitoring." },
      { q: "What is the strongest administrative tiering rule?", options: ["Use one admin account on every device", "Tier-zero credentials appear only on hardened tier-zero administration endpoints", "Let admins browse email while elevated", "Share privileged sessions"], answer: 1,
        explain: "Keeping privileged credentials off lower-trust devices prevents one workstation compromise from becoming a directory compromise." },
      { q: "A privileged group membership changes unexpectedly. What should detection correlate first?", options: ["Theme settings", "Actor, source device, target group, approval record and follow-on access", "Only the group name", "Printer status"], answer: 1,
        explain: "The sequence distinguishes approved administration from compromise and reveals whether the new privilege was immediately used." },
      { q: "Why model AD compromise as a graph path?", options: ["Graphs look better", "Attackers chain group, ACL, delegation, session and local-admin relationships; removing one edge can break the route to tier zero", "Kerberos has no logs", "Only networks have paths"], answer: 1,
        explain: "Effective privilege is often indirect. Graphing relationships exposes the shortest path and verifies whether an alternate path remains after remediation." }
    ]
  },
  "defense-rule-engineering": {
    title: "Detection-as-code checkpoint",
    sub: "Sigma, KQL, SPL, fixtures, CI and rule operations.",
    questions: [
      { q: "What should remain stable when translating Sigma into KQL or SPL?", options: ["Every field name", "The behavior hypothesis, required telemetry and expected test outcomes", "The file extension", "The vendor dashboard color"], answer: 1,
        explain: "Backends have different schemas and syntax. The portable contract is the behavior being detected, the evidence it needs and fixtures proving match and non-match." },
      { q: "Why include a known-benign fixture?", options: ["To force every rule to fire", "To prevent a normal workflow from becoming a recurring false positive", "To hide missing logs", "To replace peer review"], answer: 1,
        explain: "A benign edge-case test locks in tuning and stops a later refactor from paging analysts on an approved operation." },
      { q: "What does a field-contract test catch?", options: ["A data source stopped sending or mapping a field the rule relies on", "An expired CSS file", "A slow workstation", "A missing logo"], answer: 0,
        explain: "Rules silently fail when schemas drift. Testing required normalized fields makes telemetry health part of the detection release." },
      { q: "What is the safest first production mode for a new broad rule?", options: ["Automatic account disable", "Shadow or alert-only with volume and false-positive review", "Permanent suppression", "No logging"], answer: 1,
        explain: "Progressive release measures behavior without granting untested logic destructive authority. Containment automation needs separate approvals and dry runs." },
      { q: "Why must a detection have an owner and runbook?", options: ["To make the YAML longer", "So someone maintains data dependencies and analysts know evidence, escalation and allowed containment", "To avoid tests", "To store credentials"], answer: 1,
        explain: "A rule is an operational product. Without ownership and response guidance it decays, creates noise and cannot produce consistent decisions." }
    ]
  },
  "domains-cloud-iam": {
    title: "Cloud IAM paths checkpoint",
    sub: "Trust, effective permissions, pass-role, resource policies and graph-based prioritization.",
    questions: [
      { q: "Why can reviewing only an identity policy miss effective privilege?", options: ["Identity policies are encrypted", "Trust policies, groups, resource policies, role chaining and service actions create indirect paths", "Cloud has no authorization", "Only passwords matter"], answer: 1,
        explain: "Effective access is the union of connected controls and conditions. A narrow-looking principal can reach privilege through another role or resource policy." },
      { q: "What is the danger of broad pass-role permission?", options: ["It slows logins", "A principal may create or configure a service that runs with a more privileged role", "It disables storage", "It rotates keys"], answer: 1,
        explain: "Passing a role lets a service act with that role. Restrict both which roles may be passed and which services may receive them." },
      { q: "What is a toxic combination in a cloud graph?", options: ["One low-severity label", "Connected exposure, exploitable weakness, excessive privilege and sensitive data that form a real attack path", "A private subnet", "A patched image"], answer: 1,
        explain: "Connected risks matter more than isolated findings because they describe a plausible path from entry to impact." },
      { q: "What should a workload identity look like?", options: ["One administrator role shared by all functions", "A separate short-lived identity with only the actions and resources needed for one workload", "A key in source code", "A human account"], answer: 1,
        explain: "A compromised workload inherits its role. Narrow, separate workload identities bound blast radius and improve attribution." },
      { q: "After removing one privilege edge, what should defenders verify?", options: ["That the console looks cleaner", "That no alternate path still reaches the crown-jewel resource and intended workloads still function", "That logs are deleted", "That all users are admins"], answer: 1,
        explain: "Graph paths can be redundant. Recompute effective access and test legitimate use so the remediation is both complete and safe." }
    ]
  }
});
