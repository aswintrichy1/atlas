/* =====================================================================
   BLUEPRINT · System Design Patterns
   window.TRACKS.sdpatterns  ·  widgets + quizzes owned by this file

   Seven recurring shapes that show up across most design problems.
   Every lesson uses the same template:
     1. The requirement that summons it
     2. Mental model
     3. The solution ladder (Naive / Solid / Standout)
     4. Mechanism
     5. Failure modes
     6. "Spotting it in a prompt" cue
     7. Closing key note
   ===================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Widgets owned by this file
  ------------------------------------------------------------------ */
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

  function shell(mount, pill, title, desc) {
    mount.classList.add("widget");
    mount.appendChild(h("div", { class: "widget-head" },
      h("span", { class: "w-pill" }, pill),
      h("h3", {}, title)));
    if (desc) mount.appendChild(h("p", { class: "widget-desc" }, desc));
    return mount;
  }

  function fmt(n) {
    if (typeof n !== "number" || !isFinite(n)) return "0";
    var abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (abs >= 1e4) return Math.round(n / 1e3) + "k";
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + "k";
    if (abs >= 10) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function fmtMem(mb) {
    if (typeof mb !== "number" || !isFinite(mb)) return "0 MB";
    return mb >= 1024 ? fmt(mb / 1024) + " GB" : fmt(mb) + " MB";
  }

  function escText(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* --- sdpatFanout: pick the delivery mechanism --------------------- */
  Widgets.sdpatFanout = function (mount) {
    shell(mount, "chooser", "Pick the delivery mechanism",
      "Set the direction of the updates, how often they happen, and how many clients are connected at once. The recommendation and its arithmetic are deterministic \u2014 the same inputs always give the same answer.");

    var state = { dir: "s2c", rate: "seconds", clients: "10000" };

    function segControl(label, opts, key) {
      var wrap = h("div", { class: "w-seg" });
      var btns = [];
      for (var i = 0; i < opts.length; i++) {
        (function (opt) {
          var b = h("button", { class: opt.value === state[key] ? "active" : "" }, opt.label);
          b.addEventListener("click", function () {
            state[key] = opt.value;
            for (var j = 0; j < btns.length; j++) btns[j].classList.remove("active");
            b.classList.add("active");
            paint();
          });
          btns.push(b);
          wrap.appendChild(b);
        })(opts[i]);
      }
      return h("label", { class: "w-field" }, label + " ", wrap);
    }

    var input = h("input", { type: "number", min: "1", step: "100", value: state.clients, style: "width:9rem" });
    input.addEventListener("input", function () { state.clients = input.value; paint(); });
    input.addEventListener("change", function () { state.clients = input.value; paint(); });

    var controls = h("div", { class: "widget-controls" },
      segControl("direction", [
        { value: "s2c", label: "server \u2192 client" },
        { value: "duplex", label: "bidirectional" }
      ], "dir"),
      segControl("message rate", [
        { value: "rare", label: "rare" },
        { value: "seconds", label: "seconds" },
        { value: "sub", label: "sub-second" }
      ], "rate"),
      h("label", { class: "w-field" }, "concurrent clients ", input)
    );

    var profileRo = h("span", { class: "ro" });
    var mechRo = h("span", { class: "ro" });
    var connRo = h("span", { class: "ro" });
    var reqRo = h("span", { class: "ro" });
    var msgRo = h("span", { class: "ro" });
    var overheadRo = h("span", { class: "ro" });
    var costRo = h("span", { class: "ro" });

    var readout = h("div", { class: "w-readout" }, profileRo, mechRo, connRo, reqRo, msgRo);
    var readout2 = h("div", { class: "w-readout", style: "margin-top:8px" }, overheadRo, costRo);

    function parseClients(raw) {
      var text = String(raw == null ? "" : raw);
      var n = parseFloat(text.replace(/[^0-9.eE+-]/g, ""));
      if (typeof n !== "number" || !isFinite(n) || n <= 0) return { value: 1000, guessed: true, raw: text };
      return { value: Math.round(clamp(n, 1, 50000000)), guessed: false, raw: text };
    }

    function paint() {
      var parsed = parseClients(state.clients);
      var clients = parsed.value;
      var rateLabel = state.rate === "rare" ? "rare (about one update per client per hour)"
        : state.rate === "seconds" ? "every few seconds" : "sub-second";
      // server-to-client deliveries per client per minute
      var perClientPerMin = state.rate === "rare" ? 0.02 : (state.rate === "seconds" ? 6 : 120);
      var mech, held, reqPerMin, cost;

      if (state.dir === "s2c") {
        if (state.rate === "rare" && clients <= 5000) {
          mech = "Short polling on a 30 s interval";
          held = 0;
          reqPerMin = clients * 2;
          cost = "The cost is a latency floor equal to the poll interval, and almost every request returns nothing.";
        } else if (state.rate === "seconds" && clients <= 200) {
          mech = "Long polling with a 30 s hold";
          held = clients;
          reqPerMin = Math.round(clients * (2 + perClientPerMin));
          cost = "The cost is a fresh round trip after every single message, which stops paying off the moment updates get frequent.";
        } else {
          mech = "Server-sent events";
          held = clients;
          reqPerMin = Math.ceil(clients * 0.02);
          cost = "The cost is a one-way channel plus held connections \u2014 anything the client needs to send still rides a normal request.";
        }
      } else if (state.rate === "rare") {
        mech = "Server-sent events down, ordinary requests up";
        held = clients;
        reqPerMin = Math.ceil(clients * 0.02) + Math.round(clients * perClientPerMin);
        cost = "The cost is two paths to reason about, but you avoid running a socket tier for a trickle of traffic.";
      } else {
        mech = "WebSockets";
        held = clients;
        reqPerMin = Math.ceil(clients * 0.02);
        cost = "The cost is that connection state, reconnection and missed-message replay all become yours to build and operate.";
      }

      var deliveries = clients * perClientPerMin;
      var overhead;
      if (held === 0) {
        var rps = reqPerMin / 60;
        overhead = rps < 100
          ? "no held state; about " + fmt(rps) + " req/s folds into the API tier you already run"
          : rps < 2000
            ? "no held state, but about " + fmt(rps) + " req/s is a real slice of API capacity"
            : "no held state, and at about " + fmt(rps) + " req/s polling is now your dominant traffic";
      } else {
        var mb = held * 10 / 1024; // order-of-magnitude: ~10 KB of state per idle connection
        overhead = held <= 10000
          ? "roughly " + fmtMem(mb) + " of connection state; a single gateway node still copes"
          : held <= 200000
            ? "roughly " + fmtMem(mb) + " of connection state; you need a small gateway fleet and a registry of which node holds whom"
            : "roughly " + fmtMem(mb) + " of connection state; connections are their own tier, with their own capacity plan and on-call";
      }

      profileRo.innerHTML = "profile <b>" + (state.dir === "s2c" ? "server \u2192 client" : "bidirectional")
        + " \u00b7 " + rateLabel + " \u00b7 " + fmt(clients) + " clients</b>"
        + (parsed.guessed ? " <em>(cannot read \u201c" + escText(parsed.raw) + "\u201d \u2014 assuming 1,000)</em>" : "");
      mechRo.innerHTML = "reach for <b>" + mech + "</b>";
      connRo.innerHTML = "held connections <b>" + (held === 0 ? "none" : fmt(held)) + "</b>";
      reqRo.innerHTML = "new requests/min <b>" + fmt(reqPerMin) + "</b>";
      msgRo.innerHTML = "deliveries/min <b>" + fmt(deliveries) + "</b>";
      overheadRo.innerHTML = "per-client overhead <b>" + overhead + "</b>";
      costRo.innerHTML = "main cost <b>" + cost + "</b>";
    }

    mount.appendChild(controls);
    mount.appendChild(h("div", { class: "w-stage" }, readout, readout2));
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ------------------------------------------------------------------
     Quizzes owned by this file
  ------------------------------------------------------------------ */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "sdpatterns-delivery": {
      title: "Delivery patterns checkpoint",
      sub: "Pushing updates to clients, and moving bytes that are too big for your API.",
      questions: [
        {
          q: "An internal dashboard shows a figure that changes about once an hour, for roughly 300 users. What is the defensible first choice?",
          options: [
            "Short polling every 30 seconds",
            "WebSockets behind a dedicated gateway fleet",
            "Server-sent events with a pub/sub fan-out layer",
            "Long polling with a ten-minute hold"
          ],
          answer: 0,
          explain: "Three hundred clients polling twice a minute is 600 requests per minute, which disappears into an API tier you already operate. The latency floor of thirty seconds is irrelevant when the underlying number changes hourly. Persistent-connection tiers are a real subsystem \u2014 registries, reconnection, capacity planning \u2014 and here you would be paying for all of it to save nothing."
        },
        {
          q: "What does server-sent events give you that plain WebSockets does not?",
          options: [
            "Full-duplex messaging over a single connection",
            "Automatic reconnection with a last-event id, over ordinary HTTP",
            "Binary frames without base64 overhead",
            "Freedom from the per-origin connection limits of HTTP/1.1"
          ],
          answer: 1,
          explain: "Server-sent events is a one-way, text-only channel over an ordinary long-lived HTTP response, and the browser reconnects for you, replaying the id of the last event it saw so the server can resume. Full duplex and binary frames are exactly what WebSockets adds. Per-origin connection limits under HTTP/1.1 hurt server-sent events more than most transports, so that option is backwards."
        },
        {
          q: "Your WebSocket gateway fleet sits behind a load balancer and you roll a deploy. Which failure should you design for first?",
          options: [
            "The load balancer rewrites frames and corrupts payloads",
            "Messages published during the deploy are lost forever because pub/sub is synchronous",
            "Every client reconnects at the same moment, and the storm overloads both the gateways and the session lookup behind them",
            "Clients silently fall back to long polling and double their bandwidth"
          ],
          answer: 2,
          explain: "Dropping a gateway drops every connection it held, and those clients all retry immediately unless you make them do otherwise. The mitigations are randomised backoff on the client, staggered draining so you never cycle the whole fleet at once, and enough headroom to absorb a reconnect burst. Frame corruption and silent transport downgrades are not things a correctly configured proxy does."
        },
        {
          q: "Why is streaming a 200 MB upload through your own API servers the Naive tier?",
          options: [
            "Object storage rejects writes that do not originate in a browser",
            "You cannot compute a checksum unless the bytes go straight to storage",
            "Presigned URLs are the only way to enforce a content type",
            "The transfer occupies an application worker and its connection for the entire upload, so slow clients consume capacity that has nothing to do with computation"
          ],
          answer: 3,
          explain: "A user on a weak mobile link can hold one of your workers for minutes while doing no work you care about, and you pay to receive the bytes and again to forward them. Capacity that should be sized by request rate ends up sized by the slowest uploader. Checksums and content-type enforcement are perfectly possible either way \u2014 they are not the reason to move the bytes off your path."
        },
        {
          q: "You issue a presigned upload URL and the client reports success. What should flip the record from pending to ready?",
          options: [
            "A server-side verification triggered by a storage event, checking the real size, the actual bytes against the declared type, and whatever scanning you require",
            "The client's success callback, since it is the only party that observed the transfer finish",
            "A nightly batch job that lists the bucket",
            "Nothing \u2014 the URL's short expiry already guarantees the object is valid"
          ],
          answer: 0,
          explain: "You never received the bytes, so you cannot take the client's word for what landed. The storage layer can notify you when an object appears; a small worker then inspects it and only then promotes the record. A nightly sweep is a useful backstop for orphans but far too slow to be the promotion path, and an expiry constrains when a write may happen, not what was written."
        },
        {
          q: "What does multipart upload buy you over a single presigned PUT?",
          options: [
            "It removes the need to keep metadata in your own database",
            "Parts upload in parallel and a failed part is retried alone, so a dropped connection costs one chunk instead of the whole file",
            "It lets the client bypass the CDN on the read path",
            "It encrypts each chunk under a different key"
          ],
          answer: 1,
          explain: "Resumability is the point: the client tracks an upload id and the parts it has completed, so a network blip costs a few megabytes of rework rather than restarting a multi-gigabyte transfer. Parallel parts also help saturate a link that a single stream cannot. Metadata still belongs in your database, and encryption and read-path caching are orthogonal concerns."
        }
      ]
    },

    "sdpatterns-scaling": {
      title: "Scaling patterns checkpoint",
      sub: "Replicas, caches, read models, sharding, and the durable log.",
      questions: [
        {
          q: "You add read replicas. A user posts a comment, immediately reloads, and does not see it. What is happening and what is the standard fix?",
          options: [
            "The cache is stale; lower the TTL",
            "The write silently failed; add a retry",
            "Replication lag \u2014 route that user's reads to the primary for a short window after their write, or make the read wait until the replica has reached the position of that write",
            "The load balancer is using least-connections; switch to round robin"
          ],
          answer: 2,
          explain: "Asynchronous replication means a replica trails the primary, usually by milliseconds but by seconds or worse during write bursts and long transactions. Read-your-own-writes is the specific guarantee you have broken, and it is the one users notice instantly. Both fixes are targeted: pin that one session to the primary briefly, or carry the write's log position on the read and wait for the replica to catch up."
        },
        {
          q: "A very hot key expires and hundreds of requests miss the cache at the same instant. Which mitigation addresses that directly?",
          options: [
            "Add more read replicas",
            "Move the cache to a larger instance",
            "Shard the cache by user id",
            "Let a single request recompute while the others serve the previous value or wait on a per-key lock"
          ],
          answer: 3,
          explain: "A stampede is a concurrency problem on one key, not a capacity problem, so more replicas or more cache memory does not touch it. Collapsing the misses \u2014 one recomputation, everyone else served stale or blocked briefly \u2014 is the fix, usually combined with jittered TTLs and refreshing slightly before expiry. Sharding spreads keys across nodes but leaves the hot key just as hot."
        },
        {
          q: "Which statement about denormalised read models is accurate?",
          options: [
            "They turn a multi-table read into a single lookup, at the cost of write amplification and a window in which the model trails the source of truth",
            "They remove the consistency trade-off, because the data now lives in one place",
            "They are only possible on a graph database",
            "They make caching unnecessary"
          ],
          answer: 0,
          explain: "A read model is a precomputed answer to a specific query, maintained by whatever consumes your change stream. Reads become trivial; the price is that one logical write now updates several places, and there is always a moment when the model has not caught up. That is a consistency trade-off you moved, not one you removed."
        },
        {
          q: "You shard a table on a monotonically increasing timestamp. What goes wrong?",
          options: [
            "Cross-shard joins become impossible",
            "Every current write lands on the newest shard, so one node absorbs the entire write rate while the rest idle",
            "Consistent hashing stops working",
            "Reads accidentally become strongly consistent"
          ],
          answer: 1,
          explain: "A sharding key must spread the writes you actually receive, and \"now\" is the same value for everyone. Time-ordered keys concentrate all live traffic on one range, which is the textbook hot shard. If you need time ordering for queries, keep it inside the shard and choose something high-cardinality \u2014 a tenant, a user, a hash bucket \u2014 for the shard itself."
        },
        {
          q: "You shard a relational database by tenant id. What do you actually give up?",
          options: [
            "Secondary indexes",
            "The ability to take backups",
            "Cheap transactions and joins that cross a shard boundary \u2014 anything spanning shards now needs a distributed protocol or an application-level workflow with compensation",
            "Single-statement transactions"
          ],
          answer: 2,
          explain: "Inside a shard you still have an ordinary database with indexes, transactions and backups. What disappears is the free ride across shards: a query touching two tenants becomes a scatter-gather, and a write touching two tenants is no longer atomic. Designs survive this by making the shard boundary line up with the boundary of a business transaction."
        },
        {
          q: "Why does putting an append-only log in front of your storage help a write-heavy system?",
          options: [
            "It makes writes strongly consistent across regions",
            "It compresses writes so the database stores less",
            "It removes the need to shard",
            "It absorbs bursts durably at sequential-write speed and lets consumers apply changes at their own pace \u2014 at the cost of readers seeing data late and consumers having to be idempotent"
          ],
          answer: 3,
          explain: "Appending to a partitioned log is close to the cheapest durable write available, so the ingest path stops being coupled to how fast your database can apply changes. The queue absorbs the spike and consumers drain it. You pay for that with a visible lag between accepting a write and being able to read it, and with redelivery, which is why every consumer must be safe to run twice."
        }
      ]
    },

    "sdpatterns-coordination": {
      title: "Coordination patterns checkpoint",
      sub: "Contention, background work, and workflows that span services.",
      questions: [
        {
          q: "Two requests both read stock = 1, both conclude the item is available, and both write stock = 0. What is this, and which tier behaves this way?",
          options: [
            "A lost update, under unprotected read-modify-write",
            "A deadlock, under pessimistic locking",
            "A phantom read, under optimistic concurrency",
            "A split brain, under single-writer serialisation"
          ],
          answer: 0,
          explain: "Both writers based their decision on the same stale read, so one write silently overwrites the other and you have sold two of one item. That is the definition of a lost update, and it is exactly what the unprotected bottom rung of the ladder allows. Every rung above it exists to stop two writers acting on the same version of a row."
        },
        {
          q: "Which description of optimistic concurrency control is correct?",
          options: [
            "Take a lock, write, release the lock",
            "Write conditionally on the version you read; if the update matches zero rows, someone else won, so re-read and retry or fail the request",
            "Write unconditionally and reconcile conflicts later with a merge function",
            "Queue every write in the system behind every other write"
          ],
          answer: 1,
          explain: "Nothing is locked. You carry the version you read into the update predicate, and the storage engine decides the winner atomically. The affected-row count is your conflict signal \u2014 zero means the row moved under you. This is cheap when conflicts are rare and turns into a retry storm when they are not, which is the reason the ladder does not stop here."
        },
        {
          q: "You hold a distributed lock with a 30-second TTL, your process pauses for 40 seconds, then writes. What protects the data?",
          options: [
            "Nothing can go wrong \u2014 the lock service guarantees mutual exclusion",
            "Setting the TTL to zero so the lock never expires",
            "A fencing token issued with the lock, which the resource checks and rejects if it is older than the last token it accepted",
            "Retrying the write three times"
          ],
          answer: 2,
          explain: "A lock with an expiry is a lease, and a lease can end while its holder still believes it is the holder \u2014 a long pause, a stalled disk, a network partition. The lock service cannot help, because from its point of view the lease simply expired. Only the resource being protected can settle it, by refusing writes stamped with a token older than the newest one it has seen. A lock without expiry just replaces this failure with a permanent one."
        },
        {
          q: "Why does at-least-once delivery force handlers to be idempotent?",
          options: [
            "Because the broker may reorder messages",
            "Because exactly-once delivery is off by default and can simply be enabled",
            "Because handlers have to be stateless",
            "Because a message can arrive more than once \u2014 a lost acknowledgement, a worker crash, or a visibility timeout expiring while the work is still running \u2014 so running twice must leave the same end state as running once"
          ],
          answer: 3,
          explain: "At-least-once is a promise about the floor, not the ceiling: the broker will keep trying until it sees an acknowledgement, and it cannot tell a slow worker from a dead one. So duplicates are normal operation rather than an incident. You make the handler safe by keying side effects \u2014 a charge id, a message id, a conditional state transition \u2014 so the second run recognises the first and does nothing."
        },
        {
          q: "Which signal should drive autoscaling for a worker pool draining a queue?",
          options: [
            "Queue depth together with the age of the oldest message",
            "The rate of HTTP 500s at the API tier",
            "Worker CPU utilisation",
            "The number of connected clients"
          ],
          answer: 0,
          explain: "Depth tells you how much work is outstanding and age tells you how badly you are already late, which is what users actually feel. CPU is misleading for workers that spend most of their time waiting on other services \u2014 the pool can be saturated and idle-looking at the same time. Whatever you scale on, remember the databases downstream do not scale with your worker count."
        },
        {
          q: "What is a dead-letter queue for?",
          options: [
            "Keeping successfully processed messages for audit",
            "Holding messages that failed repeatedly, so one poison message stops burning retry budget and can be inspected and replayed after a fix",
            "Buffering overflow when the primary queue is full",
            "Replicating the queue into another region"
          ],
          answer: 1,
          explain: "Some failures are permanent \u2014 a malformed payload, a reference to something deleted \u2014 and retrying them forever wastes capacity and can block an ordered partition behind them. Moving a message aside after a bounded number of attempts keeps the main flow healthy and turns the failure into something a human can look at. Depth on that queue should page someone; a silent dead-letter queue is just a slower way of losing data."
        },
        {
          q: "Which statement about saga compensation is right?",
          options: [
            "A compensation rolls the step back exactly, the way a database transaction would",
            "Compensations run in the same order as the forward steps",
            "A compensation is a new business action that semantically undoes an earlier one \u2014 a refund, a cancellation, a correcting notice \u2014 and it must itself be idempotent and retryable",
            "A saga needs a two-phase commit coordinator to function"
          ],
          answer: 2,
          explain: "The forward step already committed in another service, so there is nothing to roll back; you can only issue a new action that restores the business meaning. Compensations run in reverse order, and they run in the same unreliable world as everything else, so they get retried and must tolerate being applied twice. Steps that genuinely cannot be undone \u2014 an email sent, an irreversible payout \u2014 belong last, or behind a reserve-then-confirm split."
        },
        {
          q: "What problem does the outbox pattern solve?",
          options: [
            "It makes event consumers idempotent automatically",
            "It orders events globally across every service",
            "It removes the need for a message broker",
            "The dual-write problem \u2014 the state change and its event commit in one local transaction, so you can never end up with a row and no event, or an event and no row"
          ],
          answer: 3,
          explain: "Writing to your database and then publishing to a broker is two writes with a gap between them, and a crash in that gap leaves the system inconsistent in a way nothing detects. Writing the event into a table in the same transaction makes the pair atomic, and a relay ships rows from that table afterwards. The relay may publish a row twice after a crash, which is exactly why consumers still need to deduplicate."
        }
      ]
    }
  });

  /* ------------------------------------------------------------------
     Track registration
  ------------------------------------------------------------------ */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sdpatterns = {
    id: "sdpatterns",
    name: "System Design Patterns",
    short: "PATTERN",
    tagline: "Name the shape before you draw the boxes",
    color: "#5eead4",
    blurb: "Most design prompts are seven problems wearing different clothes: get updates to clients, move big files, scale reads, scale writes, arbitrate contention on one item, run work that outlives a request, and hold a multi-service process together. This track trains recognition. Each lesson starts from the phrasing that summons the pattern, walks a Naive / Solid / Standout ladder so you can see what each rung buys and costs, and ends with the cues that should make you reach for it within seconds of hearing the requirement.",
    modules: [

      /* ==================== MODULE 1 · DELIVERY ==================== */
      {
        id: "delivery",
        name: "Getting Data To Clients",
        icon: "share",
        lessons: [

          /* ---------- 1. realtime-updates ---------- */
          {
            id: "realtime-updates",
            title: "Real-time updates: pushing change to clients",
            summary: "Short polling to WebSockets, the fan-out layer behind them, and how to pick from direction and message rate alone.",
            minutes: 11,
            tags: ["patterns", "realtime", "websockets", "sse"],
            blocks: [
              { t: "p", html: "This track is about <strong>recognition</strong>. Almost every design prompt is one of seven recurring shapes in costume, and the candidate who names the shape out loud in the first minute buys themselves ten minutes of thinking time and sounds like they have shipped one before. We start with the pattern that appears in more prompts than any other: getting a change that happened on the server into a client's hands without the user pressing anything." },
              { t: "p", html: "Everything here assumes nothing beyond the basics: a client, an HTTP request, a server. If you have never built a live feature, this lesson is the on-ramp \u2014 read it front to back and the other six will feel familiar." },

              { t: "h", text: "The requirement that summons it" },
              { t: "p", html: "You are in this pattern the moment the prompt implies the screen must change while the user is looking at it. The give-away phrasings are remarkably consistent." },
              {
                t: "ul", items: [
                  "\u201cUsers should see new messages <strong>without refreshing</strong>.\u201d",
                  "\u201cThe price / score / position ticks <strong>live</strong>.\u201d",
                  "\u201cShow a <strong>typing indicator</strong>, presence dot, or read receipt.\u201d",
                  "\u201cSeveral people edit the <strong>same document</strong> at once.\u201d",
                  "\u201cSend the user a <strong>notification</strong> when their export finishes.\u201d",
                  "\u201cThe driver's location updates <strong>on the map</strong> as they move.\u201d"
                ]
              },
              { t: "note", variant: "tip", html: "Two questions answer most of this lesson: <strong>which direction do messages flow</strong>, and <strong>how often</strong>. Ask those before naming a technology and the choice usually makes itself." },

              { t: "h", text: "Mental model" },
              { t: "p", html: "HTTP is a <em>pull</em> protocol. The client asks, the server answers, the exchange ends. Nothing in that model lets a server speak first. So every option below is one of exactly two tricks: <strong>ask repeatedly and pretend it is a push</strong>, or <strong>keep a channel open so the server can write down it whenever it likes</strong>." },
              { t: "p", html: "Picture a shop. Polling is a customer walking to the counter every thirty seconds to ask whether their order is ready \u2014 simple, and mostly wasted trips. Long polling is the customer standing at the counter and the clerk simply not answering until there is news. Server-sent events is the clerk handing over a one-way intercom. WebSockets is a phone line both parties can talk on. The further down that list you go, the more state you are holding open on the server, and state you hold open is state you must plan capacity for, replicate, and recover after a deploy." },

              { t: "h", text: "The solution ladder" },
              {
                t: "table",
                headers: ["Tier", "Approach", "How it behaves", "Why you move on"],
                rows: [
                  ["<strong>Naive</strong>", "Short polling", "Client asks on a fixed timer; server answers immediately, usually with \u201cnothing new\u201d", "Latency floor equals the interval, and you pay for a full request cycle \u2014 headers, auth, a query \u2014 to learn nothing. At 100k clients on a 5 s timer that is over a million requests a minute of mostly empty answers."],
                  ["<strong>Solid</strong>", "Long polling", "Client asks; server holds the request open until there is news or a timeout around 30 s, then the client asks again", "Latency drops to near-zero, and it works through every proxy on earth. But each message costs a fresh round trip and reconnect, so cost scales with <em>message rate</em>, not just client count."],
                  ["<strong>Solid</strong>", "Server-sent events", "One long-lived HTTP response the server keeps writing to; the browser reconnects on its own and replays the id of the last event it saw", "Ideal for one-way streams. Text only, one direction only, and under HTTP/1.1 the per-origin connection limit bites if you open several."],
                  ["<strong>Standout</strong>", "WebSockets", "One upgraded connection, full duplex, text or binary, minimal framing overhead", "The right answer for genuinely bidirectional or high-rate traffic \u2014 and the most expensive thing on this list to operate."],
                  ["<strong>Honest</strong>", "Any persistent transport at scale", "Millions of open connections", "This stops being a transport choice and becomes a subsystem: a connection registry, a fan-out bus, deploy choreography, reconnect storms, and a capacity model measured in connections rather than requests per second."]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>Do not skip to WebSockets to sound advanced.</strong> A one-way stream at a handful of messages per minute is a server-sent-events problem, and saying so demonstrates more judgement than reaching for the heaviest tool. Reaching down the ladder deliberately is a senior move; reaching up reflexively is not." },

              { t: "h", text: "Mechanism: connections, fan-out, and who holds whom" },
              { t: "p", html: "The instant you keep connections open, one fact dominates the design: <strong>a connection lives on exactly one server</strong>. When something interesting happens \u2014 a new message in a room, a price change \u2014 the service that produced it has no idea which of your fifty gateway nodes is holding the affected clients. You need an indirection, and that indirection is a pub/sub layer." },
              {
                t: "code", lang: "text", code:
                  "Clients ---- persistent connections ----> Gateway tier (stateful)\n" +
                  "                                            |  subscribes to topics\n" +
                  "                                            v\n" +
                  "                                   Pub/sub bus (Redis, Kafka, NATS)\n" +
                  "                                            ^\n" +
                  "                                            |  publish(topic, event)\n" +
                  "  Business services (stateless) -------------+\n" +
                  "\n" +
                  "Gateway node responsibilities\n" +
                  "  1. authenticate the connection once, at upgrade time\n" +
                  "  2. record  user -> {node, connection}  in a shared registry (TTL + heartbeat)\n" +
                  "  3. subscribe to the topics this connection cares about\n" +
                  "  4. write matching events down the socket, dropping slow consumers\n" +
                  "  5. on disconnect: unsubscribe, delete the registry entry"
              },
              { t: "p", html: "The business services stay stateless and cheap to scale, which matters \u2014 you never want your ordinary API tier to also be the thing holding a million sockets. The gateway tier is the part with a capacity model of its own: memory per connection (order of tens of kilobytes once buffers are counted), a file descriptor each, and a hard dependency on load balancers and proxies configured for long-lived connections rather than sixty-second idle timeouts." },

              { t: "h2", text: "Reconnection and missed messages" },
              { t: "p", html: "Connections drop constantly \u2014 a phone changes network, a laptop sleeps, you deploy. The transport reconnecting is not the hard part; <strong>the gap is the hard part</strong>. Messages published while the client was away must not vanish silently, because a chat that quietly loses a message is worse than one that is visibly offline." },
              {
                t: "ol", items: [
                  "Give every channel a <strong>monotonic sequence number</strong> or cursor, assigned server-side.",
                  "The client remembers the last sequence it successfully rendered.",
                  "On reconnect the client sends that value; server-sent events does this for you via the last-event id, and on WebSockets you send it in your first frame.",
                  "The server replays from a <strong>bounded buffer</strong> \u2014 the last few minutes, or the last N events per channel.",
                  "If the gap is older than the buffer, do not guess: tell the client to <strong>resync from a snapshot</strong> and resume streaming from there."
                ]
              },
              { t: "note", variant: "trap", html: "<strong>Unbounded replay buffers are a trap.</strong> \u201cWe keep every event so any client can catch up\u201d quietly turns your message bus into a database with no retention policy. Bound the buffer, and make the snapshot-and-resync path a first-class flow you have actually tested \u2014 it is the path every client takes after a long weekend." },

              { t: "widget", id: "sdpatFanout" },

              { t: "h", text: "Failure modes" },
              {
                t: "table",
                headers: ["Failure", "What you observe", "Mitigation"],
                rows: [
                  ["Reconnect storm after a deploy", "Every client reconnects within the same second; gateways and the registry lookup both spike", "Randomised exponential backoff on the client, staggered draining so you never cycle the whole fleet at once, and headroom sized for the burst"],
                  ["Fan-out amplification", "One published event becomes N socket writes; a popular channel saturates a node", "Cap subscribers per node, shard busy channels across nodes, and batch or coalesce updates that arrive faster than a human can read"],
                  ["Slow consumer", "A client on a poor link cannot drain its buffer; server memory climbs", "Bound the per-connection buffer and choose a policy up front \u2014 drop intermediate updates, or disconnect and let them resync"],
                  ["Idle proxy timeouts", "Connections die every ~60 s for no visible reason", "Application-level heartbeats every 20\u201330 s, and proxy timeouts configured to match"],
                  ["Duplicate delivery", "The same message renders twice after a reconnect", "Client-side dedupe on the event id \u2014 replay is by design, so the client must tolerate it"],
                  ["Registry drift", "Events routed to a node that no longer holds that user", "Short TTLs refreshed by heartbeat, and treat a write to a dead connection as a normal, expected event"]
                ]
              },

              { t: "h", text: "Picking, in one pass" },
              {
                t: "compare",
                bad: { title: "Server \u2192 client only", items: ["Rare updates, few clients \u2192 short polling, and be glad", "Rare updates, many clients \u2192 server-sent events", "Steady or fast stream \u2192 server-sent events", "Client still sends via ordinary requests"] },
                good: { title: "Bidirectional", items: ["Rare in both directions \u2192 events down, ordinary requests up", "Chat, collaboration, gaming \u2192 WebSockets", "Budget for a gateway tier and a registry", "Reconnect and replay are yours to build"] }
              },
              { t: "p", html: "Message rate decides the second axis. Below roughly one update per client per minute, the persistent connection is mostly idle and you are paying to hold it. Above a few per second, every trick that costs a round trip per message collapses and you want one open channel. In between, either works and the tiebreaker is operational: how much appetite do you have for a stateful tier?" },
              { t: "p", html: "Two other patterns lean on this one. Background work usually reports completion through this channel rather than making the client poll \u2014 see <a href='#/sdpatterns/coordination/long-running-tasks'>work that outlives a request</a> \u2014 and a live view is often a <a href='#/sdpatterns/scaling/scaling-reads'>denormalised read model</a> being streamed rather than queried." },

              {
                t: "cue", html: "<strong>Spotting it in a prompt.</strong> Reach for the real-time delivery pattern when you hear: <em>live</em>, <em>real time</em>, <em>without refreshing</em>, <em>as it happens</em>, <em>presence</em>, <em>typing indicator</em>, <em>collaborative editing</em>, <em>push notification</em>, <em>ticker</em>, <em>tracking on a map</em>, or any requirement stated as a delay budget (\u201cwithin a second\u201d). Then immediately ask the two questions that pick the rung: <strong>which direction</strong>, and <strong>how many messages per client per minute</strong>."
              },
              { t: "note", variant: "key", html: "<strong>Direction and rate pick the transport; the fan-out layer is the real design.</strong> One-way and infrequent is a polling or server-sent-events problem. Bidirectional or fast is WebSockets. Whichever you choose, the interesting engineering is behind it \u2014 a pub/sub bus so stateless services can reach a stateful gateway tier, a connection registry, and a sequence-plus-replay scheme so a reconnect does not silently lose a message." }
            ]
          },

          /* ---------- 2. large-blobs ---------- */
          {
            id: "large-blobs",
            title: "Large files: never let bytes touch your API",
            summary: "Presigned uploads, multipart with resume, verifying a transfer you never saw, and the CDN read path.",
            minutes: 11,
            tags: ["patterns", "uploads", "storage", "cdn"],
            blocks: [
              { t: "p", html: "The second delivery pattern is the mirror of the first: instead of a steady trickle of small messages, you have one enormous payload and the question is how to move it without your application servers becoming a bottleneck they were never sized to be." },

              { t: "h", text: "The requirement that summons it" },
              {
                t: "ul", items: [
                  "\u201cUsers <strong>upload</strong> photos, videos, attachments, or a CSV.\u201d",
                  "\u201cSupport files up to <strong>5 GB</strong>.\u201d",
                  "\u201cUploads must <strong>resume</strong> if the connection drops.\u201d",
                  "\u201cUsers <strong>download</strong> or stream that content, worldwide.\u201d",
                  "\u201cGenerate an <strong>export</strong> the user can retrieve later.\u201d",
                  "Anything where a single request body is measured in megabytes rather than kilobytes."
                ]
              },
              { t: "p", html: "The threshold is fuzzy but useful: once a payload exceeds a few megabytes, or once the transfer time is dominated by the client's link rather than your processing, you are in this pattern." },

              { t: "h", text: "Mental model" },
              { t: "p", html: "<strong>Split the problem in two.</strong> A file upload is really two very different writes wearing one name: a small piece of <em>metadata</em> (owner, filename, declared type, status) that is transactional and belongs in your database, and a large stream of <em>bytes</em> that belongs in object storage and should never pass through your code at all." },
              { t: "p", html: "Your API's job is to grant permission and record intent. The bytes go directly between the client and the storage layer, which is a service purpose-built for exactly that and priced accordingly. Think of your API as issuing a ticket rather than carrying the luggage." },

              { t: "h", text: "The solution ladder" },
              {
                t: "table",
                headers: ["Tier", "Approach", "How it behaves", "Why you move on"],
                rows: [
                  ["<strong>Naive</strong>", "Proxy the bytes through your API", "Client posts the file to your service, which streams or buffers it and forwards it to storage", "One slow uploader holds a worker and its connection for the entire transfer. Capacity that should be sized by request rate is now sized by the slowest mobile link, buffering risks memory exhaustion, and you pay to move each byte twice."],
                  ["<strong>Solid</strong>", "Presigned direct-to-storage upload", "API creates a pending record and returns a short-lived signed URL scoped to one key; the client uploads straight to storage", "Your servers never see the bytes and scale by request rate again. Still one shot: a dropped connection at 90% means starting over, which is brutal on large files."],
                  ["<strong>Standout</strong>", "Presigned + multipart + resume, CDN on the read path", "File is split into chunks, each with its own upload slot; parts go in parallel, completed parts are remembered, a completion call assembles them; reads are served from edge caches", "This is the shape you should describe by default for anything large. The cost is genuine client-side complexity and a lifecycle to manage \u2014 incomplete uploads, orphaned records, verification."]
                ]
              },
              { t: "note", variant: "tip", html: "Say the Naive tier out loud and reject it explicitly. \u201cI would not proxy the bytes, because that couples my app-server capacity to client bandwidth\u201d is one sentence that shows you understand <em>why</em> the pattern exists, not just that it is fashionable." },

              { t: "h", text: "Mechanism: the handshake" },
              {
                t: "code", lang: "text", code:
                  "1. INITIATE\n" +
                  "   client -> api   POST /uploads  {filename, declared_type, size, sha256?}\n" +
                  "   api    -> db    INSERT file(id, owner, key, status='pending', expected_size)\n" +
                  "   api    -> client {upload_id, key, part_size: 8MB, urls:[...signed slots...]}\n" +
                  "       signed slots are constrained: one exact key, one method,\n" +
                  "       a content-length range, a content-type, and a short expiry\n" +
                  "\n" +
                  "2. TRANSFER  (client <-> object storage, api not involved)\n" +
                  "   for each part i:  PUT <slot i> body=chunk_i   -> returns an etag\n" +
                  "   client persists {upload_id, completed:[{part, etag}]} locally\n" +
                  "   a dropped connection resumes from the first missing part\n" +
                  "\n" +
                  "3. COMPLETE\n" +
                  "   client -> api   POST /uploads/{id}/complete {parts:[{part, etag}]}\n" +
                  "   api    -> store CompleteMultipartUpload  (storage assembles the object)\n" +
                  "   status stays 'pending' -- the client's word is not evidence\n" +
                  "\n" +
                  "4. VERIFY  (asynchronous, triggered by a storage object-created event)\n" +
                  "   worker: real size == expected_size?\n" +
                  "           magic bytes match the declared type?\n" +
                  "           checksum matches, scan clean, dimensions/duration sane?\n" +
                  "   pass -> UPDATE file SET status='ready'   (and enqueue transcode/thumbnail)\n" +
                  "   fail -> status='rejected', delete the object, tell the user why"
              },
              { t: "p", html: "Chunk sizes in the single-digit-megabyte range are the usual compromise: small enough that losing one is cheap, large enough that per-part overhead and signing costs stay negligible. Parts upload in parallel, which also lets a client saturate a link that a single stream cannot." },

              { t: "h2", text: "Validating an upload you never received" },
              { t: "p", html: "This is the part candidates skip and interviewers notice. You granted a URL and something appeared in a bucket. <strong>You have no evidence about what it is.</strong> Defend on two fronts." },
              {
                t: "ul", items: [
                  "<strong>Constrain at signing time.</strong> Bind the signature to one object key, one HTTP method, a maximum content length, an allowed content type, and an expiry measured in minutes. A leaked URL should be near-worthless: wrong key, wrong size, or too late.",
                  "<strong>Verify after the fact.</strong> Let the storage layer notify you when an object appears, then inspect it server-side. Check the real byte count against what was declared, sniff the leading bytes rather than trusting the extension or the content-type header, run whatever scanning your risk profile requires, and only then promote the record to <code class='tok'>ready</code>.",
                  "<strong>Never let the client flip the status.</strong> A success callback is a hint that verification should start, not proof that it passed. Every reader filters on status, so a record that is not <code class='tok'>ready</code> is invisible and harmless."
                ]
              },

              { t: "h2", text: "The read path" },
              { t: "p", html: "Reads are the easier half but still worth stating. Serve through a CDN so bytes leave from an edge near the user rather than crossing an ocean on every request; set long cache lifetimes and make the object key content-addressed or versioned so a new version is a new URL and you never need to invalidate. For private content, issue short-lived signed read URLs rather than proxying, and support HTTP range requests so video players can seek without pulling the whole file." },

              { t: "h", text: "Failure modes" },
              {
                t: "table",
                headers: ["Failure", "What you observe", "Mitigation"],
                rows: [
                  ["Orphaned pending records", "Rows stuck at <code class='tok'>pending</code> forever; a bucket full of half-uploaded parts you still pay for", "A reaper job that expires stale records, plus a storage lifecycle rule that aborts incomplete multipart uploads after a fixed number of days"],
                  ["Leaked presigned URL", "A signed slot ends up somewhere it should not", "Narrow scope and short expiry, so the worst case is one overwrite of one key inside a few minutes \u2014 and version the bucket so even that is recoverable"],
                  ["Content-type lies", "A file declared an image executes as something else downstream", "Sniff magic bytes server-side, re-encode images rather than trusting them, and serve user content from a separate hostname with a forced download disposition where appropriate"],
                  ["Duplicate uploads", "The same file stored many times", "Have the client send a content hash at initiate; if the hash already exists, skip the transfer entirely and link the new record to the existing object"],
                  ["Resumability that never resumes", "The client restarts from zero after a crash because progress lived in memory", "Persist the upload id and completed part list on the device, not just in a variable"],
                  ["Verification backlog", "Uploads succeed but nothing turns <code class='tok'>ready</code> during a spike", "Treat verification as ordinary background work with its own queue and workers \u2014 see <a href='#/sdpatterns/coordination/long-running-tasks'>work that outlives a request</a>"]
                ]
              },
              { t: "p", html: "Note how the metadata record makes everything else possible. It is what gives you a state machine (<code class='tok'>pending \u2192 uploaded \u2192 ready | rejected</code>), a hook for permissions, and something to reap. Designs that skip it end up trying to reconstruct truth by listing a bucket, which is slow, expensive, and wrong the moment two clients race." },

              {
                t: "cue", html: "<strong>Spotting it in a prompt.</strong> Reach for the large-object pattern when you hear: <em>upload</em>, <em>attachment</em>, <em>photo or video</em>, <em>file size up to N</em>, <em>resumable</em>, <em>import a CSV</em>, <em>export a report</em>, <em>stream media</em>, or a payload described in megabytes or gigabytes. The first sentence out of your mouth should be <strong>\u201cmetadata through my API, bytes direct to object storage with a presigned URL\u201d</strong> \u2014 then add multipart if the files are large and a CDN if reads are global."
              },
              { t: "note", variant: "key", html: "<strong>Your API grants permission; storage moves the bytes.</strong> Keep a metadata row with an explicit status, hand out narrowly scoped short-lived signed URLs, use multipart so a dropped connection costs one chunk instead of the whole file, and never mark a record ready on the client's say-so \u2014 verify the object you never saw before anyone can read it." },
              { t: "quiz", id: "sdpatterns-delivery" }
            ]
          }
        ]
      },

      /* ==================== MODULE 2 · SCALING ==================== */
      {
        id: "scaling",
        name: "Scaling Reads & Writes",
        icon: "trend",
        lessons: [

          /* ---------- 3. scaling-reads ---------- */
          {
            id: "scaling-reads",
            title: "Scaling reads: replicas, caches, and read models",
            summary: "Push reads outward and they get faster and staler. Replication lag, stampedes, and a consistency story you can defend.",
            minutes: 11,
            tags: ["patterns", "caching", "replication", "consistency"],
            blocks: [
              { t: "p", html: "Most systems are read-heavy by a wide margin \u2014 ratios of fifty or a hundred reads per write are ordinary for anything with a feed, a catalogue, or a profile page. That imbalance is good news, because reads are the easy side: they can be copied. This lesson is the ladder for exploiting that, and the price attached to each rung." },

              { t: "h", text: "The requirement that summons it" },
              {
                t: "ul", items: [
                  "\u201cThe read-to-write ratio is roughly <strong>100:1</strong>.\u201d",
                  "\u201cMillions of people <strong>view</strong> a product page, a profile, a leaderboard.\u201d",
                  "\u201c<strong>p99 under 200 ms</strong>\u201d, or any latency target attached to a read.",
                  "\u201cThe same content is requested <strong>over and over</strong>.\u201d",
                  "\u201cThe database is <strong>fine on writes but the reads are killing it</strong>.\u201d",
                  "A homepage, dashboard, or feed that assembles data from several tables on every request."
                ]
              },

              { t: "h", text: "Mental model" },
              { t: "p", html: "Think of reads as being served by whichever layer answers first, and picture those layers as rings around the source of truth: the primary database, then replicas, then a shared cache, then a precomputed read model, then a CDN or the client itself. <strong>The further out you push a read, the faster and cheaper it gets, and the older the answer is allowed to be.</strong>" },
              { t: "p", html: "So the design question is never \u201chow do I make reads fast\u201d. It is <em>\u201chow stale may this particular read be, and what happens to the user if it is?\u201d</em> A view count can be a minute old and nobody dies. An account balance shown next to a Transfer button cannot. Different reads in the same product get different rings." },

              { t: "h", text: "The solution ladder" },
              {
                t: "table",
                headers: ["Tier", "Approach", "What it buys", "What it costs"],
                rows: [
                  ["<strong>Naive</strong>", "Buy a bigger machine", "Nothing to design, no code changes, buys real time cheaply at small scale", "A hard ceiling you cannot see until you hit it, one failure domain, and a restart that is full downtime. Fine as a stopgap, indefensible as the answer."],
                  ["<strong>Solid</strong>", "Read replicas", "Read capacity scales with replica count; a natural failover target; analytics traffic moves off the primary", "Replication is asynchronous, so replicas trail the primary \u2014 usually milliseconds, but seconds or worse under write bursts, long transactions, or a slow apply thread. You have just broken read-your-own-writes."],
                  ["<strong>Solid</strong>", "A cache with an explicit invalidation strategy", "Sub-millisecond hits, and the load reduction is nonlinear: an 80% hit rate removes four fifths of the database's read work", "You now own coherence. Every write must decide what happens to the cached copy, and \u201cwe will just use a TTL\u201d is a decision, not an escape from one."],
                  ["<strong>Standout</strong>", "Denormalised read models", "The expensive query is computed once at write time; the read is a single lookup with no joins and predictable latency", "Write amplification \u2014 one logical write updates several places \u2014 plus a rebuild path when the model's shape changes, and a window where the model trails the source of truth."]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>These are layers, not alternatives.</strong> A mature system runs all of them at once: replicas for bulk read capacity, a cache for hot keys, read models for the two or three queries that would otherwise dominate. The ladder is about the order in which you reach, not a single choice." },

              { t: "h", text: "Mechanism: cache-aside, and the read-your-own-writes fix" },
              {
                t: "code", lang: "text", code:
                  "READ (cache-aside)\n" +
                  "  v = cache.get(key)\n" +
                  "  if v != null: return v                       # hit\n" +
                  "  if not lock.acquire(key, ttl=5s):            # someone is already computing\n" +
                  "      return cache.get_stale(key) or wait_briefly_then_retry()\n" +
                  "  v = db.query(...)\n" +
                  "  cache.set(key, v, ttl = base + random(0, base/4))   # jitter, so keys\n" +
                  "  lock.release(key)                                   # never expire together\n" +
                  "  return v\n" +
                  "\n" +
                  "WRITE\n" +
                  "  db.update(...)\n" +
                  "  cache.delete(key)        # delete, do not update: an update races\n" +
                  "                           # with a concurrent read repopulating the key\n" +
                  "\n" +
                  "READ-YOUR-OWN-WRITES over replicas\n" +
                  "  on write:  session.last_write_at = now  (or capture the log position)\n" +
                  "  on read:   if now - session.last_write_at < lag_budget:\n" +
                  "                 read from primary\n" +
                  "             else:\n" +
                  "                 read from a replica"
              },
              { t: "p", html: "Two details in there carry most of the value. <strong>Delete rather than update</strong> on write: an update can be overtaken by a concurrent read that already fetched the old row and is about to write it back, leaving the cache permanently wrong. And <strong>jitter your TTLs</strong>: keys populated together expire together, which manufactures the exact stampede the next section is about." },
              { t: "p", html: "The read-your-own-writes sketch is deliberately narrow. You are not making the whole system consistent; you are routing <em>one session</em> to the primary for a few seconds after <em>its own</em> write. Everyone else keeps using replicas. If your database exposes a log position, carrying it on the read and waiting for the replica to reach it is the precise version of the same idea." },

              { t: "h", text: "Stampedes and cold caches" },
              { t: "p", html: "Two related failures, and they are the ones that take systems down rather than merely slow them." },
              {
                t: "compare",
                bad: { title: "Cache stampede (one hot key)", items: ["A popular key expires", "Hundreds of concurrent requests miss at once", "All of them run the same expensive query", "The database saturates and everything queues behind it", "Fix: single-flight per key, serve stale while one request refreshes, refresh slightly before expiry, jitter TTLs"] },
                good: { title: "Thundering herd (cold cache)", items: ["A cache node restarts, or you deploy a new cluster", "Every read misses, not just one key", "Full production traffic arrives at a database sized for 20% of it", "Fix: warm the cache before taking traffic, roll nodes one at a time, shed or queue load while it fills, and never size the database assuming the cache is up"] }
              },
              { t: "note", variant: "trap", html: "<strong>\u201cThe cache absorbs it\u201d is not a capacity plan.</strong> Ask what happens the first minute after the cache is empty. If the honest answer is that the database falls over, your real availability is the cache's availability \u2014 and you have made a distributed cache a single point of failure without meaning to." },

              { t: "h", text: "Failure modes" },
              {
                t: "table",
                headers: ["Failure", "What you observe", "Mitigation"],
                rows: [
                  ["Replication lag spike", "Users see their own writes disappear; stale reads during a bulk import", "Route recent writers to the primary, monitor lag as a first-class metric with alerts, and take a replica out of rotation when it falls behind a threshold"],
                  ["Stale cache after a write path you forgot", "One rarely used admin endpoint updates a row without invalidating; the wrong value persists for hours", "Centralise invalidation next to the write \u2014 one repository method, or a change-stream consumer \u2014 rather than sprinkling deletes across call sites"],
                  ["Hot key", "A single celebrity or product key saturates one cache shard", "Replicate that key across shards with a suffix, or add a small in-process cache in front with a very short TTL"],
                  ["Cache and database disagree permanently", "Support tickets nobody can reproduce", "Bounded TTLs even on write-through caches, so every entry is eventually re-derived from the source of truth"],
                  ["Read model drift", "The denormalised view slowly diverges from the tables it was built from", "Make the rebuild path routine and cheap, reconcile periodically, and always be able to regenerate the model from the source"],
                  ["Unbounded cache growth", "Eviction pressure, then a collapsing hit rate", "Size deliberately, choose an eviction policy on purpose, and measure hit rate per key family rather than in aggregate"]
                ]
              },

              { t: "h", text: "State the consistency story out loud" },
              {
                t: "table",
                headers: ["Guarantee", "What the user experiences", "Where it comes from"],
                rows: [
                  ["Strong", "Every read reflects every committed write", "Reads served from the primary; the expensive option, reserved for balances, inventory, permissions"],
                  ["Read-your-own-writes", "You always see your own changes; other people's may lag", "Session pinning after a write, or waiting for a log position \u2014 the default users actually expect"],
                  ["Bounded staleness", "Data may be up to N seconds old, and you know N", "TTLs plus a lag alarm; the honest answer for feeds and dashboards"],
                  ["Eventual", "It converges, with no promise about when", "Only acceptable when the user cannot tell \u2014 view counts, recommendations, aggregate stats"]
                ]
              },
              { t: "p", html: "Naming the row you have chosen, and why, is the single highest-value sentence in this pattern. \u201cReads are served from replicas with bounded staleness of about two seconds, except the checkout page, which reads the primary\u201d tells an interviewer you have shipped this. Note also that heavy write volume is what pushes replicas and read models into lag in the first place \u2014 the two halves of scaling are coupled, which is why <a href='#/sdpatterns/scaling/scaling-writes'>scaling writes</a> is the next lesson." },

              {
                t: "cue", html: "<strong>Spotting it in a prompt.</strong> Reach for the read-scaling ladder when you hear: <em>read-heavy</em>, <em>100:1 ratio</em>, <em>millions of views</em>, <em>the same content served repeatedly</em>, <em>p99 latency target</em>, <em>the database is fine until traffic spikes</em>, <em>trending</em>, <em>leaderboard</em>, or <em>feed</em>. Then, before naming a technology, ask the question that actually decides the design: <strong>how stale is this specific read allowed to be, and who notices?</strong>"
              },
              { t: "note", variant: "key", html: "<strong>Every read you push outward buys latency with staleness.</strong> Replicas add capacity and cost you read-your-own-writes; caches add speed and hand you invalidation; read models make the query trivial and make writes do more work. Layer them deliberately, jitter and single-flight to survive expiry, and be able to say in one sentence exactly how stale each read may be." }
            ]
          },

          /* ---------- 4. scaling-writes ---------- */
          {
            id: "scaling-writes",
            title: "Scaling writes: batching, sharding, and the log",
            summary: "Writes cannot be copied, only split or deferred. Shard keys, hot shards, resharding, and life without cross-shard transactions.",
            minutes: 11,
            tags: ["patterns", "sharding", "write-throughput", "queues"],
            blocks: [
              { t: "p", html: "Reads are easy because a read can be answered by any copy. Writes have no such luxury: every write must land somewhere durable, in some order, and only one place can be the authority for a given piece of data. That asymmetry is why scaling writes is the harder half and why it changes your data model rather than just your infrastructure." },

              { t: "h", text: "The requirement that summons it" },
              {
                t: "ul", items: [
                  "\u201cWe ingest <strong>millions of events per minute</strong>\u201d \u2014 clicks, metrics, telemetry, logs.",
                  "\u201cEvery user action is <strong>recorded</strong>.\u201d",
                  "\u201cSensors report <strong>every few seconds</strong>.\u201d",
                  "\u201cHigh-volume <strong>chat messages</strong>, orders, trades, or bids.\u201d",
                  "\u201cThe write rate is <strong>bursty</strong> \u2014 quiet, then ten times normal for an hour.\u201d",
                  "Any capacity estimate that comes out above a few thousand writes per second sustained."
                ]
              },
              { t: "note", variant: "tip", html: "Do the arithmetic before choosing anything. A day is about 10\u2075 seconds, so daily writes divided by 100,000 is your average rate; multiply by three to five for peak. A single well-tuned relational node handles thousands of writes per second. If your number lands under that, say so and stop \u2014 proposing a sharded cluster for 200 writes per second is a red flag, not a strength." },

              { t: "h", text: "Mental model" },
              { t: "p", html: "You have exactly three moves, and every technology below is one of them. <strong>Make each write cheaper</strong> (batch them, or use storage whose write path is sequential). <strong>Split the writes across more authorities</strong> (shard). <strong>Stop doing the write now</strong> (accept it into a durable log and apply it later)." },
              { t: "p", html: "Picture a single ledger everybody must queue to sign. Batching is signing ten entries per trip to the desk. Sharding is opening more desks, each with its own ledger and its own range of names. The log is a drop box: your entry is safely recorded the instant it lands, and a clerk transcribes it into the ledger shortly afterwards. The drop box is fast precisely because transcription has not happened yet \u2014 that gap is the whole trade-off." },

              { t: "h", text: "The solution ladder" },
              {
                t: "table",
                headers: ["Tier", "Approach", "What it buys", "What it costs"],
                rows: [
                  ["<strong>Naive</strong>", "Buy a bigger machine", "Faster disks and more memory genuinely raise the ceiling, with zero design work", "Still one authority, still one failure domain, and the ceiling arrives suddenly. A stopgap while you build the real thing."],
                  ["<strong>Solid</strong>", "Batch and buffer", "Amortises per-operation overhead \u2014 network round trips, transaction begin/commit, index maintenance. Often a several-fold improvement for a day's work", "Latency rises by up to the batch window, and anything buffered in memory is lost on a crash. Batch in a durable place, or accept the window explicitly."],
                  ["<strong>Solid</strong>", "Shard by a carefully chosen key", "Write capacity now scales with node count, which is the only move on this list with no ceiling", "You lose cheap cross-shard joins and transactions, you inherit hot shards, and resharding is a project. The key choice is effectively permanent."],
                  ["<strong>Solid</strong>", "Write-optimised storage", "LSM-tree engines turn random writes into sequential appends plus background compaction \u2014 excellent for append-heavy, time-series-shaped data", "Read amplification, compaction competing with live traffic for disk, and a query model far narrower than SQL. You are choosing a different database, not tuning one."],
                  ["<strong>Standout</strong>", "Asynchronous ingestion through a durable log", "Accepts bursts at close to sequential-write speed and decouples arrival rate from apply rate; consumers replay, fan out, and scale independently", "Readers see data late, consumers must be idempotent because delivery is at-least-once, and you now operate a log with retention, partitions and consumer lag of its own."]
                ]
              },
              { t: "p", html: "Notice these compose. A large ingestion pipeline is usually all five: clients batch, the log absorbs the burst, consumers write to a sharded write-optimised store, and someone occasionally buys a bigger machine for the one component that refuses to shard." },

              { t: "h", text: "Mechanism: choosing the shard key" },
              { t: "p", html: "This is the decision the whole pattern hangs on, and the one interviewers probe. A good shard key has three properties, and you should name all three." },
              {
                t: "ol", items: [
                  "<strong>High cardinality</strong> \u2014 enough distinct values that you can keep splitting. Country fails; user id passes.",
                  "<strong>Even distribution</strong> \u2014 traffic spread roughly equally across values, not just values spread across shards.",
                  "<strong>Alignment with your dominant query</strong> \u2014 the data a single request needs should live on one shard, or every read becomes a scatter-gather across all of them."
                ]
              },
              {
                t: "code", lang: "text", code:
                  "hash sharding      shard = hash(user_id) % N\n" +
                  "  + spreads evenly, resists hot spots\n" +
                  "  - range queries must fan out to every shard\n" +
                  "\n" +
                  "range sharding     shard = range_containing(created_at)\n" +
                  "  + range scans hit one shard\n" +
                  "  - monotonic keys send ALL current writes to the newest shard\n" +
                  "\n" +
                  "composite          shard = hash(tenant_id)            -- co-locates a tenant\n" +
                  "                   sort inside shard by (created_at)  -- keeps time queries fast\n" +
                  "\n" +
                  "hot-entity relief  shard = hash(entity_id + ':' + (seq % 16))\n" +
                  "  splits one screaming key across 16 buckets;\n" +
                  "  reads now fan out to 16 places -- pay it only where you must\n" +
                  "\n" +
                  "logical shards     4096 logical shards mapped onto 16 physical nodes\n" +
                  "  rebalancing moves whole logical shards; the key mapping never changes"
              },
              { t: "p", html: "That last line is the trick worth remembering. Hashing directly onto physical nodes means every capacity change rewrites where every row lives. Hashing onto a large fixed number of logical shards and then mapping those onto machines means growth is a metadata change plus a data copy, not a global rehash. Consistent hashing with virtual nodes solves the same problem from the other direction." },

              { t: "h2", text: "Hot shards" },
              { t: "p", html: "Even distribution of <em>keys</em> is not even distribution of <em>traffic</em>. One enterprise tenant with a thousand times the volume of the median, one celebrity account, one product during a launch \u2014 each pins a single shard at 100% while the rest idle, and the cluster's effective capacity becomes the capacity of one node. Detect it by monitoring per-shard rates rather than cluster totals, which is the metric that hides the problem. Mitigate by splitting the hot key across sub-buckets, giving genuinely enormous tenants their own dedicated shard, or buffering that key's writes and applying them in batches." },

              { t: "h2", text: "Resharding without an outage" },
              {
                t: "ol", items: [
                  "Stand up the new topology alongside the old one; nothing routes to it yet.",
                  "<strong>Double-write</strong> \u2014 every write goes to both old and new, so the new one stops falling further behind.",
                  "<strong>Backfill</strong> the history in the background, throttled so it does not starve live traffic.",
                  "<strong>Verify</strong> \u2014 compare counts and sample rows until you actually believe the copy.",
                  "Move reads over gradually, a percentage at a time, watching error rates.",
                  "Stop double-writing and decommission the old topology, keeping the rollback path alive until you are sure."
                ]
              },
              { t: "note", variant: "warn", html: "Resharding a live system is measured in weeks, not hours. That is the real reason the shard key matters so much: it is one of the few decisions in a design that is genuinely expensive to reverse. Say that out loud when you choose one." },

              { t: "h", text: "Life without cross-shard transactions" },
              { t: "p", html: "Inside one shard you still have an ordinary database: indexes, transactions, joins. Across shards, all of that disappears. A write touching two shards is no longer atomic, and a query touching many becomes a scatter-gather whose latency is set by the slowest participant." },
              {
                t: "ul", items: [
                  "<strong>Design the boundary to match the transaction.</strong> If everything a business operation touches shares one shard key, you never need a distributed transaction. This is why tenant id is such a common choice.",
                  "<strong>Denormalise across the boundary.</strong> Copy the few fields the other side needs rather than joining for them.",
                  "<strong>Use a workflow with compensation</strong> when an operation genuinely spans shards \u2014 that is the <a href='#/sdpatterns/coordination/multi-step-processes'>multi-step process</a> pattern, and it applies to shards exactly as it does to services.",
                  "<strong>Push aggregates to a separate system.</strong> Cluster-wide counts and reports belong in an analytical store fed by the log, not in a fan-out query across every shard on the read path."
                ]
              },

              { t: "h", text: "Failure modes" },
              {
                t: "table",
                headers: ["Failure", "What you observe", "Mitigation"],
                rows: [
                  ["Hot shard", "One node at 100%, cluster average at 20%", "Per-shard dashboards, key salting, dedicated shards for outlier tenants"],
                  ["Buffered writes lost", "A crash loses the last few seconds of accepted data", "Buffer in a durable log rather than process memory, or acknowledge only after the durable write"],
                  ["Consumer lag grows without bound", "The log accepts everything; readers fall minutes then hours behind", "Alert on lag, not just on errors; scale consumers on lag; make sure the sustained apply rate genuinely exceeds the sustained arrival rate"],
                  ["Duplicate applies", "Counts drift upward after a redelivery", "At-least-once means idempotent consumers \u2014 dedupe on event id or use conditional writes"],
                  ["Compaction storms", "Periodic latency spikes on an LSM store", "Throttle compaction, provision headroom, and schedule heavy maintenance away from peak"],
                  ["Retention surprise", "The log expires data a lagging consumer had not read yet", "Size retention against your worst realistic outage, and alert when a consumer's lag approaches it"]
                ]
              },

              {
                t: "cue", html: "<strong>Spotting it in a prompt.</strong> Reach for the write-scaling ladder when you hear: <em>ingest</em>, <em>events per second</em>, <em>telemetry</em>, <em>time series</em>, <em>bursty traffic</em>, <em>write-heavy</em>, <em>append-only</em>, <em>audit log</em>, or an estimate above a few thousand writes per second. Then say the three moves in order \u2014 <strong>make each write cheaper, split the authorities, or defer the work through a log</strong> \u2014 and pick your shard key out loud, justifying cardinality, distribution, and query alignment."
              },
              { t: "note", variant: "key", html: "<strong>Writes cannot be copied, only split or deferred.</strong> Batching buys a constant factor, write-optimised storage buys another, but only sharding removes the ceiling \u2014 and it costs you cross-shard transactions and hands you hot shards. A durable log in front lets you accept bursts far faster than you can apply them, at the price of readers seeing data late and every consumer needing to be idempotent." },
              { t: "quiz", id: "sdpatterns-scaling" }
            ]
          }
        ]
      },

      /* ==================== MODULE 3 · COORDINATION ==================== */
      {
        id: "coordination",
        name: "Coordination & Work",
        icon: "queue",
        lessons: [

          /* ---------- 5. contention ---------- */
          {
            id: "contention",
            title: "Contention: many writers, one item",
            summary: "Lost updates, pessimistic locks, optimistic version checks, single-writer serialisation, and the reservation problem.",
            minutes: 12,
            tags: ["patterns", "concurrency", "locking", "idempotency"],
            blocks: [
              { t: "p", html: "Scaling is about volume. This pattern is about the opposite: a single row that everybody wants at the same instant. Throughput barely matters here \u2014 correctness does, and the failure is silent. Nothing errors, nothing pages, you simply sold the same seat twice." },

              { t: "h", text: "The requirement that summons it" },
              {
                t: "ul", items: [
                  "\u201cThe <strong>last seat</strong>, the last ticket, the last unit of stock.\u201d",
                  "\u201cLimited-edition drop \u2014 <strong>ten thousand people</strong>, one hundred items.\u201d",
                  "\u201cTwo people must not <strong>book the same slot</strong>.\u201d",
                  "\u201cNever <strong>double-charge</strong> a customer.\u201d",
                  "\u201cTwo editors change the <strong>same record</strong> at once.\u201d",
                  "\u201cExactly one winner\u201d, \u201conly one leader\u201d, \u201cno oversell\u201d, \u201cthe balance must never go negative\u201d."
                ]
              },
              { t: "note", variant: "tip", html: "Say the invariant before you say the mechanism: <strong>\u201cone confirmed booking per seat per showing\u201d</strong>, or <strong>\u201cstock never goes below zero\u201d</strong>. Naming the invariant frames everything after it, and it is the sentence that tells an interviewer you understand the problem rather than the vocabulary." },

              { t: "h", text: "Mental model" },
              { t: "p", html: "The item is a shared mutable cell, and every writer performs the same three steps: read the current value, decide, write a new value. The bug is entirely in the gap between the read and the write. Two writers that read the same value both believe they are the only one acting on it, and the second write silently erases the first \u2014 a <strong>lost update</strong>." },
              { t: "p", html: "The second thing to hold: <strong>contention is per key</strong>. A ticketing system with a hundred thousand seats has no global contention problem; it has one intense contention problem on each of a few popular seats. That is why serialising per key is affordable and serialising globally is not." },

              { t: "h", text: "The solution ladder" },
              {
                t: "table",
                headers: ["Tier", "Approach", "How it behaves", "Why you move on"],
                rows: [
                  ["<strong>Naive</strong>", "Read\u2011modify\u2011write with no protection", "<code class='tok'>SELECT stock</code>, check it in application code, then <code class='tok'>UPDATE stock = 4</code>", "Lost updates. Two requests read 5, both write 4, you shipped two items and decremented once. It passes every test you write on a laptop and fails the moment two users overlap."],
                  ["<strong>Solid</strong>", "Pessimistic locking", "<code class='tok'>SELECT \u2026 FOR UPDATE</code> inside a transaction, or a distributed lock held while you work", "Correct and easy to reason about, and the right tool for short critical sections in one database. But writers queue, latency rises with contention, deadlocks appear when locks are taken in different orders, and a <em>distributed</em> lock with a TTL can expire while its holder is still running."],
                  ["<strong>Solid</strong>", "Optimistic concurrency control", "Read the row and its version; write with <code class='tok'>WHERE version = :seen</code>; zero rows affected means you lost the race, so re-read and retry", "Nothing is locked, so the uncontended path is as fast as a plain write \u2014 excellent when conflicts are rare. Under heavy contention it degrades badly: everyone retries, most retries fail, and throughput collapses."],
                  ["<strong>Standout</strong>", "Single-writer serialisation per key", "Route every mutation for a key to one consumer \u2014 a partitioned queue, an actor, a single-threaded shard owner \u2014 so operations on that key are applied one at a time by construction", "No locks and no retries, because concurrency on that key no longer exists. The cost is an asynchronous API, ordering guarantees you must actually maintain, and a per-key throughput ceiling of roughly one operation per processing latency."]
                ]
              },
              { t: "note", variant: "warn", html: "<strong>The ladder is not a ranking to memorise \u2014 conflict rate picks the rung.</strong> Rare conflicts favour optimistic checks. Frequent conflicts on a bounded set of keys favour serialisation. Short critical sections in one database favour a row lock. Say which regime you are in and the choice follows." },

              { t: "h", text: "Mechanism: the version check, done correctly" },
              {
                t: "code", lang: "text", code:
                  "OPTIMISTIC UPDATE\n" +
                  "  row = SELECT id, stock, version FROM items WHERE id = :id\n" +
                  "  if row.stock < 1: reject('out of stock')\n" +
                  "\n" +
                  "  n = UPDATE items\n" +
                  "         SET stock = stock - 1, version = version + 1\n" +
                  "       WHERE id = :id AND version = :row.version AND stock > 0\n" +
                  "\n" +
                  "  if n == 0:                  # someone else committed first\n" +
                  "      retry (bounded, with jitter) or fail cleanly\n" +
                  "\n" +
                  "  The predicate is the guarantee. The engine evaluates it atomically,\n" +
                  "  so exactly one of two racing writers can match a given version.\n" +
                  "  Same idea elsewhere: a conditional write in a document store,\n" +
                  "  compare-and-set in a key-value store, If-Match with an ETag over HTTP.\n" +
                  "\n" +
                  "RESERVATION (seats, and anything with a hold)\n" +
                  "  reserve:  INSERT reservation(seat_id, user, expires_at = now + 10m)\n" +
                  "            -- a UNIQUE constraint on active seat_id does the arbitration\n" +
                  "            -- for you: the database rejects the second inserter\n" +
                  "  confirm:  reservation -> booking, inside one transaction\n" +
                  "  expire:   a sweeper deletes holds past expires_at and frees the seat\n" +
                  "            -- and every read of availability must ignore expired holds,\n" +
                  "               so a late sweeper degrades gracefully instead of overselling"
              },
              { t: "p", html: "Two things to notice. First, <code class='tok'>stock &gt; 0</code> is in the predicate as well as the version, because a correct concurrency check and a correct business rule are not the same thing. Second, the reservation flow pushes arbitration into a <strong>unique constraint</strong> \u2014 the cheapest, most reliable mutual exclusion available to you, and one that keeps working when your application servers are chaos." },

              { t: "h2", text: "Lock expiry, and the lock that outlives its holder" },
              { t: "p", html: "A distributed lock is a lease. It must have an expiry, or one crashed process blocks a key forever. But an expiry means the lock can end while the holder still believes it holds it \u2014 a long garbage-collection pause, a stalled disk, a network partition. Now two processes are inside the critical section and the lock service sees nothing wrong, because from its point of view the lease simply lapsed." },
              { t: "p", html: "The lock cannot fix this; only the protected resource can. Issue a <strong>fencing token</strong> \u2014 a number that increases every time the lock is granted \u2014 and have the resource record the highest token it has accepted and reject anything older. The stalled process wakes up, presents token 41, and the storage layer refuses it because it has already served token 42. This is the detail that separates people who have used a distributed lock from people who have been burned by one." },

              { t: "h2", text: "Idempotency keys" },
              { t: "p", html: "Retries are unavoidable: a client times out and resends, a proxy retries, a user double-clicks. Without protection, \u201ccharge this card\u201d executed twice charges twice. The fix is a client-supplied <strong>idempotency key</strong>, unique per logical operation." },
              {
                t: "ol", items: [
                  "The client generates a key for the operation and sends it with the request, resending the <em>same</em> key on every retry.",
                  "The server inserts that key into a table with a unique constraint, in the same transaction as the work \u2014 or claims it first, before doing anything with side effects.",
                  "If the insert conflicts, this is a replay: return the stored response instead of doing the work again.",
                  "Store the outcome against the key so replays are answered identically, and expire keys after a window comfortably longer than any client's retry budget."
                ]
              },
              { t: "p", html: "Idempotency keys are not exotic; they are the price of admission for any endpoint that moves money or creates something. They also appear in every other coordination lesson, because at-least-once delivery makes duplicates routine \u2014 see <a href='#/sdpatterns/coordination/long-running-tasks'>work that outlives a request</a>." },

              { t: "h", text: "Failure modes" },
              {
                t: "table",
                headers: ["Failure", "What you observe", "Mitigation"],
                rows: [
                  ["Lost update", "Oversold inventory, vanished edits, counters that drift low", "Never read-modify-write without either a lock, a version predicate, or an atomic operation in the store itself"],
                  ["Deadlock", "Transactions abort in pairs under load", "Acquire locks in a consistent global order, keep critical sections short, and set a lock timeout so a cycle resolves quickly"],
                  ["Lock held across a network call", "One slow third party stalls every writer on that key", "Do external work outside the critical section; take the lock only to commit the decision"],
                  ["Retry storm under optimistic control", "Throughput falls as contention rises; most updates match zero rows", "Bound retries, add jittered backoff, and if the conflict rate stays high, move up to serialisation"],
                  ["Expired lock, two holders", "Two processes both act; the damage is invisible until reconciliation", "Fencing tokens checked by the resource, plus leases long enough for realistic pauses"],
                  ["Holds that never expire", "Inventory slowly drains into abandoned carts", "Expiry on every reservation, a sweeper that reclaims them, and availability reads that already ignore expired holds"],
                  ["Per-key throughput ceiling", "One key serialised at, say, 200 operations per second becomes the bottleneck", "Split the item into buckets and reserve from a bucket, or admit users through a queue so demand arrives at a rate the key can absorb"]
                ]
              },

              {
                t: "cue", html: "<strong>Spotting it in a prompt.</strong> Reach for the contention pattern when you hear: <em>the last one</em>, <em>limited stock</em>, <em>no double booking</em>, <em>exactly one winner</em>, <em>flash sale</em>, <em>seat selection</em>, <em>never double-charge</em>, <em>concurrent edits</em>, <em>balance must not go negative</em>, or <em>only one leader</em>. State the invariant first, then say which rung you are on and why \u2014 and pick the rung from the <strong>conflict rate</strong>, not from habit."
              },
              { t: "note", variant: "key", html: "<strong>The bug lives in the gap between read and write, and it is silent.</strong> Close it with a predicate the storage engine evaluates atomically \u2014 a version check, a unique constraint, a conditional write \u2014 or remove the concurrency entirely by routing a key to a single writer. If you use a distributed lock, remember it is a lease: give it an expiry, and give the resource a fencing token so a stalled holder cannot come back from the dead." }
            ]
          },

          /* ---------- 6. long-running-tasks ---------- */
          {
            id: "long-running-tasks",
            title: "Work that outlives the request",
            summary: "Queues, idempotent handlers, backoff with jitter, dead-letter queues, and autoscaling on queue depth.",
            minutes: 11,
            tags: ["patterns", "queues", "async", "workers"],
            blocks: [
              { t: "p", html: "Some work simply does not fit inside a request. Transcoding a video, generating a report over ten million rows, sending a hundred thousand emails, importing a customer's spreadsheet \u2014 none of these will finish before something between the user and your server gives up. This pattern is how you accept that work honestly." },

              { t: "h", text: "The requirement that summons it" },
              {
                t: "ul", items: [
                  "\u201c<strong>Generate a report</strong> / export the data / build the invoice.\u201d",
                  "\u201c<strong>Transcode</strong> the upload into several resolutions.\u201d",
                  "\u201cSend an email or push to <strong>every affected user</strong>.\u201d",
                  "\u201c<strong>Import</strong> a large file and validate every row.\u201d",
                  "\u201cCall a slow <strong>third-party API</strong> that sometimes takes half a minute.\u201d",
                  "Anything a product manager describes with \u201cand then it processes\u201d."
                ]
              },
              { t: "p", html: "There is also a rate-based trigger. Even fast work belongs in the background when it is optional to the user's outcome \u2014 analytics, indexing, cache warming, webhooks to partners. If failing it should not fail the user's request, it should not be in the user's request." },

              { t: "h", text: "Mental model" },
              { t: "p", html: "<strong>Separate accepting work from doing work.</strong> The request's job shrinks to something it can always finish in milliseconds: validate the input, durably record the intent, return an identifier. Everything else happens elsewhere, at a pace set by your capacity rather than by an HTTP timeout." },
              { t: "p", html: "The queue is not just a buffer, it is the durability boundary. Once a job is in it, the work will happen even if every worker restarts, and the API is free to return. Everything else in this lesson follows from one consequence of that: because the queue guarantees delivery <em>at least</em> once, it cannot guarantee exactly once." },

              { t: "h", text: "The solution ladder" },
              {
                t: "table",
                headers: ["Tier", "Approach", "How it behaves", "Why you move on"],
                rows: [
                  ["<strong>Naive</strong>", "Do it inline", "The request handler performs the whole job while the client waits", "Proxies and load balancers cut requests off after somewhere around 30\u201360 seconds. The client retries, so now two copies are running. A deploy kills the work with no record it existed, and one heavy job monopolises a worker that should be serving hundreds of fast requests."],
                  ["<strong>Solid</strong>", "Enqueue a job, return an id", "Handler validates, writes a job record, publishes to a queue, responds <code class='tok'>202 Accepted</code>; a worker pool consumes", "Fixes timeouts and isolates the load. But the user is now in the dark, and you have inherited delivery semantics: retries, duplicates, poison messages, and a queue that can silently grow."],
                  ["<strong>Standout</strong>", "Queue + visible status + push on completion", "Same, plus a status resource the client can poll, or a real-time push when it finishes; plus bounded retries with backoff, a dead-letter queue, progress and cancellation, and workers that autoscale on queue depth", "This is the finished pattern. Every extra piece exists because of a specific production failure, so you can justify each one individually."]
                ]
              },

              { t: "h", text: "Mechanism" },
              {
                t: "code", lang: "text", code:
                  "ACCEPT (fast, synchronous)\n" +
                  "  POST /reports  {params, Idempotency-Key: k}\n" +
                  "    validate params\n" +
                  "    job = INSERT job(id, type, params, status='queued', attempts=0)\n" +
                  "    publish(queue, {job_id: job.id})\n" +
                  "    return 202 {job_id, status_url: '/jobs/' + job.id}\n" +
                  "\n" +
                  "OBSERVE\n" +
                  "  GET /jobs/{id} -> {status: queued|running|done|failed,\n" +
                  "                     progress: 0..100, result_url?, error?}\n" +
                  "  or push the same transition over the live channel\n" +
                  "\n" +
                  "PROCESS (worker, must tolerate running twice)\n" +
                  "  msg = queue.receive()            # becomes invisible for a lease period\n" +
                  "  claimed = UPDATE job SET status='running', lease_until = now + 5m\n" +
                  "             WHERE id = msg.job_id AND status IN ('queued','running')\n" +
                  "               AND (lease_until IS NULL OR lease_until < now)\n" +
                  "  if not claimed: ack(msg); return      # a duplicate delivery; drop it\n" +
                  "\n" +
                  "  heartbeat: extend lease_until while the work continues\n" +
                  "  do the work, writing side effects keyed by job id\n" +
                  "  UPDATE job SET status='done', result=...\n" +
                  "  ack(msg)                              # only now\n" +
                  "\n" +
                  "  on retryable error:  nack -> redelivered after backoff\n" +
                  "  on permanent error:  status='failed'; ack; record why\n" +
                  "  after N attempts:    route to the dead-letter queue"
              },
              { t: "p", html: "The claim step is the load-bearing line. Acknowledging <em>after</em> the work rather than before is what makes the queue durable across a crash, and it is also precisely what creates duplicates \u2014 a worker that dies just before its acknowledgement leaves a message that will be delivered again." },

              { t: "h2", text: "At-least-once means idempotent, always" },
              { t: "p", html: "Every mainstream queue offers at-least-once delivery. The broker keeps a message until it sees an acknowledgement, and it cannot tell a slow worker from a dead one, so if the lease expires it hands the message to somebody else \u2014 possibly while the first worker is still going. Duplicates are normal operation, not an incident." },
              { t: "p", html: "So the handler must produce the same end state whether it runs once or five times. In practice that means: key every side effect by the job id, use conditional state transitions rather than blind updates, ask downstream services for idempotency support (a payment provider's idempotency key, a mail provider's message id), and never write \u201c<code class='tok'>count = count + 1</code>\u201d in a handler without something to deduplicate against." },
              { t: "note", variant: "trap", html: "<strong>\u201cWe will use exactly-once delivery\u201d is a wrong answer.</strong> What some systems offer is exactly-once <em>processing</em> within a closed loop \u2014 a transactional read-process-write inside one system \u2014 not exactly-once delivery to an arbitrary side effect. The moment your handler sends an email or charges a card, you are back to at-least-once and idempotency is the only defence." },

              { t: "h2", text: "Retries: backoff and jitter" },
              { t: "p", html: "Retry only what is worth retrying. A timeout, a 503, a lock conflict \u2014 retry. A validation failure or a 404 \u2014 do not; it will fail identically forever. Then space the attempts out: double the delay each time up to a ceiling, and <strong>randomise it</strong>." },
              {
                t: "code", lang: "text", code:
                  "delay = min(cap, base * 2 ** attempt)\n" +
                  "sleep(random(0, delay))            # full jitter\n" +
                  "\n" +
                  "base = 1s, cap = 5m, max_attempts = 6\n" +
                  "  -> roughly 1s, 2s, 4s, 8s, 16s, 32s of ceiling, each randomised\n" +
                  "\n" +
                  "Why jitter: a downstream outage fails 10,000 jobs at the same instant.\n" +
                  "Without randomisation all 10,000 retry at the same instant too, and the\n" +
                  "recovering service is knocked over by its own clients, repeatedly."
              },
              { t: "note", variant: "warn", html: "Retries multiply load precisely when the system is least able to absorb it. Cap total attempts, add a circuit breaker so you stop hammering a dependency that is clearly down, and make sure a retry storm cannot outlive the outage that caused it." },

              { t: "h2", text: "Dead-letter queues" },
              { t: "p", html: "After the retry budget is spent, move the message aside rather than dropping it or looping forever. A dead-letter queue keeps the payload and the failure history somewhere a human can look, stops one poison message consuming capacity indefinitely, and \u2014 critically for ordered partitions \u2014 unblocks everything queued behind it. Alarm on its depth. A dead-letter queue nobody watches is a slow, tidy way of losing data." },

              { t: "h2", text: "Autoscaling workers" },
              { t: "p", html: "Scale on <strong>queue depth and the age of the oldest message</strong>, not CPU. Workers that spend their time waiting on storage and third parties look idle while being completely saturated, so CPU misleads you in both directions. Depth tells you the backlog; age tells you how late you already are, which is the number users actually feel." },
              { t: "p", html: "Two guards. Set a floor so a cold pool is not scaling from zero when a burst lands, and a ceiling \u2014 because a hundred new workers all hitting the same database will take down the thing they depend on. Worker count is not free capacity; it is a multiplier on every downstream dependency." },

              { t: "h", text: "Failure modes" },
              {
                t: "table",
                headers: ["Failure", "What you observe", "Mitigation"],
                rows: [
                  ["Duplicate side effects", "Two identical emails, a double charge", "Idempotency keyed by job id, and conditional transitions instead of blind updates"],
                  ["Zombie jobs", "Status stuck at <code class='tok'>running</code> forever after a worker died", "A lease with a heartbeat; a sweeper that reclaims jobs whose lease has expired"],
                  ["Poison message", "One malformed payload retried forever, blocking its partition", "Bounded attempts then dead-letter, with the failure reason attached"],
                  ["Silent backlog", "Everything reports healthy while jobs are two hours late", "Alert on oldest-message age, not just on error rate"],
                  ["Autoscaling stampede", "Workers scale out and the shared database collapses", "Cap concurrency, rate-limit at the worker, and treat downstream capacity as the real ceiling"],
                  ["Lost job records", "The message published but the row was never written, or the reverse", "Write the job row and publish in one atomic step \u2014 the outbox pattern from <a href='#/sdpatterns/coordination/multi-step-processes'>multi-step processes</a>"],
                  ["No way to cancel", "A user aborts an import and it keeps running for an hour", "A cancellation flag the worker checks between units of work"]
                ]
              },
              { t: "p", html: "Telling the user is part of the pattern, not a nicety. Either expose a status resource they can poll, or push the transition over a live channel \u2014 the same fan-out layer from <a href='#/sdpatterns/delivery/realtime-updates'>real-time updates</a>. Returning an id and never mentioning the job again is how you get a support queue full of \u201cis it stuck?\u201d." },

              {
                t: "cue", html: "<strong>Spotting it in a prompt.</strong> Reach for the background-work pattern when you hear: <em>generate</em>, <em>process</em>, <em>transcode</em>, <em>export</em>, <em>import</em>, <em>send to all users</em>, <em>batch</em>, <em>nightly</em>, <em>it can take a few minutes</em>, or any dependency on a slow third party. Also reach for it whenever the work is <strong>not required for the user's response to be correct</strong>. Say the whole shape in one breath: <strong>accept fast, return an id, process asynchronously, make the handler idempotent, and tell the user when it lands.</strong>"
              },
              { t: "note", variant: "key", html: "<strong>Accept the work, do not perform it.</strong> Validate, persist the intent, return an id in milliseconds, and let a worker pool drain the queue. Because delivery is at-least-once, an idempotent handler is not an optimisation \u2014 it is the correctness requirement. Add bounded retries with jittered backoff, a dead-letter queue you actually alarm on, and autoscaling driven by queue depth and message age." }
            ]
          },

          /* ---------- 7. multi-step-processes ---------- */
          {
            id: "multi-step-processes",
            title: "Multi-step processes across services",
            summary: "Orchestration, sagas and compensation, choreography, the outbox pattern \u2014 and how to combine all seven patterns.",
            minutes: 12,
            tags: ["patterns", "saga", "orchestration", "outbox"],
            blocks: [
              { t: "p", html: "The last pattern is the one that ties the others together. A single business operation \u2014 checkout, onboarding, fulfilment, booking a trip \u2014 touches several services, each with its own database. There is no transaction spanning them, so consistency stops being something the database provides and becomes something you build out of durable state, retries, and deliberate undo." },

              { t: "h", text: "The requirement that summons it" },
              {
                t: "ul", items: [
                  "\u201c<strong>Checkout</strong>: reserve stock, charge the card, create the order, notify the warehouse.\u201d",
                  "\u201cBook a <strong>flight and a hotel and a car</strong>, all or nothing.\u201d",
                  "\u201c<strong>Onboarding</strong>: create the account, provision the workspace, seed defaults, send the welcome.\u201d",
                  "\u201cIf the payment fails, <strong>release the inventory</strong>.\u201d",
                  "\u201cThe order moves through <strong>several states</strong> over hours or days.\u201d",
                  "Any requirement containing \u201cand then\u201d more than twice, or the words \u201call or nothing\u201d across service boundaries."
                ]
              },

              { t: "h", text: "Mental model" },
              { t: "p", html: "A local transaction gives you atomicity for free: everything commits or nothing does. Across services that guarantee evaporates, and what replaces it is a <strong>state machine you own</strong>. Every instance of the process is a durable record saying which step it reached; progress is made by advancing that record; failure is handled by either retrying forward or running deliberate undo actions backwards." },
              { t: "p", html: "The key mental shift is that <em>undo is a business action, not a rollback</em>. You cannot un-send an email; you send a correction. You cannot un-charge a card; you issue a refund. You cannot un-ship a parcel; you start a return. Compensation restores the business meaning, not the previous bytes." },

              { t: "h", text: "The solution ladder" },
              {
                t: "table",
                headers: ["Tier", "Approach", "How it behaves", "Why you move on"],
                rows: [
                  ["<strong>Naive</strong>", "Chained synchronous calls", "Service A calls B, which calls C, which calls D, all inside the original request", "A failure at step three leaves steps one and two committed and nothing recording that fact \u2014 stock reserved for an order that does not exist. Latency is the sum of every hop, availability is the product of every dependency, and a timeout leaves you genuinely unable to say what happened."],
                  ["<strong>Solid</strong>", "Orchestrated workflow with persisted state", "A coordinator owns a row per instance; it invokes one step at a time and records the outcome before moving on; on restart it resumes from the last durable state", "You can now answer \u201cwhere is order 12345?\u201d instantly. The coordinator is a component to build and operate, and it must be restartable \u2014 in-memory state defeats the entire purpose."],
                  ["<strong>Standout</strong>", "Saga with explicit compensating actions", "Each forward step has a defined undo. On failure the coordinator runs the compensations for completed steps, in reverse order, until the instance is consistently cancelled", "The honest answer for cross-service consistency. It costs you a compensation for every step, a design discussion about steps that cannot be undone, and acceptance of a visible window where the system is partly committed."],
                  ["<strong>Standout</strong>", "Event-driven choreography", "No coordinator. Each service emits events and reacts to others' events; the process is an emergent property of those reactions", "Maximum decoupling and the easiest thing to extend \u2014 a new consumer needs nobody's permission. But no single place describes the process, so tracing a stuck instance means correlating logs across services. That trade is real: <strong>choreography buys decoupling with traceability.</strong>"]
                ]
              },
              { t: "note", variant: "tip", html: "A practical default: <strong>orchestrate what the business cares about, choreograph the rest.</strong> Checkout is orchestrated because someone will ask where an order is. Sending the welcome email, updating the search index and refreshing analytics are choreographed off the same events, because nobody needs a control tower for those." },

              { t: "h", text: "Mechanism: a saga, concretely" },
              {
                t: "code", lang: "text", code:
                  "state: order_saga(id, step, status, attempts, updated_at)\n" +
                  "\n" +
                  "  step             forward action              compensation\n" +
                  "  ---------------  --------------------------  --------------------------\n" +
                  "  1 reserve_stock  hold items, expires in 15m  release the hold\n" +
                  "  2 authorise_pay  authorise (do not capture)  void the authorisation\n" +
                  "  3 create_order   insert the order row        cancel the order\n" +
                  "  4 capture_pay    capture the authorisation   refund the capture\n" +
                  "  5 notify         hand off to fulfilment      send a cancellation notice\n" +
                  "\n" +
                  "forward:  for each step\n" +
                  "            record ATTEMPTING(step) durably, then invoke it\n" +
                  "            success -> record DONE(step), continue\n" +
                  "            retryable failure -> backoff and retry the same step\n" +
                  "            permanent failure -> switch to COMPENSATING\n" +
                  "\n" +
                  "backward: for each completed step, in reverse\n" +
                  "            run its compensation; retry until it succeeds\n" +
                  "            a compensation that keeps failing goes to a human queue,\n" +
                  "            never silently to /dev/null\n" +
                  "\n" +
                  "every call carries  idempotency_key = (saga_id, step_name)\n" +
                  "  so a retry after an ambiguous timeout cannot double-charge"
              },
              { t: "p", html: "Two design choices in that table are worth stealing. <strong>Authorise then capture</strong> splits an awkward step into a reversible half and a final half, so the risky part happens late and the early part is cheap to undo. And <strong>the stock hold has an expiry</strong>, so even a saga that dies completely eventually stops holding inventory \u2014 the reservation idea from <a href='#/sdpatterns/coordination/contention'>contention</a>, reused as a safety net." },
              { t: "p", html: "Order your steps accordingly: reversible and cheap first, irreversible last. If a step genuinely cannot be compensated \u2014 an email to a customer, an irreversible payout \u2014 put it at the end, where reaching it means everything else already succeeded." },

              { t: "h2", text: "The outbox pattern" },
              { t: "p", html: "Any of these designs eventually needs to do two things at once: change your database and tell the world about it. Doing them as two separate writes has a gap, and a crash in that gap is undetectable \u2014 you either have an order with no event, or an event for an order that was rolled back. This is the <strong>dual-write problem</strong>, and it is where most home-grown event systems quietly lose data." },
              {
                t: "code", lang: "text", code:
                  "BEGIN\n" +
                  "  INSERT INTO orders(...)                       -- the state change\n" +
                  "  INSERT INTO outbox(id, topic, payload,        -- the event, same txn\n" +
                  "                     created_at, published_at NULL)\n" +
                  "COMMIT              -- both, or neither. no gap.\n" +
                  "\n" +
                  "relay (a separate loop, or change-data-capture on the outbox table)\n" +
                  "  rows = SELECT * FROM outbox WHERE published_at IS NULL\n" +
                  "         ORDER BY id LIMIT 100\n" +
                  "  publish(rows) ; UPDATE outbox SET published_at = now() WHERE id IN (...)\n" +
                  "\n" +
                  "A crash between publish and update republishes on restart.\n" +
                  "That is fine and expected: the outbox gives you at-least-once,\n" +
                  "so consumers deduplicate on the event id. It does not give you\n" +
                  "exactly-once, and no pattern here does."
              },

              { t: "h2", text: "Making every step idempotent" },
              {
                t: "ul", items: [
                  "<strong>Key each call</strong> by <code class='tok'>(workflow id, step name)</code> and pass that as the idempotency key to the downstream service, so a retry after an ambiguous timeout is recognised as a replay.",
                  "<strong>Record intent before acting.</strong> Writing <code class='tok'>ATTEMPTING(step)</code> durably first means that after a crash you know a call <em>may</em> have gone out and can query rather than blindly redo.",
                  "<strong>Use conditional transitions.</strong> Advance with <code class='tok'>WHERE step = 'previous'</code> so a duplicated coordinator cannot push the same instance forward twice.",
                  "<strong>Deduplicate on the consumer side</strong> with a table of processed event ids and a retention window longer than any plausible redelivery.",
                  "<strong>Make compensations idempotent too.</strong> Refunding twice is worse than the original bug, and compensations get retried exactly like forward steps."
                ]
              },

              { t: "h", text: "Failure modes" },
              {
                t: "table",
                headers: ["Failure", "What you observe", "Mitigation"],
                rows: [
                  ["Coordinator dies mid-flight", "Instances frozen at a step", "Persist state before every call, make the coordinator restartable and horizontally scalable, and sweep for instances that have not advanced"],
                  ["Stuck workflow nobody notices", "An order sits at step two for three days", "A deadline per step, an alarm on age in state, and a dashboard listing every instance not in a terminal state"],
                  ["Compensation fails", "The undo itself errors, leaving a half-cancelled order", "Retry compensations indefinitely with backoff, and escalate to a human queue rather than dropping \u2014 this is money, not telemetry"],
                  ["Duplicate events", "The same step runs twice after a redelivery", "Consumer-side dedupe on event id, plus conditional transitions on the state row"],
                  ["Lost events", "A downstream service never hears about an order", "The outbox pattern; never publish outside the transaction that made the change"],
                  ["Choreography with no observer", "Nobody can say why instance 12345 stopped", "Correlation ids on every event, one place that materialises the process view for support, and an explicit owner for the end-to-end flow"],
                  ["Schema drift", "A new field breaks an old consumer mid-migration", "Additive-only changes, versioned events, and consumers that ignore fields they do not recognise"]
                ]
              },

              { t: "h", text: "Combining the patterns" },
              { t: "p", html: "You have now seen all seven, and the reason they were taught separately is that real systems use them together. A single checkout flow is a stack of them, and the senior move in an interview is to name each seam rather than describing one giant bespoke design." },
              {
                t: "table",
                headers: ["Concern in checkout", "Pattern", "What it contributes"],
                rows: [
                  ["The Pay button is clicked twice", "<a href='#/sdpatterns/coordination/contention'>Contention</a>", "An idempotency key, so the second click returns the first result instead of charging again"],
                  ["The last item in stock", "<a href='#/sdpatterns/coordination/contention'>Contention</a>", "A conditional decrement or a reservation row with an expiry, so you cannot oversell"],
                  ["Charge, order, warehouse", "This lesson", "An orchestrated saga with compensations, so a failure at step four unwinds cleanly"],
                  ["Receipt PDF and emails", "<a href='#/sdpatterns/coordination/long-running-tasks'>Background work</a>", "A queue with idempotent handlers, so slow work never blocks the response"],
                  ["\u201cOrder confirmed\u201d appearing live", "<a href='#/sdpatterns/delivery/realtime-updates'>Real-time updates</a>", "A push over the existing channel instead of the client polling a status endpoint"],
                  ["The order history page", "<a href='#/sdpatterns/scaling/scaling-reads'>Scaling reads</a>", "A denormalised read model built from the same events the saga already emits"],
                  ["Event volume at peak", "<a href='#/sdpatterns/scaling/scaling-writes'>Scaling writes</a>", "A partitioned log absorbing the burst so the apply path can lag without dropping anything"],
                  ["Invoices and shipping labels", "<a href='#/sdpatterns/delivery/large-blobs'>Large objects</a>", "Generated to object storage and served by signed URL, never streamed through the API"]
                ]
              },
              { t: "p", html: "Two habits make this land. First, <strong>name the pattern before you draw</strong>: \u201cthis is a saga with compensation, sitting on top of an idempotent reservation\u201d orients an interviewer immediately. Second, <strong>state the cost each time</strong> \u2014 a saga has a visible window of partial commitment, a read model lags, a log means late readers. A design presented as free is a design nobody believes." },

              {
                t: "cue", html: "<strong>Spotting it in a prompt.</strong> Reach for the multi-step process pattern when you hear: <em>checkout</em>, <em>fulfilment</em>, <em>onboarding</em>, <em>approval flow</em>, <em>all or nothing across services</em>, <em>if X fails then undo Y</em>, <em>the order moves through states</em>, or any narrative with three or more \u201cand then\u201ds. Decide orchestration versus choreography by asking <strong>\u201cwill someone need to ask where this instance is?\u201d</strong> \u2014 if yes, you want a coordinator with a state row and a compensation for every step."
              },
              { t: "note", variant: "key", html: "<strong>Across services you do not get atomicity \u2014 you build it.</strong> Persist a state machine per instance, define a compensating action for every forward step and order the irreversible ones last, publish events through an outbox so the change and its announcement commit together, and key every call by workflow and step so retries are replays. Then say the cost out loud: the process is visibly inconsistent for a while, and that window is the price of crossing a service boundary at all." },
              { t: "quiz", id: "sdpatterns-coordination" }
            ]
          }
        ]
      }
    ]
  };
})();
