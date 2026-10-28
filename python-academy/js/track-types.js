/* =====================================================================
   PYXIS · Typing, Generics & Protocols
   window.TRACKS.types — modules: basics / generics
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     typeChecker — what a static checker says about each fix
  ================================================================== */
  var CASES = [
    {
      id: "optional", label: "Optional",
      code: ["def shout(user: User | None) -> str:", "    {FIX}", "    return user.name.upper()"],
      fixes: [
        { id: "none", label: "No check", line: "pass", ok: false, diag: "error: Item \"None\" of \"User | None\" has no attribute \"name\"  [union-attr]", type: "User | None", note: "The checker refuses to let you dereference something that might be None." },
        { id: "guard", label: "if None: return", line: "if user is None: return \"\"", ok: true, diag: "Success: no issues found", type: "User", note: "Control-flow narrowing: after the early return the checker knows user is a User. Best fix: honest and free at runtime." },
        { id: "assert", label: "assert", line: "assert user is not None", ok: true, diag: "Success: no issues found", type: "User", note: "Narrowing works, but asserts vanish under python -O. Fine for internal invariants, wrong for validating input." },
        { id: "cast", label: "cast()", line: "user = cast(User, user)", ok: true, diag: "Success: no issues found", type: "User", note: "Silences the checker without checking anything. If user really is None you still crash at runtime. Use cast only when you know something the checker cannot." }
      ]
    },
    {
      id: "variance", label: "Invariance",
      code: ["{FIX}", "    return sum(xs) / len(xs)", "mean(prices)   # prices: list[int]"],
      fixes: [
        { id: "list", label: "list[float]", line: "def mean(xs: list[float]) -> float:", ok: false, diag: "error: Argument 1 to \"mean\" has incompatible type \"list[int]\"; expected \"list[float]\"  [arg-type]\nnote: \"list\" is invariant -- consider using \"Sequence\" instead, which is covariant", type: "list[int]", note: "A list[float] parameter could legally append a float, which would corrupt a caller's list[int]. So list is invariant." },
        { id: "seq", label: "Sequence[float]", line: "def mean(xs: Sequence[float]) -> float:", ok: true, diag: "Success: no issues found", type: "list[int]", note: "Sequence is read-only, therefore covariant: a Sequence[int] is acceptable wherever a Sequence[float] is expected." },
        { id: "iter", label: "Iterable[float]", line: "def mean(xs: Iterable[float]) -> float:", ok: false, diag: "error: Argument 1 to \"len\" has incompatible type \"Iterable[float]\"; expected \"Sized\"  [arg-type]", type: "Iterable[float]", note: "Too loose: an Iterable has no len(). Accept the weakest type that still supports what the body does." }
      ]
    },
    {
      id: "protocol", label: "Protocol",
      code: ["{FIX}", "def load(src: Readable) -> bytes:", "    return src.read()", "load(io.BytesIO(b\"hi\")); load(S3Object(...))"],
      fixes: [
        { id: "abc", label: "ABC base", line: "class Readable(ABC): @abstractmethod def read(self) -> bytes: ...", ok: false, diag: "error: Argument 1 to \"load\" has incompatible type \"S3Object\"; expected \"Readable\"  [arg-type]", type: "nominal", note: "Nominal typing: S3Object comes from a library and does not inherit your ABC, so it is rejected even though it has read()." },
        { id: "proto", label: "Protocol", line: "class Readable(Protocol): def read(self) -> bytes: ...", ok: true, diag: "Success: no issues found", type: "structural", note: "Structural typing: anything with a compatible read() qualifies, including third-party classes you cannot modify." }
      ]
    },
    {
      id: "typeddict", label: "TypedDict",
      code: ["class Event(TypedDict):", "    id: str", "    {FIX}", "e: Event = {\"id\": \"e1\"}"],
      fixes: [
        { id: "req", label: "ts: float", line: "ts: float", ok: false, diag: "error: Missing key \"ts\" for TypedDict \"Event\"  [typeddict-item]", type: "Event", note: "Keys are required by default, so the literal is incomplete." },
        { id: "notreq", label: "NotRequired", line: "ts: NotRequired[float]", ok: true, diag: "Success: no issues found", type: "Event", note: "NotRequired documents an optional key. Readers must then use e.get(\"ts\") rather than e[\"ts\"]." }
      ]
    }
  ];

  Widgets.typeChecker = function (mount) {
    K.shell(mount, "checker", "What the type checker says",
      "Pick a situation, then pick a fix. The panel shows the diagnostic a strict checker would report and the type it infers at the interesting point.");
    var cs = CASES[0], fx = cs.fixes[0];
    var top = h("div", { class: "w-stage", style: "display:flex;gap:10px;flex-wrap:wrap" });
    var fixRow = h("div", { class: "w-stage", style: "display:flex;gap:10px;flex-wrap:wrap" });
    var codeBox = h("pre", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.78rem;margin:0;white-space:pre-wrap;color:var(--text)" });
    var diag = h("pre", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.76rem;margin:0;white-space:pre-wrap" });
    var readout = h("div", { class: "w-readout" });
    function buildFixes() {
      K.clear(fixRow);
      fixRow.appendChild(K.segment(cs.fixes.map(function (f) { return [f.id, f.label]; }), 0, function (id) {
        fx = cs.fixes.filter(function (f) { return f.id === id; })[0]; paint();
      }));
    }
    function paint() {
      codeBox.textContent = cs.code.map(function (l) { return l.replace("{FIX}", fx.line); }).join("\n");
      diag.textContent = fx.diag;
      diag.style.color = fx.ok ? "var(--lime-ink)" : "var(--rose-ink)";
      K.clear(readout);
      readout.appendChild(K.ro("case", cs.label));
      readout.appendChild(K.ro("fix", fx.label));
      readout.appendChild(K.ro("verdict", fx.ok ? "passes" : "error"));
      readout.appendChild(K.ro("inferred", fx.type));
      readout.appendChild(K.wide(fx.note));
    }
    top.appendChild(K.segment(CASES.map(function (c) { return [c.id, c.label]; }), 0, function (id) {
      cs = CASES.filter(function (c) { return c.id === id; })[0]; fx = cs.fixes[0]; buildFixes(); paint();
    }));
    mount.appendChild(top);
    mount.appendChild(fixRow);
    mount.appendChild(codeBox);
    mount.appendChild(diag);
    mount.appendChild(readout);
    buildFixes();
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "types-basics": {
      title: "Type hints checkpoint",
      sub: "Gradual typing, narrowing, records and literal types.",
      questions: [
        {
          q: "What does CPython do with a type annotation such as def f(x: int) when you call f(\"a\")?",
          options: ["Raises TypeError","Nothing: annotations are not enforced at runtime; a static checker or a validation library must act on them","Coerces \"a\" to int","Emits a warning"],
          answer: 1,
          explain: "Annotations are metadata. Static tools such as mypy or pyright check them before running, and libraries such as pydantic can validate at runtime, but the interpreter itself ignores them."
        },
        {
          q: "Which narrowing technique should you use to validate untrusted input?",
          options: ["An explicit if check that raises a real exception","assert isinstance(x, int)","typing.cast","A # type: ignore comment"],
          answer: 0,
          explain: "Asserts are stripped under python -O and cast performs no check at all. An if-check that raises narrows the type for the checker and actually protects the program at runtime."
        },
        {
          q: "You parse JSON from a partner API into a dict. Which type best describes its shape for the checker without changing the runtime value?",
          options: ["dict[str, Any]","A frozen dataclass","Any","A TypedDict"],
          answer: 3,
          explain: "TypedDict types an ordinary dict key by key, so you keep the plain dict at runtime and the checker knows each field. A dataclass changes the runtime type, and dict[str, Any] tells the checker nothing."
        },
        {
          q: "What does typing.assert_never(x) in the final else of a match over an Enum buy you?",
          options: ["Faster matching","Runtime validation of the enum","A type error if a new enum member is added and not handled, because x would no longer be Never there","Nothing on Python 3.11+"],
          answer: 2,
          explain: "When every member is handled, the checker narrows x to Never in the fallback branch. Add a member and that branch becomes reachable with a real type, so the call to assert_never fails type checking: exhaustiveness for free."
        },
        {
          q: "A function returns str for a str argument and bytes for a bytes argument. How do you express that precisely?",
          options: ["-> str | bytes","-> Any","@overload signatures, or a constrained TypeVar","Two functions are required"],
          answer: 2,
          explain: "A plain union return forces callers to narrow a value whose type they already know. Overloads (or TypeVar('S', str, bytes)) tie the output type to the input type."
        },
        {
          q: "Which annotation restricts a parameter to the strings \"asc\" or \"desc\"?",
          options: ["str","Literal[\"asc\", \"desc\"]","Enum","Annotated[str, 2]"],
          answer: 1,
          explain: "Literal types let the checker reject any other string at call sites, which is ideal for small fixed option sets in function signatures. An Enum is the better choice when the values carry behaviour or appear in many places."
        }
      ]
    },
    "types-generics": {
      title: "Generics and protocols checkpoint",
      sub: "TypeVar, variance, Protocol and typing at scale.",
      questions: [
        {
          q: "Why does mypy reject passing list[int] to a parameter typed list[float]?",
          options: ["list is invariant: the function could append a float into the caller's list[int]","int is not a float","mypy does not support numbers","Generic types are never compatible"],
          answer: 0,
          explain: "Mutable containers must be invariant to stay sound. Accepting Sequence[float] instead is covariant and safe because the function promises not to write."
        },
        {
          q: "What does def first[T](xs: Sequence[T]) -> T: express (Python 3.12 syntax)?",
          options: ["T is any type and the return can differ","T must be a class","It is a runtime-checked generic","The return type is the same type as the elements of the input"],
          answer: 3,
          explain: "A type parameter links input and output: first(list_of_users) is known to return a User. PEP 695 syntax declares T inline instead of with a module-level TypeVar."
        },
        {
          q: "When is a Protocol a better choice than an abstract base class?",
          options: ["When you want runtime enforcement","When the class has many methods","Never; ABCs are always better","When you need to accept third-party types you cannot make inherit from your base"],
          answer: 3,
          explain: "Protocols are structural: any object with matching members satisfies them, with no inheritance needed. ABCs are nominal and enforce implementation at instantiation, which helps when you own the hierarchy."
        },
        {
          q: "What does @runtime_checkable allow, and what is its limit?",
          options: ["Full signature checking at runtime","Faster attribute access","isinstance() checks against a Protocol, but only verifying that the members exist, not their signatures or types","Static checking of untyped code"],
          answer: 2,
          explain: "Runtime protocol checks look for attribute names only. An object with a read attribute of the wrong signature still passes isinstance, so treat it as a coarse filter."
        },
        {
          q: "You are writing a decorator that must preserve the wrapped function's exact parameters for the checker. What do you use?",
          options: ["Callable[..., Any]","ParamSpec (P.args and P.kwargs)","TypeVar bound to Callable","functools.wraps alone"],
          answer: 1,
          explain: "ParamSpec captures a callable's whole parameter list so the wrapper can be typed as Callable[P, R] in and out. wraps fixes runtime metadata but tells the checker nothing."
        },
        {
          q: "In a large untyped codebase, what is the most effective way to adopt type checking?",
          options: ["Type the boundaries and new modules first, enable strict per package, and ratchet so typed code cannot regress","Turn on strict mode for everything at once","Annotate everything as Any","Only type tests"],
          answer: 0,
          explain: "Gradual typing works best inside-out from trusted boundaries. Per-module strictness and a CI ratchet make progress steady without a big-bang migration that stalls."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.types = {
    id: "types",
    name: "Typing, Generics & Protocols",
    short: "TYPE",
    tagline: "Types are the cheapest tests you will ever write",
    color: "#c084fc",
    blurb: "Gradual typing with mypy or pyright, narrowing unions, TypedDict and dataclasses at the right boundaries, Literal and overloads, generics with the 3.12 syntax, variance, Protocol-based structural typing, and a strategy for typing a large codebase.",
    modules: [
      {
        id: "basics",
        name: "Type hints that pay",
        icon: "shield",
        lessons: [
          L("why-types", "Gradual typing and the checker", "Annotations are not enforced at runtime; a static checker turns them into a fast test suite that runs on every save.", 7, ["mypy", "pyright", "gradual"], [
            B.p("Python's type system is <strong>gradual</strong>: annotated and unannotated code coexist, and <code class='tok'>Any</code> is the escape hatch between them. The interpreter ignores annotations. A checker such as <strong>mypy</strong> or <strong>pyright</strong> reads them and reports contradictions before the code runs."),
            B.code("python", [
              "def apply_discount(price: float, pct: float) -> float:",
              "    return price * (1 - pct / 100)",
              "",
              "apply_discount(\"19.99\", 10)",
              "# error: Argument 1 has incompatible type \"str\"; expected \"float\"",
              "",
              "reveal_type(apply_discount(10, 5))   # checker prints: float"
            ]),
            B.table(["What types catch", "What they do not"], [
              ["None where a value is expected", "Wrong business logic with correct types"],
              ["Typos in attribute and keyword names", "Data that is wrong at runtime (validate it)"],
              ["Broken call sites after a refactor", "Performance problems"],
              ["Missing cases in a match over an Enum", "Anything hidden behind Any"]
            ]),
            B.cmp("mypy", ["Reference implementation of many typing PEPs", "Plugins (pydantic, Django stubs)", "Per-module config in pyproject"],
                  "pyright", ["Very fast, powers editor tooling", "Strong inference, strict defaults available", "Node-based CLI; also used by some IDEs"]),
            B.tip("Run the checker in CI and in your editor. A type error found while typing costs seconds; the same bug in production costs an incident."),
            B.p("Trade-off: annotations add noise to simple scripts, and complex generic signatures can become harder to read than the code. Type the public surface and the tricky parts; let inference handle local variables."),
            B.cue("<strong>Interview cue:</strong> \"Types are the cheapest tests you will ever write: they run on every keystroke and cover every call site.\" Then name the limit: they do not validate runtime data."),
            B.key("<strong>Annotations are checked statically, not enforced at runtime.</strong> Run a checker everywhere and validate untrusted data separately.")
          ]),
          L("unions-narrowing", "Optional, unions and narrowing", "X | None forces you to handle absence; isinstance, is None, match and TypeIs narrow the type so the checker follows your logic.", 8, ["optional", "narrowing", "typeis"], [
            B.p("<code class='tok'>User | None</code> (or <code class='tok'>Optional[User]</code>) says the value may be absent. The checker will not let you use <code class='tok'>.name</code> until control flow proves it is not None. That proof is called <strong>narrowing</strong>."),
            B.widget("typeChecker"),
            B.table(["Narrowing construct", "Narrows to"], [
              ["<code class='tok'>if x is None: return</code>", "Non-None below the return"],
              ["<code class='tok'>isinstance(x, (int, float))</code>", "That union of classes"],
              ["<code class='tok'>match x: case Point(x=0):</code>", "The matched class pattern"],
              ["<code class='tok'>if key in typed_dict:</code>", "Key presence for NotRequired keys"],
              ["User function returning <code class='tok'>TypeIs[T]</code> (3.13)", "T when True, and the remainder when False"],
              ["<code class='tok'>TypeGuard[T]</code> (3.10)", "T when True only"]
            ]),
            B.code("python", [
              "from typing import TypeIs, TypeGuard",
              "",
              "def is_money(x: int | str | Money) -> TypeIs[Money]:",
              "    return isinstance(x, Money) and x.cents >= 0",
              "",
              "def render(x: int | str | Money) -> str:",
              "    if is_money(x):",
              "        return x.format()           # x: Money",
              "    return str(x)                   # x: int | str  (TypeIs narrows both ways)",
              "",
              "# TypeGuard may narrow to a non-subtype, e.g. list[object] -> list[str],",
              "# but only narrows the True branch",
              "def all_str(xs: list[object]) -> TypeGuard[list[str]]:",
              "    return all(isinstance(x, str) for x in xs)"
            ]),
            B.trap("<code class='tok'>if user:</code> narrows away None but also treats an empty string, 0 or an empty list as missing. Use <code class='tok'>is None</code> when falsy values are legitimate."),
            B.cue("<strong>Spotting it in a prompt:</strong> an <code class='tok'>AttributeError: 'NoneType' object has no attribute</code> in production is a missing-narrowing bug a checker would have caught. Say so."),
            B.key("<strong>Make absence explicit and narrow it honestly.</strong> Prefer early returns and is None checks; use cast only when you truly know more than the checker.")
          ]),
          L("typeddict-dataclass", "TypedDict, dataclass, NamedTuple or a model?", "Pick the record type by where the data lives: plain dicts at the wire, validated models at the boundary, dataclasses inside.", 8, ["typeddict", "dataclass", "pydantic"], [
            B.p("Python offers several ways to describe a record. They differ in what exists at runtime and how much checking happens. The mistake is not picking the wrong one once; it is using the same one everywhere."),
            B.table(["Type", "Runtime value", "Validation", "Best for"], [
              ["<code class='tok'>TypedDict</code>", "A plain dict", "Static only", "JSON shapes, kwargs, legacy dict-heavy code"],
              ["<code class='tok'>dataclass</code>", "Your class", "None (types are hints)", "Internal domain objects"],
              ["<code class='tok'>NamedTuple</code>", "A tuple subclass", "None", "Small immutable values that unpack"],
              ["pydantic model", "Your class", "Parses and validates at runtime", "Untrusted input: HTTP bodies, config, messages"],
              ["attrs class", "Your class", "Optional validators", "Rich internal objects, slots by default"]
            ]),
            B.code("python", [
              "from typing import TypedDict, NotRequired",
              "from dataclasses import dataclass",
              "from pydantic import BaseModel, Field",
              "",
              "class OrderIn(BaseModel):          # edge: validate untrusted JSON",
              "    sku: str = Field(min_length=1)",
              "    qty: int = Field(gt=0, le=1000)",
              "",
              "@dataclass(frozen=True, slots=True)",
              "class Order:                        # core: trusted, cheap",
              "    sku: str",
              "    qty: int",
              "",
              "class OrderRow(TypedDict):          # storage: rows as dicts",
              "    sku: str",
              "    qty: int",
              "    note: NotRequired[str]"
            ]),
            B.p("A healthy service <strong>parses at the boundary</strong>: an HTTP body becomes a validated model, which is converted to an internal dataclass, which the core uses without re-checking. Validation cost is paid once, and the core never sees a half-valid object."),
            B.warn("Do not pass pydantic models deep into your domain just because they are convenient. You couple business logic to a serialisation library and pay validation repeatedly, which can show up in profiles on hot paths."),
            B.cue("<strong>Interview cue:</strong> \"Parse, don't validate: convert untrusted input into a type that cannot be invalid, at the edge, once.\""),
            B.key("<strong>Choose the record by location.</strong> TypedDict for dict-shaped wire data, a validating model at trust boundaries, frozen dataclasses for the core.")
          ]),
          L("literal-enum-overload", "Literal, Enum, Final and overload", "Encode small option sets, constants and input-dependent return types so the checker enforces your API's rules.", 8, ["literal", "enum", "overload"], [
            B.p("Some of the most useful types are tiny. <code class='tok'>Literal</code> restricts values, <code class='tok'>Enum</code> names a closed set with behaviour, <code class='tok'>Final</code> marks constants, and <code class='tok'>@overload</code> describes functions whose return type depends on arguments."),
            B.code("python", [
              "from enum import StrEnum",
              "from typing import Literal, Final, overload, assert_never",
              "",
              "MAX_PAGE: Final = 500",
              "",
              "class Status(StrEnum):           # 3.11+: members are real str values",
              "    PENDING = \"pending\"",
              "    PAID = \"paid\"",
              "    REFUNDED = \"refunded\"",
              "",
              "def badge(s: Status) -> str:",
              "    match s:",
              "        case Status.PENDING: return \"grey\"",
              "        case Status.PAID: return \"green\"",
              "        case Status.REFUNDED: return \"amber\"",
              "        case _: assert_never(s)   # new member -> type error here",
              "",
              "@overload",
              "def fetch(id: int, raw: Literal[True]) -> bytes: ...",
              "@overload",
              "def fetch(id: int, raw: Literal[False] = ...) -> dict[str, object]: ...",
              "def fetch(id, raw=False):",
              "    ..."
            ]),
            B.table(["Tool", "Use when", "Avoid when"], [
              ["<code class='tok'>Literal[...]</code>", "2 to 5 option strings in one signature", "Values are reused across modules: use an Enum"],
              ["<code class='tok'>Enum</code> / <code class='tok'>StrEnum</code>", "Closed sets used widely, with methods", "The set is open-ended or user-defined"],
              ["<code class='tok'>Final</code>", "Module constants, class constants", "Values meant to be configured"],
              ["<code class='tok'>@overload</code>", "Return type depends on a flag or argument type", "You can split it into two clearer functions"]
            ]),
            B.tip("Boolean flags that change a return type are often a design smell. Two functions, <code class='tok'>fetch_raw</code> and <code class='tok'>fetch_json</code>, may be simpler than overloads."),
            B.quiz("types-basics"),
            B.cue("<strong>Spotting it in a prompt:</strong> \"we keep forgetting to handle a new status\" is solved by an Enum plus assert_never: exhaustiveness checking at zero runtime cost."),
            B.key("<strong>Small types enforce big rules.</strong> Literal for local options, Enum for shared sets, Final for constants, and assert_never for exhaustive handling.")
          ])
        ]
      },
      {
        id: "generics",
        name: "Generics & structural typing",
        icon: "diamond",
        lessons: [
          L("generics-typevar", "Generics and type parameters", "Type parameters link inputs to outputs; Python 3.12 lets you declare them inline on functions, classes and aliases.", 8, ["generics", "typevar", "pep695"], [
            B.p("A generic function is one whose types are parameterised: <code class='tok'>first(xs)</code> returns <em>whatever</em> the list holds. Without a type parameter you must choose between <code class='tok'>Any</code> (no checking) and one concrete type (no reuse)."),
            B.code("python", [
              "from collections.abc import Sequence, Callable",
              "",
              "# 3.12+ syntax (PEP 695)",
              "def first[T](xs: Sequence[T]) -> T:",
              "    return xs[0]",
              "",
              "class Page[T]:",
              "    def __init__(self, items: list[T], cursor: str | None) -> None:",
              "        self.items, self.cursor = items, cursor",
              "",
              "type Handler[E] = Callable[[E], None]      # generic alias",
              "",
              "def max_by[T, K: (int, float, str)](xs: Sequence[T], key: Callable[[T], K]) -> T:",
              "    return max(xs, key=key)",
              "",
              "# pre-3.12 equivalent",
              "from typing import TypeVar, Generic",
              "T = TypeVar(\"T\")",
              "class OldPage(Generic[T]): ..."
            ]),
            B.table(["Form", "Meaning"], [
              ["<code class='tok'>[T]</code>", "Any type, the same everywhere T appears in one call"],
              ["<code class='tok'>[T: Base]</code>", "Upper bound: T must be Base or a subclass"],
              ["<code class='tok'>[T: (int, str)]</code>", "Constrained: exactly one of the listed types"],
              ["<code class='tok'>Self</code> (3.11)", "The type of the current instance, for fluent APIs and classmethod constructors"]
            ]),
            B.trap("A type variable used only once in a signature adds nothing: <code class='tok'>def log[T](x: T) -> None</code> is just <code class='tok'>object</code>. Type parameters earn their keep by relating two or more positions."),
            B.p("Trade-off: generics make reusable code precise, but deep generic stacks produce error messages few people can read. Keep type parameters to one or two per signature and give aliases good names."),
            B.cue("<strong>Interview cue:</strong> explain a TypeVar as \"a promise that these positions have the same type for any given call\", then show the bound form for anything that needs methods."),
            B.key("<strong>Type parameters relate positions.</strong> Use the 3.12 syntax where you can, bound them when the body needs methods, and avoid single-use type variables.")
          ]),
          L("variance", "Variance without tears", "Why list[int] is not a list[float], why Sequence is fine, and why callables flip direction for their arguments.", 8, ["variance", "covariance", "callable"], [
            B.p("Variance answers: if <code class='tok'>Dog</code> is a subtype of <code class='tok'>Animal</code>, is <code class='tok'>Box[Dog]</code> a subtype of <code class='tok'>Box[Animal]</code>? It depends on whether the box can be <strong>written to</strong>, <strong>read from</strong>, or both."),
            B.table(["Variance", "Rule", "Examples"], [
              ["Covariant", "Box[Dog] is a Box[Animal]. Read-only", "<code class='tok'>Sequence</code>, <code class='tok'>Iterable</code>, <code class='tok'>tuple</code>, <code class='tok'>frozenset</code>, Mapping values, Callable return"],
              ["Contravariant", "Box[Animal] is a Box[Dog]. Write/consume-only", "Callable parameters: a handler of any Animal can handle Dogs"],
              ["Invariant", "Neither. Read and write", "<code class='tok'>list</code>, <code class='tok'>dict</code>, <code class='tok'>set</code>, Mapping keys"]
            ]),
            B.code("python", [
              "def feed_all(animals: list[Animal]) -> None:",
              "    animals.append(Cat())        # legal for list[Animal]",
              "",
              "dogs: list[Dog] = [Dog()]",
              "feed_all(dogs)                   # error: list is invariant",
              "",
              "def feed_all_ro(animals: Sequence[Animal]) -> None: ...",
              "feed_all_ro(dogs)                # ok: Sequence is covariant",
              "",
              "on_dog: Callable[[Dog], None]",
              "on_any: Callable[[Animal], None] = lambda a: None",
              "on_dog = on_any                  # ok: params are contravariant"
            ]),
            B.tip("Rule of thumb for parameters: accept the most abstract read-only type the body needs (<code class='tok'>Iterable</code>, <code class='tok'>Sequence</code>, <code class='tok'>Mapping</code>); return the most concrete type you produce (<code class='tok'>list</code>, <code class='tok'>dict</code>)."),
            B.p("With PEP 695 syntax, checkers <em>infer</em> the variance of your own generic classes from how the type parameter is used, so you rarely spell <code class='tok'>covariant=True</code> by hand anymore."),
            B.cue("<strong>Spotting it in a prompt:</strong> an \"incompatible type list[X]; expected list[Y]\" error with a note about invariance. The fix is almost always to widen the parameter to Sequence or Iterable."),
            B.key("<strong>Read-only is covariant, write-only is contravariant, read-write is invariant.</strong> Accept abstract read-only types and return concrete ones.")
          ]),
          L("protocols", "Protocols and structural typing", "Describe what an object can do, not what it inherits from, and accept third-party types without adapters.", 8, ["protocol", "duck-typing", "structural"], [
            B.p("Python has always been duck-typed at runtime. <code class='tok'>typing.Protocol</code> brings that to the checker: a protocol lists required members, and <strong>any</strong> class with compatible members satisfies it, with no inheritance or registration."),
            B.code("python", [
              "from typing import Protocol, runtime_checkable",
              "",
              "class Clock(Protocol):",
              "    def now(self) -> float: ...",
              "",
              "class SystemClock:",
              "    def now(self) -> float:",
              "        return time.time()",
              "",
              "class FrozenClock:                 # test double: no base class needed",
              "    def __init__(self, t: float) -> None: self.t = t",
              "    def now(self) -> float: return self.t",
              "",
              "def is_expired(token_exp: float, clock: Clock) -> bool:",
              "    return clock.now() >= token_exp",
              "",
              "@runtime_checkable",
              "class SupportsClose(Protocol):",
              "    def close(self) -> None: ..."
            ]),
            B.cmp("Abstract base class", ["Nominal: must inherit", "Enforces implementation at instantiation", "Can share concrete helper methods"],
                  "Protocol", ["Structural: just match the shape", "Works with types you do not own", "Checked statically; isinstance only with runtime_checkable"]),
            B.warn("<code class='tok'>isinstance(x, SupportsClose)</code> on a runtime-checkable protocol only checks that a <code class='tok'>close</code> attribute exists. It does not check its signature or return type, and it is relatively slow."),
            B.p("Protocols shine at module boundaries: a repository protocol, a clock, a message publisher. Your core depends on a few-method shape; production and test implementations plug in without inheriting from anything. Keep them small: a ten-method protocol is an ABC in disguise."),
            B.cue("<strong>Interview cue:</strong> \"I type collaborators as small Protocols, so tests pass simple fakes and production can use library classes untouched.\""),
            B.key("<strong>Protocols type duck typing.</strong> Define small capability shapes at boundaries and let any matching class satisfy them.")
          ]),
          L("typing-strategy", "A typing strategy that scales", "Strictness per package, stubs, honest Any boundaries, ParamSpec for decorators, and a CI ratchet so coverage only goes up.", 9, ["strict", "stubs", "paramspec"], [
            B.p("Typing a large codebase is an engineering project, not a style preference. The goal is a steadily growing island of trustworthy types, with explicit and small borders where <code class='tok'>Any</code> enters."),
            B.code("toml", [
              "[tool.mypy]",
              "python_version = \"3.12\"",
              "warn_unused_ignores = true",
              "warn_redundant_casts = true",
              "",
              "[[tool.mypy.overrides]]",
              "module = [\"billing.*\", \"core.*\"]",
              "strict = true",
              "",
              "[[tool.mypy.overrides]]",
              "module = [\"legacy.*\"]",
              "ignore_errors = true"
            ]),
            B.ol([
              "Type <strong>boundaries</strong> first: public functions, HTTP handlers, repository interfaces.",
              "Turn on <strong>strict per package</strong> as each one is clean; never globally on day one.",
              "Install <strong>stub packages</strong> (for example types-requests) or write minimal <code class='tok'>.pyi</code> stubs for untyped dependencies.",
              "Ban new <code class='tok'># type: ignore</code> without an error code, and warn on unused ignores.",
              "Add a <strong>ratchet</strong> in CI: the count of errors or untyped functions may only go down."
            ]),
            B.code("python", [
              "from typing import Callable, ParamSpec, TypeVar",
              "import functools",
              "",
              "P = ParamSpec(\"P\")",
              "R = TypeVar(\"R\")",
              "",
              "def logged(fn: Callable[P, R]) -> Callable[P, R]:",
              "    @functools.wraps(fn)",
              "    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:",
              "        return fn(*args, **kwargs)",
              "    return wrapper"
            ]),
            B.table(["Smell", "Better"], [
              ["<code class='tok'>Any</code> spreading through signatures", "Contain it at one adapter; convert to a real type there"],
              ["<code class='tok'># type: ignore</code> with no code", "<code class='tok'># type: ignore[attr-defined]</code> plus a reason"],
              ["Huge Union return types", "Overloads, or split the function"],
              ["<code class='tok'>dict[str, Any]</code> passed everywhere", "TypedDict or a dataclass"]
            ]),
            B.tip("Annotations on Python 3.14 are evaluated lazily by default, which removes most forward-reference headaches. On older versions, <code class='tok'>from __future__ import annotations</code> gives similar ergonomics, but watch libraries that read annotations at runtime."),
            B.quiz("types-generics"),
            B.cue("<strong>Interview cue:</strong> describe adoption as a ratchet: \"strict where it is clean, stubs at the edges, and CI that refuses regressions\". It shows you have done it, not just read about it."),
            B.key("<strong>Grow trusted islands.</strong> Strict per package, contained Any, error-coded ignores, ParamSpec for decorators, and a CI ratchet that never goes backwards.")
          ])
        ]
      }
    ]
  };
})();
