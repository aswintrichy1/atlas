/* =====================================================================
   CITADEL · Practice and content-quality library
   Static offline material for scenarios, interviews, rubrics, cheat
   sheets and glossary pages. Defensive, original, no external links.
   ===================================================================== */
(function () {
  "use strict";

  window.CitadelPractice = {
    routes: [
      {
        id: "scenarios",
        title: "Scenario packs",
        route: "#/scenarios",
        summary: "Compact drills with model-answer outlines for capstone practice, interview prep and team tabletop review.",
        count: "4 packs"
      },
      {
        id: "interview",
        title: "Interview prompts",
        route: "#/interview",
        summary: "Five security prompts with what to listen for in a strong answer.",
        count: "5 prompts"
      },
      {
        id: "rubrics",
        title: "Rubrics",
        route: "#/rubrics",
        summary: "Beginner, competent and senior bands for evaluating practice answers.",
        count: "3 bands"
      },
      {
        id: "cheatsheets",
        title: "Cheat sheets",
        route: "#/cheatsheets",
        summary: "Short cards for incident response, threat modeling, secure upload, sessions and detection engineering.",
        count: "5 cards"
      },
      {
        id: "glossary",
        title: "Glossary",
        route: "#/glossary",
        summary: "Core terms with cross-links so the mental model stays connected.",
        count: "12 terms"
      }
    ],

    scenarios: [
      {
        id: "breach-triage",
        title: "Breach triage",
        timebox: "35 minutes",
        role: "Incident lead",
        prompt: "A customer portal shows unusual authentication events, a service account touched records outside its normal pattern, and support reports an MFA reset dispute. Build the first-response plan.",
        modelAnswer: [
          {
            heading: "Stabilize and assign ownership",
            points: [
              "Declare the working severity, name an incident commander, open an evidence log and split work across identity, app, data and communications leads.",
              "Protect volatile evidence before broad cleanup: preserve relevant auth logs, app logs, service-account activity, endpoint telemetry and ticket history."
            ]
          },
          {
            heading: "Scope the story",
            points: [
              "Build a timeline for first suspicious login, MFA reset, service-account activity, data reads, containment actions and remaining uncertainty.",
              "Separate facts from assumptions; mark every claim with the evidence source and confidence level."
            ]
          },
          {
            heading: "Contain without blinding the team",
            points: [
              "Revoke suspicious sessions, disable or rotate the affected service account, pause risky exports and isolate systems only where evidence suggests active misuse.",
              "Keep forensic copies and logging active; avoid destructive cleanup until responders understand what would be lost."
            ]
          },
          {
            heading: "Close the loop",
            points: [
              "Patch the root cause, strengthen identity recovery, add detection for reset-plus-data-access patterns and name owners for residual risks.",
              "Prepare a plain-language executive update: what happened, what is known, what is contained, what remains uncertain and the next decision needed."
            ]
          }
        ],
        links: [
          { label: "Breach capstone", route: "#/threats/case-studies/breach-capstone" },
          { label: "IR flow cheat sheet", route: "#/cheatsheets/ir-flow" },
          { label: "Rubric bands", route: "#/rubrics" }
        ]
      },
      {
        id: "secure-customer-portal",
        title: "Secure customer portal",
        timebox: "45 minutes",
        role: "Security architect",
        prompt: "Design a portal for user profiles, billing data, document uploads, admin support tools and analytics exports on customer-portal.example. Explain controls, telemetry, recovery and residual risk.",
        modelAnswer: [
          {
            heading: "Inventory and boundaries",
            points: [
              "List assets, identities, data classes, upload/export paths, third-party processing and trust boundaries between browser, API, worker, object store, admin tool and analytics tier.",
              "Minimize regulated data copies and define owners, retention and deletion paths before adding controls."
            ]
          },
          {
            heading: "Prevent the highest-risk abuse",
            points: [
              "Use strong authentication, object-level authorization, step-up for sensitive changes, server-side upload naming, type and size validation, scanning, isolated storage and authorized download handlers.",
              "Apply least-privilege workload roles, segmentation, secret rotation, encryption and explicit deny defaults for admin actions."
            ]
          },
          {
            heading: "Make failure visible",
            points: [
              "Define telemetry for login risk, MFA changes, admin actions, upload verdicts, object access, export creation, unusual data reads and denied authorization attempts.",
              "Write first detections with owners, runbooks, false-positive notes and review cadence."
            ]
          },
          {
            heading: "Recover and govern risk",
            points: [
              "Document containment choices, session and key rotation, backup restore order, RTO/RPO, communications triggers and residual risks with owner and expiry date.",
              "State the trade-offs plainly: what is accepted now, why, and what control would reduce it next."
            ]
          }
        ],
        links: [
          { label: "Architecture capstone", route: "#/threats/case-studies/security-architecture-capstone" },
          { label: "Secure upload checklist", route: "#/cheatsheets/secure-upload-checklist" },
          { label: "Auth/session checklist", route: "#/cheatsheets/auth-session-checklist" }
        ]
      },
      {
        id: "cloud-misconfiguration-drill",
        title: "Cloud misconfiguration drill",
        timebox: "30 minutes",
        role: "Cloud defender",
        prompt: "A workload role can list and read storage buckets far beyond its service need. Logs show rare metadata access and unusual object enumeration. Explain triage, containment and prevention.",
        modelAnswer: [
          {
            heading: "Confirm blast radius",
            points: [
              "Identify the workload, role, permissions, buckets touched, API calls, source identity, time window and whether data reads moved from enumeration to access.",
              "Treat identity as the blast radius: the question is what the role could do, not only what the process normally does."
            ]
          },
          {
            heading: "Contain safely",
            points: [
              "Reduce or replace the role policy, rotate temporary trust where needed, block metadata abuse paths and preserve cloud audit logs before changing retention or log sinks.",
              "Avoid broad shutdown unless active misuse is continuing and targeted permission reduction cannot stop it."
            ]
          },
          {
            heading: "Prevent recurrence",
            points: [
              "Move to least-privilege roles, scoped resource policies, metadata protections, egress allow-lists and policy review for storage access.",
              "Add detections for rare role use, object enumeration spikes, metadata access and access outside normal workload data prefixes."
            ]
          }
        ],
        links: [
          { label: "Cloud case study", route: "#/threats/case-studies/capital-one-ssrf" },
          { label: "Detection card template", route: "#/cheatsheets/detection-card-template" },
          { label: "Least privilege", route: "#/glossary/least-privilege" }
        ]
      },
      {
        id: "detection-tuning",
        title: "Detection tuning",
        timebox: "40 minutes",
        role: "Detection engineer",
        prompt: "A rule for suspicious admin login fires too often during maintenance but has caught one real case. Tune it without making it blind.",
        modelAnswer: [
          {
            heading: "Preserve the hypothesis",
            points: [
              "Restate what the rule is meant to catch in plain language and identify the telemetry source that proves the behavior.",
              "Separate noisy conditions from the core signal; do not remove the attacker behavior just because it is inconvenient."
            ]
          },
          {
            heading: "Tune with evidence",
            points: [
              "Review false positives by admin group, device, geography, time, change window and automation account. Add bounded exclusions with owners and expiry.",
              "Keep test cases: one real suspicious pattern, one known-benign maintenance pattern and one edge case that should remain visible."
            ]
          },
          {
            heading: "Operate the rule",
            points: [
              "Update severity, runbook, triage questions, dashboard notes and review cadence. Add metrics for alert volume, true positives, suppressions and stale exclusions.",
              "Escalate gaps in source logging rather than hiding them in rule logic."
            ]
          }
        ],
        links: [
          { label: "Detection engineering lesson", route: "#/threats/case-studies/detection-engineering" },
          { label: "Detection card template", route: "#/cheatsheets/detection-card-template" },
          { label: "Telemetry", route: "#/glossary/telemetry" }
        ]
      }
    ],

    interviewPrompts: [
      {
        id: "file-upload-threat-model",
        title: "File upload threat model",
        ask: "Threat-model a file upload feature for a customer portal. What can go wrong, and what controls do you require?",
        strongSignals: [
          "Starts with assets, trust boundaries, file lifecycle and who can upload, process and download.",
          "Mentions allow-listed extensions, content signature checks, size limits, random server-side names, isolated storage, scanning and authorization on download.",
          "Covers operational signals: upload failures, scan verdicts, download anomalies and admin bypass attempts."
        ],
        pitfalls: [
          "Only says 'check the extension'.",
          "Stores user-supplied names in executable paths.",
          "Forgets authorization and retention after upload."
        ],
        links: [
          { label: "Secure upload checklist", route: "#/cheatsheets/secure-upload-checklist" },
          { label: "Trust boundary", route: "#/glossary/trust-boundary" }
        ]
      },
      {
        id: "suspicious-admin-login",
        title: "Suspicious admin login",
        ask: "An admin account logs in from a new device and immediately exports data. Walk through your triage.",
        strongSignals: [
          "Checks identity signals, device posture, session context, admin actions, export scope and prior password or MFA changes.",
          "Contains by revoking sessions or pausing risky access while preserving logs and evidence.",
          "Communicates confidence and uncertainty rather than jumping to a final conclusion."
        ],
        pitfalls: [
          "Deletes the account before preserving evidence.",
          "Treats a valid password as proof of legitimacy.",
          "Forgets to inspect downstream data access."
        ],
        links: [
          { label: "IR flow", route: "#/cheatsheets/ir-flow" },
          { label: "MFA fatigue", route: "#/glossary/mfa-fatigue" }
        ]
      },
      {
        id: "secure-session-handling",
        title: "Secure session handling",
        ask: "Design secure session handling for a web app with normal users and support admins.",
        strongSignals: [
          "Uses server-issued opaque session IDs in Secure, HttpOnly, SameSite cookies and rotates on login, privilege change and risk.",
          "Scopes sessions, enforces idle and absolute timeouts, revokes on logout and step-up events, and separates admin risk.",
          "Avoids storing session tokens in browser storage and describes detection for stolen-session signals."
        ],
        pitfalls: [
          "Puts privileges or PII inside the session token.",
          "Only relies on client-side timeout.",
          "Does not rotate after authentication or privilege elevation."
        ],
        links: [
          { label: "Auth/session checklist", route: "#/cheatsheets/auth-session-checklist" },
          { label: "Least privilege", route: "#/glossary/least-privilege" }
        ]
      },
      {
        id: "xss-detection-tuning",
        title: "XSS detection tuning",
        ask: "A browser-side XSS alert is noisy. How do you tune it while keeping meaningful coverage?",
        strongSignals: [
          "Defines the detection hypothesis and separates harmless user text from dangerous sinks, script execution, suspicious DOM mutation and blocked CSP events.",
          "Uses context, allow-listed source paths and bounded suppression rather than broad string removal.",
          "Pairs tuning with prevention: output encoding, sanitization, CSP, safe DOM APIs and regression tests."
        ],
        pitfalls: [
          "Suppresses all script-looking text.",
          "Ignores where the data lands in the DOM.",
          "Treats detection as a substitute for fixing the sink."
        ],
        links: [
          { label: "STRIDE mitigations", route: "#/cheatsheets/stride-mitigations" },
          { label: "Detection tuning scenario", route: "#/scenarios/detection-tuning" }
        ]
      },
      {
        id: "incident-commander-first-30",
        title: "Incident commander first 30 minutes",
        ask: "You are incident commander for a suspected breach. What do you do in the first 30 minutes?",
        strongSignals: [
          "Establishes command, severity, scope hypotheses, communications channel, evidence log and named owners.",
          "Chooses containment that reduces harm without destroying visibility.",
          "Sets the update rhythm for executives, legal/privacy and responders while keeping speculation labeled."
        ],
        pitfalls: [
          "Starts with broad reimaging or rebooting.",
          "Lets everyone investigate without roles or timestamps.",
          "Waits for certainty before communicating operational risk."
        ],
        links: [
          { label: "Breach triage scenario", route: "#/scenarios/breach-triage" },
          { label: "Containment", route: "#/glossary/containment" }
        ]
      }
    ],

    rubricBands: [
      {
        band: "Beginner",
        signal: "Names the obvious controls and explains the main risk in plain language.",
        evidence: [
          "Identifies key assets, a few threats and at least one preventive control.",
          "Uses correct terms but may miss trust boundaries, ownership or operational detail.",
          "Can describe what to do, but not yet how to prove it worked."
        ],
        coaching: "Ask for evidence sources, scope, assumptions and one detection or test that would validate the answer."
      },
      {
        band: "Competent",
        signal: "Builds a defensible answer across prevention, detection and response.",
        evidence: [
          "Connects assets, threat paths, controls, telemetry, owners and residual risk.",
          "Makes reasonable trade-offs and can explain why a control belongs at a specific boundary.",
          "Includes validation: tests, logs, metrics, runbooks or review cadence."
        ],
        coaching: "Push for sharper prioritization, failure modes and communication to non-technical stakeholders."
      },
      {
        band: "Senior",
        signal: "Frames the system, exposes assumptions and turns the answer into an operating model.",
        evidence: [
          "Prioritizes by business impact, blast radius and evidence quality rather than control checklists.",
          "Names owners, decision points, rollback paths, residual-risk expiry and detection tuning loops.",
          "Communicates uncertainty clearly and avoids both panic and false confidence."
        ],
        coaching: "Look for crisp executive summaries, measurable outcomes and explicit trade-offs."
      }
    ],

    rubricDimensions: [
      ["Problem framing", "Assets, users, data classes, boundaries and success criteria are explicit."],
      ["Threat reasoning", "The answer follows plausible abuse paths without giving exploit instructions."],
      ["Control design", "Controls are layered, least-privilege and placed where they reduce real risk."],
      ["Detection and evidence", "Telemetry, alerts, tests and confidence levels are named."],
      ["Response and recovery", "Containment, evidence preservation, communications and RTO/RPO are practical."],
      ["Communication", "The story is concise, factual and clear about assumptions and residual risk."]
    ],

    cheatsheets: [
      {
        id: "ir-flow",
        title: "IR flow",
        purpose: "Use when a suspicious event may become an incident.",
        sections: [
          { heading: "First 15 minutes", items: ["Name an incident commander.", "Open a timeline and evidence log.", "Declare severity and unknowns.", "Assign identity, app, endpoint, data and communications owners."] },
          { heading: "Triage", items: ["Scope affected users, systems, data and time window.", "Preserve volatile evidence before cleanup.", "Decide whether containment can be targeted."] },
          { heading: "Contain and recover", items: ["Revoke sessions and risky tokens.", "Isolate only where needed.", "Rotate secrets.", "Patch root cause.", "Restore in tested order."] },
          { heading: "After action", items: ["Write the timeline.", "Name control gaps.", "Create detections and owners.", "Track residual risk to closure."] }
        ]
      },
      {
        id: "stride-mitigations",
        title: "STRIDE mitigations",
        purpose: "Turn threat-model findings into control ideas.",
        sections: [
          { heading: "Spoofing", items: ["Strong authentication.", "Phishing-resistant MFA where risk warrants.", "Signed service identity."] },
          { heading: "Tampering", items: ["Integrity checks.", "Server-side validation.", "Immutable logs.", "Change control."] },
          { heading: "Repudiation", items: ["Structured audit logs.", "Correlation IDs.", "Time synchronization.", "Tamper-evident storage."] },
          { heading: "Information disclosure", items: ["Data minimization.", "Encryption.", "Access scoping.", "No-store caching for sensitive responses."] },
          { heading: "Denial of service", items: ["Rate limits.", "Quotas.", "Circuit breakers.", "Backpressure and capacity alarms."] },
          { heading: "Elevation of privilege", items: ["Least privilege.", "Object-level authorization.", "Step-up for sensitive actions.", "Privilege-change alerts."] }
        ]
      },
      {
        id: "secure-upload-checklist",
        title: "Secure upload checklist",
        purpose: "Use before enabling user-provided files.",
        sections: [
          { heading: "Accept", items: ["Authenticate uploaders.", "Allow-list business-required extensions.", "Validate file signatures and size.", "Reject double-extension and path tricks."] },
          { heading: "Store", items: ["Generate server-side names.", "Store outside executable paths.", "Keep original names as metadata only if needed.", "Apply least-privilege storage permissions."] },
          { heading: "Process", items: ["Scan or rewrite where appropriate.", "Use isolated workers.", "Limit decompression and parsing.", "Log scan verdicts and failures."] },
          { heading: "Serve", items: ["Download through an authorization handler.", "Set safe content disposition.", "Monitor bulk access.", "Expire or delete by retention policy."] }
        ]
      },
      {
        id: "auth-session-checklist",
        title: "Auth/session checklist",
        purpose: "Use for web app login, session and admin flows.",
        sections: [
          { heading: "Session token", items: ["Opaque, server-issued, high-entropy ID.", "Secure, HttpOnly and SameSite cookie.", "No raw session token in browser storage.", "No PII or privileges inside the token."] },
          { heading: "Lifecycle", items: ["Rotate on login, privilege change and risk.", "Invalidate old IDs.", "Enforce idle and absolute timeouts server-side.", "Full logout revokes server state."] },
          { heading: "Sensitive actions", items: ["Step up for admin, export, password and MFA changes.", "Show what is being authorized.", "Reject client-side downgrades."] },
          { heading: "Detection", items: ["Log session creation, rotation and revocation.", "Alert on impossible travel, new device risk and repeated MFA prompts.", "Hash session IDs before logging."] }
        ]
      },
      {
        id: "detection-card-template",
        title: "Detection engineering card template",
        purpose: "Use when converting an incident lesson into a maintained rule.",
        sections: [
          { heading: "Hypothesis", items: ["If an attacker is doing X, we should observe Y in source Z."] },
          { heading: "Logic", items: ["Plain-language condition.", "Time window.", "Threshold.", "Joins.", "Exclusions with owner and expiry."] },
          { heading: "Triage", items: ["First five analyst checks.", "Evidence to preserve.", "When to escalate.", "Containment trigger."] },
          { heading: "Quality", items: ["Should-fire test.", "Should-not-fire test.", "Known benign edge case.", "False-positive notes.", "Review cadence."] }
        ]
      }
    ],

    glossary: [
      { term: "Asset", slug: "asset", definition: "Anything the organization values and must protect: data, systems, identities, processes, trust or reputation.", related: ["risk", "control", "telemetry"] },
      { term: "Threat", slug: "threat", definition: "A potential cause of harm, such as a malicious actor, accident, process failure or environmental event.", related: ["vulnerability", "risk", "control"] },
      { term: "Vulnerability", slug: "vulnerability", definition: "A weakness that can be used by a threat to cause impact.", related: ["threat", "risk", "control"] },
      { term: "Risk", slug: "risk", definition: "The possibility that a threat uses a vulnerability to harm an asset, usually reasoned about through likelihood and impact.", related: ["asset", "threat", "control"] },
      { term: "Control", slug: "control", definition: "A safeguard that reduces risk by preventing, detecting, responding to or recovering from unwanted events.", related: ["risk", "telemetry", "containment"] },
      { term: "Trust boundary", slug: "trust-boundary", definition: "A place where data, identity or execution crosses from one trust level to another and must be validated.", related: ["asset", "control", "least-privilege"] },
      { term: "MFA fatigue", slug: "mfa-fatigue", definition: "An identity attack pattern where repeated prompts pressure a user into approving access they did not initiate.", related: ["control", "telemetry", "least-privilege"] },
      { term: "Least privilege", slug: "least-privilege", definition: "Granting only the access required for the task, for the shortest practical time, with review and revocation paths.", related: ["control", "trust-boundary", "risk"] },
      { term: "Telemetry", slug: "telemetry", definition: "Security-relevant signals collected from systems, identities, networks and applications so defenders can detect and investigate behavior.", related: ["control", "containment", "risk"] },
      { term: "Containment", slug: "containment", definition: "Actions that limit further harm during an incident while preserving enough visibility and evidence to understand what happened.", related: ["telemetry", "control", "rto-rpo"] },
      { term: "RTO/RPO", slug: "rto-rpo", definition: "Recovery time objective is how quickly service must return. Recovery point objective is how much data loss is tolerable.", related: ["asset", "risk", "containment"] },
      { term: "Residual risk", slug: "residual-risk", definition: "The risk that remains after controls are applied, ideally with an explicit owner, reason and review date.", related: ["risk", "control", "least-privilege"] }
    ]
  };
})();
