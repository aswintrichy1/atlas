/* track-secplus.js — Security+ concepts, defensive framing (unofficial, original prep) */
(function () {
  "use strict";
  var TID = "secplus";

  function h(tag, attrs) {
    var el = document.createElement(tag);
    for (var k in attrs) {
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    mount.appendChild(h("p", { class: "widget-desc" }, desc));
    var stage = h("div", { class: "w-stage" });
    mount.appendChild(stage);
    return stage;
  }
  function seg(label, opts, active, onPick) {
    var wrap = h("div", { class: "su-ctl" }, h("span", { class: "su-ctl-label" }, label));
    var box = h("div", { class: "w-seg", role: "group", "aria-label": label });
    var btns = opts.map(function (o, i) {
      var b = h("button", { type: "button", class: "w-seg-btn" + (i === active ? " active" : ""), "aria-pressed": i === active ? "true" : "false" }, o);
      b.addEventListener("click", function () {
        btns.forEach(function (x, j) { x.className = "w-seg-btn" + (j === i ? " active" : ""); x.setAttribute("aria-pressed", j === i ? "true" : "false"); });
        onPick(i);
      });
      box.appendChild(b);
      return b;
    });
    wrap.appendChild(box);
    return wrap;
  }
  function ro(label) {
    var b = h("b", {}, "-");
    var el = h("div", { class: "ro" }, label + ": ", b);
    return { el: el, set: function (v) { b.textContent = String(v); } };
  }
  function hashStr(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
  var bag = [];
  function slot(seedText) {
    if (!bag.length) {
      bag = [0, 1, 2, 3];
      var r = hashStr(TID + seedText);
      for (var i = 3; i > 0; i--) { r = (Math.imul(r, 1103515245) + 12345) >>> 0; var j = (r >>> 8) % (i + 1); var t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    }
    return bag.pop();
  }
  function Q(q, right, wrong, explain) {
    var pos = slot(q);
    var options = wrong.slice(0, 3);
    options.splice(pos, 0, right);
    return { q: q, options: options, answer: pos, explain: explain };
  }
  var QZ = {};
  function L(id, title, summary, minutes, tags, blocks, questions) {
    var qid = TID + "-" + id;
    QZ[qid] = { title: "Checkpoint: " + title, sub: questions.length + " original exam-style questions with explanations", questions: questions };
    var b = blocks.slice(0, -1).concat([{ t: "quiz", id: qid }], blocks.slice(-1));
    return { id: id, title: title, summary: summary, minutes: minutes, tags: tags, blocks: b };
  }
  var VERIFY = { t: "note", variant: "warn", html: "Unofficial, defensive study material. Exam objectives, domain weights and question formats change; <strong>verify current official objectives</strong>. Threats are described only so you can recognize and defend against them." };

  /* ---------- widgets ---------- */
  var Widgets = {};

  Widgets.suControlSorter = function (mount) {
    var stage = shell(mount, "classifier", "Control category and type sorter", "Step through example controls. Each one has a category (who or what implements it) and a primary type (what it does to an incident's timeline).");
    var items = [
      ["Firewall rule blocking inbound admin ports", "technical", "preventive"],
      ["Security awareness training", "operational", "preventive"],
      ["Risk assessment policy", "managerial", "directive"],
      ["Badge reader on the server room", "physical", "preventive"],
      ["SIEM alert on impossible-travel logins", "technical", "detective"],
      ["Restoring a server from known-good backup", "technical", "corrective"],
      ["Warning sign about CCTV monitoring", "physical", "deterrent"],
      ["Extra monitoring because a legacy system cannot be patched", "technical", "compensating"],
      ["Guard doing hourly patrols", "operational", "detective"]
    ];
    var st = { i: 0 };
    var a = ro("Control"), b = ro("Category"), c = ro("Primary type");
    var note = h("p", { class: "su-dim" }, "");
    function paint() {
      var it = items[st.i];
      a.set(it[0]); b.set(it[1]); c.set(it[2]);
      note.textContent = "Example " + (st.i + 1) + " of " + items.length + ". Many controls serve more than one type; exam items usually ask for the best fit.";
    }
    var prev = h("button", { type: "button", class: "w-btn" }, "Previous");
    var next = h("button", { type: "button", class: "w-btn primary" }, "Next control");
    prev.addEventListener("click", function () { st.i = (st.i + items.length - 1) % items.length; paint(); });
    next.addEventListener("click", function () { st.i = (st.i + 1) % items.length; paint(); });
    stage.appendChild(h("div", { class: "su-row" }, prev, next));
    stage.appendChild(note);
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el));
    paint();
  };

  Widgets.suRiskCalc = function (mount) {
    var stage = shell(mount, "calculator", "Quantitative risk calculator", "Set the asset value, exposure factor and annual rate of occurrence. The calculator derives single loss expectancy and annualized loss expectancy, then compares a control's yearly cost.");
    var st = { av: 1, ef: 1, aro: 1, ctl: 1 };
    var AV = [50000, 200000, 1000000], EF = [0.1, 0.25, 0.5, 1], ARO = [0.1, 0.5, 2], CTL = [5000, 20000, 80000];
    var a = ro("SLE = AV x EF"), b = ro("ALE = SLE x ARO"), c = ro("Control cost / yr"), d = ro("Decision hint");
    function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
    function paint() {
      var sle = AV[st.av] * EF[st.ef];
      var ale = sle * ARO[st.aro];
      a.set(money(sle)); b.set(money(ale)); c.set(money(CTL[st.ctl]));
      d.set(CTL[st.ctl] < ale ? "control costs less than expected yearly loss: mitigation is justified if it cuts the risk enough" : "control costs more than expected loss: consider accepting, transferring or a cheaper control");
    }
    stage.appendChild(seg("Asset value", ["$50k", "$200k", "$1M"], 1, function (i) { st.av = i; paint(); }));
    stage.appendChild(seg("Exposure factor", ["10%", "25%", "50%", "100%"], 1, function (i) { st.ef = i; paint(); }));
    stage.appendChild(seg("ARO (per year)", ["0.1", "0.5", "2"], 1, function (i) { st.aro = i; paint(); }));
    stage.appendChild(seg("Control cost per year", ["$5k", "$20k", "$80k"], 1, function (i) { st.ctl = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el, d.el));
    paint();
  };

  Widgets.suIrStepper = function (mount) {
    var stage = shell(mount, "process", "Incident response stepper", "Walk a ransomware-style alert through a common response lifecycle. Each step shows the goal and one concrete action.");
    var steps = [
      ["Preparation", "Have playbooks, contacts, tooling and backups ready before anything happens.", "Test restoring a critical server from offline backup each quarter."],
      ["Detection", "Notice that something abnormal is happening.", "EDR alert: many files renamed with a new extension on one host."],
      ["Analysis", "Confirm scope, impact and what is affected.", "Correlate SIEM logs to find other hosts contacting the same destination."],
      ["Containment", "Stop the spread while preserving evidence.", "Isolate affected hosts from the network; disable the compromised account."],
      ["Eradication", "Remove the cause.", "Reimage hosts, remove persistence, patch the exploited weakness."],
      ["Recovery", "Return to normal operations safely.", "Restore data from clean backups and monitor closely for recurrence."],
      ["Lessons learned", "Improve so it is less likely or less damaging next time.", "Blameless review; update playbooks and detection rules."]
    ];
    var st = { i: 0 };
    var list = h("ol", { class: "su-steps" });
    var a = ro("Phase"), b = ro("Goal"), c = ro("Example action");
    function paint() {
      list.textContent = "";
      steps.forEach(function (s, i) { list.appendChild(h("li", { class: i === st.i ? "is-active" : i < st.i ? "is-done" : "" }, s[0])); });
      a.set((st.i + 1) + ". " + steps[st.i][0]); b.set(steps[st.i][1]); c.set(steps[st.i][2]);
    }
    var back = h("button", { type: "button", class: "w-btn" }, "Back");
    var fwd = h("button", { type: "button", class: "w-btn primary" }, "Next phase");
    back.addEventListener("click", function () { st.i = Math.max(0, st.i - 1); paint(); });
    fwd.addEventListener("click", function () { st.i = (st.i + 1) % steps.length; paint(); });
    stage.appendChild(list);
    stage.appendChild(h("div", { class: "su-row" }, back, fwd));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el, c.el));
    paint();
  };

  Widgets.suZonePlacer = function (mount) {
    var stage = shell(mount, "architecture", "Network zone placement", "Pick an asset and see which zone it belongs in and the key control between zones.");
    var assets = [
      ["Public web server", "Screened subnet (DMZ)", "Firewall allows only HTTPS from the internet; no direct path to internal databases"],
      ["Customer database", "Internal data zone", "Only the app tier may connect, on the DB port; access is logged"],
      ["Employee laptops", "User zone with NAC", "Network access control checks posture before granting access"],
      ["Building badge system", "Isolated OT/IoT segment", "No internet access; tightly restricted management path"],
      ["Jump host for admins", "Management zone", "MFA required; sessions recorded; only management protocols allowed onward"],
      ["Guest Wi-Fi", "Guest network", "Internet only; no route to internal zones"]
    ];
    var st = { i: 0 };
    var a = ro("Zone"), b = ro("Key control");
    function paint() { a.set(assets[st.i][1]); b.set(assets[st.i][2]); }
    stage.appendChild(seg("Asset", assets.map(function (x) { return x[0]; }), 0, function (i) { st.i = i; paint(); }));
    stage.appendChild(h("div", { class: "w-readout" }, a.el, b.el));
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- lessons ---------- */
  var concepts = [
    L("cia-aaa", "CIA, AAA and zero trust", "The vocabulary every other domain builds on.", 8, ["fundamentals"], [
      VERIFY,
      { t: "p", html: "Every control protects at least one of <strong>confidentiality</strong> (only the right people see it), <strong>integrity</strong> (it has not been altered improperly) or <strong>availability</strong> (it is there when needed). Access is managed through <strong>authentication, authorization and accounting</strong>." },
      { t: "table", headers: ["Term", "Plain meaning", "Example control"], rows: [
        ["Confidentiality", "Prevent unauthorized disclosure", "Encryption, access control"],
        ["Integrity", "Prevent or detect unauthorized change", "Hashing, digital signatures, change control"],
        ["Availability", "Keep systems usable", "Redundancy, backups, DDoS protection"],
        ["Non-repudiation", "Sender cannot credibly deny an action", "Digital signatures with protected private keys"],
        ["Authentication", "Prove who you are", "Password plus MFA"],
        ["Authorization", "Decide what you may do", "Role-based permissions"],
        ["Accounting", "Record what you did", "Audit logs"]
      ] },
      { t: "h", text: "Zero trust in one paragraph" },
      { t: "p", html: "Zero trust drops the idea that being inside the network makes you trusted. Every request is evaluated using identity, device posture and context. A <strong>policy engine</strong> decides, a <strong>policy administrator</strong> sets up or tears down the session, and a <strong>policy enforcement point</strong> sits in the data path to allow or block." },
      { t: "note", variant: "trap", html: "Hashing provides integrity, not confidentiality. Encryption provides confidentiality; it does not by itself prove who sent the data." },
      { t: "note", variant: "key", html: "CIA says what you protect, AAA says how access is controlled and recorded, and zero trust evaluates every request instead of trusting location." }
    ], [
      Q("A company hashes downloadable installers and publishes the hashes so users can verify the files. Which goal does this mainly support?", "Integrity", ["Confidentiality", "Availability", "Authorization"], "Comparing hashes shows whether the file was altered. It does not hide the file or keep the service available."),
      Q("Which concept ensures a user cannot credibly deny having approved a transaction?", "Non-repudiation", ["Availability", "Least functionality", "Obfuscation"], "Non-repudiation is typically achieved with digital signatures tied to a private key only the signer controls."),
      Q("A user logs in with a password and a one-time code, then can only view, not edit, payroll. Which step is the view-only restriction?", "Authorization", ["Authentication", "Accounting", "Identification"], "Authentication proved identity; authorization decides what the identity may do."),
      Q("In a zero trust architecture, which component sits in the data path and allows or blocks the connection?", "Policy enforcement point", ["Policy engine", "Certificate revocation list", "Honeypot"], "The policy engine decides and the administrator configures the session; the enforcement point actually gates the traffic."),
      Q("Redundant power supplies and a standby site primarily protect which property?", "Availability", ["Confidentiality", "Integrity", "Non-repudiation"], "Redundancy keeps systems usable during component or site failures."),
      Q("Which recorded artifact best supports the accounting part of AAA?", "Audit logs of user actions", ["A firewall's allow rule", "A strong password policy", "Full-disk encryption"], "Accounting records who did what and when, which audit logs provide.")
    ]),

    L("controls", "Security control categories and types", "Classify controls by who implements them and what they do.", 8, ["controls"], [
      { t: "p", html: "Two lenses. <strong>Category</strong>: technical, managerial, operational, physical. <strong>Type</strong>: preventive, deterrent, detective, corrective, compensating, directive. One control has one category and usually one primary type." },
      { t: "widget", id: "suControlSorter" },
      { t: "table", headers: ["Type", "Acts", "Example"], rows: [
        ["Preventive", "Before: stops it", "Account lockout, firewall rule"],
        ["Deterrent", "Before: discourages it", "Warning banner, visible cameras"],
        ["Detective", "During or after: finds it", "IDS alert, log review"],
        ["Corrective", "After: fixes it", "Restore from backup, patch"],
        ["Compensating", "Instead: alternative when the ideal is not possible", "Isolation for an unpatchable system"],
        ["Directive", "Tells people what to do", "Policy, acceptable use agreement"]
      ] },
      { t: "note", variant: "tip", html: "Category is about <em>who/what implements</em> the control (software, management decisions, people's processes, physical things). Type is about <em>when and how</em> it affects an incident." },
      { t: "note", variant: "key", html: "Classify by category (technical, managerial, operational, physical) and type (preventive, deterrent, detective, corrective, compensating, directive)." }
    ], [
      Q("A legacy medical device cannot be patched, so it is placed on an isolated VLAN with strict monitoring. What type of control is the isolation?", "Compensating", ["Deterrent", "Directive", "Corrective"], "When the preferred control (patching) is not possible, an alternative that reduces the same risk is a compensating control."),
      Q("Which is an example of a managerial control?", "A risk assessment process", ["A badge reader", "An antivirus agent", "A security guard's patrol"], "Managerial controls are administrative decisions and processes such as policies and risk assessments."),
      Q("A login banner warns that unauthorized access is prosecuted. What type of control is it?", "Deterrent", ["Detective", "Corrective", "Compensating"], "Deterrents discourage attempts without technically preventing them."),
      Q("Which control is primarily detective?", "An intrusion detection system alerting on suspicious traffic", ["A locked server cabinet", "A backup restore", "An acceptable use policy"], "Detective controls identify activity; they do not stop it by themselves."),
      Q("Restoring files from backup after malware corrupts them is which type of control?", "Corrective", ["Preventive", "Deterrent", "Directive"], "Corrective controls reduce impact and restore normal operation after an event."),
      Q("Security guards performing patrols fall under which category?", "Operational", ["Technical", "Managerial", "Cryptographic"], "Operational controls are implemented by people following procedures. Physical items like fences are physical controls, but a patrol is a human process.")
    ]),

    L("crypto-pki", "Cryptography and PKI essentials", "Which tool gives which guarantee, and how certificates build trust.", 10, ["crypto", "pki"], [
      { t: "p", html: "Match the tool to the guarantee. <strong>Symmetric</strong> encryption is fast and uses one shared key. <strong>Asymmetric</strong> encryption uses a key pair and solves key exchange and signatures. <strong>Hashing</strong> creates a fixed-size fingerprint for integrity. <strong>Digital signatures</strong> combine hashing with a private key." },
      { t: "table", headers: ["Goal", "Use", "Key used"], rows: [
        ["Encrypt bulk data", "Symmetric cipher (for example AES-GCM)", "Shared secret key"],
        ["Send a secret to someone", "Encrypt with recipient's public key (often to wrap a symmetric key)", "Recipient's public key"],
        ["Prove you signed it", "Sign the hash with your private key", "Signer's private key; verify with public key"],
        ["Detect tampering", "Hash (SHA-256 family) or HMAC", "None, or a shared key for HMAC"],
        ["Store passwords", "Salted, slow password hashing (key stretching)", "Per-user salt"]
      ] },
      { t: "ul", items: ["A certificate binds a public key to an identity and is signed by a certificate authority.", "Trust chains run from a leaf certificate through intermediates to a trusted root.", "Revocation is checked via CRLs or OCSP; stapling lets the server provide fresh OCSP status.", "Avoid deprecated algorithms (for example MD5, SHA-1, DES) in new designs."] },
      { t: "note", variant: "trap", html: "Signing uses the <em>sender's private</em> key; encrypting for confidentiality uses the <em>recipient's public</em> key. Swapping them is the most common crypto question error." },
      { t: "note", variant: "key", html: "Symmetric for speed, asymmetric for key exchange and signatures, hashes for integrity, salts and stretching for passwords, CAs and chains for trust." }
    ], [
      Q("Alice wants to send Bob a message only Bob can read. Which key encrypts it (or the symmetric key protecting it)?", "Bob's public key", ["Alice's private key", "Bob's private key", "Alice's public key"], "Anything encrypted with Bob's public key can only be decrypted with Bob's private key, which only he holds."),
      Q("Which key creates a digital signature?", "The signer's private key", ["The signer's public key", "The recipient's public key", "A shared symmetric key"], "Signatures are created with the private key and verified by anyone with the matching public key."),
      Q("Why add a unique salt before hashing each stored password?", "So identical passwords produce different hashes and precomputed tables are ineffective", ["To make the hash reversible", "To encrypt the password with AES", "To shorten the hash"], "Salts defeat rainbow tables and hide reused passwords. Slow hashing (key stretching) further raises the cost of guessing."),
      Q("A browser must check whether a server's certificate has been revoked, quickly and with privacy. Which mechanism helps most?", "OCSP stapling", ["A longer certificate validity period", "Self-signed certificates", "Disabling the intermediate certificate"], "With stapling, the server supplies a recent signed OCSP response, so clients get revocation status without querying the CA themselves."),
      Q("Which approach is best for encrypting a large database backup efficiently?", "A symmetric cipher such as AES with a properly protected key", ["RSA encryption of every block", "Hashing the backup with SHA-256", "Base64 encoding"], "Symmetric encryption is designed for bulk data. Hashing is one-way and encoding provides no secrecy."),
      Q("What does a certificate authority's signature on a certificate assert?", "That the CA vouches the public key belongs to the named subject", ["That the server has no vulnerabilities", "That the private key is stored in the certificate", "That the connection uses no encryption"], "Certificates bind identity to a public key. The private key is never included.")
    ]),

    L("change-mgmt", "Change management and secure baselines", "Why approved, tested, reversible change is a security control.", 8, ["change", "baselines"], [
      { t: "p", html: "Many incidents begin with an unplanned change. A change process makes changes <strong>approved, tested, scheduled and reversible</strong>, and keeps documentation current." },
      { t: "ol", items: ["Request with business reason and scope.", "Impact analysis: affected systems, dependencies, downtime, security implications.", "Approval by owners or a change board.", "Test in a non-production environment.", "Schedule in a maintenance window with stakeholders informed.", "Implement with a <strong>backout plan</strong> ready.", "Verify, then update documentation, diagrams and baselines."] },
      { t: "table", headers: ["Concept", "Why it matters"], rows: [
        ["Secure baseline", "Known-good configuration to deploy and to compare against"],
        ["Allow list / deny list", "Controls what software or connections are permitted"],
        ["Version control", "Track and roll back configuration and code"],
        ["Dependencies and legacy apps", "Restarts and changes may break things that are not obvious"]
      ] },
      { t: "note", variant: "trap", html: "An emergency change still needs documentation and a retrospective review; urgency changes the order, not the accountability." },
      { t: "note", variant: "key", html: "Approve, test, schedule, implement with a backout plan, verify and document. Baselines define known-good and expose drift." }
    ], [
      Q("Before deploying a firewall upgrade, the team prepares steps to restore the previous version if problems appear. What is this called?", "A backout plan", ["A tabletop exercise", "A risk register", "A service-level agreement"], "A backout (rollback) plan defines how to return to the previous state if a change fails."),
      Q("Which step identifies the systems and users a proposed change could affect?", "Impact analysis", ["Lessons learned", "Eradication", "Penetration testing"], "Impact analysis examines dependencies, downtime and security effects before approval."),
      Q("Configuration scanning shows servers drifting from the approved settings. What should they be compared against?", "The secure baseline", ["The incident report", "The vendor's marketing sheet", "The previous day's firewall logs only"], "A baseline is the documented known-good configuration used for builds and drift detection."),
      Q("Why schedule significant changes in a maintenance window?", "To minimize business impact and ensure stakeholders are prepared", ["To avoid needing approval", "To skip testing", "To hide changes from auditors"], "Agreed windows reduce disruption and ensure the right people are available."),
      Q("An urgent patch is applied outside the normal process to stop active exploitation. What should happen afterward?", "Document it and review it through the change process retrospectively", ["Nothing; emergencies are exempt", "Revert it immediately", "Delete the logs"], "Emergency changes are allowed but must still be recorded and reviewed so the change record stays accurate."),
      Q("Which control limits execution to approved software only?", "Application allow listing", ["Application deny listing of known malware only", "Open file shares", "Disabling logging"], "An allow list permits only approved applications, which is stronger than blocking known bad ones.")
    ])
  ];

  var threats = [
    L("threat-actors", "Threat actors, motivations and vectors", "Who attacks, why, and which doors they usually try.", 9, ["threats"], [
      { t: "p", html: "Defenders prioritize better when they know who is likely to target them. Actors differ in <strong>resources</strong>, <strong>sophistication</strong>, and <strong>motivation</strong>." },
      { t: "table", headers: ["Actor", "Typical motivation", "Defensive emphasis"], rows: [
        ["Nation-state", "Espionage, disruption", "Detection depth, segmentation, supply-chain scrutiny"],
        ["Organized crime", "Financial gain (ransom, fraud)", "Backups, MFA, phishing resistance, EDR"],
        ["Hacktivist", "Ideology, publicity", "DDoS protection, web hardening, monitoring"],
        ["Insider", "Grievance, money, mistakes", "Least privilege, monitoring, offboarding"],
        ["Unskilled attacker", "Curiosity, notoriety", "Patching and basic hygiene stop most attempts"],
        ["Shadow IT (unsanctioned tech)", "Convenience, not malice", "Discovery, policy, approved alternatives"]
      ] },
      { t: "ul", items: ["Common vectors: email and messaging, removable media, vulnerable software, unsupported systems, open ports, default credentials, supply chain and third parties.", "Human vectors include phishing, voice and SMS phishing, impersonation and pretexting.", "Reducing attack surface (closing ports, removing unused software) removes vectors entirely."] },
      { t: "note", variant: "tip", html: "In scenario questions, the motivation clue (money, ideology, revenge, espionage) usually identifies the actor faster than technical details do." },
      { t: "note", variant: "key", html: "Know the actor's motivation and resources, then shrink the vectors they rely on: people, email, exposed services, and suppliers." }
    ], [
      Q("A group encrypts a hospital's files and demands payment. Which actor type is most likely?", "Organized crime", ["Hacktivist", "Shadow IT", "Nation-state focused on espionage"], "Financial extortion is the hallmark of criminal groups. Hacktivists seek publicity for a cause; espionage aims for quiet access."),
      Q("A department installs an unapproved cloud file-sharing app to work faster. What is this called?", "Shadow IT", ["An advanced persistent threat", "A watering-hole attack", "Privilege escalation"], "Shadow IT is technology used without approval, usually for convenience. The defense is discovery and providing approved options."),
      Q("A recently dismissed administrator still has VPN access weeks later. Which control failure enabled this insider risk?", "Incomplete offboarding and access revocation", ["Weak Wi-Fi encryption", "Missing DDoS protection", "Lack of code signing"], "Prompt deprovisioning at departure removes access that could be misused."),
      Q("Which actor typically has the most resources and patience for long-term covert access?", "Nation-state", ["Unskilled attacker", "Hacktivist with a one-day campaign", "Shadow IT user"], "State-sponsored groups can fund sustained, sophisticated operations aimed at espionage or disruption."),
      Q("What is the most effective way to remove an attack vector such as an unused service on a server?", "Disable or uninstall the service", ["Write a policy asking attackers not to use it", "Increase log retention only", "Rename the server"], "Removing unnecessary services reduces attack surface so the vector no longer exists."),
      Q("A website is defaced with political slogans. Which actor type does this most suggest?", "Hacktivist", ["Organized crime", "Insider making a mistake", "Shadow IT"], "Public messaging tied to a cause points to ideological motivation.")
    ]),

    L("indicators", "Recognizing attack indicators", "Spot the signs of common attack types and map each to a defense.", 10, ["indicators", "detection"], [
      { t: "p", html: "This lesson is about <strong>recognition</strong>: what you would see in logs or user reports, and which control addresses it. No attack procedure is needed to defend well." },
      { t: "table", headers: ["What you observe", "Likely category", "Primary defenses"], rows: [
        ["One password tried against many accounts, few attempts each", "Password spraying", "MFA, banned-password lists, smart lockout, sign-in risk alerts"],
        ["Many attempts against one account", "Brute force", "Lockout or throttling, MFA"],
        ["Files suddenly renamed and unreadable, ransom note", "Ransomware", "Offline backups, EDR, least privilege, segmentation"],
        ["Unusual database errors from form input", "Injection attempts", "Parameterized queries, input validation, WAF"],
        ["Scripts appearing in page output from user content", "Cross-site scripting attempts", "Output encoding, content security policy"],
        ["Outbound traffic to rare domains at regular intervals", "Command-and-control beaconing", "Egress filtering, DNS monitoring, EDR"],
        ["Login from two distant countries within minutes", "Credential compromise", "Impossible-travel alerts, MFA, session revocation"]
      ] },
      { t: "ul", items: ["Malware families to recognize: ransomware, trojan, worm (self-spreading), spyware and keyloggers, rootkits (hiding), logic bombs (trigger-based).", "Physical and human signs: tailgating, unknown USB devices found on site, urgent requests to bypass process.", "Indicators of compromise include unexpected accounts, disabled security tools, and new scheduled tasks."] },
      { t: "note", variant: "trap", html: "Account lockouts across <em>many</em> users at once suggest spraying or a misconfigured service, not one user forgetting a password." },
      { t: "note", variant: "key", html: "Read the indicator, name the category, choose the control: MFA for credential attacks, backups for ransomware, parameterized queries for injection, encoding for XSS." }
    ], [
      Q("Logs show a single common password attempted once against hundreds of accounts. What is the most likely activity?", "Password spraying", ["Brute force against one account", "Pass-the-hash", "Shoulder surfing"], "Spraying tries a few common passwords across many accounts to avoid per-account lockout. MFA and banned-password lists defend against it."),
      Q("Web logs show form submissions containing SQL fragments and the database returns errors. Which fix addresses the root cause?", "Use parameterized queries in the application", ["Increase server RAM", "Shorten session timeouts", "Rename the database"], "Parameterized queries keep input as data rather than executable SQL. A WAF can help but does not fix the code."),
      Q("Files across a file share become unreadable and a note demands payment. Which control most improves recovery?", "Tested offline or immutable backups", ["A longer password policy", "A public bug bounty", "Removing the firewall"], "Backups attackers cannot alter let you restore without paying."),
      Q("Which malware type spreads by itself across a network without user action?", "Worm", ["Trojan", "Logic bomb", "Keylogger"], "Worms self-propagate, often through vulnerable services. Trojans rely on users running them."),
      Q("A host contacts an unfamiliar domain every 60 seconds with small requests. What should an analyst suspect?", "Command-and-control beaconing", ["Normal software updates every minute", "A DNS cache warming", "A user typing slowly"], "Regular, small outbound connections to rare destinations are a classic beaconing pattern; investigate and contain the host."),
      Q("User content displays as executable script in other users' browsers. Which defense is most directly relevant?", "Context-aware output encoding", ["Full-disk encryption", "Port security", "RAID 5"], "Encoding output for the HTML context prevents user-supplied content from being interpreted as script.")
    ]),

    L("mitigations", "Mitigation techniques", "Hardening, segmentation, patching and least privilege as everyday defense.", 9, ["hardening", "mitigation"], [
      { t: "p", html: "Most breaches exploit something preventable: an unpatched system, an over-privileged account, a flat network, a default password. Mitigation is a set of habits applied consistently." },
      { t: "table", headers: ["Technique", "What it does"], rows: [
        ["Patching", "Removes known vulnerabilities; prioritize exposed and critical systems"],
        ["Hardening", "Removes unnecessary services, defaults and features"],
        ["Least privilege", "Gives accounts only what they need, for as long as needed"],
        ["Segmentation", "Limits lateral movement between zones"],
        ["Encryption", "Protects data if storage or traffic is exposed"],
        ["Monitoring and EDR", "Detects and responds on endpoints"],
        ["Isolation", "Quarantines suspicious or unpatchable systems"],
        ["Decommissioning", "Removes systems that are no longer needed"]
      ] },
      { t: "ul", items: ["Change default credentials before connecting a device.", "Host-based firewalls add a layer even inside a trusted zone.", "Configuration enforcement tools keep systems at their baseline.", "Disable unused ports and protocols on network devices."] },
      { t: "note", variant: "tip", html: "When asked for the <em>first</em> or <em>best</em> mitigation, prefer the one that removes the root cause (patch, remove, restrict) over one that only detects." },
      { t: "note", variant: "key", html: "Patch, harden, restrict privileges, segment, encrypt, monitor, and remove what you do not need." }
    ], [
      Q("New IoT cameras still use the manufacturer's default admin password. What should be done first?", "Change the default credentials before deployment", ["Place them on the guest Wi-Fi with defaults", "Add a warning sticker", "Enable verbose logging only"], "Default credentials are widely known. Changing them removes an easy entry point."),
      Q("An attacker who compromises one workstation can reach every server. Which mitigation limits this lateral movement?", "Network segmentation", ["Longer screen-lock timeout", "A new logo on the login page", "Bigger hard drives"], "Segmentation restricts which systems can talk to each other, containing the spread."),
      Q("A help-desk account has domain admin rights it rarely needs. What principle should be applied?", "Least privilege", ["Separation of environments", "Defense through obscurity", "Implicit trust"], "Remove standing high privilege and grant elevated access only when required."),
      Q("A server no longer supports any business function but remains online and unpatched. What is the best action?", "Decommission it securely", ["Leave it running for convenience", "Rename it", "Move it to a faster rack"], "Unused systems add risk without value. Decommissioning removes the exposure."),
      Q("Which is a hardening step for a new server build?", "Disable unnecessary services and remove unused software", ["Enable every optional feature", "Use a shared administrator password", "Turn off the host firewall"], "Hardening reduces attack surface by removing what is not needed."),
      Q("A critical vulnerability affects an internet-facing server. What should usually be prioritized?", "Patching that server promptly, with compensating controls until patched", ["Patching internal test machines first", "Waiting for the next annual maintenance", "Disabling all logging"], "Exposure and severity drive priority. If an immediate patch is impossible, add compensating controls.")
    ])
  ];

  var archi = [
    L("network-design", "Secure network design", "Zones, screened subnets, firewalls, VPNs and access control.", 10, ["network", "architecture"], [
      { t: "p", html: "Group systems by trust and function, then control traffic between groups. Internet-facing services live in a <strong>screened subnet</strong>; internal data lives deeper; management access goes through a dedicated, tightly monitored path." },
      { t: "widget", id: "suZonePlacer" },
      { t: "table", headers: ["Device or approach", "Strength"], rows: [
        ["Stateful firewall", "Tracks connections; allows replies automatically"],
        ["Next-generation firewall", "Application awareness and user identity in rules"],
        ["Web application firewall", "Filters HTTP for application-layer attack patterns"],
        ["IDS", "Detects and alerts; out of band"],
        ["IPS", "Inline; can block traffic it judges malicious"],
        ["NAC", "Checks device identity and posture before network access"],
        ["VPN / ZTNA", "Encrypted remote access; zero trust access is per application"]
      ] },
      { t: "note", variant: "trap", html: "An IDS cannot block by itself because it is not inline. If a question needs automatic blocking, the answer is an IPS (or inline enforcement)." },
      { t: "note", variant: "tip", html: "Fail-open versus fail-closed: a security device that fails closed blocks traffic when it breaks, favouring confidentiality over availability." },
      { t: "note", variant: "key", html: "Zone by trust, screen public services, gate management access, use IPS for inline blocking and NAC for device admission." }
    ], [
      Q("A public web server must be reachable from the internet without exposing the internal network. Where should it be placed?", "In a screened subnet (DMZ)", ["On the internal user VLAN", "On the same subnet as the database", "On the management network"], "A screened subnet isolates internet-facing systems so a compromise does not give direct internal access."),
      Q("Which device can automatically block detected malicious traffic because it sits inline?", "Intrusion prevention system", ["Intrusion detection system on a mirror port", "Syslog server", "Network tap"], "IPS devices are in the traffic path and can drop packets; an IDS observes copies and alerts."),
      Q("Laptops must meet patch and antivirus requirements before joining the corporate network. What enforces this?", "Network access control (NAC)", ["A web application firewall", "DNS sinkholing", "A load balancer"], "NAC checks device posture and identity at connection time and can quarantine non-compliant devices."),
      Q("A security appliance fails. The design requires that no traffic pass uninspected. How should it fail?", "Fail closed", ["Fail open", "Fail over to an unmonitored bypass", "Fail silently with no alert"], "Fail-closed blocks traffic when the control fails, prioritizing security over availability."),
      Q("Which control specifically inspects HTTP requests for application-layer attack patterns such as injection attempts?", "Web application firewall", ["Port-based ACL on a switch", "Spanning tree", "A KVM switch"], "WAFs understand HTTP and can filter malicious request patterns before they reach the application."),
      Q("Remote employees need access to a few internal apps without being placed on the whole internal network. Which approach fits zero trust principles best?", "Zero trust network access granting per-application access", ["A flat VPN to the entire network", "Port forwarding through the edge router", "Shared credentials on a jump box"], "ZTNA brokers access to specific applications based on identity and posture rather than network location.")
    ]),

    L("resilience", "Resilience, backups and the cloud", "Shared responsibility, redundancy, backup strategy and recovery sites.", 9, ["resilience", "cloud", "backup"], [
      { t: "p", html: "Resilience means the business keeps working through failure. In the cloud, the <strong>shared responsibility model</strong> splits duties: the provider secures the underlying infrastructure; the customer secures data, identities and configuration, with the line moving by service type." },
      { t: "table", headers: ["Service model", "Customer still owns"], rows: [
        ["IaaS", "OS patching, apps, data, identities, network config"],
        ["PaaS", "Apps, data, identities, platform configuration"],
        ["SaaS", "Data, identities and access, tenant settings"]
      ] },
      { t: "table", headers: ["Recovery site", "Readiness", "Cost"], rows: [
        ["Hot", "Running, near-current data; fastest switch", "Highest"],
        ["Warm", "Hardware and connectivity ready; data needs loading", "Medium"],
        ["Cold", "Space and power only", "Lowest"]
      ] },
      { t: "ul", items: ["Backup rule of thumb: several copies, on different media, with at least one offsite or offline (immutable).", "Test restores; a backup you have never restored is unproven.", "RTO is how long you can be down; RPO is how much data you can lose; MTTR and MTBF describe repair and failure intervals.", "High availability uses redundancy and load balancing; clustering keeps services up through node failure."] },
      { t: "note", variant: "trap", html: "Moving to SaaS does not move responsibility for who has access to your data. Identity and data governance always stay with the customer." },
      { t: "note", variant: "key", html: "Know your side of shared responsibility, keep offline and offsite backups, test restores, and pick the recovery site that meets RTO and RPO." }
    ], [
      Q("In a SaaS email service, which responsibility remains with the customer?", "Managing user accounts, access and data", ["Patching the provider's servers", "Physical security of data centers", "Maintaining the hypervisor"], "Even in SaaS, customers control who can access their data and how it is configured."),
      Q("Which recovery site has hardware and connectivity ready but requires data restoration before use?", "Warm site", ["Hot site", "Cold site", "Mobile site with no equipment"], "Warm sites sit between hot and cold: infrastructure exists, but current data must be restored."),
      Q("A ransomware event encrypted online backups too. Which practice would have prevented that loss?", "Keeping at least one offline or immutable backup copy", ["Increasing backup frequency on the same share", "Compressing backups", "Storing backups on the same server"], "Copies that attackers cannot reach or modify survive an attack on production and online storage."),
      Q("What does MTTR measure?", "The average time to repair a failed component and restore service", ["The average time between failures", "The maximum tolerable data loss", "The time to approve a change"], "Mean time to repair describes recovery speed; mean time between failures describes reliability."),
      Q("In IaaS, who is responsible for patching the guest operating system?", "The customer", ["The cloud provider", "The hardware vendor", "No one; it patches itself"], "IaaS customers manage everything from the OS upward."),
      Q("Why test restores regularly?", "To prove backups are complete and recovery meets time objectives", ["To reduce storage costs", "To satisfy only marketing needs", "To disable old backups automatically"], "Restore tests reveal corruption, missing data and unrealistic recovery times before an emergency.")
    ]),

    L("data-protection", "Protecting data", "Data states, classification, DLP and techniques to reduce exposure.", 9, ["data", "dlp"], [
      { t: "p", html: "Protect data according to <strong>how sensitive it is</strong> and <strong>where it is</strong>. Classification drives handling rules; data state drives the technical control." },
      { t: "table", headers: ["Data state", "Typical protection"], rows: [
        ["At rest", "Full-disk, database or file encryption; access control"],
        ["In transit", "TLS, VPN, secure protocols"],
        ["In use", "Access control, secure enclaves, memory protections, screen privacy"]
      ] },
      { t: "table", headers: ["Technique", "Effect"], rows: [
        ["Masking", "Hides part of a value (for example last four digits shown)"],
        ["Tokenization", "Replaces a value with a token; real value held in a secure vault"],
        ["Hashing", "One-way transform for comparison without storing the original"],
        ["Encryption", "Reversible with the key"],
        ["Data minimization", "Do not collect or keep what you do not need"],
        ["DLP", "Detect and block sensitive data leaving approved channels"]
      ] },
      { t: "ul", items: ["Classification examples: public, internal, confidential, restricted (labels vary by organization).", "Data sovereignty: laws of the location where data is stored may apply.", "Roles: owner (accountable), custodian (operates controls), controller and processor (privacy roles)."] },
      { t: "note", variant: "tip", html: "Tokenization suits payment data because systems handle tokens while the real numbers stay in a hardened vault, shrinking compliance scope." },
      { t: "note", variant: "key", html: "Classify first, protect by state, minimize what you keep, and use masking, tokenization and DLP to limit exposure." }
    ], [
      Q("A payment system wants applications to store a stand-in value instead of real card numbers, with the real numbers in a secured vault. Which technique is this?", "Tokenization", ["Hashing with no vault", "Steganography", "Compression"], "Tokenization replaces sensitive values with tokens mapped in a protected vault, reducing exposure in other systems."),
      Q("Customer service screens should show only the last four digits of an ID number. Which technique fits?", "Data masking", ["Full-disk encryption", "Key escrow", "Load balancing"], "Masking hides portions of data for display while keeping it usable for the task."),
      Q("Which control helps prevent employees from emailing files labeled confidential to personal accounts?", "Data loss prevention (DLP)", ["A screened subnet", "RAID 1", "NTP synchronization"], "DLP inspects content and context and can block or alert when sensitive data leaves approved channels."),
      Q("Which protection applies to data in transit?", "TLS", ["Full-disk encryption", "File permissions only", "Shredding"], "Encryption in transit protects data moving across networks; disk encryption protects data at rest."),
      Q("Who is accountable for deciding how a dataset is classified and who may access it?", "The data owner", ["The data custodian", "The end user", "The backup operator"], "Owners are accountable for classification and access decisions; custodians implement the controls."),
      Q("A company stores customer birthdates it never uses. Which principle suggests removing them?", "Data minimization", ["Defense in depth", "Fail open", "Separation of duties"], "Collecting and keeping only necessary data reduces breach impact and compliance burden.")
    ])
  ];

  var ops = [
    L("iam-ops", "Identity and access management in operations", "MFA, SSO, provisioning, privileged access and account hygiene.", 9, ["iam", "mfa"], [
      { t: "p", html: "Identity is the new perimeter. Strong authentication, timely provisioning and deprovisioning, and tight control of privileged accounts prevent a large share of incidents." },
      { t: "table", headers: ["Factor", "Examples"], rows: [
        ["Something you know", "Password, PIN"],
        ["Something you have", "Hardware security key, authenticator app, smart card"],
        ["Something you are", "Fingerprint, face"],
        ["Somewhere you are", "Location or network context (supporting signal)"]
      ] },
      { t: "ul", items: ["MFA requires factors from different categories; two passwords are still one factor.", "Phishing-resistant MFA (hardware keys, platform authenticators with public-key cryptography) resists credential relay.", "SSO and federation (SAML, OpenID Connect) centralize authentication; OAuth is about delegated authorization.", "Privileged access management: vaulted credentials, just-in-time elevation, session recording.", "Access reviews (attestation) remove permissions people no longer need."] },
      { t: "note", variant: "trap", html: "A password plus a security question is not MFA. Both are something you know." },
      { t: "note", variant: "key", html: "MFA across different factor types (prefer phishing-resistant), SSO for consistency, just-in-time privilege, and regular access reviews." }
    ], [
      Q("Which combination is true multifactor authentication?", "A password and a hardware security key", ["A password and a PIN", "Two different passwords", "A password and a security question"], "MFA needs different categories. A password and a key combine something you know with something you have."),
      Q("Administrators should receive elevated rights only for approved tasks and only for a limited time. What is this called?", "Just-in-time privileged access", ["Permanent standing privilege", "Implicit deny", "Account sharing"], "JIT elevation reduces the window during which privileged credentials can be misused."),
      Q("Which protocol is primarily used for delegated authorization, letting an app act on a user's behalf without the user's password?", "OAuth", ["SAML for encryption at rest", "SNMP", "RADIUS accounting only"], "OAuth grants scoped access tokens for delegated authorization. Authentication is commonly layered on top with OpenID Connect."),
      Q("Managers periodically confirm whether their team members still need each permission. What is this process?", "Access review (attestation)", ["Penetration testing", "Fuzzing", "Data masking"], "Regular reviews catch permission creep and stale access."),
      Q("Which MFA method best resists phishing sites that relay codes in real time?", "Hardware security keys using public-key challenge-response", ["SMS one-time codes", "Email codes", "Knowledge-based questions"], "Origin-bound public-key authentication fails on look-alike sites, unlike codes a user can be tricked into typing."),
      Q("Employees use one corporate login to access many SaaS apps. What enables this?", "Single sign-on with federation", ["Local accounts in each app", "Shared passwords stored in a spreadsheet", "Disabling authentication"], "SSO via federation lets a trusted identity provider authenticate users for multiple services.")
    ]),

    L("monitoring-vuln", "Monitoring and vulnerability management", "SIEM, log sources, alert tuning, scanning and prioritization.", 10, ["siem", "vulnerability"], [
      { t: "p", html: "Detection needs good data and good tuning. A <strong>SIEM</strong> collects and correlates logs; analysts and automation turn alerts into action. Vulnerability management finds weaknesses and fixes the most dangerous first." },
      { t: "table", headers: ["Log source", "Answers"], rows: [
        ["Authentication logs", "Who logged in, from where, failures"],
        ["Firewall and network flow", "Who talked to whom, how much"],
        ["Endpoint / EDR", "Processes, file changes, suspicious behaviour"],
        ["DNS logs", "Lookups to suspicious or newly seen domains"],
        ["Application logs", "Errors, transactions, abuse patterns"]
      ] },
      { t: "ol", items: ["Identify assets and scan regularly (credentialed scans see more).", "Validate findings; remove false positives.", "Prioritize by severity, exploitability, exposure and asset criticality.", "Remediate (patch, configure) or apply compensating controls; document exceptions.", "Rescan to verify, and report trends."] },
      { t: "ul", items: ["False positive: alert without a real issue. False negative: real issue without an alert (more dangerous).", "Tune noisy rules; alert fatigue causes real alerts to be missed.", "Time synchronization across systems makes correlation possible.", "SOAR playbooks automate repeatable response steps."] },
      { t: "note", variant: "tip", html: "Severity scores are a starting point. An internet-facing system with a known exploited vulnerability outranks a higher-scored issue on an isolated lab machine." },
      { t: "note", variant: "key", html: "Collect the right logs, sync time, tune alerts; scan, validate, prioritize by real risk, remediate, rescan." }
    ], [
      Q("A scan reports a vulnerability, but investigation shows the affected software is not installed. What is this?", "A false positive", ["A false negative", "A true positive", "A zero-day"], "The scanner flagged an issue that does not exist, which is a false positive."),
      Q("Analysts ignore a SIEM rule that fires hundreds of times a day without real incidents. What is the best response?", "Tune or refine the rule to reduce noise", ["Delete all SIEM rules", "Turn off logging", "Hire more analysts and keep the rule unchanged"], "Tuning reduces alert fatigue so real detections get attention."),
      Q("Which scan type typically finds more accurate results about installed software and missing patches?", "Credentialed scan", ["Unauthenticated external scan only", "Ping sweep", "Passive DNS lookup"], "Credentialed scans log into systems and can inspect configuration and patch levels directly."),
      Q("Two vulnerabilities have similar severity. One is on an internet-facing server with known active exploitation. How should it be prioritized?", "Higher, because exposure and exploitation increase real risk", ["Lower, because internet servers are patched automatically", "Equal, because scores match", "Ignore both until the next audit"], "Context such as exposure and known exploitation matters beyond the base score."),
      Q("Why is consistent time synchronization important for monitoring?", "Correlating events across systems depends on accurate timestamps", ["It speeds up disk writes", "It encrypts logs automatically", "It reduces license costs"], "Without synchronized clocks, sequences of events across devices cannot be reconstructed reliably."),
      Q("Which tool automates repeatable response steps such as isolating a host after a confirmed alert?", "SOAR", ["DHCP", "RAID", "A KVM"], "Security orchestration, automation and response platforms run playbooks to act consistently and quickly.")
    ]),

    L("incident-response", "Incident response and digital forensics", "Lifecycle, containment choices, evidence handling and order of volatility.", 10, ["incident-response", "forensics"], [
      { t: "p", html: "A response plan turns panic into procedure. One common lifecycle: <strong>preparation, detection, analysis, containment, eradication, recovery, lessons learned</strong>. Forensics runs alongside so evidence stays usable." },
      { t: "widget", id: "suIrStepper" },
      { t: "table", headers: ["Order of volatility (collect first to last)", "Why"], rows: [
        ["CPU registers and cache", "Lost almost instantly"],
        ["Memory (RAM), running processes, network connections", "Lost on shutdown"],
        ["Temporary files and swap", "Overwritten quickly"],
        ["Disk", "Persists but can be altered"],
        ["Remote logs and monitoring data", "May roll over by retention"],
        ["Archival media and backups", "Most stable"]
      ] },
      { t: "ul", items: ["Chain of custody records who handled evidence, when and why.", "Legal hold preserves relevant data when litigation is possible.", "Take hashes of acquired images to prove integrity.", "Tabletop exercises test the plan cheaply; simulations test it more realistically."] },
      { t: "note", variant: "trap", html: "Powering off a compromised machine first destroys memory evidence. Isolate it from the network instead, unless safety requires otherwise." },
      { t: "note", variant: "key", html: "Follow the lifecycle, contain before eradicating, collect evidence from most to least volatile, and keep a documented chain of custody." }
    ], [
      Q("A workstation shows signs of active compromise. What is usually the best immediate containment step that preserves evidence?", "Disconnect it from the network while leaving it powered on", ["Power it off immediately", "Reimage it right away", "Ignore it until the weekend"], "Network isolation stops spread while keeping volatile memory available for analysis."),
      Q("Which should be collected first according to the order of volatility?", "Contents of RAM", ["Backup tapes", "Disk image", "Printed reports"], "Memory is lost on shutdown, so it is collected before more persistent sources."),
      Q("Which document tracks every person who handled a piece of evidence?", "Chain of custody", ["Service-level agreement", "Acceptable use policy", "Risk register"], "Chain of custody shows evidence was controlled and unaltered, supporting its use in investigations."),
      Q("In which phase are malware and attacker persistence removed from affected systems?", "Eradication", ["Preparation", "Detection", "Lessons learned"], "Eradication removes the cause after containment limits spread."),
      Q("A team walks through a simulated breach scenario in a conference room without touching systems. What is this?", "A tabletop exercise", ["A full-scale failover", "A penetration test", "A vulnerability scan"], "Tabletops test plans and decision-making through discussion."),
      Q("Why hash a forensic disk image after acquisition?", "To prove later that the image has not changed", ["To encrypt it for transport", "To compress it", "To remove malware"], "Matching hashes demonstrate integrity from acquisition through analysis.")
    ])
  ];

  var program = [
    L("risk", "Risk management", "Identify, assess, treat and track risk with simple math and clear owners.", 10, ["risk"], [
      { t: "p", html: "Risk is the combination of <strong>likelihood</strong> and <strong>impact</strong>. You identify risks, analyze them qualitatively (high/medium/low) or quantitatively (money), choose a treatment, and record it in a register with an owner." },
      { t: "widget", id: "suRiskCalc" },
      { t: "table", headers: ["Treatment", "Meaning", "Example"], rows: [
        ["Mitigate (reduce)", "Apply controls to lower likelihood or impact", "Add MFA"],
        ["Transfer (share)", "Shift financial impact to another party", "Cyber insurance, contracts"],
        ["Avoid", "Stop the risky activity", "Retire an unsafe service"],
        ["Accept", "Acknowledge and monitor within appetite", "Low-impact risk with costly fix"]
      ] },
      { t: "ul", items: ["SLE (single loss expectancy) = asset value x exposure factor.", "ALE (annualized loss expectancy) = SLE x ARO (annual rate of occurrence).", "Risk appetite: how much risk the organization is willing to take; tolerance: acceptable variation.", "Residual risk remains after controls; inherent risk is before controls.", "Business impact analysis identifies critical functions, RTO and RPO."] },
      { t: "note", variant: "trap", html: "Insurance transfers financial impact, not accountability. The organization still owns the risk and its reputation consequences." },
      { t: "note", variant: "key", html: "Likelihood times impact; SLE = AV x EF, ALE = SLE x ARO; treat by mitigating, transferring, avoiding or accepting, and record owners in a register." }
    ], [
      Q("A server worth $100,000 would lose 40 percent of its value in a fire. What is the SLE?", "$40,000", ["$100,000", "$4,000", "$140,000"], "SLE is asset value times exposure factor: 100,000 x 0.4 = 40,000."),
      Q("Using an SLE of $40,000 and an ARO of 0.25, what is the ALE?", "$10,000", ["$160,000", "$40,000", "$1,000"], "ALE is SLE times ARO: 40,000 x 0.25 = 10,000 per year."),
      Q("A company buys cyber insurance to cover breach costs. Which risk treatment is this?", "Transfer", ["Avoid", "Accept", "Mitigate"], "Insurance shifts financial impact to another party while the organization keeps responsibility."),
      Q("An organization stops offering a legacy service because securing it is not feasible. Which treatment is this?", "Avoid", ["Transfer", "Accept", "Exploit"], "Avoidance eliminates the risk by ending the activity that creates it."),
      Q("What remains after controls have been applied to a risk?", "Residual risk", ["Inherent risk", "Risk appetite", "Exposure factor"], "Residual risk is what is left after treatment; inherent risk is before controls."),
      Q("Which document records identified risks, their ratings, owners and treatment status?", "Risk register", ["Chain of custody form", "Network diagram", "Acceptable use policy"], "A risk register tracks risks over time so they are owned and reviewed.")
    ]),

    L("governance", "Governance, compliance and third parties", "Policies, standards, agreements, audits and awareness.", 9, ["governance", "compliance"], [
      { t: "p", html: "Governance sets direction and accountability. <strong>Policies</strong> state intent, <strong>standards</strong> make it measurable, <strong>procedures</strong> give step-by-step instructions, and <strong>guidelines</strong> offer recommended practice." },
      { t: "table", headers: ["Agreement", "Purpose"], rows: [
        ["SLA", "Measurable service levels and remedies"],
        ["MOU / MOA", "Shared intentions between parties, often less binding"],
        ["MSA", "Master terms for future work"],
        ["SOW / work order", "Specific deliverables under the master terms"],
        ["NDA", "Confidentiality obligations"],
        ["BPA", "Business partnership terms, responsibilities and profit sharing"]
      ] },
      { t: "ul", items: ["Third-party risk: due diligence before signing, right-to-audit clauses, ongoing monitoring, and offboarding.", "Audits can be internal or external; attestations provide independent assurance.", "Compliance failures can lead to fines, sanctions and reputational harm.", "Security awareness programs cover phishing recognition, reporting, and safe handling; measure with simulations and reporting rates."] },
      { t: "note", variant: "tip", html: "If a question asks which document contains <em>step-by-step instructions</em>, it is a procedure; <em>mandatory, measurable requirements</em> point to a standard." },
      { t: "note", variant: "key", html: "Policies set intent, standards set measurable rules, procedures give steps; manage suppliers with due diligence, contracts and monitoring; train people continuously." }
    ], [
      Q("Which document specifies that all laptops must use full-disk encryption with a particular algorithm strength?", "A standard", ["A guideline", "A memorandum of understanding", "A press release"], "Standards make policy measurable and mandatory with specific requirements."),
      Q("A contract defines 99.9 percent uptime and service credits when it is missed. Which agreement is this?", "SLA", ["NDA", "MOU", "BPA"], "Service-level agreements define measurable performance and remedies."),
      Q("Before onboarding a new payroll provider, the company reviews its security controls and audit reports. What is this?", "Vendor due diligence", ["Penetration testing of competitors", "Data masking", "Eradication"], "Due diligence assesses a supplier's risk before entering an agreement."),
      Q("Which clause lets an organization examine a supplier's security practices during the contract?", "Right-to-audit clause", ["Non-compete clause", "Force majeure clause", "Termination for convenience only"], "Right-to-audit provisions allow verification of the supplier's controls."),
      Q("Which document provides step-by-step instructions for resetting a user's MFA device?", "A procedure", ["A policy", "A standard", "A risk register"], "Procedures describe exactly how to perform a task."),
      Q("How can an organization measure the effectiveness of phishing awareness training?", "Track simulated phishing click rates and reporting rates over time", ["Count the number of slides in the training", "Ask users if they liked the font", "Disable email filtering to test users"], "Simulations and reporting metrics show whether behaviour is improving.")
    ])
  ];

  window.QUIZZES = Object.assign(window.QUIZZES || {}, QZ);

  window.SUMMIT_CARDS = (window.SUMMIT_CARDS || []).concat([
    { front: "CIA triad", back: "Confidentiality, integrity, availability.", track: TID },
    { front: "Non-repudiation", back: "Proof that an action came from a specific party; usually digital signatures.", track: TID },
    { front: "Compensating control", back: "Alternative control used when the preferred one is not feasible.", track: TID },
    { front: "Sign vs encrypt", back: "Sign with your private key; encrypt for someone with their public key.", track: TID },
    { front: "Salt", back: "Unique random value added before hashing passwords; defeats precomputed tables.", track: TID },
    { front: "Backout plan", back: "Steps to return to the previous state if a change fails.", track: TID },
    { front: "Password spraying indicator", back: "Few attempts with common passwords across many accounts.", track: TID },
    { front: "IDS vs IPS", back: "IDS detects and alerts out of band; IPS sits inline and can block.", track: TID },
    { front: "Screened subnet", back: "Zone for internet-facing services, isolated from internal networks.", track: TID },
    { front: "Hot / warm / cold site", back: "Running and current / equipped but needs data / space and power only.", track: TID },
    { front: "Tokenization", back: "Replace sensitive values with tokens; real values kept in a secure vault.", track: TID },
    { front: "Order of volatility", back: "Registers and cache, RAM, temp and swap, disk, remote logs, archives.", track: TID },
    { front: "SLE / ALE", back: "SLE = AV x EF; ALE = SLE x ARO.", track: TID },
    { front: "Risk treatments", back: "Mitigate, transfer, avoid, accept.", track: TID },
    { front: "Policy vs standard vs procedure", back: "Intent / measurable mandatory rule / step-by-step instructions.", track: TID }
  ]);

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.secplus = {
    id: "secplus",
    name: "Security+ (defensive)",
    short: "SEC+",
    tagline: "Recognize threats, choose controls, run operations",
    color: "#34d399",
    blurb: "Defensive, concept-level prep for the entry security certification: fundamentals and controls, cryptography and PKI, threat recognition and mitigation, secure architecture, resilience, operations, incident response, risk and governance. Unofficial; verify current objectives.",
    modules: [
      { id: "concepts", name: "General security concepts", icon: "compass", lessons: concepts },
      { id: "threats", name: "Threats, indicators and mitigations", icon: "shield", lessons: threats },
      { id: "archi", name: "Security architecture", icon: "map", lessons: archi },
      { id: "ops", name: "Security operations", icon: "wrench", lessons: ops },
      { id: "program", name: "Program management and oversight", icon: "diamond", lessons: program }
    ]
  };
})();
