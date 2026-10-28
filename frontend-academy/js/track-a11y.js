/* =====================================================================
   PIXEL · Accessibility
   window.TRACKS.a11y — modules: foundations / interaction / verify
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};
  var ACC = "#facc15";

  /* ---------- a11yContrast: WCAG contrast checker ---------- */
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function luminance(rgb) {
    var c = rgb.map(function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    var hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  }

  Widgets.a11yContrast = function (mount) {
    var h = WK.h;
    WK.shell(mount, "checker", "Contrast ratio checker",
      "Pick a text and background colour, or start from a preset. The ratio is computed with the WCAG relative-luminance formula.");
    var PRESETS = [
      ["#1f2937", "#ffffff", "Dark grey on white"],
      ["#767676", "#ffffff", "Mid grey on white"],
      ["#9ca3af", "#ffffff", "Light grey on white"],
      ["#ffffff", "#db2777", "White on pink"],
      ["#9ca3af", "#111827", "Grey on near-black"]
    ];
    var fg = PRESETS[0][0], bg = PRESETS[0][1];
    var fgIn = h("input", { type: "color", value: fg, "aria-label": "Text colour" });
    var bgIn = h("input", { type: "color", value: bg, "aria-label": "Background colour" });
    fgIn.addEventListener("input", function () { fg = fgIn.value; paint(); });
    bgIn.addEventListener("input", function () { bg = bgIn.value; paint(); });
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var a = hexToRgb(fg), b = hexToRgb(bg);
      if (!a || !b) return;
      var r = ratio(a, b);
      WK.clear(stage);
      stage.appendChild(h("div", { style: "border-radius:12px;padding:16px 18px;border:1px solid var(--line);background:" + bg + ";color:" + fg + ";" },
        h("div", { style: "font-size:1.5rem;font-weight:700;" }, "Large heading sample"),
        h("div", { style: "font-size:0.95rem;margin-top:4px;" }, "Body text sample at a normal reading size.")));
      var checks = [["AA body text", 4.5], ["AA large text", 3], ["AA UI and icons", 3], ["AAA body text", 7]];
      var row = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;" });
      checks.forEach(function (c) {
        var pass = r >= c[1];
        row.appendChild(WK.badge((pass ? "✓ " : "✕ ") + c[0] + " ≥ " + c[1], pass ? WK.GOOD : WK.BAD));
      });
      stage.appendChild(row);
      WK.readout(readout, [["contrast", r.toFixed(2) + " : 1"], ["text", fg], ["background", bg]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.select(PRESETS.map(function (p, i) { return [String(i), p[2]]; }), "0", function (v) {
        var p = PRESETS[Number(v)]; fg = p[0]; bg = p[1]; fgIn.value = fg; bgIn.value = bg; paint();
      }, "Preset"),
      WK.field("Text ", fgIn),
      WK.field("Background ", bgIn)));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- a11yFocusOrder: tab order vs visual order ---------- */
  Widgets.a11yFocusOrder = function (mount) {
    var h = WK.h;
    WK.shell(mount, "keyboard", "Tab order vs. visual order",
      "A signup form. Introduce common bugs, then press the Tab button to walk the focus order a keyboard user would get.");
    var bugs = { divButton: false, tabindex: false, cssOrder: false, hidden: false };
    var cursor = -1;
    var ITEMS = { menu: "Hidden menu link", name: "Name", email: "Email", check: "Subscribe checkbox", cancel: "Cancel", submit: "Submit" };
    function model() {
      var dom = ["name", "email", "check", "cancel", "submit"];
      if (bugs.hidden) dom.unshift("menu");
      var tabbable = dom.filter(function (k) { return !(bugs.divButton && k === "submit"); });
      if (bugs.tabindex) tabbable = ["cancel"].concat(tabbable.filter(function (k) { return k !== "cancel"; }));
      var visual = bugs.cssOrder ? ["email", "name", "check", "cancel", "submit"] : ["name", "email", "check", "cancel", "submit"];
      return { tabbable: tabbable, visual: visual };
    }
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      var m = model();
      var focused = cursor >= 0 ? m.tabbable[cursor % m.tabbable.length] : null;
      WK.clear(stage);
      var row = h("div", { style: "display:flex;flex-wrap:wrap;gap:8px;" });
      var all = (bugs.hidden ? ["menu"] : []).concat(m.visual);
      all.forEach(function (k) {
        var pos = m.tabbable.indexOf(k);
        var ghost = k === "menu";
        var isFocus = focused === k;
        var style = "min-width:110px;padding:10px 12px;border-radius:10px;font-size:0.84rem;" +
          (ghost ? "border:1px dashed var(--line-strong);color:var(--text-dim);" : "border:1px solid var(--line);background:var(--surface-solid);color:var(--text);") +
          (isFocus ? "outline:3px solid " + ACC + ";outline-offset:2px;" : "");
        row.appendChild(h("div", { style: style },
          h("div", { style: "font-weight:600;" }, ITEMS[k] + (ghost ? " (invisible)" : "")),
          h("div", { style: "margin-top:4px;" }, pos >= 0 ? WK.badge("tab stop " + (pos + 1), ghost ? WK.MID : "#38bdf8") : WK.badge("unreachable", WK.BAD))));
      });
      stage.appendChild(row);
      var expected = m.visual.filter(function (k) { return k !== "submit" || !bugs.divButton; });
      var actual = m.tabbable.filter(function (k) { return k !== "menu"; });
      var matches = !bugs.hidden && !bugs.divButton && expected.join() === actual.join();
      var issues = [];
      if (bugs.divButton) issues.push("Submit is a div with a click handler: no keyboard focus, no Enter or Space, no button role.");
      if (bugs.tabindex) issues.push("A positive tabindex on Cancel pulls it ahead of every other control.");
      if (bugs.cssOrder) issues.push("CSS order swapped Name and Email visually, but focus still follows the DOM.");
      if (bugs.hidden) issues.push("An off-screen menu link is still focusable, so focus disappears for one stop.");
      stage.appendChild(h("ul", { style: "margin:10px 0 0;padding-left:18px;font-size:0.84rem;color:var(--text);" },
        issues.length ? issues.map(function (t) { return h("li", {}, t); }) : h("li", {}, "Focus order matches the visual order and every control is reachable.")));
      WK.readout(readout, [["tab stops", m.tabbable.length], ["focused", focused ? ITEMS[focused] : "none"], ["order matches visual", matches ? "yes" : "no"], ["issues", issues.length]]);
    }
    function setBug(k) { return function (v) { bugs[k] = v; cursor = -1; paint(); }; }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.toggle("Submit as div", false, setBug("divButton")),
      WK.toggle("tabindex=\"3\" on Cancel", false, setBug("tabindex")),
      WK.toggle("CSS order swap", false, setBug("cssOrder")),
      WK.toggle("Focusable hidden menu", false, setBug("hidden"))));
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.btn("Tab ⇥", function () { cursor += 1; paint(); }, "primary"),
      WK.btn("Reset focus", function () { cursor = -1; paint(); }, "ghost")));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "a11y-foundations": {
      title: "Accessibility foundations checkpoint",
      sub: "Semantics first, ARIA when needed.",
      questions: [
        { q: "What is the first rule of ARIA?", options: ["Add role to every element", "If a native HTML element provides the semantics and behaviour you need, use it instead of ARIA", "Always use aria-label", "ARIA replaces keyboard support"], answer: 1,
          explain: "Native elements bring role, name, state and keyboard behaviour for free. ARIA only changes what assistive tech is told; it adds no behaviour." },
        { q: "An icon-only button shows a trash can. What does it need?", options: ["Nothing", "An accessible name, such as aria-label=\"Delete draft\" or visually hidden text", "A title attribute only", "role=\"img\""], answer: 1,
          explain: "Without a name, a screen reader announces only \"button\". Name it by its action." },
        { q: "What does adding role=\"button\" to a div give you?", options: ["Full button behaviour", "Only the announced role; you still must add tabindex, Enter and Space handling and focus styles", "Nothing at all", "Form submission"], answer: 1,
          explain: "ARIA changes semantics, not behaviour. A real button element does all of it for free." },
        { q: "What does aria-live=\"polite\" do?", options: ["Hides content", "Announces content changes in that region when the screen reader is idle", "Makes text bold", "Prevents focus"], answer: 1,
          explain: "Live regions announce dynamic updates such as \"3 results\" or \"Saved\" without moving focus." },
        { q: "Why does heading structure matter?", options: ["It only affects SEO", "Screen reader users navigate by headings to skim and jump to sections", "Browsers require it", "It changes the font size"], answer: 1,
          explain: "Headings are the page's table of contents for assistive tech. Use levels by structure, not by size." }
      ]
    },
    "a11y-interaction": {
      title: "Keyboard & forms checkpoint",
      sub: "Focus management and accessible forms.",
      questions: [
        { q: "Why avoid positive tabindex values like tabindex=\"3\"?", options: ["They are invalid HTML", "They pull elements ahead of the natural order, creating a confusing focus sequence that is hard to maintain", "They disable focus", "They only work in some browsers"], answer: 1,
          explain: "Use 0 to make something focusable in DOM order and -1 for programmatic focus. Fix order by fixing the DOM." },
        { q: "When a modal dialog opens, where should focus go, and where when it closes?", options: ["Stay where it was; nowhere", "Into the dialog (first field or its heading), then back to the control that opened it", "To the page top both times", "To the browser address bar"], answer: 1,
          explain: "Move focus in, keep it inside while open, close on Escape, and restore it to the trigger. The native dialog element helps with much of this." },
        { q: "A field has a placeholder \"Email\" and no label. What is the problem?", options: ["None", "Placeholders disappear on typing, are often low contrast and are not a reliable accessible name; use a visible label", "Placeholders are not allowed", "It breaks autofill only"], answer: 1,
          explain: "A visible label associated with the input is clearer for everyone and reliably announced." },
        { q: "How should an inline validation error be connected to its field?", options: ["Red border only", "aria-invalid on the field and aria-describedby pointing at the error text", "A tooltip on hover", "An alert() popup"], answer: 1,
          explain: "Colour alone fails users who cannot see it. Linking the message makes it announced with the field." },
        { q: "What should never be removed without a replacement?", options: ["Box shadows", "The visible focus indicator", "Placeholder text", "Hover effects"], answer: 1,
          explain: "Keyboard users need to see where focus is. Use :focus-visible to style it instead of removing outlines." }
      ]
    },
    "a11y-verify": {
      title: "Verifying accessibility checkpoint",
      sub: "Contrast, motion and testing.",
      questions: [
        { q: "What contrast ratio does WCAG AA require for normal body text?", options: ["2:1", "3:1", "4.5:1", "7:1"], answer: 2,
          explain: "AA asks for 4.5:1 for normal text and 3:1 for large text and meaningful UI components. 7:1 is AAA." },
        { q: "How should animations respect user preferences?", options: ["Ignore them", "Reduce or remove non-essential motion under prefers-reduced-motion", "Double the animation speed", "Only animate on mobile"], answer: 1,
          explain: "Large motion can trigger vestibular symptoms. Honour the media query and keep animations to transform and opacity." },
        { q: "What share of accessibility issues can automated scanners reliably catch?", options: ["All of them", "A meaningful subset (missing names, contrast, invalid ARIA), but not focus order, meaning or usability", "None", "Only colour issues"], answer: 1,
          explain: "Automation is a floor. Keyboard walkthroughs and screen reader checks find what scanners cannot." },
        { q: "A status is shown only by a red or green dot. What should change?", options: ["Brighter colours", "Add text or an icon so the meaning does not rely on colour alone", "Make the dot larger", "Nothing"], answer: 1,
          explain: "Colour-blind users and screen reader users need a non-colour cue such as a label." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.a11y = {
    id: "a11y",
    name: "Accessibility",
    short: "A11Y",
    tagline: "Interfaces everyone can perceive and operate",
    color: ACC,
    blurb: "Accessibility is correctness, not polish. Start from semantic HTML, add ARIA only where it is needed, make everything keyboard operable with visible focus, build forms with real labels and announced errors, then verify contrast, motion and screen reader output.",
    modules: [
      {
        id: "foundations",
        name: "Foundations",
        icon: "shield",
        lessons: [
          {
            id: "semantic-first",
            title: "Semantic HTML first",
            summary: "The right element gives you role, name, state and keyboard behaviour for free.",
            minutes: 9,
            tags: ["semantics", "landmarks", "headings", "accessible-name"],
            blocks: [
              { t: "p", html: "Assistive technology reads the <strong>accessibility tree</strong>: each node has a <em>role</em> (button, link, heading), a <em>name</em> (what it is called) and a <em>state</em> (expanded, checked). Native elements fill all three in for you." },
              { t: "compare", bad: { title: "Rebuilt from divs", items: ["<code class='tok'>&lt;div class=\"btn\" onclick&gt;</code>", "No focus, no Enter or Space, no role", "Every app reimplements it slightly wrong"] }, good: { title: "Native element", items: ["<code class='tok'>&lt;button type=\"button\"&gt;</code>", "Focusable, keyboard operable, announced as button", "Works with forms and assistive tech by default"] } },
              { t: "table", headers: ["Need", "Use"], rows: [
                ["Navigate to another URL", "<code class='tok'>&lt;a href&gt;</code>"],
                ["Perform an action", "<code class='tok'>&lt;button&gt;</code>"],
                ["Page regions", "<code class='tok'>&lt;header&gt; &lt;nav&gt; &lt;main&gt; &lt;footer&gt;</code> landmarks"],
                ["Section titles", "<code class='tok'>&lt;h1&gt;…&lt;h6&gt;</code> in structural order"],
                ["Tabular data", "<code class='tok'>&lt;table&gt;</code> with <code class='tok'>&lt;th scope&gt;</code>"]
              ] },
              { t: "ul", items: [
                "Every image gets <code class='tok'>alt</code>: describe meaningful images, use <code class='tok'>alt=\"\"</code> for decorative ones.",
                "Icon-only buttons need an accessible name via <code class='tok'>aria-label</code> or visually hidden text.",
                "Set <code class='tok'>lang</code> on the html element so screen readers pronounce text correctly.",
                "Add a skip link to jump past repeated navigation to the main content."
              ] },
              { t: "note", variant: "key", html: "<strong>Choose the element by meaning, then style it.</strong> Links navigate, buttons act, landmarks and headings give structure, and every control has a name." }
            ]
          },
          {
            id: "aria-when-needed",
            title: "ARIA: only when HTML runs out",
            summary: "ARIA describes custom widgets to assistive tech — it never adds behaviour.",
            minutes: 10,
            tags: ["aria", "live-regions", "disclosure"],
            blocks: [
              { t: "p", html: "ARIA attributes change what assistive technology is <strong>told</strong>, not what the element <strong>does</strong>. Use them for patterns HTML has no element for, and keep them in sync with the visual state." },
              { t: "code", lang: "javascript", code:
                "function Disclosure({ title, children }) {\n" +
                "  const [open, setOpen] = useState(false);\n" +
                "  const id = useId();\n" +
                "  return (\n" +
                "    <>\n" +
                "      <button aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>\n" +
                "        {title}\n" +
                "      </button>\n" +
                "      <div id={id} hidden={!open}>{children}</div>\n" +
                "    </>\n" +
                "  );\n" +
                "}\n\n" +
                "// announce async results without moving focus\n" +
                "<p role=\"status\" aria-live=\"polite\">{count} results</p>" },
              { t: "table", headers: ["Attribute", "Purpose"], rows: [
                ["aria-label / aria-labelledby", "Provide or point to an accessible name"],
                ["aria-describedby", "Extra description such as a hint or error"],
                ["aria-expanded, aria-pressed, aria-selected", "Reflect widget state"],
                ["aria-live, role=status, role=alert", "Announce dynamic changes"],
                ["aria-hidden=\"true\"", "Remove decorative content from the tree (never on focusable elements)"]
              ] },
              { t: "note", variant: "trap", html: "Bad ARIA is worse than none: a <code class='tok'>role=\"menu\"</code> without arrow-key handling promises keyboard behaviour that is not there." },
              { t: "note", variant: "tip", html: "For complex widgets (combobox, tabs, tree, grid) follow the established keyboard interaction patterns, or use a well-tested headless library rather than inventing your own." },
              { t: "quiz", id: "a11y-foundations" },
              { t: "note", variant: "key", html: "<strong>No ARIA is better than bad ARIA.</strong> Use it to name, describe, reflect state and announce changes — and implement the matching keyboard behaviour yourself." }
            ]
          }
        ]
      },
      {
        id: "interaction",
        name: "Keyboard & Forms",
        icon: "compass",
        lessons: [
          {
            id: "keyboard-focus",
            title: "Keyboard access and focus management",
            summary: "Everything operable by keyboard, a focus order that follows the layout, and focus moved deliberately.",
            minutes: 11,
            tags: ["keyboard", "focus", "tabindex", "dialogs"],
            blocks: [
              { t: "p", html: "Many people never touch a mouse: keyboard users, switch users, screen reader users, power users. If an action cannot be reached with Tab and triggered with Enter or Space, it does not exist for them." },
              { t: "widget", id: "a11yFocusOrder" },
              { t: "table", headers: ["tabindex", "Meaning", "Use"], rows: [
                ["(none) on native controls", "Focusable in DOM order", "The default you want"],
                ["0", "Make a custom element focusable in DOM order", "Custom widgets only"],
                ["-1", "Focusable by script, not by Tab", "Dialog headings, error summaries, roving focus"],
                ["1 or more", "Jumps ahead of everything", "Avoid"]
              ] },
              { t: "ul", items: [
                "Style focus with <code class='tok'>:focus-visible</code>; never remove outlines without a replacement.",
                "Dialogs: move focus in, keep it inside, close on Escape, restore focus to the trigger.",
                "After route changes in a SPA, move focus to the new page's heading or announce the change.",
                "Make visually hidden off-screen menus <code class='tok'>inert</code> or <code class='tok'>hidden</code> so they leave the tab order."
              ] },
              { t: "note", variant: "tip", html: "The native <code class='tok'>&lt;dialog&gt;</code> element opened with <code class='tok'>showModal()</code> traps focus, handles Escape and makes the rest of the page inert." },
              { t: "h", text: "Two patterns worth memorizing" },
              { t: "code", lang: "javascript", code:
                "// 1. Modal: native dialog, focus restored to the trigger on close\n" +
                "function ConfirmDialog({ open, onClose, children }) {\n" +
                "  const ref = useRef(null);\n" +
                "  const opener = useRef(null);\n" +
                "  useEffect(() => {\n" +
                "    const d = ref.current;\n" +
                "    if (open && !d.open) { opener.current = document.activeElement; d.showModal(); }\n" +
                "    if (!open && d.open) { d.close(); opener.current?.focus(); }\n" +
                "  }, [open]);\n" +
                "  return <dialog ref={ref} onClose={onClose} aria-labelledby=\"dlg-title\">{children}</dialog>;\n" +
                "}\n\n" +
                "// 2. Roving tabindex: one Tab stop for the group, arrows move inside it\n" +
                "function Toolbar({ items }) {\n" +
                "  const [active, setActive] = useState(0);\n" +
                "  const refs = useRef([]);\n" +
                "  const move = (i) => { setActive(i); refs.current[i]?.focus(); };\n" +
                "  const onKeyDown = (e) => {\n" +
                "    if (e.key === \"ArrowRight\") move((active + 1) % items.length);\n" +
                "    if (e.key === \"ArrowLeft\") move((active - 1 + items.length) % items.length);\n" +
                "    if (e.key === \"Home\") move(0);\n" +
                "    if (e.key === \"End\") move(items.length - 1);\n" +
                "  };\n" +
                "  return (\n" +
                "    <div role=\"toolbar\" aria-label=\"Formatting\" onKeyDown={onKeyDown}>\n" +
                "      {items.map((it, i) => (\n" +
                "        <button key={it.id} ref={(el) => (refs.current[i] = el)}\n" +
                "                tabIndex={i === active ? 0 : -1} aria-pressed={it.on}>{it.label}</button>\n" +
                "      ))}\n" +
                "    </div>\n" +
                "  );\n" +
                "}" },
              { t: "table", headers: ["Widget", "Tab", "Arrows", "Enter / Space", "Escape"], rows: [
                ["Menu button", "Reaches the button", "Move between items", "Activate item", "Close, focus the button"],
                ["Tabs", "Into the active tab, then the panel", "Switch tabs", "Activate (if manual)", "—"],
                ["Combobox", "Into the input", "Move the active option", "Select option", "Close the popup"],
                ["Dialog", "Cycles inside", "—", "Activates buttons", "Close, restore focus"]
              ] },
              { t: "note", variant: "key", html: "<strong>Reachable, operable, visible, predictable.</strong> Everything works by keyboard, focus is always visible, its order follows the layout, and you move it on purpose." }
            ]
          },
          {
            id: "forms-errors",
            title: "Accessible forms and errors",
            summary: "Visible labels, helpful hints, errors that are announced and linked to their fields.",
            minutes: 10,
            tags: ["forms", "labels", "errors", "autocomplete"],
            blocks: [
              { t: "p", html: "Forms are where accessibility failures cost money: a sign-up nobody can complete. The fixes are mostly plain HTML used correctly." },
              { t: "code", lang: "text", code:
                "<label for=\"email\">Work email</label>\n" +
                "<input id=\"email\" name=\"email\" type=\"email\" autocomplete=\"email\"\n" +
                "       spellcheck=\"false\" required\n" +
                "       aria-invalid=\"true\" aria-describedby=\"email-hint email-err\">\n" +
                "<p id=\"email-hint\">We send the invite here.</p>\n" +
                "<p id=\"email-err\">Enter an address like name@company.example</p>" },
              { t: "table", headers: ["Do", "Why"], rows: [
                ["A visible label for every input", "Clear for everyone, reliably announced"],
                ["Correct type and autocomplete", "Right mobile keyboard and autofill"],
                ["Never block paste", "Password managers and accessibility tools rely on it"],
                ["Errors next to fields, linked with aria-describedby", "Announced with the field"],
                ["On submit, focus the first invalid field or an error summary", "Users learn what went wrong immediately"],
                ["Keep submit enabled until the request starts", "Disabled buttons hide why nothing happens"]
              ] },
              { t: "note", variant: "warn", html: "Do not rely on colour alone for errors. Pair the red border with text and, optionally, an icon." },
              { t: "quiz", id: "a11y-interaction" },
              { t: "note", variant: "key", html: "<strong>Label it, type it, explain it, link the error, move focus to it.</strong> Accessible forms are also faster forms for every user." }
            ]
          }
        ]
      },
      {
        id: "verify",
        name: "Visual & Verification",
        icon: "diamond",
        lessons: [
          {
            id: "contrast-motion",
            title: "Contrast, colour and motion",
            summary: "Readable text, meaning beyond colour, and animation that respects user preferences.",
            minutes: 9,
            tags: ["contrast", "colour", "reduced-motion"],
            blocks: [
              { t: "p", html: "Contrast is measured as a ratio between the relative luminance of text and background, from 1:1 (invisible) to 21:1 (black on white)." },
              { t: "widget", id: "a11yContrast" },
              { t: "table", headers: ["Content", "AA minimum", "AAA"], rows: [
                ["Body text", "4.5 : 1", "7 : 1"],
                ["Large text (about 24px, or 19px bold)", "3 : 1", "4.5 : 1"],
                ["Icons, input borders, focus rings", "3 : 1", "—"]
              ] },
              { t: "code", lang: "text", code:
                "/* motion only for those who are fine with it */\n" +
                ".card { transition: transform 200ms ease, opacity 200ms ease; }\n" +
                "@media (prefers-reduced-motion: reduce) {\n" +
                "  .card { transition: none; }\n" +
                "}" },
              { t: "ul", items: [
                "Check contrast in every theme, including hover, disabled and placeholder states.",
                "Never convey meaning by colour alone: add text, icons or patterns.",
                "Animate transform and opacity; avoid transition: all.",
                "Support zoom to 200% and text resizing without horizontal scrolling on content."
              ] },
              { t: "note", variant: "key", html: "<strong>4.5:1 for text, 3:1 for large text and UI, never colour alone, and honour reduced motion.</strong> Check every theme and state." }
            ]
          },
          {
            id: "screen-reader-testing",
            title: "Testing with tools and screen readers",
            summary: "Automate the floor, then walk the page by keyboard and listen to it.",
            minutes: 9,
            tags: ["axe", "screen-reader", "testing"],
            blocks: [
              { t: "p", html: "Automated scanners catch missing names, bad contrast and invalid ARIA. They cannot tell you whether the focus order makes sense or whether a label is meaningful. That needs a person." },
              { t: "ol", items: [
                "Run an automated accessibility scanner in unit, component and end-to-end tests.",
                "Unplug the mouse: complete the main task using only the keyboard.",
                "Turn on a screen reader and navigate by headings, landmarks and form controls.",
                "Zoom to 200% and test with reduced motion and a high-contrast mode.",
                "Include disabled users in research for critical flows."
              ] },
              { t: "code", lang: "javascript", code:
                "// component test: query the way users perceive the page\n" +
                "const { container } = render(<SignupForm />);\n" +
                "await user.type(screen.getByRole(\"textbox\", { name: /work email/i }), \"bad\");\n" +
                "await user.click(screen.getByRole(\"button\", { name: /create account/i }));\n" +
                "expect(screen.getByRole(\"textbox\", { name: /work email/i })).toHaveAttribute(\"aria-invalid\", \"true\");\n" +
                "expect(await axe(container)).toHaveNoViolations();" },
              { t: "note", variant: "tip", html: "Querying by role and accessible name in tests doubles as an accessibility check: if the test cannot find the button by its name, neither can a screen reader user." },
              { t: "quiz", id: "a11y-verify" },
              { t: "note", variant: "key", html: "<strong>Automation is the floor, not the ceiling.</strong> Scan in CI, then verify by keyboard, by screen reader and at high zoom." }
            ]
          }
        ]
      }
    ]
  };
})();
