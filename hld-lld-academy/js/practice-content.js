/* =====================================================================
   BLUEPRINT · Practice/content-quality layer
   Static, offline interview drills and references for HLD + LLD practice.
   ===================================================================== */
window.BlueprintPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Model-answer outlines",
      color: "#f5a623",
      icon: "map",
      summary: "Compact, discussable outlines for end-to-end HLD and LLD practice prompts."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed drills",
      color: "#a78bfa",
      icon: "quiz",
      summary: "Short prompts with time boxes, expected moves, and follow-up pressure points."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Self-check bands",
      color: "#5eead4",
      icon: "star",
      summary: "Beginner, competent, and senior answer bands for judging your own practice."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#bef264",
      icon: "md",
      summary: "Interview flow, capacity numbers, distributed patterns, LLD checks, and invariants."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Vocabulary",
      color: "#fb7185",
      icon: "lesson",
      summary: "Plain-English terms with local cross-links to practice pages and lessons."
    }
  ],

  scenarios: [
    {
      id: "ticket-marketplace-flash-sale",
      title: "Ticket marketplace flash sale",
      subtitle: "HLD capstone outline",
      timebox: "45-60 min",
      prompt: "Design a ticket marketplace for a high-demand event drop. Users browse events, enter a waiting room, reserve seats, pay, and receive tickets. The system must handle a flash crowd and must not double-sell seats.",
      related: [
        { label: "Marketplace capstone", route: "#/hld/cases/production-capstone" },
        { label: "Idempotency", route: "#/glossary/idempotency" },
        { label: "Saga", route: "#/glossary/saga" }
      ],
      outline: [
        {
          title: "Clarify the contract",
          items: [
            "Separate browse/search from reserve/pay/issue. Browsing may be stale; booking cannot be.",
            "State the no-double-sell invariant early: one confirmed ticket per seat per event.",
            "Ask about hold duration, transfer/refund rules, payment provider behavior, known sale start time, and acceptable degradation."
          ]
        },
        {
          title: "Shape the architecture",
          items: [
            "Edge/CDN for event pages and static assets; API gateway with rate limits and bot controls.",
            "Waiting-room service admits users in batches using a token bucket or queue.",
            "Inventory service owns seats and holds in a strongly consistent store.",
            "Order service orchestrates reserve -> authorize payment -> confirm -> issue ticket through a saga.",
            "Notification workers consume events; search index updates asynchronously."
          ]
        },
        {
          title: "Deep dives",
          items: [
            "Seat hold is a conditional write or transaction keyed by event_id + seat_id with expiry.",
            "Idempotency key scopes checkout retries; downstream payment, ticket issue, and notification each have their own dedupe key.",
            "Flash crowd is controlled by admission, not by letting every request hit inventory.",
            "Observability watches queue depth, admission rate, reservation conflicts, payment failures, p99 checkout latency, and SLO burn."
          ]
        },
        {
          title: "Trade-offs to narrate",
          items: [
            "Cache browse pages aggressively, but verify availability against the inventory source of truth during checkout.",
            "Prefer a small critical section around seat state over a broad distributed lock.",
            "Use graceful degradation: freeze seat maps, pause transfers, or show approximate availability during the drop."
          ]
        }
      ]
    },
    {
      id: "multi-tenant-saas-isolation",
      title: "Multi-tenant SaaS isolation",
      subtitle: "Reliability review outline",
      timebox: "40-55 min",
      prompt: "A shared B2B SaaS platform has noisy-neighbor incidents, global deploy risk, and enterprise tenants asking for stronger isolation. Review the architecture and propose an evolution path.",
      related: [
        { label: "SaaS reliability capstone", route: "#/hld/cases/saas-reliability-review" },
        { label: "Shard", route: "#/glossary/shard" },
        { label: "SLO", route: "#/glossary/slo" }
      ],
      outline: [
        {
          title: "Clarify isolation goals",
          items: [
            "Ask whether the concern is data isolation, performance isolation, deploy blast radius, compliance, or all of them.",
            "Classify tenants by size and risk; not every tenant needs the same isolation tier.",
            "Define the failure target: a hot tenant should affect only its cell/cohort, not the whole platform."
          ]
        },
        {
          title: "Evolution path",
          items: [
            "Make tenant_id first-class in table indexes, cache keys, queue partitions, logs, metrics, and admin tools.",
            "Split shared background workers, queues, and rate limits by tenant cohort before moving databases.",
            "Introduce a routing control plane: tenant -> cell, cached at the edge with an audited source of truth.",
            "Move selected tenants through copy, replay, verify, cutover, and rollback.",
            "Deploy by waves: empty cell, internal cell, small tenant cohort, then larger cohorts."
          ]
        },
        {
          title: "Hard parts",
          items: [
            "Cross-cell analytics must use an exported data plane, not direct queries against every production cell.",
            "Support tooling must be cell-aware so operators do not accidentally cross tenant boundaries.",
            "Per-tenant budgets need enforcement across CPU, DB pools, queue depth, search, caches, and background jobs."
          ]
        },
        {
          title: "Trade-offs to narrate",
          items: [
            "Cells reduce blast radius but increase operational surface area.",
            "Shared metadata services simplify routing but become critical dependencies.",
            "Full tenant-dedicated stacks are expensive; tiered isolation is often the practical answer."
          ]
        }
      ]
    },
    {
      id: "chat-system-under-load",
      title: "Chat system under load",
      subtitle: "Real-time HLD outline",
      timebox: "45 min",
      prompt: "Design a chat system that supports one-to-one and group messaging. It should keep active users connected during spikes, deliver messages to offline users later, and degrade safely under load.",
      related: [
        { label: "Chat case study", route: "#/hld/cases/chat" },
        { label: "Backpressure", route: "#/glossary/backpressure" },
        { label: "p99", route: "#/glossary/p99" }
      ],
      outline: [
        {
          title: "Clarify scope",
          items: [
            "Ask one-to-one vs groups, attachment support, ordering guarantees, presence accuracy, read receipts, and retention.",
            "Define delivery semantics: accepted message is durably stored before ack; clients may receive duplicates and dedupe by message id.",
            "Set latency goal for active delivery and separate it from offline catch-up."
          ]
        },
        {
          title: "Core architecture",
          items: [
            "Connection servers hold WebSocket sessions and heartbeats; they remain stateless enough to reconnect elsewhere.",
            "Message service validates, assigns ids, stores messages, and publishes to a room/user stream.",
            "Pub/sub backplane routes active deliveries to the connection server that owns each socket.",
            "Offline inbox or per-user cursor lets clients catch up after reconnect.",
            "Presence is approximate with heartbeat TTLs; correctness belongs to message storage, not presence."
          ]
        },
        {
          title: "Load controls",
          items: [
            "Apply backpressure per connection, per user, per room, and per tenant.",
            "Bound fan-out work with queues and worker pools; large groups may switch to pull-on-read or mailbox fan-out.",
            "Drop or sample low-value signals such as typing indicators before dropping messages.",
            "Track p99 send-to-deliver latency, queue lag, reconnect rate, socket count, and slow consumer counts."
          ]
        },
        {
          title: "Trade-offs to narrate",
          items: [
            "Strict total ordering is expensive; per-conversation ordering is usually enough.",
            "Presence can be eventually consistent; message persistence cannot be best-effort.",
            "Large-group chat looks more like feed fan-out than one-to-one delivery."
          ]
        }
      ]
    },
    {
      id: "lld-elevator-vending-extension",
      title: "LLD elevator/vending extension",
      subtitle: "Object-design extension outline",
      timebox: "35-45 min",
      prompt: "Extend the elevator or vending-machine design after the base version works. Add requirements such as maintenance mode, priority requests, exact-change-only mode, refunds, restocking, or analytics without turning the design into a giant conditional.",
      related: [
        { label: "Elevator example", route: "#/lld/practice/case-elevator" },
        { label: "Vending example", route: "#/lld/practice/case-vending-machine" },
        { label: "State machine", route: "#/glossary/state-machine" }
      ],
      outline: [
        {
          title: "Start from invariants",
          items: [
            "Elevator: a car cannot move with doors open; capacity must not exceed the limit; a stop is either pending, being served, or complete.",
            "Vending: balance never goes negative; stock count changes only through dispense/restock; refund returns the inserted balance exactly once.",
            "Name the states before naming classes."
          ]
        },
        {
          title: "Extension seams",
          items: [
            "Use State objects for modes: Idle, HasMoney, Dispensing, Maintenance, SoldOut, ExactChangeOnly.",
            "Use Strategy for policies: dispatch selection, stop ordering, pricing, refund/change-making, restock rules.",
            "Use Command objects for user/admin actions when you need audit, undo, retry, or queued execution.",
            "Inject clock, payment device, display, sensors, and inventory repository for testability."
          ]
        },
        {
          title: "Walk scenarios",
          items: [
            "Vending: insert coins -> select sold-out item -> refund -> restock -> select available item -> dispense.",
            "Elevator: hall request -> assigned car -> priority request arrives -> scheduler reorders safely -> car enters maintenance.",
            "Show where locks or serialized event loops protect shared mutable state."
          ]
        },
        {
          title: "Trade-offs to narrate",
          items: [
            "A simple enum plus switch may be fine for tiny products; State pattern earns its keep when transitions and rules grow.",
            "Do not add patterns by name alone. Explain the change pressure they absorb.",
            "A senior LLD answer names failure and recovery paths, not only happy-path classes."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "url-shortener-30",
      title: "URL shortener in 30 minutes",
      timebox: "30 min",
      prompt: "Design a URL shortener that creates short aliases, redirects quickly, tracks basic analytics, and handles hot links.",
      expected: [
        "Clarify custom aliases, expiry, auth, abuse controls, and redirect latency.",
        "Estimate create QPS vs redirect QPS; redirects dominate.",
        "Use base62 ids or random tokens; store key -> long URL in a durable KV/table.",
        "Cache hot keys at the edge or app cache; make analytics async.",
        "Mention collision handling, custom alias uniqueness, and read-heavy scaling."
      ],
      followups: [
        "How do you handle a celebrity posting one short link?",
        "What changes if users can choose custom aliases?",
        "Where do analytics writes go so redirects stay fast?"
      ],
      links: [
        { label: "URL shortener lesson", route: "#/hld/cases/url-shortener" },
        { label: "HLD flow", route: "#/cheatsheets/hld-flow" }
      ]
    },
    {
      id: "feed-fanout-deep-dive",
      title: "Feed fan-out deep dive",
      timebox: "35 min",
      prompt: "Design a social feed and deep dive on how posts reach follower timelines at scale.",
      expected: [
        "Clarify read/write ratio, follower distribution, freshness expectations, ranking, and privacy.",
        "Compare fan-out-on-write, fan-out-on-read, and hybrid fan-out.",
        "Precompute normal-user feeds; pull celebrity posts on read or rank from a side index.",
        "Use queues for fan-out workers and track lag, retries, and duplicate event handling.",
        "Discuss cache invalidation, privacy changes, and ranking as a separate concern."
      ],
      followups: [
        "What happens when a user has 50 million followers?",
        "How do you remove a deleted/private post from existing feeds?",
        "Where does ranking happen?"
      ],
      links: [
        { label: "News feed lesson", route: "#/hld/cases/news-feed" },
        { label: "Queue patterns", route: "#/cheatsheets/consistency-cache-queue" }
      ]
    },
    {
      id: "parking-lot-classes",
      title: "Parking lot classes",
      timebox: "30 min",
      prompt: "Design the classes for a multi-level parking lot with tickets, spot assignment, payment, and future support for EV spots.",
      expected: [
        "Clarify vehicle types, spot types, entry/exit flow, payment timing, and concurrency.",
        "Identify ParkingLot, Level, ParkingSpot, Vehicle, Ticket, PricingStrategy, SpotAssignmentStrategy, and service/controller classes.",
        "Use Strategy for pricing and assignment; consider State for spot lifecycle.",
        "Walk park -> ticket -> pay -> exit and show where a spot is atomically claimed.",
        "Call out extension points for EV charging, reservations, and different pricing rules."
      ],
      followups: [
        "How do you prevent two cars getting the same spot?",
        "How does weekend pricing get added?",
        "Where would you put payment provider code?"
      ],
      links: [
        { label: "Parking lot example", route: "#/lld/practice/case-parking-lot" },
        { label: "LLD checklist", route: "#/cheatsheets/lld-class-design" }
      ]
    },
    {
      id: "rate-limiter",
      title: "Rate limiter",
      timebox: "25 min",
      prompt: "Design a rate limiter for an API gateway. It should support per-user and per-tenant limits and continue to behave sensibly when traffic spikes.",
      expected: [
        "Clarify fixed window vs sliding window vs token bucket behavior.",
        "Choose key dimensions such as tenant_id, user_id, endpoint, and time bucket.",
        "Use Redis or a local+distributed hybrid for counters/tokens with expiry.",
        "Discuss consistency trade-offs: approximate local limits are faster; central limits are stricter.",
        "Return clear retry-after metadata and instrument allowed, denied, and error paths."
      ],
      followups: [
        "What if Redis is slow or down?",
        "How do you avoid one tenant starving another?",
        "How would you rate-limit login differently from reads?"
      ],
      links: [
        { label: "Backpressure", route: "#/glossary/backpressure" },
        { label: "Capacity numbers", route: "#/cheatsheets/capacity-numbers" }
      ]
    },
    {
      id: "booking-consistency-availability",
      title: "Strong consistency vs availability for booking",
      timebox: "30 min",
      prompt: "A booking system must reserve scarce inventory while users search from many regions. Explain where you choose strong consistency, where availability can win, and why.",
      expected: [
        "Split search/browse from reserve/confirm.",
        "Search availability can be cached and slightly stale; checkout verifies against the source of truth.",
        "Use transactions, conditional writes, or scoped locks for scarce inventory.",
        "Use holds with expiry, idempotency keys, and compensating actions for payment failure.",
        "Discuss CAP/PACELC in terms of user impact, not slogans."
      ],
      followups: [
        "What happens during a regional network partition?",
        "How do holds expire without losing money?",
        "Can you still serve search during an inventory-store incident?"
      ],
      links: [
        { label: "CAP/PACELC", route: "#/glossary/cap-pacelc" },
        { label: "State machines", route: "#/cheatsheets/state-machine-invariants" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "Requirements and assumptions",
      "Architecture and API/data model",
      "Correctness and consistency",
      "Scale, reliability, and operations",
      "Communication and trade-off reasoning",
      "LLD handoff or class design"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Names familiar components but leaves correctness, trade-offs, and failure modes under-specified.",
        signals: [
          "Starts drawing before clarifying scope or constraints.",
          "Uses broad phrases like cache, queue, and database without explaining ownership or data flow.",
          "Treats all reads and writes as having the same consistency needs.",
          "Mentions scaling only as add more servers.",
          "LLD answer lists classes but not responsibilities, invariants, or extension points."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Delivers a workable design, explains the main trade-offs, and handles common bottlenecks.",
        signals: [
          "Clarifies functional and non-functional requirements before picking components.",
          "Separates hot paths from background work and read paths from write paths.",
          "Uses caching, queues, partitioning, idempotency, and transactions in the places they fit.",
          "Calls out key failure modes and basic metrics.",
          "LLD answer has cohesive classes, interfaces for policies, and a scenario walkthrough."
        ]
      },
      {
        id: "senior",
        title: "Senior",
        summary: "Makes the design operable: explicit invariants, blast-radius control, migration paths, and measurable reliability.",
        signals: [
          "States the system's invariants and protects them with concrete mechanisms.",
          "Explains why some paths are strongly consistent while others are eventually consistent.",
          "Designs overload behavior, degradation modes, retries, DLQs, replay, and backpressure.",
          "Defines SLOs, p99 targets, dashboards, alert signals, launch gates, and rollback plans.",
          "LLD answer is testable, extensible, concurrency-aware, and maps cleanly from the HLD."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "hld-flow",
      title: "HLD 7-step interview flow",
      summary: "A repeatable loop for avoiding random component dumps.",
      items: [
        "1. Clarify functional scope: users, core actions, in/out of scope.",
        "2. Clarify non-functional goals: scale, latency, availability, consistency, durability, privacy.",
        "3. Estimate traffic and data roughly enough to expose hot paths.",
        "4. Define APIs and data model around ownership boundaries.",
        "5. Draw the high-level architecture and label sync vs async paths.",
        "6. Deep dive on the riskiest part: correctness, scale, or failure mode.",
        "7. Close with bottlenecks, observability, launch plan, and LLD handoff."
      ]
    },
    {
      id: "capacity-numbers",
      title: "Capacity-estimation numbers",
      summary: "Order-of-magnitude anchors for interview math.",
      items: [
        "QPS = requests per day / 86,400. Peak QPS often starts at 3x-10x average.",
        "Storage per day = writes per day x average record size x replication factor.",
        "Bandwidth = QPS x response size; separate upload and download paths.",
        "p99 matters more than average for user-visible latency under load.",
        "Cache hit rate changes backend load sharply: 95% hit rate means only 5% reaches origin.",
        "Queue depth and drain rate tell you how long a spike takes to recover."
      ]
    },
    {
      id: "consistency-cache-queue",
      title: "Consistency, cache, and queue patterns",
      summary: "Quick chooser for common distributed-system moves.",
      items: [
        "Strong consistency: scarce inventory, money movement, authorization decisions, uniqueness constraints.",
        "Eventual consistency: feeds, counters, search indexes, notifications, analytics, presence.",
        "Cache-aside: app reads cache, falls back to DB, then fills cache.",
        "Write-through/write-behind: use when cache update behavior must be part of the write path.",
        "Cache stampede controls: jittered TTL, single-flight rebuild, stale-while-revalidate, request coalescing.",
        "Queue pattern: accept work durably, process with idempotent workers, monitor lag, use DLQ/replay for poison messages."
      ]
    },
    {
      id: "lld-class-design",
      title: "LLD class-design checklist",
      summary: "Use this after identifying nouns and verbs.",
      items: [
        "Name entities, value objects, services, repositories, and policies separately.",
        "Give every class one reason to change; keep state and behavior together where invariants live.",
        "Use interfaces for policies that vary: pricing, scheduling, assignment, retry, conflict resolution.",
        "Prefer composition over inheritance unless the is-a relationship is stable and behaviorally substitutable.",
        "Walk one happy path and two edge paths through methods and collaborators.",
        "Call out concurrency: shared mutable state, locks/transactions, idempotency, and test seams."
      ]
    },
    {
      id: "state-machine-invariants",
      title: "State machine and invariant checklist",
      summary: "The fastest way to make workflows precise.",
      items: [
        "List states as nouns/adjectives: QUEUED, SENDING, PAID, CANCELLED, EXPIRED.",
        "List transitions as verbs/events: reserve, authorize, confirm, expire, refund.",
        "Define illegal transitions and what error they return.",
        "Write invariants first: one confirmed ticket per seat, balance never negative, car cannot move with doors open.",
        "Persist state after every side effect boundary so retries resume safely.",
        "Emit events on transitions, not on vague method calls."
      ]
    }
  ],

  glossary: [
    {
      id: "slo",
      term: "SLO",
      definition: "Service Level Objective: the reliability target a service promises for a measured user journey, such as 99.9% successful checkout requests under a latency threshold.",
      useIt: "Use SLOs to decide when to ship, rollback, degrade, or spend reliability work.",
      links: [
        { label: "Reliability rubric", route: "#/rubrics" },
        { label: "SLO lesson", route: "#/hld/reliability/slo-error-budgets" }
      ]
    },
    {
      id: "p99",
      term: "p99",
      definition: "The 99th percentile latency: 99% of requests are faster than this value, and 1% are slower.",
      useIt: "Use p99 for user-visible paths because averages hide painful tail latency.",
      links: [
        { label: "Capacity numbers", route: "#/cheatsheets/capacity-numbers" },
        { label: "Chat scenario", route: "#/scenarios/chat-system-under-load" }
      ]
    },
    {
      id: "qps",
      term: "QPS",
      definition: "Queries per second, used as shorthand for request rate even when the request is not literally a database query.",
      useIt: "Estimate average and peak QPS to identify hot paths and size caches, queues, and databases.",
      links: [
        { label: "Capacity numbers", route: "#/cheatsheets/capacity-numbers" }
      ]
    },
    {
      id: "idempotency",
      term: "Idempotency",
      definition: "A retry-safe operation where repeating the same request has the same effect as doing it once.",
      useIt: "Use idempotency keys for checkout, payment, ticket issuance, queue workers, and API retries.",
      links: [
        { label: "Ticket marketplace", route: "#/scenarios/ticket-marketplace-flash-sale" },
        { label: "Idempotent workflow", route: "#/lld/practice/case-idempotent-workflow" }
      ]
    },
    {
      id: "saga",
      term: "Saga",
      definition: "A distributed workflow made of local transactions plus compensating actions when a later step fails.",
      useIt: "Use a saga when reserve -> pay -> confirm spans services and cannot be one database transaction.",
      links: [
        { label: "Ticket marketplace", route: "#/scenarios/ticket-marketplace-flash-sale" },
        { label: "State machines", route: "#/cheatsheets/state-machine-invariants" }
      ]
    },
    {
      id: "shard",
      term: "Shard",
      definition: "A horizontal partition of data or traffic, usually selected by a key such as tenant_id, user_id, or event_id.",
      useIt: "Use shards to spread load and limit blast radius, but plan routing, rebalancing, and cross-shard queries.",
      links: [
        { label: "SaaS isolation", route: "#/scenarios/multi-tenant-saas-isolation" },
        { label: "Database scaling", route: "#/hld/data/sharding" }
      ]
    },
    {
      id: "cache-stampede",
      term: "Cache stampede",
      definition: "A burst where many requests miss or expire the same hot cache key and all rebuild it at once.",
      useIt: "Prevent with jittered TTLs, single-flight rebuilds, stale-while-revalidate, and request coalescing.",
      links: [
        { label: "Cache patterns", route: "#/cheatsheets/consistency-cache-queue" },
        { label: "Caching basics", route: "#/hld/caching/caching-basics" }
      ]
    },
    {
      id: "backpressure",
      term: "Backpressure",
      definition: "A control that slows or rejects upstream work when downstream systems cannot keep up.",
      useIt: "Use backpressure before queues grow without bound or slow consumers pull the system down.",
      links: [
        { label: "Chat scenario", route: "#/scenarios/chat-system-under-load" },
        { label: "Reliability lesson", route: "#/hld/reliability/circuit-breakers-backpressure" }
      ]
    },
    {
      id: "state-machine",
      term: "State machine",
      definition: "A model of explicit states and allowed transitions for an object or workflow.",
      useIt: "Use state machines for booking, payments, holds, vending machines, elevators, and sync operations.",
      links: [
        { label: "State checklist", route: "#/cheatsheets/state-machine-invariants" },
        { label: "LLD extension", route: "#/scenarios/lld-elevator-vending-extension" }
      ]
    },
    {
      id: "invariant",
      term: "Invariant",
      definition: "A rule that must always remain true if the system is correct.",
      useIt: "Name invariants before mechanisms: no double-sell, no negative balance, one active hold per seat.",
      links: [
        { label: "State checklist", route: "#/cheatsheets/state-machine-invariants" },
        { label: "Senior rubric", route: "#/rubrics" }
      ]
    },
    {
      id: "cap-pacelc",
      term: "CAP/PACELC",
      definition: "CAP frames consistency vs availability during partitions. PACELC adds the normal-case trade-off: else, latency vs consistency.",
      useIt: "Use it to justify why booking needs strong consistency while search, feeds, and counters can be eventually consistent.",
      links: [
        { label: "Booking prompt", route: "#/interview/booking-consistency-availability" },
        { label: "Consistency patterns", route: "#/cheatsheets/consistency-cache-queue" }
      ]
    }
  ]
};
