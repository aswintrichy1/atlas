/* =====================================================================
   PYXIS · Packaging & Tooling
   window.TRACKS.pkg — modules: envs / build
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     depResolver — a tiny backtracking resolver over a fake index
  ================================================================== */
  /* ranges are [min inclusive, max exclusive|null] */
  var INDEX = {
    webkit: { "3.0": { httpcore: [2.0, null] }, "2.1": { httpcore: [1.0, 2.0] }, "2.0": { httpcore: [1.0, 2.0] } },
    datakit: { "1.4": { httpcore: [2.0, null] }, "1.3": { httpcore: [1.2, 2.0] } },
    httpcore: { "2.1": {}, "2.0": {}, "1.9": {}, "1.2": {} }
  };
  var ROOTS = [
    { id: "a", label: "webkit<3, datakit>=1.3", reqs: [["webkit", [2.0, 3.0]], ["datakit", [1.3, null]]] },
    { id: "b", label: "webkit<3, datakit>=1.4", reqs: [["webkit", [2.0, 3.0]], ["datakit", [1.4, null]]] },
    { id: "c", label: "webkit>=3, datakit>=1.3", reqs: [["webkit", [3.0, null]], ["datakit", [1.3, null]]] },
    { id: "d", label: "unpinned", reqs: [["webkit", [0, null]], ["datakit", [0, null]]] }
  ];
  function fmtRange(r) {
    if (r[0] === 0 && r[1] === null) return "(any)";
    var lo = r[0] ? ">=" + r[0].toFixed(1) : "";
    var hi = r[1] !== null ? "<" + r[1].toFixed(1) : "";
    return [lo, hi].filter(Boolean).join(",");
  }
  function inRange(v, r) { var n = parseFloat(v); return n >= r[0] && (r[1] === null || n < r[1]); }
  function okAll(v, list) { return list.every(function (c) { return inRange(v, c.range); }); }
  function clone(o) { var c = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = Array.isArray(o[k]) ? o[k].slice() : o[k]; return c; }

  function resolve(root) {
    var trace = [], stats = { steps: 0, backtracks: 0 };
    function solve(pending, chosen, cons) {
      if (stats.steps > 60) return null;
      if (!pending.length) return chosen;
      var r = pending[0], rest = pending.slice(1);
      var c2 = clone(cons);
      c2[r.name] = (c2[r.name] || []).concat([{ range: r.range, by: r.by }]);
      if (chosen[r.name] !== undefined) {
        if (okAll(chosen[r.name], c2[r.name])) return solve(rest, chosen, c2);
        trace.push("conflict: " + r.by + " needs " + r.name + fmtRange(r.range) + ", but " + r.name + " " + chosen[r.name] + " is already chosen");
        return null;
      }
      var cands = Object.keys(INDEX[r.name]).filter(function (v) { return okAll(v, c2[r.name]); })
        .sort(function (a, b) { return parseFloat(b) - parseFloat(a); });
      if (!cands.length) {
        trace.push("no " + r.name + " satisfies " + c2[r.name].map(function (c) { return fmtRange(c.range) + " (" + c.by + ")"; }).join(" and "));
        return null;
      }
      for (var i = 0; i < cands.length; i++) {
        var v = cands[i];
        stats.steps++;
        trace.push("try " + r.name + " " + v);
        var ch2 = clone(chosen); ch2[r.name] = v;
        var deps = INDEX[r.name][v];
        var more = Object.keys(deps).map(function (d) { return { name: d, range: deps[d], by: r.name + " " + v }; });
        var res = solve(rest.concat(more), ch2, c2);
        if (res) return res;
        stats.backtracks++;
        trace.push("backtrack: discard " + r.name + " " + v);
      }
      return null;
    }
    var pending = root.reqs.map(function (q) { return { name: q[0], range: q[1], by: "your project" }; });
    var result = solve(pending, {}, {});
    return { result: result, trace: trace, stats: stats };
  }

  Widgets.depResolver = function (mount) {
    K.shell(mount, "resolver", "Dependency resolver, step by step",
      "Your project needs webkit and datakit. Both depend on httpcore, with different ranges. Pick your top-level constraints and watch a resolver choose newest-first and backtrack on conflicts.");
    var root = ROOTS[0];
    var controls = h("div", { class: "w-stage", style: "display:flex;gap:10px;flex-wrap:wrap" });
    var idx = h("div", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.76rem;color:var(--text-dim);display:grid;gap:2px" });
    Object.keys(INDEX).forEach(function (p) {
      idx.appendChild(h("div", {}, p + ": " + Object.keys(INDEX[p]).map(function (v) {
        var d = INDEX[p][v]; var ks = Object.keys(d);
        return v + (ks.length ? " (" + ks.map(function (k) { return k + fmtRange(d[k]); }).join(", ") + ")" : "");
      }).join("  |  ")));
    });
    var traceBox = h("div", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.76rem;display:grid;gap:2px;color:var(--text)" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var r = resolve(root);
      K.clear(traceBox);
      r.trace.slice(0, 16).forEach(function (t, i) {
        traceBox.appendChild(h("div", { style: /^conflict|^no |^backtrack/.test(t) ? "color:var(--rose-ink)" : "" }, (i + 1) + ". " + t));
      });
      if (r.trace.length > 16) traceBox.appendChild(h("div", { style: "color:var(--text-dim)" }, "\u2026 " + (r.trace.length - 16) + " more steps"));
      K.clear(readout);
      readout.appendChild(K.ro("constraints", root.label));
      readout.appendChild(K.ro("candidates tried", r.stats.steps));
      readout.appendChild(K.ro("backtracks", r.stats.backtracks));
      if (r.result) {
        readout.appendChild(h("span", { class: "ro", style: "color:var(--lime-ink)" }, "resolved ", h("b", {}, Object.keys(r.result).sort().map(function (k) { return k + "==" + r.result[k]; }).join("  "))));
        readout.appendChild(K.wide("Write exactly these pins to a lock file and every later install skips this search entirely."));
      } else {
        readout.appendChild(h("span", { class: "ro", style: "color:var(--rose-ink)" }, "result ", h("b", {}, "ResolutionImpossible")));
        readout.appendChild(K.wide("No combination satisfies every range. Relax a top-level constraint, upgrade the package holding the old upper bound, or split the conflicting tools into separate environments."));
      }
    }
    controls.appendChild(K.segment(ROOTS.map(function (x) { return [x.id, x.label]; }), 0, function (id) {
      root = ROOTS.filter(function (x) { return x.id === id; })[0]; paint();
    }));
    mount.appendChild(controls);
    mount.appendChild(idx);
    mount.appendChild(traceBox);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "pkg-envs": {
      title: "Environments and dependencies checkpoint",
      sub: "venvs, resolvers, lock files and version specifiers.",
      questions: [
        {
          q: "Why prefer python -m pip install over a bare pip install?",
          options: ["It is faster","It skips dependency resolution","It enables wheels","It guarantees the packages go into the interpreter you are actually running, not whichever pip is first on PATH"],
          answer: 3,
          explain: "With several Pythons installed, pip on PATH may belong to a different interpreter. python -m pip ties the installer to the python you invoked, which removes a whole family of 'I installed it but import fails' problems."
        },
        {
          q: "What does activating a virtual environment actually do?",
          options: ["Copies the standard library","Starts a background service","Mostly prepends the environment's bin directory to PATH (and sets VIRTUAL_ENV); running .venv/bin/python directly works without activating","Locks dependency versions"],
          answer: 2,
          explain: "A venv is a directory with its own interpreter entry point and site-packages. Activation is a shell convenience; scripts, CI and containers can call the environment's python by path."
        },
        {
          q: "An application deploys from requirements with only lower bounds (requests>=2). What is the main risk?",
          options: ["Slower installs","Each build can resolve different versions, so a release can break without any code change","pip refuses lower bounds","Wheels cannot be used"],
          answer: 1,
          explain: "Without a lock, the resolver picks the newest compatible versions at install time. A new upstream release changes your production dependency set silently. Applications should lock exact versions and hashes."
        },
        {
          q: "You maintain a library published to an index. How should its declared dependencies look?",
          options: ["Compatible ranges, such as pydantic>=2.5,<3, leaving exact pinning to the applications that install it","Exact pins like pydantic==2.7.1","No dependencies listed","Git URLs"],
          answer: 0,
          explain: "Exact pins in a library make it impossible to install alongside other libraries that need a slightly different version. Libraries declare what they are compatible with; applications lock what they actually run."
        },
        {
          q: "What does uv sync --locked do differently from uv sync?",
          options: ["It fails if uv.lock is out of date with pyproject.toml instead of silently updating it, which is what CI should do","Nothing","It ignores the lock file","It upgrades everything"],
          answer: 0,
          explain: "In CI you want to install exactly what was reviewed. --locked asserts the lock matches the project metadata, catching a forgotten lock update before deployment."
        },
        {
          q: "What does the specifier ~=1.4.2 allow?",
          options: ["Exactly 1.4.2",">=1.4.2 and <2.0","Any 1.x",">=1.4.2 and <1.5"],
          answer: 3,
          explain: "The compatible-release operator drops the last component and allows anything at or above the given version within that prefix: ~=1.4.2 means >=1.4.2, ==1.4.*. Note that ~=1.4 would instead mean >=1.4, <2."
        }
      ]
    },
    "pkg-build": {
      title: "pyproject, wheels and linting checkpoint",
      sub: "Project metadata, distributions, build backends and Ruff.",
      questions: [
        {
          q: "Which table in pyproject.toml tells installers how to build your project?",
          options: ["[project]","[tool.setuptools]","[build-system], with requires and build-backend","[dependency-groups]"],
          answer: 2,
          explain: "[build-system] names the backend (hatchling, setuptools, flit-core, uv_build and so on) and what must be installed to run it. [project] holds the standard metadata the backend reads."
        },
        {
          q: "Why are wheels preferred over sdists for installation?",
          options: ["Wheels are smaller","Installing a wheel is unpacking files with no build step, whereas an sdist runs the build backend, which can execute arbitrary code and needs compilers for extensions","sdists are deprecated","Wheels include the interpreter"],
          answer: 1,
          explain: "Wheels are prebuilt, so installs are fast, reproducible and do not execute project code. sdists are the source of truth for building, but installing from them is slower and riskier."
        },
        {
          q: "A wheel is named pkg-1.0-cp312-cp312-manylinux_2_28_x86_64.whl. What does that tell you?",
          options: ["It is pure Python","It contains compiled code for CPython 3.12 on x86-64 Linux with glibc 2.28 or newer","It works on every platform","It is a source distribution"],
          answer: 1,
          explain: "Wheel tags encode the Python implementation and version, the ABI, and the platform. A pure-Python wheel is tagged py3-none-any instead."
        },
        {
          q: "What is the advantage of a src/ layout?",
          options: ["Tests import the installed package rather than accidentally importing the working directory, so packaging mistakes surface early","Shorter imports","It is required by pip","It makes wheels smaller"],
          answer: 0,
          explain: "With a flat layout, the repo root is on sys.path, so tests can pass even if files are missing from the built wheel. src/ forces an install, usually editable, which mirrors what users get."
        },
        {
          q: "What does Ruff replace in a typical toolchain?",
          options: ["The type checker","pytest","The build backend","Many separate linters and formatters: flake8 and plugins, isort, pyupgrade, and Black-compatible formatting"],
          answer: 3,
          explain: "Ruff implements a large set of lint rules plus a formatter in one fast binary configured from pyproject.toml. It does not do type checking, so keep mypy or pyright alongside it."
        },
        {
          q: "Where should development-only tools such as pytest and ruff be declared in a modern project?",
          options: ["In [project] dependencies","In a README","In [dependency-groups] (or the tool's dev group), so they are installable locally and in CI but not published as runtime requirements","In [build-system] requires"],
          answer: 2,
          explain: "Runtime dependencies ship to every user. Dependency groups are local-only sets for development and CI, keeping the published metadata minimal."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.pkg = {
    id: "pkg",
    name: "Packaging & Tooling",
    short: "PKG",
    tagline: "Reproducible from laptop to production",
    color: "#34d399",
    blurb: "Virtual environments, pip and uv, how resolvers backtrack, lock files and hashes, version specifiers, pyproject.toml anatomy, wheels and build backends, Ruff for lint and format, and a pre-commit plus CI baseline.",
    modules: [
      {
        id: "envs",
        name: "Environments & dependencies",
        icon: "cube",
        lessons: [
          L("venvs", "Virtual environments and isolation", "One interpreter plus one site-packages per project, created from a known Python version and never mixed with the system install.", 7, ["venv", "isolation", "interpreter"], [
            B.p("A <strong>virtual environment</strong> is a directory with a Python entry point and its own <code class='tok'>site-packages</code>. Installing into it cannot break another project or the operating system's tools. It does not copy the standard library; it points back at a base interpreter, which is why the base version matters."),
            B.code("bash", [
              "python3.12 -m venv .venv          # stdlib way",
              ".venv/bin/python -m pip install -e .",
              "",
              "uv python install 3.12            # uv can fetch interpreters",
              "uv venv --python 3.12             # creates .venv",
              "uv run pytest                     # runs inside the project env"
            ]),
            B.table(["Fact", "Implication"], [
              ["Activation only edits PATH and a few variables", "Scripts and CI can call .venv/bin/python directly"],
              ["<code class='tok'>sys.prefix != sys.base_prefix</code> inside a venv", "A quick runtime check that you are isolated"],
              ["Venvs are not relocatable", "Recreate them; do not copy them between machines or into images"],
              ["System Pythons may be marked externally managed (PEP 668)", "pip refuses to install there: that is a feature"]
            ]),
            B.warn("Never <code class='tok'>sudo pip install</code>. It mixes your packages with the distribution's own, and an upgrade can break OS tooling written in Python. Use a venv for projects and a tool runner such as <code class='tok'>pipx</code> or <code class='tok'>uv tool</code> for command-line tools."),
            B.tip("Commit a <code class='tok'>.python-version</code> file and a <code class='tok'>requires-python</code> range. Both uv and pyenv read the former; installers enforce the latter."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"it works on my machine\" with import errors in CI usually means different interpreters or a shared global site-packages. Ask which python and which pip."),
            B.key("<strong>One project, one interpreter, one environment.</strong> Create it from a pinned Python version, call its python explicitly, and recreate rather than copy it.")
          ]),
          L("pip-uv", "pip, uv and how resolvers work", "Installers turn ranges into a concrete set of versions by searching and backtracking; uv does the same job much faster and manages the whole project.", 9, ["pip", "uv", "resolver"], [
            B.p("Every installer has two jobs: <strong>resolve</strong> (pick one version of each package such that every declared range is satisfied) and <strong>install</strong> (fetch and unpack those distributions). Resolution is a search problem; when a choice leads to a conflict, the resolver backtracks and tries an older version."),
            B.widget("depResolver"),
            B.table(["Tool", "Strengths", "Notes"], [
              ["pip", "Ships with Python; the reference installer", "Backtracking resolver; pair with pip-tools for locking"],
              ["uv", "Very fast resolver and installer; manages Pythons, venvs, lock, run, build", "Universal cross-platform <code class='tok'>uv.lock</code>; drop-in <code class='tok'>uv pip</code> interface"],
              ["Poetry / PDM / Hatch", "Project managers with their own lock or env features", "Choose one per repo and standardise"]
            ]),
            B.code("bash", [
              "uv init billing && cd billing",
              "uv add \"fastapi>=0.110\" \"sqlalchemy>=2\"",
              "uv add --dev pytest ruff mypy",
              "uv lock                     # resolve and write uv.lock",
              "uv sync --locked            # install exactly the lock (CI)",
              "uv lock --upgrade-package sqlalchemy"
            ]),
            B.trap("A resolver that backtracks for minutes is usually telling you that two packages have incompatible upper bounds. Read the conflict message, then fix the constraint; do not paper over it with <code class='tok'>--no-deps</code>, which installs a set that was never proven consistent."),
            B.p("Trade-off: a faster, all-in-one tool centralises workflow and speeds CI dramatically, but every developer and pipeline must adopt it, and its project commands are opinionated. The compatibility <code class='tok'>uv pip</code> interface is a gentle first step."),
            B.cue("<strong>Interview cue:</strong> describe resolution as constraint satisfaction with backtracking, and lock files as caching its answer. That explains both slow installs and why locking fixes reproducibility."),
            B.key("<strong>Resolve once, install many times.</strong> Let the resolver search, read its conflicts instead of bypassing them, and record the answer in a lock.")
          ]),
          L("locking", "Lock files and reproducible installs", "Applications pin every transitive dependency, ideally with hashes, so the build you tested is the build you ship.", 8, ["lock", "hashes", "reproducible"], [
            B.p("A <strong>lock file</strong> records the exact version, and ideally the artifact hashes, of every package in the resolved set, including transitive ones. Installing from it is deterministic: no search, no surprises when an upstream releases on a Friday night."),
            B.table(["Approach", "Lock artifact", "Install command"], [
              ["uv project", "<code class='tok'>uv.lock</code> (cross-platform)", "<code class='tok'>uv sync --locked</code>"],
              ["pip-tools", "<code class='tok'>requirements.txt</code> compiled from <code class='tok'>requirements.in</code>", "<code class='tok'>pip install --require-hashes -r requirements.txt</code>"],
              ["Poetry / PDM", "<code class='tok'>poetry.lock</code> / <code class='tok'>pdm.lock</code>", "Tool-specific install"],
              ["Standard format", "<code class='tok'>pylock.toml</code> (PEP 751)", "Emerging support across installers"]
            ]),
            B.code("bash", [
              "# pip-tools flow",
              "pip-compile --generate-hashes requirements.in -o requirements.txt",
              "pip install --require-hashes -r requirements.txt",
              "",
              "# requirements.txt excerpt",
              "# idna==3.7 \\",
              "#     --hash=sha256:<digest of the wheel you reviewed>"
            ]),
            B.cmp("Applications", ["Lock every transitive version", "Hashes on, installs from lock only", "Scheduled, reviewed upgrades"],
                  "Libraries", ["Declare compatible ranges", "Test against both lowest and newest supported versions", "Do not ship a lock as metadata"]),
            B.tip("Automate upgrades: a bot or a scheduled job runs <code class='tok'>uv lock --upgrade</code> (or pip-compile with upgrade) weekly, CI runs the full test suite, and a human merges. Small, frequent upgrades beat a terrifying yearly one."),
            B.warn("A lock generated on macOS may not include wheels for Linux if your tool locks per-platform. Prefer a universal lock, or generate the lock in the same environment you deploy to."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"production broke and nobody changed code\" points to an unpinned transitive dependency. The fix is a lock plus hash checking, not a one-off pin."),
            B.key("<strong>Apps lock, libraries range.</strong> Install production from a hash-checked lock and upgrade on a schedule, with tests as the gate.")
          ]),
          L("version-specifiers", "Version specifiers and dependency hygiene", "Read and write specifiers, markers and extras precisely, and keep the dependency tree small enough to reason about.", 7, ["pep440", "markers", "extras"], [
            B.p("Python versions follow PEP 440 and specifiers combine comparison clauses. Getting them right is how you avoid both over-pinning (unresolvable installs) and under-pinning (surprise breakage)."),
            B.table(["Specifier", "Means"], [
              ["<code class='tok'>==2.1.3</code>", "Exactly this version (lock files, not libraries)"],
              ["<code class='tok'>>=2.1,<3</code>", "Any 2.x from 2.1: the common library range"],
              ["<code class='tok'>~=2.1</code>", "&gt;=2.1, ==2.* (compatible release)"],
              ["<code class='tok'>~=2.1.3</code>", "&gt;=2.1.3, ==2.1.*"],
              ["<code class='tok'>!=2.4.0</code>", "Exclude one known-bad release"],
              ["<code class='tok'>; python_version < \"3.11\"</code>", "Environment marker: only on old Pythons"],
              ["<code class='tok'>pkg[postgres]</code>", "Install an optional extra"]
            ]),
            B.code("toml", [
              "[project]",
              "requires-python = \">=3.11\"",
              "dependencies = [",
              "  \"httpx>=0.27,<1\",",
              "  \"tomli>=2; python_version < '3.11'\",",
              "  \"sqlalchemy[asyncio]>=2.0\",",
              "]",
              "",
              "[project.optional-dependencies]",
              "postgres = [\"psycopg[binary]>=3.1\"]"
            ]),
            B.ul([
              "<strong>Audit before you add.</strong> A dependency is code you now maintain: check activity, licence, size and its own tree.",
              "<strong>Prefer the standard library</strong> for small jobs: tomllib, zoneinfo, dataclasses, pathlib, concurrent.futures.",
              "<strong>Remove dead dependencies</strong>; tools can report imports that are declared but unused, and vice versa.",
              "<strong>Avoid upper bounds you have not observed breaking</strong> in libraries; they cause resolution failures for everyone downstream."
            ]),
            B.quiz("pkg-envs"),
            B.cue("<strong>Interview cue:</strong> \"Libraries should declare the widest range they actually support; applications pin the exact set they tested.\""),
            B.key("<strong>Specifiers are contracts.</strong> Use ranges and markers in metadata, exact pins only in locks, and treat every new dependency as code you own.")
          ])
        ]
      },
      {
        id: "build",
        name: "pyproject, wheels & lint",
        icon: "blocks",
        lessons: [
          L("pyproject", "pyproject.toml anatomy", "One file holds build configuration, standard project metadata, dependency groups and every tool's settings.", 8, ["pyproject", "metadata", "src-layout"], [
            B.p("<code class='tok'>pyproject.toml</code> is the single source of truth for a modern project. Three areas matter: <code class='tok'>[build-system]</code> (how to build), <code class='tok'>[project]</code> (standard metadata every tool understands) and <code class='tok'>[tool.*]</code> (per-tool configuration). Dependency groups hold local-only sets such as dev tools."),
            B.code("toml", [
              "[build-system]",
              "requires = [\"hatchling\"]",
              "build-backend = \"hatchling.build\"",
              "",
              "[project]",
              "name = \"billing\"",
              "version = \"1.4.0\"",
              "requires-python = \">=3.11\"",
              "dependencies = [\"fastapi>=0.110\", \"sqlalchemy>=2\"]",
              "",
              "[project.scripts]",
              "billing-admin = \"billing.cli:main\"",
              "",
              "[dependency-groups]",
              "dev = [\"pytest>=8\", \"ruff\", \"mypy\"]",
              "",
              "[tool.ruff]",
              "line-length = 100",
              "",
              "[tool.pytest.ini_options]",
              "addopts = \"-ra --strict-markers\""
            ]),
            B.table(["Layout", "Shape", "Trade-off"], [
              ["src layout", "<code class='tok'>src/billing/__init__.py</code>", "Tests run against the installed package; packaging bugs surface early"],
              ["Flat layout", "<code class='tok'>billing/__init__.py</code> at root", "Simpler, but the repo root shadows the installed package"]
            ]),
            B.tip("Use <code class='tok'>[project.scripts]</code> entry points instead of shipping loose scripts. The installer generates a correct launcher for the environment on every platform."),
            B.trap("Keeping the version in three places (pyproject, __init__, a changelog script) guarantees drift. Choose one source: a static version, or a dynamic version derived from git tags by the build backend."),
            B.cue("<strong>Spotting it in a prompt:</strong> a repo with setup.py, setup.cfg, requirements.txt, tox.ini and several dotfiles. Propose consolidating into pyproject.toml one tool at a time."),
            B.key("<strong>pyproject.toml is the project.</strong> Standard metadata in [project], the backend in [build-system], dev tools in dependency groups, settings under [tool].")
          ]),
          L("wheels-sdists", "Wheels, sdists and build backends", "What a distribution contains, how platform tags work, and why installing a wheel never runs your code.", 8, ["wheel", "sdist", "manylinux"], [
            B.p("A <strong>source distribution</strong> (sdist) is an archive of your source plus metadata; installing one means running the build backend. A <strong>wheel</strong> is a zip of files already laid out for <code class='tok'>site-packages</code>; installing one is unpacking. Publish both; deploy wheels."),
            B.diagram("packaging-flow", "From source tree to installed package: build once, install the same wheel everywhere."),
            B.table(["Wheel tag", "Means"], [
              ["<code class='tok'>py3-none-any</code>", "Pure Python, any platform"],
              ["<code class='tok'>cp312-cp312-manylinux_2_28_x86_64</code>", "CPython 3.12 ABI, Linux glibc 2.28+, x86-64"],
              ["<code class='tok'>cp312-abi3-...</code>", "Stable ABI: one build works on 3.12 and later"],
              ["<code class='tok'>musllinux_1_2</code>", "For Alpine-style musl libc"],
              ["<code class='tok'>macosx_11_0_arm64</code>", "Apple silicon"]
            ]),
            B.code("bash", [
              "uv build                       # or: python -m build",
              "ls dist/",
              "# billing-1.4.0.tar.gz   billing-1.4.0-py3-none-any.whl",
              "unzip -l dist/billing-1.4.0-py3-none-any.whl | head"
            ]),
            B.table(["Backend", "Good fit"], [
              ["hatchling", "Pure-Python projects, flexible file selection"],
              ["setuptools", "Legacy projects and C extensions"],
              ["flit-core", "Minimal pure-Python packages"],
              ["maturin", "Rust extensions via PyO3"],
              ["scikit-build-core", "CMake-based C/C++ extensions"]
            ]),
            B.warn("Inspect your wheel before publishing. Missing data files, an accidentally included test fixture with private data, or a <code class='tok'>.env</code> are all common, and the wheel is what users actually get."),
            B.cue("<strong>Interview cue:</strong> \"Build the wheel once in CI, then promote that exact artifact through staging to production\" demonstrates release discipline."),
            B.key("<strong>sdists build, wheels install.</strong> Read the tags, build in CI once, inspect the contents, and deploy the identical wheel everywhere.")
          ]),
          L("ruff-lint", "Ruff: lint and format in one tool", "A fast, single binary that replaces a stack of linters and formatters, configured in pyproject.toml.", 7, ["ruff", "lint", "format"], [
            B.p("Ruff implements hundreds of lint rules, including pyflakes, pycodestyle, isort, pyupgrade, bugbear and simplification checks, plus a Black-compatible formatter. Because it is fast enough to run on every save, style debates move out of code review and into configuration."),
            B.code("toml", [
              "[tool.ruff]",
              "target-version = \"py311\"",
              "line-length = 100",
              "",
              "[tool.ruff.lint]",
              "select = [\"E\", \"F\", \"I\", \"UP\", \"B\", \"SIM\", \"S\", \"RUF\"]",
              "ignore = [\"E501\"]          # formatter owns line length",
              "",
              "[tool.ruff.lint.per-file-ignores]",
              "\"tests/**\" = [\"S101\"]      # asserts are fine in tests"
            ]),
            B.code("bash", [
              "ruff check . --fix        # lint, applying safe fixes",
              "ruff format .             # format",
              "ruff check --select UP --fix .   # modernise syntax for target-version"
            ]),
            B.table(["Rule family", "Catches"], [
              ["F (pyflakes)", "Unused imports, names that were never defined"],
              ["B (bugbear)", "Mutable defaults, loop-variable closures, bare except"],
              ["UP (pyupgrade)", "Old syntax for your target version"],
              ["I (isort)", "Import ordering"],
              ["S (bandit-style)", "Hard-coded passwords, shell injection, unsafe YAML load"],
              ["SIM", "Needlessly complex conditionals"]
            ]),
            B.tip("Adopt rules incrementally on an existing codebase: enable a family, auto-fix what is safe, add per-file ignores for the rest, then tighten. A huge one-shot diff hides real changes in noise."),
            B.p("Trade-off: one tool means one dependency and one config, but you inherit its rule set. Ruff does not type check; keep mypy or pyright for that."),
            B.cue("<strong>Spotting it in a prompt:</strong> slow pre-commit hooks and conflicting isort/Black/flake8 settings. Consolidating on Ruff fixes both speed and conflicts."),
            B.key("<strong>Let the machine own style.</strong> Ruff for lint and format, a curated rule selection, safe auto-fixes, and a type checker alongside.")
          ]),
          L("pre-commit-ci", "Pre-commit hooks and a tooling baseline", "Run the same fast checks locally before each commit and authoritatively in CI, with pinned tool versions.", 7, ["pre-commit", "ci", "baseline"], [
            B.p("Local hooks give feedback in seconds; CI gives the authoritative verdict. The trick is to run <em>the same versions of the same tools</em> in both places so nobody fights a check that only fails remotely."),
            B.code("yaml", [
              "# .pre-commit-config.yaml",
              "repos:",
              "  - repo: local",
              "    hooks:",
              "      - id: ruff",
              "        name: ruff check",
              "        entry: uv run ruff check --fix",
              "        language: system",
              "        types: [python]",
              "      - id: ruff-format",
              "        name: ruff format",
              "        entry: uv run ruff format",
              "        language: system",
              "        types: [python]",
              "      - id: mypy",
              "        name: mypy",
              "        entry: uv run mypy src",
              "        language: system",
              "        pass_filenames: false"
            ]),
            B.table(["Stage", "Checks", "Budget"], [
              ["On save (editor)", "Ruff, type checker in the language server", "Under a second"],
              ["Pre-commit", "Ruff fix and format, quick type check, secret scan", "A few seconds"],
              ["CI pull request", "Everything above plus full tests, coverage, build, audit", "Minutes"],
              ["Nightly", "Slow suites: mutation tests, full integration, dependency upgrades", "As long as needed"]
            ]),
            B.tip("Using <code class='tok'>language: system</code> with <code class='tok'>uv run</code> makes hooks use the versions from your lock file, so local and CI tools cannot drift apart."),
            B.warn("Hooks can be skipped with <code class='tok'>--no-verify</code>. They are a convenience, not a control. The control is CI, with branch protection requiring it to pass."),
            B.quiz("pkg-build"),
            B.cue("<strong>Interview cue:</strong> \"Fast checks shift left into hooks; authoritative checks run in CI from the same lock\" describes a mature developer workflow."),
            B.key("<strong>Same tools, same versions, two places.</strong> Hooks for speed, CI for authority, and the lock file as the version source for both.")
          ])
        ]
      }
    ]
  };
})();
