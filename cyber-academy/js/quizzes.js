/* =====================================================================
   CITADEL · Quiz bank
   window.QUIZZES[id] = { title, sub, questions: [{ q, options, answer, explain }] }
   `answer` is the 0-based index of the correct option. Verified by hand.
   ===================================================================== */
window.QUIZZES = {
  /* ---------------- CORE ---------------- */
  "core-foundations": {
    title: "Core principles checkpoint",
    sub: "The CIA triad, risk, and secure-by-default design.",
    questions: [
      {
        q: "Encryption of stored data primarily protects which property of the CIA triad?",
        options: ["Integrity", "Availability", "Confidentiality", "Non-repudiation"],
        answer: 2,
        explain: "Encryption keeps data unreadable to unauthorized parties — that is confidentiality. Integrity is protected by hashes/signatures, and availability by redundancy and backups."
      },
      {
        q: "Which expression best captures how risk is estimated?",
        options: ["Threat + Vulnerability", "Likelihood \u00d7 Impact", "The CVSS score on its own", "The total number of vulnerabilities"],
        answer: 1,
        explain: "Risk = Likelihood \u00d7 Impact. A severe-looking vulnerability with no plausible threat or low impact can be a lower risk than a trivially exploitable flaw on a critical asset."
      },
      {
        q: "An authorization check that 'fails closed' will, on an unexpected error,",
        options: ["allow access so the app stays available", "deny access by default", "skip logging the failure", "disable the firewall"],
        answer: 1,
        explain: "Fail-safe defaults mean security decisions deny on uncertainty. Many breaches come from checks that failed open under error or load and simply let requests through."
      },
      {
        q: "By Kerckhoffs's principle, a system should stay secure even if everything is public except the",
        options: ["source code", "algorithm", "key", "network diagram"],
        answer: 2,
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
        options: ["Authentication", "Integrity", "Authorization", "Availability"],
        answer: 2,
        explain: "Elevation of privilege means gaining rights you should not have, which is an authorization failure. Spoofing maps to authentication; tampering to integrity; DoS to availability."
      },
      {
        q: "A trust boundary on a design is best described as",
        options: ["a firewall rule", "a point where data passes between zones of different trust", "an encryption key", "a user role"],
        answer: 1,
        explain: "Trust boundaries are where assumptions change — browser to server, service to database, your code to a third party. Attacks concentrate there, so validate and authorize on the trusted side."
      },
      {
        q: "Where must user input ultimately be validated?",
        options: ["In the browser with JavaScript", "On the trusted server side", "In the database only", "In the CDN"],
        answer: 1,
        explain: "Client-side checks are UX and can be bypassed. Anything that crossed a trust boundary must be validated and authorized server-side, every time."
      },
      {
        q: "A vulnerability appears on the CISA KEV catalog. What does that signal?",
        options: ["It is only theoretical", "It is known to be actively exploited in the wild", "It is low severity", "It has already been patched everywhere"],
        answer: 1,
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
        options: ["prevents the initial compromise", "reduces the blast radius after a compromise", "replaces the need for authentication", "removes the need for logging"],
        answer: 1,
        explain: "Least privilege does not stop the first foothold — it limits how far that foothold can reach, turning 'game over' into a contained incident."
      },
      {
        q: "OAuth 2.0 was designed primarily for",
        options: ["authentication (proving who a user is)", "authorization (delegated access to resources)", "encrypting traffic", "hashing passwords"],
        answer: 1,
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
        options: ["encryption", "a cryptographic hash", "encoding — reversible by anyone, no key", "a message authentication code"],
        answer: 2,
        explain: "Base64 is encoding: it changes representation, not secrecy, and anyone can decode it. 'We Base64'd the token' protects nothing."
      },
      {
        q: "Which AES mode of operation should you avoid because it leaks patterns?",
        options: ["GCM", "CTR", "CBC", "ECB"],
        answer: 3,
        explain: "ECB encrypts identical plaintext blocks to identical ciphertext (the 'ECB penguin'). Prefer an authenticated mode like AES-GCM."
      },
      {
        q: "The avalanche effect of a good hash means",
        options: ["the hash is reversible", "flipping one input bit flips about half the output bits", "the digest grows with the input", "collisions are easy to find"],
        answer: 1,
        explain: "A tiny input change produces a completely different digest, with no partial similarity to exploit — which is what makes hashes useful for integrity."
      },
      {
        q: "To get confidentiality and integrity together, you should use",
        options: ["ECB mode", "an AEAD mode such as AES-GCM", "Base64 encoding", "a plain SHA-256 of the data"],
        answer: 1,
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
        options: ["the recipient's public key", "your own private key", "a shared symmetric secret", "the certificate authority's key"],
        answer: 1,
        explain: "Signing uses your private key (only you have it); anyone can verify with your public key. That asymmetry is what gives non-repudiation."
      },
      {
        q: "Diffie\u2013Hellman allows two parties to",
        options: ["transmit a secret key safely over the wire", "derive a shared secret over a public channel without sending it", "sign messages", "store passwords"],
        answer: 1,
        explain: "Both sides compute the same shared secret from exchanged public values; an eavesdropper who sees everything still faces the infeasible discrete-log problem."
      },
      {
        q: "Forward secrecy (from ephemeral key exchange) guarantees that",
        options: ["handshakes are faster", "past recorded sessions stay safe even if the long-term key leaks later", "certificates can be smaller", "no certificate authority is needed"],
        answer: 1,
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
        options: ["the website is safe and trustworthy", "the server's identity — that you're talking to that domain", "the site has no vulnerabilities", "your data is anonymized"],
        answer: 1,
        explain: "The padlock means 'encrypted to whoever this is', not 'trustworthy'. Phishing sites can hold perfectly valid certificates."
      },
      {
        q: "The right way to store user passwords is",
        options: ["a single SHA-256", "reversibly encrypted in the database", "a slow, salted hash such as Argon2id or bcrypt", "Base64 encoded"],
        answer: 2,
        explain: "Use a deliberately slow, memory-hard hash with a unique per-user salt. Fast hashes (even SHA-256) let attackers try billions of guesses per second after a leak."
      },
      {
        q: "Adding a unique salt to each password hash mainly",
        options: ["slows the hash down", "makes identical passwords hash differently and defeats rainbow tables", "encrypts the password", "removes the need to hash"],
        answer: 1,
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
        q: "Which category sits at #1 in the OWASP Top 10 (2021)?",
        options: ["Injection", "Broken Access Control", "Cross-site scripting", "Server-side request forgery"],
        answer: 1,
        explain: "Broken Access Control rose to #1 — authenticated users reaching data or actions that are not theirs. Authentication being fine says nothing about authorization."
      },
      {
        q: "The robust fix for SQL injection is",
        options: ["blocklisting words like DROP", "manually escaping quotes", "parameterized / prepared statements", "hiding SQL errors from users"],
        answer: 2,
        explain: "Parameterized queries send the query and the data on separate channels, so input can never change the query's structure. Blocklists and manual escaping are bypassable."
      },
      {
        q: "The primary defense against cross-site scripting is",
        options: ["limiting input length", "contextual output encoding, backed by a Content-Security-Policy", "using HTTPS", "a web application firewall alone"],
        answer: 1,
        explain: "Encode user data for the output context so it renders as text, not markup, and add CSP to block inline/third-party script. Blocklist filters always lose."
      },
      {
        q: "Stored XSS differs from reflected XSS in that the payload",
        options: ["requires HTTPS to work", "is saved on the server and served to other users", "only affects the attacker", "cannot steal cookies"],
        answer: 1,
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
        options: ["Secure", "SameSite", "HttpOnly", "Domain"],
        answer: 2,
        explain: "HttpOnly hides the cookie from document.cookie, so script injected via XSS can't exfiltrate the session token. Secure forces HTTPS; SameSite limits cross-site sending."
      },
      {
        q: "A JWT's payload is",
        options: ["encrypted and unreadable", "signed but readable by anyone (it's just Base64)", "irreversibly hashed", "kept secret on the server"],
        answer: 1,
        explain: "A standard JWT is signed, not encrypted. Anyone can decode and read the claims, so never put secrets in it — and always verify the signature with a fixed algorithm."
      },
      {
        q: "Which pair best mitigates CSRF?",
        options: ["HttpOnly cookies", "anti-CSRF tokens plus SameSite cookies", "output encoding", "TLS alone"],
        answer: 1,
        explain: "CSRF abuses the browser auto-sending cookies cross-site. A secret token the attacker's page can't read, plus SameSite cookies, stops forged state-changing requests."
      },
      {
        q: "An Insecure Direct Object Reference (IDOR) is an example of",
        options: ["injection", "broken access control — a missing ownership check", "cross-site scripting", "security misconfiguration"],
        answer: 1,
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
        options: ["X-Frame-Options", "Content-Security-Policy", "Referrer-Policy", "X-Content-Type-Options"],
        answer: 1,
        explain: "A good CSP restricts where scripts may come from and can refuse inline script, neutralizing whole classes of XSS. X-Frame-Options addresses clickjacking instead."
      },
      {
        q: "A secret was committed to git and the line later deleted. The correct response is to",
        options: ["do nothing — it's deleted", "revoke and rotate it; treat it as compromised", "just add a .gitignore entry", "encrypt the repository"],
        answer: 1,
        explain: "The secret still lives in git history and may already be scraped. Deleting the line is not enough — revoke and rotate the credential."
      },
      {
        q: "A software bill of materials (SBOM) primarily helps you",
        options: ["encrypt dependencies", "know what components you ship so you can find vulnerable ones", "speed up builds", "replace a firewall"],
        answer: 1,
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
        options: ["encrypts traffic", "contains the blast radius of a breach", "replaces multi-factor authentication", "speeds up the network"],
        answer: 1,
        explain: "Segmentation limits what a compromised host can reach. Flat networks are how one phished laptop becomes estate-wide ransomware in hours."
      },
      {
        q: "The core idea of zero trust is",
        options: ["trust everything inside the firewall", "never trust based on network location — verify every request", "authenticate once at the VPN and trust thereafter", "block all external traffic"],
        answer: 1,
        explain: "Zero trust drops 'inside = trusted'. Every request is authenticated, authorized and encrypted regardless of origin, with least privilege and micro-segmentation."
      },
      {
        q: "Mutual TLS (mTLS) provides",
        options: ["one-way server authentication only", "mutual authentication of both ends of a connection", "password hashing", "faster DNS resolution"],
        answer: 1,
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
        options: ["an IDS encrypts and an IPS hashes", "an IDS alerts, while an IPS sits inline and can block", "they are identical", "an IPS can only log"],
        answer: 1,
        explain: "Same detection brain, different placement: detection (alert) versus prevention (block inline). An over-aggressive IPS can also block legitimate traffic, so it is tuned carefully."
      },
      {
        q: "Signature-based detection is weakest against",
        options: ["known malware", "novel or zero-day attacks", "high traffic volumes", "expired certificates"],
        answer: 1,
        explain: "Signatures are accurate on known patterns but blind to brand-new attacks. Anomaly-based detection can catch novel activity at the cost of more false positives."
      },
      {
        q: "By far the most common way intrusions begin is",
        options: ["physical theft of hardware", "phishing", "a poisoned supply chain", "a volumetric DDoS"],
        answer: 1,
        explain: "Most intrusions start with someone clicking a phishing lure. Technical controls must assume a click will happen and limit what it can achieve."
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
        options: ["unknown zero-day vulnerabilities", "known vulnerabilities that already have patches", "insider threats only", "physical access"],
        answer: 1,
        explain: "Attackers rarely need a zero-day when last quarter's unpatched, internet-facing CVE is available. Disciplined patch management prevents an enormous share of incidents."
      },
      {
        q: "A backup only becomes a real recovery control once you have",
        options: ["encrypted it", "actually tested restoring from it", "stored it on the same server", "compressed it"],
        answer: 1,
        explain: "Untested backups fail when you need them most, and ransomware specifically targets backups. Keep offline/immutable copies and rehearse the restore."
      },
      {
        q: "What separates authorized security testing from a crime?",
        options: ["using specialized tools", "explicit written permission and a defined scope", "only testing at night", "posting a disclaimer"],
        answer: 1,
        explain: "Red teaming, pen tests and bug bounties operate under written authorization and scope. The skills here are for defending and testing your own systems — with consent."
      }
    ]
  }
};
