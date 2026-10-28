/* =====================================================================
   BLUEPRINT · Quiz bank
   Filtered for this split app. Answers hand-verified in source.

   Merge, never reassign: the track-*.js files contribute to the same
   namespace, so a plain assignment here would drop their entries whenever
   this file is evaluated after them.
   ===================================================================== */
window.QUIZZES = Object.assign(window.QUIZZES || {}, {
  "hld-foundations": {
    "title": "Foundations checkpoint",
    "sub": "Estimation, scaling vocabulary, and how to frame a design.",
    "questions": [
      {
        "q": "Roughly how long does a round trip within the same data center take, compared to reading 1 MB sequentially from SSD?",
        "options": [
          "DC round trip ~0.5 ms; SSD 1 MB read ~1 ms",
          "Both are about the same (~1 ms)",
          "DC round trip ~100 ms; SSD read ~1 µs",
          "SSD read is always slower than any network call"
        ],
        "answer": 0,
        "explain": "A same-DC round trip is ~0.5 ms and reading 1 MB sequentially from SSD is ~1 ms. Knowing these 'latency numbers every engineer should know' lets you sanity-check designs instantly."
      },
      {
        "q": "You expect 86 million requests evenly spread across a day. What is the approximate average QPS?",
        "options": [
          "~100 QPS",
          "~1,000 QPS",
          "~10,000 QPS",
          "~860,000 QPS"
        ],
        "answer": 1,
        "explain": "A day has ~86,400 seconds. 86,000,000 / 86,400 ≈ 1,000 QPS. The handy trick: 86,400 ≈ 10⁵, so requests-per-day ÷ 10⁵ ≈ average QPS. Remember to also plan for peak (often 2–5× average)."
      },
      {
        "q": "Which is the BEST first question to ask when given an open-ended design prompt?",
        "options": [
          "Which database should we use?",
          "What are the functional & non-functional requirements and scale?",
          "Should it be microservices?",
          "What programming language is required?"
        ],
        "answer": 1,
        "explain": "Always scope first: clarify functional requirements, non-functional requirements (latency, availability, consistency), and the scale (users, QPS, data size). Technology choices come AFTER you know the constraints."
      },
      {
        "q": "'Vertical scaling' means…",
        "options": [
          "Adding more machines to a pool",
          "Splitting a table across shards",
          "Adding more CPU/RAM to a single machine",
          "Adding a CDN"
        ],
        "answer": 2,
        "explain": "Vertical scaling (scaling up) means a bigger box — more CPU, RAM, disk. It is simple but has a hard ceiling and a single point of failure. Horizontal scaling (scaling out) adds more machines."
      },
      {
        "q": "A service accepts 500 writes per second and stores about 2 KB per write. Roughly how much new data does it add per day, before replication?",
        "options": [
          "About 8.6 GB",
          "About 860 MB",
          "About 8.6 TB",
          "About 86 GB"
        ],
        "answer": 3,
        "explain": "500 × 2 KB = 1 MB per second, and a day has 86,400 seconds, so about 86 GB per day. Multiply by the replication factor and the retention period before sizing disks."
      }
    ]
  },
  "hld-caching": {
    "title": "Caching checkpoint",
    "sub": "Strategies, eviction, and invalidation.",
    "questions": [
      {
        "q": "In a cache-aside (lazy loading) setup, who is responsible for loading data into the cache on a miss?",
        "options": [
          "The database, automatically",
          "The load balancer",
          "The cache server itself",
          "The application code"
        ],
        "answer": 3,
        "explain": "With cache-aside, the application checks the cache, and on a miss it reads the DB and then populates the cache. The cache stays 'dumb'. (Read-through delegates that loading to the cache layer instead.)"
      },
      {
        "q": "Which eviction policy removes the entry that hasn't been accessed for the longest time?",
        "options": [
          "LRU",
          "FIFO",
          "LFU",
          "Random"
        ],
        "answer": 0,
        "explain": "LRU = Least Recently Used. It evicts the item whose last access is oldest. LFU evicts the least frequently used; FIFO evicts the oldest inserted regardless of access."
      },
      {
        "q": "A write-back (write-behind) cache improves write latency but introduces which risk?",
        "options": [
          "Cache and DB can never be consistent",
          "Data loss if the cache fails before flushing to the DB",
          "Reads become impossible",
          "It cannot be combined with a CDN"
        ],
        "answer": 1,
        "explain": "Write-back acknowledges the write after updating only the cache, flushing to the DB asynchronously. That's fast, but if the cache node dies before the flush, those writes are lost unless you add durability (e.g., replication / WAL)."
      },
      {
        "q": "What problem does a short, randomized TTL ('jitter') primarily mitigate?",
        "options": [
          "Cache penetration",
          "False positives",
          "Cache stampede / thundering herd",
          "Hot partitions"
        ],
        "answer": 2,
        "explain": "If many keys expire at the same instant, all the misses hit the DB at once (a stampede). Adding random jitter to TTLs spreads expirations out. Stampedes are also mitigated by request coalescing / locks."
      },
      {
        "q": "Why is it dangerous to cache a permission-dependent response under a key that does not include the user or tenant?",
        "options": [
          "The cache can serve one user's data to another user who requests the same key",
          "It makes the cache hit rate too high",
          "It forces every read to go to the database",
          "Caches cannot store responses larger than one kilobyte"
        ],
        "answer": 0,
        "explain": "If authorization changes the response, the identity or permission scope must be part of the key. Otherwise the first caller's view is returned to everyone, which is a data leak rather than a performance bug."
      }
    ]
  },
  "hld-databases": {
    "title": "Data layer checkpoint",
    "sub": "SQL vs NoSQL, replication, sharding, indexing.",
    "questions": [
      {
        "q": "Sharding a database primarily helps with…",
        "options": [
          "Reducing code complexity",
          "Eliminating the need for indexes",
          "Guaranteeing strong consistency",
          "Distributing data & write load horizontally beyond one machine"
        ],
        "answer": 3,
        "explain": "Sharding (horizontal partitioning) splits rows across multiple machines so no single node holds all the data or absorbs all the writes. It adds complexity (cross-shard queries, rebalancing) in exchange for scale."
      },
      {
        "q": "In leader–follower replication, what is the main consequence of asynchronous replication?",
        "options": [
          "Followers may serve slightly stale reads (replication lag)",
          "Writes are impossible",
          "The leader cannot fail over",
          "Reads must always go to the leader"
        ],
        "answer": 0,
        "explain": "Async replication lets the leader ack writes without waiting for followers, so followers can lag. Reading from a follower can therefore return stale data — a read-your-writes consistency concern."
      },
      {
        "q": "A database index speeds up reads but…",
        "options": [
          "Has zero cost",
          "Slows down writes and uses extra storage",
          "Makes the table read-only",
          "Removes the need for a primary key"
        ],
        "answer": 1,
        "explain": "Indexes (often B-trees) make lookups fast, but every insert/update/delete must also maintain the index, adding write overhead and storage. Index deliberately, not on every column."
      },
      {
        "q": "Which choice of shard key is most likely to create a 'hot shard'?",
        "options": [
          "A high-cardinality hash of user_id",
          "A UUID",
          "Monotonically increasing timestamp",
          "A composite hashed key"
        ],
        "answer": 2,
        "explain": "A monotonically increasing key (like a timestamp or auto-increment id) routes all new writes to the same shard, creating a hotspot. Hashing or high-cardinality keys spread writes evenly."
      },
      {
        "q": "Which workload is a column-oriented OLAP store usually optimized for?",
        "options": [
          "Single-row transactional updates",
          "Queueing background jobs",
          "Low-latency session lookup by key",
          "Scanning a few columns across many rows for analytics"
        ],
        "answer": 3,
        "explain": "Column stores keep values from the same column together, so analytic scans and aggregations read only the needed columns and compress well. OLTP row stores are better for fetching or updating complete entities."
      },
      {
        "q": "Why do LSM-tree storage engines often have excellent write throughput?",
        "options": [
          "They turn random updates into append-friendly writes and compact later",
          "They never persist data",
          "They require every query to be a full scan",
          "They avoid replication entirely"
        ],
        "answer": 0,
        "explain": "LSM trees write to an in-memory structure and append sorted files, then compact in the background. That favors high write rates, but compaction introduces read, write, and space amplification."
      },
      {
        "q": "A search index is primarily built around which structure?",
        "options": [
          "FIFO queue",
          "Inverted index mapping terms to documents",
          "Session cookie jar",
          "DNS cache"
        ],
        "answer": 1,
        "explain": "Search engines use inverted indexes: term -> matching documents, plus scoring and filters. Vector databases solve semantic nearest-neighbor retrieval; both may be combined in hybrid search."
      }
    ]
  },
  "hld-cap": {
    "title": "CAP & consistency checkpoint",
    "sub": "Trade-offs under partitions.",
    "questions": [
      {
        "q": "CAP theorem says that during a network partition, a distributed system must sacrifice…",
        "options": [
          "Performance or cost",
          "Durability or Latency",
          "Consistency or Availability",
          "Reads or Writes"
        ],
        "answer": 2,
        "explain": "When a partition (P) happens, you must choose: stay Available (answer with possibly-stale data → AP) or stay Consistent (refuse/block to avoid divergence → CP). You cannot have both during the partition."
      },
      {
        "q": "DynamoDB and Cassandra are usually described as…",
        "options": [
          "CA systems",
          "CP systems",
          "ACID-only systems",
          "AP systems"
        ],
        "answer": 3,
        "explain": "They favor Availability and Partition tolerance (AP), offering tunable/eventual consistency. Systems like ZooKeeper, etcd, and HBase lean CP (consistency over availability)."
      },
      {
        "q": "'Eventual consistency' means…",
        "options": [
          "If writes stop, all replicas converge to the same value given enough time",
          "Data is never consistent",
          "Every read returns the latest write immediately",
          "Consistency only on the leader"
        ],
        "answer": 0,
        "explain": "Under eventual consistency, replicas may temporarily disagree, but absent new writes they converge. It trades immediate correctness for availability and low latency."
      },
      {
        "q": "PACELC extends CAP by also forcing a choice when there is NO partition. What is that choice?",
        "options": [
          "Cost vs Capacity",
          "Latency vs Consistency",
          "Reads vs Writes",
          "Sync vs Async only"
        ],
        "answer": 1,
        "explain": "PACELC: if Partition then Availability-vs-Consistency, Else Latency-vs-Consistency. Even on a healthy network, stronger consistency (e.g., quorum reads) costs latency."
      },
      {
        "q": "A replicated store has N = 3 copies and uses write quorum W = 2 and read quorum R = 2. Why does a read see the most recent acknowledged write?",
        "options": [
          "Because reads always go to the leader",
          "Because W = 2 means every replica receives every write synchronously",
          "Because R + W > N, every read quorum overlaps every write quorum in at least one replica",
          "Because quorums disable network partitions"
        ],
        "answer": 2,
        "explain": "With R + W > N, any set of R replicas shares at least one member with any set of W replicas, so at least one replica in the read holds the latest acknowledged value. Version numbers then pick it out."
      }
    ]
  },
  "hld-messaging": {
    "title": "Messaging & APIs checkpoint",
    "sub": "Queues, async, and rate limiting.",
    "questions": [
      {
        "q": "The main benefit of putting a message queue between a producer and consumer is…",
        "options": [
          "It guarantees exactly-once delivery for free",
          "It removes the need for a database",
          "Decoupling + buffering, so spikes don't overwhelm the consumer",
          "It makes the system synchronous"
        ],
        "answer": 2,
        "explain": "A queue decouples producers from consumers and absorbs bursts (load leveling). Consumers process at their own pace. Exactly-once is notoriously hard — most systems give at-least-once + idempotency."
      },
      {
        "q": "Which rate-limiting algorithm naturally ALLOWS short bursts up to a capacity while enforcing an average rate?",
        "options": [
          "Fixed window",
          "No algorithm allows bursts",
          "Sliding log only",
          "Token bucket"
        ],
        "answer": 3,
        "explain": "Token bucket refills tokens at a steady rate up to a capacity; a client can spend a burst of saved tokens, then is throttled to the refill rate. Leaky bucket, by contrast, enforces a smooth constant output."
      },
      {
        "q": "Why is idempotency important for at-least-once delivery?",
        "options": [
          "Reprocessing a duplicate message must not change the result",
          "It makes messages smaller",
          "It encrypts the payload",
          "It guarantees ordering"
        ],
        "answer": 0,
        "explain": "At-least-once means a message may be delivered more than once. Idempotent handlers (e.g., keyed by a request id) ensure duplicates have no extra effect — charging a card once even if the event arrives twice."
      },
      {
        "q": "What problem does the transactional outbox pattern solve?",
        "options": [
          "Encrypting messages at rest",
          "Atomically committing business data and the intent to publish an event",
          "Making consumers single-threaded",
          "Replacing all queues with HTTP"
        ],
        "answer": 1,
        "explain": "The outbox writes the business change and an outbox event in the same database transaction. A relay publishes the event later, so a crash between commit and publish does not lose the event."
      },
      {
        "q": "For strict ordering of events for one customer, what should the partition key usually be?",
        "options": [
          "A random UUID per event",
          "The current timestamp only",
          "The customer or entity id whose order must be preserved",
          "The consumer host name"
        ],
        "answer": 2,
        "explain": "Kafka-like systems guarantee order within a partition, not across all partitions. Partition by the entity whose updates must stay ordered, then make that consumer path idempotent."
      },
      {
        "q": "Which API design helps a client safely retry a payment creation after a timeout?",
        "options": [
          "Offset pagination",
          "Changing POST to GET",
          "A larger JSON payload",
          "Idempotency-Key header"
        ],
        "answer": 3,
        "explain": "An idempotency key lets the server dedupe repeated unsafe writes and return the original result, avoiding duplicate charges when the client cannot tell whether the first attempt succeeded."
      },
      {
        "q": "Why are cursor-based pages usually safer than offset pages for large, changing lists?",
        "options": [
          "They anchor the next page to a stable position instead of a shifting row count",
          "They encrypt every item",
          "They require no ordering",
          "They disable indexes"
        ],
        "answer": 0,
        "explain": "Offset pagination can skip or duplicate rows when inserts/deletes happen before the offset. A cursor encodes a stable sort position, such as created_at plus id."
      },
      {
        "q": "What should a robust batch API return when only some items fail?",
        "options": [
          "HTTP 200 with no details",
          "Per-item status plus a request/correlation id",
          "A random retry time only",
          "A stack trace for the client to parse"
        ],
        "answer": 1,
        "explain": "Real clients need to know exactly which items succeeded, which failed, whether failures are retryable, and how to cite the request in support or logs."
      }
    ]
  },
  "lld-oop": {
    "title": "OOP foundations checkpoint",
    "sub": "The four pillars.",
    "questions": [
      {
        "q": "Hiding internal state and exposing behavior through methods is which pillar?",
        "options": [
          "Inheritance",
          "Polymorphism",
          "Encapsulation",
          "Abstraction"
        ],
        "answer": 2,
        "explain": "Encapsulation bundles data with the methods that operate on it and restricts direct access to internals, protecting invariants. Abstraction is about exposing only the essential concept; they're related but distinct."
      },
      {
        "q": "A `Circle` and a `Square` both implement a `Shape.area()` method and are used interchangeably through the `Shape` type. This is…",
        "options": [
          "Encapsulation",
          "Memoization",
          "Composition",
          "Polymorphism"
        ],
        "answer": 3,
        "explain": "Polymorphism lets different types respond to the same message (`area()`) in their own way, so calling code depends on the `Shape` abstraction, not the concrete class."
      },
      {
        "q": "'Favor composition over inheritance' advises you to…",
        "options": [
          "Build behavior by combining objects rather than deep inheritance trees",
          "Never use classes",
          "Always copy-paste code",
          "Use only static methods"
        ],
        "answer": 0,
        "explain": "Deep inheritance is rigid and leaks parent details into children. Composing small collaborators is more flexible, easier to test, and avoids the fragile base-class problem."
      },
      {
        "q": "Callers use a PaymentGateway interface with a single charge() method and never see the retry, signing and HTTP details behind it. Which pillar is this?",
        "options": [
          "Inheritance",
          "Abstraction",
          "Polymorphism",
          "Composition"
        ],
        "answer": 1,
        "explain": "Abstraction exposes what an object does while hiding how it does it. Callers depend on charge(), and the protocol details can change without touching them."
      },
      {
        "q": "When is inheritance the right tool rather than composition?",
        "options": [
          "Whenever two classes share a few lines of code",
          "Whenever you want to avoid writing interfaces",
          "Whenever a class needs more than three fields",
          "When the subtype is a genuine kind of the base type and can honour the base type's full contract everywhere it is used"
        ],
        "answer": 3,
        "explain": "Inheritance is sound when the is-a relationship holds and substitution is safe. Sharing code alone is better served by composing a helper, because inheritance couples the subclass to every future change in the parent."
      }
    ]
  },
  "lld-solid": {
    "title": "SOLID checkpoint",
    "sub": "The five object-oriented design principles.",
    "questions": [
      {
        "q": "A class should have only one reason to change. Which principle is this?",
        "options": [
          "Open/Closed",
          "Single Responsibility",
          "Liskov Substitution",
          "Dependency Inversion"
        ],
        "answer": 1,
        "explain": "Single Responsibility Principle (SRP): a class should do one job, so it has only one reason to change. Mixing, say, persistence and business rules in one class violates it."
      },
      {
        "q": "'Software entities should be open for extension but closed for modification' is…",
        "options": [
          "SRP",
          "ISP",
          "OCP",
          "DIP"
        ],
        "answer": 2,
        "explain": "Open/Closed Principle (OCP): add new behavior by adding new code (e.g., a new strategy/subclass), not by editing existing, tested code. Polymorphism and plugins are the usual tools."
      },
      {
        "q": "A subclass that throws 'not supported' for a method it inherited most likely violates…",
        "options": [
          "KISS",
          "Interface Segregation Principle",
          "DRY",
          "Liskov Substitution Principle"
        ],
        "answer": 3,
        "explain": "LSP says subtypes must be usable anywhere their base type is expected. A `Penguin` subclass of `Bird` that throws on `fly()` breaks substitutability — the hierarchy is wrong."
      },
      {
        "q": "Depending on an interface (abstraction) instead of a concrete class is the essence of…",
        "options": [
          "Dependency Inversion Principle",
          "Single Responsibility",
          "Open/Closed",
          "Interface Segregation"
        ],
        "answer": 0,
        "explain": "Dependency Inversion Principle (DIP): high-level modules and low-level modules should both depend on abstractions. This is what makes code testable and swappable (e.g., inject a `PaymentGateway` interface)."
      },
      {
        "q": "A Printer interface forces a basic printer class to implement fax() and scan(), which it fills with 'not supported'. Which principle is the interface breaking?",
        "options": [
          "Open/Closed",
          "Dependency Inversion",
          "Interface Segregation",
          "Single Responsibility of the caller"
        ],
        "answer": 2,
        "explain": "Interface Segregation says clients should not depend on methods they do not use. Split it into Printer, Scanner and Fax so each class implements only what it supports."
      }
    ]
  },
  "lld-patterns": {
    "title": "Design patterns checkpoint",
    "sub": "Recognize the pattern from the intent.",
    "questions": [
      {
        "q": "You need to choose an algorithm at runtime (e.g., different payment methods) behind a common interface. Which pattern fits best?",
        "options": [
          "Singleton",
          "Strategy",
          "Observer",
          "Adapter"
        ],
        "answer": 1,
        "explain": "Strategy encapsulates interchangeable algorithms behind a common interface, letting the client pick one at runtime — perfect for payment methods, sorting strategies, compression codecs, etc."
      },
      {
        "q": "When one object changes state and many dependents must be notified automatically, use…",
        "options": [
          "Facade",
          "Builder",
          "Observer",
          "Prototype"
        ],
        "answer": 2,
        "explain": "Observer defines a one-to-many dependency: when the subject changes, all subscribed observers are notified. It underpins event systems, pub/sub, and UI data-binding."
      },
      {
        "q": "A class that makes an incompatible third-party interface usable by your code without changing either is a…",
        "options": [
          "Decorator",
          "Mediator",
          "Composite",
          "Adapter"
        ],
        "answer": 3,
        "explain": "Adapter wraps an existing (often third-party) interface and translates it to the interface your code expects — like a power-plug adapter. Decorator, by contrast, adds behavior to the same interface."
      },
      {
        "q": "Which pattern is best for constructing a complex object step-by-step with many optional parameters?",
        "options": [
          "Builder",
          "Factory Method",
          "Singleton",
          "Flyweight"
        ],
        "answer": 0,
        "explain": "Builder assembles a complex object through a fluent, step-by-step API and avoids telescoping constructors. Factory Method instead decides WHICH class to instantiate; they solve different problems."
      },
      {
        "q": "Ensuring a class has exactly one instance with a global access point is the intent of…",
        "options": [
          "Prototype",
          "Singleton",
          "Bridge",
          "Command"
        ],
        "answer": 1,
        "explain": "Singleton guarantees a single shared instance (e.g., a config or logger). Use sparingly — it's effectively global state and can hurt testability and concurrency if abused."
      }
    ]
  },
  "hld-scaling": {
    "title": "Scaling checkpoint",
    "sub": "Vertical vs horizontal, statelessness, and load balancing.",
    "questions": [
      {
        "q": "What is the key requirement that lets a service scale horizontally behind a load balancer?",
        "options": [
          "A faster CPU",
          "A single shared in-memory session",
          "Statelessness — any replica can serve any request",
          "Sticky sessions on every route"
        ],
        "answer": 2,
        "explain": "If servers keep no per-client state locally, any replica can handle any request, so you can add, remove, or restart nodes freely. State is externalized to a shared cache/DB or carried in a token."
      },
      {
        "q": "A load balancer using 'least connections' is best when…",
        "options": [
          "All requests take the same time",
          "You need cache affinity",
          "There is only one server",
          "Requests vary widely in duration"
        ],
        "answer": 3,
        "explain": "Least-connections routes to the server with the fewest active requests, which balances load well when request durations are uneven. Round-robin is fine when requests are uniform."
      },
      {
        "q": "'Power of two choices' load balancing means…",
        "options": [
          "Pick two servers at random and send to the less-loaded one",
          "Always pick the first of two servers",
          "Use exactly two servers",
          "Hash the request into one of two buckets"
        ],
        "answer": 0,
        "explain": "Sampling two servers at random and choosing the lighter one gives almost the evenness of 'least connections' at almost the cost of 'random' — a favorite at scale."
      },
      {
        "q": "Why run load balancers in pairs (active-passive or active-active)?",
        "options": [
          "To double throughput only",
          "So the load balancer itself isn't a single point of failure",
          "To support more algorithms",
          "To avoid health checks"
        ],
        "answer": 1,
        "explain": "An LB fronting redundant servers is great until the LB dies. Running a pair with a floating IP (plus DNS/anycast above) removes that single point of failure."
      },
      {
        "q": "What is the main operational cost of relying on sticky sessions behind a load balancer?",
        "options": [
          "Requests become slower because TLS must be renegotiated",
          "The load balancer can no longer run health checks",
          "Clients must store their session ids in a database",
          "Load spreads unevenly, and users pinned to a failed or drained node lose their in-memory session"
        ],
        "answer": 3,
        "explain": "Pinning users to nodes defeats even distribution and turns every node restart, deploy or failure into lost sessions. Moving session state to a shared store keeps the tier stateless."
      }
    ]
  },
  "hld-networking": {
    "title": "Networking & real-time checkpoint",
    "sub": "Proxies and server-push techniques.",
    "questions": [
      {
        "q": "A reverse proxy sits in front of…",
        "options": [
          "Clients, hiding them from servers",
          "Only databases",
          "Servers, hiding them from clients",
          "The DNS resolver"
        ],
        "answer": 2,
        "explain": "A reverse proxy fronts your servers (load balancing, TLS termination, caching, WAF) so clients see one endpoint. A forward proxy fronts clients to control/anonymize outbound traffic."
      },
      {
        "q": "For one-way server→client streaming (a live feed or notifications), the simplest fit is…",
        "options": [
          "Short polling",
          "A second database",
          "WebSockets",
          "Server-Sent Events (SSE)"
        ],
        "answer": 3,
        "explain": "SSE streams events over a single long-lived HTTP response with auto-reconnect — ideal for server→client only. WebSockets add full-duplex but more complexity; use them for two-way real-time."
      },
      {
        "q": "Why are WebSockets harder to scale than stateless HTTP?",
        "options": [
          "Each connection is stateful and pins a client to one server",
          "They use more bandwidth per message",
          "They can't be load balanced at all",
          "They require a relational database"
        ],
        "answer": 0,
        "explain": "A WebSocket is a persistent, stateful connection tied to a specific server, which complicates load balancing and autoscaling. At scale you add a pub/sub backplane so any server can deliver to any socket."
      },
      {
        "q": "In long polling, what does the server do with a client request when there is no new data yet?",
        "options": [
          "Returns an empty response immediately",
          "Holds the request open until data arrives or a timeout expires, then responds; the client immediately asks again",
          "Upgrades the connection to a WebSocket",
          "Pushes data later over a separate UDP channel"
        ],
        "answer": 1,
        "explain": "Long polling keeps a normal HTTP request open until there is something to say. It is simple and works everywhere, at the cost of a new request per message and connections held open on the server."
      },
      {
        "q": "A forward proxy differs from a reverse proxy because it…",
        "options": [
          "Only handles UDP traffic",
          "Terminates TLS for backend servers",
          "Load-balances requests across application servers",
          "Sits in front of clients and makes outbound requests on their behalf, for example for egress filtering"
        ],
        "answer": 3,
        "explain": "A forward proxy represents clients to the outside world; a reverse proxy represents servers to their clients. Load balancing and TLS termination are reverse-proxy jobs."
      }
    ]
  },
  "hld-reliability": {
    "title": "Reliability checkpoint",
    "sub": "Availability, bloom filters, observability, and idempotency.",
    "questions": [
      {
        "q": "Three services on the critical path are each 99.9% available (in series). The combined availability is roughly…",
        "options": [
          "99.9%",
          "99.7%",
          "99.99%",
          "100%"
        ],
        "answer": 1,
        "explain": "Availability multiplies across dependencies in series: 0.999³ ≈ 0.997, i.e. ~99.7%. Fewer things on the critical path and redundancy improve it."
      },
      {
        "q": "A bloom filter can tell you…",
        "options": [
          "Exactly which items are present",
          "'Definitely not in the set' or 'possibly in the set'",
          "'Definitely in the set' or 'possibly not'",
          "The count of items"
        ],
        "answer": 1,
        "explain": "A bloom filter has no false negatives but allows false positives: it answers 'definitely absent' or 'probably present', using a fraction of the memory of a real set — perfect as a pre-filter."
      },
      {
        "q": "Which operation is naturally idempotent?",
        "options": [
          "add 100 to balance",
          "increment the counter",
          "set balance = 100",
          "append to a log"
        ],
        "answer": 2,
        "explain": "'set balance = 100' produces the same result no matter how many times it runs. 'add 100' does not — a retried request would double-charge. Idempotency keys make non-idempotent creates safe."
      },
      {
        "q": "Of the four golden signals, which measures how 'full' your resources are?",
        "options": [
          "Latency",
          "Traffic",
          "Errors",
          "Saturation"
        ],
        "answer": 3,
        "explain": "Saturation captures how close to capacity a resource is (CPU, memory, queue depth). The other three golden signals are latency, traffic (demand), and errors."
      },
      {
        "q": "During an incident, what should the team optimize for first?",
        "options": [
          "Mitigating user impact and stabilizing the service",
          "Writing a perfect root-cause report immediately",
          "Renaming every dashboard",
          "Deploying unrelated features"
        ],
        "answer": 0,
        "explain": "Incident response prioritizes detection, acknowledgement, mitigation, and communication. Root-cause analysis is important, but users must be made safe first."
      },
      {
        "q": "A good page-worthy alert should be tied to…",
        "options": [
          "Any CPU change at all",
          "An actionable user-impact symptom and a runbook",
          "A metric nobody owns",
          "Only a log volume spike"
        ],
        "answer": 1,
        "explain": "Alerts should be actionable, owned, and tied to user impact or an SLO. Noisy, unactionable alerts train responders to ignore the pager."
      }
    ]
  },
  "hld-fault-isolation": {
    "title": "Fault isolation checkpoint",
    "sub": "Cells, shuffle sharding, circuit breakers, and load shedding.",
    "questions": [
      {
        "q": "Which description best distinguishes a cell from a shard and a region?",
        "options": [
          "A region is always smaller than a cell",
          "A cell is just a bigger database shard",
          "A cell is a whole isolated mini-stack for a tenant/resource cohort; a shard is a data partition; a region is a geographic deployment location",
          "A shard always contains app servers and queues"
        ],
        "answer": 2,
        "explain": "A cell is a full serving slice: app tier, queues, caches and data for a bounded tenant/resource cohort. A shard is primarily a data partition. A region is a geographic failure domain that may contain many cells."
      },
      {
        "q": "Why are synchronous cross-cell calls on the hot path dangerous?",
        "options": [
          "They make tracing impossible",
          "They make tenant routing deterministic",
          "They reduce storage cost too much",
          "They couple cells so one slow or failed cell can break requests in another cell"
        ],
        "answer": 3,
        "explain": "Cells exist to contain blast radius. If cell A must synchronously call cell B to serve a user request, B's latency or outage now affects A, undoing much of the isolation."
      },
      {
        "q": "Shuffle sharding is most useful for…",
        "options": [
          "Assigning each tenant a small deterministic subset of workers/resources so noisy neighbors overlap less",
          "Guaranteeing strong consistency across regions",
          "Replacing tenant authorization checks",
          "Making every tenant share every queue equally"
        ],
        "answer": 0,
        "explain": "Shuffle sharding maps each tenant to a small subset of resources. Two tenants may share a member, but are unlikely to share the exact same subset, limiting noisy-neighbor blast radius."
      },
      {
        "q": "Load shedding differs from circuit breaking because load shedding…",
        "options": [
          "Only happens after a dependency returns many errors",
          "Drops or defers low-priority work when your own system is overloaded",
          "Always retries requests faster",
          "Is the same as autoscaling"
        ],
        "answer": 1,
        "explain": "A circuit breaker protects callers from repeatedly calling a failing dependency. Load shedding protects the local system under saturation by rejecting or deferring low-value work before queues collapse."
      },
      {
        "q": "In a pooled multi-tenant SaaS database, what must every tenant-scoped query include?",
        "options": [
          "A random sleep",
          "A cross-cell join",
          "A tenant/resource predicate or enforced policy boundary",
          "A debug flag"
        ],
        "answer": 2,
        "explain": "Pooled tenancy shares infrastructure, so tenant isolation depends on every DB query, cache key, queue message, search filter, and admin tool carrying the tenant boundary."
      },
      {
        "q": "What is the main purpose of tenant-aware deploy waves?",
        "options": [
          "To deploy alphabetically",
          "To force every tenant into one cell",
          "To skip observability",
          "To limit blast radius by rolling changes through tenant cohorts while watching metrics"
        ],
        "answer": 3,
        "explain": "Deploy waves let teams start with low-risk tenants, pause on bad signals, and protect high-value or regulated tenants until the change has proven safe."
      }
    ]
  },
  "hld-architecture": {
    "title": "Architecture checkpoint",
    "sub": "Monolith vs microservices and distributed transactions.",
    "questions": [
      {
        "q": "Per Conway's Law, microservices pay off mainly when…",
        "options": [
          "You have many teams that need to ship independently",
          "You have one small team",
          "You want fewer moving parts",
          "You need strong multi-row transactions"
        ],
        "answer": 0,
        "explain": "Systems mirror the org that builds them. Microservices' independent deploy/scale shines with many autonomous teams; a single small team is usually faster and cheaper with a modular monolith."
      },
      {
        "q": "Once each microservice owns its own database, a single ACID transaction across services is…",
        "options": [
          "Still trivial",
          "Impossible — there's no shared transaction to roll back",
          "Handled automatically by the gateway",
          "Replaced by a bigger lock"
        ],
        "answer": 1,
        "explain": "Separate databases mean no global transaction. You coordinate with a Saga (local transactions + compensations) or, rarely, two-phase commit — each with real trade-offs."
      },
      {
        "q": "A Saga handles a failed step by…",
        "options": [
          "Locking all services until it succeeds",
          "Ignoring the failure",
          "Running compensating transactions to undo prior steps",
          "Rolling back a global 2PC commit"
        ],
        "answer": 2,
        "explain": "A Saga is a sequence of local transactions; if one fails, it runs compensating ('undo') transactions for the completed steps — eventually consistent but available, unlike blocking 2PC."
      },
      {
        "q": "What is the classic weakness of two-phase commit?",
        "options": [
          "It cannot guarantee atomicity",
          "It only works within a single database",
          "It requires eventual consistency",
          "Participants that have voted yes can be left blocked, holding locks, if the coordinator fails before announcing the outcome"
        ],
        "answer": 3,
        "explain": "After a participant prepares, it must wait for the coordinator's decision. If the coordinator disappears, participants hold locks and cannot safely decide alone, which is why 2PC is avoided across independently owned services."
      },
      {
        "q": "How does an orchestrated saga differ from a choreographed one?",
        "options": [
          "An orchestrated saga cannot run compensations",
          "A central orchestrator tells each service what to do next, making the flow explicit, instead of services reacting to each other's events",
          "A choreographed saga uses two-phase commit",
          "They are identical; the terms are synonyms"
        ],
        "answer": 1,
        "explain": "Orchestration puts the workflow in one place, which is easier to read and monitor; choreography decouples services but spreads the flow across event handlers, which gets hard to follow as steps grow."
      }
    ]
  },
  "hld-production-readiness": {
    "title": "Production readiness checkpoint",
    "sub": "Capacity, cost, launch gates, and design-doc practice.",
    "questions": [
      {
        "q": "A service expects 40M actions per day with a 5x peak multiplier. What is the best first capacity estimate?",
        "options": [
          "No QPS estimate is possible from daily actions",
          "Exactly 40M QPS",
          "About 5 QPS peak",
          "About 463 average QPS and about 2,315 peak QPS"
        ],
        "answer": 3,
        "explain": "Average QPS is daily actions / 86,400: 40M / 86,400 ~= 463. Peak is then average x the peak multiplier, so 463 x 5 ~= 2,315 QPS."
      },
      {
        "q": "What does N+1 capacity mean in a launch plan?",
        "options": [
          "The system can handle expected peak even after one planned capacity unit is unavailable",
          "The system needs one database only",
          "You add exactly one user to the load test",
          "You deploy one version after another"
        ],
        "answer": 0,
        "explain": "N is the capacity needed for expected peak. N+1 adds enough headroom to survive one instance, node, or equivalent capacity unit being unavailable."
      },
      {
        "q": "Which cost bucket is most directly affected by sending large responses across a cloud/provider boundary?",
        "options": [
          "Primary-key choice",
          "Egress",
          "Object TTL only",
          "Password hashing"
        ],
        "answer": 1,
        "explain": "Egress is data leaving a cloud or provider boundary. Large cross-boundary responses can be expensive and also add latency."
      },
      {
        "q": "Which signal best proves a canary is safe to continue?",
        "options": [
          "The deploy command succeeded",
          "CPU is zero",
          "Canary traffic holds SLOs, error rate, saturation, and business success rate within guardrails versus control",
          "The new version has more features"
        ],
        "answer": 2,
        "explain": "A canary is guarded by user-impacting signals: latency/SLOs, errors, saturation, and business counters compared to control. Successful deployment alone says nothing about production behavior."
      },
      {
        "q": "A good ADR primarily records...",
        "options": [
          "Only the final diagram",
          "A list of team members",
          "Every log line from the launch",
          "The decision, context, alternatives, consequences, and trade-offs"
        ],
        "answer": 3,
        "explain": "An Architecture Decision Record captures why a choice was made, what alternatives lost, and what consequences the team accepts. That is the useful part for future readers."
      }
    ]
  },
  "hld-ai": {
    "title": "AI & ML systems checkpoint",
    "sub": "GenAI design framing, retrieval, ranking and evaluation.",
    "questions": [
      {
        "q": "What does an AI agent's loop add on top of a plain LLM call?",
        "options": [
          "Nothing — it's the same",
          "The ability to call tools, observe results, and repeat until done",
          "A larger model",
          "A relational database"
        ],
        "answer": 1,
        "explain": "An agent wraps the model in a think → act (call a tool) → observe loop, repeating until it produces an answer or hits a step budget. Tools, memory, and the loop are the new pieces."
      },
      {
        "q": "Retrieval-Augmented Generation (RAG) primarily helps with which problem?",
        "options": [
          "Slow GPUs",
          "Eliminating all hallucinations and prompt injection",
          "Giving the model relevant private or fresh context at answer time",
          "Replacing authorization checks"
        ],
        "answer": 2,
        "explain": "RAG retrieves relevant chunks from your knowledge base at query time and adds them to the prompt. It can improve grounding, but it does not guarantee truthful answers or remove prompt-injection risk."
      },
      {
        "q": "In a RAG system, a vector database is used to…",
        "options": [
          "Store SQL rows",
          "Run the LLM",
          "Cache HTML pages",
          "Find the nearest chunks to a query via embedding similarity"
        ],
        "answer": 3,
        "explain": "It stores each chunk as an embedding (a vector) and uses approximate nearest-neighbor search to retrieve the most semantically similar chunks for a query — the retrieval engine RAG runs on."
      },
      {
        "q": "Why must an LLM feature ship with an eval harness?",
        "options": [
          "Because you can't reliably improve what you can't measure",
          "To make it faster",
          "To reduce token count",
          "It's not needed"
        ],
        "answer": 0,
        "explain": "Prompts behave like code: a dataset of inputs with graded outputs plus automated scoring lets you catch regressions when you change a prompt, model, or retrieval step."
      },
      {
        "q": "In a search/ranking pipeline, what is the usual role of candidate retrieval?",
        "options": [
          "Return every document to the user",
          "Find a broad, cheap set of plausible items before expensive ranking",
          "Bypass authorization filters",
          "Store session cookies"
        ],
        "answer": 1,
        "explain": "Search and recommendation systems first retrieve candidates cheaply, then apply richer ranking and filtering. This keeps latency manageable while giving the ranker enough options."
      },
      {
        "q": "Which RAG control prevents one tenant's document from entering another tenant's prompt?",
        "options": [
          "A larger top-k",
          "Higher temperature",
          "Tenant and ACL metadata filters before prompt construction",
          "Longer context windows only"
        ],
        "answer": 2,
        "explain": "RAG documents are protected resources. Tenant and ACL filters must run before ranking/prompt construction so the model never sees unauthorized context."
      }
    ]
  },
  "hld-protocols": {
    "title": "Protocols & delivery checkpoint",
    "sub": "DNS, HTTPS/auth, containers, and coordination.",
    "questions": [
      {
        "q": "Why is the FIRST DNS lookup for a domain slow but later ones instant?",
        "options": [
          "The server is warming up",
          "The domain is rate-limited",
          "TLS has to renegotiate",
          "Results are cached (OS, resolver, along the way) with a TTL"
        ],
        "answer": 3,
        "explain": "DNS is a heavily-cached hierarchy. The first lookup walks root → TLD → authoritative; the answer is then cached with a TTL, so repeats are instant — which is also why changes take time to propagate."
      },
      {
        "q": "A JWT (stateless token) scales well but has which drawback vs server sessions?",
        "options": [
          "It's hard to revoke before it expires",
          "It can't carry claims",
          "It requires a shared session store",
          "It only works over HTTP"
        ],
        "answer": 0,
        "explain": "Any node can verify a signed JWT without shared state, but you can't easily revoke one before expiry — so keep them short-lived and pair with refresh tokens. Server sessions revoke instantly but need a shared store."
      },
      {
        "q": "Passwords should be stored using…",
        "options": [
          "Plaintext",
          "A slow, salted hash (bcrypt/scrypt/Argon2)",
          "A fast hash like MD5",
          "Base64 encoding"
        ],
        "answer": 1,
        "explain": "A slow, salted password hash defeats rainbow tables (salt) and brute force (slowness), so a database leak doesn't immediately expose everyone's credentials."
      },
      {
        "q": "A canary deployment reduces risk by…",
        "options": [
          "Deploying to everyone at once",
          "Skipping health checks",
          "Sending a small % of traffic to the new version first while watching metrics",
          "Rolling back automatically every time"
        ],
        "answer": 2,
        "explain": "A canary shifts 1% → 10% → 100% of traffic to the new version, monitoring error rate and latency at each step so you can abort before a bad release reaches everyone."
      },
      {
        "q": "What is the difference between authentication and authorization?",
        "options": [
          "They are the same",
          "Authentication only applies to databases",
          "Authorization stores passwords",
          "Authentication proves who you are; authorization decides what resource/action you may access"
        ],
        "answer": 3,
        "explain": "Authn establishes identity. Authz is a fresh decision about whether that identity may perform an action on a resource, usually scoped by tenant, ownership, role, or policy."
      },
      {
        "q": "Why is JWT parsing alone insufficient for protecting an invoice endpoint?",
        "options": [
          "The token may identify the user, but the service still must check access to that specific invoice/resource",
          "JWTs cannot be signed",
          "JWTs only work with GraphQL",
          "It prevents TLS from working"
        ],
        "answer": 0,
        "explain": "A JWT can carry identity and broad claims, but resource-scoped authorization still has to verify tenant, ownership, role, and action for the invoice being requested."
      },
      {
        "q": "Which RAG-specific threat should be modeled in an HLD?",
        "options": [
          "Only CPU cache misses",
          "Cross-tenant retrieval and prompt injection from indexed documents",
          "DNS TTL selection only",
          "Whether the UI uses dark mode"
        ],
        "answer": 1,
        "explain": "RAG expands the attack surface: malicious documents can inject instructions, stale or unauthorized chunks can be retrieved, and cross-tenant filters can fail unless designed and tested explicitly."
      }
    ]
  },
  "hld-data-migrations": {
    "title": "Zero-downtime migrations checkpoint",
    "sub": "Expand-contract, backfills, verification, cutover and rollback.",
    "questions": [
      {
        "q": "In an expand-contract migration, what should happen FIRST?",
        "options": [
          "Drop the old column so nobody can use it",
          "Run one giant UPDATE in peak traffic",
          "Add the new schema/path while keeping the old one working",
          "Cut reads to the new table before it exists"
        ],
        "answer": 2,
        "explain": "Expand first: add the new nullable column/table/index/path and ship code that can tolerate both shapes. Contracting the old shape comes last, after backfill, verification, cutover and the rollback window."
      },
      {
        "q": "What makes a production backfill safe to pause, crash and resume?",
        "options": [
          "Skipping verification until the end",
          "A single transaction around every row in the database",
          "Running only from an engineer's laptop",
          "A restartable checkpoint plus idempotent batches"
        ],
        "answer": 3,
        "explain": "Persisting checkpoints and making each batch idempotent means a crashed worker can repeat the last chunk safely. Throttling and verification keep the migration from hurting production or silently drifting."
      },
      {
        "q": "What is a shadow read?",
        "options": [
          "Reading the new path in parallel, comparing it, but returning the old result to the user",
          "A read served only from a cache",
          "A read that bypasses authorization",
          "A replica read during failover only"
        ],
        "answer": 0,
        "explain": "Shadow reads let you test the new read path under real traffic without affecting users. The old response is still served, while mismatches between old and new are measured."
      },
      {
        "q": "Why keep dual-write enabled briefly after cutting reads to the new store?",
        "options": [
          "To make writes twice as expensive forever",
          "To preserve a rollback path while confidence builds",
          "Because the old store is always more correct",
          "To avoid needing CDC validation"
        ],
        "answer": 1,
        "explain": "Keeping the old path warm gives you a rollback lever: flip reads back if the new path misbehaves. Once the rollback window closes and validation is clean, you can contract the old path."
      },
      {
        "q": "For tenant/cell migration, what must change atomically at cutover?",
        "options": [
          "The database engine",
          "Every user's password",
          "The routing control-plane mapping for tenant -> cell",
          "The client app theme"
        ],
        "answer": 2,
        "explain": "After copy, replay and verification, cutover is the routing decision that sends that tenant to the target cell. The mapping must change atomically and be auditable."
      }
    ]
  },
  "hld-offline-sync": {
    "title": "Offline-first sync checkpoint",
    "sub": "Local source of truth, operation queues, delta sync and conflicts.",
    "questions": [
      {
        "q": "In an offline-first mobile app, what should the UI read from first?",
        "options": [
          "A remote API on every render",
          "Only push notifications",
          "A random cache entry",
          "The local database/materialized view"
        ],
        "answer": 3,
        "explain": "The local DB is the UI source of truth. User edits update it immediately and append a durable operation; network sync catches the shared server state up later."
      },
      {
        "q": "Why does each queued sync operation need a stable operation_id?",
        "options": [
          "So the server can dedupe retries safely",
          "To make the payload larger",
          "So clients can skip authorization",
          "To sort notes alphabetically"
        ],
        "answer": 0,
        "explain": "Flaky mobile networks cause duplicate sends. A stable operation_id lets the server apply a mutation once and return the prior acknowledgement for retries."
      },
      {
        "q": "What problem do tombstones solve in offline sync?",
        "options": [
          "They speed up image rendering",
          "They tell other devices about deletes so old copies are not resurrected",
          "They encrypt local records",
          "They replace conflict resolution entirely"
        ],
        "answer": 1,
        "explain": "Without tombstones, a device that missed a delete may later sync its old copy back and resurrect the record. Tombstones carry delete information until every relevant checkpoint has advanced."
      },
      {
        "q": "Which conflict policy is safest for important same-field edits?",
        "options": [
          "Blind last-write-wins every time",
          "Ignore both edits",
          "User-visible resolution or a domain-specific merge",
          "Always delete the record"
        ],
        "answer": 2,
        "explain": "LWW is fine for low-value fields, but important same-field edits need product-aware handling: field merge when safe, domain-specific rules, or a user-visible conflict."
      },
      {
        "q": "Why is partial sync important on mobile?",
        "options": [
          "It removes the need for local storage",
          "It disables retries",
          "It guarantees no conflicts ever happen",
          "It avoids pulling the entire account/company history onto a constrained device"
        ],
        "answer": 3,
        "explain": "Phones have limited battery, storage and bandwidth. Partial sync scopes by workspace, folder, time window or subscription so the client only carries the data it needs."
      }
    ]
  },
  "lld-principles": {
    "title": "Clean-code checkpoint",
    "sub": "DRY/KISS/YAGNI, UML, and concurrency.",
    "questions": [
      {
        "q": "DRY (Don't Repeat Yourself) is really about avoiding duplicated…",
        "options": [
          "knowledge — a single authoritative source for each fact",
          "characters",
          "files",
          "variables"
        ],
        "answer": 0,
        "explain": "DRY targets duplicated knowledge, not duplicated text. Two pieces of code that look alike but change for different reasons aren't true duplication — merging them creates harmful coupling."
      },
      {
        "q": "In UML, a filled diamond (composition) means…",
        "options": [
          "A loose 'uses' relationship",
          "Exclusive ownership and shared lifetime — the part dies with the whole",
          "Inheritance",
          "An interface"
        ],
        "answer": 1,
        "explain": "Composition (filled diamond) = the whole owns the part exclusively and they share a lifetime (a House owns its Rooms). Aggregation (hollow diamond) is a looser 'has-a' where the part can outlive the whole."
      },
      {
        "q": "A race condition occurs when…",
        "options": [
          "Two threads run on different CPUs",
          "A lock is always held",
          "Program correctness depends on the unpredictable interleaving of threads",
          "An object is immutable"
        ],
        "answer": 2,
        "explain": "A race condition is a bug whose outcome depends on timing — classically a non-atomic read-modify-write where two threads both read, then one update is lost. A lock around the critical section fixes it."
      },
      {
        "q": "The most practical way to prevent deadlock is to…",
        "options": [
          "Use more locks",
          "Increase thread priority",
          "Never use locks",
          "Always acquire locks in the same global order"
        ],
        "answer": 3,
        "explain": "Consistent lock ordering makes a circular wait impossible, breaking one of deadlock's four necessary conditions. Keeping critical sections small and using tryLock with a timeout also help."
      },
      {
        "q": "YAGNI advises you to…",
        "options": [
          "Write abstractions for every likely future requirement up front",
          "Avoid building features or extension points until a real need for them exists",
          "Never refactor working code",
          "Prefer inheritance over composition"
        ],
        "answer": 1,
        "explain": "You Aren't Gonna Need It: speculative generality costs time and complexity now for a payoff that often never arrives. Keep the design easy to change instead."
      }
    ]
  },
  "lld-practice": {
    "title": "Applied LLD checkpoint",
    "sub": "The LLD process and worked problems.",
    "questions": [
      {
        "q": "The O(1) LRU cache combines which two structures?",
        "options": [
          "Hash map + doubly-linked list",
          "Array + binary tree",
          "Heap + stack",
          "Trie + queue"
        ],
        "answer": 0,
        "explain": "A hash map gives O(1) lookup (key → node); a doubly-linked list ordered by recency gives O(1) move-to-front and O(1) eviction of the least-recently-used tail node."
      },
      {
        "q": "A vending machine is the textbook example of which design pattern?",
        "options": [
          "Singleton",
          "State",
          "Observer",
          "Adapter"
        ],
        "answer": 1,
        "explain": "The machine behaves differently per phase (Idle, HasMoney, Dispensing), so modeling each phase as a State object — each owning its transitions — beats a tangle of if/flag checks."
      },
      {
        "q": "In an elevator system, putting the dispatch policy behind a SchedulingStrategy interface is an example of…",
        "options": [
          "The Singleton pattern",
          "Inheritance abuse",
          "The Strategy pattern (swap the algorithm without touching the cars)",
          "A god object"
        ],
        "answer": 2,
        "explain": "Strategy isolates the changing dispatch policy (nearest-car, least-busy, night mode) behind an interface, so you can swap it without modifying ElevatorCar or ElevatorSystem — Open/Closed in action."
      },
      {
        "q": "What's the FIRST step when given an open-ended LLD prompt?",
        "options": [
          "Start writing classes",
          "Optimize for performance",
          "Pick a database",
          "Clarify requirements, core objects, and key use cases"
        ],
        "answer": 3,
        "explain": "Scope first: nail down the requirements, the core entities and their responsibilities, and the main use cases. Jumping to code on assumptions is the classic mistake."
      },
      {
        "q": "In an offline sync LLD, why should the operation queue be durable instead of just an in-memory list?",
        "options": [
          "So pending edits survive app kills and can be retried safely",
          "So the UI can use more memory",
          "So conflict resolution is unnecessary",
          "So operations can skip server validation"
        ],
        "answer": 0,
        "explain": "Mobile apps are killed and restarted often. Persisting the operation queue means local edits are not lost; stale SENDING operations can be recovered and retried because the server dedupes by operation id."
      },
      {
        "q": "Putting LWW, field-merge and user-resolution behind a ConflictResolver interface is an example of which pattern?",
        "options": [
          "Singleton",
          "Strategy",
          "Adapter",
          "Composite"
        ],
        "answer": 1,
        "explain": "Conflict policies are interchangeable algorithms. A Strategy interface lets the sync engine depend on an abstraction and swap the policy by entity or product rule."
      },
      {
        "q": "Why model a server migration as small MigrationStep objects with checkpoint and verify methods?",
        "options": [
          "To make the migration harder to read",
          "To avoid writing data",
          "To make each phase restartable, testable and independently verifiable",
          "To remove the need for rollback planning"
        ],
        "answer": 2,
        "explain": "Small steps isolate responsibility: expand, backfill, verify, cutover and rollback can each persist progress and be tested. A giant script is hard to pause, resume or reason about after failure."
      }
    ]
  },
  "hld-clocks": {
    "title": "Clocks & ordering checkpoint",
    "sub": "Physical uncertainty, Lamport and vector clocks, HLC, TrueTime and choosing an order.",
    "questions": [
      {
        "q": "Two servers stamp writes with their wall clocks and the store keeps the larger timestamp (last-write-wins). What can go wrong?",
        "options": [
          "A write that happened later in real time can be silently discarded because the other server's clock runs ahead",
          "Nothing, as long as both servers run NTP",
          "Reads become slower but stay correct",
          "The store refuses all writes until clocks agree exactly"
        ],
        "answer": 0,
        "explain": "NTP keeps clocks close, not identical: offsets of milliseconds are normal and much larger skews happen. A server whose clock is ahead wins every conflict, so a genuinely later write from the other server is dropped without any error."
      },
      {
        "q": "Event a has Lamport timestamp 5 and event b has Lamport timestamp 9. What can you conclude?",
        "options": [
          "a happened before b",
          "b happened before a",
          "b did not happen before a; they may be causally ordered or concurrent",
          "a and b are concurrent"
        ],
        "answer": 2,
        "explain": "Lamport clocks guarantee that if a happened before b then L(a) < L(b). The converse does not hold: L(a) < L(b) is also consistent with a and b being concurrent. Detecting concurrency needs vector clocks."
      },
      {
        "q": "Vector clocks V(a) = [2, 0, 1] and V(b) = [1, 3, 1]. How are a and b related?",
        "options": [
          "a happened before b",
          "They are concurrent: neither vector is less than or equal to the other in every position",
          "b happened before a",
          "They are the same event"
        ],
        "answer": 1,
        "explain": "a is ahead in the first position and b is ahead in the second, so neither dominates. Concurrent updates like these are exactly what a store must surface as a conflict or merge, rather than silently overwrite."
      },
      {
        "q": "Why do some distributed databases use hybrid logical clocks instead of pure Lamport clocks?",
        "options": [
          "HLC removes the need for any clock synchronisation",
          "HLC timestamps are always exactly equal to real time",
          "HLC detects all concurrent events like a vector clock",
          "HLC timestamps stay close to physical time, so they are meaningful for snapshot reads and debugging, while still respecting causality with a logical counter"
        ],
        "answer": 3,
        "explain": "A hybrid logical clock carries the largest physical time seen plus a counter for ties. It preserves happens-before like Lamport, stays within the clock-skew bound of wall time, and fits in a fixed-size timestamp, unlike a vector."
      },
      {
        "q": "In a TrueTime-style design, why does a transaction wait before making its commit visible?",
        "options": [
          "To let replication finish copying the data to every region",
          "To wait out the clock uncertainty interval, so no other node can later assign an earlier timestamp to a transaction that started after this one committed",
          "To batch commits for throughput",
          "To give the client time to cancel"
        ],
        "answer": 1,
        "explain": "The clock API returns an interval rather than a single instant. Waiting until the chosen commit timestamp is definitely in the past everywhere makes timestamp order match real-time order. Keeping that uncertainty small, with GPS and atomic clocks, keeps the wait short."
      },
      {
        "q": "A chat product needs replies to never appear before the message they answer, but does not need a global order across conversations. What is the cheapest sufficient guarantee?",
        "options": [
          "Causal ordering, for example a per-conversation sequence from a single owner",
          "A global total order of every message through one consensus log",
          "Wall-clock ordering with NTP",
          "No ordering; clients sort however they like"
        ],
        "answer": 0,
        "explain": "The requirement is about cause and effect inside a conversation. A single writer per conversation gives that order cheaply and lets conversations scale independently, whereas one global consensus log would serialise all traffic for a guarantee nobody needs."
      }
    ]
  }
});
