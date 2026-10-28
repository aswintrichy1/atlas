/* =====================================================================
   ANVIL · Security
   window.TRACKS.sec — modules: authn / authz
   Registers its own widgets, quizzes and track data. Uses window.AnvilKit.
   The JWT widget shows decoded claims only; no encoded tokens appear here.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.AnvilKit;
  var h = K.h, J = K.J;
  var Widgets = {};

  /* ==================================================================
     secJwt — walk a bearer token through resource-server validation
  ================================================================== */
  var NOW = 1800000000;
  function baseToken() {
    return {
      header: { alg: "RS256", kid: "key-2026-10", typ: "JWT" },
      payload: { iss: "https://auth.shop.example", aud: ["orders-api"], sub: "customer-4821", scope: "orders:read orders:write", iat: NOW - 120, nbf: NOW - 120, exp: NOW + 480 },
      signature: "valid"
    };
  }
  var TOKEN_CASES = {
    valid: { label: "Valid token", tweak: function () {} },
    expired: { label: "Expired", tweak: function (t) { t.payload.iat = NOW - 4000; t.payload.nbf = NOW - 4000; t.payload.exp = NOW - 600; } },
    audience: { label: "Wrong audience", tweak: function (t) { t.payload.aud = ["reporting-api"]; } },
    issuer: { label: "Unknown issuer", tweak: function (t) { t.payload.iss = "https://login.attacker.example"; } },
    none: { label: "alg: none", tweak: function (t) { t.header.alg = "none"; t.signature = "absent"; } },
    tampered: { label: "Tampered payload", tweak: function (t) { t.payload.sub = "customer-0001"; t.signature = "mismatch"; } },
    scope: { label: "Missing scope", tweak: function (t) { t.payload.scope = "orders:read"; } }
  };

  function validate(t) {
    var checks = [];
    var allowedAlg = t.header.alg === "RS256" || t.header.alg === "ES256";
    checks.push({ name: "Algorithm is on the allow-list (RS256 / ES256)", ok: allowedAlg, fail: 401 });
    checks.push({ name: "Signature verifies with JWKS key \"" + t.header.kid + "\"", ok: allowedAlg && t.signature === "valid", fail: 401 });
    checks.push({ name: "iss equals the configured issuer", ok: t.payload.iss === "https://auth.shop.example", fail: 401 });
    checks.push({ name: "aud contains \"orders-api\"", ok: t.payload.aud.indexOf("orders-api") !== -1, fail: 401 });
    checks.push({ name: "Not expired, already valid (60 s clock skew)", ok: t.payload.exp + 60 > NOW && t.payload.nbf - 60 <= NOW, fail: 401 });
    checks.push({ name: "Authorization: POST /orders needs SCOPE_orders:write", ok: t.payload.scope.split(" ").indexOf("orders:write") !== -1, fail: 403 });
    var firstFail = null;
    checks.forEach(function (c) { if (!firstFail && !c.ok) firstFail = c; });
    return { checks: checks, status: firstFail ? firstFail.fail : 201, firstFail: firstFail };
  }

  var CASE_NOTES = {
    valid: "Every check passes; the request reaches the controller with an authenticated principal and SCOPE_ authorities.",
    expired: "Short-lived access tokens limit the damage of a leak. The client should refresh, not the server extend.",
    audience: "A token minted for another API must not be accepted here, or one compromised service can replay tokens against all others.",
    issuer: "Only tokens from your configured authorization server are trusted; the issuer also decides which JWKS keys apply.",
    none: "An unsigned token must never be accepted. Pin allowed algorithms instead of trusting the header.",
    tampered: "Changing any claim invalidates the signature. Claims are only base64-encoded, not encrypted: anyone can read them, nobody can change them.",
    scope: "Authentication succeeded, so this is 403 Forbidden, not 401: the caller is known but not allowed to do this."
  };

  Widgets.secJwt = function (mount) {
    K.shell(mount, "inspect", "JWT validation walk-through",
      "A client sends POST /orders with a bearer token. Pick a token variant and watch Spring Security's resource-server checks run in order. Only decoded claims are shown; the signature is represented by its verification result.");
    var which = "valid";
    var stage = h("div", { class: "w-stage", style: "display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var t = baseToken();
      TOKEN_CASES[which].tweak(t);
      var r = validate(t);
      K.clear(stage);
      stage.appendChild(h("pre", { style: "font-family:var(--font-mono);font-size:0.74rem;margin:0;white-space:pre-wrap" },
        "header  " + JSON.stringify(t.header, null, 1).replace(/\n\s*/g, " ") + "\n\npayload " + JSON.stringify(t.payload, null, 2) + "\n\nsignature: " + t.signature));
      var list = h("div", { style: "display:grid;gap:6px;align-content:start" });
      var stopped = false;
      r.checks.forEach(function (c) {
        var state = stopped ? "skipped" : c.ok ? "pass" : "fail";
        if (!c.ok) stopped = true;
        list.appendChild(h("div", { style: "display:flex;gap:8px;align-items:flex-start;font-size:0.82rem;opacity:" + (state === "skipped" ? "0.5" : "1") },
          h("b", { style: "min-width:48px;color:" + (state === "pass" ? "var(--lime-ink)" : state === "fail" ? "var(--rose-ink)" : "var(--text-faint)") }, state),
          h("span", {}, c.name)));
      });
      stage.appendChild(list);
      K.clear(readout);
      readout.appendChild(h("span", { class: "ro", style: "color:" + (r.status === 201 ? "var(--lime-ink)" : "var(--rose-ink)") }, "response ", h("b", {}, String(r.status) + (r.status === 201 ? " Created" : r.status === 401 ? " Unauthorized" : " Forbidden"))));
      readout.appendChild(K.wide(CASE_NOTES[which]));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment(Object.keys(TOKEN_CASES).map(function (k) { return [k, TOKEN_CASES[k].label]; }), 0, function (v) { which = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "sec-authn": {
      title: "Authentication checkpoint",
      sub: "The filter chain, OAuth2 resource servers and JWT validation.",
      questions: [
        {
          q: "Where does Spring Security do its work for a servlet application?",
          options: ["Inside each controller method", "In a chain of servlet filters that runs before the DispatcherServlet", "In the JPA layer", "In the embedded server's TLS handshake"],
          answer: 1,
          explain: "Spring Security installs a FilterChainProxy holding one or more SecurityFilterChains. Authentication, CSRF, CORS, exception translation and authorization all happen there, before your controller runs."
        },
        {
          q: "A pure bearer-token API with no cookies or browser sessions. What is the usual CSRF setting?",
          options: ["Keep CSRF protection on and require tokens from every client", "CSRF can be disabled, because browsers do not attach bearer tokens automatically", "CSRF is required by OAuth2", "Disable CORS instead"],
          answer: 1,
          explain: "CSRF abuses credentials the browser sends automatically, such as cookies. Bearer tokens in an Authorization header are not sent automatically, so CSRF protection is unnecessary for such APIs; keep it for cookie-based sessions."
        },
        {
          q: "What does setting spring.security.oauth2.resourceserver.jwt.issuer-uri give you?",
          options: ["A login page", "Discovery of the issuer's JWKS keys and validation of signature, issuer and timestamps for incoming JWTs", "A user database", "Automatic token refresh for clients"],
          answer: 1,
          explain: "The resource server fetches the issuer's metadata and public keys, verifies signatures and validates iss, exp and nbf. Audience validation should be added explicitly for your API."
        },
        {
          q: "Why must a resource server pin the allowed signing algorithms instead of trusting the token header?",
          options: ["Headers are encrypted", "An attacker controls the header; trusting alg enables attacks like unsigned tokens or algorithm confusion", "It speeds up parsing", "JWKS requires it"],
          answer: 1,
          explain: "The token header is attacker-supplied input. The server decides which algorithms and keys are acceptable; a token claiming alg none or a different key type must be rejected."
        },
        {
          q: "A valid, unexpired token lacks the scope required for an endpoint. Which status should the API return?",
          options: ["401 Unauthorized", "403 Forbidden", "404 Not Found always", "500"],
          answer: 1,
          explain: "Authentication succeeded, so the problem is authorization. 401 tells a client to authenticate again, which would not help."
        }
      ]
    },
    "sec-authz": {
      title: "Authorization and secrets checkpoint",
      sub: "Method security, object-level access, secrets and password storage.",
      questions: [
        {
          q: "GET /orders/{id} checks that the caller is authenticated but returns any order id they ask for. What class of vulnerability is this?",
          options: ["SQL injection", "Broken object-level authorization (insecure direct object reference)", "Cross-site scripting", "CSRF"],
          answer: 1,
          explain: "Authenticating the caller is not enough; each object must be checked against the caller's rights. This is the most common serious API flaw: enumerate ids and read everyone's data."
        },
        {
          q: "Which annotation expresses 'only callers that may read this order' on a service method?",
          options: ["@Secured(\"ROLE_USER\")", "@PreAuthorize(\"@orderAccess.canRead(authentication, #orderId)\")", "@Transactional(readOnly = true)", "@RolesAllowed(\"*\")"],
          answer: 1,
          explain: "@PreAuthorize with a bean reference lets you call domain logic, such as ownership or tenant checks, with the authentication and method arguments. Role checks alone cannot express object ownership."
        },
        {
          q: "What should the default rule be at the end of a SecurityFilterChain's authorizeHttpRequests block?",
          options: ["anyRequest().permitAll()", "anyRequest().authenticated() or denyAll(), with public endpoints listed explicitly", "No rule", "anyRequest().hasRole(\"ADMIN\")"],
          answer: 1,
          explain: "Deny by default means a new endpoint is protected until someone deliberately opens it. Permit-all defaults expose endpoints by accident."
        },
        {
          q: "How should user passwords be stored?",
          options: ["Encrypted with AES so they can be recovered", "Hashed with SHA-256", "Hashed with a slow, salted password hash such as Argon2id or bcrypt, via Spring's PasswordEncoder", "Base64-encoded"],
          answer: 2,
          explain: "Password hashes must be slow and salted to resist offline guessing. Fast hashes like SHA-256 (and broken ones like MD5) are unsuitable; reversible encryption means a key leak exposes every password."
        },
        {
          q: "Which practice keeps database credentials out of source control while allowing rotation?",
          options: ["A private Git repository", "Placeholders like ${DB_PASSWORD} resolved from a secret manager or mounted secret at runtime", "Obfuscating the password in code", "Storing it in a constant class"],
          answer: 1,
          explain: "Secrets in a repository spread to every clone and CI log and cannot be rotated without a commit. Resolving them at runtime from the platform keeps them out of code and makes rotation an operational task."
        }
      ]
    },
    "sec-hardening": {
      title: "Hardening checkpoint",
      sub: "CORS and CSRF for APIs, service-to-service auth and injection defences.",
      questions: [
        {
          q: "A browser SPA on https://app.shop.example calls your API with a session cookie. Which configuration is correct?",
          options: ["Disable CSRF, allow origin *", "Keep CSRF on (for example a cookie-to-header token), and allow exactly that origin with credentials", "Disable CORS so all origins work", "CSRF only matters for GET requests"],
          answer: 1,
          explain: "Cookies are attached automatically, so cookie-authenticated state changes need CSRF protection. Credentialed CORS requires explicit origins; a wildcard with credentials is rejected and unsafe."
        },
        {
          q: "What does CORS actually protect?",
          options: ["Your API from attackers using curl", "Users' browsers: it controls which other origins' scripts may read your responses", "Database credentials", "TLS certificates"],
          answer: 1,
          explain: "CORS is a browser read-permission mechanism. Non-browser clients ignore it, so it is never a substitute for authentication and authorization."
        },
        {
          q: "Service A calls service B with no user involved (a nightly sync). Which OAuth2 flow fits?",
          options: ["Authorization code with PKCE", "Client credentials: A authenticates as itself and gets a narrowly scoped token for B", "Forward an admin user's token", "A shared static API key in the code"],
          answer: 1,
          explain: "Client credentials issues a token to the service identity, with scopes and audience limited to what it needs. Its secret comes from the secret store, never from source."
        },
        {
          q: "Which JPQL is safe against injection?",
          options: ["\"... where p.name = '\" + name + \"'\"", "\"... where p.name = :name\" with setParameter(\"name\", name)", "Escaping quotes by hand with replace(\"'\", \"''\")", "Using a native query instead"],
          answer: 1,
          explain: "Bound parameters keep data separate from the query text in JPQL and SQL alike. Hand escaping misses cases, and native queries are equally injectable when concatenated."
        },
        {
          q: "A controller binds @RequestBody directly to the User JPA entity. What is the main risk?",
          options: ["Slower JSON parsing", "Mass assignment: clients can set fields like role or tenantId that the API never meant to expose", "Hibernate refuses to save it", "It breaks OpenAPI generation"],
          answer: 1,
          explain: "Bind to a request record with only the writable fields, validate it, and map onto the entity explicitly in the service."
        }
      ]
    },
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sec = {
    id: "sec",
    name: "Security",
    short: "SEC",
    tagline: "Authenticate every call, authorize every object",
    color: "#34d399",
    blurb: "Secure Spring services the way production systems do: how the Spring Security filter chain works, running an OAuth2 resource server, validating JWTs properly, method- and object-level authorization, and handling secrets and passwords without ever putting them in code.",
    modules: [
      {
        id: "authn",
        name: "Authentication",
        icon: "shield",
        lessons: [
          {
            id: "filter-chain",
            title: "The Spring Security filter chain",
            summary: "How requests flow through Spring Security's filters, configuring a stateless API chain, CSRF and CORS decisions, and multiple chains.",
            minutes: 10,
            tags: ["spring-security", "filters", "csrf", "cors"],
            blocks: [
              { t: "p", html: "Spring Security is a set of servlet <strong>filters</strong>. A single registered filter delegates to a <code class='tok'>FilterChainProxy</code>, which picks the first matching <code class='tok'>SecurityFilterChain</code> and runs its filters in a fixed order before your controller sees the request." },
              { t: "diagram", id: "security-filter-chain", caption: "Authentication filters populate the security context; exception translation turns failures into 401 or 403; authorization decides." },
              { t: "code", lang: "java", code: J([
                "@Configuration",
                "@EnableMethodSecurity",
                "class SecurityConfig {",
                "",
                "  @Bean",
                "  SecurityFilterChain api(HttpSecurity http) throws Exception {",
                "    http",
                "      .securityMatcher(\"/api/**\")",
                "      .authorizeHttpRequests(auth -> auth",
                "          .requestMatchers(HttpMethod.GET, \"/api/catalog/**\").permitAll()",
                "          .requestMatchers(\"/api/admin/**\").hasAuthority(\"SCOPE_admin\")",
                "          .anyRequest().authenticated())            // deny by default",
                "      .oauth2ResourceServer(rs -> rs.jwt(Customizer.withDefaults()))",
                "      .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))",
                "      .csrf(csrf -> csrf.disable())                 // bearer tokens only, no cookies",
                "      .cors(Customizer.withDefaults());",
                "    return http.build();",
                "  }",
                "}"
              ]) },
              { t: "table", headers: ["Filter (simplified order)", "Job"], rows: [
                ["CorsFilter", "Answer preflights; allow only configured origins"],
                ["CsrfFilter", "Require a token for state-changing cookie-authenticated requests"],
                ["BearerTokenAuthenticationFilter", "Extract and validate the bearer token"],
                ["ExceptionTranslationFilter", "Turn authentication failures into 401, access denied into 403"],
                ["AuthorizationFilter", "Apply authorizeHttpRequests rules"]
              ] },
              { t: "note", variant: "warn", html: "<strong>Only disable CSRF when no cookies authenticate.</strong> If a browser front end uses a session cookie, keep CSRF protection on. Bearer-only APIs are not exposed to CSRF because browsers do not attach those headers automatically." },
              { t: "ul", items: [
                "CORS: list exact origins such as <code class='tok'>https://app.shop.example</code>; never combine wildcard origins with credentials.",
                "Use separate chains with <code class='tok'>securityMatcher</code> for, say, the API and Actuator, each with its own rules.",
                "Security headers (HSTS, content-type options, frame options) are on by default; do not strip them."
              ] },
              { t: "p", html: "Transport security and authentication basics at system level: <a class='inline' href='../hld-lld-academy/index.html#/hld/protocols-security/https-auth'>Blueprint: HTTPS and auth</a>." },
              { t: "note", variant: "key", html: "<strong>Security happens in filters before your code.</strong> Configure a stateless chain per surface, deny by default, and choose CSRF and CORS settings from how clients actually authenticate." }
            ]
          },
          {
            id: "oauth2-resource-server",
            title: "Running an OAuth2 resource server",
            summary: "Accept access tokens from an authorization server, map scopes and roles to authorities, and call other services with client credentials.",
            minutes: 9,
            tags: ["oauth2", "resource-server", "scopes"],
            blocks: [
              { t: "p", html: "In OAuth2, an <strong>authorization server</strong> issues access tokens, a <strong>client</strong> obtains them, and your API is a <strong>resource server</strong> that validates them on every request. Your service never sees user passwords; it trusts signed tokens from a configured issuer." },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  security:",
                "    oauth2:",
                "      resourceserver:",
                "        jwt:",
                "          issuer-uri: https://auth.shop.example        # metadata + JWKS discovered from here",
                "          audiences: orders-api                        # reject tokens minted for other APIs"
              ]) },
              { t: "h", text: "Scopes, roles and authorities" },
              { t: "p", html: "By default each entry in the <code class='tok'>scope</code> claim becomes an authority prefixed with <code class='tok'>SCOPE_</code>. If your issuer puts roles in a custom claim, map them explicitly:" },
              { t: "code", lang: "java", code: J([
                "@Bean",
                "JwtAuthenticationConverter jwtAuthenticationConverter() {",
                "  var roles = new JwtGrantedAuthoritiesConverter();",
                "  roles.setAuthoritiesClaimName(\"roles\");",
                "  roles.setAuthorityPrefix(\"ROLE_\");",
                "  var converter = new JwtAuthenticationConverter();",
                "  converter.setJwtGrantedAuthoritiesConverter(roles);",
                "  return converter;",
                "}"
              ]) },
              { t: "table", headers: ["Token type", "Validation", "Trade-off"], rows: [
                ["JWT", "Locally with the issuer's public keys", "Fast, offline; revocation only by expiry"],
                ["Opaque token", "Introspection call to the authorization server", "Instant revocation; a network call per request (cache it)"]
              ] },
              { t: "h", text: "Service-to-service calls" },
              { t: "p", html: "When your service calls another API on its own behalf, it uses the <strong>client credentials</strong> grant: Spring Security's OAuth2 client obtains and caches a token, and an interceptor adds it to outgoing requests. The client secret comes from the platform as <code class='tok'>${ORDERS_CLIENT_SECRET}</code>, or better, workload identity removes the secret entirely." },
              { t: "note", variant: "trap", html: "<strong>Forwarding the user's token everywhere spreads its power.</strong> A token with broad audience accepted by every service lets any compromised service act as the user everywhere. Use narrow audiences and token exchange or client credentials for downstream calls." },
              { t: "note", variant: "key", html: "<strong>Trust one issuer, check the audience, map authorities deliberately.</strong> Validate tokens on every request and use client credentials or token exchange for your own outbound calls." }
            ]
          },
          {
            id: "jwt-validation",
            title: "Validating JWTs properly",
            summary: "The checks a resource server must make, algorithm pinning, key rotation, clock skew, revocation and what never to put in claims.",
            minutes: 10,
            tags: ["jwt", "jwks", "token-validation"],
            blocks: [
              { t: "p", html: "A JWT is a set of claims with a signature. It is <strong>signed, not encrypted</strong>: anyone holding it can read the claims; only the issuer can produce a valid signature. Accepting one safely means running every check, in order, every time." },
              { t: "widget", id: "secJwt" },
              { t: "ol", items: [
                "Parse and accept only expected algorithms (for example RS256 or ES256). Reject <code class='tok'>none</code>.",
                "Verify the signature with the key identified by <code class='tok'>kid</code> from the issuer's JWKS.",
                "Check <code class='tok'>iss</code> is your authorization server.",
                "Check <code class='tok'>aud</code> contains your API.",
                "Check <code class='tok'>exp</code> and <code class='tok'>nbf</code> with a small clock skew allowance.",
                "Then authorize: scopes, roles and object-level rules."
              ] },
              { t: "code", lang: "java", code: J([
                "@Bean",
                "JwtDecoder jwtDecoder(@Value(\"${spring.security.oauth2.resourceserver.jwt.issuer-uri}\") String issuer) {",
                "  NimbusJwtDecoder decoder = JwtDecoders.fromIssuerLocation(issuer);",
                "  OAuth2TokenValidator<Jwt> audience = new JwtClaimValidator<List<String>>(",
                "      JwtClaimNames.AUD, aud -> aud != null && aud.contains(\"orders-api\"));",
                "  decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(",
                "      JwtValidators.createDefaultWithIssuer(issuer), audience));",
                "  return decoder;",
                "}"
              ]) },
              { t: "ul", items: [
                "Keys rotate: the decoder caches the JWKS and refetches on an unknown <code class='tok'>kid</code>. Never pin a single public key in config.",
                "Keep access tokens short-lived (minutes). Revocation of JWTs is otherwise only possible with deny lists or introspection.",
                "Never put secrets or sensitive personal data in claims; they are readable by anyone who sees the token.",
                "Never log full tokens; log the subject or a token id instead."
              ] },
              { t: "note", variant: "trap", html: "<strong>Decoding is not validating.</strong> Code that base64-decodes the payload to read <code class='tok'>sub</code> without verifying the signature trusts anything an attacker writes. Always go through the configured <code class='tok'>JwtDecoder</code>." },
              { t: "quiz", id: "sec-authn" },
              { t: "note", variant: "key", html: "<strong>Algorithm, signature, issuer, audience, time \u2014 then authorization.</strong> Pin algorithms, follow key rotation through JWKS, keep tokens short-lived, and keep sensitive data out of claims and logs." }
            ]
          }
        ]
      },
      {
        id: "authz",
        name: "Authorization & Secrets",
        icon: "blocks",
        lessons: [
          {
            id: "method-security",
            title: "Method security and object-level authorization",
            summary: "Authorize at the service layer with @PreAuthorize, enforce ownership and tenancy per object, and test the rules.",
            minutes: 10,
            tags: ["authorization", "preauthorize", "multi-tenancy"],
            blocks: [
              { t: "p", html: "URL rules answer 'may this caller use this endpoint?'. Most real breaches happen one level down: 'may this caller see <em>this order</em>?'. <strong>Method security</strong> puts authorization next to the use case, where you know which object is involved." },
              { t: "code", lang: "java", code: J([
                "@Service",
                "class OrderQueries {",
                "",
                "  @PreAuthorize(\"hasAuthority('SCOPE_orders:read') and @orderAccess.canRead(authentication, #orderId)\")",
                "  public OrderView get(long orderId) { ... }",
                "",
                "  @PreAuthorize(\"hasAuthority('SCOPE_orders:admin')\")",
                "  public Page<OrderView> search(OrderSearch criteria, Pageable page) { ... }",
                "}",
                "",
                "@Component(\"orderAccess\")",
                "class OrderAccess {",
                "  boolean canRead(Authentication auth, long orderId) {",
                "    String customer = ((Jwt) auth.getPrincipal()).getSubject();",
                "    return orders.isOwnedBy(orderId, customer);   // cheap, indexed ownership check",
                "  }",
                "}"
              ]) },
              { t: "ul", items: [
                "Enable with <code class='tok'>@EnableMethodSecurity</code>; annotations work through proxies, so self-invocation skips them.",
                "Prefer scoping queries by owner or tenant (<code class='tok'>where tenant_id = :tenant</code>) so unauthorized rows are never loaded at all.",
                "Return 404 rather than 403 for objects the caller must not know exist, consistently.",
                "Admin and support access paths need the same rigour, plus audit logging."
              ] },
              { t: "h", text: "Test the rules" },
              { t: "code", lang: "java", code: J([
                "@WebMvcTest(OrderController.class)",
                "class OrderAccessTest {",
                "  @Autowired MockMvc mvc;",
                "",
                "  @Test",
                "  void customerCannotReadSomeoneElsesOrder() throws Exception {",
                "    mvc.perform(get(\"/api/orders/77\")",
                "            .with(jwt().jwt(j -> j.subject(\"customer-1\")).authorities(new SimpleGrantedAuthority(\"SCOPE_orders:read\"))))",
                "       .andExpect(status().isNotFound());",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Trusting ids from the client is the classic API breach.</strong> A tenant id or customer id in the request body or path is a claim, not a fact. Derive identity from the validated token and check ownership server-side." },
              { t: "note", variant: "key", html: "<strong>Authorize the object, not just the endpoint.</strong> Combine scopes with ownership or tenant checks in the service, scope queries by owner, and prove the rules with tests." }
            ]
          },
          {
            id: "secrets-config",
            title: "Secrets, passwords and sensitive data",
            summary: "Keep credentials out of code and images, inject and rotate them at runtime, store passwords with slow hashes, and keep secrets out of logs.",
            minutes: 9,
            tags: ["secrets", "password-hashing", "logging"],
            blocks: [
              { t: "p", html: "Treat the repository as public. Anything committed \u2014 passwords, API keys, private keys, connection strings with credentials \u2014 is compromised the moment it lands, and lives on in history and every clone. Secrets belong to the runtime environment." },
              { t: "table", headers: ["Where it could go", "Verdict"], rows: [
                ["Hardcoded in Java, YAML, Dockerfile or tests", "Never"],
                ["Environment variable injected by the platform", "Acceptable; referenced as <code class='tok'>${DB_PASSWORD}</code>"],
                ["Secret file mounted into the pod", "Good; read with <code class='tok'>configtree:</code>"],
                ["Secret manager or vault integration", "Good; supports rotation and audit"],
                ["Workload identity / short-lived credentials", "Best; often no static secret at all"]
              ] },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  datasource:",
                "    url: ${DB_URL}",
                "    username: ${DB_USER}",
                "    password: ${DB_PASSWORD}",
                "  config:",
                "    import: optional:configtree:/run/secrets/app/   # files named after property keys"
              ]) },
              { t: "h", text: "User passwords" },
              { t: "code", lang: "java", code: J([
                "@Bean",
                "PasswordEncoder passwordEncoder() {",
                "  // stores an {id} prefix so the algorithm can be upgraded later; bcrypt by default",
                "  return PasswordEncoderFactories.createDelegatingPasswordEncoder();",
                "}"
              ]) },
              { t: "ul", items: [
                "Use a slow, salted password hash (bcrypt, or Argon2id where available) through <code class='tok'>PasswordEncoder</code>.",
                "Never use fast hashes such as SHA-256 for passwords, and never MD5 or SHA-1 for anything security-relevant.",
                "Never encrypt passwords reversibly; hashes are compared, not decrypted."
              ] },
              { t: "h", text: "Keep secrets out of telemetry" },
              { t: "ul", items: [
                "Do not log request headers wholesale; Authorization and cookies end up in log storage.",
                "Mask sensitive fields in structured logs and in ProblemDetail responses.",
                "Keep Actuator <code class='tok'>env</code> masked and internal; never expose <code class='tok'>heapdump</code> publicly.",
                "Scan commits and images for secrets in CI so mistakes are caught before merge."
              ] },
              { t: "note", variant: "trap", html: "<strong>Deleting a committed secret does not un-leak it.</strong> It remains in Git history, forks and CI caches. Rotate it immediately, then clean up." },
              { t: "quiz", id: "sec-authz" },
              { t: "note", variant: "key", html: "<strong>Secrets live in the runtime, never in the repo.</strong> Inject them through placeholders or mounted files, rotate them, hash passwords slowly, and keep tokens and credentials out of logs." }
            ]
          }
        ]
      },
      {
        id: "hardening",
        name: "Hardening",
        icon: "broom",
        lessons: [
          {
            id: "cors-csrf-apis",
            title: "CORS and CSRF for APIs",
            summary: "What each mechanism protects, configuring exact-origin CORS, and when CSRF must stay on for browser clients.",
            minutes: 9,
            tags: ["cors", "csrf", "browser-security"],
            blocks: [
              { t: "p", html: "CORS and CSRF are both about browsers, and both are often misconfigured by copying a snippet. They answer different questions." },
              { t: "table", headers: ["", "CORS", "CSRF"], rows: [
                ["Threat", "A script on another origin reading your responses", "Another site making the user's browser send an authenticated, state-changing request"],
                ["Who enforces", "The browser, based on your response headers", "Your server, by requiring a token the attacker cannot read"],
                ["Matters when", "Any browser front end on a different origin", "Credentials are attached automatically (cookies, browser-managed auth)"],
                ["Irrelevant for", "Server-to-server clients (they ignore it)", "Bearer tokens sent explicitly in the Authorization header"]
              ] },
              { t: "code", lang: "java", code: J([
                "@Bean",
                "CorsConfigurationSource corsConfigurationSource(@Value(\"${app.cors.origins}\") List<String> origins) {",
                "  var c = new CorsConfiguration();",
                "  c.setAllowedOrigins(origins);                          // e.g. https://app.shop.example per environment",
                "  c.setAllowedMethods(List.of(\"GET\", \"POST\", \"PUT\", \"PATCH\", \"DELETE\"));",
                "  c.setAllowedHeaders(List.of(\"Authorization\", \"Content-Type\", \"Idempotency-Key\", \"X-XSRF-TOKEN\"));",
                "  c.setExposedHeaders(List.of(\"Location\", \"Retry-After\"));",
                "  c.setAllowCredentials(true);                            // never with a \"*\" origin",
                "  c.setMaxAge(Duration.ofHours(1));                       // cache preflights",
                "  var source = new UrlBasedCorsConfigurationSource();",
                "  source.registerCorsConfiguration(\"/api/**\", c);",
                "  return source;",
                "}"
              ]) },
              { t: "h", text: "Cookie sessions need CSRF" },
              { t: "p", html: "Bearer-token APIs can disable CSRF, as in the <a class='inline' href='#/sec/authn/filter-chain'>filter chain</a> lesson. A browser app using a session cookie (for example behind a backend-for-frontend) must keep it: the SPA reads a token from a readable cookie and echoes it in a header, which a cross-site attacker cannot do." },
              { t: "code", lang: "java", code: J([
                "http.csrf(csrf -> csrf",
                "    .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())   // XSRF-TOKEN cookie",
                "    .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()));     // read X-XSRF-TOKEN header",
                "// session cookie itself: HttpOnly, Secure, SameSite=Lax (or Strict)"
              ]) },
              { t: "ul", items: [
                "Configure CORS in one place (the security chain) rather than mixing <code class='tok'>@CrossOrigin</code> annotations across controllers.",
                "Reflecting the request's Origin header back is equivalent to <code class='tok'>*</code>: keep an explicit list per environment.",
                "SameSite cookies reduce CSRF risk but do not replace tokens for every browser and same-site subdomain case.",
                "Never treat CORS as access control: curl and other servers ignore it."
              ] },
              { t: "note", variant: "key", html: "<strong>CORS decides who may read, CSRF decides who may act.</strong> Allow exact origins, keep CSRF on whenever cookies authenticate, and disable it only for pure bearer-token APIs." }
            ]
          },
          {
            id: "service-to-service",
            title: "Service-to-service auth: client credentials and mTLS",
            summary: "Get and cache scoped tokens with the OAuth2 client, attach them with RestClient, and where mutual TLS fits.",
            minutes: 9,
            tags: ["oauth2-client", "client-credentials", "mtls"],
            blocks: [
              { t: "p", html: "When a service calls another on its own behalf, it needs an identity of its own. The <strong>client credentials</strong> grant gives it one: the service authenticates to the authorization server and receives a short-lived access token with a narrow scope and audience. Spring Security's OAuth2 client obtains, caches and refreshes it." },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  security:",
                "    oauth2:",
                "      client:",
                "        registration:",
                "          inventory:",
                "            provider: corp",
                "            client-id: ${INVENTORY_CLIENT_ID}",
                "            client-secret: ${INVENTORY_CLIENT_SECRET}   # from the secret store at runtime",
                "            authorization-grant-type: client_credentials",
                "            scope: inventory.read",
                "        provider:",
                "          corp:",
                "            token-uri: https://auth.shop.example/oauth2/token"
              ]) },
              { t: "code", lang: "java", code: J([
                "@Bean",
                "RestClient inventoryClient(RestClient.Builder builder, OAuth2AuthorizedClientManager clients) {",
                "  var oauth = new OAuth2ClientHttpRequestInterceptor(clients);",
                "  oauth.setClientRegistrationIdResolver(request -> \"inventory\");",
                "  return builder.baseUrl(\"https://inventory.shop.svc.example\")",
                "      .requestInterceptor(oauth)            // adds Authorization: Bearer <cached token>",
                "      .build();",
                "}"
              ]) },
              { t: "ul", items: [
                "One registration per downstream audience keeps scopes minimal; do not reuse one all-powerful client.",
                "On the receiving side, validate the audience and require the scope, as in <a class='inline' href='#/sec/authn/oauth2-resource-server'>resource server</a>.",
                "When the call acts for a user, prefer token exchange (a downscoped token for that user) over forwarding the original token.",
                "Rotate client secrets, or use private-key JWT client authentication so no shared secret exists."
              ] },
              { t: "h", text: "Mutual TLS, briefly" },
              { t: "p", html: "With <strong>mTLS</strong> both sides present certificates, so the server knows which workload connected before any HTTP is read. In Kubernetes a service mesh usually handles it transparently. When the application terminates TLS itself, Spring Boot SSL bundles load the keys from mounted files." },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  ssl:",
                "    bundle:",
                "      pem:",
                "        workload:",
                "          keystore:",
                "            certificate: file:/etc/tls/tls.crt     # issued and rotated by the platform",
                "            private-key: file:/etc/tls/tls.key",
                "          truststore:",
                "            certificate: file:/etc/tls/ca.crt",
                "server:",
                "  ssl:",
                "    bundle: workload",
                "    client-auth: need"
              ]) },
              { t: "note", variant: "warn", html: "<strong>Verify the certificates you load.</strong> Check expiry, key strength (RSA 2048+ or ECDSA P-256+), SHA-2 signatures and the issuing CA, for example with <code class='tok'>openssl x509 -text -noout -in tls.crt</code>. Automate rotation; expired certificates are a classic outage. Enforce TLS 1.3 where both sides support it." },
              { t: "note", variant: "key", html: "<strong>Give every service its own narrow identity.</strong> Client credentials for scoped tokens, secrets injected at runtime, audience checks on the receiver, and mTLS (mesh or SSL bundles) for workload identity on the wire." }
            ]
          },
          {
            id: "injection-input",
            title: "Injection and untrusted input",
            summary: "SQL and JPQL injection, unsafe sort and filter parameters, mass assignment, and SSRF from user-supplied URLs.",
            minutes: 10,
            tags: ["injection", "owasp", "validation"],
            blocks: [
              { t: "p", html: "Injection happens when untrusted data is interpreted as code: SQL, JPQL, shell, LDAP, expression languages, log formats. The defence is always the same idea: keep data and code in separate channels." },
              { t: "compare",
                bad: { title: "Concatenated query", items: [
                  "<code class='tok'>\"select o from Order o where o.status = '\" + status + \"'\"</code>",
                  "<code class='tok'>jdbc.query(\"... order by \" + sortParam, ...)</code>",
                  "Native query built with String.format",
                  "Hand-escaping quotes"
                ] },
                good: { title: "Bound and allow-listed", items: [
                  "<code class='tok'>where o.status = :status</code> with a bound parameter",
                  "Sort key mapped through an allow-list to a known column",
                  "Specifications or a query builder for dynamic filters",
                  "Typed inputs (enums, UUIDs) validated at the edge"
                ] } },
              { t: "code", lang: "java", code: J([
                "enum OrderSort {",
                "  NEWEST(\"createdAt\"), TOTAL(\"total\");",
                "  final String property;",
                "  OrderSort(String p) { property = p; }",
                "}",
                "",
                "@GetMapping(\"/orders\")",
                "Slice<OrderRow> list(@RequestParam OrderStatus status,                    // enum: bad values -> 400",
                "                     @RequestParam(defaultValue = \"NEWEST\") OrderSort sort) {",
                "  return orders.findByStatus(status, PageRequest.of(0, 50, Sort.by(DESC, sort.property)));",
                "}"
              ]) },
              { t: "h", text: "Mass assignment" },
              { t: "p", html: "Binding a request body directly to an entity lets clients set any field Jackson can reach, such as <code class='tok'>role</code>, <code class='tok'>tenantId</code> or <code class='tok'>verified</code>. Bind to a request record that contains only the writable fields, <a class='inline' href='#/api/rest/validation'>validate</a> it, and map it explicitly." },
              { t: "h", text: "SSRF and other channels" },
              { t: "ul", items: [
                "<strong>SSRF:</strong> when users supply URLs (webhooks, image imports), allow-list schemes and hosts, resolve and reject private, loopback and link-local addresses (including cloud metadata), disable redirects and set timeouts.",
                "<strong>Path traversal:</strong> never build file paths from input; normalise and check the result stays under the base directory.",
                "<strong>Log injection:</strong> structured JSON logging escapes newlines; never log secrets or full tokens.",
                "<strong>Expression injection:</strong> never evaluate SpEL, templates or scripts built from user input.",
                "<strong>Deserialization:</strong> avoid Java serialization of untrusted bytes; keep Jackson's default typing off."
              ] },
              { t: "note", variant: "trap", html: "<strong>Validation is not the injection defence.</strong> It narrows input and gives good errors, but parameter binding and allow-lists are what make queries safe. Defence in depth: do both, and give the database user only the privileges the service needs." },
              { t: "quiz", id: "sec-hardening" },
              { t: "note", variant: "key", html: "<strong>Data never becomes code.</strong> Bind every parameter, allow-list identifiers such as sort keys, bind requests to purpose-built records, and fence outbound requests to user-supplied URLs." }
            ]
          }
        ]
      }
    ]
  };
})();
