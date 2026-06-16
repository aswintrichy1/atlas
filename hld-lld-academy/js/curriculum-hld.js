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
            { t: "note", variant: "key", html: "<strong>The core skill of HLD is trade-off reasoning.</strong> There is rarely one right answer — only choices that buy you one property (say, low latency) at the cost of another (say, strong consistency). Naming the trade-off out loud is what separates a senior answer from a junior one." },
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
            { t: "p", html: "Every lesson in this track is really about one of these properties and the price you pay to improve it. Keep this list in your head — it is the lens through which all the patterns make sense." }
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
            { t: "note", variant: "key", html: "Now you know this is an <strong>object-storage problem</strong> (S3-class), not a 'fits in Postgres' problem — and you reached that conclusion in 90 seconds of arithmetic. <em>That</em> is the value of estimation." },
            { t: "h", text: "Units worth memorizing" },
            {
              t: "ul", items: [
                "1 byte = 8 bits · 1 KB ≈ 10³ · 1 MB ≈ 10⁶ · 1 GB ≈ 10⁹ · 1 TB ≈ 10¹² · 1 PB ≈ 10¹⁵",
                "A typical char ≈ 1 byte (ASCII) or up to 4 bytes (UTF-8)",
                "A UUID ≈ 16 bytes · a timestamp ≈ 8 bytes · a typical row ≈ hundreds of bytes",
                "1 server ≈ tens of thousands of simple QPS; a DB ≈ thousands of writes/sec before tuning"
              ]
            }
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
            { t: "note", variant: "key", html: "Modern internet-scale systems are <strong>horizontally scaled</strong>, but they often scale individual nodes vertically too. Start vertical (it's free engineering-wise); go horizontal when you hit the ceiling or need redundancy." },
            { t: "h", text: "Why horizontal needs statelessness" },
            { t: "p", html: "If request #1 from a user lands on server A and request #2 lands on server B, server B must be able to serve it. That only works if servers hold <em>no</em> per-user state locally — the subject of the next lesson." }
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
            { t: "p", html: "Rule of thumb: keep app servers <strong>disposable</strong>. If killing a random server would log anyone out or lose data, you still have hidden state to evict." }
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
            { t: "note", variant: "key", html: "<strong>Cache hit ratio</strong> is the metric that matters: hits ÷ total lookups. A 95% hit ratio means the DB sees only 5% of read traffic. Small improvements here translate to large capacity gains." },
            { t: "h", text: "Write strategies" },
            { t: "p", html: "The hard part of caching isn't reading — it's keeping the cache consistent with the source of truth when data <em>changes</em>. Explore the three write strategies below." },
            { t: "widget", id: "cachewrite" },
            { t: "p", html: "Pair a write strategy with a <em>read</em> strategy (next lesson). The classic combo is <strong>cache-aside reads + write-through (or invalidate-on-write)</strong>." }
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
            { t: "note", variant: "trap", html: "Also watch for <strong>cache penetration</strong> (queries for keys that don't exist bypass the cache every time — cache the 'not found' too, or use a bloom filter) and <strong>hot keys</strong> (one key so popular it overloads a single cache node — replicate or shard it)." }
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
            { t: "note", variant: "key", html: "<strong>LRU</strong> is the default workhorse — it assumes recently used ⇒ soon used (temporal locality). Production caches like Redis offer LRU, LFU, and approximations that sample a few keys instead of maintaining perfect order (cheaper, nearly as good)." },
            { t: "p", html: "Implementation note: a classic exact-LRU is a <em>hash map + doubly-linked list</em> giving O(1) get and put — a favorite LLD interview question that bridges both tracks." }
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
            { t: "note", variant: "key", html: "<strong>ACID vs BASE.</strong> ACID (Atomic, Consistent, Isolated, Durable) = correctness guarantees, classic SQL. BASE (Basically Available, Soft-state, Eventually consistent) = availability & scale, classic NoSQL. Pick the guarantee your domain truly needs — money wants ACID; a 'like' counter is happy with BASE." },
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
            { t: "note", variant: "trap", html: "Don't pick NoSQL 'for scale' on a system that will never need it. You'll trade away JOINs and transactions for a horizontal scalability you don't use. Match the tool to the access pattern." }
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
            { t: "note", variant: "key", html: "<strong>Indexes trade write speed & storage for read speed.</strong> Every insert/update must also update each index. Index the columns you filter/join/sort on — not every column." },
            {
              t: "ul", items: [
                "<strong>Primary index</strong> — on the primary key; often the physical row order (clustered).",
                "<strong>Secondary index</strong> — on other columns you query by.",
                "<strong>Composite index</strong> — multiple columns; only helps queries using a <em>leftmost prefix</em>.",
                "<strong>Covering index</strong> — includes all columns a query needs, so the DB never touches the table.",
                "<strong>Hash index</strong> — O(1) equality lookups, but no range queries."
              ]
            },
            { t: "note", variant: "tip", html: "Read the query planner (<code class='tok'>EXPLAIN ANALYZE</code>). 'Seq Scan' on a big table in a hot query is a red flag; 'Index Scan' is what you want. Profile before adding indexes — guessing wastes write performance." }
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
            { t: "note", variant: "tip", html: "Don't shard until you must. Squeeze vertical scaling, read replicas, and caching first — sharding is a one-way door that complicates everything downstream." }
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
            { t: "note", variant: "key", html: "Higher isolation = fewer anomalies but more locking/aborts and lower throughput. <strong>Read Committed</strong> is the common default (Postgres, Oracle, SQL Server). <strong>Serializable</strong> is the gold standard — the result is <em>as if</em> transactions ran one at a time — but it's the slowest. (*MySQL's InnoDB blocks phantoms at Repeatable Read via next-key locks.)" },
            { t: "h", text: "How databases actually do it: MVCC" },
            { t: "p", html: "Rather than locking readers behind writers, most modern databases use <strong>Multi-Version Concurrency Control (MVCC)</strong>: every write creates a new <em>version</em> of a row stamped with a transaction id, and each transaction reads a consistent <em>snapshot</em> as of when it began. Readers never block writers and writers never block readers — only write-write conflicts need resolving." },
            { t: "note", variant: "trap", html: "Don't default to Serializable 'to be safe' — it can tank throughput and cause serialization failures your app must retry. Pick the weakest level that's correct for the operation: a money transfer wants Serializable (or careful row locks); a dashboard read is fine at Read Committed." },
            { t: "note", variant: "tip", html: "In a system-design interview, naming the isolation level you'd use — and <em>why</em> — signals real database depth. Tie it back to the CAP/PACELC trade-off: stronger isolation usually means more coordination and higher latency." }
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
            { t: "note", variant: "key", html: "In any real distributed system, network partitions <em>will</em> happen — so <strong>P is non-negotiable</strong>. The real choice is: during a partition, do you stay <strong>Consistent</strong> (CP, refuse/block) or <strong>Available</strong> (AP, answer with maybe-stale data)? 'CA' only exists on a single node." },
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
            { t: "note", variant: "trap", html: "Don't memorize labels — reason from the use case. A bank ledger wants CP (never show a wrong balance). A social feed wants AP (always load, even if a like count is briefly off). The 'right' answer is domain-specific." }
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
            { t: "note", variant: "key", html: "<strong>Eventual consistency is not 'no consistency'.</strong> It guarantees convergence — given no new writes, all replicas end up identical. The window of disagreement is usually milliseconds. For likes, view counts, and feeds, that's invisible to users and well worth the availability." },
            { t: "h", text: "Picking a model" },
            {
              t: "ul", items: [
                "Money, inventory, unique usernames, distributed locks → <strong>strong</strong>.",
                "Social feeds, analytics, recommendations, presence → <strong>eventual</strong> (+ read-your-writes for the author).",
                "Chat & comment threads → <strong>causal</strong> so replies never appear before what they reply to.",
                "Default mindset: use the <em>weakest</em> model your correctness allows — it's cheaper and more available."
              ]
            },
            { t: "quiz", id: "hld-cap" }
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
            { t: "note", variant: "key", html: "Kafka scales by splitting a topic into <strong>partitions</strong>; order is guaranteed <em>within</em> a partition, and the partition key (e.g. user_id) decides placement. More partitions = more parallelism, at the cost of cross-partition ordering." },
            { t: "note", variant: "tip", html: "Rule of thumb: need to <em>distribute tasks</em> to workers? Use a queue. Need to <em>broadcast events</em> to many systems and keep history? Use a log/stream." },
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
            { t: "note", variant: "key", html: "Heuristic: if the user is <em>waiting on the result to continue</em>, go sync (login, checkout validation). If it's <em>fire-and-forget</em> background work (send email, generate thumbnail, update analytics), go async." },
            { t: "p", html: "Most real systems blend both: a synchronous API at the edge that quickly enqueues asynchronous work behind it — fast response now, heavy lifting later." }
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
            { t: "note", variant: "key", html: "<strong>Over-fetching</strong> (REST returns more than you need) and <strong>under-fetching</strong> (you must call 3 endpoints to build one screen) are exactly what GraphQL fixes by letting the client request a precise shape. gRPC instead optimizes the <em>wire</em>: binary Protobuf over HTTP/2 with streaming — ideal between services in a mesh." },
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
            }
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
            { t: "note", variant: "trap", html: "Keep the gateway <em>thin</em>. It's for cross-cutting concerns, not business logic. A gateway stuffed with domain rules becomes a new monolith — and a new single point of failure, so run it redundantly." }
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
            { t: "note", variant: "key", html: "<strong>Pick by directionality.</strong> Server→client only (notifications, live feed, stock ticker)? → <strong>SSE</strong> (simpler, auto-reconnect, works over plain HTTP). Two-way, low-latency (chat, multiplayer, collaborative editing)? → <strong>WebSockets</strong>." },
            { t: "note", variant: "trap", html: "WebSockets are <em>stateful</em> — each connection pins a client to a server, which complicates load balancing and autoscaling. At scale you add a pub/sub backplane (e.g., Redis) so any server can deliver a message to any connected client, regardless of which node holds the socket." },
            { t: "p", html: "Don't forget humble <strong>long polling</strong> — it's a robust fallback that works through restrictive proxies and older clients where WebSockets fail." },
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
          summary: "What 99.99% actually buys you, and the patterns that protect uptime: redundancy, failover, and circuit breakers.",
          minutes: 7,
          tags: ["reliability", "availability"],
          blocks: [
            { t: "p", html: "<strong>Availability</strong> is the fraction of time a system is operational, usually quoted in 'nines'. Each extra nine is roughly 10× harder and costlier than the last." },
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
            { t: "note", variant: "key", html: "Availability multiplies across <em>dependencies in series</em>: if a request needs services each at 99.9%, three of them give 0.999³ ≈ 99.7%. Reduce the number of things on the critical path, and add redundancy so a component's failure isn't the request's failure." },
            { t: "h", text: "Patterns that protect uptime" },
            {
              t: "ul", items: [
                "<strong>Redundancy</strong> — no single point of failure; N+1 everything on the critical path.",
                "<strong>Failover</strong> — a healthy standby takes over automatically (active-passive or active-active).",
                "<strong>Health checks</strong> — detect sick nodes and pull them from rotation fast.",
                "<strong>Circuit breaker</strong> — stop calling a failing dependency for a cooldown so you fail fast instead of piling up.",
                "<strong>Bulkheads</strong> — isolate resources so one overloaded feature can't sink the whole ship.",
                "<strong>Graceful degradation</strong> — drop to a cached or simpler response instead of erroring.",
                "<strong>Retries with backoff + jitter</strong> — recover from blips without synchronized retry storms."
              ]
            },
            { t: "note", variant: "trap", html: "Naive retries are dangerous: when a service wobbles, every client retrying at once creates a <strong>retry storm</strong> that finishes it off. Always use <em>exponential backoff with jitter</em>, cap attempts, and pair retries with a circuit breaker." }
          ]
        },
        {
          id: "bloom-filters",
          title: "Bloom filters",
          summary: "A tiny probabilistic set that answers 'definitely not' or 'maybe' — and saves you from pointless lookups.",
          minutes: 6,
          tags: ["reliability", "algorithms", "data-structures"],
          blocks: [
            { t: "p", html: "A <strong>bloom filter</strong> is a space-efficient probabilistic structure that tests set membership. It can say <em>'definitely not in the set'</em> or <em>'possibly in the set'</em> — never a false negative, but occasionally a false positive. In exchange it uses a fraction of the memory a real set would." },
            { t: "p", html: "It's just a bit array of size <em>m</em> and <em>k</em> hash functions. To add an item, hash it k ways and set those k bits. To test, hash and check those k bits: if <em>any</em> is 0 it's definitely absent; if <em>all</em> are 1 it's probably present (those bits might have been set by other items)." },
            { t: "widget", id: "bloom" },
            { t: "h", text: "Where they earn their keep" },
            {
              t: "ul", items: [
                "<strong>Cache penetration guard</strong> — 'is this key worth a DB lookup?' Skip the trip for keys that definitely don't exist.",
                "<strong>Databases (Cassandra, HBase, Bigtable)</strong> — skip reading an SSTable that definitely lacks the key.",
                "<strong>Web/CDN</strong> — 'have we seen this URL / has this user seen this article?'",
                "<strong>Spell-checkers, malicious-URL lists</strong> — huge sets, tiny memory."
              ]
            },
            { t: "note", variant: "key", html: "The trade is tunable: more bits and more hashes ⇒ fewer false positives, more memory. You accept a small false-positive rate (a wasted lookup) to eliminate the <em>vast majority</em> of pointless work. No false negatives means it's safe as a pre-filter." }
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
            { t: "note", variant: "key", html: "<strong>The four golden signals</strong> (Google SRE) are the metrics to watch first: <strong>Latency</strong> (how long), <strong>Traffic</strong> (how much demand), <strong>Errors</strong> (failure rate), and <strong>Saturation</strong> (how full your resources are). Cover these and you catch most problems." },
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
            { t: "quiz", id: "hld-reliability" }
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
            { t: "note", variant: "key", html: "<strong>Conway's Law:</strong> systems mirror the communication structure of the org that builds them. Microservices pay off when you have <em>many teams</em> that need to ship independently. With one small team, a monolith is almost always faster and cheaper." },
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
            { t: "note", variant: "key", html: "Sagas demand <strong>idempotent</strong> steps and <strong>compensations</strong> (retries are inevitable — the Reliability module's idempotency keys apply here) and they expose intermediate states, so design for them: an order can be 'pending' before it's 'confirmed'. Halo famously scaled to 11.6M users on exactly this pattern." },
            { t: "note", variant: "tip", html: "Prefer a saga for cross-service business transactions; reserve 2PC for the rare case where you truly cannot tolerate any intermediate inconsistency and the participants are few and fast. Often the best fix is to <em>redraw service boundaries</em> so the transaction lives inside one service." },
            { t: "quiz", id: "hld-architecture" }
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
          id: "url-shortener",
          title: "Design a URL shortener",
          summary: "TinyURL/bit.ly. A compact end-to-end design that exercises hashing, caching, and read-heavy scaling.",
          minutes: 9,
          tags: ["case-study", "read-heavy"],
          blocks: [
            { t: "p", html: "Classic warm-up. The whole framework in miniature: take a long URL, return a short code, and redirect on lookup — at scale, very read-heavy." },
            { t: "h", text: "1 · Requirements" },
            {
              t: "ul", items: [
                "Functional: shorten a URL → short code; visiting the code redirects to the original. Optional: custom alias, expiry, analytics.",
                "Non-functional: redirects must be <strong>fast</strong> (&lt; 100 ms) and <strong>highly available</strong>; extremely read-heavy.",
                "Reads ≫ writes — assume ~100:1."
              ]
            },
            { t: "h", text: "2 · Estimate" },
            { t: "code", lang: "text", code:
              "Writes:  100M new URLs / month  ~= 40 writes/sec (avg)\n" +
              "Reads :  100x  ~= 4,000 redirects/sec\n" +
              "Storage: 100M/mo * 12 * 5 yr * ~500 bytes  ~= 3 TB over 5 years\n" +
              "Codes  : base62 [a-zA-Z0-9], length 7 -> 62^7 ~= 3.5 trillion codes"
            },
            { t: "h", text: "3 · API" },
            { t: "code", lang: "text", code:
              "POST /shorten   { url, customAlias?, expiry? }  -> { shortUrl }\n" +
              "GET  /{code}                                   -> 302 redirect"
            },
            { t: "h", text: "4 · Core design choice: generating the code" },
            {
              t: "ul", items: [
                "<strong>Hash + truncate</strong> (e.g., MD5 → base62, first 7 chars). Simple, but collisions need handling.",
                "<strong>Counter + base62 encode</strong> — a global incrementing id encoded to base62 guarantees uniqueness, no collisions. Hand out id ranges to each server (a ticket service) to avoid a write bottleneck.",
                "Avoid sequential, guessable codes if privacy matters — add randomness."
              ]
            },
            { t: "note", variant: "key", html: "The counter approach is usually cleanest: <em>unique by construction, no collision checks</em>. Distribute id generation (range allocation or a service like a Snowflake id) so the counter isn't a single write hotspot." },
            { t: "h", text: "5 · Architecture" },
            { t: "code", lang: "text", code:
              "  Client ─► CDN/LB ─► App servers ─► Cache (Redis) ─► DB (KV store)\n" +
              "                                       │ 95%+ hit ratio on hot codes\n" +
              "  Redirects: look up code -> cache hit -> 302. Miss -> DB -> cache."
            },
            { t: "note", variant: "tip", html: "Because it's read-heavy with a small, hot key space (popular links), <strong>caching is the hero</strong>. A KV store (DynamoDB/Cassandra) + Redis cache + CDN gets you to millions of redirects/sec. Code→URL never changes, so cache aggressively with long TTLs." }
          ]
        },
        {
          id: "news-feed",
          title: "Design a news feed",
          summary: "Twitter/Instagram home timeline. The fan-out problem and the celebrity edge case.",
          minutes: 9,
          tags: ["case-study", "fan-out"],
          blocks: [
            { t: "p", html: "Build the home timeline: each user sees a feed of recent posts from people they follow, newest first. The crux is <strong>fan-out</strong> — how a new post reaches all the right feeds." },
            { t: "h", text: "Two strategies for building a feed" },
            { t: "compare",
              bad: { title: "Fan-out on write (push)", items: ["On post, push it into every follower's precomputed feed", "✓ Reads are instant (feed is ready)", "✗ A celebrity post = millions of writes", "✗ Wasted work for inactive followers", "Great for users with few followers"] },
              good: { title: "Fan-out on read (pull)", items: ["On read, gather recent posts from everyone you follow & merge", "✓ Cheap writes; no wasted fan-out", "✗ Reads are heavy (merge many sources)", "✗ Slow for users following thousands", "Great for celebrities / inactive users"] }
            },
            { t: "note", variant: "key", html: "<strong>The hybrid is the real answer.</strong> Use push for normal users (precompute feeds for fast reads), but for <em>celebrities</em> with millions of followers, switch to pull — fetch their recent posts at read time and merge in. This avoids the 'fan-out storm' of one post triggering tens of millions of writes." },
            { t: "h", text: "Architecture sketch" },
            { t: "code", lang: "text", code:
              "Post ─► write to DB ─► enqueue fan-out job\n" +
              "                          │\n" +
              "         (push) inject post id into followers' feed cache (Redis lists)\n" +
              "         (celebrities skipped here)\n\n" +
              "Read feed ─► read precomputed feed from cache\n" +
              "          ─► merge in recent posts from followed celebrities (pull)\n" +
              "          ─► hydrate post ids -> post contents, rank, return"
            },
            {
              t: "ul", items: [
                "Store <strong>post ids</strong> in feeds (cheap), then hydrate to full content from a cache/store at read time.",
                "<strong>Rank</strong> by recency or an ML score; paginate with a cursor.",
                "Eventual consistency is fine — a post appearing a second late is invisible to users."
              ]
            }
          ]
        },
        {
          id: "chat",
          title: "Design a chat system",
          summary: "WhatsApp/Slack core. Real-time delivery, presence, and the connection-routing problem.",
          minutes: 8,
          tags: ["case-study", "real-time"],
          blocks: [
            { t: "p", html: "1:1 and group messaging with real-time delivery, online presence, and message history. This one leans on everything from the real-time and messaging modules." },
            { t: "h", text: "The connection problem" },
            { t: "p", html: "Clients hold persistent <strong>WebSocket</strong> connections to a fleet of stateful <em>connection servers</em>. But user A's socket is on server 3 while user B's is on server 8 — how does A's message reach B?" },
            { t: "diagram", id: "chat-fanout", caption: "A presence registry maps user → connection server; a pub/sub backplane (Kafka/Redis) routes the message between servers." },
            { t: "h", text: "Key pieces" },
            {
              t: "ul", items: [
                "<strong>Connection servers</strong> hold WebSockets; scale horizontally (sticky by connection).",
                "<strong>Presence service</strong> tracks who's online and which server holds their socket (heartbeats expire stale entries).",
                "<strong>Message store</strong> — write every message durably (wide-column store like Cassandra; partition by chat/conversation id, sorted by time).",
                "<strong>Pub/sub backplane</strong> routes a message to the server holding the recipient's socket.",
                "<strong>Offline delivery</strong> — if the recipient is offline, persist + push notification; deliver on reconnect.",
                "<strong>Delivery receipts</strong> — sent / delivered / read via acks; messages are at-least-once + dedup by message id."
              ]
            },
            { t: "note", variant: "key", html: "Group chat changes fan-out: a message to a 500-person group must reach up to 500 sockets across many servers. The pub/sub backplane handles that, and you store the message once while delivering many times. Ordering is per-conversation (a partition key)." },
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
            { t: "note", variant: "tip", html: "Read real architectures actively. For each, ask: <em>what was the bottleneck, what did they trade away, and would I have reached for the same tool?</em> That's exactly the muscle a system-design interview tests — and you'll notice the same dozen patterns from this track recurring everywhere." }
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
            { t: "note", variant: "key", html: "Every one of these designs is assembled from the primitives in this track — load balancers, caches, sharded databases, queues, CDNs, idempotency, and the CAP trade-off. Master the building blocks and the 'design X' prompts become exercises in <em>composition</em>, not recall." }
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
          id: "ai-agents",
          title: "AI agents & agentic patterns",
          summary: "An LLM that can plan, call tools, and remember — the architecture behind autonomous assistants.",
          minutes: 8,
          tags: ["ai", "agents", "llm"],
          blocks: [
            { t: "p", html: "An <strong>AI agent</strong> wraps a large language model in a loop that lets it <em>act</em>, not just answer. The model decides what to do, calls a <em>tool</em> (search, code execution, an API), observes the result, and repeats until the task is done. Four ingredients recur: a <strong>model</strong> (the reasoner), <strong>tools</strong> (its hands), <strong>memory</strong> (state across steps), and a <strong>planning loop</strong> (the control flow)." },
            { t: "diagram", id: "agent-loop", caption: "The ReAct-style loop: think \u2192 act \u2192 observe, repeating until an answer or the step budget is reached." },
            { t: "note", variant: "key", html: "The system-design challenges are familiar ones in new clothes: <strong>state &amp; memory</strong> (short-term context vs long-term vector store), <strong>reliability</strong> (tools fail; loops must time out and retry), <strong>cost/latency</strong> (every step is an LLM call), and <strong>safety</strong> (sandbox tool execution, bound the agent's authority)." },
            { t: "note", variant: "trap", html: "Give an agent a step budget and idempotent tools. Without a loop cap it can spin forever or thrash; without idempotency a retried tool call can double-charge or double-send — the same idempotency lesson from Reliability, now at the agent layer." },
          ]
        },
        {
          id: "rag-vector",
          title: "RAG & vector databases",
          summary: "Ground a model in your own data by retrieving relevant chunks at query time — the antidote to hallucination.",
          minutes: 7,
          tags: ["ai", "rag", "vector-db"],
          blocks: [
            { t: "p", html: "<strong>Retrieval-Augmented Generation (RAG)</strong> fixes the LLM's two big gaps — it doesn't know your private data and it can confidently make things up. The idea: at query time, <em>retrieve</em> the most relevant snippets from your knowledge base and stuff them into the prompt as grounding, so the model answers from facts you supplied." },
            { t: "code", lang: "text", code:
              "Indexing (offline):  docs ─► chunk ─► embed ─► store vectors\n\n" +
              "Query (online):\n" +
              "  question ─► embed ─► vector DB: top-k nearest chunks\n" +
              "          ─► prompt = question + retrieved context ─► LLM ─► grounded answer"
            },
            { t: "p", html: "A <strong>vector database</strong> (Pinecone, Weaviate, pgvector, Milvus) stores each chunk as an <em>embedding</em> — a high-dimensional vector — and finds the nearest ones to a query vector using approximate nearest-neighbor search. It's the retrieval engine RAG runs on." },
            { t: "note", variant: "key", html: "RAG quality lives or dies on <strong>retrieval</strong>, not the model. Chunking strategy, embedding choice, top-k, and re-ranking matter more than swapping the LLM. Garbage retrieved → garbage generated." },
          ]
        },
        {
          id: "llm-systems",
          title: "LLM systems & serving",
          summary: "Tokens, context windows, prompt vs context engineering, and how to actually evaluate an LLM feature.",
          minutes: 8,
          tags: ["ai", "llm", "evaluation"],
          blocks: [
            { t: "p", html: "To design with LLMs you need their physics. Models read and write <strong>tokens</strong> (~¾ of a word each), fit a bounded <strong>context window</strong>, and cost money and latency per token. Everything — prompt size, retrieved context, conversation history — competes for that window." },
            {
              t: "ul", items: [
                "<strong>Prompt engineering</strong> — crafting the instruction for a single call.",
                "<strong>Context engineering</strong> — deciding <em>what</em> goes into the window (system prompt + retrieved docs + memory + tools) and in what order. The higher-leverage skill for real systems.",
                "<strong>Temperature</strong> — randomness; low for factual/deterministic, higher for creative.",
                "<strong>Streaming</strong> — emit tokens as they're generated so the UI feels instant."
              ]
            },
            { t: "note", variant: "key", html: "<strong>You can't ship what you can't measure.</strong> LLM features need an <em>eval harness</em>: a dataset of inputs with graded outputs, plus automated scoring (exact-match, LLM-as-judge, or human review). Treat prompts like code — version them and run evals on every change." },
          ]
        },
        {
          id: "genai-design",
          title: "Designing GenAI & ML systems",
          summary: "From a blank page to a production GenAI system — and how classic ML pipelines go from data to deployment.",
          minutes: 8,
          tags: ["ai", "ml", "system-design"],
          blocks: [
            { t: "p", html: "Designing a GenAI feature reuses everything from this track — gateways, caches, queues, rate limits, idempotency — plus a few AI-specific boxes: a <strong>model gateway</strong> (route/fallback across providers), a <strong>vector store</strong> for retrieval, a <strong>prompt/version registry</strong>, a <strong>guardrail</strong> layer (moderation, PII filtering), and an <strong>eval + feedback</strong> loop." },
            { t: "p", html: "Classic <strong>ML systems</strong> follow a pipeline: collect &amp; label data → train → evaluate offline → serve (batch or real-time) → monitor for drift → retrain. The hard parts are rarely the model — they're the <em>data</em>, the feature pipeline, and keeping training and serving consistent." },
            { t: "note", variant: "tip", html: "Cache aggressively and degrade gracefully. LLM calls are slow and pricey, so cache responses for repeated prompts, stream tokens for perceived speed, and fall back to a smaller model or a canned answer when the provider is rate-limiting you." },
            { t: "quiz", id: "hld-ai" },
          ]
        }
      ]
    },

    /* ============================ PROTOCOLS, SECURITY & DELIVERY ============================ */
    {
      id: "protocols-security",
      name: "Protocols, Security & Delivery",
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
          ]
        },
        {
          id: "containers-delivery",
          title: "Containers, Docker & deployment",
          summary: "Ship the same artifact everywhere, then roll it out safely with blue-green and canary releases.",
          minutes: 7,
          tags: ["delivery", "containers", "deployment"],
          blocks: [
            { t: "p", html: "A <strong>container</strong> packages an app with its dependencies into one portable image that runs identically on a laptop, in CI, and in production — solving \u201cit works on my machine.\u201d Unlike a VM, containers share the host kernel, so they start in milliseconds and pack densely. <strong>Docker</strong> builds and runs them; an orchestrator (Kubernetes) schedules them across a fleet." },
            { t: "h", text: "Rolling out without downtime" },
            {
              t: "ul", items: [
                "<strong>Rolling</strong> — replace instances a few at a time; simple, no extra capacity.",
                "<strong>Blue-green</strong> — stand up a full new version, flip traffic at the LB, keep the old one for instant rollback.",
                "<strong>Canary</strong> — send 1% → 10% → 100% of traffic to the new version, watching metrics at each step.",
                "<strong>Feature flags</strong> — decouple <em>deploy</em> from <em>release</em>; turn a feature on for a cohort without redeploying."
              ]
            },
            { t: "note", variant: "tip", html: "Pair deployment strategy with health checks and automated rollback. A canary is only safe if you're watching error rate and latency and can abort the moment they spike." },
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
            { t: "quiz", id: "hld-protocols" },
          ]
        }
      ]
    }
  ]
};
