/* =====================================================================
   ANVIL · Modern Java
   window.TRACKS.java — modules: lang / fp / collections

   Self-contained: this file registers its own widgets, its own quizzes,
   and its own track data. Nothing else needs editing to load it.
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- DOM helpers (local so load order never matters) ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var kids = Array.prototype.slice.call(arguments, 2);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); }
  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" }, h("span", { class: "w-pill" }, pill), h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
  }
  function segment(pairs, initialIdx, onPick) {
    var seg = h("div", { class: "w-seg" });
    var btns = [];
    pairs.forEach(function (pair, idx) {
      var b = h("button", { type: "button", class: "w-seg-btn" + (idx === initialIdx ? " active" : "") }, pair[1]);
      b.addEventListener("click", function () {
        btns.forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        onPick(pair[0]);
      });
      btns.push(b);
      seg.appendChild(b);
    });
    return seg;
  }
  function btn(label, cls, onClick) {
    var b = h("button", { type: "button", class: "w-btn" + (cls ? " " + cls : "") }, label);
    b.addEventListener("click", onClick);
    return b;
  }
  function ro(label, value) { return h("span", { class: "ro" }, label + " ", h("b", {}, String(value))); }
  function J(lines) { return lines.join("\n"); }

  var Widgets = {};

  /* ==================================================================
     javaStreamLazy — step a stream pipeline element by element
  ================================================================== */
  var SRC = [3, 8, 12, 5, 20, 7, 15, 30];

  function streamTrace(limit) {
    var ev = [], taken = 0, pulled = 0, filters = 0, maps = 0;
    for (var i = 0; i < SRC.length && taken < limit; i++) {
      var x = SRC[i];
      pulled++; filters++;
      if (x > 6) {
        maps++; taken++;
        ev.push({ text: "pull " + x + " \u2192 filter(x > 6) pass \u2192 map \u2192 " + (x * 10) + " \u2192 limit " + taken + "/" + limit, ok: true });
      } else {
        ev.push({ text: "pull " + x + " \u2192 filter(x > 6) reject", ok: false });
      }
    }
    var passing = SRC.filter(function (v) { return v > 6; }).length;
    return { ev: ev, pulled: pulled, filters: filters, maps: maps, eager: { pulled: SRC.length, filters: SRC.length, maps: passing } };
  }

  Widgets.javaStreamLazy = function (mount) {
    shell(mount, "stepper", "Stream laziness, one element at a time",
      "Source [3, 8, 12, 5, 20, 7, 15, 30] through filter(x > 6), map(x * 10), limit(n). Step through to see that each element travels the whole pipeline before the next one is pulled, and that limit stops the source early.");
    var limit = 2, shown = 0, tr = streamTrace(limit);
    var log = h("div", { class: "w-stage", style: "font-family:var(--font-mono);font-size:0.82rem;line-height:1.7;min-height:120px" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      clear(log);
      if (!shown) log.appendChild(h("div", { style: "color:var(--text-faint)" }, "Nothing runs until a terminal operation (toList) pulls. Press Step."));
      for (var i = 0; i < shown; i++) {
        var e = tr.ev[i];
        log.appendChild(h("div", { style: "color:" + (e.ok ? "var(--lime-ink)" : "var(--text-dim)") }, (i + 1) + ". " + e.text));
      }
      if (shown === tr.ev.length) log.appendChild(h("div", { style: "color:var(--accent-ink);margin-top:6px" }, "limit reached \u2014 the remaining " + (SRC.length - tr.pulled) + " source element(s) are never read."));
      clear(readout);
      var p = 0, f = 0, m = 0;
      for (var j = 0; j < shown; j++) { p++; f++; if (tr.ev[j].ok) m++; }
      readout.appendChild(ro("pulled", p + " / " + SRC.length));
      readout.appendChild(ro("filter calls", f));
      readout.appendChild(ro("map calls", m));
      readout.appendChild(ro("eager loops would do", tr.eager.filters + " filters + " + tr.eager.maps + " maps"));
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      segment([[1, "limit(1)"], [2, "limit(2)"], [3, "limit(3)"], [6, "limit(6)"]], 1, function (v) { limit = v; tr = streamTrace(limit); shown = 0; paint(); }),
      btn("Step", "primary", function () { if (shown < tr.ev.length) shown++; paint(); }),
      btn("Run to end", "ghost", function () { shown = tr.ev.length; paint(); }),
      btn("Reset", "ghost", function () { shown = 0; paint(); })
    ));
    mount.appendChild(log);
    mount.appendChild(readout);
    paint();
  };

  /* ==================================================================
     javaHashMap — buckets, collisions, resize
     Uses Java's real String.hashCode and HashMap's hash spreading.
  ================================================================== */
  function javaHash(str) {
    var hsh = 0;
    for (var i = 0; i < str.length; i++) hsh = (Math.imul(31, hsh) + str.charCodeAt(i)) | 0;
    return hsh;
  }
  function spread(hc) { return (hc ^ (hc >>> 16)) | 0; }
  var KEYS = ["alice", "bob", "carol", "dave", "erin", "frank", "grace", "heidi", "ivan", "judy", "mallory", "niaj", "olivia", "peggy", "rupert", "sybil"];

  Widgets.javaHashMap = function (mount) {
    shell(mount, "simulator", "Inside a HashMap",
      "Put keys into a table that starts with 16 buckets. Each key's hashCode is spread (h ^ h >>> 16) and masked with (capacity - 1) to pick a bucket. Past 0.75 load the table doubles and every entry is rehashed. 'Aa' and 'BB' share a hashCode, so they always collide.");
    var cap = 16, entries = [], next = 0, last = null, resized = false;
    var grid = h("div", { class: "w-stage", style: "display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:6px" });
    var readout = h("div", { class: "w-readout" });
    function idx(k) { return spread(javaHash(k)) & (cap - 1); }
    function put(k) {
      if (entries.indexOf(k) !== -1) { last = { key: k, note: "already present \u2014 value replaced, size unchanged" }; return; }
      entries.push(k);
      resized = false;
      if (entries.length > cap * 0.75) { cap *= 2; resized = true; }
      last = { key: k, note: resized ? "threshold crossed \u2014 resized to " + cap + " and rehashed every entry" : "" };
    }
    function paint() {
      clear(grid);
      var buckets = [];
      for (var b = 0; b < cap; b++) buckets.push([]);
      entries.forEach(function (k) { buckets[idx(k)].push(k); });
      var longest = 0;
      buckets.forEach(function (list, i) {
        if (list.length > longest) longest = list.length;
        var hot = last && list.indexOf(last.key) !== -1;
        grid.appendChild(h("div", {
          style: "border:1px solid " + (list.length > 1 ? "var(--rose)" : "var(--line)") + ";border-radius:8px;padding:5px;min-height:46px;font-size:0.72rem;background:" + (hot ? "color-mix(in srgb, var(--accent) 16%, var(--surface-solid))" : "var(--surface-solid)")
        }, h("div", { style: "color:var(--text-faint);font-family:var(--font-mono)" }, "[" + i + "]"),
           h("div", { style: "color:var(--text);word-break:break-all" }, list.join(" \u2192 "))));
      });
      clear(readout);
      readout.appendChild(ro("size", entries.length));
      readout.appendChild(ro("capacity", cap));
      readout.appendChild(ro("load", (entries.length / cap).toFixed(2)));
      readout.appendChild(ro("resize at size >", Math.floor(cap * 0.75)));
      readout.appendChild(ro("longest chain", longest));
      if (last) {
        var hc = javaHash(last.key);
        readout.appendChild(h("span", { class: "ro", style: "flex-basis:100%" }, "last put \"" + last.key + "\": hashCode " + hc + ", bucket " + idx(last.key) + (last.note ? " \u2014 " + last.note : "")));
      }
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      btn("Put next key", "primary", function () { if (next < KEYS.length) { put(KEYS[next]); next++; } else { last = { key: KEYS[KEYS.length - 1], note: "out of sample keys \u2014 reset to start over" }; } paint(); }),
      btn("Put \"Aa\" and \"BB\"", "ghost", function () { put("Aa"); put("BB"); paint(); }),
      btn("Put 8 keys", "ghost", function () { for (var i = 0; i < 8 && next < KEYS.length; i++) { put(KEYS[next]); next++; } paint(); }),
      btn("Reset", "ghost", function () { cap = 16; entries = []; next = 0; last = null; paint(); })
    ));
    mount.appendChild(grid);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ==================================================================
     Quizzes
  ================================================================== */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "java-lang": {
      title: "Modern language features checkpoint",
      sub: "Records, sealed hierarchies and pattern matching.",
      questions: [
        {
          q: "A record declares a component List<String> tags. A caller passes a mutable ArrayList and later adds to it. What protects the record's state?",
          options: ["Nothing extra is needed: record fields are final, so the list cannot change", "A compact constructor that assigns tags = List.copyOf(tags)", "Declaring the record final", "Overriding equals and hashCode"],
          answer: 1,
          explain: "Record fields are final references, but finality is shallow: the list object itself can still be mutated by whoever holds it. Copying into an unmodifiable list in the compact constructor makes the record genuinely immutable and also rejects null elements."
        },
        {
          q: "You add a new permitted subtype to a sealed interface used in several switch expressions that have no default branch. What happens?",
          options: ["The switches silently fall through to the first case", "A MatchException is thrown the first time the new type arrives", "Every exhaustive switch over that interface fails to compile until it handles the new type", "Nothing, sealed types do not affect switch"],
          answer: 2,
          explain: "Because the compiler knows the full set of permitted subtypes, a switch without a default is checked for exhaustiveness. Adding a subtype turns every incomplete switch into a compile error, which is exactly the safety net you want when a domain grows a new case."
        },
        {
          q: "Which statement about a record compared with a hand-written class is correct?",
          options: ["Records can extend another class", "Records generate accessors, equals, hashCode and toString from their components", "Records cannot have static factory methods", "Records cannot implement interfaces"],
          answer: 1,
          explain: "A record derives its accessors, equality, hash code and string form from its components. Records implicitly extend java.lang.Record so they cannot extend anything else, but they can implement interfaces and declare static factories and extra methods."
        },
        {
          q: "In a switch over Object, where must case null appear if you want nulls handled instead of throwing?",
          options: ["It is not allowed in pattern switches", "As an explicit case null (optionally combined with default)", "Only inside a guard with when", "Nulls are always routed to default automatically"],
          answer: 1,
          explain: "Without an explicit case null, a switch throws NullPointerException for a null selector, even if it has a default. Adding case null (or case null, default) opts into handling it, which keeps the old fail-fast behavior as the default."
        },
        {
          q: "What does the guard in case Payment(var amount, var currency) when amount.signum() < 0 do?",
          options: ["It casts amount to a negative number", "It adds a boolean condition that must hold for the case to match, after deconstruction", "It is evaluated before the type test", "It makes the switch non-exhaustive by definition"],
          answer: 1,
          explain: "A record pattern first checks the type and binds the components, then the when guard is evaluated with those bindings. If the guard is false the switch tries the next case, so you can express refinements without nested if statements."
        }
      ]
    },
    "java-fp": {
      title: "Streams, Optional and generics checkpoint",
      sub: "Laziness, collectors, Optional discipline and wildcards.",
      questions: [
        {
          q: "list.stream().filter(p).map(f).limit(2).toList() runs on a list of one million elements where the first two elements pass the filter. Roughly how many elements does the filter see?",
          options: ["One million", "Two", "Five hundred thousand", "It depends on the number of CPU cores"],
          answer: 1,
          explain: "Streams are lazy and process elements one at a time through the whole pipeline. limit is short-circuiting, so once two elements have passed through map the source stops being read and the remaining elements are never touched."
        },
        {
          q: "Collectors.toMap(User::email, u -> u) throws IllegalStateException in production. What is the likely cause?",
          options: ["The stream was parallel", "Two users share the same email key and no merge function was supplied", "toMap cannot store records", "The map exceeded its load factor"],
          answer: 1,
          explain: "toMap without a merge function treats a duplicate key as an error. Either supply a merge function that states the policy explicitly, or use groupingBy when several values per key are expected."
        },
        {
          q: "Which use of Optional matches common best practice?",
          options: ["A field Optional<String> middleName on a JPA entity", "A method parameter Optional<Filter> filter", "A repository method returning Optional<Order> findById(id)", "A List<Optional<Order>> returned from a service"],
          answer: 2,
          explain: "Optional was designed as a return type that forces the caller to decide what absence means. As a field, parameter or collection element it adds allocation and ceremony without that benefit; overloads, nullable fields or empty collections are clearer there."
        },
        {
          q: "Why is orElseGet(() -> loadDefault()) preferred over orElse(loadDefault()) when loadDefault calls the database?",
          options: ["orElse is deprecated", "orElse evaluates its argument even when the Optional has a value, so the query always runs", "orElseGet caches the result", "orElse throws when the value is present"],
          answer: 1,
          explain: "Arguments in Java are evaluated before the method is called, so orElse(loadDefault()) runs the query every time. orElseGet takes a Supplier and calls it only when the Optional is empty."
        },
        {
          q: "You need a method that copies elements from one list into another of a compatible type. Which signature follows the producer-extends, consumer-super rule?",
          options: ["copy(List<T> src, List<T> dst)", "copy(List<? super T> src, List<? extends T> dst)", "copy(List<? extends T> src, List<? super T> dst)", "copy(List<?> src, List<?> dst)"],
          answer: 2,
          explain: "The source produces T values, so it can be a list of any subtype: ? extends T. The destination consumes T values, so it can be a list of any supertype: ? super T. That is the most flexible signature that stays type-safe."
        },
        {
          q: "Why can't you write new T() inside a generic class?",
          options: ["Generics are only checked at runtime", "Type erasure removes T at runtime, so the JVM does not know which constructor to call", "T must always be an interface", "Constructors cannot be generic"],
          answer: 1,
          explain: "Java implements generics by erasure: T becomes its bound (usually Object) in bytecode. Pass a Supplier<T> or a Class<T> when you need to create instances."
        }
      ]
    },
    "java-collections": {
      title: "Collections internals checkpoint",
      sub: "HashMap mechanics, equality contracts and picking the right collection.",
      questions: [
        {
          q: "A HashMap has capacity 16 and the default load factor. When does it first resize?",
          options: ["When the 16th entry is added", "When the 13th entry is added (size exceeds 12)", "When any bucket has 8 entries", "Never, HashMap has fixed capacity"],
          answer: 1,
          explain: "The resize threshold is capacity times load factor, 16 x 0.75 = 12. Adding the entry that takes size above 12 doubles the table to 32 and redistributes the entries."
        },
        {
          q: "You override equals in a class used as a HashMap key but forget hashCode. What is the typical symptom?",
          options: ["Compilation fails", "get returns null for a key that is logically equal to one already in the map", "The map becomes sorted", "Every put throws ConcurrentModificationException"],
          answer: 1,
          explain: "HashMap uses hashCode to pick the bucket before it ever calls equals. Two equal objects with different identity hash codes land in different buckets, so the lookup never finds the existing entry."
        },
        {
          q: "Why is mutating a field that participates in hashCode after the object is used as a HashMap key dangerous?",
          options: ["It throws immediately", "The entry stays in the bucket for the old hash, so lookups with the object no longer find it", "HashMap rehashes automatically on every change", "It only matters for TreeMap"],
          answer: 1,
          explain: "The map computed the bucket when the key was inserted and never recomputes it. After the hash changes the entry is effectively lost. Immutable keys such as records and strings avoid the problem."
        },
        {
          q: "Which structure is the usual best choice for a FIFO work queue or a stack in single-threaded code?",
          options: ["LinkedList", "Stack", "ArrayDeque", "Vector"],
          answer: 2,
          explain: "ArrayDeque is a resizable circular array: cache-friendly and without per-node allocation. Stack and Vector carry legacy synchronization, and LinkedList allocates a node per element with poor locality."
        },
        {
          q: "What happens when one bucket in a large HashMap accumulates many colliding keys?",
          options: ["Lookups in that bucket become O(n) forever", "The bucket converts from a linked list to a balanced tree once it passes a threshold and the table is large enough", "The map throws an exception", "The colliding keys are discarded"],
          answer: 1,
          explain: "Since Java 8 a bin that grows past a threshold (8 entries) is converted into a red-black tree, provided the table has at least 64 buckets; smaller tables resize instead. That bounds worst-case lookup in the bucket at O(log n)."
        }
      ]
    },
    "java-craft": {
      title: "Craft and tooling checkpoint",
      sub: "Equality contracts, exception design, logging and builds.",
      questions: [
        {
          q: "A class overrides equals but not hashCode, and instances are used as HashMap keys. What happens?",
          options: ["Nothing; equals is enough", "Equal objects can land in different buckets, so lookups miss entries that are 'equal'", "The map throws on put", "hashCode is generated automatically"],
          answer: 1,
          explain: "The contract says equal objects must have equal hash codes. Object's default hashCode is identity-based, so two equal keys usually hash differently and get() looks in the wrong bucket. Records generate both consistently."
        },
        {
          q: "new BigDecimal(\"2.0\").equals(new BigDecimal(\"2.00\")) returns false. Which comparison expresses numeric equality?",
          options: ["==", "compareTo(...) == 0", "hashCode()", "toString().equals(...)"],
          answer: 1,
          explain: "BigDecimal.equals compares value and scale, so 2.0 and 2.00 differ. compareTo ignores scale. This also means a HashSet can contain both, while a TreeSet treats them as one element."
        },
        {
          q: "Where should a low-level SQLException from a repository usually be handled in a Spring service?",
          options: ["Caught and ignored in the repository", "Translated into an unchecked exception (Spring's DataAccessException hierarchy) and handled at a boundary that can act on it, such as the error advice", "Declared as throws on every controller", "Logged at every layer it passes through"],
          answer: 1,
          explain: "Spring translates persistence exceptions into unchecked DataAccessExceptions. Handle them where you can do something useful, log once at that boundary, and keep the original as the cause."
        },
        {
          q: "Why is log.debug(\"loaded {} items for {}\", items.size(), customerId) better than string concatenation?",
          options: ["It is shorter", "The message is only formatted if DEBUG is enabled, and structured backends keep the arguments separate", "Concatenation is not allowed in SLF4J", "It encrypts the arguments"],
          answer: 1,
          explain: "Parameterized messages defer formatting until the level is enabled, avoiding wasted work on hot paths. Pass the exception as the last argument to keep its stack trace."
        },
        {
          q: "Several Spring and third-party libraries need mutually compatible versions. What is the standard Maven mechanism to align them?",
          options: ["Copying versions into every module", "Importing a BOM (bill of materials) such as spring-boot-dependencies in dependencyManagement", "Using version ranges like [1.0,)", "Shading every dependency"],
          answer: 1,
          explain: "A BOM declares tested version combinations once; modules then declare dependencies without versions. The Spring Boot parent or BOM import does this for hundreds of libraries."
        },
        {
          q: "In a multi-module build, the web module and the batch module both need the domain model. What is the clean structure?",
          options: ["Copy the classes into both", "A separate domain module that both depend on, with dependencies flowing one way and no cycles", "Make the web module depend on the batch module", "Put everything in one module"],
          answer: 1,
          explain: "Shared code lives in its own module so builds and ownership stay clear. Modules must form an acyclic graph; a cycle means the boundary is wrong."
        }
      ]
    }
  });

  /* ==================================================================
     Track data
  ================================================================== */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.java = {
    id: "java",
    name: "Modern Java",
    short: "JAVA",
    tagline: "The language you will actually write in 2026",
    color: "#ef4444",
    blurb: "Start from zero with the Java you will write every day on a backend: records and immutability, sealed hierarchies with pattern matching, streams and Optional used with discipline, generics without fear, and what really happens inside HashMap and its siblings.",
    modules: [
      {
        id: "lang",
        name: "Language Features",
        icon: "cube",
        lessons: [
          {
            id: "records",
            title: "Records: value objects without the boilerplate",
            summary: "What a record generates, how to validate in a compact constructor, and why records are the default shape for DTOs and value objects.",
            minutes: 9,
            tags: ["records", "immutability", "dto"],
            blocks: [
              { t: "p", html: "A <strong>record</strong> is a class whose whole identity is its data. You declare the components once and the compiler writes the constructor, accessors, <code class='tok'>equals</code>, <code class='tok'>hashCode</code> and <code class='tok'>toString</code>. Think of it as a named, typed tuple with rules." },
              { t: "h", text: "From forty lines to one" },
              { t: "code", lang: "java", code: J([
                "public record Money(BigDecimal amount, Currency currency) { }",
                "",
                "var price = new Money(new BigDecimal(\"19.99\"), Currency.getInstance(\"EUR\"));",
                "price.amount();           // accessor, no 'get' prefix",
                "price.equals(otherPrice); // compares components, not identity"
              ]) },
              { t: "p", html: "The fields are <code class='tok'>private final</code>, the class is implicitly <code class='tok'>final</code>, and it extends <code class='tok'>java.lang.Record</code>, so it cannot extend anything else. It can implement interfaces, declare static factories, and add methods that derive from its components." },
              { t: "h", text: "Validate once, in the compact constructor" },
              { t: "p", html: "A record that can be built in an invalid state is just a mutable bug waiting for a constructor call. The <strong>compact constructor</strong> runs before the fields are assigned, so it is the single place to normalise and reject input." },
              { t: "code", lang: "java", code: J([
                "public record OrderLine(String sku, int quantity, List<String> tags) {",
                "  public OrderLine {",
                "    Objects.requireNonNull(sku, \"sku\");",
                "    if (quantity <= 0) throw new IllegalArgumentException(\"quantity must be positive\");",
                "    tags = List.copyOf(tags);   // defensive, unmodifiable copy",
                "  }",
                "}"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Finality is shallow.</strong> A <code class='tok'>final List</code> field can still point at a list the caller keeps mutating. Copy collections in the compact constructor or the record is only immutable on paper." },
              { t: "h", text: "Where records fit on a backend" },
              { t: "table", headers: ["Use", "Record?", "Why"], rows: [
                ["Request / response DTO", "Yes", "Immutable, equality for tests, works with Jackson and Bean Validation"],
                ["Value object (Money, Email)", "Yes", "Validation in one place, safe as a map key"],
                ["Typed configuration", "Yes", "<code class='tok'>@ConfigurationProperties</code> binds to record constructors"],
                ["Query projection", "Yes", "Spring Data and JPQL constructor expressions can return records"],
                ["JPA entity", "No", "Entities need a no-arg constructor, mutable state and proxyable classes"]
              ] },
              { t: "compare",
                bad: { title: "Mutable DTO", items: ["Setters let any layer change state mid-request", "equals is identity, so tests compare field by field", "Null fields leak across service boundaries"] },
                good: { title: "Record DTO", items: ["Built once, valid by construction", "Value equality for free", "Absence handled explicitly (Optional return, or a required field)"] } },
              { t: "p", html: "Records are a data carrier, not a design pattern replacement. For modelling behaviour around data, Blueprint's <a class='inline' href='../hld-lld-academy/index.html#/lld/oop/composition-inheritance'>composition vs inheritance</a> lesson covers the trade-offs this lesson assumes." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"DTO\", \"value object\", \"immutable\", \"equality bug in tests\", \"config class with ten @Value fields\" \u2014 reach for a record with a validating compact constructor." },
              { t: "note", variant: "key", html: "<strong>A record is a promise that the data is the identity.</strong> Keep that promise with a compact constructor that validates and copies, and use records for DTOs, value objects and config \u2014 never for JPA entities." }
            ]
          },
          {
            id: "sealed-types",
            title: "Sealed types: closed hierarchies on purpose",
            summary: "Restrict who may implement an interface so the compiler can check that every case is handled.",
            minutes: 8,
            tags: ["sealed", "domain-modeling", "exhaustiveness"],
            blocks: [
              { t: "p", html: "Ordinary interfaces are open: anyone, anywhere, can add an implementation. That is right for plug-in points and wrong for domain facts. A payment is approved, declined or pending \u2014 there is no fourth answer you want a stranger to invent. A <strong>sealed</strong> type writes that rule into the type system." },
              { t: "code", lang: "java", code: J([
                "public sealed interface PaymentResult permits Approved, Declined, Pending { }",
                "",
                "public record Approved(String authCode) implements PaymentResult { }",
                "public record Declined(String reason, boolean retryable) implements PaymentResult { }",
                "public record Pending(Duration retryAfter) implements PaymentResult { }"
              ]) },
              { t: "h", text: "The three ways to continue a sealed hierarchy" },
              { t: "table", headers: ["Modifier on the subtype", "Meaning"], rows: [
                ["<code class='tok'>final</code> (records are implicitly final)", "The hierarchy ends here"],
                ["<code class='tok'>sealed ... permits ...</code>", "Another closed level below"],
                ["<code class='tok'>non-sealed</code>", "Re-opens this branch for unknown subclasses; use sparingly"]
              ] },
              { t: "h", text: "Why it pays: exhaustive switches" },
              { t: "code", lang: "java", code: J([
                "String describe(PaymentResult r) {",
                "  return switch (r) {",
                "    case Approved a -> \"approved \" + a.authCode();",
                "    case Declined d -> \"declined: \" + d.reason();",
                "    case Pending p  -> \"retry in \" + p.retryAfter().toSeconds() + \"s\";",
                "  };   // no default: the compiler proves all cases are covered",
                "}"
              ]) },
              { t: "p", html: "Add <code class='tok'>RequiresChallenge</code> to the permits list next quarter and every switch above stops compiling until someone decides what it means. With a <code class='tok'>default</code> branch, the new case would have slid silently into whatever the default did." },
              { t: "note", variant: "tip", html: "<strong>Leave out default on purpose.</strong> In a switch over a sealed type, a default branch throws away the compiler's exhaustiveness check. Write it only when the fallback is genuinely correct for every future subtype." },
              { t: "compare",
                bad: { title: "Result as exceptions and nulls", items: ["Declined thrown as an exception, pending returned as null", "Callers must read the docs to learn the cases", "New outcomes break callers at runtime"] },
                good: { title: "Result as a sealed type", items: ["Every outcome is a typed value with its own data", "The cases are visible in the signature", "New outcomes break callers at compile time"] } },
              { t: "p", html: "Sealed types plus pattern matching give you most of what the Visitor pattern was invented for, with far less ceremony. Compare with Blueprint's <a class='inline' href='../hld-lld-academy/index.html#/lld/patterns/behavioral'>behavioral patterns</a> to see what you no longer need to hand-write." },
              { t: "note", variant: "warn", html: "<strong>Not for extension points.</strong> If a library user or another team must be able to add implementations, keep the interface open. Sealing is a statement that you own every case." },
              { t: "note", variant: "key", html: "<strong>Seal what you own, switch without default.</strong> A sealed hierarchy turns \"did we handle every outcome?\" from a code-review question into a compiler error." }
            ]
          },
          {
            id: "pattern-matching",
            title: "Pattern matching: instanceof, switch and record patterns",
            summary: "Test a shape, bind its parts and branch on it in one expression, with guards and explicit null handling.",
            minutes: 9,
            tags: ["pattern-matching", "switch", "record-patterns"],
            blocks: [
              { t: "p", html: "Pattern matching collapses three steps you used to write by hand \u2014 test the type, cast, pull out the fields \u2014 into one. Modern Java has it in three places: <code class='tok'>instanceof</code>, <code class='tok'>switch</code>, and <strong>record patterns</strong> that deconstruct a record into its components." },
              { t: "h", text: "instanceof with a binding" },
              { t: "code", lang: "java", code: J([
                "// before",
                "if (event instanceof OrderPlaced) {",
                "  OrderPlaced placed = (OrderPlaced) event;",
                "  ship(placed.orderId());",
                "}",
                "// now: the binding is in scope only where the test is true",
                "if (event instanceof OrderPlaced placed) ship(placed.orderId());"
              ]) },
              { t: "h", text: "switch with record patterns and guards" },
              { t: "code", lang: "java", code: J([
                "BigDecimal fee(PaymentResult r) {",
                "  return switch (r) {",
                "    case Declined(var reason, var retryable) when retryable -> RETRY_FEE;",
                "    case Declined d -> BigDecimal.ZERO;",
                "    case Approved(var code) -> STANDARD_FEE;",
                "    case Pending p -> BigDecimal.ZERO;",
                "  };",
                "}"
              ]) },
              { t: "ul", items: [
                "<strong>Record pattern</strong> <code class='tok'>Declined(var reason, var retryable)</code> checks the type and binds components in one go; patterns can nest.",
                "<strong>Guard</strong> <code class='tok'>when retryable</code> refines a case after binding; if false, matching continues with the next case.",
                "<strong>Order matters</strong>: a more general case above a specific one makes the specific one unreachable, and the compiler rejects that as dominance.",
                "<strong>Unnamed pattern</strong> <code class='tok'>_</code> (final in Java 22) ignores components you do not need."
              ] },
              { t: "h", text: "Null is opt-in" },
              { t: "p", html: "A pattern switch throws <code class='tok'>NullPointerException</code> on a null selector unless you write <code class='tok'>case null</code>. That keeps fail-fast behaviour as the default and makes null handling visible where it happens." },
              { t: "code", lang: "java", code: J([
                "String label(Object o) {",
                "  return switch (o) {",
                "    case null -> \"missing\";",
                "    case Integer i when i > 0 -> \"positive int\";",
                "    case Integer i -> \"int\";",
                "    case String s -> \"text of length \" + s.length();",
                "    default -> \"other\";",
                "  };",
                "}"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Do not pattern-match your way around polymorphism.</strong> If every subtype can answer a question the same way, a method on the interface is still better. Pattern matching shines when the logic belongs to the caller, such as mapping results to HTTP statuses at the edge." },
              { t: "table", headers: ["Level", "What they say"], rows: [
                ["Mid", "Uses instanceof bindings and switch expressions correctly"],
                ["Senior", "Models outcomes as sealed records and relies on exhaustiveness instead of default branches"],
                ["Staff", "Knows when a method on the type beats a switch at the call site, and sets that convention for the codebase"]
              ] },
              { t: "quiz", id: "java-lang" },
              { t: "note", variant: "key", html: "<strong>Shape, bind, branch \u2014 in one expression.</strong> Combine sealed types, record patterns and guards so the compiler checks coverage, and handle null with an explicit case rather than by accident." }
            ]
          }
        ]
      },
      {
        id: "fp",
        name: "Streams, Optional & Generics",
        icon: "share",
        lessons: [
          {
            id: "streams",
            title: "Streams: lazy pipelines and honest collectors",
            summary: "How intermediate and terminal operations really execute, which collectors bite, and when a plain loop is better.",
            minutes: 10,
            tags: ["streams", "collectors", "laziness"],
            blocks: [
              { t: "p", html: "A stream is a <strong>recipe</strong>, not a collection. Intermediate operations (<code class='tok'>filter</code>, <code class='tok'>map</code>, <code class='tok'>sorted</code>) only describe the work. Nothing happens until a <strong>terminal</strong> operation (<code class='tok'>toList</code>, <code class='tok'>collect</code>, <code class='tok'>findFirst</code>) starts pulling elements through." },
              { t: "widget", id: "javaStreamLazy" },
              { t: "h", text: "Execution is per element, not per stage" },
              { t: "p", html: "Each element travels the whole pipeline before the next one is pulled. That is why <code class='tok'>limit</code>, <code class='tok'>findFirst</code> and <code class='tok'>anyMatch</code> can stop early, and why a side effect in <code class='tok'>map</code> runs fewer times than the source size. Stateful stages such as <code class='tok'>sorted</code> and <code class='tok'>distinct</code> are the exception: they must see everything first." },
              { t: "h", text: "Collectors worth knowing \u2014 and their traps" },
              { t: "code", lang: "java", code: J([
                "// group and count",
                "Map<OrderStatus, Long> byStatus = orders.stream()",
                "    .collect(Collectors.groupingBy(Order::status, Collectors.counting()));",
                "",
                "// toMap: state the duplicate-key policy explicitly",
                "Map<String, Customer> byEmail = customers.stream()",
                "    .collect(Collectors.toMap(Customer::email, c -> c, (first, dup) -> first));",
                "",
                "// Java 16+: unmodifiable result",
                "List<String> skus = lines.stream().map(OrderLine::sku).toList();"
              ]) },
              { t: "note", variant: "trap", html: "<strong>toMap without a merge function throws on duplicates.</strong> It works in tests with clean data and fails in production with an <code class='tok'>IllegalStateException</code> the day two rows share a key." },
              { t: "h", text: "Parallel streams are rarely a backend win" },
              { t: "ul", items: [
                "They run on the shared <strong>common ForkJoinPool</strong>, so one heavy request can starve every other parallel stream in the JVM.",
                "Blocking I/O inside a parallel stream wastes those few pool threads.",
                "They only pay off for large, CPU-bound, splittable work with no shared mutable state \u2014 and you should measure before believing it."
              ] },
              { t: "compare",
                bad: { title: "Stream misuse", items: ["Mutating an external list inside forEach", "Five chained stages that a two-line loop would express", "parallel() on a request path calling the database"] },
                good: { title: "Stream done well", items: ["Pure functions in each stage", "Collect into a result, do not mutate outside", "Plain loops when you need early exit with complex state or checked exceptions"] } },
              { t: "note", variant: "key", html: "<strong>Streams are lazy recipes executed one element at a time.</strong> Keep stages pure, give toMap a merge policy, and treat parallel() as a measured optimisation, not a default." }
            ]
          },
          {
            id: "optional",
            title: "Optional: a return type, not a lifestyle",
            summary: "Use Optional to force callers to handle absence at service boundaries, and avoid the patterns that make it worse than null.",
            minutes: 7,
            tags: ["optional", "null-safety"],
            blocks: [
              { t: "p", html: "<code class='tok'>Optional&lt;T&gt;</code> exists for one job: a method that might not have an answer tells its caller so in the signature. The caller must then decide what absence means \u2014 a default, a different path, or an error." },
              { t: "code", lang: "java", code: J([
                "// repository: absence is a normal outcome",
                "Optional<Customer> findById(UUID id);",
                "",
                "// service: absence at this boundary is an error the API maps to 404",
                "public Customer getCustomer(UUID id) {",
                "  return repository.findById(id)",
                "      .orElseThrow(() -> new CustomerNotFoundException(id));",
                "}"
              ]) },
              { t: "h", text: "The useful operations" },
              { t: "table", headers: ["Operation", "Use it for"], rows: [
                ["<code class='tok'>map</code> / <code class='tok'>flatMap</code>", "Transform the value if present, chain lookups that return Optional"],
                ["<code class='tok'>orElseThrow(supplier)</code>", "Turn absence into a domain exception at a boundary"],
                ["<code class='tok'>orElseGet(supplier)</code>", "Lazy default, computed only when empty"],
                ["<code class='tok'>orElse(value)</code>", "Cheap constant default only \u2014 the argument is always evaluated"],
                ["<code class='tok'>ifPresentOrElse</code>", "Side effects for both branches"]
              ] },
              { t: "note", variant: "trap", html: "<strong>orElse(expensiveCall()) always runs the call.</strong> Java evaluates arguments before the method runs, so the database query fires even when the value is present. Use <code class='tok'>orElseGet</code>." },
              { t: "compare",
                bad: { title: "Optional anti-patterns", items: ["<code class='tok'>opt.get()</code> without a check \u2014 a null pointer exception with extra steps", "Optional fields on entities and DTOs", "Optional method parameters", "Returning null from a method declared to return Optional"] },
                good: { title: "Optional with discipline", items: ["Return type of lookups that may miss", "Resolved at the service boundary with orElseThrow", "Empty collections instead of Optional&lt;List&gt;", "Overloads or a nullable field for optional inputs"] } },
              { t: "note", variant: "tip", html: "<strong>Do not let null cross a service boundary.</strong> Inside a method, a local null is a manageable detail. Across a boundary it becomes everyone's problem; Optional on lookups plus records with required fields stops that." },
              { t: "note", variant: "key", html: "<strong>Optional is a signpost on return values.</strong> Resolve it at the boundary with orElseThrow or a lazy default, and keep it out of fields, parameters and collections." }
            ]
          },
          {
            id: "generics",
            title: "Generics: bounds, wildcards and erasure",
            summary: "Write type-safe reusable code, apply producer-extends consumer-super, and understand what erasure forbids.",
            minutes: 9,
            tags: ["generics", "wildcards", "erasure"],
            blocks: [
              { t: "p", html: "Generics let the compiler carry a type through your code so you do not cast. <code class='tok'>List&lt;Order&gt;</code> means every read gives you an <code class='tok'>Order</code> and every write must be one. The rules get interesting when subtypes meet containers." },
              { t: "h", text: "Invariance: why List<Integer> is not a List<Number>" },
              { t: "p", html: "If <code class='tok'>List&lt;Integer&gt;</code> were a <code class='tok'>List&lt;Number&gt;</code>, you could add a <code class='tok'>Double</code> to a list of integers through the wider reference. Java forbids it, so generic types are <strong>invariant</strong>. Wildcards are how you opt into safe flexibility." },
              { t: "code", lang: "java", code: J([
                "// producer: you read T out  -> ? extends T",
                "static double total(Collection<? extends Number> values) {",
                "  double sum = 0;",
                "  for (Number n : values) sum += n.doubleValue();",
                "  return sum;",
                "}",
                "",
                "// consumer: you put T in     -> ? super T",
                "static void addDefaults(List<? super Integer> sink) {",
                "  sink.add(0);",
                "  sink.add(1);",
                "}"
              ]) },
              { t: "note", variant: "tip", html: "<strong>Producer extends, consumer super.</strong> If a parameter only gives you values, widen it with <code class='tok'>? extends</code>; if it only takes values, widen it with <code class='tok'>? super</code>; if it does both, use the exact type." },
              { t: "h", text: "Bounded type parameters" },
              { t: "code", lang: "java", code: J([
                "static <T extends Comparable<? super T>> T max(List<? extends T> items) {",
                "  T best = items.get(0);",
                "  for (T item : items) if (item.compareTo(best) > 0) best = item;",
                "  return best;",
                "}"
              ]) },
              { t: "h", text: "Erasure: what the JVM never sees" },
              { t: "table", headers: ["You cannot", "Because", "Do this instead"], rows: [
                ["<code class='tok'>new T()</code>", "T is erased to its bound", "Pass a <code class='tok'>Supplier&lt;T&gt;</code>"],
                ["<code class='tok'>x instanceof List&lt;String&gt;</code>", "Type arguments are gone at runtime", "Check <code class='tok'>List&lt;?&gt;</code> and the elements"],
                ["Overload <code class='tok'>m(List&lt;A&gt;)</code> and <code class='tok'>m(List&lt;B&gt;)</code>", "Both erase to <code class='tok'>m(List)</code>", "Use different method names"],
                ["Create <code class='tok'>new T[10]</code>", "Arrays are reified, generics are not", "Use a <code class='tok'>List&lt;T&gt;</code>"]
              ] },
              { t: "note", variant: "warn", html: "<strong>Raw types switch the checker off.</strong> A raw <code class='tok'>List</code> compiles with warnings and fails later with a <code class='tok'>ClassCastException</code> far from the cause. Treat unchecked warnings as errors in new code." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"why doesn't this compile when I pass a List of subtypes\", \"utility that copies or merges collections\", \"need to create instances of a type parameter\" \u2014 think wildcards, PECS and Supplier." },
              { t: "quiz", id: "java-fp" },
              { t: "note", variant: "key", html: "<strong>Generics are invariant; wildcards buy safe flexibility.</strong> Apply producer-extends, consumer-super to parameters, and remember erasure means runtime has no idea what T was." }
            ]
          }
        ]
      },
      {
        id: "collections",
        name: "Collections Internals",
        icon: "grid",
        lessons: [
          {
            id: "collections-internals",
            title: "Inside HashMap, and choosing the right collection",
            summary: "Hashing, buckets, resizing and treeification, the equals/hashCode contract, and a practical guide to picking a collection.",
            minutes: 12,
            tags: ["hashmap", "collections", "equals-hashcode"],
            blocks: [
              { t: "p", html: "A <code class='tok'>HashMap</code> is an array of <strong>buckets</strong>. To store a key it computes the key's <code class='tok'>hashCode</code>, mixes the high bits into the low bits, and masks the result with <code class='tok'>capacity - 1</code> to pick a bucket. Equal keys must land in the same bucket, which is why <code class='tok'>equals</code> and <code class='tok'>hashCode</code> are a contract, not two independent methods." },
              { t: "widget", id: "javaHashMap" },
              { t: "h", text: "The numbers that matter" },
              { t: "stat", items: [
                { v: "16", k: "default initial buckets" },
                { v: "0.75", k: "default load factor" },
                { v: "2x", k: "growth on resize" },
                { v: "8", k: "bin size that may treeify" }
              ] },
              { t: "ul", items: [
                "<strong>Resize</strong>: when size exceeds capacity x load factor, the table doubles and every entry moves. If you know the size up front, presize to avoid repeated rehashing.",
                "<strong>Treeify</strong>: a bin with many collisions becomes a red-black tree, but only once the table has at least 64 buckets; smaller tables resize instead. Worst-case lookup in that bin becomes O(log n).",
                "<strong>Iteration order</strong> is unspecified and changes on resize. Use <code class='tok'>LinkedHashMap</code> when order matters."
              ] },
              { t: "h", text: "The equals / hashCode contract" },
              { t: "code", lang: "java", code: J([
                "// equal objects MUST have equal hash codes; records do this for you",
                "public record CustomerKey(String tenant, String email) { }",
                "",
                "Map<CustomerKey, Customer> cache = new HashMap<>();",
                "cache.put(new CustomerKey(\"acme\", \"a@acme.example\"), customer);",
                "cache.get(new CustomerKey(\"acme\", \"a@acme.example\")); // found"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Mutable keys get lost.</strong> Change a field that feeds hashCode after inserting the key and the entry stays in the old bucket. Lookups miss, and the entry leaks until the map is cleared. Use immutable keys." },
              { t: "h", text: "Choosing a collection" },
              { t: "table", headers: ["Need", "Choose", "Avoid"], rows: [
                ["Indexed list, mostly appends and reads", "<code class='tok'>ArrayList</code> (presize if known)", "<code class='tok'>LinkedList</code> \u2014 node per element, poor locality"],
                ["Stack or FIFO queue", "<code class='tok'>ArrayDeque</code>", "<code class='tok'>Stack</code>, <code class='tok'>Vector</code> \u2014 legacy synchronization"],
                ["Key lookup", "<code class='tok'>HashMap</code>", "Linear search in a list"],
                ["Sorted keys, range queries", "<code class='tok'>TreeMap</code> (O(log n))", "Sorting a HashMap's entries on every call"],
                ["Enum keys", "<code class='tok'>EnumMap</code> / <code class='tok'>EnumSet</code>", "HashMap with enum keys"],
                ["Simple LRU cache", "<code class='tok'>LinkedHashMap</code> in access order", "Hand-rolled linked lists"],
                ["Constant data", "<code class='tok'>List.of</code>, <code class='tok'>Map.of</code> (unmodifiable, reject nulls)", "Collections you then wrap and forget"],
                ["Shared between threads", "See <a class='inline' href='#/conc/sync/locks-atomics'>concurrent collections</a>", "<code class='tok'>Collections.synchronizedMap</code> for hot paths"]
              ] },
              { t: "note", variant: "tip", html: "<strong>Big-O hides constants.</strong> ArrayList beats LinkedList even for many middle inserts at realistic sizes because contiguous memory is cache-friendly. Measure before choosing on theory alone." },
              { t: "table", headers: ["Level", "What they say"], rows: [
                ["Mid", "Knows HashMap is O(1) average and overrides equals with hashCode"],
                ["Senior", "Explains buckets, load factor, resize cost and treeification, and presizes hot maps"],
                ["Staff", "Connects key design, memory footprint and locality to latency, and picks structures from measurements"]
              ] },
              { t: "quiz", id: "java-collections" },
              { t: "note", variant: "key", html: "<strong>HashMap is buckets plus a contract.</strong> Good keys are immutable with consistent equals and hashCode; good collections are chosen for access pattern and memory locality, not habit." }
            ]
          }
        ]
      },
      {
        id: "craft",
        name: "Craft & Tooling",
        icon: "wrench",
        lessons: [
          {
            id: "equality-immutability",
            title: "Strings, immutability and the equals/hashCode contract",
            summary: "Why String is immutable, how equality and ordering contracts work, and the value-type pitfalls that cause real bugs.",
            minutes: 9,
            tags: ["equals", "hashcode", "immutability", "string"],
            blocks: [
              { t: "p", html: "Most of a backend's data are <strong>values</strong>: money, ids, addresses, timestamps. Values are easiest to reason about when they are <strong>immutable</strong> and compare by content. Java gives you the tools, but the contracts behind <code class='tok'>equals</code>, <code class='tok'>hashCode</code> and <code class='tok'>compareTo</code> have to be honoured exactly." },
              { t: "h", text: "String: immutable by design" },
              { t: "ul", items: [
                "A <code class='tok'>String</code> never changes after construction, so it is safe to share between threads, cache its hash code and use as a map key.",
                "String literals are interned: <code class='tok'>\"a\" == \"a\"</code> may be true, which is why <code class='tok'>==</code> sometimes appears to work. Always compare with <code class='tok'>equals</code>.",
                "Concatenation in loops creates garbage; use <code class='tok'>StringBuilder</code> or <code class='tok'>String.join</code> / collectors.",
                "Text blocks (<code class='tok'>\"\"\"</code>) keep SQL and JSON readable without escaping."
              ] },
              { t: "h", text: "The equality contracts" },
              { t: "table", headers: ["Contract", "Rule", "Broken when"], rows: [
                ["equals", "Reflexive, symmetric, transitive, consistent, never equal to null", "A subclass adds fields and compares differently from its parent"],
                ["hashCode", "Equal objects must have equal hash codes", "equals is overridden alone; hash depends on mutable fields"],
                ["compareTo", "Consistent with equals is strongly recommended", "Sorted sets and maps drop or merge 'different' elements"]
              ] },
              { t: "code", lang: "java", code: J([
                "// records: content-based equals, hashCode and toString for free",
                "public record Money(BigDecimal amount, Currency currency) {",
                "  public Money {",
                "    amount = amount.setScale(currency.getDefaultFractionDigits(), RoundingMode.HALF_EVEN); // normalise scale",
                "  }",
                "}",
                "",
                "new BigDecimal(\"2.0\").equals(new BigDecimal(\"2.00\"));       // false: scale differs",
                "new BigDecimal(\"2.0\").compareTo(new BigDecimal(\"2.00\")) == 0; // true"
              ]) },
              { t: "note", variant: "trap", html: "<strong>Mutable keys corrupt hash collections.</strong> If a field used in <code class='tok'>hashCode</code> changes while the object is in a HashSet, the object is stranded in the wrong bucket: <code class='tok'>contains</code> returns false and it can never be removed. Keys must be immutable." },
              { t: "h", text: "Immutability in practice" },
              { t: "ul", items: [
                "Final fields, no setters, defensive copies of mutable inputs (<code class='tok'>List.copyOf</code>).",
                "Prefer <code class='tok'>java.time</code> types (immutable) over <code class='tok'>Date</code> and <code class='tok'>Calendar</code>.",
                "Return unmodifiable views or copies rather than internal collections.",
                "JPA entities are the exception: they are mutable by design, so give them id-based or business-key equality and keep them inside the service."
              ] },
              { t: "note", variant: "key", html: "<strong>Values should be immutable and compare by content.</strong> Use records, normalise inside constructors, keep equals, hashCode and compareTo consistent, and never mutate a key." }
            ]
          },
          {
            id: "exceptions-design",
            title: "Designing exceptions",
            summary: "Checked vs unchecked, domain exception hierarchies, wrapping causes, try-with-resources, and where to handle and log.",
            minutes: 9,
            tags: ["exceptions", "error-handling"],
            blocks: [
              { t: "p", html: "Exceptions are part of your API. Good exception design makes failures <strong>specific</strong> (callers can react), <strong>traceable</strong> (the cause chain survives) and <strong>handled once</strong>, at a boundary that can do something about them." },
              { t: "table", headers: ["Kind", "Use for", "Example"], rows: [
                ["Unchecked domain exception", "Business rule violations callers may map to a response", "<code class='tok'>CreditLimitExceeded</code>, <code class='tok'>OrderNotFound</code>"],
                ["Unchecked programming error", "Bugs: violated preconditions", "<code class='tok'>IllegalArgumentException</code>, <code class='tok'>IllegalStateException</code>"],
                ["Checked exception", "Recoverable conditions the immediate caller must decide on", "<code class='tok'>IOException</code> in a file importer"],
                ["Error", "JVM-level failure; do not catch", "<code class='tok'>OutOfMemoryError</code>"]
              ] },
              { t: "code", lang: "java", code: J([
                "public sealed abstract class OrderException extends RuntimeException",
                "    permits OrderNotFound, CreditLimitExceeded, OrderAlreadyShipped {",
                "  protected OrderException(String message) { super(message); }",
                "}",
                "",
                "public final class OrderNotFound extends OrderException {",
                "  public OrderNotFound(long id) { super(\"order \" + id + \" not found\"); }",
                "}",
                "",
                "// wrap, never lose the cause",
                "try {",
                "  return parser.parse(payload);",
                "} catch (JsonProcessingException e) {",
                "  throw new InvalidOrderPayload(\"order payload is not valid JSON\", e);",
                "}"
              ]) },
              { t: "h", text: "Resources and cleanup" },
              { t: "code", lang: "java", code: J([
                "try (var in = Files.newBufferedReader(path);",
                "     var out = Files.newBufferedWriter(target)) {",
                "  in.transferTo(out);",
                "} // closed in reverse order, even on exceptions; close failures become suppressed exceptions"
              ]) },
              { t: "compare",
                bad: { title: "Exception anti-patterns", items: ["<code class='tok'>catch (Exception e) {}</code> swallowing failures", "Logging and rethrowing at every layer: five stack traces per error", "Exceptions for normal control flow (a 'not found' that is expected)", "Leaking exception messages with SQL or internals to clients"] },
                good: { title: "Deliberate handling", items: ["A small sealed hierarchy of domain exceptions", "Wrap with context, keep the cause", "Handle and log once at the boundary (the @RestControllerAdvice)", "Optional or a result type when absence is normal"] } },
              { t: "note", variant: "tip", html: "<strong>Map domain exceptions to HTTP in one place.</strong> The advice in <a class='inline' href='#/api/rest/problem-details'>ProblemDetail error responses</a> turns each exception type into a status and a safe body." },
              { t: "note", variant: "key", html: "<strong>Specific, wrapped, handled once.</strong> Use unchecked domain exceptions for business failures, keep cause chains, close resources with try-with-resources, and log at the boundary that handles the error." }
            ]
          },
          {
            id: "logging-slf4j",
            title: "Logging with SLF4J, Logback and MDC",
            summary: "The logging facade and backend, parameterized messages, levels that mean something, and per-request context with MDC.",
            minutes: 8,
            tags: ["logging", "slf4j", "logback", "mdc"],
            blocks: [
              { t: "p", html: "Spring Boot logs through <strong>SLF4J</strong>, a facade, with <strong>Logback</strong> as the default backend. Code depends only on the facade; the backend decides format and destination. Logs are for humans investigating incidents, so every line should answer 'what happened, to what, and why?'." },
              { t: "code", lang: "java", code: J([
                "private static final Logger log = LoggerFactory.getLogger(PaymentService.class);",
                "",
                "log.info(\"payment captured order={} amount={}\", orderId, amount);   // formatted only if INFO is on",
                "log.warn(\"partner slow, using cached rates partner={} ms={}\", partner, elapsed);",
                "log.error(\"capture failed order={}\", orderId, ex);                // exception last: full stack trace",
                "",
                "// SLF4J 2 fluent API for structured key-values",
                "log.atInfo().addKeyValue(\"orderId\", orderId).log(\"order shipped\");"
              ]) },
              { t: "table", headers: ["Level", "Means", "Example"], rows: [
                ["ERROR", "Someone should look; a request or job failed", "Payment capture failed after retries"],
                ["WARN", "Unexpected but handled; may need attention if it repeats", "Fallback used because the breaker is open"],
                ["INFO", "Business-relevant events and lifecycle", "Order placed, application started"],
                ["DEBUG", "Diagnostic detail, off in production by default", "Computed price breakdown"],
                ["TRACE", "Very fine-grained", "Framework internals"]
              ] },
              { t: "h", text: "MDC: context on every line" },
              { t: "p", html: "The <strong>Mapped Diagnostic Context</strong> is a thread-local map whose entries are added to every log line. Tracing already puts <code class='tok'>traceId</code> and <code class='tok'>spanId</code> there; you can add tenant or job ids at a boundary." },
              { t: "code", lang: "java", code: J([
                "try (var ignored = MDC.putCloseable(\"tenant\", tenantId)) {",
                "  importer.run(file);            // every log line inside carries tenant=...",
                "}                                // removed even on exceptions: no leaks onto pooled threads"
              ]) },
              { t: "code", lang: "yaml", code: J([
                "logging:",
                "  level:",
                "    root: INFO",
                "    com.shop.pricing: DEBUG      # targeted, temporary; change at runtime via Actuator loggers",
                "  structured:",
                "    format:",
                "      console: ecs                # JSON lines for the log pipeline"
              ]) },
              { t: "note", variant: "warn", html: "<strong>MDC does not follow work to other threads.</strong> Executors, CompletableFuture and @Async need a TaskDecorator or context propagation to copy it, as covered in <a class='inline' href='#/prod/observe/tracing-logging'>tracing and structured logging</a>." },
              { t: "note", variant: "trap", html: "<strong>Never log secrets or whole payloads.</strong> Tokens, passwords and personal data in logs end up in systems with broad access and long retention. Log identifiers, not contents." },
              { t: "note", variant: "key", html: "<strong>Facade in code, structure in output, context via MDC.</strong> Use parameterized messages, meaningful levels, the exception as last argument, and clean MDC up in finally or try-with-resources." }
            ]
          },
          {
            id: "build-tooling",
            title: "Build tooling: Maven, Gradle, BOMs and multi-module builds",
            summary: "How Java builds resolve dependencies, aligning versions with BOMs, structuring multi-module projects, and keeping builds reproducible.",
            minutes: 10,
            tags: ["maven", "gradle", "bom", "dependencies"],
            blocks: [
              { t: "p", html: "Every Spring service is a build first. <strong>Maven</strong> and <strong>Gradle</strong> both resolve a tree of dependencies, compile, test and package. Most production surprises \u2014 <code class='tok'>NoSuchMethodError</code>, two logging backends, a vulnerable transitive library \u2014 are dependency-management problems." },
              { t: "table", headers: ["Concern", "Maven", "Gradle"], rows: [
                ["Build definition", "Declarative <code class='tok'>pom.xml</code>", "Kotlin or Groovy DSL, programmable"],
                ["Version alignment", "<code class='tok'>dependencyManagement</code> + BOM import", "<code class='tok'>platform(...)</code> + version catalogs"],
                ["Conflict resolution", "Nearest declaration wins", "Highest version wins (by default)"],
                ["Speed features", "Parallel builds, build cache via extensions", "Incremental tasks, build cache, configuration cache"],
                ["Wrapper", "<code class='tok'>./mvnw</code>", "<code class='tok'>./gradlew</code>"]
              ] },
              { t: "h", text: "BOMs align versions" },
              { t: "code", lang: "xml", code: J([
                "<dependencyManagement>",
                "  <dependencies>",
                "    <dependency>",
                "      <groupId>org.springframework.boot</groupId>",
                "      <artifactId>spring-boot-dependencies</artifactId>",
                "      <version>${spring-boot.version}</version>",
                "      <type>pom</type>",
                "      <scope>import</scope>",
                "    </dependency>",
                "  </dependencies>",
                "</dependencyManagement>",
                "",
                "<dependencies>",
                "  <dependency>",
                "    <groupId>org.springframework.boot</groupId>",
                "    <artifactId>spring-boot-starter-web</artifactId>   <!-- no version: the BOM decides -->",
                "  </dependency>",
                "</dependencies>"
              ]) },
              { t: "code", lang: "text", code: J([
                "// Gradle (Kotlin DSL) equivalent",
                "dependencies {",
                "    implementation(platform(\"org.springframework.boot:spring-boot-dependencies:${springBootVersion}\"))",
                "    implementation(\"org.springframework.boot:spring-boot-starter-web\")",
                "    testImplementation(\"org.springframework.boot:spring-boot-starter-test\")",
                "}"
              ]) },
              { t: "h", text: "Multi-module structure" },
              { t: "code", lang: "text", code: J([
                "shop/",
                "\u251c\u2500 pom.xml                 <- parent: plugins, BOM import, Java release",
                "\u251c\u2500 shop-domain/            <- plain Java: entities, rules (no web deps)",
                "\u251c\u2500 shop-api/               <- Spring Boot app: controllers, config -> depends on domain",
                "\u2514\u2500 shop-batch/             <- Spring Batch jobs -> depends on domain"
              ]) },
              { t: "ul", items: [
                "Dependencies flow one way; a cycle between modules means a boundary is wrong.",
                "Use scopes deliberately: <code class='tok'>test</code>, <code class='tok'>runtime</code> (JDBC drivers), <code class='tok'>provided</code>; Gradle's <code class='tok'>implementation</code> keeps transitive leakage down.",
                "Inspect conflicts with <code class='tok'>mvn dependency:tree</code> or <code class='tok'>gradle dependencies</code>; exclude duplicates such as a second logging backend.",
                "Enforce rules in the build: required Java version, banned dependencies, no snapshot versions in releases."
              ] },
              { t: "note", variant: "warn", html: "<strong>Reproducible builds need pinned inputs.</strong> Avoid version ranges and dynamic versions, commit the wrapper, pin plugin versions, and resolve dependencies through a controlled repository proxy. Scan the resolved tree for known vulnerabilities in CI." },
              { t: "quiz", id: "java-craft" },
              { t: "note", variant: "key", html: "<strong>Let a BOM own versions and the module graph own boundaries.</strong> Declare dependencies without versions, keep modules acyclic, inspect the resolved tree, and pin everything that feeds a release." }
            ]
          }
        ]
      }
    ]
  };
})();
