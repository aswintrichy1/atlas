/* =====================================================================
   PIXEL · Composition Patterns
   window.TRACKS.comp — modules: patterns / api
   ===================================================================== */
(function () {
  "use strict";
  var WK = window.WK;
  var Widgets = {};
  var ACC = "#d946ef";

  /* ---------- compBooleanExplosion ---------- */
  var BOOLS = ["isEditing", "isThread", "isDM", "hideAttachments", "isCompact", "showFormatting"];
  function invalidCombo(c) {
    if (c.isThread && c.isDM) return true;            // a message is in a thread or a DM, not both
    if (c.isCompact && c.showFormatting) return true; // no room for the toolbar
    if (c.isEditing && c.hideAttachments) return true; // editing never shows attachments: redundant flag
    return false;
  }
  Widgets.compBooleanExplosion = function (mount) {
    var h = WK.h;
    WK.shell(mount, "calculator", "Boolean prop explosion",
      "Add boolean props to a <Composer> one at a time. Each flag doubles the combinations you must reason about and test. Then switch to the composition view.");
    var on = { isEditing: true, isThread: true, isDM: false, hideAttachments: false, isCompact: false, showFormatting: false };
    var view = "bool";
    var stage = h("div", { class: "w-stage" });
    var readout = h("div", { class: "w-readout" });
    function enabled() { return BOOLS.filter(function (b) { return on[b]; }); }
    function paint() {
      var en = enabled(), n = en.length, total = Math.pow(2, n), bad = 0, cells = [];
      for (var m = 0; m < total; m++) {
        var c = {};
        en.forEach(function (b, i) { c[b] = !!(m & (1 << i)); });
        var inv = invalidCombo(c);
        if (inv) bad++;
        cells.push(inv);
      }
      var modes = ["isEditing", "isThread", "isDM"].filter(function (b) { return on[b]; });
      var variants = 1 + modes.length;
      WK.clear(stage);
      var code;
      if (view === "bool") {
        code = "<Composer" + (en.length ? "\n  " + en.map(function (b) { return b + "={" + (b === "isThread" || b === "isEditing" ? "true" : "false") + "}"; }).join("\n  ") + "\n" : " ") + "/>";
      } else {
        var names = { isEditing: "EditMessageComposer", isThread: "ThreadComposer", isDM: "DirectMessageComposer" };
        code = "// shared internals, explicit variants\nfunction ChannelComposer() {\n  return (\n    <Composer.Provider state={useChannelDraft()}>\n      <Composer.Frame>\n        <Composer.Input />\n" +
          (on.showFormatting ? "        <Composer.Formatting />\n" : "") +
          (on.hideAttachments ? "" : "        <Composer.Attachments />\n") +
          "        <Composer.Submit />\n      </Composer.Frame>\n    </Composer.Provider>\n  );\n}" +
          modes.map(function (b) { return "\nfunction " + names[b] + "() { /* same parts, its own provider */ }"; }).join("");
      }
      stage.appendChild(h("pre", { style: "margin:0 0 12px;font-family:var(--font-mono);font-size:0.78rem;color:var(--text);white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;" }, code));
      if (view === "bool") {
        var grid = h("div", { style: "display:flex;flex-wrap:wrap;gap:4px;", "aria-label": total + " combinations, " + bad + " invalid", role: "img" });
        cells.forEach(function (inv) { grid.appendChild(h("span", { style: "width:18px;height:18px;border-radius:4px;" + (inv ? WK.tint(WK.BAD, 45) : WK.tint(ACC, 30)) })); });
        stage.appendChild(grid);
        stage.appendChild(h("p", { style: "margin:10px 0 0;font-size:0.84rem;color:var(--text);" }, "Each square is one combination of the flags you added; red ones are states that make no sense but the API still allows."));
      } else {
        stage.appendChild(h("p", { style: "margin:0;font-size:0.84rem;color:var(--text);" }, "Optional parts are included or left out at the call site, so they are not runtime states. You ship and test " + variants + " explicit component" + (variants === 1 ? "" : "s") + "."));
      }
      WK.readout(readout, view === "bool"
        ? [["boolean props", n], ["combinations", total], ["invalid combinations", bad]]
        : [["explicit variants", variants], ["invalid states", 0], ["tests needed", variants]]);
    }
    var toggles = BOOLS.map(function (b) { return WK.toggle(b, on[b], function (v) { on[b] = v; paint(); }); });
    mount.appendChild(h("div", { class: "widget-controls" }, WK.segment([["bool", "Boolean props"], ["comp", "Composition"]], 0, function (v) { view = v; paint(); }, "API style")));
    mount.appendChild(h("div", { class: "widget-controls" }, toggles));
    mount.appendChild(stage);
    mount.appendChild(readout);
    paint();
  };

  /* ---------- compPatternPicker ---------- */
  var PATTERNS = {
    children: { name: "children / slots", code: "<Card>\n  <Card.Header>Plan</Card.Header>\n  {body}\n</Card>", cost: "Parent cannot control child internals." },
    compound: { name: "Compound components", code: "<Tabs defaultValue=\"a\">\n  <Tabs.List><Tabs.Trigger value=\"a\">A</Tabs.Trigger></Tabs.List>\n  <Tabs.Panel value=\"a\">…</Tabs.Panel>\n</Tabs>", cost: "Needs context plumbing; parts only work inside the root." },
    renderprop: { name: "Render prop", code: "<VirtualList items={rows} renderRow={(row) => <Row {...row} />} />", cost: "Inline functions per render; nesting gets noisy." },
    headless: { name: "Headless hook", code: "const { getInputProps, getMenuProps, getItemProps } = useCombobox({ items });", cost: "You own all markup and styling." },
    provider: { name: "Provider with a state/actions interface", code: "<ComposerProvider state={draft} actions={{ submit, update }}>\n  <Composer.Input />\n</ComposerProvider>", cost: "An interface to design and keep stable." },
    variant: { name: "variant enum prop", code: "<Button variant=\"danger\" size=\"sm\">Delete</Button>", cost: "Fine for looks; wrong for behaviour differences." },
    explicit: { name: "Explicit variant components", code: "<EditMessageComposer />  // vs <ThreadComposer />, sharing parts", cost: "More named components to document." }
  };
  var REQS = [
    ["tabs", "Tabs whose markup varies page by page", "compound"],
    ["virtual", "Reuse list virtualization with unknown row UI", "renderprop"],
    ["combobox", "Dropdown needing full a11y but brand-specific styling", "headless"],
    ["modal", "Modal used with three different footers", "children"],
    ["drill", "Avoid passing user through five layers", "provider"],
    ["swap", "Same composer UI over local state or a server store", "provider"],
    ["looks", "Button with primary / secondary / danger looks", "variant"],
    ["modes", "Composer behaves differently when editing vs in a thread", "explicit"]
  ];
  Widgets.compPatternPicker = function (mount) {
    var h = WK.h;
    WK.shell(mount, "chooser", "Pick the composition pattern",
      "Choose a requirement. The matching pattern lights up with a sketch and its main cost.");
    var cur = REQS[0];
    var grid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;" });
    var detail = h("div", { style: "margin-top:12px;" });
    var readout = h("div", { class: "w-readout" });
    function paint() {
      WK.clear(grid);
      Object.keys(PATTERNS).forEach(function (k) {
        var hit = k === cur[2];
        grid.appendChild(h("div", { style: "border-radius:10px;padding:10px;font-size:0.84rem;font-weight:600;" + (hit ? WK.tint(ACC, 26) : "border:1px solid var(--line);background:var(--surface-solid);color:var(--text-dim);") }, PATTERNS[k].name));
      });
      var p = PATTERNS[cur[2]];
      WK.clear(detail);
      detail.appendChild(h("pre", { style: "margin:0;font-family:var(--font-mono);font-size:0.78rem;color:var(--text);white-space:pre-wrap;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;" }, p.code));
      WK.readout(readout, [["requirement", cur[1]], ["pattern", p.name], ["cost", p.cost]]);
    }
    mount.appendChild(h("div", { class: "widget-controls" },
      WK.field("requirement", WK.select(REQS.map(function (r) { return [r[0], r[1]]; }), cur[0], function (v) { cur = REQS.filter(function (r) { return r[0] === v; })[0] || REQS[0]; paint(); }, "Requirement")),
      WK.btn("Next", function () { var i = REQS.indexOf(cur); cur = REQS[(i + 1) % REQS.length]; var s = mount.querySelector("select"); if (s) s.value = cur[0]; paint(); }, "primary")));
    mount.appendChild(h("div", { class: "w-stage" }, grid, detail));
    mount.appendChild(readout);
    paint();
  };

  window.Widgets = Object.assign(window.Widgets || {}, Widgets);

  window.QUIZZES = Object.assign(window.QUIZZES || {}, {
    "comp-patterns": {
      title: "Composition patterns checkpoint",
      sub: "Children, compound components, render props and headless hooks.",
      questions: [
        { q: "A Tabs component needs callers to place triggers and panels in any markup. Which pattern fits best?", options: ["One <Tabs items={[...]}> prop with an array", "Compound components sharing state through context", "A global store", "Inheritance from a base class"], answer: 1,
          explain: "Compound components let callers compose Tabs.List, Tabs.Trigger and Tabs.Panel freely while the root owns the selected value through context." },
        { q: "Why is passing elements as children a cheap fix for prop drilling?", options: ["Children are global", "The parent that creates the element passes data directly, so intermediate layers never see it", "Children skip rendering", "It enables server components automatically"], answer: 1,
          explain: "When a layout component renders {children}, the data is bound where the element is created. The layers in between no longer need to forward props." },
        { q: "What does a headless component or hook provide?", options: ["Styles only", "Behaviour, state and accessibility wiring with no markup or styles", "Server rendering", "A design token set"], answer: 1,
          explain: "Headless pieces give you keyboard handling, ARIA attributes and state through prop getters, while you own every element and style." },
        { q: "When is a render prop still a good choice over a hook?", options: ["Never", "When a component must control where and how many times caller UI is rendered, like a virtualized list rendering only visible rows", "When styling buttons", "For global state"], answer: 1,
          explain: "A virtualized list decides which rows exist; the caller supplies how a row looks. That inversion is exactly what a render prop expresses." }
      ]
    },
    "comp-api": {
      title: "Component API design checkpoint",
      sub: "Boolean props, explicit variants and provider interfaces.",
      questions: [
        { q: "A component has five independent boolean props. How many combinations exist?", options: ["5", "10", "25", "32"], answer: 3,
          explain: "Each boolean doubles the space: 2 to the power of 5 is 32. Many are usually invalid, yet the API allows them all." },
        { q: "A Composer behaves differently when editing a message versus replying in a thread. What is the recommended API?", options: ["isEditing and isThread booleans", "Explicit variant components like EditMessageComposer and ThreadComposer that share internal parts", "A mode string checked in twenty places", "Two copied components with no shared code"], answer: 1,
          explain: "Explicit variants make each supported case a named component built from shared parts, so impossible combinations cannot be written." },
        { q: "What does a provider with a generic { state, actions, meta } interface enable?", options: ["Faster CSS", "The same UI to run over local state, a server-synced store, or a test fake by swapping the provider", "Avoiding React entirely", "Removing all props"], answer: 1,
          explain: "When only the provider knows how state is stored, the UI depends on an interface. Swapping implementations does not touch the components." },
        { q: "In React 19, how does a function component accept a ref?", options: ["Only via forwardRef", "As a regular ref prop", "Through context only", "It cannot"], answer: 1,
          explain: "React 19 passes ref as a normal prop to function components, so forwardRef is no longer needed for new code." },
        { q: "When is a variant enum prop (variant=\"danger\") appropriate?", options: ["For visual styles of one component with the same behaviour", "For completely different behaviours", "Never", "Only for icons"], answer: 0,
          explain: "Enums suit mutually exclusive looks. When behaviour diverges, separate components or composition keep each path simple." }
      ]
    }
  });

  window.TRACKS = window.TRACKS || {};
  window.TRACKS.comp = {
    id: "comp",
    name: "Composition Patterns",
    short: "COMP",
    tagline: "Compose, don't configure",
    color: ACC,
    blurb: "Build components that scale with your product instead of sprouting flags: children and slots, compound components, render props, headless hooks, explicit variants instead of boolean props, and providers that hide how state is stored.",
    modules: [
      {
        id: "patterns",
        name: "Composition Patterns",
        icon: "blocks",
        lessons: [
          {
            id: "children-composition",
            title: "Children, slots and composition over configuration",
            summary: "Let callers pass UI in rather than describing every variation through props.",
            minutes: 8,
            tags: ["children", "slots", "prop-drilling"],
            blocks: [
              { t: "p", html: "The most powerful prop in React is <code class='tok'>children</code>. A component that renders what it is given stays small, and callers can put anything inside without the component knowing." },
              { t: "compare",
                bad: { title: "Configuration", items: ["<code class='tok'>&lt;Card title subtitle icon footerText showFooter /&gt;</code>", "Every new need adds a prop", "Layout rules hard-coded inside"] },
                good: { title: "Composition", items: ["<code class='tok'>&lt;Card&gt;&lt;Card.Header/&gt;…&lt;/Card&gt;</code>", "Callers decide content and order", "The component owns only frame and spacing"] } },
              { t: "code", lang: "javascript", code:
                "// layout component: knows nothing about the user\n" +
                "function PageShell({ sidebar, children }) {\n" +
                "  return (\n" +
                "    <div className=\"shell\">\n" +
                "      <aside>{sidebar}</aside>\n" +
                "      <main>{children}</main>\n" +
                "    </div>\n" +
                "  );\n" +
                "}\n\n" +
                "// data is bound where the element is created: no drilling through PageShell\n" +
                "<PageShell sidebar={<AccountMenu user={user} />}>\n" +
                "  <Dashboard user={user} />\n" +
                "</PageShell>" },
              { t: "ul", items: [
                "Named slots are just props that hold elements: <code class='tok'>sidebar</code>, <code class='tok'>actions</code>, <code class='tok'>icon</code>.",
                "Prefer <code class='tok'>children</code> for structure over <code class='tok'>renderHeader()</code>-style props; use functions only when the component must pass data back.",
                "Elements passed as children are created by the parent, so they do not re-render when the wrapper's own state changes."
              ] },
              { t: "note", variant: "tip", html: "Before adding a prop, ask: could the caller just pass the element? If yes, a slot is usually simpler and more flexible." },
              { t: "note", variant: "key", html: "<strong>Accept UI, don't describe it.</strong> Children and element slots keep components small, kill prop drilling and let callers own content." }
            ]
          },
          {
            id: "compound-components",
            title: "Compound components with shared context",
            summary: "A root owns state; small parts read it through context and can be arranged freely.",
            minutes: 10,
            tags: ["compound-components", "context", "design-systems"],
            blocks: [
              { t: "p", html: "Think of <code class='tok'>&lt;select&gt;</code> and <code class='tok'>&lt;option&gt;</code>: separate tags that only make sense together. Compound components give your own widgets the same shape — a <strong>root that owns state</strong> and <strong>parts that consume it</strong>." },
              { t: "code", lang: "javascript", code:
                "const TabsCtx = createContext(null);\n" +
                "function useTabs() {\n" +
                "  const ctx = use(TabsCtx);               // React 19; useContext works too\n" +
                "  if (!ctx) throw new Error(\"Tabs parts must be inside <Tabs>\");\n" +
                "  return ctx;\n" +
                "}\n\n" +
                "function Tabs({ defaultValue, children }) {\n" +
                "  const [value, setValue] = useState(defaultValue);\n" +
                "  const ctx = useMemo(() => ({ value, setValue }), [value]);\n" +
                "  return <TabsCtx.Provider value={ctx}>{children}</TabsCtx.Provider>;\n" +
                "}\n" +
                "Tabs.Trigger = function Trigger({ value, children }) {\n" +
                "  const t = useTabs();\n" +
                "  return <button role=\"tab\" aria-selected={t.value === value} onClick={() => t.setValue(value)}>{children}</button>;\n" +
                "};\n" +
                "Tabs.Panel = function Panel({ value, children }) {\n" +
                "  return useTabs().value === value ? <div role=\"tabpanel\">{children}</div> : null;\n" +
                "};" },
              { t: "table", headers: ["Benefit", "Cost"], rows: [
                ["Callers control markup, order and wrappers", "Parts only work inside the root"],
                ["No giant items/config prop", "Context plumbing and a guard hook"],
                ["Each part has a tiny API", "Harder to enforce required structure"]
              ] },
              { t: "note", variant: "trap", html: "Avoid <code class='tok'>React.Children.map</code> + <code class='tok'>cloneElement</code> to inject props. It breaks as soon as a caller wraps a part in a div or a fragment; context does not." },
              { t: "widget", id: "compPatternPicker" },
              { t: "note", variant: "key", html: "<strong>The root owns state, the parts read it from context.</strong> Callers compose freely, and the API stays small no matter how many layouts you need." }
            ]
          },
          {
            id: "render-props-headless",
            title: "Render props and headless components",
            summary: "Separate behaviour from presentation: share logic, let callers own every pixel.",
            minutes: 10,
            tags: ["render-props", "headless", "hooks", "a11y"],
            blocks: [
              { t: "p", html: "Some components are mostly <strong>behaviour</strong>: keyboard handling, ARIA wiring, focus, open/close state. Packaging that behaviour without markup lets every brand reuse it." },
              { t: "table", headers: ["Shape", "Looks like", "Choose it when"], rows: [
                ["Custom hook", "<code class='tok'>const s = useDisclosure()</code>", "Logic only; caller renders everything"],
                ["Headless hook with prop getters", "<code class='tok'>getInputProps()</code>, <code class='tok'>getItemProps(i)</code>", "Complex a11y widget, custom markup"],
                ["Render prop", "<code class='tok'>renderRow={(row) =&gt; …}</code>", "The component decides when and how often caller UI renders"],
                ["Styled component on top", "<code class='tok'>&lt;Combobox /&gt;</code>", "Your design system's default look"]
              ] },
              { t: "code", lang: "javascript", code:
                "function CitySearch({ cities }) {\n" +
                "  const cb = useCombobox({ items: cities, itemToString: (c) => c.name });\n" +
                "  return (\n" +
                "    <div>\n" +
                "      <label {...cb.getLabelProps()}>City</label>\n" +
                "      <input {...cb.getInputProps()} className=\"field\" />\n" +
                "      <ul {...cb.getMenuProps()} className=\"menu\">\n" +
                "        {cb.isOpen && cb.items.map((c, i) => (\n" +
                "          <li key={c.id} {...cb.getItemProps({ item: c, index: i })}>{c.name}</li>\n" +
                "        ))}\n" +
                "      </ul>\n" +
                "    </div>\n" +
                "  );\n" +
                "}" },
              { t: "note", variant: "tip", html: "Prop getters merge your handlers with theirs. Always spread them and pass extra props through the getter instead of overriding <code class='tok'>onKeyDown</code> after the spread." },
              { t: "cue", html: "<strong>Spotting it in a prompt:</strong> \"same dropdown, three brands\", \"we need full keyboard support but custom styles\", \"share list logic with different row UI\" — reach for a headless hook or a render prop." },
              { t: "quiz", id: "comp-patterns" },
              { t: "note", variant: "key", html: "<strong>Ship behaviour separately from looks.</strong> Hooks and prop getters carry state and accessibility; callers own markup, and render props hand control back only where the component must decide." }
            ]
          }
        ]
      },
      {
        id: "api",
        name: "Designing Component APIs",
        icon: "diamond",
        lessons: [
          {
            id: "boolean-props",
            title: "Boolean prop explosion and explicit variants",
            summary: "Every boolean doubles the state space. Replace mode flags with explicit components built from shared parts.",
            minutes: 11,
            tags: ["boolean-props", "variants", "api-design"],
            blocks: [
              { t: "p", html: "It starts innocently: <code class='tok'>isCompact</code>. Then <code class='tok'>isThread</code>, <code class='tok'>isEditing</code>, <code class='tok'>hideAttachments</code>. Each flag <strong>doubles</strong> the combinations, most of which nobody designed, and the component fills with <code class='tok'>if</code> chains." },
              { t: "widget", id: "compBooleanExplosion" },
              { t: "stat", items: [{ v: "2ⁿ", k: "combinations for n booleans" }, { v: "64", k: "states from six flags" }, { v: "1", k: "named component per real use case" }] },
              { t: "table", headers: ["Tier", "API", "Consequence"], rows: [
                ["Naive", "<code class='tok'>&lt;Composer isThread isEditing hideAttachments /&gt;</code>", "Impossible states compile; every change risks every mode"],
                ["Solid", "<code class='tok'>&lt;Composer mode=\"thread\" /&gt;</code> enum", "Exclusive modes enforced; internals still branch"],
                ["Standout", "<code class='tok'>&lt;ThreadComposer /&gt;</code>, <code class='tok'>&lt;EditMessageComposer /&gt;</code> composed from shared parts", "Each variant is readable on its own; no dead combinations"]
              ] },
              { t: "code", lang: "javascript", code:
                "function EditMessageComposer({ message }) {\n" +
                "  return (\n" +
                "    <Composer.Provider state={useEditDraft(message)}>\n" +
                "      <Composer.Frame>\n" +
                "        <Composer.Input />\n" +
                "        <Composer.Footer>\n" +
                "          <Composer.Cancel />\n" +
                "          <Composer.Save />\n" +
                "        </Composer.Footer>\n" +
                "      </Composer.Frame>\n" +
                "    </Composer.Provider>\n" +
                "  );\n" +
                "}" },
              { t: "note", variant: "tip", html: "Enums are still right for purely visual options of one behaviour: <code class='tok'>variant=\"danger\"</code>, <code class='tok'>size=\"sm\"</code>. The smell is booleans that change <em>behaviour</em>." },
              { t: "note", variant: "key", html: "<strong>Booleans multiply states; named variants enumerate them.</strong> Use enums for looks, explicit components built from shared parts for behaviour." }
            ]
          },
          {
            id: "context-interface",
            title: "Providers as interfaces: state, actions, meta",
            summary: "Only the provider knows how state is stored; the UI depends on a small, stable interface.",
            minutes: 10,
            tags: ["context", "dependency-injection", "react-19"],
            blocks: [
              { t: "p", html: "If <code class='tok'>Composer.Input</code> imports a specific store, it can only ever work with that store. Instead, let it depend on an <strong>interface</strong> — what it can read and what it can do — and let a provider decide the implementation." },
              { t: "code", lang: "javascript", code:
                "// the contract every composer part depends on\n" +
                "// { state: { text, attachments }, actions: { update, submit }, meta: { canSubmit, isSubmitting } }\n" +
                "const ComposerCtx = createContext(null);\n\n" +
                "function LocalComposerProvider({ children, onSend }) {\n" +
                "  const [text, setText] = useState(\"\");\n" +
                "  const value = useMemo(() => ({\n" +
                "    state: { text, attachments: [] },\n" +
                "    actions: { update: setText, submit: () => onSend(text) },\n" +
                "    meta: { canSubmit: text.trim().length > 0, isSubmitting: false },\n" +
                "  }), [text, onSend]);\n" +
                "  return <ComposerCtx.Provider value={value}>{children}</ComposerCtx.Provider>;\n" +
                "}\n" +
                "// SyncedComposerProvider implements the same shape over a server store;\n" +
                "// tests use a FakeComposerProvider. The parts never change." },
              { t: "table", headers: ["Gain", "Price"], rows: [
                ["Swap local, synced or fake implementations freely", "Design and version the interface"],
                ["Parts are trivially testable", "One more layer to read"],
                ["Siblings outside the visual frame can read the same provider", "Provider placement must be deliberate"]
              ] },
              { t: "ul", items: [
                "<strong>Lift state into the provider</strong> when a sibling outside the component (a header counter, a preview pane) needs it.",
                "React 19: read context with <code class='tok'>use(Ctx)</code>, which can also be called conditionally, and receive <code class='tok'>ref</code> as a plain prop instead of <code class='tok'>forwardRef</code>.",
                "Split rarely-changing actions from fast-changing state if re-renders show up in profiling."
              ] },
              { t: "note", variant: "warn", html: "Do not leak implementation details through the interface (raw query objects, store instances). The moment a part reaches past the interface, swapping providers breaks." },
              { t: "quiz", id: "comp-api" },
              { t: "note", variant: "key", html: "<strong>The provider is the only place that knows how state works.</strong> Parts consume { state, actions, meta }, so implementations can change without touching UI." }
            ]
          }
        ]
      }
    ]
  };
})();
