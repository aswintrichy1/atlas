/* =====================================================================
   BLUEPRINT · High-Level Design curriculum
   window.TRACKS.hld
   Block grammar (rendered by app.js):
     {t:'p', html}              paragraph (inline HTML allowed)
     {t:'h', text}              section heading
     {t:'h2', text}             sub heading
     {t:'ul'|'ol', items:[]}    list (items are inline HTML)
     {t:'code', lang, code}     code card
     {t:'note', variant, html}  callout: tip|key|warn|trap
     {t:'table', headers, rows} data table
     {t:'compare', bad, good}   two-column contrast
     {t:'stat', items}          metric row [{v,k}]
     {t:'widget', id}           interactive widget
     {t:'quiz', id}             quiz
   ===================================================================== */
window.TRACKS = window.TRACKS || {};
window.TRACKS.hld = {
  id: "hld",
  name: "High-Level Design",
  short: "HLD",
  tagline: "Architect systems that scale",
  color: "#f5a623",
  blurb: "Think in boxes and arrows. Scalability, caching, databases, distributed-systems trade-offs, messaging, APIs, and reliability — the vocabulary of system design interviews and real production architecture.",
  modules: [
    /* ============================ FOUNDATIONS ============================ */
    {
      id: "foundations",
      name: "Foundations",
      icon: "compass",
      lessons: [
        {
          id: "what-is-hld",
          title: "What High-Level Design actually is",
          summary: "The 30,000-foot view: components, responsibilities, and the data flowing between them — before a single class is written.",
          minutes: 6,
          tags: ["mental-model", "intro"],
          blocks: [
            { t: "p", html: "<strong>High-Level Design (HLD)</strong> is the architecture of a system expressed as <em>components and the connections between them</em>: clients, load balancers, services, caches, databases, queues, and the third parties they all talk to. It answers <em>how the pieces fit together</em> and <em>how data flows</em> — not how any single class is implemented." },
            { t: "p", html: "If <strong>Low-Level Design (LLD)</strong> is the blueprint of a single room — the wiring, the joinery, the exact dimensions — then HLD is the site plan of the whole building: where the rooms are, how people move between them, and where the load-bearing walls go." },
            {
              t: "table",
              headers: ["", "High-Level Design", "Low-Level Design"],
              rows: [
                ["Unit of thought", "Services, datastores, queues", "Classes, methods, interfaces"],
                ["Main concern", "Scale, availability, latency", "Correctness, readability, extensibility"],
                ["Typical artifact", "Architecture diagram", "UML / class diagram"],
                ["Question it answers", "Will it handle 1M users?", "Is this code clean & flexible?"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>The core skill of HLD is trade-off reasoning.</strong> There is rarely one right answer — only choices that buy you one property (say, low latency) at the cost of another (say, strong consistency). Naming the trade-off out loud is what separates a senior answer from a junior one." },
            { t: "h", text: "The properties you are always trading" },
            {
              t: "ul", items: [
                "<strong>Scalability</strong> — can it grow with load by adding resources?",
                "<strong>Availability</strong> — what fraction of the time is it up?",
                "<strong>Latency / throughput</strong> — how fast per request, how many per second?",
                "<strong>Consistency</strong> — does everyone see the same data at the same time?",
                "<strong>Durability</strong> — once written, does data survive failures?",
                "<strong>Cost & complexity</strong> — every nine of availability and every ms of latency has a price."
              ]
            },
            { t: "p", html: "Every lesson in this track is really about one of these properties and the price you pay to improve it. Keep this list in your head — it is the lens through which all the patterns make sense." },
            { t: "note", variant: "key", html: "<strong>Every architectural decision spends one property to buy another.</strong> Scalability, availability, latency, consistency, durability and cost cannot all be maximised at once, so a design only becomes defensible at the moment you can say which of them you deliberately gave up, and what the business gets in return." }
          ]
        },
        {
          id: "estimation",
          title: "Back-of-the-envelope estimation",
          summary: "Numbers every engineer should know, and the napkin math that turns 'a lot of users' into concrete capacity.",
          minutes: 8,
          tags: ["estimation", "capacity"],
          blocks: [
            { t: "p", html: "Before choosing any technology, estimate the <strong>load</strong>. Good designs start from numbers: requests per second, storage per year, bandwidth per second. You don't need precision — you need the right <em>order of magnitude</em>." },
            { t: "h", text: "Latency numbers every engineer should know" },
            { t: "p", html: "These are approximate but the <em>ratios</em> are what matter — memory is ~100,000× faster than a cross-continent network round trip." },
            {
              t: "table",
              headers: ["Operation", "Approx. latency", "In human terms (×1B)"],
              rows: [
                ["L1 cache reference", "~1 ns", "1 second"],
                ["Main memory (RAM) reference", "~100 ns", "~2 minutes"],
                ["Read 1 MB sequentially from RAM", "~3 µs", "—"],
                ["SSD random read", "~16 µs", "—"],
                ["Read 1 MB sequentially from SSD", "~1 ms", "—"],
                ["Round trip within same data center", "~0.5 ms", "—"],
                ["Read 1 MB from disk (HDD)", "~20 ms", "—"],
                ["Round trip CA ⇄ Netherlands", "~150 ms", "—"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>Takeaways:</strong> memory ≫ SSD ≫ disk ≫ network across regions. Keep hot data in RAM, avoid cross-region calls on the hot path, and batch/compress anything that crosses the network." },
            { t: "h", text: "The QPS trick" },
            { t: "p", html: "A day has <code class='tok'>86,400</code> seconds ≈ 10⁵. So <strong>average QPS ≈ daily requests ÷ 100,000</strong>." },
            {
              t: "stat", items: [
                { v: "1M/day", k: "≈ 12 QPS average" },
                { v: "100M/day", k: "≈ 1,160 QPS average" },
                { v: "×2–5", k: "peak multiplier to plan for" },
                { v: "×10", k: "headroom many teams keep" }
              ]
            },
            { t: "h", text: "A worked example: a photo service" },
            { t: "p", html: "Say <em>10 million</em> photos uploaded per day, average <em>1.5 MB</em> each, kept for 5 years." },
            {
              t: "code", lang: "text", code:
                "Writes/sec  = 10,000,000 / 86,400        ~= 116 uploads/sec (avg)\n" +
                "Peak writes = 116 * 3                    ~= 350 uploads/sec\n" +
                "Daily bytes = 10,000,000 * 1.5 MB        = 15 TB / day\n" +
                "5-yr storage= 15 TB * 365 * 5            ~= 27 PB  (before replication)\n" +
                "With 3x replication                      ~= 82 PB\n" +
                "Write bandwidth = 15 TB / 86,400 s       ~= 178 MB/s sustained"
            },
            { t: "note", variant: "tip", html: "Now you know this is an <strong>object-storage problem</strong> (S3-class), not a 'fits in Postgres' problem — and you reached that conclusion in 90 seconds of arithmetic. <em>That</em> is the value of estimation." },
            { t: "h", text: "Units worth memorizing" },
            {
              t: "ul", items: [
                "1 byte = 8 bits · 1 KB ≈ 10³ · 1 MB ≈ 10⁶ · 1 GB ≈ 10⁹ · 1 TB ≈ 10¹² · 1 PB ≈ 10¹⁵",
                "A typical char ≈ 1 byte (ASCII) or up to 4 bytes (UTF-8)",
                "A UUID ≈ 16 bytes · a timestamp ≈ 8 bytes · a typical row ≈ hundreds of bytes",
                "1 server ≈ tens of thousands of simple QPS; a DB ≈ thousands of writes/sec before tuning"
              ]
            },
            { t: "note", variant: "key", html: "<strong>Estimate to eliminate, not to be precise.</strong> The arithmetic exists to rule out whole categories of design in about ninety seconds: being wrong by a factor of two changes nothing, while being wrong by a factor of a thousand puts you on the wrong storage tier for the rest of the conversation. Get the exponent right and move on." }
          ]
        },
        {
          id: "framework",
          title: "A repeatable design framework",
          summary: "The seven-step path from a vague prompt to a defensible architecture — usable in interviews and at work.",
          minutes: 7,
          tags: ["framework", "process"],
          blocks: [
            { t: "p", html: "Whether you're whiteboarding in an interview or writing a design doc, the same skeleton works. Resist the urge to draw boxes immediately — <strong>scope first</strong>." },
            {
              t: "ol", items: [
                "<strong>Clarify requirements.</strong> Functional ('users can post and follow'), non-functional ('p99 &lt; 200 ms, 99.9% available, read-heavy'), and out-of-scope. Write them down.",
                "<strong>Estimate scale.</strong> Users, QPS (avg & peak), read:write ratio, data size & growth. (Previous lesson.)",
                "<strong>Define the API.</strong> A few endpoints or method signatures pin down the contract: <code class='tok'>POST /tweets</code>, <code class='tok'>GET /feed?cursor=…</code>.",
                "<strong>Sketch the data model.</strong> Core entities and relationships; pick SQL vs NoSQL <em>after</em> you see access patterns.",
                "<strong>Draw the high-level diagram.</strong> Client → LB → service(s) → cache → DB, plus queues / CDN / search as needed.",
                "<strong>Deep-dive the hard parts.</strong> Pick the 1–2 genuinely tricky pieces (the feed fan-out, the rate limiter) and go deep.",
                "<strong>Address bottlenecks & failure.</strong> Single points of failure, hot keys, cache stampedes, what happens when X dies."
              ]
            },
            { t: "note", variant: "tip", html: "<strong>Read-heavy vs write-heavy</strong> is the single most useful early question. Read-heavy ⇒ add caches and replicas. Write-heavy ⇒ think sharding, queues, LSM-tree stores, and async processing." },
            { t: "h", text: "Drive with the read:write ratio" },
            {
              t: "compare",
              bad: { title: "Read-heavy systems", items: ["News feeds, product catalogs, dashboards", "Add CDNs, caches, read replicas", "Denormalize / precompute views", "Eventual consistency is usually fine"] },
              good: { title: "Write-heavy systems", items: ["Metrics, logging, IoT, chat", "Shard by key; buffer with queues", "LSM-tree stores (Cassandra)", "Batch & compact; async pipelines"] }
            },
            { t: "p", html: "You now have the scaffolding. The rest of this track fills in each box — load balancers, caches, databases, queues — with the trade-offs that make one choice better than another <em>for your numbers</em>." },
            { t: "note", variant: "key", html: "<strong>Scope before boxes.</strong> The seven steps exist to stop you architecting a system nobody asked for: requirements and numbers first, then a contract and a data model, and only then a diagram. Skipping ahead feels faster and reliably costs more, because a read:write ratio discovered late invalidates most of what you already drew." },
            { t: "quiz", id: "hld-foundations" }
          ]
        }
      ]
    },

    /* ============================ SCALING ============================ */
    {
      id: "scaling",
      name: "Scaling & Load Balancing",
      icon: "trend",
      lessons: [
        {
          id: "vertical-horizontal",
          title: "Vertical vs horizontal scaling",
          summary: "Buy a bigger box, or buy more boxes? The first big fork in any scaling story.",
          minutes: 6,
          tags: ["scaling"],
          blocks: [
            { t: "p", html: "When load grows, you scale <strong>up</strong> (vertical) or <strong>out</strong> (horizontal)." },
            {
              t: "compare",
              bad: { title: "Vertical (scale up)", items: ["Add CPU / RAM / faster disk to one machine", "Dead simple — no code changes", "No distributed-systems complexity", "✗ Hard ceiling (biggest box money can buy)", "✗ Single point of failure", "✗ Expensive at the top end"] },
              good: { title: "Horizontal (scale out)", items: ["Add more machines behind a load balancer", "Near-limitless growth", "Redundancy → fault tolerance", "✗ Requires statelessness / coordination", "✗ Network, consistency, ops complexity", "Cheaper per unit using commodity nodes"] }
            },
            { t: "h", text: "Why horizontal needs statelessness" },
            { t: "p", html: "If request #1 from a user lands on server A and request #2 lands on server B, server B must be able to serve it. That only works if servers hold <em>no</em> per-user state locally — the subject of the next lesson." },
            { t: "note", variant: "key", html: "<strong>Scale up until the box or the blast radius stops you, then scale out.</strong> Vertical growth costs no engineering and buys real headroom, but it leaves the whole system standing on one machine. Horizontal growth buys redundancy and near-unlimited capacity, and charges for it in coordination — every server has to become disposable and stateless first." }
          ]
        },
        {
          id: "statelessness",
          title: "Stateless services & sticky sessions",
          summary: "Why pushing state out of your app servers is the unlock for effortless horizontal scaling.",
          minutes: 6,
          tags: ["scaling", "state"],
          blocks: [
            { t: "p", html: "A <strong>stateless</strong> service keeps no client-specific data between requests. Everything it needs arrives in the request (a token) or lives in a <em>shared</em> store (cache/DB). Any replica can serve any request — so you can add, remove, or restart nodes freely." },
            {
              t: "compare",
              bad: { title: "Stateful (session in memory)", items: ["Login state stored on the server's RAM", "User is 'pinned' to one server (sticky session)", "✗ That server dies → user logged out", "✗ Uneven load; hard to autoscale"] },
              good: { title: "Stateless (externalized state)", items: ["Session in Redis or a signed JWT", "Any server can handle any request", "✓ Crash a node — users don't notice", "✓ Autoscaling & rolling deploys are trivial"] }
            },
            { t: "code", lang: "text", code:
              "Stateless request flow:\n\n" +
              "  Client --(JWT / session id)--> Load Balancer --> any App server\n" +
              "                                                     |\n" +
              "                                          reads session from\n" +
              "                                          Redis / DB (shared)\n"
            },
            { t: "note", variant: "trap", html: "<strong>Sticky sessions</strong> (the LB routes a user to the same server) are a band-aid that reintroduces statefulness. They make autoscaling and failover painful. Prefer externalizing state; reserve stickiness for special cases like in-progress uploads." },
            { t: "p", html: "Rule of thumb: keep app servers <strong>disposable</strong>. If killing a random server would log anyone out or lose data, you still have hidden state to evict." },
            { t: "note", variant: "key", html: "<strong>State belongs anywhere except the app server.</strong> Move sessions into a shared store or a signed token and every replica becomes interchangeable, which is what makes autoscaling, rolling deploys and sudden node loss uneventful. Anything you keep locally is a sticky session in disguise, and you pay for it during the next failover." }
          ]
        },
        {
          id: "load-balancing",
          title: "Load balancing",
          summary: "The traffic cop in front of your servers — distribution algorithms, health checks, and L4 vs L7.",
          minutes: 9,
          tags: ["scaling", "load-balancer"],
          blocks: [
            { t: "p", html: "A <strong>load balancer (LB)</strong> spreads incoming requests across a pool of servers, removes dead servers from rotation via <em>health checks</em>, and gives clients a single stable entry point (a VIP). It is the keystone of horizontal scaling." },
            { t: "widget", id: "loadbalancer" },
            { t: "h", text: "Distribution algorithms" },
            {
              t: "table",
              headers: ["Algorithm", "How it picks a server", "Best when"],
              rows: [
                ["Round robin", "Next server in a cycle", "Servers are equal; requests are uniform"],
                ["Weighted round robin", "Cycle, biased by capacity weights", "Servers have different sizes"],
                ["Least connections", "Server with fewest active conns", "Requests vary in duration"],
                ["Least response time", "Fewest conns + lowest latency", "Latency-sensitive pools"],
                ["IP / URL hash", "Hash(key) → server", "Cache affinity / sticky-ish routing"],
                ["Random (+ 2 choices)", "Pick 2 at random, take the lighter", "Simple, surprisingly even at scale"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>Power of Two Choices:</strong> picking the lesser-loaded of two random servers gives almost the evenness of 'least connections' with almost the cost of 'random'. A favorite at scale." },
            { t: "h", text: "Layer 4 vs Layer 7" },
            {
              t: "compare",
              bad: { title: "L4 (transport)", items: ["Routes by IP + port (TCP/UDP)", "Doesn't read the request body", "Extremely fast, low overhead", "Can't route by URL / header / cookie"] },
              good: { title: "L7 (application)", items: ["Reads HTTP — path, headers, cookies", "Smart routing: /api → X, /img → Y", "TLS termination, compression, WAF", "More CPU per request"] }
            },
            { t: "h", text: "Don't make the LB a single point of failure" },
            { t: "p", html: "An LB in front of redundant servers is great — until the LB itself dies. Run LBs in pairs (active-passive or active-active) with a floating IP, and use DNS or anycast above them for region-level redundancy." },
            { t: "note", variant: "key", html: "<strong>Health checks</strong> are what make an LB more than a splitter. Active checks (ping <code class='tok'>/healthz</code> every few seconds) let the LB stop sending traffic to a sick node within seconds — the foundation of self-healing systems." },
            { t: "quiz", id: "hld-scaling" },
          ]
        }
      ]
    },

    /* ============================ CACHING ============================ */
    {
      id: "caching",
      name: "Caching & CDNs",
      icon: "bolt",
      lessons: [
        {
          id: "caching-basics",
          title: "Why and where to cache",
          summary: "Trade memory for latency. The cache hierarchy from browser to database, and the write strategies that keep it honest.",
          minutes: 8,
          tags: ["caching", "performance"],
          blocks: [
            { t: "p", html: "A <strong>cache</strong> stores the result of expensive work close to where it's needed so you don't redo it. It trades a little memory (and some staleness risk) for a lot of latency and load reduction. In read-heavy systems it is often the single biggest win." },
            { t: "h", text: "The cache hierarchy" },
            {
              t: "ul", items: [
                "<strong>Client / browser cache</strong> — assets and API responses cached on the device.",
                "<strong>CDN</strong> — static (and increasingly dynamic) content at edge locations near users.",
                "<strong>Load-balancer / reverse-proxy cache</strong> — e.g. Varnish, Nginx microcaching.",
                "<strong>Application cache</strong> — in-process (fast, per-node) or distributed (Redis / Memcached, shared).",
                "<strong>Database cache</strong> — query/result cache and the DB's own buffer pool."
              ]
            },
            { t: "note", variant: "tip", html: "<strong>Cache hit ratio</strong> is the metric that matters: hits ÷ total lookups. A 95% hit ratio means the DB sees only 5% of read traffic. Small improvements here translate to large capacity gains." },
            { t: "h", text: "Write strategies" },
            { t: "p", html: "The hard part of caching isn't reading — it's keeping the cache consistent with the source of truth when data <em>changes</em>. Explore the three write strategies below." },
            { t: "widget", id: "cachewrite" },
            { t: "p", html: "Pair a write strategy with a <em>read</em> strategy (next lesson). The classic combo is <strong>cache-aside reads + write-through (or invalidate-on-write)</strong>." },
            { t: "note", variant: "key", html: "<strong>A cache is a bet that slightly stale data is cheaper than a slow answer.</strong> Where you place it and what hit ratio it sustains decide how much latency and database load you win; the write strategy decides how wrong the data is allowed to be while you are winning. Choose both, or the second one gets chosen for you by whatever TTL somebody guessed." }
          ]
        },
        {
          id: "cache-strategies",
          title: "Cache-aside, read-through & invalidation",
          summary: "The read patterns — and why 'there are only two hard things in CS' is a joke about cache invalidation.",
          minutes: 7,
          tags: ["caching"],
          blocks: [
            { t: "h", text: "Cache-aside (lazy loading)" },
            { t: "p", html: "The application owns the cache. On a read: check cache → on miss, read DB → populate cache → return. The most common pattern; the cache only ever holds data someone actually asked for." },
            { t: "code", lang: "python", code:
              "def get_user(user_id):\n" +
              "    key = f\"user:{user_id}\"\n" +
              "    cached = cache.get(key)\n" +
              "    if cached is not None:\n" +
              "        return cached            # HIT\n" +
              "    user = db.query_user(user_id)  # MISS -> read source of truth\n" +
              "    cache.set(key, user, ttl=300)  # populate, expire in 5 min\n" +
              "    return user"
            },
            { t: "compare",
              bad: { title: "Cache-aside", items: ["App manages cache explicitly", "Only requested data is cached", "Resilient: cache down ⇒ still works (slower)", "✗ First read is always a miss", "✗ Risk of stale data until TTL"] },
              good: { title: "Read-through", items: ["Cache library loads from DB on miss", "App code is simpler (just cache.get)", "Centralized loading logic", "✗ Cache is now a dependency on the read path", "✗ Cold cache hammers the DB"] }
            },
            { t: "h", text: "Invalidation: the genuinely hard part" },
            {
              t: "ul", items: [
                "<strong>TTL (expiry):</strong> simplest — data is stale for at most the TTL. Tune per data type.",
                "<strong>Write-invalidate:</strong> on update, delete the key so the next read repopulates. Avoids serving known-stale data.",
                "<strong>Write-through:</strong> update cache + DB together — cache never stale, but writes cost more.",
                "<strong>Versioned keys:</strong> bake a version/etag into the key so old entries are simply never read."
              ]
            },
            { t: "note", variant: "warn", html: "<strong>Cache stampede / thundering herd:</strong> a hot key expires and thousands of concurrent misses hit the DB at once. Defenses: add <em>jitter</em> to TTLs, use a <em>mutex/lease</em> so only one request recomputes, or serve slightly-stale data while one worker refreshes in the background." },
            { t: "note", variant: "trap", html: "Also watch for <strong>cache penetration</strong> (queries for keys that don't exist bypass the cache every time — cache the 'not found' too, or use a bloom filter) and <strong>hot keys</strong> (one key so popular it overloads a single cache node — replicate or shard it)." },
            { t: "note", variant: "key", html: "<strong>Invalidation is the design; the read pattern is a detail.</strong> Cache-aside and read-through barely change your architecture, but how you expire, delete or version a key on write decides how stale a user can get — and whether one popular key expiring takes the database down with it. Every failure mode in this lesson is a consequence of that one choice." }
          ]
        },
        {
          id: "eviction",
          title: "Eviction policies",
          summary: "Caches are finite. When full, which entry gets thrown out? LRU, LFU, FIFO — visualized.",
          minutes: 6,
          tags: ["caching", "algorithms"],
          blocks: [
            { t: "p", html: "A cache has bounded memory. When it's full and a new entry arrives, an <strong>eviction policy</strong> decides who gets kicked out. The goal: evict the entry least likely to be needed soon." },
            { t: "widget", id: "lru" },
            {
              t: "table",
              headers: ["Policy", "Evicts", "Good for", "Watch out"],
              rows: [
                ["LRU", "Least recently used", "General purpose; temporal locality", "One big scan can flush hot data"],
                ["LFU", "Least frequently used", "Stable popularity distributions", "New items struggle vs old favorites"],
                ["FIFO", "Oldest inserted", "Simple, predictable", "Ignores actual usage"],
                ["Random", "A random entry", "Tiny overhead, surprisingly OK", "No locality awareness"],
                ["TTL", "Anything expired", "Time-bounded freshness", "Stampede on synchronized expiry"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>LRU</strong> is the default workhorse — it assumes recently used ⇒ soon used (temporal locality). Production caches like Redis offer LRU, LFU, and approximations that sample a few keys instead of maintaining perfect order (cheaper, nearly as good)." },
            { t: "p", html: "Implementation note: a classic exact-LRU is a <em>hash map + doubly-linked list</em> giving O(1) get and put — a favorite LLD interview question that bridges both tracks." },
            { t: "note", variant: "key", html: "<strong>An eviction policy is a guess about the future, so buy the cheapest guess that holds.</strong> LRU bets on temporal locality and is right often enough to be the default, and production caches deliberately approximate it by sampling a handful of keys — because near-perfect ordering at a fraction of the bookkeeping is the better trade at cache speeds." }
          ]
        },
        {
          id: "cdn",
          title: "CDNs & edge caching",
          summary: "Push content to within ~50 ms of every user on Earth. Push vs pull, TTLs, and cache busting.",
          minutes: 6,
          tags: ["caching", "cdn", "networking"],
          blocks: [
            { t: "p", html: "A <strong>Content Delivery Network (CDN)</strong> is a globally distributed fleet of edge caches. Users fetch content from the nearest <em>point of presence (PoP)</em> instead of crossing the planet to your origin — slashing latency and offloading the origin." },
            { t: "diagram", id: "cdn-tree", caption: "One origin feeds many edge PoPs; each PoP serves the users nearest to it." },
            { t: "compare",
              bad: { title: "Pull CDN", items: ["Edge fetches from origin on first miss, then caches", "Zero upfront work; self-managing", "First user in a region pays a slow miss", "Origin must stay reachable"] },
              good: { title: "Push CDN", items: ["You upload/push content to the CDN ahead of time", "Great for large, known, infrequently-changing files", "No cold-miss penalty", "You manage what's pushed & when"] }
            },
            { t: "h", text: "Keeping edge content fresh" },
            {
              t: "ul", items: [
                "<strong>TTL / Cache-Control headers</strong> tell the edge how long to keep a copy.",
                "<strong>Cache busting:</strong> put a content hash in the filename (<code class='tok'>app.9f3a1.js</code>) so a new version is a new URL — cache forever, never stale.",
                "<strong>Purge / invalidation API</strong> to evict on demand for urgent changes.",
                "Increasingly, CDNs cache <em>dynamic</em> content and run <em>edge compute</em> (functions at the PoP)."
              ]
            },
            { t: "note", variant: "tip", html: "Best practice: <strong>immutable, hashed asset URLs + long TTLs</strong>. You get edge-fast delivery and instant deploys (new hash = new URL) without ever fighting stale caches." },
            { t: "note", variant: "key", html: "<strong>The cheapest request is the one that never reaches your origin.</strong> A CDN converts geographic distance into a local cache hit, and the freshness problem that creates disappears entirely once content is addressed by its hash — immutable URLs let you cache indefinitely and still deploy instantly, which is why push versus pull matters far less than naming things well." },
            { t: "quiz", id: "hld-caching" }
          ]
        }
      ]
    },

    /* ============================ DATA LAYER ============================ */
    {
      id: "data",
      name: "The Data Layer",
      icon: "database",
      lessons: [
        {
          id: "sql-vs-nosql",
          title: "SQL vs NoSQL",
          summary: "Relational rigor vs flexible scale. Choosing by access pattern, not by hype.",
          minutes: 9,
          tags: ["database", "data-model"],
          blocks: [
            { t: "p", html: "The choice isn't 'old vs new' — it's about your <strong>access patterns, consistency needs, and scale</strong>. Many real systems use both (polyglot persistence)." },
            { t: "compare",
              bad: { title: "Relational (SQL)", items: ["Tables, rows, fixed schema, JOINs", "ACID transactions — strong consistency", "Great for complex queries & relationships", "Vertical scaling first; sharding is manual", "Postgres, MySQL, SQL Server"] },
              good: { title: "Non-relational (NoSQL)", items: ["Document / key-value / wide-column / graph", "Flexible or no schema", "Built to scale out horizontally", "Often BASE / eventual consistency", "Mongo, Cassandra, DynamoDB, Redis, Neo4j"] }
            },
            { t: "h", text: "The NoSQL families" },
            {
              t: "table",
              headers: ["Family", "Shape", "Sweet spot", "Examples"],
              rows: [
                ["Key-value", "key → blob", "Caches, sessions, counters", "Redis, DynamoDB"],
                ["Document", "JSON-like docs", "Catalogs, profiles, CMS", "MongoDB, Couchbase"],
                ["Wide-column", "rows with dynamic columns", "Write-heavy, time-series, huge scale", "Cassandra, HBase, Bigtable"],
                ["Graph", "nodes + edges", "Social graphs, recommendations", "Neo4j, Neptune"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>ACID vs BASE.</strong> ACID (Atomic, Consistent, Isolated, Durable) = correctness guarantees, classic SQL. BASE (Basically Available, Soft-state, Eventually consistent) = availability & scale, classic NoSQL. Pick the guarantee your domain truly needs — money wants ACID; a 'like' counter is happy with BASE." },
            { t: "h", text: "How to choose" },
            {
              t: "ul", items: [
                "Need multi-row transactions, complex JOINs, strong consistency? → <strong>SQL</strong>.",
                "Massive write throughput, flexible schema, horizontal scale? → <strong>NoSQL</strong> (often wide-column).",
                "Simple lookups by key at low latency? → <strong>key-value</strong>.",
                "Deeply connected data with relationship queries? → <strong>graph</strong>.",
                "Unsure / typical CRUD app at moderate scale? → <strong>start with Postgres.</strong> It scales further than people think."
              ]
            },
            { t: "note", variant: "trap", html: "Don't pick NoSQL 'for scale' on a system that will never need it. You'll trade away JOINs and transactions for a horizontal scalability you don't use. Match the tool to the access pattern." },
            { t: "note", variant: "key", html: "<strong>Access patterns choose the database; scale only shortens the list.</strong> Decide which queries must be fast, which writes must be transactional, and how the data is actually shaped — then pick the engine that answers those natively. A mismatched data model taxes you on every feature, while unused horizontal headroom costs you nothing at all." }
          ]
        },
        {
          id: "database-selection-deep-dive",
          title: "Database selection deep dive",
          summary: "Pick storage by workload shape: OLTP, OLAP, search, time-series, graph, vector, and the engine costs underneath.",
          minutes: 9,
          tags: ["database", "storage-engine", "selection"],
          blocks: [
            { t: "p", html: "A database choice is really three choices: <strong>workload</strong> (what queries dominate), <strong>data model</strong> (rows, documents, edges, vectors), and <strong>storage engine</strong> (how bytes are laid out and updated). Get those right before comparing vendor names." },
            { t: "table", headers: ["Need", "Good fit", "Watch for"], rows: [
              ["OLTP", "Row-store SQL or key-value store for short, selective reads/writes", "Hot rows, lock contention, transactional boundaries"],
              ["OLAP", "Column store or warehouse for scans and aggregations", "Freshness lag, high concurrency cost, ETL complexity"],
              ["Search", "Inverted index with analyzers, ranking and filters", "Relevance tuning, reindexing, eventual consistency"],
              ["Time-series", "Append-optimized store partitioned by time and metric/entity", "High-cardinality tags and retention policy"],
              ["Graph", "Native graph or relational tables tuned for traversals", "Supernodes and hard-to-shard relationship queries"],
              ["Vector", "ANN index plus metadata filters for semantic retrieval", "Recall/latency trade-offs and tenant/ACL filtering"]
            ] },
            { t: "h", text: "Rows, columns, B-trees and LSM trees" },
            { t: "compare",
              bad: { title: "Row store + B-tree", items: ["Rows stored together; great for fetching one entity", "B-trees keep keys sorted for point and range reads", "In-place updates work well for OLTP", "Write amplification grows with many indexes"] },
              good: { title: "Column store + LSM", items: ["Columns stored together; great for scanning one field across many rows", "LSM trees append writes then compact sorted files", "Excellent write throughput and compression", "Compaction creates read/write/space amplification"] }
            },
            { t: "ul", items: [
              "<strong>NewSQL</strong> keeps SQL and transactions but distributes data with consensus; great when you need relational correctness plus scale, costly when latency and coordination dominate.",
              "<strong>Hot partitions</strong> happen when one key, tenant, region or timestamp range absorbs too much traffic. Salt keys, shard by a higher-cardinality key, or split the tenant/resource.",
              "<strong>Amplification</strong> is hidden cost: one logical write can become many index writes, replicated writes, compaction rewrites and cache invalidations."
            ] },
            { t: "note", variant: "key", html: "Start from access patterns: query predicates, sort order, freshness, write rate, retention, consistency, multi-tenancy and failure model. A boring database that matches the workload beats an exciting one that fights it." },
            { t: "quiz", id: "hld-databases" }
          ]
        },
        {
          id: "indexing",
          title: "Indexing",
          summary: "How a database finds a row without scanning the whole table — B-trees, composite indexes, and their write cost.",
          minutes: 7,
          tags: ["database", "performance"],
          blocks: [
            { t: "p", html: "Without an index, finding rows means a <strong>full table scan</strong> — O(n). An index is a sorted side structure (usually a <strong>B-tree</strong>) that turns lookups into O(log n), like the index at the back of a book." },
            { t: "code", lang: "sql", code:
              "-- Without an index this scans every row:\n" +
              "SELECT * FROM orders WHERE customer_id = 42;\n\n" +
              "-- Create an index so lookups by customer_id are O(log n):\n" +
              "CREATE INDEX idx_orders_customer ON orders (customer_id);\n\n" +
              "-- Composite index: order matters! Helps queries filtering on\n" +
              "-- customer_id, or (customer_id AND status) -- the leftmost prefix.\n" +
              "CREATE INDEX idx_orders_cust_status ON orders (customer_id, status);"
            },
            { t: "note", variant: "tip", html: "<strong>Indexes trade write speed & storage for read speed.</strong> Every insert/update must also update each index. Index the columns you filter/join/sort on — not every column." },
            {
              t: "ul", items: [
                "<strong>Primary index</strong> — on the primary key; often the physical row order (clustered).",
                "<strong>Secondary index</strong> — on other columns you query by.",
                "<strong>Composite index</strong> — multiple columns; only helps queries using a <em>leftmost prefix</em>.",
                "<strong>Covering index</strong> — includes all columns a query needs, so the DB never touches the table.",
                "<strong>Hash index</strong> — O(1) equality lookups, but no range queries."
              ]
            },
            { t: "note", variant: "tip", html: "Read the query planner (<code class='tok'>EXPLAIN ANALYZE</code>). 'Seq Scan' on a big table in a hot query is a red flag; 'Index Scan' is what you want. Profile before adding indexes — guessing wastes write performance." },
            { t: "note", variant: "key", html: "<strong>An index is a write tax paid to make one query shape fast.</strong> That makes indexing a decision about a specific access pattern rather than a table-wide habit: the column order in a composite index is part of the contract, the planner is the only honest referee, and an index nothing queries is pure overhead on every insert." }
          ]
        },
        {
          id: "replication",
          title: "Replication",
          summary: "Copy data across machines for read scale and fault tolerance — and the lag that comes with it.",
          minutes: 8,
          tags: ["database", "availability"],
          blocks: [
            { t: "p", html: "<strong>Replication</strong> keeps copies of the same data on multiple nodes. It buys you <em>read scalability</em> (serve reads from many replicas), <em>high availability</em> (a replica takes over if the primary dies), and <em>geo-locality</em> (read from a nearby copy)." },
            { t: "h", text: "Leader–follower (primary–replica)" },
            { t: "p", html: "One <strong>leader</strong> takes all writes and streams its changelog to read-only <strong>followers</strong>. The most common topology." },
            { t: "code", lang: "text", code:
              "          writes            reads          reads\n" +
              "  Client ───────► LEADER ──repl──► Follower 1\n" +
              "                    │      ──repl──► Follower 2\n" +
              "                    └────  ──repl──► Follower 3\n" +
              "  (all writes go to the leader; reads can fan out to followers)"
            },
            { t: "compare",
              bad: { title: "Async replication", items: ["Leader acks before followers confirm", "Lowest write latency", "✗ Followers lag → stale reads", "✗ Failover can lose the last few writes"] },
              good: { title: "Sync replication", items: ["Leader waits for follower(s) to confirm", "No data loss on failover (durable)", "✗ Higher write latency", "✗ A slow/dead follower stalls writes"] }
            },
            { t: "note", variant: "warn", html: "<strong>Replication lag</strong> causes the classic 'I posted a comment but it vanished on refresh' bug — your refresh hit a lagging follower. Fixes: <em>read-your-writes</em> (route a user's reads to the leader briefly after they write), or read from the leader for that session." },
            { t: "h", text: "Other topologies" },
            {
              t: "ul", items: [
                "<strong>Multi-leader:</strong> several leaders accept writes (e.g., one per region). Great for write locality, but you must resolve write conflicts.",
                "<strong>Leaderless (Dynamo-style):</strong> any node accepts writes; clients use <em>quorums</em> (W + R &gt; N) for tunable consistency. Used by Cassandra & DynamoDB."
              ]
            },
            { t: "note", variant: "key", html: "<strong>Quorum intuition:</strong> with N replicas, if you write to W and read from R such that W + R &gt; N, the read set and write set overlap — so a read always sees the latest write. Tune (W, R) to trade latency vs consistency." }
          ]
        },
        {
          id: "sharding",
          title: "Sharding & partitioning",
          summary: "When data outgrows one machine, split it. Range vs hash partitioning, hot shards, and rebalancing.",
          minutes: 8,
          tags: ["database", "scaling"],
          blocks: [
            { t: "p", html: "Replication copies the <em>same</em> data everywhere. <strong>Sharding (horizontal partitioning)</strong> splits <em>different</em> data across machines so no single node holds it all or absorbs all the writes. It's how you scale writes and storage beyond one box." },
            { t: "h", text: "Choosing a partitioning scheme" },
            {
              t: "table",
              headers: ["Scheme", "How", "Pro", "Con"],
              rows: [
                ["Range", "Split by key ranges (A–M, N–Z)", "Efficient range scans", "Easy to create hot ranges"],
                ["Hash", "shard = hash(key) % N", "Even distribution", "Range queries scatter; resizing reshuffles"],
                ["Directory", "Lookup table maps key → shard", "Flexible, rebalanceable", "The lookup is a new SPOF"],
                ["Geo", "Partition by region", "Data locality & compliance", "Cross-region queries are costly"]
              ]
            },
            { t: "note", variant: "warn", html: "<strong>The shard key is the most important decision.</strong> A bad key creates a <em>hot shard</em> — e.g., partitioning by <code class='tok'>created_at</code> sends every new write to the same node. Pick a high-cardinality, evenly-accessed key (often a hash of user_id)." },
            { t: "h", text: "The costs you take on" },
            {
              t: "ul", items: [
                "<strong>Cross-shard queries & JOINs</strong> become scatter-gather (slow) or impossible — denormalize.",
                "<strong>Cross-shard transactions</strong> need sagas or 2-phase commit — avoid if you can.",
                "<strong>Rebalancing</strong> when you add a shard: naive <code class='tok'>hash % N</code> remaps almost everything. The fix is the next lesson — consistent hashing.",
                "<strong>Operational complexity</strong> multiplies — backups, migrations, and monitoring per shard."
              ]
            },
            { t: "note", variant: "tip", html: "Don't shard until you must. Squeeze vertical scaling, read replicas, and caching first — sharding is a one-way door that complicates everything downstream." },
            { t: "note", variant: "key", html: "<strong>Sharding buys write and storage capacity by surrendering the single-machine conveniences nobody priced.</strong> Joins, transactions and rebalancing all turn into project work, and the shard key freezes the distribution you will live with — which is exactly why replicas, caching and a bigger box come first." }
          ]
        },
        {
          id: "transactions-isolation",
          title: "Transactions & isolation levels",
          summary: "ACID, the four isolation levels, and the read anomalies they prevent — the database knowledge interviewers probe hardest.",
          minutes: 8,
          tags: ["database", "transactions", "consistency"],
          blocks: [
            { t: "p", html: "A <strong>transaction</strong> groups several reads and writes into one unit that either fully commits or fully rolls back. Its guarantees are summed up by <strong>ACID</strong>: <em>Atomicity</em> (all-or-nothing), <em>Consistency</em> (never violates constraints), <em>Isolation</em> (concurrent transactions don't corrupt each other), and <em>Durability</em> (once committed, it survives a crash)." },
            { t: "p", html: "<strong>Isolation</strong> is the subtle one. Perfect isolation (every transaction runs as if alone) is expensive, so databases offer weaker <em>levels</em> that trade correctness for concurrency. Each level is defined by which read <em>anomalies</em> it permits." },
            { t: "h", text: "The three anomalies" },
            {
              t: "ul", items: [
                "<strong>Dirty read</strong> — you read another transaction's <em>uncommitted</em> write, which may be rolled back.",
                "<strong>Non-repeatable read</strong> — you read a row twice and get different values because another transaction committed an update in between.",
                "<strong>Phantom read</strong> — you run the same range query twice and new rows appear because another transaction inserted them."
              ]
            },
            { t: "h", text: "The four isolation levels" },
            {
              t: "table",
              headers: ["Level", "Dirty read", "Non-repeatable", "Phantom"],
              rows: [
                ["Read Uncommitted", "Possible", "Possible", "Possible"],
                ["Read Committed", "Prevented", "Possible", "Possible"],
                ["Repeatable Read", "Prevented", "Prevented", "Possible*"],
                ["Serializable", "Prevented", "Prevented", "Prevented"]
              ]
            },
            { t: "note", variant: "tip", html: "Higher isolation = fewer anomalies but more locking/aborts and lower throughput. <strong>Read Committed</strong> is the common default (Postgres, Oracle, SQL Server). <strong>Serializable</strong> is the gold standard — the result is <em>as if</em> transactions ran one at a time — but it's the slowest. (*MySQL's InnoDB blocks phantoms at Repeatable Read via next-key locks.)" },
            { t: "h", text: "How databases actually do it: MVCC" },
            { t: "p", html: "Rather than locking readers behind writers, most modern databases use <strong>Multi-Version Concurrency Control (MVCC)</strong>: every write creates a new <em>version</em> of a row stamped with a transaction id, and each transaction reads a consistent <em>snapshot</em> as of when it began. Readers never block writers and writers never block readers — only write-write conflicts need resolving." },
            { t: "note", variant: "trap", html: "Don't default to Serializable 'to be safe' — it can tank throughput and cause serialization failures your app must retry. Pick the weakest level that's correct for the operation: a money transfer wants Serializable (or careful row locks); a dashboard read is fine at Read Committed." },
            { t: "note", variant: "tip", html: "In a system-design interview, naming the isolation level you'd use — and <em>why</em> — signals real database depth. Tie it back to the CAP/PACELC trade-off: stronger isolation usually means more coordination and higher latency." },
            { t: "note", variant: "key", html: "<strong>Choose the weakest isolation level that still makes the operation correct.</strong> Each step up the ladder removes one anomaly and adds coordination, so a money transfer earns Serializable and a dashboard query does not. MVCC is what makes the middle of that ladder affordable, and naming the specific anomaly you are buying protection from is the part that reads as depth." }
          ]
        },
        {
          id: "zero-downtime-data-migrations",
          title: "Zero-downtime data migrations",
          summary: "Change data shape under live traffic with expand-contract, restartable backfills, verification, cutover and rollback.",
          minutes: 11,
          tags: ["database", "migration", "zero-downtime", "operations"],
          blocks: [
            { t: "p", html: "A <strong>zero-downtime migration</strong> changes data shape while reads and writes continue. The safe shape is: make old and new paths coexist, move data in small verified batches, then cut over with a rehearsed rollback." },
            { t: "h", text: "The expand-contract pattern" },
            { t: "ol", items: [
              "<strong>Expand</strong>: add the new nullable column/table/index/path. Do not remove the old shape yet.",
              "<strong>Bridge</strong>: ship code that understands both old and new shapes, usually behind a feature flag.",
              "<strong>Backfill</strong>: copy old data into the new shape in small, restartable chunks.",
              "<strong>Verify</strong>: compare counts, checksums, sampled rows and live CDC streams until drift is explainable.",
              "<strong>Cut over</strong>: route reads to the new shape, then writes, while watching SLOs and mismatch metrics.",
              "<strong>Contract</strong>: remove the old path only after the rollback window closes and stale clients are gone."
            ] },
            { t: "code", lang: "text", code:
              "Phase 0  old read/write path only\n" +
              "Phase 1  expand schema: add new_order_items, new indexes\n" +
              "Phase 2  dual-write: old table + new table from the same command\n" +
              "Phase 3  backfill historical rows with checkpoints\n" +
              "Phase 4  shadow-read new table and compare, still return old result\n" +
              "Phase 5  cut reads to new table, keep dual-write for rollback\n" +
              "Phase 6  cut writes to new table, freeze/remove old path later"
            },
            { t: "h", text: "Backfills: checkpoint, throttle, verify" },
            { t: "p", html: "Backfills should be <em>restartable</em>. Walk primary-key ranges or stable cursors, persist the last completed checkpoint, and make each batch idempotent. Throttle on database load, replica lag, queue depth and errors; the migration is background work, not the product." },
            { t: "table", headers: ["Control", "Why it matters"], rows: [
              ["Checkpoint", "Resume after deploys, crashes or manual pauses without scanning from the beginning."],
              ["Throttle", "Keep lock time, IO, replication lag and cache churn below production limits."],
              ["Idempotent batch", "Retrying batch 42 overwrites or upserts the same target rows, not duplicates them."],
              ["Verification", "Counts catch big gaps; checksums and sampled row diffs catch subtle transforms."]
            ] },
            { t: "h", text: "Dual-write, dual-read, shadow-read" },
            { t: "ul", items: [
              "<strong>Dual-write</strong> sends each new mutation to old and new stores in one application command. Record failures explicitly; do not silently let the two stores drift.",
              "<strong>Dual-read</strong> can read the new store first and fall back to old during rollout, but it can hide bugs if every miss quietly succeeds from old.",
              "<strong>Shadow-read</strong> is safer before cutover: serve the old result to the user, read the new store in parallel, compare, and emit a mismatch metric.",
              "<strong>CDC validation</strong> tails the change stream from the source and confirms every committed mutation reaches the target in order for each key."
            ] },
            { t: "note", variant: "tip", html: "The migration dashboard should show progress, lag, mismatch rate, write failure rate, batch retries and rollback readiness. A green deploy is not enough; the data must be green too." },
            { t: "h", text: "Cutover and rollback" },
            { t: "p", html: "Cutover is a routing decision. Keep the old path warm for a defined window, keep dual-write until confidence is high, and make rollback mechanical: flip reads back, pause the backfill, preserve mismatch evidence, and replay missing writes from the durable log." },
            { t: "compare",
              bad: { title: "Risky migration", items: ["Big bang schema rewrite", "One giant UPDATE", "No checkpoint table", "Deletes old column immediately", "Rollback means restoring a backup"] },
              good: { title: "Operational migration", items: ["Expand-contract", "Small idempotent batches", "Shadow reads and CDC validation", "Feature-flagged cutover", "Rollback path rehearsed before launch"] }
            },
            { t: "h", text: "Tenant and cell migrations" },
            { t: "p", html: "Tenant or cell moves are the same pattern at a larger boundary: sequence writes, copy tenant-scoped data, replay changes, verify checksums, then atomically update the routing control plane. Keep the source read-capable until support, analytics and jobs agree on the new location." },
            { t: "note", variant: "trap", html: "Never hardcode tenant ids, program ids, account names or dates into a migration plan. They belong in a runtime manifest or control-plane row so the same machinery works in every environment and for every tenant." },
            { t: "note", variant: "key", html: "<strong>A safe migration is one you can stop at any phase.</strong> Expand-contract keeps both shapes alive so backfill, shadow read and cutover each stay reversible, and the old path stays warm until the mismatch evidence — not the schedule — says the rollback window has closed. Everything else here is machinery for making that pause cheap." },
            { t: "quiz", id: "hld-data-migrations" }
          ]
        },
        {
          id: "consistent-hashing",
          title: "Consistent hashing",
          summary: "Add or remove a node and move only ~1/N of the keys, not all of them. The algorithm behind elastic clusters.",
          minutes: 8,
          tags: ["database", "algorithms", "distributed"],
          blocks: [
            { t: "p", html: "With plain <code class='tok'>hash(key) % N</code>, changing N (adding/removing a node) remaps <em>almost every</em> key — catastrophic for a cache or shard cluster. <strong>Consistent hashing</strong> remaps only about <em>1/N</em> of keys, making clusters elastic." },
            { t: "p", html: "The idea: map both nodes <em>and</em> keys onto a circular hash space (0…2³²). A key belongs to the first node found clockwise. Add or remove a node and only the keys in that one arc move." },
            { t: "widget", id: "consistenthash" },
            { t: "h", text: "Virtual nodes" },
            { t: "p", html: "A few physical nodes placed once on the ring distribute keys unevenly, and removing one dumps its whole arc onto a single neighbor. The fix: give each physical node many <strong>virtual nodes</strong> (replicas) scattered around the ring. Load smooths out, and a departing node's keys spread across <em>many</em> survivors. Toggle the vnode count in the widget to see it." },
            { t: "note", variant: "key", html: "Consistent hashing powers <strong>Cassandra, DynamoDB, Riak</strong>, and distributed caches like memcached clients. Anytime you need to add/remove nodes without reshuffling the world, this is the tool." },
            { t: "quiz", id: "hld-databases" }
          ]
        }
      ]
    },

    /* ============================ DISTRIBUTED ============================ */
    {
      id: "distributed",
      name: "Distributed Trade-offs",
      icon: "share",
      lessons: [
        {
          id: "cap",
          title: "CAP & PACELC theorems",
          summary: "The fundamental law of distributed data: under a partition, pick two of three.",
          minutes: 8,
          tags: ["distributed", "consistency", "theory"],
          blocks: [
            { t: "p", html: "The <strong>CAP theorem</strong> states that a distributed data store can provide at most <em>two</em> of: <strong>Consistency</strong> (every read sees the latest write), <strong>Availability</strong> (every request gets a non-error response), and <strong>Partition tolerance</strong> (it keeps working despite dropped messages between nodes)." },
            { t: "note", variant: "tip", html: "In any real distributed system, network partitions <em>will</em> happen — so <strong>P is non-negotiable</strong>. The real choice is: during a partition, do you stay <strong>Consistent</strong> (CP, refuse/block) or <strong>Available</strong> (AP, answer with maybe-stale data)? 'CA' only exists on a single node." },
            { t: "widget", id: "cap" },
            { t: "h", text: "PACELC — the part CAP forgets" },
            { t: "p", html: "CAP only describes behavior <em>during</em> a partition. <strong>PACELC</strong> adds: <em>else</em> (when the system is healthy), you still trade <strong>Latency</strong> vs <strong>Consistency</strong>. Even with no partition, a quorum read that guarantees freshness is slower than reading one nearby replica." },
            { t: "code", lang: "text", code:
              "PACELC:  if (Partition) then choose (Availability | Consistency)\n" +
              "         Else            choose (Latency      | Consistency)\n\n" +
              "  DynamoDB / Cassandra : PA/EL  -> available + low-latency\n" +
              "  HBase / etcd / ZK    : PC/EC  -> consistent, always\n" +
              "  Spanner              : PC/EC  -> consistency via synced clocks"
            },
            { t: "note", variant: "trap", html: "Don't memorize labels — reason from the use case. A bank ledger wants CP (never show a wrong balance). A social feed wants AP (always load, even if a like count is briefly off). The 'right' answer is domain-specific." },
            { t: "note", variant: "key", html: "<strong>The partition choice is rare; the latency choice is constant.</strong> CAP forces a one-off decision between refusing a request and answering with possibly-stale data, but PACELC's <em>else</em> branch is what you actually pay on every healthy request — freshness bought with a quorum round trip, or speed bought by trusting a nearby replica." }
          ]
        },
        {
          id: "consistency-models",
          title: "Consistency models",
          summary: "Strong, eventual, causal, read-your-writes — the spectrum between 'always correct' and 'always fast'.",
          minutes: 7,
          tags: ["distributed", "consistency"],
          blocks: [
            { t: "p", html: "'Consistency' isn't binary — it's a spectrum of guarantees about <em>what a read can observe</em>. Stronger models are easier to reason about; weaker models are faster and more available." },
            {
              t: "table",
              headers: ["Model", "Guarantee", "Cost / use"],
              rows: [
                ["Strong (linearizable)", "Every read sees the latest committed write, as if one copy", "Highest latency; needed for locks, balances"],
                ["Sequential", "All nodes see ops in the same order", "Slightly cheaper than linearizable"],
                ["Causal", "Cause precedes effect for everyone", "Good for comments/replies ordering"],
                ["Read-your-writes", "You always see your own writes", "UX fix for replication lag"],
                ["Monotonic reads", "Reads never go backwards in time", "Avoids 'data flickering'"],
                ["Eventual", "Replicas converge if writes stop", "Fastest, most available"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>Eventual consistency is not 'no consistency'.</strong> It guarantees convergence — given no new writes, all replicas end up identical. The window of disagreement is usually milliseconds. For likes, view counts, and feeds, that's invisible to users and well worth the availability." },
            { t: "h", text: "Picking a model" },
            {
              t: "ul", items: [
                "Money, inventory, unique usernames, distributed locks → <strong>strong</strong>.",
                "Social feeds, analytics, recommendations, presence → <strong>eventual</strong> (+ read-your-writes for the author).",
                "Chat & comment threads → <strong>causal</strong> so replies never appear before what they reply to.",
                "Default mindset: use the <em>weakest</em> model your correctness allows — it's cheaper and more available."
              ]
            },
            { t: "note", variant: "key", html: "<strong>Consistency is a per-operation choice, not a system-wide setting.</strong> The same product can hold balances linearizably, order replies causally and let like counts converge eventually, because each guarantee is bought with coordination and coordination is paid in latency and availability. Naming the model per operation is what keeps that bill proportional to the risk." },
            { t: "quiz", id: "hld-cap" }
          ]
        },
        {
          id: "quorums-consensus",
          title: "Quorums & consensus",
          summary: "When replicas disagree, quorum math and consensus protocols decide what is safe to read, write and coordinate.",
          minutes: 8,
          tags: ["distributed", "consensus", "quorum"],
          blocks: [
            { t: "p", html: "Replication gives durability and availability, but it creates a question: <em>which copy is authoritative right now?</em> Two families answer it. <strong>Quorums</strong> give tunable consistency for replicated data. <strong>Consensus</strong> elects one agreed leader or value when the system must make exactly one decision." },
            { t: "h", text: "Quorum intuition" },
            { t: "p", html: "With <strong>N</strong> replicas, write to <strong>W</strong> and read from <strong>R</strong>. If <strong>R + W &gt; N</strong>, every read overlaps at least one successful write, so it can discover the newest value." },
            { t: "table", headers: ["Setting", "Behavior"], rows: [
              ["N=3, W=2, R=2", "Balanced: survives one replica down and read/write sets overlap"],
              ["W=1, R=1", "Fast but stale reads are possible"],
              ["W=3, R=1", "Writes are slow/strict; reads are fast"],
              ["Sloppy quorum", "Writes go to reachable fallback nodes during failure; availability improves, repair gets harder"],
              ["Read repair", "A read notices stale replicas and repairs them in the background"]
            ] },
            { t: "h", text: "When you need consensus" },
            { t: "ul", items: [
              "Leader election: exactly one primary should accept writes.",
              "Distributed locks and leases: only one worker owns a critical section.",
              "Cluster membership and configuration: every node must agree on who is in the group.",
              "Metadata stores: etcd, ZooKeeper and Consul exist so applications do not invent this badly."
            ] },
            { t: "note", variant: "key", html: "Do not build your own consensus protocol in an interview or a product. Name Raft/Paxos conceptually, then reach for a proven coordination system unless consensus is the product." }
          ]
        },
        {
          id: "service-coordination",
          title: "Service discovery & coordination",
          summary: "How services find each other and stay in sync — registries, gossip, hinted handoff, and the sidecar.",
          minutes: 7,
          tags: ["distributed", "service-discovery", "coordination"],
          blocks: [
            { t: "p", html: "In a dynamic fleet, instances come and go constantly, so hard-coded addresses don't work. <strong>Service discovery</strong> lets a caller ask \u201cwhere is the orders service right now?\u201d A <em>service registry</em> (Consul, etcd, Eureka) tracks healthy instances; clients or a load balancer query it to route requests." },
            { t: "h", text: "Staying consistent without a central boss" },
            {
              t: "ul", items: [
                "<strong>Gossip protocol</strong> — nodes periodically exchange state with a few random peers; membership and health spread epidemic-style, with no central coordinator. Used by Cassandra and DynamoDB.",
                "<strong>Hinted handoff</strong> — if a target node is down, a peer temporarily stores the write and \u201chands it off\u201d when the node returns, preserving availability.",
                "<strong>Sidecar pattern</strong> — run a helper container next to each service to handle discovery, mTLS, retries, and metrics; the backbone of a service mesh (Istio, Linkerd).",
                "<strong>Cell-based architecture</strong> — partition the whole system into isolated cells so a failure is contained to one cell, not the fleet."
              ]
            },
            { t: "note", variant: "key", html: "These are the gears behind the buzzwords. Gossip + hinted handoff are how leaderless stores stay available during failures; the sidecar is how a mesh adds discovery, security, and observability <em>without</em> touching your application code." },
          ]
        }
      ]
    },

    /* ============================ CLOCKS & ORDERING ============================ */
    {
      id: "clocks",
      name: "Clocks & Ordering",
      icon: "compass",
      lessons: [
        {
          id: "physical-time",
          title: "Physical clocks, NTP and uncertainty",
          summary: "Why two machines never agree on the time, what NTP actually guarantees, and why wall-clock timestamps are a dangerous way to decide which write wins.",
          minutes: 8,
          tags: ["clocks", "ntp", "distributed", "ordering"],
          blocks: [
            { t: "p", html: "Every server has a quartz oscillator that drifts \u2014 typically tens of parts per million, which is a few seconds a day if left alone. <strong>NTP</strong> repeatedly corrects each clock against reference servers, but it estimates the offset from round-trip times, so the result is <em>close</em>, not identical. Within one data center a few milliseconds of disagreement is normal; across regions, or during network trouble, it can be far more." },
            { t: "table", headers: ["Clock", "Answers", "Safe for"], rows: [
              ["Wall clock (time of day)", "\u201cWhat time is it?\u201d", "Showing times to people, coarse expiry, logs \u2014 never for ordering writes across machines"],
              ["Monotonic clock", "\u201cHow long since I last looked?\u201d", "Timeouts, durations, rate limiters \u2014 on one machine only; it never jumps backwards"],
              ["Logical clock", "\u201cCould this event have caused that one?\u201d", "Ordering events across machines without trusting physical time"]
            ] },
            { t: "note", variant: "warn", html: "<strong>The wall clock can jump backwards.</strong> An NTP step correction, a VM migration or a manual change can move it. Code that measures a duration as <code class='tok'>end - start</code> on the wall clock can see negative time; use the monotonic clock for durations." },
            { t: "h", text: "Why last-write-wins on timestamps loses data" },
            { t: "code", lang: "text", code:
              "node A clock: +40 ms ahead        node B clock: correct\n\n" +
              "real 12:00:00.000  A writes x=1   stamped 12:00:00.040\n" +
              "real 12:00:00.010  B writes x=2   stamped 12:00:00.010\n\n" +
              "LWW keeps the larger stamp -> x=1\n" +
              "the write that really happened last is silently discarded, no error anywhere"
            },
            { t: "p", html: "Last-write-wins is acceptable only when losing a concurrent update is acceptable (a cache, a presence flag) or when timestamps come from somewhere that respects causality. For anything users would notice, order writes with a single writer per key, a version number checked on write, or a logical clock \u2014 the subject of the next lessons." },
            { t: "note", variant: "tip", html: "Interview phrasing: \u201cI won't order these by server timestamps, because clocks across machines can disagree by more than the gap between two writes. A per-key version with compare-and-set gives me a correct order without trusting the clock.\u201d" },
            { t: "note", variant: "key", html: "<strong>Physical clocks are estimates with error bars, not facts.</strong> Use the wall clock for humans, the monotonic clock for durations, and something that respects causality \u2014 a single writer, a version, or a logical clock \u2014 whenever the order of writes decides which data survives." }
          ]
        },
        {
          id: "logical-clocks",
          title: "Lamport and vector clocks",
          summary: "Happens-before without trusting time: Lamport clocks give a cheap order consistent with causality; vector clocks can also prove two events were concurrent.",
          minutes: 10,
          tags: ["clocks", "lamport", "vector-clocks", "causality"],
          blocks: [
            { t: "p", html: "Event <em>a</em> <strong>happened before</strong> event <em>b</em> if they are on the same process in that order, or <em>a</em> is a send and <em>b</em> its receive, or there is a chain of these between them. If neither happened before the other, they are <strong>concurrent</strong> \u2014 not simultaneous, just unable to have influenced each other." },
            { t: "h", text: "Lamport clocks" },
            { t: "code", lang: "text", code:
              "each process keeps one counter L\n" +
              "  local event or send:  L = L + 1            (attach L to the message)\n" +
              "  receive message m:    L = max(L, m.L) + 1\n\n" +
              "guarantee:   a -> b   implies   L(a) < L(b)\n" +
              "NOT true:    L(a) < L(b) implies a -> b       (they may be concurrent)\n" +
              "total order: sort by (L, process id) to break ties"
            },
            { t: "p", html: "One integer per message buys an order that never contradicts causality, which is enough for things like a total order of operations in a replicated log or mutual-exclusion tickets. What it cannot do is tell you that two writes were concurrent, so it cannot detect a conflict." },
            { t: "h", text: "Vector clocks" },
            { t: "code", lang: "text", code:
              "each process keeps a vector V with one counter per process\n" +
              "  local event or send:  V[self] += 1          (attach V)\n" +
              "  receive message m:    V = elementwise max(V, m.V); V[self] += 1\n\n" +
              "a -> b        iff  V(a) <= V(b) in every position and V(a) != V(b)\n" +
              "concurrent    iff  neither vector is <= the other\n\n" +
              "  [2,0,1] vs [1,3,1]  ->  concurrent: surface as a conflict or merge"
            },
            { t: "widget", id: "orderingLab" },
            { t: "table", headers: ["", "Lamport clock", "Vector clock"], rows: [
              ["Size", "One integer", "One counter per participant"],
              ["Preserves causality", "Yes", "Yes"],
              ["Detects concurrency", "No", "Yes"],
              ["Typical use", "Total order, tie-breaking, log sequence", "Conflict detection in leaderless replicated stores, version vectors"],
              ["Cost to watch", "Invents an order between unrelated events", "Grows with clients or replicas; needs pruning or per-replica (not per-client) entries"]
            ] },
            { t: "note", variant: "trap", html: "Do not put one vector entry per <em>client</em>. With millions of clients the vector explodes. Leaderless stores keep entries per <em>replica</em> that coordinates the write (a version vector), and either return concurrent siblings to the application or merge them with a data-type rule." },
            { t: "note", variant: "key", html: "<strong>Lamport clocks order; vector clocks also explain.</strong> A Lamport timestamp is a cheap order consistent with causality but blind to concurrency; a vector clock proves whether two writes could have seen each other, which is exactly what you need to detect a conflict instead of silently overwriting it." }
          ]
        },
        {
          id: "hlc-truetime",
          title: "Hybrid logical clocks and TrueTime",
          summary: "Two ways to get timestamps that mean something physically and still respect causality: hybrid logical clocks, and bounded clock uncertainty with commit wait.",
          minutes: 9,
          tags: ["clocks", "hlc", "truetime", "spanner", "snapshot"],
          blocks: [
            { t: "p", html: "Databases want timestamps that do two jobs: respect causality like a logical clock, and stay close to real time so \u201cread as of 10:00\u201d or \u201cexpire after a day\u201d means something. Two designs dominate." },
            { t: "h", text: "Hybrid logical clocks (HLC)" },
            { t: "code", lang: "text", code:
              "timestamp = (wall, logical)\n" +
              "  send/local: wall' = max(wall, physical_now)\n" +
              "              logical = (wall' == wall) ? logical + 1 : 0\n" +
              "  receive m:  wall' = max(wall, m.wall, physical_now)\n" +
              "              logical bumps when wall' ties with wall or m.wall\n\n" +
              "properties: a -> b implies hlc(a) < hlc(b)\n" +
              "            hlc.wall stays within the clock-skew bound of real time\n" +
              "            fixed size, unlike a vector"
            },
            { t: "p", html: "HLC is what several distributed SQL databases use for transaction and snapshot timestamps. It does not make clocks agree; it makes the timestamp <em>safe</em> when they disagree, and it relies on an assumed maximum skew. Nodes that exceed that bound are typically taken out of service, because correctness of some reads depends on it." },
            { t: "h", text: "Bounded uncertainty and commit wait (the TrueTime idea)" },
            { t: "p", html: "Google's Spanner exposes time as an <strong>interval</strong>: <code class='tok'>now()</code> returns <code class='tok'>[earliest, latest]</code>, and the true time is guaranteed to be inside it. GPS receivers and atomic clocks in every data center keep that interval small \u2014 a few milliseconds. A committing transaction takes <code class='tok'>latest</code> as its timestamp and then <strong>waits</strong> until <code class='tok'>earliest</code> has passed it before making the commit visible." },
            { t: "diagram", id: "truetime-wait", caption: "Commit wait: hold the commit until the uncertainty interval has passed the chosen timestamp." },
            { t: "p", html: "After the wait, any transaction that starts later \u2014 anywhere in the world \u2014 must get a larger timestamp, so timestamp order matches real-time order. That is <strong>external consistency</strong> (strict serializability) without a global coordinator on every read. The cost is the wait itself, which is why the investment goes into shrinking the uncertainty." },
            { t: "table", headers: ["Approach", "Needs", "Gives", "Costs"], rows: [
              ["Single leader / sequencer", "One node assigns every order", "Total order, simple", "Throughput and availability of that node"],
              ["HLC", "Loosely synchronised clocks with a skew bound", "Causal, near-physical, fixed-size timestamps", "Some reads must handle uncertainty, for example by restarting"],
              ["Bounded uncertainty + commit wait", "Tight, measured clock error (special hardware)", "Real-time order across regions", "Every commit waits roughly the uncertainty"]
            ] },
            { t: "note", variant: "tip", html: "In an interview, describe the <em>concept</em> \u2014 time as an interval, wait out the uncertainty \u2014 rather than claiming you will deploy atomic clocks. Then say what you would do without that hardware: a single sequencer per shard, or HLC with a skew bound." },
            { t: "note", variant: "key", html: "<strong>You cannot remove clock error, so you either carry causality alongside it or wait it out.</strong> HLC carries a logical counter next to physical time and stays safe under bounded skew; commit wait spends a few milliseconds per commit to make timestamp order equal real-time order." }
          ]
        },
        {
          id: "choosing-order",
          title: "Causal vs total order: choosing the trade-off",
          summary: "Name the weakest order the product actually needs, then pick the cheapest mechanism that provides it \u2014 per key, per entity, causal or global.",
          minutes: 8,
          tags: ["ordering", "causal", "total-order", "consensus", "trade-offs"],
          blocks: [
            { t: "p", html: "Ordering is a requirement like latency: stronger is more expensive, so ask for the weakest one that keeps the product correct. Most designs need order <em>within</em> something \u2014 a key, an account, a conversation \u2014 and almost never across everything." },
            { t: "table", headers: ["Guarantee", "Promise", "Cheapest mechanism", "Example need"], rows: [
              ["None", "Any order", "Independent writes, idempotent consumers", "Metrics, clickstream counts"],
              ["Per key / per partition", "Events for one key apply in order", "Partition by key; one writer or one consumer per partition", "Account balance, order state machine"],
              ["FIFO per sender", "One sender's messages arrive in send order", "Sequence number per sender", "A device's edits"],
              ["Causal", "Effects never appear before causes", "Per-entity sequence, or dependency tracking with vector or hybrid clocks", "Replies after messages; comments after posts"],
              ["Total", "Everyone sees one sequence", "Single leader or consensus log (Raft or Paxos)", "Unique usernames, seat assignment, ledger entries"],
              ["Real-time (linearizable)", "Total order that also respects wall-clock real time", "Consensus reads or commit wait", "Locks, leader leases, \u201cread your own write\u201d across regions"]
            ] },
            { t: "h", text: "Decision recipe" },
            { t: "ol", items: [
              "<strong>Find the invariant.</strong> \u201cA balance never goes negative\u201d needs ordered writes per account; \u201ca like count is roughly right\u201d needs none.",
              "<strong>Find its scope.</strong> If the invariant lives inside one entity, order within that entity and partition by it \u2014 the system then scales with the number of entities.",
              "<strong>Prefer a single writer to a clock.</strong> One owner per partition assigning sequence numbers is simpler and more correct than comparing timestamps.",
              "<strong>Use causal order across entities</strong> only where users see cause and effect, and accept concurrency elsewhere \u2014 with an explicit merge or conflict rule.",
              "<strong>Pay for total or linearizable order</strong> only for the small set of operations that truly need it, and route just those through consensus."
            ] },
            { t: "note", variant: "trap", html: "A Kafka topic is ordered per <em>partition</em>, not per topic. Choosing the partition key is choosing your ordering scope: key by account id and each account's events stay in order; increase the partition count later and the key-to-partition mapping changes, so plan that migration." },
            { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> How replication logs, Raft, MVCC snapshot timestamps and isolation levels implement these guarantees inside a database engine is covered in the Ledger atlas (database internals) in this collection. Here the goal is choosing and defending the guarantee in a design." },
            { t: "quiz", id: "hld-clocks" },
            { t: "note", variant: "key", html: "<strong>Order is scoped, and scope is the design decision.</strong> Order within the entity that owns the invariant, partition by that entity, give each partition a single writer, and reserve consensus or commit wait for the few operations that genuinely need one global sequence." }
          ]
        }
      ]
    },

    /* ============================ MESSAGING ============================ */
    {
      id: "messaging",
      name: "Messaging & Streaming",
      icon: "queue",
      lessons: [
        {
          id: "queues",
          title: "Message queues & async processing",
          summary: "Decouple producers from consumers, absorb spikes, and make slow work disappear off the request path.",
          minutes: 8,
          tags: ["messaging", "async"],
          blocks: [
            { t: "p", html: "A <strong>message queue</strong> sits between a producer and a consumer. The producer drops a message and moves on; the consumer processes it later, at its own pace. This single idea unlocks decoupling, resilience, and load-leveling." },
            { t: "code", lang: "text", code:
              "  Producer ──put──►  [ msg | msg | msg | msg ]  ──take──► Consumer(s)\n" +
              "  (web request)            QUEUE                    (workers pull)\n\n" +
              "  Web replies instantly; heavy work (email, thumbnails, billing)\n" +
              "  happens asynchronously in the background."
            },
            { t: "h", text: "Why teams reach for queues" },
            {
              t: "ul", items: [
                "<strong>Decoupling</strong> — producer and consumer can deploy, scale, and fail independently.",
                "<strong>Load leveling</strong> — a traffic spike fills the queue instead of crashing the consumer; workers drain it steadily.",
                "<strong>Resilience</strong> — if a consumer is down, messages wait; nothing is lost.",
                "<strong>Responsiveness</strong> — return to the user immediately; do slow work off the hot path.",
                "<strong>Fan-out</strong> — one event, many independent consumers."
              ]
            },
            { t: "h", text: "Delivery guarantees" },
            {
              t: "compare",
              bad: { title: "At-most-once", items: ["May lose messages, never duplicates", "Fire-and-forget", "OK for metrics where a gap is fine"] },
              good: { title: "At-least-once (common)", items: ["Never lost, but may duplicate", "Requires idempotent consumers", "The pragmatic default"] }
            },
            { t: "note", variant: "trap", html: "<strong>Exactly-once</strong> delivery is famously hard (and usually a marketing claim). In practice you get <em>at-least-once delivery + idempotent processing</em>, which is effectively exactly-once <em>effects</em>. Design consumers to safely handle duplicates (see the Idempotency lesson)." },
            { t: "note", variant: "key", html: "Add a <strong>dead-letter queue (DLQ)</strong> for messages that keep failing. Instead of blocking the queue or retrying forever, poison messages get parked for inspection — a must-have for production reliability." }
          ]
        },
        {
          id: "kafka-pubsub",
          title: "Pub/sub & event streaming",
          summary: "Queues vs logs. Why Kafka keeps the message after you read it, and what that unlocks.",
          minutes: 7,
          tags: ["messaging", "kafka"],
          blocks: [
            { t: "p", html: "There are two shapes of messaging. A <strong>queue</strong> (RabbitMQ, SQS) is a to-do list: each message is delivered to <em>one</em> worker, then removed. A <strong>log</strong> (Kafka, Pulsar) is an append-only ledger: messages are <em>retained</em>, and many independent consumer groups can read the same stream at their own offsets." },
            { t: "compare",
              bad: { title: "Queue (work distribution)", items: ["Message consumed once, then gone", "Competing consumers share the load", "Great for task/job processing", "RabbitMQ, Amazon SQS"] },
              good: { title: "Log / stream (event broadcast)", items: ["Messages retained for days; replayable", "Many consumer groups read independently", "Ordered within a partition", "Kafka, Pulsar, Kinesis"] }
            },
            { t: "h", text: "Why retention changes everything" },
            {
              t: "ul", items: [
                "<strong>Replay</strong> — a new service can reprocess history from offset 0; fix a bug and re-run.",
                "<strong>Multiple consumers</strong> — analytics, search-indexer, and notifier all read the same order stream.",
                "<strong>Event sourcing</strong> — the log <em>is</em> the source of truth; current state is a fold over events.",
                "<strong>Decoupled architecture</strong> — services emit events without knowing who listens (pub/sub)."
              ]
            },
            { t: "note", variant: "tip", html: "Kafka scales by splitting a topic into <strong>partitions</strong>; order is guaranteed <em>within</em> a partition, and the partition key (e.g. user_id) decides placement. More partitions = more parallelism, at the cost of cross-partition ordering." },
            { t: "note", variant: "tip", html: "Rule of thumb: need to <em>distribute tasks</em> to workers? Use a queue. Need to <em>broadcast events</em> to many systems and keep history? Use a log/stream." },
            { t: "note", variant: "key", html: "<strong>Retention is the real difference, not delivery.</strong> A queue hands each message to one worker and forgets it; a log keeps the events so a new consumer, a bug fix or a reprocessing run is possible months later. You are deciding whether history is an asset you can query or a liability you have to store and secure." },
          ]
        },
        {
          id: "event-replay-backpressure",
          title: "Event replay, poison messages & backpressure",
          summary: "Streams are replayable, but replay is only safe when consumers are idempotent and overload has a pressure valve.",
          minutes: 7,
          tags: ["messaging", "streaming", "backpressure"],
          blocks: [
            { t: "p", html: "A retained log lets you fix a bug and replay history. That is a superpower and a foot-gun: the same events can hit downstream systems again, faster than they can process, and one bad event can poison a consumer forever." },
            { t: "table", headers: ["Problem", "Production pattern"], rows: [
              ["Consumer lag grows", "Scale consumers, reduce per-message work, or slow producers before retention expires"],
              ["Poison message retries forever", "Move to DLQ after bounded attempts with reason and payload pointer"],
              ["Replay duplicates side effects", "Idempotent consumer keyed by event id or business key"],
              ["Out-of-order updates", "Partition by entity id and apply version checks"],
              ["Downstream cannot keep up", "Backpressure: pause consumption, reject writes, shed low-priority work or buffer with limits"]
            ] },
            { t: "note", variant: "trap", html: "An unbounded queue hides overload until it becomes data loss or an outage. Bounded queues and explicit backpressure fail earlier, but they fail honestly." },
            { t: "note", variant: "key", html: "<strong>Replay and overload are the same requirement seen twice: bound what a consumer can be asked to absorb.</strong> Dedupe before any irreversible side effect so history can be re-run on purpose, and keep queues bounded so a bad day surfaces as an honest rejection rather than a backlog that quietly ages into data loss." }
          ]
        },
        {
          id: "event-driven-reliability",
          title: "Advanced queues & event-driven reliability",
          summary: "Transactional outbox/inbox, CDC, DLQs, ordering and replay safety for production event systems.",
          minutes: 9,
          tags: ["messaging", "reliability", "cdc", "outbox"],
          blocks: [
            { t: "p", html: "Event-driven systems fail in the gaps between a database commit, a publish, a retry and a consumer side effect. The reliable design makes each gap explicit and recoverable." },
            { t: "table", headers: ["Risk", "Production pattern"], rows: [
              ["DB write succeeds but publish fails", "Transactional outbox: write business row and outbox row in the same transaction, then relay later"],
              ["Consumer mutates twice after retry", "Inbox/dedup table keyed by message id or business id before side effects"],
              ["Bad payload blocks progress", "Bounded retries, DLQ with failure reason, and a safe replay tool"],
              ["Consumer falls behind", "Lag alerts on time-behind and offset-behind, plus autoscaling or load shedding"],
              ["Order matters per entity", "Partition by entity id and keep one ordered consumer lane per partition"],
              ["Need change stream from DB", "CDC reads the DB log and emits durable events without app-level dual writes"]
            ] },
            { t: "code", lang: "text", code:
              "Request transaction:\n" +
              "  update orders set status='paid'\n" +
              "  insert into outbox(event_id, type, payload, status='new')\n" +
              "  commit\n\n" +
              "Relay:\n" +
              "  read unsent outbox rows -> publish -> mark sent\n\n" +
              "Consumer:\n" +
              "  if inbox has event_id: skip\n" +
              "  else record event_id, apply idempotent side effect, commit"
            },
            { t: "note", variant: "warn", html: "<strong>Effectively-once</strong> is a better phrase than exactly-once for most architectures. Brokers can help with transactions and dedupe, but the business effect is correct only when the database write, external side effect and consumer dedupe are designed together." },
            { t: "note", variant: "tip", html: "Replay from a stream is powerful only if handlers are version-aware, idempotent and bounded. Before replaying a month of events, run a small window, watch lag, and disable side effects that should not repeat, such as emails." },
            { t: "note", variant: "key", html: "<strong>Reliability lives in the gaps between components, not inside the broker.</strong> A durable event system is a business write and an outbox row in one transaction, a relay that is safe to repeat, and a consumer that dedupes before doing anything irreversible. Remove any one of the three and at-least-once quietly becomes sometimes-twice, sometimes-never." },
            { t: "quiz", id: "hld-messaging" }
          ]
        },
        {
          id: "sync-async",
          title: "Synchronous vs asynchronous",
          summary: "Wait for the answer, or fire and forget? The choice shapes latency, coupling, and failure behavior.",
          minutes: 5,
          tags: ["messaging", "communication"],
          blocks: [
            { t: "p", html: "<strong>Synchronous</strong> calls block until they get a response (a normal HTTP request). <strong>Asynchronous</strong> calls hand off work and continue — the result arrives later via a callback, a queue, or a webhook." },
            { t: "compare",
              bad: { title: "Synchronous (request/response)", items: ["Simple to reason about; immediate result", "Caller learns of failures instantly", "✗ Caller blocked; latency adds up across hops", "✗ Tight coupling; a slow callee slows you"] },
              good: { title: "Asynchronous (event/queue)", items: ["Non-blocking; absorbs spikes; loosely coupled", "Independent scaling & failure isolation", "✗ Harder to trace & debug (eventual results)", "✗ Need to handle out-of-order / retries"] }
            },
            { t: "p", html: "Most real systems blend both: a synchronous API at the edge that quickly enqueues asynchronous work behind it — fast response now, heavy lifting later." },
            { t: "note", variant: "key", html: "<strong>Ask who is waiting.</strong> Work the user needs before they can continue stays synchronous; everything else moves behind a queue, which is why most systems end up as a fast synchronous edge in front of an asynchronous interior. The bill for that split is paid later, in retries, out-of-order arrival and results that are harder to trace." }
          ]
        }
      ]
    },

    /* ============================ APIs ============================ */
    {
      id: "api",
      name: "APIs & the Edge",
      icon: "plug",
      lessons: [
        {
          id: "rest-graphql-grpc",
          title: "REST vs GraphQL vs gRPC",
          summary: "Three ways services talk. Resources, graphs, and contracts — and when each shines.",
          minutes: 8,
          tags: ["api", "communication"],
          blocks: [
            { t: "p", html: "How should clients and services communicate? The three dominant styles optimize for different things: simplicity, flexibility, and speed." },
            {
              t: "table",
              headers: ["", "REST", "GraphQL", "gRPC"],
              rows: [
                ["Model", "Resources + HTTP verbs", "Single graph, you query fields", "Remote procedure calls"],
                ["Transport", "HTTP/JSON", "HTTP/JSON", "HTTP/2 + Protobuf (binary)"],
                ["Shape control", "Server-defined", "Client picks exact fields", "Strict schema (.proto)"],
                ["Strengths", "Ubiquitous, cacheable, simple", "No over/under-fetching; one round trip", "Fast, tiny, streaming, typed"],
                ["Weak spots", "Over/under-fetch; many endpoints", "Caching & complexity harder", "Not browser-native; less human-readable"],
                ["Great for", "Public CRUD APIs", "Rich client UIs (mobile/web)", "Internal microservice calls"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>Over-fetching</strong> (REST returns more than you need) and <strong>under-fetching</strong> (you must call 3 endpoints to build one screen) are exactly what GraphQL fixes by letting the client request a precise shape. gRPC instead optimizes the <em>wire</em>: binary Protobuf over HTTP/2 with streaming — ideal between services in a mesh." },
            {
              t: "ul", items: [
                "Public API for third parties? → <strong>REST</strong> (familiar, cacheable, tooling everywhere).",
                "Complex UI assembling data from many sources? → <strong>GraphQL</strong>.",
                "Low-latency, high-throughput internal calls? → <strong>gRPC</strong>.",
                "Real-time streams? → gRPC streaming, WebSockets, or SSE (next module)."
              ]
            },
            { t: "h", text: "API design hygiene (any style)" },
            {
              t: "ul", items: [
                "<strong>Versioning</strong> (<code class='tok'>/v1/…</code>) so you can evolve without breaking clients.",
                "<strong>Pagination</strong> — prefer cursor-based over offset for large, changing lists.",
                "<strong>Idempotency keys</strong> on writes so retries don't double-charge.",
                "Consistent <strong>errors</strong>, sensible <strong>status codes</strong>, and <strong>rate limits</strong> (two lessons away)."
              ]
            },
            { t: "note", variant: "key", html: "<strong>Pick the style by who the caller is.</strong> Public and cacheable points at REST, a screen assembling many resources points at GraphQL, and a hot internal hop points at gRPC — and each choice hands you a different hard problem: endpoint sprawl, query cost control, or a binary contract browsers cannot speak. Versioning, cursors, idempotency keys and stable errors are owed to callers either way." }
          ]
        },
        {
          id: "api-gateway",
          title: "API gateways & BFF",
          summary: "One smart front door for many services: auth, routing, rate limiting, and aggregation.",
          minutes: 6,
          tags: ["api", "microservices"],
          blocks: [
            { t: "p", html: "As a monolith splits into many services, you don't want every client talking to every service directly. An <strong>API gateway</strong> is a single entry point that fronts your services and handles the cross-cutting concerns in one place." },
            { t: "code", lang: "text", code:
              "                     ┌──────────────► Users service\n" +
              "  Clients ──► API ──┼──────────────► Orders service\n" +
              "             Gateway├──────────────► Payments service\n" +
              "                    └──────────────► Search service\n\n" +
              "  Gateway does: TLS, authN/Z, routing, rate limiting,\n" +
              "  request aggregation, caching, logging, retries."
            },
            { t: "h", text: "What it centralizes" },
            {
              t: "ul", items: [
                "<strong>Authentication & authorization</strong> — verify the token once at the edge.",
                "<strong>Routing</strong> — map public paths to internal services.",
                "<strong>Rate limiting & throttling</strong> — protect everything behind it.",
                "<strong>Aggregation</strong> — fan out to several services and compose one response.",
                "<strong>Observability</strong> — uniform logging, tracing, metrics.",
                "<strong>Protocol translation</strong> — REST outside, gRPC inside."
              ]
            },
            { t: "note", variant: "tip", html: "A <strong>Backend-for-Frontend (BFF)</strong> is a gateway tailored to one client type — e.g., a mobile BFF returns lean payloads for slow networks, a web BFF returns richer ones. It keeps client-specific shaping out of your core services." },
            { t: "note", variant: "trap", html: "Keep the gateway <em>thin</em>. It's for cross-cutting concerns, not business logic. A gateway stuffed with domain rules becomes a new monolith — and a new single point of failure, so run it redundantly." },
            { t: "note", variant: "key", html: "<strong>A gateway is where cross-cutting concerns go to be written once.</strong> Auth, routing, rate limits, aggregation and tracing genuinely belong at the front door; domain rules do not, because every request in the system passes through this box and whatever you put in it becomes both a shared bottleneck and a shared failure." }
          ]
        },
        {
          id: "rate-limiting",
          title: "Rate limiting",
          summary: "Protect services from abuse and overload. Token bucket, leaky bucket, and window counters.",
          minutes: 8,
          tags: ["api", "reliability", "algorithms"],
          blocks: [
            { t: "p", html: "A <strong>rate limiter</strong> caps how many requests a client may make in a time window — defending against abuse, runaway clients, and cascading overload, and enforcing fair use / billing tiers. Over the limit, you return <code class='tok'>429 Too Many Requests</code>." },
            { t: "widget", id: "tokenbucket" },
            { t: "h", text: "The classic algorithms" },
            {
              t: "table",
              headers: ["Algorithm", "How it works", "Allows bursts?", "Notes"],
              rows: [
                ["Token bucket", "Tokens refill at rate R, cap B; each request spends one", "Yes, up to B", "Most popular; flexible"],
                ["Leaky bucket", "Requests queue; drain at constant rate", "No — smooths output", "Steady outflow; good for shaping"],
                ["Fixed window", "Count per fixed interval (e.g., per minute)", "Spiky at edges", "Simple; allows 2× burst at boundaries"],
                ["Sliding window log", "Timestamp every request; count last N s", "Accurate", "Memory-heavy at scale"],
                ["Sliding window counter", "Weighted blend of two fixed windows", "Smooth", "Great accuracy/cost balance"]
              ]
            },
            { t: "note", variant: "warn", html: "<strong>Fixed-window edge burst:</strong> a client can send the full quota at 11:59:59 and again at 12:00:00 — effectively 2× the limit across the boundary. Sliding-window variants fix this." },
            { t: "h", text: "Where to enforce it" },
            { t: "p", html: "In a distributed fleet, a per-server limiter is too loose (N servers ⇒ N× the limit). Centralize counters in a shared store like <strong>Redis</strong> (atomic increments / Lua scripts), usually at the <strong>API gateway</strong>. Identify clients by API key, user id, or IP — and return <code class='tok'>Retry-After</code> so good clients back off politely." },
            { t: "note", variant: "key", html: "<strong>A rate limiter is only as strong as the place its counter lives.</strong> Choosing between token bucket and a sliding window is really choosing how much burst you will tolerate; keeping the count per instance quietly multiplies every published limit by the size of your fleet. Shared state at the edge, and an honest <code class='tok'>Retry-After</code>, are what make the limit real." },
            { t: "quiz", id: "hld-messaging" }
          ]
        },
        {
          id: "api-design-real-clients",
          title: "API design for real clients",
          summary: "Mobile apps, webhooks, retries, deprecations and partial failures need more than clean endpoint names.",
          minutes: 8,
          tags: ["api", "clients", "reliability"],
          blocks: [
            { t: "p", html: "A real API is used by mobile apps on old versions, partners with retry loops, batch jobs, webhooks, SDKs and dashboards. Design the contract for imperfect networks and slow client upgrades." },
            { t: "table", headers: ["Client problem", "API design answer"], rows: [
              ["Large changing lists", "Cursor pagination with stable sort keys, not offset pagination"],
              ["Retry after timeout", "Idempotency keys on unsafe writes and replay of the original response"],
              ["Asynchronous results", "Webhooks with signed payloads, event ids, retries and delivery status"],
              ["Quota exceeded", "Standard rate-limit headers: limit, remaining, reset and Retry-After"],
              ["One item fails in a batch", "Partial-failure response with per-item status and a correlation id"],
              ["Mobile screen needs many resources", "Mobile BFF shapes a compact response and hides service fan-out"],
              ["Old clients break on new errors", "Stable error envelope with code, message, retryability and docs-free remediation text"]
            ] },
            { t: "code", lang: "text", code:
              "GET /orders?limit=50&cursor=eyJvZmZzZXQiOi4uLn0\n" +
              "-> { items: [...], next_cursor: '...', has_more: true }\n\n" +
              "POST /payments\n" +
              "Idempotency-Key: tenant_42:8f0c...\n" +
              "-> same key + same request returns the same final response\n\n" +
              "429 Too Many Requests\n" +
              "RateLimit-Limit: 1000\n" +
              "RateLimit-Remaining: 0\n" +
              "RateLimit-Reset: 60\n" +
              "Retry-After: 60"
            },
            { t: "note", variant: "tip", html: "Deprecation is an observability problem. Keep telemetry by client id, SDK version and endpoint/field usage so you know who still depends on old behavior before you remove it." },
            { t: "note", variant: "trap", html: "Do not make clients parse English error messages. Messages are for humans; machines need stable error codes, retryability, field pointers and request ids." },
            { t: "note", variant: "key", html: "<strong>Design the contract for the client you cannot upgrade.</strong> Old app versions, retrying partners and overnight batch jobs will keep calling every endpoint you ever shipped, so cursors, idempotency keys, machine-readable errors and per-item batch results are not polish — they are what buys you the right to change the API at all." },
            { t: "quiz", id: "hld-messaging" }
          ]
        }
      ]
    },

    /* ============================ NETWORKING ============================ */
    {
      id: "networking",
      name: "Networking & Real-time",
      icon: "globe",
      lessons: [
        {
          id: "proxies",
          title: "Forward vs reverse proxies",
          summary: "Two middlemen that look similar but sit on opposite ends — one fronts clients, one fronts servers.",
          minutes: 5,
          tags: ["networking"],
          blocks: [
            { t: "p", html: "A <strong>proxy</strong> is an intermediary for requests. The direction it faces is what distinguishes the two kinds." },
            { t: "compare",
              bad: { title: "Forward proxy (client-side)", items: ["Sits in front of clients", "Hides the client from the server", "Corporate egress filter, VPN, web cache", "Server sees the proxy, not the user"] },
              good: { title: "Reverse proxy (server-side)", items: ["Sits in front of servers", "Hides the servers from clients", "LB, TLS termination, caching, WAF", "Client sees one endpoint, not the fleet"] }
            },
            { t: "code", lang: "text", code:
              "Forward:  [Clients] -> (Forward Proxy) ----------> Internet\n" +
              "Reverse:  Internet ----------> (Reverse Proxy) -> [Servers]"
            },
            { t: "note", variant: "key", html: "Your <strong>load balancer, CDN edge, and API gateway are all reverse proxies.</strong> They terminate TLS, cache, route, and shield your origin. Forward proxies are about controlling and anonymizing <em>outbound</em> client traffic." }
          ]
        },
        {
          id: "realtime",
          title: "Real-time delivery: polling, SSE & WebSockets",
          summary: "How servers push data to clients — from crude polling to full-duplex sockets.",
          minutes: 7,
          tags: ["networking", "real-time"],
          blocks: [
            { t: "p", html: "HTTP is request/response — the client asks, the server answers. But chat, live scores, and notifications need the <em>server</em> to push. Here's the ladder of techniques, from worst to best for true real-time." },
            {
              t: "table",
              headers: ["Technique", "How", "Latency", "Cost"],
              rows: [
                ["Short polling", "Client asks every few seconds", "Up to the interval", "Wasteful: mostly empty replies"],
                ["Long polling", "Server holds the request until data, then client re-asks", "Near real-time", "Better, but reconnection churn"],
                ["SSE", "Server streams events over one long-lived HTTP response", "Real-time (push)", "One-way (server→client) only"],
                ["WebSockets", "Persistent, full-duplex TCP connection", "Real-time both ways", "Stateful conns; scaling needs care"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>Pick by directionality.</strong> Server→client only (notifications, live feed, stock ticker)? → <strong>SSE</strong> (simpler, auto-reconnect, works over plain HTTP). Two-way, low-latency (chat, multiplayer, collaborative editing)? → <strong>WebSockets</strong>." },
            { t: "note", variant: "trap", html: "WebSockets are <em>stateful</em> — each connection pins a client to a server, which complicates load balancing and autoscaling. At scale you add a pub/sub backplane (e.g., Redis) so any server can deliver a message to any connected client, regardless of which node holds the socket." },
            { t: "p", html: "Don't forget humble <strong>long polling</strong> — it's a robust fallback that works through restrictive proxies and older clients where WebSockets fail." },
            { t: "note", variant: "key", html: "<strong>Choose the weakest push mechanism the feature actually needs.</strong> One-way updates are perfectly served by SSE and cost you nothing operationally, while full-duplex sockets buy two-way latency and charge for it in statefulness — every connection pins a user to one server, which is what drags a pub/sub backplane and a polling fallback into the design." },
            { t: "quiz", id: "hld-networking" },
          ]
        }
      ]
    },

    /* ============================ RELIABILITY ============================ */
    {
      id: "reliability",
      name: "Reliability & Resilience",
      icon: "shield",
      lessons: [
        {
          id: "availability",
          title: "Availability & the nines",
          summary: "What the nines buy, why critical-path dependencies multiply risk, and which patterns keep failures contained.",
          minutes: 7,
          tags: ["reliability", "availability"],
          blocks: [
            { t: "p", html: "<strong>Availability</strong> is the fraction of time a system can serve users. The headline number is only useful when tied to a user journey: checkout, login, search, stream start, or message send." },
            {
              t: "table",
              headers: ["Availability", "Nickname", "Downtime / year", "Downtime / day"],
              rows: [
                ["99%", "two nines", "~3.65 days", "~14.4 min"],
                ["99.9%", "three nines", "~8.77 hours", "~1.44 min"],
                ["99.99%", "four nines", "~52.6 min", "~8.6 s"],
                ["99.999%", "five nines", "~5.26 min", "~0.86 s"]
              ]
            },
            { t: "note", variant: "tip", html: "Availability multiplies across <em>dependencies in series</em>: if a request needs services each at 99.9%, three of them give 0.999³ ≈ 99.7%. Reduce the number of things on the critical path, and add redundancy so a component's failure isn't the request's failure." },
            { t: "h", text: "Patterns that protect the user path" },
            {
              t: "ul", items: [
                "<strong>Redundancy</strong> — remove single points of failure with N+1 capacity on critical components.",
                "<strong>Failover</strong> — route to a healthy standby or peer without manual heroics.",
                "<strong>Health checks</strong> — remove sick instances before users discover them.",
                "<strong>Circuit breakers</strong> — fail fast while a dependency recovers.",
                "<strong>Bulkheads</strong> — reserve separate pools so one feature cannot exhaust shared resources.",
                "<strong>Graceful degradation</strong> — serve a cached, simpler, or partial response when the full answer is unsafe.",
                "<strong>Retries with backoff and jitter</strong> — recover from blips without synchronized retry storms."
              ]
            },
            { t: "note", variant: "trap", html: "Naive retries are dangerous: when a service wobbles, every client retrying at once creates a <strong>retry storm</strong> that finishes it off. Always use <em>exponential backoff with jitter</em>, cap attempts, and pair retries with a circuit breaker." },
            { t: "note", variant: "key", html: "<strong>Availability is set by the length of the critical path, not the quality of any one component.</strong> Each dependency in series multiplies its failure rate into the request, so the durable wins are removing hops and adding redundancy — and then making sure the recovery behaviour itself, retries most of all, cannot become the outage." }
          ]
        },
        {
          id: "slo-error-budgets",
          title: "SLOs & error budgets",
          summary: "Turn reliability from vibes into an explicit contract: what users need, how you measure it, and when risk must slow down.",
          minutes: 7,
          tags: ["reliability", "sre", "slo"],
          blocks: [
            { t: "p", html: "<strong>Reliability is a product feature</strong>. To engineer it, name the user-visible behavior, measure it as an <strong>SLI</strong>, set the target as an <strong>SLO</strong>, and use the remaining error budget to govern launch risk." },
            { t: "table", headers: ["Term", "Example"], rows: [
              ["SLI", "99.95% of checkout requests return success within 500 ms"],
              ["SLO", "Meet that SLI over a rolling 30-day window"],
              ["SLA", "Customer contract, usually looser than the internal SLO"],
              ["Error budget", "If the SLO is 99.95%, the system may fail 0.05% of valid requests"]
            ] },
            { t: "note", variant: "trap", html: "Do not set SLOs at 100%. Perfect targets make every tiny blip a policy violation and leave no room for deploys, maintenance or honest trade-offs." },
            { t: "note", variant: "key", html: "<strong>An SLO is a spending limit, not a scoreboard.</strong> Naming the user-visible behaviour and its target turns reliability arguments into arithmetic: budget remaining means you may ship risk, budget burning means reliability work comes first. A target of 100% does not remove failure, it removes your ability to decide." }
          ]
        },
        {
          id: "multi-region-resilience",
          title: "Multi-region resilience",
          summary: "Designing across regions is a business-continuity choice with hard trade-offs in data, routing and operations.",
          minutes: 8,
          tags: ["reliability", "multi-region", "disaster-recovery"],
          blocks: [
            { t: "p", html: "A single region can fail from power, network, control-plane or human error. <strong>Multi-region</strong> designs reduce that blast radius, but they add latency, data-consistency choices and operational complexity." },
            { t: "table", headers: ["Pattern", "How it behaves"], rows: [
              ["Backup / restore", "Cheapest; recovery can take hours. Good for low RTO systems."],
              ["Pilot light", "Core data replicated; small standby footprint scales up during disaster."],
              ["Warm standby", "A smaller live stack runs continuously and can take traffic faster."],
              ["Active-active", "Multiple regions serve traffic all the time; hardest because writes and conflicts cross regions."]
            ] },
            { t: "h", text: "The two numbers to ask for" },
            { t: "ul", items: [
              "<strong>RTO</strong> (recovery time objective): how long can the system be down?",
              "<strong>RPO</strong> (recovery point objective): how much data can the business afford to lose?",
              "Low RTO + low RPO usually means higher cost, synchronous replication, or complex conflict handling."
            ] },
            { t: "note", variant: "key", html: "Active-active is not automatically better. For money, inventory and uniqueness, cross-region writes may need a single writer, quorum, escrow or conflict-resolution rule. Pick the model from business correctness, not from ambition." }
          ]
        },
        {
          id: "cell-based-architecture",
          title: "Cell-based architecture & shuffle sharding",
          summary: "Shrink blast radius by routing tenants into isolated mini-stacks, then use shuffle sharding to keep noisy neighbors from sharing every dependency.",
          minutes: 8,
          tags: ["reliability", "fault-isolation", "multi-tenant"],
          blocks: [
            { t: "p", html: "A <strong>cell</strong> is a bounded serving slice: app tier, queues, caches and datastores for a tenant or resource cohort. The goal is simple: a bad deploy, noisy tenant or sick dependency should hurt a known slice, not everyone." },
            { t: "widget", id: "cellrouter" },
            { t: "h", text: "How requests find the right cell" },
            { t: "code", lang: "text", code:
              "request(tenant_id)\n" +
              "  -> edge router reads tenant_id / resource_id\n" +
              "  -> cell map: tenant_42 -> cell-c\n" +
              "  -> route only to cell-c services and data\n\n" +
              "Control plane: assigns tenants, stores routing map, manages migrations\n" +
              "Data plane: serves traffic inside one cell"
            },
            { t: "ul", items: [
              "<strong>Partition key</strong> follows the isolation boundary: tenant, account, region + tenant, or resource owner.",
              "<strong>Per-cell capacity</strong> is capped; new cohorts move to a new cell instead of growing blast radius forever.",
              "<strong>Cell-local dependencies</strong> keep queues, caches, workers and primary stores from becoming global failure points.",
              "<strong>Routing changes</strong> are deterministic, cached at the edge, observable and reversible."
            ] },
            { t: "note", variant: "trap", html: "<strong>Avoid synchronous cross-cell calls on the request path.</strong> They turn isolated cells back into one coupled system: cell A now fails when cell B is slow. Prefer async events, replicated read models, or a shared control plane that is not in the hot path." },
            { t: "h", text: "Shuffle sharding" },
            { t: "p", html: "<strong>Shuffle sharding</strong> assigns each tenant a small deterministic subset of workers, queues or partitions. Tenants may overlap on one member, but rarely on the whole subset, so noisy-neighbor impact stays narrow." },
            { t: "table", headers: ["Design", "Failure blast radius"], rows: [
              ["Shared pool", "One bad deploy or noisy tenant can affect everyone."],
              ["Cells", "Only tenants in the affected cell are hit."],
              ["Shuffle-sharded workers", "A noisy tenant is isolated to its assigned subset; most tenants do not overlap fully."]
            ] },
            { t: "note", variant: "key", html: "Cells are a reliability pattern, not a free lunch. They add routing state, migration workflows, per-cell deploy orchestration, data rebalancing, capacity fragmentation and harder analytics across cells." },
            { t: "quiz", id: "hld-fault-isolation" }
          ]
        },
        {
          id: "multi-tenancy-operations",
          title: "Multi-tenancy operations",
          summary: "Pooled, bridge and silo models are only the start. Operability comes from quotas, cost, noisy-neighbor controls and tenant-aware rollouts.",
          minutes: 8,
          tags: ["multi-tenant", "operations", "saas"],
          blocks: [
            { t: "p", html: "Multi-tenancy is not just a database layout. It is a promise that tenants share a platform without sharing failures, data, cost surprises or rollout risk." },
            { t: "table", headers: ["Model", "Shape", "Operational trade-off"], rows: [
              ["Pooled", "Many tenants share app, DB tables, cache and queues", "Lowest cost, highest need for hard tenant filters and quotas"],
              ["Bridge", "Shared app tier, separate schema/database/queue per tenant or tier", "Good balance; more migrations and routing metadata"],
              ["Silo", "Dedicated stack per tenant or cell", "Best isolation, highest cost and fleet-management overhead"]
            ] },
            { t: "ul", items: [
              "<strong>Per-tenant quotas</strong> on requests, jobs, storage, vector chunks, cache memory and queue depth keep one tenant from consuming the platform.",
              "<strong>Cost attribution</strong> tags every request, job and storage object with tenant id so expensive tenants are visible and billable.",
              "<strong>Noisy-neighbor dashboards</strong> show top tenants by CPU, DB time, cache misses, queue lag, error rate and p99 latency.",
              "<strong>Tenant-aware deploy waves</strong> roll out by low-risk tenants, then normal tenants, then high-value or regulated tenants after metrics stay clean.",
              "<strong>Cross-cell analytics</strong> should read replicated/exported data, not synchronously query every serving cell on a user request."
            ] },
            { t: "note", variant: "trap", html: "A tenant_id column is not isolation by itself. Every query builder, cache key, queue consumer, log sink and admin tool must carry the tenant boundary, or the weakest path leaks data." },
            { t: "note", variant: "key", html: "<strong>Tenancy is an operational property, not a storage layout.</strong> Pooled, bridge and silo only set the starting cost; what tenants actually experience is whether quotas, cache keys, queue partitions, deploy waves and cost attribution all carry the same boundary. Whichever substrate forgets it defines your real isolation, and it is usually the one nobody reviewed." },
            { t: "quiz", id: "hld-fault-isolation" }
          ]
        },
        {
          id: "circuit-breakers-backpressure",
          title: "Circuit breakers, bulkheads & backpressure",
          summary: "Prevent small dependency failures from turning into cascading outages.",
          minutes: 7,
          tags: ["reliability", "resilience", "backpressure"],
          blocks: [
            { t: "p", html: "Cascading failure starts when one slow dependency makes callers wait, callers hold threads, queues grow, retries multiply, and unrelated features run out of shared resources. Resilience patterns exist to <em>stop propagation</em>." },
            { t: "table", headers: ["Pattern", "Protects against"], rows: [
              ["Circuit breaker", "Repeated calls to a known-failing dependency; fail fast during cooldown"],
              ["Bulkhead", "One feature consuming every thread, connection or worker"],
              ["Timeout", "Requests waiting forever and tying up resources"],
              ["Backpressure", "Producers overwhelming consumers; slow or reject work before queues explode"],
              ["Load shedding", "Drop low-priority work to preserve the core user path"]
            ] },
            { t: "code", lang: "text", code:
              "Dependency starts timing out\n" +
              "-> clients retry without jitter\n" +
              "-> dependency sees more traffic while sick\n" +
              "-> caller thread pools fill\n" +
              "-> unrelated requests fail too\n\n" +
              "Fix: timeout + bounded retries + jitter + circuit breaker + bulkhead" },
            { t: "note", variant: "tip", html: "Backpressure is a kindness. Returning 429 or queue-full early is better than accepting work you cannot finish and timing out every user later." },
            { t: "note", variant: "key", html: "<strong>Cascading failure is resource exhaustion, so every pattern here is a way of giving resources back.</strong> Timeouts return threads, breakers stop feeding a sick dependency, bulkheads stop one feature spending the whole pool, and backpressure refuses work that was never going to finish. What they cost is a system that says no more often, and on purpose." }
          ]
        },
        {
          id: "load-shedding-degradation",
          title: "Load shedding & graceful degradation",
          summary: "When the system is overloaded, protect the core path by rejecting low-value work and serving simpler responses on purpose.",
          minutes: 7,
          tags: ["reliability", "resilience", "overload"],
          blocks: [
            { t: "p", html: "<strong>Load shedding</strong> is deliberate refusal: when capacity is exhausted, reject or defer work before queues grow so large that everything times out. It is better to fail 5% quickly than accept 100% and fail them all slowly." },
            { t: "h", text: "Design the priority ladder before the incident" },
            { t: "table", headers: ["Tier", "Examples", "Overload action"], rows: [
              ["Critical", "login, checkout, payment confirm", "keep serving; reserve capacity"],
              ["Important", "search, recommendations, notifications", "serve cached/stale/simple result"],
              ["Optional", "analytics beacons, personalization, previews", "drop, sample, or queue for later"]
            ] },
            { t: "p", html: "<strong>Graceful degradation</strong> is the user-facing half: the page still loads, but with a simpler experience. Examples: hide recommendations, show cached inventory with a freshness label, disable expensive filters, sample metrics, or switch to a smaller model." },
            { t: "compare",
              bad: { title: "Circuit breaker", items: ["Triggered by a failing dependency", "Stops calls to that dependency for a cooldown", "Goal: fail fast and let the dependency recover"] },
              good: { title: "Load shedding", items: ["Triggered by local overload or saturation", "Drops low-priority requests before accepting them", "Goal: preserve capacity for the core path"] }
            },
            { t: "note", variant: "tip", html: "Make shedding explicit and observable: return <code class='tok'>429</code> or <code class='tok'>503</code> with retry hints for clients, tag degraded responses, and alert on sustained shedding because it means demand exceeds safe capacity." },
            { t: "note", variant: "trap", html: "Do not shed blindly. Randomly dropping payment confirmations while keeping homepage experiments alive is backwards. Reserve bulkheads and budgets for the paths the business cannot afford to corrupt." },
            { t: "note", variant: "key", html: "<strong>Overload is a decision you either make in advance or have made for you.</strong> Ranking traffic into tiers before the incident lets the system refuse optional work quickly and serve a deliberately simpler answer on the paths that matter. A system with no ladder still sheds — it just sheds whatever happens to time out first." }
          ]
        },
        {
          id: "idempotency",
          title: "Idempotency",
          summary: "Make 'do this again' safe. The property that turns unreliable networks and at-least-once delivery into correct systems.",
          minutes: 6,
          tags: ["reliability", "correctness"],
          blocks: [
            { t: "p", html: "An operation is <strong>idempotent</strong> if doing it once and doing it many times produce the same result. <code class='tok'>set balance = 100</code> is idempotent; <code class='tok'>add 100 to balance</code> is not. In distributed systems — where requests time out, get retried, and messages are delivered at-least-once — idempotency is what keeps duplicates from causing damage." },
            { t: "code", lang: "text", code:
              "Client sends 'charge $50'. Network times out. Did it go through?\n" +
              "Client retries. Without idempotency -> charged $100. BAD.\n\n" +
              "Fix: client sends an Idempotency-Key (a UUID) with the request.\n" +
              "Server records the key + result. A repeat key returns the SAME\n" +
              "stored result instead of charging again."
            },
            { t: "h", text: "How to make writes idempotent" },
            {
              t: "ul", items: [
                "<strong>Idempotency keys</strong> — client sends a unique key; server stores key→result and dedupes retries.",
                "<strong>Natural idempotency</strong> — design operations as 'set state to X' (PUT) rather than 'increment'.",
                "<strong>Dedup by event id</strong> — consumers track processed message ids and skip repeats.",
                "<strong>Conditional writes</strong> — 'create only if not exists' / compare-and-set on a version."
              ]
            },
            { t: "note", variant: "key", html: "HTTP semantics already encode this: <code class='tok'>GET</code>, <code class='tok'>PUT</code>, and <code class='tok'>DELETE</code> are idempotent by definition; <code class='tok'>POST</code> is not. For non-idempotent creates (payments, orders), require an <strong>idempotency key</strong> — it's the single most important pattern for safe retries." },
          ]
        },
        {
          id: "incident-response-readiness",
          title: "Incident response & operational readiness",
          summary: "Prepare before the pager fires: severity, roles, runbooks, rollback, comms and learning loops.",
          minutes: 8,
          tags: ["reliability", "incident-response", "operations"],
          blocks: [
            { t: "p", html: "Operational readiness is design work. If nobody knows who leads, what to roll back, which dashboard matters, or how to tell users, the system is not production-ready even if the happy path works." },
            { t: "table", headers: ["Readiness item", "Why it matters"], rows: [
              ["Severity levels", "Everyone shares the same language for urgency and customer impact"],
              ["Incident roles", "Commander, comms, scribe and subject experts avoid chaos"],
              ["Runbooks", "Common failures have tested diagnosis and rollback steps"],
              ["Kill switches", "Feature flags, load shedding and queue pauses stop bleeding fast"],
              ["Rollback plan", "Every deploy has a known revert path and data-migration strategy"],
              ["Status comms", "Customers and support get honest updates without distracting responders"],
              ["Post-incident review", "Blameless timeline, contributing factors and tracked follow-ups"]
            ] },
            { t: "code", lang: "text", code:
              "Triage loop:\n" +
              "  1. Declare severity and incident commander\n" +
              "  2. Identify user impact from SLIs, not guesses\n" +
              "  3. Mitigate first: rollback, disable feature, shed load, fail over\n" +
              "  4. Communicate current impact and next update time\n" +
              "  5. Preserve timeline, then fix root causes after service is stable"
            },
            { t: "note", variant: "tip", html: "A good incident process optimizes for <strong>MTTD</strong> (detect), <strong>MTTA</strong> (acknowledge) and <strong>MTTR</strong> (recover). Root-cause perfection can wait until users are safe." },
            { t: "note", variant: "trap", html: "Do not page on unactionable symptoms or vanity metrics. Alerts should have an owner, a runbook, a severity rule and a clear user-impact reason." },
            { t: "note", variant: "key", html: "<strong>Readiness is measured by how quickly you can stop the bleeding without understanding it.</strong> Severity language, a named commander, tested rollbacks and kill switches all exist so mitigation can happen before diagnosis. The root cause is a follow-up ticket written after the service is stable, not an activity performed while users are down." },
            { t: "quiz", id: "hld-reliability" }
          ]
        },
        {
          id: "observability",
          title: "Observability: metrics, logs & traces",
          summary: "You can't operate what you can't see. The three pillars, the four golden signals, and why tracing is non-negotiable in microservices.",
          minutes: 7,
          tags: ["reliability", "observability", "monitoring"],
          blocks: [
            { t: "p", html: "<strong>Observability</strong> is how well you can understand a system's internal state from its outputs. <em>Monitoring</em> tells you <strong>when</strong> something is wrong; observability lets you ask <strong>why</strong> — including questions you didn't anticipate. At scale it's the difference between a 5-minute incident and a 5-hour one." },
            { t: "h", text: "The three pillars" },
            {
              t: "table",
              headers: ["Pillar", "What it is", "Answers", "Tools"],
              rows: [
                ["Metrics", "Numeric time-series (counters, gauges, histograms)", "Is it healthy? trends?", "Prometheus, Graphite"],
                ["Logs", "Timestamped, structured event records", "What exactly happened?", "ELK, Loki, Splunk"],
                ["Traces", "A request's path across services with timing", "Where did the latency go?", "Jaeger, Zipkin, OTel"]
              ]
            },
            { t: "note", variant: "tip", html: "<strong>The four golden signals</strong> (Google SRE) are the metrics to watch first: <strong>Latency</strong> (how long), <strong>Traffic</strong> (how much demand), <strong>Errors</strong> (failure rate), and <strong>Saturation</strong> (how full your resources are). Cover these and you catch most problems." },
            { t: "h", text: "Why distributed tracing is essential" },
            { t: "p", html: "When one user request fans out across 20 microservices, a single log line is useless. <strong>Distributed tracing</strong> attaches a <em>trace id</em> to the request at the edge and propagates it through every hop, so you can reconstruct the whole call tree and see exactly which service added the 800 ms." },
            { t: "code", lang: "text", code:
              "trace_id=abc123  (one request, propagated through every service)\n\n" +
              "  [gateway 5ms] \u2500\u25b6 [auth 12ms] \u2500\u25b6 [orders 40ms] \u2500\u25b6 [db 780ms]  \u2190 the culprit\n" +
              "                              \u2514\u25b6 [inventory 30ms]\n\n" +
              "  Each span records: service, start, duration, parent span, tags."
            },
            { t: "h", text: "SLI, SLO, SLA — and error budgets" },
            {
              t: "ul", items: [
                "<strong>SLI</strong> (indicator) — a measured number, e.g. 'p99 latency' or '% of 200 responses'.",
                "<strong>SLO</strong> (objective) — your internal target for an SLI, e.g. '99.9% of requests succeed'.",
                "<strong>SLA</strong> (agreement) — the contractual promise to customers, with penalties; always looser than the SLO.",
                "<strong>Error budget</strong> — 100% − SLO. A 99.9% SLO permits ~43 min/month of failure; spend it on releases, and freeze risky changes when it runs out."
              ]
            },
            { t: "note", variant: "trap", html: "<strong>Alert on symptoms, not causes.</strong> Page a human when users are affected (error rate up, latency past the SLO), not on every CPU blip — noisy alerts train people to ignore the pager. Good alerts are actionable, rare, and tied to an SLO." },
            { t: "note", variant: "tip", html: "Emit <strong>structured logs</strong> (JSON, not free text) with the trace id, and prefer <strong>histograms over averages</strong> for latency — an average hides the p99 tail where your unhappiest users live." },
            { t: "note", variant: "key", html: "<strong>Instrument for the question you have not thought of yet.</strong> Metrics say something is wrong, traces say where, logs say what — and the leverage comes from one trace id tying all three to a single request. Coverage is cheap; attention is not, so page only on the handful of signals a user would actually notice." },
            { t: "quiz", id: "hld-reliability" }
          ]
        }
      ]
    },
    {
      id: "production-readiness",
      name: "Capacity, Cost & Launch Readiness",
      icon: "gauge",
      lessons: [
        {
          id: "capacity-planning",
          title: "Capacity planning from users to boxes",
          summary: "Turn users into QPS, peak load, app instances, database capacity, queue workers and cache memory before launch day.",
          minutes: 10,
          tags: ["capacity", "estimation", "launch"],
          blocks: [
            { t: "p", html: "Capacity planning is the bridge between a design diagram and a production plan. Start from user behavior, convert it to average QPS, multiply for peak, then allocate capacity across the app tier, database, cache, queue and any third-party dependency." },
            { t: "widget", id: "capacitycalc" },
            { t: "h", text: "The capacity chain" },
            { t: "ol", items: [
              "<strong>Users:</strong> monthly active users, daily active users, session length and actions per session.",
              "<strong>Average QPS:</strong> daily actions / 86,400. Split reads, writes and expensive operations separately.",
              "<strong>Peak QPS:</strong> average QPS x peak multiplier. Consumer apps often see 3x-10x depending on time-of-day and launch events.",
              "<strong>App instances:</strong> peak QPS / safe per-instance QPS, then add N+1 or N+2 headroom.",
              "<strong>Database:</strong> model read QPS, write QPS, index cost, connection limits, storage growth and replication lag.",
              "<strong>Queues:</strong> arrival rate vs worker drain rate. Backlog growth is a capacity bug even if the API still returns 200.",
              "<strong>Cache:</strong> working-set size, item size, hit ratio target, eviction risk and hot-key plan."
            ] },
            { t: "code", lang: "text", code:
              "Example chain:\n" +
              "  2M DAU x 20 actions/day          = 40M actions/day\n" +
              "  40M / 86,400                     ~= 463 QPS average\n" +
              "  peak factor 5x                   ~= 2,315 QPS peak\n" +
              "  app instance safe load 300 QPS   ~= 8 instances\n" +
              "  N+2 headroom                     ~= 10 instances\n\n" +
              "Then split the load:\n" +
              "  reads -> cache + read replicas\n" +
              "  writes -> primary/shards + queue workers\n" +
              "  async work -> queue drain rate >= arrival rate"
            },
            { t: "table", headers: ["Layer", "Capacity question", "Failure smell"], rows: [
              ["App", "How many safe QPS per instance at p95 CPU < 60-70%?", "Autoscaler chases load but p99 keeps rising."],
              ["Database", "Can primary writes, read replicas and connections handle peak?", "CPU is fine but lock waits, IO or connections saturate."],
              ["Queue", "Can workers drain faster than producers enqueue?", "Backlog age rises during every peak and never fully recovers."],
              ["Cache", "Is hot working set smaller than memory with room for churn?", "Hit ratio collapses after deploys or traffic spikes."],
              ["Third party", "Do provider quotas cover peak and retries?", "Your fallback path fails because the dependency rate-limits first."]
            ] },
            { t: "note", variant: "tip", html: "Capacity is not one number. Track at least <strong>traffic</strong>, <strong>latency</strong>, <strong>errors</strong> and <strong>saturation</strong> for every critical layer, then decide what runs out first." },
            { t: "note", variant: "trap", html: "Do not size only for the happy path. Retries, cache misses, replays, migrations and failover all add load exactly when the system is already stressed." },
            { t: "note", variant: "key", html: "<strong>Capacity planning is about finding which layer runs out first, not how big the fleet is.</strong> The chain from users to instances is easy arithmetic; the honest part is sizing for the load that only exists when things go wrong, because retries, cold caches, replays and failover all arrive together, and they arrive at peak." }
          ]
        },
        {
          id: "cost-modeling",
          title: "Cost modeling and unit economics",
          summary: "Estimate compute, storage, bandwidth, egress, API and LLM costs early enough to change the architecture.",
          minutes: 9,
          tags: ["cost", "capacity", "finops"],
          blocks: [
            { t: "p", html: "A scalable design that loses money per request is not production-ready. Cost modeling turns architecture into unit economics: what does one user, one upload, one generated answer or one checkout cost to serve?" },
            { t: "h", text: "The cost buckets" },
            { t: "table", headers: ["Bucket", "What to estimate", "Design lever"], rows: [
              ["Compute", "Instance count x hours, CPU-heavy workers, GPU/model serving", "Right-size, autoscale, batch, use cheaper tiers off peak."],
              ["Storage", "Raw bytes x replication x retention x indexes/backups", "Lifecycle cold data, compress, delete derived data that can be rebuilt."],
              ["Bandwidth", "Bytes served to clients and between services/regions", "Cache at edge, compress, avoid chatty cross-region calls."],
              ["Egress", "Data leaving a cloud/provider boundary", "Keep compute near data, avoid unnecessary multi-cloud hot paths."],
              ["API calls", "Paid provider calls, retries, webhooks, payment/search/email quotas", "Cache, batch, dedupe and add circuit breakers."],
              ["LLM usage", "Input tokens + output tokens + embeddings + reranking", "Token budgets, semantic cache, model router, smaller fallback model."]
            ] },
            { t: "code", lang: "text", code:
              "Monthly cost sketch:\n" +
              "  app compute      = instances * hourly_rate * 730\n" +
              "  object storage   = stored_TB * storage_rate * replicas/overhead\n" +
              "  bandwidth        = outbound_TB * egress_rate\n" +
              "  provider APIs    = calls * price_per_call\n" +
              "  LLM feature      = (input_tokens + output_tokens) * model_rate\n" +
              "                   + embedding_tokens * embedding_rate\n" +
              "                   + reranker_calls * reranker_rate\n\n" +
              "Unit cost = monthly cost / successful business events"
            },
            { t: "h", text: "Architecture choices that move cost" },
            { t: "ul", items: [
              "<strong>Cache hit ratio</strong> often dominates read-heavy cost: a 95% hit ratio means the database sees only 1 in 20 reads.",
              "<strong>Data retention</strong> changes storage math more than database choice. Five years of raw events can dwarf the serving system.",
              "<strong>Cross-region calls</strong> cost twice: latency plus egress. Keep user-facing paths local where possible.",
              "<strong>LLM token budgets</strong> are product requirements. Decide maximum context, answer length, model class and retry policy deliberately.",
              "<strong>Retries</strong> are hidden spend. Exponential backoff and idempotency prevent retry storms from multiplying cost and load."
            ] },
            { t: "note", variant: "tip", html: "Add a <strong>cost per successful request</strong> dashboard next to latency and errors. It catches regressions like a prompt change that doubles tokens or a cache bug that shifts traffic to a paid API." },
            { t: "note", variant: "key", html: "<strong>Cost per successful event is an architectural metric, not a finance one.</strong> Retention policy, cache hit ratio, cross-region hops and token budgets move unit economics further than any instance-type decision — and all four are nearly free to change while the design is still a diagram, and expensive to change once traffic depends on them." }
          ]
        },
        {
          id: "launch-readiness",
          title: "Launch readiness and release gates",
          summary: "N+1/N+2 capacity, load tests, canaries, rollbacks, dashboards and error-budget freezes.",
          minutes: 10,
          tags: ["launch", "release", "sre", "reliability"],
          blocks: [
            { t: "p", html: "Launch readiness is a checklist with teeth. It asks: if traffic arrives tomorrow, what breaks first, who sees it, how do we stop the rollout, and what feature can we turn off to protect the core path?" },
            { t: "h", text: "N+1 and N+2 headroom" },
            { t: "p", html: "<strong>N</strong> is the capacity required for expected peak. <strong>N+1</strong> means the fleet still works if one instance, node or zone-sized slice is unavailable. <strong>N+2</strong> adds another failure or deploy buffer. The right choice depends on blast radius and recovery time, not a universal rule." },
            { t: "compare",
              bad: { title: "Capacity without headroom", items: ["Passes a happy-path load test at 100%", "Autoscaling starts only after saturation", "One node loss pushes the rest above safe CPU", "No room for deploy overlap or retries"] },
              good: { title: "Launch-ready capacity", items: ["Peak traffic fits below safe utilization", "N+1 or N+2 survives common failures", "Queue drain rate exceeds arrival rate", "Canary and rollback tested before launch"] }
            },
            { t: "h", text: "Load-test plan" },
            { t: "ol", items: [
              "<strong>Baseline:</strong> expected peak traffic, realistic read/write mix, representative payload sizes and cache warm state.",
              "<strong>Stress:</strong> increase load until the first bottleneck is obvious; document the failure mode.",
              "<strong>Soak:</strong> run for hours to find leaks, connection churn, queue drift and slow compaction effects.",
              "<strong>Failover:</strong> kill an app node, cache node, worker pool member and replica; confirm traffic drains and recovers.",
              "<strong>Cold-start:</strong> validate behavior after cache flush, deploy restart or a new region/cell coming online."
            ] },
            { t: "h", text: "Release gates" },
            { t: "table", headers: ["Gate", "Pass signal"], rows: [
              ["Canary", "1% then 10% traffic holds SLOs, error rate and saturation within guardrails."],
              ["Rollback", "One command or automated policy restores the previous version and data compatibility is preserved."],
              ["Dashboards", "Golden signals, business counters, queue age, cache hit ratio, dependency errors and cost are visible."],
              ["Alerts", "Page on user-impacting burn rate, not on noisy internals alone."],
              ["Error-budget freeze", "If the service is already burning budget, freeze risky launches until reliability recovers."],
              ["Runbook", "Known failure modes have owners, links to dashboards and first mitigation steps."]
            ] },
            { t: "note", variant: "tip", html: "A canary is only as good as the signals that guard it. Measure p95/p99 latency, errors, saturation and business success rate for both canary and control." },
            { t: "note", variant: "trap", html: "Rollback is a product feature. If schema changes, caches, clients or background jobs make rollback impossible, call that out before launch day and use expand/contract migrations." },
            { t: "note", variant: "key", html: "<strong>Launch readiness is the ability to undo, proven before you need it.</strong> Headroom, load tests and canaries only tell you what breaks first; the gate that decides your worst day is whether one command restores the previous version with the data still compatible. That is a constraint on migrations, caches and clients, not a deploy-day checklist item." },
            { t: "quiz", id: "hld-production-readiness" }
          ]
        },
        {
          id: "design-doc-adr-practice",
          title: "Design docs and ADR interview practice",
          summary: "Practice turning architecture choices into clear decisions, trade-offs, risks and follow-up experiments.",
          minutes: 8,
          tags: ["design-doc", "adr", "interview"],
          blocks: [
            { t: "p", html: "A strong design doc is not a diagram dump. It is a decision record: the problem, constraints, options considered, recommendation, consequences, rollout plan and open risks. Interviews reward the same structure because it shows judgment under ambiguity." },
            { t: "h", text: "One-page design doc skeleton" },
            { t: "table", headers: ["Section", "What it must answer"], rows: [
              ["Context", "What problem are we solving, for whom, and why now?"],
              ["Goals / non-goals", "What outcomes matter, and what is intentionally out of scope?"],
              ["Scale and SLOs", "Users, QPS, data growth, latency, availability and cost targets."],
              ["Options", "At least two credible designs with trade-offs, not one pre-decided answer."],
              ["Decision", "Chosen approach and why it fits the constraints better."],
              ["Risks", "Failure modes, security/privacy concerns, cost risks and migration hazards."],
              ["Launch plan", "Phases, canary, rollback, dashboards, owners and success criteria."]
            ] },
            { t: "h", text: "ADR shape" },
            { t: "code", lang: "text", code:
              "ADR: Use a queue between checkout and ticket issuance\n\n" +
              "Status: Accepted\n" +
              "Context: Ticket issuance can spike and provider calls are slow.\n" +
              "Decision: Checkout writes an order event; workers issue tickets asynchronously.\n" +
              "Consequences:\n" +
              "  + API latency is protected from provider slowness\n" +
              "  + retries and idempotency are centralized in workers\n" +
              "  - users may see 'pending' for a short period\n" +
              "  - queue age becomes a launch-critical metric"
            },
            { t: "h", text: "Interview drill" },
            { t: "ul", items: [
              "After sketching the design, ask: <em>what are my top two risks?</em> Then deep-dive those, not every box.",
              "When choosing between SQL, NoSQL, queue, cache or region strategy, name the losing option and why it lost.",
              "End with a launch story: load test, canary, dashboards, rollback and what you would defer.",
              "Use ADR language for trade-offs: <strong>because</strong>, <strong>therefore</strong>, <strong>consequence</strong>."
            ] },
            { t: "h", text: "Rubric: design doc / ADR practice" },
            { t: "ul", items: [
              "<strong>Problem framing:</strong> goals, non-goals, scale, SLOs and constraints are explicit before solution boxes appear.",
              "<strong>Options:</strong> at least two credible alternatives are compared, including why the losing option lost.",
              "<strong>Decision quality:</strong> the recommendation ties back to user value, correctness, cost, operability and team constraints.",
              "<strong>Risk handling:</strong> failure modes, security/privacy concerns, migration hazards and open questions have owners or experiments.",
              "<strong>Launch readiness:</strong> canary, rollback, dashboards, success criteria and follow-up ADRs are named."
            ] },
            { t: "note", variant: "tip", html: "In interviews, a concise decision log beats a perfect-looking diagram. The interviewer wants to see how you choose, not just what boxes you remember." },
            { t: "note", variant: "key", html: "<strong>A design doc is judged on the option you rejected.</strong> Anyone can present an architecture that would work; judgment shows in naming two credible approaches, saying which constraint decided between them, and owning the consequences you accepted. That is also the calibration bar in a design interview — the recommendation earns far less credit than the reasoning that narrowed it." }
          ]
        },
        {
          id: "containers-delivery",
          title: "Containers & deployment topology",
          summary: "The HLD-level view of shipping: one immutable artifact, an orchestrator that places it, and a rollout strategy that decides how much capacity you hold and how fast you can go back.",
          minutes: 6,
          tags: ["delivery", "containers", "deployment", "release"],
          blocks: [
            { t: "p", html: "In a design interview, deployment is about <strong>topology and blast radius</strong>, not Dockerfiles. Ship one immutable image; let an orchestrator spread replicas across zones behind health-checked load balancers; pick a rollout by how much spare capacity you hold and how fast you must get back." },
            { t: "code", lang: "text", code:
              "CI builds image@sha256  ->  registry\n" +
              "                              |\n" +
              "   region A                   v                 region B\n" +
              "   zone 1   zone 2   zone 3        zone 1   zone 2   zone 3\n" +
              "   [svc]    [svc]    [svc]         [svc]    [svc]    [svc]   replicas spread across zones\n" +
              "      \\       |       /               \\       |       /\n" +
              "       load balancer  <--- health checks --->  load balancer\n" +
              "                 \\                            /\n" +
              "                  global traffic routing (DNS / anycast)"
            },
            { t: "table", headers: ["Rollout", "Extra capacity", "Rollback speed", "Use it when"], rows: [
              ["Rolling", "Little", "Minutes", "Backward-compatible changes to stateless services"],
              ["Blue-green", "A full copy", "Seconds (flip the LB)", "Risky releases worth double capacity"],
              ["Canary", "A small slice", "Seconds", "Changes judged on error rate and latency at 1% \u2192 10% \u2192 100%"],
              ["Feature flag", "None", "Instant", "Separating deploy from release"]
            ] },
            { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Image builds, container hardening, Kubernetes and CI/CD deployment automation are covered in the Forge atlas (DevSecOps) in this collection." },
            { t: "note", variant: "key", html: "<strong>An immutable artifact lets the rollout become the safety mechanism</strong> \u2014 provided health checks can abort it and schema changes stay backward compatible (see <a href='#/hld/data/zero-downtime-data-migrations'>zero-downtime data migrations</a>) so the old version can still run." }
          ]
        }
      ]
    },
    {
      id: "architecture",
      name: "Architecture Styles",
      icon: "blocks",
      lessons: [
        {
          id: "monolith-microservices",
          title: "Monolith vs microservices",
          summary: "The most over-debated decision in our field, reframed around team size and real trade-offs — not fashion.",
          minutes: 8,
          tags: ["architecture", "microservices"],
          blocks: [
            { t: "p", html: "A <strong>monolith</strong> is one deployable unit containing all features. <strong>Microservices</strong> split the system into many small, independently deployable services owning their own data. Neither is 'modern' or 'legacy' — each fits a different stage and team shape." },
            { t: "compare",
              bad: { title: "Monolith", items: ["✓ Simple to build, test, deploy, debug", "✓ Fast local calls; easy transactions", "✓ One codebase, one pipeline", "✗ Scales as one blob; small change → full redeploy", "✗ One bug can take down everything", "✗ Tech stack is locked in"] },
              good: { title: "Microservices", items: ["✓ Independent deploy & scale per service", "✓ Team & tech autonomy; fault isolation", "✓ Scale only the hot path", "✗ Distributed-systems tax: network, tracing, consistency", "✗ Ops complexity (CI/CD, observability) explodes", "✗ Cross-service transactions need sagas"] }
            },
            { t: "note", variant: "tip", html: "<strong>Conway's Law:</strong> systems mirror the communication structure of the org that builds them. Microservices pay off when you have <em>many teams</em> that need to ship independently. With one small team, a monolith is almost always faster and cheaper." },
            { t: "note", variant: "tip", html: "<strong>Start with a (well-modularized) monolith.</strong> Extract services later along seams that hurt — the parts that need independent scaling or ownership. Premature microservices give you all the distributed complexity with none of the team-scaling benefit." },
            { t: "h", text: "If you do go distributed" },
            {
              t: "ul", items: [
                "<strong>Database per service</strong> — no shared DB, or you've just built a distributed monolith.",
                "<strong>Async events</strong> between services to reduce coupling and tight failure chains.",
                "<strong>Sagas</strong> for business transactions spanning services (no 2-phase commit).",
                "<strong>Observability first</strong> — distributed tracing, centralized logs, and per-service health are non-negotiable.",
                "<strong>API gateway + service discovery</strong> to manage the sprawl."
              ]
            },
            { t: "note", variant: "key", html: "<strong>Split along team boundaries, not along nouns.</strong> Microservices exchange local function calls for network calls, shared transactions for sagas, and one pipeline for many — a fair price when independent teams need to ship without coordinating, and pure overhead when one team is paying it. The seams worth extracting are the ones that already hurt." }
          ]
        },
        {
          id: "distributed-transactions",
          title: "Distributed transactions: Saga & 2PC",
          summary: "Once each service owns its own database, a single ACID transaction is impossible. How to keep money and inventory correct across services.",
          minutes: 8,
          tags: ["architecture", "transactions", "saga", "consistency"],
          blocks: [
            { t: "p", html: "In a monolith, 'charge the card AND reserve the item AND create the order' is one <strong>ACID transaction</strong> — all or nothing. Split those into three services with three databases and that guarantee vanishes: there's no shared transaction to roll back. This is the hardest tax of microservices." },
            { t: "h", text: "Option 1 — Two-Phase Commit (2PC)" },
            { t: "p", html: "A <strong>coordinator</strong> asks every participant to <em>prepare</em> (phase 1); if all vote yes, it tells them to <em>commit</em> (phase 2); any 'no' triggers a global abort. It gives true atomicity — but it's <strong>synchronous and blocking</strong>: participants hold locks until the coordinator decides, and if the coordinator dies mid-protocol everyone is stuck." },
            { t: "note", variant: "trap", html: "2PC trades availability for consistency (it's a CP protocol) and scales poorly — one slow participant stalls everyone, and the coordinator is a single point of failure. Most internet-scale systems avoid it in favour of sagas." },
            { t: "h", text: "Option 2 — the Saga pattern" },
            { t: "p", html: "A <strong>saga</strong> breaks the work into a sequence of <em>local</em> transactions, one per service. If a step fails, the saga runs <strong>compensating transactions</strong> to undo the prior steps — semantic rollback instead of a locked global commit. It's eventually consistent but stays available." },
            { t: "code", lang: "text", code:
              "Happy path:   reserve item \u2192 charge card \u2192 create order \u2713\n\n" +
              "Card declined at step 2 \u2192 run compensations backwards:\n" +
              "   (undo) release item  \u2190  charge failed\n\n" +
              "Each step has a matching 'undo':\n" +
              "   reserve item   \u2194  release item\n" +
              "   charge card    \u2194  refund card\n" +
              "   create order   \u2194  cancel order"
            },
            {
              t: "compare",
              bad: { title: "Choreography", items: ["Each service reacts to events, no central brain", "Loosely coupled, no coordinator SPOF", "✗ Hard to follow the flow; cyclic event risk", "Good for simple, few-step sagas"] },
              good: { title: "Orchestration", items: ["A central orchestrator tells each service what to do next", "Flow is explicit and easy to monitor", "✗ The orchestrator is a component to run & scale", "Good for complex, many-step sagas"] }
            },
            { t: "note", variant: "tip", html: "Sagas demand <strong>idempotent</strong> steps and <strong>compensations</strong> (retries are inevitable — the Reliability module's idempotency keys apply here) and they expose intermediate states, so design for them: an order can be 'pending' before it's 'confirmed'. Halo famously scaled to 11.6M users on exactly this pattern." },
            { t: "note", variant: "tip", html: "Prefer a saga for cross-service business transactions; reserve 2PC for the rare case where you truly cannot tolerate any intermediate inconsistency and the participants are few and fast. Often the best fix is to <em>redraw service boundaries</em> so the transaction lives inside one service." },
            { t: "note", variant: "key", html: "<strong>Once every service owns its own database, atomicity stops being a database feature and becomes a business decision.</strong> A saga replaces rollback with compensation and promotes intermediate states — pending, reserved, refunded — into the domain model. If the product cannot tolerate those states, the honest fix is moving the boundary, not adding a coordinator." },
            { t: "quiz", id: "hld-architecture" }
          ]
        },
        {
          id: "api-schema-evolution",
          title: "API versioning & schema evolution",
          summary: "Production systems live for years. Contracts must evolve without breaking old clients or corrupting event consumers.",
          minutes: 8,
          tags: ["architecture", "api", "schema-evolution"],
          blocks: [
            { t: "p", html: "The first version of an API is easy; the tenth is architecture. Mobile apps, partners, services and event consumers update on different schedules, so a contract change must be rolled out as a compatibility plan, not a surprise." },
            { t: "table", headers: ["Change", "Compatibility"], rows: [
              ["Add optional response field", "Usually safe; old clients ignore it"],
              ["Remove or rename a field", "Breaking; keep old field during migration"],
              ["Make optional field required", "Breaking for old writers"],
              ["Add enum value", "Can break clients that assume exhaustive lists"],
              ["Change type or meaning", "Breaking even if the field name stays the same"]
            ] },
            { t: "h", text: "Safe evolution pattern" },
            { t: "ol", items: [
              "<strong>Expand</strong>: add the new field, endpoint or event version while keeping the old one.",
              "<strong>Dual-write / dual-read</strong>: support both shapes and measure old usage.",
              "<strong>Migrate consumers</strong>: publish a deadline, SDK update and test fixtures.",
              "<strong>Contract-test</strong>: producer changes must pass consumer expectations in CI.",
              "<strong>Contract</strong>: remove the old shape only after usage is gone."
            ] },
            { t: "note", variant: "tip", html: "For events, prefer versioned schemas with backward/forward compatibility checks. A broken event schema can take down many consumers that the producer team never talks to." },
            { t: "note", variant: "trap", html: "Versioning is not a license to abandon old clients forever. Every version needs ownership, telemetry and an end-of-life path, or support cost grows without bound." },
            { t: "note", variant: "key", html: "<strong>Compatibility is a rollout plan, not a version number.</strong> Add before you remove, run both shapes while you measure who still uses the old one, and give every version an owner and an end date. Event consumers need this most, because the producing team usually cannot name everyone who is listening." }
          ]
        }
      ]
    },
    {
      id: "cases",
      name: "Case Studies",
      icon: "map",
      lessons: [
        {
          id: "mobile-offline-sync",
          title: "Case study: mobile offline-first sync",
          summary: "Design a notes/tasks app that works on airplanes: local DB source of truth, operation log, delta sync, conflict handling and battery-aware scheduling.",
          minutes: 12,
          tags: ["case-study", "mobile", "offline-first", "sync"],
          blocks: [
            { t: "p", html: "Offline-first design starts with a product promise: users can read and edit when the network disappears. The client renders from its <strong>local database</strong>; the server is the shared convergence point, not a dependency for every button press." },
            { t: "h", text: "Requirements and constraints" },
            { t: "ul", items: [
              "Create, edit, delete and search notes while offline; the UI must update immediately.",
              "Sync when connectivity returns, across multiple devices for the same account.",
              "Survive app kills, battery saver, flaky networks and duplicate retries.",
              "Converge deterministically, preserve user intent where possible, and surface hard conflicts clearly."
            ] },
            { t: "h", text: "Client data model" },
            { t: "table", headers: ["Local table", "Responsibility"], rows: [
              ["<code>notes</code>", "Materialized local view rendered by the UI; includes version, deleted flag and last local edit time."],
              ["<code>sync_operations</code>", "Append-only operation log / sync queue: create, update field, delete, attach file, reorder."],
              ["<code>sync_checkpoint</code>", "Last server cursor pulled, last operation pushed, retry state and device id."],
              ["<code>conflicts</code>", "Records that need field merge or user resolution, with both local and remote values."]
            ] },
            { t: "code", lang: "text", code:
              "User edit -> write local note + append operation atomically\n" +
              "UI      -> observes local DB, no network wait\n" +
              "Pusher  -> sends pending operations in order, with idempotency keys\n" +
              "Puller  -> fetches server deltas after checkpoint cursor\n" +
              "Merger  -> applies remote changes, resolves or records conflicts\n" +
              "Cleaner -> compacts acked operations and old tombstones"
            },
            { t: "h", text: "Push and pull delta sync" },
            { t: "p", html: "The client pushes pending operations with a stable <code class='tok'>operation_id</code>, <code class='tok'>device_id</code>, entity id and base version. The server dedupes, validates authorization, applies the change, and returns the new version. Pull sync asks for deltas after cursor C for the scoped collection." },
            { t: "ul", items: [
              "<strong>Checkpoints</strong> make sync resumable: if the app dies after sending operation 105 but before saving the ack, retrying 105 is safe because the server dedupes it.",
              "<strong>Retries</strong> use exponential backoff and jitter; permanent validation errors move the operation to a failed state for user-visible repair.",
              "<strong>Crash recovery</strong> replays the local DB plus unacked operations. Never keep the only copy of pending edits in memory.",
              "<strong>Partial sync</strong> scopes data by workspace, project, folder, time window or subscription so a phone does not pull an entire company history."
            ] },
            { t: "h", text: "Deletes, tombstones and attachments" },
            { t: "p", html: "Deletes need <strong>tombstones</strong>: a lightweight record saying entity X was deleted at version V. Without tombstones, another device can resurrect a deleted note because it simply never hears about the delete. Tombstones are retained until every active device checkpoint has advanced beyond them, then compacted." },
            { t: "note", variant: "tip", html: "Large attachments usually sync out-of-band: first create metadata and a content hash in the operation log, then upload/download bytes with resumable chunks. The note can show a pending attachment badge while bytes catch up." },
            { t: "h", text: "Conflict resolution" },
            { t: "table", headers: ["Strategy", "Use when", "Trade-off"], rows: [
              ["Last-write-wins (LWW)", "Low-value fields such as color or collapsed/expanded state", "Simple, but can discard a real edit."],
              ["Hybrid logical clock (HLC)", "You need causality-ish ordering across devices without trusting wall clocks alone", "More robust than timestamps, still not business intent."],
              ["Field-level merge", "Different fields changed independently, such as title vs reminder date", "Requires per-field versions or patches."],
              ["User resolution", "Two edits changed the same important text or amount", "Slower, but preserves trust for high-value data."],
              ["CRDT-style data type", "Collaborative counters, sets or text-like structures with well-defined merge rules", "Powerful for the right shape, but not magic; product rules and storage cost still matter."]
            ] },
            { t: "note", variant: "tip", html: "Phrase conflict policy in product language: 'a deleted task stays deleted unless the user explicitly restores it' is clearer than 'delete wins'. The implementation follows the policy." },
            { t: "h", text: "Battery, bandwidth and scheduling" },
            { t: "ul", items: [
              "Run a short foreground sync after user edits or app resume, then batch background work.",
              "Prefer Wi-Fi and charging for heavy pulls, media uploads and index rebuilds.",
              "Use OS background task APIs instead of a tight polling loop; mobile platforms will throttle abusive sync.",
              "Compress and page deltas; skip low-priority collections on metered or poor networks.",
              "Expose sync status: saved locally, syncing, synced, conflict, failed."
            ] },
            { t: "h", text: "Rubric: offline sync design review" },
            { t: "ul", items: [
              "<strong>Local-first UX:</strong> UI reads from local state and every edit is durable before the network call.",
              "<strong>Retry safety:</strong> operations have stable ids, idempotent server handling and crash recovery for stale in-flight work.",
              "<strong>Delta discipline:</strong> pull is cursor-based, scoped, paged and protected by authorization filters.",
              "<strong>Conflict policy:</strong> field merge, tombstones, LWW and user resolution are chosen by product value, not convenience.",
              "<strong>Mobile constraints:</strong> sync respects battery, bandwidth, background limits and attachment chunking.",
              "<strong>Trust boundary:</strong> the server validates versions, invariants and permissions before advancing shared state."
            ] },
            { t: "note", variant: "trap", html: "Do not make the server accept arbitrary client state as truth. Clients send operations; the server validates authorization, versions and invariants before advancing the shared record." },
            { t: "note", variant: "key", html: "<strong>Offline-first means the local database is the product and the server is the referee.</strong> Every edit lands durably on the device before any network call, and the client ships intent as an idempotent operation log rather than whole records — which is precisely what lets the server keep enforcing versions and permissions. Tombstones, conflict policy and battery-aware scheduling all follow from that split." },
            { t: "quiz", id: "hld-offline-sync" }
          ]
        },
        {
          id: "real-world-tour",
          title: "A tour of real-world architectures",
          summary: "How the giants actually scaled — the recurring patterns behind Netflix, Instagram, Uber, S3 and more, summarized.",
          minutes: 10,
          tags: ["case-study", "real-world", "architecture"],
          blocks: [
            { t: "p", html: "The fastest way to build design intuition is to study how real companies solved real scale. The remarkable thing is how <em>few</em> patterns keep recurring — the same dozen ideas from this track, recombined. Here's a tour, grouped by theme." },
            { t: "h", text: "Feeds & social: the fan-out problem" },
            { t: "p", html: "Netflix, Instagram, Twitter/X, Reddit, LinkedIn and Tinder all wrestle with one question: when a user opens the app, how do you assemble their personalized feed <em>fast</em>? The universal answer is <strong>fan-out on write</strong> (push each new post into followers' precomputed feeds — great for read-heavy timelines) versus <strong>fan-out on read</strong> (assemble on demand — better for celebrities with millions of followers). Big systems use a <em>hybrid</em>: precompute for normal users, pull-on-read for the rare mega-accounts." },
            {
              t: "ul", items: [
                "<strong>Netflix</strong> — microservices + CDN: 'Open Connect' edge appliances cache video inside ISPs, while hundreds of stateless services (recommendations, playback, billing) scale independently. Chaos engineering deliberately kills instances to prove resilience.",
                "<strong>Instagram</strong> — scaled to billions on a famously small team with a <em>boring</em>, horizontally-sharded stack: Postgres + Cassandra, heavy memcached caching, shard by user id. Simplicity that scales beats cleverness.",
                "<strong>Twitter / X timeline</strong> — the canonical hybrid fan-out: precomputed home timelines in Redis for most users, merge-on-read for accounts with huge follower counts.",
                "<strong>LinkedIn</strong> — moved from a monolith to hundreds of services on an async, event-driven backbone (Kafka, which they invented) to decouple teams and absorb spikes."
              ]
            },
            { t: "h", text: "Real-time, chat & video" },
            { t: "p", html: "Live video (Facebook, Hotstar, Zoom) and chat (Slack) push the real-time module's ideas to the limit. The recurring tricks: a <strong>persistent-connection tier</strong> (WebSockets) kept separate from stateless app servers, a <strong>pub/sub backplane</strong> to route messages between connection servers, and aggressive <strong>CDN + edge</strong> caching to absorb fan-out." },
            {
              t: "ul", items: [
                "<strong>Facebook Live</strong> — a hierarchy of caches: edge POPs absorb the 'thundering herd' so the origin encodes once and the CDN tree fans out to a billion viewers.",
                "<strong>Disney+ Hotstar</strong> — 25M+ concurrent viewers by pre-scaling for <em>predictable</em> spikes (cricket finals) and a 'panic mode' that sheds non-essential features to protect the core stream.",
                "<strong>Zoom</strong> — distributed media routers near users keep latency low; only the streams you actually view are sent at full quality.",
                "<strong>Slack</strong> — a WebSocket per client plus per-channel pub/sub fan-out; an edge cache ('Flannel') serves channel metadata close to users."
              ]
            },
            { t: "h", text: "Scaling to millions (and surviving flash sales)" },
            { t: "p", html: "The AWS/GCP scaling playbooks and the flash-sale stories (Shopify, Razorpay, SeatGeek) reuse this whole track's toolkit: a load balancer in front of stateless app servers, read replicas and caches for read-heavy load, queues to absorb write spikes, and a <strong>virtual waiting room</strong> that throttles demand at the door instead of letting it melt the checkout path." },
            {
              t: "ul", items: [
                "<strong>Scale on AWS / GCP</strong> — the same ladder every time: one box → load balancer + many stateless servers → CDN + cache → read replicas → shard the DB → break out services.",
                "<strong>YouTube with ~9 engineers</strong> — lean teams win by leaning on managed infrastructure, caching everything cacheable, and keeping the architecture simple.",
                "<strong>Shopify / Razorpay flash sales</strong> — queue the writes, cache the catalog, rate-limit per user; protect the database as the scarce resource.",
                "<strong>SeatGeek waiting room</strong> — admit users to the purchase flow in controlled batches so concurrency never exceeds what the backend can serve."
              ]
            },
            { t: "h", text: "Storage, data & geo at extreme scale" },
            { t: "p", html: "S3, Lambda, Apple Pay, PayPal, Uber and Google Search show the data tier under enormous load. The threads: <strong>durability through replication</strong> (S3's eleven nines = many copies across failure domains), <strong>idempotency for money</strong> (payments must survive retries without double-charging), and <strong>geospatial indexing</strong> (Uber's grid to find nearby drivers without scanning the planet)." },
            {
              t: "ul", items: [
                "<strong>Amazon S3</strong> — objects replicated across many devices and availability zones; constant background repair maintains 99.999999999% durability.",
                "<strong>Apple Pay / PayPal</strong> — idempotency keys plus a double-entry ledger make every transaction exactly-once even over flaky networks; PayPal ran a billion/day on a handful of JVMs using the actor model.",
                "<strong>Uber ETA / nearby drivers</strong> — partition the map into a spatial grid (H3), keep driver locations in memory, and answer 'who's near me' from a few relevant cells only.",
                "<strong>Google Search</strong> — a massive inverted index sharded across thousands of machines; a query scatters to shards and gathers ranked results."
              ]
            },
            {
              t: "table",
              headers: ["System", "The one big lesson"],
              rows: [
                ["Netflix", "Microservices + CDN edge; design for failure (chaos engineering)"],
                ["Instagram", "A boring, horizontally-sharded stack beats clever — and cache hard"],
                ["Twitter / X", "Hybrid fan-out: precompute feeds, pull for celebrities"],
                ["Facebook Live", "A CDN cache hierarchy absorbs the thundering herd"],
                ["Hotstar", "Plan capacity for known spikes; degrade gracefully"],
                ["Uber", "A spatial grid index gives fast nearby-driver lookups"],
                ["Amazon S3", "Durability = replication across independent failure domains"],
                ["Stripe / PayPal", "Idempotency keys make money operations retry-safe"]
              ]
            },
            { t: "note", variant: "tip", html: "Read real architectures actively. For each, ask: <em>what was the bottleneck, what did they trade away, and would I have reached for the same tool?</em> That's exactly the muscle a system-design interview tests — and you'll notice the same dozen patterns from this track recurring everywhere." },
            { t: "note", variant: "key", html: "<strong>The same handful of primitives keeps reappearing because the constraints do.</strong> Read-heavy pushes every one of these companies toward caching and precomputation, spiky pushes them toward queues and admission control, and money pushes them toward idempotency and a ledger. What differs between them is which constraint dominated, not which exotic technology they found." }
          ]
        },
        {
          id: "interview-designs",
          title: "Classic interview designs",
          summary: "Worked skeletons for the 'design X' prompts that come up again and again — assembled from this track's building blocks.",
          minutes: 9,
          tags: ["case-study", "interview"],
          blocks: [
            { t: "p", html: "These are the canonical \u201cdesign X\u201d prompts. The reassuring secret: almost all of them reduce to <em>combinations of the building blocks</em> in this track. Work each with the seven-step framework from Foundations before peeking at the skeleton." },
            { t: "h", text: "The canonical 'design X' prompts" },
            {
              t: "table",
              headers: ["Prompt", "Core approach (skeleton)"],
              rows: [
                ["URL shortener (Bitly)", "Counter/hash → base62 key; KV store key→URL; cache hot links; 301 redirect (full lesson earlier in this module)"],
                ["Twitter / X timeline", "Hybrid fan-out; precomputed feeds in Redis; pull-on-read for celebrities"],
                ["WhatsApp / chat", "WebSocket connection tier + presence service + pub/sub backplane; store-and-forward for offline users"],
                ["YouTube", "Upload → transcode pipeline (queue + workers) → store renditions → serve via CDN; metadata in a sharded DB"],
                ["Spotify", "CDN for audio; precomputed playlists & recommendations; clients stream via HTTP range requests"],
                ["Airbnb / booking", "Geo + availability search; booking needs strong consistency (locks/transactions) to avoid double-booking"],
                ["Web crawler", "Frontier queue + URL dedup (bloom filter) + per-host politeness; parse → inverted index"],
                ["Payment system (Stripe)", "Idempotency keys; double-entry ledger; async settlement; exactly-once via dedup"],
                ["Amazon S3", "Partitioned object store; replicate for durability; metadata index; read-after-write consistency"]
              ]
            },
            { t: "h", text: "Smaller building blocks they love" },
            { t: "p", html: "Interviewers also use bite-sized components that test one idea cleanly:" },
            {
              t: "ul", items: [
                "<strong>Real-time leaderboard</strong> — a Redis <em>sorted set</em> (ZADD/ZRANK) gives O(log n) ranking and top-K in one call.",
                "<strong>Distributed counter</strong> — shard the counter across many keys to avoid a hot row; sum on read, or use approximate counters at extreme scale.",
                "<strong>Live comments / presence</strong> — WebSockets + pub/sub; presence expires via heartbeats so stale 'online' states clear themselves.",
                "<strong>Pastebin</strong> — like the URL shortener: generate a key, store the blob in an object store, optional TTL, serve via CDN.",
                "<strong>Rate limiter</strong> — a token bucket in Redis at the gateway (covered in the APIs module)."
              ]
            },
            { t: "h", text: "Interview & behavioral craft" },
            {
              t: "ul", items: [
                "<strong>Drive the conversation</strong> with the seven-step framework: clarify → estimate → API → data model → high-level diagram → deep-dive → bottlenecks.",
                "<strong>State assumptions and trade-offs out loud.</strong> 'I'll pick AP here because a stale like-count is fine' is exactly what the interviewer grades.",
                "<strong>Mobile system design</strong> adds offline-first sync, battery/network constraints, and local caching to the usual checklist.",
                "<strong>Behavioral rounds</strong> reward concrete STAR stories (Situation, Task, Action, Result) — prepare 4\u20135 that show ownership, conflict resolution, and measurable impact."
              ]
            },
            { t: "note", variant: "tip", html: "For timed drills with compact outlines, use the new <a class='inline' href='#/interview'>Interview prompts</a> page. Treat each outline as a calibration aid, not a script to memorize." },
            { t: "note", variant: "key", html: "<strong>'Design X' is a composition exercise, and the bar is how you sequence it.</strong> Every prompt here reduces to the same primitives — load balancer, cache, sharded store, queue, CDN, idempotency key, a CAP choice. What gets graded is whether you scoped before drawing, said the trade-off out loud, and spent your depth on the one part that was genuinely hard." }
          ]
        },
        {
          id: "production-capstone",
          title: "Capstone: design a production marketplace",
          summary: "A full HLD drill: requirements, APIs, data model, consistency, scaling, failure modes, observability and LLD handoff.",
          minutes: 14,
          tags: ["case-study", "capstone", "production"],
          blocks: [
            { t: "p", html: "Brief: design a ticket marketplace for high-demand events. Users search events, join a waiting room during drops, reserve seats, pay, receive tickets and get notifications. The system must survive flash traffic and never double-sell a seat." },
            { t: "h", text: "1 · Clarify the contract" },
            { t: "ul", items: [
              "Functional: search events, view seats, reserve for a short hold, pay, issue ticket, transfer/refund later.",
              "Non-functional: no double booking, checkout p99 under the SLO, graceful degradation during drops, auditable payment flow.",
              "Scale: read-heavy browsing, bursty writes at sale start, strict correctness around inventory and money."
            ] },
            { t: "h", text: "2 · Core architecture" },
            { t: "code", lang: "text", code:
              "Client -> CDN/WAF -> API Gateway -> Search/Browse service -> cache/search index\n" +
              "                         -> Waiting-room service -> token bucket / queue\n" +
              "                         -> Inventory service -> strongly consistent seat store\n" +
              "                         -> Order service -> saga orchestrator\n" +
              "                         -> Payment service -> provider + ledger\n" +
              "                         -> Notification service -> queue + workers" },
            { t: "h", text: "3 · Deep dives interviewers expect" },
            { t: "table", headers: ["Concern", "Design answer"], rows: [
              ["Double-sell prevention", "Seat reservation uses conditional write or transaction on seat id with hold expiry."],
              ["Flash crowd", "Waiting room admits users in controlled batches; browse path remains cached and degraded if needed."],
              ["Payment retries", "Idempotency key per checkout and double-entry ledger for money movement."],
              ["Cross-service workflow", "Saga: reserve seat -> authorize payment -> confirm order; compensate by releasing hold or refunding."],
              ["Search freshness", "Event/search index is eventually consistent; checkout always verifies against inventory source of truth."],
              ["Observability", "Trace checkout end to end; alert on SLO burn, payment failures, reservation conflicts and queue depth."]
            ] },
            { t: "h", text: "4 · LLD handoff" },
            { t: "ul", items: [
              "Model <strong>Seat</strong>, <strong>Hold</strong>, <strong>Order</strong>, <strong>PaymentAttempt</strong> and <strong>Ticket</strong> with explicit state machines.",
              "Make commands idempotent: <code class='tok'>ReserveSeat(commandId)</code>, <code class='tok'>ConfirmPayment(idempotencyKey)</code>.",
              "Use interfaces for payment provider, notification sender and clock so tests can simulate retries, expiry and provider failures.",
              "Write invariants first: one confirmed ticket per seat per event; expired holds cannot confirm; refunds append ledger entries, never edit history."
            ] },
            { t: "h", text: "Rubric: production marketplace" },
            { t: "ul", items: [
              "<strong>Correctness:</strong> no double-sell path, reservation expiry is enforced, and payment/order/ticket states are auditable.",
              "<strong>Scale:</strong> browse traffic is cacheable, drop traffic is admitted through a waiting room, and writes protect the inventory source of truth.",
              "<strong>Reliability:</strong> retries are idempotent, the saga has compensations, and queues have DLQ/replay plans.",
              "<strong>Operations:</strong> launch has capacity math, canary signals, dashboards, runbooks and rollback steps.",
              "<strong>LLD handoff:</strong> entities, commands, state machines and invariants are clear enough for implementation."
            ] },
            { t: "note", variant: "tip", html: "Use this capstone as a template: every serious design needs a source of truth, hot-path scaling plan, failure-mode story, observability plan and clear LLD invariants." },
            { t: "note", variant: "tip", html: "After you work it once, compare against the compact <a class='inline' href='#/scenarios/ticket-marketplace-flash-sale'>ticket marketplace scenario outline</a> and grade yourself with the <a class='inline' href='#/rubrics'>rubric bands</a>." },
            { t: "note", variant: "key", html: "<strong>The marketplace splits into a path that may be stale and a path that must be exact.</strong> Browsing is cacheable, eventually consistent and safe to degrade under load; reserving a seat and taking money needs a conditional write, an idempotency key and an auditable ledger. Naming that boundary in the first two minutes is what makes every later decision — waiting room, saga, search index — fall out on its own." }
          ]
        },
        {
          id: "saas-reliability-review",
          title: "Capstone: multi-tenant SaaS reliability review",
          summary: "Start with a shared monolith, then evolve toward cells while managing routing, migration, deployment waves and cross-tenant analytics.",
          minutes: 10,
          tags: ["case-study", "capstone", "multi-tenant", "reliability"],
          blocks: [
            { t: "p", html: "Brief: a B2B SaaS product started as a shared monolith with one app fleet and one database. A few large tenants now create noisy-neighbor incidents, deploys affect everyone, and enterprise customers want stronger isolation. Review the reliability plan." },
            { t: "h", text: "1 · Current state" },
            { t: "ul", items: [
              "One shared app tier, one shared primary database, one shared queue fleet.",
              "Tenant id exists in most tables but is not always the leading index key.",
              "Deploys are global: a bad release affects every tenant at once.",
              "Analytics queries run against the same operational data model."
            ] },
            { t: "h", text: "2 · Evolve toward cells" },
            { t: "code", lang: "text", code:
              "Phase 0: shared monolith\n" +
              "Phase 1: tenant_id as first-class partition key + per-tenant limits\n" +
              "Phase 2: split queues/caches/workers by tenant cohort\n" +
              "Phase 3: route selected tenants to isolated cells\n" +
              "Phase 4: many cells + controlled migrations + cell-aware deploys"
            },
            { t: "table", headers: ["Concern", "Review question"], rows: [
              ["Partition key", "Is tenant_id/account_id present in every hot table, event and cache key that must be isolated?"],
              ["Migration", "Can a tenant be copied, dual-written, verified, cut over, and rolled back without downtime?"],
              ["Routing", "Does the edge router resolve tenant -> cell before touching cell-local services?"],
              ["Deployment waves", "Can we deploy to one empty/canary cell, then a small cell, then larger cells, watching SLOs each wave?"],
              ["Noisy neighbor", "Are CPU, queue depth, DB pools, rate limits and background jobs budgeted per tenant or per cell?"],
              ["Analytics", "How do we query across cells without hammering production stores or breaking tenant isolation?"]
            ] },
            { t: "h", text: "3 · Migration shape" },
            { t: "ol", items: [
              "<strong>Make tenant boundaries explicit</strong>: schema indexes, cache keys, queue partitioning and logs all carry tenant id.",
              "<strong>Build the routing control plane</strong>: source of truth for tenant -> cell with audit trail and fast edge cache.",
              "<strong>Move low-risk tenants first</strong>: small tenants, internal tenants, then one enterprise tenant with a rollback plan.",
              "<strong>Deploy in waves</strong>: empty cell -> beta cell -> 1% tenants -> more cells; abort on error-budget burn.",
              "<strong>Export analytics events</strong>: stream cell-local events into a warehouse/lake so cross-cell reporting is off the hot path."
            ] },
            { t: "h", text: "Rubric: SaaS reliability review" },
            { t: "ul", items: [
              "<strong>Isolation:</strong> tenant boundaries exist in data, cache, queues, search, logs, metrics and admin tools.",
              "<strong>Blast radius:</strong> cells or cohorts limit noisy tenants, bad deploys and dependency failures to a known slice.",
              "<strong>Migration safety:</strong> tenant moves use copy, replay, verification, cutover, rollback and audit trails.",
              "<strong>Rollout control:</strong> deploy waves start with low-risk cohorts and stop on SLO/error-budget burn.",
              "<strong>Analytics plan:</strong> cross-cell reporting uses an exported data plane, not synchronous production-cell queries."
            ] },
            { t: "note", variant: "tip", html: "The cell target is not 'microservices everywhere'. It is <strong>bounded blast radius</strong>: a bad deploy, hot tenant or sick dependency should affect a known slice of tenants, with routing and migration tools mature enough to operate calmly." },
            { t: "note", variant: "trap", html: "Analytics gets harder after cells. Cross-cell joins, global dashboards and support tools need a separate data plane; do not solve that by letting analysts query every production cell directly." },
            { t: "note", variant: "tip", html: "Use the <a class='inline' href='#/scenarios/multi-tenant-saas-isolation'>multi-tenant SaaS isolation outline</a> as a self-review checklist for tenant boundaries, blast radius, migration safety and analytics." },
            { t: "note", variant: "key", html: "<strong>Isolation is earned tenant by tenant, in whatever order keeps rollback possible.</strong> Making the tenant boundary explicit in data, cache, queues and logs comes first and is worth doing even if cells never arrive; cells and deploy waves only pay for themselves once routing, migration and cross-cell analytics are boring enough to run on an ordinary Tuesday." }
          ]
        }
      ]
    },

    /* ============================ AI & ML SYSTEMS ============================ */
    {
      id: "ai-ml",
      name: "AI & ML Systems",
      icon: "bolt",
      lessons: [
        {
          id: "search-ranking-recommendations",
          title: "Search, ranking & recommendations",
          summary: "The design-interview version: a two-stage funnel of cheap candidate retrieval and expensive ranking, with filters first and a feedback loop last.",
          minutes: 7,
          tags: ["search", "ranking", "recommendations", "ai", "interview"],
          blocks: [
            { t: "p", html: "\u201cDesign search for a marketplace\u201d and \u201cdesign a recommendations feed\u201d are the same shape in an interview: a <strong>funnel</strong>. Retrieve a broad candidate set cheaply, remove what the user may not or cannot see, rank the survivors with richer signals, then log what was shown and clicked so the next model is better." },
            { t: "code", lang: "text", code:
              "corpus ~100M items\n" +
              "  -> candidate retrieval  ~1,000   inverted index / vector ANN / co-engagement / popular   (< 50 ms)\n" +
              "  -> filters              ~800     tenant, ACL, availability, language, already-seen\n" +
              "  -> ranking              ~100     richer model: text match, embedding score, freshness,\n" +
              "                                   user affinity, quality                                  (< 100 ms)\n" +
              "  -> re-rank              top 20   diversity, dedupe, business rules\n" +
              "  -> log impressions + clicks  ->  training data for the next ranker"
            },
            { t: "table", headers: ["Interview step", "What to say"], rows: [
              ["Objective", "Name the metric the product cares about (clicks, purchases, watch time, successful searches) and a guardrail metric it must not hurt."],
              ["Candidates", "Several cheap sources merged: lexical for exact terms, vectors for meaning, co-engagement for \u201cpeople also\u2026\u201d, popularity for cold start."],
              ["Filters", "Permission and availability filters before ranking, so the ranker never scores what the user may not see."],
              ["Ranking", "A heavier model over a few hundred items; features come from a store shared with training so serving matches training."],
              ["Serving", "Precompute candidates for feeds, compute online for search; hold the whole funnel inside a latency budget."],
              ["Feedback", "Impressions and clicks become labels; correct for position bias; test changes with an online experiment, not offline metrics alone."]
            ] },
            { t: "note", variant: "trap", html: "Do not let personalization bypass access control. Tenant and permission filters run before candidates reach the ranking model or the feed, and the same rule holds when the \u201cranker\u201d is a language model reading retrieved text." },
            { t: "note", variant: "tip", html: "<strong>Go deeper.</strong> Retrieval engines are in the <a href='#/deepdives/stores/elasticsearch'>Elasticsearch</a> and <a href='#/deepdives/specialized/vector-db'>vector database</a> deep dives, and <a href='#/breakdowns/hard/post-search'>Design full-text search</a> works one system end to end. For the ML side \u2014 objectives, features, offline evaluation, A/B tests and serving rankers in a latency budget \u2014 continue in the Synapse atlas (ML system design) in this collection." },
            { t: "note", variant: "key", html: "<strong>Retrieval decides what is possible; ranking decides what the product means.</strong> Cheap recall gathers a wide candidate set, and the order you return encodes freshness, authority, diversity and business rules \u2014 a product decision wearing a similarity score." }
          ]
        },
        {
          id: "genai-design",
          title: "Designing GenAI & ML systems",
          summary: "A design-interview bridge: frame an LLM or ML prompt as ordinary system design with a probabilistic, metered dependency \u2014 then know where to go for depth.",
          minutes: 8,
          tags: ["ai", "ml", "system-design", "interview"],
          blocks: [
            { t: "p", html: "\u201cDesign a support assistant over our docs\u201d or \u201cdesign a conversational assistant\u201d is system design with two unusual dependencies: one <strong>probabilistic</strong> (the model can be confidently wrong) and one <strong>metered</strong> (every token costs money and time). Gateways, caches, queues, rate limits and idempotency from this track carry over unchanged. What you add is a small set of AI-specific boxes and an evaluation loop." },
            { t: "h", text: "A framework for the interview" },
            { t: "ol", items: [
              "<strong>Clarify the risk of a wrong answer.</strong> A wrong movie suggestion and a wrong refund policy need different safeguards. Ask who the users are, what data they may see, and the latency and cost targets.",
              "<strong>Draw the boxes.</strong> Client, API, a <em>model gateway</em> in front of every model call, retrieval if answers must come from private or fresh data, and an async queue for batch work.",
              "<strong>Walk the data path.</strong> For retrieval-augmented generation (RAG), separate <em>ingestion</em> (parse, chunk, embed, index ahead of time) from the <em>online path</em> (retrieve nearest chunks from a vector index, filter by permission, rerank, build the prompt).",
              "<strong>Add tools only if needed.</strong> An agent is a loop in which the model calls a tool, observes the result and repeats. Give it a step budget and make every tool safe to call twice.",
              "<strong>Size it in tokens.</strong> Concurrent generations = requests per second \u00d7 seconds per answer; that, not raw QPS, sizes the serving fleet.",
              "<strong>Prove it works.</strong> A golden evaluation set run on every prompt or model change, traces on every answer, and guardrails on input and output.",
              "<strong>Plan the failures.</strong> Provider rate limits, a slow model, an empty retrieval, injected instructions in a document \u2014 each needs a named fallback."
            ] },
            { t: "table", headers: ["AI-specific box", "Classic analogue", "Where it appears in this atlas"], rows: [
              ["Model gateway (routing, quotas, fallback)", "API gateway", "<a href='#/hld/api/api-gateway'>API gateways & BFF</a>"],
              ["Vector index for retrieval", "Search index", "<a href='#/deepdives/specialized/vector-db'>Vector databases</a>"],
              ["Prompt and model registry", "Config and feature flags", "<a href='#/hld/production-readiness/containers-delivery'>Containers & deployment topology</a>"],
              ["Guardrails and permission filters", "Validation and authorization", "<a href='#/hld/protocols-security/security-threat-modeling'>Security threat modeling</a>"],
              ["Agent loop with tools", "Workflow orchestrator", "<a href='#/sdpatterns/coordination/multi-step-processes'>Multi-step processes</a>"],
              ["Degrade to a smaller model or cached answer", "Graceful degradation", "<a href='#/hld/reliability/load-shedding-degradation'>Load shedding & degradation</a>"]
            ] },
            { t: "p", html: "Classic <strong>ML systems</strong> follow a pipeline: collect and label data \u2192 build features \u2192 train \u2192 evaluate offline \u2192 serve in batch or in real time \u2192 monitor for drift \u2192 retrain. The hard parts are rarely the model; they are the data, the feature pipeline, and keeping training and serving consistent so the model sees the same features in production that it learned from." },
            { t: "note", variant: "tip", html: "For a full worked example at interview depth, see <a href='#/breakdowns/hard/chatgpt'>Design a conversational assistant</a> in the Problem Breakdowns track." },
            { t: "note", variant: "tip", html: "<strong>Where to go deeper.</strong> This atlas covers the design-interview framing only. The Lumen atlas (LLMs & GenAI) in this collection teaches how the pieces work \u2014 tokens and inference, RAG and retrieval quality, agents and tools, evals and LLM security \u2014 and its <em>Production LLM Systems</em> module covers serving architecture, capacity and latency budgets, cost, and how production RAG fails. The Synapse atlas (ML system design) covers ML objectives, features, evaluation, A/B testing and model serving." },
            { t: "quiz", id: "hld-ai" },
            { t: "note", variant: "key", html: "<strong>A GenAI system is an ordinary system with two unusual dependencies: one probabilistic, one metered.</strong> Gateways, caches, queues and idempotency carry over unchanged; what you add is a model gateway, a prompt and model registry, a guardrail layer and an evaluation loop \u2014 because without the last one there is no way to tell an improvement from a regression." }
          ]
        }
      ]
    },

    /* ============================ PROTOCOLS & SECURITY ============================ */
    {
      id: "protocols-security",
      name: "Protocols & Security",
      icon: "shield",
      lessons: [
        {
          id: "dns-request-path",
          title: "DNS & the request path",
          summary: "What actually happens between pressing Enter and seeing a page — DNS, TCP, TLS, and the first byte.",
          minutes: 7,
          tags: ["networking", "dns", "fundamentals"],
          blocks: [
            { t: "p", html: "\u201cWhat happens when you type a URL and press Enter?\u201d is the most common warm-up question in interviews because it touches every layer at once. The short version: resolve a name to an address, open a connection, secure it, then exchange HTTP." },
            { t: "code", lang: "text", code:
              "1. DNS      example.com ─► IP address (recursive resolver, caches at every hop)\n" +
              "2. TCP      3-way handshake to that IP : port 443\n" +
              "3. TLS      handshake: certificate check + key exchange ─► encrypted channel\n" +
              "4. HTTP     GET / ─► server (often a reverse proxy/CDN) ─► response\n" +
              "5. Render   browser parses HTML, fetches assets (often from a CDN edge)"
            },
            { t: "p", html: "<strong>DNS</strong> is a globally distributed, heavily-cached hierarchy (root → TLD → authoritative). The result is cached at your OS, your resolver, and along the way with a TTL, which is why the <em>first</em> lookup is slow and the rest are instant — and why DNS changes take time to propagate." },
            { t: "note", variant: "key", html: "DNS is also a load-balancing and failover tool: round-robin records spread traffic, GeoDNS returns a nearby region, and short TTLs let you reroute around a dead data center. It's the layer <em>above</em> your load balancers." },
          ]
        },
        {
          id: "https-auth",
          title: "HTTPS, TLS & authentication",
          summary: "How the web is encrypted and how you prove who a user is — TLS, JWTs, sessions, and password storage.",
          minutes: 8,
          tags: ["security", "auth", "https"],
          blocks: [
            { t: "p", html: "<strong>HTTPS</strong> is HTTP over <strong>TLS</strong>. The TLS handshake uses asymmetric crypto and a certificate (signed by a trusted CA) to verify the server's identity and agree on a fast symmetric key, which then encrypts the session. The payoff: confidentiality, integrity, and authenticity over a hostile network." },
            { t: "h", text: "Proving identity: sessions vs tokens" },
            {
              t: "compare",
              bad: { title: "Server sessions", items: ["Server stores session state; client holds an opaque id", "Easy to revoke instantly", "✗ Needs a shared session store to scale horizontally"] },
              good: { title: "JWT (stateless tokens)", items: ["Signed token carries the claims; server stores nothing", "Scales effortlessly — any node can verify", "✗ Hard to revoke before expiry; keep them short-lived + refresh"] }
            },
            { t: "note", variant: "warn", html: "<strong>Never store passwords in plaintext or with fast hashes.</strong> Use a slow, salted password hash (bcrypt, scrypt, Argon2) so a database leak doesn't hand attackers everyone's credentials. The salt defeats rainbow tables; the slowness defeats brute force." },
            { t: "note", variant: "key", html: "<strong>TLS proves which server you reached; it says nothing about who the user is.</strong> Sessions and tokens trade revocation against statelessness — server-side sessions let you log someone out this second, signed tokens let any node verify without a lookup — and short lifetimes with refresh are how you buy back some of what tokens give away. Slow salted password hashing is the control that still protects users after the database leaks." }
          ]
        },
        {
          id: "security-threat-modeling",
          title: "Security threat modeling for HLD",
          summary: "Design auth, tenant isolation, abuse controls, secrets and RAG safety as first-class boxes in the architecture.",
          minutes: 10,
          tags: ["security", "threat-modeling", "multi-tenant", "rag"],
          blocks: [
            { t: "p", html: "Threat modeling asks: what are we protecting, who can attack it, where are the trust boundaries, and what controls make abuse hard? In HLD, draw security as boxes and flows, not as a footnote." },
            { t: "table", headers: ["Threat area", "HLD controls to name"], rows: [
              ["Authentication", "MFA for sensitive users, secure password hashing, session rotation, device/risk signals"],
              ["Authorization", "Resource-scoped checks on every request; tenant + resource id enforced in queries"],
              ["Tenant isolation", "DB row/schema boundaries, cache key prefixes, queue partitions, vector metadata filters, log redaction"],
              ["API abuse", "Rate limits, quotas, bot/fraud rules, idempotency, anomaly alerts and abuse playbooks"],
              ["Secrets and TLS", "Secrets manager, rotation, short-lived credentials, TLS everywhere, certificate lifecycle"],
              ["Sessions and JWTs", "HttpOnly/Secure/SameSite cookies, short JWT TTLs, refresh-token rotation and revocation"],
              ["RAG-specific risks", "Prompt injection, poisoned documents, cross-tenant retrieval, unsafe tool calls and citation spoofing"]
            ] },
            { t: "h", text: "Resource-scoped authorization" },
            { t: "p", html: "The authorization check must bind <strong>user, tenant, action and resource</strong>. Avoid designs where the app fetches by raw id and checks later; prefer scoped reads like <code class='tok'>tenant_id + resource_id</code> at the data layer, plus policy checks at service boundaries." },
            { t: "ul", items: [
              "<strong>DB</strong>: include tenant/resource predicates in every query and constrain admin tools the same way.",
              "<strong>Cache</strong>: prefix keys by tenant and never cache an authorization-dependent response under a global key.",
              "<strong>Queues</strong>: carry tenant id, trace id and authorization context; consumers re-check before side effects.",
              "<strong>Vector/search</strong>: apply tenant and ACL filters before ranking or prompt construction.",
              "<strong>Logs</strong>: keep correlation ids, redact secrets/PII, and avoid raw prompts or tokens unless explicitly approved."
            ] },
            { t: "note", variant: "warn", html: "For RAG, the most dangerous bug is retrieval crossing a permission boundary. Treat documents as protected resources: index ACL metadata, filter before top-k reaches the model, and test with swapped-tenant prompts." },
            { t: "note", variant: "trap", html: "A signed JWT proves claims were issued; it does not prove the user may access a specific invoice, document or tenant. Authorization is a fresh resource decision, not a token-parsing exercise." },
            { t: "note", variant: "key", html: "<strong>Authorization is a decision about a resource, taken again at every layer that can return data.</strong> Threat modelling in HLD means drawing the trust boundaries and then checking that the database predicate, the cache key, the queue message and the retrieval filter all carry the same tenant and permission scope. Whichever one of them forgets is your actual security posture." },
            { t: "quiz", id: "hld-protocols" }
          ]
        }
      ]
    },
  ]
};
