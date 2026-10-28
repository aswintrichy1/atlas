/* =====================================================================
   BLUEPRINT · Breakdowns → module "scale" (Scale & Infrastructure)
   Ten full problem breakdowns, one house template each:
     1 scoping questions · 2 requirements · 3 capacity math
     4 entities + API   · 5 high-level design · 6 the one hard part
     7 deep dives       · 8 level expectations · key note
   Owns: window.TRACKS.breakdowns.modules[+1 module "scale"]
         window.QUIZZES["breakdowns-scale"]
         window.Widgets.bdRateLab
   Track metadata (name/short/color/blurb) is owned by a sibling file.
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     WIDGETS OWNED BY THIS FILE
     ================================================================= */
  var Widgets = {};

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      if (k === "class") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    for (var i = 2; i < arguments.length; i++) {
      var kid = arguments[i];
      if (kid == null) continue;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    }
    return el;
  }

  function clearNode(el) {
    while (el && el.firstChild) el.removeChild(el.firstChild);
  }

  function fmt(n) {
    if (!isFinite(n)) return "0";
    var v = Math.round(n);
    var s = String(Math.abs(v)), out = "", c = 0, i;
    for (i = s.length - 1; i >= 0; i--) {
      out = s.charAt(i) + out;
      c++;
      if (c % 3 === 0 && i > 0) out = "," + out;
    }
    return (v < 0 ? "-" : "") + out;
  }

  function bytes(n) {
    if (n >= 1048576) return (n / 1048576).toFixed(1) + " MB";
    if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
    return Math.round(n) + " B";
  }

  /* -----------------------------------------------------------------
     bdRateLab — five rate-limiter algorithms over one fixed trace.
     Window = 60 s, trace = seconds 0..120 (two aligned windows).
     Every shape offers the same total load (3x the limit) so the
     differences you see come from the algorithm, not the input volume.
     ----------------------------------------------------------------- */
  Widgets.bdRateLab = function (mount) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, "simulator"),
      h("h3", {}, "Compare rate-limiter algorithms")));
    mount.appendChild(h("p", { class: "widget-desc" },
      "One 120-second trace, two aligned 60-second windows, five algorithms. Every traffic shape offers the same total load, so any difference you see is the algorithm's doing."));

    var WINDOW = 60;
    var SPAN = 121;

    var ALGOS = [
      { id: "fixed", label: "fixed window" },
      { id: "log", label: "sliding log" },
      { id: "counter", label: "sliding counter" },
      { id: "token", label: "token bucket" },
      { id: "leaky", label: "leaky bucket" }
    ];
    var SHAPES = [
      { id: "steady", label: "steady" },
      { id: "bursty", label: "bursty" },
      { id: "boundary", label: "boundary-spike" }
    ];

    var algo = "fixed";
    var shape = "boundary";
    var limit = 100;

    function buildArrivals(L, shapeId) {
      var a = [], i;
      for (i = 0; i < SPAN; i++) a.push(0);
      function put(t, n) {
        if (t < 0 || t >= SPAN) return;
        var v = Math.round(n);
        if (v > 0) a[t] += v;
      }
      if (shapeId === "steady") {
        for (i = 0; i < 12; i++) put(i * 10, L / 4);
      } else if (shapeId === "bursty") {
        put(5, L); put(25, L / 2); put(70, L); put(100, L / 2);
      } else {
        /* everything crowded against the 60-second boundary */
        put(59, L); put(60, L); put(100, L / 2); put(110, L / 2);
      }
      return a;
    }

    function simulate(L, shapeId, algoId) {
      var arr = buildArrivals(L, shapeId);
      var out = [];
      var allowed = 0, rejected = 0, offered = 0;
      var w1 = 0, w2 = 0;
      var rate = L / WINDOW;
      var queueCap = Math.max(1, Math.round(L / 4));

      var used = 0, curWin = -1;                       /* fixed window   */
      var hist = [];                                   /* sliding log    */
      var prevCount = 0, curCount = 0, cWin = -1;      /* sliding counter*/
      var tokens = L;                                  /* token bucket   */
      var queue = 0;                                   /* leaky bucket   */
      var t, n, a, j;

      for (t = 0; t < SPAN; t++) {
        n = arr[t];
        offered += n;
        a = 0;

        if (algoId === "fixed") {
          var w = Math.floor(t / WINDOW);
          if (w !== curWin) { curWin = w; used = 0; }
          a = Math.min(n, Math.max(0, L - used));
          used += a;
          out.push(a);
        } else if (algoId === "log") {
          var inWin = 0;
          for (j = Math.max(0, t - WINDOW + 1); j < t; j++) inWin += hist[j] || 0;
          a = Math.min(n, Math.max(0, L - inWin));
          hist[t] = a;
          out.push(a);
        } else if (algoId === "counter") {
          var w2i = Math.floor(t / WINDOW);
          if (w2i !== cWin) {
            prevCount = (cWin === w2i - 1) ? curCount : 0;
            curCount = 0;
            cWin = w2i;
          }
          var elapsed = t - w2i * WINDOW;
          var est = prevCount * ((WINDOW - elapsed) / WINDOW) + curCount;
          a = Math.min(n, Math.max(0, Math.floor(L - est)));
          curCount += a;
          out.push(a);
        } else if (algoId === "token") {
          if (t > 0) tokens = Math.min(L, tokens + rate);
          a = Math.min(n, Math.floor(tokens));
          tokens -= a;
          out.push(a);
        } else {
          /* leaky bucket as a shaper: drain at a fixed rate, admit into
             a bounded queue, drop whatever does not fit */
          var served = Math.min(queue, rate);
          queue -= served;
          a = Math.min(n, Math.floor(queueCap - queue));
          if (a < 0) a = 0;
          queue += a;
          out.push(served);
        }

        allowed += a;
        rejected += (n - a);
        if (t < WINDOW) w1 += a; else w2 += a;
      }

      var burst = 0;
      for (t = 0; t < out.length - 1; t++) {
        var pair = out[t] + out[t + 1];
        if (pair > burst) burst = pair;
      }

      return {
        allowed: allowed, rejected: rejected, offered: offered,
        w1: w1, w2: w2, burst: Math.round(burst),
        rate: rate, queueCap: queueCap
      };
    }

    function memoryFor(L, algoId) {
      if (algoId === "log") return bytes(L * 8);
      if (algoId === "counter") return "~24 B";
      if (algoId === "leaky") return "~16 B + queued work";
      return "~16 B";
    }

    function verdictFor(L, shapeId, algoId, r) {
      var rateTxt = (r.rate).toFixed(1) + "/s";
      if (algoId === "fixed") {
        return "One counter per aligned window is the cheapest thing that works — and the worst 2-second burst above ("
          + fmt(r.burst) + " against a limit of " + fmt(L)
          + ") is exactly why it is not accurate. It bounds requests per aligned window, never per arbitrary window."
          + (shapeId === "boundary" ? " This trace is built to expose that: a full limit at the end of window one, a full limit at the start of window two." : "");
      }
      if (algoId === "log") {
        return "Exact — no client ever exceeds " + fmt(L)
          + " in any rolling 60 seconds, on any traffic shape. You pay for that in state: one timestamp per allowed request, "
          + memoryFor(L, "log") + " per active client, versus tens of bytes for every other option here.";
      }
      if (algoId === "counter") {
        return "Two counters and one multiplication get you within a few percent of the log, with no boundary doubling. It assumes the previous window's traffic was evenly spread, so on spiky input it is slightly generous or slightly strict — usually the right default.";
      }
      if (algoId === "token") {
        return "Long-run rate is pinned to " + rateTxt + ", but a full bucket releases up to " + fmt(L)
          + " instantly. That burst allowance is a feature when the client is legitimately bursty and a liability when the burst is the attack.";
      }
      return "Output is shaped to " + rateTxt + ": the worst 2-second burst reaching the backend is "
        + fmt(r.burst) + " no matter how spiky the input is. You pay with queueing latency and with drops once the "
        + fmt(r.queueCap) + "-deep queue fills — which is why the allowed count here is lower than the token bucket's.";
    }

    var algoSeg = h("div", { class: "w-seg" });
    var shapeSeg = h("div", { class: "w-seg" });
    var input = h("input", {
      type: "number", min: "1", max: "100000", step: "1", value: "100", style: "width:96px"
    });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });

    function readLimit() {
      var v = parseInt(input.value, 10);
      if (!isFinite(v) || isNaN(v)) v = 100;
      if (v < 1) v = 1;
      if (v > 100000) v = 100000;
      return v;
    }

    function ro(label, value) {
      return h("span", { class: "ro" }, label + " ", h("b", {}, value));
    }

    function paint() {
      limit = readLimit();
      var r = simulate(limit, shape, algo);
      var algoLabel = "fixed window";
      var i;
      for (i = 0; i < ALGOS.length; i++) if (ALGOS[i].id === algo) algoLabel = ALGOS[i].label;

      clearNode(stage);
      stage.appendChild(h("div", {
        style: "font-family:var(--font-mono);font-size:0.82rem;line-height:1.9;opacity:0.92"
      },
        h("div", {}, "algorithm    " + algoLabel),
        h("div", {}, "limit        " + fmt(limit) + " per 60 s"),
        h("div", {}, "offered      " + fmt(r.offered) + " requests over 120 s"),
        h("div", {}, "window 1     " + fmt(r.w1) + " allowed"),
        h("div", {}, "window 2     " + fmt(r.w2) + " allowed")
      ));

      clearNode(readout);
      readout.appendChild(ro("allowed", fmt(r.allowed)));
      readout.appendChild(ro("rejected", fmt(r.rejected)));
      readout.appendChild(ro("worst 2s burst", fmt(r.burst)));
      readout.appendChild(ro("state / client", memoryFor(limit, algo)));
      readout.appendChild(h("span", { class: "ro" }, verdictFor(limit, shape, algo, r)));
    }

    function buildSeg(seg, items, current, onPick) {
      clearNode(seg);
      items.forEach(function (it) {
        var b = h("button", { class: it.id === current ? "active" : "" }, it.label);
        b.addEventListener("click", function () {
          onPick(it.id);
          paint();
        });
        seg.appendChild(b);
      });
    }

    function renderSegs() {
      buildSeg(algoSeg, ALGOS, algo, function (id) { algo = id; renderSegs(); });
      buildSeg(shapeSeg, SHAPES, shape, function (id) { shape = id; renderSegs(); });
    }

    input.addEventListener("input", paint);
    input.addEventListener("change", function () { input.value = String(readLimit()); paint(); });

    renderSegs();
    mount.appendChild(h("div", { class: "widget-controls" }, algoSeg));
    mount.appendChild(h("div", { class: "widget-controls" },
      h("label", { class: "w-field" }, "limit / 60 s ", input),
      shapeSeg
    ));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* =================================================================
     QUIZ OWNED BY THIS FILE
     ================================================================= */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "breakdowns-scale": {
      title: "Scale & Infrastructure checkpoint",
      sub: "Ingest, caching, limiting, ordering, fan-out, scheduling and delivery.",
      questions: [
        {
          q: "A fixed-window counter allows 100 requests per aligned 60-second window. What is the largest number of requests one client can push through inside a span much shorter than 60 seconds?",
          options: [
            "100 — that is exactly the guarantee the algorithm makes",
            "200, by filling the end of one window and the start of the next",
            "150, because the second window is only partially available",
            "Unbounded, because the counter resets on every request"
          ],
          answer: 1,
          explain: "The counter resets on an aligned boundary, so 100 requests at the last instant of window k plus 100 at the first instant of window k+1 land 200 requests in an arbitrarily short span. Fixed windows bound requests per aligned window, not per arbitrary window of the same length. A sliding window log or a sliding window counter closes that gap."
        },
        {
          q: "Which rate-limiting algorithm has the highest state cost per active client, and why?",
          options: [
            "Fixed window, because it keeps one counter and a window id",
            "Sliding window counter, because it keeps two counters instead of one",
            "Sliding window log, because it keeps a timestamp for every request in the window",
            "Token bucket, because it keeps a token level and a refill timestamp"
          ],
          answer: 2,
          explain: "The log stores one timestamp per allowed request, so its memory grows with the limit itself — at a 1,000-per-minute limit that is roughly 8 KB per active client, against tens of bytes for the counter and bucket forms. Exactness is the thing you are buying with that memory. The sliding window counter approximates the same answer in constant state."
        },
        {
          q: "Token bucket and leaky-bucket-as-a-queue are configured for the same long-run rate. What is the practical difference?",
          options: [
            "Only the leaky bucket bounds the long-run rate; the token bucket bounds nothing",
            "The leaky bucket permits bursts up to its queue depth; the token bucket never permits a burst",
            "They behave identically; the names describe the same algorithm",
            "The token bucket permits a burst up to the bucket size; the leaky bucket smooths its output to a constant rate"
          ],
          answer: 3,
          explain: "Both cap the sustained rate at the refill or leak rate, but a full token bucket releases up to its capacity instantly, which is why it suits clients whose bursts are legitimate. A leaky-bucket queue drains at a fixed rate, so the backend never sees a burst at all — paid for with queueing latency and with drops once the queue is full."
        },
        {
          q: "You run a 16-node cache keyed by hash(key) % N and add a seventeenth node. Roughly what fraction of keys change owner?",
          options: [
            "About 6%, which is what consistent hashing would also give you",
            "About 25%",
            "About 50%",
            "About 94%"
          ],
          answer: 3,
          explain: "Under modulo hashing only the keys whose index happens to be unchanged stay put — roughly one in seventeen — so about 94% of the key space relocates and the cache effectively empties into the database behind it. Consistent hashing moves only about 1/17 of keys instead, and virtual nodes spread that transfer across every remaining node rather than dumping it on one neighbour."
        },
        {
          q: "A fitness app records one GPS point every 3 seconds per active session. Which change most cheaply reduces the request rate hitting the ingest tier?",
          options: [
            "Batch points on the device and upload one request per 30 seconds of recording",
            "Increase the sampling interval from 3 seconds to 10 seconds",
            "Add read replicas behind the activity database",
            "Shard the point table by user id"
          ],
          answer: 0,
          explain: "Batching ten points into one request cuts request rate tenfold without losing a single data point or changing the product. Replicas and sharding help the storage tier absorb volume but do nothing about the number of requests arriving. Lowering the sampling rate does reduce load, but it degrades route fidelity, which is the product."
        },
        {
          q: "Two bids on the same auction hit two application servers at the same instant. Which mechanism prevents a lost update without a distributed lock?",
          options: [
            "Read the current price, compare it in the application, then write the new price",
            "A conditional write that only succeeds if the stored price and version still match what the bid was based on",
            "Let both servers write to different replicas and reconcile the divergence afterwards",
            "Raise the database connection pool size so neither request has to wait"
          ],
          answer: 1,
          explain: "A compare-and-set on price plus version makes the database itself the arbiter: exactly one write wins and the loser retries against the price it now sees. Read-then-write is the textbook lost-update pattern. Reconciling divergent replicas after the fact means you have already told two people they were the high bidder."
        },
        {
          q: "Why split an uploaded video into roughly 10-second chunks before transcoding?",
          options: [
            "It reduces the total CPU work the transcode requires",
            "It improves the compression ratio of every rendition",
            "It turns one long serial job into hundreds of independent, retryable jobs",
            "It is a hard requirement of adaptive-bitrate players"
          ],
          answer: 2,
          explain: "Chunking does not reduce total CPU; it converts a single multi-hour serial job into hundreds of independent ones, so a long upload can occupy hundreds of cores and a failure costs one chunk instead of the whole file. Adaptive-bitrate delivery also uses segments, but that is a packaging concern downstream of transcode and does not dictate the transcode unit."
        },
        {
          q: "A distributed scheduler must never run a job twice. Which approach is most robust?",
          options: [
            "Tighten NTP synchronisation so every node's wall clock agrees closely enough to compare",
            "Elect a single leader and allow only that node to fire jobs",
            "Have each worker sleep a random interval before firing so collisions become unlikely",
            "Accept at-least-once firing and deduplicate on a deterministic key of (job id, scheduled time)"
          ],
          answer: 3,
          explain: "Exactly-once delivery across a network is not achievable, but exactly-once effect is: make the fire event carry a key the handler can deduplicate on with a conditional insert. A single leader converts a duplication problem into an availability problem, tighter NTP only narrows the race window, and random sleeps make collisions rarer without making them impossible."
        },
        {
          q: "Five million viewers watch one broadcast and 800 comments arrive per second. What most effectively makes delivery affordable?",
          options: [
            "Sample comments to a fixed display budget and batch them into one frame per viewer per second",
            "Have each client poll the API once per second for anything new",
            "Push every comment to every viewer over its persistent connection",
            "Move the comment table to a faster database engine"
          ],
          answer: 0,
          explain: "Delivering every comment to every viewer is roughly four billion messages per second, and no human can read 800 comments a second anyway — so the product itself licenses you to sample. Batching a sampled set into one frame per second makes the per-viewer message rate a constant, and a fan-out tree keeps pub/sub cost proportional to node count rather than viewer count. Polling five million clients just relocates the same load onto the API."
        },
        {
          q: "A notification worker consumes from an at-least-once queue. When should it write the deduplication record relative to calling the push provider?",
          options: [
            "After the provider confirms success, so that failed sends stay freely retryable",
            "Before or atomically with the provider call, as a conditional insert where the first writer wins",
            "It does not matter, because the queue guarantees each message is handled once",
            "Only in the client application, which can suppress a duplicate banner locally"
          ],
          answer: 1,
          explain: "If the record is written only after a successful send, a crash between the send and the write leaves no evidence and the redelivered message notifies the user a second time. A conditional insert placed before the call means the duplicate attempt loses the race and becomes a no-op, and passing the same key to the provider's own idempotency header collapses in-flight duplicates too. At-least-once queues never promise single delivery."
        }
      ]
    }
  });

  /* =================================================================
     MODULE
     ================================================================= */
  var LESSONS = [];

  /* ---------------------------------------------------------------
     1 · STRAVA
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "strava",
    title: "Design activity tracking with routes and leaderboards",
    summary: "Strava. Swallow a firehose of GPS points cheaply, then serve segment leaderboards that have to be right.",
    minutes: 11,
    tags: ["breakdown", "ingest", "leaderboard", "geospatial"],
    blocks: [
      { t: "p", html: "The prompt: users record runs and rides on a phone, the app draws the route, and every named stretch of road — a <em>segment</em> — carries a leaderboard of everyone who has ever ridden it. Two very different systems are hiding in one product: a high-volume write pipe and a correctness-sensitive ranking service." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>Is the leaderboard all-time or windowed?</strong> — Assume both: all-time plus this-year and this-month. Windowing changes the storage shape more than the arithmetic.",
        "<strong>Does a route have to match a segment exactly?</strong> — Assume fuzzy matching along a polyline with a tolerance, not GPS-point equality. Phone GPS drifts several metres.",
        "<strong>Can activities be edited, deleted, or flagged as invalid?</strong> — Assume yes. This is the single detail that decides your leaderboard design, so ask it early.",
        "<strong>Must the leaderboard update instantly?</strong> — Assume not. Seconds-to-a-minute after upload is fine and nobody notices. Say so out loud; it buys you an async pipeline.",
        "<strong>Live tracking for followers?</strong> — Assume out of scope for the first pass, and mention you would add it as a separate low-fanout stream."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Record an activity on device and upload it, including offline recording and a later upload.",
        "Render the route, distance, elevation and pace for a completed activity.",
        "Detect which segments an activity crossed and record an <em>effort</em> per segment.",
        "Serve a segment leaderboard: top N overall, plus the viewer's own rank.",
        "Remove an activity and all its efforts when a user deletes or an anti-cheat check flags it."
      ] },
      { t: "ul", items: [
        "<strong>Ingest availability</strong> — the upload path must accept writes even when the leaderboard tier is degraded. A lost workout is unforgivable; a stale rank is not.",
        "<strong>Leaderboard read latency</strong> — p99 under 200 ms for the top 100 of a segment.",
        "<strong>Effort freshness</strong> — a new effort is visible on the leaderboard within about 60 seconds of upload.",
        "<strong>Correctness</strong> — an effort appears exactly once per (activity, segment), and disappears completely on deletion.",
        "<strong>Durability</strong> — raw point data is never lost; everything derived from it can be rebuilt."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  registered users            40,000,000\n" +
        "  daily active users           4,000,000\n" +
        "  activities per active / day        0.5\n" +
        "  average activity               45 min, 1 GPS point every 3 s\n\n" +
        "WRITE VOLUME\n" +
        "  activities / day = 4,000,000 * 0.5        =  2,000,000\n" +
        "  points / activity = 45 * 60 / 3           =        900\n" +
        "  points / day     = 2,000,000 * 900        =  1.8 billion\n" +
        "  points / sec     = 1.8e9 / 86,400         =  ~20,800 / s\n\n" +
        "  device batches 30 s of recording -> 10 points per request\n" +
        "  ingest req / sec = 20,800 / 10            =  ~2,080 / s\n" +
        "  peak (x3)                                 =  ~6,300 / s\n\n" +
        "STORAGE\n" +
        "  raw point  ~16 B (lat, lon, elevation, dt, heart rate)\n" +
        "  delta-encoded + compressed  ~4 B\n" +
        "  points / day = 1.8e9 * 4 B                =  7.2 GB / day\n" +
        "  per year     = 7.2 * 365                  =  ~2.6 TB / yr\n" +
        "  summaries    = 2,000,000 * 500 B          =  1 GB / day -> 365 GB / yr\n\n" +
        "BANDWIDTH\n" +
        "  2,080 req/s * ~400 B                      =  ~0.8 MB / s\n" +
        "  ingest bandwidth is a rounding error; the leaderboard is the problem\n\n" +
        "LEADERBOARD\n" +
        "  named segments                            =  2,000,000\n" +
        "  efforts / day (5 segments per activity)   =  10,000,000 -> ~116 / s\n" +
        "  top-1,000 per segment in a sorted set\n" +
        "  2e6 * 1,000 * 24 B                        =  ~48 GB of cache"
      },
      { t: "note", variant: "tip", html: "Notice what the arithmetic just told you. Twenty thousand points a second sounds terrifying until batching turns it into two thousand requests a second and under a megabyte per second of bandwidth. <strong>Do the capacity math before you pick the hard part</strong> — it frequently moves." },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ENTITIES\n" +
        "  User(user_id, ...)\n" +
        "  Activity(activity_id, user_id, started_at, sport, distance_m,\n" +
        "           duration_s, elevation_m, track_uri, status)\n" +
        "  TrackBlob            immutable, in object storage, keyed by track_uri\n" +
        "  Segment(segment_id, name, polyline, start_cell, end_cell, distance_m)\n" +
        "  Effort(activity_id, segment_id, user_id, elapsed_s, started_at)\n" +
        "        primary key (activity_id, segment_id)   <- idempotency lives here\n\n" +
        "API\n" +
        "  POST /activities                     -> { activity_id, upload_token }\n" +
        "  POST /activities/{id}/points         batch of points, idempotent by seq\n" +
        "  POST /activities/{id}/complete       -> enqueues segment matching\n" +
        "  GET  /activities/{id}                -> summary + track_uri\n" +
        "  GET  /segments/{id}/leaderboard?window=all|year|month&cursor=\n" +
        "  GET  /segments/{id}/me               -> your best effort and rank\n" +
        "  DELETE /activities/{id}              -> tombstone + effort retraction"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  phone --batched points--> [ ingest API ] --append--> object storage\n" +
        "                                  |                    (immutable track)\n" +
        "                                  +--> activity row (relational)\n" +
        "                                  |\n" +
        "                         on complete: enqueue\n" +
        "                                  v\n" +
        "                        [ segment match workers ]\n" +
        "                          |            |\n" +
        "               cell index lookup   polyline match\n" +
        "                          |            |\n" +
        "                          +---> Effort upsert (activity_id, segment_id)\n" +
        "                                       |\n" +
        "                              [ leaderboard updater ]\n" +
        "                                       v\n" +
        "                          sorted set per (segment, window)\n" +
        "                                       ^\n" +
        "  reader --> [ read API ] -------------+ (miss -> rebuild from Effort)"
      },
      { t: "p", html: "Three load-bearing pieces. <strong>Object storage holds the immutable track</strong>, so the point firehose never touches a transactional database. <strong>The Effort table is the system of record for rankings</strong> — one row per activity-segment pair, which is what makes retraction and replay possible. <strong>The sorted sets are a derived cache</strong>: fast to read, and rebuildable from Effort if a node dies. Every other component can be restarted without ceremony." },

      { t: "h", text: "6 · The one hard part: cheap ingest that still yields a correct leaderboard" },
      { t: "p", html: "These two goals pull in opposite directions. Cheap ingest wants to write opaque blobs and never read them again. A correct leaderboard wants a queryable, mutable ranking that can retract an entry the instant a ride is deleted or flagged. The resolution is to separate the durable log from the derived ranking, and to make the derivation idempotent." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Insert every GPS point as a row and compute the leaderboard with <code class='tok'>ORDER BY elapsed LIMIT 100</code> over all efforts at read time", "Twenty thousand row inserts a second for data you will never query point-by-point, and a ranking query that scans every effort on a popular segment on every page view."],
          ["Naive", "Batch points into blobs, but still rank by scanning the effort table on read", "Ingest is fixed and the write cost collapses, but the read path still degrades with segment popularity — precisely the segments people look at."],
          ["Solid", "Blobs to object storage, summaries in a relational row, asynchronous segment matching from a queue, and a sorted set per segment updated as efforts land", "Writes and reads are both cheap and the pipeline is decoupled. The remaining risk is a sorted set that drifts from the truth after a retry, a crash or a deletion."],
          ["Standout", "The same shape, plus: the Effort table keyed on <code class='tok'>(activity_id, segment_id)</code> so a replayed job upserts instead of double-counting; the sorted set treated as a rebuildable cache, not a source of truth; a bounded top-N in memory with the tail paged from Effort; and deletion modelled as an explicit retraction event, not a silent row removal", "Correctness now survives retries, worker crashes, cache loss and anti-cheat retractions — and you can say exactly how each one recovers."]
        ]
      },
      { t: "note", variant: "tip", html: "The sentence that earns the credit: <em>'the leaderboard is a materialised view over an immutable effort log, so every failure mode reduces to rebuilding a view.'</em> That reframes cache invalidation, retries and cheat retraction as one problem instead of three." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Matching a route to segments without scanning two million polylines" },
      { t: "p", html: "Index every segment by the spatial cells its start point falls in — a geohash prefix or a hierarchical hex grid works equally well. For a finished activity, collect the distinct cells the route passes through, union the candidate segments registered in those cells, and only then run the expensive polyline match. A 45-minute ride touches a few hundred cells and yields tens of candidates, so you have replaced a two-million-row scan with a bounded index lookup plus a handful of geometric comparisons." },
      { t: "h2", text: "Retraction, and why it dictates the schema" },
      { t: "p", html: "A cheat flag or a deletion must remove the entry from every window of every affected leaderboard. If efforts were only ever appended to a sorted set you cannot find them again reliably. Because the Effort row is keyed on <code class='tok'>(activity_id, segment_id)</code>, retraction is a lookup of that activity's efforts followed by a <code class='tok'>ZREM</code> per (segment, window) plus a recompute of the boundary entry that just got promoted. Design the delete path in the interview, not after it." },
      { t: "h2", text: "Time-window leaderboards without three copies of everything" },
      { t: "p", html: "All-time, year and month are three sorted sets per segment, which triples the 48 GB estimate. The cheaper alternative is one sorted set for all-time plus a per-window set only for the segments that were actually read recently, populated on demand from Effort with a range predicate on <code class='tok'>started_at</code>. Most segments are never looked at; pay for the ones that are." },

      { t: "h", text: "8 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "Batched ingest, object storage for tracks, a relational summary row, and a cached leaderboard. Correct capacity arithmetic.", "Writes every GPS point as a row, or recomputes the ranking on read."],
          ["Senior", "Async segment matching from a queue, a spatial index for candidate selection, idempotent effort upserts, and an explicit answer for deletion.", "Never asks whether activities can be deleted, so the design has no retraction path at all."],
          ["Staff", "Frames the leaderboard as a derived view over an immutable log, reasons about rebuild time and cache-loss blast radius, and trades window granularity against memory with numbers.", "Correct design with no story for how it is operated: no rebuild plan, no bound on recovery time."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>Ingest and ranking are two systems, not one.</strong> Make the point stream immutable and boring, make the ranking derived and rebuildable, and key the effort on <code class='tok'>(activity, segment)</code> so retries and retractions are both trivial. The same split shows up again when you build a <a href=\"#/breakdowns/scale/price-tracker\">price tracker</a> and when you decide what a <a href=\"#/breakdowns/scale/distributed-cache\">distributed cache</a> is allowed to lose." }
    ]
  });

  /* ---------------------------------------------------------------
     2 · DISTRIBUTED CACHE
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "distributed-cache",
    title: "Design a distributed cache",
    summary: "Memcached or Redis Cluster from first principles: key placement under membership change, eviction policy, and the one key that ruins everything.",
    minutes: 11,
    tags: ["breakdown", "caching", "consistent-hashing", "hot-key"],
    blocks: [
      { t: "p", html: "The prompt: build a horizontally scalable in-memory cache that sits between a service tier and its database. Reads must be sub-millisecond, the cluster must survive nodes joining and leaving, and it must not fall over when one key becomes a thousand times more popular than the rest." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>Is this a cache or a store?</strong> — Assume a cache: losing data is acceptable, losing availability is not. That single answer removes durability, replication consistency and most of the hard distributed-systems work.",
        "<strong>Who decides placement, client or server?</strong> — Assume a smart client with a shared ring topology. Mention that a proxy tier is the alternative and costs you a network hop.",
        "<strong>Do we need cross-region?</strong> — Assume one region per cluster, with independent clusters elsewhere. Cross-region cache coherence is a different and much worse problem.",
        "<strong>What is the object size distribution?</strong> — Assume a few hundred bytes to a few kilobytes, average 4 KB. Multi-megabyte values would push you toward a different memory allocator story.",
        "<strong>Strong or eventual invalidation?</strong> — Assume eventual, with a TTL as the backstop. Ask, because 'the price shown must never be stale' changes the answer."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "<code class='tok'>GET</code>, <code class='tok'>SET</code> with TTL, and <code class='tok'>DELETE</code> on a byte-string key.",
        "Distribute keys across a cluster of nodes with no central coordinator on the request path.",
        "Survive a node joining, leaving or dying without a cluster-wide reshuffle.",
        "Evict when a node is full, under a stated policy.",
        "Expose per-node hit ratio, eviction rate and memory pressure."
      ] },
      { t: "ul", items: [
        "<strong>Latency</strong> — p99 under 1 ms for a cache hit within the availability zone, excluding client-side serialisation.",
        "<strong>Throughput</strong> — 500,000 reads per second across the cluster at steady state.",
        "<strong>Membership churn</strong> — adding or removing one node relocates at most about 1/N of the key space.",
        "<strong>Availability</strong> — losing one node degrades hit ratio, never correctness; the service behind must still serve.",
        "<strong>Load balance</strong> — no node carries more than about 1.25x the mean key count."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  read QPS at the cache        500,000 / s\n" +
        "  write + invalidate QPS        25,000 / s   (5% of reads)\n" +
        "  hot working set          200,000,000 objects\n" +
        "  average object                  4 KB\n" +
        "  usable RAM per node            64 GB\n\n" +
        "SIZING\n" +
        "  data set     = 200e6 * 4 KB              =  800 GB\n" +
        "  primaries    = 800 / 64                  =  12.5 -> 16 (headroom)\n" +
        "  + 1 replica each                         =  32 nodes\n" +
        "  per-node QPS = 500,000 / 16              =  ~31,000 / s\n" +
        "               (a simple GET path does ~100,000 ops/s: comfortable)\n\n" +
        "BANDWIDTH\n" +
        "  500,000 * 4 KB                           =  2 GB/s  = 16 Gbps total\n" +
        "  per node = 2 GB/s / 16                   =  125 MB/s = 1 Gbps\n\n" +
        "MEMBERSHIP CHANGE, 16 -> 17 NODES\n" +
        "  hash(key) % N        moves ~16/17        =  ~94% of keys\n" +
        "  consistent hashing   moves ~1/17         =  ~6% of keys\n" +
        "  200 virtual nodes each -> 3,400 ring points, so the 6% is spread\n" +
        "  across every surviving node instead of landing on one neighbour\n\n" +
        "THE HOT KEY\n" +
        "  one key taking 10% of reads = 50,000 / s\n" +
        "  50,000 * 4 KB                            =  200 MB/s = 1.6 Gbps\n" +
        "  ...on a single node's NIC. Sharding cannot help: it is one key."
      },
      { t: "note", variant: "trap", html: "The 94% figure is the whole argument for consistent hashing and people quote it wrongly. Under <code class='tok'>hash(key) % N</code>, moving from 16 to 17 nodes leaves roughly one key in seventeen where it was — so about <strong>94% relocate</strong>, every one of them a miss, all at once. That is not a slow warm-up; it is a stampede into your database." },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "CLIENT-SIDE STATE\n" +
        "  Ring       sorted array of { hash_point, node_id }   (~3,400 entries)\n" +
        "  Membership { node_id, host, state: joining|live|leaving, epoch }\n\n" +
        "NODE-SIDE STATE\n" +
        "  Slab-allocated hash table: key -> { value, expires_at, lru_ptr, freq }\n" +
        "  Eviction structure (LRU list, or a frequency sketch for W-TinyLFU)\n\n" +
        "API\n" +
        "  GET    key                -> value | MISS\n" +
        "  SET    key value ttl      -> OK\n" +
        "  DELETE key                -> OK\n" +
        "  MGET   key...             -> values      (one round trip per node)\n" +
        "  STATS                     -> hits, misses, evictions, bytes, keys\n" +
        "  TOPOLOGY                  -> ring + epoch  (polled, not per request)\n\n" +
        "PLACEMENT\n" +
        "  owner(key) = first ring point clockwise from hash(key)\n" +
        "  replicas   = next R-1 distinct physical nodes clockwise"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "   app process\n" +
        "   +----------------------------+\n" +
        "   | near cache (tiny, 1 s TTL) |  <- absorbs hot keys locally\n" +
        "   | ring client (3,400 points) |\n" +
        "   +-------------+--------------+\n" +
        "                 | hash(key) -> ring lookup -> node\n" +
        "                 v\n" +
        "   +---------+  +---------+  +---------+       +---------+\n" +
        "   | node 1  |  | node 2  |  | node 3  |  ...  | node 16 |\n" +
        "   | 64 GB   |  | 64 GB   |  | 64 GB   |       | 64 GB   |\n" +
        "   +---------+  +---------+  +---------+       +---------+\n" +
        "        ^                                           ^\n" +
        "        |                                           |\n" +
        "   [ membership service: gossip or a small consensus group ]\n" +
        "        publishes ring + epoch; clients poll, never block on it\n\n" +
        "   miss -> single-flight to the database, one fetch per key per node"
      },
      { t: "p", html: "The load-bearing choices: <strong>the ring lives in the client</strong>, so a healthy request never consults a coordinator; <strong>membership is published, not queried</strong>, so the control plane can be slow and unavailable without hurting the data plane; and <strong>misses are coalesced</strong>, because the moment a node leaves you get a burst of misses for the same keys and an uncoalesced cache is a database amplifier." },

      { t: "h", text: "6 · The one hard part: placement under churn, and what it does to eviction" },
      { t: "p", html: "Placement and eviction look independent and are not. A placement scheme that relocates a large fraction of keys turns every membership change into a mass eviction event; a placement scheme that leaves load uneven means some nodes evict constantly while others sit half empty. Solve them together." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "<code class='tok'>hash(key) % N</code> with LRU on each node", "One node change relocates ~94% of keys. Every relocated key is a miss, and the miss storm hits the database you were protecting."],
          ["Naive", "Consistent hashing with one ring point per node, LRU on each node", "Membership churn is now cheap, but with 16 random points the key distribution skews badly — commonly tens of percent above and below the mean — and losing a node dumps its entire share onto exactly one neighbour."],
          ["Solid", "Consistent hashing with 100–200 virtual nodes per physical node, LRU with per-key TTL", "Load lands within a few percent of the mean, a membership change moves about 1/N of keys, and the transfer is spread across all survivors. Good enough for most systems."],
          ["Standout", "The same, plus bounded-load placement (cap any node at ~1.25x the mean and spill clockwise), a frequency-aware admission policy such as W-TinyLFU instead of naive LRU, hot-key replication to k nodes, and single-flight on miss", "Now the cluster resists both structural skew and popularity skew, a scan-heavy workload cannot evict the genuinely hot set, and node loss cannot stampede the origin. Each addition answers a specific failure you can name."]
        ]
      },
      { t: "note", variant: "tip", html: "Naive LRU has a specific, nameable weakness: <strong>a single large scan evicts your entire working set</strong>, because every scanned key looks recent. Frequency-aware admission fixes exactly that by refusing to admit a key that has not been seen often enough to displace what is already resident." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Eviction policies, and when each one is actually right" },
      { t: "table",
        headers: ["Policy", "Best for", "Fails on"],
        rows: [
          ["TTL only", "Data with a natural freshness bound, like a rendered page", "Memory pressure — nothing is evicted early, so the node OOMs or refuses writes."],
          ["LRU", "Workloads with strong temporal locality", "Large sequential scans, which flush the hot set."],
          ["LFU", "Stable popularity distributions", "Shifting popularity — yesterday's hit stays resident forever unless counters decay."],
          ["W-TinyLFU", "Mixed traffic with both a hot core and scan noise", "Slightly more per-key state and a sketch to maintain; usually worth it."],
          ["Random", "When you want predictable eviction cost and can tolerate the hit-ratio loss", "Anything where the hit ratio is the point."]
        ]
      },
      { t: "h2", text: "The hot key" },
      { t: "p", html: "One key at 50,000 reads per second puts 200 MB/s on one NIC while fifteen other nodes idle. Sharding does not help, because the unit of placement is the key. Three fixes, in the order you should reach for them: a <strong>near cache</strong> in the application process with a one-second TTL, which converts almost all of that traffic into local memory reads at the cost of one second of staleness; <strong>key splitting</strong>, where you write the value under <code class='tok'>k#0</code> through <code class='tok'>k#7</code> and each client reads a randomly chosen suffix, spreading one key across eight nodes at the cost of eight times the memory and a fan-out on invalidation; and <strong>read replicas for hot ranges</strong>, which is the same idea with the fan-out managed by the cluster instead of the caller." },
      { t: "h2", text: "Write policy and invalidation" },
      { t: "p", html: "Write-through keeps the cache warm and adds latency to every write. Write-around keeps writes fast and guarantees a miss on the next read of that key. Write-back is fast and can lose data, which is fine for a counter and catastrophic for anything else — remember you declared this a cache, so write-back needs a very good reason. For invalidation, prefer <em>delete</em> over <em>update</em>: a delete is idempotent and order-independent, whereas two concurrent updates can leave the cache holding the older value forever. The same reasoning about coordination cost shows up in the <a href=\"#/breakdowns/scale/rate-limiter\">rate limiter</a>, where the shared counter is the thing you are trying not to consult." },

      { t: "h", text: "8 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "Consistent hashing with virtual nodes, TTL plus LRU, correct node-count and bandwidth arithmetic.", "Reaches for modulo hashing, or cannot say what happens when a node dies."],
          ["Senior", "Load skew and the bounded-load fix, an eviction policy chosen against the workload, single-flight on miss, and a concrete hot-key mitigation.", "Treats eviction as an implementation detail and never mentions the scan-flush problem."],
          ["Staff", "Frames it as a control-plane / data-plane split, quantifies the miss-storm blast radius on the origin, and states the staleness the near cache buys and who has to accept it.", "Adds mechanisms without pricing them — a near cache is a correctness decision, not a free optimisation."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>Two skews, two fixes.</strong> Structural skew (uneven key ranges) is solved by virtual nodes plus a bounded-load cap. Popularity skew (one hot key) is solved by replication or a near cache — never by more shards. Saying which skew you are treating is what separates a memorised answer from a reasoned one." }
    ]
  });

  /* ---------------------------------------------------------------
     3 · RATE LIMITER
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "rate-limiter",
    title: "Design a distributed rate limiter",
    summary: "Five algorithms, one honest comparison. The fixed-window boundary burst, the memory cost of exactness, and how to avoid a round trip per request.",
    minutes: 12,
    tags: ["breakdown", "rate-limiting", "algorithms", "edge"],
    blocks: [
      { t: "p", html: "The prompt: protect an API from abuse and accidental overload by capping how many requests each client may make. It is deceptively small. The algorithm choice is a real trade-off between accuracy and memory, and the distributed part is a trade-off between accuracy and latency — and interviewers know exactly which claims candidates get wrong." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>What are we limiting on?</strong> — Assume API key, with a fallback to source IP for unauthenticated calls. Ask, because IP-only limiting punishes everyone behind one corporate NAT.",
        "<strong>One global limit or per endpoint?</strong> — Assume a default per client plus overrides for expensive endpoints. A search query and a health check should not share a budget.",
        "<strong>Reject or queue?</strong> — Assume reject with <code class='tok'>429</code> and a <code class='tok'>Retry-After</code> header. Queueing turns a rate limiter into a shaper and changes the design.",
        "<strong>How accurate must it be?</strong> — Assume approximate is fine for the general limit and exact is required for a small set of expensive or abuse-prone endpoints. This is the question that unlocks the whole design.",
        "<strong>What happens if the counter store is unavailable?</strong> — Assume fail open with a conservative local cap. Say it out loud; a limiter that takes the API down with it has inverted its own purpose."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Enforce a per-client request budget over a rolling time window.",
        "Enforce it consistently across every edge node, not per instance.",
        "Return <code class='tok'>429</code> with <code class='tok'>Retry-After</code> and remaining-quota headers on rejection.",
        "Support per-endpoint and per-plan overrides.",
        "Degrade safely when the shared counter store is slow or unreachable."
      ] },
      { t: "ul", items: [
        "<strong>Added latency</strong> — under about 1 ms at p99 on the request path. A limiter that costs 10 ms has become the bottleneck it was meant to prevent.",
        "<strong>Accuracy</strong> — within a few percent of the nominal limit for the general case; exact for the flagged endpoints.",
        "<strong>Throughput</strong> — 200,000 requests per second across the edge.",
        "<strong>Memory</strong> — bounded and predictable per client, and stated explicitly per algorithm.",
        "<strong>Availability</strong> — the limiter must never be a hard dependency of the API path."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  edge request rate            200,000 / s\n" +
        "  distinct API clients       5,000,000\n" +
        "  default limit              1,000 requests / 60 s / client\n" +
        "  edge nodes                        40\n\n" +
        "NAIVE: ONE SHARED-COUNTER ROUND TRIP PER REQUEST\n" +
        "  counter store ops / s                  =  200,000 / s\n" +
        "  a single node does roughly 100,000 ops/s, so this needs sharding\n" +
        "  AND every request now carries a network hop it did not have before\n\n" +
        "STATE PER CLIENT, BY ALGORITHM\n" +
        "  fixed window            counter + window id        ~16 B\n" +
        "  sliding window counter  2 counters + window id     ~24 B\n" +
        "  token bucket            level + last-refill time   ~16 B\n" +
        "  leaky bucket            queue depth + last drain   ~16 B + queued work\n" +
        "  sliding window log      up to 1,000 * 8 B          ~8 KB\n\n" +
        "  all 5M clients, counter form  = 5e6 * 24 B         =  120 MB\n" +
        "  500k active clients, log form = 5e5 * 8 KB         =  4 GB   (33x)\n\n" +
        "LOCAL ENFORCEMENT WITH ASYNCHRONOUS SYNC\n" +
        "  each node enforces against a local lease and flushes deltas\n" +
        "  every 200 ms:\n" +
        "  store ops / s = 40 nodes * 5 flushes/s             =  200 / s\n" +
        "  that is 1,000x fewer operations than the naive path\n" +
        "  the price: up to (40 nodes * local lease) of overshoot per interval"
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ENTITIES\n" +
        "  Policy(policy_id, scope: client|plan|endpoint, limit, window_s,\n" +
        "         burst, algorithm)\n" +
        "  Bucket(key = client_id + ':' + policy_id, state)\n" +
        "         state shape depends on the algorithm (see above)\n\n" +
        "DECISION CALL (in-process, then a shared store behind it)\n" +
        "  allow(key, policy, now) -> { allowed: bool, remaining: int,\n" +
        "                               reset_after_s: int }\n\n" +
        "RESPONSE CONTRACT ON REJECTION\n" +
        "  429 Too Many Requests\n" +
        "  Retry-After: 12\n" +
        "  X-RateLimit-Limit: 1000\n" +
        "  X-RateLimit-Remaining: 0\n" +
        "  X-RateLimit-Reset: 1712361600\n\n" +
        "ATOMICITY\n" +
        "  the read-modify-write must be one atomic operation in the store\n" +
        "  (a server-side script, or INCR + EXPIRE issued together), or two\n" +
        "  concurrent requests will both read the same pre-increment count"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  client --> [ edge node 1 ] --+\n" +
        "  client --> [ edge node 2 ] --+--> local buckets (in memory)\n" +
        "     ...          ...          |    decide in microseconds\n" +
        "  client --> [ edge node 40] --+\n" +
        "                                     | async delta flush, 200 ms\n" +
        "                                     v\n" +
        "                        [ sharded counter store ]\n" +
        "                          key = client:policy, sharded by client\n" +
        "                                     |\n" +
        "                                     v\n" +
        "                        [ policy service ] --> pushed to edge,\n" +
        "                          cached locally, never on the hot path\n\n" +
        "  flagged expensive endpoints bypass the local path and take one\n" +
        "  atomic round trip to the store for an exact sliding-window answer"
      },
      { t: "p", html: "The structure is deliberate. <strong>The decision is local</strong>, so the common case costs a hash lookup and some arithmetic. <strong>The shared store is a convergence mechanism, not an oracle</strong>, consulted asynchronously in batches. <strong>Policy is pushed, never pulled</strong>, so a policy service outage cannot stall the edge. And <strong>exactness is opt-in</strong> for the handful of endpoints where over-admitting actually costs money." },

      { t: "h", text: "6 · The one hard part: an accurate shared counter without a round trip per request" },
      { t: "p", html: "Every request wants to consult a single authoritative number, and that number lives on another machine. You cannot have exact global accounting and zero added latency at 200,000 requests per second — so the design is about choosing which inaccuracy you can defend." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Per-instance in-memory fixed-window counters, no coordination", "With 40 nodes the effective limit is 40x the intended one, the fixed-window boundary flaw doubles that again, and every deploy silently resets everyone's budget."],
          ["Naive", "A shared fixed-window counter with <code class='tok'>INCR</code> plus <code class='tok'>EXPIRE</code> on every request", "Now consistent across nodes, but it adds a network round trip to 200,000 requests per second and still permits twice the limit across a window boundary."],
          ["Solid", "A shared sliding-window counter updated by one atomic server-side script per request", "One round trip, constant memory per client, no boundary doubling and error within a few percent. Correct and simple; the round trip is the remaining cost."],
          ["Standout", "Local token buckets at each edge node enforced against a lease acquired from the shared store and refreshed asynchronously, with an exact sliding-window log reserved for flagged expensive endpoints, fail-open to a conservative local cap on store failure, and a full <code class='tok'>429</code> header contract", "Common-path latency is microseconds, store load drops by three orders of magnitude, the overshoot is bounded and quantifiable, and the endpoints where exactness pays for itself still get it."]
        ]
      },

      { t: "h", text: "7 · The five algorithms, precisely" },
      { t: "table",
        headers: ["Algorithm", "How it decides", "Accuracy", "State per active client", "Real weakness"],
        rows: [
          ["Fixed window", "One counter per aligned window; reset at the boundary", "Bounds the count per <em>aligned</em> window only", "~16 B", "Permits up to 2x the limit across a boundary."],
          ["Sliding window log", "Store a timestamp per allowed request; count those newer than <code class='tok'>now - window</code>", "Exact for any rolling window", "8 B x limit (~8 KB at a 1,000 limit)", "Memory grows with the limit; pruning costs work on every call."],
          ["Sliding window counter", "Current window count plus the previous window's count weighted by overlap", "Approximate; assumes even spread in the previous window", "~24 B", "Slightly generous or strict on spiky traffic; no exactness guarantee."],
          ["Token bucket", "Tokens refill at a fixed rate up to a capacity; a request spends one", "Bounds the long-run rate; permits a burst up to the capacity", "~16 B", "The burst allowance is exactly what an attacker uses."],
          ["Leaky bucket (queue)", "Requests enter a bounded queue drained at a fixed rate; overflow is dropped", "Bounds the long-run rate <em>and</em> the instantaneous output rate", "~16 B plus the queued requests", "Adds queueing latency, and drops legitimate bursts once the queue is full."]
        ]
      },
      { t: "note", variant: "trap", html: "The two claims most often stated wrongly. <strong>One:</strong> a fixed window with limit L does not guarantee L requests per any 60 seconds — it guarantees L per <em>aligned</em> 60 seconds, and a client can land L at the end of one window and L at the start of the next, so up to <strong>2L</strong> inside an arbitrarily short span. <strong>Two:</strong> the token bucket permits bursts up to the bucket size at its output; the leaky-bucket queue does not permit bursts at all, because it drains at a constant rate. Both bound the long-run rate identically. If you only remember one distinction, remember that the token bucket <em>allows</em> burstiness and the leaky bucket <em>removes</em> it." },
      { t: "widget", id: "bdRateLab" },
      { t: "p", html: "Play with the boundary-spike shape on the fixed window and read the worst-burst figure, then switch to the sliding log and watch the same trace get correctly clipped — and the per-client memory jump by two orders of magnitude. That trade is the entire lesson." },

      { t: "h", text: "8 · Deep dives" },
      { t: "h2", text: "What to key on" },
      { t: "p", html: "API key is the right default because it identifies a paying entity you can talk to. Falling back to IP is necessary for unauthenticated traffic and comes with two real problems: an office or mobile carrier behind one NAT shares a budget among thousands of people, and IPv6 hands an attacker an effectively unlimited supply of addresses — so limit IPv6 on a prefix such as /64, not the full address. Compose keys as <code class='tok'>(principal, policy)</code> so a per-endpoint override is a different bucket rather than a special case in the code." },
      { t: "h2", text: "Fail open or fail closed" },
      { t: "p", html: "When the counter store is unreachable, failing closed rejects everything and turns a limiter outage into an API outage. Failing open admits everything and removes your protection at precisely the moment an overload might be causing the store problem. The defensible middle is to fail open <em>to a local cap</em>: each node keeps enforcing a conservative in-memory limit derived from the last known policy, so you lose global accuracy but keep a ceiling. State which way you chose and why — an interviewer is testing whether you noticed there was a choice." },
      { t: "h2", text: "The response contract, and why it matters more than it looks" },
      { t: "p", html: "A bare <code class='tok'>429</code> teaches the client nothing, so it retries immediately and every rejected client retries in lockstep — you have built a synchronised load generator. Return <code class='tok'>Retry-After</code>, publish remaining quota on successful responses so a well-behaved client can self-pace, and document that clients must add jitter to their backoff. The same synchronisation hazard drives the reconnect design in <a href=\"#/breakdowns/scale/live-comments\">live comments</a> and the per-user caps in the <a href=\"#/breakdowns/scale/notification-system\">notification system</a>." },

      { t: "h", text: "9 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "Names the algorithms, picks one, and explains the fixed-window boundary flaw correctly. Atomic increment in a shared store.", "Describes a fixed window as if it bounded any rolling window, or forgets that the read-modify-write must be atomic."],
          ["Senior", "Compares memory against accuracy with numbers, avoids a round trip per request with local enforcement plus async sync, and specifies the failure mode of the store.", "Adds a shared counter to the hot path without ever costing the latency it introduces."],
          ["Staff", "Treats accuracy as a per-endpoint product decision, quantifies the overshoot the distributed design permits, and designs the client contract so rejection does not create a retry storm.", "Optimises the algorithm and ignores that 40 nodes with independent buckets multiply the limit by 40."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>Fixed window is cheap and permits 2L across a boundary. The log is exact and costs 8 B per request in the window. The sliding counter is the pragmatic default. Token bucket allows bursts; leaky bucket removes them.</strong> Then the distributed question, which is separate: enforce locally, converge asynchronously, and be explicit about how much overshoot that buys you." }
    ]
  });

  /* ---------------------------------------------------------------
     4 · ONLINE AUCTION
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "online-auction",
    title: "Design a live online auction",
    summary: "eBay's endgame. Ordering bids under contention, closing exactly once, and pushing price changes to thirty thousand watchers.",
    minutes: 11,
    tags: ["breakdown", "concurrency", "real-time", "consistency"],
    blocks: [
      { t: "p", html: "The prompt: users list items with a deadline, other users bid, the highest bid at the deadline wins. Almost all of the difficulty is compressed into the final thirty seconds of a popular auction, where contention on a single row, a hard deadline and a live audience all arrive at once." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>English auction, or something else?</strong> — Assume ascending open-outcry with a visible current price. Sealed-bid or Dutch auctions have completely different consistency needs.",
        "<strong>Is a rejected bid an error or a re-quote?</strong> — Assume a re-quote: the client is told the new price and may bid again. This turns a hard concurrency problem into a retry loop.",
        "<strong>Automatic proxy bidding?</strong> — Assume yes. It matters enormously: storing a maximum and resolving server-side collapses a burst of manual bids into a few writes.",
        "<strong>Is the deadline hard?</strong> — Assume soft: any bid in the final two minutes extends the deadline by two minutes. Ask about this, because it removes the worst thundering herd in the system.",
        "<strong>Do watchers need every price, or the latest price?</strong> — Assume the latest. That single answer licenses coalescing and cuts fan-out by an order of magnitude."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "List an item with a starting price, reserve and deadline.",
        "Accept a bid, or reject it with the current price if it has been outbid.",
        "Show the current price and bid count to watchers in near real time.",
        "Close the auction at the deadline and declare exactly one winner.",
        "Show a complete, auditable bid history per auction."
      ] },
      { t: "ul", items: [
        "<strong>Correctness</strong> — one winner per auction, ever. Bids on one item are totally ordered and that order is auditable.",
        "<strong>Bid acknowledgement</strong> — p99 under 300 ms, because a bidder in the endgame is watching a clock.",
        "<strong>Price propagation</strong> — watchers see a price change within about 1 second.",
        "<strong>Close accuracy</strong> — the auction transitions to closed within a couple of seconds of the deadline, and does so exactly once.",
        "<strong>Durability</strong> — a bid that was acknowledged is never lost, including through a failover."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  live listings                5,000,000\n" +
        "  bids / day                  20,000,000\n" +
        "  concurrent watchers          2,000,000\n" +
        "  watchers on one hot auction     30,000\n" +
        "  price update message             120 B\n\n" +
        "WRITE VOLUME\n" +
        "  average bids / s = 20e6 / 86,400          =  ~230 / s\n" +
        "  peak (x20, endgame clustering)            =  ~4,600 / s\n" +
        "  system-wide this is trivial; the constraint is PER ITEM:\n" +
        "  one hot auction can take ~50 bids / s and every one of them\n" +
        "  must be serialised against the same current price\n\n" +
        "FAN-OUT, ONE HOT AUCTION\n" +
        "  naive: 50 updates/s * 30,000 watchers     =  1,500,000 msg / s\n" +
        "  coalesced to 4 updates/s: 4 * 30,000      =    120,000 msg / s\n" +
        "  at 120 B/msg = 120,000 * 120              =  14.4 MB/s = 115 Mbps\n" +
        "  a 12x reduction for one second of price staleness\n\n" +
        "STORAGE\n" +
        "  bids      20e6/day * 200 B                =  4 GB/day -> ~1.5 TB/yr\n" +
        "  listings  5e6 * 2 KB                      =  10 GB hot set"
      },
      { t: "note", variant: "tip", html: "Read the arithmetic again: 230 bids per second across the whole platform is nothing, and 50 bids per second on one row is everything. <strong>When average load is trivial and the design is still hard, the constraint is contention, not throughput</strong> — say that sentence and you have identified the problem correctly." },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ENTITIES\n" +
        "  Auction(auction_id, seller_id, item_id, start_price, reserve,\n" +
        "          ends_at, status: open|closing|closed, current_price,\n" +
        "          high_bidder_id, version)\n" +
        "  Bid(auction_id, seq, bidder_id, amount, max_amount, created_at)\n" +
        "      partition key auction_id, clustering key seq  <- the ledger\n" +
        "  Watch(auction_id, user_id)\n" +
        "  Outcome(auction_id, winner_id, final_price, closed_at)\n" +
        "      primary key auction_id  <- closing exactly once lives here\n\n" +
        "API\n" +
        "  POST /auctions                        -> { auction_id }\n" +
        "  POST /auctions/{id}/bids  { amount, max_amount?, based_on_version }\n" +
        "       -> 201 { accepted, new_price, your_version }\n" +
        "       -> 409 { outbid, current_price, current_version }\n" +
        "  GET  /auctions/{id}                   -> price, ends_at, version\n" +
        "  GET  /auctions/{id}/bids?cursor=      -> the ledger\n" +
        "  WS   /auctions/{id}/stream            -> coalesced price frames"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  bidder --> [ bid API ] --conditional write--> Auction row\n" +
        "                  |            (price, version)\n" +
        "                  |  on success: append to per-auction bid ledger\n" +
        "                  v\n" +
        "        [ auction event log, partitioned by auction_id ]\n" +
        "                  |                       |\n" +
        "                  v                       v\n" +
        "        [ price coalescer ]      [ ledger / analytics / fraud ]\n" +
        "          max 4 frames/s per auction\n" +
        "                  v\n" +
        "        [ pub/sub topic per auction ]\n" +
        "                  v\n" +
        "        [ connection tier ] --> 30,000 websockets for the hot one\n\n" +
        "  [ closing scheduler ] --at ends_at--> conditional transition\n" +
        "        UPDATE auction SET status='closed' WHERE status='open'\n" +
        "        -> exactly one caller sees rows_affected = 1\n" +
        "        -> that caller writes Outcome and emits auction.closed"
      },
      { t: "p", html: "Three load-bearing pieces. <strong>The conditional write on the auction row is the arbiter</strong> — no lock, no coordinator, one winner per attempt. <strong>The per-auction ledger is append-only</strong>, which makes the bid order auditable and lets you recompute the winner if anything downstream is ever doubted. <strong>The coalescer stands between the write rate and the fan-out rate</strong>, and is the only reason 30,000 watchers is affordable." },

      { t: "h", text: "6 · The one hard part: ordering bids under contention and closing exactly once" },
      { t: "p", html: "Two bids arriving in the same millisecond must produce one winner and one clear rejection, and the auction must transition to closed once even if two schedulers wake up for it. Both are the same problem — a single-writer decision on shared state — and both are solved by making the database the arbiter rather than coordinating in the application." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Read the current price, compare in the application, write the new price", "The classic lost update. Two bids read 100, both decide 110 is valid, both write, and two people were told they were winning."],
          ["Naive", "Take a distributed lock per auction and hold it across the write", "Correct while everything is healthy, but the hot auction now serialises on a lock with no fencing token, and a garbage-collection pause on the lock holder either stalls the endgame or lets a second holder in behind it."],
          ["Solid", "A conditional write: <code class='tok'>UPDATE ... SET price = :bid WHERE auction_id = :id AND version = :v AND current_price &lt; :bid</code>. Zero rows affected means outbid, and the client retries against the returned price.", "One winner per attempt, no lock, no coordinator, and the failure mode is a re-quote the user understands. This is the answer most interviews want."],
          ["Standout", "The same, plus: every bid appended to an immutable per-auction ledger so the order is auditable and the winner is derivable; closing as a single conditional state transition (<code class='tok'>open -> closed</code>) that exactly one caller can win, making duplicate scheduler fires harmless; a two-minute anti-snipe extension so the deadline is never a synchronised herd; and proxy bidding resolved server-side so a bidding war costs a handful of writes rather than hundreds", "Correctness, auditability, idempotent closing and load shaping, each traced to a specific failure you can name out loud."]
        ]
      },
      { t: "note", variant: "tip", html: "Closing is the same primitive as bidding. <strong>A conditional state transition that exactly one caller can win turns 'exactly once' from a distributed-systems problem into a single-row database guarantee.</strong> Duplicate scheduler fires stop being a bug and become a no-op." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Real-time price updates to thirty thousand watchers" },
      { t: "p", html: "Send state, not deltas: each frame carries <code class='tok'>{ price, high_bidder, version, ends_at }</code>, so a client that missed a frame is corrected by the next one and you never need a replay protocol. Coalesce to a fixed maximum frame rate per auction — the watcher cannot perceive more than a few updates a second and the product only promised the latest price. Fan out through one pub/sub topic per auction so each connection node subscribes once and delivers locally. The full version of that fan-out problem is in <a href=\"#/breakdowns/scale/live-comments\">live comments</a>." },
      { t: "h2", text: "Proxy bidding, which is a load-shedding mechanism in disguise" },
      { t: "p", html: "When a bidder submits a maximum rather than a price, the server raises their bid automatically only as far as needed to stay ahead. A war between two proxy bidders resolves in a single server-side computation instead of dozens of round trips. It improves the user experience and, not coincidentally, removes most of the write contention you were about to design around — which is worth saying out loud, because recognising that a product feature solves an infrastructure problem is exactly the judgement being assessed." },
      { t: "h2", text: "What happens if the scheduler is late" },
      { t: "p", html: "If the closing job fires ten seconds late, bids arriving in those ten seconds were accepted against an auction the users believed was open. Decide the policy explicitly: either the deadline is authoritative and the bid API itself rejects anything with <code class='tok'>now &gt; ends_at</code> regardless of status, or the close time is authoritative and late bids count. The first is almost always right, and it means the scheduler only has to be roughly on time. The general version of that reasoning lives in the <a href=\"#/breakdowns/scale/job-scheduler\">job scheduler</a>." },

      { t: "h", text: "8 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "Recognises the lost-update hazard and reaches for a conditional write or a transaction. Has a websocket tier for price updates.", "Read-then-write, or a distributed lock proposed with no discussion of what happens when the holder pauses."],
          ["Senior", "Append-only bid ledger, idempotent close via a conditional transition, and coalesced fan-out with a stated staleness budget.", "Solves bidding correctly and leaves closing as 'a cron job fires at the deadline' with no duplicate-fire story."],
          ["Staff", "Identifies contention rather than throughput as the constraint from the arithmetic, uses anti-snipe and proxy bidding as deliberate load shaping, and states the deadline-authority policy.", "Designs for peak aggregate QPS and never notices that a single row is the bottleneck."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>One row, one arbiter.</strong> A conditional write on (price, version) orders bids without a lock; the same conditional-transition trick on <code class='tok'>status</code> closes the auction exactly once. Everything else — the ledger, the coalescer, the anti-snipe window — exists to make those two writes cheap and auditable." }
    ]
  });

  /* ---------------------------------------------------------------
     5 · YOUTUBE
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "youtube",
    title: "Design video upload, transcode and streaming",
    summary: "YouTube. A transcode pipeline as a fan-out of independent jobs, adaptive bitrate at the client, and the CDN bill that shapes the whole architecture.",
    minutes: 12,
    tags: ["breakdown", "media", "pipeline", "cdn"],
    blocks: [
      { t: "p", html: "The prompt: users upload video of arbitrary length and quality, and anyone in the world can watch it smoothly on a phone with a bad connection. The interesting parts are a batch pipeline that has to be embarrassingly parallel, a delivery format that lets the client adapt, and an egress bill that dwarfs every other cost in the system." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>On-demand or live?</strong> — Assume on-demand. Live streaming shares the delivery stack but replaces the whole pipeline with a latency budget.",
        "<strong>How fast must a video become watchable?</strong> — Assume a few minutes for a standard-definition rung, with higher rungs arriving later. This licenses a prioritised ladder rather than an all-or-nothing publish.",
        "<strong>Do we own the CDN?</strong> — Assume a commercial CDN for the first pass, and mention that at this volume you would eventually place your own caches inside ISP networks.",
        "<strong>Are recommendations and search in scope?</strong> — Assume out of scope, and say so early so you spend the time on the pipeline.",
        "<strong>Do we retain the original?</strong> — Assume yes, in cold storage, because re-encoding to a future codec is otherwise impossible."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Upload a video file of arbitrary size, resumably, over a flaky connection.",
        "Transcode it into a ladder of resolutions and bitrates and package it for adaptive streaming.",
        "Publish it and serve playback worldwide with fast startup and no rebuffering.",
        "Let the player switch quality mid-stream as bandwidth changes.",
        "Report processing progress to the uploader and surface failures clearly."
      ] },
      { t: "ul", items: [
        "<strong>Startup latency</strong> — first frame within about 1 second on a warm cache.",
        "<strong>Rebuffer ratio</strong> — under 0.5% of playback time. This is the metric the business actually watches.",
        "<strong>Time to watchable</strong> — a standard-definition rung available within a few minutes of upload for a typical video.",
        "<strong>Durability</strong> — the original master survives eleven-nines-class object storage; renditions are regenerable.",
        "<strong>Cost</strong> — egress per watch-hour is a first-class design constraint, not an afterthought."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  upload rate           100 hours of video per minute\n" +
        "  average video length   10 min\n" +
        "  source bitrate         10 Mbps (1080p)\n" +
        "  views / day         1,000,000,000\n" +
        "  average watch / view    5 min\n" +
        "  average delivered       2 Mbps\n\n" +
        "INGEST\n" +
        "  hours / day   = 100 * 1,440              =  144,000 h\n" +
        "  videos / day  = 144,000 * 6              =  864,000\n" +
        "  uploads / s   = 864,000 / 86,400         =  10 / s\n" +
        "  1 hour at 10 Mbps = 10 * 3,600 / 8 / 1000 =  4.5 GB\n" +
        "  source / day  = 144,000 * 4.5 GB         =  648 TB / day\n\n" +
        "TRANSCODE\n" +
        "  ladder  240p 0.4 + 360p 0.7 + 480p 1.2\n" +
        "        + 720p 2.5 + 1080p 4.5             =  9.3 Mbps total\n" +
        "  1 hour of ladder = 9.3 * 3,600 / 8 / 1000 =  ~4.2 GB\n" +
        "  renditions / day = 144,000 * 4.2 GB      =  ~605 TB / day\n" +
        "  stored / day = 648 + 605                 =  ~1.25 PB / day\n" +
        "  per year     = 1.25 * 365                =  ~450 PB / yr\n\n" +
        "  work = 5 rungs * 144,000 h               =  720,000 rendition-hours\n" +
        "  at ~1x realtime per core: 720,000 / 24   =  30,000 cores, always on\n" +
        "  a 10-min video chunked at 10 s = 60 chunks * 5 rungs = 300 jobs\n\n" +
        "DELIVERY\n" +
        "  watch-hours / day = 1e9 * 5/60           =  ~83,000,000 h\n" +
        "  1 hour at 2 Mbps                         =  0.9 GB\n" +
        "  egress / day = 83e6 * 0.9 GB             =  ~75 PB / day\n" +
        "  average rate = 75e15 B / 86,400          =  ~870 GB/s = ~7 Tbps\n" +
        "  read : write = 75 PB : 648 TB            =  ~115 : 1\n\n" +
        "COST\n" +
        "  at $0.005 per GB of CDN egress:\n" +
        "  75,000,000 GB * $0.005                   =  $375,000 / day\n" +
        "  that single line is why you eventually build your own edge"
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ENTITIES\n" +
        "  Video(video_id, owner_id, title, duration_s, status, created_at)\n" +
        "        status: uploading|probing|transcoding|partial|ready|failed\n" +
        "  Master(video_id, object_uri, codec, bitrate, checksum)\n" +
        "  Rendition(video_id, rung, object_prefix, bitrate, state)\n" +
        "  Chunk(video_id, rung, chunk_index, state, attempt, worker_id)\n" +
        "        primary key (video_id, rung, chunk_index)  <- idempotency\n" +
        "  Manifest(video_id, format: hls|dash, object_uri)\n\n" +
        "API\n" +
        "  POST /uploads                -> { upload_id, presigned_part_urls }\n" +
        "  PUT  <presigned url>            client writes bytes to storage direct\n" +
        "  POST /uploads/{id}/complete  -> { video_id }, starts the pipeline\n" +
        "  GET  /videos/{id}/status     -> per-rung progress\n" +
        "  GET  /videos/{id}/manifest   -> HLS/DASH manifest (CDN-cached)\n" +
        "  GET  <cdn>/{video}/{rung}/{chunk}.m4s     the actual bytes\n\n" +
        "NOTE: the API never proxies video bytes. Uploads go straight to\n" +
        "object storage with a pre-signed URL; playback goes straight to\n" +
        "the CDN. The API only ever moves metadata."
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  uploader --presigned PUT--> [ object storage: master ]\n" +
        "                                      |\n" +
        "                              complete -> enqueue\n" +
        "                                      v\n" +
        "                            [ probe: codec, duration, keyframes ]\n" +
        "                                      v\n" +
        "                            [ segment at GOP boundaries ]\n" +
        "                                      v\n" +
        "        +----------- fan out: chunk x rung = N jobs -----------+\n" +
        "        v            v            v            v               v\n" +
        "   [worker]     [worker]     [worker]     [worker]  ...   [worker]\n" +
        "        |            |            |            |               |\n" +
        "        +------------+------ chunk written ----+---------------+\n" +
        "                                      v\n" +
        "                            [ package: HLS + DASH manifests ]\n" +
        "                                      v\n" +
        "                     publish rung -> [ origin ] -> [ CDN edge ]\n" +
        "                                                        |\n" +
        "                                                     viewer\n\n" +
        "  360p rung is prioritised and published first: watchable in minutes"
      },
      { t: "p", html: "The load-bearing decisions: <strong>bytes never touch the API tier</strong>, which is what makes 10 uploads a second and 7 Tbps of egress coexist in one design; <strong>the pipeline is a directed graph of idempotent stages</strong> keyed on <code class='tok'>(video, rung, chunk)</code>, so any stage can be retried; and <strong>publish is incremental</strong>, so a rung goes live the moment it is complete rather than waiting for 1080p." },

      { t: "h", text: "6 · The one hard part: turning one long job into hundreds of independent ones" },
      { t: "p", html: "Transcoding a two-hour video into five rungs is, naively, a single computation that occupies one machine for hours and loses everything if that machine dies. The fix is to find a unit of work that can be produced independently and stitched back together losslessly — and in video, that unit already exists, because encoders emit self-contained groups of pictures starting at keyframes." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Transcode all rungs synchronously inside the upload request", "The uploader's HTTP connection is held open for hours, any network blip loses all the work, and your API tier is now a CPU farm."],
          ["Naive", "Transcode whole files per rung on an async worker pool", "The upload path is fixed, but a two-hour video pins one worker for hours, a crash restarts from zero, and latency is bounded by the longest single video rather than by your fleet size."],
          ["Solid", "Segment at keyframe-aligned boundaries into roughly 6–10 second chunks, enqueue chunk x rung as independent jobs, stitch and package on completion", "Parallelism is bounded by chunk count rather than by worker count, so a long video finishes in roughly the time of one chunk. A failure costs one chunk. This is the answer the question is looking for."],
          ["Standout", "The same, expressed as a per-upload DAG (probe -> segment -> fan-out transcode -> package -> thumbnails, captions, content matching -> publish) with an idempotency key per stage output; the 360p rung prioritised so the video is watchable in minutes; non-urgent rungs run on preemptible capacity; and rungs for the long tail generated lazily on first request rather than eagerly for videos nobody watches", "Every addition is a cost or latency decision with a number behind it, and the lazy-rung idea alone removes a large fraction of the 30,000-core estimate."]
        ]
      },
      { t: "note", variant: "trap", html: "Chunk boundaries must align to keyframes. If you cut mid-GOP, the decoder cannot start at the chunk boundary, the encoder cannot encode it independently, and the stitched output has visible artefacts at every seam. This is why the pipeline probes first and segments second — <strong>the chunk size is a target, not a rule</strong>." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Adaptive bitrate, and why the client decides" },
      { t: "p", html: "The manifest lists every rung with its bitrate and the URLs of its segments. The player measures its own throughput and buffer level and picks the next segment's rung accordingly, so quality can change every few seconds without a new connection. The client decides because only the client knows its buffer occupancy, its screen size and whether the user just walked into a lift — the server sees an average that is already stale. Startup is the special case: begin at a conservative rung to get a frame on screen fast, then ramp once the buffer is healthy, because a fast start with one quality step up beats a slow start at the right quality." },
      { t: "h2", text: "CDN economics" },
      { t: "p", html: "Video view counts follow a steep long tail: a small fraction of videos generate most of the views, which is what makes caching viable at all. Three levers move the bill. <strong>Cache hit ratio</strong> — a tiered CDN with regional mid-tier caches shields the origin so an unpopular video still costs only one origin fetch per region rather than one per edge. <strong>Peering</strong> — putting caches inside ISP networks converts paid transit into settlement-free delivery, which is the single largest saving available at this scale. <strong>Codec efficiency</strong> — a newer codec that cuts bitrate by 30% cuts the entire egress line by 30%, which against $375,000 a day pays for a great deal of extra encoding compute." },
      { t: "h2", text: "The upload path" },
      { t: "p", html: "Resumable, chunked uploads directly to object storage with a pre-signed URL: the client splits the file into parts, uploads them independently, retries only the failed parts and finalises with a single call. The API never sees a video byte, which means the API tier scales with metadata operations rather than with terabytes. Deduplicate on a content hash so a re-upload of the same file skips the pipeline entirely — a surprisingly large win, and one that also gives content matching a hook. The chunk-and-retry structure here is the same one used by the <a href=\"#/breakdowns/scale/job-scheduler\">job scheduler</a> for idempotent work units." },

      { t: "h", text: "8 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "Async transcode off a queue, object storage for masters and renditions, a CDN in front, and a manifest-based player.", "Transcodes inside the request, or proxies video bytes through the API tier."],
          ["Senior", "Chunk-level fan-out with idempotent jobs, keyframe alignment, incremental publish per rung, and a correct account of how the player adapts.", "Chunks the video but never mentions keyframe alignment, or treats publish as all-or-nothing."],
          ["Staff", "Prices the egress and lets that price drive architecture (peering, codec choice, lazy rungs), and reasons about the cost of the tail versus the head of the popularity distribution.", "Designs a technically sound pipeline with no awareness that delivery, not compute, is where the money goes."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>Find the independent unit of work and the pipeline designs itself.</strong> Keyframe-aligned chunks make transcode embarrassingly parallel and retries cheap; adaptive bitrate moves the quality decision to the only party with the information; and egress cost, not CPU, is the number that should shape your architecture at this scale." }
    ]
  });

  /* ---------------------------------------------------------------
     6 · JOB SCHEDULER
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "job-scheduler",
    title: "Design a distributed job scheduler",
    summary: "Cron for a cluster. Firing each job once despite clock skew and dead workers, and deciding what 'catch up' means after an outage.",
    minutes: 11,
    tags: ["breakdown", "scheduling", "idempotency", "distributed"],
    blocks: [
      { t: "p", html: "The prompt: let services register work to run at a future time or on a recurring schedule, and run it reliably across a fleet where any machine can die at any moment and no two clocks agree exactly. The word 'exactly' in 'exactly once' is where every candidate either earns credit or loses it." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>How precise must firing be?</strong> — Assume within a few seconds for most jobs, with a smaller set needing sub-second. Precision is expensive and most callers do not need it.",
        "<strong>Exactly once, or at least once with idempotent handlers?</strong> — Assume at-least-once delivery with deduplication on a deterministic key. Ask this explicitly; the honest answer is the whole design.",
        "<strong>What happens after an outage?</strong> — Assume a per-job catch-up policy rather than one global rule. A billing job and a cache-warm job want opposite behaviour.",
        "<strong>Do jobs have dependencies?</strong> — Assume independent jobs. Workflow orchestration is a different system and saying so keeps the scope honest.",
        "<strong>Timezones?</strong> — Assume yes, stored per job. That drags in daylight saving, which is a real correctness issue rather than a detail."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Register a one-off job at a future timestamp, or a recurring job with a cron expression and timezone.",
        "Fire the job at approximately the right time by delivering an event to the owning service.",
        "Retry a job whose execution failed, with backoff and a maximum attempt count.",
        "Support cancel and reschedule before firing.",
        "Expose per-job execution history: when it fired, how long it took, and how it ended."
      ] },
      { t: "ul", items: [
        "<strong>Firing precision</strong> — within about 2 seconds of the scheduled time at p99, and say plainly that sub-100 ms is not on offer.",
        "<strong>Duplicate rate</strong> — duplicates are permitted at the delivery layer and must be zero at the effect layer.",
        "<strong>Durability</strong> — a registered job survives the loss of any single node; no job is silently dropped.",
        "<strong>Throughput</strong> — 580 fires per second at steady state, 83,000 per second in the top-of-hour minute.",
        "<strong>Availability</strong> — no single scheduler node whose loss stops all firing."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  registered jobs           100,000,000\n" +
        "  fires / day                50,000,000\n" +
        "  top-of-hour concentration  10% of the day in one minute\n" +
        "  due-index shards                  500\n\n" +
        "RATES\n" +
        "  average = 50e6 / 86,400                  =  ~580 / s\n" +
        "  peak minute = 5,000,000 / 60             =  ~83,000 / s\n" +
        "  per shard at peak = 83,000 / 500         =  ~167 / s\n" +
        "  (a shard owner comfortably claims 167 jobs in a one-second tick)\n\n" +
        "STORAGE\n" +
        "  job rows      100e6 * 500 B              =  50 GB\n" +
        "  run history   50e6/day * 300 B           =  15 GB/day -> ~5.5 TB/yr\n" +
        "  history is the thing that grows; give it a retention policy\n\n" +
        "DUE INDEX\n" +
        "  bucket jobs by due-second; a tick reads the bucket for the\n" +
        "  current second on each owned shard, so a scan never touches\n" +
        "  the 100M-row table\n\n" +
        "PRECISION FLOOR\n" +
        "  NTP typically holds servers within tens of milliseconds of one\n" +
        "  another, and queueing adds more. 'Fires at exactly T' is really\n" +
        "  'fires within roughly 100 ms of T, plus delivery time'. Promise\n" +
        "  the second number, not the first."
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ENTITIES\n" +
        "  Job(job_id, owner_service, payload_ref, schedule_kind: once|cron,\n" +
        "      cron_expr, timezone, next_fire_at, shard, state, catch_up_policy)\n" +
        "  DueBucket(shard, due_second, job_id)        the scan index\n" +
        "  Claim(shard, job_id, scheduled_for, worker_id, claim_expires_at)\n" +
        "  Run(job_id, scheduled_for, attempt, started_at, ended_at, result)\n" +
        "      primary key (job_id, scheduled_for)   <- the idempotency key\n" +
        "  ShardLease(shard, owner_id, fence_token, expires_at)\n\n" +
        "API\n" +
        "  POST   /jobs      { at | cron, timezone, target, payload,\n" +
        "                      catch_up: all|latest|skip, max_attempts }\n" +
        "  DELETE /jobs/{id}\n" +
        "  PATCH  /jobs/{id} { at | cron }\n" +
        "  GET    /jobs/{id}/runs?cursor=\n\n" +
        "FIRE EVENT DELIVERED TO THE OWNER\n" +
        "  { job_id, scheduled_for, attempt, idempotency_key }\n" +
        "  idempotency_key = job_id + ':' + scheduled_for\n" +
        "  deterministic, so every retry and every duplicate carries the\n" +
        "  same key and the handler can collapse them"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  caller --> [ registration API ] --> Job row + DueBucket entry\n" +
        "                                            |\n" +
        "  [ lease manager ] assigns 500 shards to N scheduler nodes\n" +
        "        each lease carries a monotonically increasing fence token\n" +
        "                                            |\n" +
        "                                            v\n" +
        "  [ scheduler node ] --tick every second--> read DueBucket for\n" +
        "        each owned shard at the current second\n" +
        "                     |\n" +
        "                     +--> conditional claim:\n" +
        "                          pending -> claimed, expires in 60 s\n" +
        "                     |\n" +
        "                     +--> emit fire event (job_id, scheduled_for)\n" +
        "                     |\n" +
        "                     +--> for cron jobs, compute next_fire_at from\n" +
        "                          the SCHEDULED time and re-index\n" +
        "                                            |\n" +
        "                                            v\n" +
        "                            [ durable queue per owner service ]\n" +
        "                                            v\n" +
        "                   [ handler ] -- dedupe on idempotency_key --> work\n\n" +
        "  expired claims are swept back to pending and re-fired"
      },
      { t: "p", html: "The load-bearing pieces: <strong>the due index is bucketed by second and sharded</strong>, so no tick ever scans the job table; <strong>shard ownership is a lease with a fence token</strong>, so a node that pauses and wakes up cannot write over its successor; and <strong>the fire event carries a deterministic key</strong>, which is the only reason at-least-once delivery is acceptable." },

      { t: "h", text: "6 · The one hard part: exactly-once firing across a cluster" },
      { t: "p", html: "You cannot get exactly-once delivery over a network — the classic argument is that the sender can never distinguish a lost message from a lost acknowledgement, so it must either risk a duplicate or risk a loss. What you can get is exactly-once <em>effect</em>, and the entire design follows from admitting that up front." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Every scheduler node scans for jobs where <code class='tok'>due_at &lt;= now()</code> and runs what it finds", "N nodes produce N executions of every job. Adding a node makes it worse, and the failure is silent until someone is charged twice."],
          ["Naive", "Elect a single leader that is the only node permitted to fire", "Exactly once while the leader is alive, and zero fires while it is dead, garbage-collecting or partitioned. You have converted a duplication problem into an availability problem and capped throughput at one machine."],
          ["Solid", "Shard the due index and give each shard one owner via a lease; claim each job with a conditional update from <code class='tok'>pending</code> to <code class='tok'>claimed</code> with an expiry, so a crashed owner's claims are swept back and retried", "Horizontally scalable, tolerant of node loss, and duplicates are now rare rather than routine. Rare is not zero: a claim that expires while the work is still running fires it again."],
          ["Standout", "The same, plus: treat delivery as at-least-once and make the effect exactly-once by having the fire event carry <code class='tok'>(job_id, scheduled_for)</code> as an idempotency key that the handler enforces with a conditional insert; add a fence token to the shard lease so a resurrected owner's writes are rejected; and bound catch-up so a four-hour outage does not replay four hours of cron in one second", "Correct under every failure you can name, and — critically — you can say out loud which component guarantees which property."]
        ]
      },
      { t: "note", variant: "tip", html: "The sentence to say: <em>'I cannot promise exactly-once delivery, so I will promise exactly-once effect — the fire event carries a deterministic key and the handler deduplicates on it.'</em> That one line converts an impossible requirement into a designed one, and interviewers are listening for it." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Clock skew, and never trusting a wall clock for correctness" },
      { t: "p", html: "Well-behaved NTP holds machines within tens of milliseconds of each other, but a machine with a broken clock can be seconds or minutes out and will not tell you. Two consequences. First, never make a correctness decision by comparing two machines' wall clocks — use the datastore's clock as the single reference, or a lease whose validity is measured against a monotonic local timer rather than an absolute timestamp. Second, be honest about precision: since skew plus queueing already costs you tens to hundreds of milliseconds, a promise of sub-second accuracy needs a different mechanism (a dedicated timer service with the caller on the same host) rather than a tighter NTP configuration." },
      { t: "h2", text: "Recurrence, timezones and daylight saving" },
      { t: "p", html: "Always compute the next fire time from the previous <em>scheduled</em> time, never from the actual completion time — otherwise a job that runs a few seconds late every time drifts steadily and an hourly job eventually runs at half past. Timezones then bite twice a year: on the spring-forward day a job scheduled for 02:30 local has no occurrence at all, because that wall-clock time never happens; on the fall-back day a job scheduled for 01:30 local has two candidate occurrences. Store the timezone with the job, resolve each occurrence explicitly, and make the policy for both cases a documented choice rather than whatever your date library happens to do." },
      { t: "h2", text: "Catch-up after downtime" },
      { t: "table",
        headers: ["Policy", "Behaviour after a four-hour outage", "Right for"],
        rows: [
          ["Fire all missed", "Replays every missed occurrence, in order", "Billing, ledger postings, anything where each occurrence is a distinct obligation."],
          ["Fire once, latest only", "Runs the job a single time and resumes the normal schedule", "Idempotent refreshes: cache warms, index rebuilds, aggregate recomputation."],
          ["Skip", "Discards everything missed and waits for the next scheduled time", "Notifications and anything time-sensitive, where late is worse than never."]
        ]
      },
      { t: "p", html: "Whichever policy applies, rate-limit the replay. Four hours of a per-minute job is 240 executions arriving at once, and across a large fleet that is an accidental denial-of-service on your own downstream. The same jitter reasoning applies to the top-of-hour spike: spread each job's fire time within a tolerance window by hashing its id, so 83,000 jobs due at 12:00:00 become 83,000 jobs spread across a few seconds. It is the same medicine prescribed by the <a href=\"#/breakdowns/scale/rate-limiter\">rate limiter</a> for synchronised client retries." },

      { t: "h", text: "8 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "A sharded due index rather than a table scan, claims with expiry, and retries with backoff.", "Every node scans and fires, or a single leader with no answer for what happens when it dies."],
          ["Senior", "States plainly that exactly-once delivery is unavailable, designs a deterministic idempotency key, and handles claim expiry while work is still running.", "Says 'exactly once' without ever defining where the guarantee is actually enforced."],
          ["Staff", "Adds fencing tokens, makes catch-up a per-job product decision, jitters the top-of-hour herd, and quantifies the precision floor imposed by clock skew.", "Perfect firing logic with no plan for the recovery stampede after an outage."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>Delivery is at-least-once; the effect is exactly-once.</strong> Shard the due index, lease each shard with a fence token, claim conditionally with an expiry, and hand the handler a deterministic <code class='tok'>(job_id, scheduled_for)</code> key. Then decide catch-up per job, because 'replay everything' and 'skip everything' are both right for different jobs." }
    ]
  });

  /* ---------------------------------------------------------------
     7 · LIVE COMMENTS
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "live-comments",
    title: "Design live comments on a broadcast",
    summary: "Millions of viewers, one stream. Fan-out that stays affordable, latency that stays bounded, and named degradation tiers when it goes viral.",
    minutes: 11,
    tags: ["breakdown", "real-time", "fan-out", "load-shedding"],
    blocks: [
      { t: "p", html: "The prompt: a live broadcast with a scrolling comment stream beside it. The write volume is small enough to be uninteresting and the read fan-out is large enough to be impossible, which makes this the cleanest example in the module of a problem you solve by changing the product rather than by scaling the infrastructure." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>Must every viewer see every comment?</strong> — Assume no. This is <em>the</em> question. Nobody can read 800 comments a second, so the product already permits sampling, and that single answer changes the cost by two orders of magnitude.",
        "<strong>Is global ordering required?</strong> — Assume no, beyond a rough recency ordering. Two viewers seeing comments in slightly different orders is unobservable and enormously cheaper.",
        "<strong>What latency is acceptable?</strong> — Assume one to two seconds. 'Real time' in this product means 'feels live', not 'sub-100 ms'.",
        "<strong>Do comments need to be durable?</strong> — Assume persisted for replay and moderation, but delivery itself is best-effort. Separating those two is what makes the fan-out tractable.",
        "<strong>What happens when a stream goes viral?</strong> — Assume graceful degradation with a defined ladder rather than uniform failure. Volunteer this; it is the part interviewers push on."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Post a comment on a live broadcast.",
        "Receive new comments on that broadcast in near real time without polling.",
        "Show your own comment immediately, whether or not the server has confirmed it.",
        "Persist comments for replay, moderation and after-the-fact viewing.",
        "Degrade in a defined, announced way when a broadcast exceeds planned capacity."
      ] },
      { t: "ul", items: [
        "<strong>Delivery latency</strong> — under 2 seconds from post to visible for the comments that are delivered at all.",
        "<strong>Concurrency</strong> — 5,000,000 simultaneous viewers on a single broadcast.",
        "<strong>Write availability</strong> — posting a comment must keep working even while delivery is being shed.",
        "<strong>Bounded memory per connection</strong> — a slow consumer must never be able to grow a server-side buffer without limit.",
        "<strong>Predictable degradation</strong> — overload reduces the sample rate, never the availability of the page."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  peak concurrent viewers, one stream   5,000,000\n" +
        "  fraction commenting per minute               1%\n" +
        "  comment payload                           120 B\n" +
        "  connections per edge node                50,000\n\n" +
        "WRITE SIDE (small enough to ignore)\n" +
        "  comments / min = 5e6 * 1%                =  50,000\n" +
        "  comments / s                             =  ~830 / s\n" +
        "  ingest bandwidth = 830 * 120 B           =  ~100 KB / s\n\n" +
        "READ SIDE (where it explodes)\n" +
        "  naive: every comment to every viewer\n" +
        "  830 * 5,000,000                          =  4,150,000,000 msg / s\n" +
        "  ...which is not a number you engineer around. Change the product.\n\n" +
        "  nobody reads 830 comments/s -> sample to 20 displayed per second\n" +
        "  batch into ONE frame per viewer per second carrying those 20\n" +
        "  frame size = 20 * 120 B + overhead       =  ~2.6 KB\n" +
        "  per-viewer message rate                  =  1 / s\n" +
        "  total messages = 5,000,000               =  5,000,000 / s\n" +
        "  total egress = 5e6 * 2.6 KB              =  13 GB/s = ~104 Gbps\n\n" +
        "FAN-OUT TREE\n" +
        "  edge nodes = 5,000,000 / 50,000          =  100\n" +
        "  each node subscribes ONCE to the stream  =  2.6 KB/s inbound\n" +
        "  each node writes 50,000 * 2.6 KB         =  130 MB/s = ~1 Gbps out\n" +
        "  pub/sub fan-out is now O(100), not O(5,000,000)\n" +
        "  memory: 50,000 conns * ~10 KB            =  500 MB per node\n\n" +
        "STORAGE\n" +
        "  4-hour broadcast: 50,000/min * 240 min   =  12,000,000 comments\n" +
        "  12e6 * 200 B                             =  2.4 GB per broadcast"
      },
      { t: "note", variant: "tip", html: "Two decisions took 4.15 billion messages a second down to 5 million: <strong>sampling</strong> (a product decision, licensed by the fact that nobody can read that fast) and <strong>batching</strong> (an engineering decision, licensed by a one-second latency budget). Neither is a scaling technique. Both are the answer." },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ENTITIES\n" +
        "  Broadcast(broadcast_id, state, started_at, viewer_estimate,\n" +
        "            degradation_tier)\n" +
        "  Comment(broadcast_id, seq, user_id, body, created_at)\n" +
        "          partitioned by broadcast_id, clustered by seq\n" +
        "  Connection(conn_id, broadcast_id, user_id, node_id, cursor)\n" +
        "             held in node memory, not in a database\n\n" +
        "API\n" +
        "  POST /broadcasts/{id}/comments  { body, client_token }\n" +
        "       -> 202 { seq }        client_token makes the post idempotent\n" +
        "  WS   /broadcasts/{id}/stream\n" +
        "       server -> client, one frame per second:\n" +
        "       { comments: [...], sampled: true, tier: 2, seq_hint: 918233 }\n" +
        "  GET  /broadcasts/{id}/comments?after=seq   replay / catch-up\n\n" +
        "  the 'sampled' flag is part of the contract, not a detail:\n" +
        "  the client renders 'showing a sample of comments' from it"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  commenter --> [ write API ] --append--> [ comment log ]\n" +
        "                    |                     partitioned by broadcast\n" +
        "                    +--> durable store (replay, moderation)\n" +
        "                                              |\n" +
        "                                              v\n" +
        "                                   [ sampler / ranker ]\n" +
        "                             830/s in  ->  20/s out, per broadcast\n" +
        "                                              |\n" +
        "                                              v\n" +
        "                              [ pub/sub topic per broadcast ]\n" +
        "                              ONE subscriber per edge node: 100\n" +
        "               +---------------+--------------+--------------+\n" +
        "               v               v              v              v\n" +
        "        [ edge node 1 ]  [ edge node 2 ]  ...        [ edge node 100 ]\n" +
        "         50,000 sockets   50,000 sockets              50,000 sockets\n" +
        "         batches to 1 frame/s per socket, drops for slow consumers\n" +
        "               |\n" +
        "               v\n" +
        "            viewers\n\n" +
        "  [ load controller ] watches queue depth and drop rate, and moves\n" +
        "  the broadcast up or down a numbered degradation tier"
      },
      { t: "p", html: "The load-bearing pieces: <strong>the write path and the delivery path share nothing but a log</strong>, so a fan-out problem can never stop people commenting; <strong>each edge node subscribes once</strong>, which is the step that converts fan-out from per-viewer to per-node; and <strong>the load controller is explicit</strong>, so degradation is a state you can observe and reason about rather than an emergent property of saturated buffers." },

      { t: "h", text: "6 · The one hard part: bounded-latency fan-out that sheds load gracefully" },
      { t: "p", html: "Fan-out and latency fight each other under overload. The naive response to a delivery backlog is to buffer, but buffering trades the one property the product actually needs — recency — for a property nobody wants, namely completeness. A comment delivered 40 seconds late is worse than no comment, because it is wrong about what is happening on screen." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Every client polls <code class='tok'>GET /comments?since=</code> once a second", "Five million requests per second at the API for a stream producing 830 comments, and the overwhelming majority of responses are empty. You have built a distributed spin-wait."],
          ["Naive", "One websocket per viewer terminating on the same tier that accepts comment writes, pushing every comment", "Delivery and ingestion now share a fate, so a comment spike stalls delivery and a delivery backlog stalls posting — and it is still 4.15 billion messages a second."],
          ["Solid", "Separate tiers: a stateless write path appending to a per-broadcast log, and a connection tier where each node subscribes to that log once and fans out locally to its own sockets", "Pub/sub cost is now proportional to node count, the two paths fail independently, and the design scales by adding connection nodes. It still assumes every comment must be delivered."],
          ["Standout", "The same, plus treating the stream as sampled and best-effort: rank or sample server-side down to a fixed display budget, batch into one frame per viewer per second, apply per-connection backpressure that drops frames for slow consumers rather than buffering them, and degrade through numbered tiers (drop reactions, then widen the batch interval, then sample harder, then fall back to a periodic snapshot) with the current tier announced to the client", "Every mechanism has a named trigger and a named cost, the client tells the user the truth about what it is showing, and the system has a defined behaviour at ten times the planned load instead of an undefined one."]
        ]
      },
      { t: "note", variant: "tip", html: "<strong>Backpressure means dropping, not buffering.</strong> A per-connection queue with a hard cap and a drop-oldest policy keeps memory bounded and keeps what the viewer sees current. An unbounded buffer converts a delivery problem into an out-of-memory kill, which takes 50,000 other viewers with it." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Slow consumers and connection churn" },
      { t: "p", html: "A viewer on a poor mobile connection cannot absorb 2.6 KB a second, and with 50,000 sockets per node even a small fraction of such consumers can exhaust memory. Give each connection a bounded queue — a handful of frames — drop the oldest when it is full, and disconnect after a sustained threshold so the client can reconnect somewhere healthier. Then worry about the reconnect: 50,000 clients dropped by one node failure will all reconnect at once, and if the client retries immediately they will do it in lockstep. Jittered exponential backoff on the client and connection draining on deploy are not optional at this size, because a rolling restart of 100 nodes without them is indistinguishable from an attack." },
      { t: "h2", text: "Ordering, and the one comment that must appear instantly" },
      { t: "p", html: "Global ordering across five million viewers is expensive and invisible. Per-broadcast rough recency ordering — which a partitioned log gives you for free — is sufficient. The exception is the viewer's own comment: it must appear immediately, so echo it into the local view optimistically on submit and reconcile when the server's sequence number arrives. If the comment is later rejected by moderation, remove it and say why. This is the standard optimistic-update pattern, and here it also means the write path's latency is invisible to the person who cares most about it." },
      { t: "h2", text: "Sampling that does not feel random" },
      { t: "p", html: "Uniform random sampling makes the stream feel dead, because it discards exactly the comments people want — the ones with replies, the ones from people you follow, the ones the broadcaster responded to. Bias the sample: always include the broadcaster and moderators, always include comments the viewer's own connections wrote, and fill the remaining budget with a mix of recency and a cheap engagement signal. The per-viewer portion means the sampler cannot be entirely shared, so compute a global sample once and let each edge node splice in the small per-viewer set it already knows about. The ordering and coalescing logic here is a bigger sibling of the price stream in the <a href=\"#/breakdowns/scale/online-auction\">online auction</a>." },

      { t: "h", text: "8 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "Websockets instead of polling, a connection tier separate from the write tier, and pub/sub between them.", "Computes the naive fan-out number and then tries to scale the infrastructure to meet it."],
          ["Senior", "Fan-out proportional to node count, batching into frames, bounded per-connection queues with a drop policy, and a reconnect-storm answer.", "Buffers for slow consumers, or forgets that a rolling deploy is itself a mass reconnection event."],
          ["Staff", "Treats sampling as a product decision and negotiates it explicitly, defines numbered degradation tiers with triggers, and makes the degradation visible in the client contract.", "Degrades implicitly — latency quietly grows until the feature is useless and nobody can say which threshold was crossed."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>The arithmetic says this is impossible; the product says it does not have to be.</strong> Sampling and batching turn 4.15 billion messages a second into 5 million, a fan-out tree turns pub/sub cost from per-viewer into per-node, and drop-based backpressure keeps the stream current under overload. Degrade in named tiers and tell the client which one it is in." }
    ]
  });

  /* ---------------------------------------------------------------
     8 · NEWS AGGREGATOR
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "news-aggregator",
    title: "Design a news aggregator with topic grouping",
    summary: "Google News. Crawling politely at scale, then collapsing a thousand near-identical wire rewrites into one story.",
    minutes: 11,
    tags: ["breakdown", "crawling", "deduplication", "clustering"],
    blocks: [
      { t: "p", html: "The prompt: continuously crawl a large set of publishers, and present the news grouped by story rather than by article — so one event that two hundred outlets covered appears once, with the coverage attached. The crawl is a scheduling problem; the grouping is a similarity problem that is quadratic if you write it the obvious way." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>Do we render full article text or link out?</strong> — Assume headline, snippet and link. That is a legal and licensing constraint before it is a technical one, and it shrinks the storage estimate considerably.",
        "<strong>How fresh is fresh?</strong> — Assume a median of about five minutes from publication to visibility for significant sources, and much looser for the long tail.",
        "<strong>Personalised, or one global front page?</strong> — Assume a global set of topic pages first, with personalisation as a ranking layer on top. Keeps the scope honest.",
        "<strong>What counts as the same story?</strong> — Assume the same underlying event, which explicitly includes rewrites and syndications. Ask this, because 'same article' and 'same story' are different systems.",
        "<strong>Must we honour crawl directives?</strong> — Assume yes, strictly. Politeness is a hard constraint, not a courtesy, and it bounds the whole crawl design."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Discover and fetch new articles from a large, changing set of sources.",
        "Extract the headline, publication time, body text and entities from each page.",
        "Group near-identical and same-event articles into a single story cluster.",
        "Rank stories within a topic and serve topic pages.",
        "Respect per-host crawl directives and rate limits at all times."
      ] },
      { t: "ul", items: [
        "<strong>Freshness</strong> — median time from publication to visible under 5 minutes for high-priority sources.",
        "<strong>Clustering precision</strong> — merging two genuinely different stories is far worse than failing to merge two versions of one, so tune for precision over recall and say so.",
        "<strong>Politeness</strong> — at most one or two concurrent connections per host, honouring declared crawl delay.",
        "<strong>Throughput</strong> — ingest and cluster 2,000,000 new articles per day without a growing backlog.",
        "<strong>Serving latency</strong> — topic page p99 under 200 ms, served entirely from precomputed clusters."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  sources tracked                200,000\n" +
        "  new articles / day           2,000,000\n" +
        "  target median freshness            5 min\n" +
        "  article body                      15 KB\n\n" +
        "CRAWL\n" +
        "  articles / s = 2e6 / 86,400            =  ~23 / s\n" +
        "  uniform 5-minute polling of every source:\n" +
        "    200,000 / 300 s                      =  ~670 fetches / s\n" +
        "  most sources publish nothing most of the time, so a uniform\n" +
        "  schedule spends the overwhelming majority of that budget\n" +
        "  confirming that nothing has changed\n\n" +
        "STORAGE\n" +
        "  2e6 * 20 KB (body + metadata)          =  40 GB/day -> ~14.6 TB/yr\n" +
        "  fingerprints: 2e6 * 24 B               =  48 MB/day\n" +
        "  a 7-day comparison window              =  336 MB -> fits in RAM\n\n" +
        "DEDUPLICATION\n" +
        "  naive pairwise over one day = 2e6^2 / 2 = 2,000,000,000,000 pairs\n" +
        "  ...which is why nobody does it that way\n\n" +
        "  64-bit SimHash + 4 bands of 16 bits:\n" +
        "  compare only within a band bucket, so candidates per article\n" +
        "  fall from 2,000,000 to the low thousands\n\n" +
        "CLUSTERS\n" +
        "  ~2,000,000 articles collapsing at roughly 10:1\n" +
        "                                         =  ~200,000 stories / day"
      },
      { t: "note", variant: "trap", html: "The two trillion figure is the point of the whole exercise. Any design that compares each new article against the day's corpus is quadratic and will not run — so the interesting question is never 'how do I compare two articles' but <strong>'how do I avoid comparing almost all of them'</strong>. Locality-sensitive hashing is the standard answer because it makes candidate generation sublinear." },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ENTITIES\n" +
        "  Source(source_id, host, authority, crawl_delay_s, feed_url,\n" +
        "         last_fetch_at, publish_rate_ewma, next_poll_at)\n" +
        "  Article(article_id, source_id, url_hash, title, body, published_at,\n" +
        "          fetched_at, simhash, entities[], topic, story_id)\n" +
        "  Story(story_id, canonical_article_id, topic, first_seen_at,\n" +
        "        updated_at, member_count, score)\n" +
        "  BandIndex(band_no, band_value, article_id)     the LSH buckets\n" +
        "  HostQueue(host, in_flight, next_allowed_at)    politeness state\n\n" +
        "API (read side)\n" +
        "  GET /topics                      -> topic list with counts\n" +
        "  GET /topics/{topic}?cursor=      -> ranked stories\n" +
        "  GET /stories/{id}                -> canonical + all coverage\n" +
        "  GET /search?q=                   -> stories, not articles\n\n" +
        "INTERNAL\n" +
        "  frontier.pop(host_budget) -> urls   respects HostQueue\n" +
        "  cluster.assign(article)   -> story_id   LSH candidates, then verify"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  [ scheduler ] --scores sources by publish_rate_ewma, authority,\n" +
        "                  time since last new item--> next_poll_at\n" +
        "        |\n" +
        "        v\n" +
        "  [ frontier ] sharded BY HOST so politeness is a local property\n" +
        "        |   per-host queue: 1-2 in flight, honour crawl delay\n" +
        "        v\n" +
        "  [ fetchers ] conditional GET (If-Modified-Since / ETag)\n" +
        "        |   304 costs almost nothing and is the common case\n" +
        "        v\n" +
        "  [ extractor ] strip boilerplate -> title, body, published_at,\n" +
        "                                     entities, topic\n" +
        "        v\n" +
        "  [ fingerprint ] 64-bit SimHash over the normalised body\n" +
        "        v\n" +
        "  [ LSH candidate lookup ] 4 bands x 16 bits -> tens of candidates\n" +
        "        v\n" +
        "  [ verifier ] Hamming distance + entity overlap + time proximity\n" +
        "        v\n" +
        "  [ cluster writer ] join an existing Story, or open a new one\n" +
        "        v\n" +
        "  [ ranker ] --> precomputed topic pages --> cache --> readers"
      },
      { t: "p", html: "Two load-bearing structural choices. <strong>The frontier is sharded by host</strong>, which makes politeness a property one shard can enforce alone rather than a distributed agreement problem. And <strong>clustering is a two-stage funnel</strong>: a cheap fingerprint stage that is allowed to be imprecise because it only generates candidates, followed by an expensive verification stage that only ever sees a handful of them." },

      { t: "h", text: "6 · The one hard part: collapsing near-identical stories at scale" },
      { t: "p", html: "The same event reaches you as a wire report, twenty near-verbatim republications with different headlines and bylines, a dozen rewrites with genuinely different text, and several aggregator pages that quote all of the above. All should collapse into one story. Exact hashing catches none of them; pairwise similarity catches all of them and never finishes." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Exact match on the title, or a hash of the full body", "Catches essentially nothing. A republished wire story routinely carries a different headline, a different byline and a block of publisher boilerplate appended to the body."],
          ["Naive", "Pairwise cosine similarity over TF-IDF vectors for the day's articles", "Now it works, and it needs two trillion comparisons a day. Correct and unshippable is still unshippable."],
          ["Solid", "Strip boilerplate, compute a SimHash over the normalised body, band the fingerprint so only articles that already collide in a band are compared, then union-find pairs under a Hamming threshold into clusters", "Candidate generation becomes sublinear, comparisons drop from trillions to millions, and the quality is good enough for near-duplicates. It still struggles with genuine rewrites that share few exact phrases."],
          ["Standout", "A two-stage funnel — cheap fingerprint for recall, then an expensive verifier (embedding similarity, named-entity overlap, publication-time proximity) on the small candidate set — with a story modelled as a <em>growing</em> cluster whose canonical representative is chosen by source authority and earliest timestamp, so late syndications join the existing story instead of founding a new one", "Rewrites are caught by the semantic stage, near-duplicates by the cheap stage, and the cluster is stable over time rather than fragmenting as coverage arrives."]
        ]
      },
      { t: "note", variant: "tip", html: "Merging two distinct stories is a visible, embarrassing failure; failing to merge two versions of one story is a mildly redundant front page. <strong>Tune the threshold for precision, and let recall be recovered by the verification stage.</strong> Saying which error you are optimising against is worth more than any specific threshold." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Freshness versus politeness" },
      { t: "p", html: "These are in direct tension: freshness wants to poll constantly, politeness caps you at one or two concurrent connections per host with a declared delay between them. Four levers resolve most of it. <strong>Feeds first</strong> — a publisher's feed is one cheap request that lists everything new, so use it wherever it exists and reserve crawling for sources without one. <strong>Conditional requests</strong> — <code class='tok'>If-Modified-Since</code> and <code class='tok'>ETag</code> turn the common 'nothing changed' case into a tiny 304 rather than a 15 KB body. <strong>Adaptive scheduling</strong> — score each source by its recent publish rate and authority, so a wire service is polled every minute and a dormant blog daily. <strong>Push where offered</strong> — some publishers support notification protocols that eliminate polling entirely for their content." },
      { t: "h2", text: "Boilerplate extraction, which quietly determines dedup quality" },
      { t: "p", html: "Navigation menus, related-article rails, cookie notices and footers can be most of a page's text, and they are the <em>same</em> on every article from a given publisher. Fingerprint the raw HTML text and every article from one site looks similar to every other article from that site, which is exactly the wrong signal. Extract the main content first — density-based extraction plus per-source learned templates work well — and treat the extraction success rate per source as a monitored metric, because a site redesign will silently break it and your clusters will degrade before anyone notices." },
      { t: "h2", text: "Choosing the canonical article" },
      { t: "p", html: "Once you have a cluster you must pick what to show. Earliest publication time rewards the outlet that broke the story, source authority rewards reliability, and neither alone is right — a scraper that republishes within seconds would otherwise win every cluster. Score on a combination and re-evaluate as the cluster grows, but keep the choice stable once a story has been shown, because a front page whose headline changes every thirty seconds reads as broken. The same politeness-and-scheduling machinery appears again, at a much larger item count, in the <a href=\"#/breakdowns/scale/price-tracker\">price tracker</a>." },

      { t: "h", text: "8 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "A crawler with a frontier, an extraction stage, and some notion of similarity clustering. Politeness mentioned.", "Proposes pairwise comparison without noticing it is quadratic."],
          ["Senior", "LSH or MinHash for sublinear candidate generation, host-sharded frontier, conditional requests, and adaptive per-source scheduling.", "Fingerprints raw page text and never mentions boilerplate, which is what actually decides cluster quality."],
          ["Staff", "Names the precision-versus-recall trade explicitly, designs the two-stage funnel with costs attached, and treats extraction health as a monitored metric with a failure mode.", "Perfect clustering design with no plan for the day a major publisher changes their template."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>Never compare everything to everything.</strong> A cheap fingerprint plus locality-sensitive banding turns two trillion comparisons into millions, and an expensive verifier then runs only on the survivors. On the crawl side, feeds and conditional requests buy you most of the freshness that naive polling would try to brute-force." }
    ]
  });

  /* ---------------------------------------------------------------
     9 · PRICE TRACKER
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "price-tracker",
    title: "Design a price tracker with drop alerts",
    summary: "CamelCamelCamel. Five hundred million items, wildly different change rates, and an alert that must never cry wolf.",
    minutes: 11,
    tags: ["breakdown", "scheduling", "crawling", "alerting"],
    blocks: [
      { t: "p", html: "The prompt: track prices for a very large catalogue across many merchants, keep a price history, and alert users the moment something they are watching drops. It looks like a crawler problem and it is really a scheduling problem — you are trying to spend a fixed polling budget where the information is." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>How fast must an alert fire?</strong> — Assume within about 15 minutes for volatile items and hours for the rest. 'Instant' would multiply the crawl budget by two orders of magnitude for almost no user benefit.",
        "<strong>Do merchants offer feeds or affiliate APIs?</strong> — Assume many do. This is the highest-leverage question in the whole problem, because a bulk feed replaces millions of page fetches.",
        "<strong>Are we tracking every item, or only watched items?</strong> — Assume a large catalogue with a much smaller watched subset, and design so watched items get priority.",
        "<strong>What counts as a drop?</strong> — Assume a meaningful decrease against a recent baseline, not any decrease at all. Ask, because this is where alert quality is won or lost.",
        "<strong>Is stale data acceptable?</strong> — Assume yes, with the observation timestamp displayed. Showing a price with an honest 'as of' beats guessing."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Track the current price of a very large set of items across many merchants.",
        "Store and serve a price history per item.",
        "Let a user watch an item with a target price or a percentage-drop threshold.",
        "Send an alert when a watched item's price meets the threshold.",
        "Never alert on a bad reading, and never alert twice for the same drop."
      ] },
      { t: "ul", items: [
        "<strong>Detection latency</strong> — a real drop on a volatile item is detected within about 15 minutes.",
        "<strong>Alert precision</strong> — a false alert is much worse than a late one; users unsubscribe after two bad ones.",
        "<strong>Crawl budget</strong> — bounded and predictable, with per-merchant concurrency caps that are never exceeded.",
        "<strong>History fidelity</strong> — every price transition is recorded; repeated identical observations are not.",
        "<strong>Alert deduplication</strong> — at most one alert per user, per item, per genuine drop event."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  tracked items              500,000,000\n" +
        "  merchants                        5,000\n" +
        "  items changing price / day          1%\n" +
        "  page fetch                       50 KB\n" +
        "  active user watches         50,000,000\n\n" +
        "THE WASTE IN UNIFORM POLLING\n" +
        "  hourly polling = 500e6 * 24        =  12,000,000,000 fetches/day\n" +
        "                 = 12e9 / 86,400     =  ~139,000 fetches / s\n" +
        "                 * 50 KB             =  ~6.9 GB/s of crawl traffic\n" +
        "  actual changes = 500e6 * 1%        =  5,000,000/day = ~58 / s\n" +
        "  waste ratio    = 12e9 / 5e6        =  2,400 : 1\n\n" +
        "TIERED POLLING BY OBSERVED VOLATILITY\n" +
        "  A   1%  =   5,000,000 items / 15 min = 5e6 / 900     =  5,560 / s\n" +
        "  B   9%  =  45,000,000 items /  6 h   = 45e6 / 21,600 =  2,080 / s\n" +
        "  C  90%  = 450,000,000 items /  3 d   = 450e6/259,200 =  1,740 / s\n" +
        "  total                                                =  ~9,380 / s\n" +
        "  versus 139,000 / s uniform                           =  ~15x cheaper\n" +
        "  bulk merchant feeds covering 60% of items            =  ~3,800 / s\n\n" +
        "STORAGE: RECORD CHANGES, NOT OBSERVATIONS\n" +
        "  changes      5e6/day * 40 B        =  200 MB/day -> 73 GB / yr\n" +
        "  observations 9,380/s * 86,400 * 40 B\n" +
        "               = 810M rows/day       =  32 GB/day  -> ~11.8 TB / yr\n" +
        "  162x more storage carrying exactly the same information"
      },
      { t: "note", variant: "tip", html: "The 2,400:1 waste ratio is the number to say out loud. It reframes the problem from 'how do I crawl faster' to <strong>'how do I decide what is worth crawling'</strong>, which is the answer the interviewer is waiting for and is also what makes the system affordable." },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ENTITIES\n" +
        "  Item(item_id, merchant_id, external_id, url_hash, title,\n" +
        "       current_price, currency, last_checked_at, last_changed_at,\n" +
        "       change_rate_ewma, tier: A|B|C, next_poll_at)\n" +
        "  PriceChange(item_id, changed_at, old_price, new_price)\n" +
        "              partitioned by item_id, clustered by changed_at\n" +
        "  Merchant(merchant_id, host, concurrency_cap, feed_url,\n" +
        "           extractor_version, extraction_success_rate)\n" +
        "  Watch(user_id, item_id, target_price, drop_pct, created_at,\n" +
        "        last_alerted_at, last_alert_price)\n" +
        "  AlertSent(user_id, item_id, dedup_key)   primary key on all three\n\n" +
        "API\n" +
        "  GET  /items/{id}                 -> current price + as_of\n" +
        "  GET  /items/{id}/history?from=   -> the change log\n" +
        "  POST /watches  { item_id, target_price? , drop_pct? }\n" +
        "  DELETE /watches/{id}\n\n" +
        "INTERNAL\n" +
        "  poller.due(now, merchant_budget) -> items to fetch\n" +
        "  observe(item_id, price, observed_at) -> maybe PriceChange\n" +
        "                                       -> maybe alert candidates"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  [ scheduler ] scores every item: change_rate_ewma, time since\n" +
        "                last change, watch count, merchant sale calendar\n" +
        "        |  writes next_poll_at; a due index bucketed by minute\n" +
        "        v\n" +
        "  [ dispatcher ] sharded BY MERCHANT so the concurrency cap is\n" +
        "        |        enforced locally, never by distributed agreement\n" +
        "        +--> [ feed importer ]  for merchants with bulk feeds\n" +
        "        +--> [ page fetchers ]  conditional GET where supported\n" +
        "                    v\n" +
        "            [ extractor ] per-merchant rules, versioned\n" +
        "                    v\n" +
        "            [ plausibility filter ]\n" +
        "                    |  quarantine implausible readings\n" +
        "                    v\n" +
        "            [ observer ] price == current ? update last_checked_at\n" +
        "                                          : write PriceChange\n" +
        "                    v\n" +
        "            [ alert matcher ] find Watch rows crossing a threshold\n" +
        "                    v\n" +
        "            [ dedup gate ] conditional insert on AlertSent\n" +
        "                    v\n" +
        "            [ notification service ]"
      },
      { t: "p", html: "The load-bearing pieces: <strong>the scheduler is the product</strong>, because the polling decision determines both cost and freshness; <strong>the dispatcher shards by merchant</strong>, so a concurrency cap is a local invariant; and <strong>the dedup gate is a conditional insert</strong>, which is the only reliable way to stop a retried pipeline from alerting twice. The alert itself is handed to the <a href=\"#/breakdowns/scale/notification-system\">notification system</a>, which owns delivery." },

      { t: "h", text: "6 · The one hard part: spending a fixed poll budget where the information is" },
      { t: "p", html: "Five hundred million items and five million daily changes means 99.96% of any uniform poll is wasted. But you cannot know which items will change without checking them, so the scheduler is estimating an unobserved quantity — the probability that this item's price has moved since you last looked — and spending its budget accordingly." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "A uniform cron that polls every item on a fixed interval", "139,000 fetches a second to discover 58 changes a second, and every merchant on the list blocks you within a week."],
          ["Naive", "A priority queue ordered by time since last poll", "Fairer, and still blind: a flash-sale item and an item whose price has not moved in three years are treated identically because staleness is not the same thing as likely change."],
          ["Solid", "Volatility tiers driven by each item's observed change frequency, with per-merchant concurrency caps and conditional requests so an unchanged page costs a 304 rather than a full body", "Fifteen times cheaper than uniform polling for better freshness on the items that matter. The tiers are coarse and slow to react to a change in an item's behaviour."],
          ["Standout", "Model each item's next change as a hazard estimate, warm-started from its category and merchant priors so a brand-new item is not treated as stable; poll when the expected value of the information exceeds its cost; fold in exogenous signals (a merchant's sale calendar, a competitor's price move, a user actively viewing the item); and take the bulk feed wherever a merchant offers one, reserving crawling for the tail", "The budget now follows information rather than the clock, new items are handled correctly, and the largest single saving — feeds — is taken first rather than engineered around."]
        ]
      },
      { t: "note", variant: "tip", html: "<strong>Ask for the feed before you build the crawler.</strong> A bulk feed covering 60% of items removes 60% of the crawl for one integration per merchant. Candidates routinely design a beautiful adaptive scheduler and never mention that most of the work is avoidable — recognising the cheap path first is the senior instinct being tested." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "Alert deduplication and hysteresis" },
      { t: "p", html: "A price that oscillates between 99.99 and 99.98 must not generate a stream of alerts, and a merchant that briefly publishes 0.00 during a deployment must generate none at all. Four mechanisms, applied in order. A <strong>minimum change threshold</strong>, both absolute and relative, so noise never qualifies. <strong>Hysteresis</strong>: after alerting on a drop below a target, do not alert again until the price has risen meaningfully above that target, so a hovering price fires once. A <strong>per-user cooldown</strong> per item, measured in days. And an <strong>idempotency key</strong> — <code class='tok'>(user_id, item_id, price_bucket, day)</code> — written with a conditional insert so a retried pipeline run cannot resend. The plausibility filter sits before all of them: a price outside a sane band relative to recent history is quarantined until a second independent observation confirms it." },
      { t: "h2", text: "Extraction fragility, which is the real operational risk" },
      { t: "p", html: "A merchant redesigns their page and your extractor silently starts returning the strikethrough list price, or nothing at all. Nothing crashes; the data just becomes wrong, and you find out from users. Defend with two mechanisms that cost almost nothing. Track an <strong>extraction success rate per merchant per extractor version</strong> and alert your own team when it drops — a step change means a template change, not a bad day. And apply a <strong>distributional check</strong>: if the fraction of a merchant's items showing a price change jumps from 1% to 40% in one crawl cycle, that is a parser failure, not a sale, so quarantine the batch and page a human rather than emailing forty million people." },
      { t: "h2", text: "Storing changes rather than observations" },
      { t: "p", html: "The arithmetic above showed 162 times the storage for identical information. Beyond cost, a change log is the more useful shape: a price history chart wants transitions, a 'lowest ever' query wants a minimum over transitions, and an alert rule wants to compare against the last distinct price. Keep <code class='tok'>last_checked_at</code> on the item row so you can still show honest freshness, and write a <code class='tok'>PriceChange</code> row only when the value actually moves." },

      { t: "h", text: "8 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "A poller, a price history, watch rows and an alert path. Recognises that polling everything hourly is infeasible.", "Computes the crawl load and then proposes scaling the crawler to meet it."],
          ["Senior", "Volatility-tiered scheduling with numbers, per-merchant concurrency caps, conditional requests, change-log storage, and alert dedup with hysteresis.", "Designs the scheduler well and leaves alerting as 'send an email when price &lt; target', which will fire repeatedly on an oscillating price."],
          ["Staff", "Frames polling as an expected-value decision, prioritises merchant feeds over crawling, and treats extraction health and price plausibility as monitored, alert-blocking gates.", "No answer for the day a parser breaks — which is a certainty, not a risk."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>The scheduler is the system.</strong> Uniform polling wastes 2,400 fetches per useful observation; volatility tiers cut that fifteenfold and feeds cut it again. Then protect the user: a plausibility filter, a minimum change threshold, hysteresis and a conditional-insert dedup key are what stand between a useful alert and an unsubscribe." }
    ]
  });

  /* ---------------------------------------------------------------
     10 · NOTIFICATION SYSTEM
     --------------------------------------------------------------- */
  LESSONS.push({
    id: "notification-system",
    title: "Design a multi-channel notification system",
    summary: "Push, email and SMS behind one API. Preferences, deduplication, rate limits, provider failure, and idempotency that survives a retry.",
    minutes: 12,
    tags: ["breakdown", "messaging", "idempotency", "reliability"],
    blocks: [
      { t: "p", html: "The prompt: one internal service that every product team calls to notify a user, choosing the right channel, honouring their preferences, and never sending the same thing twice. It is the most commonly under-designed system in the interview set, because the hard parts — preferences, deduplication and idempotency — look like configuration rather than architecture." },

      { t: "h", text: "1 · The prompt and clarifying questions" },
      { t: "ul", items: [
        "<strong>Transactional, marketing, or both?</strong> — Assume both, held strictly separate. They have different consent rules, different urgency and, in many jurisdictions, different legal obligations.",
        "<strong>Who chooses the channel, caller or service?</strong> — Assume the caller declares intent and urgency, and the service resolves the channel from preferences. Otherwise every team reimplements the preference logic.",
        "<strong>Is ordering required?</strong> — Assume no across notifications, and yes within a conversation thread. Ask, because global ordering would be very expensive and is almost never needed.",
        "<strong>What is the latency requirement?</strong> — Assume seconds for transactional and minutes for digestible ones. That split is what makes batching and digesting possible.",
        "<strong>What happens when a provider is down?</strong> — Assume a secondary provider plus a per-notification time-to-live. Volunteer this; 'retry until it works' is the wrong answer and interviewers probe it."
      ] },

      { t: "h", text: "2 · Requirements" },
      { t: "ol", items: [
        "Accept a notification request from any internal service with a type, a recipient and a payload.",
        "Resolve the channel or channels from the user's preferences and the notification's urgency.",
        "Deliver via push, email or SMS, retrying transient failures with backoff.",
        "Deduplicate so a retried or duplicated request never notifies the user twice.",
        "Enforce per-user rate limits and quiet hours, and record the outcome of every attempt."
      ] },
      { t: "ul", items: [
        "<strong>Latency</strong> — transactional notifications dispatched within about 5 seconds of the triggering event at p99.",
        "<strong>Duplicate rate</strong> — effectively zero user-visible duplicates, despite at-least-once queues throughout.",
        "<strong>Durability</strong> — an accepted request is never silently lost; every one ends in a recorded terminal state.",
        "<strong>Isolation</strong> — a slow or failed channel must not delay any other channel.",
        "<strong>Throughput</strong> — 5,800 notifications per second at steady state, 29,000 at peak."
      ] },

      { t: "h", text: "3 · Capacity math (all inputs are stated assumptions)" },
      { t: "code", lang: "text", code:
        "ASSUMPTIONS\n" +
        "  users                        100,000,000\n" +
        "  notifications / day          500,000,000\n" +
        "  channel mix        push 70% / email 25% / SMS 5%\n" +
        "  SMS unit cost                     $0.005\n" +
        "  email unit cost                  $0.0001\n\n" +
        "RATES\n" +
        "  average = 500e6 / 86,400                 =  ~5,800 / s\n" +
        "  peak (x5)                                =  ~29,000 / s\n" +
        "  push  350e6 / 86,400                     =  ~4,050 / s\n" +
        "  email 125e6 / 86,400                     =  ~1,450 / s\n" +
        "  SMS    25e6 / 86,400                     =    ~290 / s\n\n" +
        "COST (the number that reshapes the design)\n" +
        "  SMS    25e6 * $0.005                     =  $125,000 / day\n" +
        "                                           =  ~$46,000,000 / yr\n" +
        "  email 125e6 * $0.0001                    =  $12,500 / day\n" +
        "  push                                     =  effectively free\n" +
        "  SMS is 5% of volume and ~91% of the bill, so preferences and\n" +
        "  channel fallback are a cost control, not merely a courtesy\n\n" +
        "STORAGE\n" +
        "  delivery records 500e6/day * 200 B       =  100 GB/day\n" +
        "                                           =  36.5 TB / yr\n" +
        "  30 days hot                              =  3 TB\n" +
        "  preferences 100e6 * 200 B                =  20 GB (fully cacheable)\n\n" +
        "PROVIDER OUTAGE\n" +
        "  push provider down 10 min at 4,050 / s   =  ~2,400,000 queued\n" +
        "  at 500 B each                            =  1.2 GB of backlog\n" +
        "  holding it is easy; the real question is which of those are\n" +
        "  still worth sending when the provider comes back"
      },

      { t: "h", text: "4 · Entity model and API" },
      { t: "code", lang: "text", code:
        "ENTITIES\n" +
        "  Notification(notification_id, user_id, type, payload_ref,\n" +
        "               urgency, created_at, expires_at, dedup_key)\n" +
        "  Preference(user_id, category, channel, enabled, quiet_hours_tz,\n" +
        "             quiet_start, quiet_end, digest: instant|hourly|daily)\n" +
        "  Delivery(notification_id, channel, provider, attempt, state,\n" +
        "           provider_message_id, error_code, updated_at)\n" +
        "  DedupRecord(dedup_key)  PRIMARY KEY, TTL'd\n" +
        "              conditional insert; first writer wins\n" +
        "  DeviceToken(user_id, platform, token, last_seen_at, invalid_at)\n\n" +
        "API\n" +
        "  POST /notify\n" +
        "    { user_id, type, urgency: transactional|digest|marketing,\n" +
        "      entity_id, params, dedup_window_s }\n" +
        "    -> 202 { notification_id, dedup_key, deduplicated: bool }\n" +
        "  GET  /notifications/{id}    -> per-channel delivery state\n" +
        "  GET  /users/{id}/preferences\n" +
        "  PUT  /users/{id}/preferences\n\n" +
        "THE DEDUP KEY IS DERIVED, NOT GENERATED\n" +
        "  dedup_key = hash(user_id, type, entity_id, floor(now/window))\n" +
        "  two callers describing the same real-world event produce the\n" +
        "  same key, which a randomly generated request id never would"
      },

      { t: "h", text: "5 · High-level design" },
      { t: "code", lang: "text", code:
        "  service --> [ notify API ] --derive dedup_key-->\n" +
        "                    |  conditional INSERT into DedupRecord\n" +
        "                    |  already present? return 202 deduplicated\n" +
        "                    v\n" +
        "            [ intake queue ]\n" +
        "                    v\n" +
        "            [ resolver ] preferences (cached) + quiet hours\n" +
        "                    |    + per-user rate-limit ladder\n" +
        "                    |    + digest bundling for non-urgent types\n" +
        "                    v\n" +
        "       +------------+-------------+\n" +
        "       v            v             v\n" +
        "  [push queue]  [email queue]  [sms queue]     separate queues:\n" +
        "       |            |             |            no head-of-line\n" +
        "       v            v             v            blocking across\n" +
        "  [push wrkrs]  [email wrkrs] [sms wrkrs]      channels\n" +
        "       |            |             |\n" +
        "  circuit breaker per provider; secondary on trip\n" +
        "       |            |             |\n" +
        "       v            v             v\n" +
        "  [ provider A ] [ provider B ] [ provider C ]\n" +
        "       |\n" +
        "       +--> Delivery row updated; webhooks reconcile the outcome\n" +
        "       +--> expired (past expires_at) -> dropped, recorded, counted"
      },
      { t: "p", html: "Four load-bearing pieces. <strong>Deduplication happens at intake</strong>, before anything is queued, so it protects against duplicate callers as well as duplicate deliveries. <strong>Queues are per channel</strong>, so a slow SMS route cannot delay a push. <strong>Circuit breakers are per provider</strong>, so a failing vendor is bypassed automatically rather than absorbing retries. And <strong>every notification has an expiry</strong>, so the system has a defined answer to 'this is now too late to be useful'." },

      { t: "h", text: "6 · The one hard part: idempotency that survives a retry" },
      { t: "p", html: "Every queue in this design is at-least-once, which means every worker will occasionally process the same message twice — after a crash, a visibility timeout, a rebalance or a network stall. If the deduplication is in the wrong place or keyed on the wrong thing, a user gets the same alert twice, and users forgive that roughly once." },
      { t: "table",
        headers: ["Tier", "Approach", "Why it lands there"],
        rows: [
          ["Naive", "Each producing service calls the push, email and SMS SDKs directly", "Every product team reimplements preferences and quiet hours slightly differently, a provider timeout becomes a checkout timeout, and there is no place where deduplication could even live."],
          ["Naive", "A shared notification service with one queue and a synchronous provider call, writing a 'sent' record afterwards", "The boundary is right, but one queue means a slow SMS route blocks push, and writing the record after the send leaves a crash window in which the redelivered message notifies the user again."],
          ["Solid", "Per-channel queues, per-provider workers, preference and quiet-hour checks at send time, exponential backoff into a dead-letter queue, and an idempotency key attached to every send", "Isolated, retryable and mostly duplicate-free. The remaining weakness is that the key is usually generated at send time, so two callers reporting the same real event still produce two notifications."],
          ["Standout", "The same, plus a key <em>derived from the event</em> — <code class='tok'>hash(user_id, type, entity_id, dedup_window)</code> — recorded with a conditional insert at intake so the first writer wins and every retry is a no-op; the same value passed as the provider's own idempotency header; a digest layer that collapses forty 'someone liked your post' events into one; per-provider circuit breakers with automatic secondary failover; and a per-user, per-channel, per-type rate ladder", "Duplicates are impossible at three independent layers, the failure of any one provider is contained, and the user's inbox is protected from an event storm — which is the failure that actually costs you the user."]
        ]
      },
      { t: "note", variant: "trap", html: "The ordering is the whole trick and it is easy to get backwards. <strong>Write the dedup record before or atomically with the provider call, never after.</strong> If you write it afterwards, a crash between the send and the write leaves no evidence the send happened, the message is redelivered, and the user is notified twice — the exact failure the record was supposed to prevent." },

      { t: "h", text: "7 · Deep dives" },
      { t: "h2", text: "The preference model" },
      { t: "p", html: "Preferences are a matrix, not a flag: channel by category by schedule. A user might want push for direct messages, a daily email digest for social activity, SMS only for security events, and nothing at all between 22:00 and 07:00 in their own timezone. Three rules keep it sane. Store quiet hours with the timezone, not as an offset, or the user's preferences silently shift twice a year. Make transactional and security notifications structurally exempt from marketing opt-outs, and enforce that in the resolver rather than in documentation. And apply the strictest applicable rule when preferences conflict — a global 'pause all' must beat a per-category opt-in, because the user who set it will not remember they had opted in." },
      { t: "h2", text: "Provider failure, and why retrying forever is wrong" },
      { t: "p", html: "Wrap each provider in a circuit breaker so a spike of timeouts trips it and traffic moves to the secondary rather than piling up retries against a dying endpoint. Then give every notification a time-to-live derived from its type, because relevance decays: a 'your driver has arrived' notification delivered six hours late is worse than no notification at all, while a 'your invoice is ready' can wait. When a provider recovers, drain the backlog through the expiry filter first — of the 2.4 million queued in the arithmetic above, the ones worth sending are the ones still inside their TTL. Record and count the drops; a silent discard is how you end up unable to explain a support ticket." },
      { t: "h2", text: "Rate limiting a user's attention" },
      { t: "p", html: "A viral post can generate thousands of events for one user in minutes. Without a cap, you send thousands of notifications, the user disables them permanently, and you have lost the channel forever — for every future notification, including the important ones. Apply a ladder: per type, per channel, per user, per hour and per day, with the digest layer absorbing the overflow into a single 'and 1,240 others' summary. The mechanics are exactly the token buckets and sliding windows from the <a href=\"#/breakdowns/scale/rate-limiter\">rate limiter</a>, applied to a human's attention rather than to an API quota — and the same alert-fatigue reasoning drives the hysteresis rules in the <a href=\"#/breakdowns/scale/price-tracker\">price tracker</a>." },

      { t: "h", text: "8 · How this scores at each level" },
      { t: "table",
        headers: ["Level", "Expected on this problem", "Common miss"],
        rows: [
          ["Mid", "A queued notification service with per-channel workers, a preference check, and retries with backoff.", "Synchronous provider calls from the producing service, or one shared queue for all channels."],
          ["Senior", "Derived idempotency keys with a conditional insert, per-provider circuit breakers with failover, dead-letter handling, and a correct account of at-least-once semantics.", "Writes the dedup record after the send, which is exactly the window that produces duplicates."],
          ["Staff", "Prices the channel mix and lets cost drive routing, treats notification TTL and digest bundling as user-trust mechanisms, and designs the preference model as an enforced invariant rather than configuration.", "Reliable delivery of notifications that nobody wants — no attention rate limit, no digest, no story for the event storm."]
        ]
      },
      { t: "note", variant: "key", html: "<strong>Derive the key from the event, write it before the send, and give every notification an expiry.</strong> At-least-once queues make duplicates inevitable at the transport layer, so the deduplication has to be a conditional insert on a deterministic key — and once you have that, retries, duplicate callers and provider replays all collapse into the same harmless no-op." },
      { t: "quiz", id: "breakdowns-scale" }
    ]
  });

  var MODULE = {
    id: "scale",
    name: "Scale & Infrastructure",
    icon: "trend",
    lessons: LESSONS
  };

  /* ---------- order-independent registration: only ever PUSH ---------- */
  window.TRACKS = window.TRACKS || {};
  var T = window.TRACKS.breakdowns || (window.TRACKS.breakdowns = { id: "breakdowns", modules: [] });
  T.modules = T.modules || [];
  T.modules.push(MODULE);
})();
