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
          id: "api-security-deep-dive",
          title: "API security deep dive",
          summary: "Modern APIs expose objects, functions and business flows. Defend each trust boundary explicitly.",
          minutes: 9,
          tags: ["api", "authz", "graphql", "grpc"],
          blocks: [
            { t: "p", html: "API security is application security with fewer browser guardrails and more automation. REST routes, GraphQL resolvers and gRPC methods all cross trust boundaries: client to edge, edge to service, service to data store, and service to service. Every boundary needs authentication, authorization, schema validation, rate limits and logs that match the resource being touched." },
            { t: "h", text: "REST, GraphQL and gRPC trust boundaries" },
            {
              t: "table",
              headers: ["API style", "Where trust commonly breaks", "Defensive move"],
              rows: [
                ["<strong>REST</strong>", "Object ids in paths and nested resources become direct object references.", "Scope every query to the caller and tenant; authorize the object before returning it."],
                ["<strong>GraphQL</strong>", "One endpoint hides many fields, nested objects and resolver paths.", "Apply field/object authorization in resolvers, query depth limits and persisted operations where appropriate."],
                ["<strong>gRPC</strong>", "Strong schemas can create false confidence; service methods still perform sensitive actions.", "Validate messages semantically, authenticate callers with service identity, and authorize every method."]
              ]
            },
            { t: "note", variant: "key", html: "<strong>A schema proves shape, not permission.</strong> A request can be valid JSON, a valid GraphQL query, or a valid protobuf message and still ask for data or actions the caller must not reach." },
            { t: "h", text: "The API authorization trio" },
            {
              t: "table",
              headers: ["Failure", "Question the server forgot to ask", "Example defensive control"],
              rows: [
                ["<strong>BOLA</strong><br>Broken Object Level Authorization", "May this caller access this specific object?", "Fetch resources through tenant/user-scoped queries, not global ids."],
                ["<strong>BFLA</strong><br>Broken Function Level Authorization", "May this caller invoke this function at all?", "Authorize methods and routes server-side; hiding buttons is only UX."],
                ["<strong>BOPLA</strong><br>Broken Object Property Level Authorization", "May this caller read or write this specific field?", "Use response DTOs and explicit writable-field allow-lists."]
              ]
            },
            { t: "p", html: "Object, function and property checks are separate. A user may read one invoice but not refund it. A support analyst may view account status but not export tax identifiers. An admin may update a display name but not directly set <code>isSuperAdmin</code> from a request body." },
            { t: "h", text: "Schema validation and mass assignment" },
            {
              t: "compare",
              bad: { title: "Common API shortcuts", items: ["Bind the entire request body onto a database model", "Accept unknown fields and ignore the scary ones later", "Return internal objects directly from the ORM", "Trust GraphQL selection sets to protect sensitive fields"] },
              good: { title: "Safer contract design", items: ["Reject unknown fields and enforce types, lengths and enum values", "Use separate input/output DTOs per role and operation", "Allow-list writable fields explicitly", "Run authorization before serialization and before mutation"] }
            },
            { t: "note", variant: "trap", html: "<strong>Mass assignment</strong> turns convenience into privilege escalation: the API accepts a field the UI never showed, and the framework writes it anyway. The fix is an explicit allow-list of fields for each operation." },
            { t: "h", text: "Rate limits are not just request counts" },
            { t: "p", html: "APIs also fail through business-flow abuse: coupon guessing, inventory hoarding, login-code spraying, password-reset flooding, scraping, and GraphQL queries that are technically valid but too expensive. Rate limit by user, IP, tenant, device and action; add quotas, idempotency keys, query complexity limits and anomaly alerts." },
            { t: "h", text: "Inventory and versioning" },
            {
              t: "ul", items: [
                "Keep an <strong>API inventory</strong>: owner, data classification, auth method, internet exposure, version, consumers and deprecation date.",
                "Retire shadow and forgotten endpoints; old versions often keep old authorization bugs.",
                "Document which API is public, partner, internal or admin, then enforce that boundary at the gateway and service.",
                "Log object ids, method names, auth decisions and rate-limit decisions with sensitive fields minimized."
              ]
            },
            { t: "note", variant: "key", html: "The best API test is simple to state: for every object, field and function, prove that a caller who should be denied is denied <em>server-side</em>." },
            { t: "quiz", id: "appsec-api-security" }
          ]
        },
        {
          id: "secure-coding-by-stack",
          title: "Secure coding by stack",
          summary: "Translate AppSec principles into framework choices: safe query APIs, output encoding, file handling, parser hardening and secret-safe logs.",
          minutes: 9,
          tags: ["secure-coding", "frameworks", "hardening"],
          blocks: [
            { t: "p", html: "Secure coding is not a separate language from engineering. It is choosing the safe API your stack already provides, keeping untrusted input as data, and making risky operations visible without leaking secrets." },
            { t: "h", text: "The stack-safe checklist" },
            { t: "table", headers: ["Risk", "Use the stack's safe path"], rows: [
              ["SQL or NoSQL injection", "<strong>Safe query APIs</strong>: prepared statements, bind parameters, query builders used without raw concatenation, and allow-listed dynamic identifiers."],
              ["XSS", "<strong>Framework output encoding</strong>: template auto-escaping, React text rendering, contextual encoders for attributes and routes, and sanitization only for approved rich text."],
              ["File upload abuse", "<strong>File handling</strong>: server-generated names, size limits, magic-byte checks, scanning, storage outside web roots, and download through authorization handlers."],
              ["Unsafe parsing", "<strong>Deserialization and XML hardening</strong>: JSON with schema validation, safe YAML only, no native object deserialization, DTDs disabled, no external entities or network fetches."],
              ["Leaky telemetry", "<strong>Logging without secrets</strong>: structured logs with request IDs, sanitized line breaks, redacted tokens and passwords, and no raw session IDs or customer secrets."]
            ] },
            { t: "h", text: "Examples by habit" },
            { t: "compare",
              bad: { title: "Risky habit", items: ["Build SQL with string concatenation", "Disable template escaping to make markup render", "Store uploads under a public path with the original filename", "Parse XML with default entity settings", "Log complete request bodies and headers"] },
              good: { title: "Safer habit", items: ["Bind values through the database driver", "Let the framework render text and sanitize only approved HTML", "Generate object IDs and serve files through checked endpoints", "Reject DTDs and external entities before parsing", "Log stable IDs and redacted fields only"] }
            },
            { t: "h", text: "Refactor review drill" },
            { t: "p", html: "When reviewing code, ask which safe primitive should replace the risky one. The answer should be specific to the stack: prepared statements, template text rendering, upload handlers, safe parsers and redaction filters." },
            { t: "widget", id: "securecode" },
            { t: "note", variant: "key", html: "The goal is not to memorize every framework. Learn the invariant: <strong>separate code from data, encode on output, isolate files, harden parsers, and never put secrets in logs.</strong>" },
            { t: "quiz", id: "appsec-secure-coding" }
          ]
        }
      ]
    },
    /* ============================ AI SECURITY ============================ */
    {
      id: "ai-security",
      name: "AI security",
      icon: "spark",
      lessons: [
        {
          id: "ai-app-security",
          title: "AI application security",
          summary: "LLM features add new trust boundaries: prompts, retrieval, tools, and approvals all need explicit control.",
          minutes: 8,
          tags: ["ai", "llm", "rag", "threat-modeling"],
          blocks: [
            { t: "p", html: "AI features are applications with a new trust boundary. They accept input, retrieve data and may call tools; prompts, retrieved text and model output must be treated as untrusted data." },
            { t: "h", text: "The four recurring risk patterns" },
            {
              t: "table",
              headers: ["Risk", "Defensive question"],
              rows: [
                ["<strong>Prompt injection</strong>", "Can user or retrieved text override system instructions?"],
                ["<strong>RAG access failure</strong>", "Does retrieval enforce the caller's authorization before content reaches the model?"],
                ["<strong>Excessive agency</strong>", "Can the model take sensitive actions without a human or policy gate?"],
                ["<strong>Tool permission drift</strong>", "Are plugins/tools scoped to the task, logged, and denied by default?"]
              ]
            },
            { t: "note", variant: "key", html: "Model instructions are not a security boundary. A prompt can guide behavior, but authorization, data filtering, tool allow-lists, and transaction approval must live in normal application code." },
            { t: "h", text: "RAG: retrieval before reasoning" },
            {
              t: "ul", items: [
                "Filter vector-search results by <strong>tenant, user, document ACL, and purpose</strong> before sending context to the model.",
                "Separate trusted system instructions from untrusted retrieved text; label sources so the model can cite without obeying them.",
                "Watch for retriever poisoning: low-quality or malicious documents that steer answers away from policy.",
                "Log which documents were retrieved so sensitive answers can be audited later."
              ]
            },
            { t: "h", text: "Safe support-bot case study" },
            { t: "p", html: "A support bot can answer account questions and draft refund requests, but the model should never become the authority. Scope retrieval to the current customer and approved help articles, make refund tools create pending requests only, and require policy or human approval for account changes." },
            { t: "compare",
              bad: { title: "Over-trusting the model", items: ["All tickets and all docs in one vector index", "A refund tool with broad account access", "No approval gate for account changes", "Logs only the final answer, not the sources/tools"] },
              good: { title: "Defensible AI feature", items: ["Per-user retrieval authorization", "Tools scoped to one account and one action", "Human approval for sensitive actions", "Full audit trail: prompt, sources, tool call, approver"] }
            },
            { t: "h", text: "Capstone: threat-model an AI support bot" },
            {
              t: "ol", items: [
                "<strong>Draw trust boundaries</strong>: user chat, model service, retriever, vector store, tools, human approval queue, and audit log.",
                "<strong>Map LLM-style categories</strong>: prompt injection, sensitive disclosure, insecure plugin design, excessive agency, and supply-chain trust in prompts/tools.",
                "<strong>Authorize retrieval</strong> before context is assembled, not after the answer is generated.",
                "<strong>Gate tools</strong> with allow-lists, schemas, dry-run previews, human approval for high impact, and deny-on-error behavior."
              ]
            },
            { t: "h2", text: "Rubric / checklist" },
            { t: "table", headers: ["Score area", "What a strong answer includes"], rows: [
              ["Trust-boundary map (25%)", "Named components, data stores, model boundary, retriever boundary, tool boundary, approval queue and audit trail."],
              ["Threat coverage (25%)", "Prompt injection, unauthorized retrieval, sensitive disclosure, tool misuse, poisoned sources, logging/retention risk and fallback behavior."],
              ["Controls (30%)", "Per-user retrieval authorization, least-privilege tools, schemas, dry-run previews, human/policy approval for high impact, deny-on-error and source logging."],
              ["Assessment quality (20%)", "Clear assumptions, residual risks, test cases using synthetic data, monitoring signals and owners for each unresolved risk."]
            ] },
            { t: "p", html: "Use the drill below to balance usefulness against least privilege. The safest bot that still solves the task is the design goal." },
            { t: "widget", id: "aiagent" },
            { t: "quiz", id: "appsec-ai" }
          ]
        },
        {
          id: "ai-offense-defense",
          title: "AI for cyber offense and defense",
          summary: "AI changes the speed and scale of security work. Learn the attacker advantages, defender advantages, and the guardrails that keep this knowledge safe.",
          minutes: 8,
          tags: ["ai", "defense", "threat-modeling"],
          blocks: [
            { t: "p", html: "AI is a force multiplier, not a new law of security. It can summarize, classify, translate, search and prioritize; the security question is whether that work is bounded, reviewed and logged." },
            { t: "h", text: "How attackers can misuse AI" },
            {
              t: "table",
              headers: ["Attacker use", "Defender response"],
              rows: [
                ["<strong>Recon summarization</strong>", "Reduce public leakage; monitor exposed assets, job posts, repos and certificate names."],
                ["<strong>Phishing personalization</strong>", "Use phishing-resistant MFA, user reporting, email authentication and behavior-based detection."],
                ["<strong>Vulnerability triage at scale</strong>", "Patch by exposure and known exploitation; keep asset inventory current."],
                ["<strong>Malware or script variation</strong>", "Detect behavior, not only hashes; watch process trees, unusual tool use and egress."],
                ["<strong>Social-engineering scripts</strong>", "Strengthen helpdesk verification, approval workflows and recovery-event alerts."]
              ]
            },
            { t: "note", variant: "warn", html: "This atlas discusses attacker use at the <strong>conceptual and defensive</strong> level only. Do not use AI to generate phishing, malware, credential theft, bypass instructions or unauthorized testing. Authorization is the line." },
            { t: "h", text: "How defenders can leverage AI" },
            {
              t: "ul", items: [
                "<strong>Alert triage</strong> \u2014 summarize logs, group related events, and propose first checks for an analyst.",
                "<strong>Detection engineering</strong> \u2014 draft rule ideas from incident writeups, then validate them against real telemetry and false positives.",
                "<strong>Threat modeling</strong> \u2014 enumerate assets, trust boundaries, abuse cases and missing controls during design review.",
                "<strong>Secure-code review</strong> \u2014 highlight risky sinks, missing authorization checks and unsafe deserialization for human review.",
                "<strong>Incident response</strong> \u2014 turn messy notes into timelines, stakeholder updates and postmortem action items."
              ]
            },
            { t: "h", text: "The safe operating model" },
            {
              t: "compare",
              bad: { title: "Unsafe AI security workflow", items: ["Paste secrets or raw customer data into a model", "Let generated detections block production without review", "Trust AI explanations without evidence", "Let an agent run tools with broad credentials"] },
              good: { title: "Defensible AI-assisted workflow", items: ["Redact sensitive data and keep audit logs", "Use AI as a draft, not an authority", "Require tests, telemetry and peer review", "Scope tools to read-only first; gate changes with approval"] }
            },
            { t: "note", variant: "key", html: "The mental model: <strong>AI drafts; humans and policy decide</strong>. Use AI to compress toil while deterministic systems keep authorization, irreversible actions and risk acceptance under control." },
            { t: "quiz", id: "appsec-ai" }
          ]
        },
        {
          id: "ai-red-blue-lab",
          title: "AI red-team vs blue-team lab",
          summary: "Test AI systems safely: define abuse cases, run authorized probes, and turn findings into controls.",
          minutes: 8,
          tags: ["ai", "red-team", "blue-team"],
          blocks: [
            { t: "p", html: "<strong>AI red teaming</strong> tests an AI feature for harmful failure modes under explicit authorization. The output is evidence: which boundary failed, what data or tool was exposed, and which control would have stopped it." },
            { t: "h", text: "Safe test categories" },
            {
              t: "table",
              headers: ["Red-team question", "Blue-team control"],
              rows: [
                ["Can untrusted text override policy?", "Treat retrieved/user text as data; enforce policy in code."],
                ["Can the model reveal data the user cannot access?", "Authorize retrieval before context assembly; audit source chunks."],
                ["Can the model call tools beyond the task?", "Tool allow-lists, schemas, dry-runs and approval gates."],
                ["Can poisoned docs steer answers?", "Trusted ingestion, review queues, source scoring and freshness rules."],
                ["Can sensitive output leave logs or chat?", "Output filters, data classification and retention controls."]
              ]
            },
            { t: "p", html: "Use this lab to match safe abuse cases to controls. The goal is a repeatable defender test plan, not harmful content." },
            { t: "widget", id: "airedblue" },
            { t: "note", variant: "warn", html: "AI red teaming must be scoped like any security test: written authorization, test accounts, synthetic data where possible, no real customer harm, and a clear stop condition." },
            { t: "quiz", id: "appsec-ai" }
          ]
        },
        {
          id: "ai-soc-copilot",
          title: "AI SOC copilot workflow",
          summary: "Use AI to compress alert toil while keeping evidence, decisions and containment under analyst control.",
          minutes: 7,
          tags: ["ai", "soc", "detection"],
          blocks: [
            { t: "p", html: "A SOC copilot should reduce analyst toil without replacing judgment. Let it summarize, cluster, enrich and draft timelines; keep the system of record in SIEM, EDR, ticketing and the analyst approval trail." },
            { t: "ol", items: [
              "<strong>Collect evidence</strong> from approved sources: alerts, endpoint events, identity logs, network flows and case notes.",
              "<strong>Summarize</strong> what happened in plain language, preserving links to source event ids.",
              "<strong>Suggest checks</strong> such as related logins, process ancestry, lateral movement and data egress.",
              "<strong>Draft actions</strong> as recommendations, not automatic containment, unless deterministic policy approves.",
              "<strong>Record decisions</strong>: analyst, evidence, action taken, and why the case was closed or escalated."
            ] },
            { t: "compare",
              bad: { title: "Risky copilot", items: ["Closes alerts without review", "Summarizes without source references", "Can isolate hosts or disable users from a prompt alone", "Trains on raw sensitive cases without policy"] },
              good: { title: "Reliable copilot", items: ["Every summary cites event ids", "Actions require policy or analyst approval", "Sensitive data is minimized/redacted", "Outputs are measured for false confidence and missed context"] }
            },
            { t: "note", variant: "key", html: "The SOC rule is simple: <strong>AI can prepare the case; analysts own the decision.</strong> The more destructive the action, the more deterministic the gate must be." }
          ]
        },
        {
          id: "ai-secure-sdlc",
          title: "AI in the secure SDLC",
          summary: "Use AI during design, code review and dependency triage without turning generated output into unreviewed authority.",
          minutes: 7,
          tags: ["ai", "sdlc", "secure-by-design"],
          blocks: [
            { t: "p", html: "AI can move security review earlier by drafting threat models, finding risky sinks, explaining dependency advisories, proposing tests and summarizing design changes. Each output is a <em>candidate</em> until normal engineering review accepts it." },
            { t: "table", headers: ["SDLC step", "AI-assisted security use"], rows: [
              ["Requirements", "Identify abuse cases, sensitive data, roles and trust boundaries."],
              ["Design", "Draft STRIDE-style threats and control options for reviewers."],
              ["Code review", "Flag injection sinks, missing authorization, unsafe parsing and secret handling."],
              ["Dependencies", "Summarize advisories, affected paths and upgrade risk."],
              ["Testing", "Suggest negative tests for authz, validation, rate limits and logging."],
              ["Release", "Generate rollback notes, security checklist deltas and residual-risk summaries."]
            ] },
            { t: "note", variant: "trap", html: "Generated code and generated security advice can both be wrong. Require tests, human review, source citations where possible, and a clear owner for accepting residual risk." },
            { t: "note", variant: "tip", html: "The highest-value pattern is <strong>AI-assisted checklists from your own standards</strong>: feed it the change description and ask what local security requirements need review, then verify manually." }
          ]
        },
        {
          id: "ai-governance",
          title: "AI security governance",
          summary: "Model risk, audit logs, data retention and approval boundaries make AI systems operable and accountable.",
          minutes: 7,
          tags: ["ai", "governance", "risk"],
          blocks: [
            { t: "p", html: "AI governance is the operating system around AI features: who may use them, what data may enter, which models/tools are approved, how outputs are logged, and which actions require review. Without it, every team invents its own risk boundary." },
            { t: "ul", items: [
              "<strong>Data policy</strong> \u2014 classify what may be sent to models; redact secrets and regulated data unless explicitly approved.",
              "<strong>Model and tool registry</strong> \u2014 approved providers, versions, use cases, owners and fallback plans.",
              "<strong>Auditability</strong> \u2014 log prompts, retrieved sources, tool calls, approvals and final actions with sensitive fields minimized.",
              "<strong>Retention</strong> \u2014 define how long prompts, outputs and embeddings are stored and how deletion requests are handled.",
              "<strong>Risk gates</strong> \u2014 human or policy approval for money movement, account changes, external messages and privilege changes.",
              "<strong>Evaluation</strong> \u2014 test for data leakage, unsafe tool calls, hallucinated authority and degraded behavior after prompt/model changes."
            ] },
            { t: "note", variant: "key", html: "Governance should make the safe path easy: approved models, approved data flows, reusable logging, standard approval gates and a clear review process for exceptions." },
            { t: "quiz", id: "appsec-ai" }
          ]
        }
      ]
    },
    /* ============================ HARDENING & SUPPLY CHAIN ============================ */
    {
      id: "hardening",
      name: "Hardening & supply chain",
      icon: "lock",
      lessons: [
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
