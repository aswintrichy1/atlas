/* =====================================================================
   PYXIS · Production Python
   window.TRACKS.prod — modules: config / ship
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     configResolver — layered configuration with validation
  ================================================================== */
  var LAYERS = ["default", "config file", "env var", "CLI flag", "secret store"];
  var ENVS = {
    local: {
      "default": { log_level: "INFO", pool_size: "5", timeout_s: "5" },
      "config file": { log_level: "DEBUG" },
      "secret store": { api_token: "(from gitignored .env, dev-only value)" }
    },
    ci: {
      "default": { log_level: "INFO", pool_size: "5", timeout_s: "5" },
      "env var": { log_level: "WARNING", pool_size: "2" },
      "secret store": { api_token: "(CI masked secret)" }
    },
    staging: {
      "default": { log_level: "INFO", pool_size: "5", timeout_s: "5" },
      "config file": { pool_size: "10" },
      "env var": { log_level: "INFO" },
      "secret store": { api_token: "(secret manager, staging path)" }
    },
    production: {
      "default": { log_level: "INFO", pool_size: "5", timeout_s: "5" },
      "config file": { pool_size: "20", timeout_s: "3" },
      "env var": { log_level: "WARNING" },
      "secret store": { api_token: "(secret manager, mounted file, rotated)" }
    }
  };
  var OVERRIDES = {
    none: {},
    env: { "env var": { log_level: "DEBUG" } },
    cli: { "CLI flag": { pool_size: "15" } },
    bad: { "env var": { pool_size: "lots" } }
  };
  var KEYS = ["log_level", "pool_size", "timeout_s", "api_token"];

  Widgets.configResolver = function (mount) {
    K.shell(mount, "config", "Layered configuration resolver",
      "Settings resolve from the lowest layer (defaults) to the highest (CLI flags). Secrets come only from a secret source. Pick an environment and an override to see the winning value, where it came from, and whether startup validation passes.");
    var env = "local", ov = "none";
    var table = h("div", { class: "w-stage", style: "display:grid;gap:4px;font-size:0.82rem" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var layers = {};
      LAYERS.forEach(function (l) {
        layers[l] = Object.assign({}, ENVS[env][l] || {}, (OVERRIDES[ov][l]) || {});
      });
      K.clear(table);
      table.appendChild(h("div", { style: "display:grid;grid-template-columns:110px 1fr 120px;gap:8px;color:var(--text-dim);font-weight:600" },
        h("span", {}, "setting"), h("span", {}, "resolved value"), h("span", {}, "source")));
      var errors = [];
      KEYS.forEach(function (k) {
        var val = null, src = "missing";
        LAYERS.forEach(function (l) { if (layers[l][k] !== undefined) { val = layers[l][k]; src = l; } });
        if (k === "pool_size" && val !== null && !/^\d+$/.test(val)) errors.push("pool_size='" + val + "' is not an integer");
        if (k === "pool_size" && /^\d+$/.test(val || "") && (+val < 1 || +val > 50)) errors.push("pool_size out of range 1..50");
        var shown = k === "api_token" ? "SecretStr('**********') " + val : val;
        table.appendChild(h("div", { style: "display:grid;grid-template-columns:110px 1fr 120px;gap:8px;color:var(--text)" },
          h("code", { class: "tok" }, k), h("span", {}, shown === null ? "\u2014" : shown),
          h("span", { style: "color:" + (src === "secret store" ? "var(--lime-ink)" : "var(--accent-ink)") }, src)));
      });
      K.clear(readout);
      readout.appendChild(K.ro("environment", env));
      readout.appendChild(K.ro("override", ov));
      readout.appendChild(K.ro("startup", errors.length ? "FAILS FAST" : "valid"));
      readout.appendChild(K.wide(errors.length
        ? "Validation error: " + errors.join("; ") + ". The process exits at startup with a clear message instead of misbehaving later under load."
        : "Every value is typed and validated once at startup. The secret's value is never printed: its repr is masked and it comes only from the secret layer."));
    }
    var ctl = h("div", { class: "w-stage", style: "display:flex;flex-wrap:wrap;gap:12px;align-items:center" });
    ctl.appendChild(K.labeled("environment", K.segment([["local", "local"], ["ci", "CI"], ["staging", "staging"], ["production", "production"]], 0, function (v) { env = v; paint(); })));
    ctl.appendChild(K.labeled("override", K.segment([["none", "none"], ["env", "LOG_LEVEL=DEBUG"], ["cli", "--pool-size 15"], ["bad", "POOL_SIZE=lots"]], 0, function (v) { ov = v; paint(); })));
    mount.appendChild(ctl);
    mount.appendChild(table);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "prod-config": {
      title: "Config, logging and secrets checkpoint",
      sub: "Twelve-factor config, structured logs, secrets and failure handling.",
      questions: [
        {
          q: "Why validate all configuration once at startup with a typed settings model?",
          options: ["A bad or missing value fails immediately with a clear error instead of surfacing hours later as a confusing runtime bug","It is faster at runtime","It hides configuration from operators","It is required by Python"],
          answer: 0,
          explain: "Fail fast. A typo in POOL_SIZE should stop the deploy, not appear as an exception deep inside a request at peak traffic."
        },
        {
          q: "Which is the best way to provide a database password to a containerised Python service?",
          options: ["A constant in settings.py","Commit it to a private repository","Bake it into the Docker image","Inject it at runtime from a secret manager (as an environment variable or mounted file), read it into a SecretStr, and never commit it"],
          answer: 3,
          explain: "Secrets in source or images are copied everywhere and cannot be rotated cleanly. Runtime injection keeps them out of artefacts; SecretStr keeps them out of logs and reprs."
        },
        {
          q: "What makes logs \"structured\"?",
          options: ["They use capital letters","They are written to a database","Each event is emitted as key-value data (usually JSON) with consistent fields such as level, event, request_id and duration, so it can be queried","They contain stack traces"],
          answer: 2,
          explain: "Queryable fields beat parsing free text. A log backend can then filter by request_id or aggregate by event name."
        },
        {
          q: "How do you attach a request ID to every log line without passing it through every function?",
          options: ["A global variable","Store it in a contextvars.ContextVar (or structlog's contextvars helpers) set by middleware, and have the log formatter read it","Thread-local storage in asyncio code","Print it manually"],
          answer: 1,
          explain: "ContextVars follow the logical flow of a request, including across awaits and tasks. Globals mix requests together; thread-locals break under asyncio."
        },
        {
          q: "A call to a downstream API sometimes fails with timeouts. What retry policy is appropriate?",
          options: ["Retry immediately forever","A bounded number of retries with exponential backoff and jitter, only for retryable errors and idempotent operations, inside an overall deadline","Never retry","Retry every error including 400 Bad Request"],
          answer: 1,
          explain: "Unbounded or synchronised retries amplify outages. Backoff with jitter spreads load, and only idempotent, transient failures should be retried."
        },
        {
          q: "What should a Python service do when it receives SIGTERM during a rolling deploy?",
          options: ["Stop accepting new work, finish or hand back in-flight work within the grace period, close pools and flush telemetry, then exit","Exit immediately","Ignore it","Restart itself"],
          answer: 0,
          explain: "Orchestrators send SIGTERM before SIGKILL. Graceful shutdown avoids dropped requests and half-processed messages."
        }
      ]
    },
    "prod-ship": {
      title: "Shipping Python checkpoint",
      sub: "Containers, CI, supply chain and releases.",
      questions: [
        {
          q: "Why use a multi-stage Dockerfile for a Python service?",
          options: ["It is required for Python","It runs tests automatically","It makes images mutable","Build tools and caches stay in the builder stage; the final image contains only the runtime and installed dependencies, so it is smaller with less attack surface"],
          answer: 3,
          explain: "Compilers, package caches and source checkouts are needed to build but not to run. Copying only the virtual environment and app into a slim base keeps the runtime minimal."
        },
        {
          q: "Why should the container run as a non-root user?",
          options: ["Python requires it","It is faster","If the process is compromised, the attacker has fewer privileges inside the container and against mounted volumes","Root cannot open ports"],
          answer: 2,
          explain: "Least privilege limits blast radius. Create a dedicated user in the image and switch to it with USER before the entrypoint."
        },
        {
          q: "In CI, what does uv sync --locked (or installing from a hashed lockfile) protect against?",
          options: ["Slow tests","Lint errors","Silently resolving different dependency versions than the ones reviewed, because the install fails if the lock is out of date","Network outages"],
          answer: 2,
          explain: "A locked install reproduces exactly what was tested and reviewed. If pyproject and the lock disagree, CI fails instead of quietly upgrading."
        },
        {
          q: "Which practice most directly reduces software supply-chain risk for published Python packages?",
          options: ["Long-lived PyPI API tokens in CI secrets","Trusted publishing via short-lived OIDC credentials plus signed provenance attestations","Uploading from a developer laptop","Disabling 2FA"],
          answer: 1,
          explain: "Trusted publishing removes long-lived upload tokens, and attestations let consumers verify which workflow built the artefact."
        },
        {
          q: "What does pip-audit or a similar scanner do in a pipeline?",
          options: ["Checks resolved dependencies against vulnerability databases and fails or reports when known-vulnerable versions are present","Formats code","Builds wheels","Measures coverage"],
          answer: 0,
          explain: "Scanning the lock or environment catches known CVEs before deploy. Pair it with automated update PRs so fixes land quickly."
        },
        {
          q: "A release includes a schema change and new code. Which rollout plan is safest?",
          options: ["Deploy code and drop the old column simultaneously","Deploy on Friday evening","Skip staging","Run a backward-compatible expand migration first, roll out code gradually behind health checks or a flag, watch SLOs, and keep a rollback path"],
          answer: 3,
          explain: "Backward-compatible migrations let old and new code run side by side, which is what makes canaries and rollbacks possible."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.prod = {
    id: "prod",
    name: "Production Python",
    short: "PROD",
    tagline: "Config, logs, containers, CI",
    color: "#2dd4bf",
    blurb: "Typed twelve-factor configuration, structured logging with context, secrets handled without ever touching source, error handling and graceful shutdown, then lean non-root containers, CI pipelines, supply-chain security and a release checklist you can actually follow.",
    modules: [
      {
        id: "config",
        name: "Configure and observe",
        icon: "wrench",
        lessons: [
          L("twelve-factor-config", "Typed, layered configuration", "Keep config in the environment, layer sources predictably, and validate everything once at startup with pydantic-settings.", 8, ["config", "pydantic-settings", "twelve-factor"], [
            B.p("The same build artefact should run in every environment; only <strong>configuration</strong> changes. Read it from the environment and secret sources at startup, convert it to typed values, and refuse to start if anything is missing or invalid."),
            B.widget("configResolver"),
            B.code("python", [
              "from pydantic import Field, SecretStr",
              "from pydantic_settings import BaseSettings, SettingsConfigDict",
              "",
              "class Settings(BaseSettings):",
              "    model_config = SettingsConfigDict(env_prefix=\"BILLING_\", env_file=\".env\",",
              "                                      secrets_dir=\"/run/secrets\", extra=\"forbid\")",
              "",
              "    log_level: str = \"INFO\"",
              "    pool_size: int = Field(5, ge=1, le=50)",
              "    timeout_s: float = Field(5.0, gt=0)",
              "    database_url: SecretStr                 # required: no default, startup fails if absent",
              "    api_token: SecretStr",
              "",
              "settings = Settings()                       # validates once; import this object, not os.environ",
              "repr(settings.api_token)                    # SecretStr('**********')"
            ]),
            B.table(["Layer (low \u2192 high)", "Typical use"], [
              ["Defaults in code", "Safe values for every environment"],
              ["Config file per environment", "Non-secret tuning: pool sizes, feature defaults"],
              ["Environment variables", "Deploy-time overrides set by the platform"],
              ["CLI flags", "One-off operational overrides"],
              ["Secret store (env or mounted file)", "Credentials and keys, never in the layers above"]
            ]),
            B.warn("A <code class='tok'>.env</code> file is a local-development convenience. Keep it gitignored, ship a <code class='tok'>.env.example</code> with placeholder names only, and never rely on it in production."),
            B.trap("Environment-specific identifiers such as account names, database names, project IDs and run dates are configuration. Hardcoding them breaks the next environment and leaks internal names."),
            B.cue("<strong>Interview cue:</strong> \"one artefact, config from the environment, validated at startup, secrets from a secret store\" covers most configuration questions."),
            B.key("<strong>Config is input, validated once.</strong> Layer sources predictably, type every value, fail fast on errors, and keep secrets in their own layer.")
          ]),
          L("structured-logging", "Structured logging", "Configure stdlib logging properly, emit JSON events with consistent fields, propagate request context, and keep secrets and personal data out.", 8, ["logging", "structlog", "json"], [
            B.p("Logs are data for machines first and humans second. Emit <strong>events with fields</strong>, configure logging once at the entry point, and let libraries use module-level loggers without configuring anything themselves."),
            B.code("python", [
              "import logging, structlog",
              "",
              "def configure_logging(level: str) -> None:",
              "    structlog.configure(",
              "        processors=[",
              "            structlog.contextvars.merge_contextvars,   # request_id, user_id from context",
              "            structlog.processors.add_log_level,",
              "            structlog.processors.TimeStamper(fmt=\"iso\", utc=True),",
              "            structlog.processors.dict_tracebacks,",
              "            structlog.processors.JSONRenderer(),",
              "        ],",
              "        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(level)),",
              "    )",
              "",
              "log = structlog.get_logger()",
              "",
              "async def middleware(request, call_next):",
              "    structlog.contextvars.bind_contextvars(request_id=request.headers.get(\"x-request-id\", new_id()))",
              "    try:",
              "        return await call_next(request)",
              "    finally:",
              "        structlog.contextvars.clear_contextvars()",
              "",
              "log.info(\"invoice.paid\", invoice_id=inv.id, amount_cents=inv.amount, duration_ms=42)"
            ]),
            B.table(["Do", "Avoid"], [
              ["<code class='tok'>logging.getLogger(__name__)</code> in libraries", "Calling basicConfig inside a library"],
              ["Event names plus fields", "Interpolated prose that must be regex-parsed"],
              ["Lazy formatting: <code class='tok'>log.info(\"x=%s\", x)</code> with stdlib", "f-strings that format even when the level is disabled"],
              ["<code class='tok'>log.exception</code> inside except", "Logging and re-raising at every layer (duplicate noise)"],
              ["Redaction processors for tokens and emails", "Logging request bodies, headers or settings objects"]
            ]),
            B.warn("Never log an Authorization header, a cookie, a full settings object or a raw request body. One debug line can copy credentials into a log system that far more people can read."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"we cannot correlate logs across services\". Missing request or trace IDs bound into context and propagated in headers."),
            B.key("<strong>Configure once, log events with fields, bind context.</strong> JSON output, request and trace IDs everywhere, and nothing secret or personal in the payload.")
          ]),
          L("secrets-handling", "Handling secrets", "Where secrets live, how they reach the process, how they rotate, and the tooling that stops them from ever reaching a commit.", 8, ["secrets", "vault", "rotation"], [
            B.p("A secret is anything that grants access: passwords, API tokens, private keys, signing keys, connection strings with credentials. The rule is simple and absolute: <strong>secrets never appear in source code, images, logs or tickets</strong>. Everything else here is about making that rule easy to follow."),
            B.code("python", [
              "import os",
              "from pathlib import Path",
              "",
              "def read_secret(name: str) -> str:",
              "    \"\"\"Prefer a mounted file (rotates without restart); fall back to an env var.\"\"\"",
              "    path = Path(os.environ.get(\"SECRETS_DIR\", \"/run/secrets\")) / name",
              "    if path.exists():",
              "        return path.read_text().strip()",
              "    return os.environ[name.upper()]          # injected by the platform, never committed",
              "",
              "db_password = read_secret(\"db_password\")   # placeholder name only; value comes from the store"
            ]),
            B.table(["Delivery", "Pros", "Cons"], [
              ["Environment variable from the platform", "Simple, universal", "Visible to the process tree; restart to rotate"],
              ["Mounted file (Kubernetes secret, CSI driver)", "Rotates without redeploy; not in env dumps", "Needs file-reading code"],
              ["Fetched from a secret manager at startup", "Central audit, short-lived credentials", "Startup dependency, needs caching"],
              ["Workload identity (no static secret)", "Nothing to leak or rotate", "Cloud-specific setup"]
            ]),
            B.ul([
              "<strong>Prevent:</strong> a pre-commit hook and CI step that scan for secrets (detect-secrets, gitleaks-style scanners).",
              "<strong>Contain:</strong> use <code class='tok'>SecretStr</code> so values do not print; redact in log processors.",
              "<strong>Rotate:</strong> design for two valid credentials at once so rotation needs no downtime.",
              "<strong>Respond:</strong> a leaked secret is compromised forever. Revoke and rotate first, then clean history."
            ]),
            B.trap("Deleting a committed secret in a later commit does not remove it: it is still in history, forks and caches. Treat it as leaked and rotate it immediately."),
            B.cue("<strong>Interview cue:</strong> \"prefer identities over secrets, inject what remains at runtime, mask it in memory and logs, and rehearse rotation\"."),
            B.key("<strong>Secrets live in a secret store, never in code.</strong> Inject at runtime, mask with SecretStr, scan every commit, and rotate on any suspicion.")
          ]),
          L("errors-in-prod", "Errors, retries and shutdown", "Exception design for services, timeouts and retries with backoff, error tracking, and graceful shutdown on SIGTERM.", 8, ["errors", "retries", "sigterm"], [
            B.p("Production failure handling has three parts: <strong>classify</strong> errors so callers know what to do, <strong>bound</strong> every wait with timeouts and every retry with limits, and <strong>stop cleanly</strong> when the platform asks."),
            B.code("python", [
              "import random, time",
              "",
              "class BillingError(Exception): ...",
              "class Retryable(BillingError): ...          # timeouts, 503, connection reset",
              "class Permanent(BillingError): ...          # validation, 4xx, business rule",
              "",
              "def with_retries(fn, *, attempts: int = 4, base: float = 0.2, deadline_s: float = 5.0):",
              "    start = time.monotonic()",
              "    for i in range(attempts):",
              "        try:",
              "            return fn()",
              "        except Retryable:",
              "            if i == attempts - 1 or time.monotonic() - start > deadline_s:",
              "                raise",
              "            time.sleep(random.uniform(0, base * 2 ** i))   # full jitter backoff"
            ]),
            B.code("python", [
              "import asyncio, signal",
              "",
              "async def main() -> None:",
              "    stop = asyncio.Event()",
              "    loop = asyncio.get_running_loop()",
              "    loop.add_signal_handler(signal.SIGTERM, stop.set)",
              "    async with asyncio.TaskGroup() as tg:",
              "        tg.create_task(consume(stop))       # stops pulling new messages when stop is set",
              "        await stop.wait()",
              "    await pool.close()                      # after in-flight work completes",
              "    flush_telemetry()"
            ]),
            B.table(["Concern", "Practice"], [
              ["Timeouts", "On every network call, smaller than the caller's own deadline"],
              ["Retries", "Only transient errors, idempotent operations, backoff with jitter, bounded"],
              ["Error tracking", "Send unhandled exceptions with context to an error tracker; group and alert"],
              ["User-facing errors", "Stable error codes, no stack traces or internals in responses"],
              ["Shutdown", "Handle SIGTERM, drain within the grace period, then exit"]
            ]),
            B.quiz("prod-config"),
            B.cue("<strong>Spotting it in a prompt:</strong> \"deploys drop a few requests every time\". Missing SIGTERM handling, or readiness not flipping to false before shutdown."),
            B.key("<strong>Classify, bound and drain.</strong> Separate retryable from permanent errors, put timeouts and limits on everything, and shut down gracefully on SIGTERM.")
          ])
        ]
      },
      {
        id: "ship",
        name: "Build and ship",
        icon: "map",
        lessons: [
          L("containers", "Containers for Python services", "Multi-stage builds with uv, slim non-root images, sensible environment flags, and an entrypoint that handles signals.", 9, ["docker", "uv", "non-root"], [
            B.p("A good Python image is <strong>small, reproducible, non-root and fast to rebuild</strong>. Multi-stage builds give you all four: install dependencies from the lockfile in a builder stage, then copy just the virtual environment and app into a slim runtime."),
            B.code("dockerfile", [
              "# syntax=docker/dockerfile:1",
              "FROM python:3.13-slim AS builder",
              "COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /bin/uv",
              "ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy",
              "WORKDIR /app",
              "COPY pyproject.toml uv.lock ./",
              "RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev --no-install-project",
              "COPY src ./src",
              "RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev",
              "",
              "FROM python:3.13-slim",
              "RUN useradd --create-home --uid 10001 app",
              "ENV PATH=\"/app/.venv/bin:$PATH\" PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1",
              "WORKDIR /app",
              "COPY --from=builder --chown=app:app /app /app",
              "USER app",
              "EXPOSE 8000",
              "CMD [\"uvicorn\", \"billing.api:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]"
            ]),
            B.table(["Choice", "Reason"], [
              ["Copy lockfiles before source", "Dependency layer is cached until the lock changes"],
              ["Slim base, pinned tag (or digest)", "Smaller attack surface, reproducible builds"],
              ["Non-root USER", "Least privilege if the process is compromised"],
              ["Exec-form CMD", "Python is PID 1 and receives SIGTERM directly"],
              ["<code class='tok'>PYTHONUNBUFFERED=1</code>", "Logs appear immediately on stdout"],
              ["<code class='tok'>.dockerignore</code>", "Keeps .git, .env, caches and tests out of the context"]
            ]),
            B.warn("Never <code class='tok'>COPY .env</code> or pass secrets as build args: both end up in image layers or history. Inject secrets at runtime, or use build secret mounts for private indexes."),
            B.tip("Alpine images use musl, so many wheels are unavailable and packages compile from source. Debian slim images usually build faster and behave more predictably for Python."),
            B.cue("<strong>Interview cue:</strong> walk through layers: lock first for caching, builder versus runtime stage, non-root user, exec-form entrypoint for signals."),
            B.key("<strong>Lock, build, copy, drop privileges.</strong> Multi-stage with a cached dependency layer, slim non-root runtime, exec-form CMD, and no secrets in layers.")
          ]),
          L("ci-pipelines", "CI pipelines for Python", "A fast, layered pipeline: locked install, lint and types, tests with coverage across versions, then build and publish artefacts.", 8, ["ci", "github-actions", "matrix"], [
            B.p("CI should give a trustworthy answer quickly. Order jobs from cheapest to most expensive, fail early on formatting and types, and make every install come from the lockfile so CI tests what will ship."),
            B.code("yaml", [
              "name: ci",
              "on: [push, pull_request]",
              "permissions:",
              "  contents: read                    # least privilege by default",
              "jobs:",
              "  check:",
              "    runs-on: ubuntu-latest",
              "    strategy:",
              "      matrix:",
              "        python: [\"3.12\", \"3.13\", \"3.14\"]",
              "    steps:",
              "      - uses: actions/checkout@v5",
              "      - uses: astral-sh/setup-uv@v6",
              "        with:",
              "          enable-cache: true",
              "      - run: uv sync --locked --python ${{ matrix.python }}",
              "      - run: uv run ruff format --check . && uv run ruff check .",
              "      - run: uv run mypy src",
              "      - run: uv run pytest -q --cov=billing --cov-report=xml",
              "  build:",
              "    needs: check",
              "    runs-on: ubuntu-latest",
              "    steps:",
              "      - uses: actions/checkout@v5",
              "      - uses: astral-sh/setup-uv@v6",
              "      - run: uv build                  # sdist + wheel from the same commit"
            ]),
            B.table(["Stage", "Goal", "Typical time"], [
              ["Format + lint", "Style and obvious bugs", "Seconds"],
              ["Type check", "Contract errors", "Seconds to a minute"],
              ["Unit tests (matrix)", "Behaviour on supported Pythons", "Minutes"],
              ["Integration tests", "Real database, containers", "Minutes"],
              ["Build + scan + publish", "Artefacts, SBOM, vulnerability scan", "Minutes"]
            ]),
            B.tip("Run the same commands locally and in CI through one entry point (a Makefile, nox or just uv scripts) so \"works on my machine\" and CI never diverge."),
            B.warn("Workflows triggered by pull requests from forks must not receive secrets. Keep publish and deploy jobs on protected branches or tags, with environment approvals."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"CI is green but production broke on a dependency\". The install was not locked, or CI tested a different Python than production runs."),
            B.key("<strong>Cheap checks first, locked installs always.</strong> Lint, types, matrix tests, then build once and promote the same artefact.")
          ]),
          L("supply-chain", "Supply-chain security", "Lock and verify dependencies, scan for vulnerabilities, generate SBOMs, pin CI actions, and publish with trusted, attested builds.", 8, ["supply-chain", "sbom", "trusted-publishing"], [
            B.p("Most of the code you ship is code you did not write. Supply-chain security is about knowing exactly what you depend on, noticing when it is vulnerable or malicious, and proving where your own artefacts came from."),
            B.table(["Risk", "Control"], [
              ["Unreviewed version drift", "Lockfiles with hashes; locked installs in CI and images"],
              ["Known vulnerabilities", "pip-audit or similar on every build; automated update PRs"],
              ["Typosquatting and malicious packages", "Review new dependencies; private index or allow-list for sensitive services"],
              ["Compromised CI actions", "Pin third-party actions to a full commit SHA; minimal workflow permissions"],
              ["Leaked publishing tokens", "Trusted publishing: short-lived OIDC credentials instead of stored API tokens"],
              ["Unknown provenance", "Build attestations (Sigstore-based) and an SBOM per release"]
            ]),
            B.code("bash", [
              "uv export --format requirements-txt --locked > requirements.txt   # pinned, with hashes",
              "pip-audit -r requirements.txt --strict                           # fail on known vulns",
              "cyclonedx-py environment -o sbom.json                            # what is inside this build"
            ]),
            B.code("yaml", [
              "publish:",
              "  needs: build",
              "  runs-on: ubuntu-latest",
              "  environment: release",
              "  permissions:",
              "    id-token: write                   # OIDC for trusted publishing, no stored token",
              "  steps:",
              "    - uses: actions/download-artifact@v5",
              "    - uses: pypa/gh-action-pypi-publish@release/v1   # pin to a commit SHA in real workflows"
            ]),
            B.tip("Every new dependency is a long-term commitment. Ask: is it maintained, how many transitive dependencies does it pull in, and could twenty lines of our own code replace it?"),
            B.cue("<strong>Interview cue:</strong> \"lock and hash, scan continuously, pin actions, publish with OIDC and attestations\" is a complete one-line supply-chain answer."),
            B.key("<strong>Know, verify and prove.</strong> Lock and hash dependencies, scan every build, pin CI actions, and publish with short-lived credentials and attestations.")
          ]),
          L("release-checklist", "A release checklist", "Versioning, changelogs, compatible migrations, progressive rollout, the signals to watch, and a rehearsed rollback.", 7, ["release", "canary", "rollback"], [
            B.p("A release is safe when it is <strong>small, observable and reversible</strong>. A checklist turns that into routine instead of heroics."),
            B.ol([
              "<strong>Version and changelog:</strong> semantic version for libraries; a dated changelog entry explaining user-visible changes.",
              "<strong>Compatibility:</strong> migrations are backward compatible (expand first); APIs keep old fields until clients move.",
              "<strong>Same artefact:</strong> the image or wheel built and tested in CI is the one promoted; no rebuilds per environment.",
              "<strong>Config reviewed:</strong> new settings exist in every environment's configuration and secret store before deploy.",
              "<strong>Progressive rollout:</strong> canary or percentage rollout, or a feature flag defaulting off.",
              "<strong>Watch signals:</strong> error rate, latency percentiles and saturation against SLOs for a defined bake time.",
              "<strong>Rollback ready:</strong> previous artefact one command away; flags can disable the feature without a deploy.",
              "<strong>Communicate:</strong> release notes for consumers and an owner on call during rollout."
            ]),
            B.table(["Signal during rollout", "Action"], [
              ["Error rate up on canary only", "Halt and roll back the canary"],
              ["Latency p99 regression beyond budget", "Pause, profile the new version"],
              ["Migration slow or locking tables", "Stop; migrations should be online and batched"],
              ["All green after bake time", "Continue to the next stage"]
            ]),
            B.trap("A rollback is only possible if the database still works with the old code. Contract steps (dropping columns, tightening constraints) belong in a later release, after the new code has proven itself."),
            B.quiz("prod-ship"),
            B.cue("<strong>Interview cue:</strong> describe releases as \"expand, deploy progressively, observe, then contract\", and name the metric that would make you roll back."),
            B.key("<strong>Small, observable, reversible.</strong> Promote one tested artefact, migrate compatibly, roll out progressively against SLOs, and keep rollback one step away.")
          ])
        ]
      }
    ]
  };
})();
