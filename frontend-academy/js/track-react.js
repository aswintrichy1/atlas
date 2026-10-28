/* =====================================================================
   PIXEL · React Core
   window.TRACKS.react — modules: basics / hooks / tree
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};
  var ACC = "#61dafb";

  /* ---------- reactRerender: who re-renders, and why ---------- */
  var TREE = [
    { name: "App", depth: 0, tags: ["state: query, theme, items"] },
    { name: "Header", depth: 1, tags: [] },
    { name: "SearchBox", depth: 2, tags: ["input"] },
    { name: "Toolbar", depth: 1, tags: ["memo-able"] },
    { name: "ThemeButton", depth: 2, tags: ["reads theme context"] },
    { name: "List", depth: 1, tags: ["memo-able", "props: items"] },
    { name: "Item 1", depth: 2, tags: ["memo-able"] },
    { name: "Item 2", depth: 2, tags: ["memo-able"] },
    { name: "Item 3", depth: 2, tags: ["memo-able"] },
    { name: "Footer", depth: 1, tags: ["memo-able", "reads setTheme"] }
  ];
  Widgets.reactRerender = function (mount) {
    var h = WK.h;
    WK.shell(mount, "visualizer", "Re-render visualizer",
      "Trigger an update, then flip memo, context and colocation switches. Highlighted components rendered on the last action; the badge counts total renders.");
    var opt = { memo: false, memoValue: false, split: false, colocate: false };
    var counts = {}, last = {}, lastWhy = "Mount: every component renders once.", total = 0, lastAction = "mount";
    TREE.forEach(function (n) { counts[n.name] = 1; last[n.name] = true; total++; });

    function compute(action) {
      var R = {};
      if (action === "search" && opt.colocate) { R.SearchBox = true; return { set: R, why: "The query state lives inside SearchBox, so only SearchBox renders. Nothing above it changed." }; }
      R.App = true; R.Header = true; R.SearchBox = true;
      var valueChanged = action === "theme" || !opt.memoValue;
      var actionsChanged = opt.split ? false : valueChanged;
      if (!opt.memo) R.Toolbar = true;
      if (R.Toolbar || valueChanged) R.ThemeButton = true;
      if (!opt.memo || actionsChanged) R.Footer = true;
      var itemsChanged = action === "edit";
      if (!opt.memo || itemsChanged) R.List = true;
      if (R.List) { ["Item 1", "Item 2", "Item 3"].forEach(function (n) { if (!opt.memo || n === "Item 2") R[n] = true; }); }
      var why = [];
      why.push("App state changed, so App re-renders and, by default, every child renders with it.");
      if (opt.memo) why.push("memo lets Toolbar, List, Items and Footer skip when their props are unchanged" + (itemsChanged ? " — only the edited Item 2 gets a new object." : "."));
      if (valueChanged && action !== "theme") why.push("The context value is a new object each render, so consumers render even behind memo.");
      if (action === "theme") why.push("The theme really changed, so theme consumers must render.");
      if (opt.split && action === "theme") why.push("Split context: Footer only reads the stable setter, so it skips.");
      return { set: R, why: why.join(" ") };
    }
    var treeEl = h("div", { style: "display:flex;flex-direction:column;gap:6px;" });
    var whyEl = h("p", { style: "margin:12px 0 0;font-size:0.86rem;color:var(--text);" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      WK.clear(treeEl);
      TREE.forEach(function (n) {
        var hit = !!last[n.name];
        var memoTag = opt.memo && n.tags.indexOf("memo-able") >= 0;
        var tags = n.tags.filter(function (t) { return t !== "memo-able"; });
        if (memoTag) tags.unshift("React.memo");
        if (n.name === "SearchBox" && opt.colocate) tags.unshift("state: query");
        if (n.name === "App" && opt.colocate) tags = ["state: theme, items"];
        treeEl.appendChild(h("div", {
          style: "margin-left:" + (n.depth * 26) + "px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:10px;padding:7px 10px;transition:background .25s;" +
            (hit ? WK.tint(ACC, 26) : "border:1px solid var(--line);background:var(--surface-solid);color:var(--text);")
        },
          h("span", { style: "font-family:var(--font-mono);font-weight:700;font-size:0.86rem;" }, "<" + n.name.replace(" ", "") + " />"),
          tags.map(function (t) { return h("span", { style: "font-size:0.72rem;color:var(--text-dim);border:1px solid var(--line-strong);border-radius:999px;padding:1px 8px;" }, t); }),
          h("span", { style: "margin-left:auto;font-family:var(--font-mono);font-size:0.76rem;color:var(--text-dim);" }, (hit ? "rendered · " : "skipped · ") + counts[n.name] + "×")));
      });
      whyEl.textContent = lastWhy;
      var n = Object.keys(last).filter(function (k) { return last[k]; }).length;
      WK.readout(readout, [["last action", lastAction], ["rendered", n + " / " + TREE.length], ["total renders", total]]);
    }
    function act(action, label) {
      var r = compute(action);
      last = r.set; lastWhy = r.why; lastAction = label;
      Object.keys(r.set).forEach(function (k) { counts[k]++; total++; });
      paint();
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.btn("Type in search", function () { act("search", "type in search"); }, "primary"),
      WK.btn("Toggle theme", function () { act("theme", "toggle theme"); }),
      WK.btn("Edit item 2", function () { act("edit", "edit item 2"); }),
      WK.btn("Reset counts", function () { TREE.forEach(function (n) { counts[n.name] = 0; }); last = {}; total = 0; lastAction = "reset"; lastWhy = "Counters cleared."; paint(); }, "ghost")));
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.toggle("React.memo on children", false, function (v) { opt.memo = v; }),
      WK.toggle("Memoize context value", false, function (v) { opt.memoValue = v; }),
      WK.toggle("Split state / actions context", false, function (v) { opt.split = v; }),
      WK.toggle("Colocate query in SearchBox", false, function (v) { opt.colocate = v; })));
    mount.appendChild(h("div", { class: "w-stage" }, treeEl, whyEl));
    mount.appendChild(readout);
    paint();
  };

  /* ---------- reactKeys: index keys vs stable ids ---------- */
  Widgets.reactKeys = function (mount) {
    var h = WK.h;
    WK.shell(mount, "demo", "Keys and component identity",
      "Each row has an uncontrolled input holding its own state. Prepend or rotate the list and see whether that state follows the item or stays at the position.");
    var strategy = "index", items, dom, expected, nextId;
    function reset() {
      items = [{ id: "a", label: "Apples" }, { id: "b", label: "Bread" }, { id: "c", label: "Cheese" }];
      expected = { a: "2 kg", b: "sourdough", c: "aged 12 months" };
      dom = {}; nextId = 1;
      items.forEach(function (it, i) { dom[keyOf(it, i)] = expected[it.id]; });
    }
    function keyOf(it, i) { return strategy === "index" ? "i" + i : "id-" + it.id; }
    var listEl = h("div", { style: "display:flex;flex-direction:column;gap:8px;" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      WK.clear(listEl);
      var bad = 0;
      items.forEach(function (it, i) {
        var k = keyOf(it, i);
        var val = dom[k] != null ? dom[k] : "";
        var ok = val === (expected[it.id] || "");
        if (!ok) bad++;
        var input = h("input", { type: "text", value: val, "aria-label": "Note for " + it.label, style: "max-width:180px" });
        input.addEventListener("input", function () { dom[k] = input.value; expected[it.id] = input.value; });
        listEl.appendChild(h("div", { style: "display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-radius:10px;padding:8px 10px;" + (ok ? "border:1px solid var(--line);background:var(--surface-solid);color:var(--text);" : WK.tint(WK.BAD, 16)) },
          h("span", { style: "font-family:var(--font-mono);font-size:0.74rem;color:var(--text-dim);min-width:70px;" }, "key=" + (strategy === "index" ? i : it.id)),
          h("strong", { style: "min-width:90px;" }, it.label),
          WK.field("note", input),
          h("span", { style: "font-size:0.76rem;color:var(--text-dim);" }, ok ? "state matches" : "wrong state: expected \"" + (expected[it.id] || "") + "\"")));
      });
      WK.readout(readout, [["key strategy", strategy === "index" ? "array index" : "stable id"], ["rows", items.length], ["rows with the wrong state", bad]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([["index", "key = index"], ["id", "key = item.id"]], 0, function (v) { strategy = v; reset(); paint(); }, "Key strategy"),
      WK.btn("Prepend item", function () {
        if (items.length >= 6) return;
        var it = { id: "n" + nextId, label: "New item " + nextId }; nextId++;
        expected[it.id] = "";
        items = [it].concat(items); paint();
      }, "primary"),
      WK.btn("Rotate", function () { items = items.slice(1).concat(items.slice(0, 1)); paint(); }),
      WK.btn("Reset", function () { reset(); paint(); }, "ghost")));
    mount.appendChild(h("div", { class: "w-stage" }, listEl));
    mount.appendChild(readout);
    reset();
    paint();
  };

  /* ---------- reactEffectDeps: dependency array simulator ---------- */
  var EFFECT_CODE = {
    fetch: function (d) { return "useEffect(() => {\n  let ignore = false;\n  fetchUser(userId).then((u) => { if (!ignore) setUser(u); });\n  return () => { ignore = true; };\n}" + d + ");"; },
    resize: function (d) { return "useEffect(() => {\n  const onResize = () => setWidth(window.innerWidth);\n  window.addEventListener(\"resize\", onResize);\n  return () => window.removeEventListener(\"resize\", onResize);\n}" + d + ");"; },
    derive: function (d) { return "// state that mirrors other state\nconst [fullName, setFullName] = useState(\"\");\nuseEffect(() => {\n  setFullName(first + \" \" + last);\n}" + d + ");\n\n// better: const fullName = first + \" \" + last;"; }
  };
  var DEPS = { none: "", empty: ", []", id: ", [userId]", obj: ", [options]  // options = { userId } created every render" };
  function verdict(sc, v) {
    if (sc === "derive") return ["You don't need an effect", "Derive fullName during render. The effect adds an extra render and a frame of stale UI."];
    if (sc === "fetch") {
      if (v === "none") return ["Infinite loop", "No array means the effect runs after every render; setUser causes a render, which runs the effect again."];
      if (v === "empty") return ["Stale data", "[] runs once. When userId changes, the effect never refetches, so the UI shows the old user."];
      if (v === "id") return ["Correct", "Runs on mount and whenever userId changes; the ignore flag discards out-of-order responses."];
      return ["Infinite loop", "A new object every render is a new dependency every render; with setUser inside, it never settles."];
    }
    if (v === "none") return ["Wasteful", "Unsubscribes and resubscribes after every render. It works, but it is churn."];
    if (v === "empty") return ["Correct", "Subscribe on mount, unsubscribe on unmount. The handler only uses stable values."];
    if (v === "id") return ["Unnecessary dependency", "The listener does not use userId, so resubscribing when it changes is wasted work. Dependencies should be exactly what the effect reads."];
    return ["Wasteful", "An object created during render is a new dependency every render, so this resubscribes constantly."];
  }
  Widgets.reactEffectDeps = function (mount) {
    var h = WK.h;
    WK.shell(mount, "simulator", "Effect dependency simulator",
      "Pick a scenario and a dependency array, then re-render the parent or change userId. The log shows when the effect and its cleanup run.");
    var sc = "fetch", v = "id", runs, cleanups, log, userId, shownFor;
    function start() { runs = 1; cleanups = 0; userId = 1; shownFor = 1; log = ["mount → effect runs (userId " + userId + ")"]; }
    function rerun(reason) {
      var hasCleanup = sc !== "derive";
      if (sc === "fetch" && (v === "none" || v === "obj")) {
        for (var k = 0; k < 3; k++) { if (hasCleanup) cleanups++; runs++; }
        log.push(reason + " → effect → setUser → render → effect → … (loop, 3 of ∞ shown)");
        shownFor = userId;
        return;
      }
      if (hasCleanup) { cleanups++; log.push(reason + " → cleanup, then effect runs"); }
      else log.push(reason + " → effect runs → setFullName → extra render");
      runs++;
      shownFor = userId;
    }
    function rerender() {
      if (v === "none" || v === "obj") rerun("parent re-render");
      else log.push("parent re-render → deps unchanged, effect skipped");
      paint();
    }
    function changeId() {
      userId++;
      if (v === "empty") log.push("userId → " + userId + " → deps [] unchanged, effect skipped (showing user " + shownFor + ")");
      else rerun("userId → " + userId);
      paint();
    }
    var codeEl = h("pre", { style: "margin:0 0 12px;font-family:var(--font-mono);font-size:0.78rem;color:var(--text);white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;" });
    var logEl = h("ol", { style: "margin:0;padding-left:20px;font-family:var(--font-mono);font-size:0.76rem;color:var(--text);display:flex;flex-direction:column;gap:3px;" });
    var verdictEl = h("div", { style: "margin-top:12px;" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      codeEl.textContent = EFFECT_CODE[sc](DEPS[v]);
      WK.clear(logEl);
      log.slice(-7).forEach(function (line) { logEl.appendChild(h("li", {}, line)); });
      var vd = verdict(sc, v);
      var hex = vd[0] === "Correct" ? WK.GOOD : (vd[0] === "Infinite loop" || vd[0] === "Stale data") ? WK.BAD : WK.MID;
      WK.clear(verdictEl);
      verdictEl.appendChild(h("div", { style: WK.tint(hex, 16) + "border-radius:10px;padding:10px 12px;font-size:0.86rem;" }, h("strong", {}, vd[0] + ". "), vd[1]));
      WK.readout(readout, [["effect runs", runs], ["cleanups", cleanups], ["verdict", vd[0]]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([["fetch", "fetch by userId"], ["resize", "subscribe to resize"], ["derive", "derive fullName"]], 0, function (x) { sc = x; start(); paint(); }, "Scenario"),
      WK.field("deps", WK.select([["none", "no array"], ["empty", "[]"], ["id", "[userId]"], ["obj", "[options object]"]], v, function (x) { v = x; start(); paint(); }, "Dependency array"))));
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.btn("Re-render parent", rerender, "primary"),
      WK.btn("Change userId", changeId),
      WK.btn("Remount", function () { start(); paint(); }, "ghost")));
    mount.appendChild(h("div", { class: "w-stage" }, codeEl, logEl, verdictEl));
    mount.appendChild(readout);
    start();
    paint();
  };

  /* ---------- reactTransition: urgent vs transition rendering ---------- */
  Widgets.reactTransition = function (mount) {
    var h = WK.h;
    WK.shell(mount, "scheduler", "Urgent input vs. a heavy list render",
      "Five keystrokes arrive 80 ms apart and each one re-filters a big list. Compare a plain state update with a transition, on fast and slow devices.");
    var mode = "plain", cost = 120;
    var GAP = 80, KEYS = 5, ECHO = 4;
    function simulate() {
      var rows = [], end = 0, worst = 0, committed = 0, abandoned = 0, finalAt = 0;
      for (var i = 0; i < KEYS; i++) {
        var arrive = i * GAP;
        if (mode === "plain") {
          var start = Math.max(arrive, end);
          end = start + cost;
          var lag = end - arrive;
          worst = Math.max(worst, lag);
          committed++;
          finalAt = end;
          rows.push({ key: i + 1, arrive: arrive, inputAt: end, list: [start, end], fate: "committed" });
        } else {
          var echoAt = arrive + ECHO;
          worst = Math.max(worst, ECHO);
          var rs = echoAt, re = rs + cost;
          var next = i + 1 < KEYS ? (i + 1) * GAP : Infinity;
          var interrupted = re > next;
          if (interrupted) abandoned++; else { committed++; finalAt = re; }
          rows.push({ key: i + 1, arrive: arrive, inputAt: echoAt, list: [rs, interrupted ? next : re], fate: interrupted ? "abandoned" : "committed" });
        }
      }
      return { rows: rows, worst: worst, committed: committed, abandoned: abandoned, finalAt: finalAt };
    }
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var s = simulate();
      var max = Math.max(s.finalAt, KEYS * GAP) + 40;
      WK.clear(stage);
      s.rows.forEach(function (r) {
        var track = h("div", { style: "height:14px;border-radius:7px;background:var(--line);position:relative;overflow:hidden;" });
        var col = r.fate === "abandoned" ? "#94a3b8" : "#61dafb";
        track.appendChild(h("div", { style: "position:absolute;top:0;bottom:0;left:" + (r.list[0] / max * 100) + "%;width:" + (Math.max(1, r.list[1] - r.list[0]) / max * 100) + "%;" + WK.tint(col, 45) + "border-radius:7px;" }));
        track.appendChild(h("div", { style: "position:absolute;top:0;bottom:0;width:3px;left:" + (r.inputAt / max * 100) + "%;background:" + (r.inputAt - r.arrive > 50 ? WK.BAD : WK.GOOD) + ";" }));
        stage.appendChild(h("div", { style: "display:grid;grid-template-columns:80px 1fr 120px;gap:10px;align-items:center;margin-bottom:6px;" },
          h("span", { style: "font-family:var(--font-mono);font-size:0.8rem;color:var(--text);" }, "key " + r.key),
          track,
          h("span", { style: "font-family:var(--font-mono);font-size:0.76rem;color:var(--text-dim);text-align:right;" }, "input +" + (r.inputAt - r.arrive) + " ms · " + r.fate)));
      });
      stage.appendChild(h("p", { style: "margin:8px 0 0;font-size:0.84rem;color:var(--text);" },
        mode === "plain" ? "Each keystroke waits for the previous list render to finish, so characters appear late and lag grows with every key." :
        "The input echoes immediately. List renders that would finish after the next keystroke are abandoned, so only useful work commits."));
      WK.readout(readout, [["worst input lag", s.worst + " ms"], ["list renders committed", s.committed], ["abandoned", s.abandoned], ["final list at", s.finalAt + " ms"]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([["plain", "plain setState"], ["transition", "startTransition / useDeferredValue"]], 0, function (v) { mode = v; paint(); }, "Update type"),
      WK.segment([[60, "fast device (60 ms)"], [120, "mid device (120 ms)"], [250, "slow device (250 ms)"]], 1, function (v) { cost = v; paint(); }, "Render cost")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "react-basics": {
      title: "Components & state checkpoint",
      sub: "Pure components, props, state snapshots and updates.",
      questions: [
        { q: "Inside a click handler you call setCount(count + 1) three times. count was 0. What is it after the next render?", options: ["3", "1", "0", "It throws"], answer: 1,
          explain: "Each call reads the same snapshot of count from this render, so all three schedule 0 + 1. Use the updater form setCount(c => c + 1) to queue increments." },
        { q: "Why must a component be pure during render?", options: ["React may call it more than once or skip calls, so side effects there run unpredictably", "Pure functions run on the GPU", "Hooks only work in pure functions written as arrow functions", "It is only a style convention"], answer: 0,
          explain: "React can render a component twice in development, pause renders, or throw away results in concurrent mode. Side effects belong in event handlers or effects." },
        { q: "What is the correct way to add an item to an array held in state?", options: ["items.push(item); setItems(items)", "setItems(items.concat()); items.push(item)", "setItems([...items, item])", "items[items.length] = item"], answer: 2,
          explain: "State must be treated as immutable. Creating a new array changes the reference, which is how React knows something changed." },
        { q: "useState(buildExpensiveIndex()) re-runs buildExpensiveIndex on every render. What fixes it?", options: ["useState(() => buildExpensiveIndex())", "useEffect(buildExpensiveIndex, [])", "useRef(buildExpensiveIndex)", "Move it into JSX"], answer: 0,
          explain: "Passing a function makes it a lazy initializer: React calls it only on the first render and ignores it afterwards." },
        { q: "{count && <Badge />} renders a stray 0 when count is 0. What is the clean fix?", options: ["Wrap it in a fragment", "{count > 0 ? <Badge /> : null}", "Use count || null", "Use CSS display none"], answer: 1,
          explain: "&& returns the left operand when it is falsy, and React renders the number 0. An explicit boolean condition with a ternary avoids it." }
      ]
    },
    "react-hooks": {
      title: "Hooks checkpoint",
      sub: "Rules of hooks, effects that synchronize, and refs.",
      questions: [
        { q: "Why can't hooks be called inside a condition?", options: ["Conditions are slower", "React identifies each hook by its call order, which must be identical every render", "Hooks only work at module level", "The linter is overly strict"], answer: 1,
          explain: "React stores hook state in a list indexed by call order. Skipping a call shifts every later hook onto the wrong state slot." },
        { q: "A component copies props.first and props.last into a fullName state via useEffect. What is the better approach?", options: ["Add both props to the dependency array", "Use useLayoutEffect", "Compute const fullName = first + ' ' + last during render", "Store it in a ref"], answer: 2,
          explain: "Anything computable from props or state should be derived during render. The effect version renders once with stale data and then again." },
        { q: "An effect fetches data for userId. Responses can arrive out of order. What prevents showing the wrong user?", options: ["An empty dependency array", "A cleanup that sets an ignore flag or aborts the request", "useMemo around fetch", "Calling the effect twice"], answer: 1,
          explain: "When userId changes, React runs the previous effect's cleanup. Flagging or aborting there discards the stale response." },
        { q: "You need to store a timer id that should not trigger a re-render when it changes. Which tool fits?", options: ["useState", "useContext", "useMemo", "useRef"], answer: 3,
          explain: "A ref is a mutable box that persists across renders without causing them. It is the right place for timer ids and other transient values." },
        { q: "In development with StrictMode, your effect's subscribe and unsubscribe both run an extra time on mount. What does that tell you?", options: ["React is stress-testing that your cleanup correctly undoes the setup", "Your component is broken", "Production will double-subscribe", "You must remove StrictMode"], answer: 0,
          explain: "StrictMode mounts, unmounts and remounts in development to surface missing cleanups. If the extra cycle causes a bug, the effect is not resilient." }
      ]
    },
    "react-tree": {
      title: "Rendering, context & keys checkpoint",
      sub: "What triggers a render, how context propagates, and identity.",
      questions: [
        { q: "A parent re-renders. Its child is not wrapped in memo and its props did not change. Does the child render?", options: ["No, props are the same", "Only in development", "Yes, by default children render when their parent renders", "Only if it uses context"], answer: 2,
          explain: "React's default is to re-render the whole subtree. memo opts a component out when its props are shallowly equal." },
        { q: "A provider passes value={{ user, logout }}. Every consumer re-renders whenever the provider's parent renders. Why?", options: ["Context always re-renders everything", "A new object literal is created each render, so the value's identity changes", "logout is async", "Consumers forgot memo"], answer: 1,
          explain: "Context compares the value by reference. Memoize it with useMemo (and stable callbacks) so it only changes when user changes." },
        { q: "What does changing a component's key do?", options: ["Forces React to discard the old instance and mount a fresh one with fresh state", "Only re-renders it", "Nothing unless it is in a list", "Moves it to the end of the list"], answer: 0,
          explain: "Keys define identity. A new key means a new component instance, which is a clean way to reset a form when the selected record changes." },
        { q: "Why are array indexes risky as keys for a list that can be reordered?", options: ["Indexes are not strings", "State such as input values stays attached to the position, not the item", "React forbids them", "They slow down the initial render"], answer: 1,
          explain: "On reorder or insert, the index of each item changes but React matches by key, so local state ends up on the wrong item. Use stable ids from the data." },
        { q: "What does startTransition mark an update as?", options: ["Synchronous and urgent", "A server action", "Interruptible and lower priority than typing or clicking", "A layout effect"], answer: 2,
          explain: "Transition updates can be interrupted by urgent ones, so expensive re-renders, like filtering a big list, don't block input." }
      ]
    },
    "react-concurrent": {
      title: "Suspense, transitions & hook pitfalls checkpoint",
      sub: "Concurrent rendering and the bugs hooks make easy.",
      questions: [
        { q: "Typing in a search box lags because each keystroke re-filters 10,000 rows. Which fix keeps the input responsive without debouncing?", options: ["Wrap the input in memo", "Keep the input state urgent and update the filter inside startTransition (or render from useDeferredValue)", "Move the list into useEffect", "Use a layout effect"], answer: 1,
          explain: "The input updates immediately; the heavy re-render is marked non-urgent and can be interrupted by the next keystroke." },
        { q: "A component inside <Suspense> suspends. What does the user see?", options: ["A blank page", "The nearest Suspense boundary's fallback until the data or code is ready", "An error boundary", "The previous route forever"], answer: 1,
          explain: "Suspense shows the closest fallback for that subtree. Boundaries decide how much of the page is replaced while waiting." },
        { q: "Navigating with startTransition to a route that suspends does what to already-visible content?", options: ["Replaces it with the fallback immediately", "Keeps showing the old UI (with isPending available) instead of flashing a fallback", "Throws", "Reloads the page"], answer: 1,
          explain: "Transitions avoid hiding content that is already on screen; you can show a subtle pending indicator instead." },
        { q: "An interval callback always logs count as 0 even after clicks. What is the bug?", options: ["React batches logs", "A stale closure: the effect captured the first render's count and has an empty dependency list", "setInterval is not allowed", "count must be a ref"], answer: 1,
          explain: "Callbacks see the values from the render that created them. Use a functional update, include the dependency, or read the latest value from a ref." },
        { q: "An effect calls setItems([...items, x]) and lists [items] as a dependency. What happens?", options: ["It runs once", "An infinite render loop, because each run creates a new items array that re-triggers the effect", "React ignores it", "Nothing until unmount"], answer: 1,
          explain: "Setting state that is also a dependency re-runs the effect forever. Usually this logic belongs in an event handler, or should use a functional update without the dependency." },
        { q: "What should a custom hook's name and contract be?", options: ["Any name; return JSX", "Start with use, call other hooks at its top level, and return values or functions, not elements", "Start with get and avoid hooks", "Only wrap useEffect"], answer: 1,
          explain: "The use prefix lets lint rules check the rules of hooks. Custom hooks share logic, not state: each caller gets its own state." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.react = {
    id: "react",
    name: "React Core",
    short: "REACT",
    tagline: "Think in renders, not in mutations",
    color: ACC,
    blurb: "The mental model that makes React predictable: components as pure functions of props and state, state as snapshots, the rules of hooks, effects that synchronize rather than react, refs, the render and commit phases, context, and reconciliation with keys.",
    modules: [
      {
        id: "basics",
        name: "Components & JSX",
        icon: "cube",
        lessons: [
          {
            id: "components-jsx",
            title: "Components, JSX and purity",
            summary: "A component is a function from props and state to a description of UI. Keep it pure.",
            minutes: 9,
            tags: ["components", "jsx", "purity"],
            blocks: [
              { t: "p", html: "Hold this picture: <strong>UI = f(props, state)</strong>. A component is a function that returns a description of what should be on screen. React compares descriptions and updates the real DOM for you." },
              { t: "code", lang: "javascript", code:
                "function PriceTag({ amount, currency }) {\n" +
                "  const formatted = new Intl.NumberFormat(\"en\", { style: \"currency\", currency }).format(amount);\n" +
                "  return <span className=\"price\">{formatted}</span>;\n" +
                "}\n\n" +
                "// JSX compiles to plain function calls that build element objects:\n" +
                "// jsx(\"span\", { className: \"price\", children: formatted })" },
              { t: "table", headers: ["JSX rule", "Why"], rows: [
                ["Return one root (or a fragment <code class='tok'>&lt;&gt;…&lt;/&gt;</code>)", "A function returns one value"],
                ["<code class='tok'>className</code>, <code class='tok'>htmlFor</code>, camelCase events", "JSX props map to DOM properties"],
                ["<code class='tok'>{expression}</code> embeds values", "Text is escaped by default, which blocks most injection"],
                ["Components start with a capital letter", "Lowercase names are treated as DOM tags"]
              ] },
              { t: "h", text: "Purity" },
              { t: "compare",
                bad: { title: "Impure render", items: ["Mutates a module-level variable", "Fetches or logs during render", "Reads Math.random or Date.now for output", "Results differ between identical renders"] },
                good: { title: "Pure render", items: ["Same inputs, same JSX", "Side effects in event handlers", "Synchronization in effects", "Safe to render twice, pause or discard"] } },
              { t: "note", variant: "trap", html: "Never define a component inside another component. Each render creates a new function type, so React unmounts and remounts it, losing state and focus every time." },
              { t: "note", variant: "tip", html: "Composition beats configuration: pass <code class='tok'>children</code> and small components rather than growing a single component's props list." },
              { t: "note", variant: "key", html: "<strong>Components are pure functions of props and state that return a UI description.</strong> Side effects live in handlers and effects, never in the render body." }
            ]
          },
          {
            id: "props-state",
            title: "Props, state and the snapshot model",
            summary: "State is a snapshot per render; updates are queued, batched and applied on the next render.",
            minutes: 10,
            tags: ["props", "state", "batching", "immutability"],
            blocks: [
              { t: "p", html: "Props flow down and are read-only. State is memory a component owns. The crucial detail: <strong>each render sees a fixed snapshot of state</strong>. Calling a setter does not change the variable you already have; it asks React for a new render." },
              { t: "code", lang: "javascript", code:
                "function Counter() {\n" +
                "  const [count, setCount] = useState(0);\n\n" +
                "  function addThree() {\n" +
                "    setCount(count + 1);      // 0 + 1\n" +
                "    setCount(count + 1);      // still 0 + 1\n" +
                "    setCount((c) => c + 1);   // updater: uses the queued value\n" +
                "  }                           // result after render: 2\n\n" +
                "  return <button onClick={addThree}>{count}</button>;\n" +
                "}" },
              { t: "table", headers: ["Technique", "Use it for"], rows: [
                ["Updater function <code class='tok'>setX(prev =&gt; …)</code>", "New state that depends on old state; stable callbacks"],
                ["Lazy initializer <code class='tok'>useState(() =&gt; init())</code>", "Expensive initial values computed once"],
                ["Immutable updates (spread, <code class='tok'>map</code>, <code class='tok'>toSorted</code>)", "Objects and arrays so references change"],
                ["Automatic batching", "Several setters in one event cause one render"]
              ] },
              { t: "note", variant: "warn", html: "Mutating state (<code class='tok'>user.name = x; setUser(user)</code>) keeps the same reference, so React may skip the render and memoized children never see the change." },
              { t: "note", variant: "tip", html: "Keep state minimal. If a value can be computed from props or other state, compute it during render instead of storing it." },
              { t: "quiz", id: "react-basics" },
              { t: "note", variant: "key", html: "<strong>State is a per-render snapshot; setters schedule the next render.</strong> Use updater functions for sequential updates, lazy initializers for expensive defaults, and never mutate." }
            ]
          }
        ]
      },
      {
        id: "hooks",
        name: "Hooks Done Right",
        icon: "wrench",
        lessons: [
          {
            id: "hooks-rules",
            title: "The rules of hooks, and why they exist",
            summary: "Hooks are identified by call order. Call them unconditionally, at the top level, from components or other hooks.",
            minutes: 8,
            tags: ["hooks", "rules", "custom-hooks"],
            blocks: [
              { t: "p", html: "React keeps a list of hook slots per component instance. On each render it walks your hook calls <strong>in order</strong> and hands back the matching slot. That is the whole reason for the rules." },
              { t: "ol", items: [
                "Call hooks only at the top level — not in conditions, loops or after an early return.",
                "Call hooks only from function components or custom hooks.",
                "Name custom hooks <code class='tok'>useSomething</code> so tools can check them."
              ] },
              { t: "code", lang: "javascript", code:
                "// custom hooks share LOGIC, not state: each caller gets its own copy\n" +
                "function useMediaQuery(query) {\n" +
                "  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);\n" +
                "  useEffect(() => {\n" +
                "    const mql = window.matchMedia(query);\n" +
                "    const onChange = () => setMatches(mql.matches);\n" +
                "    mql.addEventListener(\"change\", onChange);\n" +
                "    return () => mql.removeEventListener(\"change\", onChange);\n" +
                "  }, [query]);\n" +
                "  return matches;\n" +
                "}" },
              { t: "table", headers: ["Hook", "Purpose"], rows: [
                ["useState / useReducer", "Component memory"],
                ["useEffect / useLayoutEffect", "Synchronize with systems outside React"],
                ["useRef", "Mutable value or DOM handle without re-rendering"],
                ["useMemo / useCallback", "Cache a value or function between renders"],
                ["useContext / use", "Read context (use can also read promises in React 19)"],
                ["useTransition / useDeferredValue", "Mark work as non-urgent"]
              ] },
              { t: "note", variant: "tip", html: "Turn on the hooks lint rules. They catch conditional calls and dishonest dependency arrays automatically." },
              { t: "note", variant: "key", html: "<strong>Hooks are matched by call order.</strong> Call them unconditionally at the top level; custom hooks reuse logic, and every caller gets independent state." }
            ]
          },
          {
            id: "use-effect-correctly",
            title: "useEffect correctly: synchronize, don't react",
            summary: "Effects keep a component in sync with an external system. Most derived values and event logic do not need one.",
            minutes: 12,
            tags: ["useEffect", "dependencies", "cleanup", "fetching"],
            blocks: [
              { t: "p", html: "An effect says: <strong>after rendering, make this external thing match the current props and state</strong> — a subscription, a timer, a non-React widget, a network connection. If no external system is involved, you probably do not need one." },
              { t: "table", headers: ["Situation", "Instead of an effect"], rows: [
                ["Value computed from props/state", "Compute it during render (useMemo if expensive)"],
                ["Something should happen because the user clicked", "Do it in the event handler"],
                ["Reset state when a prop changes", "Give the component a <code class='tok'>key</code>"],
                ["Notify a parent of a change", "Call the parent's callback in the same handler"],
                ["Fetch data for a page", "A data library or the framework's loader; effects as a last resort"]
              ] },
              { t: "widget", id: "reactEffectDeps" },
              { t: "code", lang: "javascript", code:
                "useEffect(() => {\n" +
                "  const controller = new AbortController();\n" +
                "  fetch(`/api/users/${userId}`, { signal: controller.signal })\n" +
                "    .then((r) => r.json())\n" +
                "    .then(setUser)\n" +
                "    .catch((e) => { if (e.name !== \"AbortError\") setError(e); });\n" +
                "  return () => controller.abort();   // cleanup cancels the stale request\n" +
                "}, [userId]);                          // exactly what the effect reads" },
              { t: "ul", items: [
                "<strong>Dependencies are not a choice.</strong> List every reactive value the effect reads; change the code, not the array, when it runs too often.",
                "Prefer primitive dependencies (<code class='tok'>user.id</code>) over objects rebuilt each render.",
                "For logic that should read the latest value without re-running the effect, React provides an effect-event pattern (<code class='tok'>useEffectEvent</code>); keep those functions out of the dependency list.",
                "StrictMode runs setup, cleanup, setup in development to prove cleanup works."
              ] },
              { t: "note", variant: "trap", html: "Silencing the dependency lint rule hides stale closures: the effect keeps using values from the render it was created in." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"useEffect that sets state from props\", \"runs in a loop\", \"shows the previous user\" — check whether an effect is needed at all, then whether its dependencies and cleanup are honest." },
              { t: "note", variant: "key", html: "<strong>Effects synchronize with external systems.</strong> Derive values during render, handle user intent in event handlers, keep dependencies honest, and always clean up." }
            ]
          },
          {
            id: "refs-imperative",
            title: "Refs and imperative escape hatches",
            summary: "Mutable values that survive renders without causing them, and DOM access when you truly need it.",
            minutes: 8,
            tags: ["useRef", "dom", "focus", "react-19"],
            blocks: [
              { t: "p", html: "A ref is a box: <code class='tok'>{ current }</code>. React gives you the same box every render, and changing it <strong>does not trigger a render</strong>. That makes refs right for values the UI does not display." },
              { t: "table", headers: ["Use a ref for", "Use state for"], rows: [
                ["Timer and interval ids", "Anything rendered on screen"],
                ["A DOM node to focus, measure or scroll", "Values children need as props"],
                ["The latest value read inside a long-lived callback", "Values that should re-run effects"],
                ["Instances of non-React libraries", "Form values you display"]
              ] },
              { t: "code", lang: "javascript", code:
                "// React 19: ref is a regular prop on function components (no forwardRef needed)\n" +
                "function TextField({ label, ref, ...props }) {\n" +
                "  return (\n" +
                "    <label>{label}<input ref={ref} {...props} /></label>\n" +
                "  );\n" +
                "}\n\n" +
                "function SearchBar() {\n" +
                "  const inputRef = useRef(null);\n" +
                "  return (\n" +
                "    <>\n" +
                "      <TextField label=\"Search\" ref={inputRef} />\n" +
                "      <button type=\"button\" onClick={() => inputRef.current?.focus()}>Focus search</button>\n" +
                "    </>\n" +
                "  );\n" +
                "}" },
              { t: "note", variant: "warn", html: "Do not read or write <code class='tok'>ref.current</code> during render (except lazy initialization). The render must stay pure, and refs change outside React's knowledge." },
              { t: "note", variant: "tip", html: "<code class='tok'>useImperativeHandle</code> lets a component expose a narrow API such as <code class='tok'>focus()</code> instead of its whole DOM node. Reach for it rarely; declarative props are usually clearer." },
              { t: "quiz", id: "react-hooks" },
              { t: "note", variant: "key", html: "<strong>Refs hold mutable values that should not re-render.</strong> Use them for DOM handles, timers and latest-value boxes; keep everything visible in state." }
            ]
          }
        ]
      },
      {
        id: "tree",
        name: "The Tree & Reconciliation",
        icon: "share",
        lessons: [
          {
            id: "render-commit",
            title: "Render and commit: what a re-render really is",
            summary: "Trigger, render, commit. A re-render recalculates JSX; only the differences reach the DOM.",
            minutes: 11,
            tags: ["rendering", "memo", "transitions", "concurrent"],
            blocks: [
              { t: "p", html: "A re-render is React <strong>calling your component again</strong> to get fresh JSX. It is not a DOM update. React diffs the new tree against the old one and commits only the changes." },
              { t: "diagram", id: "react-render-commit", caption: "A state update triggers a render of that component and its subtree; the commit applies only the diff to the DOM." },
              { t: "table", headers: ["Triggers a render", "Does not trigger one"], rows: [
                ["Its own state changes", "Mutating a ref"],
                ["Its parent renders (unless memo with equal props)", "Mutating an object in state"],
                ["A context it reads changes value", "Changing a variable outside React"]
              ] },
              { t: "widget", id: "reactRerender" },
              { t: "h", text: "Keeping renders cheap" },
              { t: "ul", items: [
                "<strong>Colocate state</strong> as low as possible so fewer components sit under it.",
                "<strong>Pass children</strong>: elements created by a parent that did not re-render are reused as-is.",
                "<strong>memo</strong> a component only when it is expensive and its props are stable.",
                "<strong>startTransition / useDeferredValue</strong> let urgent input win over a heavy re-render."
              ] },
              { t: "note", variant: "tip", html: "Re-renders are usually cheap. Optimize after profiling shows a slow commit or a component rendering far more often than expected." },
              { t: "note", variant: "key", html: "<strong>Render computes, commit applies the diff.</strong> A parent render cascades to its subtree; colocate state, pass children and memoize only where profiling says it matters." }
            ]
          },
          {
            id: "context",
            title: "Context without accidental re-renders",
            summary: "Context removes prop drilling; its value identity decides who re-renders.",
            minutes: 9,
            tags: ["context", "provider", "performance"],
            blocks: [
              { t: "p", html: "Context is a <strong>broadcast channel</strong> down the tree. Any component that reads it re-renders when the provider's value changes by reference — even if it is wrapped in memo." },
              { t: "code", lang: "javascript", code:
                "const ThemeState = createContext(\"light\");\n" +
                "const ThemeActions = createContext(() => {});\n\n" +
                "function ThemeProvider({ children }) {\n" +
                "  const [theme, setTheme] = useState(\"light\");\n" +
                "  const toggle = useCallback(() => setTheme((t) => (t === \"light\" ? \"dark\" : \"light\")), []);\n" +
                "  return (\n" +
                "    <ThemeActions.Provider value={toggle}>\n" +
                "      <ThemeState.Provider value={theme}>{children}</ThemeState.Provider>\n" +
                "    </ThemeActions.Provider>\n" +
                "  );\n" +
                "}" },
              { t: "table", headers: ["Tier", "Approach", "Effect"], rows: [
                ["Naive", "<code class='tok'>value={{ theme, toggle }}</code> literal", "Every consumer renders on every provider render"],
                ["Solid", "<code class='tok'>useMemo</code> the value, <code class='tok'>useCallback</code> the actions", "Consumers render only when theme changes"],
                ["Standout", "Split state and actions contexts; keep fast-changing data in a selector-based store", "Action-only consumers never re-render"]
              ] },
              { t: "note", variant: "warn", html: "Context is a transport, not a state manager. High-frequency data (cursor position, form keystrokes) in a broad context re-renders large parts of the app." },
              { t: "note", variant: "tip", html: "Wrap the provider's <code class='tok'>children</code> rather than rendering consumers inline. Children elements are created by the parent, so they do not re-render just because the provider's state changed." },
              { t: "note", variant: "key", html: "<strong>Consumers re-render when the context value's identity changes.</strong> Memoize the value, split state from actions, and keep fast-changing data out of broad contexts." }
            ]
          },
          {
            id: "reconciliation-keys",
            title: "Reconciliation and keys",
            summary: "React matches elements by type and key. Keys are identity, and identity owns state.",
            minutes: 9,
            tags: ["reconciliation", "keys", "identity"],
            blocks: [
              { t: "p", html: "When React compares two trees it assumes: <strong>different type means different subtree</strong>, and within a list, <strong>the key says which item is which</strong>. State belongs to that identity." },
              { t: "widget", id: "reactKeys" },
              { t: "table", headers: ["Key choice", "Result"], rows: [
                ["Stable id from data", "State and DOM follow the item through inserts and reorders"],
                ["Array index", "Fine for static lists; wrong state on insert, remove or sort"],
                ["<code class='tok'>Math.random()</code>", "New identity every render: everything remounts, focus is lost"]
              ] },
              { t: "code", lang: "javascript", code:
                "// reset all form state when switching records: new key, new instance\n" +
                "<ProfileForm key={user.id} user={user} />\n\n" +
                "// type change at the same position also remounts:\n" +
                "{isEditing ? <EditForm /> : <ReadOnlyView />}" },
              { t: "note", variant: "trap", html: "Conditionally wrapping a component in a different parent element (<code class='tok'>div</code> vs <code class='tok'>section</code>) changes the tree shape and silently resets its state." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"input values jump to the wrong row\", \"form keeps old values after selecting another user\", \"list item loses focus while typing\" — think keys and identity." },
              { t: "quiz", id: "react-tree" },
              { t: "note", variant: "key", html: "<strong>Type and key decide identity; identity owns state.</strong> Use stable data ids as keys, and change a key on purpose when you want a clean remount." }
            ]
          }
        ]
      },
      {
        id: "concurrent",
        name: "Concurrent React & Pitfalls",
        icon: "queue",
        lessons: [
          {
            id: "suspense-transitions",
            title: "Suspense, transitions and deferred values",
            summary: "Let urgent updates win, show fallbacks only where they help, and keep visible content on screen during navigation.",
            minutes: 12,
            tags: ["suspense", "useTransition", "useDeferredValue", "use"],
            blocks: [
              { t: "p", html: "Concurrent rendering lets React <strong>prepare a new UI in the background</strong> and abandon it if something more urgent arrives. Two tools expose it: <strong>Suspense</strong> (what to show while something is not ready) and <strong>transitions</strong> (which updates may wait)." },
              { t: "widget", id: "reactTransition" },
              { t: "table", headers: ["Tool", "What it does", "Reach for it when"], rows: [
                ["<code class='tok'>&lt;Suspense fallback&gt;</code>", "Shows a fallback while children wait for code (lazy) or data (a suspending source)", "Part of the page can load independently"],
                ["<code class='tok'>useTransition</code>", "Marks a state update as interruptible and gives you isPending", "You own the setter: tabs, filters, navigation"],
                ["<code class='tok'>useDeferredValue</code>", "Renders with the previous value first, then the new one in the background", "You only receive the value as a prop"],
                ["<code class='tok'>use(promise)</code>", "Reads a promise inside render and suspends until it resolves", "A server component passes a promise down"]
              ] },
              { t: "code", lang: "javascript", code:
                "function Search() {\n" +
                "  const [query, setQuery] = useState(\"\");\n" +
                "  const deferred = useDeferredValue(query);   // list lags, input never does\n" +
                "  const stale = query !== deferred;\n" +
                "  return (\n" +
                "    <>\n" +
                "      <input value={query} onChange={(e) => setQuery(e.target.value)} />\n" +
                "      <div style={{ opacity: stale ? 0.6 : 1 }}>\n" +
                "        <Suspense fallback={<ResultsSkeleton />}>\n" +
                "          <Results query={deferred} />         {/* memo(Results) so it can bail out */}\n" +
                "        </Suspense>\n" +
                "      </div>\n" +
                "    </>\n" +
                "  );\n" +
                "}\n\n" +
                "function Tabs() {\n" +
                "  const [tab, setTab] = useState(\"posts\");\n" +
                "  const [isPending, startTransition] = useTransition();\n" +
                "  const select = (t) => startTransition(() => setTab(t)); // old tab stays visible\n" +
                "  return <TabBar onSelect={select} pending={isPending} active={tab} />;\n" +
                "}" },
              { t: "ul", items: [
                "Put Suspense boundaries around regions that can load independently, not around every component.",
                "Navigations wrapped in a transition keep showing the old screen instead of flashing a fallback.",
                "Controlled input values must never be set inside a transition; keep the input urgent.",
                "Transitions do not make work cheaper; they make it interruptible. Still memoize the heavy child."
              ] },
              { t: "note", variant: "trap", html: "Creating a promise during a client component's render and passing it to <code class='tok'>use</code> creates a new promise every render, which suspends forever. Create promises in a server component, a loader or a cache." },
              { t: "note", variant: "key", html: "<strong>Suspense decides what to show while waiting; transitions decide what may wait.</strong> Keep input urgent, defer heavy renders, and place boundaries where independent loading helps." }
            ]
          },
          {
            id: "hooks-pitfalls",
            title: "Hook pitfalls and custom hooks",
            summary: "Stale closures, effect loops, unstable dependencies and how to package logic in a custom hook.",
            minutes: 11,
            tags: ["stale-closure", "effects", "custom-hooks", "pitfalls"],
            blocks: [
              { t: "p", html: "Most hook bugs come from one fact: <strong>every render is a snapshot</strong>. Functions created during a render see that render's props and state forever." },
              { t: "table", headers: ["Symptom", "Cause", "Fix"], rows: [
                ["Interval logs a frozen value", "Stale closure over the first render", "Functional update <code class='tok'>setCount(c =&gt; c + 1)</code>, or a ref holding the latest value"],
                ["Effect runs on every render", "Object or function dependency recreated each render", "Depend on primitives, move the object inside the effect, or memoize it"],
                ["Infinite render loop", "Effect sets state that is in its own dependency list", "Move the logic to the event handler, or use a functional update"],
                ["Race: old response overwrites new", "No cleanup for async work", "Ignore flag or AbortController in the effect cleanup"],
                ["Value one render behind", "Reading state right after setting it", "Compute the next value once and use it"],
                ["Too many re-renders error", "Calling a setter during render", "Call it in a handler, or derive the value instead"]
              ] },
              { t: "code", lang: "javascript", code:
                "// stale closure fixed with a functional update\n" +
                "useEffect(() => {\n" +
                "  const id = setTimeout(() => {\n" +
                "    setSeconds((s) => s + 1);          // reads the latest value, never a stale one\n" +
                "  }, 1000);\n" +
                "  return () => clearTimeout(id);       // re-armed after every tick\n" +
                "}, [seconds]);\n\n" +
                "// a custom hook: shares logic, each caller gets its own state\n" +
                "function useOnlineStatus() {\n" +
                "  return useSyncExternalStore(\n" +
                "    (cb) => {\n" +
                "      window.addEventListener(\"online\", cb);\n" +
                "      window.addEventListener(\"offline\", cb);\n" +
                "      return () => { window.removeEventListener(\"online\", cb); window.removeEventListener(\"offline\", cb); };\n" +
                "    },\n" +
                "    () => navigator.onLine,\n" +
                "    () => true                        // server snapshot\n" +
                "  );\n" +
                "}" },
              { t: "ul", items: [
                "Name custom hooks <code class='tok'>useSomething</code> so lint rules can enforce the rules of hooks inside them.",
                "Return values and callbacks, not JSX. If it returns markup, it is a component.",
                "Store event handlers that must not re-trigger effects in a ref updated on every render.",
                "Subscribe to global events once in a shared hook rather than once per component instance.",
                "Lazy-initialize expensive state: <code class='tok'>useState(() =&gt; parse(raw))</code> runs the parser once."
              ] },
              { t: "note", variant: "warn", html: "Silencing the exhaustive-deps lint rule hides the stale closure instead of fixing it. Restructure the effect until the rule is satisfied." },
              { t: "quiz", id: "react-concurrent" },
              { t: "note", variant: "key", html: "<strong>Each render is a snapshot.</strong> Use functional updates, primitive dependencies and cleanups, keep logic in handlers when it responds to events, and package reusable logic as use-prefixed hooks." }
            ]
          }
        ]
      }
    ]
  };
})();
