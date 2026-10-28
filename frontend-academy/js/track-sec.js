/* =====================================================================
   PIXEL · Frontend Security & Delivery
   window.TRACKS.sec — modules: threats / delivery
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};
  var ACC = "#fb7185";

  /* ---------- secXssSink: payload x sink ---------- */
  Widgets.secXssSink = function (mount) {
    var h = WK.h;
    WK.shell(mount, "sinks", "Where untrusted text lands decides if it runs",
      "Pick a user-supplied value and the place your code puts it. Nothing here is ever executed; the widget only describes what a browser would do.");
    var PAYLOADS = [
      ["plain", "Hello, Aswin"],
      ["img", "<img src=x onerror=\"stealCookies()\">"],
      ["bold", "<b>bold</b> claim"],
      ["js", "javascript:stealCookies()"]
    ];
    var SINKS = [
      ["text", "JSX text / textContent"],
      ["html", "innerHTML / dangerouslySetInnerHTML"],
      ["clean", "Sanitized HTML (allow-list)"],
      ["href", "Link href attribute"]
    ];
    var p = 1, sink = "text";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function verdict() {
      var id = PAYLOADS[p][0];
      if (sink === "text") return ["safe", WK.GOOD, "Rendered as literal characters. React escapes text children, so markup never becomes elements.", "visible text: " + PAYLOADS[p][1]];
      if (sink === "html") {
        if (id === "img") return ["script runs", WK.BAD, "The browser parses the string into an img element; the broken src fires onerror and runs attacker code with the page's privileges.", "DOM: <img src=\"x\" onerror=\"stealCookies()\">"];
        if (id === "bold") return ["HTML injection", WK.MID, "No script here, but the attacker controls markup: fake forms, misleading content, or a payload one step away from script.", "DOM: <b>bold</b> claim"];
        return ["harmless here", WK.GOOD, "No markup in this value, but the sink is still dangerous for the next value that has some.", "DOM text: " + PAYLOADS[p][1]];
      }
      if (sink === "clean") {
        if (id === "img") return ["neutralized", WK.GOOD, "The allow-list sanitizer drops the event handler attribute. Use a maintained sanitizer, never a homemade regex.", "DOM: <img src=\"x\">"];
        return ["safe", WK.GOOD, "Allowed tags such as b survive; scripts, handlers and dangerous URLs are removed.", "DOM: " + (id === "js" ? "javascript:stealCookies() (plain text)" : PAYLOADS[p][1])];
      }
      if (id === "js") return ["script runs on click", WK.BAD, "A javascript: URL executes when the link is followed. Validate that user URLs use http or https before rendering them.", "DOM: <a href=\"javascript:stealCookies()\">"];
      return ["safe", WK.GOOD, "Treated as a relative URL. Still validate schemes for every user-provided link.", "DOM: <a href=\"" + PAYLOADS[p][1] + "\">"];
    }
    function paint() {
      var v = verdict();
      WK.clear(stage);
      stage.appendChild(h("div", { style: WK.tint(v[1], 16) + "border-radius:10px;padding:10px 12px;" },
        h("div", { style: "display:flex;gap:8px;align-items:center;font-weight:600;" }, WK.badge(v[0], v[1])),
        h("p", { style: "margin:6px 0 0;font-size:0.86rem;" }, v[2])));
      stage.appendChild(h("pre", { style: "margin:10px 0 0;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface-solid);color:var(--text);font-family:var(--font-mono);font-size:0.8rem;white-space:pre-wrap;" }, v[3]));
      WK.readout(readout, [["value", PAYLOADS[p][1]], ["sink", SINKS.filter(function (s) { return s[0] === sink; })[0][1]], ["result", v[0]]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.field("Untrusted value ", WK.select(PAYLOADS.map(function (x, i) { return [String(i), x[1]]; }), "1", function (v) { p = Number(v); paint(); }, "Untrusted value"))));
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment(SINKS, 0, function (v) { sink = v; paint(); }, "Sink")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- secCspBuilder: policy vs attacks ---------- */
  Widgets.secCspBuilder = function (mount) {
    var h = WK.h;
    WK.shell(mount, "policy", "Build a Content Security Policy",
      "Toggle directives and see which attacks the policy stops. Start from a strict baseline and notice what each relaxation costs.");
    var o = { nonce: true, inline: false, evalOk: false, frame: true, base: true, object: true };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function header() {
      var script = ["'self'"];
      if (o.nonce) script.push("'nonce-{per-request}'", "'strict-dynamic'");
      if (o.inline) script.push("'unsafe-inline'");
      if (o.evalOk) script.push("'unsafe-eval'");
      var parts = ["default-src 'self'", "script-src " + script.join(" "), "connect-src 'self' https://api.shop.example"];
      if (o.object) parts.push("object-src 'none'");
      if (o.base) parts.push("base-uri 'none'");
      if (o.frame) parts.push("frame-ancestors 'none'");
      return "Content-Security-Policy: " + parts.join("; ");
    }
    function attacks() {
      var inlineBlocked = o.nonce || !o.inline;
      return [
        ["Injected inline <script>", inlineBlocked, o.nonce && o.inline ? "Blocked: with a nonce present, browsers ignore 'unsafe-inline'." : inlineBlocked ? "Blocked: inline scripts need a matching nonce." : "Runs: 'unsafe-inline' allows any inline script."],
        ["<script src> from evil.example", true, "Blocked: the host is not allowed and the tag has no nonce."],
        ["eval() of attacker string", !o.evalOk, o.evalOk ? "Runs: 'unsafe-eval' re-enables string evaluation." : "Blocked: string evaluation is disabled."],
        ["Framing for clickjacking", o.frame, o.frame ? "Blocked: frame-ancestors 'none'." : "Allowed: any site can frame this page."],
        ["Injected <base href> hijack", o.base, o.base ? "Blocked: base-uri 'none'." : "Allowed: relative script URLs can be redirected."],
        ["Plugin <object> payload", o.object, o.object ? "Blocked: object-src 'none'." : "Falls back to default-src 'self'; explicit 'none' is safer."]
      ];
    }
    function paint() {
      var a = attacks();
      WK.clear(stage);
      stage.appendChild(h("pre", { style: "margin:0 0 10px;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface-solid);color:var(--text);font-family:var(--font-mono);font-size:0.76rem;white-space:pre-wrap;word-break:break-word;" }, header()));
      a.forEach(function (x) {
        stage.appendChild(h("div", { style: "display:flex;gap:10px;align-items:flex-start;margin-bottom:6px;font-size:0.84rem;color:var(--text);" },
          WK.badge(x[1] ? "blocked" : "allowed", x[1] ? WK.GOOD : WK.BAD),
          h("span", {}, h("b", {}, x[0]), " — " + x[2])));
      });
      var blocked = a.filter(function (x) { return x[1]; }).length;
      WK.readout(readout, [["attacks blocked", blocked + " / " + a.length], ["script policy", o.nonce ? "nonce-based" : o.inline ? "unsafe-inline" : "self only"]]);
    }
    function t(k, label) { return WK.toggle(label, o[k], function (v) { o[k] = v; paint(); }); }
    mount.appendChild(h("div", { class: "widget-controls" },
      t("nonce", "nonce + strict-dynamic"), t("inline", "'unsafe-inline'"), t("evalOk", "'unsafe-eval'")));
    mount.appendChild(h("div", { class: "widget-controls" },
      t("frame", "frame-ancestors 'none'"), t("base", "base-uri 'none'"), t("object", "object-src 'none'")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "sec-threats": {
      title: "Frontend threats checkpoint",
      sub: "XSS, CSP, CSRF, cookies and supply chain.",
      questions: [
        { q: "Why is rendering user input as JSX text children safe by default?", options: ["React removes all HTML tags", "React escapes text, so markup characters become literal text instead of elements", "Browsers block scripts in React apps", "JSX runs in a sandbox"], answer: 1,
          explain: "Text children are inserted as text nodes. The danger begins when you opt out with dangerouslySetInnerHTML or set raw HTML yourself." },
        { q: "You must render user-supplied rich text. What is the safe approach?", options: ["A regex that strips <script>", "A maintained allow-list sanitizer before rendering, plus a CSP as a second layer", "Base64-encode it", "Trust it if the user is logged in"], answer: 1,
          explain: "Homemade filters miss event handlers, SVG and URL tricks. Sanitize with an allow-list and back it with a strict CSP." },
        { q: "A strict nonce-based CSP mainly defends against what?", options: ["SQL injection", "Injected scripts executing even if an XSS bug slips through", "DDoS attacks", "Slow images"], answer: 1,
          explain: "CSP is defence in depth: injected scripts without the per-request nonce are refused by the browser." },
        { q: "Which cookie settings best protect a session cookie?", options: ["No flags", "HttpOnly, Secure and SameSite=Lax or Strict", "Store the token in localStorage instead", "Expires in ten years"], answer: 1,
          explain: "HttpOnly keeps scripts from reading it, Secure keeps it on HTTPS, and SameSite stops most cross-site sends that enable CSRF." },
        { q: "A small transitive dependency is compromised in a new release. Which practice limits the damage?", options: ["Always install latest", "Lockfiles, automated advisories, reviewing dependency updates and minimizing dependencies", "Disabling HTTPS", "Copying code from forums"], answer: 1,
          explain: "Pin versions, review updates, scan for advisories and remove packages you do not need." }
      ]
    },
    "sec-delivery": {
      title: "Delivery checkpoint",
      sub: "Builds, environments, CI deploys and feature flags.",
      questions: [
        { q: "Which environment variables end up in the client bundle?", options: ["None", "Those explicitly exposed to the client (for example by a public prefix), which anyone can read", "Only encrypted ones", "All server variables"], answer: 1,
          explain: "Anything shipped to the browser is public. Never put secrets in client-exposed variables; keep them on the server." },
        { q: "Why fingerprint asset filenames (app.3f9a1c.js)?", options: ["Smaller files", "So they can be cached for a year safely; a change produces a new name", "To hide code", "For SEO"], answer: 1,
          explain: "Content hashes allow immutable long-lived caching while HTML stays short-cached to pick up new versions." },
        { q: "What is a preview deployment per pull request good for?", options: ["Nothing", "Reviewing the real build and running end-to-end tests before merging", "Replacing production", "Skipping code review"], answer: 1,
          explain: "Reviewers and tests exercise the exact artifact that will ship." },
        { q: "What makes feature flags safe to depend on?", options: ["Keep them forever", "A safe default when the flag service fails, owners, expiry dates and removal of stale flags", "Evaluate them only in CSS", "Store them in the URL"], answer: 1,
          explain: "Flags are runtime configuration; they need defaults, ownership and cleanup or they become hidden complexity." },
        { q: "Why prefer evaluating flags on the server for a server-rendered page?", options: ["It is required by law", "It avoids a flash of the wrong variant and keeps unreleased code paths out of the client", "Servers are faster at maths", "Clients cannot read JSON"], answer: 1,
          explain: "Server evaluation renders the right variant first time and does not reveal hidden features in client code." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sec = {
    id: "sec",
    name: "Frontend Security & Delivery",
    short: "SEC",
    tagline: "Ship safely and keep shipping",
    color: ACC,
    blurb: "The browser runs your code next to an attacker's input. Stop XSS at the sink, add a strict Content Security Policy, defend against CSRF with cookie settings, manage dependency risk, and deliver through fast builds, CI previews, cache-friendly deploys and feature flags.",
    modules: [
      {
        id: "threats",
        name: "Browser Threats",
        icon: "shield",
        lessons: [
          {
            id: "xss",
            title: "Cross-site scripting (XSS)",
            summary: "Untrusted data becoming code. Escaping by default, and the few sinks that turn it off.",
            minutes: 11,
            tags: ["xss", "sinks", "sanitization"],
            blocks: [
              { t: "p", html: "XSS happens when attacker-controlled data reaches a place where the browser treats it as <strong>code</strong>: HTML, a script, a URL or an event handler. The attacker's script then runs with your user's session." },
              { t: "widget", id: "secXssSink" },
              { t: "table", headers: ["Dangerous sink", "Safer alternative"], rows: [
                ["dangerouslySetInnerHTML / innerHTML", "Text rendering; sanitize with an allow-list if HTML is required"],
                ["href or src from user input", "Allow only http and https schemes"],
                ["eval, new Function, string timers", "Never with data; use real functions"],
                ["document.write, insertAdjacentHTML", "DOM APIs with text nodes"],
                ["Server-rendered JSON in a script tag", "Serialize with escaping of &lt; characters"]
              ] },
              { t: "code", lang: "javascript", code:
                "function SafeLink({ url, children }) {\n" +
                "  let safe = \"#\";\n" +
                "  try {\n" +
                "    const u = new URL(url, window.location.origin);\n" +
                "    if (u.protocol === \"https:\" || u.protocol === \"http:\") safe = u.href;\n" +
                "  } catch {}\n" +
                "  return <a href={safe} rel=\"noopener noreferrer\">{children}</a>;\n" +
                "}" },
              { t: "h", text: "XSS paths specific to React apps" },
              { t: "ul", items: [
                "Serializing server data into a script tag for hydration: escape <code class='tok'>&lt;</code> so a value containing <code class='tok'>&lt;/script&gt;</code> cannot break out.",
                "Spreading untrusted objects into props (<code class='tok'>{...userProps}</code>) can smuggle in <code class='tok'>dangerouslySetInnerHTML</code> or event handlers.",
                "Markdown renderers that allow raw HTML need sanitizing after rendering, not before.",
                "Third-party widgets that call <code class='tok'>innerHTML</code> on your data inherit the same risk; review what you pass them.",
                "Prefer the Trusted Types API where supported to make raw HTML sinks fail loudly unless the value passed through a sanitizer policy."
              ] },
              { t: "note", variant: "trap", html: "Escaping is context-specific. Text that is safe in HTML can still be dangerous inside a URL, a style attribute or an inline script." },
              { t: "note", variant: "key", html: "<strong>Keep untrusted data out of code contexts.</strong> Render as text, validate URL schemes, sanitize with an allow-list when HTML is unavoidable, and back it with CSP." }
            ]
          },
          {
            id: "csp",
            title: "Content Security Policy",
            summary: "A browser-enforced allow-list for scripts and other resources — your second line of defence.",
            minutes: 10,
            tags: ["csp", "nonce", "clickjacking"],
            blocks: [
              { t: "p", html: "A CSP is a response header listing where scripts, styles, frames and connections may come from. If an XSS bug slips through, a strict policy can still stop the injected script from running." },
              { t: "widget", id: "secCspBuilder" },
              { t: "ul", items: [
                "Prefer a <strong>nonce-based</strong> policy with <code class='tok'>'strict-dynamic'</code> over long host allow-lists.",
                "Generate a fresh random nonce per response; a fixed nonce protects nothing.",
                "Add <code class='tok'>object-src 'none'</code>, <code class='tok'>base-uri 'none'</code> and <code class='tok'>frame-ancestors</code>.",
                "Roll out with <code class='tok'>Content-Security-Policy-Report-Only</code> first and watch violation reports."
              ] },
              { t: "h", text: "Issuing a nonce per request" },
              { t: "code", lang: "javascript", code:
                "// middleware (conceptual): fresh nonce for every HTML response\n" +
                "export function middleware(request) {\n" +
                "  const nonce = btoa(crypto.randomUUID());        // CSPRNG-backed, never reused\n" +
                "  const csp = [\n" +
                "    \"default-src 'self'\",\n" +
                "    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,\n" +
                "    \"style-src 'self' 'unsafe-inline'\",           // tighten later if feasible\n" +
                "    \"img-src 'self' blob: data:\",\n" +
                "    \"object-src 'none'\", \"base-uri 'none'\", \"frame-ancestors 'none'\",\n" +
                "  ].join(\"; \");\n" +
                "  const headers = new Headers(request.headers);\n" +
                "  headers.set(\"x-nonce\", nonce);                   // read by the root layout\n" +
                "  const res = NextResponse.next({ request: { headers } });\n" +
                "  res.headers.set(\"Content-Security-Policy\", csp);\n" +
                "  return res;\n" +
                "}" },
              { t: "table", headers: ["Directive", "Controls", "Strict choice"], rows: [
                ["script-src", "Where scripts may load and run", "'nonce-…' 'strict-dynamic'"],
                ["connect-src", "fetch, XHR, WebSocket targets", "'self' plus your API origins"],
                ["img-src / font-src", "Images and fonts", "'self' and known CDNs"],
                ["frame-ancestors", "Who may embed this page", "'none' (or your own origin)"],
                ["form-action", "Where forms may submit", "'self'"],
                ["report-to", "Where violation reports go", "Your own reporting endpoint"]
              ] },
              { t: "note", variant: "tip", html: "Nonces make pages dynamic, because every response is different. Static pages can use hash-based policies for their few inline scripts instead." },
              { t: "note", variant: "warn", html: "Adding <code class='tok'>'unsafe-inline'</code> to make a third-party snippet work quietly removes most of the protection. Load the snippet with a nonce instead." },
              { t: "note", variant: "key", html: "<strong>CSP is defence in depth, not a substitute for escaping.</strong> Use per-request nonces, block objects, base tags and framing, and roll out in report-only mode first." }
            ]
          },
          {
            id: "csrf-cookies",
            title: "CSRF, cookies and tokens",
            summary: "Stop other sites from riding your user's session, and store credentials where scripts cannot reach.",
            minutes: 10,
            tags: ["csrf", "samesite", "httponly", "tokens"],
            blocks: [
              { t: "p", html: "<strong>Cross-site request forgery</strong> tricks the browser into sending an authenticated request from another site, because cookies attach automatically. The defence is to make cross-site requests either cookie-less or rejected." },
              { t: "table", headers: ["Control", "Effect"], rows: [
                ["SameSite=Lax (or Strict)", "Cookies not sent on cross-site subrequests and POSTs"],
                ["HttpOnly", "JavaScript cannot read the cookie, so XSS cannot steal it"],
                ["Secure", "Only sent over HTTPS"],
                ["CSRF token or Origin check on mutations", "Server rejects requests not from your pages"],
                ["No state changes on GET", "Links and images cannot trigger writes"]
              ] },
              { t: "compare", bad: { title: "Token in localStorage", items: ["Readable by any script on the page", "One XSS bug leaks the session", "Must be attached manually"] }, good: { title: "HttpOnly session cookie", items: ["Invisible to JavaScript", "SameSite blocks most CSRF", "Pair with Origin checks for mutations"] } },
              { t: "note", variant: "tip", html: "Server actions and API routes must still check Origin and authorization. Framework CSRF protection helps, but authorization is always your job." },
              { t: "note", variant: "key", html: "<strong>HttpOnly, Secure, SameSite cookies plus server-side checks on every mutation.</strong> Never make writes reachable by GET." }
            ]
          },
          {
            id: "supply-chain",
            title: "Dependency and supply-chain risk",
            summary: "Every package you install runs with your app's privileges — choose, pin and watch them.",
            minutes: 9,
            tags: ["dependencies", "lockfile", "sri", "third-party"],
            blocks: [
              { t: "p", html: "A typical frontend pulls in hundreds of transitive packages. Any one of them, or a hijacked maintainer account, can ship code that reads your users' data." },
              { t: "ol", items: [
                "Commit the lockfile and install with a frozen lockfile in CI.",
                "Enable automated advisories and dependency update pull requests; review the diff, not just the version.",
                "Prefer fewer, well-maintained packages; remove unused ones.",
                "Block install scripts where your package manager supports it, or allow them per package.",
                "Load third-party scripts with Subresource Integrity hashes when self-hosting is not possible."
              ] },
              { t: "stat", items: [{ v: "100s", k: "transitive packages in a typical app" }, { v: "1", k: "compromised package is enough" }, { v: "0", k: "secrets that belong in the client bundle" }] },
              { t: "note", variant: "warn", html: "Third-party tags (analytics, chat, A/B testing) run with full page access. Treat them as dependencies: inventory, review and limit them." },
              { t: "quiz", id: "sec-threats" },
              { t: "note", variant: "key", html: "<strong>Pin, review, minimize and monitor.</strong> Lockfiles, advisories, careful updates and an inventory of third-party scripts." }
            ]
          }
        ]
      },
      {
        id: "delivery",
        name: "Build & Delivery",
        icon: "plug",
        lessons: [
          {
            id: "vite-ci-deploy",
            title: "Builds, CI and deploys",
            summary: "A fast dev server, a reproducible build, preview deploys and cache-friendly releases.",
            minutes: 11,
            tags: ["vite", "ci", "caching", "env"],
            blocks: [
              { t: "p", html: "Modern build tools serve native ES modules in development for instant startup and produce optimized, hashed bundles for production. Your pipeline turns every commit into a tested, deployable artifact." },
              { t: "code", lang: "bash", code:
                "# CI pipeline (conceptual)\n" +
                "pnpm install --frozen-lockfile\n" +
                "pnpm typecheck && pnpm lint\n" +
                "pnpm test -- --run\n" +
                "pnpm build                  # hashed assets in dist/\n" +
                "deploy-preview dist/        # unique URL per pull request\n" +
                "pnpm e2e --base-url \"$PREVIEW_URL\"" },
              { t: "table", headers: ["Asset", "Cache-Control", "Why"], rows: [
                ["index.html", "no-cache (revalidate)", "Always discover the newest asset names"],
                ["app.[hash].js / .css", "public, max-age=31536000, immutable", "Name changes when content changes"],
                ["API responses", "Per endpoint", "Usually private or short-lived"]
              ] },
              { t: "ul", items: [
                "Variables exposed to the client are public. Keep secrets in server environments and CI secret stores.",
                "Build once, promote the same artifact through staging to production.",
                "Keep instant rollback: switch traffic back to the previous artifact.",
                "Upload source maps to your error tracker privately instead of serving them publicly."
              ] },
              { t: "note", variant: "warn", html: "A key named <code class='tok'>PUBLIC_…</code> or similar ends up in the JavaScript any visitor can download. Treat it as published." },
              { t: "note", variant: "key", html: "<strong>Reproducible build, gated pipeline, preview per PR, immutable hashed assets, instant rollback.</strong> And no secrets in the client." }
            ]
          },
          {
            id: "feature-flags",
            title: "Feature flags and progressive delivery",
            summary: "Decouple deploy from release: ship dark, roll out gradually, and turn off fast.",
            minutes: 9,
            tags: ["feature-flags", "rollout", "experiments"],
            blocks: [
              { t: "p", html: "Flags let you merge and deploy unfinished work safely, release to 1% of users, run experiments, and disable a broken feature without a redeploy." },
              { t: "code", lang: "javascript", code:
                "// server component: evaluate once, render the right variant\n" +
                "export default async function Checkout() {\n" +
                "  const flags = await getFlags({ userId: await currentUserId() });\n" +
                "  const newFlow = flags.isOn(\"checkout-v2\", { default: false }); // safe default\n" +
                "  return newFlow ? <CheckoutV2 /> : <CheckoutV1 />;\n" +
                "}\n\n" +
                "// load the new flow's code only when it is on\n" +
                "const CheckoutV2 = lazy(() => import(\"./CheckoutV2\"));" },
              { t: "table", headers: ["Flag type", "Lifetime", "Example"], rows: [
                ["Release", "Days to weeks", "Hide a feature until it is done"],
                ["Experiment", "Weeks", "A/B test of a new layout"],
                ["Ops / kill switch", "Long-lived", "Disable an expensive widget under load"],
                ["Permission", "Long-lived", "Enterprise-only feature"]
              ] },
              { t: "note", variant: "trap", html: "Client-only flag evaluation causes a flash of the old UI and ships hidden features' code to everyone. Evaluate on the server for rendered pages." },
              { t: "quiz", id: "sec-delivery" },
              { t: "note", variant: "key", html: "<strong>Deploy is not release.</strong> Flags need safe defaults, owners and expiry; evaluate them server-side and delete them when done." }
            ]
          }
        ]
      }
    ]
  };
})();
