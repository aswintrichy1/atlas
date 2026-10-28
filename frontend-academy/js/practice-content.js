/* Pixel practice reference — scenario packs, interview prompts, rubrics,
   cheat sheets, and glossary for the practice hub. Every `route` here must
   resolve to a real lesson in window.TRACKS. */
window.PixelPractice = {
  nav: [
    {
      id: "scenarios",
      route: "#/scenarios",
      title: "Scenario packs",
      label: "Design walkthroughs",
      color: "#ec4899",
      icon: "map",
      summary: "Outlines you can talk through end to end for the frontend design and debugging problems that come up most."
    },
    {
      id: "interview",
      route: "#/interview",
      title: "Interview prompts",
      label: "Timed practice",
      color: "#38bdf8",
      icon: "quiz",
      summary: "Timed prompts with what an interviewer listens for and the follow-ups they push on."
    },
    {
      id: "rubrics",
      route: "#/rubrics",
      title: "Rubrics",
      label: "Score yourself",
      color: "#34d399",
      icon: "star",
      summary: "The dimensions a frontend round is scored on, and what each band sounds like."
    },
    {
      id: "cheatsheets",
      route: "#/cheatsheets",
      title: "Cheat sheets",
      label: "Fast recall",
      color: "#fbbf24",
      icon: "md",
      summary: "Thresholds, hook rules, query priorities and rendering choices worth having in memory."
    },
    {
      id: "glossary",
      route: "#/glossary",
      title: "Glossary",
      label: "Say it precisely",
      color: "#818cf8",
      icon: "lesson",
      summary: "The terms you will be expected to use correctly, with the sentence that shows you mean it."
    }
  ],

  scenarios: [
    {
      id: "slow-product-page",
      title: "The product page is slow on phones",
      subtitle: "A performance investigation from metrics to fixes.",
      timebox: "35 min",
      prompt: "Field data shows a product page with LCP of 4.8 s and INP of 450 ms on mid-range Android phones. Walk through how you diagnose and fix it.",
      related: [
        { label: "Core Web Vitals", route: "#/perf/vitals/core-web-vitals" },
        { label: "LCP: images and fonts", route: "#/perf/vitals/lcp-images-fonts" },
        { label: "Eliminating waterfalls", route: "#/perf/loading/waterfalls" }
      ],
      outline: [
        {
          title: "Measure before touching code",
          items: [
            "Confirm with field data at the 75th percentile, then reproduce in the lab with CPU and network throttling.",
            "Identify the LCP element and split its time into TTFB, load delay, load time and render delay."
          ]
        },
        {
          title: "Fix LCP",
          items: [
            "Make the hero image discoverable in HTML with high fetch priority, responsive sizes and modern formats.",
            "Remove request waterfalls: fetch on the server, start independent requests in parallel, stream slow sections.",
            "Self-host fonts with swap and matched fallback metrics."
          ]
        },
        {
          title: "Fix INP",
          items: [
            "Profile the slow interactions; find long tasks from hydration, third-party scripts or heavy handlers.",
            "Defer third parties, code-split heavy widgets, and mark non-urgent updates as transitions.",
            "Reduce what hydrates: server components for static parts, client components only at the leaves."
          ]
        },
        {
          title: "Keep it fixed",
          items: [
            "Bundle-size budgets in CI and real-user monitoring with alerts on regressions."
          ]
        }
      ]
    },
    {
      id: "design-autocomplete",
      title: "Design a search autocomplete",
      subtitle: "The most common frontend system design prompt.",
      timebox: "40 min",
      prompt: "Design the autocomplete for a large store's search box: suggestions as you type, keyboard and screen reader friendly, fast on slow networks.",
      related: [
        { label: "Autocomplete breakdown", route: "#/sd/breakdowns/sd-autocomplete" },
        { label: "ARIA when needed", route: "#/a11y/foundations/aria-when-needed" },
        { label: "Server state", route: "#/state/global/server-state" }
      ],
      outline: [
        {
          title: "Requirements",
          items: [
            "Minimum query length, number of suggestions, recent searches, highlighting, mobile behaviour.",
            "Non-functional: suggestions within about 150 ms of a pause, works offline with recents, fully accessible."
          ]
        },
        {
          title: "Architecture and API",
          items: [
            "Input, popup listbox, option components; state for query, results, active index, open.",
            "GET /suggest?q=…&limit=8 returning ids, labels and highlight ranges; cache headers for popular prefixes."
          ]
        },
        {
          title: "Correctness and speed",
          items: [
            "Debounce, cache by query, abort stale requests, ignore responses that do not match the latest query.",
            "Prefetch popular prefixes; keep the input responsive with transitions for heavy result rendering."
          ]
        },
        {
          title: "Accessibility",
          items: [
            "Combobox pattern: aria-expanded, aria-controls, aria-activedescendant, arrow keys, Enter, Escape.",
            "Announce result counts with a polite live region."
          ]
        }
      ]
    },
    {
      id: "rendering-choice",
      title: "Choose rendering for a new storefront",
      subtitle: "A Next.js architecture discussion.",
      timebox: "30 min",
      prompt: "A retailer is moving to Next.js. Pages: home, category listings, product detail, search, cart and account. Choose a rendering strategy for each and justify it.",
      related: [
        { label: "CSR, SSR, SSG and ISR", route: "#/next/strategies/csr-ssr-ssg-isr" },
        { label: "Server components", route: "#/next/rsc/server-components" },
        { label: "Streaming with Suspense", route: "#/next/rsc/streaming-suspense" }
      ],
      outline: [
        {
          title: "Map each page to freshness, personalization and SEO",
          items: [
            "Home and categories: static with revalidation; product detail: ISR with on-demand revalidation on price change.",
            "Search: dynamic server rendering with streaming; cart and account: per-request and personalized."
          ]
        },
        {
          title: "Component boundaries",
          items: [
            "Server components for content and data; client components for add-to-cart, filters and the mini-cart.",
            "Stream reviews and recommendations behind Suspense with reserved-space skeletons."
          ]
        },
        {
          title: "Mutations and caching",
          items: [
            "Server actions with auth, validation and targeted revalidation.",
            "Explicit cache settings per fetch; per-request dedup with React cache."
          ]
        }
      ]
    },
    {
      id: "xss-incident",
      title: "A stored XSS report on user profiles",
      subtitle: "An incident-style security scenario.",
      timebox: "25 min",
      prompt: "A researcher reports that a crafted profile bio runs script for anyone viewing the profile. Contain it, fix it and prevent the class of bug.",
      related: [
        { label: "Cross-site scripting", route: "#/sec/threats/xss" },
        { label: "Content Security Policy", route: "#/sec/threats/csp" },
        { label: "CSRF, cookies and tokens", route: "#/sec/threats/csrf-cookies" }
      ],
      outline: [
        {
          title: "Contain",
          items: [
            "Find the sink (raw HTML rendering of the bio) and ship a hotfix that renders it as text.",
            "Search stored bios for payloads; invalidate sessions if session theft is possible."
          ]
        },
        {
          title: "Fix properly",
          items: [
            "If rich text is required, sanitize with a maintained allow-list sanitizer on render.",
            "Validate URL schemes for links; keep session cookies HttpOnly, Secure and SameSite."
          ]
        },
        {
          title: "Prevent the class",
          items: [
            "Lint rule flagging raw HTML sinks; review checklist; nonce-based CSP in report-only, then enforced."
          ]
        }
      ]
    }
  ],

  interview: [
    {
      id: "react-rendering-20",
      title: "How React renders, in 20 minutes",
      timebox: "20 min",
      prompt: "Explain what happens from a setState call to pixels on screen, and how you would stop unnecessary re-renders.",
      expected: [
        "Describes trigger, render (call components, diff) and commit (DOM mutations), then effects.",
        "Explains that a parent render re-renders children by default and how keys preserve identity.",
        "Prefers structural fixes (move state down, children as props, split context) before memo.",
        "Knows memo needs stable props, and when useMemo and useCallback actually pay."
      ],
      followups: [
        "Why might a memoized child still re-render on every keystroke?",
        "What changes when an optimizing compiler memoizes automatically?"
      ],
      links: [
        { label: "Render and commit", route: "#/react/tree/render-commit" },
        { label: "Memoization that pays", route: "#/perf/runtime/memoization" }
      ]
    },
    {
      id: "state-management-25",
      title: "State management in 25 minutes",
      timebox: "25 min",
      prompt: "How do you decide where state lives in a large React application? Walk through a dashboard with filters, server data and a multi-step form.",
      expected: [
        "Classifies state: server, URL, form, local UI and shared client state.",
        "Uses a query cache for server data with keys, staleness and invalidation.",
        "Puts filters in the URL so links and refreshes preserve them.",
        "Keeps local state colocated and uses small stores or split contexts for the rest."
      ],
      followups: [
        "Two components show the same user and one updates it. How do both stay in sync?",
        "When would you reach for a reducer over several useState calls?"
      ],
      links: [
        { label: "Where state lives", route: "#/state/local/where-state-lives" },
        { label: "Server state", route: "#/state/global/server-state" },
        { label: "State architecture at scale", route: "#/sd/framework/sd-state-architecture" }
      ]
    },
    {
      id: "accessibility-20",
      title: "Accessible components in 20 minutes",
      timebox: "20 min",
      prompt: "Build an accessible modal dialog and a custom dropdown. What must each do for keyboard and screen reader users?",
      expected: [
        "Prefers native elements (dialog, select, button) and explains what ARIA adds and does not add.",
        "Covers focus in on open, containment, Escape to close and focus restore.",
        "Names the combobox or listbox pattern with arrow keys and aria-activedescendant or roving tabindex.",
        "Mentions testing by keyboard, with a screen reader and with automated checks."
      ],
      followups: [
        "Why is role=\"button\" on a div not enough?",
        "How do you announce a validation error without moving focus?"
      ],
      links: [
        { label: "Keyboard and focus", route: "#/a11y/interaction/keyboard-focus" },
        { label: "ARIA when needed", route: "#/a11y/foundations/aria-when-needed" }
      ]
    },
    {
      id: "news-feed-40",
      title: "Design a news feed in 40 minutes",
      timebox: "40 min",
      prompt: "Design the frontend of an infinite news feed with images, likes, comments and live updates.",
      expected: [
        "States requirements and non-functional goals with numbers.",
        "Defines entities and a cursor-paginated API.",
        "Virtualizes the list, sizes media, prefetches the next page.",
        "Uses optimistic likes with rollback, and a new-posts pill with scroll anchoring.",
        "Covers accessibility (articles, focus after load more) and monitoring."
      ],
      followups: [
        "How do you keep a post's like count consistent when it appears in two views?",
        "What changes if the feed must work offline?"
      ],
      links: [
        { label: "News feed breakdown", route: "#/sd/breakdowns/sd-news-feed" },
        { label: "Mutations and cache", route: "#/state/global/mutations-cache" }
      ]
    },
    {
      id: "testing-15",
      title: "Testing strategy in 15 minutes",
      timebox: "15 min",
      prompt: "You join a team with flaky end-to-end tests and almost no component tests. What testing strategy do you propose?",
      expected: [
        "Explains the testing trophy and testing behaviour over implementation.",
        "Adds integration tests with Testing Library and network-level mocks.",
        "Keeps a few end-to-end tests for critical journeys with auto-waiting assertions and isolated data.",
        "Quarantines flaky tests and adds static checks and CI gates."
      ],
      followups: [
        "Which query would you use to find a button, and why?",
        "How would you test a debounced search input?"
      ],
      links: [
        { label: "Testing strategy", route: "#/test/strategy/test-strategy" },
        { label: "Testing Library", route: "#/test/components/rtl" }
      ]
    }
  ],

  rubrics: {
    dimensions: [
      "React fundamentals — rendering, hooks, state placement",
      "Data and architecture — server state, rendering strategy, APIs",
      "Performance — Core Web Vitals, bundles, waterfalls, runtime",
      "Accessibility — semantics, keyboard, focus, announcements",
      "Quality and security — testing strategy, XSS, CSP, delivery",
      "Communication and trade-off reasoning"
    ],
    bands: [
      {
        id: "beginner",
        title: "Beginner",
        summary: "Knows the APIs but not why they behave the way they do.",
        signals: [
          "Uses effects to derive state and to respond to user events.",
          "Puts all state in one global store, including server data.",
          "Talks about speed without metrics or thresholds.",
          "Builds clickable divs and removes focus outlines."
        ]
      },
      {
        id: "competent",
        title: "Competent",
        summary: "Builds solid features with sensible state and accessible basics, but misses system-level trade-offs.",
        signals: [
          "Colocates state and uses a query cache for server data.",
          "Knows LCP, INP and CLS and the common fixes.",
          "Uses semantic elements and labelled forms.",
          "Writes Testing Library tests that query by role."
        ]
      },
      {
        id: "strong",
        title: "Strong",
        summary: "Designs the whole client: rendering, data, performance, accessibility and safety, with clear trade-offs.",
        signals: [
          "Chooses rendering strategy per route and places the client boundary at the leaves.",
          "Eliminates waterfalls, streams slow sections and sets performance budgets.",
          "Handles race conditions, optimistic updates and failure modes explicitly.",
          "Treats every server action as a public endpoint and uses a strict CSP."
        ]
      }
    ]
  },

  cheatsheets: [
    {
      id: "vitals",
      title: "Core Web Vitals thresholds",
      summary: "Good at the 75th percentile of real users.",
      items: [
        "LCP ≤ 2.5 s (poor above 4 s).",
        "INP ≤ 200 ms (poor above 500 ms).",
        "CLS ≤ 0.1 (poor above 0.25).",
        "Never lazy-load the LCP image; give it high fetch priority.",
        "Reserve space for images, ads and embeds; animate transform and opacity."
      ]
    },
    {
      id: "hooks",
      title: "Hook rules and effect checklist",
      summary: "What to check before writing useEffect.",
      items: [
        "Hooks only at the top level of components and custom hooks.",
        "Can it be computed during render? Then it is not an effect.",
        "Is it a response to a user action? Put it in the event handler.",
        "Syncing with an external system? Effect with cleanup and complete dependencies.",
        "Depend on primitives; use functional updates to shrink dependency lists."
      ]
    },
    {
      id: "queries",
      title: "Testing Library query priority",
      summary: "Query the way users perceive the page.",
      items: [
        "1. getByRole with a name.",
        "2. getByLabelText for form fields.",
        "3. getByPlaceholderText, getByText, getByDisplayValue.",
        "4. getByAltText, getByTitle.",
        "5. getByTestId as a last resort.",
        "getBy = present now, queryBy = assert absence, findBy = wait for it."
      ]
    },
    {
      id: "rendering",
      title: "Rendering strategy picker",
      summary: "Freshness, personalization, SEO.",
      items: [
        "Rarely changes, same for everyone: SSG.",
        "Changes on a schedule, shared: ISR or revalidated static.",
        "Fresh per request or personalized and SEO-relevant: SSR with streaming.",
        "Behind login, no SEO: CSR or server-rendered per request.",
        "Client components at the leaves; pass minimal serialized props."
      ]
    },
    {
      id: "a11y",
      title: "Accessibility quick checks",
      summary: "Five minutes before every merge.",
      items: [
        "Tab through: every control reachable, focus visible, order matches layout.",
        "Every input has a visible label; errors linked with aria-describedby.",
        "Icon-only buttons have accessible names.",
        "Text contrast at least 4.5:1, UI at least 3:1.",
        "Respect prefers-reduced-motion."
      ]
    }
  ],

  glossary: [
    {
      id: "hydration",
      term: "Hydration",
      definition: "React running components in the browser to attach event handlers and state to HTML that was rendered on the server.",
      useIt: "Say what it costs: the page looks ready before it responds, and every hydrated component ships JavaScript.",
      links: [{ label: "Hydration", route: "#/next/strategies/hydration" }]
    },
    {
      id: "rsc",
      term: "React Server Components",
      definition: "Components that render only on the server, can read data directly and ship no client JavaScript.",
      useIt: "Pair it with where you put the 'use client' boundary and what crosses it serialized.",
      links: [{ label: "Server components", route: "#/next/rsc/server-components" }]
    },
    {
      id: "waterfall",
      term: "Request waterfall",
      definition: "A chain of requests where each starts only after the previous one finishes, even though it did not need to.",
      useIt: "Name the fix: start independent work together, fetch higher in the tree, or join on the server.",
      links: [{ label: "Eliminating waterfalls", route: "#/perf/loading/waterfalls" }]
    },
    {
      id: "derived-state",
      term: "Derived state",
      definition: "A value that can be computed from existing props or state and therefore should not be stored separately.",
      useIt: "Say you compute it during render, and memoize only if the computation is expensive.",
      links: [{ label: "Reducers and derived state", route: "#/state/local/reducers-derived" }]
    },
    {
      id: "server-state",
      term: "Server state",
      definition: "Data owned by a remote source that the client caches temporarily and must keep fresh.",
      useIt: "Contrast it with client state and mention keys, staleness and invalidation.",
      links: [{ label: "Server state", route: "#/state/global/server-state" }]
    },
    {
      id: "compound",
      term: "Compound components",
      definition: "A set of components that work together through shared context, such as Tabs with Tabs.List and Tabs.Panel.",
      useIt: "Use it as the alternative to a component with a dozen boolean props.",
      links: [{ label: "Compound components", route: "#/comp/patterns/compound-components" }]
    },
    {
      id: "inp",
      term: "Interaction to Next Paint (INP)",
      definition: "A Core Web Vital measuring the delay from a user interaction to the next frame, across the whole visit.",
      useIt: "Tie it to long tasks on the main thread and the fixes: yield, transitions, less hydration.",
      links: [{ label: "INP and CLS", route: "#/perf/vitals/inp-cls" }]
    },
    {
      id: "accessible-name",
      term: "Accessible name",
      definition: "The text assistive technology announces for an element, computed from its content, label or ARIA attributes.",
      useIt: "Mention it when testing: getByRole('button', { name }) fails if the name is missing.",
      links: [{ label: "Semantic HTML first", route: "#/a11y/foundations/semantic-first" }]
    },
    {
      id: "csp",
      term: "Content Security Policy",
      definition: "A response header telling the browser which sources of script and other resources the page may use.",
      useIt: "Call it defence in depth behind correct escaping, and prefer per-request nonces.",
      links: [{ label: "Content Security Policy", route: "#/sec/threats/csp" }]
    },
    {
      id: "event-loop",
      term: "Event loop",
      definition: "The browser's scheduler: run one task, drain all microtasks, then possibly render a frame.",
      useIt: "Use it to explain why a long synchronous task freezes input and why promises run before timers.",
      links: [{ label: "The event loop", route: "#/web/browser/event-loop" }]
    }
  ]
};
