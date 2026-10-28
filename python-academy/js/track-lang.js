/* =====================================================================
   PYXIS · Python Language & Data Model
   window.TRACKS.lang — modules: objects / runtime
   Registers its own widgets, quizzes and track data. Uses window.PyxisKit.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.PyxisKit;
  var h = K.h, B = K.B, L = K.lesson;
  var Widgets = {};

  /* ==================================================================
     mutabilityLab — names, objects and aliasing, step by step
  ================================================================== */
  var SCENARIOS = [
    {
      id: "alias", label: "Alias a list",
      code: ["a = [1, 2]", "b = a", "b.append(3)", "b = [9]"],
      steps: [
        { names: { a: "o1" }, objs: { o1: "[1, 2]" }, note: "One list object exists; the name a refers to it." },
        { names: { a: "o1", b: "o1" }, objs: { o1: "[1, 2]" }, note: "Assignment never copies. b is a second name for the same object." },
        { names: { a: "o1", b: "o1" }, objs: { o1: "[1, 2, 3]" }, note: "append mutates the shared object, so the change is visible through a as well." },
        { names: { a: "o1", b: "o2" }, objs: { o1: "[1, 2, 3]", o2: "[9]" }, note: "Rebinding b points it at a new object. a is untouched: rebinding is not mutation." }
      ]
    },
    {
      id: "iadd", label: "+= list vs tuple",
      code: ["x = [1]; y = x", "x += [2]", "s = (1,); t = s", "s += (2,)"],
      steps: [
        { names: { x: "o1", y: "o1" }, objs: { o1: "[1]" }, note: "Two names, one list." },
        { names: { x: "o1", y: "o1" }, objs: { o1: "[1, 2]" }, note: "list defines __iadd__, which extends in place. y sees the change." },
        { names: { x: "o1", y: "o1", s: "o2", t: "o2" }, objs: { o1: "[1, 2]", o2: "(1,)" }, note: "Two names, one tuple." },
        { names: { x: "o1", y: "o1", s: "o3", t: "o2" }, objs: { o1: "[1, 2]", o2: "(1,)", o3: "(1, 2)" }, note: "tuple has no __iadd__, so += falls back to s = s + (2,): a brand-new object. t still holds the old one." }
      ]
    },
    {
      id: "default", label: "Mutable default",
      code: ["def add(item, bucket=[]):", "    bucket.append(item); return bucket", "r1 = add('a')", "r2 = add('b')"],
      steps: [
        { names: { "add.__defaults__[0]": "o1" }, objs: { o1: "[]" }, note: "The default list is created once, when def runs, and stored on the function." },
        { names: { "add.__defaults__[0]": "o1" }, objs: { o1: "[]" }, note: "The body has not run yet; nothing has changed." },
        { names: { "add.__defaults__[0]": "o1", r1: "o1" }, objs: { o1: "['a']" }, note: "The call mutates the shared default and returns it." },
        { names: { "add.__defaults__[0]": "o1", r1: "o1", r2: "o1" }, objs: { o1: "['a', 'b']" }, note: "The second call reuses the same list. r1 and r2 are the same object. Use bucket=None and create the list inside." }
      ]
    },
    {
      id: "copy", label: "Shallow vs deep copy",
      code: ["grid = [[0], [0]]", "shallow = grid.copy()", "deep = copy.deepcopy(grid)", "grid[0].append(1)"],
      steps: [
        { names: { grid: "o1" }, objs: { o1: "[o2, o3]", o2: "[0]", o3: "[0]" }, note: "An outer list holding references to two inner lists." },
        { names: { grid: "o1", shallow: "o4" }, objs: { o1: "[o2, o3]", o4: "[o2, o3]", o2: "[0]", o3: "[0]" }, note: "A shallow copy makes a new outer list whose slots point at the same inner lists." },
        { names: { grid: "o1", shallow: "o4", deep: "o5" }, objs: { o1: "[o2, o3]", o4: "[o2, o3]", o5: "[o6, o7]", o2: "[0]", o3: "[0]", o6: "[0]", o7: "[0]" }, note: "deepcopy recursively copies children too (and remembers what it copied, so cycles are safe)." },
        { names: { grid: "o1", shallow: "o4", deep: "o5" }, objs: { o1: "[o2, o3]", o4: "[o2, o3]", o5: "[o6, o7]", o2: "[0, 1]", o3: "[0]", o6: "[0]", o7: "[0]" }, note: "Mutating an inner list shows through the shallow copy but not the deep one." }
      ]
    }
  ];

  Widgets.mutabilityLab = function (mount) {
    K.shell(mount, "simulator", "Names, objects and aliasing",
      "Pick a scenario and step through it. The left column lists names; the right lists the objects they refer to. Watch which operations mutate an object and which only rebind a name.");
    var sc = SCENARIOS[0], step = 0;
    var codeBox = h("div", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.8rem;display:grid;gap:2px" });
    var board = h("div", { class: "w-stage", style: "display:grid;grid-template-columns:1fr 1fr;gap:12px" });
    var readout = h("div", { class: "w-readout" });
    var controls = h("div", { class: "w-stage", style: "display:flex;gap:8px;flex-wrap:wrap;align-items:center" });
    function paint() {
      var st = sc.steps[step];
      K.clear(codeBox);
      sc.code.forEach(function (line, i) {
        codeBox.appendChild(h("div", { style: "padding:2px 8px;border-radius:6px;" + (i === step ? "background:var(--surface-2);color:var(--text);font-weight:700" : "color:var(--text-dim)") }, (i === step ? "\u25b6 " : "  ") + line));
      });
      K.clear(board);
      var namesCol = h("div", { style: "display:grid;gap:6px;align-content:start" }, h("b", { style: "font-size:0.78rem;color:var(--text-dim)" }, "names"));
      Object.keys(st.names).forEach(function (n) {
        namesCol.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text)" }, n + " \u2192 " + st.names[n]));
      });
      var objCol = h("div", { style: "display:grid;gap:6px;align-content:start" }, h("b", { style: "font-size:0.78rem;color:var(--text-dim)" }, "objects"));
      Object.keys(st.objs).forEach(function (o) {
        var refs = Object.keys(st.names).filter(function (n) { return st.names[n] === o; }).length;
        objCol.appendChild(h("div", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text);border:1px solid var(--line-strong);border-radius:8px;padding:4px 8px" },
          o + "  " + st.objs[o] + "   (" + refs + " name" + (refs === 1 ? "" : "s") + ")"));
      });
      board.appendChild(namesCol);
      board.appendChild(objCol);
      K.clear(readout);
      readout.appendChild(K.ro("scenario", sc.label));
      readout.appendChild(K.ro("step", (step + 1) + " / " + sc.steps.length));
      readout.appendChild(K.ro("objects alive", Object.keys(st.objs).length));
      readout.appendChild(K.wide(st.note));
    }
    controls.appendChild(K.segment(SCENARIOS.map(function (s) { return [s.id, s.label]; }), 0, function (id) {
      sc = SCENARIOS.filter(function (s) { return s.id === id; })[0]; step = 0; paint();
    }));
    controls.appendChild(K.btn("Step \u25b6", "primary", function () { step = (step + 1) % sc.steps.length; paint(); }));
    controls.appendChild(K.btn("Reset", "ghost", function () { step = 0; paint(); }));
    mount.appendChild(controls);
    mount.appendChild(codeBox);
    mount.appendChild(board);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "lang-objects": {
      title: "Objects and the data model checkpoint",
      sub: "Identity, mutability, copies, dunder protocols and hashing.",
      questions: [
        {
          q: "After a = [1]; b = a; b = b + [2], what is a?",
          options: ["[1]","[1, 2]","[2]","It raises TypeError"],
          answer: 0,
          explain: "b + [2] builds a new list and rebinds b to it. a still refers to the original [1]. Only in-place operations such as append or += on a list would have been visible through a."
        },
        {
          q: "Why is def f(x, seen=[]) a classic bug?",
          options: ["Lists are not allowed as defaults","It makes the function a generator","Defaults are evaluated lazily on each call","The default list is created once at definition time and shared by every call that omits seen"],
          answer: 3,
          explain: "Default values are evaluated when def executes and stored on the function object. Every call that relies on the default mutates the same list. Use None as the sentinel and create the list inside the body."
        },
        {
          q: "When should you use is rather than ==?",
          options: ["Comparing two strings","Comparing small integers for speed","Comparing to singletons such as None, or when you truly need object identity","Always; it is faster"],
          answer: 2,
          explain: "is checks identity, == checks value through __eq__. Identity of equal strings or ints is an interpreter implementation detail, so only singletons like None and sentinels should be compared with is."
        },
        {
          q: "A class defines __eq__ but not __hash__. What happens when you put an instance in a set?",
          options: ["It works using id()","TypeError: unhashable type, because defining __eq__ sets __hash__ to None","It works but all instances collide","Python generates __hash__ from the fields"],
          answer: 1,
          explain: "Python removes the inherited identity hash when you override equality, because equal objects must hash equal. Define a __hash__ consistent with __eq__, or use a frozen dataclass."
        },
        {
          q: "Your container class defines __len__ but not __bool__. What does if container: do?",
          options: ["Always True","Uses __len__: falsy when the length is 0","Raises TypeError","Calls __iter__ and checks for one item"],
          answer: 1,
          explain: "Truth testing tries __bool__, then falls back to __len__, then defaults to True. Defining __len__ is enough to make an empty container falsy."
        },
        {
          q: "What does copy.copy(outer) give you when outer is a list of lists?",
          options: ["A new outer list whose elements are the same inner list objects","A fully independent structure","The same object","A tuple"],
          answer: 0,
          explain: "A shallow copy duplicates only the top-level container. Inner lists are shared, so mutating one is visible through both. copy.deepcopy recurses and handles cycles with a memo."
        }
      ]
    },
    "lang-runtime": {
      title: "Functions, scope and classes checkpoint",
      sub: "Closures, decorators, attribute lookup and the MRO.",
      questions: [
        {
          q: "fns = [lambda: i for i in range(3)]; what does [f() for f in fns] return?",
          options: ["[0, 1, 2]","[0, 0, 0]","NameError","[2, 2, 2]"],
          answer: 3,
          explain: "Closures capture variables, not values. All three lambdas look up i when called, and by then the comprehension variable is 2. Bind the value with a default argument (lambda i=i: i) or use functools.partial."
        },
        {
          q: "What does functools.wraps do inside a decorator?",
          options: ["Makes the wrapper faster","Caches the result","Copies the wrapped function's name, docstring and other metadata onto the wrapper and sets __wrapped__","Makes the decorator accept arguments"],
          answer: 2,
          explain: "Without wraps, every decorated function reports the wrapper's name and docstring, which breaks logging, debugging and tools like pytest or FastAPI that introspect signatures. wraps also records __wrapped__ so inspect can find the original."
        },
        {
          q: "A function assigns count += 1 to a variable defined in its enclosing function. What is needed?",
          options: ["global count","Nothing","nonlocal count","A lambda"],
          answer: 2,
          explain: "Assignment makes a name local unless declared otherwise, so count += 1 raises UnboundLocalError. nonlocal binds the name to the nearest enclosing function scope; global would target module scope instead."
        },
        {
          q: "An instance has 'x' in its __dict__ and its class defines x as a property. Which wins on obj.x?",
          options: ["The instance __dict__","The property, because it is a data descriptor and data descriptors on the type take precedence","Whichever was defined last","It raises AttributeError"],
          answer: 1,
          explain: "Attribute lookup checks data descriptors on the type first, then the instance dict, then non-data descriptors such as plain functions. property defines __set__, so it is a data descriptor and wins."
        },
        {
          q: "When is __getattr__ called?",
          options: ["Only when normal lookup fails to find the attribute","On every attribute access","Only for private names","Only on assignment"],
          answer: 0,
          explain: "__getattribute__ runs on every access; __getattr__ is the fallback after normal lookup raises AttributeError. That makes __getattr__ the safe hook for proxies and lazy attributes."
        },
        {
          q: "In class D(B, C) where B and C both inherit from A, what does super().method() inside B do for a D instance?",
          options: ["Calls A.method","Calls object.method","Calls B.method again","Calls the next class after B in D's MRO, which is C"],
          answer: 3,
          explain: "super() follows the method resolution order of the instance's type, not the static parent of the class it appears in. D's MRO is D, B, C, A, object, so B's super() reaches C. That is what makes cooperative multiple inheritance work."
        }
      ]
    }
  });

  /* ==================================================================
     Track
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.lang = {
    id: "lang",
    name: "Python Language & Data Model",
    short: "LANG",
    tagline: "Know what the interpreter actually does",
    color: "#fbbf24",
    blurb: "Names and objects, mutability and copies, the dunder protocols that make your classes feel built in, hashing rules, closures, decorators, descriptors and the MRO.",
    modules: [
      {
        id: "objects",
        name: "Objects, names & mutability",
        icon: "cube",
        lessons: [
          L("names-objects", "Names bind to objects", "Variables are labels on objects; assignment never copies, and identity, type and value are three different questions.", 8, ["names", "identity", "references"], [
            B.p("Hold this picture: <strong>a Python variable is a name tag, not a box.</strong> Every value lives as an object on the heap with an identity, a type and a value. A name is an entry in a namespace dictionary pointing at one of those objects. Assignment moves tags; it never copies the object."),
            B.diagram("py-names", "Names live in namespaces; objects live on the heap and are shared freely."),
            B.h("Identity, type, value"),
            B.table(["Question", "Ask with", "Notes"], [
              ["Same object?", "<code class='tok'>a is b</code>, <code class='tok'>id(a)</code>", "Identity is fixed for the object's lifetime"],
              ["What kind?", "<code class='tok'>type(a)</code>, <code class='tok'>isinstance</code>", "The type decides which operations exist"],
              ["Equal value?", "<code class='tok'>a == b</code>", "Delegates to <code class='tok'>__eq__</code>; any class can redefine it"]
            ]),
            B.code("python", [
              "a = [1, 2]",
              "b = a            # second name, same object",
              "b.append(3)",
              "print(a)         # [1, 2, 3]",
              "print(a is b)    # True",
              "b = [1, 2, 3]    # rebinding: new object, a unaffected",
              "print(a == b, a is b)   # True False"
            ]),
            B.h("Reference counting, briefly"),
            B.p("CPython frees most objects the moment their reference count drops to zero, and a cyclic garbage collector cleans up reference cycles. That is why files closed by scope exit usually close promptly in CPython, and also why you should not rely on it: other interpreters and cycles delay finalization. Use <code class='tok'>with</code> for resources."),
            B.trap("Small integers and some short strings are cached by CPython, so <code class='tok'>x is 256</code> may be True while <code class='tok'>x is 257</code> is False. That is an implementation detail. Use <code class='tok'>is</code> only for singletons like <code class='tok'>None</code>, <code class='tok'>True</code> and your own sentinels."),
            B.widget("mutabilityLab"),
            B.cue("<strong>Spotting it in a prompt:</strong> \"I changed one variable and another one changed too\" is always aliasing. Say out loud: <em>assignment binds a name; only methods like append, item assignment or += on mutables change the object.</em>"),
            B.key("<strong>Names refer, objects exist.</strong> Assignment rebinds a name and never copies; mutation changes the object every name sees.")
          ]),
          L("mutability-aliasing", "Mutability, aliasing and copies", "Which built-ins mutate, why += behaves differently on lists and tuples, and when a shallow copy is not enough.", 8, ["mutability", "copy", "defaults"], [
            B.p("Mutability is a property of the <em>type</em>. Lists, dicts, sets and most user objects can change in place; ints, floats, strings, tuples, frozensets and bytes cannot. Bugs appear when a mutable object is reachable from two places and one of them did not expect to share it."),
            B.table(["Type", "Mutable?", "Hashable by default?"], [
              ["int, float, str, bytes", "No", "Yes"],
              ["tuple, frozenset", "No (but may contain mutables)", "Only if every element is hashable"],
              ["list, dict, set, bytearray", "Yes", "No"],
              ["Your class", "Yes", "Yes by identity, until you define <code class='tok'>__eq__</code>"]
            ]),
            B.h("The three classic traps"),
            B.code("python", [
              "# 1. mutable default argument: evaluated once at def time",
              "def add(item, bucket=None):",
              "    if bucket is None:",
              "        bucket = []",
              "    bucket.append(item)",
              "    return bucket",
              "",
              "# 2. multiplied nested lists share the inner row",
              "grid = [[0] * 3] * 2      # both rows are the SAME list",
              "grid = [[0] * 3 for _ in range(2)]   # independent rows",
              "",
              "# 3. += on a list mutates; on a tuple it rebinds",
              "t = ([1],)",
              "t[0] += [2]   # TypeError, yet t[0] is now [1, 2]"
            ]),
            B.p("The third one is worth explaining in an interview: <code class='tok'>t[0] += [2]</code> first calls <code class='tok'>list.__iadd__</code>, which extends the list in place, then tries to assign the result back into the tuple slot, which fails. The mutation already happened."),
            B.h("Copies: choose deliberately"),
            B.cmp("Shallow copy (list(x), x.copy(), copy.copy)", ["New outer container", "Elements are shared references", "Cheap: O(n) pointer copies"],
                  "Deep copy (copy.deepcopy)", ["Recursively copies children", "Memo dict handles cycles and shared refs", "Slow and surprising for objects holding files, locks or sockets"]),
            B.tip("Often the best copy is no copy: return new immutable values (tuples, frozen dataclasses) from functions instead of handing out internal lists that callers might mutate."),
            B.cue("<strong>Interview cue:</strong> when asked to review code with <code class='tok'>def f(x=[])</code> or <code class='tok'>[[0]*n]*m</code>, name the shared-object cause before proposing the fix; reviewers listen for the mechanism, not the folklore."),
            B.key("<strong>Mutation is visible through every reference.</strong> Use None defaults, build nested containers with comprehensions, and copy at trust boundaries, preferably into immutable types.")
          ]),
          L("dunder-protocols", "The data model: dunder protocols", "Special methods let your objects plug into len, iteration, operators, truthiness and printing, the same way built-ins do.", 9, ["dunder", "protocols", "repr"], [
            B.p("The data model is a contract: implement a few specially named methods and the language's syntax starts working on your type. <code class='tok'>len(x)</code> calls <code class='tok'>type(x).__len__</code>, <code class='tok'>a + b</code> calls <code class='tok'>__add__</code>, <code class='tok'>for</code> calls <code class='tok'>__iter__</code>. Python looks these up on the <em>type</em>, not the instance."),
            B.table(["Syntax", "Method", "Fallback / note"], [
              ["<code class='tok'>repr(x)</code>, REPL echo", "<code class='tok'>__repr__</code>", "Unambiguous, for developers; str falls back to it"],
              ["<code class='tok'>str(x)</code>, f-strings", "<code class='tok'>__str__</code>, <code class='tok'>__format__</code>", "Readable, for users"],
              ["<code class='tok'>len(x)</code>", "<code class='tok'>__len__</code>", "Must return a non-negative int"],
              ["<code class='tok'>if x:</code>", "<code class='tok'>__bool__</code>", "Falls back to __len__, then True"],
              ["<code class='tok'>x[k]</code>", "<code class='tok'>__getitem__</code>", "Alone it also enables old-style iteration"],
              ["<code class='tok'>a + b</code>", "<code class='tok'>__add__</code> / <code class='tok'>__radd__</code>", "Return NotImplemented to let the other side try"],
              ["<code class='tok'>with x:</code>", "<code class='tok'>__enter__</code> / <code class='tok'>__exit__</code>", "See the context manager lesson"]
            ]),
            B.code("python", [
              "class Money:",
              "    __slots__ = (\"cents\", \"currency\")",
              "    def __init__(self, cents: int, currency: str) -> None:",
              "        self.cents, self.currency = cents, currency",
              "    def __repr__(self) -> str:",
              "        return f\"Money({self.cents!r}, {self.currency!r})\"",
              "    def __add__(self, other):",
              "        if not isinstance(other, Money):",
              "            return NotImplemented",
              "        if other.currency != self.currency:",
              "            raise ValueError(\"currency mismatch\")",
              "        return Money(self.cents + other.cents, self.currency)",
              "    def __radd__(self, other):      # lets sum() start from 0",
              "        return self if other == 0 else self.__add__(other)"
            ]),
            B.warn("Return <code class='tok'>NotImplemented</code> (the constant), not <code class='tok'>raise NotImplementedError</code>, from binary operators. The constant tells Python to try the reflected method on the other operand; raising aborts that negotiation."),
            B.h("Trade-off: magic has a cost"),
            B.p("Operator overloading reads beautifully for value types like money, vectors and paths, and confuses everyone when <code class='tok'>+</code> secretly does I/O. Keep dunders pure, cheap and unsurprising; give anything with side effects a named method."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"make this class work with len / sorted / sum / in\" is a data-model question. Name the method, and mention that lookup happens on the type."),
            B.key("<strong>Dunders are the plug sockets of the language.</strong> Implement the protocol, return NotImplemented for foreign types, and keep the behaviour as boring as the built-ins.")
          ]),
          L("equality-hashing", "Equality, hashing and dataclasses", "The eq/hash contract, why mutable objects make bad keys, and how dataclass options encode the rules for you.", 9, ["hash", "dataclass", "slots"], [
            B.p("Dicts and sets find keys by hash first and equality second. That gives one hard rule: <strong>if a == b, then hash(a) == hash(b)</strong>, and the hash must not change while the object is in a container. Break it and lookups silently miss."),
            B.table(["You define", "Python does", "Consequence"], [
              ["Nothing", "Identity-based __eq__ and __hash__", "Every instance is distinct"],
              ["<code class='tok'>__eq__</code> only", "Sets __hash__ = None", "Instances become unhashable"],
              ["<code class='tok'>__eq__</code> + <code class='tok'>__hash__</code>", "Uses yours", "You own the contract; hash only immutable fields"]
            ]),
            B.h("Let dataclass write it"),
            B.code("python", [
              "from dataclasses import dataclass, field",
              "",
              "@dataclass(frozen=True, slots=True)",
              "class SKU:",
              "    vendor: str",
              "    code: str",
              "",
              "@dataclass(slots=True)",
              "class Cart:",
              "    owner: str",
              "    items: list[SKU] = field(default_factory=list)  # never a bare []",
              "",
              "prices = {SKU(\"acme\", \"A1\"): 999}   # frozen -> hashable",
              "# Cart is eq=True, frozen=False -> __hash__ is None, so it cannot be a key"
            ]),
            B.table(["dataclass option", "Effect"], [
              ["<code class='tok'>eq=True</code> (default)", "Field-wise __eq__; hash removed unless frozen"],
              ["<code class='tok'>frozen=True</code>", "Assignment raises; __hash__ generated from fields"],
              ["<code class='tok'>slots=True</code> (3.10+)", "No per-instance __dict__: less memory, typo-proof attributes"],
              ["<code class='tok'>order=True</code>", "Generates comparison methods in field order"],
              ["<code class='tok'>kw_only=True</code>", "Forces keyword arguments; safer for wide records"]
            ]),
            B.trap("<code class='tok'>frozen</code> is shallow. A frozen dataclass holding a list can still have that list mutated, and if the list were part of the hash it could not be hashed at all. Use tuples or frozensets for collection fields of value types."),
            B.p("Trade-off: frozen dataclasses cost a little at construction (they bypass their own guard with object.__setattr__) and make updates explicit via <code class='tok'>dataclasses.replace</code>. In exchange you get safe dict keys, safe sharing across threads, and fewer aliasing bugs."),
            B.quiz("lang-objects"),
            B.cue("<strong>Interview cue:</strong> \"Equal objects must hash equal, and anything used as a key must be immutable in the fields that feed the hash\" is the sentence that shows you understand why dict lookups fail."),
            B.key("<strong>Hash what never changes.</strong> Prefer frozen, slotted dataclasses for value objects and let the decorator generate a correct eq/hash pair.")
          ])
        ]
      },
      {
        id: "runtime",
        name: "Functions, scope & classes",
        icon: "blocks",
        lessons: [
          L("scope-closures", "Scope, LEGB and closures", "How Python resolves a name, why loop closures all see the last value, and when nonlocal is the honest fix.", 8, ["scope", "closures", "legb"], [
            B.p("Name resolution follows <strong>LEGB</strong>: Local, Enclosing function, Global (module), Built-ins. The compiler decides at definition time which names are local to a function: any name assigned anywhere in the body is local throughout the body, unless declared <code class='tok'>global</code> or <code class='tok'>nonlocal</code>."),
            B.code("python", [
              "total = 0",
              "def bump():",
              "    total += 1      # UnboundLocalError: total is local here",
              "",
              "def counter():",
              "    n = 0",
              "    def inc():",
              "        nonlocal n  # rebind the enclosing variable",
              "        n += 1",
              "        return n",
              "    return inc"
            ]),
            B.h("Closures capture variables, not values"),
            B.p("An inner function keeps a reference to the enclosing <em>cell</em>, and reads its current value when called. In a loop, every closure shares the one loop variable."),
            B.code("python", [
              "handlers = [lambda: i for i in range(3)]",
              "[f() for f in handlers]          # [2, 2, 2]",
              "handlers = [lambda i=i: i for i in range(3)]",
              "[f() for f in handlers]          # [0, 1, 2]",
              "from functools import partial",
              "handlers = [partial(print, i) for i in range(3)]   # explicit binding"
            ]),
            B.cmp("Closure state", ["Lightweight, private", "Great for small factories and decorators", "Hard to inspect or test once it grows"],
                  "Small class", ["Visible attributes, a real name", "Easy to extend and type", "A few more lines"]),
            B.tip("If a closure needs more than one or two pieces of mutable state, it wants to be a class or a dataclass with <code class='tok'>__call__</code>."),
            B.cue("<strong>Spotting it in a prompt:</strong> callbacks registered in a loop that all fire with the last item. Diagnose late binding, then fix with a default argument or partial."),
            B.key("<strong>Assignment makes a name local; closures read cells late.</strong> Bind loop values explicitly and reach for nonlocal only when the state is genuinely tiny.")
          ]),
          L("decorators", "Decorators done properly", "A decorator is just a function that takes a function and returns one; doing it well means wraps, argument factories and awareness of async.", 9, ["decorators", "functools", "wraps"], [
            B.p("<code class='tok'>@deco</code> above <code class='tok'>def f</code> is sugar for <code class='tok'>f = deco(f)</code>, executed once at import time. Most decorators return a wrapper that runs extra logic around the original call: timing, retries, caching, access checks, registration."),
            B.code("python", [
              "import functools, time",
              "",
              "def retry(times: int = 3, delay: float = 0.1):",
              "    def deco(fn):",
              "        @functools.wraps(fn)",
              "        def wrapper(*args, **kwargs):",
              "            for attempt in range(1, times + 1):",
              "                try:",
              "                    return fn(*args, **kwargs)",
              "                except ConnectionError:",
              "                    if attempt == times:",
              "                        raise",
              "                    time.sleep(delay * 2 ** (attempt - 1))",
              "        return wrapper",
              "    return deco",
              "",
              "@retry(times=5)",
              "def fetch(): ..."
            ]),
            B.table(["Shape", "Use when"], [
              ["<code class='tok'>@deco</code>", "No configuration needed"],
              ["<code class='tok'>@deco(...)</code> (factory)", "Behaviour depends on arguments; the outer call returns the real decorator"],
              ["Class with <code class='tok'>__call__</code>", "The decorator holds meaningful state or needs methods"],
              ["Registration (returns fn unchanged)", "Plugin and route tables, like web framework routing"]
            ]),
            B.warn("A sync wrapper around an <code class='tok'>async def</code> returns the coroutine without awaiting it, so your retry or timing logic measures nothing. Check <code class='tok'>inspect.iscoroutinefunction(fn)</code> and provide an async wrapper."),
            B.p("Always use <code class='tok'>functools.wraps</code>: it copies <code class='tok'>__name__</code>, <code class='tok'>__qualname__</code>, <code class='tok'>__doc__</code> and <code class='tok'>__module__</code>, and sets <code class='tok'>__wrapped__</code> so <code class='tok'>inspect.signature</code> still sees the original parameters. Frameworks that read signatures, such as FastAPI and pytest, depend on that."),
            B.h2("Trade-off"),
            B.p("Decorators hide control flow. A stack of five decorators is five layers of behaviour a reader must hold in their head, and decorators that run at import time make module import slower and order-dependent. Keep them few, well named and documented."),
            B.cue("<strong>Interview cue:</strong> write the three-level factory from memory, add wraps, and mention the async case unprompted. That combination signals production experience."),
            B.key("<strong>A decorator is f = deco(f) at import time.</strong> Use wraps, use a factory for arguments, and handle coroutine functions separately.")
          ]),
          L("descriptors-properties", "Attribute lookup, properties and descriptors", "The exact order Python searches for obj.attr, and how property, methods and ORMs are all descriptors underneath.", 10, ["descriptors", "property", "getattr"], [
            B.p("Every <code class='tok'>obj.attr</code> runs <code class='tok'>type(obj).__getattribute__</code>, which applies a fixed precedence. Knowing it explains properties, bound methods, <code class='tok'>__slots__</code>, and how ORM columns know which row they belong to."),
            B.ol([
              "Find <code class='tok'>attr</code> on the type's MRO. If it is a <strong>data descriptor</strong> (defines <code class='tok'>__set__</code> or <code class='tok'>__delete__</code>), call its <code class='tok'>__get__</code> and stop.",
              "Look in the instance <code class='tok'>__dict__</code>. If found, return it.",
              "If the type attribute is a <strong>non-data descriptor</strong> (only <code class='tok'>__get__</code>, like a function), call its <code class='tok'>__get__</code>; this is how methods become bound.",
              "Otherwise return the plain class attribute, or call <code class='tok'>__getattr__</code> if defined, or raise AttributeError."
            ]),
            B.code("python", [
              "class Positive:",
              "    def __set_name__(self, owner, name):",
              "        self.private = \"_\" + name",
              "    def __get__(self, obj, objtype=None):",
              "        return self if obj is None else getattr(obj, self.private)",
              "    def __set__(self, obj, value):",
              "        if value <= 0:",
              "            raise ValueError(f\"{self.private[1:]} must be positive\")",
              "        setattr(obj, self.private, value)",
              "",
              "class Order:",
              "    qty = Positive()      # reusable validation, declared once",
              "    def __init__(self, qty): self.qty = qty"
            ]),
            B.table(["Tool", "Reach for it when"], [
              ["Plain attribute", "Default. Python has no need for getters/setters up front"],
              ["<code class='tok'>@property</code>", "A computed or validated attribute on one class"],
              ["<code class='tok'>functools.cached_property</code>", "Expensive, computed once per instance (needs a __dict__)"],
              ["Custom descriptor", "The same validation or behaviour across many attributes or classes"],
              ["<code class='tok'>__getattr__</code>", "Proxies, lazy loading, dynamic fallbacks"]
            ]),
            B.trap("<code class='tok'>cached_property</code> stores its value in the instance <code class='tok'>__dict__</code>, so it does not work on classes using <code class='tok'>__slots__</code> without a <code class='tok'>__dict__</code> slot, and the cache never invalidates on its own."),
            B.p("Trade-off: descriptors are powerful and invisible. Prefer a property until you see the same property copied three times; then a descriptor removes duplication at the cost of a concept new teammates must learn."),
            B.cue("<strong>Spotting it in a prompt:</strong> \"validate this attribute on every assignment\" or \"how do Django/SQLAlchemy model fields work\" are descriptor questions. Lead with the lookup order."),
            B.key("<strong>Data descriptors beat the instance dict; the instance dict beats methods.</strong> Start with plain attributes, upgrade to property, and generalise to a descriptor only when it repeats.")
          ]),
          L("classes-mro", "Inheritance, MRO and composition", "How C3 linearisation orders base classes, why super() is cooperative, and when composition or __init_subclass__ beats a deeper hierarchy.", 9, ["mro", "super", "composition"], [
            B.p("Python supports multiple inheritance and resolves methods using the <strong>C3 linearisation</strong>: a single ordered list, <code class='tok'>Class.__mro__</code>, that respects each class's own base order and puts every class before its parents. <code class='tok'>super()</code> means \"the next class in the MRO of the actual instance\", not \"my parent\"."),
            B.code("python", [
              "class Base:",
              "    def save(self): print(\"Base\")",
              "class Audited(Base):",
              "    def save(self): print(\"Audited\"); super().save()",
              "class Cached(Base):",
              "    def save(self): print(\"Cached\"); super().save()",
              "class Repo(Audited, Cached): pass",
              "",
              "Repo().save()          # Audited, Cached, Base",
              "[c.__name__ for c in Repo.__mro__]",
              "# ['Repo', 'Audited', 'Cached', 'Base', 'object']"
            ]),
            B.p("Because every <code class='tok'>save</code> calls <code class='tok'>super()</code>, each class runs exactly once. If one class calls <code class='tok'>Base.save(self)</code> directly, the chain breaks and <code class='tok'>Cached</code> silently never runs. Cooperative methods should accept and forward <code class='tok'>**kwargs</code> so signatures can differ."),
            B.cmp("Deep inheritance", ["Behaviour scattered across bases", "Fragile base class problem", "Mixins must be ordered carefully"],
                  "Composition", ["Objects hold collaborators", "Swap parts in tests", "Explicit delegation, a little more code"]),
            B.h("Lighter than a metaclass"),
            B.code("python", [
              "class Plugin:",
              "    registry: dict[str, type] = {}",
              "    def __init_subclass__(cls, *, name: str, **kw):",
              "        super().__init_subclass__(**kw)",
              "        Plugin.registry[name] = cls",
              "",
              "class CsvExport(Plugin, name=\"csv\"): ..."
            ]),
            B.tip("Reach for <code class='tok'>__init_subclass__</code>, class decorators, or <code class='tok'>abc.ABC</code> before writing a metaclass. Metaclasses conflict when two libraries each bring one, and few reviewers can debug them."),
            B.quiz("lang-runtime"),
            B.cue("<strong>Interview cue:</strong> asked \"what does super() do?\", answer \"it delegates to the next class in the instance's MRO\", then sketch a diamond. That one sentence separates Python fluency from Java habits."),
            B.key("<strong>super() walks the MRO of the instance.</strong> Keep hierarchies shallow, make mixins cooperative, and prefer composition and __init_subclass__ over metaclasses.")
          ])
        ]
      }
    ]
  };
})();
