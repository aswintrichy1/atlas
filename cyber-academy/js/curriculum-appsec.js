/* =====================================================================
   CITADEL · Web & Application Security curriculum
   window.TRACKS.appsec  ·  block grammar documented in curriculum-core.js
   Framing is defensive: how flaws arise and, above all, how to prevent them.
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.appsec = {
  id: "appsec",
  name: "Web & App Security",
  short: "APPSEC",
  tagline: "Understand the web's flaws to build it safely",
  color: "#f5a623",
  blurb: "How web applications break and how to harden them: the OWASP Top 10, injection and SQL injection, cross-site scripting, session and CSRF defenses, broken access control, SSRF, security headers, and managing secrets and the software supply chain.",
  modules: [
    /* ============================ WEB ATTACKS ============================ */
    {
      id: "web-attacks",
      name: "The big classes",
      icon: "globe",
      lessons: [
        {
          id: "owasp-top-10",
          title: "The OWASP Top 10",
          summary: "The industry's shared checklist of the most critical web app risks — your map to what to defend first.",
          minutes: 7,
          tags: ["owasp", "overview"],
          blocks: [
            { t: "p", html: "The <strong>OWASP Top 10</strong> is a community-built, regularly updated list of the most critical web application security risks. It isn't exhaustive, but it's the shared vocabulary teams use to prioritize \u2014 and a great syllabus for what to learn." },
            {
              t: "table",
              headers: ["#", "Category (2021)", "In one line"],
              rows: [
                ["A01", "Broken Access Control", "Users do things they shouldn't"],
                ["A02", "Cryptographic Failures", "Weak/missing crypto exposes data"],
                ["A03", "Injection", "Untrusted input runs as code/query"],
                ["A04", "Insecure Design", "The flaw is in the design itself"],
                ["A05", "Security Misconfiguration", "Defaults, verbose errors, open buckets"],
                ["A06", "Vulnerable Components", "Outdated, flawed dependencies"],
                ["A07", "Auth Failures", "Weak login, session, credential handling"],
                ["A08", "Integrity Failures", "Unverified updates / deserialization"],
                ["A09", "Logging & Monitoring Failures", "You can't see the attack"],
                ["A10", "Server-Side Request Forgery", "Server tricked into making requests"]
              ]
            },
            { t: "note", variant: "key", html: "Notice the shift over the years: <strong>Broken Access Control</strong> rose to #1 and <strong>Insecure Design</strong> appeared. Security has moved upstream \u2014 from \u201cfilter bad input\u201d to \u201cdesign the system so the bad thing is impossible.\u201d" },
            { t: "h", text: "One root cause behind many" },
            { t: "p", html: "A huge share of these reduce to a single sin: <strong>trusting data that crossed a trust boundary.</strong> Injection, XSS, SSRF and broken access control are all variations on \u201cthe app believed something the attacker controlled.\u201d Keep that lens as we go." },
            { t: "note", variant: "tip", html: "OWASP also publishes focused lists \u2014 the API Security Top 10, the Mobile Top 10, and the ASVS verification standard. When you build something specific, there's usually a tailored checklist." }
          ]
        },
        {
          id: "injection",
          title: "Injection & SQL injection",
          summary: "When user input is treated as code instead of data. The fix is old, simple, and still skipped.",
          minutes: 8,
          tags: ["injection", "sqli"],
          blocks: [
            { t: "p", html: "<strong>Injection</strong> happens when an application builds a command \u2014 SQL, a shell line, an LDAP query \u2014 by gluing untrusted input directly into it. The interpreter can't tell your data from its syntax, so the input becomes <em>code</em>." },
            { t: "h", text: "The classic vulnerable pattern" },
            {
              t: "code", lang: "python", code:
"# VULNERABLE: input concatenated straight into SQL\n" +
"def login(username, password):\n" +
"    q = \"SELECT * FROM users WHERE name = '\" + username + \"'\"\n" +
"    return db.execute(q)\n\n" +
"# If username is:  alice' --\n" +
"# the query becomes:  ... WHERE name = 'alice' --'\n" +
"# and the password check is commented out.\n"
            },
            { t: "note", variant: "key", html: "The flaw isn't the quote character \u2014 it's that <strong>data and code share a channel</strong>. The robust fix separates them so input can never change the query's structure." },
            { t: "h", text: "The fix: parameterized queries" },
            {
              t: "code", lang: "python", code:
"# SAFE: the driver sends query and data on separate channels\n" +
"def login(username, password):\n" +
"    q = \"SELECT * FROM users WHERE name = %s\"\n" +
"    return db.execute(q, (username,))   # username is ALWAYS data\n"
            },
            { t: "compare",
              bad: { title: "Doesn't actually fix it", items: ["Blocklisting words like <code>DROP</code>", "Escaping quotes by hand", "Hiding SQL errors from users", "Trusting client-side validation"] },
              good: { title: "Defense in depth", items: ["<strong>Parameterized queries</strong> / prepared statements", "ORMs used safely (no raw string building)", "Least-privilege DB accounts", "Allow-list input validation as a second layer"] }
            },
            { t: "note", variant: "trap", html: "The same disease appears as OS command injection, LDAP injection, NoSQL injection and template injection. The cure is always the same shape: <strong>never mix untrusted input into a command string</strong> \u2014 use the API that keeps data as data." }
          ]
        },
        {
          id: "xss",
          title: "Cross-site scripting (XSS)",
          summary: "Injection's cousin in the browser: attacker-controlled input becomes script that runs in your users' sessions.",
          minutes: 8,
          tags: ["xss", "browser"],
          blocks: [
            { t: "p", html: "<strong>Cross-site scripting</strong> is injection aimed at the browser. If an app reflects or stores user input into a page without proper encoding, that input can become live HTML/JavaScript \u2014 running with the victim's session, able to steal cookies, keystrokes, or act as them." },
            {
              t: "table",
              headers: ["Type", "How the payload reaches the victim"],
              rows: [
                ["<strong>Stored</strong>", "Saved on the server (a comment, profile) and served to others"],
                ["<strong>Reflected</strong>", "Bounced off a request (a search term in the URL)"],
                ["<strong>DOM-based</strong>", "Client-side JS writes untrusted data into the DOM"]
              ]
            },
            { t: "h", text: "The core fix: contextual output encoding" },
            { t: "p", html: "The browser decides whether text is markup. <strong>Encode on output</strong> so user data renders as <em>text</em>, not tags: <code>&lt;</code> becomes <code>&amp;lt;</code>. Encoding depends on context \u2014 HTML body, attribute, URL and JavaScript each need different handling." },
            { t: "p", html: "See it for yourself: type a payload and toggle encoding. The lab shows what the browser would render \u2014 safely, by displaying the escaped text \u2014 never executing anything." },
            { t: "widget", id: "xss" },
            { t: "h", text: "Layers that make XSS hard" },
            {
              t: "ul", items: [
                "<strong>Output encoding</strong> for the right context (the primary defense).",
                "<strong>Content Security Policy (CSP)</strong> \u2014 restrict where scripts may load from; block inline script.",
                "Framework auto-escaping (React, modern templating) \u2014 don't defeat it with <code>dangerouslySetInnerHTML</code>/<code>v-html</code>.",
                "<code>HttpOnly</code> cookies so script can't read the session token.",
                "Sanitize HTML you must allow (e.g. rich text) with a vetted library like DOMPurify."
              ]
            },
            { t: "note", variant: "trap", html: "Blocklist filters (\u201cstrip <code>&lt;script&gt;</code>\u201d) always lose \u2014 there are countless ways to introduce script (event handlers, <code>javascript:</code> URLs, SVG). Rely on <strong>encoding + CSP</strong>, not on spotting bad strings." },
            { t: "quiz", id: "appsec-web-attacks" }
          ]
        }
      ]
    },
    /* ============================ SESSIONS & ACCESS ============================ */
    {
      id: "sessions",
      name: "Sessions & access",
      icon: "share",
      lessons: [
        {
          id: "auth-sessions",
          title: "Sessions, cookies & tokens",
          summary: "HTTP is stateless, so we bolt identity on with cookies and tokens — the part attackers love to steal.",
          minutes: 7,
          tags: ["sessions", "cookies"],
          blocks: [
            { t: "p", html: "After you log in, the app needs to remember you across stateless HTTP requests. It issues a <strong>session identifier</strong> (a cookie) or a <strong>token</strong> (often a JWT). Whoever holds that value <em>is</em> you \u2014 which is why protecting it is everything." },
            { t: "h", text: "Cookie flags that matter" },
            {
              t: "table",
              headers: ["Flag", "Effect"],
              rows: [
                ["<code>HttpOnly</code>", "JavaScript can't read it \u2014 blunts XSS cookie theft"],
                ["<code>Secure</code>", "Only sent over HTTPS"],
                ["<code>SameSite=Lax/Strict</code>", "Limits cross-site sending \u2014 mitigates CSRF"],
                ["<code>__Host-</code> prefix", "Locks the cookie to the exact host, no subdomain games"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Regenerate the session ID on login.</strong> If you keep the pre-login identifier, you're open to <em>session fixation</em>, where an attacker plants a known ID and rides the session once you authenticate." },
            { t: "h", text: "Sessions vs JWTs" },
            { t: "compare",
              bad: { title: "JWT misconceptions", items: ["\u201cJWTs can't be revoked, so don't bother\u201d", "Storing sensitive data in the (readable) payload", "Accepting <code>alg: none</code> or trusting the header's alg", "Long-lived access tokens with no rotation"] },
              good: { title: "Token hygiene", items: ["Short-lived access + refresh tokens", "Server-side allow/deny list for revocation", "Pin the verification algorithm explicitly", "Store tokens where XSS can't reach them"] }
            },
            { t: "note", variant: "trap", html: "A JWT is <strong>signed, not encrypted</strong> \u2014 anyone can read its payload (it's just Base64). Never put secrets in it, and always verify the signature with a fixed algorithm before trusting a single claim." }
          ]
        },
        {
          id: "csrf",
          title: "Cross-site request forgery",
          summary: "Your browser helpfully attaches your cookies to every request — including the ones an attacker's page triggers.",
          minutes: 6,
          tags: ["csrf", "browser"],
          blocks: [
            { t: "p", html: "<strong>CSRF</strong> abuses the browser's habit of attaching your cookies to <em>every</em> request to a site \u2014 even requests initiated by a different, malicious site. If your bank accepts a transfer based only on the session cookie, a hidden form on an attacker's page can submit it as you." },
            { t: "h", text: "Why it works, and what stops it" },
            {
              t: "ul", items: [
                "<strong>Anti-CSRF tokens</strong> \u2014 a per-session secret the attacker's page can't read or guess, required on state-changing requests.",
                "<strong>SameSite cookies</strong> \u2014 <code>Lax</code> (a strong default) or <code>Strict</code> stops cookies riding cross-site requests.",
                "<strong>Check Origin/Referer</strong> on sensitive endpoints.",
                "Require re-authentication or a second factor for the riskiest actions."
              ]
            },
            { t: "note", variant: "key", html: "CSRF only needs the attacker to make <em>your</em> browser send a request; they never see the response. That's why <strong>read-only</strong> endpoints are low-risk and <strong>state-changing</strong> ones (POST/PUT/DELETE) need protection." },
            { t: "note", variant: "trap", html: "XSS beats CSRF defenses entirely \u2014 script running on your page can simply read the CSRF token. Fixing XSS isn't optional; CSRF tokens assume the page itself isn't compromised." }
          ]
        },
        {
          id: "access-control",
          title: "Broken access control",
          summary: "OWASP's #1 risk: authenticated users reaching data and actions that aren't theirs.",
          minutes: 7,
          tags: ["access-control", "authz"],
          blocks: [
            { t: "p", html: "<strong>Broken access control</strong> is the current #1 web risk. The user is logged in \u2014 authentication is fine \u2014 but the app fails to check whether <em>this</em> user may perform <em>this</em> action on <em>this</em> object. Authorization is the gap." },
            { t: "h", text: "IDOR: the canonical example" },
            { t: "p", html: "An <strong>Insecure Direct Object Reference</strong> exposes a record's identifier and trusts it without an ownership check. Change the id in the URL, get someone else's data." },
            {
              t: "code", lang: "python", code:
"# VULNERABLE: returns the invoice for ANY id the caller supplies\n" +
"@app.get('/invoices/<id>')\n" +
"def get_invoice(id):\n" +
"    return db.invoices.find(id)        # no ownership check!\n\n" +
"# SAFE: scope every query to the authenticated user\n" +
"@app.get('/invoices/<id>')\n" +
"def get_invoice(id):\n" +
"    inv = db.invoices.find(id)\n" +
"    if inv.owner_id != current_user.id:\n" +
"        abort(404)                     # don't even confirm it exists\n" +
"    return inv\n"
            },
            { t: "compare",
              bad: { title: "Where access control breaks", items: ["Authorize in the UI only (hide buttons)", "Trust IDs/roles from the request", "Forget object-level checks on APIs", "\u201cAdmin\u201d endpoints guarded only by an obscure URL"] },
              good: { title: "Getting it right", items: ["<strong>Deny by default</strong>, allow explicitly", "Enforce authz server-side on every request", "Check ownership at the <strong>object</strong> level", "Centralize policy; cover every endpoint in tests"] }
            },
            { t: "note", variant: "key", html: "<strong>Authentication \u2260 authorization.</strong> Verifying who someone is says nothing about what they may touch. Check authorization on every request, for every object \u2014 server-side, every time." },
            { t: "quiz", id: "appsec-sessions" }
          ]
        }
      ]
    },
    /* ============================ BUILDING SECURELY ============================ */
    {
      id: "building",
      name: "Building securely",
      icon: "wrench",
      lessons: [
        {
          id: "ssrf",
          title: "Server-side request forgery",
          summary: "Trick the server into making requests on the attacker's behalf — straight at your internal network.",
          minutes: 6,
          tags: ["ssrf", "api"],
          blocks: [
            { t: "p", html: "<strong>SSRF</strong> happens when an app fetches a URL the user supplies \u2014 a webhook, an image-from-URL feature, a PDF renderer \u2014 without restriction. The attacker points it inward: at <code>localhost</code>, internal services, or the cloud metadata endpoint that hands out credentials." },
            { t: "note", variant: "warn", html: "SSRF against cloud metadata (e.g. <code>169.254.169.254</code>) has caused major breaches \u2014 the server fetches the URL and returns temporary cloud credentials to the attacker. Treat any \u201cfetch this URL\u201d feature as high-risk." },
            { t: "h", text: "Defenses that actually hold" },
            {
              t: "ul", items: [
                "<strong>Allow-list</strong> destinations (schemes, hosts, ports) \u2014 don't try to blocklist internal ranges.",
                "Resolve the hostname and <strong>validate the resolved IP</strong> isn't private/link-local (and re-check after redirects).",
                "Disable unneeded URL schemes (<code>file://</code>, <code>gopher://</code>).",
                "Require IMDSv2 / disable metadata where possible; isolate egress with network policy.",
                "Don't return raw fetch responses to the user."
              ]
            },
            { t: "note", variant: "trap", html: "Naive filters fail to DNS rebinding and redirects: a host resolves to a public IP at check time, then to <code>127.0.0.1</code> at fetch time. Validate the <em>actual</em> connected IP, and re-validate on every redirect hop." }
          ]
        },
        {
          id: "secure-headers",
          title: "Security headers & misconfiguration",
          summary: "A handful of HTTP response headers turn the browser into an ally — and most apps ship without them.",
          minutes: 6,
          tags: ["headers", "hardening"],
          blocks: [
            { t: "p", html: "<strong>Security misconfiguration</strong> is consistently in the Top 10 because the secure setting is rarely the default. A few response headers instruct the browser to enforce protections for you." },
            {
              t: "table",
              headers: ["Header", "What it does"],
              rows: [
                ["<strong>Content-Security-Policy</strong>", "Restricts script/style/connect sources \u2014 the strongest XSS mitigation"],
                ["<strong>Strict-Transport-Security</strong>", "Forces HTTPS for future visits (HSTS)"],
                ["<strong>X-Content-Type-Options: nosniff</strong>", "Stops MIME-type guessing"],
                ["<strong>X-Frame-Options / frame-ancestors</strong>", "Prevents clickjacking via framing"],
                ["<strong>Referrer-Policy</strong>", "Limits referrer leakage to other sites"]
              ]
            },
            { t: "note", variant: "key", html: "A good <strong>Content-Security-Policy</strong> is the single most effective header \u2014 it can neutralize whole classes of XSS by refusing to run inline or third-party script. It takes effort to roll out, and it's worth it." },
            { t: "h", text: "The misconfiguration checklist" },
            {
              t: "ul", items: [
                "Change or disable default accounts and credentials.",
                "Turn off verbose errors and stack traces in production.",
                "Lock down cloud storage (no world-readable buckets).",
                "Disable directory listing and unused features/ports.",
                "Keep the stack patched \u2014 misconfig and outdated components travel together."
              ]
            },
            { t: "note", variant: "tip", html: "Don't hand-maintain headers per app. Set a secure baseline at the gateway/CDN and verify it in CI \u2014 a single misconfigured environment is how the secure default quietly disappears." }
          ]
        },
        {
          id: "secrets-supply-chain",
          title: "Secrets & the supply chain",
          summary: "Your dependencies and your credentials are now part of your attack surface. Manage both deliberately.",
          minutes: 7,
          tags: ["secrets", "supply-chain"],
          blocks: [
            { t: "p", html: "Modern apps are mostly other people's code, wired together with credentials. Two of the fastest-growing risk areas are <strong>leaked secrets</strong> and a compromised <strong>software supply chain</strong>." },
            { t: "h", text: "Secrets management" },
            {
              t: "ul", items: [
                "<strong>Never commit secrets</strong> to source control \u2014 scan history and block them in CI (pre-commit hooks, secret scanners).",
                "Use a secret manager / vault, not <code>.env</code> files baked into images.",
                "Prefer short-lived, automatically rotated credentials and workload identity over static keys.",
                "Scope each secret to least privilege; have a rotation plan for when one leaks."
              ]
            },
            { t: "note", variant: "trap", html: "Rotating a leaked key is not enough if it lives in git history \u2014 it's still there in old commits. Treat any committed secret as compromised: <strong>revoke and rotate</strong>, don't just delete the line." },
            { t: "h", text: "Supply-chain security" },
            {
              t: "ul", items: [
                "Track dependencies with an <strong>SBOM</strong> (software bill of materials).",
                "Scan for known-vulnerable components (SCA) and patch promptly \u2014 most breaches use a <em>known</em> CVE.",
                "Pin versions and verify integrity (lockfiles, checksums, signatures).",
                "Limit what CI/CD and build tooling can do \u2014 a poisoned build step ships to everyone.",
                "Be wary of typosquatted and newly-published packages."
              ]
            },
            { t: "note", variant: "key", html: "Incidents like dependency confusion and poisoned build pipelines show the lesson: <strong>you inherit the security of everything you import and every tool in your pipeline.</strong> Verify integrity, minimize trust, and keep an inventory." },
            { t: "quiz", id: "appsec-building" }
          ]
        }
      ]
    }
  ]
};
