/* track-bd-hard.js — Breakdowns / Hard Mode: eleven full system-design walkthroughs.
   Owns: window.Widgets.bdWindowLab, window.QUIZZES["breakdowns-hard"],
   and the "hard" module pushed onto window.TRACKS.breakdowns.
   Track metadata and the other modules are owned by sibling files. */
(function () {
  "use strict";

  /* ================================================================
     1 · Widget owned by this file
     ================================================================ */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    var k, i;
    attrs = attrs || {};
    for (k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function fmtNum(n) {
    if (!isFinite(n) || n < 0) n = 0;
    var s = String(Math.round(n)), out = "", c = 0, i;
    for (i = s.length - 1; i >= 0; i--) {
      out = s.charAt(i) + out;
      c++;
      if (c % 3 === 0 && i > 0) out = "," + out;
    }
    return out;
  }

  function fmtBytes(n) {
    if (!isFinite(n) || n < 0) n = 0;
    var u = ["B", "KB", "MB", "GB", "TB"], i = 0;
    while (n >= 1024 && i < u.length - 1) { n = n / 1024; i++; }
    return (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10) + " " + u[i];
  }

  function clampInt(raw, lo, hi, dflt) {
    var v = parseInt(raw, 10);
    if (!isFinite(v) || isNaN(v)) return dflt;
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  }

  /* Windowed aggregation cost model. Every constant here is a stated modelling
     assumption, not a measurement — the point is the shape of the trade-off. */
  Widgets.bdWindowLab = function (mount) {
    var DUP_RATE = 0.015;      // fraction of delivered events that are retries
    var DUP_MEAN_DELAY = 30;   // seconds; mean lateness of a redelivered event
    var KEYS = 50000;          // distinct aggregation keys assumed
    var ROW_BYTES = 48;        // bytes per open aggregate row
    var DEDUP_BYTES = 24;      // bytes per retained idempotency key

    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "cost model"),
      h("h3", {}, "Windowed aggregation, and what retries cost you")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "Assumes 50,000 distinct keys, 1.5% of deliveries are retries, and a retry lands on average 30 s late. "
      + "Change any control and every number below moves."));

    var state = { wtype: "tumbling", eps: 20000, win: 60, sem: "none" };

    var roEvents = h("b", {}, "-");
    var roState = h("b", {}, "-");
    var roDedup = h("b", {}, "-");
    var roOver = h("b", {}, "-");
    var verdict = h("p", { class: "widget-desc" }, "-");

    var readout = h("div", { class: "w-readout" },
      h("span", { class: "ro" }, "events / window ", roEvents),
      h("span", { class: "ro" }, "open aggregate state ", roState),
      h("span", { class: "ro" }, "dedup / checkpoint ", roDedup),
      h("span", { class: "ro" }, "over-count ", roOver));

    function openWindows() {
      if (state.wtype === "sliding") return 4;   // window / slide = 4
      if (state.wtype === "session") return 3;   // modelled open-session factor
      return 1;                                  // tumbling
    }

    function render() {
      var ow = openWindows();
      var perWindow = state.eps * state.win;
      var rows = Math.min(perWindow, KEYS) * ow;
      var aggBytes = rows * ROW_BYTES;

      var retain = Math.max(60, state.win * 2);
      var dedupBytes = 0, caught = 0, dedupLabel = "0 B";

      if (state.sem === "idem") {
        dedupBytes = state.eps * retain * DEDUP_BYTES;
        caught = 1 - Math.exp(-retain / DUP_MEAN_DELAY);
        dedupLabel = fmtBytes(dedupBytes) + " (" + retain + " s of keys)";
      } else if (state.sem === "eo") {
        dedupBytes = aggBytes;                   // committed copy of window state
        caught = 1;
        dedupLabel = fmtBytes(dedupBytes) + " (checkpoint)";
      }

      var over = perWindow * DUP_RATE * (1 - caught);
      var overPct = perWindow > 0 ? (over / perWindow) * 100 : 0;

      roEvents.textContent = fmtNum(perWindow);
      roState.textContent = fmtBytes(aggBytes) + " over " + ow + " open window" + (ow === 1 ? "" : "s");
      roDedup.textContent = dedupLabel;
      roOver.textContent = fmtNum(over) + " events (" + (overPct < 0.01 && overPct > 0 ? "<0.01" : Math.round(overPct * 100) / 100) + "%)";

      if (state.sem === "none") {
        verdict.textContent = "At-least-once with no dedup costs you accuracy. Every retry is counted again, so the "
          + "reported total runs about " + (Math.round(overPct * 100) / 100) + "% high — and the error is always upward, "
          + "so you will over-bill and never under-bill. Nothing downstream can tell a retry from a real click.";
      } else if (state.sem === "idem") {
        verdict.textContent = "Idempotency keys cost you memory. Holding " + fmtNum(state.eps * retain) + " keys for "
          + retain + " s costs " + fmtBytes(dedupBytes) + " per replica and catches about "
          + Math.round(caught * 1000) / 10 + "% of retries. Retries that land later than the retention window still slip "
          + "through, leaving roughly " + fmtNum(over) + " phantom events per window.";
      } else {
        verdict.textContent = "Effectively-once costs you throughput and coupling. The window aggregate and the input "
          + "offset commit together, so the count is exact — but you carry a " + fmtBytes(dedupBytes) + " checkpoint, "
          + "you stall on every commit, and the guarantee stops the moment a result leaves the transactional boundary.";
      }
    }

    function seg(options, current, onPick) {
      var wrap = h("div", { class: "w-seg" });
      var btns = [];
      options.forEach(function (opt) {
        var b = h("button", { class: "w-seg-btn" + (opt[0] === current ? " active" : "") }, opt[1]);
        b.addEventListener("click", function () {
          btns.forEach(function (x) { x.classList.remove("active"); });
          b.classList.add("active");
          onPick(opt[0]);
          render();
        });
        btns.push(b);
        wrap.appendChild(b);
      });
      return wrap;
    }

    function numField(label, value, lo, hi, onSet) {
      var input = h("input", { type: "number", value: String(value), min: String(lo), max: String(hi) });
      function commit() {
        var v = clampInt(input.value, lo, hi, value);
        input.value = String(v);
        onSet(v);
        render();
      }
      input.addEventListener("input", commit);
      input.addEventListener("change", commit);
      return h("label", { class: "w-field" }, label, input);
    }

    var controls = h("div", { class: "widget-controls" },
      seg([["tumbling", "Tumbling"], ["sliding", "Sliding"], ["session", "Session"]], state.wtype,
        function (v) { state.wtype = v; }),
      numField("events / sec ", state.eps, 1, 5000000, function (v) { state.eps = v; }),
      numField("window (s) ", state.win, 1, 3600, function (v) { state.win = v; }),
      seg([["none", "At-least-once, no dedup"], ["idem", "Idempotency keys"], ["eo", "Effectively-once"]], state.sem,
        function (v) { state.sem = v; }));

    mount.appendChild(controls);
    mount.appendChild(h("div", { class: "w-stage" }, readout, verdict));
    render();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ================================================================
     2 · Quiz owned by this file
     ================================================================ */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "breakdowns-hard": {
      title: "Hard Mode checkpoint",
      sub: "Approximate counting, exactly-once effects, convergence, tail latency and scarce capacity.",
      questions: [
        {
          q: "Your trending-topics pipeline estimates counts with a count-min sketch. What is the error direction?",
          options: [
            "Error is symmetric: a key can read high or low with equal probability",
            "It never under-counts — collisions can only inflate an estimate",
            "It never over-counts — collisions can only deflate an estimate",
            "It is exact above the frequency threshold and approximate below it"
          ],
          answer: 1,
          explain: "Every counter a key touches is incremented by that key's real count plus whatever other keys hash to "
            + "the same cell. Taking the minimum across rows picks the least-polluted cell, but pollution is never "
            + "negative, so the estimate is always at least the true count. That one-sided error is what makes the "
            + "structure safe for 'is this trending' decisions and unsafe for billing."
        },
        {
          q: "Your crawler's 'already seen' Bloom filter returns a false positive for a URL. What actually happens?",
          options: [
            "The page is fetched twice, wasting bandwidth",
            "The frontier queue grows without bound",
            "A URL that was never crawled is silently skipped and may never be fetched",
            "The filter has to be rebuilt from scratch to stay correct"
          ],
          answer: 2,
          explain: "A Bloom filter can say 'probably present' for something absent, but never 'absent' for something "
            + "present. Used as a seen-set, a false positive means you conclude you already have a page you have "
            + "never fetched, and it drops out of the crawl invisibly. That is why the filter is a fast negative "
            + "cache in front of an exact store, not the store itself."
        },
        {
          q: "An ingest pipeline advertises 'exactly-once'. What can you actually guarantee end to end?",
          options: [
            "Exactly-once delivery of every network message",
            "Exactly-once delivery, provided every hop runs over TCP",
            "At-most-once delivery, which is the safe default for counters",
            "Exactly-once effects, built from at-least-once delivery plus idempotent or transactional application"
          ],
          answer: 3,
          explain: "Exactly-once delivery is not achievable across an unreliable network: a sender that loses an "
            + "acknowledgement cannot distinguish a lost message from a lost ack, so it must either retry or risk "
            + "loss. What you can build is exactly-once effect — deliver at least once, then make the application "
            + "of each message idempotent or commit it transactionally with the offset."
        },
        {
          q: "A driver is offered a ride and the phone goes offline before accepting. What keeps the dispatch correct?",
          options: [
            "Hold the offer under a short server-side lease; when it expires, release it and offer the next driver",
            "Treat silence as acceptance after a timeout and dispatch the driver anyway",
            "Broadcast the ride to every nearby driver at once and take the first reply",
            "Keep the rider waiting until that driver's connection comes back"
          ],
          answer: 0,
          explain: "The offer is state the server owns, not the phone. A lease with an expiry means the worst case is "
            + "a few seconds of delay rather than a rider stranded on a dead socket, and the accept has to be an "
            + "idempotent compare-and-set against the lease so a late acceptance from a reconnecting phone loses "
            + "cleanly. Broadcasting to everyone trades this problem for a thundering-herd race."
        },
        {
          q: "Which statement about operational transformation versus CRDTs is accurate?",
          options: [
            "CRDTs need a central server to order operations; OT converges without one",
            "OT usually relies on a server to impose a total order and keeps operations compact; CRDTs converge without central ordering but carry per-element metadata",
            "Both require a central sequencer, so the choice is only about library maturity",
            "CRDTs guarantee user intent is preserved, which OT structurally cannot do"
          ],
          answer: 1,
          explain: "OT transforms each incoming operation against the operations it did not see, which is compact on "
            + "the wire but depends on a server to fix one authoritative order. CRDTs give every element an "
            + "identity so merges commute, which converges peer-to-peer at the cost of metadata that grows with "
            + "edit history. Neither one preserves intent — convergence and intent are different problems."
        },
        {
          q: "A search query fans out to 120 shards. Each shard independently stays under its own 99th-percentile latency 99% of the time. Roughly what share of queries wait on at least one slow shard?",
          options: ["About 1%", "About 12%", "About 70%", "About 99%"],
          answer: 2,
          explain: "The query is only as fast as its slowest shard, so you need all 120 to be fast: 0.99 to the power "
            + "of 120 is about 0.30. That leaves roughly 70% of queries stuck behind at least one straggler, which "
            + "is why scatter-gather systems reduce shard count per query, hedge requests after the p95, and "
            + "return partial results rather than waiting forever."
        },
        {
          q: "Why write the 'payment authorized' event into an outbox table inside the same transaction as the ledger entries?",
          options: [
            "It speeds up the ledger write by deferring index maintenance",
            "It removes the need for idempotency keys on the provider call",
            "It makes the state change and the event atomic, so you cannot commit money movement and then lose the notification",
            "It guarantees the downstream consumer processes the event exactly once"
          ],
          answer: 2,
          explain: "Writing to the database and then publishing to a broker is two commits with a crash window "
            + "between them, which produces ledger rows nobody downstream ever hears about. The outbox collapses "
            + "them into one commit, and a relay tails the table afterwards. The relay still delivers at least "
            + "once, so consumers must be idempotent — the outbox fixes atomicity, not duplication."
        },
        {
          q: "An engineer adds a user_id label to a metric that already has 5,000 series, on a service with 1,000 active users. What is the immediate effect?",
          options: [
            "Storage grows by 1,000 extra samples per scrape",
            "Queries get faster because the data is more granular",
            "Nothing changes until the retention window rolls over",
            "Active series can grow to about 5,000,000, multiplying index, memory and query cost"
          ],
          answer: 3,
          explain: "Series count is the product of every label's distinct values, so a new 1,000-value label "
            + "multiplies rather than adds: 5,000 times 1,000 is 5,000,000 new series. Cost in a time-series "
            + "database tracks active series far more closely than raw sample volume, because each series needs "
            + "its own index entry, its own open chunk and its own compaction. This is the classic cardinality "
            + "explosion, and it usually ships as a one-line change."
        },
        {
          q: "Why run a per-symbol order book as a single-writer in-memory sequence rather than as a distributed transaction?",
          options: [
            "A single writer gives a deterministic total order per symbol, which makes fills reproducible and the whole session replayable from the journal",
            "Distributed transactions cannot span more than two nodes",
            "In-memory books cannot lose data, so no journal is needed",
            "It lets one symbol scale without limit by adding more replicas"
          ],
          answer: 0,
          explain: "Price-time priority is only meaningful if there is one agreed sequence of events, and consensus "
            + "per order would cost more than the matching itself. A single writer per symbol produces that "
            + "sequence for free, and because matching is a pure function of the ordered input, journalling the "
            + "input lets you rebuild any moment of the day. The cost is that one symbol's throughput is capped "
            + "by one core, which is why sharding is by symbol."
        },
        {
          q: "An assistant serves 3,500 requests per second and each response streams for about 10 seconds. Roughly how many generations are in flight at once?",
          options: ["350", "3,500", "35,000", "350,000"],
          answer: 2,
          explain: "Little's law: concurrency equals arrival rate times time in system, so 3,500 per second times 10 "
            + "seconds is about 35,000 simultaneous streams. That number, divided by how many streams one "
            + "accelerator can hold given its KV cache budget, is your fleet size — which is why shortening "
            + "responses or raising tokens per second is a capacity decision, not a product nicety."
        }
      ]
    }
  });

  /* ================================================================
     3 · Module content
     ================================================================ */
  var LESSONS = [];

  /* ---------------------------------------------------------------- 1 */
  LESSONS.push({
    id: "top-k",
    title: "Design top-K heavy hitters in a stream",
    summary: "Trending topics over a firehose. Approximate counting with a count-min sketch and a heap, and how you merge per-shard results without lying.",
    minutes: 12,
    tags: ["breakdown", "streaming", "approximation"],
    blocks: [
      { t: "p", html: "The prompt is <strong>show the top 1,000 trending topics right now</strong>. The mental model that unlocks it: you are not asked for counts, you are asked for a <em>ranking</em>. Ranking tolerates bounded error; billing does not. Once you say that out loud, approximate structures stop being a hack and become the correct tool." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>Top-K of what, over what window?</strong> Assume top 1,000 topics over rolling 1-minute, 1-hour and 24-hour windows.",
        "<strong>How fresh?</strong> Assume the 1-minute list may lag reality by up to 10 seconds. Nobody can tell.",
        "<strong>Exact or approximate?</strong> Assume approximate is fine for rank, and that we must be able to state the error bound.",
        "<strong>Who consumes it?</strong> Assume a read-heavy public surface plus an internal API — reads vastly outnumber the recompute.",
        "<strong>Adversarial?</strong> Assume yes: people try to manufacture trends, so we need per-account weighting downstream, but that is a separate service."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Ingest a stream of (topic, user, timestamp) events.",
        "Return the top K topics for a requested window, with an estimated count.",
        "Support several window sizes concurrently.",
        "Expire old data so yesterday's news stops trending."
      ] },
      { t: "ul", items: [
        "<strong>Read latency:</strong> p99 under 50 ms for the top-K read — it is served from a materialised list, not computed on demand.",
        "<strong>Freshness:</strong> the 1-minute list is at most 10 s stale.",
        "<strong>Accuracy:</strong> a stated over-count bound of roughly 300 events per 1-minute window (derived below), never an under-count.",
        "<strong>Scale (assumed):</strong> 50,000 events/s average, 150,000/s peak, 500 million distinct topics per day."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "All inputs below are stated assumptions, not measurements.\n\n" +
        "  tagged events / day     = 4,300,000,000\n" +
        "  events / sec (avg)      = 4.3e9 / 86,400            ~= 50,000/s\n" +
        "  peak multiplier         = 3x                        ~= 150,000/s\n" +
        "  distinct topics / day   = 500,000,000\n\n" +
        "Exact counting is what you cannot afford:\n" +
        "  500e6 keys * ~64 B/entry                            ~= 32 GB, per replica, per day\n\n" +
        "Count-min sketch, sized per 1-minute window:\n" +
        "  events per window       = 50,000 * 60                = 3,000,000\n" +
        "  width  w = ceil(e / eps),   eps   = 1e-4             = 27,183 -> round up to 32,768\n" +
        "  depth  d = ceil(ln(1/delta)), pick d = 16 -> delta   = e^-16 ~= 1.1e-7\n" +
        "  memory = 32,768 * 16 * 4 B                           = 2 MB per sketch\n" +
        "  bound  = eps * N = 1e-4 * 3,000,000                  = 300 over-count, w.p. >= 1 - delta\n\n" +
        "Sharded ingest:\n" +
        "  shards                  = 64\n" +
        "  events / sec / shard    = 50,000 / 64                ~= 780/s\n" +
        "  sketch memory total     = 64 * 2 MB                   = 128 MB\n" +
        "  heap per shard          = top 1,000, O(log 1000)     ~= 10 comparisons per update"
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "Event      { topic_id, user_id, ts, weight }\n" +
        "Sketch     { window_id, w, d, seeds[d], cells[d][w] }   // uint32 cells\n" +
        "Candidate  { topic_id, est_count }                      // heap entry\n" +
        "TopKList   { window_id, generated_at, entries[K] }      // materialised result\n\n" +
        "POST /v1/events            { topic_id, user_id, ts }        -> 202\n" +
        "GET  /v1/trending?window=1m&k=100                           -> TopKList\n" +
        "GET  /v1/topics/{id}/count?window=1h                        -> { estimate, upper_bound }\n" +
        "GET  /v1/trending/{window}/at?ts=...                        -> historical TopKList"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "producers -> log (partitioned by hash(topic_id)) -> 64 counter shards\n" +
        "                                                      |\n" +
        "                          per shard: sketch(window) + min-heap(K)\n" +
        "                                                      |\n" +
        "                      every 10 s: emit (sketch, heap) to merger\n" +
        "                                                      v\n" +
        "                          merger: cell-wise add sketches, union heaps,\n" +
        "                                  re-estimate, take global top K\n" +
        "                                                      v\n" +
        "                          materialised TopKList in a cache -> read API"
      },
      { t: "p", html: "Two components are load-bearing. First, <strong>partitioning the log by topic id</strong>: it means one topic's events all land on one shard, so a shard's heap is a real local top-K rather than a random sample. Second, the <strong>merger</strong>, which is the only place a global ordering exists. Everything else is replaceable." },

      { t: "h", text: "6 · The one hard part: counting 500 million keys in 2 MB" },
      { t: "p", html: "You cannot keep a hash map of every topic, and you cannot sample, because sampling loses exactly the long-tail items that are about to become trends. A count-min sketch gives you a fixed-size structure with a <em>provable, one-sided</em> error, and a min-heap alongside it turns estimates into a ranking. The decision to defend is why approximation is acceptable here at all." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Exact hash map of topic -> count on every shard", "32 GB per day per replica, unbounded growth, and a rebalance every time the key space shifts. It also gives you precision nobody asked for."],
          ["Naive", "Sample 1 in 100 events, then count exactly", "Cheap, but a topic with 40 mentions in a minute is invisible below the sampling floor. You lose emerging trends, which is the whole product."],
          ["Solid", "Count-min sketch per shard, min-heap of size K, merge periodically", "Fixed 2 MB per window with a stated over-count bound. Ranking is stable for anything above the noise floor."],
          ["Standout", "The same, plus an exact counter promoted for anything that enters the heap, and a stated bound published with the API", "Heavy hitters — the only ones users see — become exact, because there are only K of them. The sketch does the filtering; a small exact table does the reporting. The API returns both estimate and upper bound so consumers can reason about error."]
        ] },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Why the sketch over-counts and never under-counts" },
      { t: "p", html: "Each of the <code class='tok'>d</code> rows hashes the key to one cell and increments it. That cell also accumulates every other key that collides there, so each row's reading is <em>true count plus collision noise</em>, and noise is never negative. Taking the minimum across rows picks the least-polluted row. Therefore the estimate is <strong>always greater than or equal to the truth</strong>. This is the sentence that earns credit: say it precisely, and then say what it implies — a sketch is safe for 'is this trending' and unsafe for 'how much do we bill'. Contrast this with <a class='inline' href='#/breakdowns/hard/ad-click-aggregator'>click aggregation</a>, where the same over-count would be fraud." },
      { t: "h2", text: "Merging per-shard partials without double-counting" },
      { t: "p", html: "Count-min sketches are linear: if two sketches share the same width, depth and hash seeds, adding them cell by cell yields exactly the sketch you would have built from the combined stream. So the merged bound is <code class='tok'>eps * N_total</code> — 300 for our 3-million-event minute — not 64 times the per-shard bound. The heaps are different: a union of per-shard top-1,000 lists is <em>not</em> a global top-1,000 unless a topic's events all live on one shard. That is precisely why the log is partitioned by topic id rather than round-robin. If you must partition by something else, keep a larger per-shard heap (say 4K) and accept that the true global rank near the boundary is uncertain." },
      { t: "h2", text: "Making windows expire" },
      { t: "p", html: "A sketch has no delete. The standard move is a ring of sub-window sketches: keep 60 one-second sketches and answer a one-minute query by summing them, dropping the oldest each tick. Memory becomes <code class='tok'>60 * 2 MB = 120 MB</code> per shard for the minute view, which is the honest cost of a sliding window. For 24 hours you do not keep 86,400 sketches — you roll one-minute sketches into hourly ones, accept a coarser slide, and say so." },
      { t: "note", variant: "trap", html: "Do not claim the sketch 'has 0.01% error'. It has an additive bound of <code class='tok'>eps * N</code> relative to the <em>total stream volume</em>, which is enormous relative to a small key and negligible relative to a heavy hitter. That asymmetry is the whole reason it works for top-K." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Recognises that exact counting will not fit, reaches for a sketch plus a heap, and draws a working ingest-to-read path."],
          ["Senior", "Sizes the sketch from a stated error target, gets the error direction right, partitions the log by topic so per-shard heaps are meaningful, and handles window expiry."],
          ["Staff", "Frames approximation as a product decision with a published bound, promotes heavy hitters to exact counters so the visible numbers are trustworthy, and names the adversarial and rebalancing failure modes before being asked."]
        ] },
      { t: "note", variant: "key", html: "<strong>Approximation is a contract, not a shortcut.</strong> A count-min sketch buys you a fixed memory footprint in exchange for a one-sided, bounded over-count. State the bound, keep the K items you actually display exact, and partition so that a local top-K means something globally." }
    ]
  });

  /* ---------------------------------------------------------------- 2 */
  LESSONS.push({
    id: "web-crawler",
    title: "Design a web crawler",
    summary: "Ten billion pages in a month. Politeness, frontier prioritisation, dedup at a hundred billion URLs, and not falling into traps.",
    minutes: 12,
    tags: ["breakdown", "crawler", "dedup"],
    blocks: [
      { t: "p", html: "The prompt is <strong>crawl the web and keep a corpus fresh</strong>. The mental model: a crawler is a scheduling problem wearing a networking costume. Fetching is easy. Deciding <em>what to fetch next, and when you are allowed to</em>, is the system." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>Coverage or freshness?</strong> Assume both: 10 billion pages in a 30-day cycle, with a fast lane that re-crawls news within an hour.",
        "<strong>What do we do with the bytes?</strong> Assume we store raw pages and hand them to an indexing pipeline — see <a class='inline' href='#/breakdowns/hard/post-search'>full-text search</a> for the other half.",
        "<strong>Do we respect robots directives and crawl-delay?</strong> Assume yes, unconditionally, and that this is a hard constraint rather than a nice-to-have.",
        "<strong>JavaScript rendering?</strong> Assume a small render budget — maybe 5% of pages get a headless render — because rendering costs about 50x a plain fetch.",
        "<strong>How much do we care about duplicate content?</strong> Assume a lot: near-duplicates are most of the web."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Given seed URLs, discover and fetch reachable pages.",
        "Never exceed a per-domain rate limit or a robots directive.",
        "Fetch each URL at most once per cycle; detect near-duplicate content.",
        "Prioritise: important and fast-changing pages get crawled sooner and more often.",
        "Survive traps — infinite calendars, session-id URLs, and redirect loops."
      ] },
      { t: "ul", items: [
        "<strong>Throughput:</strong> sustain roughly 3,900 fetches/s for 30 days.",
        "<strong>Politeness:</strong> no more than 1 request per domain per 2 s by default; obey a stricter crawl-delay when published.",
        "<strong>Durability:</strong> a worker crash loses at most one in-flight batch; the frontier is persistent.",
        "<strong>Scale (assumed):</strong> 10 billion pages fetched, 100 billion URLs discovered."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions.\n\n" +
        "  target corpus         = 10,000,000,000 pages in 30 days\n" +
        "  seconds in 30 days    = 30 * 86,400                    = 2,592,000\n" +
        "  fetch rate            = 10e9 / 2,592,000              ~= 3,900 pages/s\n" +
        "  avg page on the wire  = 80 KB\n" +
        "  ingress bandwidth     = 3,900 * 80 KB                 ~= 312 MB/s (~2.5 Gbps)\n" +
        "  stored, compressed    = 20 KB/page\n" +
        "  corpus storage        = 10e9 * 20 KB                   = 200 TB\n\n" +
        "Dedup at frontier scale:\n" +
        "  URLs discovered       = 100,000,000,000  (~10 links seen per page)\n" +
        "  Bloom filter, 10 bits/URL = 1e11 * 10 / 8              = 125 GB, FPR ~1%\n" +
        "  false positives       = 1% * 1e11                      = 1e9 URLs wrongly 'seen'\n" +
        "  -> a Bloom filter alone silently drops a billion pages. Exact store required.\n\n" +
        "Politeness sets your parallelism, not your hardware:\n" +
        "  per-domain rate       = 1 fetch / 2 s                  = 0.5 fetches/s\n" +
        "  distinct domains in flight = 3,900 / 0.5               = 7,800\n" +
        "  -> you must always have >= 7,800 ready domains, or throughput collapses."
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "UrlRecord   { url_hash, url, domain_id, first_seen, last_fetched, etag,\n" +
        "              content_hash, simhash, http_status, priority, next_eligible_at }\n" +
        "DomainState { domain_id, host, robots_rules, crawl_delay_ms, last_fetch_at,\n" +
        "              in_flight, error_streak, ip_group }\n" +
        "Page        { url_hash, fetched_at, headers, body_ref, render_used }\n\n" +
        "Internal API (a crawler has no public surface worth designing):\n" +
        "  frontier.lease(worker_id, n)        -> [UrlRecord]   // respects politeness\n" +
        "  frontier.complete(url_hash, result) -> ok            // idempotent by url_hash\n" +
        "  frontier.discover([url])            -> accepted_count\n" +
        "  scheduler.reprioritise(domain_id, signal)"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  seeds\n" +
        "    |\n" +
        "    v\n" +
        "  +----------------------- URL frontier -----------------------+\n" +
        "  |  priority queues (by score)  ->  per-domain FIFO queues     |\n" +
        "  |  a domain queue is 'ready' only when now >= next_eligible   |\n" +
        "  +-------------------------------+----------------------------+\n" +
        "                                  | lease(n)\n" +
        "                                  v\n" +
        "                        fetcher pool (async I/O)\n" +
        "                                  |\n" +
        "            +---------------------+---------------------+\n" +
        "            v                     v                     v\n" +
        "     content store          parser / link                dedup\n" +
        "     (200 TB blobs)         extractor            Bloom -> exact KV\n" +
        "                                  |                      |\n" +
        "                                  +----> discover() <-----+"
      },
      { t: "p", html: "The load-bearing piece is the <strong>two-level frontier</strong>: a priority structure that decides <em>which</em> domain deserves attention, feeding per-domain FIFOs that decide <em>when</em> a URL may leave. Separating those two questions is what makes politeness and prioritisation coexist. The second load-bearing piece is <strong>domain state</strong>, because robots rules, crawl delay and error backoff all key off it, and it must be cheap to read on every lease." },

      { t: "h", text: "6 · The one hard part: politeness and prioritisation are in tension" },
      { t: "p", html: "Prioritisation wants to fetch the most valuable URLs immediately. Politeness says the most valuable URLs are often on the same few domains, and you may only touch each one every two seconds. Resolve it by making the scheduler pick domains, not URLs." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "One global priority queue of URLs, check politeness at fetch time and requeue if too soon", "The head of the queue is dominated by a handful of hot domains, so workers spend their time requeuing. Effective throughput collapses to the rate of the busiest domain."],
          ["Naive", "One queue per domain, round-robin over all domains", "Politeness is perfect and prioritisation is gone. A spam farm with 10 million pages gets the same attention as a national newspaper."],
          ["Solid", "Two levels: a priority heap over <em>domains</em> keyed by next-eligible time and domain score, feeding per-domain FIFOs", "Only ready domains are ever offered to a worker, so no lease is wasted, and the domain score still steers the crawl."],
          ["Standout", "The same, plus leases with a timeout, per-IP-group limits rather than per-hostname, and a budget per domain per cycle", "Many hostnames share one IP, so per-host limits can still hammer one server — grouping by resolved IP is the correct politeness unit. Leases make a worker crash self-healing, and a per-cycle budget stops one enormous site consuming the whole crawl."]
        ] },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Dedup at 100 billion URLs" },
      { t: "p", html: "Use the Bloom filter as a <strong>fast negative cache</strong>, not as the answer. If the filter says 'absent', the URL is definitely new — accept it with no disk read, and that is the overwhelmingly common case. If it says 'present', do one lookup in an exact key-value store keyed by a 64-bit hash of the normalised URL. That inverts the failure mode: the filter's 1% false-positive rate becomes 1% extra lookups instead of a billion silently dropped pages. Normalisation matters as much as the structure — lowercase the host, strip default ports, sort or drop tracking query parameters, resolve dot segments." },
      { t: "h2", text: "Content dedup, which is a different problem" },
      { t: "p", html: "URL dedup catches the same address twice. It does nothing for the same article published at fifty addresses. For exact duplicates, hash the normalised body and keep a content-hash index. For near-duplicates — boilerplate differences, one changed timestamp — compute a 64-bit simhash over shingles and treat pages within a small Hamming distance as the same document, keeping the canonical one. This is what stops the corpus being 40% syndicated wire copy." },
      { t: "h2", text: "Traps, and the budget that saves you" },
      { t: "p", html: "Infinite calendars, faceted-search URLs with combinatorial filters, and session ids in paths generate unbounded distinct URLs that all resolve to near-identical content. No single detector catches all of them, so layer cheap defences: cap URL depth and length, cap distinct URLs per domain per cycle, drop URLs whose parameters look like session tokens, and — most effective — feed content dedup back into the frontier so a domain producing thousands of near-identical pages has its score crushed automatically. Combine that with per-domain error backoff so a site returning server errors does not consume a lease slot forever." },
      { t: "note", variant: "warn", html: "Politeness failures are the one bug class here with consequences outside your system: a crawler that ignores crawl-delay is a denial-of-service tool. Treat the rate limiter as a correctness invariant, enforce it in the frontier rather than in worker code, and make it impossible for a worker to fetch a URL it was not leased." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Draws frontier, fetchers, parser and store; knows a Bloom filter is involved in dedup; mentions robots rules."],
          ["Senior", "Separates domain scheduling from URL ordering, computes that ~7,800 concurrent domains are needed for the target rate, and uses the Bloom filter as a negative cache in front of an exact store."],
          ["Staff", "Rate-limits by resolved IP group rather than hostname, adds leases with timeouts for crash recovery, closes the loop from content dedup back into frontier scoring, and treats politeness as an invariant with an owner rather than a config value."]
        ] },
      { t: "note", variant: "key", html: "<strong>The frontier is the system.</strong> Two levels — priority over domains, FIFO within a domain — let you honour politeness and still crawl the important things first. A Bloom filter belongs in front of an exact store, never instead of one, because its false positives silently delete pages you will never know you missed." }
    ]
  });

  /* ---------------------------------------------------------------- 3 */
  LESSONS.push({
    id: "ad-click-aggregator",
    title: "Design an ad click aggregator",
    summary: "Billions of billable clicks a day, counted in near real time. Exactly-once effects under retries, tumbling windows, and the lambda-versus-kappa question.",
    minutes: 13,
    tags: ["breakdown", "streaming", "exactly-once"],
    blocks: [
      { t: "p", html: "The prompt is <strong>advertisers must see click counts within a minute, and those counts become invoices</strong>. The mental model: this is <a class='inline' href='#/breakdowns/hard/top-k'>stream counting</a> with the approximation removed. Money means the over-count you happily accepted for trending topics is now fraud, and the under-count is lost revenue." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>How fresh must the dashboard be?</strong> Assume under 60 s for the live view; the billing number may finalise hours later.",
        "<strong>Is the fast number the billed number?</strong> Assume no — and say so early. A revised, reconciled figure is normal and expected in ad tech.",
        "<strong>What dimensions?</strong> Assume ad id primarily, with campaign, country and device as secondary rollups.",
        "<strong>What is the retry behaviour of the client?</strong> Assume the browser or SDK retries on timeout, so duplicates are guaranteed, not hypothetical.",
        "<strong>How long must we keep detail?</strong> Assume 7 days of raw events for dispute resolution, then rollups."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Accept a click event and durably record it before acknowledging.",
        "Aggregate into 1-minute tumbling windows keyed by ad id and secondary dimensions.",
        "Serve time-series queries over minute, hour and day granularity.",
        "Produce a finalised, auditable number per billing period.",
        "Detect and suppress duplicate deliveries of the same click."
      ] },
      { t: "ul", items: [
        "<strong>Ingest availability:</strong> 99.99% — a rejected click is unbillable revenue that never comes back.",
        "<strong>Freshness:</strong> a click is reflected in the live dashboard within 60 s at p99.",
        "<strong>Accuracy:</strong> live view within 0.1% of final; the finalised number must reconcile exactly against the raw log.",
        "<strong>Scale (assumed):</strong> 10 billion billable clicks/day, roughly 116,000/s average and 348,000/s peak."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions.\n\n" +
        "  billable clicks / day   = 10,000,000,000\n" +
        "  clicks / sec (avg)      = 10e9 / 86,400            ~= 116,000/s\n" +
        "  peak (3x)                                          ~= 348,000/s\n" +
        "  event size              = 200 B\n" +
        "  ingest bandwidth        = 116,000 * 200 B          ~= 23 MB/s (~186 Mbps)\n" +
        "  raw log, 7-day retention= 10e9 * 200 B * 7          = 14 TB\n\n" +
        "Aggregate storage, 1-minute tumbling windows keyed by ad_id:\n" +
        "  active ads              = 2,000,000\n" +
        "  ads touched per minute  ~= 500,000 rows\n" +
        "  1-min tier  = 500,000 * 1,440 * 60 B               ~= 43 GB/day -> 7 d  ~= 300 GB\n" +
        "  1-hour tier = 2e6 * 24 * 60 B                      ~= 2.9 GB/day -> 90 d ~= 260 GB\n" +
        "  1-day tier  = 2e6 * 60 B                           ~= 120 MB/day -> keep\n\n" +
        "Dedup state, assuming a 5-minute client retry horizon:\n" +
        "  keys in flight          = 116,000 * 300             = 34,800,000\n" +
        "  memory @ 24 B/key                                  ~= 840 MB per aggregator replica\n" +
        "  -> this is the real price of exactly-once effects. Budget for it explicitly."
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ClickEvent { click_id, ad_id, campaign_id, user_hash, country, device,\n" +
        "             ts_client, ts_ingest, signature }\n" +
        "WindowAgg  { ad_id, dim_key, window_start, granularity, count, revenue }\n" +
        "Watermark  { partition, event_time_low_bound }\n" +
        "BillingRun { period, ad_id, final_count, source_offsets, closed_at }\n\n" +
        "POST /v1/click        { click_id, ad_id, ... }   -> 202  // click_id is the idempotency key\n" +
        "GET  /v1/reports?ad_id=&from=&to=&granularity=1m -> [WindowAgg]\n" +
        "GET  /v1/reports/{ad_id}/final?period=2026-08    -> BillingRun\n" +
        "POST /v1/reports/{ad_id}/dispute                 -> raw event export job"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "browser/SDK -> edge collector -> append-only log (partitioned by ad_id)\n" +
        "                    |                     |\n" +
        "            signs + stamps        +-------+---------------------+\n" +
        "            ts_ingest             |                             |\n" +
        "                                  v                             v\n" +
        "                        stream aggregator              raw archive (object store)\n" +
        "                    (1-min tumbling, watermarks,                |\n" +
        "                     dedup on click_id)                         v\n" +
        "                                  |                     nightly batch recompute\n" +
        "                                  v                             |\n" +
        "                        OLAP / time-series store  <-------------+\n" +
        "                                  |      (overwrite the minute, keyed by window)\n" +
        "                                  v\n" +
        "                          reporting API -> dashboard"
      },
      { t: "p", html: "The <strong>append-only log is the source of truth</strong>, not the aggregate. Everything downstream is a derived view that can be rebuilt, which is what makes the whole design defensible: if the stream job has a bug, you fix it and replay. The <strong>edge collector</strong> is the other critical component, because it is where <code class='tok'>ts_ingest</code> is stamped — client clocks are unreliable and sometimes adversarial, so event time must be anchored by something you control." },

      { t: "widget", id: "bdWindowLab" },

      { t: "h", text: "6 · The one hard part: exactly-once effects under guaranteed retries" },
      { t: "p", html: "Say the precise thing: <strong>exactly-once delivery is not achievable</strong> across an unreliable network, because a sender that loses an acknowledgement cannot distinguish that from a lost message. What you can achieve is an exactly-once <em>effect</em> — deliver at least once, then make the application of each delivery idempotent or transactional. Everything below follows from that distinction." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "At-least-once into an incrementing counter", "Every retry inflates the count, and the error is always upward, so advertisers are over-billed. Worse, the error is invisible: nothing downstream can distinguish a retry from a real click."],
          ["Naive", "At-most-once — acknowledge before persisting", "Duplicates disappear and so does revenue. A broker restart drops the events in flight and nobody can reconstruct them, because the log never had them."],
          ["Solid", "Client-generated <code class='tok'>click_id</code>, at-least-once delivery, dedup set held for the retry horizon", "Correct within the retention window and cheap to reason about. Costs roughly 840 MB per replica and lets duplicates older than the window slip through."],
          ["Standout", "The same, plus transactional commit of window state and input offset together, plus a nightly batch recompute from the raw log that overwrites each window by key", "The stream path is fast and nearly right; the batch path is slow and exactly right. Because aggregates are written keyed by (ad_id, window_start), the recompute is idempotent by construction — it overwrites rather than adds. That is what makes the finalised number auditable against the raw log."]
        ] },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Tumbling windows, watermarks and late events" },
      { t: "p", html: "A tumbling window is a fixed, non-overlapping bucket: every event belongs to exactly one, which makes the state per window small and the semantics obvious. The hard part is deciding when a window is done. Use a <strong>watermark</strong> — a moving lower bound on event time derived from what each partition has delivered — and close a window when the watermark passes its end plus a grace period. Events arriving after that go to a late-arrival side output; they still update the stored aggregate (because writes are keyed by window) but they no longer hold the window open. The grace period is a direct latency-versus-completeness dial: longer grace means a later dashboard and a more complete number." },
      { t: "h2", text: "Lambda versus kappa, answered honestly" },
      { t: "p", html: "Lambda runs a fast approximate stream path and a slow exact batch path over the same log, and serves whichever is authoritative for the question being asked. Kappa runs only the stream path and handles correction by replaying the log through a new version of the job. Kappa is genuinely simpler — one codebase, one set of semantics — and for most analytics it is the right answer. For <em>billing</em>, the argument for keeping a batch path is not technical elegance, it is that a finance team needs a recomputation they can run, inspect and diff against the raw events on demand, independently of the streaming runtime's state. Choose kappa and you must be able to replay from the log into a scratch table and produce exactly that artefact; if you can, kappa wins." },
      { t: "h2", text: "Fraud, and why the count is not the only number" },
      { t: "p", html: "A meaningful fraction of raw clicks are non-human or duplicated by ad-network intermediaries. Filtering happens after ingestion, never before, because you must keep the raw evidence for disputes. Model it as a second pipeline that annotates events with a validity verdict and writes a parallel set of aggregates; the dashboard shows gross, the invoice uses net. Keeping them as separate materialised views rather than one mutable number is what makes an advertiser dispute answerable." },
      { t: "note", variant: "trap", html: "Never let the streaming job be the only path that can produce a billing number. If the only copy of the aggregate lives in the stream processor's state store, a bad deploy is unrecoverable. Aggregates are derived data; the log is the record." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Ingests to a log, aggregates in tumbling windows, serves from a time-series store, and knows duplicates need a click id."],
          ["Senior", "Distinguishes exactly-once delivery from exactly-once effect, sizes the dedup state, handles late events with watermarks and a grace period, and keys aggregate writes so they are idempotent."],
          ["Staff", "Treats the log as the source of truth with derived views, argues lambda versus kappa from the auditability requirement rather than fashion, separates gross from net for fraud, and designs the dispute and recompute path before the happy path."]
        ] },
      { t: "note", variant: "key", html: "<strong>You cannot buy exactly-once delivery; you can build exactly-once effects.</strong> At-least-once transport plus an idempotency key plus aggregates written keyed by window gives you counts that survive retries and replays — and a raw log that lets you prove it." }
    ]
  });

  /* ---------------------------------------------------------------- 4 */
  LESSONS.push({
    id: "uber",
    title: "Design a ride-hailing service",
    summary: "Match riders to drivers over a fleet whose positions never stop moving. Geospatial indexing, the offer handshake, and what happens when a phone dies mid-offer.",
    minutes: 12,
    tags: ["breakdown", "geospatial", "matching"],
    blocks: [
      { t: "p", html: "The prompt is <strong>a rider taps a button and a nearby driver arrives</strong>. The mental model: two very different systems sharing a name. One is a high-volume, low-value write stream — location pings, where losing one costs nothing. The other is a low-volume, high-value state machine — the ride, where losing one costs a customer. Design them separately and connect them narrowly." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>One city or global?</strong> Assume global but partitioned by metro — matching never crosses a city boundary, which is a gift.",
        "<strong>How fast must a match be?</strong> Assume a driver is offered within 5 s of the request and the rider sees an assignment within 15 s.",
        "<strong>Do we optimise per-rider or globally?</strong> Assume greedy nearest-driver first, and note that batched global matching over a few seconds is measurably better — that is the interesting follow-up.",
        "<strong>What is the source of truth for a ride?</strong> Assume a strongly consistent store; a ride is money and safety, not analytics.",
        "<strong>Pooling, scheduled rides, surge?</strong> Assume out of scope, but say surge pricing reads the same supply/demand signal the matcher already computes."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Drivers stream location while online; riders request a ride from a pickup point.",
        "Find nearby available drivers and offer the ride to one at a time.",
        "A driver accepts or declines; on accept the ride becomes assigned and exclusive.",
        "Track the ride through pickup, in-progress and completion.",
        "Both parties see the other's live position for the duration."
      ] },
      { t: "ul", items: [
        "<strong>Match latency:</strong> first offer within 5 s at p99.",
        "<strong>Correctness:</strong> a driver is never concurrently assigned to two rides, and a rider is never assigned two drivers.",
        "<strong>Availability:</strong> location ingest may shed load; ride state may not.",
        "<strong>Scale (assumed):</strong> 5 million drivers online at peak, pings every 4 s, 20 million rides/day."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions.\n\n" +
        "  drivers online at peak  = 5,000,000\n" +
        "  ping interval           = 4 s\n" +
        "  pings / sec             = 5e6 / 4                      = 1,250,000/s\n" +
        "  ping size               = 100 B\n" +
        "  ingest bandwidth        = 1.25e6 * 100 B               = 125 MB/s (~1 Gbps)\n" +
        "  live location table     = 5e6 * 64 B                   = 320 MB\n" +
        "  -> the entire live fleet fits in memory. Do not put it in a disk database.\n\n" +
        "  rides / day             = 20,000,000\n" +
        "  match requests / sec    = 20e6 / 86,400               ~= 230/s, peak 3x ~= 700/s\n" +
        "  -> matching is roughly 1/5,000th the write volume of location. Different system.\n\n" +
        "One match, in one metro:\n" +
        "  search radius           = 3 km -> area = pi * 3^2     ~= 28 km^2\n" +
        "  index cell area         ~= 0.75 km^2\n" +
        "  cells to scan           = 28 / 0.75                   ~= 38\n" +
        "  driver density          = 20 online drivers / km^2\n" +
        "  candidates              = 28 * 20                     ~= 560\n" +
        "  -> rank 560 candidates by road-network ETA, offer the best one."
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "Driver   { driver_id, status: offline|available|offered|on_trip, vehicle,\n" +
        "           cell_id, lat, lng, heading, updated_at }\n" +
        "Ride     { ride_id, rider_id, driver_id?, state, pickup, dropoff,\n" +
        "           requested_at, assigned_at, version }\n" +
        "Offer    { offer_id, ride_id, driver_id, expires_at, state }   // the lease\n\n" +
        "POST /v1/drivers/location   { lat, lng, heading }          -> 204   (fire and forget)\n" +
        "POST /v1/rides              { pickup, dropoff, product }   -> Ride (state=matching)\n" +
        "POST /v1/offers/{id}/accept { }                            -> Ride | 409 Conflict\n" +
        "POST /v1/offers/{id}/decline                               -> 204\n" +
        "GET  /v1/rides/{id}                                        -> Ride + driver position"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  driver app --ping every 4s--> location gateway --> location shard (in memory)\n" +
        "                                                       keyed by cell_id\n" +
        "                                                            ^\n" +
        "  rider app --request ride--> ride service                  | query cells\n" +
        "                                  |                         |\n" +
        "                                  v                         |\n" +
        "                            match service  ----------------+\n" +
        "                                  |  rank by ETA\n" +
        "                                  v\n" +
        "                            offer service (lease, TTL 12 s)\n" +
        "                                  |  push over persistent connection\n" +
        "                                  v\n" +
        "                            driver app -- accept/decline --> ride store (strong)\n" +
        "                                                                  |\n" +
        "                                                                  v\n" +
        "                                                     trip stream -> pricing, analytics"
      },
      { t: "p", html: "The load-bearing components are the <strong>in-memory location shards</strong>, partitioned by geospatial cell so a proximity query touches only the ~38 relevant cells, and the <strong>offer service</strong>, which is the only place that decides who owns a ride right now. Note that the ride store is a small, strongly consistent database while location is a large, lossy in-memory grid. Mixing those two consistency models into one store is the most common way this design fails." },

      { t: "h", text: "6 · The one hard part: the offer handshake when a driver vanishes" },
      { t: "p", html: "Matching is a search problem and search problems are tractable. The genuinely hard decision is what happens between 'we chose you' and 'I accept', because in that window the driver's phone can lose signal, the app can be killed, or two match attempts can race for the same driver. The rider is watching a spinner the entire time." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Broadcast the ride to every nearby driver; first accept wins", "Every other driver gets a rejection they did not earn, and the accept path becomes a hot contention point. It also makes ETA-based ranking pointless — you get whoever tapped fastest."],
          ["Naive", "Offer to one driver and wait for a response with no timeout", "A driver who drives into a tunnel strands the rider indefinitely. The system has no way to distinguish 'thinking' from 'gone'."],
          ["Solid", "Offer to one driver under a server-side lease with a 12 s expiry; on expiry, release and offer the next", "Bounded worst case. The rider waits seconds, not minutes, and driver state has a single owner: the lease."],
          ["Standout", "The same, plus an idempotent compare-and-set accept against <code class='tok'>(offer_id, version)</code>, a short overlap where the next offer is prepared before the current expires, and a reconciliation sweep for orphaned leases", "The compare-and-set means a late accept from a reconnecting phone fails cleanly with a 409 instead of double-assigning. Preparing the next candidate during the tail of the current lease hides most of the expiry latency. The sweep catches leases whose owning process died, which is the failure the happy path cannot see."]
        ] },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Indexing a fleet that never stops moving" },
      { t: "p", html: "A B-tree on latitude and longitude is the wrong shape: two-dimensional range queries degenerate, and every driver updates every 4 seconds, so the index churns constantly. Instead map the surface to a discrete cell id — a hierarchical grid such as H3 or S2, or a geohash prefix — and keep a hash map from cell id to the set of drivers currently in it. A proximity query becomes 'read these 38 cells', which is a handful of memory lookups. An update becomes 'remove from old cell, add to new cell', and crucially <strong>most pings do not change the cell at all</strong>, so the common case is a field write. Choose cell size so that a typical cell holds tens of drivers: too coarse and you scan thousands of candidates, too fine and one query touches hundreds of cells." },
      { t: "h2", text: "Straight-line distance is a lie" },
      { t: "p", html: "Cell scanning gives you candidates by crow-flight distance, which ranks a driver across a river as closer than one two blocks away. So the pipeline is two-stage: use the grid as a cheap <em>filter</em> to get roughly 560 candidates, then score the top few dozen with a real road-network ETA from a routing service that knows about one-way streets and current traffic. Cache ETAs at cell-to-cell granularity so the routing service is not called 560 times per request — cell pairs repeat constantly and a 30-second cache is plenty fresh." },
      { t: "h2", text: "Greedy versus batched matching" },
      { t: "p", html: "Assigning each request to its nearest driver the instant it arrives is locally optimal and globally mediocre: a driver perfect for a request arriving 2 seconds later gets consumed by the current one. Collecting requests into a short batch — 2 to 5 seconds — and solving an assignment problem over the batch measurably reduces total pickup time. The trade-off is explicit and worth naming: you spend a few seconds of every rider's wait to reduce the average. The same connection-and-presence machinery that drives the driver app here is what <a class='inline' href='#/breakdowns/hard/online-chess'>real-time multiplayer</a> needs, and the deterministic ordering discipline is the same one <a class='inline' href='#/breakdowns/hard/robinhood'>order matching</a> depends on." },
      { t: "note", variant: "tip", html: "Location pings are the perfect thing to shed under load: drop to every 8 seconds instead of 4 and the product barely changes, while ingest halves. Say this out loud — knowing which traffic is disposable is a senior signal." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Uses a geospatial grid instead of scanning all drivers, separates location ingest from ride state, and describes an offer/accept flow."],
          ["Senior", "Sizes the ping volume and realises the live fleet fits in memory, picks cell size from driver density, and puts a lease with a timeout on the offer."],
          ["Staff", "Makes accept an idempotent compare-and-set so reconnecting phones cannot double-assign, adds an orphaned-lease sweep, separates cheap grid filtering from expensive ETA ranking, and names batched matching as a deliberate latency-for-efficiency trade."]
        ] },
      { t: "note", variant: "key", html: "<strong>An offer is a lease, not a message.</strong> The server owns who is allowed to accept and for how long; the phone merely reports. Everything hard about ride matching — disconnects, races, double assignment — becomes tractable the moment the offer has an owner, an expiry and a compare-and-set accept." }
    ]
  });

  /* ---------------------------------------------------------------- 5 */
  LESSONS.push({
    id: "google-docs",
    title: "Design collaborative document editing",
    summary: "Many cursors, one document, no lost keystrokes. Operational transformation versus CRDTs, stated honestly, plus presence and cursor sync.",
    minutes: 13,
    tags: ["breakdown", "collaboration", "consistency"],
    blocks: [
      { t: "p", html: "The prompt is <strong>several people type in the same document at the same time and everyone sees the same result</strong>. The mental model: you are not syncing documents, you are syncing <em>operations</em>. Two people editing character 40 simultaneously did not create a conflict to be resolved — they created two intentions that must both survive, in an order everyone agrees on." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>How many concurrent editors per document?</strong> Assume 1 to 5 typical, 50 worst case, and that the tail matters for presence fan-out but not for convergence.",
        "<strong>Plain text or rich text?</strong> Assume rich text, which means formatting spans as well as characters — this materially affects the CRDT choice.",
        "<strong>Offline editing?</strong> Assume brief offline periods must merge cleanly on reconnect. This is the strongest argument for a CRDT.",
        "<strong>Do we need full history?</strong> Assume named version history plus undo, not a replayable log of every keystroke forever.",
        "<strong>Is a central server acceptable?</strong> Assume yes. Saying so early legitimises operational transformation."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Multiple clients edit one document; all converge to the same final state.",
        "A local edit renders instantly, without waiting for the server.",
        "Show who else is present and where their cursor and selection are.",
        "Reconnect after a network drop without losing local edits.",
        "Persist the document and provide named version history."
      ] },
      { t: "ul", items: [
        "<strong>Local echo:</strong> a keystroke renders in under 16 ms — never blocked on the network.",
        "<strong>Remote echo:</strong> a collaborator's keystroke appears within 200 ms at p95 on a same-region connection.",
        "<strong>Convergence:</strong> guaranteed, not best-effort. Any two clients that have seen the same set of operations show the same text.",
        "<strong>Scale (assumed):</strong> 100 million documents, 2 million concurrent sessions, roughly 800,000 operations/s."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions.\n\n" +
        "  documents                = 100,000,000\n" +
        "  concurrent sessions      = 2,000,000\n" +
        "  fraction actively typing = 10%                     -> 200,000 typists\n" +
        "  ops / sec / typist       = 4 (keystrokes coalesced at 250 ms)\n" +
        "  inbound ops / sec        = 200,000 * 4              = 800,000/s\n" +
        "  op size on the wire      = 60 B\n" +
        "  inbound bandwidth        = 800,000 * 60 B           = 48 MB/s\n" +
        "  fan-out                  = 2 other collaborators avg\n" +
        "  outbound ops / sec       = 1,600,000                -> ~96 MB/s before framing\n" +
        "  (batching at 50 ms amortises frame overhead; it does not reduce op count)\n\n" +
        "Operation log:\n" +
        "  ops / day                = 800,000 * 86,400        ~= 69,000,000,000\n" +
        "  raw log / day            = 69e9 * 60 B             ~= 4.1 TB/day\n" +
        "  -> you cannot keep the raw op log forever. Snapshot and truncate.\n" +
        "  document text at rest    = 100e6 * 20 KB            = 2 TB\n\n" +
        "CRDT metadata, worst case:\n" +
        "  per-character identity   = site id 4 B + counter 4 B = 8 B\n" +
        "  20 KB doc, fully fragmented = 20,000 * 8 B          = 160 KB of ids\n" +
        "  -> 9x the text once you count both. Run-length encoding of contiguous inserts\n" +
        "     collapses this to a small multiple for normal documents, but the worst case\n" +
        "     is real and you should quote both."
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "Document  { doc_id, owner, snapshot_ref, snapshot_rev, current_rev, acl }\n" +
        "Operation { op_id, doc_id, site_id, client_rev, server_rev,\n" +
        "            kind: insert|delete|format, position_or_id, payload }\n" +
        "Session   { session_id, doc_id, user_id, cursor, selection, colour, last_seen }\n" +
        "Snapshot  { doc_id, rev, body, created_at }\n\n" +
        "WS  /v1/docs/{id}/stream\n" +
        "    client -> { type: 'op',       ops[], client_rev }\n" +
        "    client -> { type: 'presence', cursor, selection }\n" +
        "    server -> { type: 'ops',      ops[], server_rev }\n" +
        "    server -> { type: 'ack',      client_rev, server_rev }\n" +
        "    server -> { type: 'presence', sessions[] }\n" +
        "GET  /v1/docs/{id}?rev=            -> Snapshot + ops since rev\n" +
        "POST /v1/docs/{id}/versions        -> named version"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  client                      edit server (one owner per doc)      storage\n" +
        "  ------                      ------------------------------      -------\n" +
        "  local model  --op-->  [ authoritative document state ]  --->  op log (append)\n" +
        "  optimistic            [ transform / integrate incoming ]        |\n" +
        "  render      <--ops--  [ broadcast to other sessions    ]        v\n" +
        "  pending queue                     |                       snapshot every\n" +
        "  (unacked ops)                     |                       1,000 ops\n" +
        "                                    v\n" +
        "                          presence channel (ephemeral,\n" +
        "                          not persisted, TTL heartbeats)\n\n" +
        "  routing: doc_id -> consistent hash -> one edit server owns that document"
      },
      { t: "p", html: "Two things carry the design. <strong>Single ownership per document</strong>: a consistent hash routes every session for a document to one server, so there is exactly one place that assigns revision numbers. That single-writer discipline is the same idea that makes <a class='inline' href='#/breakdowns/hard/robinhood'>order matching</a> tractable. Second, the <strong>client's pending queue</strong> of unacknowledged operations, which is what lets the UI render instantly and still reconcile correctly when the server's version of history arrives." },

      { t: "h", text: "6 · The one hard part: making concurrent edits converge" },
      { t: "p", html: "Two users insert at position 40 at the same instant. Neither saw the other. Applying both naively gives two different documents. There are exactly two serious families of answer, and the interviewer wants to know that you understand what each one actually costs." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Last-write-wins on the whole document", "One person's paragraph vanishes with no warning. This is not a merge strategy, it is data loss with extra steps."],
          ["Naive", "Pessimistic locking — lock a paragraph while someone types", "Convergence is trivial and the product is dead. Collaborative editing exists precisely to avoid taking turns."],
          ["Solid", "Operational transformation: the server assigns a total order and each op is transformed against the ops the client had not seen", "Operations stay tiny — an insert is a position and a character. The cost is that correctness depends on the transformation functions being right for every operation pair, which is famously easy to get subtly wrong, and it needs a central server to define the order."],
          ["Standout", "A sequence CRDT with run-length-encoded identifiers, plus a server that still sequences and snapshots", "Every character has an immutable identity, so merges commute and no transformation matrix exists to get wrong. It converges without central ordering, which makes offline editing and reconnect natural. The cost is metadata: identity per element, tombstones for deletions, and up to 9x overhead on a fragmented document before run-length compression. Keeping a server for sequencing and snapshotting is not cheating — it is how you bound that metadata."]
        ] },
      { t: "note", variant: "warn", html: "Do not claim CRDTs preserve user intent and OT does not, or vice versa. Both guarantee <em>convergence</em> — everyone ends up with the same document. Neither guarantees the result is what either author meant. Intent is a product problem that shows up as 'why is my sentence interleaved with theirs', and no algebra fixes it." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "The client pending queue, concretely" },
      { t: "p", html: "The client keeps three things: the last server revision it has acknowledged, a queue of local operations it has sent but not had acked, and its rendered state. When a remote operation arrives, the client transforms it against its pending queue before applying — or, in the CRDT case, simply integrates it, since the identities make order irrelevant. When an ack arrives, the matching operation leaves the queue. On reconnect the client sends its pending queue with the last acknowledged revision, and the server replays whatever the client missed. This is also the entire offline story: the pending queue just gets longer." },
      { t: "h2", text: "Presence is a different system, and should be" },
      { t: "p", html: "Cursor positions and selections are high-frequency, low-value and worthless once stale — the exact opposite of document operations. Send them on the same socket but on a separate logical channel, never persist them, throttle to about 10 updates per second per session, and expire a session's presence via heartbeat timeout. Critically, presence must not be part of the operation log: mixing an ephemeral high-rate cursor stream into a durable log you were already struggling to truncate is how a document's history becomes terabytes of mouse movement." },
      { t: "h2", text: "Snapshots, truncation, and history that is affordable" },
      { t: "p", html: "You cannot keep 69 billion operations a day. Snapshot the materialised document every 1,000 operations, then truncate operations older than the most recent snapshot beyond a short replay window. Named versions are separate, user-triggered snapshots that are never truncated. Undo is <em>not</em> 'reverse the last operation in the log' — in a collaborative document that would undo someone else's typing. Undo must be per-site: invert the last operation this user contributed, transformed against everything that has happened since, which is one of the genuinely fiddly parts of a real implementation and worth naming as such." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Knows edits must be operations rather than whole-document saves, uses a persistent connection, and names OT or CRDT as the convergence mechanism."],
          ["Senior", "Explains the actual trade-off — OT is compact but needs a server-assigned order and correct transform functions; CRDTs converge without ordering but carry per-element metadata — and designs the client pending queue and reconnect path."],
          ["Staff", "Separates presence from the durable op log, bounds CRDT metadata with run-length encoding and snapshots, gets per-site undo right, and is explicit that convergence is not intent preservation."]
        ] },
      { t: "note", variant: "key", html: "<strong>Convergence is the guarantee; metadata is the price.</strong> OT keeps operations small and pays with a central sequencer and transformation functions that must be correct for every operation pair. CRDTs remove the ordering dependency and pay with identity and tombstones on every element. Pick from your offline requirement, not from taste." }
    ]
  });

  /* ---------------------------------------------------------------- 6 */
  LESSONS.push({
    id: "post-search",
    title: "Design full-text search over a huge post corpus",
    summary: "Two hundred billion posts, sub-second queries. Index sharding, scatter-gather fan-out, the tail latency arithmetic, and keeping the index near real time.",
    minutes: 12,
    tags: ["breakdown", "search", "tail-latency"],
    blocks: [
      { t: "p", html: "The prompt is <strong>search everything anyone has ever posted, fast</strong>. The mental model: an inverted index turns 'which documents contain this word' from a scan into a lookup. Everything else in this design is about the consequences of that index being far too large for one machine — and the surprising fact that the hardest problem is not size, it is the slowest shard." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>What kind of query?</strong> Assume keyword and phrase queries with filters (author, time, language), ranked by relevance blended with recency.",
        "<strong>How fresh?</strong> Assume a new post is findable within about 10 seconds. That single number drives most of the design.",
        "<strong>Complete or good?</strong> Assume top-quality results matter far more than exhaustive recall — nobody reads page 40.",
        "<strong>Personalised?</strong> Assume ranking may use viewer signals, but candidate retrieval is shared. Personalisation belongs in the re-rank stage.",
        "<strong>Where does the corpus come from?</strong> Assume a write stream plus a bulk backfill — the same shape as the <a class='inline' href='#/breakdowns/hard/web-crawler'>crawler</a> output."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Index every post's text, author and timestamp.",
        "Answer keyword and phrase queries with filters, returning ranked results with pagination.",
        "Make new posts searchable within seconds.",
        "Handle deletions and edits, including legally mandated removals.",
        "Degrade to partial results rather than failing when a shard is slow."
      ] },
      { t: "ul", items: [
        "<strong>Query latency:</strong> p50 under 100 ms, p99 under 500 ms end to end.",
        "<strong>Freshness:</strong> a post is searchable within 10 s at p95.",
        "<strong>Availability:</strong> 99.95%; a partial result set is a success, not an error.",
        "<strong>Scale (assumed):</strong> 200 billion posts, 500 million new posts/day, 100,000 queries/s at peak."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions.\n\n" +
        "  posts in corpus         = 200,000,000,000\n" +
        "  new posts / day         = 500,000,000 -> 500e6 / 86,400    ~= 5,800/s\n" +
        "  indexable terms / post  = 30 after tokenising and stopping\n" +
        "  postings                = 200e9 * 30                        = 6,000,000,000,000\n" +
        "  bytes / posting         = 4 B (delta-gapped ids, varint positions)\n" +
        "  inverted index          = 6e12 * 4 B                        = 24 TB\n\n" +
        "  index per shard         = 200 GB\n" +
        "  shards                  = 24e12 / 200e9                     = 120\n" +
        "  replicas                = 3 -> serving nodes                = 360\n\n" +
        "Query fan-out:\n" +
        "  peak queries / sec      = 100,000\n" +
        "  internal requests / sec = 100,000 * 120                     = 12,000,000/s\n" +
        "  -> shard count is a latency AND a cost multiplier. Fewer shards per query wins.\n\n" +
        "The arithmetic that decides the architecture:\n" +
        "  per-shard p99 = 50 ms, p50 = 10 ms\n" +
        "  P(all 120 shards fast) = 0.99 ^ 120                        ~= 0.30\n" +
        "  -> ~70% of queries wait on at least one p99 shard.\n" +
        "  A query is as slow as its slowest shard, always."
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "Posting     { term_id, doc_id_delta, tf, positions[] }     // in a compressed block\n" +
        "Segment     { segment_id, shard_id, doc_range, term_dict, postings, deleted_bitset }\n" +
        "DocMeta     { doc_id, author_id, created_at, lang, score_features }\n" +
        "ShardRouter { shard_id -> replica endpoints, health, load }\n\n" +
        "GET  /v1/search?q=&filters=&cursor=&limit=   -> { results[], cursor, partial: bool }\n" +
        "POST /v1/index                { doc_id, text, meta }   -> 202\n" +
        "DELETE /v1/index/{doc_id}                              -> 202   // tombstone, not erase\n" +
        "GET  /v1/search/explain?q=&doc_id=                     -> scoring breakdown"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "                          +---------------- query coordinator ----------------+\n" +
        "  client -> gateway ----> | parse, rewrite, plan, fan out, gather, re-rank    |\n" +
        "                          +--+-------------+-------------+-------------+------+\n" +
        "                             |             |             |             |\n" +
        "                          shard 1       shard 2   ...  shard 120    (x3 replicas)\n" +
        "                             |             |             |\n" +
        "                     [ sealed segments (immutable) + live segment (in memory) ]\n" +
        "                             ^\n" +
        "  post stream --> indexer ---+  append to live segment, flush every 1 s,\n" +
        "                                background merge into sealed segments\n\n" +
        "  each shard returns its local top-N; the coordinator merges 120 * N and re-ranks"
      },
      { t: "p", html: "The <strong>query coordinator</strong> is the only stateful decision-maker on the read path: it decides which shards to ask, when to give up on a straggler, and how to blend the returned candidates. The <strong>segment structure</strong> is the other load-bearing choice — immutable sealed segments plus a small mutable live segment is what allows lock-free reads, cheap replication (immutable files copy trivially) and near-real-time indexing at the same time." },

      { t: "h", text: "6 · The one hard part: 70% of your queries are held hostage by one shard" },
      { t: "p", html: "Scatter-gather has a property people consistently underestimate: fan-out multiplies tail latency. Each shard is fast almost always, and 'almost always' compounds badly across 120 of them. You cannot fix this by making shards faster — you fix it by changing the shape of the fan-out." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Fan out to all 120 shards and wait for every response", "Your p99 becomes roughly a single shard's p99.99. Adding shards to handle growth makes latency worse, which is the opposite of what scaling should do."],
          ["Naive", "Reduce to 12 huge shards so the fan-out is small", "The tail improves and per-shard work grows tenfold, so the p50 collapses. You traded a tail problem for a throughput problem."],
          ["Solid", "Fan out to all shards, but return partial results once a deadline passes and mark the response <code class='tok'>partial: true</code>", "Bounded latency, honest API. Users almost never notice a missing 1% of candidates, and the contract makes the degradation explicit rather than silent."],
          ["Standout", "Tier the index by document quality and recency, query the small hot tier first, and only fall through to the cold tier when the hot tier's results are thin — plus hedged requests to a second replica after the p95", "Most queries are answered by a fraction of the shards, so the effective fan-out drops and the tail arithmetic improves dramatically. Hedging after the p95 costs only a few percent extra load because it fires rarely, and it cuts the tail caused by one unlucky replica rather than one unlucky shard."]
        ] },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Sharding by document, not by term" },
      { t: "p", html: "Term-partitioned indexes put all postings for one word on one shard, which sounds efficient — a single-word query hits one machine. In practice it fails: a multi-word query needs intersections across shards, meaning you ship enormous posting lists over the network, and one popular term makes its shard a permanent hotspot. Document-partitioned indexes give every shard a slice of the corpus and a complete index over that slice, so every shard can answer independently and intersection happens locally. You pay the fan-out cost — which is exactly the tail problem above — but that cost is manageable and the term-partitioned failure mode is not." },
      { t: "h2", text: "Near-real-time indexing without rewriting 24 TB" },
      { t: "p", html: "5,800 new posts per second cannot mutate an immutable index. The standard structure: each shard has one small <em>live</em> segment in memory, into which new documents are appended and which is flushed to disk about once a second so it survives a crash. Searches query the sealed segments plus the live segment. A background merge periodically folds small segments into larger ones, and the merged output replaces the inputs atomically. Deletions never rewrite postings — they set a bit in a per-segment deleted bitset, and the space is reclaimed at the next merge. This means a deleted document stops appearing immediately while the bytes disappear later, which is the correct behaviour for edits and takedowns alike." },
      { t: "h2", text: "Two-stage retrieval, because ranking is expensive" },
      { t: "p", html: "Do not run your good ranking function over every matching document. Stage one is cheap retrieval — term matching with a simple score, taking the top few hundred per shard, using techniques that let you skip blocks of postings that provably cannot make the cut. Stage two re-ranks the merged few thousand candidates with the expensive model, including viewer personalisation. This split is what makes 100,000 queries a second affordable, and it maps cleanly onto the coordinator/shard boundary: shards do cheap retrieval, the coordinator does expensive re-ranking." },
      { t: "note", variant: "trap", html: "Pagination by offset is a scatter-gather disaster: page 50 forces every shard to compute and ship 5,000 results so the coordinator can discard 4,950. Use an opaque cursor that encodes the last score and doc id, and make deep pagination explicitly bounded." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Describes an inverted index, shards it, and fans a query out to shards with a merge step at the coordinator."],
          ["Senior", "Justifies document partitioning over term partitioning, sizes the index and shard count, designs live-plus-sealed segments for near-real-time indexing, and handles deletes with a bitset."],
          ["Staff", "Does the tail arithmetic out loud, reduces effective fan-out with index tiering, hedges after the p95, makes partial results an explicit part of the API contract, and splits cheap retrieval from expensive re-ranking."]
        ] },
      { t: "note", variant: "key", html: "<strong>Fan-out multiplies the tail.</strong> With 120 shards each meeting its p99 independently, roughly 70% of queries wait on a straggler. The fixes are structural — tier the index so most queries touch fewer shards, hedge to a second replica after the p95, and make partial results a documented outcome rather than a silent one." }
    ]
  });

  /* ---------------------------------------------------------------- 7 */
  LESSONS.push({
    id: "payment-system",
    title: "Design a payment system",
    summary: "Money that survives partial failure. Double-entry ledgers, idempotency keys, the outbox pattern, and why reconciliation is not optional.",
    minutes: 13,
    tags: ["breakdown", "payments", "correctness"],
    blocks: [
      { t: "p", html: "The prompt is <strong>take a payment, pay out a merchant, and be able to prove both</strong>. The mental model: a payment system is an accounting system with an API bolted on. The interesting engineering is not throughput — 580 transactions a second is unremarkable — it is that every component you depend on can fail halfway through, and money must still add up afterwards." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>Are we the processor or the platform?</strong> Assume platform: we orchestrate, an external provider moves the money.",
        "<strong>Which flows?</strong> Assume authorise, capture, refund and payout. Say that authorise-and-capture being separate is what makes the state machine non-trivial.",
        "<strong>Multi-currency?</strong> Assume yes, and that a ledger account is scoped to exactly one currency — never mix currencies in one balance.",
        "<strong>What consistency does the balance need?</strong> Assume strong. A merchant balance that is eventually consistent is a merchant balance that is sometimes wrong.",
        "<strong>Regulatory retention?</strong> Assume seven years, immutable, exportable."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Create a payment intent, authorise it with a provider, and capture it.",
        "Record every money movement in an immutable double-entry ledger.",
        "Make every write idempotent so client and network retries are safe.",
        "Refund, fully or partially, without ever editing history.",
        "Reconcile our ledger against the provider's settlement file every day."
      ] },
      { t: "ul", items: [
        "<strong>Correctness:</strong> debits equal credits for every transaction, always. This is an invariant, not a target.",
        "<strong>Availability:</strong> 99.99% on the authorise path; a failed authorisation is a lost sale.",
        "<strong>Latency:</strong> p99 under 2 s end to end, dominated by the provider call, not by us.",
        "<strong>Scale (assumed):</strong> 50 million payments/day, roughly 580/s average and 5,800/s at seasonal peak."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions.\n\n" +
        "  payments / day          = 50,000,000\n" +
        "  payments / sec (avg)    = 50e6 / 86,400                  ~= 580/s\n" +
        "  seasonal peak (10x)                                      ~= 5,800/s\n" +
        "  ledger entries / payment= 6  (customer, merchant payable, platform fee,\n" +
        "                                processor fee, tax, clearing)\n" +
        "  entries / day           = 50e6 * 6                        = 300,000,000\n" +
        "  entry size              = 200 B\n" +
        "  ledger growth           = 300e6 * 200 B                   = 60 GB/day\n" +
        "  ledger per year         = 60 GB * 365                    ~= 22 TB/year\n\n" +
        "Idempotency store, 24-hour retention:\n" +
        "  keys retained           = 50,000,000\n" +
        "  key record              = 300 B (key, request hash, response ref, status)\n" +
        "  store size              = 50e6 * 300 B                    = 15 GB\n\n" +
        "Reconciliation, daily:\n" +
        "  provider settlement rows= 50,000,000\n" +
        "  target unmatched        < 0.01%                           = 5,000 rows/day\n" +
        "  -> 5,000 breaks per day is already a staffed team. Design the break queue\n" +
        "     and its auto-resolution rules as a first-class part of the system."
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "PaymentIntent { intent_id, merchant_id, amount, currency, state, idem_key,\n" +
        "                provider_ref, version }\n" +
        "LedgerAccount { account_id, owner_type, owner_id, currency, kind: asset|liability }\n" +
        "LedgerTxn     { txn_id, occurred_at, reason, source_event_id }   // immutable\n" +
        "LedgerEntry   { entry_id, txn_id, account_id, direction: dr|cr, amount_minor }\n" +
        "OutboxRow     { outbox_id, aggregate_id, event_type, payload, published_at? }\n\n" +
        "POST /v1/payment_intents      Idempotency-Key: <uuid>   -> PaymentIntent\n" +
        "POST /v1/payment_intents/{id}/capture   Idempotency-Key -> PaymentIntent\n" +
        "POST /v1/refunds              Idempotency-Key           -> Refund\n" +
        "GET  /v1/balances/{account_id}                          -> { available, pending }\n" +
        "GET  /v1/ledger/txns?from=&to=                          -> [LedgerTxn + entries]"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  merchant -> API (idempotency middleware)\n" +
        "                 |\n" +
        "                 |  one transaction:\n" +
        "                 |    insert idempotency row (unique on key)\n" +
        "                 |    upsert payment_intent\n" +
        "                 |    insert ledger_txn + balanced ledger_entries\n" +
        "                 |    insert outbox row\n" +
        "                 v\n" +
        "            primary DB (strongly consistent, single writer per account shard)\n" +
        "                 |\n" +
        "        outbox relay tails the table\n" +
        "                 |\n" +
        "                 +--> provider adapter --> external provider (retries, timeouts)\n" +
        "                 +--> event bus --> notifications, analytics, payouts\n" +
        "                 |\n" +
        "        daily: provider settlement file --> reconciliation job --> break queue"
      },
      { t: "p", html: "The load-bearing component is the <strong>single database transaction</strong> that writes the idempotency record, the state change, the ledger entries and the outbox row together. Everything else in this design exists because that transaction cannot extend to the external provider. The <strong>outbox relay</strong> is the bridge between the world where you have transactions and the world where you do not." },

      { t: "h", text: "6 · The one hard part: correctness when the provider call fails ambiguously" },
      { t: "p", html: "You call the provider to authorise. The call times out. You now do not know whether the customer was charged. That single ambiguity is the root of nearly every serious defect in payment systems, and the design either has an answer or it does not." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Retry the provider call on timeout", "You may authorise twice. The customer sees two holds, and you have no record explaining which one is real, because your side never persisted the first attempt."],
          ["Naive", "Write the row, then publish the event, then call the provider", "Three separate commits with two crash windows. A crash between them leaves a ledger entry with no provider call, or a provider charge with no ledger entry. Both are discovered by a customer, not by you."],
          ["Solid", "Persist an attempt with an idempotency key first, pass that key to the provider, and let the provider deduplicate the retry", "The retry is now safe because both sides key on the same token, and your own record exists before the external effect. This is the minimum bar."],
          ["Standout", "The same, plus outbox-driven side effects, an explicit <code class='tok'>unknown</code> attempt state that a poller resolves by querying the provider, and a daily reconciliation against the settlement file that can only be closed by a human or a rule", "The <code class='tok'>unknown</code> state is the crucial addition: it admits that you do not know, keeps the payment out of both success and failure paths, and gives a background job the job of finding out. Reconciliation then catches the residue that even that misses — because the provider's file, not your database, is the external truth."]
        ] },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Double-entry, and the invariants it buys" },
      { t: "p", html: "Every money movement is a transaction containing two or more entries whose debits and credits sum to zero, in the same currency. Balances are never stored as a mutable field you update — they are the sum of entries against an account, optionally maintained as a materialised total that can be recomputed from scratch and checked. Three invariants follow, and you should state them: <strong>every transaction balances to zero</strong>; <strong>entries are append-only</strong>, so a refund is a new transaction reversing the original rather than an edit; and <strong>every entry names the event that caused it</strong>, so any balance can be explained back to its source. A system with those three properties can survive almost any bug, because the history is intact and recomputable." },
      { t: "h2", text: "Idempotency keys that actually work" },
      { t: "p", html: "The subtlety people miss: an idempotency key must be enforced by a <em>unique constraint in the same transaction as the effect</em>, not checked with a read-then-write. Two concurrent retries both read 'no existing key' and both proceed otherwise. Store the request fingerprint alongside the key so a client that reuses a key with a different body gets a clear error rather than a silently wrong result, store the response so the retry returns the identical body, and set a retention window — 24 hours here, 15 GB — longer than any client's retry horizon. Note the contrast with <a class='inline' href='#/breakdowns/hard/ad-click-aggregator'>click counting</a>, where a missed duplicate is a rounding error; here it is a double charge." },
      { t: "h2", text: "Why money is never 'eventually consistent' without a loop" },
      { t: "p", html: "Eventual consistency says the system converges if updates stop. Payments never stop, external providers hold state you do not control, and a lost message means convergence never happens at all — it just looks fine locally. The only thing that makes distributed money correct is a <strong>reconciliation loop</strong>: independently re-derive what should be true from an external source, compare against what you recorded, and route every mismatch to a queue that a rule or a human must close. Reconciliation is not a cleanup script; it is the control system that makes all the optimistic machinery upstream safe. Design it, staff it, and put its unmatched count on the same dashboard as your error rate." },
      { t: "note", variant: "warn", html: "Store amounts as integers in the currency's minor units, never as floating point. Currencies also differ in how many minor units they have, so the scale belongs with the amount. Every rounding rule — fee splits, tax, currency conversion — must be defined once and applied in one place, because two components rounding differently produces breaks that reconciliation will find and nobody will be able to explain." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Uses idempotency keys, keeps a payment state machine, and knows a ledger records money movements rather than mutable balances."],
          ["Senior", "Writes state, ledger entries and outbox in one transaction; enforces idempotency with a unique constraint rather than read-then-write; handles the ambiguous provider timeout with an explicit unknown state."],
          ["Staff", "Names the double-entry invariants and makes them checkable, designs reconciliation and the break queue as first-class systems with owners, and is explicit that no amount of internal correctness substitutes for comparison against the external record."]
        ] },
      { t: "note", variant: "key", html: "<strong>Persist your intent before you cause an external effect, and reconcile afterwards.</strong> Idempotency keys make retries safe, the outbox makes state and events atomic, double-entry makes every balance explainable, and the reconciliation loop is the only thing that catches what all three miss." }
    ]
  });

  /* ---------------------------------------------------------------- 8 */
  LESSONS.push({
    id: "metrics-monitoring",
    title: "Design a metrics and alerting platform",
    summary: "A hundred million active series. Cardinality explosion, write amplification, retention tiers, and evaluating thousands of alert rules without rescanning history.",
    minutes: 12,
    tags: ["breakdown", "observability", "time-series"],
    blocks: [
      { t: "p", html: "The prompt is <strong>collect metrics from a large fleet, graph them, and alert on them</strong>. The mental model: a metrics platform is a write-dominated database where the unit of cost is not the sample, it is the <em>series</em>. Get that inversion right and the whole design follows; get it wrong and you build something that dies the first time an engineer adds a label." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>Metrics only, or logs and traces too?</strong> Assume metrics only. They are numeric, regular and aggregatable, which is why they get their own storage engine.",
        "<strong>Push or pull collection?</strong> Assume pull-based scraping with a push gateway for short-lived jobs — pull gives you liveness detection for free.",
        "<strong>How long do we keep it?</strong> Assume 7 days at full resolution, 30 days at one minute, 2 years at one hour.",
        "<strong>How fresh must alerts be?</strong> Assume a rule fires within 30 s of the condition being true.",
        "<strong>Who can create series?</strong> Assume any engineer, which means cardinality control is a platform responsibility, not a convention."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Scrape or receive samples for millions of labelled series.",
        "Store them compressed with configurable retention tiers.",
        "Answer range queries with aggregation over labels and time.",
        "Evaluate alert rules continuously and notify on state transitions.",
        "Protect the platform from a single team's cardinality mistake."
      ] },
      { t: "ul", items: [
        "<strong>Ingest:</strong> sustain 6.7 million samples/s with no sample loss during a rolling restart.",
        "<strong>Query:</strong> p99 under 2 s for a 24-hour range over a thousand series.",
        "<strong>Alert latency:</strong> under 30 s from condition true to notification sent.",
        "<strong>Scale (assumed):</strong> 100 million active series, 15-second scrape interval."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions.\n\n" +
        "  active series             = 100,000,000\n" +
        "  scrape interval           = 15 s\n" +
        "  samples / sec             = 100e6 / 15                    ~= 6,700,000/s\n" +
        "  raw sample                = 16 B (8 B timestamp + 8 B float)\n" +
        "  compressed                ~= 1.3 B (delta-of-delta ts, XOR floats)\n" +
        "  compression ratio                                         ~= 12x\n\n" +
        "Retention tiers:\n" +
        "  raw    = 6.7e6 * 1.3 B * 86,400                          ~= 750 GB/day\n" +
        "           x 7 days                                        ~= 5.3 TB\n" +
        "  1-min rollup, 4 aggregates (min/max/sum/count):\n" +
        "         = 100e6 * 1,440 * 4 * 1.3 B                       ~= 750 GB/day\n" +
        "           x 30 days                                       ~= 22 TB\n" +
        "  1-hour rollup, 4 aggregates:\n" +
        "         = 100e6 * 24 * 4 * 1.3 B                          ~= 12.5 GB/day\n" +
        "           x 730 days                                      ~= 9 TB\n" +
        "  total per replica                                        ~= 37 TB\n\n" +
        "  Note the middle tier costs the same per day as raw and is kept 4x longer.\n" +
        "  Rollups are not automatically cheap. Count the aggregates.\n\n" +
        "Cardinality, the failure mode:\n" +
        "  a metric with 5,000 series, plus one label with 1,000 values\n" +
        "         = 5,000 * 1,000                                    = 5,000,000 series\n" +
        "  that is +5% of the entire platform, from one line of application code."
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "Series   { series_id, metric_name, labels{}, first_seen, last_seen }\n" +
        "Chunk    { series_id, start_ts, end_ts, encoding, blob }   // ~2 h of samples\n" +
        "Rule     { rule_id, expr, for_duration, labels, severity, state }\n" +
        "AlertInst{ rule_id, fingerprint, state: pending|firing|resolved, since, value }\n\n" +
        "POST /v1/write                 (batched, compressed samples)  -> 204\n" +
        "GET  /v1/query_range?expr=&start=&end=&step=                  -> matrix\n" +
        "GET  /v1/series?match[]=                                      -> [Series]\n" +
        "GET  /v1/labels/{name}/values                                 -> [string]\n" +
        "POST /v1/rules                 { expr, for, severity }        -> Rule\n" +
        "GET  /v1/alerts?state=firing                                  -> [AlertInst]"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  targets <--scrape-- collectors (sharded by target hash)\n" +
        "                          |\n" +
        "                          v  batched remote-write\n" +
        "                    ingest tier  --> WAL (durability) --> in-memory head block\n" +
        "                          |                                    |\n" +
        "                   cardinality guard                    every ~2 h: seal block,\n" +
        "                   (per-tenant series budget,           write to object store\n" +
        "                    label allow/deny, sampling)                |\n" +
        "                                                               v\n" +
        "                                              compactor: merge + downsample\n" +
        "                                              raw -> 1 min -> 1 hour\n" +
        "                          +------------------------------------+\n" +
        "                          v                                    v\n" +
        "                    query tier (fan-out, merge)          rule evaluator\n" +
        "                          |                                    |\n" +
        "                     dashboards                       alert manager (dedupe,\n" +
        "                                                      group, silence, route)"
      },
      { t: "p", html: "The <strong>in-memory head block plus write-ahead log</strong> is the heart of ingest: recent samples live in memory in compressed chunks so both writes and recent-range queries are cheap, and the WAL means a process restart replays rather than loses. The <strong>cardinality guard</strong> at the ingest boundary is the other essential piece, and it is the one most designs omit — without it, a single deploy can take the platform down for every tenant." },

      { t: "h", text: "6 · The one hard part: cardinality is a multiplication, and everybody forgets" },
      { t: "p", html: "A series is a unique combination of metric name and label values. Adding a label does not add series, it <em>multiplies</em> them, and the cost of a series is not its samples — it is an index entry, an open chunk in memory, a compaction unit and a term in every query's label matching. One engineer adding a user identifier as a label can multiply the platform's working set overnight." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Document a naming convention and trust teams to follow it", "Conventions are not enforcement. The incident happens during a deploy nobody reviewed for label hygiene, and the platform team finds out from the pager."],
          ["Naive", "Cap total series globally and reject writes when full", "The cap protects the platform and punishes whoever happened to write next, which is usually not the team that caused it. You have converted one team's bug into everyone's outage."],
          ["Solid", "Per-tenant series budgets enforced at ingest, with the offending metric named in the rejection and a dashboard showing who is near their limit", "Blast radius is contained to the tenant, the error message is actionable, and teams can see the problem coming."],
          ["Standout", "The same, plus automatic detection of high-cardinality labels before enforcement bites — flag any label whose distinct-value count grows superlinearly, drop it to a bounded bucketing, and alert its owner", "Turns a hard rejection into a graceful degradation: the metric keeps working with a coarser label instead of disappearing. Detecting the growth pattern rather than the absolute count catches the mistake in the minutes after a deploy, which is when it is cheap to fix."]
        ] },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Write amplification, and why the head block matters" },
      { t: "p", html: "Naively, 6.7 million samples per second means 6.7 million tiny writes, each touching a different series — the worst possible pattern for any storage engine. The fix is to buffer per series in memory and only persist in large, contiguous units. Compression does the heavy lifting: timestamps at a fixed scrape interval compress to almost nothing with delta-of-delta encoding, and consecutive float values in a well-behaved metric share most of their bits, so XOR-then-encode gets you from 16 bytes to about 1.3. That 12x is the difference between roughly 9 TB a day and 750 GB a day, and it is the single most consequential encoding decision in the system. The WAL exists precisely because the head block is in memory: it makes the buffering safe." },
      { t: "h2", text: "Rollups and retention, counted properly" },
      { t: "p", html: "Downsampling is usually presented as an obvious win, but the arithmetic above shows the 1-minute tier costing exactly as much per day as raw. The reason is that a rollup point must carry min, max, sum and count — you cannot re-aggregate correctly from an average alone, and losing the max destroys exactly the spikes people query for. So a 4x-per-point multiplier partially cancels the 4x reduction in point count from 15 s to 60 s. The real saving comes from the hour tier, which is 60x fewer points. The lesson generalises well beyond metrics: <a class='inline' href='#/breakdowns/hard/ad-click-aggregator'>rollup tiers</a> only save money when the granularity reduction outruns the number of aggregates you must preserve." },
      { t: "h2", text: "Evaluating ten thousand rules without rescanning history" },
      { t: "p", html: "The naive rule evaluator runs every rule's query against the full store every interval, which turns alerting into the heaviest read workload on the platform. Three things fix it. First, <strong>almost every rule only needs recent data</strong> — a rule over a 5-minute window can be answered entirely from the in-memory head block, never touching object storage. Second, <strong>shard rules across evaluators by rule hash</strong> and stagger their evaluation offsets, so ten thousand rules do not all fire their queries on the same second. Third, <strong>keep the alert instance state machine separate from evaluation</strong>: an expression being true is not an alert, it becomes one only after it has been true for the rule's <code class='tok'>for</code> duration, and the pending-to-firing transition is what suppresses flapping. Grouping, deduplication, silencing and routing then belong in a separate component so that a hundred hosts failing together produces one page, not a hundred." },
      { t: "note", variant: "trap", html: "The monitoring system must not depend on the systems it monitors. Alert delivery needs its own path — a separate region, an independent notification provider, and a dead-man's-switch alert that fires when the platform <em>stops</em> reporting. Otherwise the outage that most needs a page is the one that silences it." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Describes collection, a time-series store, a query layer and a rule evaluator, and knows retention tiers exist."],
          ["Senior", "Sizes ingest and storage with a real compression assumption, uses an in-memory head block plus WAL to avoid write amplification, and recognises cardinality as the dominant cost driver."],
          ["Staff", "Enforces per-tenant cardinality budgets with actionable errors, counts the aggregates in a rollup instead of assuming downsampling is free, evaluates rules against the head block with sharded staggered offsets, and makes the alerting path independent of the monitored infrastructure."]
        ] },
      { t: "note", variant: "key", html: "<strong>Cost scales with active series, not with samples.</strong> Labels multiply, so cardinality control belongs at the ingest boundary with per-tenant budgets. Compression turns 16 bytes into about 1.3, rollups only save money when granularity reduction outruns the aggregates you keep, and alert evaluation should read the in-memory head block rather than history." }
    ]
  });

  /* ---------------------------------------------------------------- 9 */
  LESSONS.push({
    id: "robinhood",
    title: "Design a trading and order-matching system",
    summary: "A deterministic single-writer book per symbol, market data fan-out to millions, and an audit trail where every state transition is replayable.",
    minutes: 13,
    tags: ["breakdown", "trading", "determinism"],
    blocks: [
      { t: "p", html: "The prompt is <strong>accept orders, match them fairly, and prove afterwards that you did</strong>. The mental model: the matching engine is a deterministic state machine, and everything around it exists to feed it an ordered input and distribute its ordered output. Once you see it that way, the design decisions stop being about databases and start being about sequence." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>Do we run the venue or route to one?</strong> Assume we run the book — routing is a simpler problem and a less interesting answer.",
        "<strong>Which order types?</strong> Assume limit, market and cancel, with price-time priority. Say that stops and icebergs are more of the same state machine.",
        "<strong>Do we need cross-symbol atomicity?</strong> Assume no. That single answer is what lets you shard by symbol, and it is worth confirming explicitly.",
        "<strong>What is the audit requirement?</strong> Assume every state transition must be reconstructable for seven years.",
        "<strong>Settlement?</strong> Assume out of scope here, but note it looks like the <a class='inline' href='#/breakdowns/hard/payment-system'>ledger problem</a> — double-entry positions and cash, reconciled daily."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Accept, amend and cancel orders, with pre-trade risk checks.",
        "Match on price-time priority and emit fills deterministically.",
        "Publish market data — trades and book depth — to millions of clients.",
        "Maintain positions and buying power per account.",
        "Reconstruct any moment of the trading session from the journal."
      ] },
      { t: "ul", items: [
        "<strong>Determinism:</strong> replaying the journal reproduces identical fills. This is the strongest requirement in the system.",
        "<strong>Latency:</strong> order acknowledgement in single-digit milliseconds at the API; matching itself in microseconds.",
        "<strong>Fairness:</strong> price-time priority holds strictly within a symbol.",
        "<strong>Scale (assumed):</strong> 100 million orders/day over a 6.5-hour session, bursting to about 85,000/s at the open."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions.\n\n" +
        "  orders / day            = 100,000,000\n" +
        "  trading session         = 6.5 h                        = 23,400 s\n" +
        "  orders / sec (avg)      = 100e6 / 23,400              ~= 4,300/s\n" +
        "  open-bell burst (20x)                                 ~= 85,000/s\n" +
        "  busiest symbol          = 5% of flow -> 85,000 * 0.05 ~= 4,300 orders/s\n" +
        "  time budget per order   = 1 / 4,300                   ~= 230 microseconds\n" +
        "  -> an in-memory book handles this on one core with room to spare.\n\n" +
        "Market data fan-out is the real scaling problem:\n" +
        "  concurrent clients      = 5,000,000\n" +
        "  watchlist               = 20 symbols\n" +
        "  naive per-symbol push at 4 Hz = 5e6 * 20 * 4           = 400,000,000 msg/s (no)\n" +
        "  one conflated frame per client at 4 Hz = 5e6 * 4       = 20,000,000 msg/s\n" +
        "  relay tier @ 20,000 clients / node                     = 250 edge nodes\n\n" +
        "Audit journal:\n" +
        "  events / order          = 5 (accept, book, partial, fill, settle)\n" +
        "  events / day            = 100e6 * 5                    = 500,000,000\n" +
        "  event size              = 250 B\n" +
        "  journal                 = 500e6 * 250 B                = 125 GB/day\n" +
        "  per year (252 sessions) = 125 GB * 252                ~= 32 TB/year"
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "Order    { order_id, client_order_id, account_id, symbol, side, type,\n" +
        "           limit_price, qty, remaining, tif, state, seq }\n" +
        "BookLevel{ symbol, side, price, total_qty, order_queue (FIFO) }\n" +
        "Fill     { fill_id, seq, symbol, price, qty, taker_order_id, maker_order_id, ts }\n" +
        "Position { account_id, symbol, qty, avg_price, realised_pnl }\n" +
        "Journal  { seq, symbol, kind: inbound|outbound, payload }   // append-only\n\n" +
        "POST /v1/orders    { client_order_id, symbol, side, type, price, qty }\n" +
        "     -> { order_id, state, seq }        // client_order_id is the idempotency key\n" +
        "DELETE /v1/orders/{id}                  -> { state }\n" +
        "GET  /v1/positions                      -> [Position]\n" +
        "WS   /v1/marketdata   subscribe { symbols[] } -> conflated depth + trade prints"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  client -> API gateway -> risk check (buying power, limits, fat-finger)\n" +
        "                                 |\n" +
        "                                 v\n" +
        "                    sequencer for symbol S (assigns seq, appends to journal)\n" +
        "                                 |\n" +
        "                                 v\n" +
        "         +------- matching engine for S (single writer, in memory) --------+\n" +
        "         | pure function: (book_state, ordered_input) -> (book', outputs)  |\n" +
        "         +--------------------------+--------------------------------------+\n" +
        "                                    |\n" +
        "             +----------------------+----------------------+\n" +
        "             v                      v                      v\n" +
        "      hot standby (replays     fill stream ->         market data relay\n" +
        "      the same journal)        positions, clearing    tree -> 250 edges\n" +
        "                                                             |\n" +
        "                                                        5M clients"
      },
      { t: "p", html: "The <strong>sequencer</strong> is the load-bearing component: it converts concurrent arrivals into one totally ordered stream per symbol and writes that stream to the journal <em>before</em> the engine sees it. The <strong>matching engine</strong> is then deliberately boring — a pure function with no I/O, no clock reads and no randomness, because every impurity is a place where a replay diverges." },

      { t: "h", text: "6 · The one hard part: one writer per symbol, and everything that implies" },
      { t: "p", html: "Price-time priority is only meaningful relative to an agreed order of events. You could reach for consensus per order, but the coordination would dwarf the matching. The alternative is to accept a single writer per symbol and make everything else conform to it — which sounds like a limitation until you notice it also gives you replayability for free." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Store orders in a shared database and match with transactions", "Every match is a multi-row transaction under contention on the hottest rows in the system. Throughput collapses at the open, and 'time priority' becomes whatever the lock manager decided."],
          ["Naive", "Multiple matching workers per symbol with a distributed lock", "The lock serialises you anyway, so you kept all the cost of coordination and none of the parallelism, plus a new failure mode when the lock's lease expires mid-match."],
          ["Solid", "One in-memory book per symbol, one writer, journal every inbound event before applying it", "Matching becomes microseconds of pointer work, ordering is unambiguous, and the journal gives you crash recovery by replay."],
          ["Standout", "The same, plus a strictly deterministic engine — no wall-clock reads, no map iteration order, no floating point for prices — and a hot standby replaying the identical journal", "Determinism is what turns the journal from a backup into a proof. A standby consuming the same sequence reaches the same state, so failover is a promotion rather than a reconciliation. It also means the entire session can be re-run in a test harness against a candidate build, which is how you gain confidence in an engine change."]
        ] },
      { t: "note", variant: "warn", html: "Prices are decimals, not binary floats. Store them as scaled integers in ticks. A float comparison that rounds differently on two machines breaks determinism, and a determinism bug in a matching engine is discovered by a regulator." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "What determinism actually forbids" },
      { t: "p", html: "The engine may not read the clock — timestamps arrive as part of the sequenced input. It may not iterate a hash map whose order depends on memory addresses. It may not use randomness, thread scheduling or any concurrency inside the matching loop. It may not call out to another service mid-match, because that service's response is not in the journal. Everything the engine needs must be either in its own state or in the ordered input, and the practical consequence is that risk checks, enrichment and account lookups all happen <em>before</em> sequencing, not inside matching. That constraint is what makes the input stream a complete description of the day." },
      { t: "h2", text: "Fanning market data out to five million clients" },
      { t: "p", html: "The naive arithmetic — five million clients times twenty symbols times four updates a second — gives 400 million messages a second, which is not a tuning problem, it is an architecture error. Two changes fix it. First, <strong>conflate</strong>: a client does not need every book change, it needs the latest state at a display rate, so coalesce updates into one frame per client per tick containing only symbols that actually changed. Second, <strong>fan out through a tree</strong>: the engine publishes once to a small set of regional relays, each relay publishes to edge nodes, and edge nodes hold the client sockets. Twenty thousand clients per edge node gives 250 edges, and each level of the tree multiplies capacity instead of loading the engine. Note that conflation is a deliberate information loss — professional feeds pay for the unconflated stream, and that tiering is a product decision as much as a technical one." },
      { t: "h2", text: "The audit trail as a design constraint, not a feature" },
      { t: "p", html: "'Every state transition is replayable' sounds like a logging requirement and is actually the reason for the whole architecture. Journal the <em>inputs</em> before applying them, not the outputs afterwards: outputs are derivable, inputs are not. Sequence numbers must be gapless per symbol so a missing event is detectable rather than merely absent. Retain the journal in object storage partitioned by symbol and session, and — this is the part people skip — <strong>run the replay regularly</strong>. A recovery path that has never been executed is a hypothesis. Replaying yesterday's session nightly and diffing the resulting fills against what was published turns the audit requirement into a continuous test of the engine's determinism." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Keeps the order book in memory, shards by symbol, matches on price-time priority, and persists orders and fills."],
          ["Senior", "Puts a sequencer in front of a single-writer engine, journals inbound events before applying them, sizes the market-data fan-out and introduces conflation and a relay tier."],
          ["Staff", "Enumerates what determinism forbids and enforces it, uses a hot standby replaying the same journal so failover is a promotion, treats scaled integers for prices as a correctness requirement, and runs the replay continuously as a test rather than trusting it."]
        ] },
      { t: "note", variant: "key", html: "<strong>Sequence first, then match.</strong> A single writer per symbol over a journalled, totally ordered input turns matching into a pure function — which gives you fairness, microsecond latency, crash recovery by replay, hot standby by replay, and an audit trail, all from one decision." }
    ]
  });

  /* ---------------------------------------------------------------- 10 */
  LESSONS.push({
    id: "online-chess",
    title: "Design real-time online chess",
    summary: "Authoritative move validation, clocks that stay fair across network jitter, reconnection that does not lose a game, and matchmaking.",
    minutes: 12,
    tags: ["breakdown", "real-time", "gaming"],
    blocks: [
      { t: "p", html: "The prompt is <strong>two people play chess online with clocks, and neither can cheat</strong>. The mental model: the server owns the game and the clients own nothing. That sounds obvious until you work out what it means for a player whose move was legal when they made it but arrived 400 ms later — and whose clock is running the whole time." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>Which time controls?</strong> Assume bullet through rapid, so a 1-minute game is in scope. That is what makes clock fairness hard.",
        "<strong>Spectators?</strong> Assume yes for a small number of featured games, and note that spectating is a read-only fan-out problem, not a game problem.",
        "<strong>Engine-assistance detection?</strong> Assume out of scope for the design, but say the move stream we already journal is exactly what a detector consumes.",
        "<strong>Rating and matchmaking?</strong> Assume an Elo-style rating and matchmaking that widens its band over time.",
        "<strong>Do abandoned games matter?</strong> Assume yes — a disconnect must resolve deterministically, not hang forever."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Match two players of similar rating into a game.",
        "Validate every move server-side against full chess rules, including castling, en passant and promotion.",
        "Run both clocks authoritatively, with increment, and end the game on flag.",
        "Push moves and clock state to both players with low latency.",
        "Survive a disconnect: reconnect resumes the game with correct clocks."
      ] },
      { t: "ul", items: [
        "<strong>Move round trip:</strong> under 100 ms at p95 within a region — this is a fairness requirement in bullet, not a comfort one.",
        "<strong>Correctness:</strong> an illegal move is impossible to commit, and both clients always agree on position and clock.",
        "<strong>Reconnect:</strong> within 30 s, the game resumes with no loss of state.",
        "<strong>Scale (assumed):</strong> 5 million games/day, about 28,000 concurrent games average and 83,000 at peak."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions.\n\n" +
        "  games / day             = 5,000,000\n" +
        "  average game length     = 8 min                          = 480 s\n" +
        "  concurrent games        = 5e6 * 480 / 86,400            ~= 27,800\n" +
        "  peak (3x)               = 83,000 games                   = 166,000 sockets\n\n" +
        "  plies / game            = 80\n" +
        "  moves / day             = 5e6 * 80                       = 400,000,000\n" +
        "  moves / sec (avg)       = 400e6 / 86,400                ~= 4,600/s\n" +
        "  peak (3x)                                               ~= 14,000/s\n" +
        "  message size            = 120 B\n" +
        "  peak move traffic       = 14,000 * 2 * 120 B            ~= 3.4 MB/s\n\n" +
        "  Chess is not a bandwidth problem. It is a latency and fairness problem.\n\n" +
        "  sockets per node        = 50,000\n" +
        "  nodes at peak           = 166,000 / 50,000              ~= 4 (plus headroom)\n" +
        "  live position           = 32 B bitboards + ~64 B of game state\n" +
        "  in-memory live games    = 83,000 * ~2 KB with history   ~= 170 MB\n" +
        "  archived game record    = 80 plies * 4 B + metadata     ~= 1 KB\n" +
        "  archive growth          = 5e6 * 1 KB                     = 5 GB/day"
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "Game    { game_id, white_id, black_id, time_control, position,\n" +
        "          move_history[], clocks{white_ms, black_ms}, turn, state, seq }\n" +
        "MoveMsg { game_id, seq, from, to, promotion?, client_sent_at }\n" +
        "Seat    { game_id, user_id, connection_id, node_id, last_ack_seq }\n" +
        "Ticket  { user_id, rating, band, queued_at, time_control }\n\n" +
        "WS /v1/games/{id}\n" +
        "   client -> { type:'move',    seq, from, to, promotion? }\n" +
        "   client -> { type:'resync',  last_seq }\n" +
        "   server -> { type:'state',   seq, position, clocks, turn }\n" +
        "   server -> { type:'reject',  seq, reason }\n" +
        "   server -> { type:'over',    result, reason }\n" +
        "POST /v1/matchmaking/queue { time_control } -> Ticket\n" +
        "GET  /v1/games/{id}                          -> Game (replay / spectate)"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  player A ---ws---+                                +--- player B\n" +
        "                   v                                v\n" +
        "            edge node (holds sockets, no game logic)\n" +
        "                   |            routed by game_id\n" +
        "                   v\n" +
        "        +---- game server: owns N live games in memory ----+\n" +
        "        |  validate move -> apply -> deduct clock -> emit  |\n" +
        "        |  authoritative timer wheel for flag detection    |\n" +
        "        +--------------------+-----------------------------+\n" +
        "                             |\n" +
        "            +----------------+----------------+\n" +
        "            v                                 v\n" +
        "     move journal (append)              game archive on completion\n" +
        "     -> reconnect + replay              -> rating update, analysis\n\n" +
        "  matchmaker: rating-banded queues per time control, band widens with wait"
      },
      { t: "p", html: "The load-bearing split is <strong>edge nodes that hold sockets versus game servers that hold state</strong>. Sockets are numerous and disposable; game state is small and precious. Keeping them separate means a client reconnecting can land on any edge node and still be routed to the one server that owns its game. The <strong>authoritative timer wheel</strong> is the second essential piece: flag detection cannot depend on a client telling you it ran out of time." },

      { t: "h", text: "6 · The one hard part: a clock that is fair when the network is not" },
      { t: "p", html: "In a one-minute game, 400 ms of network latency is more than half a percent of a player's entire budget, and it is not their fault. But if you refund latency naively, a player with a deliberately laggy connection gains time. The design has to be fair to honest players and unexploitable by dishonest ones, and the two pull in opposite directions." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Each client runs its own clock and reports remaining time", "Trivially cheatable — a modified client simply never runs out. The server has no independent basis to disagree."],
          ["Naive", "Server deducts wall-clock time from move-sent to move-received, with no compensation", "Honest players on slow connections lose real time on every single move, and the loss compounds over eighty plies. In bullet this decides games."],
          ["Solid", "Server is authoritative: deduct the interval between when it <em>sent</em> the opponent's move and when it <em>received</em> this move", "One consistent basis, no client input, and it correctly charges thinking time. It still charges the player for network latency in both directions."],
          ["Standout", "The same, minus a lag compensation equal to the smaller of the measured one-way estimate and a hard cap of about 100 ms per move", "Honest players get most of their latency back, and the cap bounds what a manipulated connection can extract to a fixed amount per move. Publish the rule, measure latency continuously from heartbeats rather than trusting a per-move claim, and apply the increment after the deduction so the arithmetic is easy to explain when someone disputes it."]
        ] },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Server-side validation, and what the client is allowed to do" },
      { t: "p", html: "The client may render, may highlight legal destinations, and may optimistically show a move as pending — but the position it displays is provisional until the server acknowledges. The server holds the only real board: it checks that it is that player's turn, that the piece exists, that the destination is legal including check constraints, and that special rules like castling rights, en passant availability and promotion are satisfied. Rejections carry the sequence number so the client can roll back precisely. Note that <a class='inline' href='#/breakdowns/hard/google-docs'>collaborative editing</a> makes the opposite choice — optimistic local application with convergence afterwards — because there the cost of a divergence is a merge, whereas here it is a cheated game." },
      { t: "h2", text: "Reconnection without losing the game" },
      { t: "p", html: "Every message carries a per-game sequence number, and the server keeps the recent tail of the journal in memory. On reconnect, the client sends its <code class='tok'>last_seq</code> and the server replies with everything after it, plus the current clocks computed as of now — not as of the disconnect. Meanwhile the disconnected player's clock keeps running, because chess has no pause and pretending otherwise creates an obvious exploit. A disconnect timer ends the game by abandonment if the player does not return before their clock expires. The state that must survive a <em>server</em> crash is different: replicate the move journal synchronously to one peer, since 80 moves per game is trivially cheap, and rebuild the position by replaying it. Position is derivable; the move list is not. The same routing-and-lease discipline that keeps <a class='inline' href='#/breakdowns/hard/uber'>ride offers</a> correct applies here to seat ownership." },
      { t: "h2", text: "Matchmaking that does not make people wait" },
      { t: "p", html: "Keep one queue per time control, bucketed by rating band. Search the player's own band first, then widen the band as a function of waiting time — for instance plus fifty rating points every five seconds — so the quality-versus-wait trade-off is an explicit curve rather than an accident. Two details matter in practice: colour assignment must be balanced over a player's recent games rather than randomised per game, and you should exclude pairings that just happened, or two players who queue at the same rhythm will play each other repeatedly. Matchmaking is also where you enforce fairness policy — provisional ratings, abandonment penalties, and regional preference to keep round-trip times inside the latency budget you promised." },
      { t: "note", variant: "tip", html: "Spectating is a fundamentally different workload: read-only, tolerant of a second of delay, and potentially enormous for a featured game. Serve it from a fan-out tier subscribed to the move stream, never by adding spectators as participants on the game server. Confusing the two is how one popular game degrades the platform." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Puts validation on the server, uses a persistent connection, keeps game state in memory, and handles matchmaking with rating buckets."],
          ["Senior", "Separates socket-holding edge nodes from game-owning servers, sequences messages so reconnect can replay, and makes the server the clock authority with a timer wheel for flag detection."],
          ["Staff", "Designs lag compensation that is fair and capped against manipulation, replicates the move journal so a server crash is recoverable by replay, keeps the disconnected player's clock running with an explicit abandonment rule, and isolates spectator fan-out from the game path."]
        ] },
      { t: "note", variant: "key", html: "<strong>The server owns the board and the clock; the client owns nothing but pixels.</strong> Sequence every message so reconnect is a replay, deduct time from server-measured intervals with a capped lag compensation, and keep the move journal — the position is always derivable from it, and it is the only thing you cannot rebuild." }
    ]
  });

  /* ---------------------------------------------------------------- 11 */
  LESSONS.push({
    id: "chatgpt",
    title: "Design a conversational assistant",
    summary: "Token-by-token streaming at scale, GPUs as a scheduled scarce resource, conversation context and its cost, and the abuse surface. Closes the track.",
    minutes: 14,
    tags: ["breakdown", "llm", "capacity"],
    blocks: [
      { t: "p", html: "The prompt is <strong>a chat product backed by a large language model</strong>. The mental model that separates a good answer from a vague one: this is a <em>capacity scheduling</em> problem in a streaming wrapper. The model is a fixed, expensive, slow resource; almost every design decision is about how you queue for it, how long each request holds it, and what you do when demand exceeds supply." },

      { t: "h", text: "1 · The prompt and what to ask" },
      { t: "ul", items: [
        "<strong>Are we training or serving?</strong> Assume serving only. Training is a different system with a different failure profile.",
        "<strong>Streaming or complete responses?</strong> Assume streaming, because the perceived latency difference is enormous and it changes the connection model.",
        "<strong>How long are conversations?</strong> Assume a median of 6 turns and a tail past 50, and that we must decide what to do about the tail.",
        "<strong>Is capacity elastic?</strong> Assume not really — accelerator supply is procured in advance, so admission control is a requirement rather than a fallback.",
        "<strong>Multi-tenant?</strong> Assume free and paid tiers with different guarantees, which makes queueing policy a product decision."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Accept a message in a conversation and stream a response token by token.",
        "Maintain conversation context across turns.",
        "Queue and schedule requests against a finite pool of accelerators.",
        "Enforce per-user rate limits and content policy.",
        "Degrade predictably when demand exceeds capacity."
      ] },
      { t: "ul", items: [
        "<strong>Time to first token:</strong> under 1 s at p95. This dominates perceived quality far more than total duration.",
        "<strong>Throughput per stream:</strong> at least 30 tokens/s, which is comfortably faster than reading speed.",
        "<strong>Fairness:</strong> a heavy user cannot starve others; paid capacity is reserved, not merely prioritised.",
        "<strong>Scale (assumed):</strong> 20 million daily active users, 300 million requests/day, roughly 3,500/s average."
      ] },

      { t: "h", text: "3 · Capacity math" },
      { t: "code", lang: "text", code:
        "Stated assumptions. The model shape below is illustrative, not any real product.\n\n" +
        "  daily active users      = 20,000,000\n" +
        "  messages / user / day   = 15\n" +
        "  requests / day          = 300,000,000\n" +
        "  requests / sec (avg)    = 300e6 / 86,400                 ~= 3,500/s\n" +
        "  peak (3x)                                                ~= 10,400/s\n" +
        "  tokens per request      = 800 in, 400 out\n" +
        "  output rate per stream  = 40 tokens/s\n" +
        "  stream duration         = 400 / 40                        = 10 s\n\n" +
        "Little's law is your GPU budget:\n" +
        "  concurrent generations  = 3,500 * 10                      = 35,000\n" +
        "  at peak                 = 10,400 * 10                    ~= 105,000\n\n" +
        "KV cache is what caps concurrency per accelerator:\n" +
        "  bytes/token = 2 (K and V) * layers * kv_heads * head_dim * bytes_per_element\n" +
        "              = 2 * 48 * 8 * 128 * 2 B                      = 196,608 B ~= 192 KB\n" +
        "  8,000-token session     = 8,000 * 192 KB                 ~= 1.5 GB\n" +
        "  80 GB accelerator, ~20 GB weights -> ~60 GB for KV        = ~40 sessions\n" +
        "  accelerators at average = 35,000 / 40                    ~= 875\n" +
        "  accelerators at peak    = 105,000 / 40                   ~= 2,600\n\n" +
        "  Halving average context doubles sessions per accelerator and halves the fleet.\n" +
        "  Context management is a capacity lever, not a product nicety.\n\n" +
        "  output tokens / day     = 300e6 * 400                     = 120,000,000,000"
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "Conversation { conv_id, user_id, title, created_at, summary_ref }\n" +
        "Turn         { turn_id, conv_id, role: user|assistant, content, tokens, ts }\n" +
        "Request      { req_id, conv_id, prompt_tokens, max_output, tier, state,\n" +
        "               queued_at, admitted_at, first_token_at }\n" +
        "Slot         { node_id, batch_slot, kv_bytes_used, req_id? }\n\n" +
        "POST /v1/conversations/{id}/messages  { content, stream: true }\n" +
        "     -> chunked stream of { delta } ... { done, usage }\n" +
        "POST /v1/conversations/{id}/messages/{req_id}/cancel  -> 204   // frees the slot\n" +
        "GET  /v1/conversations/{id}?before=                   -> [Turn]\n" +
        "GET  /v1/usage                                        -> { tokens, limits, reset_at }"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  client\n" +
        "    | (streaming HTTP or websocket)\n" +
        "    v\n" +
        "  gateway: auth, rate limit, safety pre-check, tier tagging\n" +
        "    |\n" +
        "    v\n" +
        "  context builder: recent turns verbatim + rolling summary + retrieved facts\n" +
        "    |                                        |\n" +
        "    |                                   conversation store\n" +
        "    v\n" +
        "  admission control + priority queues (paid | free | batch)\n" +
        "    |         rejects fast with a retry hint when the queue is over budget\n" +
        "    v\n" +
        "  scheduler -> inference nodes (continuous batching, paged KV cache)\n" +
        "    |                 |\n" +
        "    |            token stream\n" +
        "    v                 v\n" +
        "  stream relay --> client (deltas)  --> safety post-filter on the stream\n" +
        "                      |\n" +
        "                      v\n" +
        "              turn persisted on completion or cancellation"
      },
      { t: "p", html: "Two components carry this design. The <strong>admission controller</strong> is the only honest answer to fixed capacity: when the queue exceeds what the fleet can drain within the latency target, it must reject quickly with a retry hint rather than accept work it cannot serve. And the <strong>context builder</strong> is where cost is actually decided — every token it adds to the prompt is compute on the way in and memory for the whole generation." },

      { t: "h", text: "6 · The one hard part: scheduling a resource you cannot buy more of today" },
      { t: "p", html: "A web service scales by adding stateless replicas. Accelerator capacity is procured months ahead, and each request holds a slot for seconds while consuming memory proportional to its context length. That combination — long holds, heterogeneous memory footprints, and a hard ceiling — makes scheduling the defining problem." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "One request per accelerator, first come first served", "Utilisation is dreadful because generation is memory-bandwidth bound and a single sequence cannot saturate the hardware. You need many times the fleet for the same throughput."],
          ["Naive", "Fixed batching: wait for N requests, run them together to completion", "Every request in the batch finishes when the longest one does, so a 2,000-token answer holds four short ones hostage. Time to first token also degrades while the batch fills."],
          ["Solid", "Continuous batching: sequences join and leave the running batch each step, with a paged KV cache so memory is allocated in blocks rather than contiguous per-sequence reservations", "Utilisation rises sharply and a finished sequence frees its slot immediately. Paging removes the fragmentation that forces you to reserve for the worst-case context length."],
          ["Standout", "The same, plus admission control with tiered queues, prefix caching for shared conversation prefixes, and preemption of low-priority long generations back into the queue", "Prefix caching is the biggest single win in a chat product: turn 20 of a conversation re-sends the entire history, and caching the computed prefix turns a large prefill into a small one. Tiered queues make the fairness promise real rather than aspirational, and preemption means one enormous free-tier generation cannot hold a slot through a paid-traffic spike."]
        ] },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Streaming, and what it does to your infrastructure" },
      { t: "p", html: "Streaming turns a short request/response into a connection held open for ten seconds, which every layer must be configured for: no buffering proxies, no response-size-triggered compression, generous idle timeouts, and a deployment strategy that drains connections rather than cutting them. It also changes error handling fundamentally — you have already sent a success status and half an answer when the failure occurs, so errors must be expressible <em>inside</em> the stream. And cancellation becomes a first-class operation with real value: a user closing the tab should free an accelerator slot immediately, so the client disconnect must propagate all the way to the scheduler rather than being absorbed by a proxy." },
      { t: "h2", text: "Context management is the cost dial" },
      { t: "p", html: "Every turn re-sends the conversation, so cost grows quadratically with conversation length if you do nothing. The layered answer: keep the most recent turns verbatim because they matter most, replace older turns with a rolling summary the model itself generates, and retrieve specific older facts on demand rather than carrying them permanently. Cache the computed prefix so an unchanged conversation history is not recomputed from scratch each turn. The trade-off is explicit and worth stating: summarisation loses detail, and the loss is invisible until a user references something from turn 3. Expose it in the product — a visible context boundary is better than silent forgetting." },
      { t: "h2", text: "Abuse, rate limiting, and safety on a stream" },
      { t: "p", html: "Rate limiting by request count is the wrong unit, because requests differ in cost by two orders of magnitude. Limit on tokens, ideally with a token bucket over input-plus-output tokens per time window, and enforce a per-request output cap so a single call cannot monopolise a slot. Safety needs two passes: a cheap pre-check on the input before you spend an accelerator on it, and a streaming post-filter on the output. The post-filter is the awkward one — you are emitting tokens as they are produced, so a filter must either buffer a small window (adding latency) or be able to retract, which most transports cannot do. The honest resolution is a short buffered window of a sentence or so, plus a hard stop that terminates the stream with a clear reason. Say that out loud rather than pretending post-filtering is free." },
      { t: "note", variant: "trap", html: "Do not describe capacity as autoscaling. Accelerator supply is a procurement decision with a lead time, so the elastic component is the queue, not the fleet. A design that shrugs and says 'we scale out' has skipped the only genuinely hard part of the problem." },

      { t: "h", text: "How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem"],
        rows: [
          ["Mid", "Streams responses over a persistent connection, stores conversation turns, applies rate limits, and knows inference runs on a separate pool from the web tier."],
          ["Senior", "Derives concurrency from Little's law, explains continuous batching and why fixed batching wastes slots, manages context growth with summarisation and retrieval, and handles cancellation as a capacity concern."],
          ["Staff", "Treats capacity as fixed and designs admission control and tiered queues around it, connects KV cache size to concurrency per accelerator and therefore to fleet cost, uses prefix caching as the primary cost lever, and is honest about the latency cost of streaming safety filters."]
        ] },

      { t: "h", text: "What generalises across the breakdowns" },
      { t: "p", html: "That is the last problem in Hard Mode, and the Data Platforms module that follows applies the same moves to pipelines. Step back from the specifics, because the specifics are the least transferable part. Across every breakdown here, the same small set of moves did the work." },
      { t: "ul", items: [
        "<strong>Find the scarce resource and design around it.</strong> Accelerator slots here, politeness slots in <a class='inline' href='#/breakdowns/hard/web-crawler'>crawling</a>, the single writer in <a class='inline' href='#/breakdowns/hard/robinhood'>matching</a>, memory in <a class='inline' href='#/breakdowns/hard/top-k'>heavy hitters</a>. Everything else is plumbing around that constraint.",
        "<strong>Separate the write stream from the state machine.</strong> Location pings versus rides, clicks versus invoices, cursors versus document operations. They deserve different consistency, different durability and usually different stores.",
        "<strong>Make the log the truth and everything else a derived view.</strong> That is what makes <a class='inline' href='#/breakdowns/hard/ad-click-aggregator'>recomputation</a>, replay and <a class='inline' href='#/breakdowns/hard/online-chess'>reconnection</a> possible at all.",
        "<strong>Retries are certain, so make effects idempotent.</strong> Idempotency keys, compare-and-set on a version, writes keyed by window — the mechanism varies, the requirement never does.",
        "<strong>Name what you gave up.</strong> Approximate counts, conflated market data, partial search results, summarised context. Every one of these is a deliberate loss, and the answer that names the loss beats the answer that pretends there wasn't one.",
        "<strong>Design the recovery path before the happy path.</strong> Reconciliation, replay, orphaned-lease sweeps, break queues. These are not operational afterthoughts; in the hardest problems they are the architecture."
      ] },
      { t: "p", html: "The interview skill this track is actually training is not recall of these eleven designs. It is the habit of finding the one decision that carries the most weight, resolving it explicitly with its cost stated, and then spending your remaining minutes on the two or three things an interviewer will genuinely push on. If you can do that on a problem you have never seen, you did not need the eleven designs — but they are how you build the habit." },
      { t: "note", variant: "key", html: "<strong>Capacity is the design.</strong> Little's law turns request rate and response duration into a fleet size; KV cache size turns context length into concurrency per accelerator. Once you can compute both, admission control, prefix caching and context management stop being tactics and become the architecture — and that pattern of finding the binding constraint first is what generalises to every problem in this track." },
      { t: "quiz", id: "breakdowns-hard" }
    ]
  });

  /* ================================================================
     4 · Register the module (order-independent; only ever push)
     ================================================================ */
  var MY_MODULE = {
    id: "hard",
    name: "Hard Mode",
    icon: "diamond",
    lessons: LESSONS
  };

  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.breakdowns || (window.TRACKS.breakdowns = { id: "breakdowns", modules: [] });
  T.modules = T.modules || [];
  T.modules.push(MY_MODULE);
})();
