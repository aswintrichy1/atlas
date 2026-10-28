/* =====================================================================
   PIXEL · Web Platform Foundations
   window.TRACKS.web — modules: html-css / browser / js-ts
   Self-contained: registers its widgets, quizzes and track data.
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};

  /* ---------- webFlexGrid: live flexbox / grid playground ---------- */
  Widgets.webFlexGrid = function (mount) {
    var h = WK.h;
    WK.shell(mount, "playground", "Flex & grid playground",
      "Switch layout models and change one property at a time. The boxes below are styled with exactly the CSS shown in the readout.");
    var st = { mode: "flex", dir: "row", justify: "flex-start", align: "stretch", wrap: "nowrap", cols: "repeat(3, 1fr)", gap: "8px", count: 5 };
    var controls = h("div", { class: "widget-controls" });
    var stage = h("div", { class: "w-stage" });
    var box = h("div", {});
    stage.appendChild(box);
    var readout = h("div", { class: "w-readout" });
    var code = h("pre", { style: "margin:12px 0 0;font-family:var(--font-mono);font-size:0.78rem;color:var(--text);white-space:pre-wrap;" });

    function declarations() {
      if (st.mode === "flex") {
        return ["display: flex;", "flex-direction: " + st.dir + ";", "justify-content: " + st.justify + ";", "align-items: " + st.align + ";", "flex-wrap: " + st.wrap + ";", "gap: " + st.gap + ";"];
      }
      return ["display: grid;", "grid-template-columns: " + st.cols + ";", "gap: " + st.gap + ";", "align-items: " + st.align + ";"];
    }
    function paint() {
      box.style.cssText = declarations().join("") + "min-height:150px;border:1px dashed var(--line-strong);border-radius:10px;padding:8px;";
      WK.clear(box);
      for (var i = 0; i < st.count; i++) {
        var tall = i % 3 === 1;
        box.appendChild(h("div", {
          style: WK.tint("#f5a623", 22) + "border-radius:8px;padding:" + (tall ? "22px" : "8px") + " 14px;font-family:var(--font-mono);font-weight:700;min-width:" + (st.mode === "flex" ? (60 + (i % 2) * 30) + "px" : "0") + ";text-align:center;"
        }, String(i + 1)));
      }
      code.textContent = ".container {\n  " + declarations().join("\n  ") + "\n}";
      WK.readout(readout, [["model", st.mode === "flex" ? "1-D (flexbox)" : "2-D (grid)"], ["items", st.count], ["main axis", st.mode === "flex" ? (st.dir.indexOf("row") === 0 ? "horizontal" : "vertical") : "rows + columns"]]);
    }
    function renderControls() {
      WK.clear(controls);
      controls.appendChild(WK.segment([["flex", "display: flex"], ["grid", "display: grid"]], st.mode === "flex" ? 0 : 1, function (v) { st.mode = v; renderControls(); paint(); }, "Layout model"));
      if (st.mode === "flex") {
        controls.appendChild(WK.field("direction", WK.select([["row", "row"], ["column", "column"], ["row-reverse", "row-reverse"]], st.dir, function (v) { st.dir = v; paint(); })));
        controls.appendChild(WK.field("justify", WK.select([["flex-start", "flex-start"], ["center", "center"], ["space-between", "space-between"], ["space-evenly", "space-evenly"], ["flex-end", "flex-end"]], st.justify, function (v) { st.justify = v; paint(); })));
        controls.appendChild(WK.field("align", WK.select([["stretch", "stretch"], ["flex-start", "flex-start"], ["center", "center"], ["baseline", "baseline"]], st.align, function (v) { st.align = v; paint(); })));
        controls.appendChild(WK.field("wrap", WK.select([["nowrap", "nowrap"], ["wrap", "wrap"]], st.wrap, function (v) { st.wrap = v; paint(); })));
      } else {
        controls.appendChild(WK.field("columns", WK.select([["repeat(3, 1fr)", "repeat(3, 1fr)"], ["200px 1fr", "200px 1fr"], ["repeat(auto-fit, minmax(90px, 1fr))", "auto-fit minmax(90px,1fr)"], ["1fr 2fr", "1fr 2fr"]], st.cols, function (v) { st.cols = v; paint(); })));
        controls.appendChild(WK.field("align", WK.select([["stretch", "stretch"], ["start", "start"], ["center", "center"], ["end", "end"]], st.align === "flex-start" ? "start" : st.align, function (v) { st.align = v; paint(); })));
      }
      controls.appendChild(WK.field("gap", WK.select([["0px", "0"], ["8px", "8px"], ["16px", "16px"]], st.gap, function (v) { st.gap = v; paint(); })));
      controls.appendChild(WK.btn("+ item", function () { st.count = Math.min(9, st.count + 1); paint(); }));
      controls.appendChild(WK.btn("− item", function () { st.count = Math.max(1, st.count - 1); paint(); }, "ghost"));
    }
    renderControls();
    mount.appendChild(controls);
    mount.appendChild(stage);
    stage.appendChild(code);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- webEventLoop: step-through event loop animator ---------- */
  var LOOP_SNIPPETS = {
    basic: {
      code: "console.log(\"A\");\nsetTimeout(() => console.log(\"B\"), 0);\nPromise.resolve().then(() => console.log(\"C\"));\nconsole.log(\"D\");",
      steps: [
        { stack: ["script"], micro: [], task: [], out: ["A"], note: "The whole script is one task. log(\"A\") runs synchronously." },
        { stack: ["script"], micro: [], task: ["timeout → log B"], out: ["A"], note: "setTimeout hands the callback to the timer; when it fires it joins the task queue." },
        { stack: ["script"], micro: ["then → log C"], task: ["timeout → log B"], out: ["A"], note: "The promise is already resolved, so its reaction goes to the microtask queue." },
        { stack: ["script"], micro: ["then → log C"], task: ["timeout → log B"], out: ["A", "D"], note: "log(\"D\") is still synchronous." },
        { stack: ["then → log C"], micro: [], task: ["timeout → log B"], out: ["A", "D", "C"], note: "The stack is empty, so the loop drains ALL microtasks before anything else." },
        { stack: [], micro: [], task: ["timeout → log B"], out: ["A", "D", "C"], note: "Rendering opportunity: the browser may style, lay out and paint now." },
        { stack: ["timeout → log B"], micro: [], task: [], out: ["A", "D", "C", "B"], note: "Next task: the timer callback. Final order A D C B." }
      ]
    },
    nested: {
      code: "console.log(\"1\");\nsetTimeout(() => console.log(\"2\"), 0);\nqueueMicrotask(() => console.log(\"3\"));\nPromise.resolve().then(() => {\n  console.log(\"4\");\n  setTimeout(() => console.log(\"5\"), 0);\n});\nconsole.log(\"6\");",
      steps: [
        { stack: ["script"], micro: [], task: [], out: ["1"], note: "Synchronous log." },
        { stack: ["script"], micro: [], task: ["timeout → log 2"], out: ["1"], note: "Timer callback queued as a task." },
        { stack: ["script"], micro: ["microtask → log 3"], task: ["timeout → log 2"], out: ["1"], note: "queueMicrotask goes straight to the microtask queue." },
        { stack: ["script"], micro: ["microtask → log 3", "then → log 4"], task: ["timeout → log 2"], out: ["1"], note: "A second microtask, behind the first (FIFO)." },
        { stack: ["script"], micro: ["microtask → log 3", "then → log 4"], task: ["timeout → log 2"], out: ["1", "6"], note: "Last synchronous line." },
        { stack: ["microtask → log 3"], micro: ["then → log 4"], task: ["timeout → log 2"], out: ["1", "6", "3"], note: "Draining microtasks in order." },
        { stack: ["then → log 4"], micro: [], task: ["timeout → log 2", "timeout → log 5"], out: ["1", "6", "3", "4"], note: "This microtask schedules a NEW timer. It lands behind timer 2." },
        { stack: ["timeout → log 2"], micro: [], task: ["timeout → log 5"], out: ["1", "6", "3", "4", "2"], note: "Microtasks empty, so the oldest task runs." },
        { stack: ["timeout → log 5"], micro: [], task: [], out: ["1", "6", "3", "4", "2", "5"], note: "Final order 1 6 3 4 2 5." }
      ]
    },
    await: {
      code: "async function f() {\n  console.log(\"a\");\n  await null;\n  console.log(\"b\");\n}\nconsole.log(\"start\");\nf();\nsetTimeout(() => console.log(\"t\"), 0);\nPromise.resolve().then(() => console.log(\"p\"));\nconsole.log(\"end\");",
      steps: [
        { stack: ["script"], micro: [], task: [], out: ["start"], note: "Synchronous log." },
        { stack: ["script", "f()"], micro: [], task: [], out: ["start", "a"], note: "An async function runs synchronously until its first await." },
        { stack: ["script"], micro: ["f resumes → log b"], task: [], out: ["start", "a"], note: "await suspends f; the rest of f is queued as a microtask." },
        { stack: ["script"], micro: ["f resumes → log b"], task: ["timeout → log t"], out: ["start", "a"], note: "Timer queued as a task." },
        { stack: ["script"], micro: ["f resumes → log b", "then → log p"], task: ["timeout → log t"], out: ["start", "a"], note: "Promise reaction queued behind f's continuation." },
        { stack: ["script"], micro: ["f resumes → log b", "then → log p"], task: ["timeout → log t"], out: ["start", "a", "end"], note: "Last synchronous line." },
        { stack: ["f resumes → log b"], micro: ["then → log p"], task: ["timeout → log t"], out: ["start", "a", "end", "b"], note: "Microtasks drain FIFO: f resumes first." },
        { stack: ["then → log p"], micro: [], task: ["timeout → log t"], out: ["start", "a", "end", "b", "p"], note: "Then the promise reaction." },
        { stack: ["timeout → log t"], micro: [], task: [], out: ["start", "a", "end", "b", "p", "t"], note: "Finally the timer task. Order: start a end b p t." }
      ]
    }
  };
  Widgets.webEventLoop = function (mount) {
    var h = WK.h;
    WK.shell(mount, "animator", "Event loop stepper",
      "Pick a snippet and step through it. Watch the call stack, the microtask queue and the task queue decide the output order.");
    var key = "basic", idx = -1;
    var codeEl = h("pre", { style: "margin:0 0 14px;font-family:var(--font-mono);font-size:0.8rem;color:var(--text);white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;" });
    var cols = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;" });
    var note = h("p", { style: "margin:12px 0 0;font-size:0.88rem;color:var(--text);" });
    var readout = h("div", { class: "w-readout" });
    var COLS = [["Call stack", "stack", "#f5a623"], ["Microtasks", "micro", "#a78bfa"], ["Tasks", "task", "#38bdf8"], ["Output", "out", "#22c55e"]];
    function paint() {
      var snip = LOOP_SNIPPETS[key];
      codeEl.textContent = snip.code;
      var s = idx >= 0 ? snip.steps[idx] : { stack: [], micro: [], task: [], out: [], note: "Press Step to start executing the script task." };
      WK.clear(cols);
      COLS.forEach(function (c) {
        var list = h("div", { style: "display:flex;flex-direction:column;gap:6px;min-height:70px;" });
        (s[c[1]] || []).forEach(function (item) {
          list.appendChild(h("div", { style: WK.tint(c[2], 18) + "border-radius:8px;padding:5px 8px;font-family:var(--font-mono);font-size:0.76rem;" }, item));
        });
        if (!(s[c[1]] || []).length) list.appendChild(h("div", { style: "color:var(--text-dim);font-size:0.76rem;font-style:italic;" }, "empty"));
        cols.appendChild(h("div", { style: "border:1px solid var(--line);border-radius:10px;padding:8px;background:var(--surface-solid);" },
          h("div", { style: "font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim);margin-bottom:6px;font-weight:700;" }, c[0]), list));
      });
      note.textContent = s.note;
      var last = snip.steps[snip.steps.length - 1].out.join(" ");
      WK.readout(readout, [["step", (idx + 1) + " / " + snip.steps.length], ["output so far", s.out.join(" ") || "—"], ["final order", last]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.segment([["basic", "timeout vs promise"], ["nested", "nested scheduling"], ["await", "async / await"]], 0, function (v) { key = v; idx = -1; paint(); }, "Snippet"),
      WK.btn("Step", function () { idx = Math.min(LOOP_SNIPPETS[key].steps.length - 1, idx + 1); paint(); }, "primary"),
      WK.btn("Run all", function () { idx = LOOP_SNIPPETS[key].steps.length - 1; paint(); }),
      WK.btn("Reset", function () { idx = -1; paint(); }, "ghost")));
    var stage = h("div", { class: "w-stage" }, codeEl, cols, note);
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- webSpecificity: selector specificity calculator ---------- */
  function specificity(sel) {
    var a = 0, b = 0, c = 0, i = 0, s = String(sel || "").trim();
    function readName() { var start = i; while (i < s.length && /[A-Za-z0-9_-]/.test(s[i])) i++; return s.slice(start, i); }
    function readParens() {
      if (s[i] !== "(") return "";
      var depth = 0, start = i + 1;
      for (; i < s.length; i++) {
        if (s[i] === "(") depth++;
        else if (s[i] === ")") { depth--; if (!depth) { i++; return s.slice(start, i - 1); } }
      }
      return s.slice(start);
    }
    function maxOf(list) {
      var best = [0, 0, 0];
      list.split(",").forEach(function (part) {
        var sp = specificity(part);
        if (sp[0] > best[0] || (sp[0] === best[0] && (sp[1] > best[1] || (sp[1] === best[1] && sp[2] > best[2])))) best = sp;
      });
      return best;
    }
    var guard = 0;
    while (i < s.length && guard++ < 500) {
      var ch = s[i];
      if (ch === "#") { i++; readName(); a++; }
      else if (ch === ".") { i++; readName(); b++; }
      else if (ch === "[") { while (i < s.length && s[i] !== "]") i++; i++; b++; }
      else if (ch === ":") {
        if (s[i + 1] === ":") { i += 2; readName(); c++; }
        else {
          i++;
          var name = readName().toLowerCase();
          var args = readParens();
          if (name === "where") { /* zero */ }
          else if (name === "is" || name === "not" || name === "has") { var m = maxOf(args); a += m[0]; b += m[1]; c += m[2]; }
          else b++;
        }
      }
      else if (/[A-Za-z]/.test(ch)) { readName(); c++; }
      else i++;
    }
    return [a, b, c];
  }
  function cmp(x, y) { for (var k = 0; k < 3; k++) { if (x[k] !== y[k]) return x[k] > y[k] ? 1 : -1; } return 0; }
  Widgets.webSpecificity = function (mount) {
    var h = WK.h;
    WK.shell(mount, "calculator", "Specificity duel",
      "Pick or type two selectors that target the same element. Specificity is compared column by column: ids, then classes/attributes/pseudo-classes, then elements.");
    var PRESETS = [["#nav .item a", "#nav .item a"], ["ul li.active", "ul li.active"], [":where(.card) p", ":where(.card) p"], ["button:hover", "button:hover"], [".btn.btn-primary", ".btn.btn-primary"], ["a[href]", "a[href]"], [":is(#main, .x) h2", ":is(#main, .x) h2"], ["p::first-line", "p::first-line"]];
    var left = "#nav .item a", right = ".btn.btn-primary";
    var inL = h("input", { type: "text", value: left, "aria-label": "Selector A", spellcheck: "false", style: "max-width:220px" });
    var inR = h("input", { type: "text", value: right, "aria-label": "Selector B", spellcheck: "false", style: "max-width:220px" });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function card(label, sel, sp, win) {
      return h("div", { style: (win ? WK.tint("#f5a623", 20) : "border:1px solid var(--line);background:var(--surface-solid);color:var(--text);") + "border-radius:12px;padding:12px;flex:1;min-width:200px;" },
        h("div", { style: "font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim);font-weight:700;" }, label + (win ? " — wins" : "")),
        h("div", { style: "font-family:var(--font-mono);font-size:0.9rem;margin:6px 0 10px;word-break:break-all;" }, sel || "(empty)"),
        h("div", { style: "display:flex;gap:6px;" },
          ["ids", "classes", "elements"].map(function (n, k) {
            return h("div", { style: "flex:1;text-align:center;border:1px solid var(--line-strong);border-radius:8px;padding:6px 0;" },
              h("div", { style: "font-family:var(--font-mono);font-size:1.3rem;font-weight:700;" }, String(sp[k])),
              h("div", { style: "font-size:0.68rem;color:var(--text-dim);" }, n));
          })));
    }
    function paint() {
      var sa = specificity(left), sb = specificity(right), r = cmp(sa, sb);
      WK.clear(stage);
      stage.appendChild(h("div", { style: "display:flex;gap:12px;flex-wrap:wrap;" }, card("Selector A", left, sa, r > 0), card("Selector B", right, sb, r < 0)));
      stage.appendChild(h("p", { style: "margin:12px 0 0;font-size:0.86rem;color:var(--text);" },
        r === 0 ? "Tie: the rule that appears later in the stylesheet (same origin and layer) wins." : "Compared left to right; the first column that differs decides. Source order only matters on a tie."));
      WK.readout(readout, [["A", "(" + sa.join(",") + ")"], ["B", "(" + sb.join(",") + ")"], ["winner", r > 0 ? "A" : r < 0 ? "B" : "later rule"]]);
    }
    inL.addEventListener("input", function () { left = inL.value; paint(); });
    inR.addEventListener("input", function () { right = inR.value; paint(); });
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.field("A", inL),
      WK.field("preset", WK.select(PRESETS, left, function (v) { left = v; inL.value = v; paint(); }, "Preset for selector A")),
      WK.field("B", inR),
      WK.field("preset", WK.select(PRESETS, right, function (v) { right = v; inR.value = v; paint(); }, "Preset for selector B"))));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  /* ---------- quizzes ---------- */
  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "web-html-css": {
      title: "HTML & CSS checkpoint",
      sub: "Semantics, layout models and the cascade.",
      questions: [
        { q: "A clickable element opens a modal on the same page. Which element should it be?", options: ["<a> with a dummy link target", "<div onclick>", "<button type=\"button\">", "<span role=\"link\">"], answer: 2,
          explain: "Actions are buttons, navigation is links. A real button is focusable, fires on Enter and Space, and announces itself as a button without any extra code." },
        { q: "You need a card gallery that fills the row with as many 200px-minimum columns as fit. Which is the most direct tool?", options: ["grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))", "flex-direction: column", "float: left with width: 33%", "position: absolute for each card"], answer: 0,
          explain: "Grid with auto-fit and minmax creates as many tracks as fit and stretches them to share the leftover space. No media queries are needed." },
        { q: "Which selector has the highest specificity?", options: [".nav .item .link", "#header a", "ul li a:hover", ":where(#main) .card"], answer: 1,
          explain: "One id beats any number of classes: #header a is (1,0,1). :where() contributes zero, so the last option is only (0,1,0)." },
        { q: "Two rules with identical specificity set color on the same element. Which wins?", options: ["The one declared first", "The one with the shorter selector", "Neither; the browser default applies", "The one declared later in the same origin and layer"], answer: 3,
          explain: "When origin, importance, layer and specificity all tie, source order decides and the later declaration wins." },
        { q: "What is the main benefit of putting third-party CSS inside a low-priority @layer?", options: ["It loads faster", "Your unlayered styles beat it without specificity hacks", "It disables !important", "It scopes styles to a component"], answer: 1,
          explain: "Unlayered styles win over layered ones regardless of specificity, so you can override a library cleanly instead of escalating selectors or using !important." }
      ]
    },
    "web-browser": {
      title: "Inside the browser checkpoint",
      sub: "Events, the event loop and the rendering pipeline.",
      questions: [
        { q: "What does this log: console.log(1); setTimeout(()=>console.log(2)); Promise.resolve().then(()=>console.log(3)); console.log(4)?", options: ["1 2 3 4", "1 4 3 2", "1 4 2 3", "1 3 4 2"], answer: 1,
          explain: "Synchronous code runs first (1, 4). Then the microtask queue drains (3) before the loop takes the next task, the timer (2)." },
        { q: "Why is one click listener on a list container often better than one per row?", options: ["Events do not bubble from rows", "It is required by React", "Delegation uses bubbling, so one listener covers current and future rows", "It makes the event fire twice"], answer: 2,
          explain: "Events bubble from the target up through ancestors. A single listener can inspect event.target and handle rows added later, with fewer listeners to manage." },
        { q: "Which CSS change is cheapest to animate because it can usually stay on the compositor?", options: ["width", "top", "margin-left", "transform"], answer: 3,
          explain: "transform and opacity can be applied by the compositor without re-running layout or paint. Animating geometry like width or top forces layout every frame." },
        { q: "A loop reads offsetHeight and then writes style.height for 200 elements, alternating. What is the problem?", options: ["Layout thrashing: each read after a write forces a synchronous layout", "Memory leak", "The event loop is blocked forever", "CSS specificity conflict"], answer: 0,
          explain: "Reading a layout property after a style write forces the browser to recalculate layout immediately. Batch all reads, then all writes." },
        { q: "What does the defer attribute do on a classic script tag?", options: ["Runs it before HTML parsing starts", "Downloads it in parallel and runs it after parsing, in document order", "Runs it whenever it finishes downloading, in any order", "Prevents it from ever blocking rendering, even inline"], answer: 1,
          explain: "defer downloads without blocking the parser and executes after the document is parsed, preserving order. async runs as soon as it arrives, in any order." }
      ]
    },
    "web-js-ts": {
      title: "JavaScript & TypeScript checkpoint",
      sub: "Modern language features and types that prevent UI bugs.",
      questions: [
        { q: "Which TypeScript shape makes an impossible UI state unrepresentable?", options: ["{ loading: boolean; error?: string; data?: T }", "{ status: \"idle\" } | { status: \"loading\" } | { status: \"error\"; error: string } | { status: \"success\"; data: T }", "any", "Partial<T>"], answer: 1,
          explain: "A discriminated union ties each status to the fields it carries, so you cannot have data and an error at once. Narrowing on status gives you the right fields." },
        { q: "Why prefer unknown over any for a parsed JSON payload?", options: ["unknown is faster at runtime", "unknown forces you to narrow or validate before use", "any is not allowed in strict mode", "unknown converts the value to a string"], answer: 1,
          explain: "any switches type checking off. unknown accepts anything but refuses property access until you prove the shape, which is exactly what untrusted data needs." },
        { q: "What does items.toSorted(compare) do differently from items.sort(compare)?", options: ["It sorts in descending order", "It is asynchronous", "It returns a new sorted array and leaves the original untouched", "It only works on numbers"], answer: 2,
          explain: "sort mutates in place, which breaks React state that must be treated as immutable. toSorted returns a copy, safe to use on state." },
        { q: "What does the satisfies operator give you over a type annotation?", options: ["It checks the value against a type while keeping the narrower inferred type", "It casts any value to the type", "It removes the type at runtime", "It makes properties optional"], answer: 0,
          explain: "An annotation widens the variable to the declared type. satisfies validates conformance but preserves literal types, so autocomplete and narrowing stay precise." }
      ]
    }
  });

  /* ---------- track ---------- */
  window.TRACKS = window.TRACKS || {};
  window.TRACKS.web = {
    id: "web",
    name: "Web Platform Foundations",
    short: "WEB",
    tagline: "The platform React runs on",
    color: "#f5a623",
    blurb: "React is a thin layer over the browser. Learn semantic HTML, flexbox and grid, the cascade and specificity, DOM events, the event loop, the rendering pipeline, and the modern JavaScript and TypeScript you will write every day.",
    modules: [
      {
        id: "html-css",
        name: "HTML & CSS That Holds Up",
        icon: "grid",
        lessons: [
          {
            id: "semantic-html",
            title: "Semantic HTML: meaning before styling",
            summary: "Pick elements for what they are, and you get accessibility, keyboard support and SEO for free.",
            minutes: 9,
            tags: ["html", "semantics", "landmarks", "forms"],
            blocks: [
              { t: "p", html: "Think of HTML as the <strong>contract between your page and every machine that reads it</strong>: the browser, a screen reader, a search crawler, a password manager, a translation tool. Styling is a layer on top. If the contract is right, everything else gets easier." },
              { t: "h", text: "Landmarks and outline" },
              { t: "table", headers: ["Element", "What it tells machines", "Typical use"], rows: [
                ["<code class='tok'>&lt;header&gt;</code> / <code class='tok'>&lt;footer&gt;</code>", "Banner / content info region (when not nested in a section)", "Site header, site footer"],
                ["<code class='tok'>&lt;nav&gt;</code>", "A navigation landmark", "Primary menu, breadcrumbs"],
                ["<code class='tok'>&lt;main&gt;</code>", "The one main content region", "Page body; target of the skip link"],
                ["<code class='tok'>&lt;article&gt;</code> / <code class='tok'>&lt;section&gt;</code>", "Self-contained item / thematic group with a heading", "Post, card; grouped settings"],
                ["<code class='tok'>&lt;h1&gt;</code>–<code class='tok'>&lt;h6&gt;</code>", "Document outline", "One h1, no skipped levels"]
              ] },
              { t: "h", text: "Buttons versus links" },
              { t: "compare",
                bad: { title: "Div soup", items: ["<code class='tok'>&lt;div onClick&gt;</code> is not focusable", "No Enter/Space activation", "Announced as plain text", "You re-implement role, tabindex and key handlers"] },
                good: { title: "Native elements", items: ["<code class='tok'>&lt;button&gt;</code> for actions", "<code class='tok'>&lt;a href&gt;</code> for navigation", "Focus, keys and role come built in", "Works before your JavaScript loads"] } },
              { t: "code", lang: "text", code:
                "<form action=\"/search\" role=\"search\">\n" +
                "  <label for=\"q\">Search products</label>\n" +
                "  <input id=\"q\" name=\"q\" type=\"search\" autocomplete=\"off\" />\n" +
                "  <button type=\"submit\">Search</button>\n" +
                "</form>" },
              { t: "note", variant: "tip", html: "Every input needs a programmatic label: a <code class='tok'>&lt;label for&gt;</code>, a wrapping label, or <code class='tok'>aria-labelledby</code>. A placeholder is not a label: it disappears as soon as the user types." },
              { t: "note", variant: "trap", html: "A <code class='tok'>&lt;button&gt;</code> inside a form defaults to <code class='tok'>type=\"submit\"</code>. Set <code class='tok'>type=\"button\"</code> on anything that should not submit." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"make this clickable\", \"build a custom dropdown\", \"the screen reader says 'group'\" — start by asking which native element already does this." },
              { t: "note", variant: "key", html: "<strong>Choose the element for its meaning, then style it.</strong> Native semantics give you role, name, state and keyboard behaviour that would take dozens of lines to rebuild." }
            ]
          },
          {
            id: "flex-grid",
            title: "Flexbox and grid: picking the layout model",
            summary: "Flexbox distributes items along one axis; grid places them on two. Use each for what it is good at.",
            minutes: 10,
            tags: ["css", "flexbox", "grid", "layout"],
            blocks: [
              { t: "p", html: "The quickest mental model: <strong>flexbox is content-out, grid is layout-in</strong>. Flexbox lets item sizes drive the row. Grid defines tracks first and drops items into them." },
              { t: "table", headers: ["Question", "Flexbox", "Grid"], rows: [
                ["Dimensions", "One axis at a time (row or column)", "Rows and columns together"],
                ["Who decides size", "Mostly the items (flex-basis, grow, shrink)", "Mostly the container (template tracks)"],
                ["Great for", "Toolbars, nav bars, centering, button groups", "Page shells, card galleries, forms with aligned labels"],
                ["Alignment across rows", "Each wrapped line aligns on its own", "Columns line up across every row"]
              ] },
              { t: "widget", id: "webFlexGrid" },
              { t: "code", lang: "text", code:
                "/* responsive gallery, zero media queries */\n" +
                ".gallery {\n" +
                "  display: grid;\n" +
                "  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));\n" +
                "  gap: 1rem;\n" +
                "}\n\n" +
                "/* toolbar: push the last group to the far end */\n" +
                ".toolbar { display: flex; gap: .5rem; align-items: center; }\n" +
                ".toolbar .spacer { margin-inline-start: auto; }" },
              { t: "ul", items: [
                "<strong>gap</strong> works in both models; prefer it to margins between siblings.",
                "<strong>min-width: 0</strong> on a flex child lets long text shrink instead of overflowing.",
                "<strong>Container queries</strong> (<code class='tok'>@container</code>) size a component by its own box, not the viewport — ideal for reusable cards."
              ] },
              { t: "note", variant: "warn", html: "Do not reach for grid just to center one thing. <code class='tok'>display: grid; place-items: center</code> works, but so does flexbox; pick the model that matches the rest of the component." },
              { t: "note", variant: "key", html: "<strong>One axis of items: flexbox. Two axes of tracks: grid.</strong> Use <code class='tok'>gap</code>, intrinsic sizing and container queries before media queries." }
            ]
          },
          {
            id: "cascade-specificity",
            title: "The cascade, specificity and layers",
            summary: "How the browser decides which declaration wins, and how to keep that decision boring.",
            minutes: 10,
            tags: ["css", "cascade", "specificity", "layers"],
            blocks: [
              { t: "p", html: "When two declarations set the same property on the same element, the browser runs a fixed tournament. Knowing the order of the rounds removes most CSS mysteries." },
              { t: "ol", items: [
                "<strong>Origin and importance</strong> — user agent, user and author styles; <code class='tok'>!important</code> flips the order.",
                "<strong>Context</strong> — shadow DOM encapsulation.",
                "<strong>Cascade layers</strong> — later <code class='tok'>@layer</code> beats earlier; unlayered beats all layered.",
                "<strong>Specificity</strong> — (ids, classes/attributes/pseudo-classes, elements/pseudo-elements).",
                "<strong>Source order</strong> — the later declaration wins a full tie."
              ] },
              { t: "widget", id: "webSpecificity" },
              { t: "code", lang: "text", code:
                "@layer reset, vendor, components, utilities;\n\n" +
                "@layer vendor { @import url(\"datepicker.css\"); }\n" +
                "@layer components { .btn { padding: .5rem 1rem; } }\n" +
                "@layer utilities { .p-0 { padding: 0; } }  /* beats .btn regardless of specificity */\n\n" +
                ":where(.prose) a { color: var(--link); }      /* (0,0,1): trivially overridable */" },
              { t: "table", headers: ["Tier", "Strategy", "Cost"], rows: [
                ["Naive", "Fight conflicts with longer selectors and !important", "Specificity arms race; every override gets harder"],
                ["Solid", "Flat, single-class selectors (BEM, CSS Modules)", "Discipline required; global leaks still possible"],
                ["Standout", "Layers for ordering + low-specificity :where() defaults + scoped components", "Upfront architecture; teammates must learn layers"]
              ] },
              { t: "note", variant: "tip", html: "Custom properties inherit and can be overridden per subtree, which makes theming a variable swap rather than a selector rewrite." },
              { t: "quiz", id: "web-html-css" },
              { t: "note", variant: "key", html: "<strong>Order is decided by origin, layer, specificity, then source order.</strong> Keep specificity low and flat, and use layers to say which group of styles should win." }
            ]
          }
        ]
      },
      {
        id: "browser",
        name: "Inside the Browser",
        icon: "globe",
        lessons: [
          {
            id: "dom-events",
            title: "The DOM and event propagation",
            summary: "Capture, target, bubble — and why delegation and passive listeners matter.",
            minutes: 8,
            tags: ["dom", "events", "delegation"],
            blocks: [
              { t: "p", html: "The DOM is a live tree of objects the browser builds from your HTML. Every event travels that tree in <strong>three phases</strong>: down from the window to the target (capture), at the target, and back up (bubble)." },
              { t: "code", lang: "javascript", code:
                "// one listener for every row, including rows added later\n" +
                "list.addEventListener(\"click\", (event) => {\n" +
                "  const row = event.target.closest(\"[data-row-id]\");\n" +
                "  if (!row || !list.contains(row)) return;\n" +
                "  openRow(row.dataset.rowId);\n" +
                "});\n\n" +
                "// tell the browser you will never call preventDefault, so scrolling never waits\n" +
                "window.addEventListener(\"touchmove\", onMove, { passive: true });" },
              { t: "table", headers: ["Call", "What it stops", "Use when"], rows: [
                ["<code class='tok'>preventDefault()</code>", "The browser's default action (submit, navigate, scroll)", "You handle the action yourself"],
                ["<code class='tok'>stopPropagation()</code>", "Further travel through the tree", "Rarely; it breaks delegation and analytics"],
                ["<code class='tok'>{ once: true }</code>", "Later invocations of this listener", "One-shot setup handlers"],
                ["<code class='tok'>AbortController</code> signal", "Removes listeners in bulk", "Cleanup in effects and components"]
              ] },
              { t: "note", variant: "tip", html: "React attaches its listeners at the root and dispatches synthetic events, which is delegation done for you. Native listeners you add yourself still need cleanup." },
              { t: "note", variant: "trap", html: "Calling <code class='tok'>stopPropagation()</code> to fix a dropdown closing too early usually breaks an outside-click handler somewhere else. Check <code class='tok'>event.target</code> instead." },
              { t: "note", variant: "key", html: "<strong>Events travel down, hit the target, then bubble up.</strong> Delegate from a stable ancestor, mark scroll and touch listeners passive, and avoid stopping propagation." }
            ]
          },
          {
            id: "event-loop",
            title: "The event loop: tasks, microtasks and rendering",
            summary: "Why promise callbacks run before timers, and why a long task freezes the page.",
            minutes: 11,
            tags: ["event-loop", "microtasks", "async"],
            blocks: [
              { t: "p", html: "JavaScript on the main thread runs one thing at a time. The <strong>event loop</strong> picks the next unit of work: run one task, drain every microtask, maybe render, repeat." },
              { t: "diagram", id: "event-loop", caption: "One task, then all microtasks, then a rendering opportunity — a long task blocks all three." },
              { t: "table", headers: ["Queue", "Fed by", "Drained"], rows: [
                ["Task (macrotask)", "setTimeout, setInterval, user input events, message events, network callbacks", "One per loop iteration"],
                ["Microtask", "Promise reactions, await continuations, queueMicrotask, MutationObserver", "Completely, after every task"],
                ["Animation frame", "requestAnimationFrame", "Before the next paint, when the browser renders"]
              ] },
              { t: "widget", id: "webEventLoop" },
              { t: "stat", items: [{ v: "50 ms", k: "a task longer than this counts as a long task" }, { v: "~16.7 ms", k: "frame budget at 60 Hz" }, { v: "1", k: "main thread for your JS, style, layout and paint" }] },
              { t: "note", variant: "warn", html: "Microtasks that keep queueing microtasks starve rendering just like an infinite loop: the page cannot paint until the queue is empty." },
              { t: "note", variant: "tip", html: "To keep input responsive, break long work into chunks and yield back to the loop between chunks (for example with <code class='tok'>await new Promise(r =&gt; setTimeout(r))</code> or a scheduler API where available)." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"what does this log\", \"UI freezes while processing\", \"spinner never shows\" — trace tasks versus microtasks, and look for work that never yields." },
              { t: "note", variant: "key", html: "<strong>One task, all microtasks, then maybe a frame.</strong> Promise callbacks beat timers, and any long synchronous chunk delays every click and paint behind it." }
            ]
          },
          {
            id: "render-pipeline",
            title: "The rendering pipeline: from bytes to pixels",
            summary: "Parse, style, layout, paint, composite — and which changes trigger which stages.",
            minutes: 10,
            tags: ["rendering", "layout", "paint", "compositing"],
            blocks: [
              { t: "p", html: "Every frame the browser may run a pipeline. Knowing which stage your change starts from tells you what it costs." },
              { t: "diagram", id: "render-pipeline", caption: "Each stage feeds the next; a change re-runs its stage and everything after it." },
              { t: "table", headers: ["You change…", "Re-runs from", "Relative cost"], rows: [
                ["width, height, top, font-size, adding DOM nodes", "Layout", "High — geometry of many boxes may change"],
                ["color, background, box-shadow", "Paint", "Medium — pixels redrawn, no geometry"],
                ["transform, opacity (on a composited layer)", "Composite", "Low — the GPU moves existing layers"]
              ] },
              { t: "h", text: "Render-blocking resources" },
              { t: "ul", items: [
                "CSS in the head blocks first paint: the browser will not render unstyled content. Keep critical CSS small.",
                "Classic scripts without <code class='tok'>defer</code> or <code class='tok'>async</code> block the HTML parser.",
                "Module scripts are deferred by default.",
                "Web fonts can delay text rendering; <code class='tok'>font-display</code> controls the fallback behaviour."
              ] },
              { t: "code", lang: "javascript", code:
                "// layout thrashing: read-write-read-write forces layout every iteration\n" +
                "rows.forEach((r) => { r.style.height = r.offsetHeight + 10 + \"px\"; });\n\n" +
                "// batched: all reads, then all writes — one layout\n" +
                "const heights = rows.map((r) => r.offsetHeight);\n" +
                "rows.forEach((r, i) => { r.style.height = heights[i] + 10 + \"px\"; });" },
              { t: "note", variant: "tip", html: "Animate with <code class='tok'>transform</code> and <code class='tok'>opacity</code>. Use <code class='tok'>will-change</code> sparingly and only just before an animation: every promoted layer costs memory." },
              { t: "quiz", id: "web-browser" },
              { t: "note", variant: "key", html: "<strong>Layout is expensive, paint is moderate, compositing is cheap.</strong> Batch DOM reads before writes, animate transform and opacity, and keep render-blocking CSS and scripts minimal." }
            ]
          }
        ]
      },
      {
        id: "js-ts",
        name: "Modern JS & TypeScript",
        icon: "bolt",
        lessons: [
          {
            id: "typescript-essentials",
            title: "Modern JavaScript and TypeScript for UI code",
            summary: "The language features React code leans on, and the types that make whole classes of UI bugs impossible.",
            minutes: 12,
            tags: ["javascript", "typescript", "immutability", "unions"],
            blocks: [
              { t: "p", html: "React code is mostly plain JavaScript: modules, closures, immutable updates and async functions. TypeScript then lets you <strong>describe the shapes of props and state</strong> so the compiler catches mistakes before a user does." },
              { t: "h", text: "JavaScript you will use daily" },
              { t: "table", headers: ["Feature", "Why it matters in UI code"], rows: [
                ["Spread and destructuring", "Immutable updates: <code class='tok'>{ ...user, name }</code>"],
                ["Optional chaining <code class='tok'>?.</code> and nullish <code class='tok'>??</code>", "Safe reads of partial API data without falsy-zero bugs"],
                ["<code class='tok'>toSorted</code>, <code class='tok'>toSpliced</code>, <code class='tok'>with</code>, <code class='tok'>structuredClone</code>", "Copy-returning array helpers that never mutate state"],
                ["async / await + <code class='tok'>Promise.all</code>", "Parallel requests instead of waterfalls"],
                ["Closures", "Event handlers capture the props and state of the render they came from"]
              ] },
              { t: "h", text: "Types that model UI state" },
              { t: "code", lang: "javascript", code:
                "type Remote<T> =\n" +
                "  | { status: \"idle\" }\n" +
                "  | { status: \"loading\" }\n" +
                "  | { status: \"error\"; error: string }\n" +
                "  | { status: \"success\"; data: T };\n\n" +
                "function Orders({ state }: { state: Remote<Order[]> }) {\n" +
                "  switch (state.status) {\n" +
                "    case \"loading\": return <Spinner />;\n" +
                "    case \"error\":   return <ErrorBanner message={state.error} />;\n" +
                "    case \"success\": return <OrderList orders={state.data} />;\n" +
                "    default:        return null;\n" +
                "  }\n" +
                "}\n\n" +
                "type ButtonProps = React.ComponentPropsWithoutRef<\"button\"> & { tone: \"primary\" | \"danger\" };" },
              { t: "compare",
                bad: { title: "Bag of booleans", items: ["<code class='tok'>isLoading</code>, <code class='tok'>isError</code>, <code class='tok'>data?</code>", "Loading and error can both be true", "Every consumer re-checks combinations"] },
                good: { title: "Discriminated union", items: ["One <code class='tok'>status</code> field picks the variant", "Each variant carries only its own fields", "The compiler narrows for you in a switch"] } },
              { t: "ul", items: [
                "<strong>unknown over any</strong> for anything from the network; validate, then narrow.",
                "<strong>Generics</strong> for reusable components and hooks: <code class='tok'>useFetch&lt;T&gt;</code>, <code class='tok'>Select&lt;Option&gt;</code>.",
                "<strong>satisfies</strong> checks a config object without widening its literal types.",
                "<strong>Strict mode</strong> on from day one; turning it on later is a migration."
              ] },
              { t: "note", variant: "tip", html: "Types are the cheapest tests you will ever write. A prop typo, a missing case in a switch or a null you forgot is caught as you type rather than in production." },
              { t: "quiz", id: "web-js-ts" },
              { t: "note", variant: "key", html: "<strong>Update immutably, await in parallel, and model state as discriminated unions.</strong> Let the compiler make impossible UI states impossible to write." }
            ]
          }
        ]
      }
    ]
  };
})();
