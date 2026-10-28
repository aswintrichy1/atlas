/* =====================================================================
   CITADEL · Quiz bank
   window.QUIZZES[id] = { title, sub, questions: [{ q, options, answer, explain }] }
   `answer` is the 0-based index of the correct option. Verified by hand.

   Merge, never reassign: quizzes-ext.js and quizzes-rev.js contribute to the
   same namespace, so a plain assignment here drops their entries whenever this
   file is evaluated after them.
   ===================================================================== */
window.QUIZZES = Object.assign(window.QUIZZES || {}, {
  /* ---------------- CORE ---------------- */
  "core-foundations": {
    title: "Core principles checkpoint",
    sub: "The CIA triad, risk, and secure-by-default design.",
    questions: [
      {
        q: "Encryption of stored data primarily protects which property of the CIA triad?",
        options: ["Integrity", "Confidentiality", "Availability", "Non-repudiation"],
        answer: 1,
        explain: "Encryption keeps data unreadable to unauthorized parties — that is confidentiality. Integrity is protected by hashes/signatures, and availability by redundancy and backups."
      },
      {
        q: "Which expression best captures how risk is estimated?",
        options: ["Threat + Vulnerability", "The CVSS score on its own", "Likelihood \u00d7 Impact", "The total number of vulnerabilities"],
        answer: 2,
        explain: "Risk = Likelihood \u00d7 Impact. A severe-looking vulnerability with no plausible threat or low impact can be a lower risk than a trivially exploitable flaw on a critical asset."
      },
      {
        q: "An authorization check that 'fails closed' will, on an unexpected error,",
        options: ["allow access so the app stays available", "disable the firewall", "skip logging the failure", "deny access by default"],
        answer: 3,
        explain: "Fail-safe defaults mean security decisions deny on uncertainty. Many breaches come from checks that failed open under error or load and simply let requests through."
      },
      {
        q: "By Kerckhoffs's principle, a system should stay secure even if everything is public except the",
        options: ["key", "algorithm", "source code", "network diagram"],
        answer: 0,
        explain: "Strength must live in the key, not in secrecy of the design. This is why 'security by obscurity' is not a real control and why we use open, vetted algorithms."
      }
    ]
  },
  "core-threat-modeling": {
    title: "Threat modeling checkpoint",
    sub: "STRIDE, trust boundaries, and prioritizing by risk.",
    questions: [
      {
        q: "The 'E' in STRIDE — Elevation of privilege — violates which security property?",
        options: ["Authentication", "Authorization", "Integrity", "Availability"],
        answer: 1,
        explain: "Elevation of privilege means gaining rights you should not have, which is an authorization failure. Spoofing maps to authentication; tampering to integrity; DoS to availability."
      },
      {
        q: "A trust boundary on a design is best described as",
        options: ["a firewall rule", "an encryption key", "a point where data passes between zones of different trust", "a user role"],
        answer: 2,
        explain: "Trust boundaries are where assumptions change — browser to server, service to database, your code to a third party. Attacks concentrate there, so validate and authorize on the trusted side."
      },
      {
        q: "Where must user input ultimately be validated?",
        options: ["In the browser with JavaScript", "In the CDN", "In the database only", "On the trusted server side"],
        answer: 3,
        explain: "Client-side checks are UX and can be bypassed. Anything that crossed a trust boundary must be validated and authorized server-side, every time."
      },
      {
        q: "A vulnerability appears on the CISA KEV catalog. What does that signal?",
        options: ["It is known to be actively exploited in the wild", "It is only theoretical", "It is low severity", "It has already been patched everywhere"],
        answer: 0,
        explain: "KEV = Known Exploited Vulnerabilities. Presence on KEV means real attacks are happening now — it is a strong 'patch this first' signal regardless of CVSS."
      }
    ]
  },
  "core-access": {
    title: "Identity & access checkpoint",
    sub: "AuthN vs AuthZ, access models, and least privilege.",
    questions: [
      {
        q: "Genuine multi-factor authentication requires",
        options: ["two passwords", "two or more different factor types", "one very long password", "a password plus a security question"],
        answer: 1,
        explain: "MFA combines different factor types — know, have, are. Two 'know' factors (password + security question) is still one factor and not true MFA."
      },
      {
        q: "RBAC makes access decisions based on",
        options: ["the object owner's discretion", "system-enforced security labels", "the subject's assigned role(s)", "the time of day"],
        answer: 2,
        explain: "Role-Based Access Control assigns permissions to roles and roles to users. Owner discretion is DAC, labels are MAC, and context like time is ABAC."
      },
      {
        q: "The main benefit of least privilege is that it",
        options: ["prevents the initial compromise", "removes the need for logging", "replaces the need for authentication", "reduces the blast radius after a compromise"],
        answer: 3,
        explain: "Least privilege does not stop the first foothold — it limits how far that foothold can reach, turning 'game over' into a contained incident."
      },
      {
        q: "OAuth 2.0 was designed primarily for",
        options: ["authorization (delegated access to resources)", "authentication (proving who a user is)", "encrypting traffic", "hashing passwords"],
        answer: 0,
        explain: "OAuth 2.0 delegates authorization ('let this app read my calendar'). For authentication you add OIDC on top — using raw OAuth as login has caused account-takeover bugs."
      }
    ]
  },

  /* ---------------- CRYPTO ---------------- */
  "crypto-primitives": {
    title: "Primitives checkpoint",
    sub: "Encoding vs encryption, AES modes, and hashing.",
    questions: [
      {
        q: "Base64 is an example of",
        options: ["encryption", "encoding — reversible by anyone, no key", "a cryptographic hash", "a message authentication code"],
        answer: 1,
        explain: "Base64 is encoding: it changes representation, not secrecy, and anyone can decode it. 'We Base64'd the token' protects nothing."
      },
      {
        q: "Which AES mode of operation should you avoid because it leaks patterns?",
        options: ["GCM", "CTR", "ECB", "CBC"],
        answer: 2,
        explain: "ECB encrypts identical plaintext blocks to identical ciphertext (the 'ECB penguin'). Prefer an authenticated mode like AES-GCM."
      },
      {
        q: "The avalanche effect of a good hash means",
        options: ["the hash is reversible", "collisions are easy to find", "the digest grows with the input", "flipping one input bit flips about half the output bits"],
        answer: 3,
        explain: "A tiny input change produces a completely different digest, with no partial similarity to exploit — which is what makes hashes useful for integrity."
      },
      {
        q: "To get confidentiality and integrity together, you should use",
        options: ["an AEAD mode such as AES-GCM", "ECB mode", "Base64 encoding", "a plain SHA-256 of the data"],
        answer: 0,
        explain: "Authenticated encryption (AEAD) like AES-GCM or ChaCha20-Poly1305 encrypts and produces an authentication tag, so tampering is detected on decryption."
      }
    ]
  },
  "crypto-keys": {
    title: "Public-key checkpoint",
    sub: "Asymmetric keys, key exchange, and signatures.",
    questions: [
      {
        q: "To send a confidential message to Alice, you encrypt it with",
        options: ["Alice's private key", "Alice's public key", "your own private key", "a password you both guess"],
        answer: 1,
        explain: "Encrypt to someone with their public key; only their matching private key can decrypt. You sign as yourself with your private key — don't swap these."
      },
      {
        q: "To produce a digital signature on a document, you use",
        options: ["the recipient's public key", "a shared symmetric secret", "your own private key", "the certificate authority's key"],
        answer: 2,
        explain: "Signing uses your private key (only you have it); anyone can verify with your public key. That asymmetry is what gives non-repudiation."
      },
      {
        q: "Diffie\u2013Hellman allows two parties to",
        options: ["transmit a secret key safely over the wire", "store passwords", "sign messages", "derive a shared secret over a public channel without sending it"],
        answer: 3,
        explain: "Both sides compute the same shared secret from exchanged public values; an eavesdropper who sees everything still faces the infeasible discrete-log problem."
      },
      {
        q: "Forward secrecy (from ephemeral key exchange) guarantees that",
        options: ["past recorded sessions stay safe even if the long-term key leaks later", "handshakes are faster", "certificates can be smaller", "no certificate authority is needed"],
        answer: 0,
        explain: "Ephemeral keys exist only in memory for one session. Stealing the server's long-term key later cannot decrypt previously recorded traffic — defeating 'harvest now, decrypt later'."
      }
    ]
  },
  "crypto-applied": {
    title: "Applied crypto checkpoint",
    sub: "TLS, certificates, and password storage.",
    questions: [
      {
        q: "In TLS, the role of the asymmetric (public-key) part of the handshake is to",
        options: ["encrypt all application data for the whole session", "authenticate the server and agree a key, then switch to symmetric AES", "only compress the data", "replace the need for certificates"],
        answer: 1,
        explain: "TLS is hybrid: slow asymmetric crypto authenticates and establishes a shared key, then fast symmetric crypto (e.g. AES-GCM) protects the bulk data."
      },
      {
        q: "A valid TLS certificate proves",
        options: ["the website is safe and trustworthy", "the site has no vulnerabilities", "the server's identity — that you're talking to that domain", "your data is anonymized"],
        answer: 2,
        explain: "The padlock means 'encrypted to whoever this is', not 'trustworthy'. Phishing sites can hold perfectly valid certificates."
      },
      {
        q: "The right way to store user passwords is",
        options: ["a single SHA-256", "reversibly encrypted in the database", "Base64 encoded", "a slow, salted hash such as Argon2id or bcrypt"],
        answer: 3,
        explain: "Use a deliberately slow, memory-hard hash with a unique per-user salt. Fast hashes (even SHA-256) let attackers try billions of guesses per second after a leak."
      },
      {
        q: "Adding a unique salt to each password hash mainly",
        options: ["makes identical passwords hash differently and defeats rainbow tables", "slows the hash down", "encrypts the password", "removes the need to hash"],
        answer: 0,
        explain: "A per-user salt means two users with the same password get different digests, and precomputed rainbow tables are useless. Slowness comes from the algorithm's cost factor."
      }
    ]
  },

  /* ---------------- APPSEC ---------------- */
  "appsec-web-attacks": {
    title: "Web attacks checkpoint",
    sub: "OWASP Top 10, injection, and XSS.",
    questions: [
      {
        q: "Which category sits at #1 in the OWASP Top 10 (2025)?",
        options: ["Injection", "Broken Access Control", "Cross-site scripting", "Mishandling of Exceptional Conditions"],
        answer: 1,
        explain: "Broken Access Control remains #1 in the 2025 list. Authentication being correct says nothing about whether a user may access this specific object, function or data field."
      },
      {
        q: "The robust fix for SQL injection is",
        options: ["blocklisting words like DROP", "manually escaping quotes", "parameterized / prepared statements", "hiding SQL errors from users"],
        answer: 2,
        explain: "Parameterized queries send the query and the data on separate channels, so input can never change the query's structure. Blocklists and manual escaping are bypassable."
      },
      {
        q: "The primary defense against cross-site scripting is",
        options: ["limiting input length", "a web application firewall alone", "using HTTPS", "contextual output encoding, backed by a Content-Security-Policy"],
        answer: 3,
        explain: "Encode user data for the output context so it renders as text, not markup, and add CSP to block inline/third-party script. Blocklist filters always lose."
      },
      {
        q: "Stored XSS differs from reflected XSS in that the payload",
        options: ["is saved on the server and served to other users", "requires HTTPS to work", "only affects the attacker", "cannot steal cookies"],
        answer: 0,
        explain: "Stored (persistent) XSS lives in the database — a comment or profile field — and runs in every victim who views it. Reflected XSS bounces off a single request."
      }
    ]
  },
  "appsec-sessions": {
    title: "Sessions & access checkpoint",
    sub: "Cookies and tokens, CSRF, and broken access control.",
    questions: [
      {
        q: "Which cookie flag prevents JavaScript from reading the cookie (blunting XSS theft)?",
        options: ["Secure", "HttpOnly", "SameSite", "Domain"],
        answer: 1,
        explain: "HttpOnly hides the cookie from document.cookie, so script injected via XSS can't exfiltrate the session token. Secure forces HTTPS; SameSite limits cross-site sending."
      },
      {
        q: "A JWT's payload is",
        options: ["encrypted and unreadable", "irreversibly hashed", "signed but readable by anyone (it's just Base64)", "kept secret on the server"],
        answer: 2,
        explain: "A standard JWT is signed, not encrypted. Anyone can decode and read the claims, so never put secrets in it — and always verify the signature with a fixed algorithm."
      },
      {
        q: "Which pair best mitigates CSRF?",
        options: ["HttpOnly cookies", "TLS alone", "output encoding", "anti-CSRF tokens plus SameSite cookies"],
        answer: 3,
        explain: "CSRF abuses the browser auto-sending cookies cross-site. A secret token the attacker's page can't read, plus SameSite cookies, stops forged state-changing requests."
      },
      {
        q: "An Insecure Direct Object Reference (IDOR) is an example of",
        options: ["broken access control — a missing ownership check", "injection", "cross-site scripting", "security misconfiguration"],
        answer: 0,
        explain: "IDOR exposes an object id and trusts it without checking that the caller owns the object. Scope every query to the authenticated user, server-side."
      }
    ]
  },
  "appsec-building": {
    title: "Building securely checkpoint",
    sub: "SSRF, security headers, and the supply chain.",
    questions: [
      {
        q: "Server-side request forgery (SSRF) lets an attacker",
        options: ["read the database directly", "make the server send requests to internal targets it shouldn't reach", "run JavaScript in the victim's browser", "brute-force passwords"],
        answer: 1,
        explain: "SSRF abuses a 'fetch this URL' feature to reach localhost, internal services, or cloud metadata endpoints that hand out credentials. Allow-list destinations and validate the resolved IP."
      },
      {
        q: "Which single response header is the strongest mitigation for XSS?",
        options: ["X-Frame-Options", "Referrer-Policy", "Content-Security-Policy", "X-Content-Type-Options"],
        answer: 2,
        explain: "A good CSP restricts where scripts may come from and can refuse inline script, neutralizing whole classes of XSS. X-Frame-Options addresses clickjacking instead."
      },
      {
        q: "A secret was committed to git and the line later deleted. The correct response is to",
        options: ["do nothing — it's deleted", "encrypt the repository", "just add a .gitignore entry", "revoke and rotate it; treat it as compromised"],
        answer: 3,
        explain: "The secret still lives in git history and may already be scraped. Deleting the line is not enough — revoke and rotate the credential."
      },
      {
        q: "A software bill of materials (SBOM) primarily helps you",
        options: ["know what components you ship so you can find vulnerable ones", "encrypt dependencies", "speed up builds", "replace a firewall"],
        answer: 0,
        explain: "An SBOM inventories your components and versions, so when a new CVE drops you can instantly tell whether — and where — you're affected."
      }
    ]
  },

  /* ---------------- DEFENSE ---------------- */
  "defense-network": {
    title: "Network defense checkpoint",
    sub: "Firewalls, segmentation, transport, and zero trust.",
    questions: [
      {
        q: "A firewall rule set is evaluated",
        options: ["in random order", "top to bottom, first match wins", "by alphabetical rule name", "bottom to top"],
        answer: 1,
        explain: "Order matters: the first matching rule applies, with a default-deny at the bottom. A broad allow placed above a specific deny silently defeats it."
      },
      {
        q: "Network segmentation primarily",
        options: ["encrypts traffic", "replaces multi-factor authentication", "contains the blast radius of a breach", "speeds up the network"],
        answer: 2,
        explain: "Segmentation limits what a compromised host can reach. Flat networks are how one phished laptop becomes estate-wide ransomware in hours."
      },
      {
        q: "The core idea of zero trust is",
        options: ["trust everything inside the firewall", "block all external traffic", "authenticate once at the VPN and trust thereafter", "never trust based on network location — verify every request"],
        answer: 3,
        explain: "Zero trust drops 'inside = trusted'. Every request is authenticated, authorized and encrypted regardless of origin, with least privilege and micro-segmentation."
      },
      {
        q: "Mutual TLS (mTLS) provides",
        options: ["mutual authentication of both ends of a connection", "one-way server authentication only", "password hashing", "faster DNS resolution"],
        answer: 0,
        explain: "In mTLS both client and server present and verify certificates — common for service-to-service traffic in zero-trust architectures."
      }
    ]
  },
  "defense-detect": {
    title: "Detection checkpoint",
    sub: "Logging and SIEM, IDS/IPS, and the kill chain.",
    questions: [
      {
        q: "The main value of a SIEM is that it",
        options: ["blocks attacks inline", "centralizes and correlates logs from across the estate", "encrypts data at rest", "patches systems automatically"],
        answer: 1,
        explain: "A SIEM aggregates and correlates events so separate weak signals become one alert — and centralization stops attackers from quietly deleting local logs."
      },
      {
        q: "The difference between an IDS and an IPS is that",
        options: ["an IDS encrypts and an IPS hashes", "they are identical", "an IDS alerts, while an IPS sits inline and can block", "an IPS can only log"],
        answer: 2,
        explain: "Same detection brain, different placement: detection (alert) versus prevention (block inline). An over-aggressive IPS can also block legitimate traffic, so it is tuned carefully."
      },
      {
        q: "Signature-based detection is weakest against",
        options: ["known malware", "expired certificates", "high traffic volumes", "novel or zero-day attacks"],
        answer: 3,
        explain: "Signatures are accurate on known patterns but blind to brand-new attacks. Anomaly-based detection can catch novel activity at the cost of more false positives."
      },
      {
        q: "By far the most common way intrusions begin is",
        options: ["phishing", "physical theft of hardware", "a poisoned supply chain", "a volumetric DDoS"],
        answer: 0,
        explain: "Most intrusions start with someone clicking a phishing lure. Technical controls must assume a click will happen and limit what it can achieve."
      },
      {
        q: "A detection rule produces thousands of alerts during approved maintenance. What is the best engineering response?",
        options: ["Delete all maintenance logs", "Document the benign pattern, add a bounded exclusion and a should-not-fire test fixture, then review residual coverage", "Ignore every alert", "Disable the data source"],
        answer: 1,
        explain: "A narrow, tested exclusion keeps the original behavior covered while preventing a known operation from paging analysts. Global suppression destroys coverage."
      }
    ]
  },
  "defense-respond": {
    title: "Response & ops checkpoint",
    sub: "Incident response, hardening, and security operations.",
    questions: [
      {
        q: "In the incident-response lifecycle, what typically comes immediately after Identification?",
        options: ["Lessons learned", "Containment", "Recovery", "Preparation"],
        answer: 1,
        explain: "Once an incident is confirmed you contain it — stop the bleeding and isolate affected systems — before eradicating the foothold and recovering clean systems."
      },
      {
        q: "Most real-world breaches exploit",
        options: ["unknown zero-day vulnerabilities", "insider threats only", "known vulnerabilities that already have patches", "physical access"],
        answer: 2,
        explain: "Attackers rarely need a zero-day when last quarter's unpatched, internet-facing CVE is available. Disciplined patch management prevents an enormous share of incidents."
      },
      {
        q: "A backup only becomes a real recovery control once you have",
        options: ["encrypted it", "compressed it", "stored it on the same server", "actually tested restoring from it"],
        answer: 3,
        explain: "Untested backups fail when you need them most, and ransomware specifically targets backups. Keep offline/immutable copies and rehearse the restore."
      },
      {
        q: "What separates authorized security testing from a crime?",
        options: ["explicit written permission and a defined scope", "using specialized tools", "only testing at night", "posting a disclaimer"],
        answer: 0,
        explain: "Red teaming, pen tests and bug bounties operate under written authorization and scope. The skills here are for defending and testing your own systems — with consent."
      }
    ]
  }
});
