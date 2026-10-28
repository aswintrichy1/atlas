/* =====================================================================
   PIXEL · Next.js & Rendering Strategies
   window.TRACKS.next — modules: strategies / rsc / app
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};
  var ACC = "#34d399";

  /* ---------- nextStrategy: rendering strategy chooser ---------- */
  Widgets.nextStrategy = function (mount) {
    var h = WK.h;
    WK.shell(mount, "chooser", "Rendering strategy chooser",
      "Describe the page. Each strategy is scored against freshness, personalization, SEO and traffic, and the best fit is highlighted.");
    var s = { fresh: "static", pers: false, seo: true, traffic: "low" };
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    var META = {
      CSR: { name: "CSR — client-side rendering", ttfb: "fast shell, content after JS + fetch", cdn: "shell only", why: "Personalized, behind login, SEO irrelevant: ship a static shell and fetch per user." },
      SSG: { name: "SSG — static generation at build", ttfb: "fastest (CDN edge)", cdn: "yes", why: "Same HTML for everyone and it rarely changes: render once at build and serve from the edge." },
      ISR: { name: "ISR — static + timed revalidation", ttfb: "fastest (CDN edge)", cdn: "yes", why: "Shared content that changes on a schedule: serve cached HTML and regenerate in the background." },
      SSR: { name: "SSR / streaming with server components", ttfb: "server + data dependent", cdn: s.pers ? "no" : "short-lived", why: "Fresh per request or personalized but SEO-relevant: render on the server and stream." }
    };
    function scores() {
      var hi = s.traffic === "high";
      return {
        CSR: (s.pers ? 3 : 0) + (s.seo ? -4 : 1) + (s.fresh === "request" ? 1 : 0) + (hi ? 1 : 0),
        SSG: (s.fresh === "static" ? 4 : s.fresh === "hourly" ? 1 : -2) + (s.pers ? -4 : 0) + (s.seo ? 2 : 0) + (hi ? 2 : 0),
        ISR: (s.fresh === "hourly" ? 4 : s.fresh === "static" ? 2 : -1) + (s.pers ? -4 : 0) + (s.seo ? 2 : 0) + (hi ? 2 : 0),
        SSR: (s.fresh === "request" ? 4 : 1) + (s.pers ? 3 : 0) + (s.seo ? 2 : 0) + (hi ? -1 : 0)
      };
    }
    function paint() {
      var sc = scores(), best = "CSR";
      ["CSR", "SSG", "ISR", "SSR"].forEach(function (k) { if (sc[k] > sc[best]) best = k; });
      WK.clear(stage);
      ["CSR", "SSG", "ISR", "SSR"].forEach(function (k) {
        var pct = Math.max(4, Math.min(100, ((sc[k] + 6) / 16) * 100));
        var win = k === best;
        stage.appendChild(h("div", { style: "border-radius:10px;padding:8px 12px;margin-bottom:6px;" + (win ? WK.tint(ACC, 22) : "border:1px solid var(--line);background:var(--surface-solid);color:var(--text);") },
          h("div", { style: "display:flex;justify-content:space-between;gap:8px;font-size:0.86rem;font-weight:600;" }, h("span", {}, META[k].name + (win ? "  ✓ best fit" : "")), h("span", { style: "font-family:var(--font-mono);color:var(--text-dim);" }, "score " + sc[k])),
          h("div", { style: "height:8px;border-radius:6px;background:var(--line);margin-top:6px;overflow:hidden;" }, h("div", { style: "height:100%;width:" + pct + "%;background:" + (win ? ACC : "var(--line-strong)") + ";" }))));
      });
      stage.appendChild(h("p", { style: "margin:10px 0 0;font-size:0.86rem;color:var(--text);" }, META[best].why));
      var cdn = best === "SSR" ? (s.pers ? "no (per user)" : "short-lived s-maxage") : META[best].cdn;
      WK.readout(readout, [["recommended", best], ["time to first byte", META[best].ttfb], ["CDN cacheable", cdn]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([["static", "rarely changes"], ["hourly", "changes hourly"], ["request", "fresh per request"]], 0, function (v) { s.fresh = v; paint(); }, "Data freshness"),
      WK.segment([[false, "same for everyone"], [true, "personalized"]], 0, function (v) { s.pers = v; paint(); }, "Personalization")));
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([[true, "SEO critical"], [false, "SEO irrelevant"]], 0, function (v) { s.seo = v; paint(); }, "SEO"),
      WK.segment([["low", "steady traffic"], ["high", "spiky, high traffic"]], 0, function (v) { s.traffic = v; paint(); }, "Traffic")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- nextStreamTimeline: blocking vs streaming ---------- */
  Widgets.nextStreamTimeline = function (mount) {
    var h = WK.h;
    WK.shell(mount, "timeline", "Blocking, parallel, streaming or client fetch",
      "Three data sources feed one product page. Change the slow reviews call and the data strategy, and compare when each part becomes visible.");
    var mode = "seq", reviews = 1200;
    var RTT = 80, PAINT = 30, HYDRATE = 600, CLIENT_RTT = 100, HEADER = 50, PRODUCT = 300;
    var MODES = { seq: "sequential awaits (waterfall)", par: "Promise.all, no Suspense", stream: "streaming with Suspense", client: "client fetch after hydration" };
    function times() {
      if (mode === "seq") { var t = RTT + HEADER + PRODUCT + reviews + PAINT; return { shell: t, header: t, product: t, reviews: t }; }
      if (mode === "par") { var t2 = RTT + Math.max(HEADER, PRODUCT, reviews) + PAINT; return { shell: t2, header: t2, product: t2, reviews: t2 }; }
      if (mode === "stream") return { shell: RTT + HEADER + PAINT, header: RTT + HEADER + PAINT, product: RTT + PRODUCT + PAINT, reviews: RTT + reviews + PAINT };
      var base = RTT + PAINT, after = RTT + HYDRATE + CLIENT_RTT;
      return { shell: base, header: after + HEADER + PAINT, product: after + PRODUCT + PAINT, reviews: after + reviews + PAINT };
    }
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var t = times();
      var max = Math.max(t.shell, t.header, t.product, t.reviews, 1);
      WK.clear(stage);
      [["shell", "Page shell", "#94a3b8"], ["header", "Header (50 ms)", "#38bdf8"], ["product", "Product (300 ms)", ACC], ["reviews", "Reviews (" + reviews + " ms)", "#f59e0b"]].forEach(function (r) {
        var pct = (t[r[0]] / max) * 100;
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:130px 1fr 70px;gap:10px;align-items:center;margin-bottom:8px;" },
          h("span", { style: "font-size:0.82rem;color:var(--text);" }, r[1]),
          h("div", { style: "height:14px;border-radius:7px;background:var(--line);position:relative;overflow:hidden;" },
            h("div", { style: "position:absolute;left:0;top:0;bottom:0;width:" + pct + "%;" + WK.tint(r[2], 40) + "border-radius:7px;" })),
          h("span", { style: "font-family:var(--font-mono);font-size:0.78rem;color:var(--text-dim);text-align:right;" }, t[r[0]] + " ms")));
      });
      stage.appendChild(h("p", { style: "margin:8px 0 0;font-size:0.84rem;color:var(--text);" },
        mode === "seq" ? "Each await waits for the previous one, so the slowest chain blocks every byte of HTML." :
        mode === "par" ? "Requests overlap, but the HTML still waits for the slowest one." :
        mode === "stream" ? "The shell flushes immediately; each Suspense boundary streams in when its data resolves." :
        "HTML arrives fast but empty; data waits for JavaScript to download, hydrate and then fetch."));
      WK.readout(readout, [["mode", MODES[mode]], ["first paint", t.shell + " ms"], ["product visible", t.product + " ms"], ["fully complete", Math.max(t.header, t.product, t.reviews) + " ms"]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([["seq", "Waterfall"], ["par", "Promise.all"], ["stream", "Streaming"], ["client", "Client fetch"]], 0, function (v) { mode = v; paint(); }, "Data strategy")));
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([[400, "reviews 400 ms"], [1200, "reviews 1200 ms"], [3000, "reviews 3000 ms"]], 1, function (v) { reviews = v; paint(); }, "Reviews latency")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "next-strategies": {
      title: "Rendering strategies checkpoint",
      sub: "CSR, SSR, SSG, ISR and hydration.",
      questions: [
        { q: "A marketing page changes a few times a year and must rank well. Which strategy fits?", options: ["Client-side rendering", "Static generation at build time", "Server rendering on every request", "Rendering in a web worker"], answer: 1,
          explain: "Content that is the same for everyone and rarely changes is best rendered once and served from a CDN: fast and cheap." },
        { q: "What does incremental static regeneration add to static generation?", options: ["Client-side routing", "Serving cached HTML while regenerating it in the background after a revalidation window or on demand", "Per-user personalization", "Automatic code splitting"], answer: 1,
          explain: "ISR keeps static speed but refreshes pages on a schedule or when triggered, so content can change without a full rebuild." },
        { q: "What is hydration?", options: ["Compressing HTML", "Attaching React's event handlers and state to server-rendered HTML so it becomes interactive", "Fetching data on the server", "Caching images"], answer: 1,
          explain: "The server sends HTML for fast paint; the client then runs the components to wire up interactivity. Until then the page looks ready but does not respond." },
        { q: "A component renders new Date().toLocaleTimeString() during render. What happens with SSR?", options: ["Nothing unusual", "A hydration mismatch, because server and client produce different text", "It throws on the server", "The time is cached forever"], answer: 1,
          explain: "Server and client render at different moments and possibly in different time zones, so the markup differs. Render such values after mount or pass them from the server." },
        { q: "A signed-in analytics dashboard does not need SEO. Which is a reasonable choice?", options: ["Static generation per user at build time", "Client-side rendering or server rendering per request", "ISR with a one-year window", "Prerender every possible date range"], answer: 1,
          explain: "Personalized data cannot be shared across users, so it is rendered per request on the server or fetched on the client." }
      ]
    },
    "next-rsc": {
      title: "Server components & streaming checkpoint",
      sub: "The client boundary, Suspense streaming and server actions.",
      questions: [
        { q: "What does the 'use client' directive mark?", options: ["A component that only runs on the client and never on the server", "The boundary where a module and its imports become part of the client bundle", "A server action", "A test file"], answer: 1,
          explain: "Client components are still prerendered on the server, but their code ships to the browser. Everything they import joins the client bundle." },
        { q: "A server component passes a 2 MB user object to a client component that shows only the name. What should change?", options: ["Nothing", "Pass only the fields the client needs, because props across the boundary are serialized into the payload", "Wrap it in useMemo", "Convert it to a string first"], answer: 1,
          explain: "Everything crossing the server-to-client boundary is serialized and sent. Pick the minimal data to keep the payload small." },
        { q: "A page awaits three independent fetches one after another. What is the fix?", options: ["Add more Suspense boundaries only", "Start all three and await them together with Promise.all, or let separate Suspense boundaries fetch in parallel", "Move them to useEffect", "Increase the timeout"], answer: 1,
          explain: "Sequential awaits create a waterfall. Starting independent work together cuts total time to the slowest request." },
        { q: "Why must a server action check authentication and authorization itself?", options: ["It runs before middleware", "It is exposed as a callable endpoint, so anyone can invoke it directly", "Server actions cannot read cookies", "It is optional"], answer: 1,
          explain: "A server action is effectively a public POST endpoint. Hiding the button does not protect it; verify the session and permissions inside every action." },
        { q: "What does a Suspense boundary define when streaming?", options: ["A security boundary", "A unit of UI that can show a fallback and stream in when its data is ready", "A route segment", "A memoization boundary"], answer: 1,
          explain: "Suspense boundaries let the shell flush early; each boundary's content streams in later with its own fallback in the meantime." }
      ]
    },
    "next-app": {
      title: "Routing & data checkpoint",
      sub: "File-system routing, layouts and caching.",
      questions: [
        { q: "In a nested layout, what happens to the layout when navigating between its child pages?", options: ["It unmounts and remounts", "It stays mounted and keeps its state; only the page segment re-renders", "It reloads the whole document", "It is cached as static HTML"], answer: 1,
          explain: "Layouts persist across navigations within their segment, which preserves state such as an open sidebar and avoids re-rendering shared UI." },
        { q: "Two server components in one request call getUser(id). How do you avoid two database queries?", options: ["A module-level global variable", "Wrap getUser with React's per-request cache so calls with the same arguments are deduplicated", "Call it in useEffect", "Use localStorage"], answer: 1,
          explain: "A per-request cache dedupes identical calls within one render. Module-level mutable state would leak data between users' requests." },
        { q: "Reading cookies() or headers() in a server component usually means what for that route?", options: ["It becomes fully static", "It renders dynamically per request", "It is cached for a year", "It fails to build"], answer: 1,
          explain: "Request-specific inputs mean the output differs per request, so the route cannot be prerendered as one static file." },
        { q: "What does a Link do to make navigation feel instant?", options: ["Reloads the page faster", "Prefetches the target route's code and data when it becomes visible or is hovered", "Disables JavaScript", "Caches images"], answer: 1,
          explain: "Prefetching moves the network cost before the click, so the transition can render from cache." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.next = {
    id: "next",
    name: "Next.js & Rendering Strategies",
    short: "NEXT",
    tagline: "Decide where and when HTML is made",
    color: ACC,
    blurb: "Where HTML is produced decides speed, cost and SEO. Compare CSR, SSR, SSG and ISR, understand hydration, then learn React Server Components, streaming with Suspense, server actions, App Router layouts and data caching in Next.js.",
    modules: [
      {
        id: "strategies",
        name: "Rendering Strategies",
        icon: "trend",
        lessons: [
          {
            id: "csr-ssr-ssg-isr",
            title: "CSR, SSR, SSG and ISR",
            summary: "Four answers to one question: when and where does the HTML get made?",
            minutes: 11,
            tags: ["csr", "ssr", "ssg", "isr"],
            blocks: [
              { t: "p", html: "Every strategy is a choice of <strong>when</strong> HTML is produced (build, request, or in the browser) and <strong>where</strong> it can be cached. Everything else follows from that." },
              { t: "diagram", id: "rendering-timeline", caption: "When useful pixels arrive under each strategy: static HTML from the edge is earliest; client rendering waits for JavaScript and a fetch." },
              { t: "table", headers: ["Strategy", "HTML made", "Strength", "Cost"], rows: [
                ["CSR", "In the browser after JS loads", "Simple hosting, rich interactivity", "Blank or skeleton first; weak SEO; big JS"],
                ["SSR", "On the server, per request", "Fresh, personalized, crawlable", "Server cost; TTFB depends on data"],
                ["SSG", "At build time", "Fastest, cacheable at the edge", "Stale until rebuild; build time grows with pages"],
                ["ISR", "At build, then regenerated on a timer or on demand", "Static speed with fresh-ish content", "Briefly stale; cache semantics to learn"]
              ] },
              { t: "widget", id: "nextStrategy" },
              { t: "note", variant: "tip", html: "Strategies mix per route. A store can be SSG for the home page, ISR for product pages, SSR for search results and CSR inside the account area." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"must rank in search\", \"prices change hourly\", \"personalized dashboard\", \"Black Friday traffic\" — map each phrase to freshness, personalization, SEO and cacheability." },
              { t: "note", variant: "key", html: "<strong>Choose by freshness, personalization, SEO and cacheability.</strong> Static where you can, revalidated where content changes, server-rendered where it must be fresh or personal." }
            ]
          },
          {
            id: "hydration",
            title: "Hydration and its costs",
            summary: "Server HTML paints fast, but it is not interactive until React hydrates it — and the two renders must match.",
            minutes: 9,
            tags: ["hydration", "mismatch", "islands"],
            blocks: [
              { t: "p", html: "SSR gives you HTML early; <strong>hydration</strong> is React re-running your components in the browser to attach handlers and state to that HTML. Until it finishes, the page looks ready but clicks may do nothing." },
              { t: "stat", items: [{ v: "2×", k: "work: render on the server, hydrate on the client" }, { v: "JS", k: "every hydrated component ships its code" }, { v: "0", k: "differences allowed between server and client markup" }] },
              { t: "table", headers: ["Mismatch cause", "Fix"], rows: [
                ["Dates, random ids, Math.random in render", "useId for ids; compute time-sensitive values after mount or on the server and pass them down"],
                ["Reading window or localStorage in render", "Read in an effect, or render a placeholder on both sides"],
                ["Invalid HTML nesting (div inside p)", "Fix the markup; browsers repair it differently than React expects"],
                ["Browser extensions injecting attributes", "Usually harmless; suppress only on the affected element"]
              ] },
              { t: "code", lang: "javascript", code:
                "// avoid a theme flash: set the attribute before React hydrates\n" +
                "<script dangerouslySetInnerHTML={{ __html:\n" +
                "  `try{document.documentElement.dataset.theme=localStorage.getItem('theme')||'light'}catch(e){}`\n" +
                "}} />" },
              { t: "note", variant: "tip", html: "Less to hydrate is the best optimization: server components ship no client JS, and only the interactive islands hydrate." },
              { t: "quiz", id: "next-strategies" },
              { t: "note", variant: "key", html: "<strong>Hydration re-runs components to make server HTML interactive.</strong> Keep server and client output identical, and shrink what must hydrate." }
            ]
          }
        ]
      },
      {
        id: "rsc",
        name: "Server Components & Streaming",
        icon: "queue",
        lessons: [
          {
            id: "server-components",
            title: "React Server Components and the client boundary",
            summary: "Server components render on the server and ship zero JS; 'use client' marks where interactivity begins.",
            minutes: 12,
            tags: ["rsc", "use-client", "serialization"],
            blocks: [
              { t: "p", html: "Picture the tree split by a line. Above it, <strong>server components</strong> run only on the server: they can read databases and secrets and their code never reaches the browser. Below it, <strong>client components</strong> handle state, effects and events." },
              { t: "diagram", id: "rsc-boundary", caption: "Server components fetch and render; props crossing into a client component are serialized; client components can receive server-rendered children." },
              { t: "table", headers: ["Server component", "Client component"], rows: [
                ["async/await data directly", "useState, useEffect, event handlers"],
                ["Access to secrets, filesystem, database", "Access to browser APIs"],
                ["Zero bytes of component JS shipped", "Code joins the client bundle"],
                ["Default in the App Router", "Opt in with <code class='tok'>\"use client\"</code> at the top of the module"]
              ] },
              { t: "code", lang: "javascript", code:
                "// app/products/[id]/page.tsx — a server component\n" +
                "export default async function ProductPage({ params }) {\n" +
                "  const { id } = await params;\n" +
                "  const product = await db.product.find(id);\n" +
                "  return (\n" +
                "    <article>\n" +
                "      <h1>{product.name}</h1>\n" +
                "      {/* pass only what the client needs: it is serialized */}\n" +
                "      <AddToCart productId={product.id} price={product.price} />\n" +
                "      <Accordion>{/* server-rendered children inside a client component */}\n" +
                "        <Specs specs={product.specs} />\n" +
                "      </Accordion>\n" +
                "    </article>\n" +
                "  );\n" +
                "}" },
              { t: "ul", items: [
                "Push <code class='tok'>\"use client\"</code> to the leaves: a button, not the whole page.",
                "Props across the boundary must be serializable: no functions (except server actions), no class instances.",
                "Pass server components as <code class='tok'>children</code> into client components to keep them server-rendered.",
                "Mark server-only modules so an accidental client import fails the build instead of leaking secrets."
              ] },
              { t: "note", variant: "trap", html: "Putting <code class='tok'>\"use client\"</code> at the root layout turns your entire app into client components and quietly throws away the main benefit." },
              { t: "note", variant: "key", html: "<strong>Server components fetch and render with zero client JS; client components add interactivity.</strong> Keep the boundary at the leaves and send only minimal serialized props across it." }
            ]
          },
          {
            id: "streaming-suspense",
            title: "Streaming with Suspense and avoiding waterfalls",
            summary: "Flush the shell immediately, stream slow parts as they resolve, and start independent work in parallel.",
            minutes: 11,
            tags: ["streaming", "suspense", "waterfalls", "promise-all"],
            blocks: [
              { t: "p", html: "Blocking SSR sends nothing until the slowest query finishes. <strong>Streaming</strong> sends the shell right away and fills in each Suspense boundary as its data resolves." },
              { t: "widget", id: "nextStreamTimeline" },
              { t: "code", lang: "javascript", code:
                "export default async function Page({ params }) {\n" +
                "  const { id } = await params;\n" +
                "  const productP = getProduct(id);      // start early…\n" +
                "  const reviewsP = getReviews(id);      // …in parallel\n" +
                "  const product = await productP;       // await only what the shell needs\n" +
                "  return (\n" +
                "    <>\n" +
                "      <ProductHero product={product} />\n" +
                "      <Suspense fallback={<ReviewsSkeleton />}>\n" +
                "        <Reviews promise={reviewsP} />  {/* streams in later */}\n" +
                "      </Suspense>\n" +
                "    </>\n" +
                "  );\n" +
                "}" },
              { t: "table", headers: ["Tier", "Data loading", "User sees"], rows: [
                ["Naive", "Sequential awaits in one component", "Nothing until the sum of all latencies"],
                ["Solid", "Promise.all for independent data", "Everything at the slowest latency"],
                ["Standout", "Parallel starts + Suspense boundaries around slow, non-critical parts", "Shell and critical content first, the rest as it lands"]
              ] },
              { t: "note", variant: "tip", html: "Place boundaries around content of different importance and speed. Too many tiny boundaries cause popcorn layout; reserve space in fallbacks to avoid layout shift." },
              { t: "note", variant: "key", html: "<strong>Start independent work early, await late, and stream behind Suspense.</strong> The shell should never wait for the slowest query." }
            ]
          },
          {
            id: "server-actions",
            title: "Server actions: mutations as functions",
            summary: "Call server code from forms and buttons — and secure it like the public endpoint it is.",
            minutes: 10,
            tags: ["server-actions", "mutations", "security", "revalidation"],
            blocks: [
              { t: "p", html: "A server action is an async function marked <code class='tok'>\"use server\"</code> that the client can call. Under the hood it is an <strong>HTTP endpoint</strong> the framework creates for you." },
              { t: "code", lang: "javascript", code:
                "\"use server\";\n" +
                "export async function renameProject(formData) {\n" +
                "  const session = await auth();                       // 1. who is calling?\n" +
                "  if (!session) throw new Error(\"Unauthorized\");\n" +
                "  const input = RenameSchema.parse({                  // 2. validate untrusted input\n" +
                "    id: formData.get(\"id\"), name: formData.get(\"name\"),\n" +
                "  });\n" +
                "  await assertCanEdit(session.user, input.id);       // 3. may they touch THIS record?\n" +
                "  await db.project.update(input.id, { name: input.name });\n" +
                "  revalidatePath(`/projects/${input.id}`);            // 4. refresh cached views\n" +
                "  after(() => audit.log(\"rename\", input.id));        // 5. non-blocking follow-up work\n" +
                "}" },
              { t: "table", headers: ["Concern", "Rule"], rows: [
                ["Authentication", "Check the session inside every action"],
                ["Authorization", "Check access to the specific resource, not just login"],
                ["Input", "Validate with a schema; never trust hidden form fields"],
                ["Caching", "Revalidate the paths or tags the write affected"],
                ["Slow side work", "Logging, analytics, emails after the response"]
              ] },
              { t: "note", variant: "warn", html: "Hiding a button in the UI is not access control. Anyone who can find the action's id can call it with arbitrary arguments." },
              { t: "note", variant: "tip", html: "Forms that use actions work before hydration (progressive enhancement), and <code class='tok'>useFormStatus</code> / <code class='tok'>useActionState</code> give pending and result states." },
              { t: "code", lang: "javascript", code:
                "\"use client\";\n" +
                "function RenameForm({ project }) {\n" +
                "  const [state, formAction, isPending] = useActionState(\n" +
                "    (prev, fd) => renameProject(fd), { error: null });  // actions receive (prevState, formData)\n" +
                "  const [optimisticName, setOptimisticName] = useOptimistic(project.name);\n" +
                "  return (\n" +
                "    <form action={(fd) => { setOptimisticName(fd.get(\"name\")); return formAction(fd); }}>\n" +
                "      <h2>{optimisticName}</h2>\n" +
                "      <input type=\"hidden\" name=\"id\" value={project.id} />\n" +
                "      <label>New name <input name=\"name\" required /></label>\n" +
                "      <button disabled={isPending}>{isPending ? \"Saving…\" : \"Rename\"}</button>\n" +
                "      {state.error && <p role=\"alert\">{state.error}</p>}\n" +
                "    </form>\n" +
                "  );\n" +
                "}" },
              { t: "p", html: "The action returns a serializable result (for example <code class='tok'>{ error }</code>) instead of throwing for expected failures, so the form can show it. The optimistic value reverts automatically if the action fails." },
              { t: "quiz", id: "next-rsc" },
              { t: "note", variant: "key", html: "<strong>Every server action is a public endpoint.</strong> Authenticate, authorize, validate, revalidate, and push non-critical work after the response." }
            ]
          }
        ]
      },
      {
        id: "app",
        name: "Routing & Data",
        icon: "map",
        lessons: [
          {
            id: "app-router-data",
            title: "App Router, layouts and data caching",
            summary: "File-system routes, persistent layouts, per-request dedup and the caching layers you must reason about.",
            minutes: 12,
            tags: ["app-router", "layouts", "caching", "react-cache"],
            blocks: [
              { t: "p", html: "The App Router maps folders to URL segments. Each segment can have a <code class='tok'>layout</code> that <strong>persists across navigations</strong>, a <code class='tok'>page</code>, and special files for loading and error states." },
              { t: "code", lang: "text", code:
                "app/\n" +
                "  layout.tsx            root layout (html, body, providers)\n" +
                "  (shop)/               route group: organizes, not in the URL\n" +
                "    products/\n" +
                "      page.tsx          /products\n" +
                "      [id]/\n" +
                "        page.tsx        /products/123\n" +
                "        loading.tsx     Suspense fallback for this segment\n" +
                "        error.tsx       error boundary for this segment\n" +
                "  dashboard/\n" +
                "    layout.tsx          persists while moving between dashboard pages" },
              { t: "table", headers: ["Layer", "What it remembers", "Watch out for"], rows: [
                ["Per-request dedup (React cache)", "Identical function calls within one render", "Scope is a single request only"],
                ["Data cache", "fetch or function results across requests", "Defaults have changed between versions; set caching explicitly"],
                ["Full route cache", "Rendered output of static routes", "Request-specific APIs (cookies, headers) make a route dynamic"],
                ["Client router cache", "Visited and prefetched segments", "Mutations must revalidate or refresh"]
              ] },
              { t: "code", lang: "javascript", code:
                "import { cache } from \"react\";\n" +
                "export const getUser = cache(async (id) => db.user.find(id));  // deduped per request\n\n" +
                "// never: module-level mutable state shared across requests\n" +
                "// let currentUser;  <- leaks one user's data into another's render" },
              { t: "ul", items: [
                "<code class='tok'>&lt;Link&gt;</code> prefetches routes in view, so navigations render from cache.",
                "Middleware runs before routing for redirects, rewrites and coarse auth checks; keep it fast.",
                "Hoist static I/O (fonts, config) to module scope; keep per-request data inside the request."
              ] },
              { t: "note", variant: "warn", html: "Caching defaults are one of the most-changed areas across framework versions. State your caching intent explicitly per fetch or route rather than relying on remembered defaults." },
              { t: "quiz", id: "next-app" },
              { t: "note", variant: "key", html: "<strong>Folders are routes, layouts persist, and caching is layered.</strong> Dedupe per request with cache(), declare caching explicitly, and never share mutable state across requests." }
            ]
          }
        ]
      }
    ]
  };
})();
