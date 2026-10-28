/* =====================================================================
   PIXEL · Performance
   window.TRACKS.perf — modules: vitals / loading / runtime
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};
  var ACC = "#fb923c";

  function rate(v, good, poor) { return v <= good ? ["good", WK.GOOD] : v <= poor ? ["needs work", WK.MID] : ["poor", WK.BAD]; }

  /* ---------- perfVitals: Core Web Vitals lab ---------- */
  Widgets.perfVitals = function (mount) {
    var h = WK.h;
    WK.shell(mount, "lab", "Core Web Vitals lab",
      "A slow product page starts in the red. Toggle fixes and watch which metric each one moves. Thresholds: LCP 2.5 s, INP 200 ms, CLS 0.1 for good.");
    var FIXES = [
      { id: "preload", label: "Prioritize the hero image", lcp: -1.2, inp: 0, cls: 0 },
      { id: "dims", label: "Set width and height on images", lcp: 0, inp: 0, cls: -0.18 },
      { id: "fonts", label: "Self-host fonts + matched fallback", lcp: -0.3, inp: 0, cls: -0.06 },
      { id: "third", label: "Defer third-party scripts", lcp: -0.6, inp: -120, cls: 0 },
      { id: "split", label: "Code-split heavy routes", lcp: -0.5, inp: -80, cls: 0 },
      { id: "yield", label: "Break up long tasks", lcp: 0, inp: -200, cls: 0 },
      { id: "reserve", label: "Reserve space for late content", lcp: 0, inp: 0, cls: -0.07 }
    ];
    var on = {};
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var lcp = 4.2, inp = 480, cls = 0.32;
      FIXES.forEach(function (f) { if (on[f.id]) { lcp += f.lcp; inp += f.inp; cls += f.cls; } });
      lcp = Math.max(1.4, lcp); inp = Math.max(60, inp); cls = Math.max(0.01, cls);
      var m = [
        ["LCP", lcp.toFixed(1) + " s", rate(lcp, 2.5, 4), "Largest Contentful Paint: when the main content appears"],
        ["INP", Math.round(inp) + " ms", rate(inp, 200, 500), "Interaction to Next Paint: how fast the page responds"],
        ["CLS", cls.toFixed(2), rate(cls, 0.1, 0.25), "Cumulative Layout Shift: how much content jumps"]
      ];
      WK.clear(stage);
      var row = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;" });
      m.forEach(function (x) {
        row.appendChild(h("div", { style: WK.tint(x[2][1], 16) + "border-radius:12px;padding:12px;" },
          h("div", { style: "font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim);" }, x[0]),
          h("div", { style: "font-size:1.5rem;font-weight:700;margin:2px 0 6px;color:var(--text);" }, x[1]),
          WK.badge(x[2][0], x[2][1]),
          h("div", { style: "font-size:0.76rem;color:var(--text-dim);margin-top:6px;" }, x[3])));
      });
      stage.appendChild(row);
      var passing = m.filter(function (x) { return x[2][0] === "good"; }).length;
      WK.readout(readout, [["metrics passing", passing + " / 3"], ["fixes applied", Object.keys(on).filter(function (k) { return on[k]; }).length + " / " + FIXES.length]]);
    }
    var controls = h("div", { class: "widget-controls" });
    FIXES.forEach(function (f) { controls.appendChild(WK.toggle(f.label, false, function (v) { on[f.id] = v; paint(); })); });
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- perfMemo: when memoization pays ---------- */
  Widgets.perfMemo = function (mount) {
    var h = WK.h;
    WK.shell(mount, "memo", "When does memoization actually help?",
      "A list of 200 visible rows filtered from 1,000 items. Choose what triggers the re-render, then toggle the optimizations.");
    var s = { trigger: "parent", memoRow: false, stableCb: false, memoFilter: false };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var filterRuns = s.trigger === "filter" || !s.memoFilter;
      var filterMs = filterRuns ? 2.0 : 0;
      var rows, why;
      if (s.trigger === "filter") {
        rows = s.memoRow && s.stableCb ? 40 : 200;
        why = s.memoRow && s.stableCb ? "Only the 40 rows whose data changed re-render; the rest bail out." : s.memoRow ? "memo is defeated: the inline onSelect is a new function every render, so every row's props differ." : "Every visible row re-renders even when its own item did not change.";
      } else {
        rows = s.memoRow && s.stableCb ? 0 : 200;
        why = s.memoRow && s.stableCb ? "Nothing in the list changed, so every row skips rendering." : s.memoRow ? "memo is defeated: a fresh callback prop makes every row look changed." : "An unrelated counter in the parent re-renders all 200 rows.";
      }
      var rowsMs = rows * 0.06;
      var total = filterMs + rowsMs;
      WK.clear(stage);
      var grid = h("div", { style: "display:grid;grid-template-columns:repeat(20,1fr);gap:3px;margin-bottom:10px;" });
      for (var i = 0; i < 200; i++) {
        var hit = i < rows;
        grid.appendChild(h("span", { style: "height:10px;border-radius:2px;" + (hit ? "background:" + ACC + ";" : "background:var(--line);") }));
      }
      stage.appendChild(grid);
      stage.appendChild(h("p", { style: "margin:0;font-size:0.86rem;color:var(--text);" }, why + (filterRuns ? " The filter recomputes over 1,000 items." : " The filtered list is reused from useMemo.")));
      var r = rate(total, 6, 12);
      WK.readout(readout, [["rows rendered", rows + " / 200"], ["filter work", filterRuns ? "1,000 items" : "skipped"], ["estimated cost", total.toFixed(1) + " ms"], ["verdict", r[0]]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([["parent", "unrelated parent state"], ["filter", "filter text changes"]], 0, function (v) { s.trigger = v; paint(); }, "Trigger")));
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.toggle("memo(Row)", false, function (v) { s.memoRow = v; paint(); }),
      WK.toggle("useCallback(onSelect)", false, function (v) { s.stableCb = v; paint(); }),
      WK.toggle("useMemo(filtered)", false, function (v) { s.memoFilter = v; paint(); })));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- perfBundle: what is in the entry chunk ---------- */
  Widgets.perfBundle = function (mount) {
    var h = WK.h;
    WK.shell(mount, "analyzer", "Shrink the entry chunk",
      "The entry chunk of a store app, in compressed kilobytes. Apply fixes and watch the treemap rows and the budget.");
    var PARTS = [
      { id: "app", label: "your app code", kb: 62, fix: null },
      { id: "react", label: "react + react-dom", kb: 45, fix: null },
      { id: "utils", label: "utility library (whole)", kb: 24, fix: "tree", after: 3 },
      { id: "dupe", label: "duplicate copy of a state library", kb: 14, fix: "dedupe", after: 0 },
      { id: "dates", label: "date library + all locales", kb: 72, fix: "intl", after: 2 },
      { id: "chart", label: "chart library", kb: 58, fix: "lazy", after: 0 },
      { id: "third", label: "analytics + chat widget", kb: 41, fix: "defer", after: 0 }
    ];
    var FIXES = [["tree", "Per-function imports"], ["dedupe", "Dedupe versions"], ["intl", "Native Intl dates"], ["lazy", "Lazy-load charts"], ["defer", "Defer third parties"]];
    var BUDGET = 170;
    var on = {};
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var total = 0, max = 80;
      WK.clear(stage);
      PARTS.forEach(function (p) {
        var kb = p.fix && on[p.fix] ? p.after : p.kb;
        total += kb;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:190px 1fr 60px;gap:10px;align-items:center;margin-bottom:6px;" },
          h("span", { style: "font-size:0.82rem;color:var(--text);" }, p.label),
          h("div", { style: "height:14px;border-radius:7px;background:var(--line);overflow:hidden;" }, h("div", { style: "height:100%;width:" + Math.max(1, kb / max * 100) + "%;" + WK.tint(p.fix ? (on[p.fix] ? WK.GOOD : WK.MID) : "#94a3b8", 45) })),
          h("span", { style: "font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim);text-align:right;" }, kb + " kB")));
      });
      var ok = total <= BUDGET;
      stage.appendChild(h("div", { style: WK.tint(ok ? WK.GOOD : WK.BAD, 16) + "border-radius:10px;padding:8px 12px;margin-top:8px;font-size:0.86rem;" },
        ok ? "Within the " + BUDGET + " kB entry budget. Remaining weight is code the first screen really needs." : "Over the " + BUDGET + " kB entry budget by " + (total - BUDGET) + " kB: CI would fail this pull request."));
      WK.readout(readout, [["entry chunk", total + " kB"], ["budget", BUDGET + " kB"], ["saved", (316 - total) + " kB"]]);
    }
    var controls = h("div", { class: "widget-controls" });
    FIXES.forEach(function (f) { controls.appendChild(WK.toggle(f[1], false, function (v) { on[f[0]] = v; paint(); })); });
    mount.appendChild(controls);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "perf-vitals": {
      title: "Core Web Vitals checkpoint",
      sub: "LCP, INP, CLS and what moves them.",
      questions: [
        { q: "Which thresholds mark a 'good' experience at the 75th percentile?", options: ["LCP ≤ 4 s, INP ≤ 500 ms, CLS ≤ 0.25", "LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1", "LCP ≤ 1 s, INP ≤ 50 ms, CLS = 0", "LCP ≤ 3 s, INP ≤ 300 ms, CLS ≤ 0.2"], answer: 1,
          explain: "Good is LCP within 2.5 s, INP within 200 ms and CLS within 0.1, measured at the 75th percentile of real users." },
        { q: "The LCP element is a hero image found late because CSS sets it as a background. What helps most?", options: ["Lazy-load it", "Use a real img element with high fetch priority (or preload it) so the browser discovers it early", "Add more JavaScript", "Increase its resolution"], answer: 1,
          explain: "Discovery delay is a common LCP cost. Put the image in the HTML and mark it high priority; never lazy-load the LCP image." },
        { q: "What does INP measure?", options: ["Time to first byte", "The latency from user interactions to the next visual update, across the page's lifetime", "Total JavaScript size", "Image decode time"], answer: 1,
          explain: "INP reports roughly the worst interaction latency. Long tasks on the main thread are the usual cause." },
        { q: "Which change reduces CLS?", options: ["Removing alt text", "Setting width and height (or aspect-ratio) on images and reserving space for ads and embeds", "Using more web fonts", "Loading CSS at the end of body"], answer: 1,
          explain: "Shifts happen when content arrives without reserved space. Dimensions and placeholders keep the layout stable." },
        { q: "Why prefer field data over a single lab run?", options: ["Lab tools are inaccurate", "Real users have varied devices and networks; field data at the 75th percentile reflects what they experience", "Field data is faster to collect", "Lab runs cannot measure LCP"], answer: 1,
          explain: "Lab tests are great for debugging, but ranking and real experience come from field measurements across real conditions." }
      ]
    },
    "perf-loading": {
      title: "Loading performance checkpoint",
      sub: "Bundles, splitting and waterfalls.",
      questions: [
        { q: "Importing one icon from a large barrel file (index.js re-exporting everything) can cost what?", options: ["Nothing; bundlers always tree-shake", "Loading or parsing far more modules than needed, slowing builds, dev startup and sometimes the bundle", "A runtime error", "Duplicate React copies"], answer: 1,
          explain: "Barrels force tools to touch every re-exported module. Import from the specific module path or use the bundler's import optimization." },
        { q: "A rich-text editor is used on one settings page. How should it load?", options: ["In the main bundle", "Through a dynamic import so it loads only when that page or component needs it", "From a CDN on every page", "Inlined into HTML"], answer: 1,
          explain: "Code splitting keeps rarely used, heavy code out of the initial download." },
        { q: "A page fetches the user, then the user's team, then the team's projects, each after the previous render. What is this?", options: ["Prefetching", "A request waterfall", "Streaming", "Hydration"], answer: 1,
          explain: "Each request waits for the last. Fetch on the server, start independent requests in parallel, or restructure the API to return what the page needs." },
        { q: "What is a good moment to preload a heavy component's code?", options: ["Never", "On a signal of intent, such as hovering or focusing the button that opens it", "After the user closes the page", "Only during build"], answer: 1,
          explain: "Intent-based preloading hides the download behind the user's own reaction time." },
        { q: "Analytics and chat scripts slow the first load. What is the usual fix?", options: ["Load them synchronously in head", "Defer them until after hydration or interaction", "Remove analytics entirely", "Inline them"], answer: 1,
          explain: "Non-critical third parties should never compete with the content the user came for." }
      ]
    },
    "perf-runtime": {
      title: "Runtime performance checkpoint",
      sub: "Memoization, long lists and profiling.",
      questions: [
        { q: "A row is wrapped in memo, but the parent passes onSelect={() => select(id)}. What happens?", options: ["memo works as intended", "memo is defeated, because a new function prop is created every render", "React throws", "Only the first row re-renders"], answer: 1,
          explain: "memo compares props shallowly. A fresh function each render means the props always differ." },
        { q: "When is useMemo not worth it?", options: ["For expensive filtering of thousands of items", "For a simple expression on primitives, like a boolean from two values", "When the result is passed to a memoized child", "For building a context value object"], answer: 1,
          explain: "Memoizing trivial work adds bookkeeping without saving anything. Save it for expensive or identity-sensitive values." },
        { q: "You render 10,000 rows and scrolling stutters. What is the standard fix?", options: ["Add more memo calls", "Virtualize the list so only rows near the viewport are in the DOM", "Use tables instead of divs", "Increase the debounce"], answer: 1,
          explain: "Virtualization keeps DOM size proportional to the viewport, not the data set. CSS content-visibility can help for simpler cases." },
        { q: "What should you do before optimizing a slow interaction?", options: ["Wrap everything in memo", "Profile it to find what is actually slow", "Rewrite in a new framework", "Remove all effects"], answer: 1,
          explain: "Measure first. The profiler shows which components render, why and for how long." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.perf = {
    id: "perf",
    name: "Performance",
    short: "PERF",
    tagline: "Fast to load, fast to respond, stable to read",
    color: ACC,
    blurb: "Make pages fast where users feel it. Learn the Core Web Vitals, fix LCP with images and fonts, tame INP and CLS, shrink and split bundles, eliminate request waterfalls, and apply memoization, virtualization and profiling only where they pay.",
    modules: [
      {
        id: "vitals",
        name: "Core Web Vitals",
        icon: "trend",
        lessons: [
          {
            id: "core-web-vitals",
            title: "Core Web Vitals: what users feel",
            summary: "Three metrics for loading, responsiveness and visual stability, measured from real users.",
            minutes: 10,
            tags: ["lcp", "inp", "cls", "field-data"],
            blocks: [
              { t: "p", html: "Users judge speed by three moments: <strong>did the main thing appear</strong>, <strong>did it react when I tapped</strong>, and <strong>did it stay put</strong>. The Core Web Vitals turn those into metrics." },
              { t: "table", headers: ["Metric", "Measures", "Good", "Poor"], rows: [
                ["LCP", "Render time of the largest content element", "≤ 2.5 s", "&gt; 4 s"],
                ["INP", "Interaction to next paint, worst-ish across the visit", "≤ 200 ms", "&gt; 500 ms"],
                ["CLS", "Sum of unexpected layout shifts", "≤ 0.1", "&gt; 0.25"]
              ] },
              { t: "widget", id: "perfVitals" },
              { t: "table", headers: ["Lab data", "Field data"], rows: [
                ["One device and network you choose", "Real users, real devices and networks"],
                ["Reproducible, great for debugging", "Reported at the 75th percentile"],
                ["Cannot measure real interactions well", "What actually reflects experience"]
              ] },
              { t: "note", variant: "tip", html: "Measure field data with the browser's performance APIs and send it to your analytics. A fast laptop on office Wi-Fi is not your median user." },
              { t: "note", variant: "key", html: "<strong>LCP, INP and CLS measure appear, respond and stay put.</strong> Target 2.5 s, 200 ms and 0.1 at the 75th percentile of real users." }
            ]
          },
          {
            id: "lcp-images-fonts",
            title: "LCP: images and fonts",
            summary: "Get the hero discovered early, sized right and painted without waiting on fonts.",
            minutes: 10,
            tags: ["lcp", "images", "fonts", "priority"],
            blocks: [
              { t: "p", html: "LCP time splits into four parts: <strong>time to first byte</strong>, <strong>resource load delay</strong> (when the browser discovers it), <strong>load time</strong> and <strong>render delay</strong>. Fix the biggest slice." },
              { t: "code", lang: "text", code:
                "<!-- the LCP image: discoverable, prioritized, sized -->\n" +
                "<img src=\"/hero-1200.avif\"\n" +
                "     srcset=\"/hero-600.avif 600w, /hero-1200.avif 1200w\"\n" +
                "     sizes=\"(max-width: 700px) 100vw, 1200px\"\n" +
                "     width=\"1200\" height=\"600\"\n" +
                "     fetchpriority=\"high\" alt=\"Trail running shoes on rocks\">\n\n" +
                "<!-- below-the-fold images -->\n" +
                "<img src=\"/thumb.avif\" loading=\"lazy\" decoding=\"async\" width=\"300\" height=\"200\" alt=\"…\">" },
              { t: "table", headers: ["Images", "Fonts"], rows: [
                ["Modern formats (AVIF, WebP) with responsive srcset", "Self-host and subset to the characters you use"],
                ["High priority for the LCP image, lazy for the rest", "Preload only the one or two critical font files"],
                ["Always set dimensions or aspect-ratio", "font-display: swap or optional so text renders immediately"],
                ["Never lazy-load the LCP image", "Tune fallback metrics (size-adjust) to avoid a shift on swap"]
              ] },
              { t: "note", variant: "trap", html: "Lazy-loading every image by default, including the hero, delays LCP because the browser waits for layout before fetching it." },
              { t: "note", variant: "key", html: "<strong>Make the LCP resource discoverable, prioritized and right-sized.</strong> Fonts should never block text from painting." }
            ]
          },
          {
            id: "inp-cls",
            title: "INP and CLS: responsive and stable",
            summary: "Keep the main thread free to answer taps, and reserve space so nothing jumps.",
            minutes: 10,
            tags: ["inp", "cls", "long-tasks", "transitions"],
            blocks: [
              { t: "p", html: "An interaction has three phases: <strong>input delay</strong> (main thread busy), <strong>processing</strong> (your handlers), and <strong>presentation</strong> (render and paint). A long task in any phase hurts INP." },
              { t: "code", lang: "javascript", code:
                "function onFilterChange(e) {\n" +
                "  setQuery(e.target.value);                  // urgent: the input updates now\n" +
                "  startTransition(() => setFilter(e.target.value)); // heavy list can lag behind\n" +
                "}\n\n" +
                "// plain JS: yield between chunks of work\n" +
                "async function processAll(items) {\n" +
                "  for (const chunk of chunks(items, 200)) {\n" +
                "    handle(chunk);\n" +
                "    await new Promise((r) => setTimeout(r, 0)); // let input and paint happen\n" +
                "  }\n" +
                "}" },
              { t: "table", headers: ["CLS cause", "Fix"], rows: [
                ["Images without dimensions", "width/height or aspect-ratio"],
                ["Ads, embeds, banners injected late", "Reserve a min-height slot"],
                ["Web fonts swapping with different metrics", "Matched fallback metrics"],
                ["Animating top/left/height", "Animate transform and opacity instead"]
              ] },
              { t: "note", variant: "tip", html: "Shifts within 500 ms of a user's own input do not count, so content expanding below a clicked button is fine." },
              { t: "h", text: "Diagnosing a slow interaction" },
              { t: "table", headers: ["INP phase", "Usually caused by", "Fix"], rows: [
                ["Input delay", "Hydration, third-party scripts or another long task already running", "Less to hydrate, defer third parties, split long tasks"],
                ["Processing", "Heavy handlers, synchronous state updates re-rendering large trees", "Do the minimum in the handler; startTransition for the rest; memoize heavy children"],
                ["Presentation", "Large DOM, expensive layout or style recalculation", "Smaller DOM, virtualization, content-visibility, avoid layout thrashing"]
              ] },
              { t: "ol", items: [
                "Find the interaction with the worst latency in field data (attribute it to the element and event type).",
                "Reproduce with CPU throttling and record a performance profile around the click.",
                "Read the long task: which phase dominates, and which functions or components run in it.",
                "Fix the dominant phase, then re-measure in the field after release."
              ] },
              { t: "quiz", id: "perf-vitals" },
              { t: "note", variant: "key", html: "<strong>INP is about main-thread availability; CLS is about reserved space.</strong> Split long tasks, defer non-urgent updates, and give late content a home." }
            ]
          }
        ]
      },
      {
        id: "loading",
        name: "Loading & Bundles",
        icon: "bolt",
        lessons: [
          {
            id: "bundle-splitting",
            title: "Bundle size and code splitting",
            summary: "Ship less JavaScript up front: direct imports, dynamic imports and deferred third parties.",
            minutes: 10,
            tags: ["bundles", "code-splitting", "barrels", "third-party"],
            blocks: [
              { t: "p", html: "JavaScript is the most expensive byte: it must download, parse, compile and execute on the main thread. The cheapest code is the code you never send." },
              { t: "code", lang: "javascript", code:
                "// avoid: barrel import pulls the whole package graph\n" +
                "import { Check } from \"icon-library\";\n" +
                "// prefer: the specific module\n" +
                "import Check from \"icon-library/icons/check\";\n\n" +
                "// split heavy, rarely used components\n" +
                "const Editor = lazy(() => import(\"./RichTextEditor\"));\n\n" +
                "// preload on intent\n" +
                "<button onMouseEnter={() => import(\"./RichTextEditor\")} onClick={open}>Edit</button>" },
              { t: "ul", items: [
                "Split by route first, then by heavy interactive widgets (editors, charts, maps).",
                "Load analytics, chat and A/B scripts after hydration or on interaction.",
                "Load modules only when a feature flag turns the feature on.",
                "Inspect bundles with an analyzer in CI and set a size budget that fails the build."
              ] },
              { t: "note", variant: "warn", html: "Splitting the LCP-critical component behind a lazy boundary moves it later. Split what is below the fold or behind an interaction." },
              { t: "note", variant: "key", html: "<strong>Send less JS first.</strong> Import directly, split heavy and rare code, defer third parties, and enforce a budget." }
            ]
          },
          {
            id: "bundle-analysis",
            title: "Reading a bundle analysis",
            summary: "Find what is actually in your JavaScript, fix the biggest offenders, and keep it fixed with budgets.",
            minutes: 10,
            tags: ["bundle-analyzer", "tree-shaking", "duplicates", "budgets"],
            blocks: [
              { t: "p", html: "A bundle analyzer draws each chunk as a treemap where area equals bytes. The job is not to stare at it but to answer three questions: <strong>what is in the initial chunk</strong>, <strong>what is duplicated</strong>, and <strong>what should not be there at all</strong>." },
              { t: "widget", id: "perfBundle" },
              { t: "table", headers: ["Finding", "Typical cause", "Fix"], rows: [
                ["A whole utility library for three functions", "CommonJS build or namespace import defeats tree shaking", "ES module build, per-function imports, or native APIs"],
                ["Two copies of the same package", "Mismatched version ranges across dependencies", "Dedupe in the lockfile; align versions; resolution overrides"],
                ["Huge date or locale data", "All locales bundled by default", "Native Intl APIs, or import only the locales you ship"],
                ["Chart or editor in the main chunk", "Static import on a route that rarely uses it", "Dynamic import behind the interaction"],
                ["Polyfills for modern browsers", "Old browserslist targets", "Raise targets; serve differential bundles"],
                ["Server-only code in the client", "A shared module imports a server SDK", "Mark server-only modules; split shared code"]
              ] },
              { t: "code", lang: "bash", code:
                "# compare compressed sizes per chunk against a budget in CI\n" +
                "pnpm build --report            # emits a stats file + treemap\n" +
                "pnpm size-check                # fails if the entry chunk exceeds its budget\n\n" +
                "# budget example (conceptual)\n" +
                "#   entry chunk   <= 170 kB compressed\n" +
                "#   any route     <= 100 kB compressed\n" +
                "#   third parties  loaded after first interaction" },
              { t: "ul", items: [
                "Read <strong>compressed</strong> sizes for network cost, but remember parse and execute cost follows the uncompressed size.",
                "Check the initial chunk first: everything there delays hydration and interactivity.",
                "Mark packages as side-effect free only when they really are, so unused exports can be dropped.",
                "Track bundle size per pull request so regressions are reviewed like any other change."
              ] },
              { t: "note", variant: "trap", html: "Moving code into a lazy chunk that every page loads immediately only adds a request. Split at real boundaries: routes, interactions and feature flags." },
              { t: "note", variant: "key", html: "<strong>Measure the initial chunk, remove duplicates and dead weight, split at real boundaries, and enforce a budget in CI.</strong>" }
            ]
          },
          {
            id: "waterfalls",
            title: "Eliminating request waterfalls",
            summary: "The number-one frontend performance problem: requests that wait on each other for no reason.",
            minutes: 10,
            tags: ["waterfalls", "parallel", "prefetch"],
            blocks: [
              { t: "p", html: "A <strong>waterfall</strong> is a chain where request B starts only after A finishes, though B never needed A. Each link adds a full round trip, and on mobile networks those add up fast." },
              { t: "diagram", id: "request-waterfall", caption: "Top: fetch-on-render chains three round trips. Bottom: starting independent requests together finishes at the slowest one." },
              { t: "table", headers: ["Pattern", "Waterfall cause", "Fix"], rows: [
                ["Fetch in useEffect per component", "Child fetches only after the parent renders", "Hoist to route loader or server; use a query cache"],
                ["Sequential awaits", "await a; await b; when b ignores a", "Start both, then await Promise.all"],
                ["Lazy component that then fetches", "Code first, then data", "Start data and code together"],
                ["Early return before starting work", "Awaiting before checking a cheap condition", "Check cheap conditions first; defer awaits into branches"]
              ] },
              { t: "code", lang: "javascript", code:
                "// before: 3 round trips\n" +
                "const user = await getUser();\n" +
                "const prefs = await getPrefs();\n" +
                "const feed = await getFeed();\n\n" +
                "// after: 1 round trip of wall time\n" +
                "const [user, prefs, feed] = await Promise.all([getUser(), getPrefs(), getFeed()]);" },
              { t: "note", variant: "tip", html: "When B truly depends on A, move the dependency server-side (one API that joins both) so the browser makes one trip instead of two." },
              { t: "quiz", id: "perf-loading" },
              { t: "note", variant: "key", html: "<strong>Every unnecessary dependency between requests is a lost round trip.</strong> Start independent work together, fetch higher in the tree, and join dependent data on the server." }
            ]
          }
        ]
      },
      {
        id: "runtime",
        name: "Runtime & Rendering",
        icon: "wrench",
        lessons: [
          {
            id: "memoization",
            title: "Memoization that pays",
            summary: "memo, useMemo and useCallback are tools for specific problems, not a default coating.",
            minutes: 10,
            tags: ["memo", "useMemo", "useCallback", "compiler"],
            blocks: [
              { t: "p", html: "Memoization trades memory and comparisons for skipped work. It pays when the skipped work is <strong>expensive</strong> or when a <strong>stable identity</strong> lets a child bail out." },
              { t: "widget", id: "perfMemo" },
              { t: "table", headers: ["Tool", "Use when", "Skip when"], rows: [
                ["memo(Component)", "Expensive child re-renders with the same props", "Cheap children; props change every render anyway"],
                ["useMemo", "Expensive computation, or an object passed to memoized children or effect deps", "Simple expressions on primitives"],
                ["useCallback", "Function passed to a memoized child or used as an effect dependency", "Handlers on plain DOM elements"]
              ] },
              { t: "ul", items: [
                "First fix structure: move state down, lift content up as children, and split contexts.",
                "Depend on primitives in effects (<code class='tok'>user.id</code>, not <code class='tok'>user</code>).",
                "Use functional updates (<code class='tok'>setItems(prev =&gt; …)</code>) so callbacks need fewer dependencies.",
                "An optimizing compiler can memoize automatically; still write code that follows the rules of React."
              ] },
              { t: "note", variant: "trap", html: "Wrapping a component in memo and then passing it an inline object or arrow function gives you all of the cost and none of the benefit." },
              { t: "note", variant: "key", html: "<strong>Restructure first, memoize second, measure always.</strong> memo needs stable props; useMemo needs expensive work or identity that matters." }
            ]
          },
          {
            id: "long-lists-profiling",
            title: "Long lists and profiling",
            summary: "Virtualize big lists, use content-visibility for long pages, and let the profiler tell you what is slow.",
            minutes: 9,
            tags: ["virtualization", "content-visibility", "profiler"],
            blocks: [
              { t: "p", html: "DOM size drives style, layout and memory cost. If you render 10,000 rows, the browser does 10,000 rows of work even though 20 are visible." },
              { t: "table", headers: ["Virtualization", "content-visibility: auto"], rows: [
                ["Renders only rows near the viewport", "CSS-only: skips rendering off-screen sections"],
                ["Best for huge, uniform lists and grids", "Great for long articles and feeds"],
                ["Needs care for find-in-page and accessibility", "Set contain-intrinsic-size to avoid scrollbar jumps"]
              ] },
              { t: "code", lang: "text", code:
                ".feed-item {\n" +
                "  content-visibility: auto;\n" +
                "  contain-intrinsic-size: auto 320px; /* estimated height until rendered */\n" +
                "}" },
              { t: "ol", items: [
                "Reproduce the slow interaction with CPU throttling on.",
                "Record in the browser performance panel: find long tasks and what runs in them.",
                "Record in the React profiler: which components rendered, why, and for how long.",
                "Fix the largest cost, then measure again. Stop when it meets the budget."
              ] },
              { t: "note", variant: "tip", html: "Other JavaScript-level wins: build a Map for repeated lookups instead of <code class='tok'>array.find</code> in a loop, and hoist constant objects and regexes out of render." },
              { t: "quiz", id: "perf-runtime" },
              { t: "note", variant: "key", html: "<strong>Render only what is visible, and optimize only what the profiler shows.</strong> Measure with throttling, fix the biggest cost, repeat." }
            ]
          }
        ]
      }
    ]
  };
})();
