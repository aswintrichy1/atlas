/* =====================================================================
   CITADEL · Security Foundations curriculum
   window.TRACKS.core
   Block grammar (rendered by app.js):
     {t:'p', html}              paragraph (inline HTML allowed)
     {t:'h', text}              section heading
     {t:'h2', text}             sub heading
     {t:'ul'|'ol', items:[]}    list (items are inline HTML)
     {t:'code', lang, code}     code card
     {t:'note', variant, html}  callout: tip|key|warn|trap
     {t:'table', headers, rows} data table
     {t:'compare', bad, good}   two-column contrast
     {t:'stat', items}          metric row [{v,k}]
     {t:'diagram', id, caption} inline SVG diagram
     {t:'widget', id}           interactive widget
     {t:'quiz', id}             quiz
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.core = {
  id: "core",
  name: "Security Foundations",
  short: "CORE",
  tagline: "The mental models every defender shares",
  color: "#2dd4bf",
  blurb: "The vocabulary and mental models of security: the CIA triad, the difference between threats, vulnerabilities and risk, defense in depth, threat modeling with STRIDE, and the access-control models that decide who can do what.",
  modules: [
    /* ============================ FOUNDATIONS ============================ */
    {
      id: "foundations",
      name: "Core principles",
      icon: "shield",
      lessons: [
        {
          id: "cia-triad",
          title: "The CIA triad",
          summary: "Confidentiality, Integrity, Availability — the three properties every security control ultimately protects.",
          minutes: 7,
          tags: ["fundamentals", "mental-model"],
          blocks: [
            { t: "p", html: "Almost every security decision you will ever make protects one of three properties. Together they are the <strong>CIA triad</strong> — the north star of the whole field. Name the property at stake and the right control usually becomes obvious." },
            {
              t: "table",
              headers: ["Property", "Means", "Broken when…", "Typical control"],
              rows: [
                ["<strong>Confidentiality</strong>", "Only authorized parties can read the data", "A database leaks; traffic is sniffed", "Encryption, access control"],
                ["<strong>Integrity</strong>", "Data is accurate and unaltered", "A record is tampered with in transit", "Hashing, signatures, MACs"],
                ["<strong>Availability</strong>", "Authorized users can access it when needed", "A DDoS or ransomware takes it down", "Redundancy, backups, rate limits"]
              ]
            },
            { t: "note", variant: "key", html: "The three pull against each other. Lock data down hard enough (confidentiality) and you can hurt availability. Security is the craft of <strong>balancing</strong> the triad for a given system — not maximizing one." },
            { t: "h", text: "A worked example" },
            { t: "p", html: "Think about online banking. <strong>Confidentiality</strong> keeps your balance private. <strong>Integrity</strong> guarantees a $100 transfer doesn't become $1,000 in flight. <strong>Availability</strong> means the app is up on payday. A single feature — say, a transfer — usually depends on all three at once." },
            { t: "h", text: "The supporting cast: AAA and non-repudiation" },
            {
              t: "ul", items: [
                "<strong>Authentication</strong> — proving you are who you claim to be.",
                "<strong>Authorization</strong> — deciding what an authenticated identity may do.",
                "<strong>Accounting (auditing)</strong> — recording who did what, and when.",
                "<strong>Non-repudiation</strong> — a party cannot credibly deny an action (think a digital signature on a contract)."
              ]
            },
            { t: "note", variant: "tip", html: "When you read an incident report, label each impact with a CIA letter. \u201cCustomer emails exposed\u201d is a C breach; \u201csite down 4 hours\u201d is an A breach. The habit sharpens your analysis fast." },
            { t: "h", text: "Classify it yourself" },
            { t: "p", html: "Below, decide which property each scenario threatens. The reasoning is the point — there is often a primary property plus a secondary one." },
            { t: "widget", id: "ciaclassifier" }
          ]
        },
        {
          id: "threats-vulns-risk",
          title: "Threats, vulnerabilities & risk",
          summary: "Three words people use interchangeably — and shouldn't. Getting them straight is what makes risk decisions possible.",
          minutes: 7,
          tags: ["risk", "vocabulary"],
          blocks: [
            { t: "p", html: "\u201cThat's a huge security risk!\u201d is the most over-used sentence in tech. Usually the speaker means a <em>vulnerability</em> or a <em>threat</em>. The distinction is not pedantry — you can only prioritize work once you separate them." },
            {
              t: "table",
              headers: ["Term", "Definition", "Example"],
              rows: [
                ["<strong>Asset</strong>", "Something of value you want to protect", "A customer database"],
                ["<strong>Threat</strong>", "A potential cause of harm (who/what)", "A financially motivated criminal group"],
                ["<strong>Vulnerability</strong>", "A weakness that a threat can exploit", "An unpatched SQL injection flaw"],
                ["<strong>Exploit</strong>", "The method that turns a vuln into an attack", "A crafted request that dumps the DB"],
                ["<strong>Risk</strong>", "The chance and impact of harm", "Likely breach \u2192 fines + lost trust"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>Risk = Likelihood \u00d7 Impact.</strong> A scary-sounding vulnerability with no plausible threat and low impact can be a lower risk than a \u201cboring\u201d one that is trivially exploitable on a crown-jewel asset." },
            { t: "h", text: "The four ways to treat a risk" },
            {
              t: "ul", items: [
                "<strong>Mitigate</strong> — reduce likelihood or impact (patch it, add a control).",
                "<strong>Transfer</strong> — push the impact elsewhere (cyber-insurance, a third party).",
                "<strong>Avoid</strong> — stop doing the risky thing (drop the feature).",
                "<strong>Accept</strong> — knowingly live with it (document and move on)."
              ]
            },
            { t: "compare",
              bad: { title: "Vulnerability-driven panic", items: ["Patch whatever scanner screams loudest", "Ignore who would actually attack you", "No sense of business impact", "Burn out chasing low-risk noise"] },
              good: { title: "Risk-driven prioritization", items: ["Rank by likelihood \u00d7 impact", "Model real threat actors", "Protect crown-jewel assets first", "Accept documented low risks on purpose"] }
            },
            { t: "note", variant: "trap", html: "<strong>Zero risk is not the goal.</strong> It is unachievable and ruinously expensive to chase. The goal is risk that the business has consciously decided it can live with." }
          ]
        },
        {
          id: "defense-in-depth",
          title: "Defense in depth & fail-safe design",
          summary: "No single control holds forever. Layer them so that one failure is an incident, not a catastrophe.",
          minutes: 8,
          tags: ["principles", "architecture"],
          blocks: [
            { t: "p", html: "<strong>Defense in depth</strong> assumes every control will eventually fail and arranges them in layers, so an attacker who beats one still faces the next. A firewall <em>and</em> network segmentation <em>and</em> host hardening <em>and</em> least privilege <em>and</em> monitoring — each independent, each buying time." },
            { t: "diagram", id: "defense-layers", caption: "Layers around the data: beat one and the next still stands." },
            { t: "h", text: "Saltzer & Schroeder: principles that still hold (1975)" },
            {
              t: "table",
              headers: ["Principle", "What it tells you"],
              rows: [
                ["Least privilege", "Grant the minimum access needed, no more"],
                ["Fail-safe defaults", "Deny by default; allow on purpose"],
                ["Economy of mechanism", "Keep security simple — complexity hides bugs"],
                ["Complete mediation", "Check every access, every time"],
                ["Open design", "Don't rely on secrecy of the design itself"],
                ["Separation of privilege", "Require more than one condition to act"],
                ["Least common mechanism", "Don't share resources/state unnecessarily"],
                ["Psychological acceptability", "If it's painful, people route around it"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>\u201cOpen design\u201d is why we don't trust security by obscurity.</strong> Kerckhoffs's principle says a system should stay secure even if everything about it except the key is public. Hiding the algorithm is not a control." },
            { t: "h", text: "Fail closed, not open" },
            { t: "p", html: "When a control errors out, what happens? A door lock that springs open on a power cut <em>fails open</em> — convenient, insecure. An authorization check that <em>denies</em> on exception <em>fails closed</em> — the safe default for security decisions." },
            {
              t: "code", lang: "python", code:
"# Fail closed: any uncertainty -> deny\n" +
"def can_access(user, resource):\n" +
"    try:\n" +
"        return policy.evaluate(user, resource)   # explicit allow\n" +
"    except Exception:\n" +
"        log.warning('authz error -> denying')\n" +
"        return False                              # safe default\n"
            },
            { t: "note", variant: "trap", html: "A surprising number of breaches come from controls that <strong>failed open</strong> under load or error — the check timed out, threw, and the code \u201cjust let it through.\u201d Always make the safe path the default path." },
            { t: "quiz", id: "core-foundations" }
          ]
        }
      ]
    },
    /* ============================ THREAT MODELING ============================ */
    {
      id: "threat-modeling",
      name: "Threat modeling",
      icon: "map",
      lessons: [
        {
          id: "stride",
          title: "Thinking like an attacker: STRIDE",
          summary: "A simple checklist that turns 'what could go wrong?' into six concrete questions you can answer.",
          minutes: 8,
          tags: ["threat-modeling", "stride"],
          blocks: [
            { t: "p", html: "<strong>Threat modeling</strong> is structured paranoia: before you build, you ask what an adversary would try. <strong>STRIDE</strong> (from Microsoft) gives you six lenses so you don't miss a category. Each maps to a security property it violates." },
            {
              t: "table",
              headers: ["STRIDE", "Threat", "Violates", "Defense"],
              rows: [
                ["<strong>S</strong>poofing", "Pretending to be someone else", "Authentication", "Strong auth, MFA"],
                ["<strong>T</strong>ampering", "Modifying data or code", "Integrity", "Signatures, hashes, ACLs"],
                ["<strong>R</strong>epudiation", "Denying you did something", "Non-repudiation", "Audit logs, signing"],
                ["<strong>I</strong>nformation disclosure", "Leaking data", "Confidentiality", "Encryption, access control"],
                ["<strong>D</strong>enial of service", "Making it unavailable", "Availability", "Rate limits, redundancy"],
                ["<strong>E</strong>levation of privilege", "Gaining rights you shouldn't have", "Authorization", "Least privilege, isolation"]
              ]
            },
            { t: "note", variant: "tip", html: "Notice STRIDE is just the CIA triad plus authentication, authorization and non-repudiation, turned into attacker verbs. If you learned CIA + AAA, you already half-know STRIDE." },
            { t: "h", text: "How a session actually runs" },
            {
              t: "ol", items: [
                "<strong>Diagram</strong> the system: components, data stores, and the flows between them.",
                "<strong>Draw trust boundaries</strong> where data crosses from less- to more-trusted zones.",
                "<strong>Apply STRIDE</strong> to each element and each flow — six questions apiece.",
                "<strong>Rank & mitigate</strong> the threats you find, and record what you accept."
              ]
            },
            { t: "note", variant: "key", html: "Threat modeling is cheapest at design time. A whiteboard session that finds a missing trust boundary costs an hour; the same flaw found in production costs an incident." }
          ]
        },
        {
          id: "trust-boundaries",
          title: "Data flows & trust boundaries",
          summary: "The single most useful line on a security diagram is the one where trust changes.",
          minutes: 6,
          tags: ["threat-modeling", "architecture"],
          blocks: [
            { t: "p", html: "A <strong>trust boundary</strong> is any point where data or control passes between zones of different trust — browser to server, service to database, your code to a third-party API. Attacks concentrate at these crossings, because that's where assumptions break." },
            { t: "note", variant: "key", html: "<strong>The golden rule: never trust input that crossed a boundary.</strong> Validate it, authenticate its source, and authorize the action — on the trusted side, every time. Client-side checks are UX, not security." },
            { t: "h", text: "Where the boundaries usually are" },
            {
              t: "ul", items: [
                "The browser \u2194 your backend (everything from a client is attacker-controlled)",
                "Your service \u2194 another internal service (assume the network can be hostile)",
                "Your app \u2194 the database or cache",
                "Your code \u2194 third-party libraries and SaaS APIs",
                "User space \u2194 kernel / host \u2194 hypervisor"
              ]
            },
            { t: "compare",
              bad: { title: "Trust the client", items: ["Hide the 'Delete' button for non-admins and call it done", "Validate the price in JavaScript only", "Believe a user-supplied <code>role=admin</code> field"] },
              good: { title: "Re-check on the server", items: ["Authorize every action server-side", "Recompute prices from trusted data", "Derive role from the session, never the request body"] }
            },
            { t: "note", variant: "trap", html: "\u201cIt's an internal service, it's behind the firewall\u201d is how flat networks turn one foothold into total compromise. Treat internal calls as crossing a boundary too — this is the seed of zero trust." }
          ]
        },
        {
          id: "risk-management",
          title: "Prioritizing with risk",
          summary: "You will always have more findings than time. Risk is how you choose what to fix first.",
          minutes: 6,
          tags: ["risk", "process"],
          blocks: [
            { t: "p", html: "Security work is triage. A risk matrix plots <strong>likelihood</strong> against <strong>impact</strong> so a room full of people can agree on what matters. It is deliberately coarse — the goal is a shared decision, not false precision." },
            {
              t: "table",
              headers: ["", "Low impact", "Medium impact", "High impact"],
              rows: [
                ["<strong>High likelihood</strong>", "Medium", "High", "Critical"],
                ["<strong>Medium likelihood</strong>", "Low", "Medium", "High"],
                ["<strong>Low likelihood</strong>", "Low", "Low", "Medium"]
              ]
            },
            { t: "h", text: "Severity scores you'll meet" },
            {
              t: "ul", items: [
                "<strong>CVSS</strong> — scores a vulnerability's technical severity 0\u201310. A starting point, not the whole story.",
                "<strong>EPSS</strong> — estimates the probability a vuln will be exploited in the wild. Pairs well with CVSS.",
                "<strong>CISA KEV</strong> — a list of vulnerabilities <em>known to be actively exploited</em>. If it's on KEV, stop arguing and patch."
              ]
            },
            { t: "note", variant: "key", html: "A CVSS 9.8 on a server with no network path and no sensitive data may be a lower <em>risk</em> than a CVSS 6 on your internet-facing login. Context — exposure and asset value — is what turns a severity score into a risk." },
            { t: "stat", items: [
              { v: "Likelihood", k: "how probable is exploitation?" },
              { v: "\u00d7 Impact", k: "how bad if it happens?" },
              { v: "= Risk", k: "what you actually rank by" },
              { v: "KEV", k: "the 'drop everything' signal" }
            ] },
            { t: "quiz", id: "core-threat-modeling" }
          ]
        }
      ]
    },
    /* ============================ ACCESS CONTROL ============================ */
    {
      id: "access",
      name: "Identity & access",
      icon: "grid",
      lessons: [
        {
          id: "authn-authz",
          title: "Authentication vs authorization",
          summary: "AuthN proves who you are; AuthZ decides what you may do. Confusing them causes real breaches.",
          minutes: 7,
          tags: ["identity", "fundamentals"],
          blocks: [
            { t: "p", html: "<strong>Authentication (AuthN)</strong> answers \u201cwho are you?\u201d. <strong>Authorization (AuthZ)</strong> answers \u201cwhat are you allowed to do?\u201d. AuthN always comes first, but passing AuthN must never imply broad AuthZ." },
            { t: "h", text: "The three factors of authentication" },
            {
              t: "table",
              headers: ["Factor", "Examples", "Weakness"],
              rows: [
                ["Something you <strong>know</strong>", "Password, PIN", "Phishable, reused, guessable"],
                ["Something you <strong>have</strong>", "Phone, security key, token", "Can be lost or, for SMS, SIM-swapped"],
                ["Something you <strong>are</strong>", "Fingerprint, face", "Can't be changed once leaked"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>MFA = two or more <em>different</em> factors.</strong> A password plus a security question is still one factor (both \u201cknow\u201d). Phishing-resistant MFA (FIDO2/passkeys) beats SMS codes, which can be intercepted or SIM-swapped." },
            { t: "h", text: "Passkeys, token theft, and MFA bypass" },
            { t: "p", html: "<strong>Passkeys</strong> use WebAuthn/FIDO2 cryptography: the private key stays on the user's device, and the browser binds the login to the real site origin. There is no shared password for a fake login page to collect." },
            {
              t: "table",
              headers: ["Attack path", "Defensive control"],
              rows: [
                ["Phishing a password", "Prefer passkeys or hardware security keys for high-risk accounts"],
                ["Stealing a session token", "HttpOnly/Secure cookies, short lifetimes, rotation, and device/session review"],
                ["MFA push fatigue", "Number matching, rate limits, risk-based prompts, and user reporting"],
                ["Adversary-in-the-middle login proxy", "Origin-bound WebAuthn/passkeys; do not rely on OTP alone for admins"]
              ]
            },
            { t: "note", variant: "trap", html: "MFA is not magic if the attacker steals the post-login token. Treat sessions and refresh tokens as crown jewels: keep them out of JavaScript, rotate on risk, revoke on logout, and alert on impossible reuse." },
            { t: "h", text: "Tokens, sessions and SSO in one breath" },
            {
              t: "ul", items: [
                "<strong>Session cookie</strong> — server remembers you; the cookie is a reference to that session.",
                "<strong>JWT</strong> — a signed token the server can verify without a lookup (stateless).",
                "<strong>OAuth 2.0</strong> — delegated <em>authorization</em> (\u201clet this app read my calendar\u201d).",
                "<strong>OIDC</strong> — an authentication layer on top of OAuth (\u201cwho is this user?\u201d).",
                "<strong>SAML</strong> — XML-based SSO common in the enterprise."
              ]
            },
            { t: "note", variant: "trap", html: "OAuth 2.0 is for <em>authorization</em>, not authentication. Apps that used raw OAuth to \u201clog you in\u201d have shipped account-takeover bugs. Use OIDC when you need identity." }
          ]
        },
        {
          id: "federated-identity-saas",
          title: "Federated identity & SaaS security",
          summary: "SSO shifts trust to signed assertions and tokens. Secure the claims, audience, sessions, and recovery paths.",
          minutes: 8,
          tags: ["identity", "sso", "saas"],
          blocks: [
            { t: "p", html: "<strong>Federated identity</strong> lets one identity provider sign a statement that another application trusts. Instead of each SaaS app storing passwords, the user authenticates with the IdP, and the app receives a token or assertion saying who the user is and what context came with the login." },
            { t: "h", text: "The three names you will meet" },
            {
              t: "table",
              headers: ["Protocol", "What it is for", "Common mistake"],
              rows: [
                ["<strong>OAuth 2.0</strong>", "Delegated authorization: a client gets permission to call an API for a user or service.", "Using an access token as proof of login identity."],
                ["<strong>OpenID Connect (OIDC)</strong>", "Authentication layer on OAuth: the IdP issues an ID token about the signed-in user.", "Confusing ID tokens with API access tokens."],
                ["<strong>SAML</strong>", "Enterprise SSO using signed XML assertions between an IdP and a service provider.", "Trusting an assertion without strict audience, issuer, time and signature checks."]
              ]
            },
            { t: "note", variant: "key", html: "<strong>ID token vs access token:</strong> an ID token is meant for the client to learn who authenticated. An access token is meant for an API to decide whether a caller may access a resource. Do not swap their jobs." },
            { t: "h", text: "Assertion trust is precise" },
            {
              t: "ul", items: [
                "Validate the <strong>issuer</strong>: was this token or assertion signed by the IdP you configured?",
                "Validate the <strong>audience</strong>: was it issued for this exact app or API, not a different one?",
                "Validate time bounds: <code>not before</code>, expiry, clock skew and replay identifiers.",
                "Map claims conservatively: groups, roles and email addresses are inputs to authorization, not authorization by themselves.",
                "Keep signing keys rotated and retrieved through trusted metadata, with alerting when keys or IdP settings change."
              ]
            },
            { t: "h", text: "Refresh tokens and SaaS sessions" },
            { t: "p", html: "A refresh token can silently mint new access tokens, so it is closer to a long-lived credential than a temporary login artifact. Store it where scripts cannot read it, rotate it on use when possible, bind it to client context, and revoke it on logout, password reset, device loss, or suspicious reuse." },
            {
              t: "compare",
              bad: { title: "Fragile SaaS identity", items: ["Long-lived refresh tokens with no rotation", "Logout clears only the browser but leaves server sessions alive", "SAML assertions accepted for the wrong audience", "Helpdesk can reset MFA from a caller's story alone"] },
              good: { title: "Defensible federation", items: ["Short lifetimes plus refresh-token rotation", "Central session and token revocation", "Strict issuer, audience, signature and time validation", "Step-up verification and logging for MFA reset workflows"] }
            },
            { t: "note", variant: "warn", html: "<strong>Helpdesk and MFA reset flows are identity controls.</strong> Attackers often bypass strong login by socially engineering recovery. Require verified channels, supervisor approval for high-risk accounts, cooldowns, alerts to the user, and audit logs that record who approved the reset." },
            { t: "quiz", id: "core-federated-identity" }
          ]
        },
        {
          id: "access-control-models",
          title: "Access-control models",
          summary: "DAC, MAC, RBAC and ABAC — four ways to answer 'can this subject do this action on this object?'.",
          minutes: 8,
          tags: ["access-control", "models"],
          blocks: [
            { t: "p", html: "Every access decision is a triple: a <strong>subject</strong> (user/service) wants to perform an <strong>action</strong> on an <strong>object</strong> (resource). The model is how you decide yes or no — and how that decision scales to thousands of users." },
            {
              t: "table",
              headers: ["Model", "Decision based on", "Good for"],
              rows: [
                ["<strong>DAC</strong> — Discretionary", "The object owner's choice", "Files, shared docs"],
                ["<strong>MAC</strong> — Mandatory", "System-enforced labels (e.g. Secret)", "Military, high-assurance"],
                ["<strong>RBAC</strong> — Role-based", "The subject's role(s)", "Most business apps"],
                ["<strong>ABAC</strong> — Attribute-based", "Attributes + context (time, location)", "Fine-grained, dynamic policy"]
              ]
            },
            { t: "note", variant: "key", html: "<strong>RBAC is the workhorse.</strong> Assign permissions to roles, assign roles to people. When someone changes teams you swap their role, not 40 individual grants. ABAC adds context when roles aren't expressive enough." },
            { t: "h", text: "See RBAC as a matrix" },
            { t: "p", html: "An access-control matrix is just subjects \u00d7 objects with the allowed actions in each cell. Toggle roles below and watch which actions a user inherits." },
            { t: "widget", id: "rbac" },
            { t: "note", variant: "trap", html: "<strong>Role explosion</strong> is the classic RBAC failure: a new role for every edge case until you have more roles than users. When you get there, that's the signal to move some decisions to ABAC attributes." }
          ]
        },
        {
          id: "least-privilege",
          title: "Least privilege & separation of duties",
          summary: "The two principles that contain the blast radius when — not if — an account is compromised.",
          minutes: 6,
          tags: ["principles", "access-control"],
          blocks: [
            { t: "p", html: "<strong>Least privilege</strong>: every identity gets the minimum access required to do its job, and no more. When that account is phished or that service is popped, the damage is bounded by what it could legitimately touch." },
            { t: "note", variant: "key", html: "Least privilege is the highest-leverage control there is. It doesn't prevent the initial compromise — it shrinks the <strong>blast radius</strong>, turning \u201cgame over\u201d into \u201ccontained incident.\u201d" },
            { t: "h", text: "Putting it into practice" },
            {
              t: "ul", items: [
                "Default deny; grant specific permissions explicitly.",
                "Prefer short-lived, scoped credentials over long-lived secrets.",
                "Use <strong>just-in-time</strong> elevation instead of standing admin rights.",
                "Review and revoke access regularly — joiners, movers, leavers.",
                "Give services their own identities; never share one admin key."
              ]
            },
            { t: "h", text: "Separation of duties" },
            { t: "p", html: "<strong>Separation of duties (SoD)</strong> requires more than one person (or system) to complete a sensitive action — the developer who writes a payment change can't also approve and deploy it alone. It defeats both fraud and single-point mistakes." },
            { t: "compare",
              bad: { title: "Standing privilege", items: ["Everyone's an admin 'to be safe'", "One shared root key in a wiki", "Access never expires", "Same person codes, approves & deploys"] },
              good: { title: "Least privilege + SoD", items: ["Scoped roles, default deny", "Per-service identities, rotated", "Just-in-time elevation with expiry", "Author \u2260 approver for risky changes"] }
            },
            { t: "note", variant: "tip", html: "Assume breach. Design as if an attacker already has one valid account, then ask: how far can they get? Least privilege and segmentation are the answers that keep that number small." },
            { t: "quiz", id: "core-access" }
          ]
        }
      ]
    }
  ]
};
