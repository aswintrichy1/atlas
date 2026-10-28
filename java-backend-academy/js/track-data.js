/* =====================================================================
   ANVIL · Data Access
   window.TRACKS.data — modules: jpa / tx / ops
   Registers its own widgets, quizzes and track data. Uses window.AnvilKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.AnvilKit;
  var h = K.h, J = K.J;
  var Widgets = {};

  /* ==================================================================
     dataNPlusOne — query counts per fetch strategy
  ================================================================== */
  var FETCH = {
    lazy: { label: "Lazy loop", queries: function (n) { return 1 + n; }, rows: function (n) { return n + n * 4; },
      sql: ["select o.* from orders o where o.status = ? limit ?", "select l.* from order_lines l where l.order_id = ?   -- order 1", "select l.* from order_lines l where l.order_id = ?   -- order 2", "... one query per order ..."],
      note: "Touching order.getLines() inside the loop fires one query per order. Invisible in a unit test with 3 rows, painful with 1,000." },
    join: { label: "JOIN FETCH", queries: function () { return 1; }, rows: function (n) { return n * 4; },
      sql: ["select o.*, l.* from orders o join order_lines l on l.order_id = o.id where o.status = ?"],
      note: "One query, but each order row repeats per line. Combined with pagination on a collection fetch, Hibernate paginates in memory (warning HHH90003004): fetch ids first, then join fetch those ids." },
    graph: { label: "@EntityGraph", queries: function () { return 1; }, rows: function (n) { return n * 4; },
      sql: ["select o.*, l.* from orders o left join order_lines l on l.order_id = o.id where o.status = ?"],
      note: "Same SQL as a join fetch, declared on the repository method, so the default mapping can stay lazy." },
    batch: { label: "Batch size 50", queries: function (n) { return 1 + Math.ceil(n / 50); }, rows: function (n) { return n + n * 4; },
      sql: ["select o.* from orders o where o.status = ? limit ?", "select l.* from order_lines l where l.order_id in (?, ?, ... 50 ids)", "... one query per 50 orders ..."],
      note: "@BatchSize or hibernate.default_batch_fetch_size loads lazy collections for many parents at once. A good global safety net." },
    dto: { label: "DTO projection", queries: function () { return 1; }, rows: function (n) { return n; },
      sql: ["select o.id, o.created_at, count(l.id), sum(l.price * l.qty) from orders o join order_lines l on ... group by o.id, o.created_at"],
      note: "Ask for exactly the columns the screen needs. No entities, no dirty checking, no lazy loading: the fastest read path for list views." }
  };

  Widgets.dataNPlusOne = function (mount) {
    K.shell(mount, "compare", "N+1 query explorer",
      "Load a list of orders and show each one's line count (about 4 lines per order). Compare how many SQL statements each fetch strategy issues; each round trip is assumed to cost 1 ms.");
    var strat = "lazy", n = 100;
    var log = h("pre", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.76rem;white-space:pre-wrap;margin:0" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var f = FETCH[strat];
      var q = f.queries(n), rows = f.rows(n);
      var ms = q * 1 + rows * 0.004;
      log.textContent = f.sql.join("\n");
      K.clear(readout);
      readout.appendChild(K.ro("orders", K.fmt(n)));
      readout.appendChild(h("span", { class: "ro", style: q > 20 ? "color:var(--rose-ink)" : "" }, "SQL statements ", h("b", {}, K.fmt(q))));
      readout.appendChild(K.ro("rows transferred", K.fmt(rows)));
      readout.appendChild(K.ro("est. DB time", K.fmt(ms, 1) + " ms"));
      readout.appendChild(K.wide(f.note));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([["lazy", "Lazy loop"], ["join", "JOIN FETCH"], ["graph", "@EntityGraph"], ["batch", "Batch size 50"], ["dto", "DTO projection"]], 0, function (v) { strat = v; paint(); }),
      K.segment([[10, "10 orders"], [100, "100"], [1000, "1,000"]], 1, function (v) { n = v; paint(); })
    ));
    mount.appendChild(log);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     dataPropagation — what commits?
  ================================================================== */
  var OUTCOMES = {
    REQUIRED: {
      ok: { order: true, audit: true, msg: "One shared transaction; both rows commit together." },
      inner: { order: false, audit: false, err: "UnexpectedRollbackException", msg: "The inner failure marked the shared transaction rollback-only. Catching the exception in the outer method does not undo that, so the commit fails and nothing is saved." },
      outer: { order: false, audit: false, msg: "Same transaction, so the outer failure rolls back the audit row too." }
    },
    REQUIRES_NEW: {
      ok: { order: true, audit: true, msg: "Two transactions. The outer one is suspended while the inner one runs and commits on its own connection." },
      inner: { order: true, audit: false, msg: "Only the inner transaction rolls back. The outer one continues and commits the order." },
      outer: { order: false, audit: true, msg: "The audit row was already committed independently, so it survives the outer rollback. Good for audit trails, surprising for business data." }
    },
    NESTED: {
      ok: { order: true, audit: true, msg: "A savepoint inside one physical transaction; both commit at the end." },
      inner: { order: true, audit: false, msg: "Rolled back to the savepoint: the audit write is undone, the order continues. Requires a JDBC-savepoint-capable transaction manager; plain JPA/Hibernate does not support it." },
      outer: { order: false, audit: false, msg: "A savepoint is not a separate commit; the outer rollback undoes everything." }
    }
  };

  Widgets.dataPropagation = function (mount) {
    K.shell(mount, "simulate", "Propagation outcomes",
      "placeOrder() is @Transactional and calls audit.record(), whose propagation you choose. Pick what fails and see which rows end up committed. In the inner-failure case, placeOrder catches the exception and carries on.");
    var prop = "REQUIRED", scen = "ok";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function cell(label, saved) {
      return h("div", { style: "flex:1;min-width:150px;padding:10px;border-radius:8px;border:1px solid " + (saved ? "var(--lime)" : "var(--rose)") },
        h("div", { style: "font-size:0.75rem;color:var(--text-faint)" }, label),
        h("div", { style: "font-weight:600;color:" + (saved ? "var(--lime-ink)" : "var(--rose-ink)") }, saved ? "committed" : "rolled back"));
    }
    function paint() {
      var o = OUTCOMES[prop][scen];
      K.clear(stage);
      stage.appendChild(h("pre", { style: "font-family:var(--font-mono);font-size:0.76rem;margin:0 0 10px;white-space:pre-wrap" }, J([
        "@Transactional",
        "void placeOrder(Order o) {",
        "  orders.save(o);",
        "  try { audit.record(o); }            // @Transactional(propagation = " + prop + ")",
        "  catch (RuntimeException e) { log.warn(\"audit failed\", e); }",
        scen === "outer" ? "  throw new PaymentDeclined();          // outer fails after audit" : "  // continue",
        "}"
      ])));
      stage.appendChild(h("div", { style: "display:flex;gap:10px;flex-wrap:wrap" }, cell("orders row", o.order), cell("audit row", o.audit)));
      K.clear(readout);
      if (o.err) readout.appendChild(h("span", { class: "ro", style: "color:var(--rose-ink)" }, "commit throws ", h("b", {}, o.err)));
      readout.appendChild(K.wide(o.msg));
      if (prop === "REQUIRES_NEW") readout.appendChild(K.wide("Cost: REQUIRES_NEW holds a second connection while the first is suspended. Under load, many such calls can exhaust the pool and deadlock on it."));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([["REQUIRED", "REQUIRED"], ["REQUIRES_NEW", "REQUIRES_NEW"], ["NESTED", "NESTED"]], 0, function (v) { prop = v; paint(); }),
      K.segment([["ok", "Both succeed"], ["inner", "Inner fails (caught)"], ["outer", "Outer fails"]], 0, function (v) { scen = v; paint(); })
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     dataPoolSizing — connections across a fleet
  ================================================================== */
  Widgets.dataPoolSizing = function (mount) {
    K.shell(mount, "model", "Connection pool sizing",
      "Each instance runs a HikariCP pool against a database that allows 200 connections. Each instance receives 400 requests per second, and each request holds a connection for 5 ms of SQL. See what happens when you scale out, grow pools, or make a slow HTTP call inside the transaction.");
    var instances = 6, pool = 30, remote = false;
    var DB_MAX = 200, DEMAND = 400, SQL_MS = 5, REMOTE_MS = 300;
    var readout = h("div", { class: "w-readout" });
    var bar = h("div", { class: "w-stage" });
    function paint() {
      var total = instances * pool;
      var hold = (SQL_MS + (remote ? REMOTE_MS : 0)) / 1000;
      var capacity = pool / hold;
      var util = (DEMAND * hold) / pool;
      var over = total > DB_MAX;
      K.clear(bar);
      var pct = Math.min(100, (total / DB_MAX) * 100);
      bar.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim);margin-bottom:4px" }, "Connections requested from the database: " + total + " of " + DB_MAX));
      bar.appendChild(h("div", { style: "height:12px;border-radius:6px;background:var(--surface-2);overflow:hidden" },
        h("div", { style: "height:100%;width:" + pct + "%;background:" + (over ? "var(--rose)" : "var(--accent)") })));
      K.clear(readout);
      readout.appendChild(K.ro("per-instance capacity", K.fmt(capacity) + " req/s"));
      readout.appendChild(h("span", { class: "ro", style: util > 1 ? "color:var(--rose-ink)" : "" }, "pool utilization ", h("b", {}, K.fmt(Math.min(util, 9.99) * 100) + "%")));
      readout.appendChild(K.ro("fleet connections", total + " / " + DB_MAX));
      var msg;
      if (over) msg = "The fleet asks for more connections than the database allows. New instances fail to connect or starve the others; size pools from the database limit divided by the instance count, or put a proxy such as PgBouncer in front.";
      else if (util > 1) msg = "Requests arrive faster than connections free up. Threads queue in getConnection() until connectionTimeout and then fail. Moving the remote call out of the transaction fixes this far better than a bigger pool.";
      else if (util > 0.7) msg = "Working, but with little headroom for bursts or a slow query. Watch hikaricp_connections_pending.";
      else msg = "Healthy: small pools, short transactions. A pool far smaller than the thread count is normal.";
      readout.appendChild(K.wide(msg));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      K.segment([[2, "2 instances"], [6, "6"], [20, "20"]], 1, function (v) { instances = v; paint(); }),
      K.segment([[10, "pool 10"], [30, "pool 30"], [100, "pool 100"]], 1, function (v) { pool = v; paint(); }),
      K.segment([[false, "SQL only"], [true, "+300 ms HTTP call in tx"]], 0, function (v) { remote = v; paint(); })
    ));
    mount.appendChild(bar);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "data-jpa": {
      title: "JPA and fetching checkpoint",
      sub: "Persistence context, entity states and the N+1 problem.",
      questions: [
        {
          q: "Inside a @Transactional service method you load an entity, change a field, and never call save(). What happens at commit?",
          options: ["Nothing; the change is lost", "Hibernate detects the change through dirty checking and issues an UPDATE when it flushes", "An exception, because save() is required", "The entity is deleted"],
          answer: 1,
          explain: "Entities loaded inside a transaction are managed by the persistence context. At flush (before commit), Hibernate compares them with their loaded snapshot and writes the differences."
        },
        {
          q: "Why disable spring.jpa.open-in-view in an API service?",
          options: ["It is required for virtual threads", "It keeps a session open for the whole request, so lazy loading during JSON serialization silently issues queries and holds a connection longer", "It breaks transactions", "It disables caching"],
          answer: 1,
          explain: "Open-in-view hides N+1 problems in the web layer and ties connection usage to response rendering. With it off, missing fetches fail loudly in tests and you fix them with explicit fetch plans or DTOs."
        },
        {
          q: "Listing 500 orders and calling order.getCustomer().getName() for each generates 501 queries. Which fix keeps the entity mapping lazy?",
          options: ["Switch the association to EAGER", "Use an @EntityGraph or JOIN FETCH on this repository query, or a DTO projection", "Increase the connection pool", "Add @Transactional to the controller"],
          answer: 1,
          explain: "Fetch plans belong to the query, not the mapping. EAGER mappings load data everywhere, including where it is not needed, and often still cause N+1. Choose per use case: entity graph, join fetch or a projection."
        },
        {
          q: "What is the default fetch type of @ManyToOne in JPA?",
          options: ["LAZY", "EAGER", "BATCH", "It depends on the database"],
          answer: 1,
          explain: "The JPA spec makes to-one associations EAGER by default, a frequent hidden source of extra queries. Set fetch = FetchType.LAZY explicitly and fetch when needed."
        },
        {
          q: "How can a test prove a query path does not regress into N+1?",
          options: ["Measure wall-clock time", "Assert the number of SQL statements executed, for example with Hibernate statistics or a datasource proxy, against a dataset with several parents", "Check code coverage", "Run it twice"],
          answer: 1,
          explain: "Counting statements is deterministic and fails immediately when someone adds a lazy access in a loop. Use a dataset with several parent rows, or the bug cannot show."
        },
        {
          q: "A list screen needs only id, name and price of products. What is the most efficient Spring Data approach?",
          options: ["findAll() and map in Java", "A projection (interface or record DTO) so only those columns are selected and no entities are managed", "A native query returning Object[] everywhere", "Increase the fetch size"],
          answer: 1,
          explain: "Projections select only the needed columns and skip the persistence context's dirty-checking snapshots. Use entities when you intend to modify them."
        },
        {
          q: "A search endpoint has eight optional filters. Which Spring Data feature composes them without string-building JPQL?",
          options: ["One derived method per combination", "Specifications (JPA Criteria) or Querydsl predicates combined only for filters that are present", "Concatenating request params into @Query", "Native SQL with LIKE '%' + input + '%'"],
          answer: 1,
          explain: "Specification.where(...).and(...) builds a type-safe Criteria query with bound parameters, avoiding both combinatorial methods and injection-prone string concatenation."
        }
      ]
    },
    "data-tx": {
      title: "Transactions checkpoint",
      sub: "@Transactional rules, propagation, isolation and locking.",
      questions: [
        {
          q: "A @Transactional method throws a checked exception. By default, what happens?",
          options: ["The transaction rolls back", "The transaction commits, because default rollback rules only cover RuntimeException and Error", "Spring retries the method", "The exception is swallowed"],
          answer: 1,
          explain: "Spring's default rolls back on unchecked exceptions only. Declare rollbackFor for checked exceptions that should undo work, or use unchecked domain exceptions."
        },
        {
          q: "Why is calling a slow external HTTP API inside a @Transactional method harmful?",
          options: ["HTTP is not allowed in transactions", "The database connection and locks are held for the whole call, exhausting the pool and blocking other transactions", "It disables dirty checking", "The response is cached"],
          answer: 1,
          explain: "A transaction holds a pooled connection and any row locks until it ends. Do remote calls before or after it, and use an outbox or after-commit event for side effects."
        },
        {
          q: "Inner method with REQUIRED throws, outer method catches the exception and returns normally. What happens?",
          options: ["The outer work commits", "The shared transaction was marked rollback-only, so commit fails with UnexpectedRollbackException", "Only the inner work rolls back", "Spring retries the inner method"],
          answer: 1,
          explain: "With REQUIRED, both methods share one transaction. The proxy around the inner method marks it rollback-only when the exception passes through, and catching it later cannot clear that mark."
        },
        {
          q: "Two users update the same product's price at the same time; the last write silently overwrites the first. Which mechanism detects this without holding locks?",
          options: ["SERIALIZABLE everywhere", "Optimistic locking with a @Version column, returning 409 Conflict on mismatch", "A bigger connection pool", "Caching the product"],
          answer: 1,
          explain: "With @Version, each UPDATE includes WHERE version = ?; if another transaction changed the row first, zero rows match and JPA throws an optimistic lock exception, which the API maps to a conflict."
        },
        {
          q: "What is the safest way to decrement stock without overselling under concurrency?",
          options: ["Read the quantity, check it in Java, then save", "A single conditional UPDATE such as SET qty = qty - :n WHERE sku = :sku AND qty >= :n, checking the affected row count", "Use volatile for the quantity", "Synchronize the service method"],
          answer: 1,
          explain: "The database applies the check and the write atomically per row. Read-check-write in Java races across threads and instances; a JVM lock does nothing for other instances."
        }
      ]
    },
    "data-ops": {
      title: "Data operations checkpoint",
      sub: "Migrations, connection pools and caching.",
      questions: [
        {
          q: "You need to rename a column used by a service deployed with rolling updates. What is the safe approach?",
          options: ["Rename it in one migration and deploy", "Expand and contract: add the new column, write both, backfill, switch reads, then drop the old column in a later release", "Use ddl-auto=update", "Stop all instances first"],
          answer: 1,
          explain: "During a rolling deploy, old and new versions run together against the same schema. Each migration must work with both, so destructive steps come only after nothing reads the old shape."
        },
        {
          q: "What should spring.jpa.hibernate.ddl-auto be in production?",
          options: ["update", "create-drop", "validate or none, with schema changes made by versioned migrations", "create"],
          answer: 2,
          explain: "Letting Hibernate alter schemas is unreviewed, unversioned and can lose data. Flyway or Liquibase migrations are reviewed, repeatable and ordered; validate checks the mapping matches."
        },
        {
          q: "Twenty instances each configure a pool of 50 connections against a database limited to 300. What is the problem?",
          options: ["Nothing, pools are lazy", "The fleet can demand 1,000 connections, far beyond the limit; size pools from the database budget or add a connection proxy", "HikariCP caps pools automatically", "Pools should be larger than thread counts"],
          answer: 1,
          explain: "Pool sizes multiply across instances and autoscaling. Budget connections per instance from the database limit, keep pools small, and watch pending-connection metrics."
        },
        {
          q: "A popular cache entry expires and hundreds of requests hit the database at once to rebuild it. What is this, and one mitigation?",
          options: ["Cache poisoning; disable caching", "A cache stampede; coalesce loads per key (for example @Cacheable(sync = true) or a loading cache), add TTL jitter or refresh ahead of expiry", "A deadlock; add locks", "Eviction; increase memory"],
          answer: 1,
          explain: "When a hot key expires, every concurrent miss recomputes it. Let one loader per key do the work while others wait, refresh before expiry, and randomize TTLs so keys do not expire together."
        },
        {
          q: "Which caching choice is most likely to cause correctness bugs?",
          options: ["Caching small reference data with a TTL", "Caching per-user data under a key that does not include the user or tenant", "Using Caffeine for local caching", "Evicting on update"],
          answer: 1,
          explain: "A cache key that omits who the data belongs to serves one user's data to another, which is both a bug and a security incident. Include every input that changes the result in the key."
        },
        {
          q: "Redis becomes unreachable. With a default Spring cache setup, what typically happens to @Cacheable calls, and what should you configure?",
          options: ["Calls silently bypass the cache", "Calls throw and the request fails; configure short timeouts and a CacheErrorHandler that logs and falls through to the source", "The JVM restarts", "Redis buffers writes on disk"],
          answer: 1,
          explain: "Cache errors propagate by default. A cache is an optimisation, so a CacheErrorHandler plus tight connect and command timeouts should turn an outage into slower responses, not errors."
        },
        {
          q: "Why configure a JSON serializer instead of JDK serialization for RedisCacheManager values?",
          options: ["JSON is smaller in every case", "JDK serialization couples cached bytes to class versions, breaks on refactors and deserializing untrusted bytes is risky; JSON is readable and evolvable", "Redis rejects binary values", "It enables transactions"],
          answer: 1,
          explain: "With JDK serialization a renamed field or class can make every cached entry fail during a rolling deploy. JSON (with a known type) survives additive changes and is inspectable."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.data = {
    id: "data",
    name: "Data Access",
    short: "DATA",
    tagline: "JPA, transactions and the database",
    color: "#a78bfa",
    blurb: "Use JPA and Spring Data without surprises: the persistence context and entity states, fetch plans that avoid N+1 queries, where transactions belong and how propagation really behaves, isolation and locking for concurrent writes, safe schema migrations, connection-pool sizing across a fleet, and caching with TTLs and stampede protection.",
    modules: [
      {
        id: "jpa",
        name: "JPA & Fetching",
        icon: "database",
        lessons: [
          {
            id: "persistence-context",
            title: "The persistence context and entity states",
            summary: "How the EntityManager tracks entities, when SQL is actually issued, and why open-in-view should be off.",
            minutes: 10,
            tags: ["jpa", "hibernate", "entitymanager"],
            blocks: [
              { t: "p", html: "JPA is not 'objects saved to tables'. Inside a transaction, the <strong>persistence context</strong> tracks every entity it loaded or persisted. It guarantees one Java instance per row, records changes, and decides when SQL is sent. Most JPA surprises come from not knowing which state an entity is in." },
              { t: "table", headers: ["State", "Meaning", "Changes are saved?"], rows: [
                ["Transient", "<code class='tok'>new Order()</code>, unknown to JPA", "Only after persist / save"],
                ["Managed", "Loaded or persisted in the current context", "Yes, automatically at flush (dirty checking)"],
                ["Detached", "The context closed (transaction ended)", "No; needs merge, and lazy fields fail"],
                ["Removed", "Scheduled for delete", "DELETE at flush"]
              ] },
              { t: "code", lang: "java", code: J([
                "@Transactional",
                "public void rename(long id, String name) {",
                "  Product p = products.findById(id).orElseThrow();   // managed",
                "  p.rename(name);                                     // no save() needed",
                "}                                                     // flush -> UPDATE products SET name = ? WHERE id = ?"
              ]) },
              { t: "h", text: "Flush and the first-level cache" },
              { t: "ul", items: [
                "SQL for changes is sent at <strong>flush</strong>: before commit, and before queries that could see the pending changes.",
                "Loading the same id twice in one transaction returns the same instance without a second query.",
                "For big batch jobs, flush and <code class='tok'>clear()</code> periodically or the context grows until memory runs out.",
                "Entity <code class='tok'>equals</code>/<code class='tok'>hashCode</code> must not depend on mutable fields or a generated id that changes on persist."
              ] },
              { t: "note", variant: "trap", html: "<strong>Open-in-view is on by default.</strong> Spring Boot keeps the persistence context open for the whole web request and logs a warning about it. Lazy loading then happens during JSON rendering, hiding N+1 queries and holding connections longer. Set <code class='tok'>spring.jpa.open-in-view=false</code>." },
              { t: "compare",
                bad: { title: "Entity-centric everywhere", items: ["Entities returned from controllers", "save() sprinkled after every change", "Lazy loading in templates or serializers"] },
                good: { title: "Deliberate boundaries", items: ["Entities stay inside the service and transaction", "Rely on dirty checking for managed entities", "Map to records before leaving the service"] } },
              { t: "note", variant: "key", html: "<strong>Know the entity's state.</strong> Managed entities save themselves at flush, detached ones do not, and the persistence context should end with the service transaction, not with the HTTP response." }
            ]
          },
          {
            id: "n-plus-one",
            title: "Fetch plans and the N+1 problem",
            summary: "Spot N+1 queries, choose between join fetch, entity graphs, batch fetching and projections, and pin it down with tests.",
            minutes: 11,
            tags: ["n+1", "fetching", "projections"],
            blocks: [
              { t: "p", html: "The <strong>N+1 problem</strong>: one query loads N parents, then accessing a lazy association in a loop issues one more query per parent. It is the most common JPA performance bug, and it hides in small test datasets." },
              { t: "widget", id: "dataNPlusOne" },
              { t: "code", lang: "java", code: J([
                "interface OrderRepository extends JpaRepository<Order, Long> {",
                "",
                "  // fetch plan per use case; the mapping itself stays LAZY",
                "  @EntityGraph(attributePaths = { \"lines\", \"customer\" })",
                "  List<Order> findByStatus(OrderStatus status);",
                "",
                "  // list screens: a projection with exactly the needed columns",
                "  @Query(\"\"\"",
                "      select new com.shop.orders.OrderRow(o.id, o.createdAt, c.name, count(l))",
                "      from Order o join o.customer c join o.lines l",
                "      where o.status = :status",
                "      group by o.id, o.createdAt, c.name\"\"\")",
                "  Slice<OrderRow> listRows(OrderStatus status, Pageable page);",
                "}"
              ]) },
              { t: "h", text: "Defaults that bite" },
              { t: "ul", items: [
                "<code class='tok'>@ManyToOne</code> and <code class='tok'>@OneToOne</code> are <strong>EAGER</strong> by default; set <code class='tok'>fetch = LAZY</code> explicitly.",
                "Collections are lazy by default \u2014 good \u2014 but every access in a loop is a query.",
                "Set <code class='tok'>spring.jpa.properties.hibernate.default_batch_fetch_size=50</code> as a global safety net.",
                "Never paginate a query that join-fetches a collection: page the ids first, then fetch those ids with their collections."
              ] },
              { t: "h", text: "Catch it in tests" },
              { t: "code", lang: "java", code: J([
                "@DataJpaTest",
                "class OrderQueriesTest {",
                "  @Autowired OrderRepository orders;",
                "  @Autowired EntityManagerFactory emf;",
                "",
                "  @Test",
                "  void listingDoesNotIssueOneQueryPerOrder() {",
                "    var stats = emf.unwrap(SessionFactory.class).getStatistics();",
                "    stats.setStatisticsEnabled(true);",
                "    stats.clear();",
                "    orders.findByStatus(OrderStatus.OPEN).forEach(o -> o.getLines().size());",
                "    assertThat(stats.getPrepareStatementCount()).isLessThanOrEqualTo(2);",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Read paths and write paths want different shapes.</strong> Load entities when you will change them; use projections for lists and reports. Indexing the columns your fetch plans join on matters as much: <a class='inline' href='../hld-lld-academy/index.html#/hld/data/indexing'>Blueprint: indexing</a>." },
              { t: "quiz", id: "data-jpa" },
              { t: "note", variant: "key", html: "<strong>Fetch plans belong to queries, not mappings.</strong> Keep associations lazy, choose an entity graph, join fetch, batch size or projection per use case, and assert statement counts in tests." }
            ]
          },
          {
            id: "spring-data-repositories",
            title: "Spring Data repositories, projections and specifications",
            summary: "Derived queries and @Query, projections that select less, Specifications for dynamic filters, and paging with Slice.",
            minutes: 10,
            tags: ["spring-data", "projections", "specifications"],
            blocks: [
              { t: "p", html: "Spring Data JPA generates repository implementations from interfaces. Used well, it removes boilerplate; used carelessly, it hides expensive queries behind innocent method names." },
              { t: "code", lang: "java", code: J([
                "interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {",
                "",
                "  Optional<Product> findByTenantIdAndSku(String tenantId, String sku);          // derived query",
                "",
                "  @Query(\"select p from Product p where p.tenantId = :tenant and p.price < :max\")",
                "  List<Product> cheaperThan(@Param(\"tenant\") String tenant, @Param(\"max\") BigDecimal max);",
                "",
                "  List<ProductRow> findByTenantIdOrderByName(String tenantId);                   // projection",
                "",
                "  @EntityGraph(attributePaths = \"variants\")",
                "  Optional<Product> findWithVariantsById(Long id);                                // fetch plan",
                "",
                "  Slice<ProductRow> findByCategory(String category, Pageable page);               // no COUNT query",
                "}",
                "",
                "record ProductRow(Long id, String name, BigDecimal price) {}   // DTO projection: only 3 columns"
              ]) },
              { t: "table", headers: ["Tool", "Use for", "Watch out"], rows: [
                ["Derived methods", "Simple lookups by 1-3 properties", "Names longer than a sentence: switch to @Query"],
                ["@Query (JPQL)", "Joins, aggregates, explicit fetch joins", "Always bind parameters; never concatenate"],
                ["Projections", "Read-only views and lists", "Nested interface projections can trigger N+1; prefer records"],
                ["Specifications / Querydsl", "Dynamic, optional filters", "Keep them in the data layer, unit-test the composition"],
                ["Page vs Slice", "Page when the UI needs totals", "Page runs an extra COUNT; Slice just checks for a next page"],
                ["@Modifying @Query", "Bulk updates and deletes", "Bypasses the persistence context: clear it or reload"]
              ] },
              { t: "h", text: "Dynamic filters with Specifications" },
              { t: "code", lang: "java", code: J([
                "final class ProductSpecs {",
                "  static Specification<Product> inTenant(String t) { return (r, q, cb) -> cb.equal(r.get(\"tenantId\"), t); }",
                "  static Specification<Product> nameContains(String s) {",
                "    return s == null ? null : (r, q, cb) -> cb.like(cb.lower(r.get(\"name\")), \"%\" + s.toLowerCase() + \"%\");",
                "  }",
                "  static Specification<Product> maxPrice(BigDecimal m) { return m == null ? null : (r, q, cb) -> cb.le(r.get(\"price\"), m); }",
                "}",
                "",
                "Page<Product> page = products.findAll(",
                "    Specification.where(inTenant(tenant)).and(nameContains(f.name())).and(maxPrice(f.maxPrice())),",
                "    PageRequest.of(f.page(), 50, Sort.by(\"name\")));   // null specs are ignored; values are bound"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Sort parameters from clients are input too.</strong> Map allowed sort keys to properties explicitly instead of passing <code class='tok'>?sort=</code> straight through, and cap page size with <code class='tok'>spring.data.web.pageable.max-page-size</code>." },
              { t: "note", variant: "key", html: "<strong>Select what you need, filter with bound parameters.</strong> Derived methods for simple lookups, @Query for anything structural, projections for reads, Specifications for dynamic filters, and Slice when totals are not needed." }
            ]
          }
        ]
      },
      {
        id: "tx",
        name: "Transactions",
        icon: "blocks",
        lessons: [
          {
            id: "transactional-basics",
            title: "@Transactional done right",
            summary: "Put transactions on service methods, mark reads readOnly, know the rollback rules, keep them short, and publish side effects after commit.",
            minutes: 10,
            tags: ["transactional", "spring", "rollback"],
            blocks: [
              { t: "p", html: "A transaction draws a boundary around work that must succeed or fail together. In Spring, the boundary belongs on the <strong>service method</strong> that implements a use case: not on repositories (too small) and not on controllers (too big)." },
              { t: "code", lang: "java", code: J([
                "@Service",
                "@Transactional(readOnly = true)              // default for the class: reads",
                "class AccountService {",
                "",
                "  AccountView get(long id) { ... }             // read-only: no dirty checking, may use a replica",
                "",
                "  @Transactional                               // writes opt in",
                "  void transfer(long from, long to, Money amount) {",
                "    Account a = accounts.lockById(from);",
                "    Account b = accounts.lockById(to);",
                "    a.withdraw(amount);",
                "    b.deposit(amount);",
                "    events.publishEvent(new TransferCompleted(from, to, amount));",
                "  }",
                "}"
              ]) },
              { t: "table", headers: ["Rule", "Detail"], rows: [
                ["Rollback on", "RuntimeException and Error by default; checked exceptions commit unless you set <code class='tok'>rollbackFor</code>"],
                ["Applied by", "A proxy: self-invocation, private and final methods are not transactional"],
                ["readOnly = true", "Skips dirty checking and flushes; a hint some drivers and routing data sources use"],
                ["Programmatic", "<code class='tok'>TransactionTemplate</code> when the boundary is only part of a method"]
              ] },
              { t: "h", text: "Keep it short, keep I/O out" },
              { t: "p", html: "While a transaction is open it holds a connection and possibly row locks. Remote calls, message publishing and file uploads inside it extend that time and create inconsistency when they succeed but the commit fails." },
              { t: "code", lang: "java", code: J([
                "@Component",
                "class TransferNotifications {",
                "  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)",
                "  void on(TransferCompleted e) {",
                "    notifier.send(e);   // runs only if the transfer committed",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "warn", html: "<strong>AFTER_COMMIT is not guaranteed delivery.</strong> If the process dies right after commit, the listener never runs. When the side effect must happen, write it to an outbox table in the same transaction \u2014 see <a class='inline' href='#/res/events/outbox'>the transactional outbox</a>." },
              { t: "note", variant: "key", html: "<strong>One use case, one short transaction, on the service.</strong> Default to readOnly for queries, know the rollback rules, keep remote I/O outside, and trigger side effects after commit or through an outbox." }
            ]
          },
          {
            id: "propagation",
            title: "Transaction propagation",
            summary: "What REQUIRED, REQUIRES_NEW and NESTED really do when transactional methods call each other, and where each one surprises you.",
            minutes: 9,
            tags: ["propagation", "requires-new", "rollback-only"],
            blocks: [
              { t: "p", html: "<strong>Propagation</strong> decides what happens when a transactional method is called while a transaction is already active: join it, suspend it and start a new one, or create a savepoint. The default, <code class='tok'>REQUIRED</code>, joins \u2014 which is right almost always and surprising occasionally." },
              { t: "widget", id: "dataPropagation" },
              { t: "table", headers: ["Propagation", "If a transaction exists", "If none exists"], rows: [
                ["REQUIRED (default)", "Join it", "Start one"],
                ["REQUIRES_NEW", "Suspend it, start an independent one", "Start one"],
                ["NESTED", "Savepoint inside it", "Start one"],
                ["MANDATORY", "Join it", "Throw"],
                ["SUPPORTS", "Join it", "Run without"],
                ["NOT_SUPPORTED", "Suspend it, run without", "Run without"],
                ["NEVER", "Throw", "Run without"]
              ] },
              { t: "note", variant: "trap", html: "<strong>Catching an exception does not rescue a REQUIRED transaction.</strong> When an exception leaves an inner transactional method, the shared transaction is marked rollback-only. The outer method may catch it and continue, but the commit then fails with <code class='tok'>UnexpectedRollbackException</code>." },
              { t: "ul", items: [
                "Use <code class='tok'>REQUIRES_NEW</code> for work that must survive the caller's rollback, such as an audit record of a failed attempt.",
                "Every <code class='tok'>REQUIRES_NEW</code> holds a second connection while the outer one waits. Nested in hot paths, it can deadlock the pool.",
                "<code class='tok'>NESTED</code> needs savepoint support in the transaction manager; plain JPA with Hibernate does not provide it.",
                "If you find yourself reasoning about propagation a lot, the use-case boundaries are probably wrong."
              ] },
              { t: "note", variant: "key", html: "<strong>REQUIRED shares fate; REQUIRES_NEW buys independence with a second connection.</strong> Choose propagation deliberately, and do not expect a caught exception to save a rollback-only transaction." }
            ]
          },
          {
            id: "isolation-locking",
            title: "Isolation levels and locking strategies",
            summary: "Which anomalies each isolation level allows, and when to use optimistic versions, pessimistic locks, atomic updates or constraints.",
            minutes: 11,
            tags: ["isolation", "optimistic-locking", "concurrency"],
            blocks: [
              { t: "p", html: "Your service runs on many threads and many instances; the database is where concurrent writes actually meet. <strong>Isolation levels</strong> define which anomalies the database prevents for you; <strong>locking strategies</strong> cover the rest." },
              { t: "table", headers: ["Anomaly", "Example", "Prevented at"], rows: [
                ["Dirty read", "See another transaction's uncommitted change", "READ COMMITTED and above"],
                ["Non-repeatable read", "Same row read twice, different values", "REPEATABLE READ and above"],
                ["Phantom", "Same query, new rows appear", "SERIALIZABLE (and some REPEATABLE READ implementations)"],
                ["Lost update", "Two read-modify-writes; one overwrites the other", "Versioning, locks, atomic updates, or stronger isolation"],
                ["Write skew", "Two transactions each check a rule and both write", "SERIALIZABLE, or explicit locks and constraints"]
              ] },
              { t: "p", html: "PostgreSQL defaults to READ COMMITTED and MySQL InnoDB to REPEATABLE READ. Most services keep the default and protect specific invariants explicitly:" },
              { t: "code", lang: "java", code: J([
                "// 1. optimistic: detect conflicts, no locks held",
                "@Entity class Product { @Id Long id; @Version long version; BigDecimal price; }",
                "// stale update -> ObjectOptimisticLockingFailureException -> map to 409 Conflict",
                "",
                "// 2. pessimistic: lock the row for the transaction, with a timeout",
                "@Lock(LockModeType.PESSIMISTIC_WRITE)",
                "@QueryHints(@QueryHint(name = \"jakarta.persistence.lock.timeout\", value = \"2000\"))",
                "Optional<Account> findForUpdateById(long id);   // SELECT ... FOR UPDATE",
                "",
                "// 3. atomic conditional update: check and write in one statement",
                "@Modifying",
                "@Query(\"update Stock s set s.qty = s.qty - :n where s.sku = :sku and s.qty >= :n\")",
                "int reserve(String sku, int n);                  // 0 rows -> out of stock"
              ]) },
              { t: "table", headers: ["Strategy", "Best when", "Cost"], rows: [
                ["Optimistic <code class='tok'>@Version</code>", "Conflicts are rare; user edits", "Retries or 409s on conflict"],
                ["Pessimistic lock", "Conflicts are frequent; short critical updates", "Blocking, deadlock risk, needs timeouts"],
                ["Atomic UPDATE", "Counters, stock, balances", "Logic must fit one statement"],
                ["Unique constraint", "'Only one' rules: one active subscription, one key", "Handle the violation as a business outcome"]
              ] },
              { t: "note", variant: "trap", html: "<strong>Java locks do not protect database rows.</strong> A <code class='tok'>synchronized</code> service method serializes one JVM; the second instance runs the same code in parallel. Put concurrency control where the data lives." },
              { t: "p", html: "System-level view of isolation and anomalies: <a class='inline' href='../hld-lld-academy/index.html#/hld/data/transactions-isolation'>Blueprint: transactions and isolation</a>." },
              { t: "quiz", id: "data-tx" },
              { t: "note", variant: "key", html: "<strong>Name the invariant, then pick the mechanism.</strong> Versions for rare conflicts, row locks with timeouts for hot ones, atomic updates for counters, and constraints for uniqueness \u2014 all in the database, not the JVM." }
            ]
          }
        ]
      },
      {
        id: "ops",
        name: "Schema, Pools & Caching",
        icon: "wrench",
        lessons: [
          {
            id: "migrations",
            title: "Schema migrations with Flyway or Liquibase",
            summary: "Versioned, reviewed migrations, compatibility with rolling deploys, and the expand-and-contract pattern.",
            minutes: 9,
            tags: ["flyway", "liquibase", "migrations"],
            blocks: [
              { t: "p", html: "The schema is code. Changes go through <strong>versioned migrations</strong> kept in the repository, reviewed like any other change, and applied in order by a tool such as <strong>Flyway</strong> or <strong>Liquibase</strong>. Hibernate should only <em>validate</em> that mappings match." },
              { t: "code", lang: "text", code: J([
                "src/main/resources/db/migration/",
                "  V1__create_orders.sql",
                "  V2__add_orders_status_index.sql",
                "  V3__add_customer_email_column.sql",
                "",
                "# application.yml",
                "# spring.jpa.hibernate.ddl-auto: validate",
                "# spring.flyway.enabled: true"
              ]) },
              { t: "ul", items: [
                "Never edit a migration that has run anywhere; add a new one. Flyway's checksums will reject the edit.",
                "Run migrations once per deploy, either at startup with a lock or as a separate job before the rollout.",
                "Big tables: build indexes without blocking writes (for example <code class='tok'>CREATE INDEX CONCURRENTLY</code> in PostgreSQL) and backfill in batches.",
                "Test migrations against a real database engine in CI \u2014 see <a class='inline' href='#/test/integration/testcontainers'>Testcontainers</a>."
              ] },
              { t: "h", text: "Expand and contract" },
              { t: "p", html: "During a rolling deploy, version N and N+1 run against the same schema. Every migration must work with both. Breaking changes are split across releases:" },
              { t: "ol", items: [
                "<strong>Expand</strong>: add the new column or table, nullable or with a default.",
                "<strong>Migrate</strong>: the app writes both shapes; backfill old rows in batches.",
                "<strong>Switch</strong>: reads move to the new shape.",
                "<strong>Contract</strong>: a later release stops writing the old shape and drops it."
              ] },
              { t: "note", variant: "trap", html: "<strong>ddl-auto=update in production is a data-loss lottery.</strong> It is unversioned, unreviewed, cannot rename safely and differs between environments. Use migrations and <code class='tok'>validate</code>." },
              { t: "p", html: "Deeper dive: <a class='inline' href='../hld-lld-academy/index.html#/hld/data/zero-downtime-data-migrations'>Blueprint: zero-downtime data migrations</a>." },
              { t: "note", variant: "key", html: "<strong>Migrations are immutable, versioned and compatible with the previous release.</strong> Expand first, contract later, and let Hibernate only validate." }
            ]
          },
          {
            id: "connection-pooling",
            title: "Connection pooling with HikariCP",
            summary: "Small pools, fleet-wide connection budgets, timeouts that match the network, leak detection and the metrics to watch.",
            minutes: 9,
            tags: ["hikaricp", "connection-pool", "database"],
            blocks: [
              { t: "p", html: "Opening a database connection is slow, so Spring Boot uses a pool, <strong>HikariCP</strong> by default. The pool size is a throttle on how much concurrent work you send to the database, and the database is usually happiest with fewer, busier connections than people expect." },
              { t: "widget", id: "dataPoolSizing" },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  datasource:",
                "    url: ${DB_URL}",
                "    username: ${DB_USER}",
                "    password: ${DB_PASSWORD}",
                "    hikari:",
                "      maximum-pool-size: 20          # per instance; budget the fleet against the DB limit",
                "      connection-timeout: 2000       # ms to wait for a connection before failing fast",
                "      max-lifetime: 1500000          # below any proxy or DB idle cut-off",
                "      leak-detection-threshold: 20000 # log a stack trace for connections held too long"
              ]) },
              { t: "ul", items: [
                "A starting point for pool size is around <code class='tok'>cores \u00d7 2</code> of the database server, shared across all instances, then measure.",
                "Fleet total = instances \u00d7 pool size; autoscaling multiplies it. Stay below the database limit with headroom for migrations and admin sessions.",
                "The default connection timeout is 30 s, which turns a saturated pool into 30 s requests; fail faster.",
                "Watch <code class='tok'>hikaricp_connections_pending</code> and <code class='tok'>hikaricp_connections_usage_seconds</code>, not just active count."
              ] },
              { t: "note", variant: "trap", html: "<strong>A bigger pool rarely fixes pool exhaustion.</strong> The usual cause is connections held too long: slow queries, remote calls inside transactions, or open-in-view rendering. Fix the hold time and the pool shrinks back." },
              { t: "note", variant: "tip", html: "<strong>Virtual threads make this more important.</strong> Thread count stops limiting concurrency, so the pool becomes the real throttle. Keep it small and its timeout short." },
              { t: "note", variant: "key", html: "<strong>Pools are throttles, budgeted across the fleet.</strong> Keep them small, transactions short and timeouts tight, and alert on pending connections." }
            ]
          },
          {
            id: "caching",
            title: "Caching with Spring's cache abstraction",
            summary: "Cache-aside with @Cacheable, local Caffeine vs distributed Redis, TTLs, key design, invalidation and stampede protection.",
            minutes: 10,
            tags: ["caching", "caffeine", "redis"],
            blocks: [
              { t: "p", html: "A cache trades freshness for speed. Spring's cache abstraction implements <strong>cache-aside</strong> declaratively: check the cache, on a miss call the method and store the result. The hard parts are what you cache, for how long, and how you keep it correct." },
              { t: "code", lang: "java", code: J([
                "@Service",
                "class CatalogService {",
                "",
                "  @Cacheable(cacheNames = \"product-view\", key = \"#tenantId + ':' + #sku\", sync = true)",
                "  public ProductView view(String tenantId, String sku) {   // cache DTOs, not entities",
                "    return mapper.toView(products.require(tenantId, sku));",
                "  }",
                "",
                "  @CacheEvict(cacheNames = \"product-view\", key = \"#cmd.tenantId() + ':' + #cmd.sku()\")",
                "  @Transactional",
                "  public void update(UpdateProduct cmd) { ... }",
                "}"
              ]) },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  cache:",
                "    type: caffeine",
                "    cache-names: product-view",
                "    caffeine:",
                "      spec: maximumSize=50000,expireAfterWrite=10m   # always bound size and age"
              ]) },
              { t: "table", headers: ["Choice", "Local (Caffeine)", "Distributed (Redis)"], rows: [
                ["Latency", "Nanoseconds", "A network round trip"],
                ["Consistency across instances", "Each instance has its own copy", "Shared"],
                ["Invalidation", "Per instance; needs TTL or a broadcast", "One place"],
                ["Failure mode", "None extra", "Cache outage must not take the service down"]
              ] },
              { t: "h", text: "Stampedes and staleness" },
              { t: "ul", items: [
                "<strong>Always set a TTL</strong>: it bounds staleness and memory even when invalidation is missed.",
                "<code class='tok'>sync = true</code> lets one thread per key load on a miss while others wait (per instance).",
                "Add jitter to TTLs so hot keys do not expire together; refresh hot entries ahead of expiry.",
                "Put every input that changes the result, including tenant and user, in the key."
              ] },
              { t: "note", variant: "trap", html: "<strong>@Cacheable on a self-invoked method does nothing,</strong> just like @Transactional. And caching a JPA entity caches a detached object with lazy fields waiting to fail; cache immutable DTOs." },
              { t: "p", html: "Strategy and eviction trade-offs at system level: <a class='inline' href='../hld-lld-academy/index.html#/hld/caching/cache-strategies'>Blueprint: cache strategies</a>." },
              { t: "quiz", id: "data-ops" },
              { t: "note", variant: "key", html: "<strong>Cache DTOs with a TTL and a complete key.</strong> Evict on write, coalesce misses for hot keys, and make sure a cache failure degrades to slower, not broken." }
            ]
          },
          {
            id: "redis-caching",
            title: "Redis caching in production",
            summary: "RedisCacheManager with JSON values and per-cache TTLs, failing open on outages, two-level caches and Redis memory policy.",
            minutes: 9,
            tags: ["redis", "cache", "lettuce"],
            blocks: [
              { t: "p", html: "Moving the <a class='inline' href='#/data/ops/caching'>cache abstraction</a> from Caffeine to Redis gives every instance the same view and one place to invalidate. It also adds a network hop, a serialization format and a new way to fail." },
              { t: "code", lang: "yaml", code: J([
                "spring:",
                "  data:",
                "    redis:",
                "      host: ${REDIS_HOST}",
                "      port: 6379",
                "      password: ${REDIS_PASSWORD}     # injected from the secret store, never committed",
                "      ssl:",
                "        enabled: true",
                "      timeout: 200ms                   # command timeout: a cache must be fast or skipped",
                "      connect-timeout: 500ms",
                "  cache:",
                "    type: redis",
                "    redis:",
                "      key-prefix: \"orders-svc:v3:\"   # bump the version to invalidate on breaking DTO changes",
                "      time-to-live: 10m"
              ]) },
              { t: "code", lang: "java", code: J([
                "@Bean",
                "RedisCacheManagerBuilderCustomizer caches() {",
                "  var json = RedisSerializationContext.SerializationPair",
                "      .fromSerializer(new GenericJackson2JsonRedisSerializer());",
                "  return builder -> builder",
                "      .cacheDefaults(RedisCacheConfiguration.defaultCacheConfig().serializeValuesWith(json))",
                "      .withCacheConfiguration(\"product-view\",",
                "          RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(5)).serializeValuesWith(json))",
                "      .withCacheConfiguration(\"fx-rates\",",
                "          RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofHours(1)).serializeValuesWith(json));",
                "}",
                "",
                "@Configuration",
                "class CacheConfig implements CachingConfigurer {",
                "  @Override public CacheErrorHandler errorHandler() {",
                "    return new LoggingCacheErrorHandler();   // log and fall through to the real method",
                "  }",
                "}"
              ]) },
              { t: "ul", items: [
                "<strong>Fail open:</strong> tight timeouts plus a logging CacheErrorHandler turn a Redis outage into slower responses instead of errors. Watch the database: it now takes the full load.",
                "<strong>Serialize as JSON</strong> with versioned key prefixes, so rolling deploys with changed DTOs do not crash on old entries.",
                "<strong>Two levels</strong> for very hot keys: a small Caffeine cache (seconds) in front of Redis (minutes) cuts round trips; accept slightly more staleness.",
                "<strong>Memory policy:</strong> give cache-only Redis a <code class='tok'>maxmemory</code> and an LRU/LFU eviction policy; do not share that instance with data you cannot lose (locks, rate-limit buckets, sessions) without thinking it through.",
                "<strong>Big values hurt:</strong> Redis is single-threaded per shard; multi-megabyte values or KEYS/SCAN-heavy patterns stall everyone."
              ] },
              { t: "note", variant: "warn", html: "<strong>Bulk eviction is expensive.</strong> <code class='tok'>@CacheEvict(allEntries = true)</code> on Redis scans keys by pattern. Prefer precise keys, TTLs, or a version bump in the key prefix." },
              { t: "note", variant: "key", html: "<strong>Redis is shared, so treat it as a dependency.</strong> Bound every call with timeouts, fail open, serialize as versioned JSON, set TTLs per cache and size the instance with an eviction policy." }
            ]
          }
        ]
      }
    ]
  };
})();
