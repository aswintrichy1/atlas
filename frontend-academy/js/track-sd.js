/* =====================================================================
   PIXEL · Frontend System Design
   window.TRACKS.sd — modules: framework / platform / breakdowns
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};
  var ACC = "#f472b6";

  /* ---------- sdAutocomplete: debounce + stale-response guard ---------- */
  Widgets.sdAutocomplete = function (mount) {
    var h = WK.h;
    WK.shell(mount, "race", "Autocomplete: debounce and stale responses",
      "Typing \"react\" fires requests with uneven latency. Change the debounce and toggle cancellation, then press Simulate typing.");
    var KEYS = [
      { q: "r", t: 0, lat: 500 },
      { q: "re", t: 90, lat: 380 },
      { q: "rea", t: 260, lat: 700 },
      { q: "reac", t: 350, lat: 160 },
      { q: "react", t: 600, lat: 200 }
    ];
    var debounce = 0, cancel = false, shownUpTo = Infinity;
    function plan() {
      var reqs = [];
      KEYS.forEach(function (k, i) {
        var next = KEYS[i + 1];
        var fires = !next || next.t - k.t > debounce;
        if (fires) reqs.push({ q: k.q, fire: k.t + debounce, arrive: k.t + debounce + k.lat, aborted: null });
      });
      if (cancel) {
        for (var i = 0; i < reqs.length - 1; i++) {
          if (reqs[i].arrive > reqs[i + 1].fire) reqs[i].aborted = reqs[i + 1].fire;
        }
      }
      var landed = reqs.filter(function (r) { return r.aborted == null; });
      var final = landed.reduce(function (a, r) { return !a || r.arrive >= a.arrive ? r : a; }, null);
      return { reqs: reqs, final: final };
    }
    var input = h("div", { style: "font-family:var(--font-mono);font-size:0.95rem;padding:8px 12px;border-radius:10px;border:1px solid var(--line-strong);background:var(--surface-solid);color:var(--text);min-height:20px;margin-bottom:10px;" }, "react");
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var p = plan();
      var max = 1200;
      WK.clear(stage);
      stage.appendChild(input);
      KEYS.forEach(function (k) {
        var r = p.reqs.filter(function (x) { return x.q === k.q; })[0];
        var visible = k.t <= shownUpTo;
        var track = h("div", { style: "height:14px;border-radius:7px;background:var(--line);position:relative;overflow:hidden;" });
        var label;
        if (!visible) label = "";
        else if (!r) label = "debounced";
        else {
          var end = r.aborted != null ? r.aborted : r.arrive;
          var color = r.aborted != null ? "#94a3b8" : (p.final === r ? (r.q === "react" ? WK.GOOD : WK.BAD) : ACC);
          track.appendChild(h("div", { style: "position:absolute;top:0;bottom:0;left:" + (r.fire / max * 100) + "%;width:" + (Math.max(1, end - r.fire) / max * 100) + "%;" + WK.tint(color, 45) + "border-radius:7px;" }));
          label = r.aborted != null ? "aborted @" + r.aborted : "lands @" + r.arrive;
        }
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:70px 1fr 110px;gap:10px;align-items:center;margin-bottom:6px;" },
          h("span", { style: "font-family:var(--font-mono);font-size:0.82rem;color:var(--text);" }, visible ? "\"" + k.q + "\"" : "…"),
          track,
          h("span", { style: "font-family:var(--font-mono);font-size:0.76rem;color:var(--text-dim);text-align:right;" }, label)));
      });
      if (shownUpTo === Infinity && p.final) {
        var stale = p.final.q !== "react";
        stage.appendChild(h("div", { style: WK.tint(stale ? WK.BAD : WK.GOOD, 16) + "border-radius:10px;padding:8px 12px;margin-top:8px;font-size:0.86rem;" },
          stale ? "Stale! The input says \"react\" but the list shows results for \"" + p.final.q + "\", because that slower response landed last."
                : "Correct: the list shows results for \"react\"."));
      }
      WK.readout(readout, [["requests sent", p.reqs.length + " / 5"], ["aborted", p.reqs.filter(function (r) { return r.aborted != null; }).length], ["final results for", p.final ? "\"" + p.final.q + "\"" : "—"], ["settled at", p.final ? p.final.arrive + " ms" : "—"]]);
    }
    function simulate() {
      shownUpTo = -1;
      input.textContent = "";
      paint();
      KEYS.forEach(function (k) {
        setTimeout(function () {
          if (!mount.isConnected) return;
          input.textContent = k.q;
          shownUpTo = k.t;
          paint();
        }, k.t);
      });
      setTimeout(function () { if (!mount.isConnected) return; shownUpTo = Infinity; paint(); }, 1300);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([[0, "no debounce"], [150, "debounce 150 ms"], [300, "debounce 300 ms"]], 0, function (v) { debounce = v; shownUpTo = Infinity; paint(); }, "Debounce"),
      WK.toggle("Abort stale requests", false, function (v) { cancel = v; shownUpTo = Infinity; paint(); })));
    mount.appendChild(h("div", { class: "widget-controls" }, WK.btn("Simulate typing", simulate, "primary")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "sd-framework": {
      title: "System design framework checkpoint",
      sub: "Structuring a frontend design interview.",
      questions: [
        { q: "What should you do in the first minutes of a frontend system design interview?", options: ["Start drawing components", "Clarify requirements, users, scope and non-functional goals such as performance, accessibility and offline", "Pick a state library", "Write code"], answer: 1,
          explain: "Requirements drive every later decision. Agree on scope before designing." },
        { q: "Which belongs in the 'entity model and API' step?", options: ["CSS colours", "The data shapes the client holds and the endpoints or contracts that supply them, including pagination", "The CI provider", "The font stack"], answer: 1,
          explain: "Defining entities and the API contract early makes component and state decisions concrete." },
        { q: "Where should server data such as a feed or search results usually live in a React app?", options: ["A global store you sync by hand", "A server-state cache with keys, staleness and invalidation", "Component state copied everywhere", "localStorage"], answer: 1,
          explain: "Server state has different problems (caching, refetching, deduping) than UI state; use a tool built for it." },
        { q: "What distinguishes a strong answer on non-functional requirements?", options: ["Saying 'it should be fast'", "Concrete targets and techniques: performance budgets, accessibility patterns, error and offline handling, observability", "Ignoring them", "Listing frameworks"], answer: 1,
          explain: "Interviewers look for measurable goals tied to specific techniques." }
      ]
    },
    "sd-platform": {
      title: "Frontend platform checkpoint",
      sub: "Design systems and micro-frontends.",
      questions: [
        { q: "What are design tokens?", options: ["Authentication tokens", "Named design decisions (colours, spacing, typography) shared across platforms and themes", "CSS class names", "Build artifacts"], answer: 1,
          explain: "Tokens make the design language data, so themes, platforms and components stay consistent." },
        { q: "What is a good reason to adopt micro-frontends?", options: ["They are always faster", "Many independent teams need to deploy parts of a large product on their own schedules", "A single small team wants a new pattern", "To use more frameworks"], answer: 1,
          explain: "Micro-frontends solve organizational scaling. For one team they mostly add cost." },
        { q: "What is a common micro-frontend pitfall?", options: ["Too few deploys", "Duplicated dependencies and inconsistent UX across fragments", "Too much type safety", "Shared design tokens"], answer: 1,
          explain: "Without a shared design system and dependency strategy, users download React several times and see mismatched UI." },
        { q: "How should a design-system component expose variants?", options: ["Many boolean props", "A small, explicit API such as a variant prop or composable subcomponents", "Inline styles only", "One component per page"], answer: 1,
          explain: "Explicit variants and composition scale better than boolean combinations." },
        { q: "How should breaking changes in a shared component library ship?", options: ["Silently", "With semantic versioning, changelogs, deprecation warnings and codemods where possible", "By editing consumers directly", "Never"], answer: 1,
          explain: "Consumers need notice and a migration path to upgrade safely." }
      ]
    },
    "sd-breakdowns": {
      title: "Design breakdowns checkpoint",
      sub: "Autocomplete and news feed.",
      questions: [
        { q: "In an autocomplete, why must you guard against out-of-order responses?", options: ["Servers always respond in order", "A slower response for an earlier query can arrive last and overwrite the correct results", "To save memory", "It is not needed with debounce"], answer: 1,
          explain: "Debounce reduces requests but does not order responses. Abort stale requests or ignore responses that do not match the latest query." },
        { q: "Which keyboard and ARIA pattern fits an autocomplete?", options: ["A plain div list", "A combobox with a listbox popup, arrow-key navigation and aria-activedescendant", "A dialog", "A table"], answer: 1,
          explain: "The combobox pattern keeps focus in the input while announcing the active option." },
        { q: "What pagination suits an infinite news feed with new posts arriving?", options: ["Offset pagination", "Cursor-based pagination", "Loading everything at once", "Page numbers in the URL only"], answer: 1,
          explain: "Cursors stay stable when items are inserted at the top; offsets skip or duplicate items." },
        { q: "How should a feed keep scrolling smooth with thousands of posts?", options: ["Render all posts", "Virtualize or use content-visibility, lazy-load media and reserve space for it", "Disable images", "Use more effects"], answer: 1,
          explain: "Keep DOM size bounded and avoid layout shifts as media loads." },
        { q: "A user likes a post. What gives the best experience?", options: ["Wait for the server, then update", "An optimistic update with rollback on failure", "Reload the feed", "Show a modal"], answer: 1,
          explain: "Optimistic updates feel instant; rollback and an error message handle failures." },
        { q: "A data grid must support sharing a filtered, sorted view by link. Where should that view state live?", options: ["In a React context", "In the URL search params", "In localStorage only", "In a ref"], answer: 1,
          explain: "URL state survives refreshes and can be shared or bookmarked; components read it as the source of truth." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.sd = {
    id: "sd",
    name: "Frontend System Design",
    short: "FSD",
    tagline: "Design the client like a senior engineer",
    color: ACC,
    blurb: "Put it all together. Use a repeatable framework for frontend design interviews, plan state architecture, build and scale design systems, weigh micro-frontends, and work through full autocomplete and news feed breakdowns with level-by-level scoring.",
    modules: [
      {
        id: "framework",
        name: "Design Framework",
        icon: "compass",
        lessons: [
          {
            id: "sd-framework",
            title: "A framework for frontend system design",
            summary: "Requirements, architecture, data model, API, then deep dives into performance, accessibility and resilience.",
            minutes: 12,
            tags: ["interview", "framework", "requirements"],
            blocks: [
              { t: "p", html: "Frontend design interviews reward <strong>structure</strong>. A repeatable plan keeps you from diving into components before you know what the product must do." },
              { t: "h", text: "The phase plan" },
              { t: "table", headers: ["Phase", "Time", "Output"], rows: [
                ["Requirements", "~5 min", "Users, core features, scope cuts, non-functional goals"],
                ["Architecture", "~10 min", "Component tree, rendering strategy, where state lives"],
                ["Entity model and API", "~10 min", "Client data shapes, endpoints, pagination, real-time"],
                ["Deep dives", "~15 min", "Performance, accessibility, errors, offline, security"],
                ["Wrap-up", "~5 min", "Trade-offs, risks, what you would build next"]
              ] },
              { t: "h", text: "Entity model and API" },
              { t: "code", lang: "javascript", code:
                "// entities the client holds\n" +
                "type Post = { id: string; author: UserRef; body: string; media?: Media[];\n" +
                "              likeCount: number; likedByMe: boolean; createdAt: string };\n\n" +
                "// API contract\n" +
                "GET  /feed?cursor=abc&limit=20  -> { items: Post[]; nextCursor: string | null }\n" +
                "POST /posts/:id/like            -> { likeCount: number; likedByMe: true }" },
              { t: "ul", items: [
                "State non-functional goals as numbers: LCP under 2.5 s on mid-range phones, INP under 200 ms.",
                "Name the rendering strategy per route and justify it.",
                "Separate server state, URL state, form state and UI state.",
                "Cover accessibility explicitly: keyboard, focus, announcements, contrast."
              ] },
              { t: "cue", html: "<strong>Signal to the interviewer:</strong> say out loud which phase you are in and when you are moving on. It shows you manage time and scope." },
              { t: "note", variant: "key", html: "<strong>Requirements, architecture, entities and API, deep dives, trade-offs.</strong> Follow the phase plan and make every decision trace back to a requirement." }
            ]
          },
          {
            id: "sd-state-architecture",
            title: "State architecture at scale",
            summary: "Classify state by owner and lifetime, then pick the simplest home for each kind.",
            minutes: 10,
            tags: ["state", "architecture", "url-state"],
            blocks: [
              { t: "p", html: "Most state bugs in large apps come from putting state in the wrong home: server data copied into a global store, filters lost on refresh, a modal flag in a context that re-renders everything." },
              { t: "table", headers: ["Kind", "Home", "Example"], rows: [
                ["Server state", "Query cache with keys and invalidation", "Feed, profile, search results"],
                ["URL state", "Path and search params", "Filters, sort, selected tab, page"],
                ["Form state", "Form library or local state", "Draft values, validation errors"],
                ["Local UI state", "Component state, colocated", "Open menu, hover"],
                ["Shared client state", "Small store or context, split by concern", "Theme, auth session, cart"]
              ] },
              { t: "compare", bad: { title: "One giant global store", items: ["Server data duplicated and stale", "Every update re-renders broad subtrees", "Hard to know who owns what"] }, good: { title: "State by kind", items: ["Server cache owns remote data", "URL owns shareable view state", "Local state stays local"] } },
              { t: "note", variant: "tip", html: "If a user would expect a refresh or a shared link to keep it, it belongs in the URL." },
              { t: "quiz", id: "sd-framework" },
              { t: "note", variant: "key", html: "<strong>Classify state, then give each kind its natural home.</strong> Server cache, URL, form, local, and a small shared store for what is left." }
            ]
          }
        ]
      },
      {
        id: "platform",
        name: "Frontend Platform",
        icon: "blocks",
        lessons: [
          {
            id: "design-systems",
            title: "Design systems that scale",
            summary: "Tokens, accessible primitives, composable components, versioning and adoption.",
            minutes: 11,
            tags: ["design-system", "tokens", "components"],
            blocks: [
              { t: "p", html: "A design system is a product for other engineers: <strong>tokens</strong> encode decisions, <strong>primitives</strong> handle accessibility and behaviour, and <strong>components</strong> compose them into the patterns teams use daily." },
              { t: "code", lang: "text", code:
                "/* tokens: decisions as data, themed via custom properties */\n" +
                ":root {\n" +
                "  --color-bg: #ffffff;   --color-text: #1f2937;\n" +
                "  --color-accent: #db2777;\n" +
                "  --space-2: 8px;  --space-4: 16px;  --radius-md: 8px;\n" +
                "}\n" +
                "[data-theme=\"dark\"] { --color-bg: #0b0b12; --color-text: #e5e7eb; }" },
              { t: "table", headers: ["Layer", "Responsibility", "Example"], rows: [
                ["Tokens", "Colour, spacing, type, motion", "--color-accent, --space-4"],
                ["Primitives", "Behaviour and accessibility, unstyled or lightly styled", "Dialog, Popover, Listbox"],
                ["Components", "Opinionated, composable building blocks", "Button, Select, Card"],
                ["Patterns", "Documented recipes", "Empty states, forms, data tables"]
              ] },
              { t: "ul", items: [
                "Prefer explicit variants and compound components over boolean props.",
                "Every component ships stories for each state and an accessibility test.",
                "Version with semver, document changes, deprecate before removing, provide codemods.",
                "Measure adoption; a system nobody uses is a cost."
              ] },
              { t: "h", text: "A component API that ages well" },
              { t: "code", lang: "javascript", code:
                "// explicit variants + composition instead of boolean flags\n" +
                "<Button variant=\"primary\" size=\"md\" loading={saving}>Save</Button>\n\n" +
                "<Dialog.Root>\n" +
                "  <Dialog.Trigger asChild><Button variant=\"ghost\">Delete</Button></Dialog.Trigger>\n" +
                "  <Dialog.Content>\n" +
                "    <Dialog.Title>Delete project?</Dialog.Title>\n" +
                "    <Dialog.Actions>\n" +
                "      <Dialog.Close asChild><Button variant=\"ghost\">Cancel</Button></Dialog.Close>\n" +
                "      <Button variant=\"danger\" onClick={remove}>Delete</Button>\n" +
                "    </Dialog.Actions>\n" +
                "  </Dialog.Content>\n" +
                "</Dialog.Root>" },
              { t: "table", headers: ["Concern", "Decision"], rows: [
                ["Styling approach", "CSS custom properties for tokens so themes switch without re-rendering"],
                ["Escape hatches", "className and asChild composition, not dozens of style props"],
                ["Accessibility", "Built into primitives once: focus, roles, keyboard; tested per component"],
                ["Distribution", "Versioned package with changelog, or source in a monorepo with codeowners"],
                ["Governance", "A contribution path, design review, and adoption metrics"]
              ] },
              { t: "cue", html: "<strong>Interview signal:</strong> when asked to build a component library, talk about the API, accessibility and versioning before colours and spacing." },
              { t: "note", variant: "key", html: "<strong>Tokens, accessible primitives, composable components, careful versioning.</strong> Treat the design system as a product with users." }
            ]
          },
          {
            id: "micro-frontends",
            title: "Micro-frontends: when and how",
            summary: "Independent deploys for independent teams — and the costs you sign up for.",
            minutes: 10,
            tags: ["micro-frontends", "module-federation", "monorepo"],
            blocks: [
              { t: "p", html: "Micro-frontends split one product into fragments owned and deployed by different teams, composed at build time, on the server or in the browser by a <strong>shell</strong>." },
              { t: "diagram", id: "mfe-shell", caption: "A shell owns routing, auth and the design system; team-owned fragments load per route and share only well-defined contracts." },
              { t: "table", headers: ["Composition", "How", "Trade-off"], rows: [
                ["Build-time packages", "Fragments published as packages", "Simple, but deploys are coupled"],
                ["Server-side", "Edge or server stitches HTML", "Fast first paint; more infrastructure"],
                ["Runtime (federation)", "Shell loads remote bundles", "Independent deploys; version and dependency risk"]
              ] },
              { t: "compare", bad: { title: "Micro-frontends too early", items: ["One team, many repos and pipelines", "React downloaded several times", "Inconsistent UX between fragments"] }, good: { title: "Micro-frontends that pay", items: ["Many teams blocked on one release train", "Shared design system and singleton deps", "Clear contracts: routes, events, auth"] } },
              { t: "note", variant: "tip", html: "A well-structured monorepo with clear ownership often delivers most of the benefit with far less runtime complexity." },
              { t: "h", text: "Contracts between fragments" },
              { t: "table", headers: ["Contract", "Rule"], rows: [
                ["Routing", "The shell owns top-level routes; fragments own their sub-routes"],
                ["Shared dependencies", "React and the design system as singletons with agreed version ranges"],
                ["Communication", "Typed custom events or URL state; no reaching into another fragment's store"],
                ["Auth", "The shell provides session and tokens; fragments never store credentials"],
                ["Failure", "Each fragment sits in an error boundary with a fallback; one failing team never blanks the page"],
                ["Performance", "Per-fragment bundle budgets, measured in the composed page"]
              ] },
              { t: "code", lang: "javascript", code:
                "// shell: load a remote fragment lazily, isolate its failures\n" +
                "const Checkout = lazy(() => import(\"checkout/App\"));   // resolved by the federation runtime\n\n" +
                "<ErrorBoundary fallback={<CheckoutUnavailable />}>\n" +
                "  <Suspense fallback={<PageSkeleton />}>\n" +
                "    <Checkout session={session} onOrderPlaced={(id) => navigate(`/orders/${id}`)} />\n" +
                "  </Suspense>\n" +
                "</ErrorBoundary>" },
              { t: "quiz", id: "sd-platform" },
              { t: "note", variant: "key", html: "<strong>Micro-frontends solve team scaling, not performance.</strong> Adopt them when independent deploys matter, and invest in a shared shell, design system and contracts." }
            ]
          }
        ]
      },
      {
        id: "breakdowns",
        name: "Design Breakdowns",
        icon: "map",
        lessons: [
          {
            id: "sd-autocomplete",
            title: "Breakdown: search autocomplete",
            summary: "Debounce, caching, race conditions, keyboard navigation and accessible announcements.",
            minutes: 13,
            tags: ["autocomplete", "combobox", "race-conditions"],
            blocks: [
              { t: "p", html: "Requirements: suggestions appear as the user types, results are relevant to the <em>current</em> input, it works by keyboard and screen reader, and it stays fast on slow networks." },
              { t: "widget", id: "sdAutocomplete" },
              { t: "table", headers: ["Concern", "Naive", "Solid", "Standout"], rows: [
                ["Requests", "One per keystroke", "Debounced", "Debounced + cached by query + minimum length"],
                ["Correctness", "Last response wins", "Abort previous request", "Abort + ignore mismatched query + cache hits instant"],
                ["Accessibility", "Clickable div list", "Combobox + listbox roles", "aria-activedescendant, result count announced, Escape closes"],
                ["Resilience", "Silent failure", "Error message", "Offline fallback to recent searches, retry with backoff"]
              ] },
              { t: "code", lang: "javascript", code:
                "useEffect(() => {\n" +
                "  if (query.length < 2) return;\n" +
                "  const ctrl = new AbortController();\n" +
                "  const id = setTimeout(async () => {\n" +
                "    try {\n" +
                "      const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });\n" +
                "      setResults(await res.json());\n" +
                "    } catch (e) { if (e.name !== \"AbortError\") setError(e); }\n" +
                "  }, 150);\n" +
                "  return () => { clearTimeout(id); ctrl.abort(); };   // new keystroke cancels both\n" +
                "}, [query]);" },
              { t: "cue", html: "<strong>Spotting the trap:</strong> when the interviewer asks \"what if the network is slow?\", they are probing for out-of-order responses, not just loading spinners." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Level", "What the answer shows"], rows: [
                ["Mid", "Debounce, loading and empty states, basic list rendering"],
                ["Senior", "Race-condition handling, caching, combobox accessibility, error states"],
                ["Staff", "API and ranking contract, caching layers across client and edge, metrics for relevance and latency, rollout plan"]
              ] },
              { t: "note", variant: "key", html: "<strong>Fewer requests, correct results, full keyboard and screen reader support.</strong> Debounce, abort stale work, cache, and use the combobox pattern." }
            ]
          },
          {
            id: "sd-news-feed",
            title: "Breakdown: news feed",
            summary: "Cursor pagination, virtualization, media loading, optimistic interactions and live updates.",
            minutes: 13,
            tags: ["feed", "pagination", "virtualization", "optimistic"],
            blocks: [
              { t: "p", html: "Requirements: an endless scroll of posts with images, likes and comments; new posts appear without losing the reader's place; smooth on mid-range phones." },
              { t: "table", headers: ["Concern", "Naive", "Solid", "Standout"], rows: [
                ["Pagination", "Offset pages", "Cursor pagination", "Cursor + prefetch next page near the end"],
                ["Rendering", "All posts in the DOM", "Virtualized list", "Virtualized + content-visibility + stable heights"],
                ["Media", "Full-size images eagerly", "Lazy, responsive, sized", "Blur placeholders, priority for the first post, adaptive quality"],
                ["Interactions", "Wait for server", "Optimistic like", "Optimistic + rollback + deduped retries"],
                ["Live updates", "Auto-insert at top", "\"New posts\" pill", "Pill + scroll anchoring + batched updates"]
              ] },
              { t: "code", lang: "javascript", code:
                "const feed = useInfiniteQuery({\n" +
                "  queryKey: [\"feed\"],\n" +
                "  queryFn: ({ pageParam }) => api.feed({ cursor: pageParam, limit: 20 }),\n" +
                "  initialPageParam: null,\n" +
                "  getNextPageParam: (last) => last.nextCursor,\n" +
                "});\n\n" +
                "const like = useMutation({\n" +
                "  mutationFn: api.like,\n" +
                "  onMutate: (id) => patchPost(id, (p) => ({ ...p, likedByMe: true, likeCount: p.likeCount + 1 })),\n" +
                "  onError: (_e, id) => patchPost(id, (p) => ({ ...p, likedByMe: false, likeCount: p.likeCount - 1 })),\n" +
                "});" },
              { t: "cue", html: "<strong>Spotting the depth question:</strong> \"what happens when 50 new posts arrive while I am reading?\" tests scroll anchoring and update batching." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Level", "What the answer shows"], rows: [
                ["Mid", "Infinite scroll with loading states and lazy images"],
                ["Senior", "Cursor pagination, virtualization, optimistic updates, accessibility of the feed (article roles, focus on load more)"],
                ["Staff", "Real-time transport choice, cache normalization across views, performance budgets and monitoring, experimentation on ranking"]
              ] },
              { t: "note", variant: "key", html: "<strong>Cursors, virtualization, sized media, optimistic interactions, anchored live updates.</strong> Each choice should map to a stated requirement." }
            ]
          },
          {
            id: "sd-data-grid",
            title: "Breakdown: a large data grid",
            summary: "Server-driven sorting and filtering, virtualization, URL state, inline editing and an accessible grid.",
            minutes: 13,
            tags: ["data-grid", "virtualization", "url-state", "a11y-grid"],
            blocks: [
              { t: "p", html: "Requirements: an admin table of 200,000 orders with sorting, filtering, column resizing, row selection and inline editing; shareable views; usable by keyboard; smooth on a mid-range laptop." },
              { t: "table", headers: ["Concern", "Naive", "Solid", "Standout"], rows: [
                ["Data volume", "Fetch all rows", "Server pagination, sorting and filtering", "Cursor windows fetched as the viewport scrolls, with prefetch"],
                ["Rendering", "Render every row", "Row virtualization", "Row and column virtualization, fixed row heights, sticky header"],
                ["View state", "Component state", "Filters and sort in the URL", "URL state + saved views per user"],
                ["Editing", "Refetch the page after save", "Optimistic cell update", "Optimistic update, per-cell validation, conflict detection by version"],
                ["Accessibility", "Div soup", "table semantics with sortable headers (aria-sort)", "Grid pattern with roving focus, Enter to edit, Escape to cancel, announced results"]
              ] },
              { t: "code", lang: "javascript", code:
                "// URL is the source of truth for the view\n" +
                "const [params, setParams] = useSearchParams();\n" +
                "const view = { sort: params.get(\"sort\") ?? \"-createdAt\", status: params.get(\"status\") ?? \"all\" };\n\n" +
                "const rows = useInfiniteQuery({\n" +
                "  queryKey: [\"orders\", view],\n" +
                "  queryFn: ({ pageParam }) => api.orders({ ...view, cursor: pageParam, limit: 100 }),\n" +
                "  initialPageParam: null,\n" +
                "  getNextPageParam: (last) => last.nextCursor,\n" +
                "});\n\n" +
                "// header: sortable and announced\n" +
                "<th aria-sort={view.sort === \"total\" ? \"ascending\" : view.sort === \"-total\" ? \"descending\" : \"none\"}>\n" +
                "  <button onClick={() => setParams({ ...view, sort: view.sort === \"total\" ? \"-total\" : \"total\" })}>Total</button>\n" +
                "</th>" },
              { t: "ul", items: [
                "Debounce filter inputs and abort stale requests, exactly as in autocomplete.",
                "Keep selection by row id, not by index, so it survives sorting and paging.",
                "Export large selections on the server; the client only sends the filter.",
                "Measure scroll smoothness and interaction latency with throttled CPU before shipping."
              ] },
              { t: "cue", html: "<strong>Spotting the depth question:</strong> \"what happens when two admins edit the same cell?\" is about optimistic concurrency with version numbers and a clear conflict message." },
              { t: "h", text: "How this scores at each level" },
              { t: "table", headers: ["Level", "What the answer shows"], rows: [
                ["Mid", "Server pagination, sortable headers, loading and empty states"],
                ["Senior", "Virtualization, URL view state, optimistic edits, grid keyboard pattern"],
                ["Staff", "API contract for cursors and filters, conflict handling, saved views, export pipeline, performance budgets and monitoring"]
              ] },
              { t: "quiz", id: "sd-breakdowns" },
              { t: "note", variant: "key", html: "<strong>Let the server sort and filter, virtualize what you render, keep the view in the URL, and edit optimistically with conflict detection.</strong>" }
            ]
          }
        ]
      }
    ]
  };
})();
