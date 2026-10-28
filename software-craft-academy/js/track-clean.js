/* =====================================================================
   CHISEL · Clean Code
   window.TRACKS.clean — modules: names / errors / structure
   Self-contained: registers its own widgets, quizzes and track data.
   ===================================================================== */
(function () {
  "use strict";
  var K = window.ChiselKit;
  var h = K.h, clear = K.clear, ro = K.ro;

  var Widgets = {};

  /* cleanSmellSpotter — click the smelly lines */
  Widgets.cleanSmellSpotter = function (mount) {
    K.lineSpotter(mount, {
      pill: "spot it",
      title: "Code-smell spotter",
      desc: "Click every line you would flag in review. Each click tells you whether it is a real smell and why. Some lines are perfectly fine \u2014 flagging those counts as a false alarm.",
      snippets: [
        {
          id: "invoice", label: "Invoice total (JS)",
          lines: [
            { code: "function calc(o, flag) {", issue: "Vague name plus a flag argument", why: "`calc` says nothing about what is calculated, and a boolean parameter means the function does two different things depending on the caller." },
            { code: "  let t = 0;", issue: "Cryptic name", why: "`t` forces the reader to scroll down to learn it is a running subtotal. `subtotal` costs six characters." },
            { code: "  for (const item of o.items) {", why: "Iterating the items is exactly what this line should do." },
            { code: "    t += item.price * item.qty;", why: "Clear arithmetic over well-named fields." },
            { code: "  }", why: "Closing brace." },
            { code: "  if (flag) {", issue: "Branch selected by the flag", why: "This is where the flag argument splits the function into two behaviours. Two functions (or a parameter object with a named option) read better." },
            { code: "    if (o.customer) {", issue: "Deep nesting", why: "Three levels of nesting before any work happens. Guard clauses or a separate discount function flatten this." },
            { code: "      if (o.customer.tier === 3) t = t * 0.85;", issue: "Magic numbers", why: "What is tier 3, and why 0.85? Named constants such as GOLD_TIER and GOLD_DISCOUNT make the rule reviewable." },
            { code: "    }", why: "Closing brace." },
            { code: "  }", why: "Closing brace." },
            { code: "  // add tax", issue: "Comment restates the code", why: "The next line already says it adds tax. A comment should explain why, for example which jurisdiction rule applies." },
            { code: "  t = t + t * 0.2;", issue: "Magic number", why: "A hard-coded 20% tax rate will be wrong the day you sell in a second region. Inject or name it." },
            { code: "  return Math.round(t * 100) / 100;", why: "Rounding to cents at the boundary is a reasonable, visible decision." },
            { code: "}", why: "Closing brace." }
          ]
        },
        {
          id: "loader", label: "Config loader (Python)",
          lines: [
            { code: "def load_config(path):", why: "A specific, verb-first name for a function that does one thing." },
            { code: "    try:", why: "Opening a try block is fine; the question is what it catches." },
            { code: "        with open(path) as f:", why: "Context manager closes the file even on error." },
            { code: "            data = json.load(f)", why: "Parsing in one step." },
            { code: "    except Exception:", issue: "Over-broad catch", why: "Catching every exception hides typos, permission errors and bugs alike. Catch the specific errors you can handle (missing file, bad JSON)." },
            { code: "        return {}", issue: "Swallowed error", why: "Returning an empty dict turns a broken deployment into silently-default behaviour. Fail fast with a clear message instead." },
            { code: "    data2 = {}", issue: "Meaningless name", why: "`data2` tells you there was a `data`, nothing more. Name it for what it holds, such as `settings`." },
            { code: "    for k in data:", why: "Iterating the keys is fine." },
            { code: "        data2[k.lower()] = data[k]", why: "Normalising keys is a legitimate step, though a comprehension would be shorter." },
            { code: "    if data2.get('timeout') == None:", issue: "Identity comparison done with ==", why: "Compare to None with `is None`. Better still, use `setdefault` or a defaults dict merged once." },
            { code: "        data2['timeout'] = 30", issue: "Magic default buried mid-function", why: "Defaults scattered through the loader are hard to find and document. Collect them in one DEFAULTS mapping." },
            { code: "    return data2", why: "Returning the result." }
          ]
        }
      ]
    });
  };

  /* cleanNamingLab — choose the better name */
  Widgets.cleanNamingLab = function (mount) {
    K.choiceDrill(mount, {
      pill: "naming",
      title: "Naming lab",
      desc: "For each identifier, pick the name you would approve in review. The explanation shows the rule that decides it.",
      items: [
        { prompt: "A boolean that is true when the user may edit the document.", options: ["canEdit", "flag", "editable", "checkEdit"], answer: 0, why: "Booleans read best as predicates: `if (canEdit)` is a sentence. `editable` is close but describes the document, not the permission; `checkEdit` sounds like a function that does work." },
        { prompt: "A function that returns the list of overdue invoices for a customer.", options: ["getData", "process", "overdueInvoicesFor", "handleInvoices"], answer: 2, why: "Name the result and the input. `overdueInvoicesFor(customer)` reads naturally at the call site; the others could mean anything." },
        { prompt: "Loop index over a 3-line loop that sums an array.", options: ["currentArrayIndexPosition", "idx_counter_value", "theIndex", "i"], answer: 3, why: "Name length should track scope. In a three-line loop `i` is idiomatic and instantly understood; a long name adds noise without information." },
        { prompt: "A module-level constant holding the retry limit for the payments client.", options: ["N", "PAYMENT_RETRY_LIMIT", "MAX", "retry"], answer: 1, why: "Wide scope needs a fully descriptive name. `MAX` collides with every other maximum; `PAYMENT_RETRY_LIMIT` is searchable and unambiguous." },
        { prompt: "A class that turns raw CSV rows into Order objects.", options: ["OrderManager", "OrderHelper", "OrderCsvParser", "OrderUtil"], answer: 2, why: "Manager, Helper and Util are vocabulary that hides what the class does. `OrderCsvParser` names the input format and the job." },
        { prompt: "Duration in milliseconds before a session expires.", options: ["sessionTtlMs", "timeout", "time", "expiry"], answer: 0, why: "When a value has units, put them in the name. `sessionTtlMs` cannot be mistaken for seconds, which is a classic source of thousand-fold bugs." }
      ]
    });
  };

  /* cleanLogLevelDrill — pick the right log level and content */
  Widgets.cleanLogLevelDrill = function (mount) {
    K.choiceDrill(mount, {
      pill: "logging",
      title: "Pick the log level",
      desc: "For each event in a checkout service, choose the level you would log it at. Levels decide who gets woken up and what survives sampling in production.",
      choices: ["DEBUG", "INFO", "WARN", "ERROR"],
      items: [
        { prompt: "Order 8812 placed successfully (one line per order, with order id and total).", answer: 1, why: "A normal business event worth counting and searching. INFO, structured, with ids rather than personal data." },
        { prompt: "Payment provider timed out; the request was retried and the retry succeeded.", answer: 2, why: "Something abnormal happened but the system coped. WARN lets you spot a rising trend without paging anyone." },
        { prompt: "Full request and response bodies while investigating a parsing bug locally.", answer: 0, why: "Verbose diagnostics belong at DEBUG, off in production by default \u2014 and bodies may contain personal data, so they need redaction even then." },
        { prompt: "Charging the card failed after all retries; the order is stuck in PENDING.", answer: 3, why: "A user-visible failure that needs action. ERROR, logged once at the boundary, with the order id and the cause." },
        { prompt: "Cache miss for a product lookup (thousands per minute).", answer: 0, why: "High-volume, low-value events drown real signals. Count them as a metric instead; log at DEBUG at most." }
      ]
    });
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "clean-ops": {
      title: "Production-ready code checkpoint",
      sub: "Defensive programming, logging, config and flags, performance and concurrency.",
      questions: [
        { q: "Where should input be validated most strictly?", options: ["In every private helper", "Only in the database", "Only in the UI", "At trust boundaries: HTTP handlers, message consumers, file and config parsers"], answer: 3,
          explain: "Data crossing into your system from outside is untrusted. Validate and parse it once at that boundary; inside, rely on the trusted types you produced." },
        { q: "Which is the best structured log line?", options: ["print(\"something went wrong\")", "log.error(\"charge_failed\", order_id=o.id, provider=\"acme\", attempts=3, error=type(e).__name__)", "log.info(f\"user {email} with card {card_number} failed\")", "log.debug(\"here\")"], answer: 1,
          explain: "A stable event name plus key-value fields is searchable and aggregatable. Personal data such as emails and card numbers must never be logged." },
        { q: "Why should configuration be validated at startup?", options: ["A missing or malformed value then fails the deploy immediately instead of failing a user request hours later", "It is faster", "Config cannot change", "Linters require it"], answer: 0,
          explain: "Fail fast applies to configuration too. Parse config into a typed object at boot and refuse to start if a required value is missing." },
        { q: "Before optimising a slow endpoint you should first…", options: ["Rewrite it in a faster language", "Add caching everywhere", "Measure: reproduce, profile, and find where time actually goes", "Parallelise every loop"], answer: 2,
          explain: "Intuition about bottlenecks is usually wrong. A profile or trace shows the hot spot, often an N+1 query or a chatty network call rather than CPU." },
        { q: "Two requests read a counter, add one and write it back at the same time. What is the bug?", options: ["A deadlock", "A memory leak", "Nothing", "A lost update caused by a read-modify-write race"], answer: 3,
          explain: "Both read the same old value, so one increment disappears. Use an atomic operation, a lock, or a conditional update such as UPDATE ... SET n = n + 1." },
        { q: "A feature flag check is scattered through 30 if-statements. The best improvement is…", options: ["Add more flags", "Evaluate the flag once at a decision point and branch to two implementations behind one interface", "Hardcode it to true", "Move it to a comment"], answer: 1,
          explain: "Centralising the decision keeps both paths testable and makes the flag easy to delete. Scattered checks turn into permanent, untested branches." },
        { q: "An outbound HTTP call has no timeout. What is the risk?", options: ["None", "Higher costs only", "A slow dependency ties up threads or connections until the whole service stalls", "Lost logs"], answer: 2,
          explain: "Without timeouts, a dependency's slowness becomes your outage. Every network call needs a timeout, and retries need limits and backoff." }
      ]
    },
    "clean-names": {
      title: "Names, functions & comments checkpoint",
      sub: "Intent-revealing names, small functions and comments that earn their place.",
      questions: [
        { q: "Which rule best describes how long a name should be?", options: ["Proportional to the scope in which it is visible", "Always at least eight characters", "As short as possible everywhere", "Whatever the original author preferred"], answer: 0,
          explain: "A name read three lines after it is declared needs little context; a name read across a whole module needs a lot. Matching length to scope keeps small loops terse and public APIs descriptive." },
        { q: "A function named saveUser also sends a welcome email. What is the main problem?", options: ["The name is too short", "It should be a class", "Email should be sent before saving", "It hides a side effect the caller cannot guess from the name"], answer: 3,
          explain: "Callers trust names. A hidden side effect means a retry, a test or a bulk import can send emails nobody expected. Either rename it to say both things or split the email out." },
        { q: "Which comment earns its place?", options: ["// increment i", "// The vendor API rejects batches over 50 items, so we chunk at 50", "// loop over users", "// TODO"], answer: 1,
          explain: "Good comments carry information the code cannot: constraints, reasons and consequences. The other three either restate the code or say nothing." },
        { q: "What does command-query separation ask of a function?", options: ["Either change state or return information, not both", "Always return a value", "Never take more than two parameters", "Log every call"], answer: 0,
          explain: "A query that also mutates makes reading a value risky. Keeping commands and queries separate lets callers call queries freely, including in tests and assertions." },
        { q: "A function takes seven positional parameters, four of them booleans. Which refactor helps most?", options: ["Reorder the parameters alphabetically", "Add default values to all of them", "Introduce a parameter object with named fields, and split behaviour selected by the booleans", "Convert them to global variables"], answer: 2,
          explain: "Positional booleans are unreadable at the call site and usually mean the function does several jobs. A named options object fixes readability; separate functions fix the mixed responsibilities." },
        { q: "What is the 'one level of abstraction per function' guideline about?", options: ["Functions should be one line", "Each file should hold one function", "Avoid inheritance", "Statements in a function should sit at the same conceptual level, delegating details to helpers"], answer: 3,
          explain: "Mixing 'charge the customer' with string-index arithmetic forces the reader to change altitude constantly. Keeping each function at one level lets you read top-down like a summary." }
      ]
    },
    "clean-errors": {
      title: "Errors & state checkpoint",
      sub: "Exceptions, result types, null handling and immutability.",
      questions: [
        { q: "A config file is missing at startup. What should the service usually do?", options: ["Continue with empty settings", "Fail fast with a clear message naming the missing file", "Retry forever", "Log at debug level and continue"], answer: 1,
          explain: "Starting with silently defaulted config produces confusing behaviour far from the cause. Failing at startup with a precise message makes the problem obvious while it is cheap to fix." },
        { q: "When is a result type (for example Result<Ok, Err>) a better fit than throwing?", options: ["Never; exceptions are always better", "Only for network errors", "When failure is an expected, ordinary outcome the caller must handle, like validation", "When performance does not matter"], answer: 2,
          explain: "Expected failures belong in the return type so the compiler or reader cannot ignore them. Exceptions suit truly exceptional conditions that most callers cannot handle locally." },
        { q: "What is wrong with `catch (e) {}`?", options: ["It erases evidence of failure, so the program continues in an unknown state", "Nothing if it is commented", "It is slower than rethrowing", "It only works in Java"], answer: 0,
          explain: "An empty catch turns a loud bug into a silent wrong answer. If you truly can ignore an error, catch the specific type and explain why in a comment." },
        { q: "Why do value objects (for example Money, EmailAddress) tend to be immutable?", options: ["Immutability is required by every language", "Because they are stored in databases", "To make them faster to construct", "So they can be shared freely without defensive copies and their invariants hold for their whole life"], answer: 3,
          explain: "If nobody can change a Money after construction, validation runs once and every holder can trust it. Mutable value objects force copies and invite aliasing bugs." },
        { q: "A method returns a list that callers sometimes modify, corrupting internal state. The cleanest fix?", options: ["Document 'do not modify'", "Return an unmodifiable view or a copy", "Make the field public", "Catch the resulting errors later"], answer: 1,
          explain: "Handing out a mutable reference to internal state breaks encapsulation. An unmodifiable view or copy keeps the invariant inside the object that owns it." },
        { q: "Where should most error translation (for example SQL error to 'order not found') happen?", options: ["At the boundary of the layer that understands both sides", "At every call site", "In the UI only", "Nowhere; propagate raw errors"], answer: 0,
          explain: "The data layer knows what a constraint violation means for its domain. Translating there gives upper layers meaningful errors without leaking storage details." }
      ]
    },
    "clean-structure": {
      title: "Cohesion & coupling checkpoint",
      sub: "Cohesion, coupling, information hiding and deep modules.",
      questions: [
        { q: "High cohesion in a module means…", options: ["It has many public methods", "It imports many other modules", "Its parts change together for the same reasons", "It is large"], answer: 2,
          explain: "Cohesion is about shared purpose. When everything in a module changes for the same reason, a change lands in one place instead of being scattered." },
        { q: "Two services must be deployed together every time either changes. What does that signal?", options: ["Good cohesion", "A healthy release process", "Too many tests", "Tight coupling across a boundary that was meant to be independent"], answer: 3,
          explain: "Lockstep deployment means a contract between them is implicit or unstable. Either make the contract explicit and versioned, or admit they are one unit." },
        { q: "What is a 'deep' module?", options: ["One with many layers of inheritance", "One whose simple interface hides a lot of useful implementation", "One stored in a nested folder", "One with long functions"], answer: 1,
          explain: "Depth measures how much functionality you get per unit of interface you must learn. A file system call that hides caching, buffering and devices is deep; a pass-through wrapper is shallow." },
        { q: "Which coupling is generally weakest (least harmful)?", options: ["Sharing mutable global state", "Depending on another module's private fields", "Depending on a stable, narrow interface with plain data", "Relying on the order another module initialises in"], answer: 2,
          explain: "Coupling to a small, stable contract with data in and data out is easy to reason about and change. Shared mutable state and hidden ordering assumptions are the expensive kinds." },
        { q: "A class exposes getters and setters for every field and callers implement the logic. What is lost?", options: ["Information hiding: the invariants now live in every caller instead of the class", "Nothing", "Performance", "Type safety"], answer: 0,
          explain: "When behaviour lives outside the data, every caller must re-implement and keep consistent the rules. Moving the behaviour next to the data restores one place to enforce them." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.clean = {
    id: "clean",
    name: "Clean Code",
    short: "CLEAN",
    tagline: "Code the next reader understands on the first pass",
    color: "#d4a373",
    blurb: "The everyday decisions that make code cheap to read and safe to change: names that carry intent, functions that do one thing, comments that explain why, error handling you can reason about, immutable values, and modules with high cohesion and low coupling.",
    modules: [
      {
        id: "names",
        name: "Names, Functions & Comments",
        icon: "compass",
        lessons: [
          {
            id: "intent-names",
            title: "Names that carry intent",
            summary: "How to choose names that make code read like a description of the problem, and how long a name should be.",
            minutes: 9,
            tags: ["naming", "readability", "clean-code"],
            blocks: [
              { t: "p", html: "Most of the time you spend with code is spent <strong>reading</strong> it, and names are the densest information in it. A good name answers three questions without the reader scrolling: what is this, why does it exist, and how is it used." },
              { t: "h", text: "The mental model: names are tiny documentation" },
              { t: "p", html: "Every identifier is a promise. <code class='tok'>overdueInvoices</code> promises a collection of invoices that are past due. If it actually holds invoice ids, or includes drafts, the name is now lying \u2014 and lies in names are worse than vague names because readers believe them." },
              { t: "table", headers: ["Rule", "Weak", "Strong"], rows: [
                ["Name the concept, not the type", "<code class='tok'>userList</code>", "<code class='tok'>activeUsers</code>"],
                ["Put units in the name", "<code class='tok'>timeout</code>", "<code class='tok'>timeoutMs</code>"],
                ["Booleans read as predicates", "<code class='tok'>status</code>", "<code class='tok'>isArchived</code>, <code class='tok'>canRetry</code>"],
                ["Functions start with a verb", "<code class='tok'>invoice()</code>", "<code class='tok'>issueInvoice()</code>"],
                ["Use the domain's words", "<code class='tok'>process(rec)</code>", "<code class='tok'>settle(payment)</code>"],
                ["Avoid noise suffixes", "<code class='tok'>OrderManager</code>, <code class='tok'>DataHelper</code>", "<code class='tok'>OrderBook</code>, <code class='tok'>CsvParser</code>"]
              ] },
              { t: "h", text: "How long should a name be?" },
              { t: "p", html: "Length should grow with <strong>scope</strong>. A loop index read on the next line can be <code class='tok'>i</code>. A module-level constant read in forty places needs to be self-explanatory and greppable: <code class='tok'>MAX_UPLOAD_BYTES</code>. Public API names deserve the most care because you cannot rename them cheaply." },
              { t: "code", lang: "javascript", code:
                "// Before: the reader must reverse-engineer intent\n" +
                "function chk(u, d) {\n" +
                "  return u.e && (Date.now() - u.l) / 864e5 < d;\n" +
                "}\n\n" +
                "// After: the call site reads like the rule\n" +
                "const MS_PER_DAY = 86_400_000;\n" +
                "function isRecentlyActive(user, withinDays) {\n" +
                "  const daysSinceLogin = (Date.now() - user.lastLoginAt) / MS_PER_DAY;\n" +
                "  return user.emailVerified && daysSinceLogin < withinDays;\n" +
                "}"
              },
              { t: "widget", id: "cleanNamingLab" },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Descriptive names cost keystrokes and line width, and over-long names (<code class='tok'>listOfAllCurrentlyActivePremiumUsers</code>) bury the important word. When a name gets that long, it is often telling you the concept deserves a type or a function of its own." },
              { t: "cue", html: "<strong>Spotting it in review:</strong> names ending in <em>Manager, Helper, Util, Data, Info</em>; numbered variables (<code class='tok'>data2</code>); a boolean you have to negate twice to read; a comment explaining what a variable holds \u2014 rename instead." },
              { t: "note", variant: "tip", html: "Rename aggressively. Modern editors rename safely across a codebase, and a name that was right last year may be wrong now that the domain has moved on." },
              { t: "note", variant: "key", html: "<strong>A name is a promise to every future reader.</strong> Name the concept in the domain's words, scale length with scope, and rename the moment the promise stops being true." }
            ]
          },
          {
            id: "small-functions",
            title: "Functions that do one thing",
            summary: "Size, levels of abstraction, parameters, side effects and command-query separation \u2014 with a smell-spotting lab.",
            minutes: 11,
            tags: ["functions", "side-effects", "parameters", "smells"],
            blocks: [
              { t: "p", html: "\"Do one thing\" sounds vague until you use this test: <strong>can you describe the function in one sentence without the word 'and'?</strong> If the honest description is \"validates the order and charges the card and emails the receipt\", you have three functions sharing one name." },
              { t: "h", text: "Mechanism: one level of abstraction" },
              { t: "p", html: "Read a good function top to bottom and every line sits at the same altitude. High-level steps call well-named helpers; helpers deal with details. Mixing the two forces the reader to switch context every line." },
              { t: "code", lang: "python", code:
                "def place_order(cart, customer, payments, mailer):\n" +
                "    order = build_order(cart, customer)      # same altitude\n" +
                "    validate(order)                          # same altitude\n" +
                "    receipt = payments.charge(order.total, customer.card)\n" +
                "    mailer.send_receipt(customer.email, receipt)\n" +
                "    return order\n\n" +
                "# The details live one level down, each testable alone\n" +
                "def build_order(cart, customer):\n" +
                "    lines = [OrderLine(i.sku, i.qty, i.unit_price) for i in cart.items]\n" +
                "    return Order(customer.id, lines)"
              },
              { t: "h", text: "Parameters and side effects" },
              { t: "table", headers: ["Signal", "Why it hurts", "Usual fix"], rows: [
                ["Boolean flag argument", "The function does two things; call sites read <code class='tok'>render(true)</code>", "Two functions, or a named option"],
                ["More than three or four positional params", "Call sites become unreadable and easy to misorder", "Parameter object or builder"],
                ["Output parameters (mutating an argument)", "Callers cannot see the change", "Return the new value"],
                ["Hidden side effect", "A query that writes, a getter that fetches", "Rename to say it, or split"],
                ["Query that also mutates", "Breaks command-query separation; unsafe to call twice", "Separate the command from the query"]
              ] },
              { t: "widget", id: "cleanSmellSpotter" },
              { t: "h", text: "The trade-off" },
              { t: "compare",
                bad: { title: "Too big", items: ["Several responsibilities hidden behind one name", "Hard to test one path without the others", "Changes collide in review"] },
                good: { title: "Too small", items: ["Logic fragmented across ten three-line helpers", "Reader jumps around to follow one rule", "Names start to repeat the code"] } },
              { t: "p", html: "Small is a means, not a goal. Extract a function when it gives a <strong>name</strong> to an idea, hides a detail, or makes a path testable. Do not extract a function that will only ever be read alongside its single caller and whose name would just restate its body." },
              { t: "note", variant: "trap", html: "Line-count rules (\"no function over 20 lines\") get gamed. A 40-line function that is a flat, well-commented sequence of steps can be clearer than eight tiny functions with invented names." },
              { t: "note", variant: "key", html: "<strong>One sentence, no 'and'.</strong> Keep each function at one level of abstraction, make side effects visible in the name, and prefer returning values over mutating arguments." }
            ]
          },
          {
            id: "comments",
            title: "Comments that earn their place",
            summary: "When a comment adds information the code cannot, when it is noise, and how to keep comments from rotting.",
            minutes: 8,
            tags: ["comments", "documentation", "readability"],
            blocks: [
              { t: "p", html: "Code says <strong>what</strong> and <strong>how</strong>. Only a comment can say <strong>why</strong> \u2014 why this odd constant, why not the obvious approach, why this order matters. A comment that repeats the code costs reading time and goes stale the first time someone edits the line beneath it." },
              { t: "table", headers: ["Kind", "Example", "Keep?"], rows: [
                ["Restates code", "<code class='tok'>// increment counter</code>", "No \u2014 delete it"],
                ["Explains intent or constraint", "<code class='tok'>// API rejects >50 ids per call, so chunk</code>", "Yes"],
                ["Warns of consequence", "<code class='tok'>// Order matters: cache must clear before publish</code>", "Yes"],
                ["Commented-out code", "<code class='tok'>// oldCalc(x)</code>", "No \u2014 version control remembers it"],
                ["TODO without owner or ticket", "<code class='tok'>// TODO fix</code>", "Only with a ticket id and reason"],
                ["Public API doc", "docstring on an exported function", "Yes \u2014 contract, params, errors"]
              ] },
              { t: "h", text: "Prefer making the code say it" },
              { t: "code", lang: "java", code:
                "// Before\n" +
                "// check if the user is eligible for the trial\n" +
                "if (u.getAgeDays() < 30 && !u.hasPaid() && u.getRegion() != Region.EMBARGOED) { ... }\n\n" +
                "// After: the comment became a name\n" +
                "if (isEligibleForTrial(u)) { ... }\n\n" +
                "// A comment that still earns its place\n" +
                "// Trial window is 30 days by contract with the reseller (see ADR-0017);\n" +
                "// do not shorten without legal sign-off.\n" +
                "private static final int TRIAL_WINDOW_DAYS = 30;"
              },
              { t: "h", text: "Keeping comments honest" },
              { t: "ul", items: [
                "Put the comment next to the code it explains, not in a header block far above.",
                "Review comments in pull requests like code: a stale comment is a bug.",
                "Link to the durable reason (ticket, ADR, incident) instead of re-telling the story.",
                "Delete commented-out code; it rots and nobody dares remove it later."
              ] },
              { t: "note", variant: "warn", html: "A wrong comment is worse than none: readers trust prose over code they have not traced. If you change behaviour, re-read every comment within a screen of the change." },
              { t: "quiz", id: "clean-names" },
              { t: "note", variant: "key", html: "<strong>Comments explain why; code explains what.</strong> First try to make the code say it with a better name. Keep only comments that carry constraints, reasons or warnings the code cannot express." }
            ]
          }
        ]
      },
      {
        id: "errors",
        name: "Errors & State",
        icon: "shield",
        lessons: [
          {
            id: "error-handling",
            title: "Error handling you can reason about",
            summary: "Fail fast, catch narrowly, translate at boundaries, and never let a failure disappear.",
            minutes: 10,
            tags: ["errors", "exceptions", "fail-fast"],
            blocks: [
              { t: "p", html: "Error handling is where clean code usually gets messy, because every function suddenly needs to think about the unhappy path. The goal is not to handle every error everywhere; it is to <strong>handle each error exactly once, in the place that knows what to do about it</strong>." },
              { t: "h", text: "Four rules that cover most cases" },
              { t: "ol", items: [
                "<strong>Fail fast.</strong> Detect bad input and impossible states as early as possible, with a message that names the cause.",
                "<strong>Catch narrowly.</strong> Catch the specific error types you can recover from; let the rest propagate.",
                "<strong>Translate at boundaries.</strong> Convert low-level errors into domain errors where both meanings are known.",
                "<strong>Never swallow.</strong> If you deliberately ignore an error, say why in a comment and log enough to debug."
              ] },
              { t: "code", lang: "python", code:
                "class OrderNotFound(Exception):\n" +
                "    pass\n\n" +
                "def find_order(db, order_id: str) -> Order:\n" +
                "    if not order_id:\n" +
                "        raise ValueError(\"order_id must be non-empty\")   # fail fast\n" +
                "    try:\n" +
                "        row = db.fetch_one(\"SELECT * FROM orders WHERE id = %s\", [order_id])\n" +
                "    except db.OperationalError as e:                     # narrow\n" +
                "        raise StorageUnavailable(\"orders db unreachable\") from e  # translate, keep cause\n" +
                "    if row is None:\n" +
                "        raise OrderNotFound(order_id)\n" +
                "    return Order.from_row(row)"
              },
              { t: "h", text: "Where errors get handled" },
              { t: "table", headers: ["Layer", "Responsibility"], rows: [
                ["Low-level code", "Detect and raise precise errors; attach the cause"],
                ["Domain / service", "Translate infrastructure errors into domain meaning; decide retries"],
                ["Boundary (HTTP handler, job runner, CLI)", "Map to status codes or exit codes, log once with context, return a safe message"]
              ] },
              { t: "compare",
                bad: { title: "Defensive everywhere", items: ["try/catch in every function", "Each layer logs the same error again", "Errors converted to null and lost", "Stack traces never reach anyone"] },
                good: { title: "Handled once", items: ["Low-level code raises precise errors", "Boundaries log once with request context", "Retries decided where the policy lives", "Unknown errors crash loudly in development"] } },
              { t: "note", variant: "trap", html: "Logging and rethrowing at every layer produces five copies of one error in your logs, each with less context than the last. Log at the boundary that finally handles it." },
              { t: "note", variant: "key", html: "<strong>Handle each error once, where someone knows what to do.</strong> Fail fast, catch narrowly, translate at layer boundaries, keep the cause, and never let a failure vanish." }
            ]
          },
          {
            id: "null-and-results",
            title: "Nulls, optionals and result types",
            summary: "Make absence and expected failure visible in the type instead of in tribal knowledge.",
            minutes: 9,
            tags: ["null", "optional", "result-type", "errors"],
            blocks: [
              { t: "p", html: "A function that can return null without saying so turns every caller into a guessing game. The fix is the same idea in every language: <strong>put the possibility of absence or failure into the signature</strong> so the reader and the compiler both see it." },
              { t: "table", headers: ["Situation", "Prefer", "Avoid"], rows: [
                ["Value may legitimately be absent", "<code class='tok'>Optional&lt;User&gt;</code>, <code class='tok'>User | None</code>, nullable type with checks enforced", "Returning null from a method documented as returning User"],
                ["Collection may be empty", "Return an empty collection", "Returning null for 'no items'"],
                ["Expected, recoverable failure (validation, not found)", "Result / Either type, or a specific checked error", "Generic exceptions caught by string matching"],
                ["Programming error (impossible state)", "Throw / assert loudly", "Returning a sentinel such as -1"]
              ] },
              { t: "code", lang: "javascript", code:
                "// A tiny result shape: explicit, serialisable, easy to test\n" +
                "function parseQuantity(input) {\n" +
                "  const n = Number(input);\n" +
                "  if (!Number.isInteger(n)) return { ok: false, error: \"not a whole number\" };\n" +
                "  if (n < 1 || n > 99) return { ok: false, error: \"must be 1-99\" };\n" +
                "  return { ok: true, value: n };\n" +
                "}\n\n" +
                "const r = parseQuantity(form.qty);\n" +
                "if (!r.ok) showFieldError(\"qty\", r.error);\n" +
                "else cart.setQuantity(sku, r.value);"
              },
              { t: "h", text: "The trade-off" },
              { t: "p", html: "Result types make the happy path a little noisier, and in languages without good support they can sprawl into <code class='tok'>if (!r.ok)</code> chains. Use them for failures callers are <em>expected</em> to handle; keep exceptions for the rare, cross-cutting failures nobody nearby can fix." },
              { t: "note", variant: "tip", html: "Return empty collections, never null collections. It removes a whole class of null checks at zero cost, because looping over nothing is already correct." },
              { t: "note", variant: "key", html: "<strong>If it can be absent or fail, the signature should say so.</strong> Optionals for absence, empty collections for 'none', result types for expected failures, exceptions for the truly exceptional." }
            ]
          },
          {
            id: "immutability",
            title: "Immutability and value objects",
            summary: "Why values that cannot change are easier to share, test and reason about \u2014 and where mutation still wins.",
            minutes: 9,
            tags: ["immutability", "value-objects", "state"],
            blocks: [
              { t: "p", html: "Most hard bugs involve state that changed when you did not expect it. If a value <strong>cannot</strong> change after it is built, you can pass it anywhere, cache it, share it across threads and compare it by value without wondering who else holds a reference." },
              { t: "h", text: "Value objects" },
              { t: "p", html: "A value object wraps a primitive with its rules: <code class='tok'>Money</code> instead of a float, <code class='tok'>EmailAddress</code> instead of a string. Validate once in the constructor, make it immutable, and every holder can trust it for its whole life." },
              { t: "code", lang: "java", code:
                "public record Money(long cents, Currency currency) {\n" +
                "    public Money {\n" +
                "        if (cents < 0) throw new IllegalArgumentException(\"negative money\");\n" +
                "        Objects.requireNonNull(currency);\n" +
                "    }\n" +
                "    public Money plus(Money other) {\n" +
                "        if (!currency.equals(other.currency)) throw new IllegalArgumentException(\"currency mismatch\");\n" +
                "        return new Money(cents + other.cents, currency);   // new value, no mutation\n" +
                "    }\n" +
                "}"
              },
              { t: "table", headers: ["Technique", "What it prevents"], rows: [
                ["Final / readonly fields, records, frozen dataclasses", "Accidental reassignment after construction"],
                ["Return copies or unmodifiable views of internal collections", "Callers mutating your invariants"],
                ["Copy-on-write updates (<code class='tok'>{...state, qty: 2}</code>)", "Shared references seeing half-updated state"],
                ["Persistent data structures", "Expensive full copies when values are large"]
              ] },
              { t: "h", text: "The trade-off" },
              { t: "compare",
                bad: { title: "Where mutation still wins", items: ["Tight numeric loops and buffers", "Large structures updated in place under a lock", "Builders that assemble a value step by step", "Local variables that never escape a function"] },
                good: { title: "Where immutability wins", items: ["Domain values passed across layers", "Anything shared between threads", "Cache keys and map keys", "Event payloads and messages"] } },
              { t: "note", variant: "tip", html: "Local mutation is fine. A function that builds a list with a loop and returns it is effectively pure from the outside. The danger is mutation that escapes." },
              { t: "quiz", id: "clean-errors" },
              { t: "note", variant: "key", html: "<strong>Values that cannot change cannot surprise you.</strong> Wrap primitives in validated, immutable value objects, never hand out mutable internals, and keep mutation local." }
            ]
          }
        ]
      },
      {
        id: "structure",
        name: "Cohesion & Coupling",
        icon: "blocks",
        lessons: [
          {
            id: "cohesion-coupling",
            title: "Cohesion, coupling and the cost of change",
            summary: "The two forces behind almost every design guideline, and how to measure them by asking what changes together.",
            minutes: 10,
            tags: ["cohesion", "coupling", "modularity", "design"],
            blocks: [
              { t: "p", html: "Nearly every design rule you will hear is a special case of two ideas. <strong>Cohesion</strong>: things that change together should live together. <strong>Coupling</strong>: things that change separately should depend on each other as little, and as explicitly, as possible." },
              { t: "h", text: "A practical test" },
              { t: "p", html: "Take the last five changes to a module. If each one touched only that module, cohesion is high. If each one also forced edits in three other modules, coupling is high. Your version-control history is the most honest design review you have." },
              { t: "table", headers: ["Coupling kind", "Example", "How bad"], rows: [
                ["Data (plain values through a narrow interface)", "<code class='tok'>priceFor(sku, qty)</code>", "Mild \u2014 the goal"],
                ["Stamp (passing a big object, using one field)", "<code class='tok'>priceFor(order)</code> reading only <code class='tok'>order.sku</code>", "Moderate \u2014 hidden dependency on shape"],
                ["Control (a flag telling another module what to do)", "<code class='tok'>save(user, skipValidation=true)</code>", "Moderate \u2014 caller knows callee's internals"],
                ["Shared mutable state", "A global config dict both modules write", "High \u2014 order-dependent bugs"],
                ["Content (reaching into internals)", "Reading another class's private field via reflection", "Severe \u2014 any refactor breaks you"],
                ["Temporal (hidden ordering)", "<code class='tok'>init()</code> must run before <code class='tok'>load()</code>, nobody enforces it", "High \u2014 fails only in some paths"]
              ] },
              { t: "h", text: "Raising cohesion" },
              { t: "ul", items: [
                "Group by <strong>reason to change</strong> (billing rules, tax rules) rather than by technical layer alone.",
                "Move behaviour to the data it uses: if a function reads five fields of <code class='tok'>Order</code>, it probably belongs on <code class='tok'>Order</code>.",
                "Split a module when two groups of functions never call each other and change for different people."
              ] },
              { t: "note", variant: "trap", html: "DRY can increase coupling. Merging two pieces of code that look alike but change for different reasons ties their futures together. Duplication is cheaper than the wrong abstraction." },
              { t: "table", headers: ["Level", "How this scores at each level"], rows: [
                ["Mid", "Spots obvious god classes and shared mutable state, and splits them"],
                ["Senior", "Reasons from change history about what belongs together; chooses explicit contracts at boundaries"],
                ["Staff", "Shapes module and team boundaries so that common changes stay inside one team's code"]
              ] },
              { t: "note", variant: "key", html: "<strong>Ask what changes together.</strong> Put those things in one place, and make every dependency between places narrow, explicit and stable." }
            ]
          },
          {
            id: "deep-modules",
            title: "Information hiding and deep modules",
            summary: "Interfaces that are small compared with what they hide, and why pass-through layers make systems harder.",
            minutes: 9,
            tags: ["information-hiding", "abstraction", "interfaces"],
            blocks: [
              { t: "p", html: "A module is a trade: callers learn its interface, and in exchange they do not have to learn its implementation. A <strong>deep</strong> module gives you a lot of functionality for a small interface. A <strong>shallow</strong> one makes you learn an interface almost as complex as the code it wraps." },
              { t: "stat", items: [
                { v: "1 call", k: "open a file: hides caching, buffering, drivers" },
                { v: "12 methods", k: "a typical shallow wrapper that hides nothing" }
              ] },
              { t: "h", text: "Mechanism: hide decisions, not just data" },
              { t: "p", html: "Information hiding means each module owns a <em>design decision</em> that others should not depend on: the storage format, the retry policy, the pricing formula. If that decision changes, only one module changes." },
              { t: "code", lang: "javascript", code:
                "// Shallow: every caller must know the retry and backoff policy\n" +
                "client.setRetries(3);\n" +
                "client.setBackoffMs(200);\n" +
                "client.setJitter(true);\n" +
                "const res = client.get(url);\n\n" +
                "// Deep: the policy is a decision the module owns\n" +
                "const rates = await fxRates.latest(\"EUR\");   // retries, caching, staleness all hidden"
              },
              { t: "compare",
                bad: { title: "Shallow signs", items: ["Pass-through methods that just call the next layer", "Getters and setters for every field", "Callers must call methods in a specific order", "Configuration knobs for decisions callers should not make"] },
                good: { title: "Deep signs", items: ["Few methods, each doing substantial work", "Sensible defaults; options only where callers truly differ", "Invariants enforced inside", "Errors reported in the caller's vocabulary"] } },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas covers object-oriented building blocks and design patterns in its <em>Low-Level Design</em> track. This track stays on the judgement calls that apply whatever pattern you pick." },
              { t: "quiz", id: "clean-structure" },
              { t: "note", variant: "key", html: "<strong>A good module is a small door into a big room.</strong> Hide one design decision per module, keep interfaces narrow, and treat every pass-through layer as a cost you must justify." }
            ]
          }
        ]
      },
      {
        id: "ops",
        name: "Production-Ready Code",
        icon: "bolt",
        lessons: [
          {
            id: "defensive-programming",
            title: "Defensive programming without paranoia",
            summary: "Validate at trust boundaries, assert invariants, set timeouts \u2014 and stop checking the same thing in every function.",
            minutes: 10,
            tags: ["defensive-programming", "validation", "assertions", "timeouts"],
            blocks: [
              { t: "p", html: "Defensive programming means code that <strong>fails safely and loudly</strong> when the world does not match its assumptions. Done badly, it means null checks in every function and errors swallowed \"just in case\". The difference is <em>where</em> you defend." },
              { t: "table", headers: ["Defend here", "How"], rows: [
                ["Trust boundaries (HTTP, queues, files, config, third-party responses)", "Parse into trusted types; reject invalid input with a clear error"],
                ["Invariants inside your code", "Assertions that crash loudly if 'impossible' happens"],
                ["Calls to other systems", "Timeouts, bounded retries with backoff, circuit breakers"],
                ["Resources", "Close files and connections deterministically (with, try-with-resources, defer)"],
                ["Destructive operations", "Dry-run flags, confirmation, limits on blast radius"]
              ] },
              { t: "code", lang: "python", code:
                "def handle_refund(request):\n" +
                "    cmd = RefundCommand.parse(request.json)        # boundary: reject bad input here\n" +
                "    order = orders.get(cmd.order_id)\n" +
                "    assert order.currency == cmd.currency, \"currency mismatch should be impossible after parse\"\n" +
                "    with payments.session(timeout_s=5) as p:       # bounded wait, resource closed\n" +
                "        return p.refund(order.id, cmd.amount, idempotency_key=cmd.key)"
              },
              { t: "compare",
                bad: { title: "Paranoid", items: ["Null checks in every helper", "Catch-all that returns defaults", "Validation repeated at each layer", "Real bugs hidden behind fallbacks"] },
                good: { title: "Defensive", items: ["Validate once at the boundary", "Assert invariants, crash on violation", "Timeouts on every network call", "Idempotency keys for retried writes"] } },
              { t: "note", variant: "warn", html: "A fallback that hides a failure (return an empty list, default to 0) is the opposite of defensive. It converts a loud bug into silent wrong data." },
              { t: "note", variant: "key", html: "<strong>Defend at the edges, assert in the middle.</strong> Parse untrusted input once, crash loudly on broken invariants, and put timeouts and limits on everything that talks to the outside world." }
            ]
          },
          {
            id: "logging",
            title: "Logging that helps at 3 a.m.",
            summary: "Structured events, the right levels, correlation ids \u2014 and what must never be logged.",
            minutes: 11,
            tags: ["logging", "observability", "structured-logging", "privacy"],
            blocks: [
              { t: "p", html: "Logs are written by developers and read by whoever is on call, usually under pressure. Good logging answers <strong>what happened, to which request, and why</strong>, in a form a machine can search." },
              { t: "code", lang: "python", code:
                "# Unsearchable prose\n" +
                "log.info(f\"Something failed for user {user.email} while paying\")\n\n" +
                "# Structured event: stable name, ids, no personal data\n" +
                "log.error(\"payment.charge_failed\",\n" +
                "          order_id=order.id, request_id=ctx.request_id,\n" +
                "          provider=\"acme\", attempts=3, error=type(e).__name__)"
              },
              { t: "table", headers: ["Level", "Use for", "Production"], rows: [
                ["ERROR", "A failure needing action; logged once where handled", "Always on; often alerts"],
                ["WARN", "Abnormal but handled: retries, fallbacks, deprecated usage", "On; watched as a trend"],
                ["INFO", "Key business and lifecycle events", "On, at moderate volume"],
                ["DEBUG", "Diagnostic detail for developers", "Off, or sampled briefly"]
              ] },
              { t: "widget", id: "cleanLogLevelDrill" },
              { t: "h", text: "Rules worth enforcing" },
              { t: "ul", items: [
                "<strong>Never log secrets or personal data</strong>: passwords, tokens, card numbers, full emails. Redact at the logger, not by hoping.",
                "<strong>Propagate a correlation id</strong> through every service so one request can be followed end to end.",
                "<strong>Log once</strong>, at the layer that handles the error, with the cause attached.",
                "<strong>Metrics for counts, logs for stories.</strong> High-volume events belong in counters, not log lines."
              ] },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Forge, the DevSecOps atlas, covers centralised logging and audit trails in its <em>Program, Governance &amp; Resilience</em> track." },
              { t: "note", variant: "key", html: "<strong>Log structured events with ids, at the right level, once.</strong> Never log secrets or personal data, and use metrics for anything you would only count." }
            ]
          },
          {
            id: "config-flags",
            title: "Configuration and feature flags in code",
            summary: "Typed config validated at startup, secrets from a store, and flags that stay few, central and short-lived.",
            minutes: 11,
            tags: ["configuration", "feature-flags", "twelve-factor", "secrets"],
            blocks: [
              { t: "p", html: "Configuration is everything that varies between environments: URLs, limits, credentials, toggles. It belongs <strong>outside</strong> the code, but the code should still treat it with the same rigour as input from users." },
              { t: "code", lang: "python", code:
                "@dataclass(frozen=True)\n" +
                "class Settings:\n" +
                "    payments_url: str\n" +
                "    request_timeout_s: float\n" +
                "    payments_api_key: str          # injected from the secret store, never committed\n\n" +
                "def load_settings(env) -> Settings:\n" +
                "    missing = [k for k in (\"PAYMENTS_URL\", \"PAYMENTS_API_KEY\") if not env.get(k)]\n" +
                "    if missing:\n" +
                "        raise SystemExit(f\"missing required config: {', '.join(missing)}\")   # fail at boot\n" +
                "    return Settings(env[\"PAYMENTS_URL\"], float(env.get(\"REQUEST_TIMEOUT_S\", \"5\")), env[\"PAYMENTS_API_KEY\"])"
              },
              { t: "table", headers: ["Practice", "Why"], rows: [
                ["Parse config into a typed object at startup", "Bad config fails the deploy, not a user request"],
                ["Secrets from a secret store or injected env, never in the repo", "Committed secrets are leaked secrets"],
                ["No environment names or IDs hardcoded in logic", "if env == \"prod\" branches rot and differ per stage"],
                ["Defaults only for safe, non-secret values", "A missing secret should be an error, not a blank"]
              ] },
              { t: "h", text: "Feature flags: kinds and hygiene" },
              { t: "table", headers: ["Kind", "Lifetime", "Example"], rows: [
                ["Release flag", "Days to weeks", "Ship incomplete work dark on trunk"],
                ["Experiment flag", "Weeks", "A/B test a checkout layout"],
                ["Ops flag / kill switch", "Long-lived", "Turn off recommendations under load"],
                ["Permission flag", "Long-lived", "Enable a feature for one customer tier"]
              ] },
              { t: "code", lang: "javascript", code:
                "// Decide once, at the edge; both paths sit behind one interface\n" +
                "const pricing = flags.isOn(\"new-pricing\", { tenant }) ? newPricing : legacyPricing;\n" +
                "const total = pricing.quote(cart);"
              },
              { t: "note", variant: "trap", html: "Every release flag needs an owner and a removal date. Flags left in place become permanent untested branches; teams have had outages from flipping a flag nobody remembered." },
              { t: "note", variant: "key", html: "<strong>Config is input: type it, validate it at boot, keep secrets out of the repo.</strong> Flags are temporary branches: evaluate once, keep both paths tested, and delete them on schedule." }
            ]
          },
          {
            id: "performance-basics",
            title: "Performance-aware coding: measure first",
            summary: "Write sensibly by default, profile before optimising, and know the handful of mistakes that cause most slowness.",
            minutes: 11,
            tags: ["performance", "profiling", "big-o", "n-plus-one"],
            blocks: [
              { t: "p", html: "Most code does not need to be fast; it needs to not be <em>needlessly</em> slow. Write clear code with sensible defaults, then let <strong>measurement</strong>, not intuition, decide what to optimise." },
              { t: "ol", items: [
                "<strong>Reproduce</strong> the slowness with realistic data and a number: \"p95 1.8 s on the orders list\".",
                "<strong>Profile or trace</strong> to see where the time goes \u2014 CPU, database, network, locks.",
                "<strong>Fix the biggest cost</strong>, then measure again. Stop when you meet the target."
              ] },
              { t: "table", headers: ["Common culprit", "Symptom", "Usual fix"], rows: [
                ["N+1 queries", "One query per item in a loop", "Batch or join"],
                ["Quadratic loops", "Fine with 100 items, dies with 100,000", "Use a set or map for lookups"],
                ["Chatty network calls", "Many small round trips", "Batch requests; cache safely"],
                ["Loading everything", "Memory spikes, slow first byte", "Paginate or stream"],
                ["Missing index", "Slow filtered queries", "Check the query plan; add an index"],
                ["Repeated work", "Same value recomputed per call", "Compute once; memoise pure functions"]
              ] },
              { t: "code", lang: "python", code:
                "# O(n*m): list membership inside a loop\n" +
                "blocked = [c.id for c in blocked_customers]\n" +
                "eligible = [o for o in orders if o.customer_id not in blocked]\n\n" +
                "# O(n+m): set membership\n" +
                "blocked = {c.id for c in blocked_customers}\n" +
                "eligible = [o for o in orders if o.customer_id not in blocked]"
              },
              { t: "note", variant: "trap", html: "Micro-optimisations without a profile usually make code harder to read and do not move the number that matters. Optimise the measured hot path, and keep a benchmark or test that guards the gain." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Codex, the DSA atlas, covers complexity analysis and data-structure choice in depth." },
              { t: "note", variant: "key", html: "<strong>Measure, then optimise the biggest cost.</strong> Avoid the classic culprits by default \u2014 N+1 queries, quadratic lookups, chatty calls \u2014 and profile before anything clever." }
            ]
          },
          {
            id: "concurrency-pitfalls",
            title: "Concurrency pitfalls in everyday code",
            summary: "Races, lost updates, deadlocks and async mistakes that appear in ordinary web and data code.",
            minutes: 12,
            tags: ["concurrency", "race-conditions", "async", "idempotency"],
            blocks: [
              { t: "p", html: "You do not need to write thread pools to hit concurrency bugs. Two web requests, two job workers, or a retry and its original are enough. These bugs pass every test and appear under load." },
              { t: "table", headers: ["Pitfall", "Example", "Fix"], rows: [
                ["Read-modify-write race", "Two requests increment the same stock counter", "Atomic update, row lock or compare-and-set"],
                ["Check-then-act", "if not exists: create \u2014 twice", "Unique constraint; upsert"],
                ["Duplicate processing", "A message is redelivered and charged twice", "Idempotency keys; dedupe table"],
                ["Deadlock", "Two transactions lock rows in opposite order", "Consistent lock ordering; short transactions"],
                ["Shared mutable state", "A module-level cache mutated by many requests", "Immutable data; thread-safe structures; per-request state"],
                ["Async blocking", "A synchronous call inside an event loop", "Use async clients or offload to a worker"],
                ["Fire-and-forget tasks", "Unawaited promise fails silently", "Await or supervise; log failures"]
              ] },
              { t: "code", lang: "sql", code:
                "-- Race: read stock in app, subtract, write back (two buyers both succeed)\n" +
                "-- Safe: one atomic, conditional statement\n" +
                "UPDATE inventory\n" +
                "SET    on_hand = on_hand - 1\n" +
                "WHERE  sku = 'MUG-01' AND on_hand >= 1;\n" +
                "-- affected rows = 0 means sold out; no lost update possible"
              },
              { t: "note", variant: "tip", html: "Make writes <strong>idempotent</strong> whenever a retry is possible: same key, same effect, however many times it runs. It turns a whole class of concurrency bugs into non-events." },
              { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> The Blueprint atlas's <em>Concurrency In Depth</em> track covers locks, memory models and concurrent designs." },
              { t: "quiz", id: "clean-ops" },
              { t: "note", variant: "key", html: "<strong>Assume everything runs twice and at the same time.</strong> Use atomic updates and constraints instead of check-then-act, make writes idempotent, and never block an event loop." }
            ]
          }
        ]
      }
    ]
  };
  void clear; void h; void ro;
})();
