/* =====================================================================
   BLUEPRINT · Quiz bank
   window.QUIZZES[id] = { title, sub, questions: [{ q, options, answer, explain }] }
   `answer` is the 0-based index of the correct option. Verified by hand.
   ===================================================================== */
window.QUIZZES = {
  "hld-foundations": {
    title: "Foundations checkpoint",
    sub: "Estimation, scaling vocabulary, and how to frame a design.",
    questions: [
      {
        q: "Roughly how long does a round trip within the same data center take, compared to reading 1 MB sequentially from SSD?",
        options: ["Both are about the same (~1 ms)", "DC round trip ~0.5 ms; SSD 1 MB read ~1 ms", "DC round trip ~100 ms; SSD read ~1 µs", "SSD read is always slower than any network call"],
        answer: 1,
        explain: "A same-DC round trip is ~0.5 ms and reading 1 MB sequentially from SSD is ~1 ms. Knowing these 'latency numbers every engineer should know' lets you sanity-check designs instantly."
      },
      {
        q: "You expect 86 million requests evenly spread across a day. What is the approximate average QPS?",
        options: ["~100 QPS", "~1,000 QPS", "~10,000 QPS", "~860,000 QPS"],
        answer: 1,
        explain: "A day has ~86,400 seconds. 86,000,000 / 86,400 ≈ 1,000 QPS. The handy trick: 86,400 ≈ 10⁵, so requests-per-day ÷ 10⁵ ≈ average QPS. Remember to also plan for peak (often 2–5× average)."
      },
      {
        q: "Which is the BEST first question to ask when given an open-ended design prompt?",
        options: ["Which database should we use?", "What are the functional & non-functional requirements and scale?", "Should it be microservices?", "What programming language is required?"],
        answer: 1,
        explain: "Always scope first: clarify functional requirements, non-functional requirements (latency, availability, consistency), and the scale (users, QPS, data size). Technology choices come AFTER you know the constraints."
      },
      {
        q: "'Vertical scaling' means…",
        options: ["Adding more machines to a pool", "Adding more CPU/RAM to a single machine", "Splitting a table across shards", "Adding a CDN"],
        answer: 1,
        explain: "Vertical scaling (scaling up) means a bigger box — more CPU, RAM, disk. It is simple but has a hard ceiling and a single point of failure. Horizontal scaling (scaling out) adds more machines."
      }
    ]
  },

  "hld-caching": {
    title: "Caching checkpoint",
    sub: "Strategies, eviction, and invalidation.",
    questions: [
      {
        q: "In a cache-aside (lazy loading) setup, who is responsible for loading data into the cache on a miss?",
        options: ["The database, automatically", "The application code", "The cache server itself", "The load balancer"],
        answer: 1,
        explain: "With cache-aside, the application checks the cache, and on a miss it reads the DB and then populates the cache. The cache stays 'dumb'. (Read-through delegates that loading to the cache layer instead.)"
      },
      {
        q: "Which eviction policy removes the entry that hasn't been accessed for the longest time?",
        options: ["FIFO", "LRU", "LFU", "Random"],
        answer: 1,
        explain: "LRU = Least Recently Used. It evicts the item whose last access is oldest. LFU evicts the least frequently used; FIFO evicts the oldest inserted regardless of access."
      },
      {
        q: "A write-back (write-behind) cache improves write latency but introduces which risk?",
        options: ["Cache and DB can never be consistent", "Data loss if the cache fails before flushing to the DB", "Reads become impossible", "It cannot be combined with a CDN"],
        answer: 1,
        explain: "Write-back acknowledges the write after updating only the cache, flushing to the DB asynchronously. That's fast, but if the cache node dies before the flush, those writes are lost unless you add durability (e.g., replication / WAL)."
      },
      {
        q: "What problem does a short, randomized TTL ('jitter') primarily mitigate?",
        options: ["Cache penetration", "Cache stampede / thundering herd", "False positives", "Hot partitions"],
        answer: 1,
        explain: "If many keys expire at the same instant, all the misses hit the DB at once (a stampede). Adding random jitter to TTLs spreads expirations out. Stampedes are also mitigated by request coalescing / locks."
      }
    ]
  },

  "hld-databases": {
    title: "Data layer checkpoint",
    sub: "SQL vs NoSQL, replication, sharding, indexing.",
    questions: [
      {
        q: "Sharding a database primarily helps with…",
        options: ["Reducing code complexity", "Distributing data & write load horizontally beyond one machine", "Guaranteeing strong consistency", "Eliminating the need for indexes"],
        answer: 1,
        explain: "Sharding (horizontal partitioning) splits rows across multiple machines so no single node holds all the data or absorbs all the writes. It adds complexity (cross-shard queries, rebalancing) in exchange for scale."
      },
      {
        q: "In leader–follower replication, what is the main consequence of asynchronous replication?",
        options: ["Writes are impossible", "Followers may serve slightly stale reads (replication lag)", "The leader cannot fail over", "Reads must always go to the leader"],
        answer: 1,
        explain: "Async replication lets the leader ack writes without waiting for followers, so followers can lag. Reading from a follower can therefore return stale data — a read-your-writes consistency concern."
      },
      {
        q: "A database index speeds up reads but…",
        options: ["Has zero cost", "Slows down writes and uses extra storage", "Makes the table read-only", "Removes the need for a primary key"],
        answer: 1,
        explain: "Indexes (often B-trees) make lookups fast, but every insert/update/delete must also maintain the index, adding write overhead and storage. Index deliberately, not on every column."
      },
      {
        q: "Which choice of shard key is most likely to create a 'hot shard'?",
        options: ["A high-cardinality hash of user_id", "Monotonically increasing timestamp", "A UUID", "A composite hashed key"],
        answer: 1,
        explain: "A monotonically increasing key (like a timestamp or auto-increment id) routes all new writes to the same shard, creating a hotspot. Hashing or high-cardinality keys spread writes evenly."
      },
      {
        q: "Which workload is a column-oriented OLAP store usually optimized for?",
        options: ["Single-row transactional updates", "Scanning a few columns across many rows for analytics", "Low-latency session lookup by key", "Queueing background jobs"],
        answer: 1,
        explain: "Column stores keep values from the same column together, so analytic scans and aggregations read only the needed columns and compress well. OLTP row stores are better for fetching or updating complete entities."
      },
      {
        q: "Why do LSM-tree storage engines often have excellent write throughput?",
        options: ["They never persist data", "They turn random updates into append-friendly writes and compact later", "They require every query to be a full scan", "They avoid replication entirely"],
        answer: 1,
        explain: "LSM trees write to an in-memory structure and append sorted files, then compact in the background. That favors high write rates, but compaction introduces read, write, and space amplification."
      },
      {
        q: "A search index is primarily built around which structure?",
        options: ["Inverted index mapping terms to documents", "FIFO queue", "Session cookie jar", "DNS cache"],
        answer: 0,
        explain: "Search engines use inverted indexes: term -> matching documents, plus scoring and filters. Vector databases solve semantic nearest-neighbor retrieval; both may be combined in hybrid search."
      }
    ]
  },

  "hld-cap": {
    title: "CAP & consistency checkpoint",
    sub: "Trade-offs under partitions.",
    questions: [
      {
        q: "CAP theorem says that during a network partition, a distributed system must sacrifice…",
        options: ["Performance or cost", "Consistency or Availability", "Durability or Latency", "Reads or Writes"],
        answer: 1,
        explain: "When a partition (P) happens, you must choose: stay Available (answer with possibly-stale data → AP) or stay Consistent (refuse/block to avoid divergence → CP). You cannot have both during the partition."
      },
      {
        q: "DynamoDB and Cassandra are usually described as…",
        options: ["CA systems", "CP systems", "AP systems", "ACID-only systems"],
        answer: 2,
        explain: "They favor Availability and Partition tolerance (AP), offering tunable/eventual consistency. Systems like ZooKeeper, etcd, and HBase lean CP (consistency over availability)."
      },
      {
        q: "'Eventual consistency' means…",
        options: ["Data is never consistent", "If writes stop, all replicas converge to the same value given enough time", "Every read returns the latest write immediately", "Consistency only on the leader"],
        answer: 1,
        explain: "Under eventual consistency, replicas may temporarily disagree, but absent new writes they converge. It trades immediate correctness for availability and low latency."
      },
      {
        q: "PACELC extends CAP by also forcing a choice when there is NO partition. What is that choice?",
        options: ["Cost vs Capacity", "Latency vs Consistency", "Reads vs Writes", "Sync vs Async only"],
        answer: 1,
        explain: "PACELC: if Partition then Availability-vs-Consistency, Else Latency-vs-Consistency. Even on a healthy network, stronger consistency (e.g., quorum reads) costs latency."
      }
    ]
  },

  "hld-messaging": {
    title: "Messaging & APIs checkpoint",
    sub: "Queues, async, and rate limiting.",
    questions: [
      {
        q: "The main benefit of putting a message queue between a producer and consumer is…",
        options: ["It guarantees exactly-once delivery for free", "Decoupling + buffering, so spikes don't overwhelm the consumer", "It removes the need for a database", "It makes the system synchronous"],
        answer: 1,
        explain: "A queue decouples producers from consumers and absorbs bursts (load leveling). Consumers process at their own pace. Exactly-once is notoriously hard — most systems give at-least-once + idempotency."
      },
      {
        q: "Which rate-limiting algorithm naturally ALLOWS short bursts up to a capacity while enforcing an average rate?",
        options: ["Fixed window", "Token bucket", "Sliding log only", "No algorithm allows bursts"],
        answer: 1,
        explain: "Token bucket refills tokens at a steady rate up to a capacity; a client can spend a burst of saved tokens, then is throttled to the refill rate. Leaky bucket, by contrast, enforces a smooth constant output."
      },
      {
        q: "Why is idempotency important for at-least-once delivery?",
        options: ["It makes messages smaller", "Reprocessing a duplicate message must not change the result", "It encrypts the payload", "It guarantees ordering"],
        answer: 1,
        explain: "At-least-once means a message may be delivered more than once. Idempotent handlers (e.g., keyed by a request id) ensure duplicates have no extra effect — charging a card once even if the event arrives twice."
      },
      {
        q: "What problem does the transactional outbox pattern solve?",
        options: ["Encrypting messages at rest", "Atomically committing business data and the intent to publish an event", "Making consumers single-threaded", "Replacing all queues with HTTP"],
        answer: 1,
        explain: "The outbox writes the business change and an outbox event in the same database transaction. A relay publishes the event later, so a crash between commit and publish does not lose the event."
      },
      {
        q: "For strict ordering of events for one customer, what should the partition key usually be?",
        options: ["A random UUID per event", "The customer or entity id whose order must be preserved", "The current timestamp only", "The consumer host name"],
        answer: 1,
        explain: "Kafka-like systems guarantee order within a partition, not across all partitions. Partition by the entity whose updates must stay ordered, then make that consumer path idempotent."
      },
      {
        q: "Which API design helps a client safely retry a payment creation after a timeout?",
        options: ["Offset pagination", "Idempotency-Key header", "A larger JSON payload", "Changing POST to GET"],
        answer: 1,
        explain: "An idempotency key lets the server dedupe repeated unsafe writes and return the original result, avoiding duplicate charges when the client cannot tell whether the first attempt succeeded."
      },
      {
        q: "Why are cursor-based pages usually safer than offset pages for large, changing lists?",
        options: ["They encrypt every item", "They anchor the next page to a stable position instead of a shifting row count", "They require no ordering", "They disable indexes"],
        answer: 1,
        explain: "Offset pagination can skip or duplicate rows when inserts/deletes happen before the offset. A cursor encodes a stable sort position, such as created_at plus id."
      },
      {
        q: "What should a robust batch API return when only some items fail?",
        options: ["HTTP 200 with no details", "Per-item status plus a request/correlation id", "A random retry time only", "A stack trace for the client to parse"],
        answer: 1,
        explain: "Real clients need to know exactly which items succeeded, which failed, whether failures are retryable, and how to cite the request in support or logs."
      }
    ]
  },

  "lld-oop": {
    title: "OOP foundations checkpoint",
    sub: "The four pillars.",
    questions: [
      {
        q: "Hiding internal state and exposing behavior through methods is which pillar?",
        options: ["Inheritance", "Encapsulation", "Polymorphism", "Abstraction"],
        answer: 1,
        explain: "Encapsulation bundles data with the methods that operate on it and restricts direct access to internals, protecting invariants. Abstraction is about exposing only the essential concept; they're related but distinct."
      },
      {
        q: "A `Circle` and a `Square` both implement a `Shape.area()` method and are used interchangeably through the `Shape` type. This is…",
        options: ["Encapsulation", "Polymorphism", "Composition", "Memoization"],
        answer: 1,
        explain: "Polymorphism lets different types respond to the same message (`area()`) in their own way, so calling code depends on the `Shape` abstraction, not the concrete class."
      },
      {
        q: "'Favor composition over inheritance' advises you to…",
        options: ["Never use classes", "Build behavior by combining objects rather than deep inheritance trees", "Always copy-paste code", "Use only static methods"],
        answer: 1,
        explain: "Deep inheritance is rigid and leaks parent details into children. Composing small collaborators is more flexible, easier to test, and avoids the fragile base-class problem."
      }
    ]
  },

  "lld-solid": {
    title: "SOLID checkpoint",
    sub: "The five object-oriented design principles.",
    questions: [
      {
        q: "A class should have only one reason to change. Which principle is this?",
        options: ["Open/Closed", "Single Responsibility", "Liskov Substitution", "Dependency Inversion"],
        answer: 1,
        explain: "Single Responsibility Principle (SRP): a class should do one job, so it has only one reason to change. Mixing, say, persistence and business rules in one class violates it."
      },
      {
        q: "'Software entities should be open for extension but closed for modification' is…",
        options: ["SRP", "OCP", "ISP", "DIP"],
        answer: 1,
        explain: "Open/Closed Principle (OCP): add new behavior by adding new code (e.g., a new strategy/subclass), not by editing existing, tested code. Polymorphism and plugins are the usual tools."
      },
      {
        q: "A subclass that throws 'not supported' for a method it inherited most likely violates…",
        options: ["Liskov Substitution Principle", "Interface Segregation Principle", "DRY", "KISS"],
        answer: 0,
        explain: "LSP says subtypes must be usable anywhere their base type is expected. A `Penguin` subclass of `Bird` that throws on `fly()` breaks substitutability — the hierarchy is wrong."
      },
      {
        q: "Depending on an interface (abstraction) instead of a concrete class is the essence of…",
        options: ["Dependency Inversion Principle", "Single Responsibility", "Open/Closed", "Interface Segregation"],
        answer: 0,
        explain: "Dependency Inversion Principle (DIP): high-level modules and low-level modules should both depend on abstractions. This is what makes code testable and swappable (e.g., inject a `PaymentGateway` interface)."
      }
    ]
  },

  "lld-patterns": {
    title: "Design patterns checkpoint",
    sub: "Recognize the pattern from the intent.",
    questions: [
      {
        q: "You need to choose an algorithm at runtime (e.g., different payment methods) behind a common interface. Which pattern fits best?",
        options: ["Singleton", "Strategy", "Observer", "Adapter"],
        answer: 1,
        explain: "Strategy encapsulates interchangeable algorithms behind a common interface, letting the client pick one at runtime — perfect for payment methods, sorting strategies, compression codecs, etc."
      },
      {
        q: "When one object changes state and many dependents must be notified automatically, use…",
        options: ["Observer", "Builder", "Facade", "Prototype"],
        answer: 0,
        explain: "Observer defines a one-to-many dependency: when the subject changes, all subscribed observers are notified. It underpins event systems, pub/sub, and UI data-binding."
      },
      {
        q: "A class that makes an incompatible third-party interface usable by your code without changing either is a…",
        options: ["Decorator", "Adapter", "Composite", "Mediator"],
        answer: 1,
        explain: "Adapter wraps an existing (often third-party) interface and translates it to the interface your code expects — like a power-plug adapter. Decorator, by contrast, adds behavior to the same interface."
      },
      {
        q: "Which pattern is best for constructing a complex object step-by-step with many optional parameters?",
        options: ["Factory Method", "Builder", "Singleton", "Flyweight"],
        answer: 1,
        explain: "Builder assembles a complex object through a fluent, step-by-step API and avoids telescoping constructors. Factory Method instead decides WHICH class to instantiate; they solve different problems."
      },
      {
        q: "Ensuring a class has exactly one instance with a global access point is the intent of…",
        options: ["Prototype", "Singleton", "Bridge", "Command"],
        answer: 1,
        explain: "Singleton guarantees a single shared instance (e.g., a config or logger). Use sparingly — it's effectively global state and can hurt testability and concurrency if abused."
      }
    ]
  },

  "dsa-foundations": {
    title: "Foundations checkpoint",
    sub: "Arrays, Big-O, and hashing.",
    questions: [
      {
        q: "What makes indexing an array, a[i], an O(1) operation?",
        options: ["The array must be sorted first", "Elements sit in contiguous memory, so the address is base + i × size", "A hash function maps i to a slot", "Binary search locates it"],
        answer: 1,
        explain: "Because slots are contiguous and equal-sized, the address of element i is a single multiply-and-add: base + i × size. No scanning, no hashing — just arithmetic."
      },
      {
        q: "Appending to a dynamic array is 'O(1) amortized'. What does amortized mean here?",
        options: ["Every single append is exactly O(1)", "The average cost over many appends is O(1), even though an occasional resize costs O(n)", "It is O(1) only while the array is empty", "The cost is paid by the garbage collector"],
        answer: 1,
        explain: "Doubling on resize means across n appends you do at most ~2n copies total, so the average append is O(1) — even though the one append that triggers a resize is O(n)."
      },
      {
        q: "What are the average and worst-case lookup times for a hash table?",
        options: ["O(1) average, O(1) worst", "O(log n) average, O(n) worst", "O(1) average, O(n) worst", "O(n) average, O(n) worst"],
        answer: 2,
        explain: "Hashing gives O(1) on average, but if many keys collide into one bucket (a bad hash or adversarial input) it degrades to O(n)."
      },
      {
        q: "Which growth rate is the FASTEST (worst) as n gets large?",
        options: ["O(n log n)", "O(n²)", "O(2ⁿ)", "O(log n)"],
        answer: 2,
        explain: "Exponential O(2ⁿ) explodes far faster than any polynomial. At n = 50 it's already ~10¹⁵ operations — which is why brute-force subset enumeration only works for tiny n."
      }
    ]
  },

  "dsa-linear": {
    title: "Linear structures checkpoint",
    sub: "Linked lists, two pointers, and prefix sums.",
    questions: [
      {
        q: "Accessing the i-th element of a singly linked list takes…",
        options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
        answer: 2,
        explain: "There's no index arithmetic — you must follow i pointers from the head, so random access is O(n). The trade-off is O(1) insert/delete once you hold a node."
      },
      {
        q: "Floyd's fast-and-slow pointer technique is used to…",
        options: ["Sort a linked list", "Detect a cycle in a linked list", "Reverse a list in O(1) space without iterating", "Convert a list into an array"],
        answer: 1,
        explain: "One pointer hops two steps, the other one step. If there's a cycle they eventually meet; if the fast one hits null, there's no cycle. It also finds the middle of a list."
      },
      {
        q: "With a prefix-sum array P where P[0]=0, the sum of the inclusive range [l, r] is…",
        options: ["P[r] − P[l]", "P[r+1] − P[l]", "P[r] − P[l−1]", "P[l] − P[r+1]"],
        answer: 1,
        explain: "P[i] is the sum of the first i elements, so the sum of indices l..r inclusive is P[r+1] − P[l]. One subtraction, O(1) per query after an O(n) build."
      },
      {
        q: "The 'converge from both ends' two-pointer pattern requires the array to be…",
        options: ["Empty", "Sorted (or otherwise monotonic in the quantity you compare)", "A power-of-two length", "Free of duplicates"],
        answer: 1,
        explain: "It only works when moving a pointer changes the compared quantity monotonically — e.g., on a sorted array moving lo right can only raise the sum and hi left can only lower it."
      }
    ]
  },

  "dsa-sorting": {
    title: "Sorting checkpoint",
    sub: "The n log n bound and the linear-time exceptions.",
    questions: [
      {
        q: "Why can't any comparison-based sort beat O(n log n) in the worst case?",
        options: ["Memory is limited", "A decision tree that distinguishes all n! orderings must be about log(n!) ≈ n log n deep", "Swaps are expensive", "Recursion has overhead"],
        answer: 1,
        explain: "There are n! possible orderings; each comparison is one binary decision. A binary tree with n! leaves needs depth ≥ log₂(n!) ≈ n log n, so some input forces that many comparisons."
      },
      {
        q: "Which algorithm is BOTH guaranteed O(n log n) worst-case AND stable?",
        options: ["Quicksort", "Merge sort", "Selection sort", "Heapsort"],
        answer: 1,
        explain: "Merge sort is always O(n log n) and stable (it costs O(n) extra space). Quicksort can hit O(n²) on bad pivots and isn't stable; heapsort is O(n log n) but not stable."
      },
      {
        q: "Counting sort runs in O(n + k). What is k?",
        options: ["The number of elements", "The range of possible key values", "The number of swaps", "The recursion depth"],
        answer: 1,
        explain: "k is the size of the key range (you allocate a count bucket per possible value). Counting sort wins only when k is comparable to n — sorting values up to a billion would need a billion buckets."
      },
      {
        q: "A 'stable' sort is one that…",
        options: ["Never crashes", "Keeps equal elements in their original relative order", "Always uses O(1) memory", "Is always the fastest available"],
        answer: 1,
        explain: "Stability preserves the input order of equal keys, which lets you sort by one field and then another and have the first ordering survive as a tie-breaker."
      }
    ]
  },

  "dsa-trees": {
    title: "Heaps & tries checkpoint",
    sub: "Priority queues, top-k, and prefix trees.",
    questions: [
      {
        q: "In an array-backed binary heap, the children of index i are at indices…",
        options: ["i−1 and i+1", "2i and 2i+1", "2i+1 and 2i+2", "i/2 and i/2 + 1"],
        answer: 2,
        explain: "With 0-based indexing, node i's children are 2i+1 and 2i+2, and its parent is (i−1)/2. That implicit layout is why a heap needs no pointers."
      },
      {
        q: "Extracting the minimum from a binary min-heap of n elements costs…",
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        answer: 1,
        explain: "You read the root in O(1), move the last element to the root, then sift it down — at most the height of the tree, which is O(log n)."
      },
      {
        q: "To find the k largest of n elements efficiently, keep a…",
        options: ["Max-heap of size n", "Min-heap of size k", "Sorted array of size n", "Stack of size k"],
        answer: 1,
        explain: "A size-k min-heap lets you discard the smallest whenever it overflows, giving the k largest in O(n log k) time and O(k) space — better than sorting all n when k ≪ n."
      },
      {
        q: "What can a trie do that a plain hash set cannot?",
        options: ["Store strings", "Answer exact membership in O(L)", "Answer prefix queries like autocomplete", "Use less memory in every case"],
        answer: 2,
        explain: "A hash set answers exact membership in O(L) too, but it can't do prefix queries. In a trie every internal node already represents a prefix, so autocomplete comes for free."
      }
    ]
  },

  "dsa-graphs": {
    title: "Graphs checkpoint",
    sub: "BFS, DFS, topological sort, and SCCs.",
    questions: [
      {
        q: "Which traversal finds the shortest path (in number of edges) on an UNWEIGHTED graph?",
        options: ["DFS", "BFS", "Topological sort", "Binary search"],
        answer: 1,
        explain: "BFS visits vertices in order of distance, so the first time it reaches a vertex is along a shortest path. (For weighted graphs you'd reach for Dijkstra instead.)"
      },
      {
        q: "BFS uses a ___ ; DFS uses a ___.",
        options: ["stack ; queue", "queue ; stack", "heap ; queue", "queue ; heap"],
        answer: 1,
        explain: "BFS uses a FIFO queue to explore level by level; DFS uses a LIFO stack (often the call stack via recursion) to plunge deep before backing up."
      },
      {
        q: "A topological sort exists only when the graph is…",
        options: ["Undirected", "A directed acyclic graph (DAG)", "Fully connected", "Weighted"],
        answer: 1,
        explain: "Topological order requires every edge to point forward, which is impossible if there's a cycle. A back edge to a node still on the recursion stack signals a cycle and no valid ordering."
      },
      {
        q: "A strongly connected component (SCC) is a maximal set of vertices where…",
        options: ["Every vertex has equal degree", "Every vertex can reach every other vertex (in a directed graph)", "There are no edges", "All edges share one weight"],
        answer: 1,
        explain: "Within an SCC every node is reachable from every other. Collapsing each SCC to a point turns any directed graph into a DAG — its condensation."
      },
      {
        q: "Traversing a graph with V vertices and E edges (BFS or DFS) takes…",
        options: ["O(V)", "O(E)", "O(V + E)", "O(V × E)"],
        answer: 2,
        explain: "Each vertex is visited once and each edge is examined once, so both BFS and DFS run in O(V + E) on an adjacency list."
      }
    ]
  },

  "dsa-backtracking": {
    title: "Backtracking checkpoint",
    sub: "Systematic trial, error, and pruning.",
    questions: [
      {
        q: "The core rhythm of backtracking is…",
        options: ["sort, search, return", "choose, explore, un-choose", "divide, conquer, merge", "hash, probe, resize"],
        answer: 1,
        explain: "You make a choice, recurse to explore its consequences, then undo the choice on the way back up so sibling branches start clean."
      },
      {
        q: "What makes backtracking practical despite an exponential search space?",
        options: ["Caching results", "Pruning doomed branches early with a validity check", "Running on a GPU", "Compiling to machine code"],
        answer: 1,
        explain: "A good constraint check (e.g. 'this column/diagonal is already attacked' in N-Queens) cuts off whole subtrees before you waste time exploring them."
      },
      {
        q: "Forgetting to 'un-choose' (undo a change as you return) causes…",
        options: ["A syntax error", "State to leak into sibling branches, producing wrong answers", "Faster execution", "A guaranteed stack overflow"],
        answer: 1,
        explain: "Every change made on the way down must be reverted on the way back up; otherwise partial state from one branch contaminates the others."
      },
      {
        q: "Which problem is a classic fit for backtracking?",
        options: ["Summing an array", "Generating all permutations of a set", "Looking up a hash key", "Reversing a string"],
        answer: 1,
        explain: "Permutations, combinations, subsets, N-Queens, Sudoku and word search all explore a tree of partial solutions — exactly what backtracking with pruning is built for."
      }
    ]
  },

  "pat-arrays": {
    title: "Array & string patterns",
    sub: "Prefix sum, two pointers, sliding window.",
    questions: [
      {
        q: "A problem asks for the number of subarrays that sum to k. Which pattern fits best?",
        options: ["Sliding window alone", "Prefix sum + a hash map of prefix frequencies", "Binary search", "Backtracking"],
        answer: 1,
        explain: "Running prefix sums with a hash map of how often each prefix has occurred counts subarrays summing to k in one O(n) pass. Plain sliding window breaks when the array has negatives."
      },
      {
        q: "The converging two-pointer technique (one at each end) requires the array to be…",
        options: ["Empty", "Sorted, or otherwise monotonic in the compared quantity", "A power-of-two length", "Free of duplicates"],
        answer: 1,
        explain: "It only works when moving a pointer changes the compared value monotonically — e.g., on a sorted array moving lo right can only increase the sum and hi left can only decrease it."
      },
      {
        q: "'Longest substring without repeating characters' is the signature of which pattern?",
        options: ["Prefix sum", "Variable-size sliding window", "Monotonic stack", "Binary search"],
        answer: 1,
        explain: "Grow the window with the right pointer; when a repeat appears, shrink from the left past the duplicate. Each character enters and leaves once → O(n)."
      },
      {
        q: "Sliding window over a contiguous range runs in what time for n elements?",
        options: ["O(n²)", "O(n log n)", "O(n)", "O(log n)"],
        answer: 2,
        explain: "Each element is added once when the right edge passes it and removed at most once when the left edge passes it, so the whole scan is linear."
      }
    ]
  },

  "pat-linkedlist": {
    title: "Linked list patterns",
    sub: "Fast & slow pointers and in-place reversal.",
    questions: [
      {
        q: "Floyd's fast & slow pointers detect a cycle because…",
        options: ["The fast pointer sorts the list", "If a loop exists, the 2-step pointer eventually laps and meets the 1-step pointer", "They count the nodes", "The slow pointer reverses the list"],
        answer: 1,
        explain: "Inside a cycle the fast pointer gains one position per step on the slow one, so it must eventually land on it. If fast reaches null, there's no cycle."
      },
      {
        q: "To find the middle of a linked list in one pass…",
        options: ["Reverse it first", "Advance slow by 1 and fast by 2; slow is at the middle when fast reaches the end", "Use a hash map of indices", "Sort the nodes"],
        answer: 1,
        explain: "When the fast pointer (2×) hits the end, the slow pointer (1×) has covered exactly half the list — the middle. O(n) time, O(1) space."
      },
      {
        q: "In the three-pointer reversal, what must you do BEFORE setting cur.next = prev?",
        options: ["Save cur.next in a temp so you don't lose the rest of the list", "Delete prev", "Sort the list", "Allocate a new list"],
        answer: 0,
        explain: "Overwriting cur.next first would orphan the remaining nodes. Capture nxt = cur.next, then flip the arrow, then advance prev and cur."
      },
      {
        q: "Why add a dummy head node when reversing a sublist [left, right]?",
        options: ["It speeds up the loop", "It removes the special case when the reversal includes the original head", "It saves memory", "It sorts the list"],
        answer: 1,
        explain: "A dummy node before the head means the 'node before the window' always exists, so you don't branch on whether left == 1."
      }
    ]
  },

  "pat-stackheap": {
    title: "Stack & heap patterns",
    sub: "Monotonic stack and Top-K with heaps.",
    questions: [
      {
        q: "To find the next greater element for every item in O(n), keep a stack whose values are…",
        options: ["Increasing", "Decreasing (pop when a bigger value arrives)", "Random", "Sorted ascending then re-sorted"],
        answer: 1,
        explain: "A decreasing stack of indices means each new larger value pops everything smaller — and is their 'next greater element'. Each index is pushed and popped once → O(n)."
      },
      {
        q: "Why is a monotonic stack O(n) despite the inner while-loop?",
        options: ["The loop never runs", "Each element is pushed once and popped at most once across the whole scan", "It uses binary search", "The array is sorted first"],
        answer: 1,
        explain: "Amortized analysis: across the entire scan there are at most n pushes and n pops, so the total work is linear even though one step may pop several items."
      },
      {
        q: "To get the K largest of n elements efficiently, use a…",
        options: ["Max-heap of size n", "Min-heap of size K (pop the smallest when it overflows)", "Sorted array of size n", "Stack of size K"],
        answer: 1,
        explain: "A size-K min-heap keeps the K largest seen so far in O(n log K) time and O(K) space — better than sorting all n when K ≪ n."
      },
      {
        q: "Which problem signals the 'Two Heaps' variant?",
        options: ["Reverse a list", "Find the median of a running data stream", "Detect a cycle", "Merge intervals"],
        answer: 1,
        explain: "A max-heap for the lower half and a min-heap for the upper half, kept balanced, give the running median in O(log n) per insert."
      }
    ]
  },

  "pat-search": {
    title: "Intervals & search patterns",
    sub: "Merge intervals and modified binary search.",
    questions: [
      {
        q: "The first step of almost every overlapping-intervals problem is to…",
        options: ["Sort the intervals by start time", "Reverse the list", "Build a heap of sizes", "Hash the endpoints"],
        answer: 0,
        explain: "Sorting by start lets a single left-to-right sweep decide overlaps: if the next start is ≤ the current end, they overlap and you extend; otherwise start a new interval."
      },
      {
        q: "'Koko eating bananas' and 'ship packages within D days' are solved by…",
        options: ["Sorting", "Binary search on the answer (a monotonic feasibility predicate)", "A monotonic stack", "Backtracking"],
        answer: 1,
        explain: "If you can test 'is speed/capacity X feasible?' and feasibility is monotonic in X, binary-search the smallest feasible X — no sorted array required."
      },
      {
        q: "With inclusive bounds [lo, hi], the binary-search loop condition and update should be…",
        options: ["while lo < hi; hi = mid", "while lo <= hi; move bounds to mid+1 / mid-1", "while lo != hi; lo = mid", "an infinite loop with break"],
        answer: 1,
        explain: "Inclusive bounds pair with lo <= hi and moving a bound strictly past mid (mid+1 / mid-1) so the window always shrinks — preventing infinite loops."
      },
      {
        q: "Searching a rotated sorted array in O(log n) works because…",
        options: ["It must be re-sorted first", "At each step at least one half is still sorted, so you can decide which half to discard", "Rotation removes duplicates", "Binary search can't be used"],
        answer: 1,
        explain: "Comparing mid to the ends tells you which half is sorted; you check whether the target lies in that sorted half and discard the other — still O(log n)."
      }
    ]
  },

  "pat-treesgraphs": {
    title: "Trees & graphs patterns",
    sub: "Traversal, DFS, BFS and matrix flood fill.",
    questions: [
      {
        q: "An inorder traversal of a Binary Search Tree produces…",
        options: ["The nodes in random order", "The values in sorted ascending order", "Only the leaves", "A reversed tree"],
        answer: 1,
        explain: "Inorder visits left subtree, node, right subtree — which for a BST yields the keys in sorted order. It's the shortcut for validation and Kth-smallest."
      },
      {
        q: "Which traversal finds the shortest path (in edges) on an UNWEIGHTED graph or grid?",
        options: ["DFS", "BFS", "Inorder", "Binary search"],
        answer: 1,
        explain: "BFS reaches nodes in order of distance, so the first time it touches a node is via a shortest path. (Weighted graphs need Dijkstra instead.)"
      },
      {
        q: "When exploring a graph with DFS, why is a 'visited' set mandatory (unlike a tree)?",
        options: ["To sort the nodes", "Because graphs can have cycles, so without it you'd loop forever", "To count edges", "It isn't needed"],
        answer: 1,
        explain: "Trees have no cycles, but general graphs do. Marking nodes visited stops DFS from revisiting and looping endlessly."
      },
      {
        q: "'Number of islands' on a grid is solved by…",
        options: ["Sorting the rows", "Treating the grid as a graph and flood-filling each unseen land cell with DFS/BFS", "Binary search", "A monotonic stack"],
        answer: 1,
        explain: "Each cell connects to its 4 neighbours. Scan the grid; each time you hit unseen land, flood-fill its whole island and count +1 — O(rows × cols)."
      }
    ]
  },

  "pat-recursiondp": {
    title: "Recursion & DP patterns",
    sub: "Backtracking, dynamic programming and bit manipulation.",
    questions: [
      {
        q: "The core rhythm of backtracking is…",
        options: ["sort, search, return", "choose, explore, un-choose", "divide, conquer, merge", "hash, probe, resize"],
        answer: 1,
        explain: "Make a choice, recurse to explore it, then undo the choice on the way back up so sibling branches start clean. Forgetting the un-choose is the classic bug."
      },
      {
        q: "Dynamic programming applies when a problem has…",
        options: ["No structure", "Overlapping subproblems AND optimal substructure", "Only one possible answer", "Random inputs"],
        answer: 1,
        explain: "DP shines when the answer is built from smaller versions of the same problem (optimal substructure) and those smaller answers repeat (overlapping subproblems), so you compute each once."
      },
      {
        q: "Which signals usually point to dynamic programming?",
        options: ["'Sort the array'", "'Count the number of ways' or 'min/max cost' over a series of choices", "'Reverse the string'", "'Find the middle node'"],
        answer: 1,
        explain: "Counting ways or optimizing a cost over sequential decisions, where a brute-force recursion recomputes the same states, is the hallmark of DP."
      },
      {
        q: "Why does XOR find the single non-duplicated number in an array where every other value appears twice?",
        options: ["XOR sorts the values", "Because x ^ x = 0 and x ^ 0 = x, so all pairs cancel and only the loner remains", "XOR counts occurrences", "It doesn't — you need a hash map"],
        answer: 1,
        explain: "XOR-ing everything together cancels each duplicated pair to 0, leaving just the unique value — O(n) time and O(1) space."
      }
    ]
  },

  "hld-scaling": {
    title: "Scaling checkpoint",
    sub: "Vertical vs horizontal, statelessness, and load balancing.",
    questions: [
      {
        q: "What is the key requirement that lets a service scale horizontally behind a load balancer?",
        options: ["A faster CPU", "Statelessness — any replica can serve any request", "A single shared in-memory session", "Sticky sessions on every route"],
        answer: 1,
        explain: "If servers keep no per-client state locally, any replica can handle any request, so you can add, remove, or restart nodes freely. State is externalized to a shared cache/DB or carried in a token."
      },
      {
        q: "A load balancer using 'least connections' is best when…",
        options: ["All requests take the same time", "Requests vary widely in duration", "There is only one server", "You need cache affinity"],
        answer: 1,
        explain: "Least-connections routes to the server with the fewest active requests, which balances load well when request durations are uneven. Round-robin is fine when requests are uniform."
      },
      {
        q: "'Power of two choices' load balancing means…",
        options: ["Always pick the first of two servers", "Pick two servers at random and send to the less-loaded one", "Use exactly two servers", "Hash the request into one of two buckets"],
        answer: 1,
        explain: "Sampling two servers at random and choosing the lighter one gives almost the evenness of 'least connections' at almost the cost of 'random' — a favorite at scale."
      },
      {
        q: "Why run load balancers in pairs (active-passive or active-active)?",
        options: ["To double throughput only", "So the load balancer itself isn't a single point of failure", "To support more algorithms", "To avoid health checks"],
        answer: 1,
        explain: "An LB fronting redundant servers is great until the LB dies. Running a pair with a floating IP (plus DNS/anycast above) removes that single point of failure."
      }
    ]
  },

  "hld-networking": {
    title: "Networking & real-time checkpoint",
    sub: "Proxies and server-push techniques.",
    questions: [
      {
        q: "A reverse proxy sits in front of…",
        options: ["Clients, hiding them from servers", "Servers, hiding them from clients", "Only databases", "The DNS resolver"],
        answer: 1,
        explain: "A reverse proxy fronts your servers (load balancing, TLS termination, caching, WAF) so clients see one endpoint. A forward proxy fronts clients to control/anonymize outbound traffic."
      },
      {
        q: "For one-way server→client streaming (a live feed or notifications), the simplest fit is…",
        options: ["Short polling", "Server-Sent Events (SSE)", "WebSockets", "A second database"],
        answer: 1,
        explain: "SSE streams events over a single long-lived HTTP response with auto-reconnect — ideal for server→client only. WebSockets add full-duplex but more complexity; use them for two-way real-time."
      },
      {
        q: "Why are WebSockets harder to scale than stateless HTTP?",
        options: ["They use more bandwidth per message", "Each connection is stateful and pins a client to one server", "They can't be load balanced at all", "They require a relational database"],
        answer: 1,
        explain: "A WebSocket is a persistent, stateful connection tied to a specific server, which complicates load balancing and autoscaling. At scale you add a pub/sub backplane so any server can deliver to any socket."
      }
    ]
  },

  "hld-reliability": {
    title: "Reliability checkpoint",
    sub: "Availability, bloom filters, observability, and idempotency.",
    questions: [
      {
        q: "Three services on the critical path are each 99.9% available (in series). The combined availability is roughly…",
        options: ["99.9%", "99.7%", "99.99%", "100%"],
        answer: 1,
        explain: "Availability multiplies across dependencies in series: 0.999³ ≈ 0.997, i.e. ~99.7%. Fewer things on the critical path and redundancy improve it."
      },
      {
        q: "A bloom filter can tell you…",
        options: ["Exactly which items are present", "'Definitely not in the set' or 'possibly in the set'", "'Definitely in the set' or 'possibly not'", "The count of items"],
        answer: 1,
        explain: "A bloom filter has no false negatives but allows false positives: it answers 'definitely absent' or 'probably present', using a fraction of the memory of a real set — perfect as a pre-filter."
      },
      {
        q: "Which operation is naturally idempotent?",
        options: ["add 100 to balance", "increment the counter", "set balance = 100", "append to a log"],
        answer: 2,
        explain: "'set balance = 100' produces the same result no matter how many times it runs. 'add 100' does not — a retried request would double-charge. Idempotency keys make non-idempotent creates safe."
      },
      {
        q: "Of the four golden signals, which measures how 'full' your resources are?",
        options: ["Latency", "Traffic", "Errors", "Saturation"],
        answer: 3,
        explain: "Saturation captures how close to capacity a resource is (CPU, memory, queue depth). The other three golden signals are latency, traffic (demand), and errors."
      },
      {
        q: "During an incident, what should the team optimize for first?",
        options: ["Writing a perfect root-cause report immediately", "Mitigating user impact and stabilizing the service", "Renaming every dashboard", "Deploying unrelated features"],
        answer: 1,
        explain: "Incident response prioritizes detection, acknowledgement, mitigation, and communication. Root-cause analysis is important, but users must be made safe first."
      },
      {
        q: "A good page-worthy alert should be tied to…",
        options: ["An actionable user-impact symptom and a runbook", "Any CPU change at all", "A metric nobody owns", "Only a log volume spike"],
        answer: 0,
        explain: "Alerts should be actionable, owned, and tied to user impact or an SLO. Noisy, unactionable alerts train responders to ignore the pager."
      }
    ]
  },

  "hld-fault-isolation": {
    title: "Fault isolation checkpoint",
    sub: "Cells, shuffle sharding, circuit breakers, and load shedding.",
    questions: [
      {
        q: "Which description best distinguishes a cell from a shard and a region?",
        options: ["A cell is a whole isolated mini-stack for a tenant/resource cohort; a shard is a data partition; a region is a geographic deployment location", "A cell is just a bigger database shard", "A region is always smaller than a cell", "A shard always contains app servers and queues"],
        answer: 0,
        explain: "A cell is a full serving slice: app tier, queues, caches and data for a bounded tenant/resource cohort. A shard is primarily a data partition. A region is a geographic failure domain that may contain many cells."
      },
      {
        q: "Why are synchronous cross-cell calls on the hot path dangerous?",
        options: ["They make tracing impossible", "They couple cells so one slow or failed cell can break requests in another cell", "They reduce storage cost too much", "They make tenant routing deterministic"],
        answer: 1,
        explain: "Cells exist to contain blast radius. If cell A must synchronously call cell B to serve a user request, B's latency or outage now affects A, undoing much of the isolation."
      },
      {
        q: "Shuffle sharding is most useful for…",
        options: ["Guaranteeing strong consistency across regions", "Assigning each tenant a small deterministic subset of workers/resources so noisy neighbors overlap less", "Replacing tenant authorization checks", "Making every tenant share every queue equally"],
        answer: 1,
        explain: "Shuffle sharding maps each tenant to a small subset of resources. Two tenants may share a member, but are unlikely to share the exact same subset, limiting noisy-neighbor blast radius."
      },
      {
        q: "Load shedding differs from circuit breaking because load shedding…",
        options: ["Drops or defers low-priority work when your own system is overloaded", "Only happens after a dependency returns many errors", "Always retries requests faster", "Is the same as autoscaling"],
        answer: 0,
        explain: "A circuit breaker protects callers from repeatedly calling a failing dependency. Load shedding protects the local system under saturation by rejecting or deferring low-value work before queues collapse."
      },
      {
        q: "In a pooled multi-tenant SaaS database, what must every tenant-scoped query include?",
        options: ["A random sleep", "A tenant/resource predicate or enforced policy boundary", "A cross-cell join", "A debug flag"],
        answer: 1,
        explain: "Pooled tenancy shares infrastructure, so tenant isolation depends on every DB query, cache key, queue message, search filter, and admin tool carrying the tenant boundary."
      },
      {
        q: "What is the main purpose of tenant-aware deploy waves?",
        options: ["To deploy alphabetically", "To limit blast radius by rolling changes through tenant cohorts while watching metrics", "To skip observability", "To force every tenant into one cell"],
        answer: 1,
        explain: "Deploy waves let teams start with low-risk tenants, pause on bad signals, and protect high-value or regulated tenants until the change has proven safe."
      }
    ]
  },

  "hld-architecture": {
    title: "Architecture checkpoint",
    sub: "Monolith vs microservices and distributed transactions.",
    questions: [
      {
        q: "Per Conway's Law, microservices pay off mainly when…",
        options: ["You have one small team", "You have many teams that need to ship independently", "You want fewer moving parts", "You need strong multi-row transactions"],
        answer: 1,
        explain: "Systems mirror the org that builds them. Microservices' independent deploy/scale shines with many autonomous teams; a single small team is usually faster and cheaper with a modular monolith."
      },
      {
        q: "Once each microservice owns its own database, a single ACID transaction across services is…",
        options: ["Still trivial", "Impossible — there's no shared transaction to roll back", "Handled automatically by the gateway", "Replaced by a bigger lock"],
        answer: 1,
        explain: "Separate databases mean no global transaction. You coordinate with a Saga (local transactions + compensations) or, rarely, two-phase commit — each with real trade-offs."
      },
      {
        q: "A Saga handles a failed step by…",
        options: ["Locking all services until it succeeds", "Running compensating transactions to undo prior steps", "Ignoring the failure", "Rolling back a global 2PC commit"],
        answer: 1,
        explain: "A Saga is a sequence of local transactions; if one fails, it runs compensating ('undo') transactions for the completed steps — eventually consistent but available, unlike blocking 2PC."
      }
    ]
  },

  "hld-production-readiness": {
    title: "Production readiness checkpoint",
    sub: "Capacity, cost, launch gates, and design-doc practice.",
    questions: [
      {
        q: "A service expects 40M actions per day with a 5x peak multiplier. What is the best first capacity estimate?",
        options: ["About 463 average QPS and about 2,315 peak QPS", "Exactly 40M QPS", "About 5 QPS peak", "No QPS estimate is possible from daily actions"],
        answer: 0,
        explain: "Average QPS is daily actions / 86,400: 40M / 86,400 ~= 463. Peak is then average x the peak multiplier, so 463 x 5 ~= 2,315 QPS."
      },
      {
        q: "What does N+1 capacity mean in a launch plan?",
        options: ["The system needs one database only", "The system can handle expected peak even after one planned capacity unit is unavailable", "You add exactly one user to the load test", "You deploy one version after another"],
        answer: 1,
        explain: "N is the capacity needed for expected peak. N+1 adds enough headroom to survive one instance, node, or equivalent capacity unit being unavailable."
      },
      {
        q: "Which cost bucket is most directly affected by sending large responses across a cloud/provider boundary?",
        options: ["Egress", "Primary-key choice", "Object TTL only", "Password hashing"],
        answer: 0,
        explain: "Egress is data leaving a cloud or provider boundary. Large cross-boundary responses can be expensive and also add latency."
      },
      {
        q: "Which signal best proves a canary is safe to continue?",
        options: ["The deploy command succeeded", "Canary traffic holds SLOs, error rate, saturation, and business success rate within guardrails versus control", "CPU is zero", "The new version has more features"],
        answer: 1,
        explain: "A canary is guarded by user-impacting signals: latency/SLOs, errors, saturation, and business counters compared to control. Successful deployment alone says nothing about production behavior."
      },
      {
        q: "A good ADR primarily records...",
        options: ["Only the final diagram", "The decision, context, alternatives, consequences, and trade-offs", "Every log line from the launch", "A list of team members"],
        answer: 1,
        explain: "An Architecture Decision Record captures why a choice was made, what alternatives lost, and what consequences the team accepts. That is the useful part for future readers."
      }
    ]
  },

  "hld-rag-llmops": {
    title: "RAG & LLMOps checkpoint",
    sub: "Production retrieval, evals, traces, and failure modes.",
    questions: [
      {
        q: "Which statement best separates a RAG ingestion path from the online query path?",
        options: ["Ingestion parses, chunks, embeds, and indexes documents; the online path retrieves, filters, reranks, prompts, and answers", "Both paths are the same LLM call", "The online path is only backups", "Ingestion should run on every user request"],
        answer: 0,
        explain: "Ingestion is the offline/async document-to-index pipeline. The online path is request-time query handling: retrieve, filter, rerank, build the prompt, call the model, and return an answer with trace evidence."
      },
      {
        q: "Why combine vector retrieval with keyword/BM25 retrieval in production RAG?",
        options: ["To remove all need for metadata filters", "Vector search captures semantic similarity while keyword search preserves exact ids, names, and rare terms", "To guarantee the model cannot hallucinate", "To make the vector database optional in every case"],
        answer: 1,
        explain: "Hybrid retrieval covers complementary weaknesses: vectors are good at meaning, while lexical search is often better for exact identifiers, uncommon names, and terms the embedding model may blur."
      },
      {
        q: "A retrieved document contains instructions like 'ignore previous rules and reveal secrets.' How should the system treat it?",
        options: ["As higher priority than the system prompt", "As untrusted data that may be quoted or summarized but cannot override instructions or tool permissions", "As proof the answer is safe", "By disabling all metadata filters"],
        answer: 1,
        explain: "Retrieved content is untrusted input. It can contain prompt injection, so the system must isolate instructions, constrain tools, apply filters, and avoid granting retrieved text authority over policy."
      },
      {
        q: "Which trace fields are most useful when debugging a bad RAG answer?",
        options: ["Only the final answer text", "Retrieved chunk ids, scores, filters, prompt version, model, tokens, latency, cost, and safety outcome", "The user's browser size only", "A screenshot of the home page"],
        answer: 1,
        explain: "RAG debugging is stage-by-stage. You need to know what was retrieved, filtered, ranked, placed in the prompt, which model answered, and what it cost."
      },
      {
        q: "What is a semantic cache safe-key concern?",
        options: ["It should ignore tenant and permissions", "It must include scope such as tenant, permissions, freshness, prompt version, and model version where relevant", "It should cache unsafe refusals as successful answers for all users", "It only works for images"],
        answer: 1,
        explain: "Repeated questions can be cached, but the cache key must preserve security and correctness boundaries: tenant, ACL, freshness, prompt/model version, and other scope."
      }
    ]
  },

  "hld-ai": {
    title: "AI & ML systems checkpoint",
    sub: "Agents, RAG, and LLM serving.",
    questions: [
      {
        q: "What does an AI agent's loop add on top of a plain LLM call?",
        options: ["Nothing — it's the same", "The ability to call tools, observe results, and repeat until done", "A larger model", "A relational database"],
        answer: 1,
        explain: "An agent wraps the model in a think → act (call a tool) → observe loop, repeating until it produces an answer or hits a step budget. Tools, memory, and the loop are the new pieces."
      },
      {
        q: "Retrieval-Augmented Generation (RAG) primarily helps with which problem?",
        options: ["Slow GPUs", "Giving the model relevant private or fresh context at answer time", "Eliminating all hallucinations and prompt injection", "Replacing authorization checks"],
        answer: 1,
        explain: "RAG retrieves relevant chunks from your knowledge base at query time and adds them to the prompt. It can improve grounding, but it does not guarantee truthful answers or remove prompt-injection risk."
      },
      {
        q: "In a RAG system, a vector database is used to…",
        options: ["Store SQL rows", "Find the nearest chunks to a query via embedding similarity", "Cache HTML pages", "Run the LLM"],
        answer: 1,
        explain: "It stores each chunk as an embedding (a vector) and uses approximate nearest-neighbor search to retrieve the most semantically similar chunks for a query — the retrieval engine RAG runs on."
      },
      {
        q: "Why must an LLM feature ship with an eval harness?",
        options: ["To make it faster", "Because you can't reliably improve what you can't measure", "To reduce token count", "It's not needed"],
        answer: 1,
        explain: "Prompts behave like code: a dataset of inputs with graded outputs plus automated scoring lets you catch regressions when you change a prompt, model, or retrieval step."
      },
      {
        q: "In a search/ranking pipeline, what is the usual role of candidate retrieval?",
        options: ["Return every document to the user", "Find a broad, cheap set of plausible items before expensive ranking", "Bypass authorization filters", "Store session cookies"],
        answer: 1,
        explain: "Search and recommendation systems first retrieve candidates cheaply, then apply richer ranking and filtering. This keeps latency manageable while giving the ranker enough options."
      },
      {
        q: "Which RAG control prevents one tenant's document from entering another tenant's prompt?",
        options: ["A larger top-k", "Tenant and ACL metadata filters before prompt construction", "Higher temperature", "Longer context windows only"],
        answer: 1,
        explain: "RAG documents are protected resources. Tenant and ACL filters must run before ranking/prompt construction so the model never sees unauthorized context."
      }
    ]
  },

  "hld-protocols": {
    title: "Protocols & delivery checkpoint",
    sub: "DNS, HTTPS/auth, containers, and coordination.",
    questions: [
      {
        q: "Why is the FIRST DNS lookup for a domain slow but later ones instant?",
        options: ["The server is warming up", "Results are cached (OS, resolver, along the way) with a TTL", "TLS has to renegotiate", "The domain is rate-limited"],
        answer: 1,
        explain: "DNS is a heavily-cached hierarchy. The first lookup walks root → TLD → authoritative; the answer is then cached with a TTL, so repeats are instant — which is also why changes take time to propagate."
      },
      {
        q: "A JWT (stateless token) scales well but has which drawback vs server sessions?",
        options: ["It can't carry claims", "It's hard to revoke before it expires", "It requires a shared session store", "It only works over HTTP"],
        answer: 1,
        explain: "Any node can verify a signed JWT without shared state, but you can't easily revoke one before expiry — so keep them short-lived and pair with refresh tokens. Server sessions revoke instantly but need a shared store."
      },
      {
        q: "Passwords should be stored using…",
        options: ["Plaintext", "A fast hash like MD5", "A slow, salted hash (bcrypt/scrypt/Argon2)", "Base64 encoding"],
        answer: 2,
        explain: "A slow, salted password hash defeats rainbow tables (salt) and brute force (slowness), so a database leak doesn't immediately expose everyone's credentials."
      },
      {
        q: "A canary deployment reduces risk by…",
        options: ["Deploying to everyone at once", "Sending a small % of traffic to the new version first while watching metrics", "Skipping health checks", "Rolling back automatically every time"],
        answer: 1,
        explain: "A canary shifts 1% → 10% → 100% of traffic to the new version, monitoring error rate and latency at each step so you can abort before a bad release reaches everyone."
      },
      {
        q: "What is the difference between authentication and authorization?",
        options: ["They are the same", "Authentication proves who you are; authorization decides what resource/action you may access", "Authorization stores passwords", "Authentication only applies to databases"],
        answer: 1,
        explain: "Authn establishes identity. Authz is a fresh decision about whether that identity may perform an action on a resource, usually scoped by tenant, ownership, role, or policy."
      },
      {
        q: "Why is JWT parsing alone insufficient for protecting an invoice endpoint?",
        options: ["JWTs cannot be signed", "The token may identify the user, but the service still must check access to that specific invoice/resource", "JWTs only work with GraphQL", "It prevents TLS from working"],
        answer: 1,
        explain: "A JWT can carry identity and broad claims, but resource-scoped authorization still has to verify tenant, ownership, role, and action for the invoice being requested."
      },
      {
        q: "Which RAG-specific threat should be modeled in an HLD?",
        options: ["Cross-tenant retrieval and prompt injection from indexed documents", "Only CPU cache misses", "DNS TTL selection only", "Whether the UI uses dark mode"],
        answer: 0,
        explain: "RAG expands the attack surface: malicious documents can inject instructions, stale or unauthorized chunks can be retrieved, and cross-tenant filters can fail unless designed and tested explicitly."
      }
    ]
  },

  "hld-data-migrations": {
    title: "Zero-downtime migrations checkpoint",
    sub: "Expand-contract, backfills, verification, cutover and rollback.",
    questions: [
      {
        q: "In an expand-contract migration, what should happen FIRST?",
        options: ["Drop the old column so nobody can use it", "Add the new schema/path while keeping the old one working", "Run one giant UPDATE in peak traffic", "Cut reads to the new table before it exists"],
        answer: 1,
        explain: "Expand first: add the new nullable column/table/index/path and ship code that can tolerate both shapes. Contracting the old shape comes last, after backfill, verification, cutover and the rollback window."
      },
      {
        q: "What makes a production backfill safe to pause, crash and resume?",
        options: ["A restartable checkpoint plus idempotent batches", "A single transaction around every row in the database", "Running only from an engineer's laptop", "Skipping verification until the end"],
        answer: 0,
        explain: "Persisting checkpoints and making each batch idempotent means a crashed worker can repeat the last chunk safely. Throttling and verification keep the migration from hurting production or silently drifting."
      },
      {
        q: "What is a shadow read?",
        options: ["A read served only from a cache", "Reading the new path in parallel, comparing it, but returning the old result to the user", "A read that bypasses authorization", "A replica read during failover only"],
        answer: 1,
        explain: "Shadow reads let you test the new read path under real traffic without affecting users. The old response is still served, while mismatches between old and new are measured."
      },
      {
        q: "Why keep dual-write enabled briefly after cutting reads to the new store?",
        options: ["To make writes twice as expensive forever", "To preserve a rollback path while confidence builds", "Because the old store is always more correct", "To avoid needing CDC validation"],
        answer: 1,
        explain: "Keeping the old path warm gives you a rollback lever: flip reads back if the new path misbehaves. Once the rollback window closes and validation is clean, you can contract the old path."
      },
      {
        q: "For tenant/cell migration, what must change atomically at cutover?",
        options: ["The routing control-plane mapping for tenant -> cell", "Every user's password", "The database engine", "The client app theme"],
        answer: 0,
        explain: "After copy, replay and verification, cutover is the routing decision that sends that tenant to the target cell. The mapping must change atomically and be auditable."
      }
    ]
  },

  "hld-offline-sync": {
    title: "Offline-first sync checkpoint",
    sub: "Local source of truth, operation queues, delta sync and conflicts.",
    questions: [
      {
        q: "In an offline-first mobile app, what should the UI read from first?",
        options: ["A remote API on every render", "The local database/materialized view", "A random cache entry", "Only push notifications"],
        answer: 1,
        explain: "The local DB is the UI source of truth. User edits update it immediately and append a durable operation; network sync catches the shared server state up later."
      },
      {
        q: "Why does each queued sync operation need a stable operation_id?",
        options: ["To make the payload larger", "So the server can dedupe retries safely", "So clients can skip authorization", "To sort notes alphabetically"],
        answer: 1,
        explain: "Flaky mobile networks cause duplicate sends. A stable operation_id lets the server apply a mutation once and return the prior acknowledgement for retries."
      },
      {
        q: "What problem do tombstones solve in offline sync?",
        options: ["They speed up image rendering", "They tell other devices about deletes so old copies are not resurrected", "They encrypt local records", "They replace conflict resolution entirely"],
        answer: 1,
        explain: "Without tombstones, a device that missed a delete may later sync its old copy back and resurrect the record. Tombstones carry delete information until every relevant checkpoint has advanced."
      },
      {
        q: "Which conflict policy is safest for important same-field edits?",
        options: ["Blind last-write-wins every time", "User-visible resolution or a domain-specific merge", "Ignore both edits", "Always delete the record"],
        answer: 1,
        explain: "LWW is fine for low-value fields, but important same-field edits need product-aware handling: field merge when safe, domain-specific rules, or a user-visible conflict."
      },
      {
        q: "Why is partial sync important on mobile?",
        options: ["It avoids pulling the entire account/company history onto a constrained device", "It disables retries", "It guarantees no conflicts ever happen", "It removes the need for local storage"],
        answer: 0,
        explain: "Phones have limited battery, storage and bandwidth. Partial sync scopes by workspace, folder, time window or subscription so the client only carries the data it needs."
      }
    ]
  },

  "lld-principles": {
    title: "Clean-code checkpoint",
    sub: "DRY/KISS/YAGNI, UML, and concurrency.",
    questions: [
      {
        q: "DRY (Don't Repeat Yourself) is really about avoiding duplicated…",
        options: ["characters", "knowledge — a single authoritative source for each fact", "files", "variables"],
        answer: 1,
        explain: "DRY targets duplicated knowledge, not duplicated text. Two pieces of code that look alike but change for different reasons aren't true duplication — merging them creates harmful coupling."
      },
      {
        q: "In UML, a filled diamond (composition) means…",
        options: ["A loose 'uses' relationship", "Exclusive ownership and shared lifetime — the part dies with the whole", "Inheritance", "An interface"],
        answer: 1,
        explain: "Composition (filled diamond) = the whole owns the part exclusively and they share a lifetime (a House owns its Rooms). Aggregation (hollow diamond) is a looser 'has-a' where the part can outlive the whole."
      },
      {
        q: "A race condition occurs when…",
        options: ["Two threads run on different CPUs", "Program correctness depends on the unpredictable interleaving of threads", "A lock is always held", "An object is immutable"],
        answer: 1,
        explain: "A race condition is a bug whose outcome depends on timing — classically a non-atomic read-modify-write where two threads both read, then one update is lost. A lock around the critical section fixes it."
      },
      {
        q: "The most practical way to prevent deadlock is to…",
        options: ["Use more locks", "Always acquire locks in the same global order", "Never use locks", "Increase thread priority"],
        answer: 1,
        explain: "Consistent lock ordering makes a circular wait impossible, breaking one of deadlock's four necessary conditions. Keeping critical sections small and using tryLock with a timeout also help."
      }
    ]
  },

  "lld-practice": {
    title: "Applied LLD checkpoint",
    sub: "The LLD process and worked problems.",
    questions: [
      {
        q: "The O(1) LRU cache combines which two structures?",
        options: ["Array + binary tree", "Hash map + doubly-linked list", "Heap + stack", "Trie + queue"],
        answer: 1,
        explain: "A hash map gives O(1) lookup (key → node); a doubly-linked list ordered by recency gives O(1) move-to-front and O(1) eviction of the least-recently-used tail node."
      },
      {
        q: "A vending machine is the textbook example of which design pattern?",
        options: ["Singleton", "State", "Observer", "Adapter"],
        answer: 1,
        explain: "The machine behaves differently per phase (Idle, HasMoney, Dispensing), so modeling each phase as a State object — each owning its transitions — beats a tangle of if/flag checks."
      },
      {
        q: "In an elevator system, putting the dispatch policy behind a SchedulingStrategy interface is an example of…",
        options: ["The Singleton pattern", "The Strategy pattern (swap the algorithm without touching the cars)", "Inheritance abuse", "A god object"],
        answer: 1,
        explain: "Strategy isolates the changing dispatch policy (nearest-car, least-busy, night mode) behind an interface, so you can swap it without modifying ElevatorCar or ElevatorSystem — Open/Closed in action."
      },
      {
        q: "What's the FIRST step when given an open-ended LLD prompt?",
        options: ["Start writing classes", "Clarify requirements, core objects, and key use cases", "Pick a database", "Optimize for performance"],
        answer: 1,
        explain: "Scope first: nail down the requirements, the core entities and their responsibilities, and the main use cases. Jumping to code on assumptions is the classic mistake."
      },
      {
        q: "In an offline sync LLD, why should the operation queue be durable instead of just an in-memory list?",
        options: ["So the UI can use more memory", "So pending edits survive app kills and can be retried safely", "So conflict resolution is unnecessary", "So operations can skip server validation"],
        answer: 1,
        explain: "Mobile apps are killed and restarted often. Persisting the operation queue means local edits are not lost; stale SENDING operations can be recovered and retried because the server dedupes by operation id."
      },
      {
        q: "Putting LWW, field-merge and user-resolution behind a ConflictResolver interface is an example of which pattern?",
        options: ["Strategy", "Singleton", "Adapter", "Composite"],
        answer: 0,
        explain: "Conflict policies are interchangeable algorithms. A Strategy interface lets the sync engine depend on an abstraction and swap the policy by entity or product rule."
      },
      {
        q: "Why model a server migration as small MigrationStep objects with checkpoint and verify methods?",
        options: ["To make the migration harder to read", "To make each phase restartable, testable and independently verifiable", "To avoid writing data", "To remove the need for rollback planning"],
        answer: 1,
        explain: "Small steps isolate responsibility: expand, backfill, verify, cutover and rollback can each persist progress and be tested. A giant script is hard to pause, resume or reason about after failure."
      }
    ]
  },

  "dsa-interview": {
    title: "Interview craft checkpoint",
    sub: "Working a coding problem out loud, the right way.",
    questions: [
      {
        q: "In the 7-step framework, what should you do FIRST when handed a problem?",
        options: ["Write the optimal solution", "Clarify the problem — restate it and ask about input ranges and edge cases", "State the time complexity", "Pick a data structure"],
        answer: 1,
        explain: "Clarify before you code. Restating the problem and pinning down input ranges, duplicates, and edge cases prevents you from confidently solving the wrong problem."
      },
      {
        q: "Why state a brute-force approach before optimizing?",
        options: ["It's usually the final answer", "It gives a correct baseline and its complexity to anchor the optimization", "To run out the clock", "Interviewers require it by rule"],
        answer: 1,
        explain: "A brute force puts a correct baseline and its Big-O on the table, shows structured thinking, and gives you something concrete to improve — you optimize by naming and attacking its bottleneck."
      },
      {
        q: "What is the interviewer primarily evaluating?",
        options: ["Whether you instantly recall the trick", "How you think and communicate a structured approach", "Your typing speed", "How many problems you've memorized"],
        answer: 1,
        explain: "They're hiring a problem-solver, not a lookup table. A clearly-communicated structured approach — even on a problem you don't fully crack — beats a silent correct answer."
      },
      {
        q: "Just before you start writing code, you should…",
        options: ["Stay silent and code as fast as possible", "Walk the plan out loud and get the interviewer's buy-in", "Delete your hand-worked example", "Skip the edge cases to save time"],
        answer: 1,
        explain: "It's far cheaper to fix a plan than a screen of code. Narrate the approach, get a nod, then implement — and reuse the example you worked by hand as a test case."
      }
    ]
  },

  "pat-mastery": {
    title: "Pattern mastery checkpoint",
    sub: "Reading a problem and naming its pattern, fast.",
    questions: [
      {
        q: "'Longest substring with at most K distinct characters' is the signature of which pattern?",
        options: ["Binary Search", "Sliding Window", "Backtracking", "Union-Find"],
        answer: 1,
        explain: "A contiguous substring/subarray with a 'longest / shortest / at most K' constraint is the canonical Sliding Window trigger — grow and shrink a window instead of re-scanning."
      },
      {
        q: "You need the fewest steps / shortest path on an UNWEIGHTED graph or grid. Reach for…",
        options: ["DFS", "BFS", "Dynamic Programming", "Two Pointers"],
        answer: 1,
        explain: "BFS explores level by level, so the first time it reaches a node it has used the fewest edges — the shortest path on an unweighted graph. DFS gives no such guarantee."
      },
      {
        q: "'Find the K largest / most frequent / closest' elements points to which tool?",
        options: ["A heap (Top-K)", "A monotonic stack", "A prefix-sum array", "A trie"],
        answer: 0,
        explain: "A size-K heap keeps the running best K in O(n log K) without sorting everything — the standard Top-K pattern for 'K largest / smallest / most frequent / closest'."
      },
      {
        q: "What's the winning study formula this track argues for?",
        options: ["Grind 500+ random problems", "Right patterns → right order → right focus, quality over quantity", "Memorize solutions verbatim", "Only practice hard problems"],
        answer: 1,
        explain: "You don't need 500+ problems — you need the right patterns in the right order, 5–10 high-signal problems each, and the recognition reflex. Ten you can re-derive beat a hundred you memorized."
      }
    ]
  }
};
