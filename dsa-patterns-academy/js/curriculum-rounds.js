/* CODEX · SQL coding rounds + concurrency coding problems */
(function () {
  "use strict";
  window.TRACKS = window.TRACKS || {};
  window.QUIZZES = window.QUIZZES || {};

  const p = (html) => ({ t: "p", html });
  const h = (text) => ({ t: "h", text });
  const cue = (html) => ({ t: "cue", html });
  const code = (lang, source) => ({ t: "code", lang, code: source });
  const note = (variant, html) => ({ t: "note", variant, html });
  const quiz = (id) => ({ t: "quiz", id });
  const lesson = (id, title, summary, minutes, tags, blocks) => ({ id, title, summary, minutes, tags, blocks });
  const module = (id, name, icon, lessons) => ({ id, name, icon, lessons });

  window.TRACKS.sql = {
    id: "sql",
    name: "SQL Coding Rounds",
    short: "SQL",
    tagline: "Reason in rows, sets, and time",
    color: "#2dd4bf",
    blurb: "Production-shaped SQL interview practice: joins, windows, temporal logic, retention, dimensional modeling, recursive queries, debugging, query plans, and data-engineering cases. Every lesson starts from grain and correctness before syntax.",
    modules: [
      module("relational", "Relational Core", "blocks", [
        lesson("joins-anti", "Joins, semi-joins & anti-joins", "Control row multiplication, test existence safely, and explain why NOT EXISTS beats a nullable NOT IN.", 10, ["sql", "joins", "anti-join"], [
          p("A join is not merely a lookup: it combines two relations at a declared <strong>grain</strong>. Before writing SQL, say what one output row represents and whether either key can repeat. A one-to-many join deliberately multiplies rows; an accidental many-to-many join silently inflates every downstream metric."),
          cue("<b>Round signal:</b> “customers with no orders” is an anti-join; “customers with at least one order” is a semi-join. Use <code>EXISTS</code>/<code>NOT EXISTS</code> when you only need existence, not columns from the matching side."),
          code("sql", "-- Customers with no paid order: NULL-safe anti-join\nSELECT c.customer_id\nFROM customers c\nWHERE NOT EXISTS (\n  SELECT 1 FROM orders o\n  WHERE o.customer_id = c.customer_id\n    AND o.status = 'paid'\n);\n\n-- Diagnose multiplication before aggregating\nSELECT customer_id, COUNT(*) AS joined_rows\nFROM customers c JOIN orders o USING (customer_id)\nGROUP BY customer_id HAVING COUNT(*) > 1;"),
          note("trap", "<code>NOT IN (subquery)</code> can return no rows when the subquery contains one NULL: comparisons become UNKNOWN. <code>NOT EXISTS</code> states the intent and has predictable three-valued semantics."),
          note("key", "<strong>State both input grains and the output grain.</strong> If the relationship is many-to-many, pre-aggregate one side or accept multiplication explicitly; never hide it with <code>DISTINCT</code>.")
        ]),
        lesson("aggregation", "Aggregation, HAVING & conditional metrics", "Build reliable metrics at one grain and distinguish filtering rows from filtering groups.", 9, ["sql", "group-by", "aggregation"], [
          p("<code>WHERE</code> removes input rows before grouping; <code>HAVING</code> removes completed groups. Conditional aggregation computes several metrics in one pass, but every expression must preserve the intended denominator."),
          cue("<b>Round signal:</b> one row per customer/day/category plus several counts or rates. Write the desired output columns and grain first, then choose grouping keys."),
          code("sql", "SELECT account_id,\n       COUNT(*) AS events,\n       SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS successes,\n       AVG(CASE WHEN outcome = 'success' THEN 1.0 ELSE 0.0 END) AS success_rate,\n       COUNT(DISTINCT user_id) AS active_users\nFROM events\nWHERE event_ts >= :start_ts AND event_ts < :end_ts\nGROUP BY account_id\nHAVING COUNT(*) >= 100;"),
          note("trap", "<code>COUNT(column)</code> skips NULL while <code>COUNT(*)</code> counts rows. <code>AVG(CASE WHEN ... THEN 1 END)</code> averages only matching rows; add <code>ELSE 0</code> when the denominator should include all rows."),
          note("key", "<strong>Aggregation is a grain change.</strong> Name the new grain, guard integer division, and test totals before and after joins.")
        ]),
        lesson("null-temporal", "NULL and temporal semantics", "Handle UNKNOWN, half-open intervals, time zones, and as-of predicates without boundary bugs.", 11, ["sql", "null", "time"], [
          p("SQL uses three-valued logic: comparisons with NULL produce UNKNOWN, and filters keep only TRUE. Time adds another semantic layer: timestamps need a zone policy, and date ranges need an endpoint convention."),
          cue("<b>Round signal:</b> “active during”, “as of”, “latest before”, or missing values. Clarify whether NULL means unknown, absent, not applicable, or open-ended."),
          code("sql", "-- Half-open interval: composable and no double-counted midnight\nWHERE event_ts >= :day_start\n  AND event_ts <  :next_day_start\n\n-- Rows whose validity overlaps a requested interval\nWHERE valid_from < :query_end\n  AND COALESCE(valid_to, TIMESTAMP '9999-12-31 00:00:00') >= :query_start\n\n-- NULL-safe equality varies by engine\nWHERE a IS NOT DISTINCT FROM b;"),
          note("trap", "<code>BETWEEN</code> includes both endpoints. Adjacent windows can double-count their shared boundary. Store instants in UTC, convert for presentation, and define how daylight-saving gaps/folds are handled."),
          note("key", "<strong>Use half-open time ranges [start, end).</strong> They compose cleanly, make partition pruning easier, and eliminate boundary overlap.")
        ]),
        lesson("dedupe", "Deterministic deduplication", "Choose one survivor per business key with explicit precedence and stable tie-breakers.", 9, ["sql", "dedupe", "row-number"], [
          p("Deduplication is not “add DISTINCT.” It is a business decision about which record survives. Define the identity key, precedence, and a final unique tie-breaker so reruns choose the same row."),
          cue("<b>Round signal:</b> retries, CDC duplicates, multiple source records, or “latest row per key.” Reach for <code>ROW_NUMBER</code> over the business key."),
          code("sql", "WITH ranked AS (\n  SELECT s.*,\n         ROW_NUMBER() OVER (\n           PARTITION BY business_key\n           ORDER BY source_updated_at DESC,\n                    ingested_at DESC,\n                    event_id DESC\n         ) AS rn\n  FROM staging_events s\n)\nSELECT * EXCLUDE rn\nFROM ranked\nWHERE rn = 1;"),
          note("trap", "<code>MAX(updated_at)</code> finds a timestamp, not necessarily the rest of that same row. Joining it back can restore ties. Rank complete rows instead."),
          note("key", "<strong>A deterministic ORDER BY must end in uniqueness.</strong> Without it, parallel execution may pick different winners across runs."),
          quiz("sql-relational")
        ])
      ]),
      module("analytics", "Analytical SQL", "trend", [
        lesson("windows", "Window functions by frame", "Keep row detail while computing ranks, running totals, lagged values, and moving metrics.", 11, ["sql", "window", "frames"], [
          p("Window functions calculate across related rows without collapsing them. The mental model has three parts: <code>PARTITION BY</code> chooses peers, <code>ORDER BY</code> orders them, and the frame chooses which ordered rows feed the current result."),
          cue("<b>Round signal:</b> running, previous, next, rank, share-of-total, or moving average while retaining each row."),
          code("sql", "SELECT account_id, event_ts, amount,\n       LAG(amount) OVER w AS previous_amount,\n       SUM(amount) OVER (\n         PARTITION BY account_id ORDER BY event_ts, event_id\n         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW\n       ) AS running_amount\nFROM ledger\nWINDOW w AS (PARTITION BY account_id ORDER BY event_ts, event_id);"),
          { t: "widget", id: "sqlwindow" },
          note("trap", "Default frames differ by engine and can group equal ORDER BY values as peers. Specify <code>ROWS</code> explicitly and add a deterministic tie-breaker."),
          note("key", "<strong>Partition, order, frame.</strong> Say all three aloud before choosing a window function.")
        ]),
        lesson("top-n", "Top-N per group", "Rank within each group, preserve ties intentionally, and avoid a global LIMIT mistake.", 8, ["sql", "top-n", "ranking"], [
          p("Global top-N is an ORDER BY plus LIMIT. Top-N <em>per group</em> requires ranking independently inside each group, then filtering the rank in an outer query."),
          cue("<b>Round signal:</b> top products per category, latest three events per user, or highest earners in each department."),
          code("sql", "WITH ranked AS (\n  SELECT product_id, category_id, revenue,\n         DENSE_RANK() OVER (\n           PARTITION BY category_id\n           ORDER BY revenue DESC\n         ) AS revenue_rank\n  FROM product_revenue\n)\nSELECT * FROM ranked WHERE revenue_rank <= 3;"),
          note("tip", "Use <code>ROW_NUMBER</code> for exactly N rows, <code>RANK</code> for competition ranking with gaps, and <code>DENSE_RANK</code> to preserve ties without gaps."),
          note("key", "<strong>The tie policy is part of the requirement.</strong> Ask whether equal values should expand the result beyond N.")
        ]),
        lesson("gaps-islands", "Gaps & islands", "Turn consecutive dates or values into stable groups using a normalized key or break flags.", 11, ["sql", "gaps", "islands"], [
          p("An island is a consecutive run; a gap separates runs. Two reusable solutions are (1) normalize each value by its row number, or (2) flag breaks with LAG and cumulatively sum those flags."),
          cue("<b>Round signal:</b> consecutive login days, uptime stretches, missing invoice numbers, or uninterrupted status periods."),
          code("sql", "WITH days AS (\n  SELECT DISTINCT user_id, CAST(event_ts AS DATE) AS d FROM events\n), grouped AS (\n  SELECT user_id, d,\n         d - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY d) * INTERVAL '1 day' AS island_key\n  FROM days\n)\nSELECT user_id, MIN(d) AS start_date, MAX(d) AS end_date, COUNT(*) AS days\nFROM grouped GROUP BY user_id, island_key;"),
          note("trap", "Deduplicate the sequence first. Multiple events on one day otherwise advance ROW_NUMBER and split a real island."),
          note("key", "<strong>Consecutive values share value − row_number × step.</strong> For irregular rules, compute a break flag and cumulative group number instead.")
        ]),
        lesson("sessionization", "Sessionization", "Create sessions from ordered events using inactivity thresholds and cumulative break markers.", 10, ["sql", "session", "lag"], [
          p("Sessionization is gaps-and-islands with a domain threshold. Sort events per actor, compare each event to the previous event, mark a new session when the gap exceeds the threshold, then cumulatively number sessions."),
          cue("<b>Round signal:</b> “30 minutes of inactivity starts a new visit” or event streams that must become visit-level rows."),
          code("sql", "WITH marked AS (\n  SELECT e.*,\n    CASE WHEN LAG(event_ts) OVER w IS NULL\n           OR event_ts - LAG(event_ts) OVER w > INTERVAL '30 minutes'\n         THEN 1 ELSE 0 END AS new_session\n  FROM events e\n  WINDOW w AS (PARTITION BY user_id ORDER BY event_ts, event_id)\n), numbered AS (\n  SELECT *, SUM(new_session) OVER (\n    PARTITION BY user_id ORDER BY event_ts, event_id ROWS UNBOUNDED PRECEDING\n  ) AS session_no\n  FROM marked\n)\nSELECT user_id, session_no, MIN(event_ts) start_ts, MAX(event_ts) end_ts, COUNT(*) events\nFROM numbered GROUP BY user_id, session_no;"),
          note("trap", "Specify whether a gap exactly equal to the threshold starts a session. Late-arriving events can rewrite historical sessions, so production pipelines need a watermark/reprocessing policy."),
          note("key", "<strong>Order, compare, mark, cumulative-sum, aggregate.</strong> That five-step pipeline is the reusable template."),
          quiz("sql-analytics")
        ])
      ]),
      module("warehouse", "Warehouse & Recursive Cases", "cube", [
        lesson("cohort-retention", "Cohorts & retention", "Separate cohort assignment from activity periods and use the cohort size as the correct denominator.", 12, ["sql", "cohort", "retention"], [
          p("Retention asks whether members of a starting cohort return in later periods. Compute each user's immutable cohort period once, deduplicate activity to one row per user-period, then aggregate by period offset."),
          cue("<b>Round signal:</b> signup-month cohorts, week-N retention, repeat purchase, or survival-style matrices."),
          code("sql", "WITH cohort AS (\n  SELECT user_id, DATE_TRUNC('month', MIN(signup_ts)) cohort_month\n  FROM users GROUP BY user_id\n), activity AS (\n  SELECT DISTINCT user_id, DATE_TRUNC('month', event_ts) activity_month\n  FROM events\n), retained AS (\n  SELECT c.cohort_month,\n         DATEDIFF('month', c.cohort_month, a.activity_month) month_no,\n         COUNT(DISTINCT a.user_id) retained_users\n  FROM cohort c JOIN activity a USING (user_id)\n  GROUP BY 1,2\n)\nSELECT *, retained_users / NULLIF(MAX(CASE WHEN month_no=0 THEN retained_users END)\n  OVER (PARTITION BY cohort_month), 0)::DECIMAL AS retention\nFROM retained;"),
          note("trap", "Do not use active users in each later month as the denominator. Retention divides returning cohort members by the original cohort population."),
          note("key", "<strong>Cohort assignment and activity are separate relations.</strong> Keep them separate until the offset calculation.")
        ]),
        lesson("scd", "Slowly changing dimensions", "Model type-1 overwrite and type-2 history with non-overlapping effective intervals.", 11, ["sql", "scd", "warehouse"], [
          p("Type 1 replaces old attributes and keeps only current truth. Type 2 preserves history by expiring the current row and inserting a new version. The hard invariant is one current row and no overlapping validity intervals per business key."),
          cue("<b>Round signal:</b> historical customer tier, account territory “as of order time,” or warehouse merge design."),
          code("sql", "-- As-of join from fact to type-2 dimension\nSELECT f.order_id, d.customer_tier\nFROM fact_order f\nJOIN dim_customer d\n  ON d.customer_id = f.customer_id\n AND f.ordered_at >= d.effective_from\n AND f.ordered_at < COALESCE(d.effective_to, TIMESTAMP '9999-12-31 00:00:00');\n\n-- Validate accidental overlap\nSELECT a.customer_id\nFROM dim_customer a JOIN dim_customer b\n ON a.customer_id=b.customer_id AND a.version_id<b.version_id\n AND a.effective_from < COALESCE(b.effective_to, TIMESTAMP '9999-12-31 00:00:00')\n AND b.effective_from < COALESCE(a.effective_to, TIMESTAMP '9999-12-31 00:00:00');"),
          note("trap", "Expire-and-insert must be atomic. Concurrent loads can create two current rows unless the merge is serialized or protected by constraints."),
          note("key", "<strong>Use half-open effective intervals and test non-overlap.</strong> An as-of join should match exactly one version.")
        ]),
        lesson("recursive-cte", "Recursive CTEs", "Traverse hierarchies with an anchor, recursive member, termination rule, depth bound, and cycle guard.", 11, ["sql", "recursive-cte", "hierarchy"], [
          p("A recursive CTE repeatedly feeds its previous output into the next step. The anchor supplies roots; the recursive member adds one frontier level. Correctness depends on explicit termination and cycle handling."),
          cue("<b>Round signal:</b> org charts, category trees, bill of materials, dependency closure, or graph reachability in SQL."),
          code("sql", "WITH RECURSIVE org AS (\n  SELECT employee_id, manager_id, name, 0 AS depth,\n         ARRAY[employee_id] AS path\n  FROM employees WHERE manager_id IS NULL\n  UNION ALL\n  SELECT e.employee_id, e.manager_id, e.name, o.depth + 1,\n         o.path || e.employee_id\n  FROM employees e JOIN org o ON e.manager_id = o.employee_id\n  WHERE o.depth < 50 AND NOT (e.employee_id = ANY(o.path))\n)\nSELECT * FROM org ORDER BY path;"),
          note("trap", "Real hierarchy data can contain cycles. UNION DISTINCT may hide some loops but does not express the intended guard; carry a path and reject revisits."),
          note("key", "<strong>Anchor, advance, stop.</strong> Add a depth cap even when the data is supposed to be acyclic.")
        ]),
        lesson("de-cases", "Data-engineering SQL cases", "Design idempotent incremental loads, late-data handling, reconciliation, and atomic publication.", 12, ["sql", "etl", "incremental"], [
          p("Data-engineering rounds grade operational correctness: reruns, partial failures, schema drift, late events, and reconciliation matter as much as the SELECT. State the source-of-truth key and idempotency strategy."),
          cue("<b>Round signal:</b> incremental pipeline, CDC merge, backfill, watermark, or source-to-target count mismatch."),
          code("sql", "-- Idempotent upsert shape (dialect varies)\nMERGE INTO target t USING staged_batch s\nON t.business_key = s.business_key\nWHEN MATCHED AND s.source_version > t.source_version THEN\n  UPDATE SET payload=s.payload, source_version=s.source_version\nWHEN NOT MATCHED THEN\n  INSERT (business_key,payload,source_version)\n  VALUES (s.business_key,s.payload,s.source_version);\n\n-- Reconcile at useful grains, not just total count\nSELECT load_date, COUNT(*) rows, COUNT(DISTINCT business_key) keys,\n       SUM(amount) amount FROM target GROUP BY load_date;"),
          note("tip", "Use a lookback window or source version for late data, stage before publish, and make publication atomic. Record batch IDs and high-water marks only after success."),
          note("key", "<strong>A pipeline is correct when rerunning it converges to the same state.</strong> Explain replay, dedupe, watermark advancement, and reconciliation."),
          quiz("sql-warehouse")
        ])
      ]),
      module("performance", "Debugging & Performance", "compass", [
        lesson("debugging", "Debugging wrong SQL", "Localize grain changes, NULL loss, join multiplication, nondeterminism, and boundary errors.", 10, ["sql", "debugging", "correctness"], [
          p("Debug SQL as a sequence of relations. Materialize each CTE, count rows and keys, inspect unmatched records, and identify the exact step where the grain or totals diverge."),
          cue("<b>Round signal:</b> totals doubled, missing rows, flaky winners, or a query that is syntactically valid but semantically wrong."),
          code("sql", "-- Grain audit for each stage\nSELECT COUNT(*) rows,\n       COUNT(DISTINCT business_key) keys,\n       SUM(amount) amount\nFROM suspect_stage;\n\n-- Join coverage audit\nSELECT CASE WHEN r.key IS NULL THEN 'unmatched' ELSE 'matched' END status,\n       COUNT(*) rows\nFROM left_side l LEFT JOIN right_side r ON l.key=r.key\nGROUP BY 1;"),
          note("tip", "Shrink to a hand-verifiable counterexample: one duplicate key, one NULL, one boundary timestamp, one tie. A five-row fixture often exposes what a million-row table hides."),
          note("key", "<strong>Find the first stage where an invariant breaks.</strong> Do not patch the final SELECT with DISTINCT.")
        ]),
        lesson("performance", "Query plans & performance", "Read scans, estimates, join strategies, sorts, spills, partition pruning, and sargability.", 11, ["sql", "explain", "performance"], [
          p("Performance starts with less work: scan fewer partitions, project fewer columns, aggregate before explosive joins, and let indexes/clustering support selective predicates. Then read the plan instead of guessing."),
          cue("<b>Round signal:</b> slow query, timeout, warehouse spill, or “how would you optimize this?” Ask for scale, selectivity, distribution, and the actual plan."),
          code("sql", "-- Non-sargable: transforms every stored value\nWHERE DATE(event_ts) = DATE '2026-10-28'\n\n-- Sargable and partition-friendly\nWHERE event_ts >= TIMESTAMP '2026-10-28 00:00:00'\n  AND event_ts <  TIMESTAMP '2026-10-29 00:00:00'\n\n-- Pre-aggregate before joining to a dimension\nWITH daily AS (\n SELECT customer_id, CAST(event_ts AS DATE) d, SUM(amount) amount\n FROM fact GROUP BY 1,2\n)\nSELECT ... FROM daily JOIN customer_dim USING (customer_id);"),
          note("trap", "CTEs are not universally optimization fences or universally inlined; behavior depends on engine and version. Verify the plan."),
          note("key", "<strong>Compare estimated vs actual rows.</strong> Large errors explain bad join choices; spills reveal memory pressure; full scans reveal missed pruning."),
          quiz("sql-performance")
        ])
      ])
    ]
  };

  window.TRACKS.concurrency = {
    id: "concurrency",
    name: "Concurrency Coding Problems",
    short: "CON",
    tagline: "Make interleavings explicit",
    color: "#fb7185",
    blurb: "Implement and test synchronization primitives and concurrent components by naming invariants, linearization points, shutdown behavior, fairness, backpressure, and the adversarial schedules that break naive code.",
    modules: [
      module("coordination", "Coordination & Backpressure", "queue", [
        lesson("bounded-queue", "Bounded blocking queue", "Coordinate producers and consumers with capacity, condition loops, close semantics, and no lost wakeups.", 12, ["concurrency", "queue", "conditions"], [
          p("A bounded queue has two state predicates: consumers wait while empty; producers wait while full. Both checks belong in <code>while</code> loops because wakeups can be spurious and another thread may consume the condition first."),
          cue("<b>Invariant:</b> <code>0 ≤ size ≤ capacity</code>. Define whether close drains buffered work, how blocked callers wake, and what put/take return after closure."),
          code("python", "class BoundedQueue:\n    def __init__(self, capacity):\n        self.cap, self.q = capacity, deque()\n        self.cv, self.closed = Condition(), False\n    def put(self, item):\n        with self.cv:\n            while len(self.q) == self.cap and not self.closed:\n                self.cv.wait()\n            if self.closed: raise QueueClosed()\n            self.q.append(item); self.cv.notify_all()\n    def take(self):\n        with self.cv:\n            while not self.q and not self.closed:\n                self.cv.wait()\n            if not self.q: raise QueueClosed()\n            item = self.q.popleft(); self.cv.notify_all(); return item"),
          { t: "widget", id: "concurrencyqueue" },
          note("key", "<strong>The predicate is truth; notification is only a hint to re-check it.</strong> Mutate state and signal while holding the same lock.")
        ]),
        lesson("producer-consumer", "Producer–consumer pipeline", "Separate ownership, apply backpressure, propagate failure, and shut down without dropped work.", 10, ["concurrency", "producer-consumer", "shutdown"], [
          p("Producer–consumer is an architecture around a queue. The difficult part is lifecycle: choose bounded capacity, preserve or relax ordering deliberately, propagate worker failures, and ensure every accepted item is either processed or reported."),
          cue("<b>Round pressure:</b> multiple producers/consumers, poison pills, retries, or graceful shutdown. Prefer an explicit close operation over one sentinel per guessed worker count."),
          code("python", "def consumer(queue, stop, failures):\n    try:\n        while not stop.is_set():\n            item = queue.take()       # close wakes blocked take\n            process(item)\n            queue.task_done()\n    except QueueClosed:\n        return\n    except Exception as exc:\n        failures.put(exc)\n        stop.set()\n        queue.close()                 # wake the rest"),
          note("trap", "An unbounded queue merely moves overload into memory. A bounded queue turns capacity into visible backpressure."),
          note("key", "<strong>Define acceptance and completion.</strong> Shutdown is correct only if accepted work has a documented fate.")
        ]),
        lesson("worker-pool", "Worker pool", "Bound concurrency, account for tasks, contain failures, and avoid self-deadlock during shutdown.", 11, ["concurrency", "worker-pool", "backpressure"], [
          p("A worker pool caps parallelism and amortizes thread creation. Its contract includes submit behavior under saturation, result/failure delivery, cancellation, and whether shutdown waits, drains, or rejects."),
          cue("<b>Round signal:</b> execute many independent jobs with at most N in flight. A semaphore limits concurrency; a bounded queue also limits waiting work."),
          code("python", "class WorkerPool:\n    def submit(self, fn):\n        with self.state_lock:\n            if self.closing: raise Rejected()\n            future = Future()\n            self.queue.put((fn, future))\n            return future\n\n    def worker(self):\n        for fn, future in self.queue:\n            if not future.cancelled():\n                try: future.set_result(fn())\n                except BaseException as e: future.set_exception(e)"),
          note("trap", "Do not hold the pool state lock while blocking on a full work queue; workers may need that lock to complete or shut down."),
          note("key", "<strong>Separate queue capacity from worker count.</strong> One bounds backlog; the other bounds simultaneous execution."),
          quiz("con-coordination")
        ])
      ]),
      module("primitives", "Concurrent Components", "blocks", [
        lesson("token-bucket", "Token-bucket rate limiter", "Refill from monotonic elapsed time, cap bursts, and keep check-and-consume atomic.", 10, ["concurrency", "rate-limit", "token-bucket"], [
          p("A token bucket accrues tokens at rate r up to capacity b. A request consumes tokens atomically. Capacity permits bursts while refill controls the long-run rate."),
          cue("<b>Invariant:</b> <code>0 ≤ tokens ≤ capacity</code>. Use a monotonic clock so wall-clock changes cannot mint or remove tokens."),
          code("python", "def allow(self, cost=1, now=None):\n    now = monotonic() if now is None else now\n    with self.lock:\n        elapsed = max(0, now - self.last)\n        self.tokens = min(self.capacity,\n                          self.tokens + elapsed * self.rate)\n        self.last = now\n        if self.tokens < cost: return False\n        self.tokens -= cost\n        return True"),
          note("tip", "Inject the clock in tests. You can advance virtual time deterministically instead of sleeping."),
          note("key", "<strong>Refill and consume are one linearizable operation.</strong> Splitting them lets concurrent callers overspend.")
        ]),
        lesson("thread-safe-lru", "Thread-safe LRU cache", "Protect map/list invariants while avoiding callbacks or expensive work under the lock.", 12, ["concurrency", "lru", "locks"], [
          p("An O(1) LRU combines a map with a doubly linked list. Thread safety means every map/list update is atomic from callers’ perspective. A read is a write because it moves the node to most-recent."),
          cue("<b>Invariants:</b> one list node per map entry, list and map sizes agree, sentinels stay linked, capacity is never exceeded."),
          code("python", "def get(self, key):\n    with self.lock:\n        node = self.nodes.get(key)\n        if node is None: return MISSING\n        self._unlink(node)\n        self._insert_after_head(node)\n        return node.value\n\ndef put(self, key, value):\n    with self.lock:\n        # update/insert and possible tail eviction occur atomically\n        self._put_locked(key, value)"),
          note("trap", "Computing a missing value while holding the global lock serializes callers and can deadlock if the callback re-enters the cache. Use per-key single-flight or compute outside and recheck."),
          note("key", "<strong>Name the linearization point.</strong> For get it is the successful lookup plus move under one lock.")
        ]),
        lesson("rw-lock", "Read/write lock", "Coordinate shared readers and exclusive writers while choosing a starvation policy.", 11, ["concurrency", "rw-lock", "fairness"], [
          p("A read/write lock permits many readers or one writer. The implementation is simple only after choosing policy: reader preference can starve writers; writer preference can delay readers; fair queuing costs throughput."),
          cue("<b>State:</b> active readers, writer active, waiting writers. A writer-preferring reader waits if a writer is active <em>or waiting</em>."),
          code("python", "def acquire_read(self):\n    with self.cv:\n        while self.writer or self.waiting_writers:\n            self.cv.wait()\n        self.readers += 1\n\ndef acquire_write(self):\n    with self.cv:\n        self.waiting_writers += 1\n        try:\n            while self.writer or self.readers:\n                self.cv.wait()\n            self.writer = True\n        finally:\n            self.waiting_writers -= 1"),
          note("trap", "Upgrading read→write can deadlock when two readers both wait for the other to release. Disallow upgrade or provide one carefully specified upgrader slot."),
          note("key", "<strong>Fairness is API behavior, not an implementation detail.</strong> State which side may wait and why.")
        ]),
        lesson("deadlock", "Deadlock avoidance", "Break circular wait with global lock ordering, try-lock rollback, or ownership redesign.", 10, ["concurrency", "deadlock", "locks"], [
          p("Deadlock requires mutual exclusion, hold-and-wait, no preemption, and circular wait. Preventing any one condition is enough. The most reusable coding answer is a total order over lock identities."),
          cue("<b>Round signal:</b> transfer between accounts, swap two resources, nested locks, or callbacks under a lock."),
          code("python", "def transfer(src, dst, amount):\n    first, second = sorted((src, dst), key=lambda a: a.lock_id)\n    with first.lock:\n        with second.lock:\n            if src.balance < amount: return False\n            src.balance -= amount\n            dst.balance += amount\n            return True"),
          { t: "widget", id: "concurrencytimeline" },
          note("key", "<strong>All call sites must obey the same total order.</strong> Timeouts detect trouble; ordering prevents the cycle."),
          quiz("con-primitives")
        ])
      ]),
      module("async-testing", "Async Scheduling & Testing", "compass", [
        lesson("async-scheduler", "Async scheduler", "Run delayed work with a priority queue, wake on earlier arrivals, and avoid blocking the event loop.", 12, ["concurrency", "async", "scheduler"], [
          p("A delayed scheduler keeps tasks in a min-heap by deadline. The dispatcher waits until the earliest deadline, but a newly submitted earlier task must wake it so it can recompute the delay."),
          cue("<b>Round pressure:</b> cancellation, recurring tasks, drift, bounded execution, and shutdown. Keep timing separate from execution so one slow task does not stall the clock."),
          code("python", "async def run(self):\n    while not self.closed:\n        async with self.changed:\n            while not self.heap and not self.closed:\n                await self.changed.wait()\n            if self.closed: break\n            deadline, seq, job = self.heap[0]\n            delay = deadline - self.clock()\n            if delay > 0:\n                try: await wait_for(self.changed.wait(), delay)\n                except TimeoutError: pass\n                continue\n            heappop(self.heap)\n        create_task(self.execute(job))  # outside scheduler lock"),
          note("trap", "Recurring work scheduled as <code>now + interval</code> drifts with execution delays. For fixed-rate semantics, advance from the previous planned deadline and define catch-up behavior."),
          note("key", "<strong>The heap orders deadlines; a condition reports that the earliest deadline may have changed.</strong>")
        ]),
        lesson("concurrency-testing", "Testing concurrent code", "Use barriers, fake clocks, invariants, repeated schedules, stress, and model-based checks instead of sleeps.", 12, ["concurrency", "testing", "race"], [
          p("A concurrency test should force a dangerous interleaving, not hope the scheduler finds one. Barriers pause threads at known phases; latches coordinate completion; fake clocks control time; a sequential model checks final behavior."),
          cue("<b>Test dimensions:</b> safety (nothing bad), liveness (something eventually happens), linearizability (operations appear atomic), and resource cleanup."),
          code("python", "def test_no_overspend():\n    clock = FakeClock()\n    bucket = TokenBucket(rate=1, capacity=1, clock=clock)\n    gate = Barrier(9)\n    results = []\n    def contender():\n        gate.wait()\n        results.append(bucket.allow())\n    threads = [Thread(target=contender) for _ in range(8)]\n    for t in threads: t.start()\n    gate.wait()\n    for t in threads: t.join(timeout=1)\n    assert results.count(True) == 1\n    assert all(not t.is_alive() for t in threads)"),
          note("trap", "<code>sleep()</code> makes tests slow and still nondeterministic. Use deadlines only as a liveness guard, never as the mechanism that creates ordering."),
          note("key", "<strong>Assert invariants after every randomized operation and preserve the failing seed.</strong> Race detectors and stress loops complement, not replace, designed interleavings.")
        ]),
        lesson("concurrency-round", "Concurrency round playbook", "Clarify semantics, write invariants, choose linearization points, implement lifecycle, then test adversarial schedules.", 9, ["concurrency", "interview", "strategy"], [
          p("Concurrency rounds reward specification. Before code, ask about blocking, fairness, ordering, cancellation, timeout, close behavior, exception propagation, and language memory-model guarantees."),
          { t: "ol", items: ["Write shared state and invariants.", "Choose the lock/condition/atomic that protects each field.", "Name each operation's linearization point.", "Define shutdown and failure paths.", "Test empty/full, simultaneous callers, cancellation, close-while-blocked, and repeated stress."] },
          cue("<b>Narrate:</b> “This while loop protects the state predicate; this mutation is the linearization point; this notify wakes waiters after the predicate may have changed.”"),
          note("tip", "Start with one clear lock. Only split locks or use lock-free structures after profiling and a correctness argument."),
          note("key", "<strong>Correctness before parallelism.</strong> A simple linearizable solution with explicit lifecycle beats a clever race."),
          quiz("con-async")
        ])
      ])
    ]
  };

  function q(title, sub, rows) {
    return { title, sub, questions: rows.map((r) => ({ q: r[0], options: r[1], answer: r[2], explain: r[3] })) };
  }
  Object.assign(window.QUIZZES, {
    "sql-relational": q("Relational SQL checkpoint", "Joins, aggregation, NULL, time, and dedupe.", [
      ["Safest anti-join when the subquery key may contain NULL?", ["NOT IN", "NOT EXISTS", "CROSS JOIN", "UNION ALL"], 1, "NOT EXISTS tests absence directly and is not poisoned by a NULL inside the subquery."],
      ["What does COUNT(column) do with NULL?", ["Counts it", "Skips it", "Returns NULL", "Throws"], 1, "COUNT(expression) counts non-NULL evaluations; COUNT(*) counts rows."],
      ["Why prefer [start,end) time windows?", ["Shorter SQL", "They compose without double-counting boundaries", "They ignore zones", "They include midnight twice"], 1, "Adjacent half-open intervals share no included instant."],
      ["What must end a dedupe ORDER BY?", ["A nullable field", "A unique stable tie-breaker", "RANDOM()", "The partition key only"], 1, "A unique final ordering makes the chosen survivor deterministic."],
      ["A many-to-many join usually does what?", ["Removes rows", "Multiplies matching combinations", "Guarantees uniqueness", "Sorts output"], 1, "Every matching row on one side pairs with every match on the other."],
    ]),
    "sql-analytics": q("Analytical SQL checkpoint", "Windows, Top-N, islands, and sessions.", [
      ["Three parts of a window specification?", ["Table, index, view", "Partition, order, frame", "Select, where, having", "Key, value, hash"], 1, "Partition chooses peers, order sequences them, and frame chooses contributing rows."],
      ["Exactly three rows per group despite ties?", ["DENSE_RANK", "RANK", "ROW_NUMBER", "NTILE"], 2, "ROW_NUMBER assigns a unique sequence, so filtering <=3 returns exactly three when available."],
      ["First step before daily gaps-and-islands?", ["Duplicate dates", "Deduplicate dates", "Cross join calendar", "Remove ORDER BY"], 1, "Duplicates distort row numbers and split genuine runs."],
      ["Reusable sessionization sequence?", ["Sort, compare, mark, cumulative sum, aggregate", "Aggregate, sort, delete", "Join, distinct, limit", "Pivot, recurse"], 0, "Each break flag starts a new cumulatively numbered session."],
      ["Why add a tie-breaker to a window ORDER BY?", ["Make output deterministic", "Disable partitions", "Remove NULL", "Force an index"], 0, "Equal order keys otherwise have unspecified relative order."],
    ]),
    "sql-warehouse": q("Warehouse SQL checkpoint", "Retention, SCD, recursion, and pipelines.", [
      ["Retention denominator?", ["Later-month active users", "Original cohort population", "All users ever", "Event count"], 1, "Retention measures the share of the starting cohort that returned."],
      ["SCD type 2 preserves history by…", ["Overwriting", "Versioning effective intervals", "Dropping facts", "Using DISTINCT"], 1, "Each change expires one version and inserts the next."],
      ["Recursive CTE needs which three ideas?", ["Anchor, advance, stop", "Map, shuffle, reduce", "Lock, wait, signal", "Sort, limit, offset"], 0, "The anchor seeds recursion, recursive member advances it, and guards terminate it."],
      ["Core idempotency property?", ["Reruns duplicate output", "Reruns converge to the same state", "No logging", "Only append"], 1, "Safe replay produces the same intended state."],
      ["When should a watermark advance?", ["Before reading", "After successful atomic publication", "Every minute", "On any failure"], 1, "Advancing early can skip uncommitted data after failure."],
    ]),
    "sql-performance": q("SQL correctness & performance", "Debugging and query plans.", [
      ["First response to doubled totals?", ["Add DISTINCT", "Audit grain and join cardinality at each stage", "Increase warehouse", "Remove tests"], 1, "Locate the first relation where row/key counts diverge."],
      ["Sargable date predicate?", ["DATE(ts)=date", "ts >= start AND ts < next_start", "CAST(ts AS TEXT)", "YEAR(ts)=2026"], 1, "A direct range predicate supports pruning/index access."],
      ["Large estimated-vs-actual row mismatch suggests?", ["Perfect statistics", "Cardinality estimation trouble", "Syntax error", "Encryption"], 1, "Bad estimates often drive poor join algorithms and memory grants."],
      ["A spill usually indicates?", ["Too much memory", "Working data exceeded granted memory", "No rows", "Correct partitioning"], 1, "The sort buffer or hash table outgrew its memory grant, so the engine wrote intermediate state to disk and read it back — often triggered by an underestimated row count."],
      ["Best small debugging fixture?", ["Only normal rows", "Duplicate, NULL, boundary, and tie cases", "One billion rows", "Random schema"], 1, "Small adversarial examples expose semantic bugs quickly."],
    ]),
    "con-coordination": q("Coordination checkpoint", "Queues, pipelines, and pools.", [
      ["Why wait in a while loop?", ["Style", "Re-check predicate after spurious/contended wakeups", "Faster sleep", "Avoid locks"], 1, "A wakeup is only permission to re-check shared state."],
      ["What does bounded capacity provide?", ["Infinite throughput", "Backpressure", "Lock freedom", "Ordering across machines"], 1, "Producers slow or reject when consumers cannot keep up."],
      ["Queue invariant?", ["size < 0", "0 <= size <= capacity", "size always capacity", "No consumers"], 1, "Every operation must preserve those bounds."],
      ["Worker count vs queue capacity?", ["Same concept", "Execution concurrency vs waiting backlog", "Readers vs writers", "Clock vs rate"], 1, "Workers bound active work; capacity bounds admitted backlog."],
      ["Danger during submit?", ["Blocking on full queue while holding a lock workers need", "Using a future", "Returning rejection", "Counting tasks"], 0, "That lock dependency can deadlock the pool."],
    ]),
    "con-primitives": q("Concurrent components checkpoint", "Rate limits, LRU, RW locks, and deadlock.", [
      ["Clock for token bucket?", ["Wall clock", "Monotonic clock", "Random clock", "Calendar date"], 1, "Monotonic elapsed time is unaffected by clock corrections."],
      ["Why is LRU get a write?", ["It deletes value", "It moves recency order", "It allocates disk", "It changes key"], 1, "A hit moves the entry to the most-recently-used end of the list, so even a read mutates shared order and needs the same exclusive lock as a put."],
      ["Reader preference can cause?", ["Writer starvation", "Data compression", "More tokens", "Cycle collection"], 0, "A stream of readers may prevent a waiting writer from entering."],
      ["Reusable deadlock prevention?", ["Sleep randomly", "Global total lock order", "More threads", "Ignore callbacks"], 1, "A consistent order breaks circular wait."],
      ["Linearization point means?", ["Compile time", "Instant an operation appears to take effect atomically", "Lock creation", "Thread start"], 1, "Linearizability maps concurrent operations to atomic points consistent with real-time order."],
    ]),
    "con-async": q("Async & testing checkpoint", "Schedulers and concurrency verification.", [
      ["Why wake scheduler on a new task?", ["New task may have earlier deadline", "To sort strings", "To stop clock", "Always cancel"], 0, "The dispatcher must recompute which deadline is earliest."],
      ["Why avoid sleep in concurrency tests?", ["Too readable", "Slow and nondeterministic", "Uses no clock", "Prevents threads"], 1, "Sleeping neither guarantees the desired interleaving nor fast tests."],
      ["Best way to force simultaneous contenders?", ["Barrier", "Print", "Global variable without lock", "Long sleep"], 0, "A barrier releases participants from a known phase together."],
      ["Fixed-rate recurring scheduling avoids drift by?", ["Using now+interval", "Advancing from previous planned deadline", "Ignoring duration", "Wall clock jumps"], 1, "Planned deadlines preserve cadence; policy handles missed runs."],
      ["Concurrency test should cover?", ["Safety only", "Safety, liveness, linearizability, cleanup", "Output color", "Compiler version only"], 1, "Correctness includes state, progress, atomic behavior, and resource lifecycle."],
    ])
  });
})();
