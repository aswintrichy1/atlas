/* =====================================================================
   PYXIS · Web Services
   window.TRACKS.web — modules: fastapi / platform
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     poolSizer — connections across pods, workers and pools
  ================================================================== */
  Widgets.poolSizer = function (mount) {
    K.shell(mount, "capacity", "Connection pool sizer",
      "Every worker process gets its own SQLAlchemy pool. Multiply it out against the database's connection limit, then use Little's law to see how many connections the traffic actually needs.");
    var s = { dbMax: 200, pods: 4, workers: 4, pool: 5, overflow: 10, rps: 300, ms: 20 };
    var readout = h("div", { class: "w-readout" });
    var meter = h("div", { class: "w-stage", style: "display:grid;gap:6px" });

    function paint() {
      var procs = s.pods * s.workers;
      var steady = procs * s.pool;
      var worst = procs * (s.pool + s.overflow);
      var reserved = 10;
      var budget = s.dbMax - reserved;
      var needed = Math.ceil(s.rps * s.ms / 1000);
      var verdict, tone;
      if (worst > budget) { verdict = "Over the limit: a traffic spike or a deploy (old and new pods overlap) can exhaust the database's connections and new logins fail. Lower overflow, use fewer pools, or put PgBouncer in front."; tone = "var(--rose)"; }
      else if (needed > steady) { verdict = "Pools too small for the load: requests queue waiting for a connection (pool timeout errors) even though the database has headroom."; tone = "var(--accent)"; }
      else { verdict = "Healthy: steady-state pools cover the concurrency the traffic needs, and the worst case still fits the database budget."; tone = "var(--lime)"; }

      K.clear(meter);
      var pctWorst = Math.min(100, Math.round(worst / s.dbMax * 100));
      var pctSteady = Math.min(100, Math.round(steady / s.dbMax * 100));
      meter.appendChild(h("div", { style: "font-size:0.78rem;color:var(--text-dim)" }, "database connections used (of " + s.dbMax + ", " + reserved + " reserved for admin)"));
      meter.appendChild(h("div", { style: "position:relative;height:16px;border-radius:8px;background:var(--surface-2);overflow:hidden" },
        h("div", { style: "position:absolute;inset:0 auto 0 0;width:" + pctWorst + "%;background:" + tone + ";opacity:0.45" }),
        h("div", { style: "position:absolute;inset:0 auto 0 0;width:" + pctSteady + "%;background:" + tone + "" })));

      K.clear(readout);
      readout.appendChild(K.ro("processes", s.pods + " pods \u00d7 " + s.workers + " workers = " + procs));
      readout.appendChild(K.ro("steady (pool_size)", String(steady)));
      readout.appendChild(K.ro("worst (+ max_overflow)", String(worst)));
      readout.appendChild(K.ro("needed (rps \u00d7 query time)", String(needed)));
      readout.appendChild(K.ro("db budget", String(budget)));
      readout.appendChild(K.wide(verdict));
    }
    var ctl = h("div", { class: "w-stage", style: "display:flex;flex-wrap:wrap;gap:12px;align-items:center" });
    ctl.appendChild(K.labeled("db max_connections", K.segment([["200", "200"], ["100", "100"], ["500", "500"]], 0, function (v) { s.dbMax = +v; paint(); })));
    ctl.appendChild(K.labeled("pods", K.range(1, 20, 1, s.pods, function (v) { s.pods = v; paint(); })));
    ctl.appendChild(K.labeled("workers / pod", K.range(1, 8, 1, s.workers, function (v) { s.workers = v; paint(); })));
    ctl.appendChild(K.labeled("pool_size", K.range(1, 20, 1, s.pool, function (v) { s.pool = v; paint(); })));
    ctl.appendChild(K.labeled("max_overflow", K.range(0, 20, 1, s.overflow, function (v) { s.overflow = v; paint(); })));
    ctl.appendChild(K.labeled("requests / s", K.range(50, 3000, 50, s.rps, function (v) { s.rps = v; paint(); })));
    ctl.appendChild(K.labeled("query ms", K.range(2, 200, 2, s.ms, function (v) { s.ms = v; paint(); })));
    mount.appendChild(ctl);
    mount.appendChild(meter);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "web-fastapi": {
      title: "FastAPI and frameworks checkpoint",
      sub: "ASGI, request models, dependencies and framework choice.",
      questions: [
        {
          q: "What does ASGI add over WSGI?",
          options: ["Nothing; it is a rename","Built-in database access","Automatic multiprocessing","An async interface (scope, receive, send) that supports long-lived connections such as WebSockets plus lifespan events"],
          answer: 3,
          explain: "WSGI is a synchronous call per request. ASGI lets one process interleave many in-flight connections on an event loop and models streaming, WebSockets and startup/shutdown."
        },
        {
          q: "In FastAPI, a path operation is declared with plain def instead of async def. What happens?",
          options: ["It fails to start","It runs on the event loop and blocks it","FastAPI runs it in a thread pool so blocking calls inside do not stall the event loop","It runs in a separate process"],
          answer: 2,
          explain: "Sync handlers are offloaded to a worker thread pool. The danger is the opposite case: blocking calls inside async def run on the loop and freeze every request in that process."
        },
        {
          q: "What does a FastAPI dependency written with yield give you?",
          options: ["Streaming responses","Setup before the handler and guaranteed cleanup after it, for example opening and closing a database session per request","A background task","Caching across requests"],
          answer: 1,
          explain: "Code before yield runs first; the yielded value is injected; code after yield runs once the response is done, even on errors. It is the per-request context manager."
        },
        {
          q: "How do you replace a real dependency with a fake in FastAPI tests?",
          options: ["Set app.dependency_overrides[real_dep] = fake_dep for the test, then clear it","Edit the handler signature for tests","Restart the app with a different import path","It is not possible"],
          answer: 0,
          explain: "dependency_overrides swaps the provider at the injection point without touching handler code or monkeypatching modules. Clear it afterwards so overrides do not leak between tests."
        },
        {
          q: "A team needs an admin UI, auth, ORM and migrations for a content-heavy internal app with server-rendered pages. Which is the most natural fit?",
          options: ["Django, whose batteries-included stack provides all of those out of the box","FastAPI","Flask with no extensions","A bare ASGI app"],
          answer: 0,
          explain: "Django's admin, auth, ORM and migrations are integrated and mature. FastAPI shines for typed JSON APIs; Flask for small services where you choose each extension."
        },
        {
          q: "What does response_model (or a return type annotation) do in FastAPI?",
          options: ["Only documents the endpoint","Speeds up serialisation by caching","Sets the status code","Validates and filters the outgoing data to the declared schema, so internal fields such as password hashes are not leaked"],
          answer: 3,
          explain: "The response is serialised through the declared model, dropping fields not in it. Returning an ORM object with a hash column through a public schema keeps the hash out of the JSON."
        }
      ]
    },
    "web-platform": {
      title: "Database, security and observability checkpoint",
      sub: "SQLAlchemy, migrations, pools, security controls and telemetry.",
      questions: [
        {
          q: "A list endpoint issues one query for orders and then one query per order for its customer. What is this and how do you fix it in SQLAlchemy?",
          options: ["A deadlock; add retries","Connection leak; increase the pool","The N+1 problem; eager-load with selectinload or joinedload","Normal behaviour"],
          answer: 2,
          explain: "Lazy loading inside a loop multiplies queries with the row count. selectinload issues one extra IN query for all related rows; joinedload uses a JOIN for many-to-one."
        },
        {
          q: "Why should an Alembic autogenerated migration always be reviewed?",
          options: ["It is always wrong","Autogenerate can miss or misread changes (renames look like drop plus add, some constraints and server defaults are not detected), and it does not plan zero-downtime steps","It cannot run in CI","It deletes data by design"],
          answer: 1,
          explain: "A rename detected as drop-and-add destroys a column's data. Review the script, and split risky changes into expand and contract steps."
        },
        {
          q: "Twelve pods each run four workers with pool_size=5 and max_overflow=10 against a database limited to 300 connections. What is the risk?",
          options: ["None","The worst case is 12 × 4 × 15 = 720 connections, far over the limit, so spikes or rolling deploys exhaust the database","Requests will be too fast","Pools are shared, so it is only 15"],
          answer: 1,
          explain: "Each worker process owns its own pool. Multiply processes by pool_size plus overflow and compare with the database budget, or use an external pooler like PgBouncer."
        },
        {
          q: "Which approach prevents SQL injection?",
          options: ["Bound parameters (ORM expressions or text() with :params), never formatting user input into SQL strings","Escaping quotes manually","Validating that input has no spaces","Using POST instead of GET"],
          answer: 0,
          explain: "With bound parameters the driver sends data separately from the statement, so input cannot change the query's structure. f-strings in SQL are the classic bug."
        },
        {
          q: "When validating a JWT access token, which check is essential?",
          options: ["Decode it without verifying, then read the claims","Check only that it is base64","Trust it if it came over HTTPS","Verify the signature with an allow-listed algorithm and check exp, iss and aud"],
          answer: 3,
          explain: "Unverified decoding lets anyone forge claims. Pin the algorithm, verify the signature with the issuer's key, and check expiry, issuer and audience."
        },
        {
          q: "Which telemetry lets you follow a single slow request across the API, a queue and a worker?",
          options: ["CPU metrics","Access logs alone","Distributed tracing with context propagation (for example OpenTelemetry), linking spans under one trace ID","Health checks"],
          answer: 2,
          explain: "A trace stitches spans from each hop into one timeline. Put the trace ID in logs too so you can jump from a slow span to its log lines."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.web = {
    id: "web",
    name: "Web Services",
    short: "WEB",
    tagline: "APIs that stay up",
    color: "#a3e635",
    blurb: "WSGI and ASGI servers, FastAPI request models and dependency injection, an honest FastAPI vs Django vs Flask comparison, then SQLAlchemy 2.0, migrations and connection pools, web security controls, and observability with traces, metrics and health checks.",
    modules: [
      {
        id: "fastapi",
        name: "FastAPI and friends",
        icon: "globe",
        lessons: [
          L("asgi-wsgi", "WSGI, ASGI and app servers", "How a request reaches your Python code, what the server and workers do, and why async servers change the concurrency model.", 8, ["asgi", "wsgi", "uvicorn"], [
            B.p("A Python web app is a callable that a <strong>server</strong> invokes. <strong>WSGI</strong> (the long-standing standard behind Django and Flask deployments) calls your app once per request and waits for the full response. <strong>ASGI</strong> is its async successor: the app is a coroutine that receives events and sends messages, so one process can juggle many open connections."),
            B.diagram("web-request", "From socket to handler: a process manager supervises workers; each worker runs a server loop that calls your app through WSGI or ASGI."),
            B.code("python", [
              "# WSGI: synchronous, one call per request",
              "def app(environ, start_response):",
              "    start_response(\"200 OK\", [(\"Content-Type\", \"text/plain\")])",
              "    return [b\"ok\"]",
              "",
              "# ASGI: async, message-based",
              "async def app(scope, receive, send):",
              "    await send({\"type\": \"http.response.start\", \"status\": 200,",
              "                \"headers\": [(b\"content-type\", b\"text/plain\")]})",
              "    await send({\"type\": \"http.response.body\", \"body\": b\"ok\"})"
            ]),
            B.table(["", "WSGI", "ASGI"], [
              ["Model", "Sync call per request", "Async events per connection"],
              ["Concurrency per worker", "1 request (or N with threads)", "Many in-flight requests on one loop"],
              ["WebSockets / streaming", "Awkward", "First-class"],
              ["Typical servers", "gunicorn, uWSGI, mod_wsgi", "uvicorn, hypercorn, granian"],
              ["Frameworks", "Django (classic), Flask", "FastAPI, Starlette, Django (async), Litestar"]
            ]),
            B.p("In production you usually run <strong>several worker processes</strong> per container (one per core is a sensible start) so CPU work and crashes are isolated, and a process manager restarts dead workers. In Kubernetes, many teams run one worker per pod and let the orchestrator scale pods instead."),
            B.warn("ASGI concurrency only helps if handlers actually await. A blocking database driver called from <code class='tok'>async def</code> serialises the entire worker. Use async drivers or plain <code class='tok'>def</code> handlers that run in the thread pool."),
            B.cue("<strong>Interview cue:</strong> \"workers give parallelism across cores; the event loop gives concurrency within a worker\" explains why you tune both."),
            B.key("<strong>The server calls your app.</strong> WSGI is one sync call per request; ASGI is async events. Scale with processes, and keep async handlers non-blocking.")
          ]),
          L("fastapi-basics", "FastAPI: typed endpoints", "Path operations, Pydantic request and response models, status codes, error handling and lifespan setup.", 9, ["fastapi", "pydantic", "api"], [
            B.p("FastAPI turns type hints into behaviour: parameters are parsed and validated from the path, query and body; responses are filtered through declared models; and an OpenAPI schema is generated from the same types."),
            B.code("python", [
              "from contextlib import asynccontextmanager",
              "from fastapi import FastAPI, HTTPException, status",
              "from pydantic import BaseModel, Field",
              "",
              "class OrderIn(BaseModel):",
              "    sku: str = Field(min_length=3, max_length=32)",
              "    qty: int = Field(gt=0, le=1000)",
              "",
              "class OrderOut(BaseModel):",
              "    id: int",
              "    sku: str",
              "    qty: int",
              "",
              "@asynccontextmanager",
              "async def lifespan(app: FastAPI):",
              "    app.state.http = make_http_client()      # startup",
              "    yield",
              "    await app.state.http.aclose()             # shutdown",
              "",
              "app = FastAPI(lifespan=lifespan)",
              "",
              "@app.post(\"/orders\", status_code=status.HTTP_201_CREATED)",
              "async def create_order(body: OrderIn) -> OrderOut:",
              "    order = await orders.create(body.sku, body.qty)",
              "    return OrderOut.model_validate(order, from_attributes=True)",
              "",
              "@app.get(\"/orders/{order_id}\")",
              "async def get_order(order_id: int) -> OrderOut:",
              "    order = await orders.get(order_id)",
              "    if order is None:",
              "        raise HTTPException(status.HTTP_404_NOT_FOUND, \"order not found\")",
              "    return OrderOut.model_validate(order, from_attributes=True)"
            ]),
            B.table(["Feature", "What you get"], [
              ["Typed parameters", "422 with field-level errors on invalid input"],
              ["Return type / response_model", "Output filtered to the schema: no leaked internal fields"],
              ["Lifespan", "One place for startup and shutdown of clients and pools"],
              ["OpenAPI", "Interactive docs and client generation from the same types"]
            ]),
            B.tip("Keep separate input and output models. Reusing one model for create, update and read invites mass-assignment bugs, such as a client setting <code class='tok'>is_admin</code>."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"return the user from the endpoint\". Ask which schema it goes out through, so the password hash and internal flags stay server-side."),
            B.key("<strong>Types are the contract.</strong> Validate input with models, filter output through response schemas, and manage clients in the lifespan.")
          ]),
          L("dependency-injection", "Dependencies, sessions and auth", "Use Depends for per-request resources and cross-cutting checks, yield for cleanup, and overrides for tests.", 8, ["depends", "di", "testing"], [
            B.p("FastAPI's <code class='tok'>Depends</code> lets a handler declare what it needs. The framework builds the dependency graph per request, caches each dependency within that request, and runs cleanup code after the response. It replaces globals with explicit, testable inputs."),
            B.code("python", [
              "from collections.abc import AsyncIterator",
              "from typing import Annotated",
              "from fastapi import Depends, HTTPException, status",
              "from sqlalchemy.ext.asyncio import AsyncSession",
              "",
              "async def get_session() -> AsyncIterator[AsyncSession]:",
              "    async with SessionLocal() as session:     # one session per request",
              "        yield session                          # cleanup runs after the response",
              "",
              "async def current_user(token: Annotated[str, Depends(oauth2_scheme)],",
              "                       session: Annotated[AsyncSession, Depends(get_session)]) -> User:",
              "    user = await verify_and_load(token, session)",
              "    if user is None:",
              "        raise HTTPException(status.HTTP_401_UNAUTHORIZED)",
              "    return user",
              "",
              "DB = Annotated[AsyncSession, Depends(get_session)]",
              "CurrentUser = Annotated[User, Depends(current_user)]",
              "",
              "@app.get(\"/me/orders\")",
              "async def my_orders(user: CurrentUser, session: DB) -> list[OrderOut]:",
              "    return await orders.for_user(session, user.id)"
            ]),
            B.code("python", [
              "# tests: swap providers at the injection point",
              "from fastapi.testclient import TestClient",
              "",
              "def test_my_orders(fake_user):",
              "    app.dependency_overrides[current_user] = lambda: fake_user",
              "    try:",
              "        r = TestClient(app).get(\"/me/orders\")",
              "        assert r.status_code == 200",
              "    finally:",
              "        app.dependency_overrides.clear()"
            ]),
            B.tip("Declare reusable aliases with <code class='tok'>Annotated</code> (<code class='tok'>DB</code>, <code class='tok'>CurrentUser</code>) so signatures stay short and every handler resolves dependencies the same way."),
            B.trap("Do not commit inside a dependency's cleanup unconditionally. Decide explicitly where the transaction boundary lives, usually in the service layer, so an exception after a partial write rolls back."),
            B.cue("<strong>Interview cue:</strong> \"dependencies are constructor injection for request handlers\": explicit inputs, scoped lifetimes, easy overrides."),
            B.key("<strong>Depends declares what a handler needs.</strong> Yield for per-request resources, Annotated aliases for reuse, dependency_overrides for tests.")
          ]),
          L("frameworks-compare", "FastAPI vs Django vs Flask", "Compare the three on what they include, async support, typing and team fit, and pick by product shape rather than benchmarks.", 8, ["django", "flask", "comparison"], [
            B.p("All three are mature and run large production systems. The difference is <strong>how much is decided for you</strong>. Django ships an integrated platform; Flask ships a small core and lets you choose; FastAPI ships a typed API layer built on Starlette and Pydantic and leaves persistence to you."),
            B.table(["Dimension", "FastAPI", "Django", "Flask"], [
              ["Sweet spot", "Typed JSON APIs, async I/O", "Full web apps, admin-heavy products", "Small services, custom stacks"],
              ["Included", "Validation, DI, OpenAPI", "ORM, migrations, admin, auth, forms, templates", "Routing, templates; rest via extensions"],
              ["Data layer", "Bring your own (SQLAlchemy, SQLModel)", "Django ORM", "Bring your own"],
              ["Async", "Native ASGI", "Async views and an async ORM interface; some parts still sync", "Async views run per request; WSGI-first"],
              ["Typing", "Central to the design", "Optional, stubs available", "Optional"],
              ["Learning curve", "Low for APIs", "Higher, but conventions answer many questions", "Lowest to start, decisions grow later"]
            ]),
            B.cmp("Picking by benchmark", ["Choosing the framework with the best hello-world requests per second", "Ignoring that the database and network dominate real latency", "Rebuilding admin, auth and migrations by hand"],
              "Picking by product shape", ["Is it an API, a web app with an admin, or a tiny service?", "What does the team already know and operate?", "Which batteries would we otherwise build and maintain ourselves?"]),
            B.code("python", [
              "# Django: one model drives the table, migrations, admin and forms",
              "class Order(models.Model):",
              "    sku = models.CharField(max_length=32)",
              "    qty = models.PositiveIntegerField()",
              "",
              "# Flask: explicit and minimal",
              "@bp.post(\"/orders\")",
              "def create_order():",
              "    body = OrderIn.model_validate(request.get_json())   # you choose the validator",
              "    return OrderOut.model_validate(service.create(body), from_attributes=True).model_dump(), 201"
            ]),
            B.tip("Mixing is normal: a Django monolith for the back office and a FastAPI service for a high-traffic public API can share a database schema owned by one side's migrations."),
            B.quiz("web-fastapi"),
            B.cue("<strong>Interview cue:</strong> justify the choice in terms of included batteries, async needs and team familiarity, then name what you would add (ORM, auth, migrations) if the framework does not include it."),
            B.key("<strong>Choose by product shape.</strong> Django for integrated web apps, FastAPI for typed async APIs, Flask for minimal services, and own whatever the framework leaves out.")
          ])
        ]
      },
      {
        id: "platform",
        name: "Database, security and telemetry",
        icon: "database",
        lessons: [
          L("sqlalchemy", "SQLAlchemy 2.0 essentials", "Typed models, select() queries, sessions and transactions, and the loading strategies that prevent N+1 queries.", 9, ["sqlalchemy", "orm", "n+1"], [
            B.p("SQLAlchemy 2.0 unifies the Core and ORM around <code class='tok'>select()</code> and uses typed declarative models. A <strong>Session</strong> is a unit of work: it tracks loaded objects, flushes changes, and wraps a transaction you commit or roll back."),
            B.code("python", [
              "from sqlalchemy import ForeignKey, select",
              "from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, selectinload",
              "",
              "class Base(DeclarativeBase): ...",
              "",
              "class Customer(Base):",
              "    __tablename__ = \"customer\"",
              "    id: Mapped[int] = mapped_column(primary_key=True)",
              "    name: Mapped[str]",
              "",
              "class Order(Base):",
              "    __tablename__ = \"orders\"",
              "    id: Mapped[int] = mapped_column(primary_key=True)",
              "    customer_id: Mapped[int] = mapped_column(ForeignKey(\"customer.id\"), index=True)",
              "    customer: Mapped[Customer] = relationship()",
              "",
              "def recent_orders(session, limit: int) -> list[Order]:",
              "    stmt = (select(Order)",
              "            .options(selectinload(Order.customer))   # 2 queries total, not 1 + N",
              "            .order_by(Order.id.desc())",
              "            .limit(limit))",
              "    return list(session.scalars(stmt))",
              "",
              "with Session(engine) as session, session.begin():   # commit on success, rollback on error",
              "    session.add(Order(customer_id=7))"
            ]),
            B.table(["Loading strategy", "Queries", "Use for"], [
              ["Lazy (default)", "1 + one per access", "Rarely-accessed relationships"],
              ["<code class='tok'>selectinload</code>", "1 + one IN query per relationship", "Collections and most lists"],
              ["<code class='tok'>joinedload</code>", "1 with JOIN", "Many-to-one, small result sets"],
              ["<code class='tok'>raiseload</code>", "Raises on unexpected lazy load", "Catching N+1 in tests"]
            ]),
            B.warn("With <code class='tok'>AsyncSession</code>, implicit lazy loading cannot run inside an await-less attribute access and raises an error. Eager-load explicitly; it forces you to design the query up front, which is good."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"the list endpoint gets slower as data grows\". Count the queries per request; a count that scales with rows is N+1."),
            B.key("<strong>select(), sessions as units of work, explicit loading.</strong> Wrap writes in session.begin() and eager-load relationships you will touch.")
          ]),
          L("migrations-pools", "Migrations and connection pools", "Run Alembic migrations safely with expand and contract, and size connection pools against the database's real limits.", 9, ["alembic", "pool", "pgbouncer"], [
            B.p("Schema changes and connection management are where web services most often hurt their database. Both need arithmetic and a rollout plan, not defaults."),
            B.code("bash", [
              "alembic revision --autogenerate -m \"add order.status\"   # then READ the script",
              "alembic upgrade head                                     # run as a release step, not on every pod start",
              "alembic downgrade -1"
            ]),
            B.table(["Expand and contract step", "Example: rename name \u2192 full_name"], [
              ["1. Expand", "Add full_name nullable; deploy code that writes both"],
              ["2. Backfill", "Copy name to full_name in batches"],
              ["3. Switch reads", "Deploy code that reads full_name"],
              ["4. Contract", "Stop writing name; later drop the column"]
            ]),
            B.widget("poolSizer"),
            B.code("python", [
              "import os",
              "from sqlalchemy import create_engine",
              "",
              "engine = create_engine(",
              "    os.environ[\"DATABASE_URL\"],     # credentials come from the environment, never source",
              "    pool_size=5,                     # steady connections per process",
              "    max_overflow=5,                  # burst headroom per process",
              "    pool_timeout=5,                  # fail fast instead of hanging",
              "    pool_pre_ping=True,              # detect dead connections after failover",
              "    pool_recycle=1800,               # retire connections before server-side timeouts",
              ")"
            ]),
            B.tip("Little's law sizes pools: connections needed is about requests per second times average seconds holding a connection. 300 rps at 20 ms needs about 6, which is usually far fewer than teams configure."),
            B.trap("Running migrations from every pod's startup makes several processes race to apply the same revision. Run them once as a deploy job, and make migrations backward compatible with the code that is still running."),
            B.cue("<strong>Interview cue:</strong> multiply pods by workers by (pool_size + max_overflow) and compare with max_connections; mention PgBouncer in transaction mode when the product is too large."),
            B.key("<strong>Migrate in expand-and-contract steps and size pools with arithmetic.</strong> Every process owns a pool, and deploys briefly double the process count.")
          ]),
          L("web-security", "Web security essentials", "Validate input, parameterise SQL, verify tokens properly, hash passwords, and configure CORS, CSRF and rate limits deliberately.", 9, ["security", "jwt", "owasp"], [
            B.p("Most web vulnerabilities come from trusting input or misconfiguring a control. A short, consistent checklist applied to every service prevents the common classes."),
            B.table(["Threat", "Control in Python services"], [
              ["Injection", "Bound parameters via ORM or <code class='tok'>text(\":param\")</code>; never f-strings in SQL or shell"],
              ["Broken authentication", "Verify token signature, algorithm, exp, iss, aud; short-lived access tokens"],
              ["Broken authorisation", "Check object ownership on every request (no IDOR); deny by default"],
              ["Password storage", "Argon2id or bcrypt with per-password salt; never reversible encryption"],
              ["Mass assignment", "Separate input models; never bind request bodies straight onto ORM objects"],
              ["SSRF", "Allow-list outbound hosts; block internal address ranges for user-supplied URLs"],
              ["Abuse", "Rate limits per user and IP; request size limits; timeouts"]
            ]),
            B.code("python", [
              "import os",
              "import jwt                                  # PyJWT",
              "",
              "def verify(token: str) -> dict:",
              "    return jwt.decode(",
              "        token,",
              "        key=signing_key_for(token),           # fetched from the issuer's JWKS, cached",
              "        algorithms=[\"RS256\"],                 # allow-list: never accept 'none' or a client-chosen alg",
              "        audience=os.environ[\"API_AUDIENCE\"],",
              "        issuer=os.environ[\"TOKEN_ISSUER\"],",
              "        options={\"require\": [\"exp\", \"iat\", \"sub\"]},",
              "    )"
            ]),
            B.code("python", [
              "# bound parameters: data never becomes SQL",
              "session.execute(text(\"SELECT * FROM orders WHERE sku = :sku\"), {\"sku\": user_sku})"
            ]),
            B.warn("<code class='tok'>allow_origins=[\"*\"]</code> combined with credentials is rejected by browsers for good reason. List the exact front-end origins, and remember CORS is a browser policy, not authentication."),
            B.tip("If you authenticate with cookies, you need CSRF protection (SameSite cookies plus tokens for state-changing requests). Bearer tokens in headers are not sent automatically, so CSRF does not apply to them in the same way."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"GET /invoices/{id}\" with only authentication. Ask how it checks that the invoice belongs to the caller; missing ownership checks are the most common API flaw."),
            B.key("<strong>Never trust input, always verify tokens, check ownership per object.</strong> Parameterise SQL, hash passwords with Argon2 or bcrypt, and configure CORS by exact origin.")
          ]),
          L("observability-web", "Observability for web services", "Structured logs, RED metrics, distributed traces and honest health checks, wired together by shared IDs.", 8, ["opentelemetry", "metrics", "health"], [
            B.p("When a service misbehaves at 3 a.m. you need to answer: is it broken, for whom, since when, and where? <strong>Metrics</strong> detect, <strong>traces</strong> locate, <strong>logs</strong> explain. They are most useful when they share identifiers."),
            B.table(["Signal", "Python tooling", "Answers"], [
              ["RED metrics: rate, errors, duration", "Prometheus client or OpenTelemetry metrics", "Is it broken, how badly, since when?"],
              ["Traces", "OpenTelemetry SDK + FastAPI, SQLAlchemy, HTTP client instrumentation", "Which hop is slow for this request?"],
              ["Structured logs", "structlog or stdlib logging with a JSON formatter", "What exactly happened, with which inputs?"],
              ["Profiles", "Continuous sampling profiler", "Which code burns CPU in production?"]
            ]),
            B.code("python", [
              "from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor",
              "from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor",
              "",
              "FastAPIInstrumentor.instrument_app(app)        # a span per request",
              "SQLAlchemyInstrumentor().instrument(engine=engine)  # a child span per query",
              "",
              "@app.get(\"/healthz\")                            # liveness: the process is alive",
              "async def healthz() -> dict[str, str]:",
              "    return {\"status\": \"ok\"}",
              "",
              "@app.get(\"/readyz\")                             # readiness: can serve traffic now",
              "async def readyz() -> dict[str, str]:",
              "    await db_ping(timeout=0.5)",
              "    return {\"status\": \"ready\"}"
            ]),
            B.trap("Do not make liveness depend on the database. If the database blips, every pod fails liveness, gets restarted, and the outage becomes a restart storm. Dependencies belong in readiness."),
            B.tip("Keep metric labels low-cardinality: route templates like <code class='tok'>/orders/{id}</code>, never raw paths or user IDs, or your metrics backend's cost and memory explode."),
            B.quiz("web-platform"),
            B.cue("<strong>Interview cue:</strong> \"I would alert on RED metrics per route, trace every request with OpenTelemetry, and put the trace ID in every log line.\""),
            B.key("<strong>Metrics detect, traces locate, logs explain.</strong> Share trace IDs across all three, keep labels low-cardinality, and separate liveness from readiness.")
          ])
        ]
      }
    ]
  };
})();
