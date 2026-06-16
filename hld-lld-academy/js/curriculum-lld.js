/* =====================================================================
   BLUEPRINT · Low-Level Design curriculum
   window.TRACKS.lld   (same block grammar as the HLD file)
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.lld = {
  id: "lld",
  name: "Low-Level Design",
  short: "LLD",
  tagline: "Write code that bends, not breaks",
  color: "#5eead4",
  blurb: "Zoom into a single service. Object-oriented thinking, the SOLID principles, clean-code heuristics, and the full catalog of Gang-of-Four design patterns — the craft of code that's easy to read, test, and change.",
  modules: [
    /* ============================ OOP FOUNDATIONS ============================ */
    {
      id: "oop",
      name: "OOP Foundations",
      icon: "cube",
      lessons: [
        {
          id: "what-is-lld",
          title: "What Low-Level Design is",
          summary: "From boxes-and-arrows down to classes, methods, and interfaces — designing code that's a joy to change.",
          minutes: 6,
          tags: ["intro", "mental-model"],
          blocks: [
            { t: "p", html: "<strong>Low-Level Design (LLD)</strong> is where a single component becomes real code: the classes, their responsibilities, the interfaces between them, and how they collaborate. If HLD decides 'we need a payments service', LLD decides <em>how that service is structured internally</em> so it stays clean as it grows." },
            { t: "p", html: "Good LLD is judged by how it behaves under <strong>change</strong>. Requirements always shift; the question is whether a new requirement means a tidy addition or a terrifying ripple through the whole codebase." },
            { t: "h", text: "What we're optimizing for" },
            {
              t: "ul", items: [
                "<strong>Readability</strong> — code is read far more than written; clarity beats cleverness.",
                "<strong>Extensibility</strong> — new behavior should be easy to add without rewrites.",
                "<strong>Testability</strong> — small, decoupled units are easy to test in isolation.",
                "<strong>Maintainability</strong> — low coupling, high cohesion, no nasty surprises.",
                "<strong>Reusability</strong> — well-shaped abstractions get reused instead of copy-pasted."
              ]
            },
            { t: "note", variant: "key", html: "The toolkit is layered: <strong>OOP</strong> gives you the building blocks (objects, abstraction) → <strong>SOLID</strong> gives you principles for arranging them → <strong>design patterns</strong> are proven solutions to recurring arrangement problems. We'll climb that ladder in order." },
            { t: "note", variant: "tip", html: "Two coupling concepts to carry through everything: keep <strong>cohesion high</strong> (a class's parts truly belong together, doing one job well) and <strong>coupling low</strong> (classes depend on as little of each other as possible, via abstractions). Almost every principle ahead is a way to achieve those two." }
          ]
        },
        {
          id: "four-pillars",
          title: "The four pillars of OOP",
          summary: "Encapsulation, abstraction, inheritance, polymorphism — the foundation everything else is built on.",
          minutes: 9,
          tags: ["oop", "fundamentals"],
          blocks: [
            { t: "p", html: "Object-oriented programming organizes code around <strong>objects</strong> — bundles of data (state) and behavior (methods). Four pillars define how objects are shaped and related." },
            { t: "h", text: "1 · Encapsulation" },
            { t: "p", html: "Bundle data with the methods that operate on it, and hide the internals. Callers interact through a controlled public interface, so the object can protect its own invariants." },
            { t: "code", lang: "python", code:
              "class BankAccount:\n" +
              "    def __init__(self):\n" +
              "        self.__balance = 0          # private; no direct poking\n\n" +
              "    def deposit(self, amount):\n" +
              "        if amount <= 0:\n" +
              "            raise ValueError(\"amount must be positive\")\n" +
              "        self.__balance += amount    # invariant enforced here\n\n" +
              "    def get_balance(self):\n" +
              "        return self.__balance\n\n" +
              "# Callers can't set a negative balance behind the object's back."
            },
            { t: "h", text: "2 · Abstraction" },
            { t: "p", html: "Expose <em>what</em> an object does, hide <em>how</em>. A <code class='tok'>List</code> lets you <code class='tok'>add()</code> and <code class='tok'>get()</code> without knowing whether it's an array or linked list underneath. Abstraction manages complexity by hiding detail behind a clean concept." },
            { t: "note", variant: "tip", html: "<strong>Encapsulation vs abstraction:</strong> encapsulation is the <em>mechanism</em> (hiding data, controlling access); abstraction is the <em>outcome</em> (a simple concept you can use without knowing internals). They work together." },
            { t: "h", text: "3 · Inheritance" },
            { t: "p", html: "A subclass reuses and specializes a parent's structure and behavior — an <em>is-a</em> relationship. <code class='tok'>Dog</code> is-an <code class='tok'>Animal</code>. It enables reuse, but deep hierarchies get rigid (we'll prefer composition next lesson)." },
            { t: "h", text: "4 · Polymorphism" },
            { t: "p", html: "'Many forms' — different types respond to the same call in their own way, so calling code depends only on the abstraction." },
            { t: "code", lang: "python", code:
              "class Shape:\n" +
              "    def area(self): raise NotImplementedError\n\n" +
              "class Circle(Shape):\n" +
              "    def __init__(self, r): self.r = r\n" +
              "    def area(self): return 3.14159 * self.r * self.r\n\n" +
              "class Square(Shape):\n" +
              "    def __init__(self, s): self.s = s\n" +
              "    def area(self): return self.s * self.s\n\n" +
              "def total_area(shapes):\n" +
              "    return sum(s.area() for s in shapes)   # doesn't care which shape\n\n" +
              "total_area([Circle(2), Square(3)])   # 12.566... + 9"
            },
            { t: "note", variant: "key", html: "Polymorphism is the engine behind most design patterns and the Open/Closed Principle: because <code class='tok'>total_area</code> depends on <code class='tok'>Shape</code>, you can add a <code class='tok'>Triangle</code> later <em>without touching</em> that function. Add code, don't edit it." },
            { t: "quiz", id: "lld-oop" }
          ]
        },
        {
          id: "composition-inheritance",
          title: "Composition over inheritance",
          summary: "Why 'has-a' usually beats 'is-a', and how to dodge the fragile base-class trap.",
          minutes: 6,
          tags: ["oop", "design"],
          blocks: [
            { t: "p", html: "Inheritance is seductive for reuse, but it's the tightest coupling there is — a subclass depends on its parent's internals, and changes to the base ripple downward (the <em>fragile base class</em> problem). It also forces a single, rigid taxonomy." },
            { t: "p", html: "<strong>Composition</strong> builds behavior by <em>combining</em> small objects (<em>has-a</em>) instead of inheriting (<em>is-a</em>). It's more flexible, easier to test, and swappable at runtime." },
            { t: "compare",
              bad: { title: "Inheritance gone wrong", items: ["Deep, branching class trees", "Subclass breaks when base changes", "Can't change behavior at runtime", "'Penguin extends Bird' but can't fly → LSP break", "Combinatorial explosion of subclasses"] },
              good: { title: "Composition", items: ["Assemble from small collaborators", "Swap a part without touching the rest", "Change behavior at runtime (inject a strategy)", "Each part independently testable", "Mix capabilities freely"] }
            },
            { t: "code", lang: "python", code:
              "# Inheritance: rigid -- a FlyingRobot 'is-a' Robot, locked at class time\nclass Robot:        pass\nclass FlyingRobot(Robot):     # what about a SwimmingFlyingRobot?\n    def move(self): return \"fly\"\n\n# Composition: flexible -- behaviors are pluggable parts\nclass Robot:\n    def __init__(self, mover):\n        self.mover = mover            # has-a movement behavior\n    def move(self):\n        return self.mover.move()\n\nclass Fly:  \n    def move(self): return \"fly\"\nclass Walk: \n    def move(self): return \"walk\"\n\nr = Robot(Fly())\nr.mover = Walk()                      # change behavior at runtime!"
            },
            { t: "note", variant: "key", html: "The guideline 'favor composition over inheritance' doesn't ban inheritance — use it for genuine <em>is-a</em> relationships with stable bases. But reach for composition first; it's the basis of the Strategy, Decorator, and Bridge patterns you'll meet soon." }
          ]
        }
      ]
    },

    /* ============================ SOLID ============================ */
    {
      id: "solid",
      name: "SOLID Principles",
      icon: "diamond",
      lessons: [
        {
          id: "srp",
          title: "S · Single Responsibility",
          summary: "A class should have one reason to change. Split mixed concerns before they tangle.",
          minutes: 6,
          tags: ["solid"],
          blocks: [
            { t: "p", html: "<strong>Single Responsibility Principle (SRP):</strong> a class should have one job — one reason to change. When a class mixes concerns (business logic + persistence + formatting), a change to any one of them risks breaking the others, and the class becomes a magnet for edits." },
            { t: "compare",
              bad: { title: "Violation: a 'god' class", items: ["Report computes data AND formats AND emails it", "Change the email library → touch Report", "Change the number format → touch Report", "Hard to test the calculation alone"] },
              good: { title: "Each class, one reason to change", items: ["ReportCalculator → the numbers", "ReportFormatter → the presentation", "ReportMailer → delivery", "Test, change, reuse each in isolation"] }
            },
            { t: "code", lang: "python", code:
              "# BEFORE: one class, three reasons to change\nclass Report:\n    def calculate(self): ...\n    def format_html(self): ...\n    def send_email(self): ...\n\n# AFTER: separated responsibilities\nclass ReportCalculator: \n    def calculate(self): ...\nclass ReportFormatter:  \n    def format(self, data): ...\nclass ReportMailer:     \n    def send(self, html): ...\n\n# They collaborate, but each evolves independently."
            },
            { t: "note", variant: "trap", html: "SRP isn't 'one method per class'. It's about <em>cohesion of reasons to change</em>. Ask: 'who would request a change to this class?' If the answer is two different stakeholders (the accountant AND the designer), it's doing two jobs." }
          ]
        },
        {
          id: "ocp",
          title: "O · Open/Closed",
          summary: "Open for extension, closed for modification. Add behavior with new code, not edits to tested code.",
          minutes: 6,
          tags: ["solid"],
          blocks: [
            { t: "p", html: "<strong>Open/Closed Principle (OCP):</strong> software should be open to <em>extension</em> but closed to <em>modification</em>. You should be able to add new behavior by writing new code — not by editing existing, working, tested code (and risking regressions)." },
            { t: "p", html: "The tell-tale smell is a growing <code class='tok'>if/elif</code> or <code class='tok'>switch</code> on a type. Every new case means editing the same function again." },
            { t: "code", lang: "python", code:
              "# BEFORE: every new shape edits this function (closed to extension)\ndef area(shape):\n    if shape.type == \"circle\":  return 3.14159 * shape.r ** 2\n    elif shape.type == \"square\": return shape.s ** 2\n    # add triangle? edit here again...\n\n# AFTER: open for extension via polymorphism\nclass Shape:        \n    def area(self): ...\nclass Circle(Shape):  \n    def area(self): return 3.14159 * self.r ** 2\nclass Square(Shape):  \n    def area(self): return self.s ** 2\nclass Triangle(Shape):       # NEW: just add a class, edit nothing\n    def area(self): return 0.5 * self.b * self.h"
            },
            { t: "note", variant: "key", html: "OCP is usually achieved with <strong>polymorphism</strong> (interfaces/strategies) or <strong>plugins</strong>. The Strategy, Factory, and Decorator patterns are all machinery for honoring OCP. When you find yourself editing a switch statement for the third time, extract an interface." }
          ]
        },
        {
          id: "lsp",
          title: "L · Liskov Substitution",
          summary: "Subtypes must be usable anywhere their base type is expected — without surprises.",
          minutes: 6,
          tags: ["solid"],
          blocks: [
            { t: "p", html: "<strong>Liskov Substitution Principle (LSP):</strong> if S is a subtype of T, you must be able to use an S wherever a T is expected, and the program stays correct. A subclass must honor the <em>contract</em> of its parent — not weaken guarantees or throw where the parent wouldn't." },
            { t: "code", lang: "python", code:
              "# VIOLATION: a square 'is-a' rectangle in math, not in behavior\nclass Rectangle:\n    def set_width(self, w):  self.w = w\n    def set_height(self, h): self.h = h\n    def area(self):          return self.w * self.h\n\nclass Square(Rectangle):\n    def set_width(self, w):  self.w = self.h = w   # surprise!\n    def set_height(self, h): self.w = self.h = h   # surprise!\n\ndef stretch(rect):\n    rect.set_width(5); rect.set_height(4)\n    assert rect.area() == 20      # holds for Rectangle, FAILS for Square"
            },
            { t: "note", variant: "trap", html: "The famous <strong>Penguin extends Bird.fly()</strong> trap: if a subclass must throw 'not supported' for an inherited method, the hierarchy is wrong. The base abstraction over-promised. Fix it by reshaping the hierarchy (e.g., separate <code class='tok'>FlyingBird</code>) — which leads straight into the next principle." },
            { t: "note", variant: "key", html: "Practical LSP checklist for a subclass: don't strengthen preconditions, don't weaken postconditions, don't throw new exception types, and preserve invariants. If you can't, prefer composition over inheritance here." }
          ]
        },
        {
          id: "isp",
          title: "I · Interface Segregation",
          summary: "Many small, focused interfaces beat one fat one. Don't force clients to depend on methods they don't use.",
          minutes: 5,
          tags: ["solid"],
          blocks: [
            { t: "p", html: "<strong>Interface Segregation Principle (ISP):</strong> no client should be forced to depend on methods it doesn't use. A 'fat' interface forces implementers to provide stubs for irrelevant methods, coupling them to changes they don't care about." },
            { t: "code", lang: "java", code:
              "// BEFORE: a fat interface forces empty/throwing stubs\ninterface Worker {\n    void work();\n    void eat();          // a RobotWorker doesn't eat!\n}\n\n// AFTER: segregated, focused interfaces\ninterface Workable { void work(); }\ninterface Eatable  { void eat(); }\n\nclass Human implements Workable, Eatable { /* both */ }\nclass Robot implements Workable { /* just work() */ }"
            },
            { t: "note", variant: "key", html: "ISP is SRP applied to interfaces. Small role-based interfaces (<code class='tok'>Readable</code>, <code class='tok'>Closeable</code>) keep implementers free of dead methods and make mocking in tests painless. When an interface grows a 'this doesn't apply to me' method, split it." }
          ]
        },
        {
          id: "dip",
          title: "D · Dependency Inversion",
          summary: "Depend on abstractions, not concretions. The principle that makes code testable and swappable.",
          minutes: 7,
          tags: ["solid"],
          blocks: [
            { t: "p", html: "<strong>Dependency Inversion Principle (DIP):</strong> high-level modules shouldn't depend on low-level modules — both should depend on <em>abstractions</em>. And abstractions shouldn't depend on details; details depend on abstractions. In practice: depend on an interface, and <em>inject</em> the concrete implementation from outside." },
            { t: "code", lang: "python", code:
              "# BEFORE: high-level OrderService nailed to a concrete Stripe class\nclass StripeGateway:\n    def charge(self, amt): ...\nclass OrderService:\n    def __init__(self):\n        self.gateway = StripeGateway()    # hard dependency\n\n# AFTER: depend on an abstraction; inject the concrete one\nclass PaymentGateway:                     # abstraction\n    def charge(self, amt): ...\nclass StripeGateway(PaymentGateway):  \n    def charge(self, amt): ...\nclass PaypalGateway(PaymentGateway):  \n    def charge(self, amt): ...\n\nclass OrderService:\n    def __init__(self, gateway: PaymentGateway):\n        self.gateway = gateway            # injected; swappable\n\nOrderService(StripeGateway())             # prod\nOrderService(FakeGateway())               # tests -- no real charges!"
            },
            { t: "note", variant: "key", html: "DIP is what makes code <strong>testable</strong> (inject a fake), <strong>swappable</strong> (Stripe → PayPal without touching OrderService), and <strong>decoupled</strong>. It's the backbone of Dependency Injection frameworks and clean architecture's 'dependencies point inward toward abstractions'." },
            { t: "note", variant: "tip", html: "Mnemonic for the five: <strong>S</strong>ingle responsibility · <strong>O</strong>pen/closed · <strong>L</strong>iskov · <strong>I</strong>nterface segregation · <strong>D</strong>ependency inversion. Together they push you toward small, focused units that depend on abstractions — exactly the soil design patterns grow in." },
            { t: "quiz", id: "lld-solid" }
          ]
        }
      ]
    },

    /* ============================ CLEAN CODE ============================ */
    {
      id: "principles",
      name: "Clean-Code Heuristics",
      icon: "broom",
      lessons: [
        {
          id: "clean-code",
          title: "DRY, KISS, YAGNI & Demeter",
          summary: "The everyday heuristics that keep code honest, between the big principles and the patterns.",
          minutes: 7,
          tags: ["principles", "clean-code"],
          blocks: [
            { t: "h", text: "DRY — Don't Repeat Yourself" },
            { t: "p", html: "Every piece of knowledge should have a <em>single, authoritative</em> representation. Duplicated logic means bugs fixed in one copy and not the others. Extract the shared thing into one function/class/constant." },
            { t: "note", variant: "trap", html: "Beware over-DRYing. Two pieces of code that <em>look</em> alike but change for <em>different reasons</em> are not true duplication — merging them creates coupling. DRY is about duplicated <em>knowledge</em>, not duplicated <em>characters</em>." },
            { t: "h", text: "KISS — Keep It Simple" },
            { t: "p", html: "Prefer the simplest design that works. Clever, dense, or over-abstracted code is a liability — it's read and maintained far more than it's written. Simplicity is a feature." },
            { t: "h", text: "YAGNI — You Aren't Gonna Need It" },
            { t: "p", html: "Don't build for hypothetical futures. Speculative generality ('we might need plugins someday') adds complexity that usually never pays off — and gets in the way when the <em>real</em> requirement arrives looking different than you guessed." },
            { t: "note", variant: "tip", html: "DRY, KISS, and YAGNI are in healthy tension. DRY pushes toward abstraction; KISS and YAGNI pull back from premature abstraction. The art is abstracting at the <em>third</em> repetition, when the real shape is clear — not the first." },
            { t: "h", text: "Law of Demeter — don't talk to strangers" },
            { t: "p", html: "A method should only call methods on: itself, its parameters, objects it creates, and its own direct fields. Long reach-through chains couple you to a deep object graph." },
            { t: "code", lang: "js", code:
              "// VIOLATION: reaching through a chain of strangers\nconst zip = order.getCustomer().getAddress().getZip();\n//          ^ now coupled to Customer AND Address internals\n\n// BETTER: ask, don't navigate (tell-don't-ask)\nconst zip = order.getShippingZip();   // order knows how to get it"
            },
            { t: "note", variant: "key", html: "These heuristics, plus SOLID, are your day-to-day compass. Patterns (next module) are the named, reusable solutions you reach for when these principles point at a recurring structural problem." }
          ]
        },
        {
          id: "uml",
          title: "Reading UML relationships",
          summary: "The handful of class-diagram arrows you actually need to communicate a design.",
          minutes: 6,
          tags: ["principles", "uml"],
          blocks: [
            { t: "p", html: "<strong>UML class diagrams</strong> are the lingua franca of LLD discussions. You don't need the whole spec — just the relationship arrows and what they imply about coupling and lifetime." },
            {
              t: "table",
              headers: ["Relationship", "Meaning", "Lifetime", "Notation"],
              rows: [
                ["Association", "uses / knows-a", "Independent", "plain line →"],
                ["Aggregation", "has-a (shared)", "Part outlives whole", "hollow diamond ◇—"],
                ["Composition", "owns-a (exclusive)", "Part dies with whole", "filled diamond ◆—"],
                ["Inheritance", "is-a", "—", "hollow triangle △—"],
                ["Realization", "implements interface", "—", "dashed + triangle ◁┄"],
                ["Dependency", "temporarily uses", "Transient", "dashed arrow ┄►"]
              ]
            },
            { t: "code", lang: "text", code:
              "  University ◆──── Department      composition (dept dies with uni)\n" +
              "  Department ◇──── Professor       aggregation (prof can outlive dept)\n" +
              "  Professor  ────► Course          association (teaches)\n" +
              "  Manager   ──△──  Employee        inheritance (is-a)\n" +
              "  Logger    ◁┄┄─  ILogger          realization (implements)\n" +
              "  OrderSvc  ┄┄►   PaymentGateway   dependency (uses)"
            },
            { t: "note", variant: "tip", html: "The practical distinction people quiz on: <strong>aggregation vs composition</strong>. Composition = exclusive ownership and shared lifetime (a House <em>owns</em> its Rooms — destroy the house, the rooms go too). Aggregation = a looser 'has-a' where the part can exist on its own (a Team <em>has</em> Players who exist without the team)." }
          ]
        },
        {
          id: "concurrency",
          title: "Concurrency & thread safety",
          summary: "Race conditions, locks, deadlock, and the thread-safe singleton — the low-level concurrency every LLD interview eventually probes.",
          minutes: 9,
          tags: ["principles", "concurrency", "threads"],
          blocks: [
            { t: "p", html: "The moment two threads touch the same data, <em>correctness</em> stops being about logic and starts being about <em>timing</em>. A <strong>race condition</strong> is a bug whose outcome depends on the unpredictable interleaving of threads — the classic being a <code class='tok'>read-modify-write</code> that isn't atomic." },
            { t: "code", lang: "python", code:
              "# NOT thread-safe: count += 1 is really 3 steps\n" +
              "#   read count -> add 1 -> write count\n" +
              "# Two threads can both read the same value and one update is lost.\n" +
              "count = 0\n" +
              "def increment():\n" +
              "    global count\n" +
              "    count += 1          # race! lost updates under contention\n\n" +
              "# Thread-safe: serialize the critical section with a lock\n" +
              "import threading\n" +
              "lock = threading.Lock()\n" +
              "def increment_safe():\n" +
              "    global count\n" +
              "    with lock:          # only one thread in here at a time\n" +
              "        count += 1"
            },
            { t: "h", text: "The tools" },
            {
              t: "ul", items: [
                "<strong>Mutex / lock</strong> — only one thread holds it; others wait. Guards a <em>critical section</em>.",
                "<strong>Read-write lock</strong> — many readers <em>or</em> one writer; great for read-heavy data.",
                "<strong>Semaphore</strong> — allows up to N concurrent holders (e.g. a connection pool of size 10).",
                "<strong>Atomic variables</strong> — lock-free single-operation updates (compare-and-swap) for counters/flags.",
                "<strong>Immutable objects</strong> — if state never changes, it's automatically thread-safe; the simplest answer."
              ]
            },
            { t: "h", text: "Deadlock — and how to avoid it" },
            { t: "p", html: "A <strong>deadlock</strong> is two threads each holding a lock the other needs, so both wait forever. It needs four conditions to occur (mutual exclusion, hold-and-wait, no preemption, circular wait); break any one and you're safe." },
            { t: "note", variant: "key", html: "The most practical fix is <strong>lock ordering</strong>: if every thread always acquires locks in the same global order, a circular wait is impossible. Also keep critical sections small, and prefer <code class='tok'>tryLock</code> with a timeout over blocking forever." },
            { t: "h", text: "The thread-safe singleton (a favourite)" },
            { t: "code", lang: "java", code:
              "// Double-checked locking: lock only on first creation\n" +
              "class Config {\n" +
              "    private static volatile Config instance;   // volatile is essential\n" +
              "    private Config() {}\n" +
              "    static Config get() {\n" +
              "        if (instance == null) {                // 1st check (no lock)\n" +
              "            synchronized (Config.class) {\n" +
              "                if (instance == null) {        // 2nd check (locked)\n" +
              "                    instance = new Config();\n" +
              "                }\n" +
              "            }\n" +
              "        }\n" +
              "        return instance;\n" +
              "    }\n" +
              "}"
            },
            { t: "note", variant: "trap", html: "The <code class='tok'>volatile</code> keyword is not optional here — without it, another thread can see a <em>partially-constructed</em> object due to instruction reordering. (In practice, prefer an eager <code class='tok'>static final</code> field or an enum singleton, which the language makes thread-safe for free.)" },
            { t: "note", variant: "tip", html: "When an interviewer asks you to design a queue, cache, or pool, expect the follow-up: <em>'now make it thread-safe.'</em> Naming the shared mutable state, the critical section, and your locking strategy — and noting the deadlock risk — is exactly what they're listening for." },
            { t: "quiz", id: "lld-principles" }
          ]
        }
      ]
    },

    /* ============================ PATTERNS ============================ */
    {
      id: "patterns",
      name: "Design Patterns",
      icon: "grid",
      lessons: [
        {
          id: "patterns-overview",
          title: "The pattern catalog",
          summary: "What design patterns are, the three Gang-of-Four families, and how to use them without over-engineering.",
          minutes: 6,
          tags: ["patterns", "overview"],
          blocks: [
            { t: "p", html: "A <strong>design pattern</strong> is a named, reusable solution to a recurring design problem — a template, not a finished piece of code. The classic catalog comes from the 'Gang of Four' (GoF) and splits into three families by <em>what the pattern is about</em>." },
            {
              t: "table",
              headers: ["Family", "About", "Patterns"],
              rows: [
                ["Creational", "How objects get created", "Singleton · Factory Method · Abstract Factory · Builder · Prototype"],
                ["Structural", "How objects are composed", "Adapter · Decorator · Facade · Composite · Proxy · Bridge · Flyweight"],
                ["Behavioral", "How objects interact & share responsibility", "Strategy · Observer · Command · State · Template Method · Iterator · Chain of Responsibility · Mediator · Visitor · Memento"]
              ]
            },
            { t: "note", variant: "key", html: "Patterns are a <strong>vocabulary</strong> first. Saying 'let's use a Strategy here' communicates an entire design in two words. They're proven, they encode SOLID, and they make intent legible to the next engineer." },
            { t: "note", variant: "trap", html: "<strong>Don't pattern-match for its own sake.</strong> Forcing patterns onto simple problems is a classic over-engineering smell (YAGNI!). Reach for a pattern when you feel the <em>specific pain</em> it solves — not to decorate a résumé. The next three lessons teach the headline patterns of each family by the problem they cure." }
          ]
        },
        {
          id: "creational",
          title: "Creational patterns",
          summary: "Singleton, Factory, Abstract Factory, Builder, Prototype — controlling how and when objects are born.",
          minutes: 9,
          tags: ["patterns", "creational"],
          blocks: [
            { t: "p", html: "Creational patterns decouple <em>how</em> objects are created from the code that uses them, so creation logic can change without rippling everywhere." },
            { t: "h", text: "Singleton — exactly one instance" },
            { t: "p", html: "Guarantees a class has a single shared instance with a global access point. Use for genuinely shared resources (config, a connection pool, a logger)." },
            { t: "code", lang: "python", code:
              "class Config:\n" +
              "    _instance = None\n" +
              "    def __new__(cls):\n" +
              "        if cls._instance is None:\n" +
              "            cls._instance = super().__new__(cls)\n" +
              "        return cls._instance\n\n" +
              "Config() is Config()   # True -- same object"
            },
            { t: "note", variant: "trap", html: "Singleton is the most over-used (and abused) pattern. It's global state in disguise — it hurts testability and can cause concurrency bugs if not made thread-safe. Prefer dependency injection of a single shared instance over a hard Singleton when you can." },
            { t: "h", text: "Factory Method — defer which class to instantiate" },
            { t: "p", html: "A method decides which concrete class to create based on input, so callers don't hard-code constructors (honoring OCP and DIP)." },
            { t: "code", lang: "python", code:
              "class Dog:  \n    def speak(self): return \"woof\"\nclass Cat:  \n    def speak(self): return \"meow\"\n\ndef animal_factory(kind):       # one place that knows the concretes\n    return {\"dog\": Dog, \"cat\": Cat}[kind]()\n\nanimal_factory(\"dog\").speak()   # caller never wrote Dog()"
            },
            { t: "h", text: "Abstract Factory — families of related objects" },
            { t: "p", html: "A factory of factories: create whole families of compatible objects (e.g., a <code class='tok'>WinButton</code> + <code class='tok'>WinCheckbox</code> vs <code class='tok'>MacButton</code> + <code class='tok'>MacCheckbox</code>) without naming concretes. Pick the family once; the rest stays consistent." },
            { t: "h", text: "Builder — assemble complex objects step by step" },
            { t: "p", html: "Construct an object through a fluent, readable sequence of steps instead of a monstrous constructor with ten optional parameters (the 'telescoping constructor' problem)." },
            { t: "code", lang: "js", code:
              "const burger = new BurgerBuilder()\n" +
              "  .bun(\"sesame\")\n" +
              "  .patty(\"beef\")\n" +
              "  .addCheese()\n" +
              "  .addBacon()\n" +
              "  .build();            // readable; only set what you need"
            },
            { t: "h", text: "Prototype — clone an existing object" },
            { t: "p", html: "Create new objects by copying a prototype rather than building from scratch — handy when construction is expensive or you want a pre-configured starting point. Beware deep vs shallow copies of nested state." },
            { t: "note", variant: "key", html: "Quick chooser: one shared instance → <strong>Singleton</strong>. Pick one class from input → <strong>Factory Method</strong>. Consistent <em>families</em> → <strong>Abstract Factory</strong>. Many optional params / step-by-step → <strong>Builder</strong>. Expensive-to-build copies → <strong>Prototype</strong>." }
          ]
        },
        {
          id: "structural",
          title: "Structural patterns",
          summary: "Adapter, Decorator, Facade, Composite, Proxy — composing objects into bigger, flexible structures.",
          minutes: 9,
          tags: ["patterns", "structural"],
          blocks: [
            { t: "p", html: "Structural patterns are about <em>composition</em> — assembling objects and classes into larger structures while keeping them flexible and efficient." },
            { t: "h", text: "Adapter — make incompatible interfaces work together" },
            { t: "p", html: "Wrap an existing class so its interface matches what your code expects — like a travel power-plug adapter. Perfect for integrating third-party or legacy code without changing either side." },
            { t: "code", lang: "js", code:
              "// Your code expects .area(); the library gives .computeArea()\nclass LegacyRect { computeArea() { return 42; } }\n\nclass RectAdapter {\n  constructor(legacy) { this.legacy = legacy; }\n  area() { return this.legacy.computeArea(); }   // translate\n}\nshapes.push(new RectAdapter(new LegacyRect()));   // now it fits"
            },
            { t: "h", text: "Decorator — add behavior without subclassing" },
            { t: "p", html: "Wrap an object in another object of the same interface to add responsibilities dynamically. Stack decorators to combine features — the alternative to a subclass explosion (<code class='tok'>CoffeeWithMilkAndSugarAndFoam</code>)." },
            { t: "code", lang: "python", code:
              "class Coffee:\n    def cost(self): return 2.0\n\nclass MilkDecorator:\n    def __init__(self, c): self.c = c\n    def cost(self): return self.c.cost() + 0.5\n\nclass SugarDecorator:\n    def __init__(self, c): self.c = c\n    def cost(self): return self.c.cost() + 0.25\n\norder = SugarDecorator(MilkDecorator(Coffee()))\norder.cost()    # 2.75 -- features stacked at runtime"
            },
            { t: "note", variant: "trap", html: "<strong>Adapter vs Decorator</strong> — both wrap an object. Adapter <em>changes</em> the interface (to make things fit); Decorator <em>keeps</em> the interface and <em>adds</em> behavior. Same mechanism, opposite intent." },
            { t: "h", text: "Facade — one simple door to a complex subsystem" },
            { t: "p", html: "Provide a single, high-level interface that hides a messy set of subsystems. <code class='tok'>compiler.compile(src)</code> hides the lexer, parser, optimizer, and code generator behind one call. Reduces coupling between clients and internals." },
            { t: "h", text: "Composite — treat individuals and groups uniformly" },
            { t: "p", html: "Compose objects into tree structures and let clients treat a single object and a composition of objects the same way. A <code class='tok'>File</code> and a <code class='tok'>Folder</code> (of files and folders) both answer <code class='tok'>size()</code> — recursion does the rest." },
            { t: "h", text: "Proxy — a stand-in that controls access" },
            { t: "p", html: "A placeholder with the same interface as the real object, controlling access to it. Flavors: <strong>virtual</strong> (lazy-load an expensive object), <strong>protection</strong> (auth checks), <strong>remote</strong> (a local stand-in for a remote service), and <strong>caching</strong> proxies." },
            { t: "note", variant: "key", html: "Quick chooser: incompatible interface → <strong>Adapter</strong>. Add features by wrapping → <strong>Decorator</strong>. Simplify a subsystem → <strong>Facade</strong>. Tree of part-whole → <strong>Composite</strong>. Control access / lazy / remote → <strong>Proxy</strong>. (Bridge splits an abstraction from its implementation; Flyweight shares heavy common state across many objects.)" }
          ]
        },
        {
          id: "behavioral",
          title: "Behavioral patterns",
          summary: "Strategy, Observer, Command, State, Template Method — how objects communicate and divide responsibility.",
          minutes: 10,
          tags: ["patterns", "behavioral"],
          blocks: [
            { t: "p", html: "Behavioral patterns are about <em>interaction</em> — how objects collaborate, who's responsible for what, and how behavior varies without rigid conditionals." },
            { t: "h", text: "Strategy — interchangeable algorithms" },
            { t: "p", html: "Encapsulate a family of algorithms behind a common interface and pick one at runtime. The poster child for OCP and composition." },
            { t: "code", lang: "python", code:
              "class PayByCard:   \n    def pay(self, amt): return f\"card: {amt}\"\nclass PayByPaypal: \n    def pay(self, amt): return f\"paypal: {amt}\"\n\nclass Checkout:\n    def __init__(self, strategy): self.strategy = strategy\n    def total(self, amt):        return self.strategy.pay(amt)\n\nCheckout(PayByPaypal()).total(99)   # swap strategy freely"
            },
            { t: "h", text: "Observer — publish / subscribe" },
            { t: "p", html: "Define a one-to-many dependency: when the <em>subject</em> changes state, all registered <em>observers</em> are notified automatically. The backbone of event systems, UI data-binding, and reactive programming." },
            { t: "code", lang: "js", code:
              "class Subject {\n" +
              "  constructor() { this.observers = []; }\n" +
              "  subscribe(o) { this.observers.push(o); }\n" +
              "  notify(data) { this.observers.forEach(o => o.update(data)); }\n" +
              "}\n" +
              "const news = new Subject();\n" +
              "news.subscribe({ update: d => console.log(\"email:\", d) });\n" +
              "news.subscribe({ update: d => console.log(\"sms:\", d) });\n" +
              "news.notify(\"breaking!\");   // both observers fire"
            },
            { t: "note", variant: "key", html: "Strategy and Observer are the two most common behavioral patterns in real code. If you see 'choose behavior at runtime' → Strategy. If you see 'when X happens, tell everyone interested' → Observer." },
            { t: "h", text: "Command — turn a request into an object" },
            { t: "p", html: "Wrap a request (action + its arguments) as an object. This enables queuing, logging, and — crucially — <strong>undo/redo</strong>, since each command can implement <code class='tok'>execute()</code> and <code class='tok'>undo()</code>. Used in task queues, transactional menus, and editors." },
            { t: "h", text: "State — behavior that changes with internal state" },
            { t: "p", html: "Let an object alter its behavior when its internal state changes, so it appears to change class. Replaces sprawling state <code class='tok'>if/else</code> with a class per state (e.g., a document that's <code class='tok'>Draft</code> → <code class='tok'>Moderation</code> → <code class='tok'>Published</code>, each handling actions differently)." },
            { t: "h", text: "Template Method — fix the skeleton, vary the steps" },
            { t: "p", html: "Define the skeleton of an algorithm in a base method, deferring specific steps to subclasses. The overall sequence is fixed; the details are pluggable (e.g., a data-export pipeline whose <code class='tok'>format()</code> step differs for CSV vs JSON)." },
            { t: "note", variant: "trap", html: "<strong>Strategy vs Template Method</strong> both vary parts of an algorithm. Strategy uses <em>composition</em> (inject a whole algorithm object) and swaps at runtime; Template Method uses <em>inheritance</em> (override steps) and is fixed at class time. Prefer Strategy for flexibility." },
            { t: "p", html: "Other behavioral patterns worth knowing by name: <strong>Iterator</strong> (traverse a collection without exposing its internals), <strong>Chain of Responsibility</strong> (pass a request along handlers until one handles it — middleware!), <strong>Mediator</strong> (centralize complex many-to-many communication), <strong>Memento</strong> (capture & restore state — undo), and <strong>Visitor</strong> (add operations to a type hierarchy without modifying it)." },
            { t: "quiz", id: "lld-patterns" }
          ]
        }
      ]
    },

    /* ============================ PRACTICE ============================ */
    {
      id: "practice",
      name: "Applied LLD",
      icon: "wrench",
      lessons: [
        {
          id: "lld-process",
          title: "How to approach an LLD problem",
          summary: "A repeatable method for turning 'design a parking lot' into clean classes — in an interview or a PR.",
          minutes: 6,
          tags: ["practice", "process"],
          blocks: [
            { t: "p", html: "LLD interviews ('design a parking lot / elevator / vending machine / chess') reward a calm, structured method. Same steps work for a real feature design doc." },
            {
              t: "ol", items: [
                "<strong>Clarify requirements & scope.</strong> Functional features and constraints. List what's in and out.",
                "<strong>Find the nouns → candidate classes.</strong> 'Parking lot, level, spot, vehicle, ticket' — nouns become entities; verbs become methods.",
                "<strong>Define responsibilities & relationships.</strong> Who owns whom (composition/aggregation)? Keep cohesion high.",
                "<strong>Identify behavior that varies → reach for a pattern.</strong> Pricing strategies? Strategy. Spot allocation? Strategy/Factory. State transitions? State.",
                "<strong>Apply SOLID.</strong> One responsibility per class; depend on interfaces; open for extension.",
                "<strong>Sketch the API / key methods</strong> and walk a scenario end-to-end (park → pay → exit).",
                "<strong>Discuss edge cases & extensibility.</strong> Concurrency (two cars, one spot), new vehicle types, new pricing."
              ]
            },
            { t: "note", variant: "tip", html: "Narrate trade-offs as you go, exactly like HLD. 'I'll use a Strategy for pricing so we can add weekend rates without touching the parking logic (OCP).' That sentence shows you design for <em>change</em>, which is the whole game." }
          ]
        },
        {
          id: "case-parking-lot",
          title: "Worked example: parking lot",
          summary: "The canonical LLD problem, designed end-to-end with the right patterns in the right places.",
          minutes: 9,
          tags: ["practice", "case-study"],
          blocks: [
            { t: "p", html: "Design a multi-level parking lot that supports different vehicle sizes, finds and assigns spots, issues tickets, and charges on exit. Let's apply the method." },
            { t: "h", text: "1 · Requirements" },
            {
              t: "ul", items: [
                "Multiple levels; each level has spots of types: motorcycle, compact, large.",
                "A vehicle is assigned a fitting available spot on entry; a ticket is issued.",
                "On exit, fee is computed (by duration & vehicle/spot type) and the spot is freed.",
                "Extensible: new vehicle types, new pricing rules, EV charging spots later."
              ]
            },
            { t: "h", text: "2 · Nouns → classes" },
            { t: "code", lang: "text", code:
              "ParkingLot ◆── Level ◆── ParkingSpot\n" +
              "Vehicle  (Motorcycle | Car | Truck)        -- inheritance / size\n" +
              "Ticket   (vehicle, spot, entryTime)\n" +
              "ParkingStrategy   -- how to choose a spot (interface)\n" +
              "PricingStrategy   -- how to compute the fee (interface)\n" +
              "ParkingLotService -- orchestrates park() / unpark()"
            },
            { t: "h", text: "3 · Where patterns earn their place" },
            {
              t: "ul", items: [
                "<strong>Strategy</strong> for <code class='tok'>PricingStrategy</code> (flat, hourly, weekend) and <code class='tok'>SpotAssignmentStrategy</code> (nearest, by level) — add rules without editing core logic (OCP).",
                "<strong>Factory</strong> to create the right <code class='tok'>Vehicle</code> / <code class='tok'>Spot</code> from input.",
                "<strong>Singleton</strong> (carefully) or DI for the single <code class='tok'>ParkingLot</code> instance.",
                "<strong>State</strong> if a spot has a richer lifecycle (free → reserved → occupied → out-of-service)."
              ]
            },
            { t: "code", lang: "python", code:
              "class PricingStrategy:                 # OCP via Strategy\n    def price(self, ticket): ...\nclass HourlyPricing(PricingStrategy):\n    def price(self, ticket):\n        hours = ceil(duration(ticket) / 3600)\n        return hours * RATE[ticket.spot.type]\n\nclass ParkingLotService:\n    def __init__(self, lot, assigner, pricing):\n        self.lot = lot\n        self.assigner = assigner          # DIP: injected strategies\n        self.pricing = pricing\n\n    def park(self, vehicle):\n        spot = self.assigner.find(self.lot, vehicle)   # may raise if full\n        spot.occupy(vehicle)\n        return Ticket(vehicle, spot, now())\n\n    def unpark(self, ticket):\n        fee = self.pricing.price(ticket)\n        ticket.spot.free()\n        return fee"
            },
            { t: "note", variant: "key", html: "Notice how SOLID drove the shape: each class has one job (SRP), the service depends on <em>strategy interfaces</em> not concretes (DIP), and new pricing/assignment rules are new classes (OCP). That's the difference between a design that ages well and one that calcifies." },
            { t: "note", variant: "trap", html: "Don't forget <strong>concurrency</strong>: two cars must not be assigned the same spot. Mention locking the spot during assignment (or an atomic compare-and-set on spot status). Interviewers love that you remembered the race condition." }
          ]
        },
        {
          id: "case-lru",
          title: "Worked example: LRU cache (LLD)",
          summary: "Design the O(1) LRU cache — the problem that lives on the border of HLD and LLD.",
          minutes: 7,
          tags: ["practice", "data-structures"],
          blocks: [
            { t: "p", html: "You met LRU as an eviction policy in the HLD track. Here's its <em>low-level</em> design: build a cache with O(1) <code class='tok'>get</code> and <code class='tok'>put</code> that evicts the least-recently-used key when full. A perennial favorite because it forces the right data-structure choice." },
            { t: "h", text: "The key insight" },
            {
              t: "ul", items: [
                "Need O(1) lookup by key → a <strong>hash map</strong>.",
                "Need O(1) 'move to most-recent' and O(1) 'evict least-recent' → a <strong>doubly-linked list</strong> ordered by recency.",
                "Combine them: the map stores key → <em>node</em>; the list maintains recency order. That's the whole trick."
              ]
            },
            { t: "code", lang: "python", code:
              "class Node:\n    def __init__(self, k, v):\n        self.k, self.v = k, v\n        self.prev = self.next = None\n\nclass LRUCache:\n    def __init__(self, capacity):\n        self.cap = capacity\n        self.map = {}                      # key -> Node  (O(1) lookup)\n        self.head = Node(0, 0)             # sentinel: most-recent side\n        self.tail = Node(0, 0)             # sentinel: least-recent side\n        self.head.next = self.tail\n        self.tail.prev = self.head\n\n    def _remove(self, node):\n        node.prev.next = node.next\n        node.next.prev = node.prev\n\n    def _add_front(self, node):            # most-recently used\n        node.next = self.head.next\n        node.prev = self.head\n        self.head.next.prev = node\n        self.head.next = node\n\n    def get(self, key):\n        if key not in self.map:\n            return -1\n        node = self.map[key]\n        self._remove(node); self._add_front(node)   # promote\n        return node.v\n\n    def put(self, key, value):\n        if key in self.map:\n            self._remove(self.map[key])\n        node = Node(key, value)\n        self.map[key] = node\n        self._add_front(node)\n        if len(self.map) > self.cap:                 # evict LRU\n            lru = self.tail.prev\n            self._remove(lru)\n            del self.map[lru.k]"
            },
            { t: "note", variant: "key", html: "Both operations are O(1): the map gives instant access, and the doubly-linked list lets you splice a node out and re-insert at the front in constant time. Sentinel head/tail nodes remove edge-case branching. Replay the HLD <a class='inline' href='#/hld/caching/eviction'>eviction widget</a> with this structure in mind — that animation <em>is</em> this list reordering itself." },
            { t: "note", variant: "tip", html: "Many languages give you this for free: Python's <code class='tok'>OrderedDict</code> (with <code class='tok'>move_to_end</code>) or Java's <code class='tok'>LinkedHashMap</code> implement exactly this. But knowing how to build it from a hash map + linked list is the point of the exercise — and a frequent interview ask." }
          ]
        },
        {
          id: "case-vending-machine",
          title: "Worked example: vending machine",
          summary: "The interview classic for the State pattern — model coins, product selection, and dispensing as explicit states.",
          minutes: 8,
          tags: ["practice", "state-pattern", "oop"],
          blocks: [
            { t: "p", html: "A <strong>vending machine</strong> is the canonical problem for the <em>State</em> pattern. The machine behaves differently depending on where it is in the flow \u2014 inserting a coin means one thing when idle and another after a product is selected \u2014 so model each phase as a state object rather than a tangle of <code class='tok'>if</code> flags." },
            { t: "h", text: "Clarify the requirements" },
            {
              t: "ul", items: [
                "<strong>Functional</strong> \u2014 accept coins, select a product, dispense it with change, refund on cancel, restock inventory.",
                "<strong>States</strong> \u2014 Idle \u2192 Has-Money \u2192 Dispensing, plus a Sold-Out path.",
                "<strong>Edge cases</strong> \u2014 insufficient funds, out of stock, exact-change-only, cancel mid-transaction."
              ]
            },
            { t: "h", text: "The objects" },
            {
              t: "table",
              headers: ["Class", "Responsibility"],
              rows: [
                ["<code>VendingMachine</code>", "Holds current state, inventory, and the inserted balance; delegates actions to the state"],
                ["<code>State</code> (interface)", "<code>insertCoin()</code>, <code>selectProduct()</code>, <code>dispense()</code>, <code>cancel()</code>"],
                ["<code>IdleState / HasMoneyState / DispenseState</code>", "Concrete behaviours for each phase"],
                ["<code>Inventory</code>", "Product → (count, price); checks availability"],
                ["<code>Product</code>", "Name, price, code"]
              ]
            },
            { t: "code", lang: "python", code:
              "from abc import ABC, abstractmethod\n\n" +
              "class State(ABC):\n" +
              "    def __init__(self, machine): self.m = machine\n" +
              "    @abstractmethod\n" +
              "    def insert_coin(self, amount): ...\n" +
              "    @abstractmethod\n" +
              "    def select(self, code): ...\n\n" +
              "class IdleState(State):\n" +
              "    def insert_coin(self, amount):\n" +
              "        self.m.balance += amount\n" +
              "        self.m.state = self.m.has_money      # transition\n" +
              "    def select(self, code):\n" +
              "        print('Insert coins first')\n\n" +
              "class HasMoneyState(State):\n" +
              "    def insert_coin(self, amount):\n" +
              "        self.m.balance += amount             # stack more coins\n" +
              "    def select(self, code):\n" +
              "        price = self.m.inventory.price(code)\n" +
              "        if not self.m.inventory.available(code):\n" +
              "            print('Sold out'); return\n" +
              "        if self.m.balance < price:\n" +
              "            print('Insufficient funds'); return\n" +
              "        self.m.state = self.m.dispensing\n" +
              "        self.m.dispense(code, price)         # dispense + change\n\n" +
              "class VendingMachine:\n" +
              "    def __init__(self, inventory):\n" +
              "        self.inventory = inventory; self.balance = 0\n" +
              "        self.idle = IdleState(self)\n" +
              "        self.has_money = HasMoneyState(self)\n" +
              "        self.dispensing = DispenseState(self)\n" +
              "        self.state = self.idle\n" +
              "    def insert_coin(self, amount): self.state.insert_coin(amount)\n" +
              "    def select(self, code):        self.state.select(code)\n" +
              "    def dispense(self, code, price):\n" +
              "        self.inventory.take(code)\n" +
              "        change = self.balance - price\n" +
              "        self.balance = 0\n" +
              "        self.state = self.idle               # back to start\n" +
              "        print(f'Dispensed {code}, change {change}')"
            },
            { t: "note", variant: "key", html: "Each state owns its transitions, so adding a new phase (e.g. a 'maintenance' mode) means adding one class \u2014 not editing a giant switch. That's the <strong>Open/Closed Principle</strong> from the SOLID module, made concrete." },
            { t: "note", variant: "tip", html: "Making change is its own sub-problem: greedily returning the largest coins first is the classic approach, but it's a <em>coin-change</em> question underneath \u2014 mention that you'd guard for the 'exact change only' case when the till runs low on small denominations." }
          ]
        },
        {
          id: "case-elevator",
          title: "Worked example: elevator system",
          summary: "Model cars, requests and a dispatch strategy — the LLD problem that rewards a clean Strategy-pattern scheduler.",
          minutes: 9,
          tags: ["practice", "strategy-pattern", "oop"],
          blocks: [
            { t: "p", html: "An <strong>elevator system</strong> tests whether you can separate <em>mechanism</em> (a car that moves between floors) from <em>policy</em> (which car answers which request, and in what order). Keep them apart with a pluggable <strong>Strategy</strong> for scheduling and the design stays clean as the rules grow." },
            { t: "h", text: "Clarify the requirements" },
            {
              t: "ul", items: [
                "<strong>Two request types</strong> \u2014 <em>external</em> (a hall button: floor + up/down direction) and <em>internal</em> (a car button: a target floor).",
                "<strong>Multiple cars</strong> \u2014 a controller dispatches requests to the best car.",
                "<strong>A scheduling policy</strong> \u2014 e.g. the elevator <em>SCAN</em> ('look') algorithm: keep going in one direction serving stops, then reverse.",
                "<strong>Constraints</strong> \u2014 capacity, direction, and not reversing with passengers aboard."
              ]
            },
            { t: "h", text: "The objects" },
            {
              t: "table",
              headers: ["Class", "Responsibility"],
              rows: [
                ["<code>ElevatorSystem</code>", "Owns the cars and the dispatch strategy; entry point for requests"],
                ["<code>ElevatorCar</code>", "Current floor, direction, door state, and its sorted set of pending stops"],
                ["<code>Request</code>", "Source floor, optional target, direction"],
                ["<code>SchedulingStrategy</code> (interface)", "<code>selectCar(cars, request)</code> — the swappable policy"],
                ["<code>Direction / DoorState</code>", "Enums (UP, DOWN, IDLE / OPEN, CLOSED)"]
              ]
            },
            { t: "code", lang: "python", code:
              "from abc import ABC, abstractmethod\nfrom enum import Enum\n\n" +
              "class Direction(Enum): UP = 1; DOWN = -1; IDLE = 0\n\n" +
              "class SchedulingStrategy(ABC):\n" +
              "    @abstractmethod\n" +
              "    def select_car(self, cars, request): ...\n\n" +
              "class NearestCarStrategy(SchedulingStrategy):\n" +
              "    # pick the closest car already moving toward the request (or idle)\n" +
              "    def select_car(self, cars, request):\n" +
              "        def cost(car):\n" +
              "            same_way = car.direction in (Direction.IDLE, request.direction)\n" +
              "            dist = abs(car.floor - request.floor)\n" +
              "            return (0 if same_way else 1, dist)   # prefer same-direction, then nearest\n" +
              "        return min(cars, key=cost)\n\n" +
              "class ElevatorCar:\n" +
              "    def __init__(self, cid):\n" +
              "        self.id = cid; self.floor = 0\n" +
              "        self.direction = Direction.IDLE\n" +
              "        self.stops = set()                     # pending target floors\n" +
              "    def add_stop(self, floor):\n" +
              "        self.stops.add(floor)\n" +
              "    def step(self):                            # one tick of movement (SCAN)\n" +
              "        if not self.stops:\n" +
              "            self.direction = Direction.IDLE; return\n" +
              "        target = (min(s for s in self.stops if s >= self.floor)\n" +
              "                  if self.direction != Direction.DOWN and any(s >= self.floor for s in self.stops)\n" +
              "                  else max(self.stops))\n" +
              "        self.direction = Direction.UP if target > self.floor else Direction.DOWN\n" +
              "        self.floor += self.direction.value\n" +
              "        self.stops.discard(self.floor)         # arrived -> open doors\n\n" +
              "class ElevatorSystem:\n" +
              "    def __init__(self, cars, strategy):\n" +
              "        self.cars = cars; self.strategy = strategy\n" +
              "    def request(self, req):\n" +
              "        car = self.strategy.select_car(self.cars, req)\n" +
              "        car.add_stop(req.floor)\n" +
              "        if req.target is not None:\n" +
              "            car.add_stop(req.target)\n" +
              "        return car.id"
            },
            { t: "note", variant: "key", html: "The <strong>Strategy</strong> pattern is the heart of the design: dispatching is a policy that changes (nearest-car, least-busy, energy-saving at night), so it lives behind an interface. Swap the strategy without touching <code class='tok'>ElevatorCar</code> or <code class='tok'>ElevatorSystem</code> \u2014 Open/Closed again." },
            { t: "note", variant: "tip", html: "Mention concurrency: real requests arrive from many threads, so the car's pending-stops set needs a lock or a thread-safe queue. Interviewers love when you note that the data structures are touched concurrently and name how you'd guard them." },
            { t: "quiz", id: "lld-practice" }
          ]
        }
      ]
    }
  ]
};
