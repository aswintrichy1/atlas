/* =====================================================================
   ANVIL · Building APIs
   window.TRACKS.api — modules: rest / contract
   Registers its own widgets, quizzes and track data. Uses window.AnvilKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.AnvilKit;
  var h = K.h, J = K.J;
  var Widgets = {};

  /* ==================================================================
     apiStatusCodes — pick the right status for each scenario
  ================================================================== */
  var CODES = [200, 201, 202, 204, 400, 401, 403, 404, 409, 422, 429, 500, 503];
  var SCENARIOS = [
    { s: "POST /orders succeeds and creates order 9182.", ok: [201], why: "201 Created with a Location header pointing at /orders/9182, and usually the created representation in the body." },
    { s: "The request body has quantity = -3 and a blank email.", ok: [400, 422], why: "The request is malformed for this API. 400 is the common choice for validation failures; some APIs reserve 422 for well-formed but semantically invalid content. Pick one convention and return a ProblemDetail listing the fields." },
    { s: "No Authorization header is sent to a protected endpoint.", ok: [401], why: "401 Unauthorized really means unauthenticated: the client must authenticate. Include a WWW-Authenticate header." },
    { s: "A valid token for a customer tries to read another customer's invoice.", ok: [403, 404], why: "403 Forbidden says 'I know who you are, and no'. Returning 404 instead is a deliberate choice when you do not want to reveal that the resource exists." },
    { s: "PUT /orders/77 with If-Match: \"v3\" but the order is already at version v4.", ok: [409, 412], alt: "412", why: "The update is based on a stale version. 412 Precondition Failed is precise for If-Match; many APIs use 409 Conflict for optimistic-lock failures without conditional headers." },
    { s: "The client exceeded its quota of 100 requests per minute.", ok: [429], why: "429 Too Many Requests, with a Retry-After header so well-behaved clients back off." },
    { s: "A bulk export was accepted and will be produced in the background.", ok: [202], why: "202 Accepted, with a Location pointing at a status resource the client can poll." },
    { s: "DELETE /carts/5 succeeds and there is nothing to return.", ok: [204], why: "204 No Content: success with an empty body. Repeating the DELETE should also succeed (or return 404), since DELETE is idempotent." },
    { s: "The payment provider is down and the circuit breaker is open.", ok: [503], why: "503 Service Unavailable signals a temporary condition; add Retry-After if you can estimate it. Do not return 500, which suggests a bug." },
    { s: "A retried POST reuses an Idempotency-Key with a different request body.", ok: [422, 409], why: "The key is bound to the first request. Reject the mismatch (422 Unprocessable Content is common; some APIs use 409) rather than silently replaying or re-executing." },
    { s: "GET /orders/123 and order 123 does not exist.", ok: [404], why: "404 Not Found. For collections that match nothing, return 200 with an empty list instead." },
    { s: "An unexpected NullPointerException escapes the service layer.", ok: [500], why: "500 Internal Server Error, with a generic ProblemDetail and a trace id; never the stack trace. Alert on the rate of 500s." }
  ];

  Widgets.apiStatusCodes = function (mount) {
    K.shell(mount, "drill", "Pick the status code",
      "Read the scenario and choose the HTTP status you would return. Some scenarios accept two defensible answers; the explanation says when each fits.");
    var idx = 0, score = 0, answered = 0, locked = false;
    var scen = h("div", { class: "w-stage", style: "font-size:0.95rem;line-height:1.5;min-height:48px" });
    var grid = h("div", { class: "widget-controls", style: "flex-wrap:wrap" });
    var readout = h("div", { class: "w-readout" });
    function show() {
      var sc = SCENARIOS[idx];
      locked = false;
      K.clear(scen);
      scen.appendChild(h("div", { style: "color:var(--text-faint);font-size:0.75rem" }, "Scenario " + (idx + 1) + " of " + SCENARIOS.length));
      scen.appendChild(h("div", {}, sc.s));
      K.clear(grid);
      var codes = CODES.slice();
      if (sc.alt && codes.indexOf(+sc.alt) === -1) codes.splice(9, 0, +sc.alt);
      codes.forEach(function (c) {
        grid.appendChild(K.btn(String(c), "", function (ev) { pick(c, ev.currentTarget); }));
      });
      K.clear(readout);
      readout.appendChild(K.ro("score", score + " / " + answered));
    }
    function pick(c, el) {
      if (locked) return;
      locked = true;
      answered++;
      var sc = SCENARIOS[idx];
      var good = sc.ok.indexOf(c) !== -1;
      if (good) score++;
      Array.prototype.forEach.call(grid.querySelectorAll("button"), function (b) {
        if (sc.ok.indexOf(+b.textContent) !== -1) b.classList.add("primary");
      });
      if (!good) el.style.borderColor = "var(--rose)";
      K.clear(readout);
      readout.appendChild(h("span", { class: "ro", style: "color:" + (good ? "var(--lime-ink)" : "var(--rose-ink)") }, good ? "Correct" : "Not quite \u2014 accepted: " + sc.ok.join(" or ")));
      readout.appendChild(K.ro("score", score + " / " + answered));
      readout.appendChild(K.wide(sc.why));
      readout.appendChild(K.btn(idx + 1 < SCENARIOS.length ? "Next scenario" : "Start over", "primary", function () {
        if (idx + 1 < SCENARIOS.length) idx++; else { idx = 0; score = 0; answered = 0; }
        show();
      }));
    }
    mount.appendChild(scen);
    mount.appendChild(grid);
    mount.appendChild(readout);
    show();
  };

  /* ==================================================================
     apiPagination — offset vs keyset
  ================================================================== */
  Widgets.apiPagination = function (mount) {
    K.shell(mount, "compare", "Offset vs keyset pagination",
      "A table holds 5 million orders, sorted newest first, 50 per page. Compare how much work the database does and what clients see when new orders keep arriving while they page.");
    var method = "offset", page = 1, inserts = false;
    var code = h("pre", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.78rem;white-space:pre-wrap;margin:0" });
    var readout = h("div", { class: "w-readout" });
    var LIMIT = 50;
    function paint() {
      var offset = (page - 1) * LIMIT;
      var scanned = method === "offset" ? offset + LIMIT : LIMIT;
      var ms = method === "offset" ? 1 + scanned * 0.0009 : 1.2;
      K.clear(code);
      code.textContent = method === "offset"
        ? "SELECT id, created_at, total FROM orders\nORDER BY created_at DESC, id DESC\nLIMIT 50 OFFSET " + offset + ";"
        : "SELECT id, created_at, total FROM orders\nWHERE (created_at, id) < (:lastCreatedAt, :lastId)   -- from the cursor\nORDER BY created_at DESC, id DESC\nLIMIT 50;";
      K.clear(readout);
      readout.appendChild(K.ro("page", K.fmt(page)));
      readout.appendChild(K.ro("rows read by DB", K.fmt(scanned)));
      readout.appendChild(K.ro("est. query time", K.fmt(ms, ms < 10 ? 1 : 0) + " ms"));
      readout.appendChild(K.ro("jump to page N", method === "offset" ? "yes" : "no, next/previous only"));
      var issue;
      if (inserts && method === "offset") issue = "New rows shift every offset: the client sees duplicates at page boundaries (rows pushed down from the previous page) and, with deletes, silently skipped rows.";
      else if (inserts) issue = "Stable: the cursor anchors on the last row seen, so concurrent inserts appear on a fresh first page instead of shifting what the client is reading.";
      else issue = method === "offset" ? "Fine for small offsets and admin screens; cost grows linearly with depth because skipped rows are still read." : "Constant cost at any depth thanks to an index on (created_at, id). The cursor is opaque to clients, for example a base64 of the last sort key.";
      readout.appendChild(K.wide(issue, inserts && method === "offset" ? "var(--rose-ink)" : null));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([["offset", "OFFSET / LIMIT"], ["keyset", "Keyset cursor"]], 0, function (v) { method = v; paint(); }),
      K.segment([[1, "page 1"], [100, "page 100"], [20000, "page 20,000"]], 0, function (v) { page = v; paint(); }),
      K.segment([[false, "static data"], [true, "inserts while paging"]], 0, function (v) { inserts = v; paint(); })
    ));
    mount.appendChild(code);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     apiRateLimiter — token bucket over ten seconds of traffic
  ================================================================== */
  Widgets.apiRateLimiter = function (mount) {
    K.shell(mount, "simulate", "Token bucket limiter",
      "One client's traffic over ten seconds, against a bucket with a capacity (burst allowance) and a refill rate (sustained limit). Green requests pass, red ones get 429.");
    var capacity = 50, refill = 25, pattern = "burst";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function demand(sec) {
      if (pattern === "steady") return 20;
      if (pattern === "burst") return sec === 2 ? 120 : 15;
      return 80;
    }
    function paint() {
      var tokens = capacity, ok = 0, rej = 0, rows = [], peak = 0;
      for (var s = 0; s < 10; s++) {
        var want = demand(s), a = 0, r = 0;
        for (var tick = 0; tick < 10; tick++) {
          tokens = Math.min(capacity, tokens + refill / 10);
          var n = want / 10;
          var take = Math.min(n, Math.floor(tokens));
          tokens -= take; a += take; r += n - take;
        }
        a = Math.round(a); r = Math.round(r);
        ok += a; rej += r; peak = Math.max(peak, a + r);
        rows.push([a, r]);
      }
      K.clear(stage);
      var chart = h("div", { style: "display:flex;align-items:flex-end;gap:6px;height:120px" });
      rows.forEach(function (row, i) {
        var col = h("div", { title: "second " + (i + 1) + ": " + row[0] + " passed, " + row[1] + " rejected", style: "flex:1;display:flex;flex-direction:column-reverse;height:100%" });
        col.appendChild(h("div", { style: "background:var(--lime);height:" + (row[0] / peak * 100) + "%" }));
        col.appendChild(h("div", { style: "background:var(--rose);height:" + (row[1] / peak * 100) + "%" }));
        chart.appendChild(col);
      });
      stage.appendChild(chart);
      stage.appendChild(h("div", { style: "display:flex;justify-content:space-between;font-size:0.74rem;color:var(--text-dim);margin-top:4px" }, h("span", {}, "t = 1 s"), h("span", {}, "t = 10 s")));
      K.clear(readout);
      readout.appendChild(K.ro("passed", K.fmt(ok)));
      readout.appendChild(K.ro("429s", K.fmt(rej)));
      readout.appendChild(K.ro("sustained limit", refill + " req/s"));
      readout.appendChild(K.ro("burst allowance", capacity));
      var msg;
      if (pattern === "steady") msg = "Steady traffic below the refill rate never touches the limit: the bucket stays full.";
      else if (pattern === "burst") msg = rej ? "The burst exceeds what the bucket holds, so the overflow gets 429 with Retry-After. A larger capacity absorbs spikes without raising the sustained rate." : "The bucket's capacity absorbs the spike entirely; sustained traffic stays under the refill rate.";
      else msg = "Sustained overload: after the initial capacity is spent, the client is held to the refill rate and everything above it is rejected, protecting other tenants.";
      readout.appendChild(K.wide(msg, pattern === "abusive" ? "var(--rose-ink)" : null));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([["steady", "steady 20/s"], ["burst", "spike of 120"], ["abusive", "abusive 80/s"]], 1, function (v) { pattern = v; paint(); }),
      K.segment([[20, "capacity 20"], [50, "50"], [150, "150"]], 1, function (v) { capacity = v; paint(); }),
      K.segment([[10, "refill 10/s"], [25, "25/s"], [50, "50/s"]], 1, function (v) { refill = v; paint(); })
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
    "api-rest": {
      title: "REST endpoints checkpoint",
      sub: "Method semantics, validation, error responses and idempotency keys.",
      questions: [
        {
          q: "Which HTTP methods are idempotent by definition?",
          options: ["GET, PUT, DELETE", "POST and PATCH", "Only GET", "All methods"],
          answer: 0,
          explain: "Repeating GET, PUT or DELETE has the same effect as doing it once (HEAD and OPTIONS too). POST is not idempotent, which is why creating resources safely under retries needs an idempotency key."
        },
        {
          q: "Where should a rule such as 'an order cannot exceed the customer's credit limit' be enforced?",
          options: ["Bean Validation annotations on the request DTO", "In the service layer, inside the use case that has access to the customer's data", "In the controller with if statements", "Only in the database"],
          answer: 1,
          explain: "Bean Validation is for the shape of input: required fields, ranges, formats. Rules that need state, other entities or a transaction belong in the service, which can raise a domain exception mapped to a ProblemDetail."
        },
        {
          q: "What should an error response from a Spring Boot API look like?",
          options: ["The exception's stack trace as text", "An RFC 9457 ProblemDetail (type, title, status, detail, instance) plus safe extension fields such as a trace id or field errors", "Always 200 with success: false", "An empty body with the status code"],
          answer: 1,
          explain: "ProblemDetail gives clients one machine-readable shape for every error. Add a trace id for support and field-level errors for validation, but never stack traces, SQL or internal hostnames."
        },
        {
          q: "A client's POST /payments times out and it retries with the same Idempotency-Key. The first attempt actually succeeded. What should the server return?",
          options: ["Process the payment again", "The stored response of the first attempt, without executing the payment twice", "409 Conflict always", "500, because duplicates are errors"],
          answer: 1,
          explain: "The point of the key is that retries are safe: the server recognizes the key, finds the completed result and replays it. If the first attempt is still running, a 409 asking the client to retry later is appropriate."
        },
        {
          q: "Two requests with the same new Idempotency-Key arrive at the same moment on different instances. What prevents double execution?",
          options: ["A JVM lock", "A unique constraint on the key in the shared store, so only one insert of the in-progress record succeeds", "Checking the key with a SELECT first", "Sticky sessions"],
          answer: 1,
          explain: "Select-then-insert races across instances. Inserting the key first, relying on a database unique constraint (or an atomic set-if-absent in a shared cache), lets exactly one request claim it."
        },
        {
          q: "An API rejects a client for exceeding its quota. What response is most helpful?",
          options: ["500 with a stack trace", "429 Too Many Requests with Retry-After (and remaining-quota headers)", "403 Forbidden", "200 with an empty body"],
          answer: 1,
          explain: "429 tells the client to slow down, and Retry-After tells it when to come back. RateLimit-style headers let well-behaved clients pace themselves before hitting the limit."
        },
        {
          q: "Why key inbound rate limits by API client or tenant instead of one global counter per pod?",
          options: ["It is faster to compute", "One noisy client should not exhaust capacity for everyone, and per-pod counters multiply the real limit by the replica count", "Global counters are illegal", "Keys are required by HTTP"],
          answer: 1,
          explain: "Fairness needs a per-client key, and a cluster-wide limit needs a shared store (such as Redis) or enforcement at the gateway; otherwise 4 pods allow 4x the quota."
        }
      ]
    },
    "api-contract": {
      title: "API contracts checkpoint",
      sub: "Pagination, evolution, versioning and gRPC.",
      questions: [
        {
          q: "Why does OFFSET 1000000 LIMIT 50 get slow?",
          options: ["The client downloads a million rows", "The database still reads and discards the skipped rows before returning 50", "Indexes do not support ORDER BY", "LIMIT is applied before sorting"],
          answer: 1,
          explain: "Offset pagination cost grows with depth because skipped rows are scanned. Keyset pagination seeks directly to the last seen key with an index and costs the same on every page."
        },
        {
          q: "Which change to a JSON response is backward compatible for tolerant clients?",
          options: ["Renaming a field", "Adding a new optional field", "Changing a field from number to string", "Removing an enum value clients send"],
          answer: 1,
          explain: "Additive changes are safe if clients ignore unknown fields (the tolerant reader principle). Renames, type changes and removals break someone; ship them as a new version with a deprecation period."
        },
        {
          q: "How do you catch accidental breaking API changes before they ship?",
          options: ["Ask clients to report errors", "Generate or maintain an OpenAPI document and diff it against the released contract in CI, alongside consumer contract tests", "Increase the version number every release", "Disable JSON serialization changes"],
          answer: 1,
          explain: "A spec diff flags removed fields, new required parameters and type changes automatically, and consumer-driven contract tests verify the expectations real clients depend on."
        },
        {
          q: "In protobuf, what must you never do when evolving a message used by deployed services?",
          options: ["Add a new field with a new number", "Reuse or change the number of an existing field", "Mark a field deprecated", "Add a comment"],
          answer: 1,
          explain: "Field numbers identify fields on the wire. Reusing a number makes old and new code misinterpret each other's data. Remove fields by reserving their numbers and names."
        },
        {
          q: "When is gRPC a better fit than REST/JSON?",
          options: ["Public APIs consumed from browsers by third parties", "Internal service-to-service calls that benefit from a strict schema, generated clients, deadlines and streaming", "Simple CRUD for a single web front end", "Webhooks to partner systems"],
          answer: 1,
          explain: "gRPC shines between services you control: compact binary encoding, HTTP/2 multiplexing, streaming and first-class deadlines. Public and browser-facing APIs usually stay REST for reach and tooling."
        },
        {
          q: "Why add a unique tie-breaker such as id to a pagination sort on created_at?",
          options: ["It makes queries faster", "Without it, rows with equal timestamps can appear on two pages or none, because their order is not deterministic", "Databases require two sort columns", "It enables OFFSET"],
          answer: 1,
          explain: "A sort must be total for pagination to be stable. Ties on created_at have no defined order between queries; adding id makes each row's position unique for both offset and keyset pagination."
        },
        {
          q: "How should the springdoc /v3/api-docs and Swagger UI endpoints be handled in production?",
          options: ["Always public", "Either disabled, or exposed only behind authentication or an internal network, with the published spec served from CI artifacts", "Moved to port 80", "Renamed to hide them"],
          answer: 1,
          explain: "Generated docs reveal every endpoint and schema. Publish the reviewed spec from the build, and turn the runtime endpoints off or protect them."
        }
      ]
    },
    "api-reactive": {
      title: "Reactive checkpoint",
      sub: "Laziness, the event loop, backpressure and choosing WebFlux vs MVC.",
      questions: [
        {
          q: "What does calling a method that returns Mono<Order> actually do, before anyone subscribes?",
          options: ["Runs the query immediately", "Usually nothing: it assembles a pipeline that executes when subscribed", "Blocks the thread", "Starts a new platform thread"],
          answer: 1,
          explain: "Reactive types are lazy. WebFlux subscribes to what the controller returns; building a Mono and discarding it does no work."
        },
        {
          q: "A WebFlux handler calls a blocking JDBC repository directly. What is the risk?",
          options: ["None, Netty handles it", "It blocks one of the few event-loop threads, stalling every connection served by that thread", "It only affects logging", "It makes the response cacheable"],
          answer: 1,
          explain: "WebFlux runs on a small event-loop pool (about one thread per core). Blocking calls there starve the server. Use R2DBC or reactive clients, or isolate the call on boundedElastic."
        },
        {
          q: "What is backpressure in Reactive Streams?",
          options: ["HTTP 429", "The subscriber signals how many items it can accept (request(n)), so a fast producer cannot overwhelm it", "TCP retransmission", "A GC phase"],
          answer: 1,
          explain: "Demand flows upstream. Operators such as limitRate, buffer and onBackpressureDrop decide what to do when the producer is faster than the consumer."
        },
        {
          q: "With Java 21+ virtual threads available, when is WebFlux still a strong choice?",
          options: ["Never", "For streaming (SSE, WebSocket), high fan-in of long-lived connections, or an already reactive stack end to end", "For simple CRUD with JPA", "Whenever you use Spring Boot"],
          answer: 1,
          explain: "Virtual threads give MVC cheap blocking for request/response work. Reactive still shines for streams with backpressure and composing many asynchronous sources."
        }
      ]
    },
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.api = {
    id: "api",
    name: "Building APIs",
    short: "API",
    tagline: "Endpoints clients can trust",
    color: "#38bdf8",
    blurb: "Design HTTP APIs with Spring MVC that behave predictably under retries and change: resource and method semantics, request validation, ProblemDetail error responses, idempotency keys, pagination that scales, compatible evolution with OpenAPI, and when gRPC is the better contract.",
    modules: [
      {
        id: "rest",
        name: "REST Endpoints",
        icon: "globe",
        lessons: [
          {
            id: "rest-design",
            title: "Resource design, methods and status codes",
            summary: "Model resources, use HTTP methods for what they promise, follow a request through Spring MVC, and return the status a client can act on.",
            minutes: 10,
            tags: ["rest", "http", "spring-mvc"],
            blocks: [
              { t: "p", html: "A good HTTP API is predictable: <strong>nouns</strong> for resources, <strong>methods</strong> that keep their promises, and <strong>status codes</strong> a client can act on without reading your source. Spring MVC handles the plumbing; the semantics are your job." },
              { t: "diagram", id: "request-path", caption: "A request passes the servlet filter chain (security, tracing) before the DispatcherServlet routes it to a thin controller." },
              { t: "table", headers: ["Method", "Meaning", "Safe", "Idempotent", "Typical success"], rows: [
                ["GET", "Read", "yes", "yes", "200"],
                ["POST", "Create or trigger an action", "no", "no (use an idempotency key)", "201 + Location, or 202"],
                ["PUT", "Replace the resource", "no", "yes", "200 or 204"],
                ["PATCH", "Partial update", "no", "not guaranteed", "200 or 204"],
                ["DELETE", "Remove", "no", "yes", "204"]
              ] },
              { t: "code", lang: "java", code: J([
                "@RestController",
                "@RequestMapping(\"/customers/{customerId}/addresses\")",
                "class AddressController {",
                "  private final AddressService addresses;",
                "  AddressController(AddressService addresses) { this.addresses = addresses; }",
                "",
                "  @GetMapping(\"/{addressId}\")",
                "  AddressView get(@PathVariable long customerId, @PathVariable long addressId) {",
                "    return addresses.get(customerId, addressId); // throws NotFound -> 404 via advice",
                "  }",
                "",
                "  @DeleteMapping(\"/{addressId}\")",
                "  @ResponseStatus(HttpStatus.NO_CONTENT)",
                "  void delete(@PathVariable long customerId, @PathVariable long addressId) {",
                "    addresses.delete(customerId, addressId);",
                "  }",
                "}"
              ]) },
              { t: "widget", id: "apiStatusCodes" },
              { t: "note", variant: "trap", html: "<strong>200 with an error body breaks every client and proxy.</strong> Retries, caches, monitoring and circuit breakers all read the status line. Use the status code for the outcome and the body for details." },
              { t: "p", html: "For choosing between REST, GraphQL and gRPC at the system level, see <a class='inline' href='../hld-lld-academy/index.html#/hld/api/rest-graphql-grpc'>Blueprint: REST, GraphQL and gRPC</a>." },
              { t: "note", variant: "key", html: "<strong>Let HTTP carry the meaning.</strong> Resources as nouns, methods with honest safety and idempotency, and status codes that tell the client whether to fix, retry or give up." }
            ]
          },
          {
            id: "validation",
            title: "Request validation with Bean Validation",
            summary: "Validate input shape at the edge with annotations, validate business rules in the service, and return field-level errors.",
            minutes: 8,
            tags: ["validation", "jakarta-validation", "dto"],
            blocks: [
              { t: "p", html: "Validation has two layers. <strong>Input validation</strong> checks the request's shape: required, size, range, format. <strong>Business validation</strong> checks rules that need state: credit limits, stock levels, permissions. Keep the first at the edge with Bean Validation and the second in the service." },
              { t: "code", lang: "java", code: J([
                "public record CreateOrderRequest(",
                "    @NotBlank @Size(max = 64) String customerRef,",
                "    @NotEmpty @Size(max = 100) List<@Valid Line> lines,",
                "    @Email String receiptEmail) {",
                "",
                "  public record Line(@NotBlank String sku, @Positive @Max(999) int quantity) {}",
                "}",
                "",
                "@PostMapping",
                "ResponseEntity<OrderView> create(@Valid @RequestBody CreateOrderRequest req) { ... }"
              ]) },
              { t: "ul", items: [
                "<code class='tok'>@Valid</code> on the parameter triggers validation; failures raise <code class='tok'>MethodArgumentNotValidException</code>.",
                "Nested objects and list elements need <code class='tok'>@Valid</code> too, or their constraints are ignored.",
                "Put <code class='tok'>@Validated</code> on a class to validate method parameters such as <code class='tok'>@RequestParam @Max(100) int size</code>.",
                "Write a custom constraint for reusable format rules (a SKU pattern), not for rules that hit the database."
              ] },
              { t: "code", lang: "java", code: J([
                "@Service",
                "class OrderService {",
                "  @Transactional",
                "  OrderView create(CreateOrder cmd, String idempotencyKey) {",
                "    Customer c = customers.require(cmd.customerRef());",
                "    if (c.exceedsCreditWith(cmd.total())) {",
                "      throw new CreditLimitExceeded(c.id(), cmd.total()); // domain rule -> 422 ProblemDetail",
                "    }",
                "    ...",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Cap collection and string sizes.</strong> <code class='tok'>@Size(max = ...)</code> on lists and free text is cheap protection against memory-exhaustion requests; also set a request body size limit at the gateway or server." },
              { t: "note", variant: "warn", html: "<strong>Validation messages are API surface.</strong> Return field paths and stable codes clients can map, and never echo raw input back unescaped into HTML contexts." },
              { t: "note", variant: "key", html: "<strong>Shape at the edge, rules in the service.</strong> Bean Validation guards input format and size; domain rules live in the use case and surface as typed exceptions." }
            ]
          },
          {
            id: "problem-details",
            title: "Error responses with ProblemDetail",
            summary: "Map exceptions to RFC 9457 problem responses in one @RestControllerAdvice, with safe details and a trace id.",
            minutes: 9,
            tags: ["errors", "problemdetail", "controlleradvice"],
            blocks: [
              { t: "p", html: "Clients need one predictable error shape. <strong>RFC 9457 problem details</strong> (which replaced RFC 7807) define it, and Spring's <code class='tok'>ProblemDetail</code> type implements it. Centralize the mapping in a <code class='tok'>@RestControllerAdvice</code> so controllers stay free of try/catch." },
              { t: "code", lang: "json", code: J([
                "{",
                "  \"type\": \"https://errors.shop.example/credit-limit\",",
                "  \"title\": \"Credit limit exceeded\",",
                "  \"status\": 422,",
                "  \"detail\": \"Order total 1250.00 exceeds the remaining limit of 400.00.\",",
                "  \"instance\": \"/orders\",",
                "  \"traceId\": \"4bf92f3577b34da6a3ce929d0e0e4736\"",
                "}"
              ]) },
              { t: "code", lang: "java", code: J([
                "@RestControllerAdvice",
                "class ApiErrors {",
                "",
                "  @ExceptionHandler(CreditLimitExceeded.class)",
                "  ProblemDetail creditLimit(CreditLimitExceeded ex) {",
                "    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage());",
                "    pd.setType(URI.create(\"https://errors.shop.example/credit-limit\"));",
                "    pd.setTitle(\"Credit limit exceeded\");",
                "    return pd;",
                "  }",
                "",
                "  @ExceptionHandler(NotFound.class)",
                "  ProblemDetail notFound(NotFound ex) {",
                "    return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());",
                "  }",
                "",
                "  @ExceptionHandler(Exception.class)",
                "  ProblemDetail unexpected(Exception ex) {",
                "    log.error(\"unhandled error\", ex);              // full detail in logs only",
                "    return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, \"Unexpected error\");",
                "  }",
                "}"
              ]) },
              { t: "ul", items: [
                "Set <code class='tok'>spring.mvc.problemdetails.enabled=true</code> so Spring's own errors (validation, 405, 415) use the same format.",
                "Add a <code class='tok'>traceId</code> property from the current span so support can find the request in logs and traces.",
                "For validation errors, add an <code class='tok'>errors</code> array of field path and message.",
                "Map domain exceptions explicitly; let the catch-all return a generic 500."
              ] },
              { t: "note", variant: "trap", html: "<strong>Leaking internals in errors helps attackers.</strong> SQL fragments, class names, stack traces and internal hostnames in responses map your system for free. Log them; return a stable title and a trace id." },
              { t: "note", variant: "key", html: "<strong>One advice, one error shape.</strong> Map each domain exception to a ProblemDetail with the right status, include a trace id, and keep diagnostic detail in logs." }
            ]
          },
          {
            id: "idempotency-keys",
            title: "Idempotency keys for safe retries",
            summary: "Make POST endpoints safe to retry by storing a client-supplied key with the request fingerprint and response.",
            minutes: 11,
            tags: ["idempotency", "retries", "payments"],
            blocks: [
              { t: "p", html: "Networks fail after the server has done the work: the payment went through, but the response never reached the client. The client retries. Without protection you charge twice. An <strong>idempotency key</strong> lets the server recognise a retry and return the original result." },
              { t: "ol", items: [
                "The client generates a unique key per logical operation and sends it as <code class='tok'>Idempotency-Key</code>.",
                "The server tries to <strong>insert</strong> the key with a hash of the request, status IN_PROGRESS. A unique constraint lets exactly one request win.",
                "The winner executes the operation and stores the response against the key, in the same transaction as the business change where possible.",
                "A retry with the same key and same hash gets the stored response; a different hash is rejected; a key still in progress gets 409 with Retry-After.",
                "Keys expire after a retention window (for example 24 hours)."
              ] },
              { t: "code", lang: "sql", code: J([
                "CREATE TABLE idempotency_keys (",
                "  key           VARCHAR(100) PRIMARY KEY,",
                "  request_hash  CHAR(64)     NOT NULL,       -- SHA-256 of method, path and body",
                "  status        VARCHAR(16)  NOT NULL,       -- IN_PROGRESS | DONE",
                "  response_code INT,",
                "  response_body TEXT,",
                "  created_at    TIMESTAMP    NOT NULL",
                ");"
              ]) },
              { t: "code", lang: "java", code: J([
                "@Transactional",
                "public PaymentView pay(PayCommand cmd, String key) {",
                "  String hash = fingerprint(cmd);",
                "  Optional<StoredResponse> prior = keys.claimOrGet(key, hash); // INSERT ... ON CONFLICT DO NOTHING, then read",
                "  if (prior.isPresent()) {",
                "    StoredResponse r = prior.get();",
                "    if (!r.hash().equals(hash)) throw new IdempotencyKeyReused(key);  // -> 422",
                "    if (r.inProgress()) throw new RequestInProgress(key);              // -> 409 + Retry-After",
                "    return r.as(PaymentView.class);                                   // replay",
                "  }",
                "  PaymentView view = gateway.charge(cmd);   // the gateway also receives the key",
                "  keys.complete(key, 201, view);",
                "  return view;",
                "}"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Check-then-insert is a race.</strong> Two simultaneous retries both see 'no key' with a SELECT and both execute. Claim the key with an atomic insert guarded by a unique constraint." },
              { t: "note", variant: "tip", html: "<strong>Pass the key downstream.</strong> If the payment provider supports idempotency keys, forward yours, so a crash between charge and commit is also safe. The broader pattern: <a class='inline' href='../hld-lld-academy/index.html#/hld/reliability/idempotency'>Blueprint: idempotency</a>." },
              { t: "quiz", id: "api-rest" },
              { t: "note", variant: "key", html: "<strong>Retries are only safe if the server can recognise them.</strong> Claim the key atomically, bind it to a request fingerprint, store the response, and replay it on retry." }
            ]
          },
          {
            id: "rate-limiting",
            title: "Inbound rate limiting",
            summary: "Token buckets, per-client keys, cluster-wide limits with Redis or the gateway, and honest 429 responses.",
            minutes: 8,
            tags: ["rate-limiting", "bucket4j", "429"],
            blocks: [
              { t: "p", html: "Outbound limiters protect <em>other</em> services from you (see <a class='inline' href='#/res/calls/bulkheads-rate-limits'>bulkheads and rate limits</a>). Inbound limits protect <em>your</em> service from clients: one runaway script, a retry storm or a scraper must not take capacity from everyone else." },
              { t: "p", html: "The usual algorithm is the <strong>token bucket</strong>: the bucket holds up to <em>capacity</em> tokens, refills at a steady rate, and each request spends one. Bursts up to the capacity pass; sustained traffic is held to the refill rate." },
              { t: "widget", id: "apiRateLimiter" },
              { t: "code", lang: "java", code: J([
                "// Bucket4j with a Redis-backed ProxyManager: one bucket per API key, shared by all pods",
                "BucketConfiguration plan = BucketConfiguration.builder()",
                "    .addLimit(limit -> limit.capacity(100).refillGreedy(50, Duration.ofSeconds(1)))",
                "    .build();",
                "",
                "ConsumptionProbe probe = buckets.getProxy(\"rl:\" + apiKey, () -> plan).tryConsumeAndReturnRemaining(1);",
                "if (!probe.isConsumed()) {",
                "  long waitSeconds = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()));",
                "  response.setHeader(\"Retry-After\", String.valueOf(waitSeconds));",
                "  response.sendError(429);   // or a ProblemDetail body",
                "  return;",
                "}",
                "response.setHeader(\"X-RateLimit-Remaining\", String.valueOf(probe.getRemainingTokens()));"
              ]) },
              { t: "table", headers: ["Where to enforce", "Strength", "Weakness"], rows: [
                ["API gateway / ingress", "Stops traffic before it reaches pods; one place", "Coarse; little business context"],
                ["App filter + shared store (Redis)", "Per-tenant plans, per-endpoint costs", "An extra network hop per request"],
                ["App filter, in-memory", "Cheap, no dependencies", "The limit multiplies by the replica count"]
              ] },
              { t: "ul", items: [
                "Key by authenticated client or tenant; fall back to IP only for anonymous endpoints (and remember shared NATs).",
                "Give expensive endpoints a higher token cost rather than a separate limiter.",
                "Decide fail-open or fail-closed when Redis is down, and alert either way.",
                "Rate limiting is not load shedding: also cap concurrency so slow requests cannot pile up."
              ] },
              { t: "note", variant: "key", html: "<strong>Limit per client, enforce cluster-wide, answer honestly.</strong> A token bucket keyed by client, shared through the gateway or Redis, returning 429 with Retry-After keeps one caller from starving the rest." }
            ]
          }
        ]
      },
      {
        id: "contract",
        name: "Contracts & Evolution",
        icon: "map",
        lessons: [
          {
            id: "pagination",
            title: "Pagination that scales",
            summary: "Offset vs keyset pagination, stable sort orders, page size caps, and Spring Data's Page, Slice and Window.",
            minutes: 9,
            tags: ["pagination", "keyset", "spring-data"],
            blocks: [
              { t: "p", html: "Every list endpoint needs a page size cap and a stable order. The method matters once tables grow: <strong>offset</strong> pagination is simple and supports jumping to page N, while <strong>keyset</strong> (cursor) pagination stays fast and consistent at any depth." },
              { t: "widget", id: "apiPagination" },
              { t: "table", headers: ["Spring Data type", "Gives you", "Cost"], rows: [
                ["<code class='tok'>Page&lt;T&gt;</code>", "Content plus total count and pages", "An extra COUNT query on every request"],
                ["<code class='tok'>Slice&lt;T&gt;</code>", "Content plus hasNext", "Fetches one extra row, no count"],
                ["<code class='tok'>Window&lt;T&gt;</code> with <code class='tok'>ScrollPosition</code>", "Keyset scrolling", "Index seek per page"]
              ] },
              { t: "code", lang: "java", code: J([
                "interface OrderRepository extends Repository<Order, Long> {",
                "  Window<OrderSummary> findFirst50ByCustomerIdOrderByCreatedAtDescIdDesc(",
                "      long customerId, ScrollPosition position);",
                "}",
                "",
                "// first page",
                "Window<OrderSummary> w = repo.findFirst50ByCustomerIdOrderByCreatedAtDescIdDesc(id, ScrollPosition.keyset());",
                "// next page: encode w.positionAt(w.size() - 1) into an opaque cursor for the client"
              ]) },
              { t: "ul", items: [
                "Cap page size server-side (for example <code class='tok'>@Max(100)</code>) whatever the client asks for.",
                "Always add a unique tie-breaker to the sort (<code class='tok'>created_at, id</code>).",
                "Make cursors opaque so you can change their encoding later.",
                "Skip total counts on large tables unless the UI really needs them."
              ] },
              { t: "note", variant: "trap", html: "<strong>Returning a whole collection is a pagination decision too.</strong> An endpoint that is fine with 30 rows in test returns 300,000 in production a year later. Paginate from day one." },
              { t: "note", variant: "key", html: "<strong>Cap the page, make the sort total, prefer keyset at depth.</strong> Offset for small, jumpable lists; cursors for feeds, exports and anything large or changing." }
            ]
          },
          {
            id: "versioning-openapi",
            title: "Evolving APIs: compatibility, versioning and OpenAPI",
            summary: "Make additive changes, deprecate deliberately, choose a versioning style, and guard the contract with OpenAPI diffs in CI.",
            minutes: 9,
            tags: ["versioning", "openapi", "compatibility"],
            blocks: [
              { t: "p", html: "Once clients depend on an API, every change is a negotiation. Most evolution should be <strong>additive</strong>, so no version bump is needed; breaking changes get a new version, a migration window and a clear sunset." },
              { t: "table", headers: ["Change", "Compatible?", "Notes"], rows: [
                ["Add an optional response field", "Yes", "If clients ignore unknown fields"],
                ["Add an optional request field", "Yes", "Default must preserve old behaviour"],
                ["Add a new endpoint", "Yes", "\u2014"],
                ["Make an optional field required", "No", "Old clients stop working"],
                ["Rename or retype a field", "No", "Add the new field, deprecate the old"],
                ["Add an enum value to responses", "Risky", "Clients with exhaustive switches may break"]
              ] },
              { t: "h", text: "Versioning styles" },
              { t: "ul", items: [
                "<strong>Path</strong> (<code class='tok'>/v2/orders</code>): obvious, cache-friendly, easy to route at the gateway.",
                "<strong>Header or media type</strong> (<code class='tok'>Accept: application/vnd.shop.v2+json</code>): cleaner URLs, harder to test by hand.",
                "Recent Spring Framework versions add built-in API version resolution on request mappings, so the style can be configured centrally rather than hand-rolled.",
                "Announce deprecation with <code class='tok'>Deprecation</code> and <code class='tok'>Sunset</code> response headers and track who still calls the old version."
              ] },
              { t: "h", text: "OpenAPI as the contract" },
              { t: "code", lang: "bash", code: J([
                "# code-first: springdoc generates /v3/api-docs from controllers and records",
                "curl -s http://localhost:8080/v3/api-docs > build/openapi.json",
                "",
                "# CI: fail the build on breaking changes against the released contract",
                "openapi-diff contracts/orders-v1.json build/openapi.json --fail-on-incompatible"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Be a tolerant reader and a strict writer.</strong> Ignore unknown fields when consuming, and never change the meaning of an existing field when producing. More on schema evolution: <a class='inline' href='../hld-lld-academy/index.html#/hld/architecture/api-schema-evolution'>Blueprint: API and schema evolution</a>." },
              { t: "note", variant: "key", html: "<strong>Add, do not change.</strong> Ship additive changes freely, version only true breaks, deprecate with headers and data, and let a contract diff in CI catch accidents." }
            ]
          },
          {
            id: "grpc",
            title: "gRPC for service-to-service calls",
            summary: "Protobuf contracts, streaming modes, deadlines and status codes, safe schema evolution, and when gRPC beats REST.",
            minutes: 9,
            tags: ["grpc", "protobuf", "http2"],
            blocks: [
              { t: "p", html: "<strong>gRPC</strong> defines services and messages in <strong>protobuf</strong>, generates typed clients and servers, and runs over HTTP/2. It suits internal calls where both sides are yours: compact payloads, multiplexed connections, streaming and first-class deadlines." },
              { t: "code", lang: "protobuf", code: J([
                "syntax = \"proto3\";",
                "package shop.inventory.v1;",
                "",
                "service Inventory {",
                "  rpc Reserve(ReserveRequest) returns (ReserveReply);",
                "  rpc WatchStock(WatchRequest) returns (stream StockEvent); // server streaming",
                "}",
                "",
                "message ReserveRequest {",
                "  string sku = 1;",
                "  int32 quantity = 2;",
                "  string idempotency_key = 3;",
                "  reserved 4;              // removed field: never reuse its number",
                "}"
              ]) },
              { t: "table", headers: ["Mode", "Shape", "Example"], rows: [
                ["Unary", "One request, one reply", "Reserve stock"],
                ["Server streaming", "One request, many replies", "Stock change feed"],
                ["Client streaming", "Many requests, one reply", "Upload telemetry batch"],
                ["Bidirectional", "Both stream", "Interactive sessions"]
              ] },
              { t: "ul", items: [
                "Every call should carry a <strong>deadline</strong>; it propagates to downstream calls so work stops when the caller gave up.",
                "Map errors to gRPC status codes such as <code class='tok'>NOT_FOUND</code>, <code class='tok'>INVALID_ARGUMENT</code>, <code class='tok'>UNAVAILABLE</code> (retryable) and <code class='tok'>DEADLINE_EXCEEDED</code>.",
                "Evolve messages by adding fields with new numbers; reserve removed numbers and names.",
                "In Spring, the Spring gRPC project provides Boot auto-configuration for servers and clients."
              ] },
              { t: "compare",
                bad: { title: "gRPC everywhere", items: ["Public partner APIs that need curl-ability", "Browsers without a proxy layer", "Teams without schema-management discipline"] },
                good: { title: "gRPC where it pays", items: ["High-volume internal calls", "Streaming between services", "Polyglot services sharing one strict contract"] } },
              { t: "p", html: "System-level comparison: <a class='inline' href='../hld-lld-academy/index.html#/hld/api/rest-graphql-grpc'>Blueprint: REST, GraphQL and gRPC</a>." },
              { t: "quiz", id: "api-contract" },
              { t: "note", variant: "key", html: "<strong>gRPC is a strict contract with deadlines built in.</strong> Use it between services you control, keep field numbers forever, and propagate deadlines on every call." }
            ]
          },
          {
            id: "springdoc-openapi",
            title: "API docs with springdoc-openapi",
            summary: "Generate an OpenAPI spec from controllers, enrich it with annotations, document security, and publish it safely.",
            minutes: 7,
            tags: ["springdoc", "openapi", "swagger"],
            blocks: [
              { t: "p", html: "<strong>springdoc-openapi</strong> inspects your controllers, records and validation annotations at startup and serves an OpenAPI 3 document at <code class='tok'>/v3/api-docs</code>, plus an optional Swagger UI. Bean Validation constraints such as <code class='tok'>@NotBlank</code> and <code class='tok'>@Size</code> show up in the schema automatically." },
              { t: "code", lang: "java", code: J([
                "@Tag(name = \"Orders\")",
                "@RestController @RequestMapping(\"/orders\")",
                "class OrderController {",
                "",
                "  @Operation(summary = \"Place an order\")",
                "  @ApiResponse(responseCode = \"201\", description = \"Created\")",
                "  @ApiResponse(responseCode = \"409\", description = \"Duplicate idempotency key\",",
                "      content = @Content(schema = @Schema(implementation = ProblemDetail.class)))",
                "  @PostMapping",
                "  ResponseEntity<OrderView> place(@Valid @RequestBody PlaceOrder cmd,",
                "                                 @RequestHeader(\"Idempotency-Key\") String key) { ... }",
                "}",
                "",
                "@Bean OpenAPI api() {",
                "  return new OpenAPI().info(new Info().title(\"Orders API\").version(\"1\"))",
                "      .components(new Components().addSecuritySchemes(\"bearer\",",
                "          new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme(\"bearer\").bearerFormat(\"JWT\")))",
                "      .addSecurityItem(new SecurityRequirement().addList(\"bearer\"));",
                "}"
              ]) },
              { t: "code", lang: "yaml", code: J([
                "springdoc:",
                "  api-docs:",
                "    enabled: ${API_DOCS_ENABLED:false}   # on in dev, off (or protected) in prod",
                "  swagger-ui:",
                "    enabled: ${API_DOCS_ENABLED:false}",
                "  group-configs:",
                "    - group: public",
                "      paths-to-match: /orders/**"
              ]) },
              { t: "ul", items: [
                "<strong>Code-first</strong> (springdoc) keeps docs in sync with code; <strong>contract-first</strong> (write the YAML, generate interfaces) suits APIs designed with partners before coding.",
                "Export the spec in CI and diff it against the released version, as in <a class='inline' href='#/api/contract/versioning-openapi'>versioning</a>.",
                "Generated client SDKs are only as good as your schemas: name records clearly and document error responses as ProblemDetail."
              ] },
              { t: "note", variant: "warn", html: "<strong>Docs endpoints are an attack map.</strong> Disable them in production or put them behind authentication, and permit them explicitly in the security filter chain only where intended." },
              { t: "note", variant: "key", html: "<strong>Let the code generate the contract, then review it like code.</strong> Annotate operations and errors, document the auth scheme, publish the spec from CI, and keep runtime docs off in prod." }
            ]
          }
        ]
      },
      {
        id: "reactive",
        name: "Reactive",
        icon: "bolt",
        lessons: [
          {
            id: "webflux-basics",
            title: "WebFlux and Reactor vs MVC",
            summary: "Mono and Flux, the event loop, backpressure, WebClient, and how to choose between WebFlux and MVC with virtual threads.",
            minutes: 10,
            tags: ["webflux", "reactor", "webclient"],
            blocks: [
              { t: "p", html: "Spring offers two web stacks. <strong>MVC</strong> runs on servlet threads, one per request, and code blocks naturally. <strong>WebFlux</strong> runs on a small Netty event loop and expects every step to be non-blocking, expressed with Project Reactor's <code class='tok'>Mono</code> (0..1 items) and <code class='tok'>Flux</code> (0..N items)." },
              { t: "code", lang: "java", code: J([
                "@RestController",
                "class QuoteController {",
                "  private final WebClient pricing;     // non-blocking HTTP client",
                "  private final ReactiveStockRepo stock; // R2DBC or reactive Mongo",
                "",
                "  @GetMapping(\"/quotes/{sku}\")",
                "  Mono<Quote> quote(@PathVariable String sku) {",
                "    Mono<Price> price = pricing.get().uri(\"/prices/{sku}\", sku)",
                "        .retrieve().bodyToMono(Price.class)",
                "        .timeout(Duration.ofMillis(800));",
                "    Mono<Integer> onHand = stock.countBySku(sku);",
                "    return Mono.zip(price, onHand, Quote::new);   // both calls in flight at once",
                "  }",
                "",
                "  @GetMapping(value = \"/prices/stream\", produces = MediaType.TEXT_EVENT_STREAM_VALUE)",
                "  Flux<PriceTick> stream() { return ticks.flux().limitRate(100); }   // demand-driven SSE",
                "}"
              ]) },
              { t: "ul", items: [
                "<strong>Lazy:</strong> nothing runs until something subscribes; WebFlux subscribes to what you return.",
                "<strong>Backpressure:</strong> subscribers request(n) items, so a slow client slows the producer instead of filling memory.",
                "<strong>Never block the event loop:</strong> no JDBC, no <code class='tok'>.block()</code>, no Thread.sleep in handlers. Isolate unavoidable blocking calls with <code class='tok'>subscribeOn(Schedulers.boundedElastic())</code>.",
                "<strong>Context:</strong> ThreadLocal-based MDC and security do not follow the pipeline; Reactor's Context and Micrometer context propagation do."
              ] },
              { t: "table", headers: ["Need", "Choose"], rows: [
                ["CRUD over JPA/JDBC, typical request/response", "MVC + virtual threads"],
                ["Streaming (SSE, WebSocket), many long-lived connections", "WebFlux"],
                ["Gateway or proxy fanning out to many services", "WebFlux (Spring Cloud Gateway is built on it)"],
                ["Team new to reactive, debugging matters", "MVC"],
                ["Only need a non-blocking HTTP client in MVC", "RestClient, or WebClient inside MVC"]
              ] },
              { t: "note", variant: "trap", html: "<strong>Half-reactive is the worst of both.</strong> A WebFlux app that calls a blocking repository gets reactive complexity with blocking throughput, and can freeze the event loop. Go reactive end to end or stay on MVC. See <a class='inline' href='#/conc/loom/virtual-vs-reactive'>virtual threads vs reactive</a>." },
              { t: "quiz", id: "api-reactive" },
              { t: "note", variant: "key", html: "<strong>Reactive is a dataflow model, not a speed switch.</strong> Use WebFlux when you need streams, backpressure or massive connection counts with fully non-blocking I/O; otherwise MVC on virtual threads is simpler and just as scalable." }
            ]
          }
        ]
      }
    ]
  };
})();
