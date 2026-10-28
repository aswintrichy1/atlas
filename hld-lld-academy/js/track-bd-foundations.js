/* track-bd-foundations.js — Problem Breakdowns · module 1 of 3: Foundations.
   Registers the "breakdowns" track (get-or-create, order independent), owns the
   "foundations" module, the breakdowns-foundations quiz and the bdCapacityLab widget. */
(function () {
  "use strict";

  /* ================================================================
     WIDGETS OWNED BY THIS FILE
     ================================================================ */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      var v = attrs[k];
      if (v == null) continue;
      if (k === "class") el.className = v;
      else if (k === "html") el.innerHTML = v;
      else if (k.indexOf("on") === 0 && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  /* ---------- number formatting: everything lands on 2 significant figures ---------- */
  function safeNum(x) {
    var n = parseFloat(x);
    if (typeof n !== "number" || !isFinite(n) || n < 0) return 0;
    return n;
  }
  function trim(x, d) {
    if (!isFinite(x)) return "0";
    var s = x.toFixed(d);
    if (s.indexOf(".") > -1) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s;
  }
  function sig2(n) {
    if (!isFinite(n) || n <= 0) return 0;
    var e = Math.floor(Math.log(n) / Math.LN10) - 1;
    var m = Math.pow(10, e);
    if (!isFinite(m) || m <= 0) return n;
    return Math.round(n / m) * m;
  }
  function rate(n) {
    n = sig2(n);
    if (n <= 0) return "0/s";
    if (n >= 1e6) return trim(n / 1e6, 1) + "M/s";
    if (n >= 1e3) return trim(n / 1e3, 1) + "k/s";
    if (n >= 1) return trim(n, 1) + "/s";
    return trim(n, 3) + "/s";
  }
  var BYTE_UNITS = [["PB", 1e15], ["TB", 1e12], ["GB", 1e9], ["MB", 1e6], ["KB", 1e3]];
  function bytesOf(n) {
    n = sig2(n);
    if (n <= 0) return "0 B";
    for (var i = 0; i < BYTE_UNITS.length; i++) {
      if (n >= BYTE_UNITS[i][1]) {
        var q = n / BYTE_UNITS[i][1];
        return trim(q, q < 10 ? 1 : 0) + " " + BYTE_UNITS[i][0];
      }
    }
    return Math.round(n) + " B";
  }
  function count(n) {
    n = Math.ceil(n);
    if (!isFinite(n) || n < 0) return 0;
    return n;
  }

  /*  bdCapacityLab — "Do the back-of-envelope".
      Deterministic, no timers, guards junk input, and repaints the readout on
      every control change. */
  Widgets.bdCapacityLab = function (mount) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "estimator"),
      h("h3", {}, "Do the back-of-envelope")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "Four inputs and a retention window. Everything below is derived arithmetic, rounded to two significant figures — the same rounding you should do out loud."));

    /* stated constants — say these numbers in the interview, do not hide them */
    var PEAK = 3;               /* peak-to-average multiplier */
    var SHARD_WPS = 5000;       /* writes/sec one well-tuned primary shard absorbs */
    var CACHE_RPS = 100000;     /* reads/sec one cache node group absorbs */
    var NODE_BYTES = 10e12;     /* 10 TB per storage node */
    var LINK_BYTES = 3.24e14;   /* ~1 Gbps sustained for a 30-day month */

    var st = { dau: 50000000, actions: 2, bytes: 1024, ratio: 50, days: 365, retention: "1 year" };

    var inputs = {};
    function field(key, label, hint) {
      var input = h("input", {
        type: "text", inputmode: "decimal", value: String(st[key]),
        "aria-label": label, style: "width:118px"
      });
      input.value = String(st[key]);
      input.addEventListener("input", function () { st[key] = safeNum(input.value); paint(); });
      input.addEventListener("change", function () { st[key] = safeNum(input.value); paint(); });
      inputs[key] = input;
      return h("label", { class: "w-field", title: hint }, label + " ", input);
    }

    var controls = h("div", { class: "widget-controls" },
      field("dau", "daily active users", "How many humans touch the system in a day."),
      field("actions", "actions / user / day", "Writes each user generates. Fractions are fine."),
      field("bytes", "avg payload bytes", "Bytes stored per action, and bytes shipped per read."),
      field("ratio", "read : write", "Reads per write. Most consumer systems sit between 10 and 500."));

    var seg = h("div", { class: "w-seg" });
    var RETENTIONS = [["1 month", 30], ["1 year", 365], ["5 years", 1825]];
    var segButtons = [];
    for (var r = 0; r < RETENTIONS.length; r++) {
      (function (label, days, idx) {
        var b = h("button", { class: "w-seg-btn" + (label === st.retention ? " active" : "") }, label);
        b.addEventListener("click", function () {
          st.days = days; st.retention = label;
          for (var j = 0; j < segButtons.length; j++) segButtons[j].classList.remove("active");
          b.classList.add("active");
          paint();
        });
        segButtons.push(b);
        seg.appendChild(b);
        void idx;
      })(RETENTIONS[r][0], RETENTIONS[r][1], r);
    }
    controls.appendChild(h("label", { class: "w-field" }, "retention ", seg));

    var PRESETS = [
      ["Link shortener", { dau: 5000000, actions: 1, bytes: 500, ratio: 100 }],
      ["Photo feed", { dau: 300000000, actions: 0.1, bytes: 5000000, ratio: 80 }],
      ["Chat", { dau: 500000000, actions: 40, bytes: 300, ratio: 3 }]
    ];
    for (var p = 0; p < PRESETS.length; p++) {
      (function (label, vals) {
        controls.appendChild(h("button", {
          class: "w-btn", onclick: function () {
            for (var k in vals) {
              if (!Object.prototype.hasOwnProperty.call(vals, k)) continue;
              st[k] = vals[k];
              if (inputs[k]) inputs[k].value = String(vals[k]);
            }
            paint();
          }
        }, label));
      })(PRESETS[p][0], PRESETS[p][1]);
    }
    mount.appendChild(controls);

    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var verdict = h("div", { class: "w-readout", style: "margin-top:8px" });
    stage.appendChild(readout);
    stage.appendChild(verdict);
    mount.appendChild(stage);

    function ro(label, value) {
      return h("span", { class: "ro" }, label + " ", h("b", {}, value));
    }

    function paint() {
      var dau = safeNum(st.dau);
      var actions = safeNum(st.actions);
      var payload = safeNum(st.bytes);
      var ratio = safeNum(st.ratio);
      var days = safeNum(st.days) || 1;

      var writesDay = dau * actions;
      var wps = writesDay / 86400;
      var peakWps = wps * PEAK;
      var rps = wps * ratio;
      var storage = writesDay * payload * days;
      var egress = rps * payload * 86400 * 30;

      readout.innerHTML = "";
      readout.appendChild(ro("writes", rate(wps)));
      readout.appendChild(ro("peak writes (" + PEAK + "x)", rate(peakWps)));
      readout.appendChild(ro("reads", rate(rps)));
      readout.appendChild(ro("stored @ " + st.retention, bytesOf(storage)));
      readout.appendChild(ro("egress / month", bytesOf(egress)));

      verdict.innerHTML = "";
      if (!(writesDay > 0) || !(payload > 0)) {
        verdict.appendChild(h("span", { class: "ro" },
          h("b", {}, "Nothing to size yet. "),
          "Give daily active users, actions per user per day and a payload size a positive number."));
        return;
      }

      var axes = [
        { label: "write throughput", units: peakWps / SHARD_WPS, unit: "primary shard", why: "at " + rate(peakWps) + " peak, assuming ~" + SHARD_WPS.toLocaleString() + " writes/sec per shard" },
        { label: "read fan-out", units: rps / CACHE_RPS, unit: "cache node group", why: "at " + rate(rps) + ", assuming ~100k reads/sec per cache group" },
        { label: "storage", units: storage / NODE_BYTES, unit: "10 TB node", why: bytesOf(storage) + " at " + st.retention + " retention, before replication" },
        { label: "egress", units: egress / LINK_BYTES, unit: "sustained 1 Gbps link", why: bytesOf(egress) + " a month leaving the origin" }
      ];
      var top = axes[0];
      for (var i = 1; i < axes.length; i++) if (axes[i].units > top.units) top = axes[i];

      if (top.units < 1) {
        verdict.appendChild(h("span", { class: "ro" },
          h("b", {}, "Nothing binds. "),
          "Every axis fits inside one commodity unit — one primary, one cache, one storage node. Say so out loud and spend your time on correctness instead of scale."));
        return;
      }
      verdict.appendChild(h("span", { class: "ro" },
        h("b", {}, "Binding constraint: " + top.label + ". "),
        "You need roughly " + count(top.units).toLocaleString() + " x " + top.unit + " — " + top.why + ". That is the number the design has to answer for."));
    }

    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ================================================================
     QUIZ OWNED BY THIS FILE
     ================================================================ */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "breakdowns-foundations": {
      title: "Foundations checkpoint",
      sub: "Ten breakdowns, ten hard parts. One question from each.",
      questions: [
        {
          q: "Your shortener creates five million links a day and generates seven-character base62 codes at random with a conditional insert. Why does seven characters work comfortably where six would not?",
          options: [
            "Six characters cannot encode both letters and digits, only digits.",
            "Seven characters is the longest path segment a redirect response can carry.",
            "Six-character codes cannot be used as a partition key in a key-value store.",
            "Six characters gives about 5.7e10 codes, so a decade of creates fills roughly a third of the space and collision retries climb steeply; seven gives about 3.5e12, where the same volume stays under one percent."
          ],
          answer: 3,
          explain: "Random generation is only cheap while the keyspace is sparse. Retry probability tracks occupancy, so a third-full space means a meaningful fraction of inserts collide and the write path gets a second round trip. Sizing the keyspace against ten years of creates is the calculation that justifies the code length."
        },
        {
          q: "In a chunked file-sync upload, why does the service commit the file manifest to the metadata store only after every chunk is durably in the object store?",
          options: [
            "Chunks are content-addressed, so a chunk nobody points at is harmless garbage the collector reclaims later, while a manifest pointing at a missing chunk is a corrupt file.",
            "The object store cannot accept writes while a metadata transaction is open.",
            "The metadata store is slower, so writing it last shortens the request.",
            "Deduplication only works when the manifest is written last."
          ],
          answer: 0,
          explain: "The two stores fail independently, so you choose which direction the inconsistency points. An orphan chunk costs disk until garbage collection runs; a manifest referencing bytes that never landed is a file the user cannot open. Order the writes so the cheap failure is the one you can have."
        },
        {
          q: "Two reviews for the same restaurant land in the same millisecond. Each request reads avg_rating and review_count, computes the new average, and writes both back. What actually happens, and what is the fix?",
          options: [
            "Nothing goes wrong; the database serializes the two updates for you.",
            "One update is lost because both transactions read the same starting values. Store rating_sum and rating_count and increment them atomically, deriving the average on read.",
            "The search index falls behind the primary; add another read replica.",
            "The review row is inserted twice; add an idempotency key to the insert."
          ],
          answer: 1,
          explain: "This is a plain lost update: read-modify-write without a version check or a lock. Replacing the derived value with two atomic increments removes the read entirely, so concurrent writers commute and the average is computed from state that is always correct. Deriving on read costs nothing at this write rate."
        },
        {
          q: "Why is broadcasting a new delivery order to every courier within two kilometres and letting the first tap win a weak design?",
          options: [
            "Couriers cannot receive more than one push notification at a time.",
            "It breaks the ordering guarantee of the message queue that carries offers.",
            "It turns every order into a contended race that most couriers lose, burns their attention on offers they will not get, and hands you no control over which courier the order should actually go to.",
            "It makes the geospatial index too large to hold in memory."
          ],
          answer: 2,
          explain: "Broadcast optimises for one metric, time-to-acceptance, and wrecks everything else. You lose the ability to rank on distance, direction of travel and acceptance history, and couriers learn to ignore offers because most of them evaporate. A ranked offer with a short expiry keeps the same speed while preserving control."
        },
        {
          q: "Sixty thousand seats, and roughly half a million reserve attempts in the first two minutes. Which mechanism actually enforces the invariant that one seat has at most one live hold?",
          options: [
            "A distributed lock taken before reading the seat row.",
            "A queue that funnels every reserve request for the event through a single worker.",
            "Caching the seat map with a short time-to-live so clients see availability sooner.",
            "One conditional update on the seat row that sets the hold only where the seat is free or its previous hold has already expired, with the affected row count deciding the winner."
          ],
          answer: 3,
          explain: "The invariant lives on one row, so the cheapest correct enforcement is a single-row compare-and-set inside the database that already owns that row. A distributed lock adds a second system that can fail independently, and a single serialising worker is a correctness-by-bottleneck answer. Expiry belongs inside the same predicate so a stale hold never blocks a sale."
        },
        {
          q: "Fan-out on write costs roughly seventy thousand feed inserts a second at baseline. An account with a hundred million followers posts. What does the hybrid actually change?",
          options: [
            "Authors above a follower threshold are skipped on push; their recent posts are pulled and merged at read time, so one post no longer consumes tens of minutes of the entire fan-out budget.",
            "It moves fan-out onto a faster queue so the hundred million writes finish sooner.",
            "It stops precomputing feeds entirely and merges every author at read time.",
            "It compresses feed entries so the same post costs fewer bytes."
          ],
          answer: 0,
          explain: "The celebrity problem is not that the writes are slow, it is that they are unbounded per post and share a queue with everyone else. Excluding high-fan-out authors from push caps the write amplification, and merging their handful of recent posts at read time is cheap because there are few such authors per reader. You pay a small, bounded read cost to remove an unbounded write cost."
        },
        {
          q: "Your ranked feed has a 300 ms p99 budget and scoring one candidate costs about 20 microseconds of CPU. Why does the design retrieve roughly five hundred candidates rather than scoring everything eligible?",
          options: [
            "The ranking model is only accurate when given exactly five hundred items.",
            "Cost scales linearly with candidates: seven thousand feed builds a second at five hundred candidates is already about seventy cores of pure scoring, and an unbounded candidate set makes both CPU and the latency budget unbounded.",
            "HTTP clients cap responses at five hundred items.",
            "The candidate store cannot return more than five hundred rows in one query."
          ],
          answer: 1,
          explain: "Retrieval exists to make ranking affordable, not to improve it. Fixing the candidate count converts an open-ended cost into a line item you can multiply out and defend, and it puts a hard ceiling on the scoring stage of the latency budget. Quality then comes from better retrieval sources, not from scoring more things."
        },
        {
          q: "Two users right-swipe each other at the same instant. What makes the match fire exactly once?",
          options: [
            "The later swipe is rejected and that user is asked to swipe again.",
            "A background job scans the swipe table every minute and removes duplicate matches.",
            "Both swipes write into one row keyed by the unordered pair, and the conditional update that flips the second side from pending to mutual is the single state transition that emits the match.",
            "The client suppresses the duplicate notification when it arrives twice."
          ],
          answer: 2,
          explain: "Read-then-write on two separate rows can produce zero matches or two, depending on interleaving. Collapsing both directions onto one row keyed by the sorted pair turns mutuality into a single atomic transition that exactly one request can perform. Emitting the notification from that transition, through an outbox, keeps retries from duplicating it."
        },
        {
          q: "Contest peak on a coding judge implies roughly six thousand CPU-seconds of judging work per second. What is the right response?",
          options: [
            "Provision the full peak fleet permanently so no submission ever waits.",
            "Run the judge inside the API process so there is no queue to operate.",
            "Cut the number of test cases per problem until peak load fits the existing fleet.",
            "Queue it: accept the submission immediately, hand back a durable id and a visible position, and drain a bounded worker pool with per-user fairness so one contestant cannot starve the rest."
          ],
          answer: 3,
          explain: "Judging is a batch workload with a bursty arrival pattern and a tolerable wait, which is exactly the shape a queue is for. Provisioning for a peak that lasts ninety minutes a week wastes almost all of the capacity, and cutting test coverage trades correctness for cost. Fairness has to be explicit, or the heaviest submitter takes the whole pool."
        },
        {
          q: "In a multi-device chat system, what does a 'delivered' tick most defensibly mean?",
          options: [
            "The message is durably written to every registered device inbox for the recipient and acknowledged, with the product deciding explicitly whether the tick waits for the slowest device.",
            "The recipient's screen has rendered the message.",
            "The server accepted and persisted the message.",
            "The sender's client finished uploading the message."
          ],
          answer: 0,
          explain: "Delivery is a property of the recipient's devices, not of your server, so a tick that fires on server persistence is lying about a state the sender cares about. Once you accept multiple devices, 'delivered' needs a quantifier: any device or all devices. Pick one, write it down, and make the receipt derive from device cursors rather than a separate flag that can drift."
        }
      ]
    }
  });

  /* ================================================================
     MODULE CONTENT
     ================================================================ */

  var LEVELS = ["Level", "What the bar actually requires here"];

  var FOUNDATIONS = {
    id: "foundations",
    name: "Foundations",
    icon: "grid",
    lessons: [

      /* ============================ 1 · BITLY ============================ */
      {
        id: "bitly",
        title: "Design a URL shortener",
        summary: "The on-ramp breakdown. Generate short unique keys without coordination, then survive a hundred reads for every write.",
        minutes: 10,
        tags: ["breakdown", "read-heavy", "keyspace", "caching"],
        blocks: [
          { t: "p", html: "Take a long link, hand back a short one, and redirect anyone who visits it. It is the smallest problem in this track and the best place to learn the shape of every page in it: scope, requirements, numbers, entities, a diagram, <strong>one genuinely hard decision</strong>, the deep dives, and the level bar. Every later breakdown moves in exactly these beats, so read this one slowly and the other nine will read fast." },
          { t: "note", variant: "tip", html: "This page runs the whole <a href='#/hld/foundations/framework'>repeatable design framework</a> in miniature: requirements, capacity arithmetic, the entity model, one genuinely hard decision and the level bar. If the framework is new, skim that lesson first." },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "p", html: "Spend the first three minutes here. The questions below are the ones that change the design; everything else can wait." },
          { t: "ul", items: [
            "<strong>Who creates links — humans or machines?</strong> Assume both, but the volume is machine-generated: marketing tools and mobile apps, not people pasting into a box.",
            "<strong>Do we need custom aliases?</strong> Yes. They are rare (under two percent of creates) but they change the uniqueness story.",
            "<strong>Do links expire?</strong> Optional expiry, default never. Never-expiring is the harder storage case, so design for it.",
            "<strong>Do we need click analytics?</strong> Counts and coarse geography, eventually consistent. Analytics must never sit on the redirect's critical path.",
            "<strong>Can a link be edited after creation?</strong> No. Code-to-target is immutable, which is the single most useful thing anyone will tell you about this problem."
          ] },
          { t: "note", variant: "tip", html: "That last answer is worth pushing for in any breakdown. <strong>Immutable data is cacheable forever.</strong> Once the mapping cannot change, the entire read path becomes a caching problem and stops being a database problem." },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Create a short code for a target URL, optionally with a caller-supplied alias and an expiry.",
            "Resolve a code to its target and redirect the browser.",
            "Report click counts per code, with a delay measured in minutes rather than milliseconds.",
            "Let the owner deactivate a code they created."
          ] },
          { t: "ul", items: [
            "<strong>Redirect latency:</strong> p99 under 50 ms at the edge, under 100 ms from origin.",
            "<strong>Redirect availability:</strong> 99.99%. A dead redirect breaks somebody else's product, not just ours.",
            "<strong>Create availability:</strong> 99.9% is fine. Creates can retry; redirects cannot.",
            "<strong>Durability:</strong> no created code may ever resolve to the wrong target, and no code may ever be handed out twice.",
            "<strong>Uniqueness horizon:</strong> ten years of creates without exhausting or crowding the keyspace."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "p", html: "Every number below is a <strong>stated assumption</strong>, not a fact. Say them out loud, round hard, and let the interviewer correct one if they want a different scale." },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  new links / day          =  5,000,000\n" +
            "  redirects : creates      =        100 : 1\n" +
            "  stored row (link + idx)  =        500 bytes\n" +
            "  redirect on the wire     =        500 bytes  (302 + headers)\n" +
            "  peak multiplier          =          3x\n" +
            "\n" +
            "WRITES\n" +
            "  5,000,000 / 86,400       =  57.9        -> ~60 creates/sec\n" +
            "  peak  60 x 3             =              -> ~180 creates/sec\n" +
            "\n" +
            "READS\n" +
            "  5,000,000 x 100          =  500,000,000 redirects/day\n" +
            "  500,000,000 / 86,400     =  5,787       -> ~5,800 redirects/sec\n" +
            "  peak  5,800 x 3          =              -> ~17,000 redirects/sec\n" +
            "\n" +
            "STORAGE\n" +
            "  5,000,000 x 500 B        =  2.5 GB/day\n" +
            "  2.5 GB x 365             =  912 GB      -> ~0.9 TB/year\n" +
            "  5 years                  =              -> ~4.5 TB   (one node, comfortably)\n" +
            "\n" +
            "EGRESS\n" +
            "  500,000,000 x 500 B      =  250 GB/day\n" +
            "  250 GB x 30              =  7.5 TB/month\n" +
            "\n" +
            "KEYSPACE\n" +
            "  base62^7 = 62^7          =  3.5e12 codes\n" +
            "  10 years of creates      =  5e6 x 365 x 10 = 1.8e10 codes\n" +
            "  occupancy                =  1.8e10 / 3.5e12 = 0.5%\n" +
            "  same volume at 6 chars   =  1.8e10 / 5.7e10 = 32%   <- too crowded"
          },
          { t: "note", variant: "tip", html: "Read what those numbers say. <strong>4.5 TB and 180 writes a second is a single database.</strong> The only large number on the page is 17,000 reads a second, and reads are of immutable data. So this is not a sharding problem or a consistency problem — it is a caching problem with a keyspace question attached." },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  Link    code (PK, 7 chars)  target_url  owner_id  created_at\n" +
            "          expires_at?  active  custom (bool)\n" +
            "  Click   code  bucket_minute  count            (aggregated, not per-event)\n" +
            "  Owner   owner_id  api_key_hash  rate_limit_tier\n" +
            "\n" +
            "API\n" +
            "  POST /v1/links        { target, alias?, expires_at? } -> 201 { code, short }\n" +
            "  GET  /{code}                                          -> 302 Location: target\n" +
            "  GET  /v1/links/{code}                                 -> 200 { target, clicks, created_at }\n" +
            "  DELETE /v1/links/{code}                               -> 204   (soft deactivate)\n" +
            "\n" +
            "  POST /v1/links carries an Idempotency-Key header: a retried create\n" +
            "  returns the original code instead of burning a second one."
          },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "                    +-------------+\n" +
            "  browser --------> |  CDN / edge |  cache 302s by code, long TTL\n" +
            "   (GET /{code})    +------+------+\n" +
            "                           | miss\n" +
            "                    +------v------+        +-------------------+\n" +
            "                    |  redirect   |------->|  code cache (KV)  |\n" +
            "                    |  service    |<-------|  ~95% hit ratio   |\n" +
            "                    +------+------+        +-------------------+\n" +
            "                           | miss                    ^\n" +
            "                    +------v------+                  | fill\n" +
            "                    |  link store |------------------+\n" +
            "                    |  (KV / SQL) |\n" +
            "                    +------^------+\n" +
            "                           |\n" +
            "  API client ---> create service ---> key allocator (id ranges)\n" +
            "                        |\n" +
            "                        +--> click events --> queue --> rollup job --> Click"
          },
          { t: "p", html: "Two paths that share almost nothing. The <strong>redirect path</strong> is a cache lookup with a database behind it and should be deployable, scalable and on-call-able on its own. The <strong>create path</strong> is low volume and can afford a transaction, an idempotency check and a call to the key allocator. The click pipeline hangs off the side: the redirect service fires an event and returns immediately, and a rollup job turns events into per-minute counts. If the click pipeline is down, redirects still work — that separation is the whole point of drawing it as a third path." },
          { t: "h", text: "6 · The one hard part: generating codes without coordination" },
          { t: "p", html: "Every server that handles a create must produce a code nobody else will produce, without asking a central authority on every request. That is the decision the rest of the design hangs on, and there are three honest answers with very different costs." },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "Hash the target URL, truncate to seven base62 characters, insert.", "Two different targets will eventually truncate to the same code, and the naive version overwrites one with the other — silently sending users to the wrong site. It also makes the same URL always produce the same code, which leaks that someone else already shortened it and breaks per-owner analytics."],
              ["<strong>Solid</strong>", "Generate seven random base62 characters, insert with a uniqueness constraint, retry on conflict.", "Correct, stateless and trivially explained. At 0.5% occupancy after ten years, retries are rare enough to ignore. The cost is a database round trip that can fail and must be retried, and you cannot pre-generate codes offline without reserving them."],
              ["<strong>Standout</strong>", "A key allocator hands each create server a block of one million ids; the server encodes ids locally, scrambling the bits before base62 so codes are not sequential.", "Unique by construction — no conflict path at all, so creates never retry and the write is a plain insert. Each server does one allocator call per million codes, so the allocator is not on the hot path and can be down for a long time before anyone notices. The costs are real and worth naming: a crashed server strands its unused block (you leak, at most, a million codes per crash, out of 3.5 trillion), and you must scramble, or codes become an enumerable index of every link in the system."]
            ]
          },
          { t: "note", variant: "trap", html: "The trap is treating <em>unique</em> and <em>unguessable</em> as the same property. Sequential ids are unique but let anyone walk your entire link table by counting. Random codes are unguessable but need collision handling. The great answer takes uniqueness from the counter and unguessability from a reversible bit-scramble, and pays for neither with a hot-path round trip." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"What is your cache hit ratio and why?\"", "Link popularity is heavily skewed — a small set of codes carries most traffic, and a code's target never changes. So cache with a long TTL and no invalidation logic except on deactivate, expect over 95% at the key-value cache and considerably more once the CDN is warm, and size the cache for the working set of hot codes rather than the full table."],
              ["\"301 or 302?\"", "302. A 301 is cached by the browser more or less forever, which means you never see the second click — no analytics, no ability to deactivate, no way to change the target if you ever add that feature. 301 is faster for the user on repeat visits; you are trading that for control, and you should say that trade out loud rather than picking one silently."],
              ["\"How do custom aliases coexist with generated codes?\"", "Reserve them in a separate namespace or a reserved-prefix set so a generated code can never collide with a future alias. Validate aliases against a blocklist of routes and offensive strings, take them through the same uniqueness constraint, and rate-limit alias creation hard — alias squatting is the abuse vector on this product."]
            ]
          },
          { t: "p", html: "One more that comes up constantly: <strong>abuse</strong>. A shortener is a redirect-as-a-service, so it will be used to disguise malicious destinations. The answer is a scan of the target at create time against a reputation feed, a re-scan of hot codes on a schedule since a benign domain can turn hostile after creation, and an interstitial warning page instead of a hard block when the signal is weak. This is a product answer, not an infrastructure one, and offering it unprompted reads as senior." },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "Working end-to-end design: create endpoint, redirect endpoint, a store, a cache. Picks one code-generation scheme and can explain why collisions are handled. Capacity numbers present, even if rough."],
              ["<strong>Senior</strong>", "Separates the read and write paths and justifies it. Sizes the keyspace against a stated horizon rather than asserting seven characters. Names the trade-off in the code scheme instead of declaring a winner, and keeps analytics off the redirect's critical path."],
              ["<strong>Staff</strong>", "Frames the whole problem as immutability plus skew, and drives the design from there. Volunteers the abuse and enumeration risks, defines the failure behaviour of the key allocator, and says explicitly which properties are worth an availability hit (creates) and which are not (redirects)."]
            ]
          },
          { t: "note", variant: "key", html: "<strong>The mapping never changes, so the read path is a cache and the interesting decision is upstream, in key generation.</strong> Size the keyspace against a stated horizon, take uniqueness from a counter and unguessability from a scramble, and keep creates, redirects and analytics on three independently failing paths. Every breakdown in this module follows the same route: find the one immutable or invariant thing, and design outward from it. Next up, <a class='inline' href='#/breakdowns/foundations/dropbox'>file sync and storage</a>." }
        ]
      },

      /* ============================ 2 · DROPBOX ============================ */
      {
        id: "dropbox",
        title: "Design file sync and storage",
        summary: "Chunked, deduplicated, resumable uploads — and the fact that your metadata and your bytes live in two systems that fail separately.",
        minutes: 11,
        tags: ["breakdown", "storage", "dedup", "sync"],
        blocks: [
          { t: "p", html: "A folder on every device that holds the same files. Underneath, that means uploading bytes efficiently, storing them once no matter how many people have the same file, and keeping a metadata view that every client can converge on. The pattern from <a class='inline' href='#/breakdowns/foundations/bitly'>the shortener</a> repeats here in a bigger key: find the immutable thing, design outward from it. Here the immutable thing is a <strong>chunk of bytes addressed by its own hash</strong>." },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "ul", items: [
            "<strong>How big do files get?</strong> Assume a long tail up to a few gigabytes, with a median around 1 MB. The tail is what forces chunking.",
            "<strong>Do we need real-time collaborative editing?</strong> No. Last-writer-wins with a visible conflict copy is acceptable. That removes an entire subsystem.",
            "<strong>Sharing and permissions?</strong> Folder-level sharing with read or write. Assume it exists but keep it out of the sync hot path.",
            "<strong>Version history?</strong> Yes, thirty days. This matters because it means deleting bytes is never immediate.",
            "<strong>Which clients?</strong> Desktop daemon, mobile, web. The desktop daemon is the demanding one — it watches a filesystem and must be resumable across crashes and network changes."
          ] },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Upload a file from any device and see it on every other device belonging to the account.",
            "Resume an interrupted upload without re-sending bytes that already landed.",
            "Store identical content once, whether it is the same user re-uploading or a second copy in a shared folder.",
            "Keep thirty days of versions and restore any of them.",
            "Delete a file and have the deletion propagate, including to devices that were offline when it happened."
          ] },
          { t: "ul", items: [
            "<strong>Sync latency:</strong> a change on one online device is visible on another within 5 seconds at p50, 30 seconds at p99.",
            "<strong>Durability:</strong> eleven nines on stored bytes. Losing a user's file is unrecoverable reputational damage.",
            "<strong>Upload resumability:</strong> no more than one chunk of work is ever lost to a crash or a network change.",
            "<strong>Metadata consistency:</strong> read-your-writes for the uploading device; a few seconds of staleness for other devices is fine.",
            "<strong>Availability:</strong> 99.9% for metadata; the byte store rides the object store's own SLA."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "p", html: "Stated assumptions again — pick round numbers you can multiply in your head, and say that you are picking them." },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  DAU                        = 10,000,000\n" +
            "  file writes / user / day   =          5\n" +
            "  average file size          =       1 MB\n" +
            "  novel bytes after dedup    =        30% of uploaded bytes\n" +
            "  download : upload by bytes =        2 : 1\n" +
            "  replication factor         =         3x\n" +
            "  peak multiplier            =         3x\n" +
            "  chunk size                 =       4 MB\n" +
            "\n" +
            "WRITE RATE\n" +
            "  10,000,000 x 5             = 50,000,000 file writes/day\n" +
            "  50,000,000 / 86,400        = 579        -> ~600 uploads/sec\n" +
            "  peak                       =            -> ~1,800 uploads/sec\n" +
            "\n" +
            "BYTES\n" +
            "  50,000,000 x 1 MB          = 50 TB/day uploaded\n" +
            "  50 TB x 0.30               = 15 TB/day actually stored\n" +
            "  15 TB x 365                = 5,475 TB   -> ~5.5 PB/year\n" +
            "  x3 replication             =            -> ~16 PB/year of raw disk\n" +
            "\n" +
            "METADATA (a completely different problem)\n" +
            "  row per file version       = 500 B\n" +
            "  50,000,000 x 500 B         = 25 GB/day  -> ~9 TB/year\n" +
            "\n" +
            "EGRESS\n" +
            "  50 TB x 2                  = 100 TB/day\n" +
            "  100 TB x 30                = 3 PB/month"
          },
          { t: "note", variant: "tip", html: "Two systems, two orders of magnitude apart. <strong>Bytes are petabytes a year; metadata is single-digit terabytes a year.</strong> That gap is the reason they live in different stores, and it is also the reason the hardest part of this design is the seam between them." },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  File      file_id  account_id  path  current_version  deleted_at?\n" +
            "  Version   file_id  version  size  chunk_list[]  created_at  device_id\n" +
            "  Chunk     chunk_hash (PK)  size  refcount  storage_key\n" +
            "  Device    device_id  account_id  cursor  last_seen\n" +
            "\n" +
            "  A Version owns an ordered list of chunk_hash. A Chunk is content-addressed\n" +
            "  and immutable: same bytes, same hash, stored once.\n" +
            "\n" +
            "API\n" +
            "  POST /v1/upload/start   { path, size, chunk_hashes[] }\n" +
            "        -> { upload_id, need: [hashes the server does not already have] }\n" +
            "  PUT  /v1/chunk/{hash}   <bytes>                  -> 204   (idempotent by hash)\n" +
            "  POST /v1/upload/commit  { upload_id }            -> { file_id, version }\n" +
            "  GET  /v1/delta?cursor=  -> { changes[], cursor } (long-poll, per device)\n" +
            "  GET  /v1/chunk/{hash}   -> redirect to a signed, short-lived object URL"
          },
          { t: "p", html: "Look at what <code class='tok'>upload/start</code> returns: the list of chunks the server does <em>not</em> already have. That single response is the deduplication mechanism, the resumption mechanism and the bandwidth optimisation, all at once. A client that crashes mid-upload restarts by calling <code class='tok'>start</code> again and getting a shorter <code class='tok'>need</code> list." },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "  desktop daemon\n" +
            "     | watch filesystem -> hash chunks locally\n" +
            "     v\n" +
            "  +----------------+   start/commit   +--------------------+\n" +
            "  |  sync service  |----------------->|  metadata store    |\n" +
            "  |  (stateless)   |                  |  File/Version/Chunk|\n" +
            "  +--------+-------+                  +---------+----------+\n" +
            "           | signed URLs                        |\n" +
            "           v                                    | change log\n" +
            "  +----------------+                            v\n" +
            "  | object store   |  chunk_hash -> bytes   +---------+\n" +
            "  | (immutable)    |                        | notifier|--> long-poll\n" +
            "  +----------------+                        +---------+    other devices\n" +
            "           ^\n" +
            "           |  refcount == 0 for 30 days\n" +
            "     garbage collector"
          },
          { t: "p", html: "The load-bearing pieces: the <strong>metadata store</strong> is the source of truth for what exists and is a normal transactional database, sharded by account. The <strong>object store</strong> holds immutable, content-addressed blobs and never needs a transaction because writing the same hash twice is a no-op. The <strong>notifier</strong> is a per-device cursor over a change log, which is what lets an offline device catch up by asking for everything after its cursor instead of diffing whole trees. And the <strong>garbage collector</strong> exists solely because deleting a chunk is only safe when no version anywhere references it and the retention window has passed." },
          { t: "h", text: "6 · The one hard part: chunking, dedup, and the metadata/bytes seam" },
          { t: "p", html: "Two questions that look separate and are not. How do you split a file so that a small edit does not re-upload the whole thing, and how do you keep the metadata store and the object store from disagreeing when one of them fails mid-upload?" },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "Upload the whole file in one request through the application tier, write bytes and metadata in the same handler.", "A 2 GB file over a phone connection either completes or starts over, so the tail of your file-size distribution effectively never syncs. Streaming bytes through the app tier makes the app tier the bandwidth bottleneck. And with no separation, a failure after bytes land but before metadata commits leaves a file that exists in storage and not in the product."],
              ["<strong>Solid</strong>", "Fixed 4 MB chunks, hash each one, upload only the missing hashes directly to the object store with signed URLs, then commit the manifest last.", "Resumable, deduplicated, and the app tier never touches bytes. Commit-last means the only inconsistency possible is an orphan chunk, which the collector reclaims. The weakness is fixed boundaries: insert one byte at the front of a file and every subsequent chunk shifts, so a one-byte edit re-uploads the entire file."],
              ["<strong>Standout</strong>", "Content-defined chunking — a rolling hash over a sliding window picks boundaries at data-dependent positions, with min and max chunk sizes — plus the same commit-last manifest and an account-scoped dedup namespace.", "Boundaries move with the content, so an insertion changes one or two chunks and everything after realigns. That is the difference between re-uploading 4 MB and re-uploading 2 GB on an edit to a large file. The costs: chunking is now CPU work on the client, chunk sizes are variable so storage accounting is fuzzier, and scoping dedup per account gives up some global savings to close a real privacy hole."]
            ]
          },
          { t: "note", variant: "trap", html: "The privacy hole in global deduplication is worth being able to explain. If <code class='tok'>upload/start</code> tells any user that the server already has a given chunk hash, that user can confirm whether specific content exists somewhere in the system by hashing a candidate file and watching the <code class='tok'>need</code> list. Scoping dedup to the account, or requiring proof of possession before honouring a cross-account hit, closes it. Volunteering this unprompted is a strong senior signal." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"Two devices edit the same file offline. What happens?\"", "Both commit against a base version. The second commit sees that current_version has moved past its base and, instead of overwriting, creates a conflicted copy with the losing device's name and timestamp in the filename, then syncs both. This is deliberately not a merge: merging arbitrary binary content is undefined, and a visible duplicate is a failure users can understand and fix."],
              ["\"How does an offline device catch up?\"", "Per-device cursor over an append-only change log, ordered per account. Reconnect calls the delta endpoint with the stored cursor and receives every change since, including tombstones, then advances the cursor only after applying. Tombstones stay until every active device's cursor has passed them — otherwise a device that was off for a week resurrects deleted files."],
              ["\"When do chunks actually get deleted?\"", "Never on the delete path. Deleting a file writes a tombstone and decrements refcounts. A chunk becomes eligible only when its refcount has been zero for longer than the version-retention window, and even then the collector should sweep asynchronously with a safety margin. Deletion is the operation most likely to lose data permanently, so it is the one that should be slowest."]
            ]
          },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "Chunks the upload, dedups by content hash, keeps metadata separate from bytes, and can describe how an interrupted upload resumes. Knows the object store holds the blobs."],
              ["<strong>Senior</strong>", "Orders the writes deliberately and explains which inconsistency is acceptable and why. Designs the delta/cursor sync rather than hand-waving \"the client polls\". Handles tombstones and conflicted copies as first-class cases, not afterthoughts."],
              ["<strong>Staff</strong>", "Argues fixed versus content-defined chunking from the edit pattern of real files rather than from theory. Raises the dedup privacy leak, defines the garbage-collection safety margin against the retention policy, and treats the metadata/bytes seam as the central design constraint rather than an implementation detail."]
            ]
          },
          { t: "note", variant: "key", html: "<strong>Content-address the bytes and commit the manifest last.</strong> Immutable, hash-named chunks make dedup, resumability and idempotent retries the same mechanism, and writing metadata last means the only failure mode is a reclaimable orphan rather than a corrupt file. Everything else here — cursors, tombstones, conflicted copies, delayed garbage collection — exists because devices go offline and come back." }
        ]
      },

      /* ============================ 3 · YELP ============================ */
      {
        id: "yelp",
        title: "Design local business reviews and search",
        summary: "Geospatial search that also has to filter and rank, plus an aggregate rating that must not lose updates.",
        minutes: 10,
        tags: ["breakdown", "geospatial", "search", "consistency"],
        blocks: [
          { t: "p", html: "Find restaurants near me that are open now, take reservations, are rated above four stars, and are not too expensive. Then let anyone leave a review that changes that rating. It looks like a search problem with a small write problem attached; the write problem is where people quietly get it wrong." },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "ul", items: [
            "<strong>What is the search radius?</strong> Assume a bounded neighbourhood query — a few kilometres, occasionally a whole city. Nobody searches the planet, which rules out a lot of complexity.",
            "<strong>Which filters matter?</strong> Category, price band, open-now, rating floor, and a handful of amenities. Assume roughly ten filterable attributes.",
            "<strong>How fresh must a new review be in search results?</strong> Seconds to a minute. This is the answer that lets the search index be a derived, eventually consistent copy.",
            "<strong>Personalisation and ranking?</strong> Distance, rating and popularity, blended. No per-user model in v1.",
            "<strong>Who writes?</strong> Consumers writing reviews and photos; business owners editing their own listings. Both are low volume next to reads."
          ] },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Search businesses by location plus filters, ranked, paginated.",
            "View a business with its rating, review count and recent reviews.",
            "Write a review with a star rating and optional photos; one review per user per business.",
            "See the business's aggregate rating update to include your review.",
            "Let an owner update hours, category and amenities."
          ] },
          { t: "ul", items: [
            "<strong>Search latency:</strong> p99 under 200 ms including ranking, from the nearest region.",
            "<strong>Index freshness:</strong> a new or edited review is reflected in search and on the business page within 60 seconds.",
            "<strong>Rating correctness:</strong> the aggregate must equal the sum of live reviews exactly. No lost updates, ever — this one is not eventually consistent, it is just correct.",
            "<strong>Availability:</strong> 99.95% on search. Writes may degrade first.",
            "<strong>Peak shape:</strong> traffic is not uniform. Size for lunch and dinner, not for the daily average."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  businesses               = 20,000,000\n" +
            "  searches / day           = 30,000,000\n" +
            "  reviews / day            =    200,000\n" +
            "  photo uploads / day      =     50,000\n" +
            "  mealtime peak multiplier =         4x\n" +
            "  search response          = 20 results x 3 KB = 60 KB\n" +
            "\n" +
            "READS\n" +
            "  30,000,000 / 86,400      = 347      -> ~350 searches/sec\n" +
            "  peak  350 x 4            =          -> ~1,400 searches/sec\n" +
            "\n" +
            "WRITES\n" +
            "  200,000 / 86,400         = 2.3      -> ~2 reviews/sec\n" +
            "  peak                     =          -> ~10 reviews/sec\n" +
            "\n" +
            "STORAGE\n" +
            "  review row (text + meta) = 1 KB\n" +
            "  200,000 x 1 KB           = 200 MB/day  -> ~73 GB/year\n" +
            "  photos 50,000 x 500 KB   = 25 GB/day   -> ~9 TB/year\n" +
            "  business docs 20e6 x 2 KB= 40 GB total <- the whole search corpus\n" +
            "\n" +
            "EGRESS\n" +
            "  30,000,000 x 60 KB       = 1.8 TB/day -> ~54 TB/month  (JSON only;\n" +
            "                                          photos ride the CDN)"
          },
          { t: "note", variant: "tip", html: "<strong>Forty gigabytes.</strong> The entire searchable corpus fits in memory on a single large machine, and you could hold several replicas of it for the price of one storage tier. That reframes the problem completely: this is not a distributed search problem, it is a modest search problem replicated for availability and latency. Say that out loud — noticing when the numbers make something <em>easy</em> is as valuable as noticing when they make it hard." },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  Business  business_id  name  lat  lng  cell_id  category[]  price_band\n" +
            "            hours  amenities[]  rating_sum  rating_count  photo_count\n" +
            "  Review    review_id  business_id  user_id (UNIQUE with business_id)\n" +
            "            stars  body  created_at  status\n" +
            "  Photo     photo_id  business_id  user_id  storage_key\n" +
            "\n" +
            "  Note what the Business row stores: rating_sum and rating_count, not\n" +
            "  avg_rating. The average is derived on read. This is deliberate.\n" +
            "\n" +
            "API\n" +
            "  GET  /v1/search?lat=&lng=&radius_m=&q=&category=&price=&open_now=\n" +
            "                 &min_rating=&cursor=          -> { results[], cursor }\n" +
            "  GET  /v1/business/{id}                        -> { business, rating, reviews[] }\n" +
            "  POST /v1/business/{id}/reviews { stars, body }-> 201 { review_id }\n" +
            "  PATCH /v1/business/{id}        { hours, ... } -> 200   (owner only)"
          },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "  client\n" +
            "    |\n" +
            "    +--> GET /search --> search service --> search index (in-memory)\n" +
            "    |                                        geo point + all filter attrs\n" +
            "    |                                        + rating + popularity\n" +
            "    |                                             ^\n" +
            "    |                                             | indexer\n" +
            "    |                                        +----+----+\n" +
            "    +--> POST /review -> review service ---> | primary |  (source of truth)\n" +
            "    |                        |               |   DB    |\n" +
            "    |                        |               +----+----+\n" +
            "    |                        |                    | change stream\n" +
            "    |                        +--> atomic increment |\n" +
            "    |                             rating_sum,      v\n" +
            "    |                             rating_count   indexer --> index\n" +
            "    |\n" +
            "    +--> GET /business/{id} -> read replica + cache (photos via CDN)"
          },
          { t: "p", html: "The load-bearing decision is the arrow labelled <em>change stream</em>. The transactional database is the source of truth for reviews and ratings; the search index is a <strong>derived read model</strong> rebuilt from it. That is what buys you a 60-second freshness budget, and it is also what lets the index carry a denormalised copy of every filterable attribute without polluting the write model. If the indexer dies, search goes stale but stays up, and writes are unaffected — three failure domains instead of one." },
          { t: "h", text: "6 · The one hard part: geospatial search that also filters and ranks" },
          { t: "p", html: "\"Near me\" is easy on its own. \"Near me, open now, over four stars, cheap, Thai, sorted by a blend of distance and quality, page three\" is the actual query, and the naive approaches all fall over on the combination rather than on the geography." },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "A bounding-box query on indexed lat and lng columns, then filter and sort the results in application code.", "The two single-column indexes cannot be combined efficiently, so the database scans one dimension and discards most of it. A dense city centre returns tens of thousands of rows to filter in memory, and pagination is meaningless because the sort happens after the fetch. It also gets the geometry wrong: a fixed degree box is a very different distance at different latitudes."],
              ["<strong>Solid</strong>", "Encode each business into a hierarchical grid cell (geohash, quadkey or a hex grid) stored as an indexed prefix; query the covering cell plus its neighbours, then filter and rank the candidates in the service.", "Now the geography is a prefix range scan, which any index handles well, and neighbour cells fix the edge case where the nearest business sits just across a cell boundary. It is a genuinely good answer. The weakness is that the filters are still not in the index — a rare filter like \"open now and vegan and under thirty\" forces you to pull a wide candidate set and throw most of it away."],
              ["<strong>Standout</strong>", "One document per business in a search engine carrying the geo point, every filter attribute, the rating and a popularity score; a single query does geo-filter-rank together. The transactional store stays the source of truth and streams changes into the index.", "The engine intersects the geo filter with the attribute filters before ranking, so selectivity works in your favour instead of against you: a rare filter makes the query <em>faster</em>. Ranking by a distance-and-quality blend happens inside the same pass, and cursor pagination is well defined because the sort is part of the query. The costs you must name: a second system to operate, a rebuild path when the mapping changes, and an eventual-consistency window that you must keep out of the write path — the review write returns from the primary, never from the index."]
            ]
          },
          { t: "note", variant: "trap", html: "Do not let the search index become the source of truth because it is convenient. The moment a write is acknowledged from a derived index you have lost durability guarantees and gained a rebuild that silently changes data. The index is a cache with a query language." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"Two reviews land at once. How does the rating stay right?\"", "Never read-modify-write a stored average. The Business row holds rating_sum and rating_count, and posting a review issues two atomic increments in the same transaction as the review insert. Concurrent writers commute, so nothing is lost, and the average is computed on read. Edits and deletions apply a delta rather than recomputing — and a slow reconciliation job recomputes from the review table periodically to catch any drift from bugs or moderation."],
              ["\"Page three of a search, and the user is walking.\"", "Freeze the query. The cursor encodes the original centre point, the filter set and the ranking snapshot, so page three is consistent with page one even though the device has moved and two reviews have landed. Offset pagination is wrong here for the usual reason — a changing result set makes rows appear twice or never — but the moving centre point makes it worse, because the ordering itself shifts under the user."],
              ["\"How do you keep open-now correct without reindexing constantly?\"", "Do not index a boolean. Index the opening intervals as structured data and evaluate the predicate at query time against the request timestamp in the business's own timezone. A boolean would need every document rewritten as the day rolls across timezones, which is millions of pointless writes for information you can compute."]
            ]
          },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "Uses a grid or geohash index rather than a raw bounding box, separates search from the primary store, and stores sum and count instead of a mutable average."],
              ["<strong>Senior</strong>", "Explains why filters belong in the same index as the geography, drives the index from a change stream, and defines the freshness budget as an explicit requirement. Handles pagination with a frozen cursor."],
              ["<strong>Staff</strong>", "Reads the capacity numbers and says the corpus is small, then designs for latency and availability instead of shards. Treats the derived index as a rebuildable read model with an owned rebuild path, and separates the one thing that must be exactly correct (the rating aggregate) from everything that can be seconds stale."]
            ]
          },
          { t: "note", variant: "key", html: "<strong>Put the geography and the filters in the same index, and never store a derived average you have to read before writing.</strong> A single query that intersects geo with attributes before ranking turns selective filters into a speedup; two atomic counters turn a concurrency bug into arithmetic. Freshness is a budget you state, correctness on the aggregate is not." }
        ]
      },

      /* ======================== 4 · LOCAL DELIVERY ======================== */
      {
        id: "local-delivery",
        title: "Design local delivery with couriers",
        summary: "A location firehose you must not persist naively, and the gap between assigning an order and someone accepting it.",
        minutes: 11,
        tags: ["breakdown", "geospatial", "matching", "state-machine"],
        blocks: [
          { t: "p", html: "A customer orders; a courier picks it up and brings it. The system in the middle has to know where every courier is right now, choose one for each order, and handle the fact that the chosen courier is a human being who might say no. That last sentence is the whole problem." },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "ul", items: [
            "<strong>How fresh must courier locations be?</strong> A few seconds. Assume a ping every 4 seconds while on shift — that assumption sizes the entire ingest tier, so state it early.",
            "<strong>Single order per courier, or batched?</strong> Single in v1. Batching is a genuinely different optimisation problem and saying so is better than pretending otherwise.",
            "<strong>Can couriers decline?</strong> Yes. Assume roughly a third of offers are declined or time out. This is the number that forces the design.",
            "<strong>What is the matching objective?</strong> Minimise time-to-delivery, subject to fairness across couriers. Not pure nearest-first.",
            "<strong>Do we need live tracking for the customer?</strong> Yes, and it is a separate read fan-out with its own cost."
          ] },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Ingest courier location pings and keep a current position for every online courier.",
            "On a new order, find nearby available couriers and offer it to one.",
            "Handle acceptance, decline and timeout, and re-offer until someone takes it.",
            "Stream the courier's position to the customer while the order is in flight.",
            "Record an auditable history of where the courier went, for support and pay disputes."
          ] },
          { t: "ul", items: [
            "<strong>Match latency:</strong> a courier is assigned within 30 seconds of order creation at p95.",
            "<strong>Location freshness:</strong> the position used for matching is under 10 seconds old.",
            "<strong>Assignment safety:</strong> an order is never worked by two couriers, and never stranded with none.",
            "<strong>Tracking latency:</strong> the customer's map updates within 5 seconds of a ping.",
            "<strong>Peak shape:</strong> dinner is roughly six times the daily average. Size for dinner."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  couriers online at peak    =    200,000\n" +
            "  location ping interval     =        4 s\n" +
            "  ping payload               =      100 B\n" +
            "  orders / day               =  2,000,000\n" +
            "  dinner peak multiplier     =         6x\n" +
            "  candidates scanned / match =        200\n" +
            "\n" +
            "LOCATION FIREHOSE\n" +
            "  200,000 / 4 s              = 50,000 pings/sec\n" +
            "  50,000 x 100 B             = 5 MB/sec\n" +
            "  5 MB/s x 86,400            = 432 GB/day  IF you persist every ping\n" +
            "  downsample to 1 pt / 30 s  = 200,000 / 30 = ~6,700 writes/sec\n" +
            "  6,700 x 100 B x 86,400     = ~58 GB/day  for the audit trail\n" +
            "\n" +
            "ORDERS\n" +
            "  2,000,000 / 86,400         = 23      -> ~25 orders/sec average\n" +
            "  peak  25 x 6               =         -> ~140 orders/sec\n" +
            "  match queries at peak      = 140/sec, each touching ~200 couriers\n" +
            "\n" +
            "STORAGE\n" +
            "  order + assignment history = 2 KB\n" +
            "  2,000,000 x 2 KB           = 4 GB/day -> ~1.5 TB/year\n" +
            "\n" +
            "TRACKING EGRESS\n" +
            "  400,000 watchers x 1 update / 4 s x 200 B\n" +
            "  100,000/s x 200 B          = 20 MB/sec -> ~1.7 TB/day -> ~52 TB/month"
          },
          { t: "note", variant: "tip", html: "The gap between <strong>432 GB/day</strong> and <strong>58 GB/day</strong> is the whole location design in one line. Current position is a mutable in-memory value that does not need durability — if you lose it, the next ping arrives in four seconds. The audit trail is a separate, downsampled, append-only stream. Conflating them costs you almost an order of magnitude in write volume for data nobody reads." },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  Courier    courier_id  status(offline|idle|offered|assigned|delivering)\n" +
            "             lat lng cell_id updated_at  current_order_id?\n" +
            "  Order      order_id  customer_id  pickup  dropoff  state\n" +
            "             assigned_courier_id?  lease_expires_at?  created_at\n" +
            "  Offer      offer_id  order_id  courier_id  expires_at  outcome\n" +
            "  Trail      courier_id  bucket_30s  lat lng        (append-only, downsampled)\n" +
            "\n" +
            "  Order state machine:\n" +
            "    created -> offering -> assigned -> picked_up -> delivered\n" +
            "                  ^  |\n" +
            "                  +--+  decline / timeout re-enters offering\n" +
            "\n" +
            "API\n" +
            "  POST /v1/courier/ping     { lat, lng }              -> 204   (fire and forget)\n" +
            "  POST /v1/orders           { pickup, dropoff }       -> 201 { order_id }\n" +
            "  POST /v1/offers/{id}/accept                         -> 200 | 409 taken\n" +
            "  POST /v1/offers/{id}/decline                        -> 204\n" +
            "  GET  /v1/orders/{id}/track                          -> stream of positions"
          },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "  courier app --ping--> +-------------+\n" +
            "                        | ingest tier |--> current position (in-memory grid,\n" +
            "                        |  (stateless)|     partitioned by cell_id)\n" +
            "                        +------+------+\n" +
            "                               |  every 30 s\n" +
            "                               v\n" +
            "                        downsampled trail (append-only store)\n" +
            "\n" +
            "  customer --order--> order service --> order store (source of truth)\n" +
            "                            |\n" +
            "                            v\n" +
            "                      dispatch worker\n" +
            "                        1. read candidate couriers from the grid\n" +
            "                        2. rank them\n" +
            "                        3. write Offer + lease on the order row\n" +
            "                        4. push the offer to the courier app\n" +
            "                            |\n" +
            "                            v\n" +
            "                      accept/decline --> conditional update on the order\n" +
            "                            |\n" +
            "                            v\n" +
            "                      tracking fan-out --> customer (position stream)"
          },
          { t: "p", html: "The load-bearing pieces: the <strong>in-memory grid</strong> answers \"who is near this point\" without touching disk, partitioned by cell so the fleet scales with geography rather than with total courier count. The <strong>order store</strong> is the only durable authority on who owns an order. The <strong>dispatch worker</strong> is deliberately separate from the order API so that a slow matching pass never blocks order creation — the customer's order is accepted the moment it is durable, and matching happens right after." },
          { t: "h", text: "6 · The one hard part: assignment is not acceptance" },
          { t: "p", html: "Your system can assign an order in a millisecond. A courier accepts it in fifteen seconds, or not at all. That asymmetry between a machine decision and a human decision is the real problem, and how you bridge it determines both the customer's wait and whether couriers keep using the app." },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "Broadcast the order to every courier within a radius; the first to tap gets it.", "Fast, and wrong in three ways. It is a race, so the winner is whoever had the app open, not whoever should get the order — you have given up ranking entirely. Every loser wasted attention on an offer that vanished, and couriers respond by ignoring notifications. And with n couriers racing on one row you get a contention spike per order, at exactly the moment demand peaks."],
              ["<strong>Solid</strong>", "Rank the candidates, offer to the single best courier with a 20-second timer, and cascade to the next on decline or timeout.", "Full control over the objective, and a clean experience for couriers — every offer they see is really theirs. The cost is serial latency: with a one-in-three decline rate, the expected number of rounds is about 1.5, but the tail is ugly. Four consecutive declines is 80 seconds of a customer staring at a spinner, and that tail lands disproportionately on unpopular orders."],
              ["<strong>Standout</strong>", "Offer to a small parallel batch of the top two or three candidates with a short window, where accepting is a conditional claim so exactly one wins; cascade in rounds; after N rounds fall back to a hard assignment with a bonus. The order row carries a lease with an expiry so a crashed dispatcher cannot strand it.", "You buy back the latency tail without giving up ranking, because the batch is drawn from the top of your ranked list rather than from everyone nearby. The conditional claim keeps correctness trivial: the accept is a compare-and-set on the order row, and the losers get a clean 409 with an explanation rather than a silent disappearance. The lease is what makes the whole thing crash-safe — any worker can pick up an order whose lease expired, so there is no orphaned-order recovery job to write. The cost you must name: you are now knowingly showing the same order to more than one person, so the courier-facing copy has to be honest about it, and the batch size is a dial between latency and wasted taps."]
            ]
          },
          { t: "note", variant: "trap", html: "The trap is modelling assignment as a field on the order rather than a <strong>lease</strong>. A plain <code class='tok'>assigned_courier_id</code> has no way to expire, so every crash, every app kill and every courier who goes into a tunnel leaves an order that looks assigned forever and needs a sweeper to rescue. A lease with an expiry makes recovery a property of the data, not a background job." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"How do you find nearby couriers at 140 matches a second?\"", "Keep current positions in memory, bucketed by grid cell, partitioned across the fleet by cell id. A match reads the order's cell plus its ring of neighbours — a handful of small lists, not a query. Cell size is chosen so a typical cell holds tens of couriers rather than thousands; dense city centres get a finer level. Because the data is regenerated by the next ping, these nodes need no durability at all, which is why this tier can be cheap and simple."],
              ["\"A courier's phone loses signal mid-delivery.\"", "Nothing breaks immediately: the order is already assigned and the lease is long. Tracking degrades to a last-known position with a visible staleness indicator rather than a frozen dot that lies to the customer. The courier app queues its state transitions locally with idempotency keys and replays them on reconnect, so a pickup recorded in a dead zone is not lost. If the lease expires with no contact, the order returns to offering and support is notified."],
              ["\"Why not just persist every ping? Storage is cheap.\"", "Storage is cheap; write throughput is not. Fifty thousand durable writes a second is a real distributed-database problem with a real bill, and it buys you data nobody queries at that resolution. Downsampling to one point every thirty seconds keeps the audit trail useful for pay disputes and support, at roughly an eighth of the volume. Keep the full-resolution stream only in a short-lived buffer for live tracking."]
            ]
          },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "Separates location ingest from order handling, uses a spatial index instead of scanning all couriers, and models the order as a state machine with an explicit offer step."],
              ["<strong>Senior</strong>", "Distinguishes assignment from acceptance and designs the decline/timeout path deliberately. Splits current position from the durable trail on cost grounds, with numbers. Makes the accept a conditional write."],
              ["<strong>Staff</strong>", "Treats the lease as the correctness primitive and shows that crash recovery falls out of it for free. Reasons about the latency tail rather than the average, names the courier-experience cost of parallel offers, and sizes grid cells against courier density instead of picking a radius."]
            ]
          },
          { t: "note", variant: "key", html: "<strong>An assignment that cannot expire is a bug waiting for a crash.</strong> Model ownership as a lease with an expiry, make acceptance a conditional claim so exactly one courier wins, and keep the ephemeral location firehose out of your durable store. The interesting latency here is the tail created by humans declining, not the milliseconds your matcher spends ranking." }
        ]
      },

      /* ========================= 5 · TICKETMASTER ========================= */
      {
        id: "ticketmaster",
        title: "Design event ticketing",
        summary: "Sixty thousand seats, half a million buyers, one minute. Reservations with expiry, and a waiting room in front of the door.",
        minutes: 11,
        tags: ["breakdown", "consistency", "contention", "queueing"],
        blocks: [
          { t: "p", html: "Browse events, pick a seat, hold it while you pay, get a ticket. Almost all of that is easy almost all of the time. Then a stadium tour goes on sale at 10:00 and the entire year's traffic arrives in ninety seconds, aimed at sixty thousand rows in one table." },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "ul", items: [
            "<strong>Assigned seats or general admission?</strong> Assigned. General admission is a counter decrement; assigned seating is a per-row invariant, which is the harder and more interesting case.",
            "<strong>How long is a hold?</strong> Ten minutes to complete payment. This number appears in the design four times, so pin it early.",
            "<strong>Is oversell ever acceptable?</strong> No. Airlines oversell deliberately; a seat at a venue cannot be duplicated. Treat it as a hard invariant.",
            "<strong>Fairness during a drop?</strong> Approximately first-come-first-served, with bot mitigation. Not a lottery in v1.",
            "<strong>Resale and transfer?</strong> Out of scope, but note that it means a ticket must have a stable identity you can reassign later."
          ] },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Browse events and view a live-ish seat map.",
            "Reserve one or more specific seats, held for ten minutes.",
            "Pay, and receive a ticket bound to the seat.",
            "Release the seats automatically if payment does not complete in time.",
            "Admit buyers to the purchase flow in a controlled, roughly fair order during a high-demand drop."
          ] },
          { t: "ul", items: [
            "<strong>The invariant:</strong> at most one live hold and at most one confirmed ticket per seat per event. Everything else is negotiable; this is not.",
            "<strong>Reserve latency:</strong> p99 under 500 ms, including the failure response when the seat is gone.",
            "<strong>Browse availability:</strong> 99.99%, and it must survive the drop even if reserving degrades.",
            "<strong>Seat-map staleness:</strong> up to 5 seconds, clearly signalled. Users must understand that seeing a seat does not mean owning it.",
            "<strong>Money correctness:</strong> no double charge, no charge without a ticket, no ticket without a charge."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  seats in the hot event     =     60,000\n" +
            "  buyers arriving in minute 1=    500,000\n" +
            "  page loads per buyer       =          3\n" +
            "  tickets sold / year        = 200,000,000\n" +
            "  seat-map loads / day       = 50,000,000\n" +
            "  seat-map payload           =     200 KB\n" +
            "\n" +
            "THE DROP\n" +
            "  500,000 / 60 s             = 8,300 arrivals/sec\n" +
            "  8,300 x 3 page loads       = ~25,000 req/sec on the browse path\n" +
            "  reserve attempts, ~2 min   = 500,000 / 120 = 4,167 -> ~4,200/sec\n" +
            "  attempts per seat          = 500,000 / 60,000 = 8.3\n" +
            "  -> 1 - (60,000 / 500,000)  = 88% of attempts MUST fail\n" +
            "\n" +
            "STEADY STATE\n" +
            "  200,000,000 / 31,536,000 s = 6.3   -> ~6 tickets/sec average\n" +
            "  peak : average             = 4,167 / 6.3 = ~670x\n" +
            "\n" +
            "STORAGE\n" +
            "  ticket row                 = 300 B\n" +
            "  200,000,000 x 300 B        = 60 GB/year\n" +
            "  <- inventory is tiny. Contention, not size, is the problem.\n" +
            "\n" +
            "EGRESS\n" +
            "  50,000,000 x 200 KB        = 10 TB/day -> ~300 TB/month\n" +
            "  (CDN-served; the seat map is static between availability deltas)"
          },
          { t: "note", variant: "tip", html: "Two numbers define this design. <strong>Peak is roughly 670 times average</strong>, so anything sized for the average dies and anything sized for the peak is idle 99.9% of the year — which is the argument for shedding load at the door instead of scaling behind it. And <strong>88% of reserve attempts must fail</strong>, which reframes the goal: your job is to make failure fast, cheap and comprehensible, not to make every request succeed." },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  Event    event_id  venue_id  on_sale_at  status\n" +
            "  Seat     event_id + seat_id (PK)  section  row  price_band\n" +
            "           hold_id?  hold_expires_at?  ticket_id?\n" +
            "  Hold     hold_id  event_id  user_id  seat_ids[]  expires_at  state\n" +
            "  Ticket   ticket_id  event_id  seat_id  order_id  issued_at\n" +
            "  Order    order_id  user_id  hold_id  amount  state  idempotency_key\n" +
            "\n" +
            "  The invariant lives on the Seat row: (hold_id, hold_expires_at) and\n" +
            "  ticket_id are the only fields that matter, and they are on ONE row.\n" +
            "\n" +
            "API\n" +
            "  GET  /v1/events/{id}/seatmap          -> cached map + availability delta\n" +
            "  POST /v1/queue/{event_id}/join        -> { token, position_estimate }\n" +
            "  POST /v1/holds  { event_id, seat_ids[], queue_token }\n" +
            "                                        -> 201 { hold_id, expires_at } | 409\n" +
            "  POST /v1/orders { hold_id, payment }  -> 201 { order_id }  (Idempotency-Key)\n" +
            "  DELETE /v1/holds/{id}                 -> 204"
          },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "  buyer\n" +
            "    |\n" +
            "    +--> CDN --> seat map (static) + availability delta (5 s TTL)\n" +
            "    |\n" +
            "    +--> waiting room --> issues a signed token admitting N buyers/sec\n" +
            "    |                     (bounded by what the inventory shard can serve)\n" +
            "    v\n" +
            "  API gateway (validates the token; no token, no reserve)\n" +
            "    |\n" +
            "    +--> inventory service --> seat store, partitioned BY EVENT\n" +
            "    |        conditional update on one seat row\n" +
            "    |\n" +
            "    +--> order service --> saga: hold -> authorize -> confirm\n" +
            "                              |\n" +
            "                              +-- compensate: release hold / refund\n" +
            "\n" +
            "  hold expiry: evaluated lazily inside the reserve predicate,\n" +
            "               plus a slow sweeper for seat-map accuracy only"
          },
          { t: "p", html: "Three separations do the work. <strong>Browse is fully cacheable and lives on the CDN</strong>, so the 25,000 requests a second of page loads never reach your inventory tier. <strong>The waiting room is the throttle</strong>, and it sits in front of the gateway so that unadmitted traffic costs a token check rather than a database round trip. <strong>Inventory is partitioned by event</strong>, which means a hot event saturates one partition and cannot take the rest of the catalogue down with it — the blast radius of a stadium tour is that tour." },
          { t: "h", text: "6 · The one hard part: one seat, one buyer, under a thundering herd" },
          { t: "p", html: "Four thousand reserve attempts a second against sixty thousand rows, with a hard invariant and no tolerance for oversell. The correctness part is a single line of SQL; the survivability part is everything around it." },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "Read the seat, check that it is free in application code, then write the hold.", "Classic check-then-act. Two requests read \"free\" microseconds apart and both write, and the second silently overwrites the first — two buyers, one seat, and neither finds out until someone is turned away at the gate. Adding a read-committed transaction does not fix it, because the read does not lock anything. This fails rarely in testing and constantly at 4,200 attempts a second."],
              ["<strong>Solid</strong>", "A single conditional update: set the hold on the seat row only where it is free or its previous hold has already expired, and let the affected row count decide the winner.", "Correct, and correct for the right reason — the invariant is on one row, so the database that owns that row enforces it atomically with no extra coordination. Expiry inside the predicate means a stale hold never blocks a sale and you do not depend on a sweeper for correctness. What it does not solve is load: every one of the 4,200 attempts a second still reaches the database, and 88% of them exist only to be rejected."],
              ["<strong>Standout</strong>", "Keep exactly that conditional update as the invariant, and put a waiting room in front that admits buyers at a rate the inventory partition can comfortably serve; hold expiry stays lazy in the predicate, with a slow sweeper only to keep the displayed seat map honest.", "The conditional write is the correctness story and the waiting room is the capacity story, and keeping them separate is the point — you never weaken the invariant to buy throughput. Admission control turns an unbounded stampede into a queue you can measure, gives buyers a position estimate instead of an error page, and lets you shed bots at the door where it is cheap. The costs are real: the queue is now a critical, high-availability component of its own, position estimates are approximate and will be screenshotted and complained about, and a buyer who abandons the queue frees capacity you cannot easily reclaim."]
            ]
          },
          { t: "note", variant: "trap", html: "Reaching for a distributed lock here is the tell. It adds a second system that can fail independently, needs its own expiry semantics, and gives you nothing the single-row conditional write does not already give you — the seat row is already a lock, owned by the system that owns the data. Use an external lock only when the invariant genuinely spans stores." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"How do holds actually expire?\"", "Lazily, as part of the reserve predicate: a hold whose expiry has passed is treated as absent by the next writer, so correctness never waits for a background job. A sweeper still runs, but only to keep the seat map and analytics accurate, and it can lag by minutes without harm. Making expiry a data property rather than a job means a dead sweeper degrades display, not correctness."],
              ["\"Payment succeeds but the confirm step fails.\"", "Model checkout as a saga with compensations: hold, authorize, confirm, issue. Every step is idempotent and keyed by the order's idempotency key, so a retry of any step is safe. If confirm fails after authorization, the compensating action is a void or refund plus a hold release, and the order lands in a terminal failed state with the money returned. The rule to say out loud is that the ledger is append-only — you never edit a payment record, you append the reversal."],
              ["\"The seat map is stale and users are furious.\"", "Accept staleness and design the interface around it. The map is CDN-cached with a short time-to-live plus a delta feed, and the client shows availability as advisory. The reserve call is the only source of truth, so a click on a green seat can legitimately return a conflict — and that response should name the reason and immediately offer the nearest alternatives rather than dumping the user back to a stale map. During a drop, 88% of attempts fail by arithmetic; the failure experience is the product."]
            ]
          },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "States the no-double-booking invariant, uses a hold with an expiry, and avoids check-then-act by using a transaction or a conditional update. Knows browse and buy have different needs."],
              ["<strong>Senior</strong>", "Puts expiry inside the reserve predicate rather than relying on a sweeper. Partitions inventory by event to bound the blast radius. Designs checkout as a saga with idempotency and compensations, and adds admission control for the drop."],
              ["<strong>Staff</strong>", "Derives the design from the numbers: a peak-to-average ratio in the hundreds argues for shedding rather than scaling, and an 88% failure rate makes the rejection path a first-class product surface. Refuses to weaken the invariant for throughput, and separates the correctness mechanism from the capacity mechanism explicitly."]
            ]
          },
          { t: "note", variant: "key", html: "<strong>The invariant lives on one row, so enforce it with one conditional write — then buy capacity in front of it, never inside it.</strong> Lazy expiry in the predicate makes correctness independent of background jobs; a waiting room turns a stampede into a measurable queue; partitioning by event keeps one hot tour from taking down the catalogue. When most requests are arithmetically guaranteed to fail, designing the failure is the job." }
        ]
      },

      /* ========================== 6 · INSTAGRAM ========================== */
      {
        id: "instagram",
        title: "Design photo sharing with a feed",
        summary: "Fan-out on write versus on read, and the single account with a hundred million followers that forces a hybrid.",
        minutes: 11,
        tags: ["breakdown", "fan-out", "feed", "cdn"],
        blocks: [
          { t: "p", html: "Post a photo; everyone who follows you sees it near the top of their feed. The photo storage is a solved problem with a big bill. The feed is where the design lives, and it comes down to one question: do you do the work when someone posts, or when someone reads?" },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "ul", items: [
            "<strong>Chronological or ranked?</strong> Reverse-chronological in v1, with a ranking hook. Ranking is <a class='inline' href='#/breakdowns/foundations/news-feed'>its own breakdown</a>; keeping it out here lets you focus on delivery.",
            "<strong>How skewed is the follower distribution?</strong> Median around 200, maximum around 100 million. That range is the entire hard part, so establish it in the first minute.",
            "<strong>How stale may a feed be?</strong> Seconds. Except for your own posts, which must appear immediately — users treat that as a bug, not a delay.",
            "<strong>Photos, video, or both?</strong> Photos plus short video. Assume server-side transcoding into a handful of renditions.",
            "<strong>Do we need a follower cap?</strong> No, and that is why the celebrity case must be designed rather than bounded away."
          ] },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Upload a photo with a caption; it is processed into renditions and stored.",
            "Follow and unfollow accounts.",
            "Open a home feed of recent posts from followed accounts, newest first, paginated.",
            "See your own post in your own feed immediately after posting.",
            "View any account's profile grid of their own posts."
          ] },
          { t: "ul", items: [
            "<strong>Feed latency:</strong> p99 under 200 ms for the first page, excluding image bytes.",
            "<strong>Feed freshness:</strong> a post from a followed account appears within 10 seconds at p95; your own within 1 second.",
            "<strong>Image delivery:</strong> p95 under 300 ms, which effectively means served from an edge cache.",
            "<strong>Durability:</strong> uploaded originals are never lost; renditions are regenerable and therefore disposable.",
            "<strong>Availability:</strong> 99.9% on the feed; degrade to a stale feed rather than an error page."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  DAU                        = 300,000,000\n" +
            "  posts / user / day         =        0.1\n" +
            "  feed opens / user / day    =          8\n" +
            "  median follower count      =        200\n" +
            "  photos rendered per open   =         10\n" +
            "  stored bytes per post      =       5 MB (original + 4 renditions)\n" +
            "  delivered rendition        =     200 KB\n" +
            "  peak multiplier            =         3x\n" +
            "\n" +
            "WRITES\n" +
            "  300e6 x 0.1                = 30,000,000 posts/day\n" +
            "  30,000,000 / 86,400        = 347       -> ~350 posts/sec\n" +
            "  fan-out inserts 350 x 200  =           -> ~70,000 feed inserts/sec\n" +
            "  peak                       =           -> ~210,000 feed inserts/sec\n" +
            "\n" +
            "READS\n" +
            "  300e6 x 8                  = 2,400,000,000 feed opens/day\n" +
            "  2.4e9 / 86,400             = 27,800    -> ~28,000 feed reads/sec\n" +
            "  peak                       =           -> ~84,000 feed reads/sec\n" +
            "\n" +
            "STORAGE\n" +
            "  30e6 x 5 MB                = 150 TB/day -> ~55 PB/year of pixels\n" +
            "  feed index 300e6 users x 500 entries x 32 B\n" +
            "                             = 4.8 TB     <- fits in a cache fleet\n" +
            "\n" +
            "EGRESS\n" +
            "  2.4e9 x 10 x 200 KB        = 4.8 PB/day -> ~144 PB/month\n" +
            "  at 95% CDN offload the origin still serves ~7 PB/month\n" +
            "\n" +
            "THE CELEBRITY\n" +
            "  one post, 100,000,000 followers\n" +
            "  100e6 / 70,000 per sec     = 1,430 s   -> ~24 minutes of the ENTIRE\n" +
            "                                            fan-out budget, for one post"
          },
          { t: "note", variant: "tip", html: "Three things fall out of that block. The feed index is <strong>4.8 TB</strong> — small enough to live entirely in memory across a cache fleet, which is why storing post ids rather than post content is not a micro-optimisation but the difference between a cache and a database. Image egress is <strong>petabytes a day</strong>, so the CDN is not an optimisation either, it is the serving tier. And one celebrity post consumes <strong>twenty-four minutes</strong> of your total fan-out capacity, which is the number that kills the simple answer." },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  User      user_id  handle  follower_count  is_high_fanout (derived)\n" +
            "  Post      post_id (time-sortable)  author_id  caption  created_at\n" +
            "            renditions{ thumb, small, large }  status\n" +
            "  Follow    follower_id + followee_id (PK)  created_at\n" +
            "  FeedEntry user_id  post_id  author_id  score      <- cache, not truth\n" +
            "\n" +
            "  FeedEntry is ~32 B and holds NO content. Content is hydrated at read\n" +
            "  time from a post cache. This is what keeps 4.8 TB in memory.\n" +
            "\n" +
            "API\n" +
            "  POST /v1/posts        { caption }   -> { post_id, upload_urls }\n" +
            "  POST /v1/posts/{id}/commit          -> 201  (after bytes land)\n" +
            "  GET  /v1/feed?cursor=               -> { posts[], cursor }\n" +
            "  POST /v1/follow    { user_id }      -> 204\n" +
            "  GET  /v1/users/{id}/posts?cursor=   -> { posts[], cursor }"
          },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "  upload --> post service --> object store (original)\n" +
            "                  |               |\n" +
            "                  |               +--> transcode workers --> renditions --> CDN\n" +
            "                  v\n" +
            "            post store (source of truth, sharded by post_id)\n" +
            "                  |\n" +
            "                  +--> fan-out queue\n" +
            "                          |\n" +
            "                          +-- author below threshold?\n" +
            "                          |     yes -> push post_id into follower feed lists\n" +
            "                          |            (skip followers inactive > 30 days)\n" +
            "                          |     no  -> do nothing; readers will pull\n" +
            "                          v\n" +
            "                    feed cache (per-user list, ~500 entries)\n" +
            "\n" +
            "  GET /feed --> read the user's feed list\n" +
            "            --> pull recent posts from the few high-fanout authors followed\n" +
            "            --> merge, sort, hydrate ids -> post cache -> return\n" +
            "            --> image URLs point at the CDN, never at the origin"
          },
          { t: "p", html: "The load-bearing pieces: the <strong>fan-out queue</strong> decouples posting from delivery, so a post is durable and acknowledged in milliseconds while delivery takes seconds. The <strong>feed cache</strong> holds ids only, capped at a few hundred entries per user, which is what makes 300 million feeds affordable. And <strong>hydration</strong> at read time means a deleted or moderated post disappears everywhere at once, because the ids in every feed resolve through one post cache — with fan-out of content instead of ids, you would be chasing copies." },
          { t: "h", text: "6 · The one hard part: where the fan-out work happens" },
          { t: "p", html: "Someone posts. Somebody has to do the work of getting that post in front of followers. Doing it at write time makes reads trivial and writes unbounded; doing it at read time makes writes trivial and reads expensive. Neither is right on its own, and the reason is the shape of the follower distribution." },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "Pure fan-out on read: at every feed open, fetch recent posts from all followed accounts and merge.", "Writes are free and reads are catastrophic. At 28,000 feed opens a second against a median of 200 follows, you are issuing something like 5.6 million timeline lookups a second, most of which return nothing new. The p99 belongs to whoever follows the most accounts, so your most engaged users get the worst experience, and no amount of caching helps because the merge set differs per user."],
              ["<strong>Solid</strong>", "Pure fan-out on write: on post, insert the post id into every follower's precomputed feed list. Reads become one list read.", "Reads are a single cache operation and the latency budget is trivially met — this is the right default for the overwhelming majority of accounts. Two things break it. One post from a hundred-million-follower account is twenty-four minutes of your entire fan-out capacity, which stalls the queue for everyone. And you are writing into the feeds of users who have not opened the app in months, which is most of the work you do."],
              ["<strong>Standout</strong>", "Hybrid: push for authors below a follower threshold; skip push for authors above it and pull their recent posts at read time; skip fan-out to users inactive beyond a window and rebuild their feed lazily when they return.", "The threshold converts an unbounded per-post cost into a bounded one, and the read-side cost stays small because any given reader follows only a handful of high-fan-out accounts — you merge five short lists, not two hundred. Skipping dormant users removes a large fraction of total fan-out writes for content nobody would have seen. The costs to name: two code paths that must produce identical ordering, a lazy-rebuild path that has to be fast enough to serve a returning user's first open, and a threshold that is a tuning parameter you now own — set it where the marginal push cost crosses the marginal pull cost, and expect to move it."]
            ]
          },
          { t: "note", variant: "trap", html: "The trap in the hybrid is your own posts. If your account crosses the threshold, the pull path means <em>you</em> stop seeing your own posts immediately after publishing, which reads as data loss. Always write-through to the author's own feed synchronously, regardless of which path the post takes for everyone else." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"Where exactly do you set the threshold?\"", "Where the costs cross. Pushing to F followers costs F cheap writes once; pulling costs one extra timeline read per reader per feed open, multiplied by how many of that author's followers are active. So the crossover depends on the author's follower count against the read frequency of those followers — a dormant-heavy audience favours pull much earlier than an active one. Start with a follower count in the low hundreds of thousands, measure both sides, and treat it as a live tuning dial rather than a constant in the code."],
              ["\"A user follows 5,000 accounts and 50 of them are celebrities.\"", "That is the case the hybrid is worst at, because the pull side stops being a handful of lists. Cap the merge: pull from the top N high-fan-out authors by recency and affinity rather than all of them, and let the rest arrive through the ranked path on the next refresh. This is a deliberate completeness compromise, and it is the right one — a feed is a sample, not a ledger."],
              ["\"How do you not serve petabytes a day from your origin?\"", "You do not. Renditions are immutable and content-addressed, so they are cacheable forever at the edge with no invalidation logic. The origin serves cache fills only. Pre-warm the edge for high-fan-out authors at publish time, because a celebrity post generates a synchronised global cache miss otherwise. And keep the original in cold storage while renditions live on fast storage: originals are the durability obligation, renditions are regenerable."]
            ]
          },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "Knows both fan-out strategies and picks one with a reason. Stores post ids in feeds and hydrates at read. Puts images on a CDN and transcoding behind a queue."],
              ["<strong>Senior</strong>", "Arrives at the hybrid from the follower distribution rather than from memory, quantifies the celebrity cost, and handles the author's own-post case. Bounds feed length and uses cursor pagination."],
              ["<strong>Staff</strong>", "Treats the threshold as an economic decision with a measurable crossover and an owner. Removes dormant-user fan-out as a first-class saving. Reasons about the edge-cache miss storm a celebrity post creates, and names the completeness compromise in the merge cap instead of pretending the feed is complete."]
            ]
          },
          { t: "note", variant: "key", html: "<strong>Fan-out is a placement decision for a fixed amount of work, and the follower distribution decides where it goes.</strong> Push for the many, pull for the few, skip the dormant, and always write through to the author's own feed. Store ids and hydrate late so moderation and deletion have one place to take effect, and treat the CDN as the serving tier rather than an optimisation." }
        ]
      },

      /* ========================== 7 · NEWS FEED ========================== */
      {
        id: "news-feed",
        title: "Design a ranked social feed",
        summary: "Freshness versus relevance, decided inside a 300 ms budget you have to spend deliberately.",
        minutes: 10,
        tags: ["breakdown", "ranking", "latency-budget", "feed"],
        blocks: [
          { t: "p", html: "The delivery problem — getting posts into the right feeds — is solved in <a class='inline' href='#/breakdowns/foundations/instagram'>the photo-sharing breakdown</a>. This one starts after that: you have a pile of eligible posts and a few hundred milliseconds to decide which fifteen a person sees first. The tension is that the newest content is the least evaluated, and the best-evaluated content is old." },
          { t: "p", html: "Underneath every feed is one decision: <strong>when does a new post reach its followers' feeds?</strong> The two pure strategies below are the vocabulary; the hard part later on this page is choosing between them per author." },
          { t: "compare",
            bad: { title: "Fan-out on write (push)", items: ["On post, insert its id into every follower's precomputed feed", "✓ Reading a feed is one list read", "✗ One celebrity post means millions of writes", "✗ Work wasted on followers who never open the app"] },
            good: { title: "Fan-out on read (pull)", items: ["On read, gather recent posts from everyone followed and merge", "✓ Posting is cheap; nothing is wasted", "✗ Reads get heavy for users following thousands", "✓ The natural fit for authors with huge followings"] }
          },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "ul", items: [
            "<strong>What are we optimising?</strong> Not clicks. Assume a blended engagement objective with explicit guardrails on integrity and diversity — and say that a single-metric objective is how feeds go wrong.",
            "<strong>How fresh does content need to be?</strong> Something posted five minutes ago must be eligible. That single answer rules out fully precomputed feeds.",
            "<strong>Personalised or global ranking?</strong> Personalised. Assume per-user features exist and a model serves scores.",
            "<strong>What is the latency budget?</strong> 300 ms at p99 for the first page. Get this number early; it constrains every later choice.",
            "<strong>How large is the eligible pool?</strong> Thousands to low tens of thousands per user per session. Large enough that scoring all of it is not free."
          ] },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Return a ranked page of posts for a user, with a cursor for the next page.",
            "Include content posted minutes ago, not only content that has been scored offline.",
            "Never show the same post twice within a session, and rarely across sessions.",
            "Apply integrity filters and diversity rules before returning results.",
            "Degrade to something reasonable when the ranker is slow or unavailable."
          ] },
          { t: "ul", items: [
            "<strong>Latency:</strong> p99 under 300 ms end to end for the first page.",
            "<strong>Freshness:</strong> a post is eligible for ranking within 60 seconds of creation.",
            "<strong>Availability:</strong> 99.95%. A degraded feed is acceptable; an empty feed is not.",
            "<strong>Dedup:</strong> zero repeats within a session; a decayed seen-set across sessions.",
            "<strong>Cost:</strong> scoring CPU must be a stated, bounded number per request — not whatever the candidate set happens to be."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  DAU                          = 100,000,000\n" +
            "  feed opens / user / day      =           6\n" +
            "  candidates retrieved / open  =         500\n" +
            "  CPU to score one candidate   =       20 us\n" +
            "  p99 end-to-end budget        =      300 ms\n" +
            "  response payload             =       40 KB\n" +
            "  peak multiplier              =        2.5x\n" +
            "\n" +
            "REQUESTS\n" +
            "  100e6 x 6                    = 600,000,000 opens/day\n" +
            "  600,000,000 / 86,400         = 6,944     -> ~7,000 feed builds/sec\n" +
            "  peak                         =           -> ~17,500 feed builds/sec\n" +
            "\n" +
            "SCORING COST (the number that decides the architecture)\n" +
            "  7,000 x 500                  = 3,500,000 candidate scores/sec\n" +
            "  3,500,000 x 20 us            = 70 CPU-seconds per second -> ~70 cores\n" +
            "  peak 17,500 x 500 x 20 us    = 175 CPU-seconds/sec       -> ~175 cores\n" +
            "\n" +
            "LATENCY BUDGET (300 ms, spent explicitly)\n" +
            "  retrieval 120 | scoring 80 | hydration 50 | slack 50   = 300 ms\n" +
            "\n" +
            "RANKING STATE\n" +
            "  user vector 256 floats x 4 B = 1 KB\n" +
            "  100e6 x 1 KB                 = ~100 GB   (memory-resident, small fleet)\n" +
            "\n" +
            "EGRESS\n" +
            "  600e6 x 40 KB                = 24 TB/day -> ~720 TB/month"
          },
          { t: "note", variant: "tip", html: "Seventy cores. That is what 500 candidates costs, and it is affordable precisely because 500 is a <em>constant you chose</em>. Double the candidate count and you double the bill and the scoring latency; make it unbounded and you have no bill and no budget, just an outage waiting for a user with a large following graph. <strong>Retrieval exists to make ranking affordable.</strong>" },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  Candidate    post_id  author_id  created_at  source  retrieval_score\n" +
            "  Features     post: age, author affinity, media type, early engagement\n" +
            "               user: interests vector, session context, recent negatives\n" +
            "  SeenSet      user_id -> decaying set of post_ids (probabilistic + exact tail)\n" +
            "  RankedPage   user_id  cursor  post_ids[]  generated_at  model_version\n" +
            "\n" +
            "  Sources feeding retrieval (each capped, each independently disableable):\n" +
            "    followed-authors recent | topic/interest match | trending in network\n" +
            "    | exploration slot\n" +
            "\n" +
            "API\n" +
            "  GET  /v1/feed?cursor=&limit=  -> { items[], cursor, model_version }\n" +
            "  POST /v1/feed/seen { post_ids[] }            -> 204\n" +
            "  POST /v1/feed/feedback { post_id, action }   -> 204  (hide, report, like)"
          },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "  GET /feed\n" +
            "     |\n" +
            "     v\n" +
            "  [1] RETRIEVAL  (120 ms budget)  -- parallel, capped, timeout each\n" +
            "        followed recent  --+\n" +
            "        interest match   --+--> ~500 candidates, dedup vs SeenSet\n" +
            "        trending         --+\n" +
            "        exploration      --+\n" +
            "     |\n" +
            "     v\n" +
            "  [2] LIGHT RANKER (cheap model, all 500)     --> keep top 50\n" +
            "     |\n" +
            "     v\n" +
            "  [3] HEAVY RE-RANKER (expensive model, 50)   --> ordered 50\n" +
            "     |\n" +
            "     v\n" +
            "  [4] RULES PASS: integrity filters, author diversity, ad/interstitial slots\n" +
            "     |\n" +
            "     v\n" +
            "  [5] HYDRATE ids -> content cache -> response (50 ms budget)\n" +
            "\n" +
            "  Every stage has a timeout. On timeout, emit the previous stage's order\n" +
            "  and record it. A late feed is a bug; a slow feed is an outage."
          },
          { t: "p", html: "The load-bearing idea is the <strong>funnel</strong>: each stage is more expensive per item and sees fewer items, so total cost stays flat while quality rises. The second load-bearing idea is that every stage degrades to the one before it. If the heavy re-ranker times out, you return the light ranker's order — slightly worse, on time. That property is what lets you run an expensive model on the hot path at all." },
          { t: "h", text: "6 · The one hard part: freshness against relevance, inside the budget" },
          { t: "p", html: "New content has no engagement signal yet, so any relevance model ranks it low; but a feed of well-evidenced week-old posts is dead. And whatever you do about it has to fit in 300 milliseconds." },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "Sort by recency, or precompute the whole ranked feed offline on a schedule.", "Recency-only hands the feed to whoever posts most often and ignores everything you know about the reader — cheap, predictable and bad. Precomputing offline has the opposite failure: quality is fine but nothing posted since the last batch can appear, so the feed is structurally stale and the 60-second freshness requirement is simply unmet. Both are really the same mistake, which is refusing to spend any request-time compute."],
              ["<strong>Solid</strong>", "Retrieve a capped candidate set at request time, score it with one model, and include age as a feature with a decay term.", "This is a real feed and it meets the budget. Freshness competes on the same scale as everything else rather than being bolted on afterwards, and the capped candidate set makes the cost predictable. Where it strains is quality per millisecond: one model that is cheap enough to run on 500 items is not the best model you could run on 50, so you are leaving accuracy on the table at the top of the feed, which is the only part most users see."],
              ["<strong>Standout</strong>", "A staged funnel — capped multi-source retrieval, a cheap ranker over all candidates, an expensive re-ranker over the surviving top 50, then a rules pass for diversity and integrity — with freshness expressed as an explicit decay multiplier, a reserved exploration slot for unevaluated content, and a per-stage timeout that degrades to the previous stage's order.", "You get the expensive model's judgement exactly where it changes what the user sees, at one tenth of the scoring volume. The decay multiplier makes the freshness/relevance trade a tunable curve rather than an argument, and the exploration slot is what stops the cold-start feedback loop where new content never gets the impressions it needs to prove itself. The costs are honest ones: more moving parts, two models to keep consistent and version together, and a per-stage timeout policy that must be tested under load or it is decoration."]
            ]
          },
          { t: "note", variant: "trap", html: "Optimising a single engagement metric is the failure mode that looks like success on every dashboard. Engagement-only objectives reliably promote outrage and clickbait because those genuinely do get engagement. State the guardrails as part of the objective — a precision floor on integrity, an author-diversity constraint, a cap on any single source — and enforce them in the rules pass where they cannot be traded away by a model retrain." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"Precompute or compute on demand?\"", "Both, split by what changes. Candidate generation is partly precomputed — followed-author recency lists and interest matches are maintained continuously — while scoring and ordering happen per request because they depend on session context and time. The rule of thumb: precompute anything that does not depend on the current request, compute anything that does. Fully precomputing the ordered page saves latency and loses freshness, so it is only worth it as a fallback."],
              ["\"How do you not show the same post twice?\"", "A per-user seen-set consulted during retrieval, not after ranking — filtering after ranking wastes the scoring you just paid for. Keep a probabilistic structure for the long tail plus an exact list of the last few hundred, and decay it so a post from three weeks ago can resurface. Write to it optimistically on serve rather than waiting for a client impression callback, and accept the small false-negative rate."],
              ["\"The ranking service is down. What does the user see?\"", "A feed, not an error. Fall back through the stages: heavy ranker out means light ranker order, light ranker out means retrieval order with recency and affinity weighting, retrieval degraded means the last successfully generated page from cache with a fresh-content prepend. Each level is worse and each is fine. Track which level served each request, because a silent permanent fallback is the outage nobody pages for."]
            ]
          },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "Separates retrieval from ranking, caps the candidate set, treats recency as a feature rather than a sort order, and dedups against a seen-set."],
              ["<strong>Senior</strong>", "Spends the latency budget explicitly per stage and multiplies out the scoring cost. Builds the two-stage funnel and justifies it economically. Defines degradation behaviour for a slow or dead ranker."],
              ["<strong>Staff</strong>", "Frames the objective with guardrails and refuses a single engagement metric. Names the cold-start feedback loop and reserves capacity for exploration. Treats model version, fallback level and per-stage timeouts as operational surfaces that must be observable, not implementation details."]
            ]
          },
          { t: "note", variant: "key", html: "<strong>Cap the candidates, then spend the compute where it changes the answer.</strong> A funnel keeps cost flat while quality rises, per-stage timeouts that degrade to the previous stage make an expensive model safe on the hot path, and freshness belongs in the score as a decay term plus a reserved exploration slot — not as a separate sort order bolted on the side." }
        ]
      },

      /* ============================ 8 · TINDER ============================ */
      {
        id: "tinder",
        title: "Design swipe matching",
        summary: "One-directional swipes, a mutual match that must fire exactly once, and a deck that never repeats a face.",
        minutes: 10,
        tags: ["breakdown", "concurrency", "idempotency", "bloom-filter"],
        blocks: [
          { t: "p", html: "Show a profile, swipe left or right, and if two people both swipe right, they match and can talk. The write volume is large and boring. The interesting part is a two-row race condition that can produce zero matches or two, and the fact that never showing the same face twice is a harder storage problem than recording the swipes." },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "ul", items: [
            "<strong>Is a swipe reversible?</strong> One undo of the most recent swipe. That small answer forces the swipe record to be mutable, which changes the match logic.",
            "<strong>How fast must a match notification arrive?</strong> Seconds. It does not need to be synchronous with the swipe, which lets the notification ride an outbox.",
            "<strong>How is the deck ordered?</strong> Geo plus filters plus a desirability blend. Assume it is precomputed in batches, not per swipe.",
            "<strong>Can a profile ever reappear?</strong> Not within a long window. Users report repeats as a bug, so treat the seen-set as a requirement, not a nicety.",
            "<strong>Any swipe limits?</strong> Yes, a daily cap on right swipes for free accounts — which conveniently bounds abuse and the write rate at once."
          ] },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Serve a deck of candidate profiles honouring distance, age and preference filters.",
            "Record a left or right swipe, quickly and durably.",
            "Detect a mutual right-swipe and create exactly one match.",
            "Notify both users of a new match, exactly once each.",
            "Never re-show a profile the user has already swiped on."
          ] },
          { t: "ul", items: [
            "<strong>Swipe latency:</strong> p99 under 100 ms. The interaction must feel instant or the product is broken.",
            "<strong>Match correctness:</strong> exactly one match row and exactly one notification per pair, under any interleaving or retry.",
            "<strong>Deck latency:</strong> p99 under 300 ms for a fresh deck; the client prefetches so this is rarely on the critical path.",
            "<strong>No repeats:</strong> a swiped profile does not reappear for at least a year.",
            "<strong>Availability:</strong> 99.9%. Swipes may buffer client-side briefly during a blip."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  DAU                        = 20,000,000\n" +
            "  swipes / user / day        =         60\n" +
            "  right-swipe rate           =        30%\n" +
            "  mutual rate among rights   =         3%\n" +
            "  deck size                  =         25\n" +
            "  swipe row on disk          =       64 B\n" +
            "  peak multiplier            =         3x\n" +
            "\n" +
            "WRITES\n" +
            "  20e6 x 60                  = 1,200,000,000 swipes/day\n" +
            "  1.2e9 / 86,400             = 13,900     -> ~14,000 swipes/sec\n" +
            "  peak                       =            -> ~42,000 swipes/sec\n" +
            "\n" +
            "MATCHES\n" +
            "  1.2e9 x 0.30               = 360,000,000 right swipes/day\n" +
            "  360e6 x 0.03               = 10,800,000 matches/day\n" +
            "  10,800,000 / 86,400        = 125 matches/sec\n" +
            "  = 0.9% of the write rate   <- the rare path, and the only hard one\n" +
            "\n" +
            "DECK READS\n" +
            "  60 / 25                    = 2.4 deck fetches/user/day\n" +
            "  20e6 x 2.4 = 48,000,000/day-> ~560 deck builds/sec\n" +
            "\n" +
            "STORAGE\n" +
            "  1.2e9 x 64 B               = ~77 GB/day -> ~28 TB/year of swipes\n" +
            "  seen-set as a Bloom filter:\n" +
            "    60 x 365 = ~22,000 swipes/user/year x 10 bits = ~28 KB/user/year\n" +
            "    20e6 x 28 KB             = ~560 GB    <- cheap enough to keep hot\n" +
            "\n" +
            "EGRESS\n" +
            "  48e6 decks x 50 KB of JSON = 2.4 TB/day -> ~72 TB/month\n" +
            "  (photos ride the CDN and dwarf this)"
          },
          { t: "note", variant: "tip", html: "Read the ratio: <strong>14,000 swipes a second, 125 matches a second</strong>. Under one percent of writes reach the hard path. That is a licence to make the common case as cheap as possible — an append with no reads — and to spend the complexity budget entirely on the rare case where two swipes meet." },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  Swipe      actor_id + target_id (PK)  direction  created_at\n" +
            "  Pair       pair_key (PK) = min(a,b) + \":\" + max(a,b)\n" +
            "             a_right  b_right  state(none|pending|mutual)  matched_at\n" +
            "  Match      pair_key  matched_at  conversation_id  state\n" +
            "  SeenSet    user_id -> bloom filter bytes + exact recent tail\n" +
            "  Deck       user_id  profile_ids[]  built_at  filter_hash\n" +
            "\n" +
            "  The Pair row is the trick. Both directions of a potential match live on\n" +
            "  ONE row, chosen by sorting the two user ids, so mutuality is a single-row\n" +
            "  state transition rather than a cross-row read.\n" +
            "\n" +
            "API\n" +
            "  GET  /v1/deck?cursor=            -> { profiles[], cursor }\n" +
            "  POST /v1/swipe { target_id, dir } -> 200 { matched: bool }\n" +
            "  POST /v1/swipe/undo               -> 200   (last swipe only)\n" +
            "  GET  /v1/matches?cursor=          -> { matches[], cursor }"
          },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "  client (prefetches decks, buffers swipes offline)\n" +
            "     |\n" +
            "     +--> POST /swipe --> swipe service\n" +
            "     |                       |\n" +
            "     |                       +--> append Swipe (partitioned by actor_id)\n" +
            "     |                       |\n" +
            "     |                       +--> IF direction == right:\n" +
            "     |                              conditional update on Pair row\n" +
            "     |                              (partitioned by pair_key)\n" +
            "     |                                 none    -> pending\n" +
            "     |                                 pending -> mutual  <== emits match\n" +
            "     |                                              + outbox row\n" +
            "     |                       +--> add target to actor's seen-set\n" +
            "     |\n" +
            "     +--> GET /deck --> deck service --> precomputed deck cache\n" +
            "                              |            (rebuilt async per user)\n" +
            "                              +--> filter against seen-set before serving\n" +
            "\n" +
            "  outbox relay --> notification service --> both users (exactly once)"
          },
          { t: "p", html: "The load-bearing choices are the two partition keys. Swipes are partitioned by <strong>actor</strong>, because that is how they are written and how \"my swipe history\" is read. The Pair row is partitioned by <strong>pair key</strong>, because that is the only way both halves of a potential match land on the same node and can be updated atomically. Writing the same fact under two keys is a deliberate denormalisation, and being able to say why is most of the answer." },
          { t: "h", text: "6 · The one hard part: exactly one match, exactly one notification" },
          { t: "p", html: "Two people right-swipe each other within the same millisecond. The naive implementation reads the other person's swipe, does not find it because it has not committed yet, and writes its own — twice, in both directions. Zero matches. Change the timing slightly and you get two matches and two pairs of notifications." },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "On a right swipe, write the swipe row, then read for the reciprocal swipe; if present, insert a match.", "Check-then-act across two rows with no coordination. Simultaneous swipes both read before either write is visible, so nobody matches — and the users are told nothing, which is worse than an error because there is nothing to retry. Under other interleavings both requests find the reciprocal and both insert, giving two match rows and duplicate notifications. It fails silently in the direction that loses you the product's core moment."],
              ["<strong>Solid</strong>", "Insert into a match table keyed by the sorted pair, with a uniqueness constraint; the loser of the race gets a conflict and swallows it.", "Now at most one match row can exist, which is a real improvement — the database enforces the invariant. But the check for reciprocity is still a separate read, so you can get zero matches under the simultaneous case, and the notification is emitted by whichever request happened to win, which is fine until that request times out after committing. Retries can then double-notify."],
              ["<strong>Standout</strong>", "One Pair row keyed by the sorted user ids holds both directions. A right swipe is a conditional update that sets your side and, if the other side is already set, transitions the row to mutual in the same operation. That single transition — and only that transition — writes an outbox row that drives notification.", "Mutuality becomes a single-row state machine, so there is no interleaving that produces zero or two matches: one of the two concurrent updates observes the other's side and performs the transition, and the other does not. Because the outbox row is written in the same transaction as the transition, the notification cannot be lost if the process dies, and cannot be duplicated because the relay is keyed by pair. The costs to state: the pair partition is a second write on the right-swipe path (about 30% of swipes), the pair key must be canonical everywhere or you get two rows for one pair, and undo now has to reverse a state machine rather than delete a row."]
            ]
          },
          { t: "note", variant: "trap", html: "Undo is the case that breaks naive designs. If a user rewinds a right swipe that already produced a match, you must transition the pair back and revoke the match — and you must handle the notification that already went out. The clean rule is that a match, once shown to the other person, is not silently deleted: it becomes an unmatched state with the conversation closed. Say that out loud, because it is a product decision hiding in a data model." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"How do you guarantee a profile never reappears?\"", "A per-user seen-set consulted at deck-build time. A Bloom filter gives membership at about 28 KB per user-year with a small false-positive rate, and a false positive here is benign — it silently drops one candidate from a deck of thousands. Back it with the exact swipe table for anything that must be certain, such as the undo path. Filter during deck construction, not at render time, or the deck shrinks unpredictably and the client runs dry."],
              ["\"Where does the deck come from at 560 builds a second?\"", "Precomputed asynchronously per user and cached, rebuilt when the user's filters change, when they move materially, or when the deck runs low. Building on demand would put geo query, filtering, ranking and seen-set subtraction on a 300 ms path for every fetch. The client prefetching the next deck while the user swipes the current one hides the build entirely, which is why the deck latency requirement is soft."],
              ["\"28 TB a year of swipes. Do you keep all of it?\"", "Keep right swipes indefinitely — they are the match graph and the recommendation signal. Left swipes are mostly a seen-set with extra bytes, so age them: keep a recent window at full fidelity for undo and abuse investigation, and compact the rest into the Bloom filter, which is three orders of magnitude smaller. That is a retention decision, so it needs a stated policy rather than an implicit one."]
            ]
          },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "Stores swipes one-directionally, uses a canonical sorted pair key for matches, and relies on a uniqueness constraint rather than an application check. Knows the deck must be filtered against past swipes."],
              ["<strong>Senior</strong>", "Solves the simultaneous-swipe race explicitly with a single-row transition, drives notification from an outbox so it survives a crash, and chooses partition keys deliberately for both the swipe and pair writes."],
              ["<strong>Staff</strong>", "Reads the 1% match ratio and optimises the common path to a bare append. Treats the seen-set as a distinct storage problem with its own cost model and retention policy. Handles undo as a state-machine reversal with a stated product rule, and names the canonical-key hazard."]
            ]
          },
          { t: "note", variant: "key", html: "<strong>Put both halves of the decision on one row and let a single conditional transition be the match.</strong> A canonical pair key turns a distributed race into a single-row state machine, and writing the outbox row inside that same transition makes the notification exactly-once for free. Under one percent of swipes reach this path, so keep the other ninety-nine percent an append with no reads." }
        ]
      },

      /* =========================== 9 · LEETCODE =========================== */
      {
        id: "leetcode",
        title: "Design a coding-problem judge",
        summary: "Executing code you did not write, safely, and scheduling it fairly when a contest starts.",
        minutes: 11,
        tags: ["breakdown", "sandboxing", "queueing", "fairness"],
        blocks: [
          { t: "p", html: "Submit a solution, run it against a hidden test suite, get a verdict and a runtime. The web application is unremarkable. The interesting part is that you are running arbitrary code from anonymous strangers on your own machines, and that ten thousand people press submit within the same minute when a contest begins." },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "ul", items: [
            "<strong>How many languages?</strong> Around fifteen. That matters because each needs its own toolchain image and its own resource profile.",
            "<strong>Synchronous or asynchronous verdicts?</strong> Asynchronous. The client submits, polls or subscribes, and the server never holds a request open for twenty seconds of judging.",
            "<strong>Is measured runtime part of the product?</strong> Yes — users compare it and it appears on leaderboards. That turns a noisy measurement into a correctness requirement.",
            "<strong>What does contest load look like?</strong> Roughly a hundred thousand contestants, heavily bursty at the start and at each problem release.",
            "<strong>Do test cases stay hidden?</strong> Yes, and the sandbox must not be able to exfiltrate them."
          ] },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Accept a submission and return an id immediately.",
            "Compile and run it against the problem's test cases with time and memory limits.",
            "Return a verdict — accepted, wrong answer, timeout, memory exceeded, runtime error, compile error — with the first failing case for public tests only.",
            "Report a runtime that is comparable across submissions.",
            "Stay responsive and fair during a contest, where a minority of users generate most of the load."
          ] },
          { t: "ul", items: [
            "<strong>Verdict latency:</strong> p95 under 10 seconds off-contest, under 30 seconds during a contest.",
            "<strong>Isolation:</strong> submitted code cannot read another submission, reach the network, touch host state, or outlive its limits.",
            "<strong>Fairness:</strong> no single user's submissions can consume more than a bounded share of the judging pool.",
            "<strong>Durability:</strong> an accepted submission is never lost, even if every worker dies mid-run.",
            "<strong>Runtime comparability:</strong> the same code submitted twice reports times within a small, stated tolerance."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  submissions / day (normal) =  2,000,000\n" +
            "  contest contestants        =    100,000\n" +
            "  submit burst               = 15% inside one minute\n" +
            "  test cases per problem     =        100\n" +
            "  CPU per test case          =     200 ms\n" +
            "  worker machine             =   16 cores\n" +
            "  problems in the catalogue  =      3,000\n" +
            "  test data per case         =      50 KB\n" +
            "\n" +
            "THROUGHPUT\n" +
            "  2,000,000 / 86,400         = 23      -> ~25 submissions/sec baseline\n" +
            "  100,000 x 0.15 = 15,000 in 60 s      -> 250/sec, call it 300/sec peak\n" +
            "  peak : baseline            =         -> ~12x\n" +
            "\n" +
            "CPU (the real currency here)\n" +
            "  100 cases x 200 ms         = 20 CPU-seconds per submission\n" +
            "  baseline 25/s x 20 s       = 500 CPU-seconds/sec -> ~500 cores -> ~32 machines\n" +
            "  peak     300/s x 20 s      = 6,000 CPU-seconds/sec -> ~375 machines\n" +
            "  ^ you do not buy 375 machines for ninety minutes a week. You queue.\n" +
            "\n" +
            "STORAGE\n" +
            "  source 2 KB + result 1 KB  = 3 KB per submission\n" +
            "  2,000,000 x 3 KB           = 6 GB/day  -> ~2.2 TB/year\n" +
            "  test data 3,000 x 100 x 50 KB = 15 GB total\n" +
            "  ^ small enough to cache on every worker's local disk\n" +
            "\n" +
            "EGRESS\n" +
            "  2,000,000 x 5 KB           = 10 GB/day -> ~300 GB/month  (trivial)"
          },
          { t: "note", variant: "tip", html: "Egress is negligible, storage is a rounding error, and the request rate would embarrass a small website. <strong>This system is sized entirely by CPU-seconds</strong>, and the peak demand is twelve times the baseline for about ninety minutes a week. Both facts point the same way: a durable queue and a bounded worker pool, not a bigger fleet." },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  Problem     problem_id  limits{ time_ms, memory_mb }  testcase_bundle_hash\n" +
            "  Submission  submission_id  user_id  problem_id  language  source_key\n" +
            "              state(queued|running|done)  verdict  runtime_ms  queued_at\n" +
            "  Job         submission_id  lease_owner  lease_expires_at  attempt\n" +
            "  Worker      worker_id  pool(default|contest)  cores  image_versions[]\n" +
            "\n" +
            "  Test bundles are content-addressed by hash and cached on workers, so a\n" +
            "  worker fetches a bundle once and reuses it for thousands of submissions.\n" +
            "\n" +
            "API\n" +
            "  POST /v1/submissions { problem_id, language, source }\n" +
            "        -> 202 { submission_id, queue_position }\n" +
            "  GET  /v1/submissions/{id}   -> { state, verdict?, runtime_ms?, position? }\n" +
            "  GET  /v1/submissions/{id}/stream  -> server-sent updates"
          },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "  client --POST--> api (stateless)\n" +
            "                     |  1. store source in object store\n" +
            "                     |  2. insert Submission (state=queued)  <- durable\n" +
            "                     |  3. enqueue job\n" +
            "                     v\n" +
            "              +-------------------+\n" +
            "              |  scheduler        |  weighted fair queueing:\n" +
            "              |                   |   one in-flight job per user by default\n" +
            "              |                   |   separate contest pool with its own cap\n" +
            "              +---------+---------+\n" +
            "                        | lease (expires; another worker can retake)\n" +
            "                        v\n" +
            "              +-------------------+     no network, no credentials\n" +
            "              |  judge worker     |     read-only rootfs, cgroup limits\n" +
            "              |   micro-VM per    |     seccomp syscall allow-list\n" +
            "              |   submission      |     wall AND cpu timeouts\n" +
            "              +---------+---------+\n" +
            "                        | verdict\n" +
            "                        v\n" +
            "              submission store --> stream to client, update leaderboard"
          },
          { t: "p", html: "The load-bearing pieces: the submission is <strong>durable before it is enqueued</strong>, so a lost queue message costs a re-enqueue rather than a lost answer. The <strong>lease</strong> on each job means a worker that dies mid-run releases its work automatically — with an attempt counter so a submission that crashes workers repeatedly is quarantined rather than retried forever. And the worker holds <strong>no credentials at all</strong>: it pulls test bundles through a signed, read-only path, so compromising a worker yields nothing worth having." },
          { t: "h", text: "6 · The one hard part: running code you did not write" },
          { t: "p", html: "The submitted program is hostile by default. Assume it will try to read the test data, open a socket, fork until the machine dies, fill the disk, and stay alive after its timeout. Every one of those has been attempted on every judge that has ever existed." },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "Run the program as an unprivileged user in a container with a wall-clock timeout.", "A wall-clock timeout does not stop a fork bomb from taking the host down before it fires, and an unprivileged user can still fill /tmp, exhaust file descriptors, and open outbound connections. Shared kernel plus no syscall restriction means one kernel bug is a full escape. And because the container is reused, one submission can leave state behind for the next."],
              ["<strong>Solid</strong>", "A locked-down container: seccomp syscall allow-list, no network namespace, read-only root filesystem, cgroup limits on CPU, memory and process count, both wall and CPU timeouts, and a fresh container per submission.", "This is a genuinely defensible sandbox and it stops every attack in the paragraph above. The residual risk is the shared kernel: your entire isolation boundary is the syscall filter, so a kernel vulnerability reachable through an allowed syscall is a full compromise. That is a real, recurring class of bug, not a hypothetical."],
              ["<strong>Standout</strong>", "A micro-VM per submission — hardware-level isolation with its own kernel — containing all of the container hardening above, running on ephemeral workers that are destroyed after a bounded number of jobs, in a network zone with no credentials and no route to internal services.", "Defence in depth with independent layers: escaping the sandbox now means escaping a hypervisor, and succeeding still lands you on a credential-free machine in an isolated network that is about to be deleted. Worker recycling bounds the value of any persistent foothold. The costs are honest: micro-VM start-up adds tens to low hundreds of milliseconds per submission, you have a VM image pipeline to maintain per language, and utilisation drops because you cannot pack as tightly. At twenty CPU-seconds of real work per submission, that start-up overhead is a percent or two — which is exactly why the trade is easy here and would not be for a millisecond-scale workload."]
            ]
          },
          { t: "note", variant: "trap", html: "The most-missed limit is output. A submission that writes an unbounded stream to standard output will fill a disk or blow up the result path long before any CPU limit triggers. Cap output bytes, cap the number of processes, cap file descriptors, cap total written bytes, and enforce a CPU-time limit alongside the wall-clock one — a program that sleeps forever and one that spins forever need different limits to catch." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"A contest starts and the queue is thousands deep. Who runs first?\"", "Weighted fair queueing, not first-in-first-out. Default to one in-flight submission per user so a single contestant cannot occupy the pool, and give the contest its own reserved capacity so practice submissions never delay a scored one. Publish the queue position and estimated wait, because a visible queue is a wait and an invisible one is an outage. Shed or throttle at the door if the queue exceeds a depth you can drain within the latency target — accepting work you cannot do soon is a lie."],
              ["\"Two identical submissions report different runtimes. Users are complaining.\"", "Measured wall-clock time on shared hardware is noisy by construction. Pin the sandbox to dedicated cores, disable frequency scaling where you can, and discard warm-up. Then stop reporting absolute time: run a reference solution on the same worker in the same conditions and report the submission relative to it, so machine-to-machine variance cancels. State a tolerance publicly rather than pretending the number is exact."],
              ["\"How do you stop a submission stealing the hidden tests?\"", "It cannot exfiltrate what it cannot reach. No network namespace means no outbound connection at all, so even reading the bundle yields nothing transmissible. Beyond that, feed inputs through a pipe rather than mounting the bundle where the program can enumerate it, return only the first failing public case rather than the failing input for hidden cases, and rate-limit submissions per problem so nobody reconstructs the suite by binary search across hundreds of probing attempts."]
            ]
          },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "Queues submissions instead of judging inline, runs code in a container with CPU, memory and time limits, and returns a verdict asynchronously with polling."],
              ["<strong>Senior</strong>", "Sizes the system in CPU-seconds and shows why the peak must be queued rather than provisioned. Uses leases so worker death is recoverable, makes submissions durable before enqueue, and enumerates sandbox limits including processes and output."],
              ["<strong>Staff</strong>", "Argues the isolation boundary explicitly and justifies the micro-VM cost against the twenty-second workload. Designs fairness as a first-class scheduling policy with reserved contest capacity and visible queue position. Treats runtime measurement as a product correctness problem and solves it with a reference baseline."]
            ]
          },
          { t: "note", variant: "key", html: "<strong>Size it in CPU-seconds, isolate at the hardware boundary, and schedule for fairness rather than arrival order.</strong> The peak is twelve times baseline for ninety minutes a week, so it belongs in a queue with a visible position, not in a fleet you pay for all year. Assume the submitted code is hostile, give the worker nothing worth stealing, and remember that a measured runtime shown to users is a correctness requirement, not telemetry." }
        ]
      },

      /* =========================== 10 · WHATSAPP =========================== */
      {
        id: "whatsapp",
        title: "Design chat and messaging",
        summary: "Ordering across devices, offline queues, and what a delivered tick is actually promising.",
        minutes: 12,
        tags: ["breakdown", "real-time", "ordering", "multi-device"],
        blocks: [
          { t: "p", html: "Send a message; it arrives, in order, on every device the recipient owns, even the one that was switched off. Then two grey ticks turn blue. Almost every hard idea in this module shows up here — leases, cursors, idempotency, fan-out — and the small print on those ticks is a distributed-systems question wearing a user-interface costume." },
          { t: "p", html: "First, the problem that makes chat different from a request/response service: <strong>connection routing</strong>. Devices hold persistent WebSockets to a fleet of stateful connection nodes, so the sender's socket is on node 3 while the recipient's is on node 8. A <em>session registry</em> maps each device to its node (heartbeats expire stale entries), and a pub/sub <em>delivery bus</em> carries the message from the node that accepted it to the node holding the recipient. A group message is stored once and delivered many times across nodes. The rest of this page builds ordering, offline queues and multi-device sync on top of that routing layer." },
          { t: "diagram", id: "chat-fanout", caption: "A session registry maps device → connection node; a pub/sub delivery bus routes each message between nodes." },
          { t: "h", text: "1 · The prompt and what to ask" },
          { t: "ul", items: [
            "<strong>How many devices per account?</strong> Several, all active simultaneously. Multi-device is the assumption that makes the whole problem interesting, so establish it before anything else.",
            "<strong>End-to-end encrypted?</strong> Yes. The server routes ciphertext it cannot read, which rules out server-side search and server-side content fan-out decisions.",
            "<strong>Group size?</strong> Up to a few hundred. Large enough that fan-out matters, small enough to avoid the broadcast-channel design.",
            "<strong>What ordering do we promise?</strong> Total order within a conversation. Cross-conversation ordering is not promised and nobody notices.",
            "<strong>How long do we hold undelivered messages?</strong> Thirty days, then drop. That is a policy decision with a storage cost attached."
          ] },
          { t: "h", text: "2 · Requirements" },
          { t: "ol", items: [
            "Send a message to a one-to-one conversation or a group.",
            "Deliver it to every device of every recipient, in a consistent order.",
            "Queue for devices that are offline and deliver on reconnect.",
            "Show sent, delivered and read states with a defined meaning.",
            "Let a newly added device obtain enough history to be useful."
          ] },
          { t: "ul", items: [
            "<strong>Delivery latency:</strong> p99 under 500 ms device-to-device when both are online.",
            "<strong>Ordering:</strong> total order per conversation, identical on every device. No device ever displays a different sequence.",
            "<strong>Durability:</strong> an acknowledged message is never lost, even if every connection server restarts.",
            "<strong>Deduplication:</strong> a retried send never produces two visible messages.",
            "<strong>Offline retention:</strong> undelivered messages held for 30 days."
          ] },
          { t: "h", text: "3 · Capacity math" },
          { t: "code", lang: "text", code:
            "STATED ASSUMPTIONS\n" +
            "  DAU                        = 500,000,000\n" +
            "  messages sent / user / day =         40\n" +
            "  recipients per message     =        2.5  (mix of 1:1 and groups)\n" +
            "  devices per user           =        2.2\n" +
            "  read-receipt rate          =        70% of deliveries\n" +
            "  devices connected at peak  =        60%\n" +
            "  message row on disk        =      300 B\n" +
            "  delivered frame on wire    =      400 B\n" +
            "  sockets per connection node=    100,000\n" +
            "\n" +
            "SENDS\n" +
            "  500e6 x 40                 = 20,000,000,000 messages/day\n" +
            "  20e9 / 86,400              = 231,000    -> ~230,000 sends/sec\n" +
            "\n" +
            "DELIVERIES (the number that actually sizes the fleet)\n" +
            "  230,000 x 2.5 x 2.2        = ~1,300,000 device-deliveries/sec\n" +
            "\n" +
            "RECEIPTS\n" +
            "  delivered: 1 per delivery  = 1,300,000/sec\n" +
            "  read:      0.7 per delivery=   910,000/sec\n" +
            "  total receipt events       = ~2,200,000/sec\n" +
            "  ^ receipts cost ~1.7x more than the messages they describe\n" +
            "\n" +
            "CONNECTIONS\n" +
            "  500e6 x 2.2 x 0.60         = 660,000,000 concurrent sockets\n" +
            "  660e6 / 100,000            = ~6,600 connection nodes\n" +
            "  at 10 KB state / socket    = 1 GB of socket state per node\n" +
            "\n" +
            "STORAGE\n" +
            "  20e9 x 300 B               = 6 TB/day   -> ~2.2 PB/year\n" +
            "\n" +
            "EGRESS\n" +
            "  1.3e6 x 400 B              = 520 MB/sec -> ~45 TB/day -> ~1.3 PB/month"
          },
          { t: "note", variant: "tip", html: "The line that surprises people: <strong>receipts are 1.7 times the traffic of the messages themselves</strong>. Every delivery generates a delivered event and most generate a read event, and each of those has to travel back to the sender and out to the sender's other devices. Any design that treats receipts as a cheap afterthought has under-provisioned its largest write stream. Batch them, coalesce them, and never store one row per receipt per device if a cursor will do." },
          { t: "widget", id: "bdCapacityLab" },
          { t: "p", html: "Try the chat preset above, then push devices per user or the read-receipt behaviour around by changing actions per user per day. The lab uses a flat 3x peak multiplier and simple reference units, which is exactly the fidelity a whiteboard estimate deserves — the point is to find the binding constraint, not to be right to two decimal places." },
          { t: "h", text: "4 · Entity model and API" },
          { t: "code", lang: "text", code:
            "ENTITIES\n" +
            "  Conversation  conv_id  type(direct|group)  member_ids[]  next_seq\n" +
            "  Message       conv_id + seq (PK)  sender_id  client_msg_id (UNIQUE)\n" +
            "                ciphertext_ref  sent_at\n" +
            "  DeviceCursor  device_id + conv_id (PK)  delivered_seq  read_seq\n" +
            "  Device        device_id  user_id  connection_node?  last_seen\n" +
            "  Outbox        device_id  conv_id  from_seq       (offline backlog pointer)\n" +
            "\n" +
            "  There is no per-message per-device delivery row. Delivery state is TWO\n" +
            "  integers per device per conversation. That is the difference between\n" +
            "  a few billion rows a day and a few hundred million small updates.\n" +
            "\n" +
            "API\n" +
            "  WS  send    { conv_id, client_msg_id, ciphertext } -> ack { seq }\n" +
            "  WS  ack     { conv_id, delivered_seq }             -> receipts fan out\n" +
            "  WS  read    { conv_id, read_seq }                  -> receipts fan out\n" +
            "  GET /v1/conversations/{id}/messages?after_seq=     -> backlog page"
          },
          { t: "h", text: "5 · High-level design" },
          { t: "code", lang: "text", code:
            "  device ==WebSocket==> +-------------------+\n" +
            "                        | connection node   |  ~100k sockets each\n" +
            "                        +---------+---------+\n" +
            "                                  |\n" +
            "                        +---------v---------+\n" +
            "                        | session registry  |  device -> node, heartbeat TTL\n" +
            "                        +---------+---------+\n" +
            "                                  |\n" +
            "  send --> conversation shard (owns next_seq for this conv_id)\n" +
            "             1. dedup on client_msg_id\n" +
            "             2. assign seq (monotonic, single owner)\n" +
            "             3. persist Message                <- durable here, ack the sender\n" +
            "             4. publish to the delivery bus\n" +
            "                                  |\n" +
            "              +-------------------+-------------------+\n" +
            "              v                                       v\n" +
            "      online devices                          offline devices\n" +
            "      route via registry -> node -> socket     leave Outbox pointer;\n" +
            "      device acks -> delivered_seq advances    deliver on reconnect\n" +
            "\n" +
            "  receipts are messages too: they travel the same ordered path,\n" +
            "  so a read receipt can never arrive before the message it refers to."
          },
          { t: "p", html: "The load-bearing decision is the <strong>conversation shard</strong>. One owner per conversation assigns the sequence number, which is what makes total ordering cheap — no consensus, no vector clocks, just a counter with a single writer. Everything else is delivery mechanics: the <strong>session registry</strong> maps a device to the node holding its socket so the bus knows where to route, and it expires on missed heartbeats so a dead node's entries clean themselves up. Offline devices are not a special case; they are simply devices whose cursor has not advanced." },
          { t: "h", text: "6 · The one hard part: ordering and receipts across many devices" },
          { t: "p", html: "One conversation, several devices per person, some offline, all needing the same order — and a delivered tick whose meaning you have to actually define, because with multiple devices there is no single moment of delivery." },
          { t: "table",
            headers: ["Tier", "Approach", "Why it lands there"],
            rows: [
              ["<strong>Naive</strong>", "Stamp each message with the server's wall-clock time and let clients sort by it; mark delivered when the server persists the message.", "Wall clocks on different servers disagree by more than the interval between messages in an active conversation, so two devices can legitimately render the same exchange in different orders — and users notice immediately, because a reply appears above its question. Retries create duplicates because there is no dedup key. And a tick that fires on server persistence is claiming something about the recipient's phone that the server has no evidence for."],
              ["<strong>Solid</strong>", "A monotonic sequence number per conversation assigned by a single owner; clients sort by seq. At-least-once transport with client-side dedup on a client-generated message id. Delivered means persisted to the recipient's per-device inbox.", "Ordering is now exact and cheap, and duplicates are impossible because the dedup key is generated before the first attempt. This is a solid answer. What it leaves ambiguous is multi-device: if the recipient has three devices and one is off, is the message delivered? And storing a delivery row per message per device is billions of rows a day for information that is monotonic and therefore compressible."],
              ["<strong>Standout</strong>", "Keep the per-conversation sequence for order, and make a pair of per-device cursors — delivered_seq and read_seq — the only delivery state that exists. Each device acknowledges its own cursor; the sender's tick derives from a stated quantifier over the recipient's devices. Receipts travel as entries in the same ordered stream as the messages.", "Delivery state collapses from a row per message per device to two integers per device per conversation, which is what makes 1.3 million deliveries a second affordable. Because cursors are monotonic, acknowledgements are idempotent and out-of-order acks are harmless — a late ack for a lower sequence is simply ignored. Putting receipts in the same ordered stream removes an entire class of bug where a read receipt overtakes its message. The costs are real: you must pick and document the quantifier (any device or all devices, and what a brand-new device does to a long-settled conversation), and a cursor cannot express a gap, so a device that skips a message must be repaired by re-syncing from its last contiguous sequence rather than by patching one entry."]
            ]
          },
          { t: "note", variant: "trap", html: "The quantifier is a product decision that people try to solve in code. If \"delivered\" means all devices, then one tablet in a drawer keeps a conversation on a single tick forever. If it means any device, the tick can appear while the phone in the recipient's pocket has not received anything. Most products choose <em>any device</em> and expire devices that have not connected for a long window — but the point is to choose deliberately and write it down, because support will be asked about it every day." },
          { t: "h", text: "7 · Deep dives" },
          { t: "table",
            headers: ["They will push on", "Your answer"],
            rows: [
              ["\"A device has been off for two weeks. What happens on reconnect?\"", "It presents its cursor and pulls everything after it, paginated, oldest first, so ordering is preserved as it applies. The cursor advances only after a page is durably applied locally, which makes the catch-up resumable across another disconnection. Beyond the 30-day retention the backlog is gone, so the client shows a gap marker rather than silently pretending the conversation is complete — an honest gap is far better than an invisible one."],
              ["\"Two million receipts a second. How do you not fall over?\"", "Coalesce and batch. A cursor advance is idempotent and monotonic, so a client that reads twenty messages sends one ack at the highest sequence rather than twenty acks. On the fan-out side, receipts for the same conversation within a short window collapse into one update to the sender. And because receipts are lower value than messages, they get a lower priority class on the bus and are the first thing shed under load — a delayed blue tick is a far better failure than a delayed message."],
              ["\"The server cannot read the messages. What does that cost the design?\"", "Server-side search, server-side previews, and any content-based routing or moderation. Search becomes a client-side index over locally stored plaintext, which means a new device with no history cannot search it. Group fan-out is per-device rather than per-user because each device has its own keys, which is part of why the delivery count is multiplied by devices rather than by users. Media is encrypted and stored blob-side with the key travelling in the message, so the CDN serves bytes it cannot interpret."]
            ]
          },
          { t: "h", text: "8 · How this scores at each level" },
          { t: "table",
            headers: LEVELS,
            rows: [
              ["<strong>Mid</strong>", "Uses persistent connections with a registry mapping devices to nodes, persists messages before acknowledging, orders by a per-conversation sequence rather than a timestamp, and dedups on a client-generated id."],
              ["<strong>Senior</strong>", "Designs per-device cursors instead of per-message delivery rows and can show the storage difference. Handles offline catch-up as a resumable cursor walk, and treats receipts as their own significant traffic stream rather than a footnote."],
              ["<strong>Staff</strong>", "Defines what delivered means with an explicit quantifier over devices and names the product consequence of each choice. Sizes receipts and discovers they exceed message traffic. Puts receipts in the same ordered stream to eliminate a bug class, and states the honest limits encryption imposes on search, moderation and fan-out."]
            ]
          },
          { t: "p", html: "That is the module. Ten problems, one template: scope it, state your assumptions, do the arithmetic, name the single hard decision, and calibrate the answer to a level. If a page felt thin on a beat, go back to <a class='inline' href='#/breakdowns/foundations/bitly'>the shortener</a> and re-read how the beats connect — the structure is the transferable part, not the individual designs." },
          { t: "note", variant: "key", html: "<strong>One writer per conversation gives you total order for free; two monotonic integers per device give you delivery state for almost nothing.</strong> Cursors make acknowledgements idempotent and offline catch-up resumable, and routing receipts through the same ordered stream stops them overtaking what they describe. The hardest part is not the mechanism — it is deciding, and writing down, what a tick promises when a person has three devices and one of them is in a drawer." },
          { t: "quiz", id: "breakdowns-foundations" }
        ]
      }
    ]
  };

  /* ================================================================
     TRACK REGISTRATION — get-or-create, order independent
     ================================================================ */
  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.breakdowns || (window.TRACKS.breakdowns = { id: "breakdowns", modules: [] });
  T.id = "breakdowns";
  T.name = "Problem Breakdowns";
  T.short = "BREAK";
  T.tagline = "One prompt, one hard part, one level bar";
  T.color = "#f472b6";
  T.blurb = "Thirty-four worked system-design problems, including three data platforms (CDC, clickstream analytics and a feature store), every one to the same template: the clarifying questions worth asking, requirements as measurable targets, capacity arithmetic you can check, the entities and endpoints, a high-level diagram, and then the single genuinely difficult decision resolved as a Naive / Solid / Standout ladder. Each page closes with what Mid, Senior and Staff actually have to demonstrate on that specific problem, so you can calibrate rather than guess.";
  T.modules = T.modules || [];
  T.modules.unshift(FOUNDATIONS);
})();
