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
        options: ["only display a username", "mint new access tokens over time if stolen", "make TLS optional", "validate CSS"],
        answer: 1,
        explain: "A stolen refresh token can keep generating fresh access tokens. Treat it like a long-lived credential: protect it from script access, rotate it, bind it where possible, and revoke it on risk."
      },
      {
        q: "A secure logout or account-risk response should",
        options: ["only hide the current page", "clear local UI state but leave refresh tokens active", "revoke server-side sessions and tokens that can still be used", "depend on the user closing the browser"],
        answer: 2,
        explain: "Logout and risk events must invalidate usable credentials server-side. Clearing a local page does not stop a stolen token or another active SaaS session."
      },
      {
        q: "Why are helpdesk MFA reset flows a security boundary?",
        options: ["They are only a convenience feature", "They can bypass strong login if an attacker socially engineers recovery", "They only affect UI themes", "They remove the need for audit logs"],
        answer: 1,
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
        options: ["May this caller invoke this operation at all?", "Is the response compressed?", "Does the token use Base64?", "Is the endpoint name short enough?"],
        answer: 0,
        explain: "BFLA occurs when a user can call functions or routes they should not, such as admin actions. The server must authorize methods and operations, not rely on hidden UI controls."
      },
      {
        q: "Broken Object Property Level Authorization (BOPLA) is best prevented by",
        options: ["returning every database field and trusting the client", "explicit input/output DTOs and field-level read/write allow-lists", "using a single global admin role", "making object ids sequential"],
        answer: 1,
        explain: "BOPLA is about sensitive fields, not just whole objects. Separate DTOs and field-level allow-lists prevent overexposure and unauthorized field updates."
      },
      {
        q: "Why is schema validation alone insufficient for API authorization?",
        options: ["Schemas cannot parse JSON", "A request can be well-formed and still ask for forbidden data or actions", "Schemas always disable logging", "Authorization only belongs in the browser"],
        answer: 1,
        explain: "Schemas prove shape and type. Authorization decides permission. A valid REST body, GraphQL query or protobuf message still needs object, property and function checks."
      },
      {
        q: "Mass assignment is dangerous because",
        options: ["the API may write fields the UI never exposed, such as roles or flags", "it reduces file size", "it prevents validation", "it only affects static images"],
        answer: 0,
        explain: "Binding an entire request body to a model can let callers set privileged fields directly. Use operation-specific DTOs and explicit writable-field allow-lists."
      },
      {
        q: "Which control best addresses expensive GraphQL queries and business-flow abuse?",
        options: ["A single per-IP request counter only", "Query complexity limits, action-aware quotas, idempotency and anomaly alerts", "Disabling all logs", "Trusting the mobile app"],
        answer: 1,
        explain: "Abuse is often about cost or workflow, not just raw request count. Combine complexity limits, per-user/tenant quotas, idempotency keys and monitoring for unusual patterns."
      },
      {
        q: "An API inventory should track",
        options: ["owner, exposure, auth method, data classification, version and deprecation status", "only the endpoint font", "only successful responses", "nothing once an endpoint is internal"],
        answer: 0,
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
        options: ["The model cannot read instructions", "Instructions are guidance, not an enforceable security boundary", "Prompt injection only affects images", "It is fixed by longer prompts"],
        answer: 1,
        explain: "A model can be guided by instructions, but untrusted user or retrieved text still enters the same reasoning context. Enforce boundaries in application code: authorization, data filtering, tool allow-lists, and approvals."
      },
      {
        q: "In a RAG system, when should document authorization be enforced?",
        options: ["Before documents are retrieved or passed to the model", "Only after the model writes an answer", "Only in the browser", "Never, because embeddings are anonymous"],
        answer: 0,
        explain: "Retrieval must be scoped before context assembly. If unauthorized chunks reach the model, the answer may leak them even if the UI later tries to filter the output."
      },
      {
        q: "Excessive agency in an AI agent means the system",
        options: ["has too few tokens", "lets the model take high-impact actions without deterministic controls or approval", "uses a small model", "stores prompts locally"],
        answer: 1,
        explain: "Agency becomes risky when model output can directly trigger sensitive actions. Keep tools scoped, use schemas and dry-run previews, and require policy or human approval for high-impact changes."
      },
      {
        q: "The safest way to expose tools or plugins to a support bot is to",
        options: ["give every tool full admin rights for flexibility", "scope each tool to the task, deny by default, log calls, and gate sensitive actions", "hide tool names in the prompt", "trust the model to refuse dangerous calls"],
        answer: 1,
        explain: "Tools need normal least-privilege engineering: narrow permissions, explicit schemas, audit logs, and approval gates. A hidden prompt is not access control."
      },
      {
        q: "A safe way for defenders to use AI during alert triage is to",
        options: ["let it silently close alerts", "summarize evidence and suggest first checks for an analyst to verify", "paste raw secrets into the prompt", "turn every suggestion into a blocking rule automatically"],
        answer: 1,
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
        options: ["step-by-step phishing and malware generation", "high-level misuse patterns and the controls that reduce their impact", "secret prompt templates", "bypassing security tools"],
        answer: 1,
        explain: "Safe security education explains how AI changes attacker scale and deception, then maps those patterns to controls like phishing-resistant MFA, behavior detection, and helpdesk verification."
      },
      {
        q: "In an AI SOC copilot workflow, which action should require analyst or policy approval?",
        options: ["Summarizing related events", "Drafting a timeline", "Isolating a host or disabling an account", "Grouping duplicate alerts"],
        answer: 2,
        explain: "Summaries and grouping are low-risk drafts. Containment actions affect production and users, so they need deterministic policy or analyst approval."
      },
      {
        q: "The safest role for AI in secure code review is to",
        options: ["replace review entirely", "flag risky patterns and suggest tests for a human reviewer to verify", "approve its own patches", "ignore local standards"],
        answer: 1,
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
        options: ["escape quotes by hand", "use prepared statements or bind parameters", "hide database errors", "rename database tables"],
        answer: 1,
        explain: "Prepared statements and bind parameters keep query structure separate from user data, so input cannot become SQL syntax."
      },
      {
        q: "Framework output encoding helps prevent XSS because it",
        options: ["turns user-controlled text into inert text for the destination context", "encrypts the browser session", "blocks every network request", "removes the need for authorization"],
        answer: 0,
        explain: "The browser executes markup and script, so output must be encoded for its context. Framework auto-escaping is valuable unless developers bypass it."
      },
      {
        q: "A safer file-upload design is to",
        options: ["trust the uploaded filename", "store uploads under a public executable path", "generate server-side names, validate content, isolate storage, and authorize downloads", "accept any file if the user is logged in"],
        answer: 2,
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
  "threats-detection": {
    title: "Detection engineering checkpoint",
    sub: "Hypotheses, telemetry, rule logic, runbooks, and tests.",
    questions: [
      {
        q: "A detection hypothesis should state",
        options: ["the SIEM vendor name", "the attacker behavior you expect to see in telemetry", "the color of the dashboard", "the exact incident owner before triage"],
        answer: 1,
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
        options: ["lets reviewers validate intent before query syntax hides mistakes", "makes the alert secret", "removes the need for testing", "guarantees zero false positives"],
        answer: 0,
        explain: "Before writing SIEM syntax, the team should understand the behavior, time window, threshold, joins, and exclusions in ordinary language."
      },
      {
        q: "False-positive notes should include",
        options: ["only attacker examples", "known benign activity that can look similar", "user passwords", "the vendor sales contact"],
        answer: 1,
        explain: "Tuning depends on known-good examples: admin work, deployments, onboarding, backups, support resets, and maintenance windows."
      },
      {
        q: "A healthy detection test set includes",
        options: ["only the perfect malicious case", "a should-fire case, a should-not-fire case, and a benign edge case", "no tests until after production", "only screenshots"],
        answer: 1,
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
        options: ["a color palette", "an asset and data inventory", "a list of exploit names", "a press release"],
        answer: 1,
        explain: "You cannot protect what you cannot name. Inventory establishes systems, owners, identities, data classes, retention, and sensitive data flows."
      },
      {
        q: "A threat model is strongest when it focuses on",
        options: ["trust boundaries, likely abuse cases, high-value assets, and attacker entry points", "only firewall brands", "only low-risk assets", "removing all user features"],
        answer: 0,
        explain: "Threat modeling connects assets and trust boundaries to plausible attacker goals, then drives concrete architecture controls."
      },
      {
        q: "A detection plan belongs in architecture review because",
        options: ["secure systems never need logs", "defenders need telemetry and rules before production incidents happen", "it replaces authorization", "it is only useful for forensics exams"],
        answer: 1,
        explain: "Detection is a design requirement. Decide the telemetry sources, first detections, ownership, and tuning process while the system is being built."
      },
      {
        q: "An incident and recovery plan should define",
        options: ["only who writes the final report", "containment, evidence preservation, rotation, restore order, communications, and tested RTO/RPO", "the attacker's identity in advance", "no business owners"],
        answer: 1,
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
  },
  "domains-cloud-native": {
    title: "Cloud-native checkpoint",
    sub: "IAM, Kubernetes, serverless, telemetry and guardrails.",
    questions: [
      {
        q: "In cloud-native systems, why are workload identities safer than long-lived access keys in files or environment variables?",
        options: ["They make logging unnecessary", "They issue scoped, short-lived credentials tied to the workload", "They disable all network access", "They only work for administrators"],
        answer: 1,
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
        options: ["Network policy", "Admission policy", "Horizontal scaling", "A service name"],
        answer: 1,
        explain: "Admission policy checks objects before they enter the cluster, blocking risky patterns such as privileged pods, host mounts, untrusted images or missing required labels."
      },
      {
        q: "Serverless event permissions should be designed so that",
        options: ["every function shares one admin role", "only approved sources can invoke the function and the runtime role is least privilege", "event payloads are trusted automatically", "deploy permissions and runtime permissions are always identical"],
        answer: 1,
        explain: "In serverless, invocation rights and runtime rights both matter. Restrict who can trigger the function, validate event payloads, and give the function only the actions it needs."
      },
      {
        q: "A cloud guardrail is most useful when it",
        options: ["runs once during onboarding", "continuously prevents or detects forbidden configurations", "replaces all incident response", "depends on developers remembering every rule"],
        answer: 1,
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
        options: ["how long data is kept and how it is removed when no longer needed", "which font reports use", "how to bypass approvals", "which employee owns every laptop"],
        answer: 0,
        explain: "Privacy improves when data is kept only as long as needed for business, legal or safety reasons, then deleted or made unrecoverable through a provable process."
      },
      {
        q: "Why is key ownership a data-access issue?",
        options: ["Keys only affect performance", "Anyone who can use or administer decryption keys may effectively access the data", "Keys are never rotated", "Encryption removes the need for authorization"],
        answer: 1,
        explain: "Encryption is only as strong as key governance. If broad admins can use or change keys, they may be able to decrypt sensitive stores even if database permissions look restricted."
      },
      {
        q: "Sensitive access logging should focus on",
        options: ["only failed logins", "reads, exports and unusual access to high-value data with user and purpose context", "raw passwords for auditing", "deleting evidence after review"],
        answer: 1,
        explain: "For sensitive data, defenders need to see who read or exported it, from where, under what purpose and whether the volume or destination looks abnormal. Never log secrets themselves."
      },
      {
        q: "DLP and exfiltration monitoring are meant to detect",
        options: ["data leaving expected boundaries through email, file sharing, endpoints, SaaS exports or cloud storage", "only malware files", "CPU overheating", "whether users like a policy"],
        answer: 0,
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
        options: ["A plain text file", "Platform secure storage such as the system keychain or keystore", "The clipboard", "A comment in source code"],
        answer: 1,
        explain: "Mobile platforms provide protected storage backed by OS controls. Plain files, clipboards and source-code constants are much easier to extract or leak."
      },
      {
        q: "The safest mobile permission pattern is to",
        options: ["ask for every permission at install", "request only the permission needed for a feature, when the user uses that feature", "hide permission prompts", "treat denied permissions as proof of compromise"],
        answer: 1,
        explain: "Least privilege applies to devices too. Ask for the minimum permission at the moment it is needed, and design the app to degrade gracefully when it is denied."
      },
      {
        q: "Why is disabling TLS certificate validation dangerous in a mobile app?",
        options: ["It makes the app too fast", "It allows impostor servers to intercept or alter traffic", "It prevents all testing", "It only affects images"],
        answer: 1,
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
        options: ["remote logout and revocation of refresh/session tokens", "waiting for tokens to expire next year", "disabling all user accounts forever", "sharing the user's password with support"],
        answer: 0,
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
        options: ["Availability and safety of the physical process", "Color accuracy", "Browser compatibility", "Search ranking"],
        answer: 0,
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
        options: ["grouping similar assets and controlling communication paths between them", "removing the need for monitoring", "making every device internet-facing", "forcing all devices to run the same OS"],
        answer: 0,
        explain: "Zones group assets with similar trust and safety needs. Conduits define the controlled paths between zones, giving segmentation a physical-process-aware structure."
      },
      {
        q: "Signed firmware and secure boot primarily help ensure that",
        options: ["devices only run trusted code from an approved source", "passwords are shorter", "network policies are unnecessary", "all bugs disappear"],
        answer: 0,
        explain: "Firmware trust controls make unauthorized code harder to install and run. They are essential in products that may live in customer environments for years."
      },
      {
        q: "A mature product security lifecycle includes",
        options: ["design review, vulnerability intake, patch delivery and end-of-life communication", "ignoring customer reports", "never updating firmware", "using one default password for support"],
        answer: 0,
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
        options: ["only a scary title", "asset, threat, weakness, impact, owner, treatment and review date", "private passwords", "only the auditor's name"],
        answer: 1,
        explain: "A risk register drives action when each risk has context, an owner, a treatment decision and a review date. Otherwise it is just a list of worries."
      },
      {
        q: "Control mapping is the practice of",
        options: ["showing how specific controls satisfy policies, standards, laws or framework requirements", "mapping office Wi-Fi coverage", "guessing risk scores randomly", "hiding failed audits"],
        answer: 0,
        explain: "Mapping connects implemented controls to the requirements they satisfy, reducing duplicate work and making audits evidence-based."
      },
      {
        q: "Which statement best distinguishes policy, standard and procedure?",
        options: ["They are identical", "Policy states intent, a standard sets the required baseline, and a procedure gives the steps", "A procedure is optional but a policy is code", "Only vendors need them"],
        answer: 1,
        explain: "Policies define what must be true, standards define measurable baselines, and procedures tell people how to perform the work consistently."
      },
      {
        q: "Third-party risk focuses on",
        options: ["the security impact of vendors and partners that handle data, access or critical services", "only employee lunch choices", "never asking vendors questions", "making all vendors administrators"],
        answer: 0,
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
        options: ["which business processes are critical and what disruption costs", "which logo to use", "the exact attacker identity", "how to disable logging"],
        answer: 0,
        explain: "A BIA ranks processes by business impact so recovery planning focuses on what matters most and sets realistic recovery priorities."
      },
      {
        q: "RTO and RPO differ in that",
        options: ["RTO is restore speed while RPO is tolerable data loss", "RTO is encryption and RPO is logging", "they mean the same thing", "RPO only applies to laptops"],
        answer: 0,
        explain: "Recovery Time Objective asks how quickly the system must return. Recovery Point Objective asks how much recent data loss the business can tolerate."
      },
      {
        q: "Why do ransomware plans emphasize immutable or offline backups?",
        options: ["They are cheaper than all storage", "They are harder for attackers to encrypt or delete after compromising production", "They remove the need for patching", "They guarantee no breach occurred"],
        answer: 1,
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
  }
});
