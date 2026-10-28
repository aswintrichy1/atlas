/* =====================================================================
   PIXEL · State & Data
   window.TRACKS.state — modules: local / global / forms
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};
  var ACC = "#a78bfa";

  /* ---------- stateChooser: where should this state live? ---------- */
  var SCENARIOS = [
    { id: "modal", label: "Is the confirm modal open?", a: [false, false, "no", "no"], home: "Local useState", why: "Only this component cares, it is not from the server and losing it on reload is fine." },
    { id: "query", label: "Search query users share by link", a: [false, false, "url", "far"], home: "URL search params", why: "Shareable and back-button friendly: the URL is the source of truth; read it, don't copy it." },
    { id: "products", label: "Product list from the API", a: [false, true, "no", "far"], home: "Server-state cache (query library or framework loader)", why: "It is a cached copy of server data: it needs dedup, refetching and invalidation, not useState." },
    { id: "count", label: "Number of products matching the filter", a: [true, false, "no", "no"], home: "Derived during render — don't store it", why: "It is products.filter(...).length. Storing it creates a second source of truth that can drift." },
    { id: "theme", label: "Dark / light theme preference", a: [false, false, "device", "far"], home: "Persisted client store (localStorage) exposed via context", why: "Read everywhere, changes rarely, should survive reload on this device." },
    { id: "tab", label: "Selected tab, read by the header and the panel", a: [false, false, "no", "sibling"], home: "Lift state to the nearest common parent", why: "Two siblings need it; their closest shared parent owns it and passes it down." },
    { id: "wizard", label: "Draft of a 4-step checkout form", a: [false, false, "no", "no"], home: "useReducer at the form root", why: "Many related fields and transitions belong in one reducer owned by the form; persist to sessionStorage only if drafts must survive refresh." },
    { id: "toasts", label: "Toast notifications fired from anywhere", a: [false, false, "no", "far"], home: "Small external store with selectors (or a context with actions)", why: "Distant components push and read; a store with subscriptions avoids re-rendering the whole tree." }
  ];
  var QUESTIONS = ["Can it be computed from other state or props?", "Is it a copy of server data?", "Must it survive reload or be shareable?", "Who else needs it?"];
  Widgets.stateChooser = function (mount) {
    var h = WK.h;
    WK.shell(mount, "decision", "Where should this state live?",
      "Pick a piece of state. The decision path asks the same four questions every time and stops at the first decisive answer.");
    var cur = SCENARIOS[0];
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function answerText(qi, v) {
      if (qi === 2) return v === "url" ? "Yes — shareable via link" : v === "device" ? "Yes — on this device" : "No";
      if (qi === 3) return v === "far" ? "Distant components" : v === "sibling" ? "A sibling" : "Only this component";
      return v ? "Yes" : "No";
    }
    function decisiveAt(a) {
      if (a[0]) return 0;
      if (a[1]) return 1;
      if (a[2] !== "no") return 2;
      return 3;
    }
    function paint() {
      WK.clear(stage);
      var stop = decisiveAt(cur.a);
      QUESTIONS.forEach(function (q, i) {
        var reached = i <= stop, decisive = i === stop;
        stage.appendChild(h("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-radius:10px;padding:8px 12px;margin-bottom:6px;" +
          (decisive ? WK.tint(ACC, 24) : reached ? "border:1px solid var(--line-strong);background:var(--surface-solid);color:var(--text);" : "border:1px dashed var(--line);color:var(--text-dim);") },
          h("span", { style: "font-family:var(--font-mono);font-size:0.74rem;color:var(--text-dim);" }, "Q" + (i + 1)),
          h("span", { style: "flex:1;min-width:200px;" }, q),
          h("strong", {}, reached ? answerText(i, cur.a[i]) : "not needed")));
      });
      stage.appendChild(h("div", { style: WK.tint(WK.GOOD, 14) + "border-radius:12px;padding:12px;margin-top:10px;" },
        h("div", { style: "font-weight:700;margin-bottom:4px;" }, "→ " + cur.home), h("div", { style: "font-size:0.86rem;" }, cur.why)));
      WK.readout(readout, [["state", cur.label], ["home", cur.home.split(" (")[0]], ["decided at", "Q" + (stop + 1)]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.field("state", WK.select(SCENARIOS.map(function (s) { return [s.id, s.label]; }), cur.id, function (v) {
        cur = SCENARIOS.filter(function (s) { return s.id === v; })[0] || SCENARIOS[0]; paint();
      }, "Piece of state")),
      WK.btn("Next example", function () { var i = SCENARIOS.indexOf(cur); cur = SCENARIOS[(i + 1) % SCENARIOS.length]; sel(); paint(); }, "primary")));
    function sel() { var s = mount.querySelector("select"); if (s) s.value = cur.id; }
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- stateQueryCache: server-state cache simulator ---------- */
  Widgets.stateQueryCache = function (mount) {
    var h = WK.h;
    WK.shell(mount, "simulator", "Server-state cache simulator",
      "A virtual clock and one cache entry for the key [\"todos\"]. Mount observers, let time pass, refocus the window and invalidate after a mutation.");
    var stale = 0, s;
    function reset() { s = { t: 0, entry: null, observers: 0, requests: 0, hits: 0, inactiveSince: null, log: ["cache empty"] }; }
    function isStale() { return !s.entry || s.entry.invalid || (s.t - s.entry.at) >= stale; }
    function fetchNow(reason) { s.requests++; s.entry = { at: s.t, version: (s.entry ? s.entry.version : 0) + 1, invalid: false }; s.log.push("t=" + s.t + "s · " + reason + " → network request (v" + s.entry.version + ")"); }
    function mountObserver(name, count) {
      count = count || 1;
      if (!s.entry) {
        s.observers += count;
        fetchNow(name + " mounted, no cache" + (count > 1 ? " (2 observers, 1 request: deduped)" : ""));
      } else {
        s.observers += count; s.hits += count;
        if (isStale()) fetchNow(name + " mounted: cached data shown instantly, stale → background refetch");
        else s.log.push("t=" + s.t + "s · " + name + " mounted → cache hit, still fresh, no request");
      }
      s.inactiveSince = null;
    }
    var entryEl = h("div", {});
    var logEl = h("ol", { style: "margin:10px 0 0;padding-left:20px;font-family:var(--font-mono);font-size:0.76rem;color:var(--text);display:flex;flex-direction:column;gap:3px;" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      WK.clear(entryEl);
      var status = !s.entry ? "empty" : isStale() ? "stale" : "fresh";
      var hex = status === "fresh" ? WK.GOOD : status === "stale" ? WK.MID : "#94a3b8";
      entryEl.appendChild(h("div", { style: "display:flex;gap:10px;flex-wrap:wrap;align-items:center;" },
        h("span", { style: "font-family:var(--font-mono);font-weight:700;" }, "[\"todos\"]"),
        WK.badge(status, hex),
        h("span", { style: "font-size:0.8rem;color:var(--text-dim);" }, s.entry ? "data v" + s.entry.version + " · fetched at t=" + s.entry.at + "s" : "no data"),
        h("span", { style: "font-size:0.8rem;color:var(--text-dim);" }, "observers: " + s.observers),
        h("span", { style: "font-size:0.8rem;color:var(--text-dim);" }, "clock: t=" + s.t + "s")));
      WK.clear(logEl);
      s.log.slice(-6).forEach(function (l) { logEl.appendChild(h("li", {}, l)); });
      WK.readout(readout, [["network requests", s.requests], ["cache hits", s.hits], ["status", status]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([[0, "staleTime 0"], [30, "staleTime 30s"], [300, "staleTime 5m"]], 0, function (v) { stale = v; reset(); paint(); }, "staleTime"),
      WK.btn("Reset", function () { reset(); paint(); }, "ghost")));
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.btn("Mount A", function () { mountObserver("A"); paint(); }, "primary"),
      WK.btn("Mount A + B together", function () { mountObserver("A+B", 2); paint(); }),
      WK.btn("Advance +20s", function () {
        s.t += 20;
        if (s.observers === 0 && s.entry && s.inactiveSince != null && s.t - s.inactiveSince >= 300) { s.entry = null; s.log.push("t=" + s.t + "s · inactive past gcTime (5m) → entry garbage-collected"); }
        else s.log.push("t=" + s.t + "s · time passes" + (s.entry && isStale() ? " (entry is now stale)" : ""));
        paint();
      }),
      WK.btn("Window refocus", function () {
        if (s.observers > 0 && isStale()) fetchNow("window refocused, stale with observers → refetch");
        else s.log.push("t=" + s.t + "s · refocus → " + (s.observers ? "fresh, nothing to do" : "no observers, nothing to do"));
        paint();
      }),
      WK.btn("Mutate + invalidate", function () {
        if (!s.entry) { s.log.push("t=" + s.t + "s · mutation succeeded, nothing cached to invalidate"); paint(); return; }
        s.entry.invalid = true;
        if (s.observers > 0) fetchNow("mutation succeeded → invalidate → active query refetches");
        else s.log.push("t=" + s.t + "s · invalidated; will refetch on next mount");
        paint();
      }),
      WK.btn("Unmount all", function () { if (s.observers) { s.observers = 0; s.inactiveSince = s.t; s.log.push("t=" + s.t + "s · all observers unmounted; data kept for gcTime"); } paint(); })));
    mount.appendChild(h("div", { class: "w-stage" }, entryEl, logEl));
    mount.appendChild(readout);
    reset();
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "state-local": {
      title: "Local state checkpoint",
      sub: "Colocation, lifting, reducers and derived values.",
      questions: [
        { q: "Two sibling components must show the same selected item. Where should the selection state live?", options: ["In both siblings, synced with effects", "In a global store by default", "In their nearest common parent, passed down as props", "In a ref"], answer: 2,
          explain: "Lifting state to the closest common parent gives one source of truth. Syncing duplicates with effects creates drift and extra renders." },
        { q: "A component stores items and also selectedItem as a full copy of one item. What is the risk?", options: ["Nothing", "Editing the item in items leaves selectedItem stale; store selectedId instead", "It uses too much memory", "Reducers cannot handle objects"], answer: 1,
          explain: "Duplicated data drifts. Store the id and derive the selected object during render with items.find." },
        { q: "When does useReducer clearly beat several useState calls?", options: ["Always", "When state has many related fields and transitions that should be named and tested together", "When there is a single boolean", "Only with TypeScript"], answer: 1,
          explain: "A reducer centralizes transitions as events like 'submitted' or 'failed', which keeps related fields consistent and is easy to unit test." },
        { q: "Why model request status as 'idle' | 'loading' | 'error' | 'success' instead of isLoading and isError booleans?", options: ["It renders faster", "It prevents impossible combinations like loading and error at the same time", "Booleans are deprecated", "It removes the need for error handling"], answer: 1,
          explain: "A single status field can only hold one value at a time, so impossible states cannot be represented." },
        { q: "Where should a shareable search filter live so that the back button and copied links work?", options: ["useState", "localStorage", "The URL search params", "A context"], answer: 2,
          explain: "The URL is the state that browsers share, bookmark and navigate. Read the filter from it rather than duplicating it in component state." }
      ]
    },
    "state-global": {
      title: "Shared & server state checkpoint",
      sub: "Stores, selectors and server-state caches.",
      questions: [
        { q: "What is the core difference between server state and client state?", options: ["Server state is always larger", "Server state is a cached snapshot of data owned elsewhere that can go stale", "Client state cannot be global", "There is none"], answer: 1,
          explain: "Server state is owned by the backend; the client holds a copy that needs fetching, caching, deduplication, refetching and invalidation." },
        { q: "In a query library, what does staleTime control?", options: ["How long unused data stays in memory", "How long data is considered fresh before a background refetch may happen", "The request timeout", "Retry count"], answer: 1,
          explain: "Fresh data is served without refetching. Once stale, it is still shown instantly but refetched on triggers like mount or window focus. Memory retention is gcTime." },
        { q: "Two components mount at the same time and request the same query key. How many network requests should a good server-state cache make?", options: ["One, the second is deduplicated", "Two", "Zero until a user clicks", "One per render"], answer: 0,
          explain: "Requests for the same key in flight are shared. That deduplication is a main reason to use a cache instead of fetching in each component." },
        { q: "Why do selector-based stores re-render less than a single big context?", options: ["They skip React entirely", "Components subscribe to a slice and re-render only when that slice changes", "They use web workers", "They batch updates by default and context does not"], answer: 1,
          explain: "A store with selectors compares the selected value per subscriber, so an unrelated update does not touch the component." },
        { q: "What should an optimistic update always include?", options: ["A page reload", "A rollback to the previous cache value if the mutation fails, then a refetch", "Disabling the network", "A second mutation"], answer: 1,
          explain: "Optimism shows the expected result immediately. If the server rejects it, restore the snapshot and resync, or the UI lies." }
      ]
    },
    "state-forms": {
      title: "Forms & validation checkpoint",
      sub: "Controlled inputs, validation timing and accessible errors.",
      questions: [
        { q: "What is a good default timing for showing validation errors?", options: ["On every keystroke from the first character", "On submit (or blur), then live as the user fixes the field", "Only on the server", "Never show errors"], answer: 1,
          explain: "Shouting on the first keystroke is hostile. Validate on submit or blur, then re-validate on change so the error clears as soon as it is fixed." },
        { q: "Why share one validation schema between client and server?", options: ["Client validation is enough", "One definition of the rules; the server still validates because the client can be bypassed", "Servers cannot validate JSON", "It removes the need for types"], answer: 1,
          explain: "Client checks are for fast feedback; the server is the authority. A shared schema keeps rules and types consistent across both." },
        { q: "How should an inline error be connected to its input for screen readers?", options: ["Red text is enough", "aria-describedby pointing at the error message and aria-invalid on the input", "A title attribute", "Use placeholder text"], answer: 1,
          explain: "aria-describedby makes the message part of the input's description, and aria-invalid announces the field as invalid." },
        { q: "A one-time-code field should open the numeric keypad and allow autofill. Which attributes help?", options: ["type=\"number\"", "inputmode=\"numeric\" and autocomplete=\"one-time-code\"", "pattern only", "readonly"], answer: 1,
          explain: "inputmode picks the mobile keyboard without number-input quirks, and the autocomplete token lets the platform fill the code." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.state = {
    id: "state",
    name: "State & Data",
    short: "STATE",
    tagline: "One source of truth per fact",
    color: ACC,
    blurb: "Decide where each piece of state lives: colocated, lifted, reduced, derived, in the URL, in a client store or in a server-state cache. Then handle mutations, optimistic updates, forms and validation without drift.",
    modules: [
      {
        id: "local",
        name: "Local State Design",
        icon: "diamond",
        lessons: [
          {
            id: "where-state-lives",
            title: "Where state lives: colocate, lift, or put it in the URL",
            summary: "Keep state as close as possible to where it is used, and give every fact exactly one home.",
            minutes: 10,
            tags: ["colocation", "lifting-state", "url-state"],
            blocks: [
              { t: "p", html: "Most state bugs are <strong>two copies of one fact disagreeing</strong>. The fix is a placement rule: every fact has one owner, as low in the tree as it can be while still reaching everyone who needs it." },
              { t: "widget", id: "stateChooser" },
              { t: "table", headers: ["Kind of state", "Default home"], rows: [
                ["UI-only, one component (open, hover, draft text)", "useState in that component"],
                ["Needed by siblings", "Nearest common parent"],
                ["Shareable / navigable (filters, tab, page)", "URL search params or route segments"],
                ["Copy of backend data", "Server-state cache"],
                ["App-wide, changes rarely (theme, locale, session)", "Context or a small store"],
                ["Computable from other state", "Nowhere — derive it"]
              ] },
              { t: "code", lang: "javascript", code:
                "// URL as state: no duplicate useState, works with back button and shared links\n" +
                "function ProductFilters() {\n" +
                "  const [params, setParams] = useSearchParams();\n" +
                "  const sort = params.get(\"sort\") ?? \"relevance\";\n" +
                "  return (\n" +
                "    <select value={sort} onChange={(e) => setParams({ sort: e.target.value })}>\n" +
                "      <option value=\"relevance\">Relevance</option>\n" +
                "      <option value=\"price-asc\">Price: low to high</option>\n" +
                "    </select>\n" +
                "  );\n" +
                "}" },
              { t: "note", variant: "tip", html: "Colocation is also a performance tool: state low in the tree means only a small subtree re-renders when it changes." },
              { t: "note", variant: "key", html: "<strong>One fact, one owner, as low as possible.</strong> Lift only as far as the closest common parent, and use the URL for anything a user might share or navigate back to." }
            ]
          },
          {
            id: "reducers-derived",
            title: "Reducers, state machines and derived state",
            summary: "Name your transitions, make impossible states unrepresentable, and compute instead of storing.",
            minutes: 11,
            tags: ["useReducer", "state-machine", "derived-state"],
            blocks: [
              { t: "p", html: "When several fields change together, scattered <code class='tok'>setX</code> calls drift apart. A reducer turns updates into <strong>named events</strong> and one function decides the next state." },
              { t: "code", lang: "javascript", code:
                "function checkoutReducer(state, event) {\n" +
                "  switch (event.type) {\n" +
                "    case \"submit\":  return state.status === \"editing\" ? { status: \"submitting\", form: state.form } : state;\n" +
                "    case \"success\": return { status: \"done\", orderId: event.orderId };\n" +
                "    case \"failure\": return { status: \"editing\", form: state.form, error: event.message };\n" +
                "    default:        return state;\n" +
                "  }\n" +
                "}\n" +
                "const [state, dispatch] = useReducer(checkoutReducer, { status: \"editing\", form: initialForm });" },
              { t: "compare",
                bad: { title: "Stored derived values", items: ["<code class='tok'>filtered</code> kept in state and synced with an effect", "Extra render with stale data", "Two sources of truth"] },
                good: { title: "Derived during render", items: ["<code class='tok'>const visible = items.filter(matches)</code>", "Always consistent", "useMemo only if profiling shows it is slow"] } },
              { t: "ul", items: [
                "Store <strong>ids</strong>, not copies of objects (<code class='tok'>selectedId</code>, then <code class='tok'>items.find</code>).",
                "Guard transitions: a reducer can ignore <code class='tok'>submit</code> while already submitting, killing double-submit bugs.",
                "Reducers are pure, so they are trivially unit-testable without rendering anything."
              ] },
              { t: "note", variant: "warn", html: "Do not reach for <code class='tok'>useMemo</code> around cheap expressions like a string concatenation or a boolean check. The bookkeeping costs more than the work." },
              { t: "quiz", id: "state-local" },
              { t: "note", variant: "key", html: "<strong>Model state as events and statuses, store only what you cannot compute.</strong> Reducers keep related fields consistent; derived values stay correct by construction." }
            ]
          }
        ]
      },
      {
        id: "global",
        name: "Shared & Server State",
        icon: "database",
        lessons: [
          {
            id: "external-stores",
            title: "Client stores: context, selector stores and Redux-style",
            summary: "When state is truly global and changes often, subscribe to slices instead of broadcasting everything.",
            minutes: 10,
            tags: ["zustand", "redux", "context", "useSyncExternalStore"],
            blocks: [
              { t: "p", html: "Global client state is smaller than most apps think: session, preferences, a cart, cross-cutting UI like toasts. Once server data moves into a cache, what remains is usually a <strong>handful of slices</strong>." },
              { t: "table", headers: ["Option", "Strengths", "Costs"], rows: [
                ["Context + useReducer", "Built in, no dependency, fine for low-frequency data", "Every consumer re-renders when the value changes"],
                ["Selector store (Zustand-style)", "Tiny API, subscribe to slices, works outside React", "Conventions are up to you"],
                ["Redux Toolkit", "Strict event log, devtools, middleware, mature patterns", "More ceremony; overkill for small apps"],
                ["Atoms (Jotai/Recoil-style)", "Fine-grained dependencies between small pieces", "Harder to see the whole state at once"]
              ] },
              { t: "code", lang: "javascript", code:
                "// a selector store: components re-render only when their slice changes\n" +
                "const useCart = create((set) => ({\n" +
                "  items: [],\n" +
                "  add: (item) => set((s) => ({ items: [...s.items, item] })),\n" +
                "}));\n\n" +
                "function CartBadge() {\n" +
                "  const count = useCart((s) => s.items.length);   // derived primitive slice\n" +
                "  return <span aria-label={`${count} items in cart`}>{count}</span>;\n" +
                "}" },
              { t: "note", variant: "tip", html: "Libraries like these sit on <code class='tok'>useSyncExternalStore</code>, React's hook for subscribing to outside stores safely under concurrent rendering. You rarely call it directly." },
              { t: "note", variant: "trap", html: "Selecting a new object (<code class='tok'>s =&gt; ({ a: s.a, b: s.b })</code>) defeats selectors because it is a new reference every time. Select primitives or use a shallow-equality helper." },
              { t: "note", variant: "key", html: "<strong>Keep global client state small and subscribe to slices.</strong> Context suits rare changes; selector stores suit frequent ones; neither should hold server data." }
            ]
          },
          {
            id: "server-state",
            title: "Server state is a cache: query libraries",
            summary: "Fetching, caching, deduplication and background refetching, without hand-written effects.",
            minutes: 11,
            tags: ["tanstack-query", "caching", "staleTime"],
            blocks: [
              { t: "p", html: "Data from your API is not your state; it is a <strong>snapshot that can go stale</strong>. Treat it like a cache keyed by what you asked for, and let a library handle the lifecycle." },
              { t: "code", lang: "javascript", code:
                "function useTodos(filter) {\n" +
                "  return useQuery({\n" +
                "    queryKey: [\"todos\", filter],            // the cache key: everything the request depends on\n" +
                "    queryFn: ({ signal }) => api.todos(filter, { signal }),\n" +
                "    staleTime: 30_000,                        // fresh for 30 s: no refetch on mount\n" +
                "  });\n" +
                "}\n\n" +
                "const { data, isPending, isError, error } = useTodos(\"open\");" },
              { t: "widget", id: "stateQueryCache" },
              { t: "table", headers: ["Concept", "Meaning"], rows: [
                ["Query key", "Identity of the data; changing it fetches a different entry"],
                ["staleTime", "How long data counts as fresh (default 0: stale immediately)"],
                ["gcTime", "How long unused data stays in memory after the last observer unmounts"],
                ["Dedup", "Concurrent requests for the same key share one network call"],
                ["Refetch triggers", "Mount, window focus, reconnect, interval — only when stale"]
              ] },
              { t: "note", variant: "tip", html: "Show cached data immediately and refetch in the background (stale-while-revalidate). Users see something useful in milliseconds instead of a spinner." },
              { t: "h", text: "Caching patterns that scale" },
              { t: "code", lang: "javascript", code:
                "// one key factory per feature keeps keys consistent for reads and invalidation\n" +
                "export const projectKeys = {\n" +
                "  all: [\"projects\"],\n" +
                "  list: (filters) => [\"projects\", \"list\", filters],\n" +
                "  detail: (id) => [\"projects\", \"detail\", id],\n" +
                "};\n\n" +
                "// paginate without flashing an empty list\n" +
                "useQuery({ queryKey: projectKeys.list({ page }), queryFn: () => api.projects({ page }),\n" +
                "           placeholderData: keepPreviousData });\n\n" +
                "// prefetch on intent so the detail page renders from cache\n" +
                "<Link to={`/projects/${p.id}`}\n" +
                "  onMouseEnter={() => qc.prefetchQuery({ queryKey: projectKeys.detail(p.id), queryFn: () => api.project(p.id) })} />\n\n" +
                "// invalidate a whole family after a write\n" +
                "qc.invalidateQueries({ queryKey: projectKeys.all });" },
              { t: "table", headers: ["Need", "Tool"], rows: [
                ["Derive a slice without extra renders", "<code class='tok'>select</code> option on the query"],
                ["Keep old page while the next loads", "<code class='tok'>placeholderData: keepPreviousData</code>"],
                ["Instant detail pages", "<code class='tok'>prefetchQuery</code> on hover or in a route loader"],
                ["Seed a detail from list data", "<code class='tok'>initialData</code> from the cached list"],
                ["Server-rendered first paint", "Prefetch on the server, dehydrate, hydrate the client cache"],
                ["Refresh after a mutation", "<code class='tok'>invalidateQueries</code> on the key prefix"]
              ] },
              { t: "note", variant: "warn", html: "Create the query client once per browser session (and once per request on the server). A module-level client on the server would share one user's cached data with every other request." },
              { t: "note", variant: "key", html: "<strong>Server data lives in a keyed cache, not in useState.</strong> Put every input in the query key, tune staleTime per data type, and let the cache dedupe and refetch." }
            ]
          },
          {
            id: "mutations-cache",
            title: "Mutations, invalidation and optimistic updates",
            summary: "Write to the server, then make the cache tell the truth again — quickly and safely.",
            minutes: 10,
            tags: ["mutations", "optimistic-ui", "invalidation", "pagination"],
            blocks: [
              { t: "p", html: "After a write, cached reads are wrong until refreshed. You have three tools: <strong>invalidate</strong> (refetch), <strong>update the cache directly</strong> from the response, or <strong>update optimistically</strong> before the server answers." },
              { t: "code", lang: "javascript", code:
                "const qc = useQueryClient();\n" +
                "const toggle = useMutation({\n" +
                "  mutationFn: api.toggleTodo,\n" +
                "  onMutate: async (id) => {\n" +
                "    await qc.cancelQueries({ queryKey: [\"todos\"] });\n" +
                "    const previous = qc.getQueryData([\"todos\"]);\n" +
                "    qc.setQueryData([\"todos\"], (old) => old.map((t) => t.id === id ? { ...t, done: !t.done } : t));\n" +
                "    return { previous };                              // snapshot for rollback\n" +
                "  },\n" +
                "  onError: (_e, _id, ctx) => qc.setQueryData([\"todos\"], ctx.previous),\n" +
                "  onSettled: () => qc.invalidateQueries({ queryKey: [\"todos\"] }),\n" +
                "});" },
              { t: "table", headers: ["Tier", "Strategy", "Trade-off"], rows: [
                ["Naive", "Refetch the whole page after every write", "Slow, flashes loading states"],
                ["Solid", "Invalidate the affected query keys", "Correct, one round-trip of latency"],
                ["Standout", "Optimistic update + rollback + invalidate on settle", "Instant feel; more code and careful error UX"]
              ] },
              { t: "ul", items: [
                "Paginate with cursors for feeds; keep previous pages cached while the next loads.",
                "Prefetch on hover or route intent so the next screen opens from cache.",
                "Disable or deduplicate submit while a mutation is pending to avoid double writes."
              ] },
              { t: "note", variant: "warn", html: "Optimistic updates suit low-risk, high-success actions (likes, toggles). For payments or irreversible actions, show pending state and wait for the server." },
              { t: "quiz", id: "state-global" },
              { t: "note", variant: "key", html: "<strong>Every write must end with a truthful cache.</strong> Invalidate by key, update optimistically only when safe, and always keep a rollback snapshot." }
            ]
          }
        ]
      },
      {
        id: "forms",
        name: "Forms & Validation",
        icon: "wrench",
        lessons: [
          {
            id: "forms-validation",
            title: "Forms and validation that respect users",
            summary: "Controlled or uncontrolled inputs, form actions, one schema for client and server, and accessible errors.",
            minutes: 12,
            tags: ["forms", "validation", "schema", "form-actions"],
            blocks: [
              { t: "p", html: "A form is a small state machine: <strong>editing → submitting → success or error</strong>. Your job is fast feedback without nagging, and a server that never trusts the client." },
              { t: "table", headers: ["Approach", "How it works", "Good for"], rows: [
                ["Controlled", "Value in React state, onChange updates it", "Live formatting, dependent fields"],
                ["Uncontrolled", "DOM holds the value; read on submit (FormData or refs)", "Large forms, fewer renders"],
                ["Form actions (React 19)", "<code class='tok'>&lt;form action={fn}&gt;</code> with useActionState / useFormStatus", "Progressive enhancement, server mutations"]
              ] },
              { t: "code", lang: "javascript", code:
                "const SignupSchema = z.object({\n" +
                "  email: z.string().email(\"Enter a valid email\"),\n" +
                "  password: z.string().min(12, \"Use at least 12 characters\"),\n" +
                "});\n\n" +
                "// same schema on the server: the client check is for speed, the server check is for truth\n" +
                "<label htmlFor=\"email\">Email</label>\n" +
                "<input id=\"email\" name=\"email\" type=\"email\" autoComplete=\"email\"\n" +
                "       aria-invalid={!!errors.email} aria-describedby=\"email-error\" />\n" +
                "<p id=\"email-error\" role=\"alert\">{errors.email}</p>" },
              { t: "h", text: "Validation timing" },
              { t: "ol", items: [
                "Let people type without errors.",
                "Validate a field on blur or on submit.",
                "Once a field has an error, re-validate on every change so it clears immediately.",
                "On submit failure, move focus to the first invalid field or an error summary."
              ] },
              { t: "ul", items: [
                "Use the right <code class='tok'>type</code>, <code class='tok'>autocomplete</code> and <code class='tok'>inputmode</code> so password managers and mobile keyboards help.",
                "Never block paste — it breaks password managers.",
                "Keep the submit button enabled and explain what is missing, rather than a mysteriously disabled button."
              ] },
              { t: "note", variant: "trap", html: "Client-only validation is a UX feature, not security. Anyone can send a request without your form." },
              { t: "quiz", id: "state-forms" },
              { t: "note", variant: "key", html: "<strong>Validate late, re-validate live, and let the server decide.</strong> One schema for both sides, programmatic error links, and attributes that let the browser help." }
            ]
          }
        ]
      }
    ]
  };
})();
